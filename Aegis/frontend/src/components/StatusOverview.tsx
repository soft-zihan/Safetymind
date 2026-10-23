import { Row, Col, Card, Statistic, Tag } from 'antd';
import type { AppStatus } from '../types';
import { statusEventCounts, slmLabel } from '../lib/normalize';

interface StatusOverviewProps {
  status: AppStatus | null;
  loading?: boolean;
}

export default function StatusOverview({ status, loading }: StatusOverviewProps) {
  if (!status) return null;

  const protectedCount = Object.keys(status.protected_agents || {}).length;
  const eventCounts = statusEventCounts(status);

  return (
    <Row gutter={[16, 16]}>
      <Col span={6}>
        <Card loading={loading}>
          <Statistic
            title="代理服务"
            value={status.proxy?.port || '未启动'}
            suffix={<Tag color={status.proxy?.status === 'running' ? 'green' : 'default'}>{status.proxy?.status}</Tag>}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card loading={loading}>
          <Statistic
            title="桥接服务"
            value={status.bridge?.port || '未启动'}
            suffix={<Tag color={status.bridge?.status === 'running' ? 'green' : 'default'}>{status.bridge?.status}</Tag>}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card loading={loading}>
          <Statistic
            title="本地模型"
            value={slmLabel(status)}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card loading={loading}>
          <Statistic
            title="防护中"
            value={protectedCount}
            suffix="个智能体"
          />
        </Card>
      </Col>
      <Col span={12}>
        <Card loading={loading}>
          <Statistic
            title="24小时拦截"
            value={eventCounts.blocked}
            valueStyle={{ color: '#ff4d4f' }}
          />
        </Card>
      </Col>
      <Col span={12}>
        <Card loading={loading}>
          <Statistic
            title="24小时告警"
            value={eventCounts.warnings}
            valueStyle={{ color: '#faad14' }}
          />
        </Card>
      </Col>
    </Row>
  );
}
