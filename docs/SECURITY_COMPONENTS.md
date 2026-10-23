# SafetyMind 安全组件详细说明

> 本文档详细介绍 SafetyMind 集成的所有安全组件，包括架构、功能、使用方式。

---

## 目录

- [双轨共享组件](#双轨共享组件)
  - [qise 安全框架](#1-qise-安全框架)
  - [ClawShell 安全代理](#2-clawshell-安全代理)
  - [NemoClaw 沙箱](#3-nemoclaw-沙箱)
  - [Pipelock AI 防火墙](#4-pipelock-ai-防火墙)
- [OpenClaw 专属组件](#openclaw-专属组件)
  - [ClawKeeper 三层防护](#5-clawkeeper-三层防护框架)
  - [openclaw-security-assistant](#6-openclaw-security-assistant)
  - [AgentGuard 零信任安全框架](#7-agentguard-零信任安全框架)
- [Hermes 专属组件](#hermes-专属组件)
  - [hermes-plugins](#7-hermes-plugins)
  - [hermes-labyrinth](#8-hermes-labyrinth)
  - [icarus-plugin](#9-icarus-plugin)
  - [evey-setup](#10-evey-setup)
- [纵深防御架构](#纵深防御架构)

---

## 双轨共享组件

以下组件同时支持 OpenClaw（金刚龙虾）和 Hermes（铁翼信使）两大智能体。

### 1. qise 安全框架

**语言**：Python  
**定位**：核心安全框架，提供 19 个安全守卫和三层决策管线

#### 核心特性

- **19 个安全守卫**：覆盖 Ingress（入口）/ Egress（出口）/ Output（输出）三阶段
  - **通用守卫**（14 个）：
    - `PromptGuard` — 提示注入检测
    - `CommandGuard` — 命令安全过滤
    - `ExfilGuard` — 数据泄露防护
    - `CredentialGuard` — 凭据保护
    - `SanitizationGuard` — 输出清洗
    - `ScopeGuard` — 作用域限制
    - `HallucinationGuard` — 幻觉检测
    - `ToxicityGuard` — 毒性检测
    - `BiasGuard` — 偏见检测
    - `ComplianceGuard` — 合规检查
    - `PrivacyGuard` — 隐私保护
    - `RateLimitGuard` — 速率限制
    - `CostGuard` — 成本控制
    - `AuditGuard` — 审计日志
  - **车用守卫**（5 个）：
    - `CanNetworkGuard` — CAN 总线安全
    - `FirmwareIntegrityGuard` — 固件完整性
    - `VehicleDataGuard` — 车辆数据隐私
    - `ObdDiagnosticGuard` — OBD/UDS 诊断
    - `OtaUpdateGuard` — OTA 更新安全

- **三层决策管线**：
  ```
  L1 规则引擎（快速）→ L2 本地 SLM（精准）→ L3 远程 LLM（兜底）
  ```
  - **L1 规则引擎**：正则匹配 + 关键词过滤，延迟 < 1ms
  - **L2 本地 SLM**：QiseGuard 系列模型（2B / 0.8B），延迟 < 100ms
  - **L3 远程 LLM**：调用云端大模型（Qwen/GPT），延迟 1-3s

- **透明代理**：HTTP 代理（端口 8822）自动拦截 Agent 所有 API 调用，零代码集成
- **SDK 适配器**：`QiseHermesAdapter` 通过工具包装为 Hermes 提供安全防护

#### 安全模型

| 模型 | 基座 | 参数量 | F1 | 用途 |
|------|------|--------|-----|------|
| QiseGuard-2B | Qwen3.5-2B | 2B LoRA | 0.973 | 主力安全分类 |
| QiseGuard-0.8B | Qwen3.5-0.8B | 0.8B LoRA | 0.941 | 快速筛查 |

#### 接入方式

**OpenClaw（Proxy 模式）**：
```bash
# 安全龙虾 Gateway 流量经过 qise proxy
export OPENAI_API_BASE=http://localhost:8822/v1
```

**Hermes（SDK 模式）**：
```python
from qise.adapters.hermes import QiseHermesAdapter

shield = Shield.from_config()
adapter = QiseHermesAdapter(shield, session_id="hermes-session")

# 工具调用包装
safe_tools = [adapter.wrap_tool(tool) for tool in my_tools]

# 输出检查
result = adapter.check_agent_output(response)
```

**后端 API**：
- `GET /api/tools/qise/status` — qise 状态
- `POST /api/tools/qise/check` — 安全检查
- `GET /api/tools/qise/guards` — 守卫列表
- `GET /api/hermes/qise/status` — Hermes 接入状态
- `POST /api/hermes/qise/check-tool` — 工具调用检查
- `POST /api/hermes/qise/check-output` — 输出安全检查

---

### 2. ClawShell 安全代理

**语言**：Rust  
**定位**：安全代理服务，提供 API 密钥管理、DLP 扫描、透明代理拦截

#### 核心特性

- **虚拟密钥隔离**：Agent 使用虚拟密钥，真实 API Key 由 ClawShell 托管
- **DLP 敏感数据过滤**：自动检测并过滤 SSN、信用卡号、手机号等敏感信息
- **透明代理拦截**：所有出站流量经过 ClawShell，支持 HTTP/WebSocket
- **双 Agent 模式**：同时适配 OpenClaw 和 Hermes，前端可切换视图
- **系统服务**：端口 21789，通过 `start.sh` 统一管理

#### 配置

```toml
# clawshell.toml
[server]
port = 21789
host = "127.0.0.1"

[dlp]
enabled = true
patterns = ["ssn", "credit_card", "phone"]

[proxy]
openclaw_agent = "http://127.0.0.1:20789"
hermes_agent = "http://127.0.0.1:8081"
```

#### 接入方式

```bash
# 启动 ClawShell 服务
./start.sh start

# 前端管理页面
http://localhost:5173/clawshell
```

**后端 API**：
- `GET /api/clawshell/status` — 聚合状态
- `POST /api/clawshell/start` — 启动服务
- `POST /api/clawshell/stop` — 停止服务
- `GET /api/clawshell/config` — 配置信息
- `GET /api/clawshell/stats` — 监控统计

---

### 3. NemoClaw 沙箱

**语言**：TypeScript  
**定位**：NVIDIA 沙箱参考栈，支持 OpenClaw/Hermes/LangChain

#### 核心特性

- **OpenShell 沙箱**：基于 NVIDIA OpenShell 的安全沙箱环境
- **引导式入门**：提供引导式安装和配置流程
- **强化蓝图**：预定义的安全蓝图，快速部署
- **路由推理**：支持多种推理后端（本地/云端）
- **网络策略**：细粒度的网络访问控制
- **生命周期管理**：统一的 CLI 管理沙箱生命周期

#### 支持的 Agent

| Agent | 说明 |
|-------|------|
| OpenClaw | 默认支持，金刚龙虾 |
| Hermes | 铁翼信使，设置 `NEMOCLAW_AGENT=hermes` |
| LangChain Deep Agents | LangChain 深度 Agent |

#### 接入方式

```bash
# 安装 NemoClaw
cd NemoClaw
bash install.sh

# 使用 OpenClaw（默认）
nemoclaw init
nemoclaw start

# 使用 Hermes
export NEMOCLAW_AGENT=hermes
nemoclaw init
nemoclaw start
```

**后端 API**：
- `GET /api/openclaw/sandbox/status` — 沙箱状态
- `POST /api/openclaw/sandbox/create` — 创建沙箱
- `POST /api/openclaw/sandbox/stop` — 停止沙箱

---

### 4. Pipelock AI 防火墙

**语言**：Go  
**定位**：AI Agent 防火墙，出站流量检测，凭据泄露防护

#### 核心特性

- **可验证出站控制（VEC）**：基于 action receipts 的出站流量审计
- **凭据泄露防护**：65 种凭据模式检测（API Key、密码、Token）
- **提示注入防御**：29 种注入模式，6 轮规范化
- **MCP 安全扫描**：双向 MCP 流量检测
- **多协议支持**：HTTP、WebSocket、CONNECT、MCP、A2A
- **签名证据**：每次检测生成签名收据，第三方可验证

#### 支持的 Agent

Claude Code · OpenAI Codex · Cline · OpenCode · Zed · Cursor · VS Code · JetBrains · OpenAI Agents SDK · Google ADK · AutoGen · CrewAI · LangGraph

#### 接入方式

```bash
# 安装
brew install luckyPipewrench/tap/pipelock

# 初始化
pipelock init

# 测试
pipelock check --url "https://evil.com/?k=AKIAIOSFODNN7EXAMPLE"
```

**后端 API**：
- `GET /api/openclaw/pipelock/status` — Pipelock 状态
- `POST /api/openclaw/pipelock/check` — URL 检查

---

## OpenClaw 专属组件

以下组件专为 OpenClaw（金刚龙虾）设计。

### 5. ClawKeeper 三层防护框架

**语言**：JavaScript/TypeScript  
**定位**：三层防护框架，提供 Skill 策略注入、Plugin Hook 拦截、Watcher 监控

#### 核心特性

**三层架构**：

1. **Skill 层（策略注入）**：
   - 通过 Markdown 文档注入安全策略到 Agent 上下文
   - 支持 Windows 安全指南、飞书安全指南等
   - 环境特定约束、跨平台边界

2. **Plugin 层（运行时拦截）**：
   - 配置审计、威胁检测、行为监控
   - Hook 拦截 Agent 运行时操作
   - 实时阻断高风险行为

3. **Watcher 层（独立监控）**：
   - 解耦的系统级安全中间件
   - 持续验证 Agent 状态演化
   - 支持本地和云端部署
   - 实时执行干预（暂停高风险操作）

#### 功能亮点

- **全面安全扫描**：定期扫描运行时环境、依赖、工作区漏洞
- **实时威胁防护**：实时评估 AI 动作，阻断提示注入、凭据泄露、代码注入
- **行为画像与异常检测**：构建长期行为基线，检测异常动作
- **意图执行与轨迹分析**：监控多轮交互，确保对齐用户意图
- **配置完整性监控**：保护关键配置文件，检测意外变更
- **自动加固与修复**：提供修复建议，支持一键回滚

#### 接入方式

**Skill 层**：
```bash
# Windows 安全指南
cd ClawKeeper/clawkeeper-skill/skills/windows-safety-guide
./scripts/install.ps1

# 飞书安全指南
cd ClawKeeper/clawkeeper-skill/skills/feishu-safety-guide
bash scripts/install.sh
```

**Plugin 层**：
```bash
cd ClawKeeper/clawkeeper-plugin
bash install.sh  # Linux/macOS
# 或
./install.ps1    # Windows

# 验证
npx openclaw clawkeeper audit
```

**Watcher 层**：
```bash
cd ClawKeeper/clawkeeper-watcher
pnpm install
cd clawkeeper
npm install && npm run build && npm link

# 初始化
clawkeeper init remote  # 远程治理模式
clawkeeper init local   # 本地治理模式

# 启动
clawkeeper remote gateway run
# 或
clawkeeper local gateway run
```

**前端管理页面**：
- `/clawkeeper` — ClawKeeper 防护管理

**后端 API**：
- `GET /api/openclaw/clawkeeper/status` — ClawKeeper 状态
- `POST /api/openclaw/clawkeeper/audit` — 触发审计
- `GET /api/openclaw/clawkeeper/logs` — 防护日志

---

### 6. openclaw-security-assistant

**语言**：TypeScript  
**定位**：阿里云安全防护插件，LLM 请求/响应检测，Tool Call 审计

#### 核心特性

- **LLM 请求/响应检测**：自动拦截发往大模型的请求和响应，进行安全审计
- **Tool Call 安全审计**：在工具执行前后进行安全检查
- **Skill 安全检测**：定时扫描 Skill 文件变更，运行时拦截风险 Skill
- **全局 Fetch 拦截**：通过 `global.fetch` 透明劫持底层模型调用
- **身份凭据托管**：集成 Aliyun IDaaS，自动扫描明文 API Key
- **智能降级**：安全服务不可用时自动放行（fail-open）

#### 安全策略

**LLM 检测**：
| 阶段 | 动作 | 说明 |
|------|------|------|
| 请求 | allow | 正常放行 |
| 请求 | block | 拦截请求，返回安全提示 |
| 请求 | hint | 标记请求，返回提示但不阻断 |
| 响应 | allow | 正常放行 |
| 响应 | block | 拦截响应 |
| 响应 | hint | 标记响应 |

**Tool Call 检测**：
| 阶段 | 动作 | 说明 |
|------|------|------|
| 执行前 | allow | 正常执行 |
| 执行前 | block | 拦截调用 |
| 执行后 | allow | 正常返回 |
| 执行后 | block | 拦截返回 |

#### 配置

```yaml
# openclaw.json
{
  "plugins": {
    "openclaw-security-assistant": {
      "enabled": true,
      "config": {
        "endpointAddr": "https://cn-shanghai.agent-security.aliyuncs.com"
      }
    }
  }
}
```

#### 接入方式

```bash
# 启用后重启 Gateway
openclaw restart
```

**状态查询**：
```bash
# CLI
openclaw ali-osa health

# HTTP
curl http://127.0.0.1:<GATEWAY_PORT>/plugin/openclaw-security-assistant/health
```

---

### 7. AgentGuard 零信任安全框架

**语言**：Python 3.11+  
**定位**：零信任安全基础框架，提供四阶段干预、跨步骤攻击链检测、可视化策略管理

#### 核心特性

- **四阶段干预**：在 LLM 调用前后 + 工具调用前后全链路拦截（llm_before, llm_after, tool_before, tool_after）
- **跨步骤攻击链检测**：基于 Trace Pattern 检测“读数据库→发邮件”等链式攻击
- **可视化策略配置**：Web 控制台（端口 38008）管理 Agent、规则、运行时
- **零信任 ABAC 访问控制**：基于属性的访问控制，细粒度策略引擎
- **OpenClaw 插件适配器**：JS 插件将 OpenClaw hooks 映射到 AgentGuard phases
- **Python 客户端 SDK**：`from agentguard import Guard, Principal`

#### 架构

AgentGuard 采用 Client-Server 架构：
- **控制服务器**（端口 38080）：策略引擎、Session 管理、审计日志、流量记录
- **Web 控制台**（端口 38008）：可视化管理界面
- **客户端 SDK**：Python / JavaScript，支持 LangChain/AutoGen/Dify/OpenClaw 等框架
- **OpenClaw 插件**：JS 插件注册 OpenClaw hooks，将事件转发到 AgentGuard 服务器

#### 与 openclaw-security-assistant 的协作

| 维度 | openclaw-security-assistant | AgentGuard |
|------|---------------------------|------------|
| 侧重 | LLM 请求/响应检测 + IDaaS 凭据托管 | 零信任访问控制 + 跨步骤攻击链检测 |
| 干预时机 | LLM 调用前后 | LLM + 工具调用前后（四阶段） |
| 策略管理 | 插件配置 | 可视化 Web 控制台 |
| 互补点 | 凭据托管、智能降级 | 行为审计、Trace Pattern |

#### 接入方式

**OpenClaw 插件模式**：
```json
// config/openclaw-agentguard.json
{
  "serverUrl": "http://127.0.0.1:38080",
  "apiKeyEnvVar": "AGENTGUARD_API_KEY",
  "policy": { "defaultAction": "deny" },
  "auditPath": "/var/log/agentguard/audit.jsonl"
}
```

**Python SDK 模式**：
```python
from agentguard import Guard, Principal

guard = Guard(server_url="http://127.0.0.1:38080")
principal = Principal(agent_id="my-agent", user_id="user-1")

decision = guard.enforce(principal, phase="tool_before", tool="send_email")
if decision["action"] == "deny":
    raise PermissionError(decision["reason"])
```

**前端管理页面**：
- `/agentguard` — AgentGuard 零信任管理

**后端 API**：
- `GET /api/openclaw/agentguard/status` — 控制服务器状态
- `GET /api/openclaw/agentguard/stats` — 全局统计
- `GET /api/openclaw/agentguard/rules` — 规则列表
- `GET /api/openclaw/agentguard/traffic` — 流量记录
- `GET /api/openclaw/agentguard/audit` — 审计事件
- `GET /api/openclaw/agentguard/approvals` — 待审批列表
- `GET /api/openclaw/agentguard/tools` — 工具列表
- `GET /api/openclaw/agentguard/skills` — Skill 列表
- `GET /api/openclaw/agentguard/mcps` — MCP 列表

---



## 纵深防御架构

OpenClaw 采用 **5 层纵深防御** 模型，从外到内逐层拦截安全威胁：

```
L1  ClawShell DLP     ← 虚拟密钥隔离 + 敏感数据过滤（SSN/卡号/手机号）
L2  qise 安全守卫      ← 19 个守卫 + 三层决策管线（Rules → SLM → LLM）
L3  OpenClaw 加固      ← Prompt 注入检测 + Tool Call 审计 + 沙箱隔离 + AgentGuard 零信任干预
L4  ClawKeeper         ← Skill 策略注入 + Plugin Hook 拦截 + Watcher 监控
L5  Docker 沙箱        ← 网络隔离（none）+ 只读根文件系统
```

**双龙虾对比**：
- **裸奔龙虾**（端口 19789）：直连 API，无防护
- **安全龙虾**（端口 20789）：完整 5 层防御

前端攻防演练页面（`/openclaw/sandbox`）实时展示各层拦截情况。

---

## 相关文档

- [Aegis 前后端架构说明](./AEGIS_ARCHITECTURE.md)
- [部署与配置指南](./DEPLOYMENT_GUIDE.md)
- [返回主 README](../README.md)
