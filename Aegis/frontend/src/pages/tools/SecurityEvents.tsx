import { useState, useEffect, useCallback } from 'react';
import { Card, Table, Tag, Drawer, Descriptions, Typography, Alert, Row, Col, Statistic } from 'antd';
import { getEvents } from '../../lib/qiseApi';
import { subscribeSecurityEvents } from '../../lib/eventStream';
import type { SecurityEvent } from '../../lib/types';

const { Text } = Typography;

const verdictColor: Record<string, string> = {
  block: 'red',
  warn: 'orange',
  pass: 'green',
};

const verdictLabel: Record<string, string> = {
  block: '已拦截',
  warn: '告警',
  pass: '通过',
};

export default function SecurityEvents() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    loadEvents();
    const cleanup = subscribeSecurityEvents((event) => {
      setEvents((prev) => [event, ...prev]);
    });
    return cleanup;
  }, []);

  const loadEvents = async () => {
    try {
      const data = await getEvents();
      if (Array.isArray(data)) { setEvents(data); }
    } catch {
      // 后端未连接，保持空列表
    } finally { setLoading(false); }
  };

  const handleRowClick = useCallback((record: SecurityEvent) => {
    setSelectedEvent(record);
    setDrawerOpen(true);
  }, []);

  const blockCount = events.filter(e => e.decision?.verdict?.toLowerCase() === 'block').length;
  const warnCount = events.filter(e => e.decision?.verdict?.toLowerCase() === 'warn').length;
  const passCount = events.filter(e => e.decision?.verdict?.toLowerCase() === 'pass').length;

  return (
    <div>
      {events.length === 0 && !loading && <Alert message="暂无安全事件" description="后端未连接或无安全事件记录。请确保 qise 防护服务已启动。" type="info" showIcon style={{ marginBottom: 16 }} />}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="总事件" value={events.length} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="已拦截" value={blockCount} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="告警" value={warnCount} valueStyle={{ color: '#faad14' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="放行" value={passCount} valueStyle={{ color: '#52c41a' }} /></Card></Col>
      </Row>
      <Card title="⚠️ 安全事件">
        <Table
          dataSource={Array.isArray(events) ? events : []}
          loading={loading}
          rowKey="id"
          onRow={(record) => ({ onClick: () => handleRowClick(record) })}
          style={{ cursor: 'pointer' }}
          columns={[
            {
              title: '时间',
              dataIndex: 'timestamp',
              key: 'timestamp',
              render: (text: string) => text.replace('T', ' ').slice(0, 19),
              width: 180,
            },
            {
              title: '守卫',
              dataIndex: ['action', 'name'],
              key: 'guard',
              width: 150,
            },
            {
              title: '裁决',
              dataIndex: ['decision', 'verdict'],
              key: 'verdict',
              render: (verdict: string) => (
                <Tag color={verdictColor[verdict?.toLowerCase() || 'pass']}>
                  {verdictLabel[verdict?.toLowerCase() || 'pass']}
                </Tag>
              ),
              width: 100,
            },
            {
              title: '摘要',
              key: 'summary',
              render: (_: any, record: SecurityEvent) => (
                <Text ellipsis>{record.evidence[0]?.message || record.recommendation}</Text>
              ),
            },
          ]}
        />
      </Card>

      <Drawer
        title="事件详情"
        placement="right"
        width={600}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        {selectedEvent && (
          <Descriptions column={1}>
            <Descriptions.Item label="时间">{selectedEvent.timestamp}</Descriptions.Item>
            <Descriptions.Item label="阶段">{selectedEvent.stage}</Descriptions.Item>
            <Descriptions.Item label="来源">{selectedEvent.source}</Descriptions.Item>
            <Descriptions.Item label="智能体">{selectedEvent.agent.name}</Descriptions.Item>
            <Descriptions.Item label="动作">{selectedEvent.action.name}</Descriptions.Item>
            <Descriptions.Item label="风险类别">{selectedEvent.risk.category}</Descriptions.Item>
            <Descriptions.Item label="严重程度">
              <Tag color={verdictColor[selectedEvent.risk.severity?.toLowerCase() || 'low']}>
                {selectedEvent.risk.severity}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="裁决">
              <Tag color={verdictColor[selectedEvent.decision.verdict?.toLowerCase() || 'pass']}>
                {verdictLabel[selectedEvent.decision.verdict?.toLowerCase() || 'pass']}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="证据">
              {selectedEvent.evidence.map((e, i) => (
                <div key={i}>{e.message}</div>
              ))}
            </Descriptions.Item>
            <Descriptions.Item label="建议">{selectedEvent.recommendation}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
}
