import { useState, useEffect } from 'react'
import { Card, Button, Collapse, Tag, Typography, Spin, Row, Col, Statistic, message } from 'antd'
import { LockOutlined, CheckCircleOutlined, WarningOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { getSecurityOverview, runHardening } from '../../lib/hermesApi'

const { Title } = Typography

const statusTag: Record<string, React.ReactNode> = {
  pass: <Tag icon={<CheckCircleOutlined />} color="success">通过</Tag>,
  warn: <Tag icon={<WarningOutlined />} color="warning">警告</Tag>,
  fail: <Tag icon={<CloseCircleOutlined />} color="error">失败</Tag>,
}

export default function HermesHardening() {
  const [layers, setLayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [hardening, setHardening] = useState(false)

  useEffect(() => {
    getSecurityOverview()
      .then((data) => setLayers(data.layers || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleHarden = async () => {
    setHardening(true)
    try {
      await runHardening()
      message.success('加固检查完成')
      const data = await getSecurityOverview()
      setLayers(data.layers || [])
    } catch {
      message.error('加固失败')
    } finally {
      setHardening(false)
    }
  }

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />

  const passCount = layers.filter(l => l.status === 'pass').length
  const warnCount = layers.filter(l => l.status === 'warn').length
  const failCount = layers.filter(l => l.status === 'fail').length

  return (
    <div>
      <Title level={4}><LockOutlined /> Hermes 加固指南</Title>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}><Card><Statistic title="通过" value={passCount} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={8}><Card><Statistic title="警告" value={warnCount} valueStyle={{ color: '#faad14' }} /></Card></Col>
        <Col span={8}><Card><Statistic title="失败" value={failCount} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
      </Row>
      <Button type="primary" icon={<LockOutlined />} loading={hardening} onClick={handleHarden} style={{ marginBottom: 16 }}>
        一键加固检查
      </Button>
      <Collapse
        items={layers.map((layer: any) => ({
          key: layer.key,
          label: (
            <span>
              {layer.name} {statusTag[layer.status]}
            </span>
          ),
          children: <p>{layer.detail}</p>,
        }))}
      />
    </div>
  )
}
