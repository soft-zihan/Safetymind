import { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Tag, Descriptions, Button, Space, Spin, Alert, Typography, Table } from 'antd'
import { RobotOutlined, ThunderboltOutlined, ReloadOutlined, CloudServerOutlined } from '@ant-design/icons'
import ChatInterface from '../../components/ChatInterface'
import { getHermesStatus, getHermesAgents } from '../../lib/hermesApi'

const { Title, Text } = Typography

interface HermesStatus {
  version: string
  status: 'running' | 'stopped' | 'error'
  port: number
  agents_count: number
  active_agents: number
  plugins_count: number
  uptime: string
  memory_usage: string
  last_error?: string
}

interface HermesAgent {
  name: string
  status: 'active' | 'idle' | 'stopped' | 'error'
  config_path: string
  last_active: string
  skills_count?: number
  plugins_count?: number
}

export default function HermesAgent() {
  const [hermesStatus, setHermesStatus] = useState<HermesStatus | null>(null)
  const [agents, setAgents] = useState<HermesAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const HERMES_PORT = 18789
  const HERMES_URL = `http://localhost:${HERMES_PORT}`

  useEffect(() => {
    fetchHermesStatus()
  }, [])

  const fetchHermesStatus = async () => {
    setLoading(true)
    setError(null)
    try {
      // 获取 Hermes 整体状态
      const statusData = await getHermesStatus()
      setHermesStatus(statusData)

      // 获取 Agent 列表
      const agentsData = await getHermesAgents()
      const agentsList = Array.isArray(agentsData) ? agentsData : agentsData.agents || []
      setAgents(agentsList)
    } catch (err: any) {
      console.error('获取 Hermes 状态失败:', err)
      setError(err.response?.data?.detail || err.message || '无法连接到铁翼信使 Hermes')
      
      // 设置默认离线状态
      setHermesStatus({
        version: '未知',
        status: 'stopped',
        port: HERMES_PORT,
        agents_count: 0,
        active_agents: 0,
        plugins_count: 0,
        uptime: '-',
        memory_usage: '-',
      })
    } finally {
      setLoading(false)
    }
  }

  const agentColumns = [
    {
      title: 'Agent 名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          active: 'green',
          idle: 'blue',
          stopped: 'default',
          error: 'red',
        }
        const textMap: Record<string, string> = {
          active: '活跃',
          idle: '空闲',
          stopped: '已停止',
          error: '错误',
        }
        return <Tag color={colorMap[status] || 'default'}>{textMap[status] || status}</Tag>
      },
    },
    {
      title: 'Skills',
      dataIndex: 'skills_count',
      key: 'skills_count',
      render: (count: number) => count ? `${count} 个` : '-',
    },
    {
      title: 'Plugins',
      dataIndex: 'plugins_count',
      key: 'plugins_count',
      render: (count: number) => count ? `${count} 个` : '-',
    },
    {
      title: '上次活跃',
      dataIndex: 'last_active',
      key: 'last_active',
    },
    {
      title: '配置文件',
      dataIndex: 'config_path',
      key: 'config_path',
      ellipsis: true,
    },
  ]

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
  }

  return (
    <div>
      <Title level={4}>
        <ThunderboltOutlined /> 铁翼信使 Agent 管理
        <Tag color="purple" style={{ marginLeft: 12 }}>Hermes</Tag>
        <Tag color="blue" style={{ marginLeft: 8 }}>单实例</Tag>
      </Title>

      {/* 错误提示 */}
      {error && (
        <Alert
          message="连接异常"
          description={error}
          type="error"
          showIcon
          closable
          style={{ marginBottom: 24 }}
        />
      )}

      {/* Hermes 状态卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Hermes 状态"
              value={hermesStatus?.status === 'running' ? '运行中' : hermesStatus?.status === 'stopped' ? '已停止' : '错误'}
              prefix={
                hermesStatus?.status === 'running' ? (
                  <CloudServerOutlined style={{ color: '#52c41a' }} />
                ) : (
                  <ThunderboltOutlined style={{ color: '#ff4d4f' }} />
                )
              }
              valueStyle={{ color: hermesStatus?.status === 'running' ? '#52c41a' : '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Agent 总数" value={hermesStatus?.agents_count || agents.length} suffix="个" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="活跃 Agent" value={hermesStatus?.active_agents || agents.filter(a => a.status === 'active').length} suffix="个" valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Plugins" value={hermesStatus?.plugins_count || 0} suffix="个" />
          </Card>
        </Col>
      </Row>

      {/* Hermes 详细信息 */}
      <Card title="Hermes 详细信息" extra={<Button icon={<ReloadOutlined />} onClick={fetchHermesStatus}>刷新</Button>} style={{ marginBottom: 24 }}>
        <Descriptions column={2} bordered>
          <Descriptions.Item label="名称">铁翼信使 (Hermes)</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={hermesStatus?.status === 'running' ? 'green' : 'red'}>
              {hermesStatus?.status === 'running' ? '运行中' : '已停止'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="端口">{hermesStatus?.port || HERMES_PORT}</Descriptions.Item>
          <Descriptions.Item label="版本">{hermesStatus?.version}</Descriptions.Item>
          <Descriptions.Item label="运行时长">{hermesStatus?.uptime || '-'}</Descriptions.Item>
          <Descriptions.Item label="内存使用">{hermesStatus?.memory_usage || '-'}</Descriptions.Item>
          <Descriptions.Item label="API 地址" span={2}>
            <Text copyable>{HERMES_URL}</Text>
          </Descriptions.Item>
          {hermesStatus?.last_error && (
            <Descriptions.Item label="最后错误" span={2}>
              <Text type="danger">{hermesStatus.last_error}</Text>
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* Agent 列表 */}
      <Card title={<Space><RobotOutlined />Agent 列表</Space>} style={{ marginBottom: 24 }}>
        <Table
          dataSource={agents}
          columns={agentColumns}
          rowKey="name"
          pagination={false}
          locale={{ emptyText: '暂无 Agent 数据' }}
        />
      </Card>

      {/* 聊天界面 */}
      <Card title={<Space><ThunderboltOutlined />与铁翼信使对话</Space>} style={{ height: 600 }}>
        <ChatInterface
          apiUrl={HERMES_URL}
          agentName="铁翼信使"
          agentPort={HERMES_PORT}
          agentStatus={hermesStatus?.status === 'running' ? 'online' : 'offline'}
        />
      </Card>

      {/* 信息提示 */}
      <Alert
        message="ℹ️ 关于铁翼信使"
        description="Hermes 是统一的消息路由和 Agent 管理平台,支持多个 Agent 实例的编排和管理。通过聊天界面可以与默认 Agent 进行对话。"
        type="info"
        showIcon
        style={{ marginTop: 24 }}
      />
    </div>
  )
}
