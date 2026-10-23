# Aegis — 安全管理平台

> 专为 OpenClaw/Hermes 双智能体提供全方位安全加固的管理平台，通过"安全龙虾 vs 裸奔龙虾"双 Agent 对比直观展示加固效果。

**后端**：FastAPI (Python)  
**前端**：React 19 + Ant Design 5  
**页面数**：38 个

---

## 核心定位

Aegis 是 SafetyMind 的**统一管理界面**，将所有安全组件的能力整合到一个直观的前端界面中。它既是安全防护的控制中心，也是攻防演练的展示平台。

---

## 后端架构

### 路由模块

| 路由组 | 路径前缀 | 职责 |
|--------|---------|------|
| `core` | `/api/security/*` | 安全核心、攻防演示、WebSocket |
| `openclaw` | `/api/openclaw/*` | 金刚龙虾（Gateway/加固/ClawKeeper） |
| `hermes` | `/api/hermes/*` | 铁翼信使（Agent/安全/qise 接入） |
| `cheryguard` | `/api/cheryguard/*` | CheryGuard 模型管理与推理 |
| `clawshell` | `/api/clawshell/*` | ClawShell 代理管理 |
| `tools` | `/api/tools/*` | qise 安全防护/评估/数据集 |

### 核心服务

| 服务 | 职责 |
|------|------|
| `openclaw_client` | Gateway API 客户端 |
| `dual_agent_manager` | 双 Agent 管理（裸奔/安全龙虾） |
| `security_analyzer` | 安全分析引擎 |
| `attack_simulator` | 攻击模拟器（16 种场景） |
| `cli_executor` | CLI 执行器 |
| `hermes_qise` | Hermes × qise SDK 接入服务 |
| `hermes_security` | Hermes 7 层安全检查 + 安全扫描 |
| `clawshell_proxy` | ClawShell 代理服务 |

---

## 前端架构

### 导航结构

```
侧边栏菜单：
├── 总览                    ← 系统架构 + 组件状态 + 安全评分
├── 智能体管理
│   ├── 金刚龙虾            ← OpenClaw Agent 连接与状态
│   └── 铁翼信使            ← Hermes Agent 连接与状态
├── 金刚龙虾安全
│   ├── 攻防演练            ← 5 层防御链路可视化
│   └── 审计报告            ← Gateway 操作审计日志
├── 铁翼信使安全
│   ├── 安全扫描            ← 7 层架构 + 基础设施扫描
│   ├── 插件管理            ← 插件安全评级与审查
│   └── 加固指南            ← 安全加固建议
├── qise 安全防护
│   ├── 智能体防护          ← 14 个安全守卫实时防护
│   ├── 防护规则            ← 守卫规则配置
│   ├── 模型评估            ← 安全模型评测
│   └── 数据集管理          ← 基准数据集 + 合规数据生成
├── ClawKeeper              ← 三层防护框架
├── AgentGuard              ← 零信任安全框架
└── ClawShell 代理          ← 双模式安全代理
```

### 核心页面

| 页面 | 功能 |
|------|------|
| **总览** | 系统架构介绍、组件说明、实时状态汇总 |
| **攻防演练** | 裸奔龙虾 vs 安全龙虾对比，16 种攻击场景逐层拦截可视化 |
| **安全扫描** | Hermes 7 层架构 + 基础设施安全检查 |
| **CheryGuard 管理** | 8 个 Tab：模型概览、数据处理、推理测试、评估结果等 |

### 技术组件

- **状态管理**：Zustand
- **图表**：ECharts（6 维安全评分雷达图）
- **动画**：Framer Motion
- **UI 框架**：Ant Design 5

---

## 核心功能

### 攻防演练

16 种攻击场景，覆盖高中低危：

- 提示注入（高/中/低危）
- 工具投毒
- 数据外传
- 凭据泄露
- 命令注入
- ...

实时展示 5 层防御链路的拦截情况：
- L1 ClawShell DLP → L2 qise 守卫 → L3 加固 → L4 ClawKeeper → L5 沙箱

### 安全评分

6 维雷达图对比：

| 维度 | 裸奔龙虾 | 安全龙虾 |
|------|---------|---------|
| 输入安全 | 10 | 95 |
| 输出安全 | 15 | 90 |
| 工具安全 | 20 | 95 |
| 数据安全 | 30 | 92 |
| 环境安全 | 25 | 98 |
| 审计能力 | 10 | 85 |
| **总分** | **20** | **95** |

### ClawShell 双 Agent 模式

- 顶部 Segmented 控件切换 OpenClaw/Hermes 视图
- 实时显示 ClawShell 代理状态 + Agent 连接状态
- 服务控制：启动/停止/重启

---

## 技术栈

### 后端

- **框架**：FastAPI
- **HTTP 客户端**：httpx
- **数据验证**：Pydantic
- **实时通信**：WebSocket
- **定时任务**：APScheduler
- **模型推理**：PyTorch / Transformers

### 前端

- **框架**：React 19
- **UI 库**：Ant Design 5
- **图表**：ECharts
- **状态管理**：Zustand
- **动画**：Framer Motion
- **构建**：Vite
- **路由**：React Router
