import { useState } from 'react'
import { Card, Button, Table, Tag, Typography, Space, Row, Col, Statistic, message } from 'antd'
import { ScanOutlined } from '@ant-design/icons'
import { runSecurityScan } from '../../lib/hermesApi'

const { Title } = Typography

const severityColor: Record<string, string> = { critical: 'red', high: 'orange', medium: 'gold', low: 'blue' }

export default function HermesSecurityScan() {
  const [scanning, setScanning] = useState(false)
  const [results, setResults] = useState<any>(null)

  const handleScan = async (type: string) => {
    setScanning(true)
    try {
      const data = await runSecurityScan(type)
      // 检查 API 返回的 status 字段
      if (data.status === 'error') {
        message.error(data.message || '扫描失败')
        setResults(null)
      } else {
        setResults(data)
        message.success('扫描完成')
      }
    } catch {
      message.error('扫描失败')
    } finally {
      setScanning(false)
    }
  }

  const columns = [
    { title: '严重度', dataIndex: 'severity', key: 'severity', render: (s: string) => <Tag color={severityColor[s]}>{s}</Tag> },
    { title: '类型', dataIndex: 'type', key: 'type' },
    { title: '描述', dataIndex: 'description', key: 'description' },
    { title: '修复建议', dataIndex: 'remediation', key: 'remediation' },
  ]

  return (
    <div>
      <Title level={4}><ScanOutlined /> Tirith 安全扫描</Title>
      <Space style={{ marginBottom: 24 }}>
        <Button type="primary" icon={<ScanOutlined />} loading={scanning} onClick={() => handleScan('full')}>
          完整扫描
        </Button>
        <Button icon={<ScanOutlined />} loading={scanning} onClick={() => handleScan('quick')}>
          快速扫描
        </Button>
      </Space>

      {results && (
        <>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card><Statistic title="发现问题" value={results.total_issues || 0} valueStyle={{ color: '#ff4d4f' }} /></Card>
            </Col>
            <Col span={6}>
              <Card><Statistic title="高危" value={results.critical || 0} valueStyle={{ color: '#ff4d4f' }} /></Card>
            </Col>
            <Col span={6}>
              <Card><Statistic title="警告" value={results.warnings || 0} valueStyle={{ color: '#faad14' }} /></Card>
            </Col>
            <Col span={6}>
              <Card><Statistic title="通过" value={results.passed || 0} valueStyle={{ color: '#52c41a' }} /></Card>
            </Col>
          </Row>
          <Table dataSource={results.issues || []} columns={columns} rowKey={(_, i) => String(i)} pagination={false} />
        </>
      )}
    </div>
  )
}
