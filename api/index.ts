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
        history?: Array<{ role: string; content: string }>;
        model?: string;
    },
    onData: (content: string) => void,
    onSearch: (sources: SearchSource[]) => void,
    onError: (error: string) => void,
    onDone: () => void,
    options?: { signal?: AbortSignal; onStage?: (stage: string, message: string) => void }
) => {
    const url = `${API_BASE_URL}/ai/chat/stream`;

    // 构建消息列表
    const messages: Array<{ role: string; content: string }> = [];
    if (param.history && param.usingContext) {
        messages.push(...param.history);
    }
    messages.push({ role: 'user', content: param.message });

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            messages,
            model: param.model || DEFAULT_MODEL,
            search: param.search !== false,
        }),
        signal: options?.signal,
    });

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        onError(text || `请求失败 (${response.status})`);
        return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
        onError('无法获取响应流');
        return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = '';
    let hasCompleted = false;

    const processSSEEvents = () => {
        // SSE 以 \n\n 分隔事件
        const parts = buffer.split('\n\n');
        // 最后一段可能不完整，保留在 buffer 中
        buffer = parts.pop() || '';

        for (const part of parts) {
            if (!part.trim()) continue;

            let eventType = '';
            let dataStr = '';

            for (const line of part.split('\n')) {
                if (line.startsWith('event:')) {
                    eventType = line.slice(6).trim();
                } else if (line.startsWith('data:')) {
                    dataStr = line.slice(5).trim();
                }
            }

            if (!eventType && !dataStr) continue;

            // 如果没有 event 字段，使用上一次的 currentEvent
            if (eventType) {
                currentEvent = eventType;
            }

            try {
                const data = dataStr ? JSON.parse(dataStr) : {};

                switch (currentEvent) {
                    case 'connect':
                        // 连接成功，不需要特别处理
                        break;
                    case 'stage':
                        // 处理阶段提示（如"正在联网检索…"）
                        if (data.message && options?.onStage) {
                            options.onStage(String(data.stage || ''), String(data.message));
                        }
                        break;
                    case 'message':
                        if (data.content) {
                            onData(data.content);
                        }
                        break;
                    case 'search': {
                        // 联网搜索来源，按片段实时下发
                        const sources = extractSearchSources(data);
                        if (sources.length) {
                            onSearch(sources);
                        }
                        break;
                    }
                    case 'error':
                        onError(data.message || '未知错误');
                        hasCompleted = true;
                        return;
                    case 'done':
                        hasCompleted = true;
                        onDone();
                        return;
                }
            } catch {
                // 忽略JSON解析错误
            }
        }
    };

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            processSSEEvents();

            if (hasCompleted) break;
        }

        // 处理 buffer 中剩余的数据
        if (buffer.trim() && !hasCompleted) {
            // 确保以 \n\n 结尾来触发最后的事件处理
            buffer += '\n\n';
            processSSEEvents();
        }

        if (!hasCompleted) {
            onDone();
        }
    } catch (error: any) {
        if (error?.name === 'AbortError') {
            throw error; // 让调用方处理取消
        }
        onError(error instanceof Error ? error.message : '连接出错');
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
