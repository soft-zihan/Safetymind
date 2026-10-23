import { useState, useEffect } from 'react'
import { Card, Table, Tag, Typography, Spin, Row, Col, Statistic } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import { getHermesAgents } from '../../lib/hermesApi'

const { Title } = Typography

export default function HermesAgentManager() {
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getHermesAgents()
      .then((data) => setAgents(Array.isArray(data) ? data : data.agents || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (s: string) => <Tag color={s === 'active' ? 'green' : 'default'}>{s}</Tag>,
    },
    { title: '配置文件', dataIndex: 'config_path', key: 'config_path' },
    { title: '上次活跃', dataIndex: 'last_active', key: 'last_active' },
  ]

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />

  return (
    <div>
      <Title level={4}><RobotOutlined /> Hermes Agent 管理</Title>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card><Statistic title="Agent 总数" value={agents.length} /></Card>
        </Col>
        <Col span={8}>
          <Card><Statistic title="活跃" value={agents.filter(a => a.status === 'active').length} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col span={8}>
          <Card><Statistic title="空闲" value={agents.filter(a => a.status === 'idle').length} /></Card>
        </Col>
      </Row>
      <Table dataSource={agents} columns={columns} rowKey="name" pagination={false} />
    </div>
  )
}
