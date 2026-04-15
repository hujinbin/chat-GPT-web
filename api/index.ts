import request from '../utils/request';
import type { AxiosProgressEvent } from 'axios';
import { CanceledError } from 'axios';

// 支持的模型列表
export interface ModelOption {
    key: string;
    label: string;
    models: string[];
    defaultModel: string;
}

export const MODEL_OPTIONS: ModelOption[] = [
    { key: 'moonshot', label: 'Moonshot', models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'], defaultModel: 'moonshot-v1-8k' },
    { key: 'zhipu', label: 'ZhiPu', models: ['glm-4', 'glm-4-flash', 'glm-4-plus'], defaultModel: 'glm-4-flash' },
    { key: 'qwen', label: 'Qwen', models: ['qwen-turbo', 'qwen-plus', 'qwen-max'], defaultModel: 'qwen-turbo' },
    { key: 'deepseek', label: 'DeepSeek', models: ['deepseek-chat', 'deepseek-reasoner'], defaultModel: 'deepseek-chat' },
    { key: 'minmax', label: 'MinMax', models: ['abab6.5s-chat', 'abab6.5-chat', 'abab6.5g-chat'], defaultModel: 'abab6.5s-chat' },
];

// Chat Completion
export const chatCompletion = (param: any) => {
    return request({
        url: '/ai/chat/completion',
        method: 'post',
        data: param,
    });
};

// Streaming Chat Completion（支持模型选择）
export const chatCompletionStream = async (
    param: any,
    onData: (data: string) => void,
    onError: (error: string) => void,
    onDone: () => void,
    options?: { signal?: AbortSignal }
) => {
    let buffer = '';
    let lastIndex = 0;
    let hasCompleted = false;

    const flushBuffer = (isFinal: boolean) => {
        if (!buffer) return;

        const segments = buffer.split('\n\n');
        if (!isFinal) {
            buffer = segments.pop() || '';
        }

        for (const segment of segments) {
            if (!segment.startsWith('data:')) continue;

            const data = segment.slice(5).trim();
            if (data === '[DONE]') {
                if (!hasCompleted) {
                    hasCompleted = true;
                    onDone();
                }
                return;
            }

            try {
                const parsed = JSON.parse(data);

                // 兼容两种格式：
                // 1. 自定义格式: { type: "error", message: "..." } 或 { content: "..." }
                // 2. OpenAI 标准格式: { choices: [{ delta: { content: "..." } }] }
                if (parsed.type === 'error') {
                    onError(parsed.message);
                    hasCompleted = true;
                    return;
                }

                // OpenAI 标准流式格式
                if (parsed.choices && parsed.choices.length > 0) {
                    const delta = parsed.choices[0].delta;
                    if (delta && delta.content) {
                        onData(delta.content);
                    }
                } else if (parsed.content) {
                    // 兼容旧格式
                    onData(parsed.content);
                }
            } catch (e) {
                // 忽略解析错误（可能是 connect 事件等非JSON数据）
            }
        }

        if (isFinal) {
            buffer = '';
        }
    };

    const handleProgress = (progressEvent: AxiosProgressEvent) => {
        if (hasCompleted) return;

        const xhr = progressEvent.event?.target as XMLHttpRequest | null;
        const responseText = xhr?.responseText ?? '';
        const chunk = responseText.slice(lastIndex);

        if (!chunk) return;

        lastIndex = responseText.length;
        buffer += chunk;
        flushBuffer(false);
    };

    // 构建消息列表
    const messages = [];
    if (param.history && param.usingContext) {
        messages.push(...param.history);
    }
    messages.push({ role: 'user', content: param.message });

    try {
        await request.post(
            '/ai/chat/stream',
            {
                messages,
                model: param.model || 'moonshot-v1-8k',
            },
            {
                signal: options?.signal,
                responseType: 'text',
                transformResponse: [(data) => data],
                onDownloadProgress: handleProgress,
            }
        );

        if (!hasCompleted) {
            flushBuffer(true);
            if (!hasCompleted) {
                hasCompleted = true;
                onDone();
            }
        }
    } catch (error) {
        if (error instanceof CanceledError) {
            onError('请求已取消');
            throw error;
        }

        console.error('Streaming request failed:', error);
        onError(error instanceof Error ? error.message : '连接出错，请重试');
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
