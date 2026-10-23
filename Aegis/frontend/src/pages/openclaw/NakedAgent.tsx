import { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Tag, Descriptions, Button, Space, Spin, Alert, Typography } from 'antd'
import { RobotOutlined, ThunderboltOutlined, SafetyOutlined, ReloadOutlined, ApiOutlined } from '@ant-design/icons'
import ChatInterface from '../../components/ChatInterface'
import axios from 'axios'

const { Title, Text } = Typography

interface AgentStatus {
  name: string
  status: 'running' | 'stopped' | 'error'
  port: number
  version: string
  model: string
  uptime: string
  memory_usage: string
  skills_count: number
  plugins_count: number
  last_error?: string
}

interface Skill {
  name: string
  description: string
  enabled: boolean
}

interface Plugin {
  name: string
  version: string
  status: 'active' | 'inactive' | 'error'
}

export default function NakedAgent() {
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null)
  const [skills, setSkills] = useState<Skill[]>([])
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const NAKED_AGENT_PORT = 19789
  const NAKED_AGENT_URL = `http://localhost:${NAKED_AGENT_PORT}`

  useEffect(() => {
    fetchAgentStatus()
  }, [])

  const fetchAgentStatus = async () => {
    setLoading(true)
    setError(null)
    try {
      // 获取 Agent 状态
      const statusRes = await axios.get(`/api/openclaw/naked/status`, { timeout: 10000 })
      setAgentStatus(statusRes.data)

      // 获取 Skills 列表
      const skillsRes = await axios.get(`/api/openclaw/naked/skills`, { timeout: 10000 })
      setSkills(skillsRes.data.skills || skillsRes.data || [])

      // 获取 Plugins 列表
      const pluginsRes = await axios.get(`/api/openclaw/naked/plugins`, { timeout: 10000 })
      setPlugins(pluginsRes.data.plugins || pluginsRes.data || [])
    } catch (err: any) {
      console.error('获取裸奔龙虾状态失败:', err)
      setError(err.response?.data?.detail || err.message || '无法连接到裸奔龙虾 Agent')
      
      // 设置默认离线状态
      setAgentStatus({
        name: '裸奔龙虾 (Naked Lobster)',
        status: 'stopped',
        port: NAKED_AGENT_PORT,
        version: '未知',
        model: '未知',
        uptime: '-',
        memory_usage: '-',
        skills_count: 0,
        plugins_count: 0,
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
  }

  return (
    <div>
      <Title level={4}>
        <RobotOutlined /> 裸奔龙虾管理
        <Tag color="red" style={{ marginLeft: 12 }}>端口 {NAKED_AGENT_PORT}</Tag>
        <Tag color="orange" style={{ marginLeft: 8 }}>未加固</Tag>
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

      {/* Agent 状态卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Agent 状态"
              value={agentStatus?.status === 'running' ? '运行中' : agentStatus?.status === 'stopped' ? '已停止' : '错误'}
              prefix={
                agentStatus?.status === 'running' ? (
                  <SafetyOutlined style={{ color: '#52c41a' }} />
                ) : (
                  <ThunderboltOutlined style={{ color: '#ff4d4f' }} />
                )
              }
              valueStyle={{ color: agentStatus?.status === 'running' ? '#52c41a' : '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="运行时长" value={agentStatus?.uptime || '-'} suffix="" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Skills" value={agentStatus?.skills_count || skills.length} suffix="个" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Plugins" value={agentStatus?.plugins_count || plugins.length} suffix="个" />
          </Card>
        </Col>
      </Row>

      {/* Agent 详细信息 */}
      <Card title="Agent 详细信息" extra={<Button icon={<ReloadOutlined />} onClick={fetchAgentStatus}>刷新</Button>} style={{ marginBottom: 24 }}>
        <Descriptions column={2} bordered>
          <Descriptions.Item label="名称">{agentStatus?.name}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={agentStatus?.status === 'running' ? 'green' : 'red'}>
              {agentStatus?.status === 'running' ? '运行中' : '已停止'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="端口">{agentStatus?.port}</Descriptions.Item>
          <Descriptions.Item label="版本">{agentStatus?.version}</Descriptions.Item>
          <Descriptions.Item label="模型">{agentStatus?.model}</Descriptions.Item>
          <Descriptions.Item label="内存使用">{agentStatus?.memory_usage}</Descriptions.Item>
          <Descriptions.Item label="API 地址" span={2}>
            <Text copyable>{NAKED_AGENT_URL}</Text>
          </Descriptions.Item>
          {agentStatus?.last_error && (
            <Descriptions.Item label="最后错误" span={2}>
              <Text type="danger">{agentStatus.last_error}</Text>
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* Skills 和 Plugins */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card title={<Space><ApiOutlined />Skills 列表</Space>} extra={<Tag>{skills.length} 个</Tag>}>
            {skills.length > 0 ? (
              <div style={{ maxHeight: 300, overflow: 'auto' }}>
                {skills.map((skill, index) => (
                  <div key={index} style={{ padding: '8px 0', borderBottom: index < skills.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                    <Space direction="vertical" size={2} style={{ width: '100%' }}>
                      <Space>
                        <Text strong>{skill.name}</Text>
                        <Tag color={skill.enabled ? 'green' : 'default'}>{skill.enabled ? '已启用' : '已禁用'}</Tag>
                      </Space>
                      <Text type="secondary" style={{ fontSize: 12 }}>{skill.description}</Text>
                    </Space>
                  </div>
                ))}
              </div>
            ) : (
              <Text type="secondary">暂无 Skills 数据</Text>
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card title={<Space><RobotOutlined />Plugins 列表</Space>} extra={<Tag>{plugins.length} 个</Tag>}>
            {plugins.length > 0 ? (
              <div style={{ maxHeight: 300, overflow: 'auto' }}>
                {plugins.map((plugin, index) => (
                  <div key={index} style={{ padding: '8px 0', borderBottom: index < plugins.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                    <Space>
                      <Text strong>{plugin.name}</Text>
                      <Tag>v{plugin.version}</Tag>
                      <Tag color={plugin.status === 'active' ? 'green' : plugin.status === 'error' ? 'red' : 'default'}>
                        {plugin.status === 'active' ? '活跃' : plugin.status === 'error' ? '错误' : '非活跃'}
                      </Tag>
                    </Space>
                  </div>
                ))}
              </div>
            ) : (
              <Text type="secondary">暂无 Plugins 数据</Text>
            )}
          </Card>
        </Col>
      </Row>

      {/* 聊天界面 */}
      <Card title={<Space><RobotOutlined />与裸奔龙虾对话</Space>} style={{ height: 600 }}>
        <ChatInterface
          apiUrl={NAKED_AGENT_URL}
          agentName="裸奔龙虾"
          agentPort={NAKED_AGENT_PORT}
          agentStatus={agentStatus?.status === 'running' ? 'online' : 'offline'}
        />
      </Card>

      {/* 警告提示 */}
      <Alert
        message="⚠️ 安全警告"
        description="裸奔龙虾未启用任何安全防护措施,仅用于对比测试。请勿在生产环境使用,不要发送敏感信息。"
        type="warning"
        showIcon
        style={{ marginTop: 24 }}
      />
    </div>
  )
}
