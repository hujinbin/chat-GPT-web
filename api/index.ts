import { chatContent, ChatHistoryMessage, ImageAttachment } from './attachments';
import { API_BASE_URL } from '../utils/request';
import request from '../utils/request';

// 模型分组（从后端获取）
export interface ModelOption {
    key: string;
    label: string;
    models: string[];
    default_model: string;
}

// 默认模型（后端 agnes 系列最新模型）
export const DEFAULT_MODEL = 'agnes-3.0-flash';

// 联网搜索来源
export interface SearchSource {
    title: string;
    url: string;
    snippet?: string;
}

// 后端搜索事件中可能出现的来源字段名
const SOURCE_FIELD_NAMES = ['search_results', 'citations', 'sources', 'annotations', 'web_search_results'];

/**
 * 解析后端 event: search 事件的数据，兼容多种来源字段结构
 */
export const extractSearchSources = (payload: unknown): SearchSource[] => {
    if (!payload || typeof payload !== 'object') {
        return [];
    }

    const sources: SearchSource[] = [];
    const record = payload as Record<string, unknown>;

    for (const field of SOURCE_FIELD_NAMES) {
        const value = record[field];
        if (!Array.isArray(value)) {
            continue;
        }

        for (const item of value) {
            if (typeof item === 'string') {
                sources.push({ title: item, url: item });
                continue;
            }
            if (!item || typeof item !== 'object') {
                continue;
            }

            const entry = item as Record<string, unknown>;
            const url = String(entry.url ?? entry.link ?? entry.source ?? '');
            const title = String(entry.title ?? entry.name ?? entry.site_name ?? url);
            const snippet = entry.snippet ?? entry.text ?? entry.content ?? entry.description;

            if (!url && !title) {
                continue;
            }

            sources.push({
                title: title || url,
                url,
                snippet: typeof snippet === 'string' ? snippet : undefined,
            });
        }
    }

    return sources;
};

// 从后端获取可用模型列表
export const fetchModelOptions = async (): Promise<ModelOption[]> => {
    try {
        const res = await fetch(`${API_BASE_URL}/ai/models`);
        const json = await res.json();
        if (json.code === 200 && Array.isArray(json.data)) {
            return json.data;
        }
        return [];
    } catch {
        return [];
    }
};

// Chat Completion（非流式）
export const chatCompletion = (param: any) => {
    return request({
        url: '/ai/chat/completion',
        method: 'post',
        data: param,
    });
};

/**
 * 流式对话接口 - 使用原生 fetch + ReadableStream 解析标准SSE
 * 
 * SSE事件格式：
 *   event: connect\ndata: {"message":"连接成功","model":"xxx"}\n\n
 *   event: stage\ndata: {"stage":"search_start","message":"正在联网检索…"}\n\n
 *   event: search\ndata: {"search_results":[...]}\n\n
 *   event: message\ndata: {"content":"文字片段"}\n\n
 *   event: error\ndata: {"message":"错误信息"}\n\n
 *   event: done\ndata: {}\n\n
 */
export const chatCompletionStream = async (
    param: {
        message: string;
        usingContext?: boolean;
        search?: boolean;
        history?: ChatHistoryMessage[];
        images?: ImageAttachment[];
        model?: string;
    },
    onData: (content: string) => void,
    onSearch: (sources: SearchSource[]) => void,
    onError: (error: string) => void,
    onDone: () => void,
    options?: {
        signal?: AbortSignal;
        onStage?: (stage: string, message: string, metadata?: Record<string, unknown>) => void;
    }
) => {
    const messages = param.usingContext ? [...(param.history || [])] : [];
    messages.push({ role: 'user', content: chatContent(param.message, param.images) });

    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let completed = false;
    let reachedEOF = false;
    let callbackFailed = false;

    // 回调异常交由调用方处理，避免被当作 JSON 或网络错误后再次触发终止回调。
    const invoke = (callback: () => void) => {
        try {
            callback();
        } catch (error) {
            callbackFailed = true;
            throw error;
        }
    };
    const finish = () => {
        if (completed) return;
        completed = true;
        invoke(onDone);
    };
    const fail = (message: string) => {
        if (completed) return;
        completed = true;
        invoke(() => onError(message));
    };

    try {
        const response = await fetch(`${API_BASE_URL}/ai/chat/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages, model: param.model || DEFAULT_MODEL, search: param.search !== false }),
            signal: options?.signal,
        });

        if (!response.ok) {
            const text = await response.text();
            let message = `请求失败 (${response.status})`;
            try {
                const error = JSON.parse(text);
                message = error.msg || error.message || error.error?.message || message;
            } catch {
                // 非 JSON 错误页仅显示状态，避免把代理服务器 HTML 当成回复。
            }
            fail(message);
            return;
        }
        if (!response.headers.get('Content-Type')?.includes('text/event-stream')) {
            fail('服务器未返回流式响应，请检查 AI 接口与反向代理配置');
            return;
        }
        reader = response.body?.getReader();
        if (!reader) {
            fail('无法获取响应流');
            return;
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let eventName = '';
        let dataLines: string[] = [];

        const dispatch = () => {
            const name = eventName || 'message';
            const text = dataLines.join('\n');
            // SSE 的 event 字段只对当前事件有效。
            eventName = '';
            dataLines = [];
            if (!text || completed) return;
            if (text.trim() === '[DONE]') {
                finish();
                return;
            }
            if (!['stage', 'search', 'message', 'error', 'done'].includes(name)) return;
            let data: Record<string, any>;
            try {
                const parsed = JSON.parse(text);
                if (!parsed || typeof parsed !== 'object') throw new Error('invalid event');
                data = parsed;
            } catch {
                throw new Error('流式响应数据格式错误，请重试');
            }
            if (name === 'error' || data.error) {
                fail(String(data.message || data.error?.message || (typeof data.error === 'string' ? data.error : 'AI 服务返回错误')));
                return;
            }
            if (name === 'done') {
                finish();
                return;
            }
            if (name === 'stage') {
                if (typeof data.message === 'string') {
                    invoke(() => options?.onStage?.(String(data.stage || ''), data.message, data));
                }
                return;
            }
            if (name === 'search' || name === 'message') {
                const sources = extractSearchSources(data);
                if (sources.length) invoke(() => onSearch(sources));
            }
            if (name === 'message') {
                const choice = Array.isArray(data.choices) ? data.choices[0] : undefined;
                const content = typeof data.content === 'string' ? data.content : choice?.delta?.content;
                if (typeof content === 'string' && content) invoke(() => onData(content));
                if (choice?.finish_reason) finish();
            }
        };

        const processLine = (line: string) => {
            if (!line) {
                dispatch();
                return;
            }
            if (line.startsWith(':')) return;
            const colon = line.indexOf(':');
            const field = colon < 0 ? line : line.slice(0, colon);
            let value = colon < 0 ? '' : line.slice(colon + 1);
            if (value.startsWith(' ')) value = value.slice(1);
            if (field === 'event') eventName = value;
            if (field === 'data') dataLines.push(value);
        };

        const processBuffer = (final = false) => {
            while (!completed) {
                const index = buffer.search(/[\r\n]/);
                if (index < 0) break;
                // 等待下一块，防止将跨块的 CRLF 拆成两个空行。
                if (buffer[index] === '\r' && index === buffer.length - 1 && !final) break;
                const line = buffer.slice(0, index);
                const width = buffer[index] === '\r' && buffer[index + 1] === '\n' ? 2 : 1;
                buffer = buffer.slice(index + width);
                processLine(line);
            }
            if (final && !completed) {
                if (buffer) processLine(buffer);
                buffer = '';
                dispatch();
            }
        };

        while (!completed) {
            const { done, value } = await reader.read();
            if (done) {
                reachedEOF = true;
                buffer += decoder.decode();
                processBuffer(true);
                break;
            }
            buffer += decoder.decode(value, { stream: true });
            processBuffer();
        }
        if (!completed) fail('回复连接提前中断，已收到的内容已保留，可重试或继续追问');
    } catch (error) {
        if (callbackFailed) throw error;
        if (options?.signal?.aborted) {
            throw options.signal.reason || new DOMException('请求已取消', 'AbortError');
        }
        const detail = error as { name?: string; message?: string } | undefined;
        if (detail?.name === 'AbortError') throw error;
        fail(typeof detail?.message === 'string' ? detail.message : '连接出错');
    } finally {
        if (reader) {
            if (!reachedEOF) {
                try { await reader.cancel(); } catch { /* 连接已关闭时仍需释放读取锁。 */ }
            }
            reader.releaseLock();
        }
    }
};

// 文件内容抽取
export const fileExtraction = (param: any) => {
    return request({
        url: '/ai/file/extraction',
        method: 'post',
        data: param,
    });
};
