import { useNavigate } from 'react-router-dom'
import { Card, Row, Col, Typography } from 'antd'
import { DashboardOutlined, SafetyOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

const items = [
  { key: 'dashboard', icon: <DashboardOutlined style={{ fontSize: 28 }} />, title: '安全评分仪表盘', desc: '整体安全评分与趋势', path: '/dashboard' },
  { key: 'dlp-filter', icon: <SafetyOutlined style={{ fontSize: 28 }} />, title: 'DLP 数据防泄漏', desc: '敏感数据检测与脱敏', path: '/privacy/dlp' },
]

export default function OtherSub() {
  const navigate = useNavigate()
  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>📋 其他功能</Title>
      <Row gutter={[16, 16]}>
        {items.map((item) => (
          <Col xs={24} sm={12} md={8} key={item.key}>
            <Card
              hoverable
              style={{ borderRadius: 10, height: 160, borderLeft: '4px solid #eb2f96' }}
              onClick={() => navigate(item.path)}
            >
              <div style={{ fontSize: 36, marginBottom: 12, color: '#eb2f96' }}>{item.icon}</div>
              <Title level={5} style={{ margin: 0 }}>{item.title}</Title>
              <Text type="secondary">{item.desc}</Text>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}