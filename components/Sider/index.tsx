import React, { useState, useEffect, useMemo } from 'react';
import { Layout, Button, Modal, List, Tooltip, Input, Badge, Empty, Space } from 'antd';
import { 
  PlusOutlined, 
  DeleteOutlined, 
  StarOutlined, 
  StarFilled, 
  MessageOutlined,
  SearchOutlined 
} from '@ant-design/icons';

const { Sider: AntdSider } = Layout;
const { Search } = Input;

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
  lastMessage?: string;
  unread?: boolean;
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
  const [searchText, setSearchText] = useState('');

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
      content: '确定要删除此聊天记录吗？此操作无法撤销。',
      okText: '删除',
      cancelText: '取消',
      okType: 'danger',
      centered: true,
      destroyOnClose: true,
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

  // 过滤聊天列表
  const filteredChats = chats.filter(chat => 
    chat.title.toLowerCase().includes(searchText.toLowerCase()) ||
    (chat.lastMessage && chat.lastMessage.toLowerCase().includes(searchText.toLowerCase()))
  );

  return (
    <AntdSider
      collapsible
      collapsed={collapsed}
      collapsedWidth={0}
      width={320}
      trigger={isMobile ? null : undefined}
      style={{ 
        ...getMobileClass, 
        backgroundColor: '#ffffff', 
        borderRight: '1px solid #f0f0f0',
        boxShadow: '2px 0 8px rgba(0, 0, 0, 0.05)'
      }}
      onCollapse={handleUpdateCollapsed}
    >
      <div className="flex flex-col h-full">
        {/* 顶部标题和搜索 */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <MessageOutlined className="text-blue-600 mr-2 text-xl" />
              <div className="text-lg font-bold text-gray-900">聊天记录</div>
            </div>
            <Tooltip title="新建聊天">
              <Button 
                type="primary" 
                shape="circle" 
                icon={<PlusOutlined />} 
                onClick={handleAdd}
                className="bg-blue-600 hover:bg-blue-700"
                size="small"
              />
            </Tooltip>
          </div>
          
          <Search
            placeholder="搜索聊天记录"
            allowClear
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            size="small"
            prefix={<SearchOutlined />}
            style={{ borderRadius: '8px', marginBottom: '8px' }}
          />
        </div>
        
        {/* 新建聊天按钮 */}
        <div className="p-3">
          <Button 
            type="primary" 
            block 
            onClick={handleAdd}
            icon={<PlusOutlined />}
            size="large"
            className="bg-blue-600 hover:bg-blue-700"
          >
            {t('chat.newChatButton')}
          </Button>
        </div>
        
        {/* 聊天列表 */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <div className="h-full overflow-y-auto p-2">
            {filteredChats.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<div className="text-gray-500">暂无聊天记录</div>}
                style={{ marginTop: '80px' }}
              >
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleAdd}
                  className="bg-blue-600 hover:bg-blue-700"
                  size="large"
                >
                  开始新聊天
                </Button>
              </Empty>
            ) : (
              <List
                className="h-full"
                dataSource={filteredChats}
                renderItem={(chat) => (
                  <List.Item
                    key={chat.id}
                    className={`cursor-pointer rounded-lg transition-all duration-200 ${currentChatId === chat.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''} hover:bg-gray-50`}
                    onClick={() => onChatSelect(chat.id)}
                    style={{ padding: '12px' }}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center">
                        <MessageOutlined className="mr-2 text-gray-400" />
                        <div className="flex-1 min-w-0">
                          <Badge dot={chat.unread && currentChatId !== chat.id}>
                            <div className={`text-sm font-medium truncate ${
                              currentChatId === chat.id ? 'text-blue-600' : 'text-gray-800'
                            }`}>
                              {chat.title}
                            </div>
                          </Badge>
                          <div className="text-xs text-gray-500 mt-1 truncate">
                            {chat.lastMessage || chat.time}
                          </div>
                        </div>
                      </div>
                      <Space size="small">
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
                        </Tooltip>
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
                      </Space>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </div>
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