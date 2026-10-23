import { useState, useEffect } from 'react'
import { Card, Table, Tag, Button, message, Timeline, Row, Col, Statistic, Empty, Descriptions } from 'antd'
import { ReloadOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons'
import axios from 'axios'

interface AuditRecord {
  id: string
  timestamp: string
  scenario_id: number
  naked_result: string
  hardened_result: string
  leak_detected: boolean
  judge_result?: {
    naked_judge: string
    hardened_judge: string
    naked_judge_display: string
    hardened_judge_display: string
    judge_reason: string
  }
}

function Audit() {
  const [audits, setAudits] = useState<AuditRecord[]>([])
  const [loading, setLoading] = useState(false)

  const columns = [
    {
      title: '审计时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
      width: 180,
    },
    {
      title: '场景ID',
      dataIndex: 'scenario_id',
      key: 'scenario_id',
      render: (id: number) => `场景 ${id}`,
      width: 100,
    },
    {
      title: 'Unsafe-Carmind',
      dataIndex: 'naked_result',
      key: 'naked_result',
      render: (result: string, record: AuditRecord) => (
        <Tag color={result === 'fail' ? 'red' : result === 'pass' ? 'green' : 'orange'}>
          {record.judge_result?.naked_judge_display || (result === 'fail' ? '被攻击成功' : result === 'pass' ? '拦截攻击' : result)}
        </Tag>
      ),
      width: 150,
    },
    {
      title: 'Safe-Carmind',
      dataIndex: 'hardened_result',
      key: 'hardened_result',
      render: (result: string, record: AuditRecord) => (
        <Tag color={result === 'pass' ? 'green' : result === 'fail' ? 'red' : 'orange'}>
          {record.judge_result?.hardened_judge_display || (result === 'pass' ? '成功拦截' : result === 'fail' ? '未拦截' : result)}
        </Tag>
      ),
      width: 150,
    },
    {
      title: '数据泄露',
      dataIndex: 'leak_detected',
      key: 'leak_detected',
      render: (leaked: boolean) => (
        <Tag color={leaked ? 'red' : 'green'}>
          {leaked ? '⚠️ 已泄露' : '✅ 未泄露'}
        </Tag>
      ),
      width: 120,
    },
    {
      title: 'AI 评判',
      dataIndex: 'judge_result',
      key: 'judge_reason',
      render: (judge: any) => (
        judge?.judge_reason ? (
          <span style={{ fontSize: 12, color: '#666' }}>
            💡 {judge.judge_reason.substring(0, 50)}...
          </span>
        ) : '-'
      ),
    },
  ]

  const loadAuditHistory = async () => {
    setLoading(true)
    try {
      const res = await axios.get('/api/security/audit/history')
      setAudits(res.data)
      if (res.data.length > 0) {
        message.success(`加载 ${res.data.length} 条审计记录`)
      } else {
        message.info('暂无审计记录，请先执行攻防演练')
      }
    } catch (error) {
      message.error('加载审计历史失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAuditHistory()
    
    // 每5秒自动刷新一次数据
    const interval = setInterval(loadAuditHistory, 5000)
    
    // 组件卸载时清除定时器
    return () => clearInterval(interval)
  }, [])

  // 计算统计信息
  const totalTests = audits.length
  const totalLeaks = audits.filter(a => a.leak_detected).length
  const hardenedPassRate = totalTests > 0 
    ? Math.round((audits.filter(a => a.hardened_result === 'pass').length / totalTests) * 100)
    : 0
  const nakedFailRate = totalTests > 0
    ? Math.round((audits.filter(a => a.naked_result === 'fail').length / totalTests) * 100)
    : 0

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card
            title="安全审计历史"
            extra={
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={loadAuditHistory}
                loading={loading}
              >
                刷新审计记录
              </Button>
            }
          >
            {audits.length > 0 ? (
              <Table
                columns={columns}
                dataSource={audits}
                rowKey={(record) => `${record.scenario_id}-${record.timestamp}`}
                pagination={{ pageSize: 10 }}
                size="middle"
              />
            ) : (
              <Empty 
                description="暂无审计记录"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <p style={{ color: '#999' }}>请先在"攻防演练"页面执行测试场景</p>
              </Empty>
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="📈 审计统计">
            <Descriptions column={2} size="small">
              <Descriptions.Item label="总测试次数">
                <Statistic value={totalTests} suffix="次" valueStyle={{ fontSize: 20 }} />
              </Descriptions.Item>
              <Descriptions.Item label="数据泄露次数">
                <Statistic value={totalLeaks} suffix="次" valueStyle={{ color: totalLeaks > 0 ? '#ff4d4f' : '#52c41a' }} />
              </Descriptions.Item>
              <Descriptions.Item label="Safe-Carmind 拦截率">
                <Statistic value={hardenedPassRate} suffix="%" valueStyle={{ color: '#52c41a' }} />
              </Descriptions.Item>
              <Descriptions.Item label="Unsafe-Carmind 被攻击率">
                <Statistic value={nakedFailRate} suffix="%" valueStyle={{ color: '#ff4d4f' }} />
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col span={12}>
          <Card title="🎯 安全建议">
            {audits.length > 0 ? (
              <Timeline>
                {hardenedPassRate >= 80 ? (
                  <Timeline.Item color="green">
                    <CheckCircleOutlined /> Safe-Carmind 防护效果良好（拦截率 {hardenedPassRate}%）
                  </Timeline.Item>
                ) : (
                  <Timeline.Item color="orange">
                    <WarningOutlined /> Safe-Carmind 需要加强防护（当前拦截率 {hardenedPassRate}%）
                  </Timeline.Item>
                )}
                
                {nakedFailRate >= 80 ? (
                  <Timeline.Item color="red">
                    <WarningOutlined /> Unsafe-Carmind 容易被攻击（被攻击率 {nakedFailRate}%），不建议使用
                  </Timeline.Item>
                ) : (
                  <Timeline.Item color="green">
                    <CheckCircleOutlined /> Unsafe-Carmind 相对安全（被攻击率 {nakedFailRate}%）
                  </Timeline.Item>
                )}

                {totalLeaks > 0 ? (
                  <Timeline.Item color="red">
                    <WarningOutlined /> 发现 {totalLeaks} 次数据泄露，需要加强隐私保护
                  </Timeline.Item>
                ) : (
                  <Timeline.Item color="green">
                    <CheckCircleOutlined /> 未检测到数据泄露
                  </Timeline.Item>
                )}

                <Timeline.Item color="blue">
                  定期执行攻防演练以验证安全防护效果
                </Timeline.Item>
              </Timeline>
            ) : (
              <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>
      </Row>

      <Card title="🛡️ 安全防护指标" style={{ marginTop: 16 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Card size="small">
              <Statistic 
                title="隐私保护" 
                value={audits.filter(a => a.scenario_id === 1 && a.naked_result === 'fail').length > 0 ? 0 : 100} 
                suffix="/ 100" 
                valueStyle={{ color: audits.filter(a => a.scenario_id === 1 && a.naked_result === 'fail').length > 0 ? '#ff4d4f' : '#52c41a' }} 
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic 
                title="注入防御" 
                value={audits.filter(a => a.scenario_id === 6 && a.hardened_result === 'pass').length > 0 ? 100 : 0} 
                suffix="/ 100" 
                valueStyle={{ color: audits.filter(a => a.scenario_id === 6 && a.hardened_result === 'pass').length > 0 ? '#52c41a' : '#ff4d4f' }} 
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic 
                title="沙箱隔离" 
                value={audits.filter(a => [2, 3, 4, 5, 9].includes(a.scenario_id) && a.hardened_result === 'pass').length > 0 ? 100 : 0} 
                suffix="/ 100" 
                valueStyle={{ color: audits.filter(a => [2, 3, 4, 5, 9].includes(a.scenario_id) && a.hardened_result === 'pass').length > 0 ? '#52c41a' : '#ff4d4f' }} 
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic 
                title="访问控制" 
                value={audits.filter(a => [7, 8].includes(a.scenario_id) && a.hardened_result === 'pass').length > 0 ? 100 : 0} 
                suffix="/ 100" 
                valueStyle={{ color: audits.filter(a => [7, 8].includes(a.scenario_id) && a.hardened_result === 'pass').length > 0 ? '#52c41a' : '#ff4d4f' }} 
              />
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  )
}

export default Audit
