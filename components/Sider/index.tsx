import React, { useState, useEffect, useMemo } from 'react';
import { Layout, Button, Modal, List, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined, StarOutlined, StarFilled, MessageOutlined } from '@ant-design/icons';

const { Sider: AntdSider } = Layout;

// 模拟翻译函数
const t = (key: string) => {
  const translations: Record<string, string> = {
    'chat.newChatButton': '新建聊天',
    'chat.deleteMessage': '删除消息',
    'chat.clearHistoryConfirm': '确定要清空所有聊天记录吗？',
    'common.yes': '是',
    'common.no': '否',
  };
  return translations[key] || key;
};

interface Chat {
  id: string;
  title: string;
  time: string;
  isStarred: boolean;
}

interface SiderProps {
  currentChatId: string;
  chats: Chat[];
  onChatSelect: (chatId: string) => void;
  onNewChat: () => void;
  onChatsUpdate: (chats: Chat[]) => void;
}

const Sider = ({ currentChatId, chats, onChatSelect, onNewChat, onChatsUpdate }: SiderProps) => {
  // 模拟状态
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [show, setShow] = useState(false);

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleAdd = () => {
    onNewChat();
  };

  const handleUpdateCollapsed = () => {
    setCollapsed(!collapsed);
  };

  const handleClearAll = () => {
    Modal.warning({
      title: t('chat.deleteMessage'),
      content: t('chat.clearHistoryConfirm'),
      okText: t('common.yes'),
      cancelText: t('common.no'),
      onOk: () => {
        onChatsUpdate([]);
      },
    });
  };

  const handleToggleStar = (id: string) => {
    onChatsUpdate(chats.map(chat => 
      chat.id === id ? { ...chat, isStarred: !chat.isStarred } : chat
    ));
  };

  const handleDeleteChat = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除此聊天记录吗？',
      okText: '是',
      cancelText: '否',
      onOk: () => {
        onChatsUpdate(chats.filter(chat => chat.id !== id));
      },
    });
  };

  const getMobileClass = useMemo(() => {
    if (isMobile) {
      return {
        position: 'fixed',
        zIndex: 50,
      };
    }
    return {};
  }, [isMobile]);

  return (
    <AntdSider
      collapsible
      collapsed={collapsed}
      collapsedWidth={0}
      width={280}
      trigger={isMobile ? null : undefined}
      style={{ ...getMobileClass, backgroundColor: '#ffffff', borderRight: '1px solid #f0f0f0' }}
      onCollapse={handleUpdateCollapsed}
    >
      <div className="flex flex-col h-full">
        {/* 顶部标题和新建按钮 */}
        <div className="p-3 border-b flex items-center justify-between">
          <div className="text-lg font-semibold text-gray-900">新建聊天</div>
          <Tooltip title="新建聊天">
            <Button 
              type="text" 
              icon={<PlusOutlined />} 
              onClick={handleAdd}
              size="large"
            />
          </Tooltip>
        </div>
        
        {/* 新建聊天按钮 */}
        <div className="p-3">
          <Button 
            type="primary" 
            block 
            onClick={handleAdd}
            icon={<PlusOutlined />}
            size="large"
          >
            {t('chat.newChatButton')}
          </Button>
        </div>
        
        {/* 聊天列表 */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <List
            className="h-full overflow-y-auto"
            dataSource={chats}
            renderItem={(chat) => (
              <List.Item
                key={chat.id}
                className={`cursor-pointer hover:bg-gray-50 border-b border-gray-100 ${
                  chat.id === currentChatId ? 'bg-blue-50 text-blue-600' : ''
                }`}
                actions={[
                  <Tooltip title={chat.isStarred ? '取消收藏' : '收藏'}>
                    <Button 
                      type="text" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleStar(chat.id);
                      }}
                    >
                      {chat.isStarred ? <StarFilled style={{ color: '#ffd700' }} /> : <StarOutlined />}
                    </Button>
                  </Tooltip>,
                  <Tooltip title="删除">
                    <Button 
                      type="text" 
                      danger
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteChat(chat.id);
                      }}
                    >
                      <DeleteOutlined />
                    </Button>
                  </Tooltip>
                ]}
                onClick={() => onChatSelect(chat.id)}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center">
                    <MessageOutlined className="mr-2 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{chat.title}</div>
                      <div className="text-xs text-gray-500">{chat.time}</div>
                    </div>
                  </div>
                </div>
              </List.Item>
            )}
          />
          
          {/* 空状态 */}
          {chats.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              <div className="text-4xl mb-2">💬</div>
              <div>暂无聊天记录</div>
              <div className="text-xs mt-1">点击上方按钮开始新的对话</div>
            </div>
          )}
        </div>
        
        {/* 底部操作区 */}
        <div className="p-3 border-t bg-gray-50">
          <div className="flex items-center justify-between">
            <Button 
              type="text" 
              block 
              onClick={() => setShow(true)}
              className="flex-1 mr-2"
            >
              提示词商店
            </Button>
            <Tooltip title="清空所有">
              <Button 
                type="text" 
                danger
                icon={<DeleteOutlined />} 
                onClick={handleClearAll}
              />
            </Tooltip>
          </div>
        </div>
        
        {/* 底部信息 */}
        <div className="p-2 border-t text-center">
          <div className="text-xs text-gray-500">AI 聊天助手</div>
          <div className="text-xs text-gray-400 mt-1">v1.0.0</div>
        </div>
      </div>
      
      {/* 移动端遮罩 */}
      {isMobile && !collapsed && (
        <div
          className="fixed inset-0 z-40 w-full h-full bg-black/40"
          onClick={handleUpdateCollapsed}
        />
      )}
    </AntdSider>
  );
};

export default Sider;