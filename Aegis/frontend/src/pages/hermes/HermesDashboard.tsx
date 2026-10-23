import { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Tag, Timeline, Typography, Spin, Alert } from 'antd'
import { CheckCircleOutlined, WarningOutlined, CloseCircleOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { getHermesStatus, getSecurityOverview } from '../../lib/hermesApi'

const { Title, Text } = Typography

const statusIcon: Record<string, React.ReactNode> = {
  pass: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
  warn: <WarningOutlined style={{ color: '#faad14' }} />,
  fail: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
}

const statusColor: Record<string, string> = { pass: 'green', warn: 'orange', fail: 'red' }

export default function HermesDashboard() {
  const [status, setStatus] = useState<any>(null)
  const [layers, setLayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getHermesStatus(), getSecurityOverview()])
      .then(([s, o]) => {
        setStatus(s)
        setLayers(o.layers || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />

  return (
    <div>
      <Title level={4}><ThunderboltOutlined /> 铁翼信使 Hermes — 安全总览</Title>

      {/* Agent 状态 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="运行状态" value={status?.running ? '运行中' : '未运行'}
              valueStyle={{ color: status?.running ? '#52c41a' : '#ff4d4f' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="版本" value={status?.version || 'N/A'} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="运行时间" value={status?.uptime || 'N/A'} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="活跃会话" value={status?.active_sessions || 0} suffix="个" />
          </Card>
        </Col>
      </Row>

      {/* 7 层安全架构 */}
      <Title level={5}>7 层安全架构</Title>
      <Card style={{ marginBottom: 24 }}>
        <Timeline
          items={layers.map((layer: any) => ({
            dot: statusIcon[layer.status] || statusIcon.warn,
            children: (
              <div>
                <Text strong>{layer.name}</Text>
                <Tag color={statusColor[layer.status]} style={{ marginLeft: 8 }}>{layer.status}</Tag>
                <br />
                <Text type="secondary">{layer.detail}</Text>
              </div>
            ),
          }))}
        />
      </Card>

      {/* 最近事件 */}
      {status?.running ? (
        <Alert
          message="Tirith 扫描摘要"
          description="请前往 Tirith 扫描页面执行扫描以获取最新结果"
          type="info"
          showIcon
        />
      ) : (
        <Alert
          message="Hermes Agent 未运行"
          description="请先安装并启动 Hermes Agent，然后才能查看安全状态"
          type="warning"
          showIcon
        />
      )}
    </div>
  )
}
