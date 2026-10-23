import { useState, useEffect } from 'react';
import { Card, Row, Col, Tag, Typography, Divider, Space, Alert, Spin } from 'antd';
import axios from 'axios';

const { Paragraph, Text } = Typography;

interface IntegrationItem {
  key: string;
  icon: string;
  label: string;
  status: string;
  description: string;
  agents: number;
  snippet: string;
}

const statusColor: Record<string, string> = { active: 'green', available: 'blue', sdk: 'purple', unknown: 'default' };
const statusLabel: Record<string, string> = { active: '已激活', available: '可用', sdk: 'SDK 集成', unknown: '未检测' };

export default function Integrations() {
  const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      const res = await axios.get('/api/tools/qise/integrations');
      if (Array.isArray(res.data)) setIntegrations(res.data);
    } catch {
      // 后端未连接
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  return (
    <div>
      <Card title="集成管理" style={{ marginBottom: 16 }}>
        <Text type="secondary">
          Aegis 通过代理模式和 SDK 适配器与各安全组件无缝集成。
        </Text>
      </Card>

      {integrations.length === 0 ? (
        <Alert
          message="未检测到集成配置"
          description="后端未连接或无集成记录。请确保 Aegis 后端服务已启动。"
          type="info"
          showIcon
        />
      ) : (
        <Row gutter={[16, 16]}>
          {integrations.map(item => (
            <Col xs={24} lg={12} key={item.key}>
              <Card hoverable
                title={<Space><span style={{ fontSize: 24 }}>{item.icon}</span><span>{item.label}</span></Space>}
                extra={<Tag color={statusColor[item.status] || 'default'}>{statusLabel[item.status] || item.status}</Tag>}>
                <div style={{ marginBottom: 12 }}>{item.description}</div>
                {item.agents > 0 && <Text type="secondary">已保护 {item.agents} 个智能体</Text>}
                <Divider style={{ margin: '12px 0' }} />
                <div style={{ position: 'relative' }}>
                  <Paragraph code copyable={{ text: item.snippet }} style={{ background: '#f6f8fa', padding: 12, borderRadius: 6, fontSize: 12, marginBottom: 0 }}>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{item.snippet}</pre>
                  </Paragraph>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}
