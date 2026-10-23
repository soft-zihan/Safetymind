# 安全组件详细说明

> SafetyMind 各安全组件的独立介绍页。每个组件相对独立，可单独阅读。

---

## 双轨共享组件

这些组件同时为 OpenClaw（金刚龙虾）和 Hermes（铁翼信使）提供安全防护。

| 组件 | 介绍 | 说明 |
|------|------|------|
| **qise** | [→ qise 介绍](qise.md) | 核心安全框架，14 个安全守卫 + 三层决策管线 |
| **ClawShell** | [→ ClawShell 介绍](clawshell.md) | 安全特权代理，虚拟密钥隔离 + DLP 数据防泄漏 |
| **Pipelock** | [→ Pipelock 介绍](pipelock.md) | AI Agent 防火墙，可验证出站控制（VEC） |
| **NemoClaw** | [→ NemoClaw 介绍](nemoclaw.md) | NVIDIA 沙箱参考栈，安全运行环境 |

## 安全分类模型

| 组件 | 介绍 | 说明 |
|------|------|------|
| **CheryGuard** | [→ CheryGuard 介绍](cheryguard.md) | 基于 Qwen3-0.6B 微调的安全分类，Gen + Stream 双架构 |

## OpenClaw 专属组件

这些组件主要为 OpenClaw（金刚龙虾）提供安全防护，下一版本将兼容 Hermes。

| 组件 | 介绍 | 说明 |
|------|------|------|
| **ClawKeeper** | [→ ClawKeeper 介绍](clawkeeper.md) | 三层防护框架：Skill + Plugin + Watcher |
| **AgentGuard** | [→ AgentGuard 介绍](agentguard.md) | 零信任安全框架，四阶段干预 + 攻击链检测 |

## 管理平台

| 组件 | 介绍 | 说明 |
|------|------|------|
| **Aegis** | [→ Aegis 介绍](aegis.md) | 前后端管理平台，38 个页面 + 攻防演练可视化 |

---

## 纵深防御层次

各组件在纵深防御中的位置：

```
L1  ClawShell      ← 虚拟密钥隔离 + DLP 敏感数据过滤
L2  qise           ← 14 个守卫 + 三层决策管线
L3  AgentGuard     ← 零信任四阶段干预 + 攻击链检测
L4  ClawKeeper     ← Skill 策略 + Plugin 拦截 + Watcher 监控
L5  NemoClaw       ← 沙箱网络隔离 + 只读根文件系统
```

**CheryGuard** 作为本地安全分类模型，为 qise 的三层决策管线提供 SLM 层判定能力。

**Aegis** 作为统一管理界面，整合所有组件的安全能力。

**Pipelock** 作为出站防火墙，在 Agent 与网络之间进行内容级检测。
