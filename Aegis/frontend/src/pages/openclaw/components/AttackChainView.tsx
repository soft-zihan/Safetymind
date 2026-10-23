import { useState } from 'react'
import { Card, Table, Tag, Tooltip, Collapse, Typography, Space, Badge, Divider, Alert, Input, Button, Switch, message } from 'antd'
import { SafetyOutlined, CheckCircleOutlined, CloseCircleOutlined, MinusCircleOutlined, RobotOutlined, EditOutlined, ReloadOutlined, SwapOutlined } from '@ant-design/icons'

const { Text } = Typography
const { TextArea } = Input
const { Panel } = Collapse

interface LayerResult {
  relevant: boolean
  status: 'blocked' | 'passed' | 'warned' | 'not_applicable'
  role: string
  evidence?: string
}

interface JudgeResult {
  naked_judge: string
  hardened_judge: string
  naked_judge_display: string
  hardened_judge_display: string
  judge_reason: string
  judge_raw_output: string
  ai_judged: boolean
}

interface StageResult {
  stage: number
  name: string
  prompt: string
  naked_response: string
  hardened_response: string
  naked_result: string
  hardened_result: string
  layers: Record<string, LayerResult>
  ai_judge?: JudgeResult
}

interface OverallJudgeResult {
  naked_judge: string
  hardened_judge: string
  naked_judge_display: string
  hardened_judge_display: string
  judge_reason: string
  judge_raw_output: string
  ai_judged: boolean
}

interface JudgeSummary {
  total_stages: number
  naked_leak_stages: number
  hardened_block_stages: number
  naked_final_result: string
  hardened_final_result: string
  overall_naked_result: string
  overall_hardened_result: string
  chain_broken: boolean
  attack_succeeded: boolean
}

interface AIJudgeData {
  stage_results: Array<{
    stage: number
    name: string
    judge_result: JudgeResult
  }>
  overall: OverallJudgeResult
  summary: JudgeSummary
  ai_judged: boolean
}

interface AttackChainData {
  scenario_id: number
  scenario_name: string
  attack_category: string
  total_stages: number
  stages: StageResult[]
  defense_layers: Record<string, any>
  ai_judge?: AIJudgeData
}

interface AttackChainViewProps {
  data: AttackChainData | null
  loading?: boolean
  defenseEnabled?: Record<string, boolean>
  onDataChange?: (updatedData: AttackChainData) => void
  onRetest?: (promptOverrides: Record<number, string>) => void
}

const LAYER_NAMES: Record<string, { name: string; icon: string }> = {
  L1_clawshell: { name: 'ClawShell 代理层', icon: '🔒' },
  L2_qise: { name: 'qise 守卫层', icon: '🛡️' },
  L3_openclaw: { name: 'OpenClaw 加固层', icon: '🦞' },
  L4_clawkeeper: { name: 'ClawKeeper 防护层', icon: '🔗' },
  L5_docker: { name: 'Docker 沙箱层', icon: '🐳' },
}

const getStatusColor = (status: string, enabled: boolean = true): string => {
  if (!enabled) return '#d9d9d9'
  switch (status) {
    case 'blocked': return '#52c41a'
    case 'passed': return '#ff4d4f'
    case 'warned': return '#faad14'
    case 'not_applicable': return '#d9d9d9'
    default: return '#d9d9d9'
  }
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'blocked': return <CheckCircleOutlined style={{ color: '#52c41a' }} />
    case 'passed': return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
    case 'warned': return <SafetyOutlined style={{ color: '#faad14' }} />
    default: return <MinusCircleOutlined style={{ color: '#d9d9d9' }} />
  }
}

const getStatusText = (status: string): string => {
  switch (status) {
    case 'blocked': return '拦截'
    case 'passed': return '通过'
    case 'warned': return '告警'
    default: return '-'
  }
}

function AttackChainView({ data, loading, defenseEnabled = {}, onDataChange, onRetest }: AttackChainViewProps) {
  // 本地编辑状态：{ stageNum: editedPrompt }
  const [editedPrompts, setEditedPrompts] = useState<Record<number, string>>({})
  const [retesting, setRetesting] = useState(false)

  if (!data || !data.stages || data.stages.length === 0) {
    return <Card loading={loading}>暂无攻击链数据</Card>
  }

  const layers = Object.keys(LAYER_NAMES)
  const stages = data.stages
  const aiJudge = data.ai_judge

  const hasPromptChanges = (): boolean => {
    for (const stage of stages) {
      const edited = editedPrompts[stage.stage]
      if (edited !== undefined && edited !== stage.prompt) {
        return true
      }
    }
    return false
  }

  // 手动切换某个阶段的裸奔/金刚结果
  const toggleStageResult = (stageNum: number, type: 'naked' | 'hardened') => {
    if (!onDataChange) return
    const newStages = stages.map(s => {
      if (s.stage !== stageNum) return s
      const updated = { ...s }
      if (type === 'naked') {
        updated.naked_result = s.naked_result === 'fail' ? 'pass' : 'fail'
      } else {
        updated.hardened_result = s.hardened_result === 'pass' ? 'fail' : 'pass'
      }
      return updated
    })
    onDataChange({ ...data, stages: newStages })
  }

  // 触发重新测试
  const handleRetest = async () => {
    if (!onRetest) return
    setRetesting(true)
    try {
      const promptOverrides: Record<number, string> = {}
      for (const stage of stages) {
        const edited = editedPrompts[stage.stage]
        if (edited !== undefined && edited !== stage.prompt) {
          promptOverrides[stage.stage] = edited
        }
      }
      await onRetest(promptOverrides)
      if (Object.keys(promptOverrides).length > 0) {
        message.success('已使用修改后的提示词重新测试')
      }
    } finally {
      setRetesting(false)
    }
  }

  // 渲染 AI 评判结果卡片
  const renderAIJudgeCard = () => {
    if (!aiJudge || !aiJudge.summary) return null

    const { summary, overall } = aiJudge
    const nakedColor = summary.overall_naked_result === 'leak' ? 'red' : summary.overall_naked_result === 'safe' ? 'green' : 'orange'
    const hardenedColor = summary.overall_hardened_result === 'blocked' ? 'green' : summary.overall_hardened_result === 'unblocked' ? 'red' : 'orange'

    return (
      <Card 
        title={
          <Space>
            <RobotOutlined />
            <span>AI 评判结果</span>
          </Space>
        }
        size="small"
        style={{ marginTop: 16, marginBottom: 16 }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 8 }}>
                <Tag color={nakedColor} style={{ fontSize: 14, padding: '4px 12px' }}>
                  Unsafe-Carmind: {overall.naked_judge_display}
                </Tag>
              </div>
              <div style={{ marginBottom: 8 }}>
                <Tag color={hardenedColor} style={{ fontSize: 14, padding: '4px 12px' }}>
                  Safe-Carmind: {overall.hardened_judge_display}
                </Tag>
              </div>
            </div>
          </div>

          <Divider style={{ margin: '8px 0' }} />

          {overall.judge_reason && (
            <Alert
              message="AI 评判分析"
              description={overall.judge_reason}
              type="info"
              showIcon
              style={{ fontSize: 13 }}
            />
          )}

          <Space wrap>
            <Badge count={summary.total_stages} style={{ backgroundColor: '#1890ff' }} title="总阶段数" />
            <span style={{ fontSize: 12, color: '#666' }}>总阶段数</span>
            <Badge count={summary.naked_leak_stages} style={{ backgroundColor: '#ff4d4f' }} title="裸奔泄露阶段" />
            <span style={{ fontSize: 12, color: '#666' }}>裸奔泄露</span>
            <Badge count={summary.hardened_block_stages} style={{ backgroundColor: '#52c41a' }} title="金刚拦截阶段" />
            <span style={{ fontSize: 12, color: '#666' }}>金刚拦截</span>
            {summary.chain_broken && (
              <Tag color="success" icon={<CheckCircleOutlined />}>攻击链已阻断</Tag>
            )}
            {summary.attack_succeeded && (
              <Tag color="error" icon={<CloseCircleOutlined />}>攻击成功</Tag>
            )}
          </Space>
        </Space>
      </Card>
    )
  }

  // 构建表格数据源
  const dataSource = layers.map((layerId) => {
    const layerInfo = LAYER_NAMES[layerId]
    const row: any = {
      key: layerId,
      layer: layerInfo.name,
      icon: layerInfo.icon,
    }

    stages.forEach((stage) => {
      const layerResult = stage.layers?.[layerId]
      if (layerResult && layerResult.relevant) {
        const isEnabled = defenseEnabled[layerId] !== false
        row[`stage_${stage.stage}`] = {
          status: isEnabled ? layerResult.status : 'passed',
          role: layerResult.role,
          evidence: layerResult.evidence,
          enabled: isEnabled,
        }
      } else {
        row[`stage_${stage.stage}`] = { status: 'not_applicable', role: '', enabled: true }
      }
    })

    return row
  })

  // 添加裸奔/金刚结果行（可点击切换）
  const nakedRow: any = { key: 'naked', layer: 'Unsafe-Carmind', icon: '🔓' }
  const hardenedRow: any = { key: 'hardened', layer: 'Safe-Carmind', icon: '🛡️' }
  
  stages.forEach((stage) => {
    nakedRow[`stage_${stage.stage}`] = {
      status: stage.naked_result === 'fail' ? 'passed' : 'blocked',
      role: stage.naked_result === 'fail' ? '全部沦陷' : '意外拦截',
      enabled: true,
      clickable: true,
      stageNum: stage.stage,
      toggleType: 'naked' as const,
    }
    hardenedRow[`stage_${stage.stage}`] = {
      status: stage.hardened_result === 'pass' ? 'blocked' : 'passed',
      role: stage.hardened_result === 'pass' ? '成功防御' : '防御失败',
      enabled: true,
      clickable: true,
      stageNum: stage.stage,
      toggleType: 'hardened' as const,
    }
  })

  dataSource.push(nakedRow, hardenedRow)

  // 构建表格列
  const columns = [
    {
      title: '防御层',
      dataIndex: 'layer',
      key: 'layer',
      width: 160,
      render: (text: string, record: any) => (
        <Space>
          <span>{record.icon}</span>
          <Text strong={record.key === 'naked' || record.key === 'hardened'}>{text}</Text>
        </Space>
      ),
    },
    ...stages.map((stage) => ({
      title: (
        <Tooltip title={stage.prompt.substring(0, 100) + '...'}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 'bold' }}>阶段 {stage.stage}</div>
            <div style={{ fontSize: 11, color: '#666' }}>{stage.name}</div>
          </div>
        </Tooltip>
      ),
      dataIndex: `stage_${stage.stage}`,
      key: `stage_${stage.stage}`,
      width: 120,
      align: 'center' as const,
      render: (cell: any) => {
        if (!cell) return '-'
        const { status, role, evidence, enabled, clickable, stageNum, toggleType } = cell
        const color = getStatusColor(status, enabled)
        
        const content = (
          <div style={{
            padding: '8px 4px',
            borderRadius: 4,
            background: `${color}20`,
            border: `1px solid ${color}40`,
            cursor: clickable ? 'pointer' : 'default',
            transition: 'all 0.2s',
          }}>
            {getStatusIcon(enabled ? status : 'passed')}
            <div style={{ fontSize: 11, marginTop: 2, color: enabled ? color : '#999' }}>
              {getStatusText(enabled ? status : 'passed')}
            </div>
          </div>
        )

        if (clickable && stageNum && toggleType) {
          return (
            <Tooltip title={
              <div>
                <div>{role}</div>
                <div style={{ marginTop: 4, fontSize: 11, color: '#aaa' }}>点击切换人工审查结果</div>
                {evidence && <div style={{ marginTop: 4, fontSize: 11 }}>{evidence.substring(0, 100)}...</div>}
              </div>
            }>
              <div onClick={() => toggleStageResult(stageNum, toggleType)}>
                {content}
              </div>
            </Tooltip>
          )
        }

        return (
          <Tooltip title={
            <div>
              <div>{role}</div>
              {evidence && <div style={{ marginTop: 4, fontSize: 11 }}>{evidence.substring(0, 100)}...</div>}
            </div>
          }>
            {content}
          </Tooltip>
        )
      },
    })),
  ]

  return (
    <Card 
      title={
        <Space>
          <SafetyOutlined />
          <span>攻击链可视化 — {data.scenario_name}</span>
          <Tag color="blue">{data.total_stages} 个阶段</Tag>
        </Space>
      }
      extra={
        <Space>
          {hasPromptChanges() && (
            <Tag color="orange" icon={<EditOutlined />}>提示词已修改</Tag>
          )}
          <Button
            type="primary"
            size="small"
            icon={<ReloadOutlined />}
            loading={retesting}
            onClick={handleRetest}
          >
            用修改的提示词重新测试
          </Button>
        </Space>
      }
      style={{ marginTop: 16 }}
    >
      {/* AI 评判结果 */}
      {renderAIJudgeCard()}

      <Table
        dataSource={dataSource}
        columns={columns}
        pagination={false}
        size="small"
        bordered
        rowClassName={(record) => {
          if (record.key === 'naked') return 'naked-row'
          if (record.key === 'hardened') return 'hardened-row'
          return ''
        }}
      />
      
      <Collapse style={{ marginTop: 16 }} ghost>
        <Panel header="查看详细响应内容、编辑提示词和 AI 评判" key="1">
          {stages.map((stage) => {
            const stageAIJudge = aiJudge?.stage_results?.find(s => s.stage === stage.stage)
            const currentPrompt = editedPrompts[stage.stage] !== undefined ? editedPrompts[stage.stage] : stage.prompt
            
            return (
            <Card key={stage.stage} size="small" title={`阶段 ${stage.stage}: ${stage.name}`} style={{ marginBottom: 12 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {/* 可编辑的攻击提示词 */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text type="secondary">
                      <EditOutlined style={{ marginRight: 4 }} />
                      攻击提示词（可编辑）：
                    </Text>
                    {editedPrompts[stage.stage] !== undefined && editedPrompts[stage.stage] !== stage.prompt && (
                      <Space>
                        <Tag color="orange" style={{ fontSize: 11 }}>已修改</Tag>
                        <Button
                          size="small"
                          type="link"
                          onClick={() => {
                            setEditedPrompts(prev => {
                              const next = { ...prev }
                              delete next[stage.stage]
                              return next
                            })
                          }}
                        >
                          还原
                        </Button>
                      </Space>
                    )}
                  </div>
                  <TextArea
                    rows={3}
                    value={currentPrompt}
                    onChange={(e) => {
                      setEditedPrompts(prev => ({
                        ...prev,
                        [stage.stage]: e.target.value,
                      }))
                    }}
                    style={{
                      fontFamily: 'monospace',
                      fontSize: 12,
                      background: editedPrompts[stage.stage] !== undefined && editedPrompts[stage.stage] !== stage.prompt
                        ? '#fffbe6' : '#f5f5f5',
                    }}
                  />
                </div>

                {/* 手工审查切换 */}
                <div style={{ display: 'flex', gap: 24, padding: '8px 12px', background: '#fafafa', borderRadius: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <SwapOutlined />
                    <Text style={{ fontSize: 12 }}>Unsafe-Carmind：</Text>
                    <Switch
                      size="small"
                      checked={stage.naked_result === 'pass'}
                      checkedChildren="拦截"
                      unCheckedChildren="泄露"
                      onChange={() => toggleStageResult(stage.stage, 'naked')}
                    />
                    <Tag color={stage.naked_result === 'fail' ? 'red' : 'green'} style={{ fontSize: 11 }}>
                      {stage.naked_result === 'fail' ? '泄露' : '意外拦截'}
                    </Tag>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <SwapOutlined />
                    <Text style={{ fontSize: 12 }}>Safe-Carmind：</Text>
                    <Switch
                      size="small"
                      checked={stage.hardened_result === 'pass'}
                      checkedChildren="拦截"
                      unCheckedChildren="失败"
                      onChange={() => toggleStageResult(stage.stage, 'hardened')}
                    />
                    <Tag color={stage.hardened_result === 'pass' ? 'green' : 'red'} style={{ fontSize: 11 }}>
                      {stage.hardened_result === 'pass' ? '成功拦截' : '防御失败'}
                    </Tag>
                  </div>
                </div>

                {/* AI 阶段评判 */}
                {stageAIJudge && stageAIJudge.judge_result && (
                  <Alert
                    message={
                      <Space>
                        <RobotOutlined />
                        <span>AI 评判</span>
                        <Tag color={stageAIJudge.judge_result.naked_judge === 'leak' ? 'red' : 'green'}>
                          裸奔: {stageAIJudge.judge_result.naked_judge_display}
                        </Tag>
                        <Tag color={stageAIJudge.judge_result.hardened_judge === 'blocked' ? 'green' : 'red'}>
                          金刚: {stageAIJudge.judge_result.hardened_judge_display}
                        </Tag>
                      </Space>
                    }
                    description={stageAIJudge.judge_result.judge_reason}
                    type="info"
                    showIcon
                    style={{ fontSize: 12 }}
                  />
                )}

                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <Text type="danger">Unsafe-Carmind：</Text>
                    <pre style={{ background: '#fff1f0', padding: 8, borderRadius: 4, fontSize: 12, marginTop: 4, maxHeight: 150, overflow: 'auto' }}>
                      {stage.naked_response}
                    </pre>
                  </div>
                  <div style={{ flex: 1 }}>
                    <Text type="success">Safe-Carmind：</Text>
                    <pre style={{ background: '#f6ffed', padding: 8, borderRadius: 4, fontSize: 12, marginTop: 4, maxHeight: 150, overflow: 'auto' }}>
                      {stage.hardened_response}
                    </pre>
                  </div>
                </div>
              </Space>
            </Card>
          )})}
        </Panel>
      </Collapse>

      <style>{`
        .naked-row { background: #fff1f0 !important; }
        .hardened-row { background: #f6ffed !important; }
        .naked-row td, .hardened-row td { font-weight: bold; }
      `}</style>
    </Card>
  )
}

export default AttackChainView