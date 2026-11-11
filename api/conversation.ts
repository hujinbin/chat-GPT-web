import { chatContent, ChatContent, ChatHistoryMessage, ContentBlock, ImageAttachment } from './attachments';

export interface ConversationMessage {
    id?: string;
    role: 'user' | 'assistant';
    content: string;
    quote?: string;
    images?: ImageAttachment[];
    references?: ChatHistoryMessage[];
    error?: boolean;
    loading?: boolean;
    stopped?: boolean;
    media?: unknown;
}

export interface GuidanceTarget {
    messageId: string;
    content: string;
    user?: Pick<ConversationMessage, 'content' | 'quote' | 'images'>;
}

const MAX_HISTORY_MESSAGES = 20;
const MAX_REFERENCE_CHARACTERS = 8000;

function historyUserContent(message: Pick<ConversationMessage, 'content' | 'quote' | 'images'>): ChatContent {
    const text = message.quote?.trim()
        ? `引用内容：\n${message.quote}\n\n用户问题：\n${message.content}`
        : message.content;
    return chatContent(text, message.images);
}

export function completedConversationHistory(messages: ConversationMessage[], excludedAssistantId?: string): ChatHistoryMessage[] {
    const turns: ChatHistoryMessage[][] = [];
    let user: ConversationMessage | undefined;
    for (const message of messages) {
        if (message.role === 'user') {
            user = message;
            continue;
        }
        if (user && !message.id?.endsWith('-welcome') && (!excludedAssistantId || message.id !== excludedAssistantId) &&
            !message.error && !message.loading && !message.stopped && !message.media && message.content.trim() &&
            (user.content.trim() || user.images?.length)) {
            const references = validMessages(user.references || []).filter(item => item.role === 'user').slice(-2);
            turns.push([...references, { role: 'user', content: references.length ? chatContent(user.content, user.images) : historyUserContent(user) }, { role: 'assistant', content: message.content }]);
        }
        user = undefined;
    }
    const history: ChatHistoryMessage[] = [];
    for (let index = turns.length - 1; index >= 0; index--) {
        if (history.length + turns[index].length > MAX_HISTORY_MESSAGES) break;
        history.unshift(...turns[index]);
    }
    return history;
}

export function conversationRequest({ message, messages, usingContext, quote = '', images, guidance }: {
    message: string;
    messages: ConversationMessage[];
    usingContext: boolean;
    quote?: string;
    images?: ImageAttachment[];
    guidance?: GuidanceTarget;
}) {
    const references: ChatHistoryMessage[] = [];
    const context: string[] = [];
    let referenceImages: ImageAttachment[] | undefined;
    if (quote.trim()) context.push(`用户明确引用的内容：\n${quote.slice(0, MAX_REFERENCE_CHARACTERS)}`);
    if (guidance) {
        const assistantIndex = messages.findIndex(item => item.id === guidance.messageId);
        const original = guidance.user || messages.slice(0, Math.max(0, assistantIndex)).reverse().find(item => item.role === 'user');
        if (original) {
            const originalText = original.quote ? `${original.content}\n\n该问题明确引用的内容：\n${original.quote}` : original.content;
            context.push(`本次补充要求针对的原问题：\n${originalText.slice(0, MAX_REFERENCE_CHARACTERS)}`);
            referenceImages = original.images;
        }
        // 补充要求仅引用本次正在调整的回答，长回复保留最近输出片段。
        if (guidance.content.trim()) context.push(`本次补充要求针对的已生成内容片段：\n${guidance.content.slice(-MAX_REFERENCE_CHARACTERS)}`);
    }
    if (context.length || referenceImages?.length) references.push({ role: 'user', content: chatContent(context.join('\n\n'), referenceImages) });
    return {
        message,
        usingContext,
        history: usingContext ? completedConversationHistory(messages, guidance?.messageId) : undefined,
        references,
        targetUser: {
            content: message,
            quote: context.join('\n\n'),
            images: images?.length ? images : referenceImages,
        },
    };
}

function validContent(content: ChatContent): ChatContent | undefined {
    if (typeof content === 'string') return content.trim() ? content : undefined;
    if (!Array.isArray(content)) return undefined;
    const blocks = content.filter((block): block is ContentBlock => {
        if (!block || typeof block !== 'object') return false;
        if (block.type === 'text') return typeof block.text === 'string' && !!block.text.trim();
        return block.type === 'image_url' && typeof block.image_url?.url === 'string' && !!block.image_url.url;
    });
    return blocks.length ? blocks : undefined;
}

function validMessages(messages: ChatHistoryMessage[]): ChatHistoryMessage[] {
    return messages.flatMap(message => {
        if (!message || !['user', 'assistant', 'system'].includes(message.role)) return [];
        const content = validContent(message.content);
        return content === undefined ? [] : [{ role: message.role, content }];
    });
}

function contentKey(content: ChatContent): string {
    return JSON.stringify(typeof content === 'string' ? [{ type: 'text', text: content }] : content);
}

export function streamMessages({ message, images, history = [], usingContext = false, references = [] }: {
    message: string;
    images?: ImageAttachment[];
    history?: ChatHistoryMessage[];
    usingContext?: boolean;
    references?: ChatHistoryMessage[];
}): ChatHistoryMessage[] {
    const current = { role: 'user', content: chatContent(message, images) };
    const previous = usingContext ? validMessages(history) : [];
    // 调用方已经包含本轮消息时，仅移除末尾重复项，保留真实的历史追问。
    while (previous.length && previous[previous.length - 1].role === 'user' &&
        contentKey(previous[previous.length - 1].content) === contentKey(current.content)) previous.pop();
    const bounded = previous.slice(-MAX_HISTORY_MESSAGES);
    while (bounded[0]?.role === 'assistant') bounded.shift();
    const currentReferences = validMessages(references).filter(item => item.role === 'user').slice(-2);
    return [...bounded, ...currentReferences, current];
}
