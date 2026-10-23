import { useNavigate } from 'react-router-dom'
import { Card, Row, Col, Typography } from 'antd'
import { ExperimentOutlined, ApiOutlined, SettingOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

const items = [
  { key: 'advanced-lab', icon: <ExperimentOutlined style={{ fontSize: 28 }} />, title: '高级实验室', desc: '管道检查与 Payload 测试', path: '/system/advanced-lab' },
  { key: 'integrations', icon: <ApiOutlined style={{ fontSize: 28 }} />, title: '集成管理', desc: '第三方组件集成管理', path: '/system/integrations' },
  { key: 'settings', icon: <SettingOutlined style={{ fontSize: 28 }} />, title: '系统设置', desc: '全局配置与偏好设置', path: '/system/settings' },
]

export default function SystemSub() {
  const navigate = useNavigate()
  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>⚙️ 系统管理</Title>
      <Row gutter={[16, 16]}>
        {items.map((item) => (
          <Col xs={24} sm={12} md={8} key={item.key}>
            <Card
              hoverable
              style={{ borderRadius: 10, height: 160, borderLeft: '4px solid #722ed1' }}
              onClick={() => navigate(item.path)}
            >
              <div style={{ fontSize: 36, marginBottom: 12, color: '#722ed1' }}>{item.icon}</div>
              <Title level={5} style={{ margin: 0 }}>{item.title}</Title>
              <Text type="secondary">{item.desc}</Text>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}