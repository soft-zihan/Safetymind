import { useState, useEffect } from 'react'
import { Card, Table, Tag, Typography, Spin, Row, Col, Statistic, Progress } from 'antd'
import { FileTextOutlined } from '@ant-design/icons'
import { getAuditReport } from '../../lib/hermesApi'

const { Title } = Typography

const severityColor: Record<string, string> = { critical: 'red', high: 'orange', medium: 'gold', low: 'blue', info: 'default' }

export default function HermesAudit() {
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAuditReport()
      .then(setReport)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />

  const score = report?.score || 0
  const issues = report?.issues || []

  const columns = [
    { title: '严重度', dataIndex: 'severity', key: 'severity', render: (s: string) => <Tag color={severityColor[s]}>{s}</Tag> },
    { title: '描述', dataIndex: 'description', key: 'description' },
    { title: '影响范围', dataIndex: 'scope', key: 'scope' },
    { title: '修复方案', dataIndex: 'remediation', key: 'remediation' },
  ]

  return (
    <div>
      <Title level={4}><FileTextOutlined /> Hermes 审计报告</Title>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <Progress type="circle" percent={score} size={120}
                strokeColor={score >= 80 ? '#52c41a' : score >= 60 ? '#faad14' : '#ff4d4f'} />
              <div style={{ marginTop: 8 }}>安全评分</div>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card><Statistic title="发现问题总数" value={issues.length} /></Card>
        </Col>
        <Col span={8}>
          <Card><Statistic title="高危问题" value={issues.filter((i: any) => i.severity === 'critical' || i.severity === 'high').length} valueStyle={{ color: '#ff4d4f' }} /></Card>
        </Col>
      </Row>
      <Table dataSource={issues} columns={columns} rowKey={(_, i) => String(i)} pagination={false} />
    </div>
  )
}
