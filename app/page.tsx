'use client';
// 引入 React 及相关钩子
import React, { useEffect, useRef } from 'react';
// 引入 Ant Design 组件
import { Space, Spin } from 'antd';

// 引入自定义组件，用于后续替换
import HeaderComponent from '../components/HeaderComponent';
import MessageComponent from '../components/MessageComponent';

// 假设 loading 和 isMobile 为状态，这里简单模拟
const loading = false;
const isMobile = false;

// 模拟数据，对应 Vue 中的 dataSources
const dataSources = [
  {
    dateTime: '2025-01-21',
    text: '这是一条消息',
    inversion: false,
    error: false,
    loading: false,
  },
  // 可以添加更多数据
];

// 定义滚动到底部的函数
const scrollToBottom = () => {
  // 这里可以实现滚动逻辑，需要根据实际 DOM 结构调整
  console.log('滚动到底部');
};

// 模拟 controller.abort() 方法
const controller = {
  abort: () => {
    console.log('请求已中止');
  },
};

const ChatPage = () => {
  // 创建 inputRef 引用
  const inputRef = useRef(null);
  // 创建 scrollRef 引用
  const scrollRef = useRef(null);

  // 模拟 Vue 的 onMounted 钩子
  useEffect(() => {
    scrollToBottom();
    if (inputRef.current && !isMobile) {
      inputRef.current.focus();
    }
    // 模拟 Vue 的 onUnmounted 钩子，返回一个清理函数
    return () => {
      if (loading) {
        controller.abort();
      }
    };
  }, []);

  return (
    <div className="flex flex-col w-full h-full">
      {/* 条件渲染 HeaderComponent */}
      {isMobile && (
        <HeaderComponent
          usingContext={false} // 假设初始值为 false
          onExport={() => console.log('导出')}
          onToggleUsingContext={() => console.log('切换上下文')}
        />
      )}
      {/* 主内容区域 */}
      <main className="flex-1 overflow-hidden">
        <div
          id="scrollRef"
          ref={scrollRef}
          className="h-full overflow-hidden overflow-y-auto"
        >
          <div
            id="image-wrapper"
            className="w-full max-w-screen-xl m-auto dark:bg-[#101014]"
            className={isMobile ? 'p-2' : 'p-4'}
          >
            {/* 数据为空时的显示 */}
            {dataSources.length === 0 ? (
              <Space align="center" className="mt-4 text-center text-neutral-300">
                <Spin className="mr-2 text-3xl" />
                <span>Aha~</span>
              </Space>
            ) : (
              // 数据存在时渲染 Message 组件列表
              <div>
                {dataSources.map((item, index) => (
                  <MessageComponent
                    key={index}
                    dateTime={item.dateTime}
                    text={item.text}
                    inversion={item.inversion}
                    error={item.error}
                    loading={item.loading}
                    onRegenerate={() => console.log(`重新生成: ${index}`)}
                    onDelete={() => console.log(`删除: ${index}`)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ChatPage;