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
  Empty
} from 'antd';
import {
  SendOutlined,
  LoadingOutlined,
  CloseOutlined,
  ApiOutlined,
  UserOutlined,
  MenuOutlined
} from '@ant-design/icons';
import HeaderComponent from '@/components/HeaderComponent';
import Sider from '@/components/Sider';
import { chatCompletionStream } from '@/api/index';

const { Content, Header, Footer } = Layout;
const { TextArea } = Input;

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  error?: boolean;
  loading?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  isStarred: boolean;
  messages: ChatMessage[];
}

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

const ChatApp = () => {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [usingContext, setUsingContext] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isSiderCollapsed, setIsSiderCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamingAbortRef = useRef<AbortController | null>(null);
  const closeMessageRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 992);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setIsSiderCollapsed(isMobile);
  }, [isMobile]);

  const currentSession = useMemo(
    () => chatSessions.find(session => session.id === currentChatId),
    [chatSessions, currentChatId]
  );

  const messages = currentSession?.messages ?? [];

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, []);

  const handleCreateChat = useCallback(() => {
    streamingAbortRef.current?.abort();
    streamingAbortRef.current = null;
    closeMessageRef.current?.();
    closeMessageRef.current = null;
    setIsStreaming(false);

    const id = `chat-${Date.now()}`;
    const now = new Date().toISOString();
    const welcomeMessage: ChatMessage = {
      id: `${id}-welcome`,
      role: 'assistant',
      content: '你好！我是AI助手，有什么可以帮助你的吗？',
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
  }, []);

  useEffect(() => {
    if (!chatSessions.length) {
      handleCreateChat();
    }
  }, [chatSessions.length, handleCreateChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  const handleDeleteChat = useCallback((chatId: string) => {
    setChatSessions(prev => {
      const filtered = prev.filter(session => session.id !== chatId);
      if (!filtered.length) {
        setCurrentChatId('');
      } else if (currentChatId === chatId) {
        setCurrentChatId(filtered[0].id);
      }
      return filtered;
    });
  }, [currentChatId]);

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
    streamingAbortRef.current?.abort();
    streamingAbortRef.current = null;
    closeMessageRef.current?.();
    closeMessageRef.current = null;
    setIsStreaming(false);
    setChatSessions([]);
    setCurrentChatId('');
  }, []);

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
      .map(msg => `${msg.role === 'user' ? '我' : 'AI'}: ${msg.content}`)
      .join('\n\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `chat_${new Date().toISOString().slice(0, 10)}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [messages]);

  const stopStreaming = useCallback((chatId: string, assistantMessageId: string) => {
    streamingAbortRef.current?.abort();
    streamingAbortRef.current = null;
    closeMessageRef.current?.();
    closeMessageRef.current = null;
    setIsStreaming(false);
    updateMessage(chatId, assistantMessageId, msg => ({
      ...msg,
      loading: false,
      error: true,
      content: msg.content ? msg.content : '回复已取消'
    }));
  }, [updateMessage]);

  const handleSendMessage = useCallback(async () => {
    if (!currentSession || !inputValue.trim() || isStreaming) {
      return;
    }

    const chatId = currentSession.id;
    const userText = inputValue.trim();
    const now = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userText,
      createdAt: now
    };
    const assistantId = `assistant-${Date.now() + 1}`;
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: now,
      loading: true
    };
    const historyPayload = usingContext
      ? [...currentSession.messages, userMessage].map(item => ({
          role: item.role,
          content: item.content
        }))
      : undefined;

    appendMessages(chatId, [userMessage, assistantMessage]);
    setInputValue('');
    setIsStreaming(true);

    const hideSending = message.loading('AI 正在回复...', 0);
    closeMessageRef.current = hideSending;

    const controller = new AbortController();
    streamingAbortRef.current = controller;

    try {
      await chatCompletionStream(
        {
          message: userText,
          usingContext,
          history: historyPayload
        },
        chunk => {
          closeMessageRef.current?.();
          closeMessageRef.current = null;
          updateMessage(chatId, assistantId, msg => ({
            ...msg,
            content: `${msg.content}${chunk}`,
            loading: false,
            error: false
          }));
          scrollToBottom();
        },
        error => {
          closeMessageRef.current?.();
          closeMessageRef.current = null;
          if (error === '请求已取消') {
            return;
          }
          message.error(error || '获取 AI 回复失败');
          updateMessage(chatId, assistantId, msg => ({
            ...msg,
            content: error,
            loading: false,
            error: true
          }));
          setIsStreaming(false);
        },
        () => {
          closeMessageRef.current?.();
          closeMessageRef.current = null;
          setIsStreaming(false);
          updateMessage(chatId, assistantId, msg => ({
            ...msg,
            loading: false
          }));
          scrollToBottom();
        },
        { signal: controller.signal }
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        stopStreaming(chatId, assistantId);
      } else {
        console.error('发送消息失败', error);
        message.error('发送消息失败，请稍后重试');
        updateMessage(chatId, assistantId, msg => ({
          ...msg,
          content: '抱歉，发送消息失败，请稍后重试。',
          loading: false,
          error: true
        }));
        setIsStreaming(false);
      }
    }
  }, [appendMessages, currentSession, inputValue, isStreaming, scrollToBottom, stopStreaming, updateMessage, usingContext]);

  const handleCancelStreaming = useCallback(() => {
    if (!currentSession || !isStreaming || !streamingAbortRef.current) {
      return;
    }
    streamingAbortRef.current.abort();
  }, [currentSession, isStreaming]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

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

  return (
    <Layout className="h-screen bg-[#f3f5f9]">
      <Sider
        currentChatId={currentChatId}
        chats={sidebarChats}
        onChatSelect={setCurrentChatId}
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
              <div className="text-xs text-gray-500">GPT 驱动的智能对话</div>
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
                        <div className={`flex ${isMobile ? 'max-w-[85%]' : 'max-w-[70%]'} items-start ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                          <Avatar
                            size={isMobile ? 32 : 40}
                            className={isUser ? 'ml-3 bg-green-500 text-white' : 'mr-3 bg-gray-200 text-green-600'}
                            icon={isUser ? <UserOutlined /> : <ApiOutlined />}
                          />
                          <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                            <div className="mb-1 flex items-center gap-2">
                              <span className="text-xs font-medium text-gray-600">
                                {isUser ? '我' : 'AI 助手'}
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
                              } ${isMobile ? 'px-4 py-2' : 'px-5 py-3'} text-sm leading-6`}
                            >
                              {messageItem.loading ? (
                                <Space align="center">
                                  <Spin indicator={<LoadingOutlined spin />} size="small" />
                                  <span>正在思考...</span>
                                </Space>
                              ) : messageItem.error ? (
                                <span className="text-red-500">{messageItem.content}</span>
                              ) : (
                                <span className="whitespace-pre-wrap">{messageItem.content}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className={`mt-4 rounded-2xl border border-gray-200 bg-white shadow-sm ${isMobile ? 'p-3' : 'p-4'}`}>
                <TextArea
                  value={inputValue}
                  onChange={event => setInputValue(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="来说点什么吧… (Shift + Enter 换行，Enter 发送)"
                  autoSize={{ minRows: 1, maxRows: isMobile ? 3 : 5 }}
                  style={{ borderRadius: 12 }}
                />
                <div className={`mt-3 flex ${isMobile ? 'flex-col gap-2' : 'items-center justify-between'}`}>
                  <Button
                    type="text"
                    onClick={() => setUsingContext(prev => !prev)}
                    className={isMobile ? 'w-full text-left' : ''}
                  >
                    上下文 {usingContext ? '已开启' : '已关闭'}
                  </Button>
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
                      disabled={!inputValue.trim() || isStreaming}
                      onClick={handleSendMessage}
                      block={isMobile}
                    >
                      发送
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