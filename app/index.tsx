'use client';
import React, { useState, useMemo } from 'react';
import { Layout } from 'antd';
import Sider from '../components/Sider/index';
import ChatPage from './page';

const { Content } = Layout;

const ChatLayout = () => {
  // 模拟响应式检测
  const [isMobile, setIsMobile] = useState(false);
  
  // 监听窗口大小变化
  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [currentChatId, setCurrentChatId] = useState<string>('');
  const [chats, setChats] = useState<Array<{ id: string; title: string; time: string; isStarred: boolean }>>([]);

  // 创建新聊天
  const createNewChat = () => {
    const newChat = {
      id: Date.now().toString(),
      title: '新聊天',
      time: '刚刚',
      isStarred: false,
    };
    setChats(prev => [newChat, ...prev]);
    setCurrentChatId(newChat.id);
  };

  return (
    <Layout className="h-screen bg-gray-50 dark:bg-gray-900">
      <Sider 
        currentChatId={currentChatId}
        chats={chats}
        onChatSelect={setCurrentChatId}
        onNewChat={createNewChat}
        onChatsUpdate={setChats}
      />
      <Layout className="h-full">
        <Content className="h-full p-0 overflow-hidden">
          <ChatPage isMobile={isMobile} currentChatId={currentChatId} onNewChat={createNewChat} />
        </Content>
      </Layout>
    </Layout>
  );
};

export default ChatLayout;