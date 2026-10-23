# 攻防演练页面升级：从二元对比到纵深防御全景（v4 最终版）

## Context

当前攻防演练页面只做"裸奔龙虾 vs 金刚龙虾"的二元对比，无法体现多套安全组件的协同防御效果。

### 实际防御架构（已验证）

```
Aegis 后端 (8000)
  │
  ├─ OpenClawClient.send_message()
  │   │
  │   ├─ [L2 qise 守卫] ← 需新增：请求前 PromptGuard + 响应后 OutputGuard
  │   ├─ [L1 ClawShell DLP] ← 需新增：响应后 DLP 正则扫描 + 脱敏
  │   ├─ [L4 ClawKeeper Skill] ← 已有：is_hardened 时注入 safety_prompt
  │   │
  │   └─ HTTP → Gateway (19789 裸奔 / 20789 金刚)
  │              │
  │              ├─ [L3 OpenClaw 加固] ← 已有：safeBins + SOUL.md + elevated=ask
  │              └─ [L5 Docker 沙箱] ← 已有：network=none + readOnlyRoot
  │
  └─ AI Judge 评判结果
```

**已有且真实生效**：L3（Gateway 内置）、L4（Skill 注入）、L5（Docker 沙箱）
**需要接入**：L1（ClawShell DLP）、L2（qise 守卫）

### 铁律

- **不允许任何前端模拟/仿真** — 所有展示数据必须来自真实 HTTP 请求
- What-If 切换通过真实修改配置 + 重新发送请求实现
- L3/L5 切换需重启 Gateway，前端提示用户等待

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

1. **Phase 1**: 发送攻击 prompt，确认响应中包含 L1/L2 拦截痕迹
2. **Phase 2**: 逐个测试新场景，确认裸奔全阶段失败、金刚全阶段成功
3. **Phase 3**: API 端点返回正确数据
4. **Phase 4**: 前端渲染正确，What-If 切换后真实重测
5. **端到端**: `cd Aegis && ./start.sh start` → 金刚龙虾安全 > 攻防演练
6. **向后兼容**: 场景 1-10 功能与之前完全一致