import React from 'react';
import { Space, Button, Tooltip } from 'antd';
import { ExportOutlined, SettingOutlined, PlusOutlined } from '@ant-design/icons';

interface HeaderComponentProps {
  usingContext?: boolean;
  onExport?: () => void;
  onToggleUsingContext?: () => void;
  onNewChat?: () => void;
}

export default function HeaderComponent({
  usingContext = false,
  onExport = () => {},
  onToggleUsingContext = () => {},
  onNewChat = () => {},
}: HeaderComponentProps) {
  return (
    <Space size="middle">
      <Tooltip title="导出聊天记录">
        <Button 
          type="text" 
          icon={<ExportOutlined />} 
          onClick={onExport}
        />
      </Tooltip>
      <Tooltip title={usingContext ? '关闭上下文' : '开启上下文'}>
        <Button 
          type={usingContext ? 'primary' : 'default'} 
          icon={<SettingOutlined />} 
          onClick={onToggleUsingContext}
        >
          {usingContext ? '上下文' : '上下文'}
        </Button>
      </Tooltip>
      <Tooltip title="新建聊天">
        <Button 
          type="text" 
          icon={<PlusOutlined />} 
          onClick={onNewChat}
        />
      </Tooltip>
    </Space>
  );
}