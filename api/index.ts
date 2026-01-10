import request from '../utils/request';
import type { AxiosProgressEvent } from 'axios';
import { CanceledError } from 'axios';

// Chat Completion
export const chatCompletion = (param: any) => {
    return request({
        url: '/ai/chat/completion',
        method: 'post',
        data: param,
    });
};

// Streaming Chat Completion
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
                if (parsed.type === 'error') {
                    onError(parsed.message);
                    hasCompleted = true;
                    return;
                }
                if (parsed.content) {
                    onData(parsed.content);
                }
            } catch (e) {
                console.error('Error parsing SSE message:', e);
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

    try {
        await request.post(
            '/ai/chat/stream',
            {
                messages: [
                    {
                        role: 'user',
                        content: param.message,
                    },
                ],
                usingContext: param.usingContext,
                history: param.history,
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

