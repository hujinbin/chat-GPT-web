import React from 'react';
import { Space, Button, Tooltip, Switch } from 'antd';
import { ExportOutlined, SettingOutlined, PlusOutlined, DownloadOutlined } from '@ant-design/icons';

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
    <Space size="middle" className="header-actions">
      <Tooltip title="导出聊天记录">
        <Button 
          type="default" 
          icon={<DownloadOutlined />} 
          onClick={onExport}
          size="small"
          style={{ borderRadius: '8px' }}
        >
          导出
        </Button>
      </Tooltip>
      
      <Tooltip title={usingContext ? '关闭上下文' : '开启上下文'}>
        <Space size="small" align="center">
          <SettingOutlined className="text-gray-600" />
          <span className="text-sm text-gray-700">上下文</span>
          <Switch 
            checked={usingContext} 
            onChange={onToggleUsingContext}
            checkedChildren="开" 
            unCheckedChildren="关"
            size="small"
          />
        </Space>
      </Tooltip>
      
      <Tooltip title="新建聊天">
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={onNewChat}
          size="small"
          style={{ borderRadius: '8px', backgroundColor: '#165DFF' }}
        >
          新建
        </Button>
      </Tooltip>
    </Space>
  );
}