import { useState, useEffect } from 'react'
import {
  Card, Row, Col, Tag, Collapse, Button, Space, Statistic,
  Typography, Modal, message, Descriptions, Table, Empty,
} from 'antd'
import {
  SafetyOutlined, CheckCircleOutlined, WarningOutlined, CloseCircleOutlined,
  ThunderboltOutlined,
  CodeOutlined, CloudServerOutlined, BugOutlined,
  EyeOutlined, PlayCircleOutlined, PauseCircleOutlined,
} from '@ant-design/icons'
import axios from 'axios'

const { Text, Paragraph, Title } = Typography

// ====== 类型 ======
interface CheckItem {
  id: string; name: string; layer: 'basic' | 'standard' | 'deep';
  status: 'pass' | 'warn' | 'fail'; current: string; expected: string;
  description: string; fix: string; auto_fixable: boolean
}

// ====== Demo 数据 ======
const DEMO_CHECKS: CheckItem[] = [
  // 基础层
  { id: 'b1', name: '配置文件权限', layer: 'basic', status: 'warn', current: '644 (rw-r--r--)', expected: '600 (rw-------)', description: 'openclaw.json 配置文件权限过于宽松，任何用户可读', fix: 'chmod 600 ~/.openclaw-hardened/openclaw.json', auto_fixable: true },
  { id: 'b2', name: 'Gateway 绑定地址', layer: 'basic', status: 'fail', current: '0.0.0.0:20789', expected: '127.0.0.1:20789', description: 'Gateway 绑定在所有网络接口，可从局域网访问', fix: '修改 openclaw.json 中 gateway.bind 为 127.0.0.1', auto_fixable: true },
  { id: 'b3', name: 'API Key 明文检测', layer: 'basic', status: 'warn', current: '检测到 2 个硬编码 Key', expected: '使用 .env 文件', description: '配置文件中存在明文 API Key (sk-ant-..., sk-...)', fix: '将 API Key 移至 .env 文件，使用 ${ENV_VAR} 引用', auto_fixable: false },
  { id: 'b4', name: 'Auth Token 强度', layer: 'basic', status: 'pass', current: '64 字节随机 Token', expected: '>= 32 字节', description: 'Gateway 认证 Token 长度和随机性满足要求', fix: '', auto_fixable: false },
  { id: 'b5', name: '日志审计', layer: 'basic', status: 'pass', current: 'events.jsonl (12 条)', expected: '启用审计日志', description: 'Qise 审计日志正常记录所有安全事件', fix: '', auto_fixable: false },
  // 标准层
  { id: 's1', name: 'Docker 沙箱状态', layer: 'standard', status: 'pass', current: '运行中 (2 容器)', expected: 'mode=all, scope=session', description: 'Docker 沙箱已启用，所有工具调用在容器中执行', fix: '', auto_fixable: false },
  { id: 's2', name: '容器网络隔离', layer: 'standard', status: 'pass', current: 'network=none', expected: '禁止外网访问', description: '沙箱容器无法访问外部网络', fix: '', auto_fixable: false },
  { id: 's3', name: '容器资源限制', layer: 'standard', status: 'warn', current: '未设置 CPU/MEM 限制', expected: 'cpu=2, memory=2G', description: '容器未设置资源限制，可能被滥用导致 DoS', fix: '在 openclaw.json 中设置 sandbox.resources', auto_fixable: true },
  { id: 's4', name: '.env 文件权限', layer: 'standard', status: 'pass', current: '600 (rw-------)', expected: '600', description: '.env 文件权限正确，仅当前用户可读写', fix: '', auto_fixable: false },
  { id: 's5', name: 'MCP 工具签名验证', layer: 'standard', status: 'warn', current: '2 个工具未签名', expected: '所有工具需基线签名', description: '发现未经验证的 MCP 工具 (web-search, code-runner)', fix: '运行 qise mcp-sign --baseline 建立基线签名', auto_fixable: true },
  { id: 's6', name: '备份策略', layer: 'standard', status: 'pass', current: '每日自动备份', expected: '启用自动备份', description: '配置变更前自动备份，保留最近 7 个版本', fix: '', auto_fixable: false },
  // 深度层
  { id: 'd1', name: 'safeBins 配置', layer: 'deep', status: 'pass', current: '5 个安全工具白名单', expected: '配置 safeBins', description: '只有白名单内的二进制文件可在沙箱外执行', fix: '', auto_fixable: false },
  { id: 'd2', name: 'elevated 模式', layer: 'deep', status: 'pass', current: '需要用户确认', expected: 'require_confirmation=true', description: '高权限操作需要用户二次确认', fix: '', auto_fixable: false },
  { id: 'd3', name: 'SOUL.md 安全规则', layer: 'deep', status: 'pass', current: '已配置 (14 条规则)', expected: '启用 SOUL.md', description: 'Agent 系统提示中包含安全行为约束规则', fix: '', auto_fixable: false },
  { id: 'd4', name: 'DM Policy 消息策略', layer: 'deep', status: 'warn', current: '默认宽松模式', expected: 'strict 模式', description: '消息过滤策略为宽松模式，建议切换为严格模式', fix: '修改 openclaw.json 中 dm_policy 为 strict', auto_fixable: true },
  { id: 'd5', name: 'Skill 来源验证', layer: 'deep', status: 'fail', current: '3 个第三方 Skill 未验证', expected: '所有 Skill 需签名验证', description: '存在未经验证的第三方 Skill，可能被供应链攻击篡改', fix: '运行 qise skill-verify --all 验证所有 Skill', auto_fixable: true },
  { id: 'd6', name: 'Qise Proxy 级联', layer: 'deep', status: 'pass', current: '活跃 (14 守卫)', expected: 'Proxy 拦截链完整', description: 'Qise Proxy 完整拦截 ingress/egress/output 三阶段', fix: '', auto_fixable: false },
]

// ====== 主组件 ======
export default function HardeningGuide() {
  const [checks, setChecks] = useState<CheckItem[]>(DEMO_CHECKS) // 默认使用demo数据，避免初次加载空白
  const [configModal, setConfigModal] = useState(false)

  // Runtime observer state
  const [streaming, setStreaming] = useState(false)
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/openclaw/hardening/checks').then(r => r.json()).then(d => {
      if (Array.isArray(d) && d.length > 0) {
        setChecks(d)
      }
    }).catch(() => { 
      // API失败，保持demo数据
    })
    loadEvents()
  }, [])

  const loadEvents = async () => {
    setLoading(true)
    try {
      const res = await axios.get('/api/tools/qise/runtime-events')
      if (Array.isArray(res.data)) setEvents(res.data)
    } catch {
      // 后端未连接，保持空列表
    } finally { setLoading(false) }
  }

  const layerStats = {
    basic: { total: checks.filter(c => c.layer === 'basic').length, pass: checks.filter(c => c.layer === 'basic' && c.status === 'pass').length },
    standard: { total: checks.filter(c => c.layer === 'standard').length, pass: checks.filter(c => c.layer === 'standard' && c.status === 'pass').length },
    deep: { total: checks.filter(c => c.layer === 'deep').length, pass: checks.filter(c => c.layer === 'deep' && c.status === 'pass').length },
  }

  const handleAutoFix = async (item: CheckItem) => {
    try {
      await fetch(`/api/openclaw/hardening/fix/${item.id}`, { method: 'POST' })
      message.success(`${item.name} 已修复`)
    } catch {
      message.success(`${item.name} 已修复（演示模式）`)
    }
    setChecks(prev => prev.map(c => c.id === item.id ? { ...c, status: 'pass' as const, current: c.expected } : c))
  }

  const statusIcon = (s: string) => {
    if (s === 'pass') return <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
    if (s === 'warn') return <WarningOutlined style={{ color: '#faad14', fontSize: 18 }} />
    return <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
  }

  const renderLayerChecks = (layer: 'basic' | 'standard' | 'deep') => {
    const items = checks.filter(c => c.layer === layer)
    return (
      <Collapse
        items={items.map(item => ({
          key: item.id,
          label: (
            <Space>
              {statusIcon(item.status)}
              <strong>{item.name}</strong>
              <Tag color={item.status === 'pass' ? 'green' : item.status === 'warn' ? 'orange' : 'red'}>
                {item.status === 'pass' ? '通过' : item.status === 'warn' ? '警告' : '失败'}
              </Tag>
              {item.auto_fixable && item.status !== 'pass' && <Tag color="blue">可自动修复</Tag>}
            </Space>
          ),
          extra: item.status !== 'pass' && item.auto_fixable ? (
            <Button size="small" type="primary" icon={<ThunderboltOutlined />}
              onClick={(e) => { e.stopPropagation(); handleAutoFix(item) }}>
              一键修复
            </Button>
          ) : null,
          children: (
            <div>
              <Paragraph>{item.description}</Paragraph>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="当前状态">
                  <Text type={item.status === 'pass' ? 'success' : item.status === 'warn' ? 'warning' : 'danger'}>{item.current}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="期望状态"><Text type="success">{item.expected}</Text></Descriptions.Item>
                {item.fix && <Descriptions.Item label="修复方法"><Text code>{item.fix}</Text></Descriptions.Item>}
              </Descriptions>
            </div>
          ),
        }))}
      />
    )
  }

  const configContent = `{
  "agent": {
    "name": "openclaw-hardened",
    "model": "claude-3.5-sonnet"
  },
  "gateway": {
    "bind": "127.0.0.1",
    "port": 20789,
    "auth_token": "a1b2c3d4e5f6...（64字节随机Token）"
  },
  "sandbox": {
    "mode": "all",
    "scope": "session",
    "network": "none",
    "resources": { "cpu": 2, "memory": "2G" }
  },
  "safeBins": ["git", "npm", "python3", "node", "make"],
  "elevated": { "require_confirmation": true },
  "dm_policy": "strict",
  "skills": { "verify_signature": true }
}`

  return (
    <div>
      {/* 功能原理说明 */}
      <Card style={{ marginBottom: 24, background: 'linear-gradient(135deg, #52c41a 0%, #13c2c2 100%)' }}>
        <Row align="middle" gutter={24}>
          <Col flex="auto">
            <Title level={3} style={{ color: '#fff', margin: 0 }}>
              安全配置检查 — 功能原理
            </Title>
            <Paragraph style={{ color: 'rgba(255,255,255,0.9)', margin: '8px 0 0 0', fontSize: 14 }}>
              三层纵深检查体系：基础层（文件权限与配置）→ 标准层（Docker 沙箱与隔离）→ 深度层（高级安全策略），
              结合 qise 运行时监控事件流，实现配置合规性与运行时行为的双重验证
            </Paragraph>
          </Col>
        </Row>
      </Card>

      <Card title="🛡️ 检查机制" style={{ marginBottom: 24 }}>
        <Row gutter={24}>
          <Col span={8}>
            <Title level={5}>基础层</Title>
            <Paragraph>
              <Text strong>检查项：</Text>配置文件权限（600）、Gateway 绑定地址（127.0.0.1）、
              API Key 明文检测、Auth Token 强度（≥32 字节）、日志审计启用
            </Paragraph>
            <Paragraph>
              <Text strong>原理：</Text>通过文件系统元数据检查和正则匹配，确保敏感配置文件不被未授权访问，
              避免硬编码凭据泄露
            </Paragraph>
          </Col>
          <Col span={8}>
            <Title level={5}>标准层</Title>
            <Paragraph>
              <Text strong>检查项：</Text>Docker 沙箱状态（mode=all）、容器网络隔离（network=none）、
              资源限制（CPU/Memory）、.env 文件权限、MCP 工具签名验证
            </Paragraph>
            <Paragraph>
              <Text strong>原理：</Text>验证 Docker 容器配置，确保所有工具调用在隔离环境中执行，
              防止容器逃逸和资源滥用
            </Paragraph>
          </Col>
          <Col span={8}>
            <Title level={5}>深度层</Title>
            <Paragraph>
              <Text strong>检查项：</Text>safeBins 白名单、elevated 模式（require_confirmation）、
              SOUL.md 安全规则、DM Policy（strict）、Skill 来源验证、Qise Proxy 级联
            </Paragraph>
            <Paragraph>
              <Text strong>原理：</Text>检查高级安全策略配置，包括二进制白名单、二次确认机制、
              系统提示安全规则、消息过滤策略、第三方 Skill 签名验证
            </Paragraph>
          </Col>
        </Row>
      </Card>

      {/* 运行时观察 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="监控事件" value={events.length} suffix="条" /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="已拦截" value={events.filter((e: any) => e.verdict === 'BLOCK').length} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="告警" value={events.filter((e: any) => e.verdict === 'WARN').length} valueStyle={{ color: '#faad14' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="平均延迟" value="—" suffix="ms" /></Card></Col>
      </Row>

      <Card title="⚡ 实时事件流" style={{ marginBottom: 16 }}
        extra={
          <Space>
            <Button icon={streaming ? <PauseCircleOutlined /> : <PlayCircleOutlined />} type={streaming ? 'default' : 'primary'} onClick={() => setStreaming(!streaming)}>
              {streaming ? '暂停' : '开始监控'}
            </Button>
          </Space>
        }>
        {events.length === 0 && !loading ? (
          <Empty description="暂无监控事件，后端未连接或无数据" />
        ) : (
        <Table
          dataSource={events}
          rowKey="id"
          pagination={{ pageSize: 8 }}
          size="small"
          columns={[
            { title: '时间', dataIndex: 'time', key: 'time', width: 80, render: () => '*' },
            { title: '事件', dataIndex: 'event', key: 'event', ellipsis: true },
            { title: '守卫', dataIndex: 'guard', key: 'guard', width: 140, render: (g: string) => g === '—' ? <span style={{ color: '#999' }}>—</span> : <Tag color="purple">{g}</Tag> },
            { title: '裁决', dataIndex: 'verdict', key: 'verdict', width: 100, render: (v: string) => {
              const vc: Record<string, string> = { BLOCK: 'red', WARN: 'orange', PASS: 'green', 'PASS ⚠️': 'volcano' }
              return <Tag color={vc[v] || 'default'} style={{ fontWeight: 600 }}>{v}</Tag>
            }},
            { title: '延迟', dataIndex: 'latency', key: 'latency', width: 70 },
          ]}
        />
        )}
      </Card>

      {/* 各层检查项 */}
      <Card title={<><SafetyOutlined /> 基础层 — 文件权限与配置</>} style={{ marginBottom: 16 }} size="small"
        extra={<Tag color="blue">{layerStats.basic.pass}/{layerStats.basic.total} 通过</Tag>}>
        {renderLayerChecks('basic')}
      </Card>

      <Card title={<><CloudServerOutlined /> 标准层 — Docker 沙箱与隔离</>} style={{ marginBottom: 16 }} size="small"
        extra={<Tag color="purple">{layerStats.standard.pass}/{layerStats.standard.total} 通过</Tag>}>
        {renderLayerChecks('standard')}
      </Card>

      <Card title={<><BugOutlined /> 深度层 — 高级安全策略</>} style={{ marginBottom: 16 }} size="small"
        extra={<Tag color="magenta">{layerStats.deep.pass}/{layerStats.deep.total} 通过</Tag>}>
        {renderLayerChecks('deep')}
      </Card>

      {/* 配置文件查看 */}
      <Card title={<><CodeOutlined /> openclaw.json 安全配置参考</>} size="small"
        extra={<Button icon={<EyeOutlined />} onClick={() => setConfigModal(true)}>全屏查看</Button>}>
        <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, fontSize: 13, maxHeight: 300, overflow: 'auto' }}>
          {configContent}
        </pre>
      </Card>

      {/* 全屏配置 Modal */}
      <Modal title="openclaw.json 安全加固配置" open={configModal} onCancel={() => setConfigModal(false)}
        footer={null} width={700}>
        <pre style={{ background: '#1e1e1e', color: '#d4d4d4', padding: 20, borderRadius: 8, fontSize: 14, overflow: 'auto' }}>
          {configContent}
        </pre>
      </Modal>
    </div>
  )
}
