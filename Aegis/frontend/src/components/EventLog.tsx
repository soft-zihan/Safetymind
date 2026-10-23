import { useState } from 'react';
import { Segmented, List, Tag, Space } from 'antd';
import type { SecurityEvent } from '../types';

interface EventLogProps {
  events: SecurityEvent[];
  loading?: boolean;
}

type EventFilter = 'all' | 'blocked' | 'warnings';

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

export default function EventLog({ events, loading }: EventLogProps) {
  const [filter, setFilter] = useState<EventFilter>('all');

  const filteredEvents = events.filter((e) => {
    const verdict = e.decision.verdict?.toLowerCase();
    if (filter === 'blocked') return verdict === 'block';
    if (filter === 'warnings') return verdict === 'warn';
    return true;
  });

  return (
    <div>
      <Segmented
        value={filter}
        onChange={(v) => setFilter(v as EventFilter)}
        options={[
          { label: `全部 (${events.length})`, value: 'all' },
          { label: `已拦截 (${events.filter((e) => e.decision.verdict?.toLowerCase() === 'block').length})`, value: 'blocked' },
          { label: `告警 (${events.filter((e) => e.decision.verdict?.toLowerCase() === 'warn').length})`, value: 'warnings' },
        ]}
        style={{ marginBottom: 16 }}
      />
      <List
        loading={loading}
        dataSource={filteredEvents}
        renderItem={(event) => (
          <List.Item>
            <Space>
              <Tag color="default">{event.timestamp.replace('T', ' ').slice(0, 19)}</Tag>
              <Tag color="blue">{event.action.name}</Tag>
              <Tag color={verdictColor[event.decision.verdict?.toLowerCase() || 'pass']}>
                {verdictLabel[event.decision.verdict?.toLowerCase() || 'pass']}
              </Tag>
              <span>{event.evidence[0]?.message || event.recommendation}</span>
            </Space>
          </List.Item>
        )}
      />
    </div>
  );
}
