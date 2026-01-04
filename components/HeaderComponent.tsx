import React from 'react';
import { Space, Button, Tooltip, Switch } from 'antd';
import { ExportOutlined, SettingOutlined, PlusOutlined, DownloadOutlined } from '@ant-design/icons';

interface HeaderComponentProps {
  usingContext?: boolean;
  onExport?: () => void;
  onToggleUsingContext?: () => void;
  onNewChat?: () => void;
  isMobile?: boolean;
}

export default function HeaderComponent({
  usingContext = false,
  onExport = () => {},
  onToggleUsingContext = () => {},
  onNewChat = () => {},
  isMobile = false,
}: HeaderComponentProps) {
  return (
    <Space size={isMobile ? 8 : 'middle'} wrap className="header-actions">
      <Tooltip title="导出聊天记录">
        <Button 
          type="default" 
          icon={<DownloadOutlined />} 
          onClick={onExport}
          size={isMobile ? 'small' : 'middle'}
          style={{ borderRadius: '8px' }}
        >
          {!isMobile && '导出'}
        </Button>
      </Tooltip>
      
      <Tooltip title={usingContext ? '关闭上下文' : '开启上下文'}>
        <Space size="small" align="center">
          <SettingOutlined className="text-gray-600" />
          {!isMobile && <span className="text-sm text-gray-700">上下文</span>}
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
          size={isMobile ? 'small' : 'middle'}
          style={{ borderRadius: '8px', backgroundColor: '#165DFF' }}
        >
          {!isMobile && '新建'}
        </Button>
      </Tooltip>
    </Space>
  );
}