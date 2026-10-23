import { useNavigate } from 'react-router-dom'
import { Card, Row, Col, Typography } from 'antd'
import {
  DashboardOutlined, RobotOutlined, FileTextOutlined,
  LockOutlined, ApiOutlined, ScanOutlined,
  CloudServerOutlined, ThunderboltOutlined, PartitionOutlined,
  AppstoreOutlined,
} from '@ant-design/icons'

const { Title, Text } = Typography

const items = [
  { key: 'hermes-dashboard', icon: <DashboardOutlined style={{ fontSize: 28 }} />, title: 'Hermes 安全总览', path: '/hermes/dashboard' },
  { key: 'hermes-agent', icon: <RobotOutlined style={{ fontSize: 28 }} />, title: 'Hermes Agent 管理', path: '/hermes/agent' },
  { key: 'hermes-agents', icon: <CloudServerOutlined style={{ fontSize: 28 }} />, title: 'Hermes Agents 列表', path: '/hermes/agents' },
  { key: 'hermes-audit', icon: <FileTextOutlined style={{ fontSize: 28 }} />, title: 'Hermes 审计报告', path: '/hermes/audit' },
  { key: 'hermes-hardening', icon: <LockOutlined style={{ fontSize: 28 }} />, title: 'Hermes 加固检查', path: '/hermes/hardening' },
  { key: 'hermes-plugins', icon: <ApiOutlined style={{ fontSize: 28 }} />, title: 'Hermes 插件管理', path: '/hermes/plugins' },
  { key: 'hermes-scan', icon: <ScanOutlined style={{ fontSize: 28 }} />, title: 'Hermes 安全扫描', path: '/hermes/security-scan' },
  { key: 'hermes-evey', icon: <ThunderboltOutlined style={{ fontSize: 28 }} />, title: 'Upstream: Evey', path: '/hermes/upstream/evey' },
  { key: 'hermes-icarus', icon: <PartitionOutlined style={{ fontSize: 28 }} />, title: 'Upstream: Icarus', path: '/hermes/upstream/icarus' },
  { key: 'hermes-labyrinth', icon: <AppstoreOutlined style={{ fontSize: 28 }} />, title: 'Upstream: Labyrinth', path: '/hermes/upstream/labyrinth' },
  { key: 'hermes-upstream-plugins', icon: <AppstoreOutlined style={{ fontSize: 28 }} />, title: 'Upstream: 插件集', path: '/hermes/upstream/plugins' },
]

export default function HermesSub() {
  const navigate = useNavigate()
  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>⚡ Hermes 铁翼信使</Title>
      <Row gutter={[16, 16]}>
        {items.map((item) => (
          <Col xs={24} sm={12} md={8} lg={6} key={item.key}>
            <Card
              hoverable
              style={{ borderRadius: 10, textAlign: 'center', height: 140 }}
              onClick={() => navigate(item.path)}
            >
              <div style={{ fontSize: 32, marginBottom: 8, color: '#1890ff' }}>{item.icon}</div>
              <Text strong>{item.title}</Text>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}