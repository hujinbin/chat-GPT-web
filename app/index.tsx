'use client';
import React, { useState } from 'react';
import { Layout } from 'antd';
import Sider from '../components/Sider/index';
import type { ChatSummary } from '../components/Sider/index';
import ChatPage from './page';

const { Content } = Layout;

const ChatLayout = () => {
  // 模拟响应式检测
  const [isMobile, setIsMobile] = useState(false);
  const [isSiderCollapsed, setIsSiderCollapsed] = useState(false);

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
  const [chats, setChats] = useState<ChatSummary[]>([]);

  // 创建新聊天
  const createNewChat = () => {
    const newChat: ChatSummary = {
      id: Date.now().toString(),
      title: '新聊天',
      subtitle: '刚刚',
      isStarred: false,
    };
    setChats(prev => [newChat, ...prev]);
    setCurrentChatId(newChat.id);
  };

  const handleDeleteChat = (chatId: string) => {
    setChats(prev => prev.filter(c => c.id !== chatId));
  };

  const handleToggleStar = (chatId: string) => {
    setChats(prev => prev.map(c =>
      c.id === chatId ? { ...c, isStarred: !c.isStarred } : c
    ));
  };

  const handleRenameChat = (chatId: string, nextTitle: string) => {
    setChats(prev => prev.map(c =>
      c.id === chatId ? { ...c, title: nextTitle } : c
    ));
  };

  const handleClearAll = () => {
    setChats([]);
    setCurrentChatId('');
  };

  return (
    <Layout className="h-screen bg-gray-50 dark:bg-gray-900">
      <Sider
        currentChatId={currentChatId}
        chats={chats}
        onChatSelect={setCurrentChatId}
        onNewChat={createNewChat}
        onDeleteChat={handleDeleteChat}
        onToggleStar={handleToggleStar}
        onRenameChat={handleRenameChat}
        onClearAll={handleClearAll}
        isMobile={isMobile}
        collapsed={isSiderCollapsed}
        onCollapseChange={setIsSiderCollapsed}
      />
      <Layout className="h-full">
        <Content className="h-full p-0 overflow-hidden">
          <ChatPage />
        </Content>
      </Layout>
    </Layout>
  );
};

export default ChatLayout;
