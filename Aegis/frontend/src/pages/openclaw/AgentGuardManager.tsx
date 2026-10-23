import { useState, useEffect, useCallback } from 'react'
import ReactECharts from 'echarts-for-react'
import {
  Card, Row, Col, Tag, Button, Space, Tabs, Table, Statistic,
  message, Spin, Descriptions, Typography, Select, Timeline, Alert, Divider,
} from 'antd'
import {
  SafetyOutlined, CheckCircleOutlined, WarningOutlined,
  ReloadOutlined, CloudServerOutlined, EyeOutlined,
  ToolOutlined, AppstoreOutlined, ApiOutlined, ThunderboltOutlined,
  StopOutlined, CheckCircleFilled, CloseCircleFilled, AuditOutlined,
  RobotOutlined, SearchOutlined,
} from '@ant-design/icons'

const { Text, Paragraph } = Typography

// ====== 类型定义（与 AgentGuard 服务器真实返回结构对齐）======
interface HealthData {
  status?: string
  service?: string
  rules?: number
  rule_version?: string
  mode?: string
  [key: string]: any
}

interface StatsData {
  total_requests?: number
  deny_count?: number
  deny_rate?: number
  agents?: number
  agent_ids?: string[]
  rules?: number
  rule_version?: string
  sessions?: number
  [key: string]: any
}

interface RuleItem {
  id?: string
  name?: string
  rule_id?: string
  severity?: string
  category?: string
  action?: string
  tool_pattern?: string
  reason?: string
  [key: string]: any
}

// 流量记录：ts 为 Unix 秒时间戳，agent 为 agent_id，action 为决策
interface TrafficItem {
  ts?: number
  agent?: string
  session?: string
  action?: string
  tool?: string
  reason?: string
  rules?: string[]
  latency_ms?: number
  [key: string]: any
}

// 审计记录：嵌套 event / decision / runtime_state 结构
interface AuditItem {
  event?: {
    ts_ms?: number
    event_type?: string
    principal?: { agent_id?: string; session_id?: string; user_id?: string }
    tool_call?: { tool_name?: string; args?: Record<string, any> }
  }
  decision?: {
    action?: string
    reason?: string
    matched_rules?: string[]
    policy_id?: string
  }
  [key: string]: any
}

interface ApprovalItem {
  ticket_id?: string
  created_ms?: number
  status?: string
  event?: { principal?: { agent_id?: string }; tool_call?: { tool_name?: string } }
  decision?: { action?: string; reason?: string }
  note?: string
  [key: string]: any
}

interface ToolItem {
  name?: string
  owner_agent_id?: string
  labels?: { boundary?: string; sensitivity?: string; integrity?: string; tags?: string[] }
  input_params?: string[]
  [key: string]: any
}

interface SkillItem {
  name?: string
  skill_unique_id?: string
  agent_id?: string
  owner_agent_id?: string
  detect_result?: { verdict?: string; risk_level?: string } | null
  [key: string]: any
}

interface McpItem {
  name?: string
  mcp_unique_id?: string
  unique_id?: string
  agent_id?: string
  owner_agent_id?: string
  detect_result?: { verdict?: string; risk_level?: string } | null
  [key: string]: any
}

// 一键演示结果
interface DemoStep {
  step: number             // 序号
  title: string            // 中文标题
  story: string            // 剧情（攻击者视角）
  checkpoint: string       // 设卡位置（中文）
  detection: string        // 检测原理（怎么识破的）
  how: string              // 一句话总结
  phase: string            // llm_before / llm_after / tool_before / tool_after
  event_type: string
  subject: string
  detail: any
  decision: string         // 英文决策（内部）
  decision_cn: string      // 中文决策
  reason: string
  matched_rules: string[]
  signals?: string[]
  signals_cn?: string[]
  policy_id?: string
  policy_version?: string
  latency_ms?: number
}

interface DemoResult {
  ok: boolean
  session_id?: string
  agent_id?: string
  scenario?: { title: string; intro: string }
  steps: DemoStep[]
  phases?: Record<string, number>
  summary?: { total: number; allowed: number; denied: number; reviewed?: number }
}

// ====== 防护相位（4 道关卡）======
const phaseLabel: Record<string, string> = {
  llm_before: '大模型调用前',
  llm_after: '大模型调用后',
  tool_before: '工具调用前',
  tool_after: '工具调用后',
}

const phaseColor: Record<string, string> = {
  llm_before: 'geekblue',
  llm_after: 'cyan',
  tool_before: 'purple',
  tool_after: 'magenta',
}

// 中文决策 → 颜色
const decisionCnColor: Record<string, string> = {
  '放行': 'green',
  '拦截': 'red',
  '转人工审批': 'orange',
  '远程复核': 'gold',
  '降级执行': 'purple',
  '脱敏后放行': 'cyan',
}

// ====== 严重程度颜色映射 ======
const severityColor: Record<string, string> = {
  critical: 'red',
  high: 'orange',
  medium: 'gold',
  low: 'blue',
  info: 'default',
}

const policyColor: Record<string, string> = {
  ALLOW: 'green',
  DENY: 'red',
  WARN: 'orange',
  LOG: 'blue',
}

const decisionColor: Record<string, string> = {
  allow: 'green',
  deny: 'red',
  warn: 'orange',
  log: 'blue',
  human_check: 'orange',
  require_approval: 'orange',
  require_remote_review: 'gold',
  degrade: 'purple',
  sanitize: 'cyan',
  log_only: 'blue',
}

// ====== 主组件 ======
export default function AgentGuardManager() {
  const [loading, setLoading] = useState(true)
  const [health, setHealth] = useState<HealthData | null>(null)
  const [stats, setStats] = useState<StatsData | null>(null)
  const [rules, setRules] = useState<RuleItem[]>([])
  const [traffic, setTraffic] = useState<TrafficItem[]>([])
  const [audit, setAudit] = useState<AuditItem[]>([])
  const [approvals, setApprovals] = useState<ApprovalItem[]>([])
  const [tools, setTools] = useState<ToolItem[]>([])
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [mcps, setMcps] = useState<McpItem[]>([])
  const [selectedAgent, setSelectedAgent] = useState<string>('')
  const [agentStats, setAgentStats] = useState<any>(null)
  const [agentTraffic, setAgentTraffic] = useState<TrafficItem[]>([])

  // 一键演示状态
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoResult, setDemoResult] = useState<DemoResult | null>(null)

  // 扫描同步状态
  const [syncLoading, setSyncLoading] = useState(false)

  // 加载所有数据
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [healthRes, statsRes, rulesRes, trafficRes, auditRes, approvalsRes, toolsRes, skillsRes, mcpsRes] = await Promise.all([
        fetch('/api/openclaw/agentguard/status'),
        fetch('/api/openclaw/agentguard/stats'),
        fetch('/api/openclaw/agentguard/rules'),
        fetch('/api/openclaw/agentguard/traffic'),
        fetch('/api/openclaw/agentguard/audit'),
        fetch('/api/openclaw/agentguard/approvals'),
        fetch('/api/openclaw/agentguard/tools'),
        fetch('/api/openclaw/agentguard/skills'),
        fetch('/api/openclaw/agentguard/mcps'),
      ])

      if (healthRes.ok) setHealth(await healthRes.json())
      else setHealth(null)

      if (statsRes.ok) setStats(await statsRes.json())
      if (rulesRes.ok) setRules(await rulesRes.json())
      if (trafficRes.ok) setTraffic(await trafficRes.json())
      if (auditRes.ok) setAudit(await auditRes.json())
      if (approvalsRes.ok) setApprovals(await approvalsRes.json())
      if (toolsRes.ok) setTools(await toolsRes.json())
      if (skillsRes.ok) setSkills(await skillsRes.json())
      if (mcpsRes.ok) setMcps(await mcpsRes.json())
    } catch (err: any) {
      message.error(`加载 AgentGuard 数据失败: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 一键演示：调用后端 demo/run，模拟安全龙虾工具调用并展示实时决策
  const runDemo = async () => {
    setDemoLoading(true)
    setDemoResult(null)
    try {
      const res = await fetch('/api/openclaw/agentguard/demo/run', { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        message.error(`演示失败: ${err.detail || res.statusText}`)
        return
      }
      const data: DemoResult = await res.json()
      setDemoResult(data)
      message.success(`演示完成：${data.summary?.allowed ?? 0} 放行 / ${data.summary?.denied ?? 0} 拦截 / ${data.summary?.reviewed ?? 0} 送审`)
      loadData()  // 刷新流量/审计数据
    } catch (err: any) {
      message.error(`演示失败: ${err.message}`)
    } finally {
      setDemoLoading(false)
    }
  }

  // 扫描同步：扫描 OpenClaw-hardened 真实配置并同步到 AgentGuard
  const syncInventory = async () => {
    setSyncLoading(true)
    try {
      const res = await fetch('/api/openclaw/agentguard/inventory/sync', { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        message.error(`扫描同步失败: ${err.detail || res.statusText}`)
        return
      }
      const data = await res.json()
      const { inventory } = data
      message.success(`扫描同步完成：${inventory.tools} 工具 / ${inventory.skills} Skill / ${inventory.plugins} 插件`)
      loadData()  // 刷新数据
    } catch (err: any) {
      message.error(`扫描同步失败: ${err.message}`)
    } finally {
      setSyncLoading(false)
    }
  }

  // 加载 Agent 详情
  const loadAgentDetail = async (agentId: string) => {
    if (!agentId) return
    setSelectedAgent(agentId)
    try {
      const [statsRes, trafficRes] = await Promise.all([
        fetch(`/api/openclaw/agentguard/agents/${agentId}/stats`),
        fetch(`/api/openclaw/agentguard/agents/${agentId}/traffic`),
      ])
      if (statsRes.ok) setAgentStats(await statsRes.json())
      else setAgentStats(null)
      if (trafficRes.ok) setAgentTraffic(await trafficRes.json())
      else setAgentTraffic([])
    } catch {
      setAgentStats(null)
      setAgentTraffic([])
    }
  }

  if (loading) {
    return <div style={{ padding: 40 }}><Spin size="large" tip="加载 AgentGuard 数据..." /></div>
  }

  const isConnected = health?.status === 'ok'

  // ====== 表格列定义（对齐 AgentGuard 真实返回字段）======
  const ruleColumns = [
    { title: '规则 ID', dataIndex: 'rule_id', key: 'rule_id', width: 200, ellipsis: true,
      render: (v: string, r: RuleItem) => v || r.id || r.name },
    { title: '严重程度', dataIndex: 'severity', key: 'severity', width: 100,
      render: (v: string) => <Tag color={severityColor[v] || 'default'}>{v?.toUpperCase() || '-'}</Tag> },
    { title: '类别', dataIndex: 'category', key: 'category', width: 140 },
    { title: '动作', dataIndex: 'action', key: 'action', width: 90,
      render: (v: string) => <Tag color={policyColor[v] || 'default'}>{v || '-'}</Tag> },
    { title: '目标工具', dataIndex: 'tool_pattern', key: 'tool_pattern', width: 140,
      render: (v: string) => <Text code>{v || '-'}</Text> },
    { title: '说明', dataIndex: 'reason', key: 'reason', ellipsis: true },
  ]

  const trafficColumns = [
    { title: '时间', dataIndex: 'ts', key: 'ts', width: 170,
      render: (v: number) => v ? new Date(v * 1000).toLocaleString() : '-' },
    { title: 'Agent', dataIndex: 'agent', key: 'agent', width: 140, ellipsis: true },
    { title: '工具/事件', dataIndex: 'tool', key: 'tool', width: 140,
      render: (v: string) => <Text code>{v || '-'}</Text> },
    { title: '决策', dataIndex: 'action', key: 'action', width: 110,
      render: (v: string) => <Tag color={decisionColor[v] || 'default'}>{v?.toUpperCase() || '-'}</Tag> },
    { title: '命中规则', dataIndex: 'rules', key: 'rules', width: 180, ellipsis: true,
      render: (v: string[]) => (v && v.length > 0 && v[0] !== 'server:no_final_plugin')
        ? v.map(r => <Tag key={r} color="blue">{r}</Tag>) : <Text type="secondary">-</Text> },
    { title: '原因', dataIndex: 'reason', key: 'reason', ellipsis: true },
  ]

  const auditColumns = [
    { title: '时间', key: 'ts', width: 170,
      render: (_: any, r: AuditItem) => r.event?.ts_ms ? new Date(r.event.ts_ms).toLocaleString() : '-' },
    { title: 'Agent', key: 'agent', width: 140, ellipsis: true,
      render: (_: any, r: AuditItem) => r.event?.principal?.agent_id || '-' },
    { title: '事件', key: 'event_type', width: 120,
      render: (_: any, r: AuditItem) => <Text code>{r.event?.event_type || '-'}</Text> },
    { title: '工具', key: 'tool', width: 140,
      render: (_: any, r: AuditItem) => r.event?.tool_call?.tool_name || '-' },
    { title: '决策', key: 'action', width: 110,
      render: (_: any, r: AuditItem) => <Tag color={decisionColor[r.decision?.action || ''] || 'default'}>{r.decision?.action?.toUpperCase() || '-'}</Tag> },
    { title: '原因', key: 'reason', ellipsis: true,
      render: (_: any, r: AuditItem) => r.decision?.reason || '-' },
  ]

  const approvalColumns = [
    { title: '工单 ID', dataIndex: 'ticket_id', key: 'ticket_id', width: 150, ellipsis: true },
    { title: 'Agent', key: 'agent', width: 140, ellipsis: true,
      render: (_: any, r: ApprovalItem) => r.event?.principal?.agent_id || '-' },
    { title: '工具', key: 'tool', width: 140,
      render: (_: any, r: ApprovalItem) => r.event?.tool_call?.tool_name || '-' },
    { title: '原因', key: 'reason', ellipsis: true,
      render: (_: any, r: ApprovalItem) => r.decision?.reason || r.note || '-' },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (v: string) => <Tag color={v === 'pending' ? 'orange' : v === 'approved' ? 'green' : 'red'}>{v}</Tag> },
    { title: '创建时间', dataIndex: 'created_ms', key: 'created_ms', width: 170,
      render: (v: number) => v ? new Date(v).toLocaleString() : '-' },
  ]

  const toolColumns = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 160,
      render: (v: string) => <Text code>{v}</Text> },
    { title: 'Agent', dataIndex: 'owner_agent_id', key: 'owner_agent_id', width: 150, ellipsis: true },
    { title: '边界', key: 'boundary', width: 100,
      render: (_: any, r: ToolItem) => <Tag>{r.labels?.boundary || 'internal'}</Tag> },
    { title: '敏感度', key: 'sensitivity', width: 100,
      render: (_: any, r: ToolItem) => <Tag color={severityColor[r.labels?.sensitivity || ''] || 'default'}>{r.labels?.sensitivity || 'low'}</Tag> },
    { title: '参数', dataIndex: 'input_params', key: 'input_params', ellipsis: true,
      render: (v: string[]) => v?.join(', ') || '-' },
  ]

  const skillColumns = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 160 },
    { title: '唯一 ID', dataIndex: 'skill_unique_id', key: 'skill_unique_id', width: 220, ellipsis: true },
    { title: 'Agent', key: 'agent', width: 140, ellipsis: true,
      render: (_: any, r: SkillItem) => r.agent_id || r.owner_agent_id || '-' },
    { title: '检测结果', key: 'verdict', width: 110,
      render: (_: any, r: SkillItem) => {
        const verdict = r.detect_result?.verdict
        if (!verdict) return <Tag>未检测</Tag>
        return <Tag color={verdict === 'clean' ? 'green' : verdict === 'risky' ? 'red' : 'orange'}>{verdict}</Tag>
      } },
  ]

  const mcpColumns = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 160 },
    { title: '唯一 ID', key: 'unique_id', width: 220, ellipsis: true,
      render: (_: any, r: McpItem) => r.mcp_unique_id || r.unique_id || '-' },
    { title: 'Agent', key: 'agent', width: 140, ellipsis: true,
      render: (_: any, r: McpItem) => r.agent_id || r.owner_agent_id || '-' },
    { title: '检测结果', key: 'verdict', width: 110,
      render: (_: any, r: McpItem) => {
        const verdict = r.detect_result?.verdict
        if (!verdict) return <Tag>未检测</Tag>
        return <Tag color={verdict === 'clean' ? 'green' : verdict === 'risky' ? 'red' : 'orange'}>{verdict}</Tag>
      } },
  ]

  // Agent 列表：优先用后端聚合的 agent_ids，否则从 traffic/tools 提取
  const agentIds: string[] = stats?.agent_ids?.length
    ? stats.agent_ids
    : [...new Set([
        ...traffic.map(t => t.agent).filter(Boolean),
        ...tools.map(t => t.owner_agent_id).filter(Boolean),
      ])] as string[]

  // ====== 监控机制流程图（ECharts graph）======
  // 说明 AgentGuard 如何通过 OpenClaw 钩子（hooks）在 4 个节点拦截：
  //   before_agent_run → 输入门（llm_before）
  //   message_sending  → 输出门（llm_after）
  //   before_tool_call → 执行前门（tool_before）
  //   after_tool_call  → 返回后门（tool_after）
  const monitorFlowOption = {
    tooltip: { show: true },
    animationDuration: 800,
    series: [{
      type: 'graph',
      layout: 'none',
      roam: false,
      label: { show: true, fontSize: 12, color: '#222' },
      edgeLabel: { show: true, fontSize: 10, color: '#666', formatter: (p: any) => p.data.label || '' },
      edgeSymbol: ['none', 'arrow'],
      edgeSymbolSize: 8,
      lineStyle: { color: '#999', width: 1.5, curveness: 0.1 },
      emphasis: { focus: 'adjacency', lineStyle: { width: 3 } },
      data: [
        // Agent 循环主链（横向）
        { name: '用户输入', x: 60, y: 120, symbolSize: 52, itemStyle: { color: '#e6f4ff' }, category: 0 },
        { name: '大模型\n(LLM)', x: 220, y: 120, symbolSize: 60, itemStyle: { color: '#f0f5ff' }, category: 0 },
        { name: '工具调用\nJSON', x: 380, y: 120, symbolSize: 52, itemStyle: { color: '#fff7e6' }, category: 0 },
        { name: '工具执行', x: 540, y: 120, symbolSize: 56, itemStyle: { color: '#fff1f0' }, category: 0 },
        { name: '工具返回', x: 700, y: 120, symbolSize: 52, itemStyle: { color: '#fff7e6' }, category: 0 },
        // 4 道钩子关卡（下方）
        { name: '① 输入门\nbefore_agent_run', x: 140, y: 260, symbolSize: 64, itemStyle: { color: '#bae0ff' }, category: 1 },
        { name: '② 输出门\nmessage_sending', x: 300, y: 260, symbolSize: 64, itemStyle: { color: '#adc6ff' }, category: 1 },
        { name: '③ 执行前门\nbefore_tool_call', x: 460, y: 260, symbolSize: 64, itemStyle: { color: '#d3adf7' }, category: 1 },
        { name: '④ 返回后门\nafter_tool_call', x: 620, y: 260, symbolSize: 64, itemStyle: { color: '#ffadd2' }, category: 1 },
        // 控制服务器（底部中央）
        { name: 'AgentGuard 控制服务器\n规则引擎 · 轨迹库 · 审批队列', x: 380, y: 400, symbolSize: 90, itemStyle: { color: '#b7eb8f' }, category: 2 },
      ],
      links: [
        // 主链
        { source: '用户输入', target: '大模型\n(LLM)', label: '提示词' },
        { source: '大模型\n(LLM)', target: '工具调用\nJSON', label: '输出' },
        { source: '工具调用\nJSON', target: '工具执行', label: '解析执行' },
        { source: '工具执行', target: '工具返回', label: '结果' },
        // 回填循环
        { source: '工具返回', target: '大模型\n(LLM)', label: '回填', lineStyle: { curveness: 0.4, type: 'dashed' } },
        // 钩子 → 关卡
        { source: '用户输入', target: '① 输入门\nbefore_agent_run', label: '钩子' },
        { source: '大模型\n(LLM)', target: '② 输出门\nmessage_sending', label: '钩子' },
        { source: '工具执行', target: '③ 执行前门\nbefore_tool_call', label: '钩子' },
        { source: '工具返回', target: '④ 返回后门\nafter_tool_call', label: '钩子' },
        // 关卡 → 控制服务器
        { source: '① 输入门\nbefore_agent_run', target: 'AgentGuard 控制服务器\n规则引擎 · 轨迹库 · 审批队列', label: '送检' },
        { source: '② 输出门\nmessage_sending', target: 'AgentGuard 控制服务器\n规则引擎 · 轨迹库 · 审批队列', label: '送检' },
        { source: '③ 执行前门\nbefore_tool_call', target: 'AgentGuard 控制服务器\n规则引擎 · 轨迹库 · 审批队列', label: '送检' },
        { source: '④ 返回后门\nafter_tool_call', target: 'AgentGuard 控制服务器\n规则引擎 · 轨迹库 · 审批队列', label: '送检' },
      ],
      categories: [
        { name: 'Agent 循环' },
        { name: 'AgentGuard 钩子关卡' },
        { name: '控制服务器' },
      ],
    }],
  }

  // 4 道关卡的监测内容说明
  const checkpointCards = [
    {
      title: '① 输入门', hook: 'before_agent_run', phase: 'llm_before', color: '#bae0ff',
      watch: ['提示词注入话术（"忽略之前所有指令"）', '越狱/角色扮演诱导', '回填的工具结果是否被投毒'],
    },
    {
      title: '② 输出门', hook: 'message_sending', phase: 'llm_after', color: '#adc6ff',
      watch: ['模型输出中的密钥/隐私（sk-、AKIA…）', '系统提示词泄露', '模型想执行的工具调用指令'],
    },
    {
      title: '③ 执行前门', hook: 'before_tool_call', phase: 'tool_before', color: '#d3adf7',
      watch: ['工具参数（收件人/URL/命令）', '白名单 & 信任等级', '多步轨迹：读机密→外发'],
    },
    {
      title: '④ 返回后门', hook: 'after_tool_call', phase: 'tool_after', color: '#ffadd2',
      watch: ['工具返回值中的伪造指令', '返回内容是否含敏感数据', '结果是否诱导下一步危险动作'],
    },
  ]

  // ====== 一键演示结果面板（攻击故事线）======
  // 决策 → 图标/颜色
  const decisionIcon = (d: string) =>
    d === '放行' ? <CheckCircleFilled style={{ color: '#52c41a', fontSize: 18 }} />
    : d === '拦截' ? <CloseCircleFilled style={{ color: '#ff4d4f', fontSize: 18 }} />
    : <AuditOutlined style={{ color: '#faad14', fontSize: 18 }} />

  const demoPanel = demoResult && (
    <Card
      title={<><ThunderboltOutlined /> 一键演示：{demoResult.scenario?.title || '数据外泄攻击链'}</>}
      size="small"
      style={{ marginBottom: 16 }}
      extra={demoResult.session_id && <Text type="secondary" copyable style={{ fontSize: 11 }}>{demoResult.session_id}</Text>}
    >
      {/* 场景背景 */}
      {demoResult.scenario?.intro && (
        <Alert
          type="info"
          showIcon
          icon={<RobotOutlined />}
          message="演示背景"
          description={demoResult.scenario.intro}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 4 道关卡示意（按真实 Agent 循环顺序）*/}
      <div style={{ marginBottom: 16, textAlign: 'center' }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          沿着 Agent 的执行循环（输入 → 大模型 → 工具调用 JSON → 工具执行 → 结果回填），AgentGuard 设了 4 道关卡：
        </Text>
        <Space size={4} wrap>
          {([
            ['llm_before', '① 输入门'],
            ['llm_after', '② 输出门'],
            ['tool_before', '③ 执行前门'],
            ['tool_after', '④ 返回后门'],
          ] as const).map(([p, gate], i) => (
            <span key={p} style={{ display: 'inline-flex', alignItems: 'center' }}>
              {i > 0 && <span style={{ color: '#bbb', margin: '0 6px' }}>→</span>}
              <Tag color={phaseColor[p]} style={{ padding: '4px 10px', fontSize: 13 }}>
                🛡 {gate} · {phaseLabel[p]}
              </Tag>
            </span>
          ))}
        </Space>
      </div>

      {/* 攻击故事时间线 */}
      <Timeline
        items={demoResult.steps.map(s => {
          const blocked = s.decision_cn === '拦截'
          const reviewed = s.decision_cn === '转人工审批' || s.decision_cn === '远程复核'
          return {
            dot: decisionIcon(s.decision_cn),
            color: blocked ? 'red' : reviewed ? 'orange' : 'green',
            children: (
              <div style={{
                border: `1px solid ${blocked ? '#ffccc7' : reviewed ? '#ffe58f' : '#b7eb8f'}`,
                borderRadius: 8,
                padding: '10px 14px',
                background: blocked ? '#fff2f0' : reviewed ? '#fffbe6' : '#f6ffed',
              }}>
                {/* 标题行 */}
                <Space wrap size={8}>
                  <Text strong style={{ fontSize: 14 }}>第 {s.step} 步 · {s.title}</Text>
                  <Tag color={phaseColor[s.phase]}>{s.checkpoint || phaseLabel[s.phase]}</Tag>
                  <Tag color={decisionCnColor[s.decision_cn] || 'default'} style={{ fontSize: 12 }}>
                    {s.decision_cn}
                  </Tag>
                  {s.signals_cn?.length ? (
                    <Tag color="volcano" icon={<WarningOutlined />}>
                      检出：{s.signals_cn.join('、')}
                    </Tag>
                  ) : null}
                </Space>

                {/* 剧情 */}
                <Paragraph style={{ margin: '8px 0 4px' }}>
                  <Text type="secondary" style={{ fontSize: 13 }}>📖 发生了什么：</Text>
                  <Text style={{ fontSize: 13 }}>{s.story}</Text>
                </Paragraph>

                {/* 检测原理 */}
                <Paragraph style={{ margin: '0 0 4px' }}>
                  <Text type="secondary" style={{ fontSize: 13 }}><SearchOutlined /> AgentGuard 如何识破：</Text>
                  <Text style={{ fontSize: 13 }}>{s.detection}</Text>
                </Paragraph>

                {/* 一句话原理 */}
                <Paragraph style={{ margin: 0 }}>
                  <Text type="success" style={{ fontSize: 12 }} strong>💡 {s.how}</Text>
                </Paragraph>
              </div>
            ),
          }
        })}
      />

      {/* 结果统计 */}
      <Divider style={{ margin: '8px 0' }} />
      <Row gutter={12}>
        <Col span={6}>
          <Statistic title="检查步骤" value={demoResult.summary?.total ?? 0} prefix={<EyeOutlined />} />
        </Col>
        <Col span={6}>
          <Statistic title="放行" value={demoResult.summary?.allowed ?? 0} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} />
        </Col>
        <Col span={6}>
          <Statistic title="拦截" value={demoResult.summary?.denied ?? 0} valueStyle={{ color: '#ff4d4f' }} prefix={<StopOutlined />} />
        </Col>
        <Col span={6}>
          <Statistic title="转审批/复核" value={demoResult.summary?.reviewed ?? 0} valueStyle={{ color: '#faad14' }} prefix={<AuditOutlined />} />
        </Col>
      </Row>

      <Alert
        style={{ marginTop: 12 }}
        type="success"
        showIcon
        message="演示结论"
        description="攻击者尝试了提示词注入、工具结果投毒、密钥泄露、机密外发等多种手段，但 AgentGuard 通过「输入检测 + 输出检测 + 单步规则 + 多步轨迹关联」四道防线层层拦截。即使某一环节漏过，后续关卡仍能兜底——这就是纵深防御。"
      />
    </Card>
  )

  // ====== Tab 项 ======
  const tabItems = [
    {
      key: 'rules',
      label: <span><SafetyOutlined /> 规则管理</span>,
      children: (
        <Table
          dataSource={rules}
          columns={ruleColumns}
          rowKey={(r) => r.rule_id || r.id || r.name || Math.random().toString()}
          size="small"
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: '暂无规则数据' }}
        />
      ),
    },
    {
      key: 'runtime',
      label: <span><EyeOutlined /> 运行时监控</span>,
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Card title="最近流量" size="small">
            <Table
              dataSource={traffic}
              columns={trafficColumns}
              rowKey={(_, i) => String(i)}
              size="small"
              pagination={{ pageSize: 8 }}
              locale={{ emptyText: '暂无流量数据（向安全龙虾发送消息或运行一键演示后产生）' }}
            />
          </Card>
          <Card title="最近审计事件" size="small">
            <Table
              dataSource={audit}
              columns={auditColumns}
              rowKey={(_, i) => String(i)}
              size="small"
              pagination={{ pageSize: 8 }}
              locale={{ emptyText: '暂无审计事件' }}
            />
          </Card>
          <Card title="待审批" size="small">
            <Table
              dataSource={approvals}
              columns={approvalColumns}
              rowKey={(a) => a.ticket_id || Math.random().toString()}
              size="small"
              pagination={{ pageSize: 5 }}
              locale={{ emptyText: '暂无待审批项' }}
            />
          </Card>
        </Space>
      ),
    },
    {
      key: 'assets',
      label: <span><ToolOutlined /> 工具 / Skill / MCP</span>,
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Card title={<><ApiOutlined /> 已注册工具 ({tools.length})</>} size="small">
            <Table
              dataSource={tools}
              columns={toolColumns}
              rowKey={(t) => `${t.owner_agent_id}-${t.name}` || Math.random().toString()}
              size="small"
              pagination={{ pageSize: 8 }}
              locale={{ emptyText: '暂无工具数据' }}
            />
          </Card>
          <Card title={<><AppstoreOutlined /> 已扫描 Skill ({skills.length})</>} size="small">
            <Table
              dataSource={skills}
              columns={skillColumns}
              rowKey={(s) => s.skill_unique_id || Math.random().toString()}
              size="small"
              pagination={{ pageSize: 8 }}
              locale={{ emptyText: '暂无 Skill 数据' }}
            />
          </Card>
          <Card title="已扫描 MCP ({mcps.length})" size="small">
            <Table
              dataSource={mcps}
              columns={mcpColumns}
              rowKey={(m) => m.mcp_unique_id || m.unique_id || Math.random().toString()}
              size="small"
              pagination={{ pageSize: 8 }}
              locale={{ emptyText: '暂无 MCP 数据' }}
            />
          </Card>
        </Space>
      ),
    },
    {
      key: 'agents',
      label: <span><CloudServerOutlined /> Agent 详情</span>,
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Card size="small">
            <Space>
              <Text>选择 Agent：</Text>
              <Select
                style={{ width: 280 }}
                placeholder="选择要查看的 Agent"
                value={selectedAgent || undefined}
                onChange={(v) => loadAgentDetail(v)}
                options={agentIds.map(id => ({ label: id, value: id! }))}
                allowClear
                onClear={() => { setSelectedAgent(''); setAgentStats(null); setAgentTraffic([]) }}
              />
            </Space>
          </Card>
          {agentStats && (
            <Card title="Agent 统计" size="small">
              <Descriptions bordered size="small" column={2}>
                {Object.entries(agentStats).map(([k, v]) => (
                  <Descriptions.Item key={k} label={k}>
                    {typeof v === 'object' ? JSON.stringify(v) : String(v ?? '-')}
                  </Descriptions.Item>
                ))}
              </Descriptions>
            </Card>
          )}
          {agentTraffic.length > 0 && (
            <Card title="Agent 流量" size="small">
              <Table
                dataSource={agentTraffic}
                columns={trafficColumns}
                rowKey={(_, i) => String(i)}
                size="small"
                pagination={{ pageSize: 8 }}
              />
            </Card>
          )}
          {!selectedAgent && (
            <Card size="small">
              <Text type="secondary">从上方选择一个 Agent 查看详情。可用 Agent 列表来自运行时流量数据。</Text>
            </Card>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* 状态总览卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="服务器状态"
              value={isConnected ? '已连接' : '未连接'}
              valueStyle={{ color: isConnected ? '#52c41a' : '#ff4d4f' }}
              prefix={isConnected ? <CheckCircleOutlined /> : <WarningOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="受管 Agent 数"
              value={stats?.agents ?? 0}
              prefix={<CloudServerOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="规则数"
              value={stats?.rules ?? health?.rules ?? 0}
              prefix={<SafetyOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总请求 / 拦截"
              value={`${stats?.total_requests ?? 0} / ${stats?.deny_count ?? 0}`}
              suffix={stats?.total_requests ? <Text type="secondary" style={{ fontSize: 14 }}>拦截率 {((stats?.deny_rate ?? 0) * 100).toFixed(1)}%</Text> : undefined}
              prefix={<EyeOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 监控机制：AgentGuard 如何盯住 Agent 的每一步 */}
      <Card
        title={<><EyeOutlined /> AgentGuard 监控机制 — 在 Agent 循环的 4 个节点设钩子关卡</>}
        size="small"
        style={{ marginBottom: 16 }}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="监控方式：不是网络代理，而是「钩子（Hook）+ 旁路控制服务器」"
          description="AgentGuard 以插件形式挂进 OpenClaw 的事件钩子：Agent 每经过一个关键节点（进大模型前、出大模型后、执行工具前、工具返回后），钩子就把当时的输入/输出/参数/结果打包成事件，发给独立的控制服务器做策略判定，再根据「放行 / 拦截 / 转审批」执行。所有事件还会写入会话轨迹库，用于跨步骤的攻击链关联。"
        />
        <ReactECharts option={monitorFlowOption} style={{ height: 460 }} notMerge />
        <Divider style={{ margin: '12px 0' }}>四道关卡各自盯什么</Divider>
        <Row gutter={12}>
          {checkpointCards.map(c => (
            <Col span={6} key={c.title}>
              <Card size="small" style={{ background: `${c.color}22`, borderColor: c.color, height: '100%' }}>
                <Text strong style={{ fontSize: 13 }}>{c.title}</Text>
                <div style={{ margin: '4px 0 8px' }}>
                  <Tag color={phaseColor[c.phase]}>{phaseLabel[c.phase]}</Tag>
                  <Text code style={{ fontSize: 11 }}>{c.hook}</Text>
                </div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {c.watch.map(w => (
                    <li key={w} style={{ fontSize: 12, color: '#444', marginBottom: 3 }}>{w}</li>
                  ))}
                </ul>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 操作按钮 */}
      <Space style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          onClick={runDemo}
          loading={demoLoading}
        >
          一键演示：模拟数据外泄攻击链
        </Button>
        <Button
          icon={<ToolOutlined />}
          onClick={syncInventory}
          loading={syncLoading}
        >
          扫描 OpenClaw 配置
        </Button>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          刷新数据
        </Button>
        <Button
          icon={<EyeOutlined />}
          onClick={() => window.open('http://localhost:38008', '_blank')}
        >
          打开 AgentGuard UI
        </Button>
      </Space>

      {/* 一键演示结果 */}
      {demoPanel}

      {/* Tabs 区域 */}
      <Tabs items={tabItems} defaultActiveKey="rules" />
    </div>
  )
}
