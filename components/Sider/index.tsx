import React, { useMemo, useState } from 'react';
import { Layout, Button, Tooltip, Input, Empty, Space, Modal, message } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  StarOutlined,
  StarFilled,
  MessageOutlined,
  SearchOutlined,
  EditOutlined
} from '@ant-design/icons';

const { Sider: AntdSider } = Layout;
const { Search } = Input;

interface ChatSummary {
  id: string;
  title: string;
  subtitle: string;
  lastMessage?: string;
  isStarred: boolean;
  unread?: boolean;
}

interface SiderProps {
  currentChatId: string;
  chats: ChatSummary[];
  onChatSelect: (chatId: string) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
  onToggleStar: (chatId: string) => void;
  onRenameChat: (chatId: string, nextTitle: string) => void;
  onClearAll: () => void;
  isMobile: boolean;
  collapsed: boolean;
  onCollapseChange: (collapsed: boolean) => void;
}

const Sider = ({
  currentChatId,
  chats,
  onChatSelect,
  onNewChat,
  onDeleteChat,
  onToggleStar,
  onRenameChat,
  onClearAll,
  isMobile,
  collapsed,
  onCollapseChange
}: SiderProps) => {
  const [searchText, setSearchText] = useState('');
  const [editingChatId, setEditingChatId] = useState('');
  const [editingTitle, setEditingTitle] = useState('');

  const isCollapsed = collapsed && !isMobile;

  const handleAdd = () => {
    onNewChat();
    if (isMobile) {
      onCollapseChange(true);
    }
  };

  const filteredChats = useMemo(() => {
    if (!searchText.trim()) return chats;
    const lower = searchText.toLowerCase();
    return chats.filter(chat =>
      chat.title.toLowerCase().includes(lower) ||
      (chat.lastMessage && chat.lastMessage.toLowerCase().includes(lower))
    );
  }, [searchText, chats]);

  const mobileStyle = useMemo(() => {
    if (!isMobile) return {};
    return {
      position: 'fixed' as const,
      zIndex: 60,
      height: '100vh'
    };
  }, [isMobile]);

  const handleStartEdit = (chatId: string, title: string) => {
    setEditingChatId(chatId);
    setEditingTitle(title);
  };

  const finishEditing = () => {
    const trimmed = editingTitle.trim();
    if (!trimmed) {
      message.warning('标题不能为空');
      return;
    }
    onRenameChat(editingChatId, trimmed);
    setEditingChatId('');
    setEditingTitle('');
  };

  const confirmClearAll = () => {
    Modal.confirm({
      title: '清空所有聊天',
      content: '确定要删除全部聊天记录吗？此操作无法撤销。',
      okText: '清空',
      cancelText: '取消',
      okType: 'danger',
      centered: true,
      onOk: () => {
        onClearAll();
      }
    });
  };

  const renderExpandedContent = () => (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-5 pb-4 border-b border-gray-200 bg-white">
        <Button
          type="primary"
          size="large"
          icon={<PlusOutlined />}
          block
          onClick={handleAdd}
          style={{ borderRadius: 12, background: '#22c55e', borderColor: '#22c55e' }}
        >
          新建聊天
        </Button>
        <Search
          placeholder="搜索会话"
          allowClear
          value={searchText}
          onChange={event => setSearchText(event.target.value)}
          className="mt-4"
          prefix={<SearchOutlined />}
          size="middle"
          style={{ borderRadius: 10 }}
        />
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto px-3 py-4 space-y-2">
          {filteredChats.length === 0 ? (
            <div className="mt-24">
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂时没有聊天"
              />
            </div>
          ) : (
            filteredChats.map(chat => {
              const isActive = chat.id === currentChatId;
              return (
                <div
                  key={chat.id}
                  className={`group rounded-xl border transition-all duration-200 hover:border-green-400 hover:bg-green-50 cursor-pointer ${
                    isActive ? 'border-green-400 bg-green-50 shadow-sm' : 'border-transparent bg-white'
                  }`}
                  onClick={() => {
                    onChatSelect(chat.id);
                    if (isMobile) {
                      onCollapseChange(true);
                    }
                  }}
                >
                  <div className="flex items-start justify-between px-3 pt-3">
                    <Space align="center" size={8}>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600">
                        <MessageOutlined />
                      </div>
                      {editingChatId === chat.id ? (
                        <Input
                          size="small"
                          autoFocus
                          value={editingTitle}
                          onChange={event => setEditingTitle(event.target.value)}
                          onPressEnter={finishEditing}
                          onBlur={finishEditing}
                        />
                      ) : (
                        <div>
                          <div className="text-sm font-medium text-gray-800">
                            {chat.title}
                          </div>
                          <div className="text-xs text-gray-500 mt-1 max-w-[180px] truncate">
                            {chat.subtitle}
                          </div>
                        </div>
                      )}
                    </Space>
                    <Space size={4}>
                      <Tooltip title={chat.isStarred ? '取消收藏' : '收藏此会话'}>
                        <Button
                          type="text"
                          size="small"
                          onClick={event => {
                            event.stopPropagation();
                            onToggleStar(chat.id);
                          }}
                        >
                          {chat.isStarred ? (
                            <StarFilled style={{ color: '#fbbf24' }} />
                          ) : (
                            <StarOutlined className="text-gray-400" />
                          )}
                        </Button>
                      </Tooltip>
                      <Tooltip title="重命名">
                        <Button
                          type="text"
                          size="small"
                          onClick={event => {
                            event.stopPropagation();
                            handleStartEdit(chat.id, chat.title);
                          }}
                        >
                          <EditOutlined className="text-gray-400" />
                        </Button>
                      </Tooltip>
                      <Tooltip title="删除此会话">
                        <Button
                          type="text"
                          size="small"
                          danger
                          onClick={event => {
                            event.stopPropagation();
                            onDeleteChat(chat.id);
                          }}
                        >
                          <DeleteOutlined />
                        </Button>
                      </Tooltip>
                    </Space>
                  </div>
                  {chat.lastMessage && (
                    <div
                      className="px-3 pb-3 pt-1 text-xs text-gray-500"
                      style={{
                        display: '-webkit-box',
                        WebkitBoxOrient: 'vertical',
                        WebkitLineClamp: 2,
                        overflow: 'hidden'
                      }}
                    >
                      {chat.lastMessage}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="border-t border-gray-200 bg-white px-4 py-3">
        <Button
          type="text"
          block
          onClick={confirmClearAll}
          icon={<DeleteOutlined />}
          danger
        >
          清空聊天记录
        </Button>
      </div>
    </div>
  );

  const renderCollapsedContent = () => (
    <div className="flex h-full flex-col items-center py-4" style={{ overflow: 'hidden' }}>
      <Space direction="vertical" size={16} align="center">
        <Tooltip title="新建聊天">
          <Button
            type="primary"
            shape="circle"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            style={{ background: '#22c55e', borderColor: '#22c55e' }}
          />
        </Tooltip>
        <Tooltip title="展开侧边栏">
          <Button
            shape="circle"
            icon={<SearchOutlined />}
            onClick={() => onCollapseChange(false)}
          />
        </Tooltip>
      </Space>

      <div className="mt-6 flex-1 w-full overflow-y-auto px-2">
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          {filteredChats.map(chat => {
            const isActive = chat.id === currentChatId;
            return (
              <Tooltip key={chat.id} title={chat.title} placement="right">
                <div
                  className={`flex h-10 items-center justify-center rounded-lg transition-all duration-200 ${
                    isActive ? 'bg-green-500 text-white shadow-sm' : 'bg-transparent text-gray-500'
                  } hover:bg-green-100 hover:text-green-600 cursor-pointer`}
                  onClick={() => onChatSelect(chat.id)}
                >
                  <MessageOutlined />
                </div>
              </Tooltip>
            );
          })}
        </Space>
      </div>

      <div className="mt-4">
        <Tooltip title="清空聊天记录">
          <Button
            shape="circle"
            icon={<DeleteOutlined />}
            danger
            onClick={confirmClearAll}
          />
        </Tooltip>
      </div>
    </div>
  );

  return (
    <AntdSider
      collapsible
      collapsed={collapsed}
      collapsedWidth={isMobile ? 0 : 72}
      width={280}
      trigger={isMobile ? null : undefined}
      onCollapse={value => onCollapseChange(value)}
      style={{
        ...mobileStyle,
        backgroundColor: '#fbfbfb',
        borderRight: '1px solid #e9e9e9',
        boxShadow: '2px 0 12px rgba(15, 15, 15, 0.06)'
      }}
    >
      {isCollapsed ? renderCollapsedContent() : renderExpandedContent()}

      {isMobile && !collapsed && (
        <div
          className="fixed inset-0 z-50 h-full w-full bg-black/30"
          onClick={() => onCollapseChange(true)}
        />
      )}
    </AntdSider>
  );
};

export default Sider;