# 🛡️ SafetyMind — 双轨 AI 智能体安全防护平台

> 围绕 **OpenClaw（金刚龙虾）** 与 **Hermes（铁翼信使）** 两大智能体，提供多套安全方案的集成与统一管理。

SafetyMind 是一个面向 AI 智能体的**全方位安全管理平台**，通过集成多套开源安全方案，为两大智能体提供从密钥隔离、敏感数据过滤、安全守卫、零信任干预到沙箱隔离的 **5 层纵深防御**。

---

## 项目定位

AI Agent 越来越强大，但"裸奔"的 Agent 面临严峻的安全风险：

- 🔓 **密钥泄露** — Agent 持有 API Key，一旦被注入即可盗用
- 📤 **数据外传** — Agent 可能将用户隐私数据发送到恶意端点
- 💉 **提示注入** — 攻击者通过构造输入劫持 Agent 行为
- 🔗 **攻击链** — 多步骤组合操作（读敏感文件→上传外部）绕过单点检测

SafetyMind 通过 **5 层纵深防御** 逐层拦截这些威胁：

```
L1  ClawShell DLP      ← 虚拟密钥隔离 + 敏感数据过滤（SSN/卡号/手机号）
L2  qise 安全守卫       ← 14 个守卫 + 三层决策管线（Rules → SLM → LLM）
L3  OpenClaw 加固       ← Prompt 注入检测 + Tool Call 审计 + AgentGuard 零信任干预
L4  ClawKeeper          ← Skill 策略注入 + Plugin Hook 拦截 + Watcher 独立监控
L5  Docker / NemoClaw   ← 沙箱网络隔离 + 只读根文件系统
```

---

## 架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│                      Aegis 管理平台                              │
│           React 前端  ·  FastAPI 后端  ·  38 个页面              │
│    总览 · 攻防演练 · 安全扫描 · 审计 · 模型管理 · 监控           │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┴────────────────────┐
        │                                         │
   ┌────▼─────┐                            ┌──────▼─────┐
   │ 金刚龙虾  │                            │  铁翼信使   │
   │ OpenClaw  │                            │   Hermes   │
   └────┬──────┘                            └──────┬─────┘
        │                                          │
   ┌────▼──────────────────────────────────────────▼─────┐
   │              双轨共享安全组件                          │
   │                                                      │
   │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
   │  │  qise    │ │ClawShell │ │ Pipelock │ │NemoClaw│ │
   │  │ 安全框架 │ │ 安全代理 │ │ AI防火墙 │ │ 沙箱栈 │ │
   │  │ (Python) │ │  (Rust)  │ │  (Go)    │ │  (TS)  │ │
   │  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
   │                                                      │
   │  ┌──────────────┐  ┌────────────────────────────┐   │
   │  │  CheryGuard  │  │       AgentGuard           │   │
   │  │  安全分类模型 │  │   零信任安全框架            │   │
   │  │  (LoRA微调)  │  │  (四阶段干预+攻击链检测)    │   │
   │  └──────────────┘  └────────────────────────────┘   │
   └──────────────────────────────────────────────────────┘
                             │
   ┌─────────────────────────▼────────────────────────────┐
   │              ClawKeeper 三层防护框架                   │
   │   Skill层(策略注入) · Plugin层(Hook拦截) · Watcher层  │
   └──────────────────────────────────────────────────────┘
```

---

## 安全组件一览

> 各组件的详细架构、功能说明和接入方式见 → [组件详细说明](docs/components/)

### 双轨共享组件

| 组件 | 语言 | 一句话说明 | 详细文档 |
|------|------|-----------|---------|
| **[qise](qise/)** | Python | 核心安全框架，14 个安全守卫 + 三层决策管线 + 透明代理 + SDK 适配器 | [→ qise 介绍](docs/components/qise.md) |
| **[ClawShell](clawshell/)** | Rust | 安全特权代理，虚拟密钥隔离 + DLP 数据防泄漏 + 双 Agent 模式 | [→ ClawShell 介绍](docs/components/clawshell.md) |
| **[Pipelock](pipelock/)** | Go | AI Agent 防火墙，可验证出站控制（VEC），65 种凭据 + 29 种注入检测 | [→ Pipelock 介绍](docs/components/pipelock.md) |
| **[NemoClaw](NemoClaw/)** | TypeScript | NVIDIA 沙箱参考栈，支持 OpenClaw/Hermes/LangChain 三种 Agent | [→ NemoClaw 介绍](docs/components/nemoclaw.md) |

### 安全分类模型

| 组件 | 一句话说明 | 详细文档 |
|------|-----------|---------|
| **[CheryGuard](CheryGuard/)** | 基于 Qwen3-0.6B 微调的安全分类，Gen（生成式）+ Stream（判别式）双架构 | [→ CheryGuard 介绍](docs/components/cheryguard.md) |

### OpenClaw 专属组件

| 组件 | 一句话说明 | 详细文档 |
|------|-----------|---------|
| **[ClawKeeper](ClawKeeper/)** | 三层防护框架：Skill 策略注入 + Plugin Hook 拦截 + Watcher 独立监控 | [→ ClawKeeper 介绍](docs/components/clawkeeper.md) |
| **[AgentGuard](AgentGuard/)** | 零信任安全框架，四阶段干预 + 跨步骤攻击链检测 + ABAC 访问控制 | [→ AgentGuard 介绍](docs/components/agentguard.md) |

### 管理平台

| 组件 | 一句话说明 | 详细文档 |
|------|-----------|---------|
| **[Aegis](Aegis/)** | 前后端管理平台，38 个页面 + 16 个后端服务，攻防演练可视化 | [→ Aegis 介绍](docs/components/aegis.md) |

---

## 纵深防御详解

SafetyMind 的核心设计理念是**纵深防御（Defense in Depth）**——不依赖任何单一安全层，而是通过 5 层互补的防护机制，确保即使某一层被突破，后续层仍能拦截威胁。

### 各层职责

| 层级 | 组件 | 防护目标 | 拦截方式 |
|------|------|---------|---------|
| **L1** | ClawShell | 密钥与数据 | 虚拟密钥隔离，Agent 永远不接触真实 API Key；DLP 扫描过滤 SSN/信用卡/手机号 |
| **L2** | qise | 输入/输出安全 | 14 个 Guard 覆盖 Ingress/Egress/Output 三阶段，Rules→SLM→LLM 三层决策 |
| **L3** | AgentGuard + 加固 | 工具调用安全 | 零信任四阶段干预，跨步骤攻击链检测（如"读敏感文件→上传外部"） |
| **L4** | ClawKeeper | 行为与策略 | Skill 策略注入约束行为，Plugin Hook 拦截危险操作，Watcher 独立监控 |
| **L5** | NemoClaw / Docker | 运行环境 | 沙箱网络隔离（none），只读根文件系统，进程权限降级 |

### 双龙虾对比

前端攻防演练页面实时展示 **"裸奔龙虾"（直连 API，无防护）** 与 **"安全龙虾"（完整 5 层防御）** 的对比：

- 裸奔龙虾：安全评分 20 分，攻击全部成功
- 安全龙虾：安全评分 95 分，16 种攻击场景逐层拦截

---

## Aegis 管理平台

Aegis 是 SafetyMind 的统一管理界面，提供完整的安全防护管理能力：

```
侧边栏导航：
├── 总览                    ← 系统架构 + 组件状态 + 安全评分
├── 智能体管理
│   ├── 金刚龙虾            ← OpenClaw Agent 连接与状态
│   └── 铁翼信使            ← Hermes Agent 连接与状态
├── 金刚龙虾安全
│   ├── 攻防演练            ← 裸奔龙虾 vs 安全龙虾（5 层防御可视化）
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

---

## 快速开始

### 环境要求

- **必需**：Python 3.9+、Node.js 18+
- **可选**：Docker Desktop（沙箱）、Ollama（本地模型）、Rust/Cargo（ClawShell）

### 一键启动

```bash
# 1. 克隆项目
git clone <repo-url> && cd Safetymind

# 2. 配置环境变量
cp Aegis/backend/.env.example Aegis/backend/.env
# 编辑 .env 填入 API Key 等配置

# 3. 一键启动
cd Aegis && ./start.sh start
```

启动后访问：

| 服务 | 地址 |
|------|------|
| 前端界面 | http://localhost:5173 |
| 后端 API | http://localhost:8000/docs |
| Ollama 模型 | http://localhost:11434 |
| ClawShell 代理 | http://localhost:21789 |

### 手动启动

```bash
# 后端
cd Aegis/backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000

# 前端
cd Aegis/frontend
npm install && npm run dev
```

---

## 技术栈

| 层 | 技术 |
|----|------|
| 安全引擎 | Python, 14 Guards, 三层管线, SDK 适配器 |
| 安全分类 | CheryGuard (Gen/Stream), PEFT (LoRA), Qwen3-0.6B |
| 零信任 | AgentGuard, 四阶段干预, Trace Pattern 攻击链检测 |
| 安全代理 | Rust (ClawShell), Go (Pipelock) |
| 模型训练 | PyTorch, PEFT (LoRA), transformers, TRL |
| 后端 | FastAPI, httpx, Pydantic, WebSocket |
| 前端 | React 19, Ant Design 5, ECharts, React Router |
| 推理服务 | Ollama / llama.cpp, vLLM |
| 沙箱 | Docker, NemoClaw (NVIDIA OpenShell) |

---

## 文档导航

| 文档 | 说明 |
|------|------|
| [组件详细说明](docs/components/) | 各安全组件的独立介绍页 |
| [安全组件详细说明](docs/SECURITY_COMPONENTS.md) | 所有组件的架构、功能、接入方式 |
| [Aegis 前后端架构](docs/AEGIS_ARCHITECTURE.md) | 38 个前端页面 + 16 个后端服务 |
| [部署与配置指南](docs/DEPLOYMENT_GUIDE.md) | 从零部署、环境变量、常见问题 |
| [AgentGuard 原理详解](docs/AgentGuard工具调用安全原理详解.md) | 工具调用安全原理与规则设计 |
| [Qwen3Guard 技术文档](docs/Qwen3Guard技术文档.md) | 安全分类模型技术细节 |

---

## License

MIT

---

🛡️ **SafetyMind — 让 AI Agent 在安全护栏内自由行动**
