'use client';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  Layout,
  Input,
  Button,
  Space,
  Spin,
  Avatar,
  message,
  Empty,
  Select,
  Switch,
  Tooltip,
  Popover
} from 'antd';
import {
  SendOutlined,
  LoadingOutlined,
  CloseOutlined,
  ApiOutlined,
  UserOutlined,
  MenuOutlined,
  GlobalOutlined
} from '@ant-design/icons';
import ImageComposer from '@/components/ImageComposer';
import { ChatHistoryMessage, ImageAttachment, readImage, imageBytes, MAX_IMAGE_COUNT, MAX_IMAGE_TOTAL_BYTES } from '@/api/attachments';
import { conversationRequest } from '@/api/conversation';
import HeaderComponent from '@/components/HeaderComponent';
import Sider from '@/components/Sider';
import {
  chatCompletionStream,
  fetchModelOptions,
  ModelOption,
  SearchSource,
  DEFAULT_MODEL
} from '@/api/index';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import styles from './page.module.less';
import { AssistantContent, UserContent, ChatProgress, ProcessStep } from '@/components/ChatContent';
import { generateMedia, pollVideo, safeMediaURL, MediaResult } from '@/api/media';
import { API_BASE_URL } from '@/utils/request';

const { Content, Header, Footer } = Layout;
const { TextArea } = Input;

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  error?: boolean;
  errorMessage?: string;
  stopped?: boolean;
  guidance?: boolean;
  quote?: string;
  references?: ChatHistoryMessage[];
  images?: ImageAttachment[];
  process?: ProcessStep[];
  loading?: boolean;
  sources?: SearchSource[];
  media?: MediaResult;
  videoId?: string;
  // 当前处理阶段提示，如"正在联网检索…"
  stage?: string;
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  isStarred: boolean;
  messages: ChatMessage[];
}

interface ActiveRequest {
  chatId: string;
  messageId: string;
  controller: AbortController;
  mode: 'text' | 'image' | 'video';
  content: string;
  user?: { content: string; quote?: string; images?: ImageAttachment[] };
}

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const formatTime = (iso: string) => {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  return sameDay
    ? date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
};

const AppLoading = () => (
  <div className={styles.appLoading}>
    <div className={styles.loadingPanel}>
      <div className={styles.loadingLogo}>
        <ApiOutlined />
      </div>
      <div>
        <div className={styles.loadingTitle}>AI 聊天助手</div>
        <div className={styles.loadingText}>正在准备对话环境...</div>
      </div>
      <div className={styles.loadingDots} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  </div>
);

const ThinkingDots = () => (
  <span className={styles.thinkingDots} aria-label="正在思考">
    <span />
    <span />
    <span />
  </span>
);

const ChatApp = () => {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [quotedText, setQuotedText] = useState('');
  const [selectionQuote, setSelectionQuote] = useState('');
  const textareaRef = useRef<TextAreaRef>(null);
  const [usingContext, setUsingContext] = useState(true);
  const [searchEnabled, setSearchEnabled] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isSiderCollapsed, setIsSiderCollapsed] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [mode, setMode] = useState<'text' | 'image' | 'video'>('text');
  const [mediaModel, setMediaModel] = useState('agnes-image-2.5-flash');
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageSize, setImageSize] = useState('1K');
  const [imageRatio, setImageRatio] = useState('1:1');
  const [videoRatio, setVideoRatio] = useState('16:9');
  const [videoSeconds, setVideoSeconds] = useState(5);
  const [videoMode, setVideoMode] = useState<'reference' | 'keyframe'>('reference');
  const imageEpochRef = useRef(0);
  const imageReadingRef = useRef(false);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRequestRef = useRef<ActiveRequest | null>(null);
  const followOutputRef = useRef(true);
  const hasBootstrappedRef = useRef(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 992);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 从后端加载模型列表
  useEffect(() => {
    fetchModelOptions().then(groups => {
      setModelOptions(groups);
      setSelectedModel(prev => prev || groups[0]?.default_model || DEFAULT_MODEL);
    });
  }, []);

  useEffect(() => {
    setIsSiderCollapsed(isMobile);
  }, [isMobile]);

  const currentSession = useMemo(
    () => chatSessions.find(session => session.id === currentChatId),
    [chatSessions, currentChatId]
  );

  const messages = useMemo(
    () => currentSession?.messages ?? [],
    [currentSession]
  );

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current && followOutputRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, []);

  const clearImages = useCallback(() => {
    imageEpochRef.current += 1;
    imageReadingRef.current = false;
    setImages([]);
    setImageBusy(false);
  }, []);

  const addImageFiles = useCallback(async (files: File[]) => {
    if (!files.length || imageReadingRef.current || (activeRequestRef.current && activeRequestRef.current.mode !== 'text')) return;
    if (files.length + images.length > MAX_IMAGE_COUNT) { message.warning('最多添加 5 张图片'); return; }
    const epoch = imageEpochRef.current;
    imageReadingRef.current = true;
    setImageBusy(true);
    try {
      const added = await Promise.all(files.map(readImage));
      if (imageEpochRef.current !== epoch) return;
      if ([...images, ...added].reduce((total, image) => total + imageBytes(image), 0) > MAX_IMAGE_TOTAL_BYTES) throw new Error('本次图片总大小不能超过 20MB');
      setImages(current => [...current, ...added]);
    } catch (error) { if (imageEpochRef.current === epoch) message.error(error instanceof Error ? error.message : '添加图片失败'); }
    finally { if (imageEpochRef.current === epoch) { imageReadingRef.current = false; setImageBusy(false); } }
  }, [images]);

  const addImageURL = useCallback((value: string) => {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('请填写公开可访问的 HTTPS 图片链接');
      if (images.length >= MAX_IMAGE_COUNT) throw new Error('最多添加 5 张图片');
      setImages(current => [...current, { id: createId(), name: decodeURIComponent(url.pathname.split('/').pop() || '链接图片'), url: url.href }]);
    } catch (error) { message.error(error instanceof Error ? error.message : '图片链接无效'); }
  }, [images.length]);

  const cancelActiveRequest = useCallback((reason = '已停止生成') => {
    const active = activeRequestRef.current;
    activeRequestRef.current = null;
    active?.controller.abort();
    setIsStreaming(false);
    if (active) setChatSessions(prev => prev.map(session => session.id === active.chatId ? {
      ...session,
      messages: session.messages.map(item => item.id === active.messageId ? {
        ...item, loading: false, stopped: true, stage: undefined,
        process: [...(item.process || []), { stage: 'stopped', message: reason }]
      } : item)
    } : session));
    return active;
  }, []);

  useEffect(() => () => { activeRequestRef.current?.controller.abort(); }, []);

  const handleCreateChat = useCallback(() => {
    cancelActiveRequest();
    clearImages();
    followOutputRef.current = true;

    const id = `chat-${createId()}`;
    const now = new Date().toISOString();
    const welcomeMessage: ChatMessage = {
      id: `${id}-welcome`,
      role: 'assistant',
      content: '你好，我是 AI 助手。可以直接提问或上传图片。开启联网后，我会根据问题判断是否需要搜索资料。',
      createdAt: now
    };

    setChatSessions(prev => [
      {
        id,
        title: '新建聊天',
        createdAt: now,
        updatedAt: now,
        isStarred: false,
        messages: [welcomeMessage]
      },
      ...prev
    ]);
    setCurrentChatId(id);
    setInputValue('');
    setQuotedText('');
    setSelectionQuote('');
  }, [cancelActiveRequest, clearImages]);

  useEffect(() => {
    if (!hasBootstrappedRef.current) {
      hasBootstrappedRef.current = true;
      handleCreateChat();
      setIsAppReady(true);
    }
  }, [handleCreateChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  const handleDeleteChat = useCallback((chatId: string) => {
    if (activeRequestRef.current?.chatId === chatId) cancelActiveRequest();
    setChatSessions(prev => {
      const filtered = prev.filter(session => session.id !== chatId);
      if (!filtered.length) {
        setCurrentChatId('');
      } else if (currentChatId === chatId) {
        setCurrentChatId(filtered[0].id);
      }
      return filtered;
    });
  }, [currentChatId, cancelActiveRequest]);

  const handleToggleStar = useCallback((chatId: string) => {
    setChatSessions(prev =>
      prev.map(session =>
        session.id === chatId
          ? { ...session, isStarred: !session.isStarred }
          : session
      )
    );
  }, []);

  const handleRenameChat = useCallback((chatId: string, nextTitle: string) => {
    setChatSessions(prev =>
      prev.map(session =>
        session.id === chatId ? { ...session, title: nextTitle } : session
      )
    );
  }, []);

  const handleClearAll = useCallback(() => {
    cancelActiveRequest();
    clearImages();
    setChatSessions([]);
    setCurrentChatId('');
  }, [cancelActiveRequest, clearImages]);

  const appendMessages = useCallback((chatId: string, newMessages: ChatMessage[]) => {
    setChatSessions(prev =>
      prev.map(session =>
        session.id === chatId
          ? {
              ...session,
              messages: [...session.messages, ...newMessages],
              updatedAt: new Date().toISOString()
            }
          : session
      )
    );
  }, []);

  const updateMessage = useCallback(
    (chatId: string, messageId: string, updater: (message: ChatMessage) => ChatMessage) => {
      setChatSessions(prev =>
        prev.map(session =>
          session.id === chatId
            ? {
                ...session,
                messages: session.messages.map(msg =>
                  msg.id === messageId ? updater(msg) : msg
                ),
                updatedAt: new Date().toISOString()
              }
            : session
        )
      );
    },
    []
  );

  const handleExport = useCallback(() => {
    if (!messages.length) {
      message.info('当前会话暂无内容');
      return;
    }
    const text = messages
      .map(msg => `${msg.role === 'user' ? '我' : 'AI'}: ${msg.quote ? `引用内容\n${msg.quote}\n\n` : ''}${msg.content}`)
      .join('\n\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `chat_${new Date().toISOString().slice(0, 10)}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [messages]);

  const handleSendMessage = useCallback(async (intent: 'send' | 'guide' = 'send') => {
    const previous = activeRequestRef.current;
    if (!currentSession || imageBusy || (!inputValue.trim() && !images.length)) return;
    if (mode === 'video' && videoMode === 'keyframe' && images.length > 2) { message.warning('首尾帧模式最多两张图片，第一张作为首帧，第二张作为尾帧'); return; }
    if (previous && (intent !== 'guide' || previous.mode !== 'text' || previous.chatId !== currentSession.id)) return;
    const guiding = intent === 'guide' && !!previous;
    if (guiding) cancelActiveRequest('已按补充要求调整回复');

    const chatId = currentSession.id;
    const userText = inputValue.trim() || (mode === 'text' ? '请解读图片并说明其中的关键信息。' : mode === 'image' ? '请根据参考图生成一张细节清晰的图片。' : '请以参考图为主体生成自然流畅的视频。');
    const submittedImages = [...images];
    const quote = mode === 'text' ? quotedText : '';
    const now = new Date().toISOString();
    const requestId = createId();
    const assistantId = `assistant-${requestId}`;
    const { targetUser, ...requestPayload } = conversationRequest({
      message: userText, messages: currentSession.messages, usingContext, quote, images: submittedImages,
      guidance: guiding && previous ? { messageId: previous.messageId, content: previous.content, user: previous.user } : undefined,
    });
    appendMessages(chatId, [
      { id: `user-${requestId}`, role: 'user', content: userText, createdAt: now, guidance: guiding, quote, references: requestPayload.references, images: submittedImages },
      { id: assistantId, role: 'assistant', content: '', createdAt: now, loading: true,
        process: [{ stage: 'request_start', message: guiding ? '已收到补充要求，正在重新组织回复…' : '正在连接 AI 服务…' }] }
    ]);
    setInputValue('');
    clearImages();
    setQuotedText('');
    setSelectionQuote('');
    followOutputRef.current = true;
    setIsStreaming(true);
    const controller = new AbortController();
    const active: ActiveRequest = { chatId, messageId: assistantId, controller, mode, content: '', user: targetUser };
    activeRequestRef.current = active;
    // 旧请求的迟到片段和 finally 只能影响它自己的消息。
    const isCurrent = () => activeRequestRef.current === active && !controller.signal.aborted;
    const recordStage = (stage: string, text: string, metadata?: Record<string, unknown>) => {
      if (!isCurrent()) return;
      updateMessage(chatId, assistantId, item => {
        const steps = item.process || [];
        const latest = steps[steps.length - 1];
        return { ...item, stage: text, process: latest?.stage === stage && latest.message === text ? steps : [...steps, { stage, message: text, metadata }] };
      });
      scrollToBottom();
    };
    try {
      if (mode !== 'text') {
        recordStage('media_start', mode === 'image' ? '正在生成图片…' : '正在创建视频任务…');
        const media = await generateMedia(API_BASE_URL, mode, userText, mediaModel, controller.signal,
          videoId => { if (isCurrent()) updateMessage(chatId, assistantId, item => ({ ...item, videoId })); },
          text => recordStage('media_progress', text), undefined, { images: submittedImages, size: imageSize, ratio: mode === 'image' ? imageRatio : videoRatio, seconds: String(videoSeconds), videoMode: submittedImages.length ? videoMode : 'text' });
        if (isCurrent()) updateMessage(chatId, assistantId, item => ({ ...item, media, loading: false, stage: undefined, content: mode === 'image' ? '图片已生成' : '视频已生成', process: [...(item.process || []), { stage: 'done', message: '生成完成' }] }));
        return;
      }
      await chatCompletionStream({
        ...requestPayload, search: searchEnabled, model: selectedModel, images: submittedImages
      }, chunk => {
        if (!isCurrent()) return;
        if (!active.content) recordStage('streaming', '正在流式输出…');
        active.content += chunk;
        updateMessage(chatId, assistantId, item => ({ ...item, content: active.content, loading: true, stage: undefined }));
        scrollToBottom();
      }, sources => {
        if (!isCurrent()) return;
        updateMessage(chatId, assistantId, item => {
          const merged = [...(item.sources || [])];
          sources.forEach(source => { if (!merged.some(existing => existing.url === source.url)) merged.push(source); });
          return { ...item, sources: merged };
        });
        scrollToBottom();
      }, error => {
        if (!isCurrent()) return;
        updateMessage(chatId, assistantId, item => ({ ...item, loading: false, error: true, stage: undefined, errorMessage: error,
          process: [...(item.process || []), { stage: 'error', message: error }] }));
      }, () => {
        if (!isCurrent()) return;
        updateMessage(chatId, assistantId, item => ({ ...item, loading: false, stage: undefined,
          process: [...(item.process || []), { stage: 'done', message: '回复已完成' }] }));
        scrollToBottom();
      }, { signal: controller.signal, onStage: recordStage });
    } catch (error) {
      if (!isCurrent()) return;
      const text = error instanceof Error ? error.message : '请求失败，请重试';
      updateMessage(chatId, assistantId, item => ({ ...item, loading: false, error: true, stage: undefined, errorMessage: text,
        process: [...(item.process || []), { stage: 'error', message: text }] }));
    } finally {
      if (activeRequestRef.current === active) {
        activeRequestRef.current = null;
        setIsStreaming(false);
      }
    }
  }, [currentSession, inputValue, quotedText, images, imageBusy, imageSize, imageRatio, videoRatio, videoSeconds, videoMode, mode, mediaModel, usingContext, searchEnabled, selectedModel, appendMessages, updateMessage, scrollToBottom, cancelActiveRequest, clearImages]);

  const handleResumeVideo = useCallback(async (item: ChatMessage) => {
    if (!currentSession || !item.videoId || activeRequestRef.current) return;
    const chatId = currentSession.id;
    setMode('video');
    setMediaModel('agnes-video-2.5-flash');
    const controller = new AbortController();
    const active: ActiveRequest = { chatId, messageId: item.id, controller, mode: 'video', content: item.content };
    activeRequestRef.current = active;
    setIsStreaming(true);
    updateMessage(chatId, item.id, entry => ({ ...entry, loading: true, stopped: false, error: false, errorMessage: undefined }));
    try {
      const media = await pollVideo(API_BASE_URL, item.videoId, controller.signal, stage => {
        if (activeRequestRef.current === active) updateMessage(chatId, item.id, entry => ({ ...entry, stage }));
      });
      if (activeRequestRef.current === active) updateMessage(chatId, item.id, entry => ({ ...entry, media, content: '视频已生成', loading: false, stage: undefined }));
    } catch (error) {
      if (activeRequestRef.current === active) updateMessage(chatId, item.id, entry => ({ ...entry, loading: false, stage: undefined, error: true,
        errorMessage: error instanceof Error ? error.message : '查询失败' }));
    } finally {
      if (activeRequestRef.current === active) { activeRequestRef.current = null; setIsStreaming(false); }
    }
  }, [currentSession, updateMessage]);

  const handleCancelStreaming = useCallback(() => { cancelActiveRequest(); }, [cancelActiveRequest]);
  const handleSelectChat = useCallback((chatId: string) => {
    if (chatId !== currentChatId) cancelActiveRequest();
    setCurrentChatId(chatId);
    clearImages();
    setInputValue('');
    clearImages();
    setQuotedText('');
    setSelectionQuote('');
    followOutputRef.current = true;
  }, [currentChatId, cancelActiveRequest, clearImages]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (isStreaming) {
        if (mode === 'text' && (event.ctrlKey || event.metaKey)) handleSendMessage('guide');
      } else handleSendMessage();
    }
  }, [handleSendMessage, isStreaming, mode]);

  const captureQuote = useCallback(() => {
    const selection = window.getSelection();
    const container = scrollRef.current;
    if (selection && container && container.contains(selection.anchorNode) && container.contains(selection.focusNode)) {
      setSelectionQuote(selection.toString().trim().slice(0, 8000));
    }
  }, []);

  const sidebarChats = useMemo(
    () =>
      chatSessions.map(session => {
        const lastMessage = session.messages[session.messages.length - 1];
        return {
          id: session.id,
          title: session.title,
          subtitle: formatTime(session.updatedAt),
          lastMessage: lastMessage?.content || '',
          isStarred: session.isStarred
        };
      }),
    [chatSessions]
  );

  if (!isAppReady) {
    return <AppLoading />;
  }

  return (
    <Layout className="h-screen bg-[#f3f5f9]">
      <Sider
        currentChatId={currentChatId}
        chats={sidebarChats}
        onChatSelect={handleSelectChat}
        onNewChat={handleCreateChat}
        onDeleteChat={handleDeleteChat}
        onToggleStar={handleToggleStar}
        onRenameChat={handleRenameChat}
        onClearAll={handleClearAll}
        isMobile={isMobile}
        collapsed={isSiderCollapsed}
        onCollapseChange={setIsSiderCollapsed}
      />
      <Layout className="h-full bg-transparent">
        <Header className={`flex items-center justify-between bg-white shadow-sm ${isMobile ? 'px-4 py-3' : 'px-8 py-4'}`}>
          <div className={`flex items-center ${isMobile ? 'gap-2' : 'gap-3'}`}>
            {isMobile && (
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setIsSiderCollapsed(prev => !prev)}
                aria-label="切换侧边栏"
              />
            )}
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-600">
              <ApiOutlined className="text-xl" />
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900">AI 聊天助手</div>
              <div className="text-xs text-gray-500">多模型智能对话</div>
            </div>
          </div>
          <HeaderComponent
            usingContext={usingContext}
            onExport={handleExport}
            onToggleUsingContext={() => setUsingContext(prev => !prev)}
            onNewChat={handleCreateChat}
            isMobile={isMobile}
          />
        </Header>
        <Content className="flex-1 overflow-hidden">
          {currentSession ? (
            <div className={`flex h-full flex-col ${isMobile ? 'px-4 py-4' : 'px-10 py-6'}`}>
              <div
                ref={scrollRef}
                onMouseUp={captureQuote}
                onKeyUp={captureQuote}
                onScroll={event => { const element = event.currentTarget; followOutputRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 90; }}
                className={`flex-1 overflow-y-auto ${isMobile ? 'pr-1' : 'pr-2'}`}
              >
                {messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <Empty description="开始新的对话吧" />
                  </div>
                ) : (
                  messages.map(messageItem => {
                    const isUser = messageItem.role === 'user';
                    return (
                      <div
                        key={messageItem.id}
                        className={`mb-6 flex ${isUser ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`flex ${isMobile ? 'max-w-full' : 'max-w-[82%]'} min-w-0 items-start ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                          <Avatar
                            size={isMobile ? 32 : 40}
                            className={isUser ? 'ml-3 bg-green-500 text-white' : 'mr-3 bg-gray-200 text-green-600'}
                            icon={isUser ? <UserOutlined /> : <ApiOutlined />}
                          />
                          <div className={`flex min-w-0 flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                            <div className="mb-1 flex items-center gap-2">
                              <span className="text-xs font-medium text-gray-600">
                                {isUser ? messageItem.guidance ? '我 · 补充要求' : '我' : 'AI 助手'}
                              </span>
                              <span className="text-[11px] text-gray-400">
                                {formatTime(messageItem.createdAt)}
                              </span>
                            </div>
                            <div
                              className={`${
                                isUser
                                  ? 'rounded-3xl rounded-tr-md bg-green-500 text-white'
                                  : 'rounded-3xl rounded-tl-md bg-white text-gray-900 shadow'
                              } ${isMobile ? 'px-4 py-2' : 'px-5 py-3'} min-w-0 max-w-full text-sm leading-6`}
                            >
                              {isUser && messageItem.images && messageItem.images.length > 0 && <div className={styles.sentImages}>
                                {messageItem.images.map(image => <a key={image.id} href={image.url} target="_blank" rel="noopener noreferrer">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={image.url} alt={image.name} />
                                </a>)}
                              </div>}
                              {!isUser && messageItem.media && (
                                <div className="mb-3">
                                  {messageItem.media.kind === 'image'
                                    ? <img src={safeMediaURL(messageItem.media.url, true)} alt="AI 生成图片" className="max-h-[480px] max-w-full rounded-xl" />
                                    : <video src={safeMediaURL(messageItem.media.url)} controls className="max-h-[480px] max-w-full rounded-xl" />}
                                  <a href={safeMediaURL(messageItem.media.url, messageItem.media.kind === 'image')} target="_blank" rel="noopener noreferrer">打开生成结果</a>
                                </div>
                              )}
                              {!isUser && messageItem.videoId && !messageItem.media && !messageItem.loading && (
                                <Button size="small" disabled={isStreaming} onClick={() => handleResumeVideo(messageItem)}>继续查询视频</Button>
                              )}
                              {!isUser && <ChatProgress steps={messageItem.process} sources={messageItem.sources} loading={messageItem.loading} stopped={messageItem.stopped} startedAt={messageItem.createdAt} />}
                              {isUser ? <>{messageItem.quote && <blockquote className={styles.userQuote}>{messageItem.quote}</blockquote>}<UserContent content={messageItem.content} /></> : <>
                                {messageItem.content && <AssistantContent content={messageItem.content} loading={messageItem.loading} />}
                                {messageItem.loading && !messageItem.content && <Space align="center">
                                  <Spin indicator={<LoadingOutlined spin />} size="small" />
                                  <span className="text-gray-500" role="status">{messageItem.stage || '等待服务响应…'}</span><ThinkingDots />
                                </Space>}
                                {messageItem.errorMessage && <div className={styles.messageError} role="alert">{messageItem.errorMessage}</div>}
                              </>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div onDragOver={event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); }}
                onDrop={event => { if (event.dataTransfer.files.length) { event.preventDefault(); addImageFiles(Array.from(event.dataTransfer.files)); } }}
                className={`mt-4 rounded-2xl border border-gray-200 bg-white shadow-sm ${isMobile ? 'p-3' : 'p-4'}`}>
                <ImageComposer images={images} onFiles={addImageFiles} onAddURL={addImageURL}
                  onRemove={id => setImages(current => current.filter(image => image.id !== id))}
                  busy={imageBusy} disabled={isStreaming && mode !== 'text'} />
                {images.length > 0 && mode === 'text' && <Button size="small" className="mb-2" onClick={() => setInputValue('请解读图片，提取文字并说明关键信息。')}>解读图片</Button>}
                {mode === 'text' && selectionQuote && <Button size="small" className="mb-2" onClick={() => {
                  setQuotedText(selectionQuote); setSelectionQuote(''); textareaRef.current?.focus();
                }}>引用选中内容</Button>}
                {mode === 'text' && quotedText && <div className={styles.quoteChip}>
                  <span title={quotedText}>引用 · {quotedText}</span><button type="button" aria-label="取消引用" onClick={() => setQuotedText('')}>×</button>
                </div>}
                {isStreaming && mode === 'text' && <div className={styles.guidanceBar}>
                  <span>正在生成回复，可以补充要求调整回答</span><kbd>Ctrl + Enter</kbd>
                </div>}
                <TextArea
                  ref={textareaRef}
                  aria-label={isStreaming && mode === 'text' ? '补充要求' : '消息输入'}
                  value={inputValue}
                  onChange={event => setInputValue(event.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={event => {
                    const files = Array.from(event.clipboardData.items).filter(item => item.kind === 'file' && item.type.startsWith('image/')).map(item => item.getAsFile()).filter((file): file is File => !!file);
                    if (files.length) { event.preventDefault(); addImageFiles(files); }
                  }}
                  placeholder={isStreaming && mode === 'text' ? '补充要求，Ctrl + Enter 提交，Shift + Enter 换行' : mode === 'text' ? '输入问题或添加图片，Enter 发送，Shift + Enter 换行' : mode === 'image' ? '描述你想生成或编辑的图片…' : '描述你想生成的视频…'}
                  autoSize={{ minRows: 1, maxRows: isMobile ? 3 : 5 }}
                  style={{ borderRadius: 12 }}
                />
                <div className={`mt-3 flex ${isMobile ? 'flex-col gap-2' : 'items-center justify-between'}`}>
                  <div className={`flex flex-wrap items-center gap-2 ${isMobile ? 'w-full' : ''}`}>
                    <Select size="small" value={mode} disabled={isStreaming || imageBusy} aria-label="生成模式"
                      onChange={value => { setMode(value); setMediaModel(value === 'video' ? 'agnes-video-2.5-flash' : 'agnes-image-2.5-flash'); }}
                      options={[{ value: 'text', label: '文本对话' }, { value: 'image', label: '生成图片' }, { value: 'video', label: '生成视频 · 720P' }]} />
                    {mode !== 'text' && <Select size="small" disabled={isStreaming} className={isMobile ? 'flex-1' : 'min-w-[180px]'} value={mediaModel} onChange={setMediaModel} aria-label="Flash 媒体模型"
                      options={(mode === 'video' ? ['agnes-video-2.5-flash'] : ['agnes-image-2.5-flash', 'agnes-image-2.1-flash', 'agnes-image-2.0-flash']).map(value => ({ value, label: value }))} />}
                    {mode === 'image' && <>
                      <Select size="small" style={{ minWidth: 116 }} popupMatchSelectWidth={false} value={imageRatio} onChange={setImageRatio} disabled={isStreaming} aria-label="图片比例"
                        options={['1:1', '3:4', '4:3', '16:9', '9:16', '2:3', '3:2', '21:9'].map(value => ({ value, label: `比例 ${value}` }))} />
                      <Select size="small" value={imageSize} onChange={setImageSize} disabled={isStreaming} aria-label="图片分辨率"
                        options={['1K', '2K', '3K', '4K'].map(value => ({ value, label: value }))} />
                    </>}
                    {mode === 'video' && <>
                      {images.length > 0 && <Select size="small" style={{ minWidth: 145 }} popupMatchSelectWidth={false} value={videoMode} onChange={setVideoMode} disabled={isStreaming} aria-label="视频生成方式"
                        options={[{ value: 'reference', label: '参考图生视频' }, { value: 'keyframe', label: '首尾帧生视频' }]} />}
                      <Popover trigger="click" title="视频参数 · Flash 720P" content={<div className={styles.videoSettings}>
                        <label>画面比例</label>
                        <Select value={videoRatio} onChange={setVideoRatio} aria-label="视频比例" disabled={isStreaming}
                          options={['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'].map(value => ({ value, label: value }))} />
                        <label>视频时长 · {videoSeconds} 秒</label>
                        <input type="range" min={4} max={12} step={1} value={videoSeconds} onChange={event => setVideoSeconds(Number(event.target.value))} disabled={isStreaming} aria-label="视频时长" />
                        <small>{images.length ? videoMode === 'keyframe' ? '按顺序使用第一张首帧和第二张尾帧，最多两张。' : '支持最多 5 张参考图，本地图片会先上传为临时链接。' : '根据文字描述生成视频。'}</small>
                      </div>}>
                        <Button size="small" disabled={isStreaming}>比例 {videoRatio} · {videoSeconds} 秒</Button>
                      </Popover>
                    </>}
                    {mode === 'text' && <Select
                      disabled={isStreaming}
                      value={selectedModel || undefined}
                      onChange={setSelectedModel}
                      className={isMobile ? 'flex-1' : 'min-w-[180px]'}
                      size="small"
                      placeholder="选择模型"
                      options={modelOptions.flatMap(group => [
                        { label: `── ${group.label} ──`, options: group.models.map(m => ({ label: m, value: m })) }
                      ])}
                    />}
                    {mode === 'text' && <>
                    <Tooltip title="允许 AI 根据本轮问题和对话判断是否需要联网搜索">
                      <Space size={4} align="center">
                        <GlobalOutlined className="text-gray-500" />
                        <span className="text-xs text-gray-600">联网搜索</span>
                        <Switch
                          size="small"
                          checked={searchEnabled}
                          onChange={setSearchEnabled}
                        />
                      </Space>
                    </Tooltip>
                    <Tooltip title="开启后，本轮对话会带入历史消息进行追问">
                      <Space size={4} align="center">
                        <span className="text-xs text-gray-600">上下文记忆</span>
                        <Switch
                          size="small"
                          checked={usingContext}
                          onChange={setUsingContext}
                        />
                      </Space>
                    </Tooltip>
                    </>}
                  </div>
                  <Space
                    wrap
                    size={isMobile ? 8 : 12}
                    className={isMobile ? 'flex w-full justify-end' : undefined}
                  >
                    {isStreaming && (
                      <Button
                        onClick={handleCancelStreaming}
                        icon={<CloseOutlined />}
                        block={isMobile}
                      >
                        停止生成
                      </Button>
                    )}
                    <Button
                      type="primary"
                      icon={<SendOutlined />}
                      disabled={imageBusy || (!inputValue.trim() && !images.length) || (isStreaming && mode !== 'text')}
                      onClick={() => handleSendMessage(isStreaming ? 'guide' : 'send')}
                      block={isMobile}
                    >
                      {isStreaming && mode === 'text' ? '补充要求' : '发送'}
                    </Button>
                  </Space>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <Empty description="请选择或新建聊天" />
            </div>
          )}
        </Content>
        <Footer className="bg-transparent text-center text-xs text-gray-400 py-3">
          AI 聊天助手 ©2024
        </Footer>
      </Layout>
    </Layout>
  );
};

export default ChatApp;
