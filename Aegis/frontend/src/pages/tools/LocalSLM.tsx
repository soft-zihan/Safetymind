import { useState, useEffect } from 'react';
import { Card, Table, Tag, Row, Col, Statistic, Descriptions, Alert, Button, Space, Empty, Spin } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import axios from 'axios';

const statusColor: Record<string, string> = { running: 'green', ready: 'blue', downloading: 'orange', available: 'default' };
const statusLabel: Record<string, string> = { running: '运行中', ready: '就绪', downloading: '下载中', available: '可用' };

export default function LocalSLM() {
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      const res = await axios.get('/api/tools/qise/models');
      if (Array.isArray(res.data)) setModels(res.data);
    } catch {
      // 后端未连接
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  return (
    <div>
      <Alert message="本地安全模型（SLM）" description="Aegis 内置安全分类模型，提供毫秒级语义安全检查。支持多种模型并行运行。" type="info" showIcon style={{ marginBottom: 16 }} />

      {models.length === 0 ? (
        <Alert
          message="未检测到模型"
          description="后端未连接或无模型记录。请确保 Ollama 服务已启动。"
          type="info"
          showIcon
        />
      ) : (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}><Card size="small"><Statistic title="模型总数" value={models.length} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="运行中" value={models.filter(m => m.status === 'running').length} valueStyle={{ color: '#52c41a' }} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="最佳 F1" value="—" valueStyle={{ color: '#1890ff' }} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="最低 FPR" value="—" valueStyle={{ color: '#722ed1' }} /></Card></Col>
          </Row>

          <Card title="模型列表" style={{ marginBottom: 16 }}>
            <Table dataSource={models} rowKey="name" pagination={false} size="small"
              columns={[
                { title: '模型', dataIndex: 'name', key: 'name', render: (n: string) => <span style={{ fontWeight: 600 }}>{n}</span> },
                { title: '提供商', dataIndex: 'provider', key: 'provider' },
                { title: '规模', dataIndex: 'size', key: 'size' },
                { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={statusColor[s]}>{statusLabel[s]}</Tag> },
                { title: '延迟', dataIndex: 'latency', key: 'latency', render: (l: string) => l === '—' ? '—' : <span style={{ color: '#52c41a', fontWeight: 600 }}>{l}</span> },
                { title: 'F1', dataIndex: 'f1', key: 'f1', render: (f: number | string) => typeof f === 'number' ? <span style={{ fontWeight: 600 }}>{f.toFixed(3)}</span> : f },
                { title: 'FPR', dataIndex: 'fpr', key: 'fpr', render: (f: number | string) => typeof f === 'number' ? <span>{(f * 100).toFixed(1)}%</span> : f },
                { title: '用途', dataIndex: 'tasks', key: 'tasks', render: (t: string) => <span style={{ color: '#666', fontSize: 12 }}>{t}</span> },
              ]}
            />
          </Card>
        </>
      )}

      <Row gutter={16}>
        <Col span={12}>
          <Card title="当前配置">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="推理后端">Ollama (localhost:11434)</Descriptions.Item>
              <Descriptions.Item label="超时时间">30,000 ms</Descriptions.Item>
            </Descriptions>
            <Space style={{ marginTop: 16 }}>
              <Button icon={<SyncOutlined />} onClick={loadModels}>检查状态</Button>
            </Space>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="性能指标">
            <Empty description="连接后端后显示性能指标" />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
