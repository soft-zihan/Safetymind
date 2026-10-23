import { useState, useEffect } from 'react';
import { Card, Table, Tag, Select, Typography, Button, Alert, Space, Row, Col, Statistic, Empty } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Paragraph } = Typography;

const verdictColor: Record<string, string> = { BLOCK: 'red', WARN: 'orange', PASS: 'green', 'PASS ⚠️': 'volcano' };

export default function RuntimeObserver() {
  const [agent, setAgent] = useState<string>('');
  const [command, setCommand] = useState<string>('');
  const [streaming, setStreaming] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/tools/qise/runtime-events');
      if (Array.isArray(res.data)) setEvents(res.data);
    } catch {
      // 后端未连接，保持空列表
    } finally { setLoading(false); }
  };

  const generateCommand = () => {
    if (!agent) return;
    setCommand(`# 启动金刚龙虾代理保护 ${agent}\nexport OPENAI_BASE_URL=http://localhost:8822/v1\nexport OPENAI_API_KEY=sk-fixed\n${agent} --config ~/.${agent}/config.yaml`);
  };

  return (
    <div>
      <Alert message="运行时观察器" description="实时监控金刚龙虾和裸奔龙虾的安全防护效果对比。红色标记为金刚龙虾拦截的威胁，裸奔龙虾无任何防护。" type="info" showIcon style={{ marginBottom: 16 }} />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="监控事件" value={events.length} suffix="条" /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="已拦截" value={events.filter((e: any) => e.verdict === 'BLOCK').length} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="告警" value={events.filter((e: any) => e.verdict === 'WARN').length} valueStyle={{ color: '#faad14' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="平均延迟" value="—" suffix="ms" /></Card></Col>
      </Row>

      <Card title="⚡ 实时事件流" style={{ marginBottom: 16 }}
        extra={
          <Space>
            <Button icon={streaming ? <PauseCircleOutlined /> : <PlayCircleOutlined />} type={streaming ? 'default' : 'primary'} onClick={() => setStreaming(!streaming)}>
              {streaming ? '暂停' : '开始监控'}
            </Button>
          </Space>
        }>
        {events.length === 0 && !loading ? (
          <Empty description="暂无监控事件，后端未连接或无数据" />
        ) : (
        <Table
          dataSource={events}
          rowKey="id"
          pagination={{ pageSize: 8 }}
          size="small"
          columns={[
            { title: '时间', dataIndex: 'time', key: 'time', width: 80 },
            { title: '智能体', dataIndex: 'agent', key: 'agent', width: 100, render: (a: string) => <Tag color={a.includes('金刚') ? 'green' : 'red'}>{a}</Tag> },
            { title: '事件', dataIndex: 'event', key: 'event', ellipsis: true },
            { title: '守卫', dataIndex: 'guard', key: 'guard', width: 140, render: (g: string) => g === '—' ? <span style={{ color: '#999' }}>—</span> : <Tag color="purple">{g}</Tag> },
            { title: '裁决', dataIndex: 'verdict', key: 'verdict', width: 100, render: (v: string) => <Tag color={verdictColor[v] || 'default'} style={{ fontWeight: 600 }}>{v}</Tag> },
            { title: '延迟', dataIndex: 'latency', key: 'latency', width: 70 },
          ]}
        />
        )}
      </Card>

      <Card title="🔧 命令生成器">
        <Space style={{ marginBottom: 12 }}>
          <span>选择智能体：</span>
          <Select value={agent} onChange={setAgent} placeholder="选择要保护的智能体" style={{ width: 200 }}
            options={[
              { label: '🦞 OpenClaw', value: 'openclaw' },
              { label: '🤖 Claude Code', value: 'claude' },
              { label: '💻 OpenAI Codex', value: 'codex' },
            ]}
          />
          <Button type="primary" onClick={generateCommand} disabled={!agent}>生成命令</Button>
        </Space>
        {command && (
          <Paragraph copyable={{ text: command, tooltips: ['复制', '已复制!'] }} style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, marginTop: 12 }}>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{command}</pre>
          </Paragraph>
        )}
      </Card>
    </div>
  );
}
