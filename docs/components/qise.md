# qise — 核心安全框架

> 面向 AI Agent 的本地优先安全框架，通过 14 类 Guard、本地代理和可选小模型语义审查，为 Codex、OpenClaw、Hermes 等 Agent 提供运行时安全防护。

**出品方**：上海创智学院（SII）| 复旦大学  
**版本**：0.2.0（Alpha/MVP）  
**语言**：Python

---

## 核心定位

qise 是 SafetyMind 的**安全引擎核心**，负责所有安全守卫的实际判定逻辑。它独立于具体 Agent 运行，通过 **Proxy 代理** 或 **SDK 适配器** 两种方式接入，为不同智能体提供统一的安全防护能力。

---

## 核心功能

### 14 类安全守卫

覆盖 Ingress（入口）/ Egress（出口）/ Output（输出）三条流水线：

| 守卫 | 阶段 | 职责 |
|------|------|------|
| `PromptGuard` | Ingress | 提示注入检测 |
| `CommandGuard` | Ingress | 危险命令阻断 |
| `ToolPoisonGuard` | Ingress | 工具投毒识别 |
| `FilesystemGuard` | Egress | 文件系统保护 |
| `NetworkGuard` | Egress | 网络风险拦截 |
| `ExfilGuard` | Egress | 数据外传检测 |
| `CredentialGuard` | Output | 凭据泄露防护 |
| `CanNetworkGuard` | Egress | CAN 总线安全（车用） |
| `FirmwareIntegrityGuard` | Ingress | 固件完整性（车用） |
| `VehicleDataGuard` | Output | 车辆数据隐私（车用） |
| `ObdDiagnosticGuard` | Egress | OBD/UDS 诊断（车用） |
| `OtaUpdateGuard` | Ingress | OTA 更新安全（车用） |
| ... | ... | 更多守卫持续扩展 |

### 三层决策管线

```
输入 → [规则引擎] → 快速判定（低延迟，零误报）
         ↓ 不确定
     [本地 SLM] → 语义审查（Ollama, ~100ms）
         ↓ 不确定
     [远程 LLM] → 兜底判定（高精度，高延迟）
```

**设计哲学**：能用规则解决的不用模型（快），必须用语义的才上模型（准）。规则 Guard 默认强制执行（enforce），AI Guard 默认观察模式（observe），可按需升级。

### 透明代理（Guard Proxy）

以旁路代理方式拦截模型流量，支持 OpenAI-compatible 和 Anthropic Messages 协议：

- 零代码集成：只需修改 `OPENAI_API_BASE` 环境变量
- 支持流式响应
- 自动解析 SSE 流，逐块检查

### SDK 适配器

提供 5 种框架适配器，支持进程内安全检查：

| 适配器 | 目标框架 |
|--------|---------|
| `QiseHermesAdapter` | Hermes 铁翼信使 |
| `LangGraphAdapter` | LangGraph |
| `OpenAIAgentsAdapter` | OpenAI Agents SDK |
| `NanobotAdapter` | Nanobot |
| `NexAUAdapter` | NexAU |

### 安全分类模型

| 模型 | 基座 | 参数量 | F1 | 用途 |
|------|------|--------|-----|------|
| QiseGuard-2B | Qwen3.5-2B | 2B LoRA | 0.973 | 主力安全分类 |
| QiseGuard-0.8B | Qwen3.5-0.8B | 0.8B LoRA | 0.941 | 快速筛查 |

---

## 技术亮点

- **Local-first 设计**：所有状态、备份、事件存储在本地 `~/.qise/`，不依赖云端
- **规则+AI 双层防御**：低误报规则强制执行，AI 驱动守卫观察模式按需启用
- **统一产品引擎**：CLI 和桌面应用共享同一套 Python 引擎，行为一致
- **专用训练管线**：`model_training/` 包含完整的 QiseGuard-SLM 训练数据流程，覆盖 10 类安全分类，整合 13 个 HuggingFace 数据集

---

## 关键目录结构

```
qise/
├── src/qise/
│   ├── guards/           # 14 类 Guard 实现
│   ├── core/             # 核心引擎（pipeline、shield、event_logger）
│   ├── proxy/            # 本地代理（server、parser、streaming）
│   ├── adapters/         # 5 种框架适配器
│   ├── product/          # 用户流程（protect/restore/scan/status）
│   └── bridge/           # 桌面 UI 与 Guard 控制的本地 bridge
├── src-ui/               # React + TypeScript 桌面前端
├── src-tauri/            # Tauri 2 Rust 桌面外壳
├── model_training/       # QiseGuard-SLM 训练数据管线
└── data/                 # 威胁模式、安全上下文、prompt 示例
```

---

## 接入方式

### Proxy 模式（推荐，零代码）

```bash
# 启动 qise 代理
qise protect

# 修改环境变量指向代理
export OPENAI_API_BASE=http://localhost:8822/v1

# 所有 API 调用自动经过安全检查
```

### SDK 模式（Hermes 接入示例）

```python
from qise.adapters.hermes import QiseHermesAdapter

shield = Shield.from_config()
adapter = QiseHermesAdapter(shield, session_id="hermes-session")

# 工具调用包装 — 执行前自动安全检查
safe_tools = [adapter.wrap_tool(tool) for tool in my_tools]

# 输出检查 — 凭据/PII 泄露检测
result = adapter.check_agent_output(response)
```

---

## 技术栈

- **后端引擎**：Python 3.11+，Pydantic v2，httpx，aiohttp
- **桌面应用**：Tauri 2（Rust）+ React + TypeScript + Vite
- **SLM 推理**：Ollama（OpenAI-compatible endpoint）
- **模型训练**：LoRA 微调，HuggingFace 生态
- **构建工具**：Hatchling
