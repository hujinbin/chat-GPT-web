'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Input, Button, Space, Spin, Avatar, Divider } from 'antd';
import { SendOutlined, LoadingOutlined, CloseOutlined } from '@ant-design/icons';
import HeaderComponent from '../components/HeaderComponent';
import { chatCompletion } from '../api/index';

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

    try {
      // 这里调用实际的API
      const response = await chatCompletion({
        message: inputValue,
        usingContext,
      });

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response.data?.content || '抱歉，我无法理解您的问题。',
        isUser: false,
        dateTime: new Date().toISOString(),
      };

      // 更新消息列表，添加AI回复
      saveCurrentMessages([...updatedMessages, aiMessage]);
    } catch (error) {
      console.error('发送消息失败:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: '抱歉，发送消息失败，请稍后重试。',
        isUser: false,
        dateTime: new Date().toISOString(),
        error: true,
      };

      // 更新消息列表，添加错误信息
      saveCurrentMessages([...updatedMessages, errorMessage]);
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

  return (
    <div className="flex flex-col w-full h-full bg-gray-50 dark:bg-gray-900">
      {/* 非移动端显示的头部 */}
      {!isMobile && (
        <div className="border-b bg-white dark:bg-gray-800 px-4 py-3 flex justify-between items-center">
          <div className="text-lg font-semibold text-gray-900 dark:text-white">AI 聊天助手</div>
          <HeaderComponent
            usingContext={usingContext}
            onExport={handleExport}
            onToggleUsingContext={() => setUsingContext(!usingContext)}
            onNewChat={onNewChat}
          />
        </div>
      )}
      
      {/* 主内容区域 */}
      <main className="flex-1 overflow-hidden">
        <div
          ref={scrollRef}
          className="h-full overflow-y-auto p-4 bg-white dark:bg-gray-900"
        >
          <div className="max-w-3xl mx-auto">
            {/* 消息列表 */}
            {getCurrentMessages().map((message) => (
              <div 
                key={message.id} 
                className={`flex mb-6 ${message.isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!message.isUser && (
                  <Avatar className="mr-3 bg-green-500">AI</Avatar>
                )}
                <div className={`max-w-[85%] ${message.isUser ? 'flex flex-col items-end' : 'flex flex-col items-start'}`}>
                  <div className={`p-4 rounded-lg shadow-sm ${message.isUser ? 'bg-blue-500 text-white rounded-br-none' : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-none'}`}>
                    {message.loading ? (
                      <Space align="center">
                        <Spin indicator={<LoadingOutlined spin />} />
                        <span>正在思考...</span>
                      </Space>
                    ) : (
                      <div className="whitespace-pre-wrap">{message.text}</div>
                    )}
                  </div>
                  <div className="text-xs mt-1 text-gray-500 dark:text-gray-400">
                    {message.dateTime.split('T')[1].slice(0, 5)}
                  </div>
                </div>
                {message.isUser && (
                  <Avatar className="ml-3 bg-blue-500">我</Avatar>
                )}
              </div>
            ))}
            
            {/* 加载中指示器 */}
            {loading && (
              <div className="flex justify-start mb-6">
                <Avatar className="mr-3 bg-green-500">AI</Avatar>
                <div className="max-w-[85%] flex flex-col items-start">
                  <div className="p-4 rounded-lg shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-none">
                    <Space align="center">
                      <Spin indicator={<LoadingOutlined spin />} />
                      <span>正在思考...</span>
                    </Space>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      
      {/* 输入区域 */}
      <div className="border-t bg-white dark:bg-gray-800 px-4 py-3">
        <div className="max-w-3xl mx-auto">
          {/* 显示调试信息 */}
          <div className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            <span className="mr-4">显示调试信息</span>
            <span className="mr-4">上下文: {usingContext ? '开启' : '关闭'}</span>
          </div>
          
          <TextArea
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="来试试什么吧... (Shift + Enter 换行，Enter 发送)"
            autoSize={{ minRows: 1, maxRows: 4 }}
            className="mb-3 rounded-lg"
          />
          
          <Space className="w-full justify-between">
            <Space>
              <Button type="text">清空对话</Button>
              <Button type="text">导出记录</Button>
            </Space>
            <Space>
              {loading && (
                <Button onClick={() => setLoading(false)} icon={<CloseOutlined />}>
                  取消
                </Button>
              )}
              <Button
                type="primary"
                onClick={sendMessage}
                disabled={!inputValue.trim() || loading}
                icon={<SendOutlined />}
              >
                发送
              </Button>
            </Space>
          </Space>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;