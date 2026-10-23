import { useNavigate } from 'react-router-dom'
import { Card, Row, Col, Typography, Tag } from 'antd'
import {
  ScanOutlined, SafetyOutlined, DatabaseOutlined,
  ExperimentOutlined, CloudServerOutlined, EyeOutlined,
  AlertOutlined, MedicineBoxOutlined, SaveOutlined,
  ShieldOutlined,
} from '@ant-design/icons'

const { Title, Text } = Typography

const items = [
  { key: 'preflight', icon: <ScanOutlined style={{ fontSize: 28 }} />, title: '预检扫描', path: '/tools/preflight', tag: '安全' },
  { key: 'protection-rules', icon: <SafetyOutlined style={{ fontSize: 28 }} />, title: '防护规则', path: '/tools/protection-rules', tag: '安全' },
  { key: 'dataset-manager', icon: <DatabaseOutlined style={{ fontSize: 28 }} />, title: '数据集管理', path: '/tools/dataset-manager', tag: '数据' },
  { key: 'evaluation', icon: <ExperimentOutlined style={{ fontSize: 28 }} />, title: '评估测试', path: '/tools/evaluation', tag: '评估' },
  { key: 'local-slm', icon: <CloudServerOutlined style={{ fontSize: 28 }} />, title: '本地 SLM', path: '/tools/local-slm', tag: '模型' },
  { key: 'runtime-observer', icon: <EyeOutlined style={{ fontSize: 28 }} />, title: '运行时观察', path: '/tools/runtime-observer', tag: '监控' },
  { key: 'security-events', icon: <AlertOutlined style={{ fontSize: 28 }} />, title: '安全事件', path: '/tools/security-events', tag: '监控' },
  { key: 'system-doctor', icon: <MedicineBoxOutlined style={{ fontSize: 28 }} />, title: '系统诊断', path: '/tools/system-doctor', tag: '运维' },
  { key: 'backup-restore', icon: <SaveOutlined style={{ fontSize: 28 }} />, title: '备份恢复', path: '/tools/backup-restore', tag: '运维' },
  { key: 'shield', icon: <ShieldOutlined style={{ fontSize: 28 }} />, title: 'Shield 状态', path: '/tools/shield', tag: '安全' },
]

const tagColors: Record<string, string> = { 安全: 'red', 数据: 'blue', 评估: 'purple', 模型: 'green', 监控: 'orange', 运维: 'cyan' }

export default function ToolsSub() {
  const navigate = useNavigate()
  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>🧰 工具箱</Title>
      <Row gutter={[16, 16]}>
        {items.map((item) => (
          <Col xs={24} sm={12} md={8} lg={6} key={item.key}>
            <Card
              hoverable
              style={{ borderRadius: 10, height: 160 }}
              onClick={() => navigate(item.path)}
            >
              <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 32, marginBottom: 8, color: '#52c41a' }}>{item.icon}</div>
                <Text strong>{item.title}</Text>
              </div>
              <div style={{ textAlign: 'center' }}>
                <Tag color={tagColors[item.tag]}>{item.tag}</Tag>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}