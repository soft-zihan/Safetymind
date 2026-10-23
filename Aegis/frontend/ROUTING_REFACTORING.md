# Aegis 前端路由和菜单重构说明

## 重构概述

本次重构优化了 SafetyMind Aegis 前端的路由和菜单结构,解决了以下问题:

1. ✅ 删除了混乱的"智能体管理"顶级菜单
2. ✅ 将 Agent 管理功能拆分到各自的安全模块中
3. ✅ 为 OpenClaw 添加了裸奔龙虾和金刚龙虾的独立管理页面
4. ✅ 为 Hermes 添加了统一的 Agent 状态管理页面
5. ✅ 实现了可复用的聊天界面组件
6. ✅ 优化了菜单层级结构,更加清晰合理

---

## 新的菜单结构

```
侧边栏菜单：
├── 总览
├── ── 分隔线 ──
├── 金刚龙虾安全
│   ├── 裸奔龙虾 (19789) ← 新增: Agent 状态 + 聊天界面
│   ├── 金刚龙虾 (20789) ← 新增: Agent 状态 + 聊天界面
│   ├── 攻防演练
│   ├── 审计报告
│   └── 加固指南
├── 铁翼信使安全
│   ├── Agent 状态 ← 新增: Hermes Agent 管理
│   ├── 聊天界面 ← 新增: 与 Hermes 对话
│   ├── 安全扫描
│   ├── 审计报告
│   ├── 插件管理
│   └── 加固指南
├── qise 安全防护
│   ├── 上线前扫描
│   ├── 智能体防护
│   ├── 安全事件
│   ├── 防护规则
│   ├── 模型评估
│   ├── 数据集管理
│   ├── 本地小模型
│   ├── 系统诊断
│   ├── 运行观察
│   ├── 备份恢复
│   └── 集成管理
├── ClawKeeper
└── ClawShell 代理
```

---

## 路由映射表

### 金刚龙虾安全 (OpenClaw)

| 菜单项 | 路由路径 | 页面组件 | 说明 |
|--------|---------|---------|------|
| 裸奔龙虾 (19789) | `/openclaw/naked` | `pages/openclaw/NakedAgent.tsx` | 裸奔龙虾 Agent 管理和聊天 |
| 金刚龙虾 (20789) | `/openclaw/hardened` | `pages/openclaw/HardenedAgent.tsx` | 金刚龙虾 Agent 管理和聊天 |
| 攻防演练 | `/openclaw/sandbox` | `pages/openclaw/Sandbox.tsx` | 攻防演练沙盒 |
| 审计报告 | `/openclaw/audit` | `pages/openclaw/Audit.tsx` | 审计报告中心 |
| 加固指南 | `/openclaw/hardening` | `pages/openclaw/HardeningGuide.tsx` | 安全加固指南 |
| 金刚龙虾仪表盘 | `/openclaw/dashboard` | `pages/overview/Dashboard.tsx` | 保留兼容,分数仪表盘 |

### 铁翼信使安全 (Hermes)

| 菜单项 | 路由路径 | 页面组件 | 说明 |
|--------|---------|---------|------|
| Agent 状态 | `/hermes/agent` | `pages/hermes/HermesAgent.tsx` | Hermes Agent 状态管理 |
| 聊天界面 | `/hermes/chat` | `pages/hermes/HermesAgent.tsx` | 与 Hermes 对话 (复用 Agent 页面) |
| 安全扫描 | `/hermes/scan` | `pages/hermes/HermesSecurityScan.tsx` | 安全扫描 |
| 审计报告 | `/hermes/audit` | `pages/hermes/HermesAudit.tsx` | 审计报告 |
| 插件管理 | `/hermes/plugins` | `pages/hermes/HermesPlugins.tsx` | 插件管理 |
| 加固指南 | `/hermes/hardening` | `pages/hermes/HermesHardening.tsx` | 加固指南 |

### qise 安全防护

| 菜单项 | 路由路径 | 页面组件 |
|--------|---------|---------|
| 上线前扫描 | `/qise/preflight` | `pages/tools/Preflight.tsx` |
| 智能体防护 | `/qise/shield` | `pages/tools/Shield.tsx` |
| 安全事件 | `/qise/events` | `pages/tools/SecurityEvents.tsx` |
| 防护规则 | `/qise/rules` | `pages/tools/ProtectionRules.tsx` |
| 模型评估 | `/qise/eval` | `pages/tools/Evaluation.tsx` |
| 数据集管理 | `/qise/datasets` | `pages/tools/DatasetManager.tsx` |
| 本地小模型 | `/qise/slm` | `pages/tools/LocalSLM.tsx` |
| 系统诊断 | `/qise/doctor` | `pages/tools/SystemDoctor.tsx` |
| 运行观察 | `/qise/observer` | `pages/tools/RuntimeObserver.tsx` |
| 备份恢复 | `/qise/backup` | `pages/tools/BackupRestore.tsx` |
| 集成管理 | `/qise/integrations` | `pages/system/Integrations.tsx` |

### 其他

| 菜单项 | 路由路径 | 页面组件 |
|--------|---------|---------|
| 总览 | `/` | `pages/overview/Home.tsx` |
| ClawKeeper | `/clawkeeper` | `pages/openclaw/ClawKeeperManager.tsx` |
| ClawShell 代理 | `/clawshell` | `pages/clawshell/ClawShellDualAgent.tsx` |

---

## 新建文件清单

### 1. 聊天界面组件
**文件**: `frontend/src/components/ChatInterface.tsx`

**功能**:
- ✅ 实时消息发送和接收
- ✅ 消息历史显示 (支持自动滚动)
- ✅ Agent 状态显示 (在线/离线/错误)
- ✅ 错误处理和提示
- ✅ 清空聊天记录
- ✅ Enter 发送, Shift+Enter 换行
- ✅ 支持超时和重试

**Props**:
```typescript
interface ChatInterfaceProps {
  apiUrl: string           // Agent API 地址
  agentName: string        // Agent 名称
  agentPort: number        // Agent 端口
  agentStatus?: 'online' | 'offline' | 'error'  // Agent 状态
}
```

### 2. 裸奔龙虾管理页面
**文件**: `frontend/src/pages/openclaw/NakedAgent.tsx`

**功能**:
- ✅ Agent 状态显示 (运行状态、端口、版本、模型等)
- ✅ Skills 列表展示
- ✅ Plugins 列表展示
- ✅ 聊天界面集成
- ✅ 安全警告提示
- ✅ 数据刷新功能

**API 端点**:
- `GET /api/openclaw/naked/status` - 获取 Agent 状态
- `GET /api/openclaw/naked/skills` - 获取 Skills 列表
- `GET /api/openclaw/naked/plugins` - 获取 Plugins 列表
- `POST /api/agent/chat` - 发送聊天消息

### 3. 金刚龙虾管理页面
**文件**: `frontend/src/pages/openclaw/HardenedAgent.tsx`

**功能**:
- ✅ Agent 状态显示 (运行状态、端口、版本、模型等)
- ✅ 安全等级显示
- ✅ 活跃防御层展示
- ✅ Skills 列表 (含安全验证标记)
- ✅ Plugins 列表 (含安全检查标记)
- ✅ 防御层配置展示
- ✅ 聊天界面集成
- ✅ 安全防护提示

**API 端点**:
- `GET /api/openclaw/hardened/status` - 获取 Agent 状态
- `GET /api/openclaw/hardened/skills` - 获取 Skills 列表
- `GET /api/openclaw/hardened/plugins` - 获取 Plugins 列表
- `GET /api/openclaw/hardened/defense` - 获取防御层配置
- `POST /api/agent/chat` - 发送聊天消息

### 4. 铁翼信使 Agent 管理页面
**文件**: `frontend/src/pages/hermes/HermesAgent.tsx`

**功能**:
- ✅ Hermes 整体状态显示
- ✅ Agent 列表展示 (表格形式)
- ✅ 每个 Agent 的详细状态
- ✅ 聊天界面集成
- ✅ 数据刷新功能

**API 端点**:
- `GET /api/hermes/status` - 获取 Hermes 状态
- `GET /api/hermes/agents` - 获取 Agent 列表
- `POST /api/agent/chat` - 发送聊天消息

---

## 修改文件清单

### App.tsx
**文件**: `frontend/src/App.tsx`

**主要变更**:
1. ✅ 删除了"智能体管理"顶级菜单
2. ✅ 将 Agent 管理页面移到各自的安全模块下
3. ✅ 添加了新的路由:
   - `/openclaw/naked` - 裸奔龙虾
   - `/openclaw/hardened` - 金刚龙虾
   - `/hermes/agent` - Hermes Agent 状态
   - `/hermes/chat` - Hermes 聊天界面
4. ✅ 更新了菜单状态映射逻辑
5. ✅ 更新了页面标题映射
6. ✅ 优化了菜单分组和顺序

---

## 技术实现细节

### 聊天界面实现

聊天界面使用了以下技术:

1. **状态管理**: 使用 React useState 管理消息列表、输入内容、加载状态
2. **自动滚动**: 使用 useRef 和 scrollIntoView 实现新消息自动滚动
3. **错误处理**: 完整的 try-catch 错误处理和用户提示
4. **键盘事件**: Enter 发送, Shift+Enter 换行
5. **超时控制**: 60 秒超时设置
6. **UI 组件**: 使用 Ant Design 的 Card, Input, Button, List, Avatar, Tag 等组件

### 页面布局

所有 Agent 管理页面遵循统一的布局结构:

1. **页面标题**: 包含图标、名称、端口标签、状态标签
2. **状态卡片**: 4 列统计卡片显示关键指标
3. **详细信息**: Descriptions 组件展示详细配置
4. **Skills/Plugins**: 双列布局展示技能 and 插件
5. **聊天界面**: 全宽卡片集成聊天功能
6. **提示信息**: Alert 组件显示安全警告或提示

---

## 后端 API 需求

为了支持新的前端页面,后端需要提供以下 API 端点:

### OpenClaw API

```
GET  /api/openclaw/naked/status       # 裸奔龙虾状态
GET  /api/openclaw/naked/skills       # 裸奔龙虾 Skills
GET  /api/openclaw/naked/plugins      # 裸奔龙虾 Plugins
GET  /api/openclaw/hardened/status    # 金刚龙虾状态
GET  /api/openclaw/hardened/skills    # 金刚龙虾 Skills
GET  /api/openclaw/hardened/plugins   # 金刚龙虾 Plugins
GET  /api/openclaw/hardened/defense   # 金刚龙虾防御层
```

### Hermes API

```
GET  /api/hermes/status               # Hermes 状态
GET  /api/hermes/agents               # Agent 列表
```

### 通用聊天 API

```
POST /api/agent/chat                  # 发送聊天消息
  Body: {
    message: string,      // 用户消息
    agent_url: string,    // Agent API 地址
    agent_port: number    // Agent 端口
  }
  Response: {
    response: string      // Agent 回复
  }
```

---

## 兼容性说明

### 保留的路由

以下路由保持不变,确保向后兼容:

- `/openclaw/dashboard` - 金刚龙虾仪表盘 (分数dashboard)
- `/openclaw/sandbox` - 攻防演练
- `/openclaw/audit` - 审计报告
- `/openclaw/hardening` - 加固指南
- `/hermes/scan` - 安全扫描
- `/hermes/plugins` - 插件管理
- 所有 `/qise/*` 路由
- `/clawkeeper`
- `/clawshell`

### 废弃的路由

以下路由已废弃,不再使用:

- `/hermes/agents` → 改为 `/hermes/agent`

---

## 测试建议

### 功能测试

1. **菜单导航**: 测试所有菜单项点击后能否正确跳转
2. **路由匹配**: 测试直接访问 URL 能否正确加载页面
3. **状态显示**: 测试 Agent 在线/离线状态的显示
4. **聊天功能**: 测试消息发送、接收、显示
5. **错误处理**: 测试 Agent 不可用时的错误提示
6. **数据刷新**: 测试刷新按钮功能

### 边界测试

1. Agent 离线时的页面展示
2. 网络超时时的错误处理
3. 空数据时的默认显示
4. 长消息的显示和换行
5. 快速连续发送的处理

---

## 后续优化建议

1. **WebSocket 支持**: 将聊天改为实时双向通信
2. **消息历史**: 添加消息持久化和历史记录
3. **多轮对话**: 支持上下文保持和对话管理
4. **文件上传**: 支持发送图片和文件
5. **Markdown 渲染**: 支持 Agent 回复的 Markdown 格式
6. **快捷键**: 添加更多键盘快捷键支持
7. **主题切换**: 支持深色/浅色主题
8. **响应式优化**: 优化移动端显示

---

## 总结

本次重构完成了以下目标:

✅ 删除了混乱的"智能体管理"菜单  
✅ 将 Agent 管理功能拆分到各自安全模块  
✅ 为 OpenClaw 裸奔和加固实例创建独立管理页面  
✅ 为 Hermes 创建统一 Agent 管理页面  
✅ 实现可复用的聊天界面组件  
✅ 优化菜单结构,更加清晰合理  
✅ 保持向后兼容,不影响现有功能  

新的菜单结构更加清晰,功能划分更加合理,用户体验得到显著提升。
