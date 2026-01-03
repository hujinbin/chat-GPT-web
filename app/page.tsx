'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Layout, Input, Button, Space, Spin, Avatar, Card, message } from 'antd';
import { SendOutlined, LoadingOutlined, CloseOutlined, ApiOutlined, UserOutlined, PaperClipOutlined } from '@ant-design/icons';
import HeaderComponent from '../components/HeaderComponent';
import { chatCompletion, chatCompletionStream } from '../api/index';

const { Content, Header, Footer } = Layout;
const { TextArea } = Input;

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  dateTime: string;
  error?: boolean;
  loading?: boolean;
}

interface ChatPageProps {
  isMobile: boolean;
  currentChatId: string;
  onNewChat: () => void;
}

interface ChatSession {
  chatId: string;
  messages: Message[];
}

const ChatPage = ({ isMobile, currentChatId, onNewChat }: ChatPageProps) => {
  // 管理多个聊天会话
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [usingContext, setUsingContext] = useState(true);

  // 获取当前聊天会话的消息
  const getCurrentMessages = (): Message[] => {
    const currentSession = chatSessions.find(session => session.chatId === currentChatId);
    return currentSession ? currentSession.messages : [];
  };

  // 保存当前聊天会话的消息
  const saveCurrentMessages = (messages: Message[]) => {
    setChatSessions(prevSessions => {
      const sessionIndex = prevSessions.findIndex(session => session.chatId === currentChatId);
      if (sessionIndex >= 0) {
        // 更新现有会话
        return prevSessions.map((session, index) => 
          index === sessionIndex ? { ...session, messages } : session
        );
      } else {
        // 创建新会话
        return [...prevSessions, { chatId: currentChatId, messages }];
      }
    });
  };

  // 当currentChatId变化时，初始化新聊天会话
  useEffect(() => {
    if (currentChatId && !chatSessions.find(session => session.chatId === currentChatId)) {
      const initialMessages: Message[] = [
        {
          id: '1',
          text: '你好！我是AI助手，有什么可以帮助你的吗？',
          isUser: false,
          dateTime: new Date().toISOString(),
        },
      ];
      saveCurrentMessages(initialMessages);
    }
  }, [currentChatId]);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 滚动到底部
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  // 发送消息
  const sendMessage = async () => {
    if (!inputValue.trim() || loading || !currentChatId) return;

    // 显示发送中提示
    const sendingKey = message.loading('消息发送中...', 0);

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue.trim(),
      isUser: true,
      dateTime: new Date().toISOString(),
    };

    // 获取当前消息列表并添加用户消息
    const currentMessages = getCurrentMessages();
    const updatedMessages = [...currentMessages, userMessage];
    saveCurrentMessages(updatedMessages);
    
    setInputValue('');
    setLoading(true);

    // 创建一个初始的AI消息（加载中）
    const aiMessageId = (Date.now() + 1).toString();
    const initialAiMessage: Message = {
      id: aiMessageId,
      text: '',
      isUser: false,
      dateTime: new Date().toISOString(),
      loading: true,
    };
    saveCurrentMessages([...updatedMessages, initialAiMessage]);

    try {
      // 关闭发送中提示，显示AI正在思考
      message.destroy(sendingKey);
      const thinkingKey = message.loading('AI正在思考...', 0);
      
      // 使用流式API获取AI回复
      await chatCompletionStream(
        {
          message: inputValue.trim(),
          usingContext,
        },
        // onData回调：实时更新AI回复
        (content: string) => {
          // 第一次收到数据时关闭思考提示
          if (content) {
            message.destroy(thinkingKey);
          }
          
          const currentMsgs = getCurrentMessages();
          const updatedAiMessages = currentMsgs.map(msg => 
            msg.id === aiMessageId 
              ? { ...msg, text: msg.text + content, loading: false } 
              : msg
          );
          saveCurrentMessages(updatedAiMessages);
          scrollToBottom();
        },
        // onError回调：处理错误
        (error: string) => {
          message.destroy(thinkingKey);
          message.error('获取AI回复失败');
          
          const currentMsgs = getCurrentMessages();
          const updatedAiMessages = currentMsgs.map(msg => 
            msg.id === aiMessageId 
              ? { ...msg, text: error, error: true, loading: false } 
              : msg
          );
          saveCurrentMessages(updatedAiMessages);
        },
        // onDone回调：完成AI回复
        () => {
          message.destroy(thinkingKey);
          message.success('AI回复完成');
          
          const currentMsgs = getCurrentMessages();
          const updatedAiMessages = currentMsgs.map(msg => 
            msg.id === aiMessageId 
              ? { ...msg, loading: false } 
              : msg
          );
          saveCurrentMessages(updatedAiMessages);
          scrollToBottom();
        }
      );
    } catch (error) {
      console.error('发送消息失败:', error);
      message.error('发送消息失败，请稍后重试');
      
      const currentMsgs = getCurrentMessages();
      const updatedAiMessages = currentMsgs.map(msg => 
        msg.id === aiMessageId 
          ? { ...msg, text: '抱歉，发送消息失败，请稍后重试。', error: true, loading: false } 
          : msg
      );
      saveCurrentMessages(updatedAiMessages);
    } finally {
      setLoading(false);
    }
  };

  // 处理输入框变化
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  };

  // 处理按键事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 导出聊天记录
  const handleExport = () => {
    const exportContent = getCurrentMessages()
      .map(msg => `${msg.isUser ? '我' : 'AI'}: ${msg.text}`)
      .join('\n\n');
    
    const blob = new Blob([exportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 添加消息时的动画效果
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .animate-fadeIn {
        animation-name: fadeIn;
        animation-duration: 0.3s;
        animation-timing-function: ease-out;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  return (
    <Layout className="h-screen bg-gray-50">
      {/* 顶部导航 */}
      <Header className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center shadow-sm transition-all duration-300">
        <div className="flex items-center">
          <ApiOutlined className="text-2xl text-blue-600 mr-3" />
          <h1 className="text-xl font-bold text-gray-900">ChatGPT Web</h1>
        </div>
        <HeaderComponent
          usingContext={usingContext}
          onExport={handleExport}
          onToggleUsingContext={() => setUsingContext(!usingContext)}
          onNewChat={onNewChat}
        />
      </Header>
      
      {/* 主内容区域 */}
      <Content className="flex-1 overflow-hidden bg-gray-50">
        <div className="h-full flex flex-col p-6">
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto mb-6"
          >
            <div className="max-w-3xl mx-auto">
              {/* 消息列表 */}
              {getCurrentMessages().map((message, index) => (
                <div 
                  key={message.id} 
                  className={`flex mb-8 ${message.isUser ? 'justify-end' : 'justify-start'} opacity-0 animate-fadeIn`}
                  style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'forwards' }}
                >
                  <div className={`flex items-start max-w-[85%] ${message.isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                    <Avatar 
                      icon={message.isUser ? <UserOutlined /> : <ApiOutlined />} 
                      className={`${message.isUser ? 'bg-blue-600 ml-3 shadow-md' : 'bg-green-600 mr-3 shadow-md'} transition-all duration-300 hover:scale-105`}
                      size={40}
                    />
                    <div className={`flex flex-col ${message.isUser ? 'items-end' : 'items-start'}`}>
                      <div className="mb-1 flex items-center">
                        <span className="text-sm font-medium text-gray-700">
                          {message.isUser ? '我' : 'AI助手'}
                        </span>
                        <span className="text-xs text-gray-500 ml-2">
                          {message.dateTime.split('T')[1].slice(0, 5)}
                        </span>
                      </div>
                      <div 
                        className={`px-5 py-3 rounded-lg shadow-sm transition-all duration-300 ${message.isUser 
                          ? 'bg-blue-600 text-white rounded-tr-none hover:shadow-md' 
                          : 'bg-white text-gray-900 rounded-tl-none hover:shadow-md'}`}
                        style={{ borderRadius: message.isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px' }}
                      >
                        {message.loading ? (
                          <div className="flex items-center space-x-2">
                            <Spin indicator={<LoadingOutlined spin />} />
                            <span>正在思考...</span>
                          </div>
                        ) : message.error ? (
                          <div className="text-red-100 font-medium">{message.text}</div>
                        ) : (
                          <div className="whitespace-pre-wrap text-base leading-relaxed">{message.text}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* 加载中指示器 */}
              {loading && (
                <div className="flex justify-start mb-8">
                  <Avatar className="mr-3 bg-green-600" size={40} icon={<ApiOutlined />} />
                  <div className="flex flex-col items-start">
                    <Card 
                      className="bg-white text-gray-900 border-gray-200 shadow-sm"
                      bordered
                      bodyStyle={{ padding: '16px', borderRadius: '12px' }}
                    >
                      <Space align="center">
                        <Spin indicator={<LoadingOutlined spin />} />
                        <span>正在思考...</span>
                      </Space>
                    </Card>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* 输入区域 */}
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200 transition-all duration-300 hover:shadow-xl">
            <TextArea
              ref={inputRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="来试试什么吧... (Shift + Enter 换行，Enter 发送)"
              autoSize={{ minRows: 1, maxRows: 4 }}
              className="border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 mb-3 transition-all duration-300"
              style={{ borderRadius: '8px' }}
            />
            
            <Space className="w-full justify-between">
              <Space>
                <Button 
                  type="default" 
                  danger={usingContext} 
                  onClick={() => setUsingContext(!usingContext)}
                  className="transition-all duration-300 hover:shadow-md"
                >
                  上下文: {usingContext ? '开启' : '关闭'}
                </Button>
              </Space>
              <Space>
                {loading && (
                  <Button 
                    onClick={() => setLoading(false)} 
                    icon={<CloseOutlined />}
                    className="transition-all duration-300 hover:bg-red-50 hover:text-red-600"
                  >
                    取消
                  </Button>
                )}
                <Button
                  type="primary"
                  onClick={sendMessage}
                  disabled={!inputValue.trim() || loading}
                  loading={loading}
                  icon={<SendOutlined />}
                  className="bg-blue-600 hover:bg-blue-700 transition-all duration-300 hover:shadow-md"
                >
                  发送
                </Button>
              </Space>
            </Space>
            <div className="text-xs text-gray-500 text-center mt-2">
              按 Enter 发送消息，Shift + Enter 换行
            </div>
          </div>
        </div>
      </Content>
      
      {/* 底部信息 */}
      <Footer className="bg-white border-t border-gray-200 text-center text-gray-500 py-4">
        AI 聊天助手 ©2024
      </Footer>
    </Layout>
  );
};

export default ChatPage;