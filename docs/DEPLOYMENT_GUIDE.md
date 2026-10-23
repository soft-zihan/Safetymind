# SafetyMind 部署与配置指南

> 本文档帮助用户从零开始部署 SafetyMind 平台，配置所有安全组件，成功运行双轨安全防护。

---

## 目录

- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [手动部署](#手动部署)
- [环境变量配置](#环境变量配置)
- [安全组件配置](#安全组件配置)
  - [qise 安全框架](#1-qise-安全框架)
  - [ClawShell 安全代理](#2-clawshell-安全代理)
  - [ClawKeeper 三层防护](#3-clawkeeper-三层防护)
  - [NemoClaw 沙箱](#4-nemoclaw-沙箱)
  - [Pipelock AI 防火墙](#5-pipelock-ai-防火墙)
  - [OpenClaw 安全助手](#6-openclaw-安全助手)
  - [Hermes 集成](#7-hermes-集成)
  - [AgentGuard 零信任框架](#8-agentguard-零信任框架)
- [服务端口一览](#服务端口一览)
- [验证部署](#验证部署)
- [常见问题](#常见问题)

---

## 环境要求

### 必需

| 依赖 | 版本 | 说明 |
|------|------|------|
| Python | 3.9+ | 后端运行环境 |
| Node.js | 18+ | 前端运行环境 |
| npm | 9+ | 前端包管理 |

### 可选（推荐）

| 依赖 | 版本 | 说明 |
|------|------|------|
| Docker Desktop | 24+ | 沙箱隔离、Hermes 服务栈 |
| Ollama | 0.5+ | 本地安全模型推理 |
| Rust/Cargo | 1.70+ | ClawShell 编译（或使用预编译二进制） |
| Go | 1.25+ | Pipelock 编译（或使用预编译二进制） |

---

## 快速开始

最简单的方式：一键启动。

```bash
# 1. 克隆仓库
git clone <repo-url>
cd Safetymind

# 2. 复制配置文件
cp Aegis/backend/.env.example Aegis/backend/.env

# 3. 编辑配置（至少设置 OPENAI_API_KEY）
vim Aegis/backend/.env

# 4. 一键启动
cd Aegis
./start.sh start
```

启动后访问：
- **前端界面**：http://localhost:5173
- **后端 API 文档**：http://localhost:8000/docs
- **Ollama 模型服务**：http://localhost:11434
- **ClawShell 代理**：http://localhost:21789

---

## 手动部署

如需精细控制各服务的启动。

### 1. 部署后端

```bash
cd Aegis/backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
vim .env  # 编辑配置

# 启动
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. 部署前端

```bash
cd Aegis/frontend

# 安装依赖
npm install

# 开发模式
npm run dev

# 或构建生产版本
npm run build
```

### 3. 部署 Ollama（推荐）

```bash
# 安装 Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 部署基础模型
ollama pull qwen3:4b

# 部署安全模型（可选）
cd qise/model_training/models/qiseguard-2b-v0.1
ollama create qiseguard:2b -f Modelfile
```

### 4. 部署 ClawShell（可选）

```bash
# 方式一：使用预编译二进制
# 从 GitHub Releases 下载

# 方式二：从源码编译
cd clawshell
cargo build --release
# 二进制位于 target/release/clawshell

# 启动
clawshell --config clawshell.dev.toml
```

---

## 环境变量配置

配置文件位于 `Aegis/backend/.env`，所有配置项如下：

### 大模型 API

```bash
# 远程 LLM API（用于 AI 评判兜底）
JUDGE_MODEL_API_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
JUDGE_MODEL_API_KEY=sk-xxx
JUDGE_MODEL_NAME=qwen3.6-plus

# 本地模型（优先使用）
LOCAL_MODEL_BASE_URL=http://localhost:11434/v1
LOCAL_MODEL_NAME=qiseguard:2b
LOCAL_MODEL_API_KEY=local
LOCAL_MODEL_TIMEOUT=30000
USE_LOCAL_JUDGE=true  # true=优先本地模型
```

### OpenClaw 配置

```bash
# OpenClaw Gateway
OPENCLAW_AUTH_TOKEN=your-token-here
OPENCLAW_CONFIG_PATH=~/.openclaw/openclaw.json

# 安全策略
SAFE_BINS=ls,grep,cat,head,tail,wc,find,date,echo,curl,jq,python3
ELEVATED_MODE=ask  # ask|deny|allow
ELEVATED_GATES=exec,browser,write,apply_patch
DM_POLICY=paired-only
GROUP_POLICY=allowlisted
```

### Docker 沙箱

```bash
SANDBOX_IMAGE=openclaw-sandbox:bookworm-slim
SANDBOX_CONTAINER_PREFIX=openclaw-sbx-
SANDBOX_NETWORK=none        # none=完全隔离
SANDBOX_READONLY_ROOT=true  # 只读根文件系统
SANDBOX_MEMORY=2g
SANDBOX_CPUS=1.0
```

### Hermes 配置

```bash
HERMES_CONFIG_PATH=~/.hermes/config.yaml
HERMES_AGENT_URL=http://localhost:8081
HERMES_PLUGINS_PATH=~/.hermes/plugins
HERMES_TIRITH_PATH=         # 空=自动检测
HERMES_UPSTREAM_PATH=       # 空=自动检测（指向 hermes/ 目录）
```

### ClawShell 配置

```bash
CLAWSHELL_BASE_URL=http://127.0.0.1:21789
CLAWSHELL_BIN_PATH=         # 空=自动检测
CLAWSHELL_CONFIG_PATH=      # ClawShell 配置文件路径
```

### AgentGuard 配置

```bash
AGENTGUARD_SERVER_URL=http://127.0.0.1:38080   # AgentGuard 控制服务器地址
```

### 演示用敏感信息

```bash
# 用于攻防演练演示
ALIPAY_KEY=
ID_CARD_NUMBER=
MOBILE_NUMBER=
```

---

## 安全组件配置

### 1. qise 安全框架

qise 作为核心安全框架，无需额外安装，后端启动时自动加载。

**验证**：
```bash
# 检查 qise 状态
curl http://localhost:8000/api/tools/qise/status
```

**配置守卫**：
```bash
# 查看可用守卫
curl http://localhost:8000/api/tools/qise/guards
```

**接入 OpenClaw（Proxy 模式）**：
```bash
# 安全龙虾 Gateway 流量经过 qise proxy
export OPENAI_API_BASE=http://localhost:8822/v1
```

**接入 Hermes（SDK 模式）**：
在 Aegis 后端自动完成，通过 `/api/hermes/qise/*` API 管理。

---

### 2. ClawShell 安全代理

**安装**：
```bash
# 方式一：预编译二进制（推荐）
# 从 https://github.com/anthropics/clawshell/releases 下载

# 方式二：从源码编译
cd clawshell
cargo build --release
sudo cp target/release/clawshell /usr/local/bin/
```

**配置**：
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

**启动**：
```bash
# 通过 start.sh 管理
./start.sh start
./start.sh stop
./start.sh restart

# 或手动启动
clawshell --config clawshell.dev.toml
```

**验证**：
```bash
curl http://localhost:21789/status
curl http://localhost:8000/api/clawshell/status
```

---

### 3. ClawKeeper 三层防护

**Skill 层**：
```bash
# 安装 Windows 安全指南
cd ClawKeeper/clawkeeper-skill/skills/windows-safety-guide
./scripts/install.ps1

# 安装飞书安全指南
cd ClawKeeper/clawkeeper-skill/skills/feishu-safety-guide
bash scripts/install.sh
```

**Plugin 层**：
```bash
cd ClawKeeper/clawkeeper-plugin

# Linux/macOS
bash install.sh

# Windows
./install.ps1

# 验证
npx openclaw clawkeeper audit
```

**Watcher 层**：
```bash
cd ClawKeeper/clawkeeper-watcher

# 安装依赖
pnpm install

# 构建启动器
cd clawkeeper
npm install
npm run build
npm link

# 初始化模式
clawkeeper init remote  # 远程治理
clawkeeper init local   # 本地治理

# 启动
clawkeeper remote gateway run
# 或
clawkeeper local gateway run
```

---

### 4. NemoClaw 沙箱

**安装**：
```bash
cd NemoClaw

# 运行安装脚本
bash install.sh
```

**使用 OpenClaw（默认）**：
```bash
nemoclaw init
nemoclaw start
```

**使用 Hermes**：
```bash
export NEMOCLAW_AGENT=hermes
nemoclaw init
nemoclaw start
```

**验证**：
```bash
nemoclaw status
```

---

### 5. Pipelock AI 防火墙

**安装**：
```bash
# macOS
brew install luckyPipewrench/tap/pipelock

# 或从源码
go install github.com/luckyPipewrench/pipelock/cmd/pipelock@latest

# 或 Docker
docker pull ghcr.io/luckypipewrench/pipelock:latest
```

**初始化**：
```bash
pipelock init
```

**测试**：
```bash
# 应被拦截
pipelock check --url "https://evil.com/?k=AKIAIOSFODNN7EXAMPLE"

# 应被放行
pipelock check --url "https://docs.python.org/3/"
```

---

### 6. OpenClaw 安全助手

**配置**：
```json
// ~/.openclaw/openclaw.json
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

**启用**：
```bash
# 重启 Gateway
openclaw restart
```

**验证**：
```bash
openclaw ali-osa health
```

---

### 7. Hermes 集成

**连接各安全组件**：
```bash
cd Aegis

# 连接 ClawShell
bash scripts/hermes/connect-clawshell.sh

# 连接 qise
bash scripts/hermes/connect-qise.sh

# 连接 NemoClaw
bash scripts/hermes/connect-nemoclaw.sh

# 验证集成状态
bash scripts/hermes/verify-hermes.sh
```

**Evey 一键部署完整栈**：
```bash
cd hermes/evey-setup

# 交互式安装
bash setup.sh

# 或一键安装所有
bash install.sh
```

---

### 8. AgentGuard 零信任框架

**部署控制服务器**：
```bash
cd openclaw/AgentGuard

# 启动控制服务器（守护模式）
./scripts/start.sh -d

# 或手动启动
python -m uvicorn backend.api.app:app --host 0.0.0.0 --port 38080
```

**配置 OpenClaw 插件**：
```json
// OpenClaw 插件配置中指向 AgentGuard
{
  "plugins": {
    "agentguard": {
      "enabled": true,
      "config": {
        "serverUrl": "http://127.0.0.1:38080",
        "apiKeyEnvVar": "AGENTGUARD_API_KEY",
        "policy": { "defaultAction": "deny" }
      }
    }
  }
}
```

**验证**：
```bash
# 检查控制服务器状态
curl http://localhost:38080/v1/backend/health

# 通过 Aegis 后端检查
curl http://localhost:8000/api/openclaw/agentguard/status
```

---

## 服务端口一览

| 服务 | 端口 | 说明 |
|------|------|------|
| Aegis 前端 | 5173 | React 开发服务器 |
| Aegis 后端 | 8000 | FastAPI 服务 |
| Ollama | 11434 | 本地模型推理 |
| ClawShell | 21789 | 安全代理服务 |
| 裸奔龙虾 Gateway | 19789 | OpenClaw 无防护 |
| 安全龙虾 Gateway | 20789 | OpenClaw 5 层防御 |
| qise Proxy | 8822 | qise 透明代理 |
| Hermes Agent | 8081 | Hermes 服务 |
| Hermes Dashboard | 8642 | Hermes 面板 |
| LiteLLM | 4000 | 模型路由代理 |
| SearXNG | 8888 | 元搜索引擎 |
| Qdrant | 6333 | 向量数据库 |
| n8n | 5678 | 工作流自动化 |
| Langfuse | 3100 | LLM 成本追踪 |
| Uptime Kuma | 3001 | 服务监控 |
| AgentGuard 控制服务器 | 38080 | AgentGuard 策略引擎 + API |
| AgentGuard UI 控制台 | 38008 | AgentGuard 可视化管理 |

---

## 验证部署

### 1. 检查服务状态

```bash
# 一键查看所有服务状态
./start.sh status

# 或手动检查
curl http://localhost:8000/api/security/status
curl http://localhost:8000/api/clawshell/status
curl http://localhost:8000/api/hermes/status
```

### 2. 访问前端

打开 http://localhost:5173，应看到 Aegis 神盾平台总览页。

### 3. 验证安全组件

```bash
# qise 状态
curl http://localhost:8000/api/tools/qise/status

# ClawShell 状态
curl http://localhost:8000/api/clawshell/status

# ClawKeeper 状态
curl http://localhost:8000/api/openclaw/clawkeeper/status

# AgentGuard 状态
curl http://localhost:8000/api/openclaw/agentguard/status
```

### 4. 攻防演练

访问 http://localhost:5173/openclaw/sandbox，查看 5 层纵深防御可视化。

---

## 常见问题

### Q: 启动失败，端口被占用

检查端口占用：
```bash
lsof -i :5173
lsof -i :8000
lsof -i :21789
```

### Q: Ollama 模型加载慢

首次加载模型需要下载，可能需要几分钟。确保网络连接稳定。

### Q: ClawShell 无法启动

检查是否已编译：
```bash
which clawshell
# 或指定路径
export CLAWSHELL_BIN_PATH=/path/to/clawshell
```

### Q: 前端页面空白

检查后端是否正常运行：
```bash
curl http://localhost:8000/docs
```

### Q: Docker 沙箱不工作

确保 Docker Desktop 已启动：
```bash
docker ps
```

### Q: AgentGuard 控制服务器无法连接

检查 AgentGuard 是否已启动：
```bash
curl http://localhost:38080/v1/backend/health
```

如果未启动：
```bash
cd openclaw/AgentGuard
./scripts/start.sh -d
```

确认 `AGENTGUARD_SERVER_URL` 环境变量配置正确（默认 `http://127.0.0.1:38080`）。

### Q: AgentGuard 前端页面显示“未连接”

说明 Aegis 后端无法访问 AgentGuard 控制服务器。检查：
1. AgentGuard 控制服务器是否运行在 38080 端口
2. 网络是否可达（默认监听 127.0.0.1）
3. 环境变量 `AGENTGUARD_SERVER_URL` 是否正确

---

## 相关文档

- [安全组件详细说明](./SECURITY_COMPONENTS.md)
- [Aegis 前后端架构说明](./AEGIS_ARCHITECTURE.md)
- [返回主 README](../README.md)
