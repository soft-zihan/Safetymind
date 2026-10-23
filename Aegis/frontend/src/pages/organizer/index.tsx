import { useNavigate } from 'react-router-dom'
import { Card, Row, Col, Typography, Space } from 'antd'
import {
  ThunderboltOutlined,
  ToolOutlined,
  SettingOutlined,
  DesktopOutlined,
  SafetyCertificateOutlined,
  FileProtectOutlined,
} from '@ant-design/icons'

const { Title, Text } = Typography

const categories = [
  {
    key: 'hermes',
    icon: <ThunderboltOutlined style={{ fontSize: 36, color: '#1890ff' }} />,
    title: 'Hermes 铁翼信使',
    desc: '安全总览、Agent 管理、审计报告、加固检查、插件管理、安全扫描、上游项目',
    path: '/organizer/hermes',
    color: '#e6f7ff',
    borderColor: '#1890ff',
  },
  {
    key: 'tools',
    icon: <ToolOutlined style={{ fontSize: 36, color: '#52c41a' }} />,
    title: '工具箱',
    desc: '预检扫描、防护规则、数据集管理、评估测试、本地 SLM、运行时观察、安全事件、系统诊断、备份恢复、Shield 状态',
    path: '/organizer/tools',
    color: '#f6ffed',
    borderColor: '#52c41a',
  },
  {
    key: 'system',
    icon: <SettingOutlined style={{ fontSize: 36, color: '#722ed1' }} />,
    title: '系统管理',
    desc: '高级实验室、集成管理、系统设置',
    path: '/organizer/system',
    color: '#f9f0ff',
    borderColor: '#722ed1',
  },
  {
    key: 'overview-ppt',
    icon: <DesktopOutlined style={{ fontSize: 36, color: '#fa8c16' }} />,
    title: '概览 PPT',
    desc: 'Safetymind 总览、Harness 概览、Monitor 概览、Privacy 概览',
    path: '/organizer/overview-ppt',
    color: '#fff7e6',
    borderColor: '#fa8c16',
  },
  {
    key: 'other',
    icon: <FileProtectOutlined style={{ fontSize: 36, color: '#eb2f96' }} />,
    title: '其他功能',
    desc: 'Dashboard 仪表盘、DLP 数据防泄漏',
    path: '/organizer/other',
    color: '#fff0f6',
    borderColor: '#eb2f96',
  },
]

export default function OrganizerHub() {
  const navigate = useNavigate()

  return (
    <div style={{ padding: 24 }}>
      {/* 顶部标题 */}
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <Title level={2} style={{ margin: 0 }}>
          📦 收纳
        </Title>
        <Text type="secondary" style={{ fontSize: 16 }}>
          所有隐藏功能页面统一收纳在此，按类别快速导航
        </Text>
      </div>

      {/* 分类卡片 */}
      <Row gutter={[24, 24]}>
        {categories.map((cat) => (
          <Col xs={24} sm={12} lg={8} key={cat.key}>
            <Card
              hoverable
              style={{
                borderRadius: 12,
                height: '100%',
                borderLeft: `4px solid ${cat.borderColor}`,
                background: cat.color,
              }}
              onClick={() => navigate(cat.path)}
            >
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {cat.icon}
                  <Title level={4} style={{ margin: 0 }}>{cat.title}</Title>
                </div>
                <Text type="secondary" style={{ fontSize: 14 }}>
                  {cat.desc}
                </Text>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}