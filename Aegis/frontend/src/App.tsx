import { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Badge, Spin } from 'antd'
import {
  DashboardOutlined,
  ExperimentOutlined,
  SafetyOutlined,
  SettingOutlined,
  EyeOutlined,
  CloudServerOutlined,
  SafetyCertificateOutlined,
  ControlOutlined,
  InboxOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  DesktopOutlined,
  FileProtectOutlined,
} from '@ant-design/icons'
import Sandbox from './pages/openclaw/Sandbox'
import { ErrorBoundary } from './components/ErrorBoundary'

// ── 总览 ──
const Home = lazy(() => import('./pages/overview/Home'))

// ── ClawKeeper 防护框架 ──
const ClawKeeperManager = lazy(() => import('./pages/openclaw/ClawKeeperManager'))
const ClawKeeperWatcher = lazy(() => import('./pages/openclaw/ClawKeeperWatcher'))

// ── AgentGuard 零信任 ──
const AgentGuardManager = lazy(() => import('./pages/openclaw/AgentGuardManager'))

// ── ClawShell 代理 ──
const ClawShellDualAgent = lazy(() => import('./pages/clawshell/ClawShellDualAgent'))

// ── CheryGuard 安全模型 ──
const CheryGuardPage = lazy(() => import('./pages/CheryGuard'))

// ── AI-SAFE Privacy ──
const PrivacyReport = lazy(() => import('./pages/privacy/PrivacyReport'))
const QuantumPrivacy = lazy(() => import('./pages/privacy/QuantumPrivacy'))

// ── AI-SAFE Harness ──
const HardeningGuide = lazy(() => import('./pages/openclaw/HardeningGuide'))

// ── AI-SAFE Monitor ──
const DefenseMatrixPage = lazy(() => import('./pages/monitor/DefenseMatrixPage'))

// ══════════════════════════════════════════════
// 隐藏页面 — 通过「收纳」标签访问
// ══════════════════════════════════════════════

// ── Hermes 铁翼信使 ──
const HermesDashboard = lazy(() => import('./pages/hermes/HermesDashboard'))
const HermesAgent = lazy(() => import('./pages/hermes/HermesAgent'))
const HermesAgentManager = lazy(() => import('./pages/hermes/HermesAgentManager'))
const HermesAudit = lazy(() => import('./pages/hermes/HermesAudit'))
const HermesHardening = lazy(() => import('./pages/hermes/HermesHardening'))
const HermesPlugins = lazy(() => import('./pages/hermes/HermesPlugins'))
const HermesSecurityScan = lazy(() => import('./pages/hermes/HermesSecurityScan'))
const HermesUpstreamEvey = lazy(() => import('./pages/hermes/HermesUpstreamEvey'))
const HermesUpstreamIcarus = lazy(() => import('./pages/hermes/HermesUpstreamIcarus'))
const HermesUpstreamLabyrinth = lazy(() => import('./pages/hermes/HermesUpstreamLabyrinth'))
const HermesUpstreamPlugins = lazy(() => import('./pages/hermes/HermesUpstreamPlugins'))

// ── 工具箱 ──
const Preflight = lazy(() => import('./pages/tools/Preflight'))
const ProtectionRules = lazy(() => import('./pages/tools/ProtectionRules'))
const DatasetManager = lazy(() => import('./pages/tools/DatasetManager'))
const Evaluation = lazy(() => import('./pages/tools/Evaluation'))
const LocalSLM = lazy(() => import('./pages/tools/LocalSLM'))
const RuntimeObserver = lazy(() => import('./pages/tools/RuntimeObserver'))
const SecurityEvents = lazy(() => import('./pages/tools/SecurityEvents'))
const SystemDoctor = lazy(() => import('./pages/tools/SystemDoctor'))
const BackupRestore = lazy(() => import('./pages/tools/BackupRestore'))
const Shield = lazy(() => import('./pages/tools/Shield'))

// ── 系统管理 ──
const AdvancedLab = lazy(() => import('./pages/system/AdvancedLab'))
const Integrations = lazy(() => import('./pages/system/Integrations'))
const SettingsPage = lazy(() => import('./pages/system/Settings'))

// ── 概览 PPT ──
const OverviewPPT = lazy(() => import('./pages/overview/OverviewPPT'))
const HarnessOverview = lazy(() => import('./pages/harness/HarnessOverview'))
const MonitorOverview = lazy(() => import('./pages/monitor/MonitorOverview'))
const PrivacyOverview = lazy(() => import('./pages/privacy/PrivacyOverview'))

// ── 其他 ──
const Dashboard = lazy(() => import('./pages/overview/Dashboard'))
const DLPFilter = lazy(() => import('./pages/privacy/DLPFilter'))

// ── 收纳 ──
const OrganizerHub = lazy(() => import('./pages/organizer'))
const HermesSub = lazy(() => import('./pages/organizer/HermesSub'))
const ToolsSub = lazy(() => import('./pages/organizer/ToolsSub'))
const SystemSub = lazy(() => import('./pages/organizer/SystemSub'))
const OverviewPPTSub = lazy(() => import('./pages/organizer/OverviewPPTSub'))
const OtherSub = lazy(() => import('./pages/organizer/OtherSub'))


import './App.css'

const { Header, Content, Sider } = Layout

function AppContent() {
  const navigate = useNavigate()
  const location = useLocation()
  const [current, setCurrent] = useState('dashboard')

  useEffect(() => {
    const path = location.pathname
    if (path === '/' || path === '/home') setCurrent('home')
    // ── AI-SAFE Privacy ──
    else if (path === '/privacy/report') setCurrent('privacy-report')
    else if (path === '/privacy/quantum') setCurrent('privacy-quantum')
    // ── AI-SAFE Harness ──
    else if (path === '/harness/agentguard') setCurrent('harness-agentguard')
    else if (path === '/harness/clawkeeper') setCurrent('harness-clawkeeper')
    else if (path === '/harness/sandbox') setCurrent('harness-sandbox')
    // ── AI-SAFE Monitor ──
    else if (path === '/monitor/clawshell') setCurrent('monitor-clawshell')
    else if (path === '/monitor/watcher') setCurrent('monitor-watcher')
    else if (path === '/monitor/defense-matrix') setCurrent('monitor-defense-matrix')
    else if (path === '/monitor/security-config') setCurrent('monitor-security-config')
    // ── CheryGuard ──
    else if (path === '/cheryguard') setCurrent('cheryguard')
    // ── 收纳 ──
    else if (path.startsWith('/organizer')) setCurrent('organizer')
  }, [location.pathname])

  const items = [
    // ─── 总览 ───
    { key: 'monitor-defense-matrix', icon: <DashboardOutlined />, label: 'Safetymind 防御矩阵' },
    { type: 'divider' as const },

    //         { key: 'monitor-defense-matrix', icon: <SafetyCertificateOutlined />, label: 'Safetymind 防御矩阵' },

    // ─── 🔒 AI-SAFE Privacy ───
    {
      key: 'privacy-group',
      icon: <SafetyCertificateOutlined />,
      label: 'AI-SAFE Privacy',
      children: [
        { key: 'privacy-report', icon: <DashboardOutlined />, label: '隐私合规仪表盘' },
        { key: 'privacy-quantum', icon: <ExperimentOutlined />, label: '量子安全' },
      ],
    },

    // ─── 🛡️ AI-SAFE Harness ───
    {
      key: 'harness-group',
      icon: <ControlOutlined />,
      label: 'AI-SAFE Harness',
      children: [
        { key: 'harness-clawkeeper', icon: <SafetyOutlined />, label: 'ClawKeeper Plugin' },
        { key: 'harness-sandbox', icon: <ExperimentOutlined />, label: 'Safetymind 攻防演练' },
      ],
    },

    // ─── 📊 AI-SAFE Monitor ───
    {
      key: 'monitor-group',
      icon: <EyeOutlined />,
      label: 'AI-SAFE Monitor',
      children: [
        { key: 'monitor-clawshell', icon: <CloudServerOutlined />, label: 'ClawShell 代理' },
        { key: 'monitor-watcher', icon: <EyeOutlined />, label: 'ClawKeeper Watcher' },
        { key: 'monitor-security-config', icon: <SettingOutlined />, label: '安全配置' },
      ],
    },

        {
      key: 'safeguard-group',
      icon: <EyeOutlined />,
      label: 'SafeGuard 安全框架',
      children: [
        { key: 'cheryguard', icon: <ExperimentOutlined />, label: 'SafeGuard 安全模型' },
        { key: 'harness-agentguard', icon: <SafetyOutlined />, label: 'SafeGuard 安全护栏' },
      ],
    },

    // ─── 📦 收纳（隐藏页面入口）───
    {
      key: 'organizer',
      icon: <InboxOutlined />,
      label: '收纳',
      children: [
        { key: 'organizer-hub', icon: <InboxOutlined />, label: '收纳总览' },
        { key: 'organizer-hermes', icon: <ThunderboltOutlined />, label: 'Hermes 铁翼信使' },
        { key: 'organizer-tools', icon: <ToolOutlined />, label: '工具箱' },
        { key: 'organizer-system', icon: <SettingOutlined />, label: '系统管理' },
        { key: 'organizer-ppt', icon: <DesktopOutlined />, label: '概览 PPT' },
        { key: 'organizer-other', icon: <FileProtectOutlined />, label: '其他功能' },
      ],
    },
  ]

  const handleClick = (e: { key: string }) => {
    setCurrent(e.key)
    const routes: Record<string, string> = {
      home: '/',
      // ── AI-SAFE Privacy ──
      'privacy-report': '/privacy/report',
      'privacy-quantum': '/privacy/quantum',
      // ── AI-SAFE Harness ──
      'harness-agentguard': '/agentguard',
      'harness-clawkeeper': '/clawkeeper',
      'harness-sandbox': '/openclaw/sandbox',
      // ── AI-SAFE Monitor ──
      'monitor-clawshell': '/clawshell',
      'monitor-watcher': '/monitor/watcher',
      'monitor-defense-matrix': '/monitor/defense-matrix',
      'monitor-security-config': '/openclaw/hardening',
      // ── CheryGuard ──
      cheryguard: '/cheryguard',
      // ── 收纳 ──
      'organizer-hub': '/organizer',
      'organizer-hermes': '/organizer/hermes',
      'organizer-tools': '/organizer/tools',
      'organizer-system': '/organizer/system',
      'organizer-ppt': '/organizer/overview-ppt',
      'organizer-other': '/organizer/other',
    }
    if (routes[e.key]) navigate(routes[e.key])
  }

  const getPageTitle = () => {
    const titles: Record<string, string> = {
      home: '总览',
      // ── AI-SAFE Privacy ──
      'privacy-report': '隐私合规仪表盘',
      'privacy-quantum': '量子安全隐私保护',
      // ── AI-SAFE Harness ──
      'harness-agentguard': 'AgentGuard 零信任',
      'harness-clawkeeper': 'ClawKeeper Plugin',
      'harness-sandbox': 'Safetymind 攻防演练',
      // ── AI-SAFE Monitor ──
      'monitor-clawshell': 'ClawShell 代理',
      'monitor-watcher': 'ClawKeeper Watcher',
      'monitor-defense-matrix': 'Safetymind 防御矩阵',
      'monitor-security-config': '安全配置',
      // ── CheryGuard ──
      cheryguard: 'SafeGuard 安全模型',
      // ── 收纳 ──
      organizer: '收纳总览',
    }
    return titles[current] || 'Safetymind原型系统'
  }

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Sider
        theme="light"
        breakpoint="lg"
        collapsedWidth="80"
        width={280}
        style={{ overflow: 'auto', height: '100vh', position: 'sticky', top: 0, left: 0 }}
      >
        <div className="logo">
          <img src="/Safetymind.png" alt="Safetymind" style={{ height: 32, marginRight: 8 }} />
          <h2>Safetymind 原型设计</h2>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[current]}
          items={items}
          onClick={handleClick}
        />
      </Sider>
      <Layout style={{ overflow: 'auto', height: '100vh' }}>
        <Header style={{ padding: '0 24px', background: '#fff', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '100%' }}>
            <h1 style={{ margin: 0, fontSize: 20 }}>
              {getPageTitle()}
            </h1>
            <Badge count="2.0" style={{ backgroundColor: '#1890ff' }}>
              <span style={{ fontSize: 14, color: '#666' }}>Safetymind原型设计实验室（功能原型设计，尚未部署）-----</span>
            </Badge>
          </div>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, background: '#fff', borderRadius: 8 }}>
          <ErrorBoundary>
            <Suspense fallback={<Spin size="large" style={{ display: 'block', margin: '100px auto' }} />}>
              <Routes>
              {/* ── 总览 ── */}
              <Route path="/" element={<Home />} />

              {/* ── AI-SAFE Privacy ── */}
              <Route path="/privacy/report" element={<PrivacyReport />} />
              <Route path="/privacy/quantum" element={<QuantumPrivacy />} />

              {/* ── AI-SAFE Harness ── */}
              <Route path="/agentguard" element={<AgentGuardManager />} />
              <Route path="/clawkeeper" element={<ClawKeeperManager />} />
              <Route path="/openclaw/sandbox" element={<Sandbox />} />

              {/* ── AI-SAFE Monitor ── */}
              <Route path="/clawshell" element={<ClawShellDualAgent />} />
              <Route path="/monitor/watcher" element={<ClawKeeperWatcher />} />
              <Route path="/monitor/defense-matrix" element={<DefenseMatrixPage />} />
              <Route path="/openclaw/hardening" element={<HardeningGuide />} />

              {/* ── CheryGuard 安全模型 ── */}
              <Route path="/cheryguard" element={<CheryGuardPage />} />

              {/* ════════════════════════════════════ */}
              {/* 📦 收纳 — 隐藏页面 */}
              {/* ════════════════════════════════════ */}

              {/* ── 收纳导航页 ── */}
              <Route path="/organizer" element={<OrganizerHub />} />
              <Route path="/organizer/hermes" element={<HermesSub />} />
              <Route path="/organizer/tools" element={<ToolsSub />} />
              <Route path="/organizer/system" element={<SystemSub />} />
              <Route path="/organizer/overview-ppt" element={<OverviewPPTSub />} />
              <Route path="/organizer/other" element={<OtherSub />} />

              {/* ── Hermes 铁翼信使 ── */}
              <Route path="/hermes/dashboard" element={<HermesDashboard />} />
              <Route path="/hermes/agent" element={<HermesAgent />} />
              <Route path="/hermes/agents" element={<HermesAgentManager />} />
              <Route path="/hermes/audit" element={<HermesAudit />} />
              <Route path="/hermes/hardening" element={<HermesHardening />} />
              <Route path="/hermes/plugins" element={<HermesPlugins />} />
              <Route path="/hermes/security-scan" element={<HermesSecurityScan />} />
              <Route path="/hermes/upstream/evey" element={<HermesUpstreamEvey />} />
              <Route path="/hermes/upstream/icarus" element={<HermesUpstreamIcarus />} />
              <Route path="/hermes/upstream/labyrinth" element={<HermesUpstreamLabyrinth />} />
              <Route path="/hermes/upstream/plugins" element={<HermesUpstreamPlugins />} />

              {/* ── 工具箱 ── */}
              <Route path="/tools/preflight" element={<Preflight />} />
              <Route path="/tools/protection-rules" element={<ProtectionRules />} />
              <Route path="/tools/dataset-manager" element={<DatasetManager />} />
              <Route path="/tools/evaluation" element={<Evaluation />} />
              <Route path="/tools/local-slm" element={<LocalSLM />} />
              <Route path="/tools/runtime-observer" element={<RuntimeObserver />} />
              <Route path="/tools/security-events" element={<SecurityEvents />} />
              <Route path="/tools/system-doctor" element={<SystemDoctor />} />
              <Route path="/tools/backup-restore" element={<BackupRestore />} />
              <Route path="/tools/shield" element={<Shield />} />

              {/* ── 系统管理 ── */}
              <Route path="/system/advanced-lab" element={<AdvancedLab />} />
              <Route path="/system/integrations" element={<Integrations />} />
              <Route path="/system/settings" element={<SettingsPage />} />

              {/* ── 概览 PPT ── */}
              <Route path="/overview/ppt" element={<OverviewPPT />} />
              <Route path="/harness/overview" element={<HarnessOverview />} />
              <Route path="/monitor/overview" element={<MonitorOverview />} />
              <Route path="/privacy/overview" element={<PrivacyOverview />} />

              {/* ── 其他 ── */}
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/privacy/dlp" element={<DLPFilter />} />
            </Routes>
          </Suspense>
          </ErrorBoundary>
        </Content>
      </Layout>
    </Layout>
  )
}

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppContent />
    </BrowserRouter>
  )
}

export default App
