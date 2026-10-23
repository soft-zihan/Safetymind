# ClawShell — 安全特权代理

> OpenClaw/Hermes Agent 生态的安全特权代理进程，负责 API 密钥隔离、DLP 数据防泄漏扫描与邮件安全过滤。

**语言**：Rust  
**内存占用**：< 10MB  
**系统服务端口**：21789

---

## 核心定位

ClawShell 是纵深防御的 **L1 层**——最外层防线。它的核心思想是：**Agent 永远不接触真实 API Key**。通过虚拟密钥映射，即使 Agent 被攻破，攻击者拿到的也只是无用的虚拟密钥。

---

## 核心功能

### API 密钥隔离

```
Agent 持有: vk_xxxxx（虚拟密钥）
     ↓ 请求到达 ClawShell
ClawShell 查表: vk_xxxxx → sk-real-key（真实密钥）
     ↓ 替换后转发
目标 API 收到: sk-real-key
```

- 真实密钥存储在 `/etc/clawshell`（权限 700），由 Unix 文件系统权限保护
- 无需外部 IdP/Vault 依赖
- Agent 端只看到虚拟密钥，无法泄露真实凭证

### DLP 数据防泄漏

对请求/响应体进行 PII 扫描：

| 检测类型 | 模式 | 说明 |
|---------|------|------|
| SSN（社会安全号） | `block` / `redact` | 拦截或脱敏 |
| 信用卡号 | `block` / `redact` | Luhn 算法验证 |
| 手机号 | `block` / `redact` | 正则匹配 |
| 自定义模式 | 可配置 | 正则表达式扩展 |

### 邮件安全隔离

- 基于发送者白名单/黑名单过滤
- IMAP 凭证同样特权存储
- 支持 Gmail/Outlook 预设

### OAuth 认证

- 支持 Codex/ChatGPT 设备码登录流程
- 自动刷新 Token
- 请求格式自动转换

### 运行时统计

- `/admin/stats` 端点暴露请求计数、Token 用量
- 仅允许本地回环访问
- 支持持久化

---

## 技术亮点

- **基于 Unix 文件系统权限的安全边界**：无需外部 IdP/Vault，简单可靠
- **极致轻量**：内存占用 < 10MB，对系统性能零影响
- **双 Agent 模式**：同时适配 OpenClaw 与 Hermes，一键 `onboard` 向导式接入
- **双安装方式**：同时提供 Cargo 与 NPM 两种安装方式

---

## 关键目录结构

```
clawshell/src/
├── main.rs / app.rs        # 主入口与应用逻辑
├── proxy.rs / translate.rs # 代理转发与请求翻译
├── dlp.rs                  # DLP 扫描引擎
├── email.rs                # 邮件隔离与过滤
├── keys.rs                 # 虚拟/真实密钥映射
├── oauth/                  # OAuth 认证模块
├── onboard/                # 交互式接入向导
├── config.rs / migration/  # 配置管理与版本迁移
└── stats.rs                # 运行时统计
```

---

## 技术栈

- **语言**：Rust
- **异步运行时**：Tokio
- **Web 框架**：Axum
- **HTTP 客户端**：Reqwest（rustls）
- **CLI**：Clap
- **系统权限**：Nix
- **日志**：Tracing 结构化日志
