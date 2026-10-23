import { useState, useEffect } from 'react';
import { Card, Table, Tag, Row, Col, Statistic, Descriptions, Space, Badge, Spin } from 'antd';
import { SafetyOutlined, ThunderboltOutlined, WarningOutlined } from '@ant-design/icons';
import { getStatus } from '../../lib/qiseApi';
import { normalizeStatus } from '../../lib/normalize';
import { ApiErrorState, DataEmpty } from '../../components/ApiErrorState';
import type { AppStatus, AgentInfo } from '../../lib/types';

export default function Shield() {
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadStatus(); }, []);

  const loadStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getStatus();
      const s = normalizeStatus(data);
      if (s?.detected_agents && s.detected_agents.length > 0) {
        setStatus(s);
      } else {
        setStatus(s); // 即使为空也显示，使用 DataEmpty
      }
    } catch (err: any) {
      setError(err.message || '无法加载系统状态');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  if (error) {
    return <ApiErrorState error={error} onRetry={loadStatus} />;
  }

  const agents = status?.detected_agents || [];
  const protectedAgents = status?.protected_agents || {};
  const events24h = status?.events_24h || { blocked: 0, warnings: 0 };

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="防护状态" value={status?.protection_enabled ? '已启用' : '未启用'}
              valueStyle={{ color: status?.protection_enabled ? '#52c41a' : '#ff4d4f' }} prefix={<SafetyOutlined />} />
          </Card>
        </Col>
        <Col span={6}><Card size="small"><Statistic title="代理端口" value={status?.proxy_port || '—'} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="24h 拦截" value={events24h.blocked} valueStyle={{ color: '#ff4d4f' }} prefix={<ThunderboltOutlined />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="24h 告警" value={events24h.warnings} valueStyle={{ color: '#faad14' }} prefix={<WarningOutlined />} /></Card></Col>
      </Row>

      {agents.length > 0 ? (
        <Card title="🛡️ 智能体列表" style={{ marginBottom: 16 }}>
          <Table dataSource={agents} rowKey="key" pagination={false} size="small"
            columns={[
              { title: '智能体', dataIndex: 'name', key: 'name', render: (n: string) => <span style={{ fontWeight: 600 }}>{n}</span> },
              { title: '安装', key: 'installed', width: 80, render: (_: any, r: AgentInfo) => r.installed ? <Tag color="green">已安装</Tag> : <Tag>未安装</Tag> },
              { title: '防护', key: 'protected', width: 80, render: (_: any, r: AgentInfo) => r.protected ? <Badge status="success" text="已保护" /> : <Badge status="default" text="未保护" /> },
              { title: '配置路径', dataIndex: 'config_path', key: 'config', render: (p: string) => <span style={{ color: '#666', fontSize: 12 }}>{p}</span> },
              { title: '备注', dataIndex: 'note', key: 'note', render: (n: string) => <span style={{ color: '#888', fontSize: 12 }}>{n}</span> },
            ]}
          />
        </Card>
      ) : (
        <Card title="🛡️ 智能体列表" style={{ marginBottom: 16 }}>
          <DataEmpty description="未检测到智能体，请先安装 OpenClaw" />
        </Card>
      )}

      {Object.keys(protectedAgents).length > 0 && (
        <Card title="🔒 已保护智能体详情">
          {Object.entries(protectedAgents).map(([key, record]) => (
            <Card key={key} size="small" style={{ marginBottom: 12 }} title={<Space><SafetyOutlined style={{ color: '#52c41a' }} /><span>{record.display_name || key}</span></Space>}>
              <Descriptions column={2} size="small">
                <Descriptions.Item label="配置路径">{record.config_path}</Descriptions.Item>
                <Descriptions.Item label="备份路径">{record.backup_path}</Descriptions.Item>
                <Descriptions.Item label="代理地址"><Tag color="blue">{record.proxy_url}</Tag></Descriptions.Item>
                <Descriptions.Item label="上游地址"><Tag>{record.upstream_url}</Tag></Descriptions.Item>
                {record.protected_at && <Descriptions.Item label="保护时间">{new Date(record.protected_at).toLocaleString('zh-CN')}</Descriptions.Item>}
              </Descriptions>
            </Card>
          ))}
        </Card>
      )}
    </div>
  );
}
