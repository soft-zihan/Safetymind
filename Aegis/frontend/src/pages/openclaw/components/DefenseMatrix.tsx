import { useState, useEffect } from 'react'
import { Card, Table, Tag, Space, Typography, Empty } from 'antd'
import { HeatMapOutlined } from '@ant-design/icons'
import axios from 'axios'

const { Text } = Typography

const LAYER_NAMES: Record<string, { name: string; icon: string }> = {
  L1_clawshell: { name: 'ClawShell', icon: '🔒' },
  L2_qise: { name: 'qise', icon: '🛡️' },
  L3_openclaw: { name: 'OpenClaw', icon: '🦞' },
  L4_clawkeeper: { name: 'ClawKeeper', icon: '🔗' },
  L5_docker: { name: 'Docker', icon: '🐳' },
}

const RISK_COLORS: Record<string, string> = {
  critical: 'red',
  high: 'orange',
  medium: 'gold',
  low: 'blue',
}

interface MatrixRow {
  scenario_id: number
  scenario_name: string
  risk_level: string
  attack_category: string
  layers: Record<string, { relevant: boolean; role: string }>
}

interface DefenseMatrixData {
  scenarios: Array<{ id: number; name: string; risk_level: string; attack_category: string }>
  layers: string[]
  matrix: MatrixRow[]
}

interface DefenseMatrixProps {
  onScenarioClick?: (scenarioId: number) => void
}

function DefenseMatrix({ onScenarioClick }: DefenseMatrixProps) {
  const [data, setData] = useState<DefenseMatrixData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMatrix()
  }, [])

  const fetchMatrix = async () => {
    setLoading(true)
    try {
      const res = await axios.get('/api/demos/defense-matrix')
      setData(res.data)
    } catch (error) {
      console.error('获取防御矩阵失败:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <Card loading={loading} />
  }

  if (!data || !data.matrix) {
    return <Empty description="暂无防御矩阵数据" />
  }

  // 按 attack_category 分组
  const categories: Record<string, MatrixRow[]> = {}
  data.matrix.forEach((row) => {
    const cat = row.attack_category || 'unknown'
    if (!categories[cat]) categories[cat] = []
    categories[cat].push(row)
  })

  const CATEGORY_NAMES: Record<string, string> = {
    data_leakage: '数据泄露',
    command_injection: '命令注入',
    privilege_escalation: '权限提升',
    exfiltration: '数据外泄',
    credential_theft: '凭据窃取',
    social_engineering: '社工攻击',
    sandbox_escape: '沙箱逃逸',
    resource_abuse: '资源滥用',
    supply_chain: '供应链攻击',
    prompt_injection: '提示注入',
    unknown: '其他',
  }

  // 构建表格列
  const columns = [
    {
      title: '场景',
      dataIndex: 'scenario_name',
      key: 'scenario_name',
      width: 200,
      render: (text: string, record: MatrixRow) => (
        <Space>
          <a onClick={() => onScenarioClick?.(record.scenario_id)}>
            {text}
          </a>
          <Tag color={RISK_COLORS[record.risk_level]} style={{ fontSize: 11 }}>
            {record.risk_level}
          </Tag>
        </Space>
      ),
    },
    ...Object.entries(LAYER_NAMES).map(([layerId, layerInfo]) => ({
      title: (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16 }}>{layerInfo.icon}</div>
          <div style={{ fontSize: 11 }}>{layerInfo.name}</div>
        </div>
      ),
      dataIndex: ['layers', layerId],
      key: layerId,
      width: 100,
      align: 'center' as const,
      render: (cell: any) => {
        if (!cell) return '-'
        if (!cell.relevant) {
          return <span style={{ color: '#d9d9d9' }}>—</span>
        }
        return (
          <Tag color="green" style={{ fontSize: 11 }}>
            ✓ 相关
          </Tag>
        )
      },
    })),
  ]

  // 计算每层的覆盖率
  const layerCoverage = Object.keys(LAYER_NAMES).map((layerId) => {
    const count = data.matrix.filter((row) => row.layers[layerId]?.relevant).length
    const total = data.matrix.length
    return {
      layerId,
      name: LAYER_NAMES[layerId].name,
      count,
      total,
      rate: total > 0 ? Math.round((count / total) * 100) : 0,
    }
  })

  return (
    <Card
      title={
        <Space>
          <HeatMapOutlined />
          <span>防御矩阵</span>
          <Tag color="blue">{data.scenarios.length} 个场景</Tag>
        </Space>
      }
    >
      {/* 覆盖率统计 */}
      <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fafafa', borderRadius: 8 }}>
        <Text strong>各层覆盖率：</Text>
        <Space wrap style={{ marginTop: 8 }}>
          {layerCoverage.map((lc) => (
            <Tag key={lc.layerId} color="blue">
              {LAYER_NAMES[lc.layerId].icon} {lc.name}: {lc.count}/{lc.total} ({lc.rate}%)
            </Tag>
          ))}
        </Space>
      </div>

      {/* 按攻击类别分组显示 */}
      {Object.entries(categories).map(([category, rows]) => (
        <div key={category} style={{ marginBottom: 24 }}>
          <Text strong style={{ fontSize: 14, marginBottom: 8, display: 'block' }}>
            {CATEGORY_NAMES[category] || category}
          </Text>
          <Table
            dataSource={rows}
            columns={columns}
            pagination={false}
            size="small"
            bordered
            rowKey="scenario_id"
          />
        </div>
      ))}
    </Card>
  )
}

export default DefenseMatrix
