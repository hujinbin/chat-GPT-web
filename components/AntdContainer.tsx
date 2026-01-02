'use client'
import React from 'react'
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';

function AntdContainer({
    children,
}: {
    children: React.ReactNode
}) {
    // 使用 antd 默认主题颜色
    const themeConfig = {
        token: {
            colorPrimary: '#1890ff', // antd 默认蓝色
            borderRadius: 6,
        },
    };
    
    return (
        <ConfigProvider 
            locale={zhCN}
            theme={themeConfig}
        >
            {children}
        </ConfigProvider>
    )
}

export default AntdContainer;