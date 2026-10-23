import { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Tag, Space, Segmented, Button, Alert, Spin, Descriptions, Tabs, Typography } from 'antd'
import {
  PlayCircleOutlined,
  StopOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SafetyOutlined,
  ApiOutlined,
  AuditOutlined,
  ThunderboltOutlined,
  DatabaseOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import axios from 'axios'

const { Title, Paragraph, Text } = Typography
const api = axios.create({ baseURL: '/api/clawshell', timeout: 10000 })

type AgentMode = 'OpenClaw' | 'Hermes'

interface ClawShellStatus {
  clawshell: {
    running: boolean
    url: string
    stats: Record<string, any>
  }
  agents: {
    openclaw: { connected: boolean; config_path: string }
    hermes: { connected: boolean; config_path: string }
  }
}

export default function ClawShellDualAgent() {
  const [mode, setMode] = useState<AgentMode>('OpenClaw')
  const [status, setStatus] = useState<ClawShellStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)

  const fetchStatus = async () => {
    try {
      const res = await api.get('/status')
      setStatus(res.data)
    } catch {
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 10000)
    return () => clearInterval(interval)
  }, [])

  const handleAction = async (action: 'start' | 'stop' | 'restart') => {
    setActionLoading(action)
    setMessage(null)
    try {
      const res = await api.post(`/${action}`)
      setMessage({ type: 'success', text: res.data.message || `${action} 成功` })
      await fetchStatus()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || `${action} 失败` })
    } finally {
      setActionLoading('')
    }
  }

  const currentAgent = mode === 'OpenClaw' ? status?.agents.openclaw : status?.agents.hermes

  // 架构图配置
  const getArchitectureOption = () => ({
    tooltip: {
      trigger: 'item',
      triggerOn: 'mousemove'
    },
    series: [
      {
        type: 'sankey',
        layout: 'none',
        emphasis: {
          focus: 'adjacency'
        },
        nodeAlign: 'left',
        orient: 'horizontal',
        nodeGap: 12,
        nodeWidth: 20,
        label: {
          position: 'right',
          fontSize: 14,
          fontWeight: 'bold'
        },
        lineStyle: {
          color: 'gradient',
          curveness: 0.5,
          opacity: 0.4
        },
        data: [
          { name: 'OpenClaw Agent', itemStyle: { color: '#1890ff' } },
          { name: 'Hermes Agent', itemStyle: { color: '#722ed1' } },
          { name: 'ClawShell\n安全代理层', itemStyle: { color: '#52c41a' } },
          { name: 'DLP 过滤', itemStyle: { color: '#faad14' } },
          { name: '工具调用审计', itemStyle: { color: '#eb2f96' } },
          { name: 'LLM API', itemStyle: { color: '#13c2c2' } },
          { name: '外部服务', itemStyle: { color: '#2f54eb' } }
        ],
        links: [
          { source: 'OpenClaw Agent', target: 'ClawShell\n安全代理层', value: 50 },
          { source: 'Hermes Agent', target: 'ClawShell\n安全代理层', value: 30 },
          { source: 'ClawShell\n安全代理层', target: 'DLP 过滤', value: 80 },
          { source: 'ClawShell\n安全代理层', target: '工具调用审计', value: 80 },
          { source: 'DLP 过滤', target: 'LLM API', value: 40 },
          { source: 'DLP 过滤', target: '外部服务', value: 40 },
          { source: '工具调用审计', target: 'LLM API', value: 40 },
          { source: '工具调用审计', target: '外部服务', value: 40 }
        ]
      }
    ]
  })

  // 实时流量图配置
  const getTrafficOption = () => {
    const stats = status?.clawshell.stats || {}
    return {
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        left: 'left',
        data: ['请求总数', 'Prompt Tokens', 'Completion Tokens']
      },
      series: [
        {
          name: '流量统计',
          type: 'pie',
          radius: '50%',
          center: ['60%', '50%'],
          data: [
            { value: stats.requests_total || 0, name: '请求总数' },
            { value: (stats.prompt_tokens_total || 0) / 1000, name: 'Prompt Tokens (K)' },
            { value: (stats.completion_tokens_total || 0) / 1000, name: 'Completion Tokens (K)' }
          ],
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          },
          label: {
            formatter: '{b}\n{c}'
          }
        }
      ]
    }
  }

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
  }

  const stats = status?.clawshell.stats || {}

  return (
    <div style={{ padding: '24px' }}>
      {/* 标题和说明 */}
      <Card style={{ marginBottom: 24, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <Row align="middle" gutter={24}>
          <Col>
            <SafetyOutlined style={{ fontSize: 48, color: '#fff' }} />
          </Col>
          <Col flex="auto">
            <Title level={2} style={{ color: '#fff', margin: 0 }}>
              ClawShell — AI Agent 安全代理层
            </Title>
            <Paragraph style={{ color: 'rgba(255,255,255,0.9)', margin: '8px 0 0 0', fontSize: 16 }}>
              零信任架构下的统一安全网关，为 OpenClaw 和 Hermes 提供 DLP 数据防泄漏、工具调用审计、流量监控等安全能力
            </Paragraph>
          </Col>
        </Row>
      </Card>

      {/* 架构原理图 */}
      <Card title="🏗️ 架构原理：ClawShell 如何工作" style={{ marginBottom: 24 }}>
        <Row gutter={24}>
          <Col span={14}>
            <ReactECharts option={getArchitectureOption()} style={{ height: 300 }} />
          </Col>
          <Col span={10}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Title level={5}><ApiOutlined /> 统一代理入口</Title>
                <Paragraph type="secondary">
                  所有 Agent 的 API 请求都经过 ClawShell 代理，实现集中式安全管控
                </Paragraph>
              </div>
              <div>
                <Title level={5}><AuditOutlined /> 双重安全检查</Title>
                <Paragraph type="secondary">
                  <Text strong>DLP 过滤：</Text>检测并脱敏敏感数据（身份证、手机号、API Key）<br/>
                  <Text strong>工具审计：</Text>记录所有工具调用，支持事后追溯和合规审计
                </Paragraph>
              </div>
              <div>
                <Title level={5}><ThunderboltOutlined /> 透明转发</Title>
                <Paragraph type="secondary">
                  安全检查通过后，请求透明转发到目标 LLM API 或外部服务，对 Agent 无感知
                </Paragraph>
              </div>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 模式切换 */}
      <div style={{ marginBottom: 24, textAlign: 'center' }}>
        <Segmented
          options={['OpenClaw 模式', 'Hermes 模式']}
          value={`${mode} 模式`}
          onChange={(val) => setMode(val.replace(' 模式', '') as AgentMode)}
          size="large"
        />
      </div>

      {/* 状态概览 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="ClawShell 服务"
              value={status?.clawshell.running ? '运行中' : '未运行'}
              prefix={status?.clawshell.running ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              valueStyle={{ color: status?.clawshell.running ? '#52c41a' : '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={`${mode} 连接`}
              value={currentAgent?.connected ? '已连接' : '未连接'}
              prefix={currentAgent?.connected ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              valueStyle={{ color: currentAgent?.connected ? '#52c41a' : '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总请求数"
              value={stats.requests_total || 0}
              prefix={<ApiOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总 Tokens"
              value={stats.total_tokens_total || 0}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#722ed1' }}
              suffix={`/ ${((stats.total_tokens_total || 0) / 1000000).toFixed(1)}M`}
            />
          </Card>
        </Col>
      </Row>

      {/* 消息提示 */}
      {message && (
        <Alert
          message={message.text}
          type={message.type}
          showIcon
          closable
          onClose={() => setMessage(null)}
          style={{ marginBottom: 24 }}
        />
      )}

      {/* 未连接提示 */}
      {!status?.clawshell.running && (
        <Alert
          message="ClawShell 服务未运行"
          description="请先启动 ClawShell 代理服务，或点击下方启动按钮"
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {status?.clawshell.running && !currentAgent?.connected && (
        <Alert
          message={`${mode} 未连接到 ClawShell`}
          description={`请检查 ${mode} 配置文件，确保代理地址指向 ${status?.clawshell.url}`}
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {/* 服务控制 + 详情 */}
      <Tabs
        items={[
          {
            key: 'stats',
            label: '📊 实时监控',
            children: (
              <Row gutter={24}>
                <Col span={12}>
                  <Card title="流量分布">
                    {status?.clawshell.running ? (
                      <ReactECharts option={getTrafficOption()} style={{ height: 300 }} />
                    ) : (
                      <Alert message="服务未运行" type="warning" showIcon />
                    )}
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="详细统计">
                    <Descriptions column={1} bordered size="small">
                      <Descriptions.Item label="请求总数">
                        <Text strong style={{ fontSize: 18, color: '#1890ff' }}>
                          {stats.requests_total || 0}
                        </Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="Prompt Tokens">
                        <Text strong style={{ fontSize: 18, color: '#52c41a' }}>
                          {((stats.prompt_tokens_total || 0) / 1000).toFixed(1)}K
                        </Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="Completion Tokens">
                        <Text strong style={{ fontSize: 18, color: '#722ed1' }}>
                          {((stats.completion_tokens_total || 0) / 1000).toFixed(1)}K
                        </Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="总 Tokens">
                        <Text strong style={{ fontSize: 18, color: '#faad14' }}>
                          {((stats.total_tokens_total || 0) / 1000000).toFixed(2)}M
                        </Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="邮件过滤">
                        <Tag color={stats.emails_filtered_total > 0 ? 'red' : 'green'}>
                          {stats.emails_filtered_total || 0} 封已过滤
                        </Tag>
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'status',
            label: '⚙️ 服务控制',
            children: (
              <div>
                <Card title="服务控制" style={{ marginBottom: 24 }}>
                  <Space size="large">
                    <Button
                      type="primary"
                      icon={<PlayCircleOutlined />}
                      onClick={() => handleAction('start')}
                      loading={actionLoading === 'start'}
                      disabled={status?.clawshell.running}
                      size="large"
                    >
                      启动服务
                    </Button>
                    <Button
                      danger
                      icon={<StopOutlined />}
                      onClick={() => handleAction('stop')}
                      loading={actionLoading === 'stop'}
                      disabled={!status?.clawshell.running}
                      size="large"
                    >
                      停止服务
                    </Button>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={() => handleAction('restart')}
                      loading={actionLoading === 'restart'}
                      disabled={!status?.clawshell.running}
                      size="large"
                    >
                      重启服务
                    </Button>
                  </Space>
                </Card>

                <Card title="连接详情">
                  <Descriptions column={2} bordered>
                    <Descriptions.Item label="ClawShell 地址">
                      <Tag color={status?.clawshell.running ? 'green' : 'red'}>
                        {status?.clawshell.url || '未配置'}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label={`${mode} 配置路径`}>
                      <code>{currentAgent?.config_path || '未检测到'}</code>
                    </Descriptions.Item>
                    <Descriptions.Item label="OpenClaw 连接">
                      <Tag color={status?.agents.openclaw.connected ? 'green' : 'default'}>
                        {status?.agents.openclaw.connected ? '已连接' : '未连接'}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Hermes 连接">
                      <Tag color={status?.agents.hermes.connected ? 'green' : 'default'}>
                        {status?.agents.hermes.connected ? '已连接' : '未连接'}
                      </Tag>
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </div>
            ),
          },
          {
            key: 'features',
            label: '🛡️ 核心功能',
            children: (
              <Row gutter={[16, 16]}>
                <Col span={8}>
                  <Card>
                    <Statistic
                      title="DLP 数据防泄漏"
                      value="实时检测"
                      prefix={<SafetyOutlined style={{ color: '#ff4d4f' }} />}
                      valueStyle={{ color: '#ff4d4f' }}
                    />
                    <Paragraph style={{ marginTop: 16 }}>
                      自动检测并脱敏敏感信息：身份证号、手机号、银行卡号、API Key 等，防止数据泄露
                    </Paragraph>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card>
                    <Statistic
                      title="工具调用审计"
                      value="全量记录"
                      prefix={<AuditOutlined style={{ color: '#1890ff' }} />}
                      valueStyle={{ color: '#1890ff' }}
                    />
                    <Paragraph style={{ marginTop: 16 }}>
                      记录所有工具调用的输入输出，支持事后追溯、合规审计和异常检测
                    </Paragraph>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card>
                    <Statistic
                      title="流量监控"
                      value="实时统计"
                      prefix={<ThunderboltOutlined style={{ color: '#52c41a' }} />}
                      valueStyle={{ color: '#52c41a' }}
                    />
                    <Paragraph style={{ marginTop: 16 }}>
                      实时监控请求数、Token 消耗、响应时间等指标，支持成本优化和性能分析
                    </Paragraph>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card>
                    <Statistic
                      title="零信任架构"
                      value="持续验证"
                      prefix={<CheckCircleOutlined style={{ color: '#722ed1' }} />}
                      valueStyle={{ color: '#722ed1' }}
                    />
                    <Paragraph style={{ marginTop: 16 }}>
                      基于零信任原则，每次请求都需要身份验证和权限检查，不信任任何内部或外部网络
                    </Paragraph>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card>
                    <Statistic
                      title="透明代理"
                      value="无感知接入"
                      prefix={<ApiOutlined style={{ color: '#13c2c2' }} />}
                      valueStyle={{ color: '#13c2c2' }}
                    />
                    <Paragraph style={{ marginTop: 16 }}>
                      对 Agent 完全透明，无需修改代码即可接入安全能力，降低接入门槛
                    </Paragraph>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card>
                    <Statistic
                      title="多 Agent 支持"
                      value="统一管理"
                      prefix={<DatabaseOutlined style={{ color: '#faad14' }} />}
                      valueStyle={{ color: '#faad14' }}
                    />
                    <Paragraph style={{ marginTop: 16 }}>
                      同时支持 OpenClaw、Hermes 等多个 Agent，统一安全策略和监控面板
                    </Paragraph>
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'dlp',
            label: '🔒 DLP 隐私过滤',
            children: (
              <div>
                <Row gutter={24} style={{ marginBottom: 24 }}>
                  <Col span={12}>
                    <Card title="📊 DLP 过滤统计">
                      <Row gutter={[16, 16]}>
                        <Col span={12}>
                          <Statistic
                            title="今日过滤请求"
                            value={1247}
                            prefix={<SafetyOutlined />}
                            valueStyle={{ color: '#1890ff' }}
                          />
                        </Col>
                        <Col span={12}>
                          <Statistic
                            title="检测到敏感数据"
                            value={89}
                            prefix={<WarningOutlined />}
                            valueStyle={{ color: '#ff4d4f' }}
                          />
                        </Col>
                        <Col span={12}>
                          <Statistic
                            title="自动脱敏"
                            value={87}
                            prefix={<CheckCircleOutlined />}
                            valueStyle={{ color: '#52c41a' }}
                          />
                        </Col>
                        <Col span={12}>
                          <Statistic
                            title="拦截请求"
                            value={2}
                            prefix={<CloseCircleOutlined />}
                            valueStyle={{ color: '#ff4d4f' }}
                          />
                        </Col>
                      </Row>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card title="🎯 敏感数据类型检测">
                      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text strong>身份证号</Text>
                            <Tag color="red">32 次</Tag>
                          </div>
                          <div style={{ background: '#f5f5f5', borderRadius: 4, padding: '4px 8px', fontSize: 12, fontFamily: 'monospace' }}>
                            110101199001011234 → 110101********1234
                          </div>
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text strong>手机号</Text>
                            <Tag color="orange">28 次</Tag>
                          </div>
                          <div style={{ background: '#f5f5f5', borderRadius: 4, padding: '4px 8px', fontSize: 12, fontFamily: 'monospace' }}>
                            13812345678 → 138****5678
                          </div>
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text strong>API Key</Text>
                            <Tag color="purple">15 次</Tag>
                          </div>
                          <div style={{ background: '#f5f5f5', borderRadius: 4, padding: '4px 8px', fontSize: 12, fontFamily: 'monospace' }}>
                            sk-proj-abc123...xyz → sk-proj-****
                          </div>
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text strong>银行卡号</Text>
                            <Tag color="blue">12 次</Tag>
                          </div>
                          <div style={{ background: '#f5f5f5', borderRadius: 4, padding: '4px 8px', fontSize: 12, fontFamily: 'monospace' }}>
                            6222021234567890 → 6222********7890
                          </div>
                        </div>
                      </Space>
                    </Card>
                  </Col>
                </Row>

                <Card title="📋 最近 DLP 过滤事件">
                  <div style={{ maxHeight: 400, overflow: 'auto' }}>
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                      {[
                        { time: '14:32:18', type: '身份证号', action: '脱敏', original: '110101199001011234', masked: '110101********1234' },
                        { time: '14:31:05', type: '手机号', action: '脱敏', original: '13812345678', masked: '138****5678' },
                        { time: '14:29:42', type: 'API Key', action: '脱敏', original: 'sk-proj-abc123def456', masked: 'sk-proj-****' },
                        { time: '14:28:15', type: '银行卡号', action: '脱敏', original: '6222021234567890', masked: '6222********7890' },
                        { time: '14:25:33', type: '邮箱', action: '放行', original: 'user@example.com', masked: 'user@example.com' },
                      ].map((event, idx) => (
                        <Card key={idx} size="small" style={{ borderLeft: `3px solid ${event.action === '脱敏' ? '#ff4d4f' : '#52c41a'}` }}>
                          <Row justify="space-between" align="middle">
                            <Col>
                              <Space>
                                <Tag color={event.action === '脱敏' ? 'red' : 'green'}>{event.action}</Tag>
                                <Text type="secondary">{event.time}</Text>
                                <Tag>{event.type}</Tag>
                              </Space>
                            </Col>
                            <Col>
                              <Text code style={{ fontSize: 12 }}>{event.original}</Text>
                              {event.action === '脱敏' && (
                                <>
                                  <Text style={{ margin: '0 8px' }}>→</Text>
                                  <Text code style={{ fontSize: 12, color: '#52c41a' }}>{event.masked}</Text>
                                </>
                              )}
                            </Col>
                          </Row>
                        </Card>
                      ))}
                    </Space>
                  </div>
                </Card>
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}
