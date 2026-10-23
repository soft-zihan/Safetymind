# Aegis 神盾平台 — 前后端架构说明

> 本文档详细说明 Aegis 管理平台的前后端架构、页面功能、API 路由、服务模块。

---

## 目录

- [技术栈](#技术栈)
- [前端架构](#前端架构)
  - [页面总览](#页面总览)
  - [金刚龙虾安全](#金刚龙虾安全)
  - [铁翼信使安全](#铁翼信使安全)
  - [ClawKeeper 防护](#clawkeeper-防护)
    - [AgentGuard 零信任](#agentguard-零信任)
  - [qise 安全防护](#qise-安全防护)
  - [ClawShell 代理](#clawshell-代理)
  - [系统管理](#系统管理)
- [后端架构](#后端架构)
  - [路由分组](#路由分组)
  - [服务模块](#服务模块)
- [WebSocket](#websocket)

---

## 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 前端 | React 19 + TypeScript | SPA 单页应用 |
| UI 库 | Ant Design 5 | 企业级 UI 组件 |
| 图表 | ECharts | 数据可视化（雷达图、折线图等） |
| 路由 | React Router v7 | 前端路由管理 |
| 构建 | Vite | 开发服务器 + 构建工具 |
| 后端 | FastAPI | Python 异步 Web 框架 |
| HTTP 客户端 | httpx | 异步 HTTP 请求 |
| 数据校验 | Pydantic v2 | 请求/响应数据模型 |
| WebSocket | FastAPI WebSocket | 实时通信 |

---

## 前端架构

前端共 **27 个页面**，按功能分为 7 组。所有页面采用 `lazy()` 懒加载，提升首屏性能。

### 页面总览

| 分组 | 页面数 | 说明 |
|------|--------|------|
| 总览 | 1 | 系统入口，架构介绍、组件说明、状态汇总 |
| 智能体管理 | 2 | OpenClaw/Hermes Agent 连接状态 |
| 金刚龙虾安全 | 2 | OpenClaw 攻防演练、审计 |
| 铁翼信使安全 | 3 | Hermes 安全扫描、插件、加固 |
| ClawKeeper | 1 | 三层防护统一管理 |
| AgentGuard | 1 | 零信任安全框架管理 |
| qise 安全防护 | 11 | 守卫、扫描、事件、规则、评估、数据集、模型 |
| ClawShell 代理 | 1 | 双 Agent 模式切换 |

---

### 智能体管理

OpenClaw（金刚龙虾）和 Hermes（铁翼信使）的 Agent 连接入口。

| 页面 | 路由 | 组件 | 功能说明 |
|------|------|------|----------|
| **金刚龙虾** | `/openclaw/dashboard` | `ScoreDashboard` | OpenClaw Agent 连接与状态查看 |
| **铁翼信使** | `/hermes/agents` | `HermesAgentManager` | Hermes Agent 状态监控、启停控制 |

---

### 金刚龙虾安全

OpenClaw（金刚龙虾）专属安全页面，展示 qise 守卫对 OpenClaw 的防护效果。

| 页面 | 路由 | 组件 | 功能说明 |
|------|------|------|----------|
| **攻防演练** | `/openclaw/sandbox` | `Sandbox` | 裸奔龙虾 vs 安全龙虾对比，5 层防御链路实时拦截演示 |
| **审计报告** | `/openclaw/audit` | `Audit` | Gateway 安全审计日志，历史记录查询 |

---

### 铁翼信使安全

Hermes（铁翼信使）专属安全页面，展示 Hermes 7 层安全架构状态。

| 页面 | 路由 | 组件 | 功能说明 |
|------|------|------|----------|
| **安全扫描** | `/hermes/scan` | `HermesSecurityScan` | Hermes 7 层架构 + 基础设施安全扫描 |
| **插件管理** | `/hermes/plugins` | `HermesPlugins` | Hermes 社区插件的启用/禁用/安全评级 |
| **加固指南** | `/hermes/hardening` | `HermesHardening` | Hermes 安全加固建议 |

---

### ClawKeeper 防护

| 页面 | 路由 | 组件 | 功能说明 |
|------|------|------|----------|
| **ClawKeeper 管理** | `/clawkeeper` | `ClawKeeperManager` | 三层防护统一管理：Skill 策略、Plugin 拦截、Watcher 监控 |

---

### qise 安全防护

qise 安全框架管理页面，覆盖安全防护全生命周期。

| 页面 | 路由 | 组件 | 功能说明 |
|------|------|------|----------|
| **上线前扫描** | `/qise/preflight` | `Preflight` | 模型上线前安全扫描，检查潜在风险 |
| **智能体防护** | `/qise/shield` | `Shield` | 实时防护状态，19 个守卫运行情况 |
| **安全事件** | `/qise/events` | `SecurityEvents` | 安全事件列表，拦截记录 |
| **防护规则** | `/qise/rules` | `ProtectionRules` | 自定义防护规则配置 |
| **模型评估** | `/qise/eval` | `Evaluation` | 安全模型效果评估，F1/准确率 |
| **数据集管理** | `/qise/datasets` | `DatasetManager` | 训练/测试数据集管理 |
| **本地小模型** | `/qise/slm` | `LocalSLM` | 本地 SLM 模型管理（Ollama） |
| **系统诊断** | `/qise/doctor` | `SystemDoctor` | 系统健康检查，依赖诊断 |
| **运行观察** | `/qise/observer` | `RuntimeObserver` | 运行时性能观察，延迟/吞吐 |
| **备份恢复** | `/qise/backup` | `BackupRestore` | 配置备份与恢复 |
| **集成管理** | `/qise/integrations` | `Integrations` | qise 与其他组件的集成状态 |

---

### ClawShell 代理

| 页面 | 路由 | 组件 | 功能说明 |
|------|------|------|----------|
| **ClawShell 代理** | `/clawshell` | `ClawShellDualAgent` | 双 Agent 模式切换（OpenClaw/Hermes），服务启停，状态监控 |

---

### AgentGuard 零信任

AgentGuard 零信任安全框架管理页面，展示控制服务器状态、规则、运行时监控。

| 页面 | 路由 | 组件 | 功能说明 |
|------|------|------|----------|
| **AgentGuard 管理** | `/agentguard` | `AgentGuardManager` | 状态总览、规则管理、运行时监控、工具/Skill/MCP、Agent 详情 |


---

## 后端架构

后端采用 FastAPI 框架，共 **22 个路由文件** + **16 个服务模块**。

### 路由分组

```
Aegis/backend/app/routers/
├── core/              # 核心安全
│   ├── security.py    # /api/security/*
│   ├── demos.py       # /api/demos/*
│   └── websocket.py   # /ws/*
├── openclaw/          # 金刚龙虾
│   ├── gateway.py     # /api/openclaw/gateway
│   ├── hardening.py   # /api/openclaw/hardening
│   ├── clawkeeper.py  # /api/openclaw/clawkeeper
│   └── agentguard.py  # /api/openclaw/agentguard
├── hermes/            # 铁翼信使
│   ├── agents.py      # /api/hermes/agents
│   ├── security.py    # /api/hermes/security
│   ├── upstream.py    # /api/hermes/upstream
│   └── qise.py        # /api/hermes/qise
├── clawshell/         # ClawShell
│   └── proxy.py       # /api/clawshell
└── tools/             # 平台工具
    ├── qise.py        # /api/tools/qise
    ├── eval.py        # /api/tools/eval
    └── datasets.py    # /api/tools/datasets
```

### API 路由详情

#### Core 核心安全

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/security/status` | GET | 安全系统总状态 |
| `/api/security/guards` | GET | 守卫列表 |
| `/api/security/events` | GET | 安全事件 |
| `/api/demos/attack` | POST | 攻击演示 |
| `/api/demos/defense` | POST | 防御演示 |
| `/ws/security` | WebSocket | 安全事件实时推送 |

#### OpenClaw 金刚龙虾

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/openclaw/gateway/status` | GET | Gateway 状态 |
| `/api/openclaw/gateway/config` | GET | Gateway 配置 |
| `/api/openclaw/hardening/check` | POST | 加固检查 |
| `/api/openclaw/hardening/fix` | POST | 一键修复 |
| `/api/openclaw/clawkeeper/status` | GET | ClawKeeper 状态 |
| `/api/openclaw/clawkeeper/audit` | POST | 触发审计 |

#### AgentGuard 零信任

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/openclaw/agentguard/status` | GET | 控制服务器健康状态 |
| `/api/openclaw/agentguard/stats` | GET | 全局统计（Agent/规则/Session） |
| `/api/openclaw/agentguard/rules` | GET | 访问控制规则列表 |
| `/api/openclaw/agentguard/traffic` | GET | 最近流量记录 |
| `/api/openclaw/agentguard/audit` | GET | 最近审计事件 |
| `/api/openclaw/agentguard/approvals` | GET | 待审批列表 |
| `/api/openclaw/agentguard/tools` | GET | 已注册工具列表 |
| `/api/openclaw/agentguard/skills` | GET | 已扫描 Skill 列表 |
| `/api/openclaw/agentguard/mcps` | GET | 已扫描 MCP 列表 |
| `/api/openclaw/agentguard/agents/{id}/stats` | GET | Agent 运行时统计 |
| `/api/openclaw/agentguard/agents/{id}/traffic` | GET | Agent 流量 |

#### Hermes 铁翼信使

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/hermes/status` | GET | Agent 状态 |
| `/api/hermes/security/scan` | POST | Tirith 安全扫描 |
| `/api/hermes/upstream/projects` | GET | 上游项目列表 |
| `/api/hermes/upstream/browse` | GET | 浏览项目内容 |
| `/api/hermes/qise/status` | GET | qise 接入状态 |
| `/api/hermes/qise/check-tool` | POST | 工具调用检查 |
| `/api/hermes/qise/check-output` | POST | 输出安全检查 |
| `/api/hermes/qise/sdk-snippet` | GET | SDK 接入代码示例 |

#### ClawShell 代理

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/clawshell/status` | GET | 聚合状态（ClawShell + 双 Agent） |
| `/api/clawshell/start` | POST | 启动服务 |
| `/api/clawshell/stop` | POST | 停止服务 |
| `/api/clawshell/config` | GET | 配置信息 |
| `/api/clawshell/stats` | GET | 监控统计 |

#### Tools 平台工具

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/tools/qise/status` | GET | qise 状态 |
| `/api/tools/qise/guards` | GET | 守卫列表 |
| `/api/tools/qise/check` | POST | 安全检查 |
| `/api/tools/qise/events` | GET | 安全事件 |
| `/api/tools/eval/run` | POST | 运行评估 |
| `/api/tools/eval/results` | GET | 评估结果 |
| `/api/tools/datasets/list` | GET | 数据集列表 |
| `/api/tools/datasets/upload` | POST | 上传数据集 |

---

### 服务模块

后端共 **16 个服务文件**，封装核心业务逻辑。

| 服务 | 文件 | 行数 | 说明 |
|------|------|------|------|
| **AI 评判** | `ai_judge.py` | 286 | 调用本地/远程 LLM 进行安全评判 |
| **攻击模拟** | `attack_simulator.py` | 348 | 模拟各类攻击场景（注入/泄露/滥用） |
| **ClawShell 代理** | `clawshell_proxy.py` | 163 | 转发请求到 ClawShell 服务 |
| **CLI 执行** | `cli_executor.py` | 71 | 执行 CLI 命令 |
| **置信度分析** | `confidence_analyzer.py` | 247 | 分析模型预测置信度分布 |
| **纵深防御过滤** | `defense_filters.py` | 322 | 5 层防御过滤器实现 |
| **双 Agent 管理** | `dual_agent_manager.py` | 194 | 管理 OpenClaw/Hermes 双 Agent 连接 |
| **加固检查** | `hardening_checker.py` | 355 | 配置/依赖/工作区三层安全检查 |
| **Hermes 客户端** | `hermes_client.py` | 134 | 与 Hermes Agent 通信 |
| **Hermes × qise** | `hermes_qise.py` | 151 | Hermes SDK 接入 qise 适配 |
| **Hermes 安全** | `hermes_security.py` | 191 | Hermes 安全检查逻辑 |
| **Hermes 上游** | `hermes_upstream.py` | 139 | 浏览 Hermes 上游项目仓库 |
| **本地模型** | `local_model.py` | 206 | Ollama 本地模型调用封装 |
| **OpenClaw 客户端** | `openclaw_client.py` | 236 | 与 OpenClaw Gateway 通信 |
| **安全分析** | `security_analyzer.py` | 317 | 综合安全分析引擎 |
| **AgentGuard 客户端** | `agentguard_client.py` | 79 | 与 AgentGuard 控制服务器通信 |

---

## WebSocket

| 端点 | 说明 |
|------|------|
| `/ws/security` | 安全事件实时推送，前端攻防演练页面订阅 |

---

## 相关文档

- [安全组件详细说明](./SECURITY_COMPONENTS.md)
- [部署与配置指南](./DEPLOYMENT_GUIDE.md)
- [返回主 README](../README.md)
