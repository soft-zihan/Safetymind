import { Card, Badge, Switch, Descriptions, Space, Tag } from 'antd';
import type { AgentInfo, ProtectedAgentRecord } from '../types';

interface AgentCardProps {
  agent: AgentInfo;
  protectedRecord?: ProtectedAgentRecord | null;
  onToggleProtect: (agentKey: string, protect: boolean) => void;
}

export default function AgentCard({ agent, protectedRecord, onToggleProtect }: AgentCardProps) {
  return (
    <Card
      title={
        <Space>
          <span>{agent.name}</span>
          <Badge status={agent.installed ? 'success' : 'default'} />
          <Tag color={agent.experimental ? 'orange' : 'blue'}>
            {agent.experimental ? '实验性' : '稳定'}
          </Tag>
        </Space>
      }
      extra={
        <Space>
          <span>保护</span>
          <Switch
            checked={agent.protected}
            onChange={(checked) => onToggleProtect(agent.key, checked)}
          />
        </Space>
      }
      size="small"
    >
      {protectedRecord && (
        <Descriptions size="small" column={1}>
          <Descriptions.Item label="配置路径">{protectedRecord.config_path}</Descriptions.Item>
          <Descriptions.Item label="代理地址">{protectedRecord.proxy_url}</Descriptions.Item>
          <Descriptions.Item label="上游地址">{protectedRecord.upstream_url}</Descriptions.Item>
        </Descriptions>
      )}
    </Card>
  );
}
