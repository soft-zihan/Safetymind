import { useState, useEffect } from 'react'
import {
  Card, Row, Col, Switch, Tag, Button, Space, Form, InputNumber,
  Select, Alert, Divider, Statistic, message, Spin, Popconfirm,
  Descriptions, Typography, Tabs, Table,
} from 'antd'
import {
  SafetyOutlined, ReloadOutlined,
  CheckCircleOutlined, WarningOutlined, SettingOutlined,
  RollbackOutlined, ApiOutlined, EyeOutlined, ThunderboltOutlined,

} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'

const { Text, Title, Paragraph } = Typography
const { Option } = Select

// ====== 类型定义 ======
interface PolicyConfig {
  budgetGuard: {
    enabled: boolean
    unlimited: boolean
    windowDays: number
    warnRatio: number
    limits: { input: number; output: number; total: number }
  }
  inputValidator: {
    enabled: boolean
    failurePolicy: string
    unknownToolPolicy: string
  }
  pathGuard: {
    enabled: boolean
    failurePolicy: string
  }
  executionGate: {
    enabled: boolean
    failurePolicy: string
  }
}

interface ProtectionStatus {
  skill: { enabled: boolean; name: string; description: string }
  plugin: { enabled: boolean; plugins: string[]; hooks_registered: string[] }
  audit_score: number | null
  last_audit: string | null
}

// ====== 主组件 ======
export default function ClawKeeperManager() {
  const [policy, setPolicy] = useState<PolicyConfig | null>(null)
  const [status, setStatus] = useState<ProtectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  // 加载数据
  const loadData = async () => {
    setLoading(true)
    try {
      const [policyRes, statusRes] = await Promise.all([
        fetch('/api/openclaw/clawkeeper/policy'),
        fetch('/api/openclaw/clawkeeper/status'),
      ])

      if (policyRes.ok) {
        const policyData = await policyRes.json()
        setPolicy(policyData)
        form.setFieldsValue({
          budgetEnabled: policyData.budgetGuard.enabled,
          budgetUnlimited: policyData.budgetGuard.unlimited,
          budgetInput: policyData.budgetGuard.limits.input,
          budgetOutput: policyData.budgetGuard.limits.output,
          budgetTotal: policyData.budgetGuard.limits.total,
          inputValidatorEnabled: policyData.inputValidator.enabled,
          inputFailurePolicy: policyData.inputValidator.failurePolicy,
          inputUnknownPolicy: policyData.inputValidator.unknownToolPolicy,
          pathGuardEnabled: policyData.pathGuard.enabled,
          execGateEnabled: policyData.executionGate.enabled,
        })
      }

      if (statusRes.ok) {
        setStatus(await statusRes.json())
      }
    } catch (err: any) {
      message.error(`加载失败: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // 保存策略
  const handleSave = async (values: any) => {
    setSaving(true)
    try {
      const updates: any = {}

      if (values.budgetEnabled !== undefined || values.budgetInput !== undefined) {
        updates.budgetGuard = {
          enabled: values.budgetEnabled,
          unlimited: values.budgetUnlimited,
          limits: {
            input: values.budgetInput,
            output: values.budgetOutput,
            total: values.budgetTotal,
          },
        }
      }

      if (values.inputValidatorEnabled !== undefined) {
        updates.inputValidator = {
          enabled: values.inputValidatorEnabled,
          failurePolicy: values.inputFailurePolicy,
          unknownToolPolicy: values.inputUnknownPolicy,
        }
      }

      if (values.pathGuardEnabled !== undefined) {
        updates.pathGuard = { enabled: values.pathGuardEnabled }
      }

      if (values.execGateEnabled !== undefined) {
        updates.executionGate = { enabled: values.execGateEnabled }
      }

      const res = await fetch('/api/openclaw/clawkeeper/policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      message.success(data.message)
      loadData()
    } catch (err: any) {
      message.error(`保存失败: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  // 重置策略
  const handleReset = async () => {
    try {
      const res = await fetch('/api/openclaw/clawkeeper/policy/reset', { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      message.success(data.message)
      loadData()
    } catch (err: any) {
      message.error(`重置失败: ${err.message}`)
    }
  }

  if (loading) {
    return <div style={{ padding: 40 }}><Spin size="large" tip="加载 ClawKeeper 配置..." /></div>
  }

  // 架构图配置
  const getArchitectureOption = () => ({
    tooltip: { trigger: 'item', triggerOn: 'mousemove' },
    series: [{
      type: 'sankey',
      layout: 'none',
      emphasis: { focus: 'adjacency' },
      nodeAlign: 'left',
      orient: 'horizontal',
      nodeGap: 12,
      nodeWidth: 20,
      label: { position: 'right', fontSize: 13, fontWeight: 'bold' },
      lineStyle: { color: 'gradient', curveness: 0.5, opacity: 0.4 },
      data: [
        { name: 'OpenClaw Agent', itemStyle: { color: '#1890ff' } },
        { name: 'ClawKeeper\n插件系统', itemStyle: { color: '#52c41a' } },
        { name: 'budgetGuard', itemStyle: { color: '#faad14' } },
        { name: 'inputValidator', itemStyle: { color: '#eb2f96' } },
        { name: 'pathGuard', itemStyle: { color: '#722ed1' } },
        { name: 'executionGate', itemStyle: { color: '#13c2c2' } },
        { name: 'ClawShell\n安全代理', itemStyle: { color: '#2f54eb' } },
        { name: 'LLM API', itemStyle: { color: '#f5222d' } },
      ],
      links: [
        { source: 'OpenClaw Agent', target: 'ClawKeeper\n插件系统', value: 100 },
        { source: 'ClawKeeper\n插件系统', target: 'budgetGuard', value: 25 },
        { source: 'ClawKeeper\n插件系统', target: 'inputValidator', value: 25 },
        { source: 'ClawKeeper\n插件系统', target: 'pathGuard', value: 25 },
        { source: 'ClawKeeper\n插件系统', target: 'executionGate', value: 25 },
        { source: 'budgetGuard', target: 'ClawShell\n安全代理', value: 25 },
        { source: 'inputValidator', target: 'ClawShell\n安全代理', value: 25 },
        { source: 'pathGuard', target: 'ClawShell\n安全代理', value: 25 },
        { source: 'executionGate', target: 'ClawShell\n安全代理', value: 25 },
        { source: 'ClawShell\n安全代理', target: 'LLM API', value: 100 },
      ],
    }],
  })

  return (
    <div>
      {/* 顶部标题 */}
      <Card style={{ marginBottom: 24, background: 'linear-gradient(135deg, #722ed1 0%, #eb2f96 100%)' }}>
        <Row align="middle" gutter={24}>
          <Col>
            <SafetyOutlined style={{ fontSize: 48, color: '#fff' }} />
          </Col>
          <Col flex="auto">
            <Title level={2} style={{ color: '#fff', margin: 0 }}>
              ClawKeeper Plugin — 安全插件系统
            </Title>
            <Paragraph style={{ color: 'rgba(255,255,255,0.9)', margin: '8px 0 0 0', fontSize: 16 }}>
              通过插件机制无缝接入 OpenClaw，注册 Hook 拦截工具调用，四大安全守卫实时防护
            </Paragraph>
          </Col>
        </Row>
      </Card>

      {/* 架构原理图 */}
      <Card title="🏗️ 架构原理：从插件到 Watcher 的完整防护链" style={{ marginBottom: 24 }}>
        <Row gutter={24}>
          <Col span={14}>
            <ReactECharts option={getArchitectureOption()} style={{ height: 320 }} />
          </Col>
          <Col span={10}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Title level={5}><ApiOutlined /> 插件系统</Title>
                <Paragraph type="secondary">
                  ClawKeeper 通过插件机制无缝接入 OpenClaw，注册 Hook 拦截所有工具调用
                </Paragraph>
              </div>
              <div>
                <Title level={5}><SettingOutlined /> 四大安全守卫</Title>
                <Paragraph type="secondary">
                  <Text strong>budgetGuard：</Text>Token 预算控制，防止资源滥用<br/>
                  <Text strong>inputValidator：</Text>输入验证，拦截非法参数<br/>
                  <Text strong>pathGuard：</Text>路径守卫，防止目录遍历攻击<br/>
                  <Text strong>executionGate：</Text>执行门控，高风险操作二次确认
                </Paragraph>
              </div>
              <div>
                <Title level={5}><EyeOutlined /> Watcher 机制</Title>
                <Paragraph type="secondary">
                  实时监控所有安全事件，记录审计日志，支持事后追溯和异常检测
                </Paragraph>
              </div>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 顶部状态卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="Skill 防护"
              value={status?.skill.enabled ? '已启用' : '未启用'}
              valueStyle={{ color: status?.skill.enabled ? '#52c41a' : '#ff4d4f' }}
              prefix={status?.skill.enabled ? <CheckCircleOutlined /> : <WarningOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Plugin 防护"
              value={status?.plugin.enabled ? '已启用' : '未启用'}
              valueStyle={{ color: status?.plugin.enabled ? '#52c41a' : '#ff4d4f' }}
              prefix={status?.plugin.enabled ? <CheckCircleOutlined /> : <WarningOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Hook 数量"
              value={status?.plugin.hooks_registered.length ?? 0}
              prefix={<SafetyOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 安全警告 */}
      {policy && (policy.budgetGuard.unlimited || policy.inputValidator.failurePolicy === 'fail-open') && (
        <Alert
          message="安全警告"
          description="检测到不安全的策略配置：BudgetGuard 为无限模式 或 InputValidator 失败时放行。建议立即修复。"
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
          action={
            <Button size="small" danger onClick={handleReset}>
              一键修复
            </Button>
          }
        />
      )}

      {/* Tab 页：策略配置 / 插件系统 */}
      <Tabs
        defaultActiveKey="policy"
        items={[
          {
            key: 'policy',
            label: '⚙️ 策略配置',
            children: (
              <Form
                form={form}
                layout="vertical"
                onFinish={handleSave}
                initialValues={{
                  budgetEnabled: true,
                  budgetUnlimited: false,
                  budgetInput: 500000,
                  budgetOutput: 250000,
                  budgetTotal: 750000,
                  inputValidatorEnabled: true,
                  inputFailurePolicy: 'fail-closed',
                  inputUnknownPolicy: 'block',
                  pathGuardEnabled: true,
                  execGateEnabled: true,
                }}
              >
                <Row gutter={24}>
                  <Col span={16}>
                    <Card
                      title={<><SafetyOutlined /> Token 预算守卫 (BudgetGuard)</>}
                      style={{ marginBottom: 16 }}
                      extra={<Form.Item name="budgetEnabled" valuePropName="checked" noStyle><Switch checkedChildren="启用" unCheckedChildren="禁用" /></Form.Item>}
                    >
                      <Form.Item name="budgetUnlimited" valuePropName="checked" label="无限模式">
                        <Switch checkedChildren="无限" unCheckedChildren="限制" />
                      </Form.Item>
                      <Row gutter={16}>
                        <Col span={8}><Form.Item name="budgetInput" label="输入 Token 限制"><InputNumber min={0} step={10000} style={{ width: '100%' }} addonAfter="tokens" /></Form.Item></Col>
                        <Col span={8}><Form.Item name="budgetOutput" label="输出 Token 限制"><InputNumber min={0} step={10000} style={{ width: '100%' }} addonAfter="tokens" /></Form.Item></Col>
                        <Col span={8}><Form.Item name="budgetTotal" label="总 Token 限制"><InputNumber min={0} step={10000} style={{ width: '100%' }} addonAfter="tokens" /></Form.Item></Col>
                      </Row>
                    </Card>

                    <Card
                      title={<><SettingOutlined /> 输入验证器 (InputValidator)</>}
                      style={{ marginBottom: 16 }}
                      extra={<Form.Item name="inputValidatorEnabled" valuePropName="checked" noStyle><Switch checkedChildren="启用" unCheckedChildren="禁用" /></Form.Item>}
                    >
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item name="inputFailurePolicy" label="失败策略">
                            <Select><Option value="fail-closed">失败时阻止</Option><Option value="fail-open">失败时放行</Option></Select>
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="inputUnknownPolicy" label="未知工具策略">
                            <Select><Option value="block">阻止</Option><Option value="pass">允许</Option></Select>
                          </Form.Item>
                        </Col>
                      </Row>
                    </Card>

                    <Row gutter={16}>
                      <Col span={12}>
                        <Card title="路径守卫 (PathGuard)" extra={<Form.Item name="pathGuardEnabled" valuePropName="checked" noStyle><Switch checkedChildren="启用" unCheckedChildren="禁用" /></Form.Item>}>
                          <Text type="secondary">保护敏感文件路径（SSH 密钥、AWS 凭据等）</Text>
                        </Card>
                      </Col>
                      <Col span={12}>
                        <Card title="执行门控 (ExecutionGate)" extra={<Form.Item name="execGateEnabled" valuePropName="checked" noStyle><Switch checkedChildren="启用" unCheckedChildren="禁用" /></Form.Item>}>
                          <Text type="secondary">阻止危险命令（rm -rf、fork bomb 等）</Text>
                        </Card>
                      </Col>
                    </Row>
                  </Col>

                  <Col span={8}>
                    <Card title="操作" style={{ marginBottom: 16 }}>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Button type="primary" icon={<CheckCircleOutlined />} htmlType="submit" loading={saving} block>保存配置</Button>
                        <Popconfirm title="确定要重置为严格默认策略吗？" onConfirm={handleReset} okText="确定" cancelText="取消">
                          <Button danger icon={<RollbackOutlined />} block>重置为默认</Button>
                        </Popconfirm>
                        <Button icon={<ReloadOutlined />} onClick={loadData} block>刷新状态</Button>
                      </Space>
                    </Card>
                    <Card title="已注册 Hooks">
                      {status?.plugin.hooks_registered.map((hook) => (
                        <Tag color="blue" key={hook} style={{ marginBottom: 8 }}><ThunderboltOutlined /> {hook}</Tag>
                      ))}
                      <Divider style={{ margin: '12px 0' }} />
                      <Descriptions size="small" column={1}>
                        <Descriptions.Item label="最后审计">{status?.last_audit ? new Date(status.last_audit).toLocaleString() : '未审计'}</Descriptions.Item>
                        <Descriptions.Item label="插件">{status?.plugin.plugins.join(', ')}</Descriptions.Item>
                      </Descriptions>
                    </Card>
                  </Col>
                </Row>
              </Form>
            ),
          },
          {
            key: 'plugins',
            label: '🔌 插件系统',
            children: (
              <div>
                <Card title="已安装插件" style={{ marginBottom: 24 }}>
                  <Row gutter={[16, 16]}>
                    <Col span={8}>
                      <Card size="small" style={{ borderLeft: '3px solid #52c41a' }}>
                        <Descriptions column={1} size="small">
                          <Descriptions.Item label="名称"><Tag color="green">clawkeeper-plugin</Tag></Descriptions.Item>
                          <Descriptions.Item label="状态"><Tag color="green">已启用</Tag></Descriptions.Item>
                          <Descriptions.Item label="版本">1.2.0</Descriptions.Item>
                          <Descriptions.Item label="描述">核心安全插件，注册 Hook 拦截工具调用</Descriptions.Item>
                        </Descriptions>
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card size="small" style={{ borderLeft: '3px solid #1890ff' }}>
                        <Descriptions column={1} size="small">
                          <Descriptions.Item label="名称"><Tag color="blue">clawkeeper-watcher</Tag></Descriptions.Item>
                          <Descriptions.Item label="状态"><Tag color="green">已启用</Tag></Descriptions.Item>
                          <Descriptions.Item label="版本">1.1.0</Descriptions.Item>
                          <Descriptions.Item label="描述">Watcher 守护进程，持续监控安全事件</Descriptions.Item>
                        </Descriptions>
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card size="small" style={{ borderLeft: '3px solid #faad14' }}>
                        <Descriptions column={1} size="small">
                          <Descriptions.Item label="名称"><Tag color="orange">clawkeeper-skill</Tag></Descriptions.Item>
                          <Descriptions.Item label="状态"><Tag color="green">已启用</Tag></Descriptions.Item>
                          <Descriptions.Item label="版本">1.0.0</Descriptions.Item>
                          <Descriptions.Item label="描述">Skill 安全防护，拦截敏感操作</Descriptions.Item>
                        </Descriptions>
                      </Card>
                    </Col>
                  </Row>
                </Card>

                <Card title="已注册 Hook 列表">
                  <Table
                    dataSource={[
                      { key: '1', hook: 'tool_call.before', plugin: 'clawkeeper-plugin', desc: '工具调用前拦截，执行策略检查' },
                      { key: '2', hook: 'tool_call.after', plugin: 'clawkeeper-plugin', desc: '工具调用后审计，记录执行结果' },
                      { key: '3', hook: 'message.receive', plugin: 'clawkeeper-watcher', desc: '消息接收监控，检测异常输入' },
                      { key: '4', hook: 'session.start', plugin: 'clawkeeper-watcher', desc: '会话启动时初始化安全上下文' },
                      { key: '5', hook: 'session.end', plugin: 'clawkeeper-watcher', desc: '会话结束时生成审计报告' },
                      { key: '6', hook: 'skill.execute', plugin: 'clawkeeper-skill', desc: 'Skill 执行前权限验证' },
                    ]}
                    columns={[
                      { title: 'Hook 名称', dataIndex: 'hook', key: 'hook', render: (v: string) => <Tag color="purple"><ThunderboltOutlined /> {v}</Tag> },
                      { title: '所属插件', dataIndex: 'plugin', key: 'plugin' },
                      { title: '功能描述', dataIndex: 'desc', key: 'desc' },
                    ]}
                    pagination={false}
                    size="small"
                  />
                </Card>
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}
