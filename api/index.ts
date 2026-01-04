import request from '../utils/request';

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
    try {
        const response = await fetch('/api/ai/chat/stream', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: [
                    {
                        role: 'user',
                        content: param.message
                    }
                ],
                usingContext: param.usingContext,
                history: param.history
            }),
            signal: options?.signal
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            
            // 处理SSE格式的消息
            const messages = buffer.split('\n\n');
            buffer = messages.pop() || '';

            for (const message of messages) {
                if (!message.startsWith('data:')) continue;

                const data = message.slice(5).trim();
                if (data === '[DONE]') {
                    onDone();
                    return;
                }

                try {
                    const parsed = JSON.parse(data);
                    if (parsed.type === 'error') {
                        onError(parsed.message);
                        return;
                    } else if (parsed.content) {
                        onData(parsed.content);
                    }
                } catch (e) {
                    console.error('Error parsing SSE message:', e);
                }
            }
        }

        // 处理最后的buffer
        if (buffer.startsWith('data:')) {
            const data = buffer.slice(5).trim();
            if (data === '[DONE]') {
                onDone();
            } else {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.type === 'error') {
                        onError(parsed.message);
                    } else if (parsed.content) {
                        onData(parsed.content);
                    }
                } catch (e) {
                    console.error('Error parsing final SSE message:', e);
                }
            }
        }
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
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

