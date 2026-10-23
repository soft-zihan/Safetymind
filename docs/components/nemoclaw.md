# NemoClaw — NVIDIA 沙箱参考栈

> 在 NVIDIA OpenShell 沙箱内安全运行 Always-on AI Agent，支持 OpenClaw、Hermes、LangChain Deep Agents 三种 Agent 变体。

**语言**：TypeScript / Node.js (≥22)  
**出品方**：NVIDIA

---

## 核心定位

NemoClaw 提供了一个**安全运行环境**——即使 Agent 被攻破，攻击者也被限制在沙箱内，无法影响宿主机或其他服务。它是纵深防御的最后一层（L5），为上层所有安全机制提供运行环境保障。

---

## 核心功能

### 沙箱化运行

- 基于 NVIDIA OpenShell 沙箱隔离
- 容器安全加固（capability 降级、进程限制）
- 网络策略引擎：静态/动态规则 + 操作员审批流
- 精细控制 Agent 出站流量

### 多 Agent 支持

统一 CLI 入口，支持三种 Agent 变体：

| Agent | 说明 |
|-------|------|
| OpenClaw | 金刚龙虾，通用自主 Agent |
| Hermes | 铁翼信使，通信协作 Agent |
| LangChain Deep Agents | LangChain 深度 Agent |

### 引导式部署

- 一键沙箱创建
- 自动安全加固蓝图
- 路由推理（多云 Provider 支持）
- 全生命周期管理

### Agent Skills 体系

内置丰富的技能系统：

- 入门引导
- 推理配置
- 安全加固
- 策略管理
- 远程部署

---

## 技术亮点

- **OpenShell 沙箱隔离**：容器级安全边界，纵深防御最后一层
- **网络策略引擎**：精细控制 Agent 可以访问哪些网络资源
- **插件化架构**：Plugin + Blueprint 模式，支持多 Agent 变体热切换
- **路由推理**：统一推理网关，支持多云 Provider（含 AWS Bedrock）

---

## 技术栈

- **语言**：TypeScript / Node.js (≥22)
- **CLI**：oclif 框架
- **容器**：Docker
- **测试**：Vitest
- **代码质量**：Biome
- **文档**：Fern 生成
- **云集成**：AWS Bedrock SDK
