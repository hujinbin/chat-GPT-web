'use client';
import React, { useMemo, useEffect } from 'react';
import { Layout } from 'antd';
import { useRouter } from 'next/router';
import Sider from '../components/Sider/index.jsx';
import Permission from '../components/Permission';
import HeaderComponent from '../components/HeaderComponent'; // 假设 HeaderComponent 是一个 React 组件
import useBasicLayout from '@/hooks/useBasicLayout';

const { Content } = Layout;

const ChatLayout = () => {
  const router = useRouter();

  const { isMobile } = useBasicLayout();
 
  const getMobileClass = useMemo(() => {
    if (isMobile) return 'rounded-none shadow-none';
    return 'border rounded-md shadow-md dark:border-neutral-800';
  }, [isMobile]);
  return (
    <div className={`h-full dark:bg-[#24272e] transition-all ${isMobile ? 'p-0' : 'p-4'}`}>
      <div className={`h-full overflow-hidden ${getMobileClass}`}>
        <Layout className={`z-40 transition ${getContainerClass}`} hasSider>
          <Sider />
          <Content className="h-full">
            <HeaderComponent />
            {/* 使用Next.js的Link组件进行导航 */}
            <Switch>
              <Route path="/chat/:uuid" component={ChatComponent} />
              {/* 其他路由 */}
            </Switch>
          </Content>
        </Layout>
      </div>
    </div>
  );
};

export default ChatLayout;