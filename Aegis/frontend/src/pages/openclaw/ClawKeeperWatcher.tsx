import { Card, Row, Col, Tag, Steps, Timeline, Table, Typography } from 'antd'
import {
  EyeOutlined, SafetyOutlined, CheckCircleOutlined, WarningOutlined,
  FileSearchOutlined,
} from '@ant-design/icons'

const { Title, Paragraph } = Typography

export default function ClawKeeperWatcher() {
  return (
    <div>
      {/* 顶部标题 */}
      <Card style={{ marginBottom: 24, background: 'linear-gradient(135deg, #13c2c2 0%, #2f54eb 100%)' }}>
        <Row align="middle" gutter={24}>
          <Col>
            <EyeOutlined style={{ fontSize: 48, color: '#fff' }} />
          </Col>
          <Col flex="auto">
            <Title level={2} style={{ color: '#fff', margin: 0 }}>
              ClawKeeper Watcher — 实时监控与审计
            </Title>
            <Paragraph style={{ color: 'rgba(255,255,255,0.9)', margin: '8px 0 0 0', fontSize: 16 }}>
              持续监控所有安全事件，记录完整审计日志，支持事后追溯和异常检测
            </Paragraph>
          </Col>
        </Row>
      </Card>

      {/* Watcher 工作流程 */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card title="🔄 Watcher 工作流程">
            <Steps
              direction="vertical"
              size="small"
              current={4}
              items={[
                {
                  title: '事件捕获',
                  description: 'Hook 拦截所有工具调用，捕获输入/输出/上下文',
                  icon: <EyeOutlined />,
                },
                {
                  title: '策略评估',
                  description: '四大守卫并行评估：budget / input / path / execution',
                  icon: <SafetyOutlined />,
                },
                {
                  title: '裁决执行',
                  description: '根据策略结果决定 allow / warn / block',
                  icon: <CheckCircleOutlined />,
                },
                {
                  title: '审计记录',
                  description: '完整事件链写入审计日志，支持事后追溯',
                  icon: <FileSearchOutlined />,
                },
                {
                  title: '异常告警',
                  description: '检测到异常模式时触发告警通知',
                  icon: <WarningOutlined />,
                },
              ]}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="📊 架构说明">
            <Paragraph>
              ClawKeeper Watcher 采用 <Tag color="blue">LLM 意图推理</Tag> + <Tag color="blue">确定性守卫</Tag> 双层决策架构。
            </Paragraph>
            <Paragraph>
              <strong>确定性守卫层：</strong>exec_gate、path_guard、script_body_scan、url_safety 四个守卫并行扫描，基于正则模式库快速拦截已知威胁。
            </Paragraph>
            <Paragraph>
              <strong>LLM 推理层：</strong>单次 LLM 调用（temperature=0.2）评估工具调用意图，输出 JSON 决策（allow/ask/deny），包含 severity、signals、confidence 字段。
            </Paragraph>
            <Paragraph>
              <strong>后过滤策略：</strong>hardline/critical 级别强制 deny，非 hardline block + allow 降级为 ask（人类裁决）。
            </Paragraph>
          </Card>
        </Col>
      </Row>

      {/* 最近审计事件 */}
      <Card title="📋 最近审计事件" style={{ marginBottom: 24 }}>
        <Table
          dataSource={[
            { key: '1', time: '*', event: 'tool_call', guard: 'exec_gate', verdict: 'block', detail: '危险命令被阻止' },
            { key: '2', time: '*', event: 'tool_call', guard: 'path_guard', verdict: 'warn', detail: '敏感路径访问尝试' },
            { key: '3', time: '*', event: 'tool_call', guard: 'watcher_llm', verdict: 'deny', detail: '意图推理判定为高风险' },
            { key: '4', time: '*', event: 'tool_call', guard: 'url_safety', verdict: 'block', detail: 'SSRF 模式检测' },
            { key: '5', time: '*', event: 'session', guard: 'watcher', verdict: 'allow', detail: '会话正常结束，生成审计报告' },
            { key: '6', time: '*', event: 'tool_call', guard: 'credential_redact', verdict: 'allow', detail: '凭据已脱敏' },
          ]}
          columns={[
            { title: '时间', dataIndex: 'time', key: 'time', width: 120 },
            { title: '事件类型', dataIndex: 'event', key: 'event', render: (v: string) => <Tag>{v}</Tag> },
            { title: '守卫', dataIndex: 'guard', key: 'guard', render: (v: string) => <Tag color="blue">{v}</Tag> },
            {
              title: '裁决', dataIndex: 'verdict', key: 'verdict',
              render: (v: string) => (
                <Tag color={v === 'allow' ? 'green' : v === 'warn' ? 'orange' : 'red'}>
                  {v === 'allow' ? '✅ 放行' : v === 'warn' ? '⚠️ 警告' : '🚫 拦截'}
                </Tag>
              ),
            },
            { title: '详情', dataIndex: 'detail', key: 'detail' },
          ]}
          pagination={{ pageSize: 5 }}
          size="small"
        />
      </Card>

      {/* 审计时间线 */}
      <Card title="🕐 审计时间线">
        <Timeline
          items={[
            { color: 'green', children: '* — exec_gate 通过 — 命令安全检查正常' },
            { color: 'green', children: '* — path_guard 通过 — 路径访问验证成功' },
            { color: 'orange', children: '* — watcher_llm 警告 — 意图推理检测到异常模式' },
            { color: 'red', children: '* — exec_gate 拦截 — 阻止危险命令' },
            { color: 'green', children: '* — watcher 审计 — 会话正常结束' },
            { color: 'orange', children: '* — credential_redact 警告 — 检测到凭据并脱敏' },
            { color: 'green', children: '* — session 开始 — 新会话初始化安全上下文' },
          ]}
        />
      </Card>
    </div>
  )
}
