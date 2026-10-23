import { useNavigate } from 'react-router-dom'
import { Card, Row, Col, Typography } from 'antd'
import { DesktopOutlined, SafetyOutlined, EyeOutlined, SafetyCertificateOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

const items = [
  { key: 'overview-home', icon: <DesktopOutlined style={{ fontSize: 28 }} />, title: 'Safetymind 总览 PPT', path: '/overview/ppt' },
  { key: 'harness-overview', icon: <SafetyOutlined style={{ fontSize: 28 }} />, title: 'Harness 概览 PPT', path: '/harness/overview' },
  { key: 'monitor-overview', icon: <EyeOutlined style={{ fontSize: 28 }} />, title: 'Monitor 概览 PPT', path: '/monitor/overview' },
  { key: 'privacy-overview', icon: <SafetyCertificateOutlined style={{ fontSize: 28 }} />, title: 'Privacy 概览 PPT', path: '/privacy/overview' },
]

export default function OverviewPPTSub() {
  const navigate = useNavigate()
  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>🖥️ 概览 PPT</Title>
      <Row gutter={[16, 16]}>
        {items.map((item) => (
          <Col xs={24} sm={12} md={6} key={item.key}>
            <Card
              hoverable
              style={{ borderRadius: 10, textAlign: 'center', height: 160 }}
              onClick={() => navigate(item.path)}
            >
              <div style={{ fontSize: 40, marginBottom: 12, color: '#fa8c16' }}>{item.icon}</div>
              <Text strong>{item.title}</Text>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}