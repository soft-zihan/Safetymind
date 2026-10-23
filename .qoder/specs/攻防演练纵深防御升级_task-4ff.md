# 攻防演练页面升级：从二元对比到纵深防御全景（v5）

## Context

当前攻防演练页面只做"裸奔龙虾 vs 金刚龙虾"的二元对比，无法体现多套安全组件的协同防御效果。

### 项目架构

项目使用两个 OpenClaw 实例 + Hermes：
- **裸奔龙虾 (naked)** — `~/.openclaw-naked/`，端口 19789，对比基线（不接入安全措施）
- **安全龙虾 (hardened)** — `~/.openclaw-hardened/`，端口 20789，安全加固（接入 ClawShell）
- **默认龙虾** — `~/.openclaw/openclaw.json`，端口 18789，不使用（不接入任何安全措施）
- **Hermes 铁翼信使** — 也需要接入 ClawShell

### 当前问题

1. ClawShell onboard 已完成（选了 OpenClaw 目标），但最后一步 `openclaw config set` 失败
2. hardened 配置 `~/.openclaw-hardened/openclaw.json` **没有** clawshell provider — 流量仍直连 DashScope
3. 默认龙虾配置有无效 ClawKeeper 插件路径（`Adamantine-OpenClaw/`），导致 `openclaw config set` 命令失败
4. Hermes 尚未接入 ClawShell
5. ClawShell 系统服务端口 21789（onboard 时设置）

### 目标架构

```
Aegis 后端 (8000)
  │
  ├─ OpenClawClient.send_message()
  │   │
  │   ├─ [L2 qise 守卫] ← 应用层：请求前 PromptGuard + 响应后 CredentialGuard
  │   ├─ [L1 ClawShell DLP] ← 应用层：响应后 DLP 正则扫描 + 脱敏
  │   ├─ [L4 ClawKeeper Skill] ← 应用层：is_hardened 时注入 safety_prompt
  │   │
  │   └─ HTTP → Gateway (19789 裸奔 / 20789 金刚)
  │              │
  │              ├─ [L3 OpenClaw 加固] ← Gateway 内置：safeBins + SOUL.md + elevated
  │              └─ [L5 Docker 沙箱] ← Gateway 内置：network=none + readOnlyRoot
  │
  └─ AI Judge 评判结果

金刚龙虾 LLM 请求路径（目标）：
  Gateway (20789) → ClawShell (21789) → DashScope API
  这样 L1 DLP 在 ClawShell 层也真实生效（双重保障：应用层 + 代理层）

Hermes LLM 请求路径（目标）：
  Hermes → ClawShell (21789) → DashScope API
```

### 铁律

- **不允许任何前端模拟/仿真** — 所有展示数据必须来自真实 HTTP 请求
- What-If 切换通过真实修改配置 + 重新发送请求实现
- L3/L5 切换需重启 Gateway，前端提示用户等待

---

## Phase 0: 修复基础设施（ClawShell + 配置修复）

### Task 0.1: 清理默认龙虾的 ClawKeeper 引用

编辑 `~/.openclaw/openclaw.json`：
- 删除 `plugins.load.paths`（整个字段，含无效的 `Adamantine-OpenClaw` 路径）
- 删除 `plugins.entries.clawkeeper` 和 `plugins.entries.clawkeeper-watcher`
- 保留其他配置不变

目的：让 `openclaw config set` 命令不再因无效路径报错。默认龙虾不接入任何安全措施。

### Task 0.2: 确认 ClawShell 系统服务状态

```bash
clawshell status
curl -s http://127.0.0.1:21789/admin/stats
```

确认 ClawShell 在端口 21789 正常运行。

### Task 0.3: 手动配置 hardened → ClawShell 路由

onboard 失败导致 `~/.openclaw-hardened/openclaw.json` 缺少 clawshell provider。需要手动添加：

1. 在 `env` 中添加：`"CLAWSHELL_API_KEY": "virtual_key_2"`
2. 在 `agents.defaults.models` 中添加：`"clawshell/qwen3.6-plus": {"alias": "clawshell"}`
3. 在 `models.providers` 中添加：
   ```json
   "clawshell": {
     "api": "openai-completions",
     "apiKey": "${CLAWSHELL_API_KEY}",
     "baseUrl": "http://127.0.0.1:21789/v1",
     "models": [{"id": "qwen3.6-plus", "name": "qwen3.6-plus"}]
   }
   ```

### Task 0.4: 配置 Hermes → ClawShell 路由

```bash
hermes config set model.provider clawshell
hermes config set model.base_url http://127.0.0.1:21789/v1
hermes config set model.api_key virtual_key_2
```

### Task 0.5: 重启 hardened Gateway 并验证

```bash
openclaw --profile hardened gateway restart
curl -s http://127.0.0.1:20789/health
```

发送测试请求，确认流量经过 ClawShell（检查 ClawShell 的 `/admin/stats` 计数增加）。

---

## Phase 1: 接入 L1/L2 防御层 + 模型配置前端化

### Task 1.1: 在 OpenClawClient 中接入 L2 qise 守卫

**文件**: `Aegis/backend/app/services/openclaw_client.py`

在 `send_message()` 中插入真实的 qise 守卫检查：
- 请求发出前：PromptGuard / CommandGuard 等入口守卫
- 响应返回后：OutputGuard / CredentialGuard 等出口守卫
- 实现方式：直接 import qise 的 Python 守卫逻辑，在 Aegis 后端进程内执行
- `self.qise_enabled` 默认 True（金刚），裸奔设为 False，可通过 API 开关

### Task 1.2: 在 OpenClawClient 中接入 L1 ClawShell DLP

**文件**: `Aegis/backend/app/services/openclaw_client.py`

响应返回后用 ClawShell DLP 正则规则扫描：
- 提取 ClawShell 的 DLP 正则（SSN、信用卡、手机号等），Python 实现等效扫描
- `self.dlp_enabled` 默认 True（金刚），裸奔设为 False，可通过 API 开关

### Task 1.3: 新增防御层开关 API

**文件**: `Aegis/backend/app/routers/core/demos.py`

| 端点 | 说明 |
|------|------|
| `POST /api/demos/defense-toggle` | 切换某层防御开关 |
| `GET /api/demos/defense-status` | 获取各层开关状态 |

即时切换：L1/L2/L4（应用层标志位）
需重启 Gateway：L3/L5（修改配置文件）

### Task 1.4: 模型配置前端化

**文件**: `Aegis/backend/app/routers/core/demos.py` + `Sandbox.tsx`

新增 API：`GET/PUT /api/demos/model-config`
前端：场景列表上方添加"模型配置"折叠面板，下拉选择模型 + "应用并重启"按钮

---

## Phase 2: 新增多阶段攻击链场景

### Task 2.1: 扩展数据模型

**文件**: `Aegis/backend/app/data/demo_scenarios.json`

新增 `attack_stages`、`attack_category`、`defense_layers` 字段（向后兼容）。

### Task 2.2-2.5: 新增 4 个多阶段场景

| ID | 场景 | 阶段 | 覆盖层 |
|----|------|------|--------|
| 11 | 社工→记忆投毒→凭据窃取 | 3 | L2/L3/L4 → L1/L2/L3 |
| 12 | 提示注入→命令执行→数据外泄 | 3 | L2 → L3 → L1/L5 |
| 13 | 供应链投毒→权限提升 | 2 | L4 → L5 |
| 14 | 环境探测→沙箱逃逸→横向移动 | 3 | L5 → L5 → L5 |

### Task 2.6: 为现有 10 个场景补充 defense_layers

### Task 2.7: 多阶段攻击执行器

**文件**: `Aegis/backend/app/services/attack_simulator.py`

新增 `simulate_multi_stage_attack()` — 遍历各阶段，并行发送到双 Agent，收集真实拦截结果。

---

## Phase 3: 后端路由扩展

### Task 3.1: 新增 API

**文件**: `Aegis/backend/app/routers/core/demos.py`

| 端点 | 说明 |
|------|------|
| `GET /api/demos/defense-layers` | 5 层防御体系元数据 |
| `GET /api/demos/scenarios/{id}/attack-chain` | 执行多阶段攻击返回真实结果 |
| `GET /api/demos/defense-matrix` | 场景×防御层覆盖矩阵 |

### Task 3.2: 新增防御层元数据

**新文件**: `Aegis/backend/app/data/defense_layers_meta.json`

---

## Phase 4: 前端组件

### Task 4.1: AttackChainView.tsx

**新文件**: `Aegis/frontend/src/pages/openclaw/components/AttackChainView.tsx`

MITRE ATT&CK 风格矩阵，横轴攻击阶段 × 纵轴防御层，全部真实数据。

### Task 4.2: WhatIfPanel.tsx

**新文件**: `Aegis/frontend/src/pages/openclaw/components/WhatIfPanel.tsx`

5 个 Switch 开关 → 调用后端 API 切换 → 真实重新发送请求：
- L1/L2/L4：即时切换 + 自动重测
- L3/L5：提示需重启 Gateway → 用户确认 → 重启 → 重测
- 底部结论基于真实测试结果

### Task 4.3: DefenseMatrix.tsx

**新文件**: `Aegis/frontend/src/pages/openclaw/components/DefenseMatrix.tsx`

ECharts heatmap，14 场景 × 5 防御层，数据来自后端汇总。

### Task 4.4: 模型配置面板 + Sandbox.tsx 重构

**文件**: `Aegis/frontend/src/pages/openclaw/Sandbox.tsx`

```
页面顶部 Tabs: [攻防演练] | [防御矩阵]

Tab "攻防演练":
├── 模型配置（折叠面板）
├── 左侧 (8col): 场景列表 + LayerBadge
└── 右侧 (16col):
    ├── 场景详情 + 攻击提示词（保持现有）
    ├── "对比测试" 按钮（保持现有）
    └── 测试结果 Tabs:
        ├── "对比视图": 现有裸奔/金刚对比（保持现有）
        ├── "攻击链": AttackChainView（仅多阶段场景）
        └── "What-If": WhatIfPanel（真实切换+重测）

Tab "防御矩阵": DefenseMatrix
```

---

## 涉及的文件清单

| 操作 | 文件 | Phase |
|------|------|-------|
| 修改 | `~/.openclaw/openclaw.json` | 0 |
| 修改 | `~/.openclaw-hardened/openclaw.json` | 0 |
| 修改 | Hermes 配置 | 0 |
| 修改 | `Aegis/backend/app/services/openclaw_client.py` | 1 |
| 修改 | `Aegis/backend/app/routers/core/demos.py` | 1+3 |
| 修改 | `Aegis/backend/app/services/attack_simulator.py` | 2 |
| 修改 | `Aegis/backend/app/data/demo_scenarios.json` | 2 |
| 新建 | `Aegis/backend/app/data/defense_layers_meta.json` | 3 |
| 新建 | `Aegis/frontend/.../components/AttackChainView.tsx` | 4 |
| 新建 | `Aegis/frontend/.../components/WhatIfPanel.tsx` | 4 |
| 新建 | `Aegis/frontend/.../components/DefenseMatrix.tsx` | 4 |
| 修改 | `Aegis/frontend/src/pages/openclaw/Sandbox.tsx` | 4 |

---

## 验证方案

1. **Phase 0**: ClawShell 系统服务运行正常，hardened 和 Hermes 流量经过 ClawShell（`/admin/stats` 计数增加）
2. **Phase 1**: 发送攻击 prompt，确认响应中包含 L1/L2 拦截痕迹
3. **Phase 2**: 逐个测试新场景，确认裸奔全阶段失败、金刚全阶段成功
4. **Phase 3**: API 端点返回正确数据
5. **Phase 4**: 前端渲染正确，What-If 切换后真实重测
6. **端到端**: `cd Aegis && ./start.sh start` → 金刚龙虾安全 > 攻防演练
7. **向后兼容**: 场景 1-10 功能与之前完全一致