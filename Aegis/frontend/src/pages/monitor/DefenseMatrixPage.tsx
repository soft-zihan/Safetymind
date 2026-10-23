import { useState } from 'react'
import { Card, Row, Col, Tag, Typography, Modal, List } from 'antd'
import { 
  ExperimentOutlined,
  InfoCircleOutlined
} from '@ant-design/icons'

const { Title, Text, Paragraph } = Typography

// 组件分类：Privacy / Harness / Monitor
type ComponentCategory = 'Privacy' | 'Harness' | 'Monitor'

// 实际提供功能的组件（对应仓库中的真实子项目）
type RealComponent =
  | 'AgentGuard'
  | 'ClawKeeper Plugin'
  | 'ClawShell 代理'
  | 'ClawKeeper Watcher'
  | 'NemoClaw 沙箱'
  | 'qise'
  | 'Safetymind'

const REAL_COMP_COLOR: Record<RealComponent, string> = {
  'AgentGuard': '#1890ff',
  'ClawKeeper Plugin': '#096dd9',
  'ClawShell 代理': '#722ed1',
  'ClawKeeper Watcher': '#fa8c16',
  'NemoClaw 沙箱': '#eb2f96',
  'qise': '#52c41a',
  'Safetymind': '#8c8c8c'
}

interface PrincipleItem {
  text: string
  provider: RealComponent
}

interface ComponentDetail {
  name: string
  category: ComponentCategory
  description: string
  principles: PrincipleItem[]
  technologies?: string[]
}

const COMPONENTS: Record<string, ComponentDetail> = {
  '隐私数据保护': {
    name: '隐私数据保护',
    category: 'Privacy',
    description: '对用户敏感数据进行加密存储和访问控制',
    principles: [
      { text: 'AES-256-GCM 加密存储：使用对称加密算法对用户隐私数据进行加密，密钥通过 KMS 服务管理，每次加密使用随机 IV 确保相同明文产生不同密文', provider: 'Safetymind' },
      { text: '基于角色的访问控制 (RBAC)：定义 admin/operator/auditor 三级角色，每个角色绑定特定数据访问权限，权限变更需经过审批流程并记录审计日志', provider: 'Safetymind' },
      { text: '数据脱敏与匿名化处理：对展示层数据进行脱敏（如手机号显示为 138****1234），对分析场景使用 k-anonymity 算法进行匿名化', provider: 'Safetymind' },
      { text: '隐私数据访问审计日志：记录所有数据访问行为（who/when/what/how），支持 90 天回溯查询，异常访问自动触发告警', provider: 'Safetymind' }
    ],
    technologies: ['AES-256-GCM', 'RBAC', 'k-anonymity', 'KMS']
  },
  '量子安全加密': {
    name: '量子安全加密',
    category: 'Privacy',
    description: '抗量子计算攻击的加密算法',
    principles: [
      { text: 'CRYSTALS-Kyber 密钥封装：使用基于格的密码学算法进行密钥交换，密钥尺寸 1568 字节，安全性基于 Module-LWE 问题，可抵抗 Shor 算法的量子攻击', provider: 'Safetymind' },
      { text: 'CRYSTALS-Dilithium 数字签名：签名算法基于 Module-LWR 问题，签名尺寸 2420 字节，验证速度快，用于确保数据完整性和来源认证', provider: 'Safetymind' },
      { text: '后量子密码学标准 (NIST PQC)：遵循 NIST 2024 年发布的 FIPS 203/204/205 标准，确保算法实现符合官方规范', provider: 'Safetymind' },
      { text: '混合加密模式兼容传统算法：采用 X25519 + Kyber768 混合密钥封装，同时支持传统 TLS 1.3 和后量子密钥交换', provider: 'Safetymind' }
    ],
    technologies: ['Kyber768', 'Dilithium3', 'NIST FIPS 203/204', 'X25519']
  },
  '提示注入检测': {
    name: '提示注入检测',
    category: 'Harness',
    description: '多阶段干预与跨工具攻击链检测',
    principles: [
      { text: '四阶段插件管道：llm_before（LLM 调用前拦截注入）、llm_after（LLM 输出后检测泄露）、tool_before（工具调用前验证权限）、tool_after（工具返回后审计结果），每个阶段独立配置 client/server 插件', provider: 'AgentGuard' },
      { text: 'TRACE 攻击链模式匹配：支持四种分隔符语法（A->B 严格相邻、A->*->B 恰好一个中间、A->...->B 至少一个中间、A->...?->B 零个或多个中间），编译为正则表达式并使用 LRU 缓存（512 条模式）加速匹配', provider: 'AgentGuard' },
      { text: 'DSL 策略引擎：声明式规则包含 RULE/TRACE/CONDITION/POLICY/Severity/Category/Reason 字段，支持 AND/OR/NOT 布尔条件表达式，命名占位符访问器（P.name/P.boundary/P.sensitivity/P.integrity）用于条件引用', provider: 'AgentGuard' },
      { text: 'Deny-Overrides 规则匹配：多条规则冲突时按 priority 优先级排序，同优先级按 effect 强度排序（DENY > REQUIRE_REMOTE_REVIEW > REQUIRE_APPROVAL > DEGRADE > SANITIZE > LOG_ONLY > ALLOW）', provider: 'AgentGuard' },
      { text: '编码载荷与脚本体扫描：识别 base64/hex 编码的二阶段攻击载荷，检测动态路径构造中的恶意内容，支持中英双语 + 混合模式匹配（CJK 不使用 \\b 边界）', provider: 'ClawKeeper Plugin' }
    ],
    technologies: ['四阶段管道', 'TRACE 模式匹配', 'DSL 策略引擎', 'Deny-Overrides', '编码载荷扫描']
  },
  '工具调用验证': {
    name: '工具调用验证',
    category: 'Harness',
    description: '零信任架构下的工具调用安全防护',
    principles: [
      { text: '危险命令拦截 (exec_gate)：基于 20+ 条正则模式库检测危险命令（rm -rf /、chmod 777、fork bomb 等），支持 fail-closed/fail-open 策略配置，匹配即拒绝或降级为人工审批', provider: 'ClawKeeper Plugin' },
      { text: '受保护路径访问 (path_guard)：控制对 /etc/shadow、~/.ssh、/proc 等敏感路径的访问，检测路径遍历攻击（../），支持白名单/黑名单配置', provider: 'ClawKeeper Plugin' },
      { text: 'SSRF 与 URL 安全检测 (url_safety)：识别内网 IP CIDR（10.0.0.0/8、172.16.0.0/12、192.168.0.0/16）、homograph 攻击（punycode 域名）、不安全 URL scheme（file://、gopher://），阻止对内网资源的访问', provider: 'ClawKeeper Plugin' },
      { text: '凭据发现与脱敏 (credential_redact)：基于 7+ 条正则模式自动发现工具返回中的 API Key（sk-、AKIA）、密码、私钥（BEGIN PRIVATE KEY）等凭据，替换为 [REDACTED] 标记', provider: 'ClawKeeper Plugin' },
      { text: '输入验证与脚本体扫描 (input_validator + script_body_scan)：验证工具输入格式（JSON schema 校验），检测动态路径构造中的敏感目录标记（/etc、/proc、~/.aws）', provider: 'ClawKeeper Plugin' },
      { text: '可视化策略配置与审计：Web 控制台可视化配置策略，运行时仪表板显示匹配规则、风险评分、最终决策和原始事件 JSON，支持 TRACE 模式可视化编辑', provider: 'AgentGuard' }
    ],
    technologies: ['exec_gate', 'path_guard', 'url_safety', 'credential_redact', 'input_validator', 'script_body_scan']
  },
  'NemoClaw 沙箱': {
    name: 'NemoClaw 沙箱',
    category: 'Harness',
    description: 'NVIDIA NemoClaw 提供的安全沙箱执行环境',
    principles: [
      { text: '基于 NVIDIA OpenShell 的容器隔离：每个智能体运行在独立 Docker 容器中，提供完整的文件系统、进程空间和网络栈隔离，容器间互不干扰', provider: 'NemoClaw 沙箱' },
      { text: '网络策略控制：基线网络规则（默认拒绝所有出站）+ 运营者审批流程（需显式授权）+ 出站流量白名单控制，防止数据渗出和未授权网络访问', provider: 'NemoClaw 沙箱' },
      { text: '沙箱安全加固：丢弃危险 capabilities（CAP_SYS_ADMIN、CAP_NET_RAW）、限制进程数（pids-limit）、只读根文件系统（--read-only）、临时文件系统挂载（tmpfs）', provider: 'NemoClaw 沙箱' },
      { text: '快照与生命周期管理：支持沙箱快照（docker commit）和恢复，完整的生命周期操作（create/start/stop/rm），支持持久化工作目录挂载', provider: 'NemoClaw 沙箱' },
      { text: '多智能体支持：支持 OpenClaw（默认）、Hermes、LangChain Deep Agents Code 等多种智能体框架，通过 blueprint 配置不同智能体的运行环境', provider: 'NemoClaw 沙箱' }
    ],
    technologies: ['OpenShell', '网络策略', '沙箱加固', '快照恢复', '多智能体']
  },
  '运行时行为监控': {
    name: '运行时行为监控',
    category: 'Monitor',
    description: '运行时事件采集与意图推理',
    principles: [
      { text: '三层决策流：Layer 0 规则快速路径（0ms 确定性 BLOCK/PASS）→ Layer 1 SLM 语义筛查（模型依赖的风险分类）→ Layer 2 LLM 深度分析（<2s 完整轨迹推理）→ Layer 3 规则兜底（永不 fail-open）', provider: 'qise' },
      { text: '14 类守卫管道：Ingress 阶段（PromptGuard/ToolSanityGuard/ContextGuard/SupplyChainGuard）→ Egress 阶段（CommandGuard/FilesystemGuard/NetworkGuard/ExfilGuard/ResourceGuard/ToolPolicyGuard）→ Output 阶段（CredentialGuard/AuditGuard/OutputGuard）+ 跨管道 ReasoningGuard', provider: 'qise' },
      { text: 'JSONL 事件日志：写入 ~/.qise/events.jsonl，每条事件包含 schema_version/stage/source/risk{category,severity,confidence}/decision{verdict,mode,blocked_by}/evidence{guard_name,pattern_matched}/recommendation 字段', provider: 'qise' },
      { text: 'LLM 意图推理引擎：单次 LLM 调用（temperature=0.2, max_tokens=512）评估工具调用意图，输出 JSON {decision, reason, severity, signals, confidence}，采用"LLM 提议，确定性规则否决"双层决策架构', provider: 'ClawKeeper Watcher' },
      { text: '自适应防护学习：当 LLM 发现但确定性守卫漏检且置信度≥0.75 时触发，第二次 LLM 调用提取最小正则，通过良性语料库验证（10 条常见命令）防止过宽匹配，持久化到 ~/.clawkeeper/learned_patterns.json 并热加载到运行时守卫模块', provider: 'ClawKeeper Watcher' }
    ],
    technologies: ['三层决策流', '14 类守卫管道', 'JSONL 事件日志', 'LLM 意图推理', '自适应学习']
  },
  '审计与风险追溯': {
    name: '审计与风险追溯',
    category: 'Monitor',
    description: '结构化审计日志与风险评估',
    principles: [
      { text: '结构化审计追踪：记录 trace 条目包含 events/decisions/plugin results，支持内存 + JSONL 持久化存储，按 session 分组回放', provider: 'AgentGuard' },
      { text: '风险评估审计器：内置 trace_risk_summary 审计器，信号级别分为 critical（credential_theft, data_exfiltration, secret_detected）/ high（prompt_injection, privilege_escalation）/ warning', provider: 'AgentGuard' },
      { text: 'API 密钥隔离：虚拟密钥到真实密钥映射，真实 API 密钥存储在 /etc/clawshell/ 受 Unix 权限保护，智能体仅持有虚拟密钥', provider: 'ClawShell 代理' },
      { text: 'DLP 扫描：基于正则的 PII 检测（身份证号、信用卡、邮箱等），在请求/响应体中扫描，支持 block 和 redact 两种动作', provider: 'ClawShell 代理' }
    ],
    technologies: ['trace_risk_summary', '风险评估', 'API 密钥隔离', 'DLP 扫描']
  }
}

// 按 Privacy/Harness/Monitor 三层组织
const DEFENSE_GROUPS = [
  {
    id: 'Privacy',
    name: 'Privacy 隐私合规',
    category: 'Privacy' as ComponentCategory,
    color: '#52c41a',
    description: '数据加密与访问控制',
    components: ['隐私数据保护', '量子安全加密']
  },
  {
    id: 'Harness',
    name: 'Harness 安全控制',
    category: 'Harness' as ComponentCategory,
    color: '#1890ff',
    description: '输入过滤、工具验证与沙箱隔离',
    components: ['提示注入检测', '工具调用验证', 'NemoClaw 沙箱']
  },
  {
    id: 'Monitor',
    name: 'Monitor 监控审计',
    category: 'Monitor' as ComponentCategory,
    color: '#fa8c16',
    description: '运行时监控与审计追溯',
    components: ['运行时行为监控', '审计与风险追溯']
  }
]

const CATEGORY_COLORS: Record<ComponentCategory, string> = {
  Privacy: '#52c41a',
  Harness: '#1890ff',
  Monitor: '#fa8c16'
}

export default function DefenseMatrixPage() {
  const [selectedComponent, setSelectedComponent] = useState<ComponentDetail | null>(null)

  const categoryTag = (category: ComponentCategory) => (
    <Tag color={CATEGORY_COLORS[category]} style={{ fontSize: 11 }}>{category}</Tag>
  )

  return (
    <div>
      <Title level={4}>Safetymind 防御架构</Title>

      {/* 三层防御架构 */}
      {DEFENSE_GROUPS.map((group) => (
        <div key={group.id} style={{ marginBottom: 24 }}>
          <Card
            size="small"
            style={{ borderLeft: `4px solid ${group.color}` }}
            title={
              <span>
                <Text strong style={{ color: group.color, fontSize: 16 }}>{group.name}</Text>
                <Text type="secondary" style={{ marginLeft: 12, fontSize: 12 }}>{group.description}</Text>
              </span>
            }
          >
            <Row gutter={12}>
              {group.components.map((compName) => {
                const comp = COMPONENTS[compName]
                return (
                  <Col xs={24} sm={Math.floor(24 / group.components.length)} key={compName}>
                    <div 
                      style={{ 
                        padding: '12px 16px', 
                        background: '#fafafa', 
                        borderRadius: 6, 
                        height: '100%',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        border: '1px solid #f0f0f0'
                      }}
                      onClick={() => setSelectedComponent(comp)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f0f5ff'
                        e.currentTarget.style.borderColor = group.color
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#fafafa'
                        e.currentTarget.style.borderColor = '#f0f0f0'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text strong style={{ fontSize: 14 }}>{comp.name}</Text>
                        <InfoCircleOutlined style={{ color: group.color, fontSize: 14 }} />
                      </div>
                      <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                        {comp.description}
                      </Text>
                    </div>
                  </Col>
                )
              })}
            </Row>
          </Card>
        </div>
      ))}

      {/* 组件详情弹窗 */}
      <Modal
        title={
          selectedComponent ? (
            <span>
              <ExperimentOutlined style={{ marginRight: 8 }} />
              {selectedComponent.name}
              <span style={{ marginLeft: 12 }}>{categoryTag(selectedComponent.category)}</span>
            </span>
          ) : null
        }
        open={!!selectedComponent}
        onCancel={() => setSelectedComponent(null)}
        footer={null}
        width={640}
      >
        {selectedComponent && (
          <div>
            <Paragraph>{selectedComponent.description}</Paragraph>
            
            <Title level={5} style={{ marginTop: 16 }}>实现原理</Title>
            <List
              size="small"
              bordered
              dataSource={selectedComponent.principles}
              renderItem={(item) => (
                <List.Item>
                  <div style={{ width: '100%' }}>
                    <div style={{ marginBottom: 4 }}>{item.text}</div>
                    {item.provider !== 'Safetymind' && (
                      <Tag color={REAL_COMP_COLOR[item.provider]} style={{ fontSize: 11 }}>
                        {item.provider}
                      </Tag>
                    )}
                  </div>
                </List.Item>
              )}
            />

            {selectedComponent.technologies && (
              <>
                <Title level={5} style={{ marginTop: 16 }}>技术栈</Title>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {selectedComponent.technologies.map(tech => (
                    <Tag key={tech} color="blue">{tech}</Tag>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
