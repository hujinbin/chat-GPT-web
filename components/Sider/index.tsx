import React, { useState, useEffect, useMemo } from 'react';
import { Layout, Button, Modal } from 'antd';
import { useAppStore, useChatStore } from '@/store';
import { useBasicLayout } from '@/hooks/useBasicLayout';
import List from './List';
import Footer from './Footer';

const { Sider: AntdSider } = Layout;

const Sider = () => {
  const appStore = useAppStore();
  const chatStore = useChatStore();
  const { isMobile } = useBasicLayout();
  const [show, setShow] = useState(false);
  const [collapsed, setCollapsed] = useState(appStore.siderCollapsed);

  useEffect(() => {
    appStore.setSiderCollapsed(isMobile);
  }, [isMobile, appStore]);

  const handleAdd = () => {
    chatStore.addHistory({ title: t('chat.newChatTitle'), uuid: Date.now(), isEdit: false });
    if (isMobile) appStore.setSiderCollapsed(true);
  };

  const handleUpdateCollapsed = () => {
    appStore.setSiderCollapsed(!collapsed);
    setCollapsed(!collapsed);
  };

  const handleClearAll = () => {
    Modal.warning({
      title: t('chat.deleteMessage'),
      content: t('chat.clearHistoryConfirm'),
      okText: t('common.yes'),
      cancelText: t('common.no'),
      onOk: () => {
        chatStore.clearHistory();
        if (isMobile) appStore.setSiderCollapsed(true);
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

  const mobileSafeArea = useMemo(() => {
    if (isMobile) {
      return {
        paddingBottom: 'env(safe-area-inset-bottom)',
      };
    }
    return {};
  }, [isMobile]);

  return (
    <AntdSider
      collapsible
      collapsed={collapsed}
      collapsedWidth={0}
      width={260}
      trigger={isMobile ? null : undefined}
      style={getMobileClass}
      onCollapse={handleUpdateCollapsed}
    >
      <div className="flex flex-col h-full" style={mobileSafeArea}>
        <main className="flex flex-col flex-1 min-h-0">
          <div className="p-4">
            <Button type="dashed" block onClick={handleAdd}>
              {t('chat.newChatButton')}
            </Button>
          </div>
          <div className="flex-1 min-h-0 pb-4 overflow-hidden">
            <List />
          </div>
          <div className="flex items-center p-4 space-x-4">
            <div className="flex-1">
              <Button block onClick={() => setShow(true)}>
                提示词商店
              </Button>
            </div>
            <Button onClick={handleClearAll}>
              <SvgIcon icon="ri:close-circle-line" />
            </Button>
          </div>
        </main>
        <Footer />
      </div>
      {isMobile && !collapsed && (
        <div
          className="fixed inset-0 z-40 w-full h-full bg-black/40"
          onClick={handleUpdateCollapsed}
        />
      )}
      {/* PromptStore 组件需要在这里实现 */}
    </AntdSider>
  );
};

export default Sider;