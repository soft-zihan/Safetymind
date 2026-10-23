import { Card, Row, Col, Statistic, Tag, Space, Typography } from 'antd'
import {
  SafetyOutlined, WarningOutlined, CheckCircleOutlined, CloseCircleOutlined,
} from '@ant-design/icons'

const { Title, Text } = Typography

export default function DLPFilter() {
  return (
    <div>
      {/* 顶部标题 */}
      <Card style={{ marginBottom: 24, background: 'linear-gradient(135deg, #ff4d4f 0%, #ff7a45 100%)' }}>
        <Row align="middle" gutter={24}>
          <Col>
            <SafetyOutlined style={{ fontSize: 48, color: '#fff' }} />
          </Col>
          <Col flex="auto">
            <Title level={2} style={{ color: '#fff', margin: 0 }}>
              DLP 数据防泄漏
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 16 }}>
              实时检测并脱敏敏感数据，防止身份证、手机号、API Key 等敏感信息泄露
            </Text>
          </Col>
        </Row>
      </Card>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日过滤请求"
              value={1247}
              prefix={<SafetyOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="检测到敏感数据"
              value={89}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="自动脱敏"
              value={87}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="拦截请求"
              value={2}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 敏感数据类型检测 */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card title="🎯 敏感数据类型检测">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text strong>身份证号</Text>
                  <Tag color="red">32 次</Tag>
                </div>
                <div style={{ background: '#f5f5f5', borderRadius: 4, padding: '4px 8px', fontSize: 12, fontFamily: 'monospace' }}>
                  110101199001011234 → 110101********1234
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text strong>手机号</Text>
                  <Tag color="orange">28 次</Tag>
                </div>
                <div style={{ background: '#f5f5f5', borderRadius: 4, padding: '4px 8px', fontSize: 12, fontFamily: 'monospace' }}>
                  13812345678 → 138****5678
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text strong>API Key</Text>
                  <Tag color="purple">15 次</Tag>
                </div>
                <div style={{ background: '#f5f5f5', borderRadius: 4, padding: '4px 8px', fontSize: 12, fontFamily: 'monospace' }}>
                  sk-proj-abc123...xyz → sk-proj-****
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text strong>银行卡号</Text>
                  <Tag color="blue">12 次</Tag>
                </div>
                <div style={{ background: '#f5f5f5', borderRadius: 4, padding: '4px 8px', fontSize: 12, fontFamily: 'monospace' }}>
                  6222021234567890 → 6222********7890
                </div>
              </div>
            </Space>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="📊 过滤规则配置">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text strong>身份证号检测</Text>
                  <Tag color="green">已启用</Tag>
                </div>
                <Text type="secondary">正则匹配 18 位身份证号，自动脱敏中间 8 位</Text>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text strong>手机号检测</Text>
                  <Tag color="green">已启用</Tag>
                </div>
                <Text type="secondary">匹配 11 位手机号，脱敏中间 4 位</Text>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text strong>API Key 检测</Text>
                  <Tag color="green">已启用</Tag>
                </div>
                <Text type="secondary">检测 sk-、key-、token- 等前缀的密钥</Text>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text strong>银行卡号检测</Text>
                  <Tag color="green">已启用</Tag>
                </div>
                <Text type="secondary">匹配 16-19 位银行卡号，脱敏中间部分</Text>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 最近过滤事件 */}
      <Card title="📋 最近 DLP 过滤事件">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {[
            { time: '14:32:18', type: '身份证号', action: '脱敏', original: '110101199001011234', masked: '110101********1234' },
            { time: '14:31:05', type: '手机号', action: '脱敏', original: '13812345678', masked: '138****5678' },
            { time: '14:29:42', type: 'API Key', action: '脱敏', original: 'sk-proj-abc123def456', masked: 'sk-proj-****' },
            { time: '14:28:15', type: '银行卡号', action: '脱敏', original: '6222021234567890', masked: '6222********7890' },
            { time: '14:25:33', type: '邮箱', action: '放行', original: 'user@example.com', masked: 'user@example.com' },
          ].map((event, idx) => (
            <Card key={idx} size="small" style={{ borderLeft: `3px solid ${event.action === '脱敏' ? '#ff4d4f' : '#52c41a'}` }}>
              <Row justify="space-between" align="middle">
                <Col>
                  <Space>
                    <Tag color={event.action === '脱敏' ? 'red' : 'green'}>{event.action}</Tag>
                    <Text type="secondary">{event.time}</Text>
                    <Tag>{event.type}</Tag>
                  </Space>
                </Col>
                <Col>
                  <Text code style={{ fontSize: 12 }}>{event.original}</Text>
                  {event.action === '脱敏' && (
                    <>
                      <Text style={{ margin: '0 8px' }}>→</Text>
                      <Text code style={{ fontSize: 12, color: '#52c41a' }}>{event.masked}</Text>
                    </>
                  )}
                </Col>
              </Row>
            </Card>
          ))}
        </Space>
      </Card>
    </div>
  )
}
