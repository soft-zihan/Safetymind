import { useState, useEffect } from 'react'
import { Row, Col, Card, Statistic, Progress, Tag, Space, Empty, Alert } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, WarningOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import axios from 'axios'
import '../Dashboard.css'

interface ScoreData {
  total_score: number
  categories: Record<string, any>
  recommendations: string[]
  tested_scenarios?: number
  passed_scenarios?: number
  failed_scenarios?: number
}

function Dashboard() {
  const [hardenedScore, setHardenedScore] = useState<ScoreData | null>(null)
  const [nakedScore, setNakedScore] = useState<ScoreData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchScores()
    
    // 每5秒自动刷新一次数据
    const interval = setInterval(fetchScores, 5000)
    
    // 组件卸载时清除定时器
    return () => clearInterval(interval)
  }, [])

  const fetchScores = async () => {
    try {
      const [hardenedRes, nakedRes] = await Promise.all([
        axios.get('/api/security/score', { params: { agent_id: 'hardened-lobster' } }),
        axios.get('/api/security/score', { params: { agent_id: 'naked-lobster' } }),
      ])
      setHardenedScore(hardenedRes.data)
      setNakedScore(nakedRes.data)
    } catch (error) {
      console.error('获取安全评分失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRadarOption = () => {
    if (!hardenedScore || !nakedScore) return {}
    
    const hardenedCategories = Object.values(hardenedScore.categories) as any[]
    const nakedCategories = Object.values(nakedScore.categories) as any[]
    
    if (hardenedCategories.length === 0 || nakedCategories.length === 0) {
      return {
        title: {
          text: '暂无测试数据',
          left: 'center',
          top: 'middle',
          textStyle: { color: '#999', fontSize: 16 }
        }
      }
    }

    return {
      title: {
        text: '安全评分雷达图',
        left: 'center',
        textStyle: { fontSize: 16, fontWeight: 'bold' }
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const cat = hardenedCategories[params.dataIndex]
          if (cat.total === 0) {
            return `${cat.name}<br/>未测试`
          }
          return `${cat.name}<br/>金刚龙虾: ${cat.score}分 (${cat.passed}/${cat.total})<br/>裸奔龙虾: ${nakedCategories[params.dataIndex].score}分`
        }
      },
      legend: {
        data: ['金刚龙虾', '裸奔龙虾'],
        bottom: 10,
        textStyle: { fontSize: 14 }
      },
      radar: {
        indicator: hardenedCategories.map((cat: any) => ({ 
          name: cat.name, 
          max: 100 
        })),
        radius: '65%',
        axisName: {
          fontSize: 12,
          color: '#333'
        },
        splitArea: {
          areaStyle: {
            color: ['#f8f9fa', '#fff']
          }
        }
      },
      series: [{
        type: 'radar',
        data: [
          {
            value: hardenedCategories.map((cat: any) => cat.total === 0 ? 0 : cat.score),
            name: '金刚龙虾',
            areaStyle: { 
              color: 'rgba(82, 196, 26, 0.25)',
              opacity: 0.8
            },
            lineStyle: { 
              color: '#52c41a',
              width: 2
            },
            itemStyle: { 
              color: '#52c41a',
              borderWidth: 2
            },
            symbol: 'circle',
            symbolSize: 6
          },
          {
            value: nakedCategories.map((cat: any) => cat.total === 0 ? 0 : cat.score),
            name: '裸奔龙虾',
            areaStyle: { 
              color: 'rgba(255, 77, 79, 0.25)',
              opacity: 0.8
            },
            lineStyle: { 
              color: '#ff4d4f',
              width: 2
            },
            itemStyle: { 
              color: '#ff4d4f',
              borderWidth: 2
            },
            symbol: 'circle',
            symbolSize: 6
          },
        ],
      }],
    }
  }

  const hasTestData = hardenedScore?.categories && Object.keys(hardenedScore.categories).length > 0

  return (
    <div>
      {!hasTestData && !loading && (
        <Alert
          message="暂无测试数据"
          description="请先在“攻防演练”页面执行测试场景，安全评分将基于真实测试结果自动计算"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card
            className="score-card"
            title={
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                <span>金刚龙虾（加固版）</span>
                <Tag color="success">安全评分: {hardenedScore?.total_score || 0}</Tag>
              </Space>
            }
            loading={loading}
            style={{ height: '100%' }}
          >
            {hasTestData ? (
              <>
                {/* 金属质感龙虾 */}
                <div className="lobster-container">
                  <img 
                    src="/金刚龙虾.png" 
                    alt="金刚龙虾" 
                    className="lobster-emoji lobster-metallic"
                    style={{ width: '180px', height: 'auto' }}
                  />
                </div>

                <Statistic 
                  title="安全评分" 
                  value={hardenedScore?.total_score || 0} 
                  suffix="/ 100" 
                />
                <Progress 
                  percent={hardenedScore?.total_score || 0} 
                  strokeColor="#52c41a" 
                  style={{ marginTop: 16 }} 
                />
                
                {hardenedScore?.tested_scenarios !== undefined && (
                  <div className="test-stats test-stats-pass" style={{ marginTop: 16 }}>
                    <span>已测试 {hardenedScore.tested_scenarios} 个场景，通过 {hardenedScore.passed_scenarios} 个</span>
                  </div>
                )}
                
                <div style={{ marginTop: 24 }}>
                  <h4>安全状态</h4>
                  {hardenedScore?.categories && Object.values(hardenedScore.categories).map((cat: any, idx) => (
                    <div key={idx} style={{ marginBottom: 8 }}>
                      <Tag color={cat.score >= 80 ? 'green' : cat.score >= 50 ? 'orange' : 'red'}>
                        {cat.name}
                      </Tag>
                      <span style={{ marginLeft: 8 }}>{cat.score}/100</span>
                      {cat.passed !== undefined && cat.total !== undefined && (
                        <span style={{ marginLeft: 8, fontSize: 12, color: '#999' }}>
                          ({cat.passed}/{cat.total})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="no-data-container">
                <Empty description="暂无测试数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </div>
            )}
          </Card>
        </Col>

        <Col span={12}>
          <Card
            className="score-card"
            title={
              <Space>
               <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                <span>裸奔龙虾（未加固版）</span>
                <Tag color="error">安全评分: {nakedScore?.total_score || 0}</Tag>
              </Space>
            }
            loading={loading}
            style={{ height: '100%' }}
          >
            {hasTestData ? (
              <>
                {/* 裸奔龙虾 */}
                <div className="lobster-container">
                  <div className="lobster-emoji lobster-naked">
                    🦞
                  </div>
                </div>

                <Statistic 
                  title="安全评分" 
                  value={nakedScore?.total_score || 0} 
                  suffix="/ 100" 
                />
                <Progress 
                  percent={nakedScore?.total_score || 0} 
                  strokeColor={nakedScore && nakedScore.total_score < 50 ? '#ff4d4f' : '#faad14'} 
                  style={{ marginTop: 16 }} 
                />
                
                {nakedScore?.tested_scenarios !== undefined && (
                  <div className="test-stats test-stats-fail" style={{ marginTop: 16 }}>
                    <span>已测试 {nakedScore.tested_scenarios} 个场景，被攻击 {nakedScore.failed_scenarios} 个</span>
                  </div>
                )}
                
                <div style={{ marginTop: 24 }}>
                  <h4>风险项</h4>
                  {nakedScore?.categories && Object.values(nakedScore.categories).map((cat: any, idx) => (
                    <div key={idx} style={{ marginBottom: 8 }}>
                      <Tag color={cat.score >= 80 ? 'green' : cat.score >= 50 ? 'orange' : 'red'}>
                        {cat.name}
                      </Tag>
                      <span style={{ marginLeft: 8 }}>{cat.score}/100</span>
                      {cat.failed !== undefined && cat.total !== undefined && (
                        <span style={{ marginLeft: 8, fontSize: 12, color: '#999' }}>
                          ({cat.failed}/{cat.total} 被攻击成功)
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="no-data-container">
                <Empty description="暂无测试数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 16 }}>
        <ReactECharts option={getRadarOption()} style={{ height: 400 }} />
      </Card>

      {hardenedScore?.recommendations && hardenedScore.recommendations.length > 0 && (
        <Card title="💡 安全建议" style={{ marginTop: 16 }}>
          {hardenedScore.recommendations.map((rec, idx) => (
            <div key={idx} style={{ marginBottom: 8 }}>
              <WarningOutlined style={{ color: '#faad14', marginRight: 8 }} />
              {rec}
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

export default Dashboard
