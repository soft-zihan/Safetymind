import { useState } from 'react';
import { Card, Button, Space, Tag, Descriptions, Alert } from 'antd';
import {
  PlayCircleOutlined,
  StopOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

const ClawShellStatus = () => {
  const [loading, setLoading] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<'running' | 'stopped' | 'unknown'>('unknown');
  const [message, setMessage] = useState<string>('');

  const handleStart = async () => {
    setLoading(true);
    setMessage('正在启动 ClawShell...');
    // TODO: 调用后端 API 启动服务
    setTimeout(() => {
      setServiceStatus('running');
      setMessage('ClawShell 已启动');
      setLoading(false);
    }, 2000);
  };

  const handleStop = async () => {
    setLoading(true);
    setMessage('正在停止 ClawShell...');
    // TODO: 调用后端 API 停止服务
    setTimeout(() => {
      setServiceStatus('stopped');
      setMessage('ClawShell 已停止');
      setLoading(false);
    }, 2000);
  };

  const handleRestart = async () => {
    setLoading(true);
    setMessage('正在重启 ClawShell...');
    // TODO: 调用后端 API 重启服务
    setTimeout(() => {
      setServiceStatus('running');
      setMessage('ClawShell 已重启');
      setLoading(false);
    }, 2000);
  };

  return (
    <div style={{ padding: '0 16px' }}>
      <Alert
        message="ClawShell 服务管理"
        description="在此管理 ClawShell 代理服务的运行状态。ClawShell 是一个独立运行的 Rust 服务，负责 API 密钥管理和 DLP 扫描。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Card title="服务状态" style={{ marginBottom: 24 }}>
        <Descriptions column={2} bordered>
          <Descriptions.Item label="运行状态">
            <Tag 
              color={
                serviceStatus === 'running' ? 'green' : 
                serviceStatus === 'stopped' ? 'red' : 'default'
              }
              style={{ fontSize: 14, padding: '4px 12px' }}
            >
              {
                serviceStatus === 'running' ? '● 运行中' : 
                serviceStatus === 'stopped' ? '● 已停止' : '● 未知'
              }
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="监听地址">
            <code>127.0.0.1:21789</code>
          </Descriptions.Item>
          <Descriptions.Item label="服务类型">
            Rust 代理服务
          </Descriptions.Item>
          <Descriptions.Item label="版本">
            v0.2.1
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="服务控制" style={{ marginBottom: 24 }}>
        <Space size="large">
          <Button 
            type="primary" 
            icon={<PlayCircleOutlined />}
            onClick={handleStart}
            loading={loading}
            disabled={serviceStatus === 'running'}
          >
            启动服务
          </Button>
          <Button 
            danger
            icon={<StopOutlined />}
            onClick={handleStop}
            loading={loading}
            disabled={serviceStatus === 'stopped'}
          >
            停止服务
          </Button>
          <Button 
            icon={<ReloadOutlined />}
            onClick={handleRestart}
            loading={loading}
            disabled={serviceStatus === 'stopped'}
          >
            重启服务
          </Button>
        </Space>
      </Card>

      {message && (
        <Alert
          message="操作状态"
          description={message}
          type={serviceStatus === 'running' ? 'success' : 'info'}
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Card title="快速命令">
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <strong>启动服务（前台）：</strong>
            <code style={{ background: '#f5f5f5', padding: '4px 8px', borderRadius: 4, display: 'block', marginTop: 8 }}>
              clawshell start --foreground
            </code>
          </div>
          <div>
            <strong>启动服务（后台）：</strong>
            <code style={{ background: '#f5f5f5', padding: '4px 8px', borderRadius: 4, display: 'block', marginTop: 8 }}>
              clawshell start
            </code>
          </div>
          <div>
            <strong>查看状态：</strong>
            <code style={{ background: '#f5f5f5', padding: '4px 8px', borderRadius: 4, display: 'block', marginTop: 8 }}>
              clawshell status
            </code>
          </div>
          <div>
            <strong>查看日志：</strong>
            <code style={{ background: '#f5f5f5', padding: '4px 8px', borderRadius: 4, display: 'block', marginTop: 8 }}>
              clawshell logs --follow
            </code>
          </div>
          <div>
            <strong>停止服务：</strong>
            <code style={{ background: '#f5f5f5', padding: '4px 8px', borderRadius: 4, display: 'block', marginTop: 8 }}>
              clawshell stop
            </code>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default ClawShellStatus;
