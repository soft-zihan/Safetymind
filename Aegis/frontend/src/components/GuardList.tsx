
import { Collapse, Table, Radio, Tag, Space } from 'antd';
import type { GuardInfo } from '../types';

interface GuardListProps {
  guards: GuardInfo[];
  loading?: boolean;
  onSetMode: (guardName: string, mode: string) => void;
}

const MODES = ['observe', 'enforce', 'off'] as const;

const modeLabel: Record<string, string> = {
  observe: '观察',
  enforce: '拦截',
  off: '关闭',
};

const pipelineLabel: Record<string, string> = {
  ingress: '入口防护',
  egress: '出口防护',
  output: '输出过滤',
};

export default function GuardList({ guards, loading, onSetMode }: GuardListProps) {
  const grouped = guards.reduce(
    (acc, g) => {
      const key = g.pipeline;
      if (!acc[key]) acc[key] = [];
      acc[key].push(g);
      return acc;
    },
    {} as Record<string, GuardInfo[]>,
  );

  const items = ['ingress', 'egress', 'output'].map((pipeline) => {
    const pipelineGuards = grouped[pipeline] || [];
    return {
      key: pipeline,
      label: (
        <Space>
          <span>{pipelineLabel[pipeline] || pipeline}</span>
          <Tag color="blue">{pipelineGuards.length} 个守卫</Tag>
        </Space>
      ),
      children: (
        <Table
          dataSource={pipelineGuards}
          rowKey="name"
          loading={loading}
          pagination={false}
          size="small"
          columns={[
            {
              title: '守卫名称',
              dataIndex: 'name',
              key: 'name',
            },
            {
              title: '策略',
              dataIndex: 'primary_strategy',
              key: 'primary_strategy',
              render: (strategy: string) => (
                <Tag color={strategy === 'ai' ? 'purple' : 'default'}>
                  {strategy === 'ai' ? 'AI 优先' : '规则'}
                </Tag>
              ),
            },
            {
              title: '运行模式',
              key: 'mode',
              render: (_: any, record: GuardInfo) => (
                <Radio.Group
                  value={record.mode}
                  onChange={(e) => onSetMode(record.name, e.target.value)}
                  size="small"
                >
                  {MODES.map((mode) => (
                    <Radio.Button key={mode} value={mode}>
                      {modeLabel[mode]}
                    </Radio.Button>
                  ))}
                </Radio.Group>
              ),
            },
          ]}
        />
      ),
    };
  });

  return <Collapse items={items} defaultActiveKey={['ingress', 'egress', 'output']} />;
}
