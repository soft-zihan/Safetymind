import { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Tag, Descriptions, Button, Space, Spin, Alert, Typography, List } from 'antd'
import { RobotOutlined, ThunderboltOutlined, SafetyOutlined, ReloadOutlined, ApiOutlined, LockOutlined } from '@ant-design/icons'
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
  security_level: string
  active_defenses: string[]
  last_error?: string
}

interface Skill {
  name: string
  description: string
  enabled: boolean
  security_validated?: boolean
}

interface Plugin {
  name: string
  version: string
  status: 'active' | 'inactive' | 'error'
  security_checked?: boolean
}

interface DefenseLayer {
  id: string
  name: string
  enabled: boolean
  description: string
}

export default function HardenedAgent() {
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null)
  const [skills, setSkills] = useState<Skill[]>([])
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [defenseLayers, setDefenseLayers] = useState<DefenseLayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const HARDENED_AGENT_PORT = 20789
  const HARDENED_AGENT_URL = `http://localhost:${HARDENED_AGENT_PORT}`

  useEffect(() => {
    fetchAgentStatus()
  }, [])

  const fetchAgentStatus = async () => {
    setLoading(true)
    setError(null)
    try {
      // 获取 Agent 状态
      const statusRes = await axios.get(`/api/openclaw/hardened/status`, { timeout: 10000 })
      setAgentStatus(statusRes.data)

      // 获取 Skills 列表
      const skillsRes = await axios.get(`/api/openclaw/hardened/skills`, { timeout: 10000 })
      setSkills(skillsRes.data.skills || skillsRes.data || [])

      // 获取 Plugins 列表
      const pluginsRes = await axios.get(`/api/openclaw/hardened/plugins`, { timeout: 10000 })
      setPlugins(pluginsRes.data.plugins || pluginsRes.data || [])

      // 获取防御层配置
      const defenseRes = await axios.get(`/api/openclaw/hardened/defense`, { timeout: 10000 })
      setDefenseLayers(defenseRes.data.layers || defenseRes.data || [])
    } catch (err: any) {
      console.error('获取金刚龙虾状态失败:', err)
      setError(err.response?.data?.detail || err.message || '无法连接到金刚龙虾 Agent')
      
      // 设置默认离线状态
      setAgentStatus({
        name: '金刚龙虾 (Hardened Lobster)',
        status: 'stopped',
        port: HARDENED_AGENT_PORT,
        version: '未知',
        model: '未知',
        uptime: '-',
        memory_usage: '-',
        skills_count: 0,
        plugins_count: 0,
        security_level: '未知',
        active_defenses: [],
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
        <RobotOutlined /> 金刚龙虾管理
        <Tag color="green" style={{ marginLeft: 12 }}>端口 {HARDENED_AGENT_PORT}</Tag>
        <Tag color="blue" style={{ marginLeft: 8 }}>已加固</Tag>
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
            <Statistic title="安全等级" value={agentStatus?.security_level || '高'} prefix={<SafetyOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Skills" value={agentStatus?.skills_count || skills.length} suffix="个" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="活跃防御" value={agentStatus?.active_defenses?.length || 0} suffix="层" valueStyle={{ color: '#1890ff' }} />
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
          <Descriptions.Item label="安全等级">
            <Tag color="blue">{agentStatus?.security_level || '高'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="API 地址" span={2}>
            <Text copyable>{HARDENED_AGENT_URL}</Text>
          </Descriptions.Item>
          {agentStatus?.active_defenses && agentStatus.active_defenses.length > 0 && (
            <Descriptions.Item label="活跃防御层" span={2}>
              <Space wrap>
                {agentStatus.active_defenses.map((defense, index) => (
                  <Tag key={index} color="green"><LockOutlined /> {defense}</Tag>
                ))}
              </Space>
            </Descriptions.Item>
          )}
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
                        {skill.security_validated && (
                          <Tag color="blue"><SafetyOutlined /> 安全验证</Tag>
                        )}
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
                      {plugin.security_checked && (
                        <Tag color="blue"><SafetyOutlined /> 已安检</Tag>
                      )}
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

      {/* 防御层配置 */}
      {defenseLayers.length > 0 && (
        <Card title={<Space><SafetyOutlined />防御层配置</Space>} style={{ marginBottom: 24 }}>
          <List
            dataSource={defenseLayers}
            renderItem={(layer) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space>
                      <Tag color={layer.enabled ? 'green' : 'default'}>
                        <LockOutlined /> {layer.name}
                      </Tag>
                      <Text type="secondary">{layer.description}</Text>
                    </Space>
                  }
                />
                <Tag color={layer.enabled ? 'green' : 'default'}>
                  {layer.enabled ? '已启用' : '已禁用'}
                </Tag>
              </List.Item>
            )}
          />
        </Card>
      )}

      {/* 聊天界面 */}
      <Card title={<Space><RobotOutlined />与金刚龙虾对话</Space>} style={{ height: 600 }}>
        <ChatInterface
          apiUrl={HARDENED_AGENT_URL}
          agentName="金刚龙虾"
          agentPort={HARDENED_AGENT_PORT}
          agentStatus={agentStatus?.status === 'running' ? 'online' : 'offline'}
        />
      </Card>

      {/* 安全提示 */}
      <Alert
        message="✅ 安全防护已启用"
        description="金刚龙虾已启用多层安全防护,包括输入过滤、权限控制、沙箱隔离等。所有交互均受安全策略保护。"
        type="success"
        showIcon
        style={{ marginTop: 24 }}
      />
    </div>
  )
}
