# SafetyMind 项目全面审查计划

## 背景

本项目集成了两个高质量开源项目：
1. **qise** - AI 安全框架（Python 核心安全引擎）
2. **clawkeeper** - OpenClaw 安全防护工具（Node.js 插件系统）

用户要求全面梳理仓库的完整逻辑，找出集成质量问题，特别是前端设计和接口正确性。

## 审查范围

### 1. qise 集成分析

#### 1.1 Python 包集成
- **问题**: `backend/app/routers/qise.py` 直接 import qise 包，但 qise 项目在 `qise/` 目录下
- **检查点**:
  - Python 路径配置是否正确
  - qise 包是否已安装到虚拟环境
  - import 语句能否正常工作
  - shield.yaml 配置文件位置

#### 1.2 API 路由完整性
- **后端路由**: `/api/qise/*` (640行代码)
- **前端调用**: `frontend/src/lib/qiseApi.ts` (72行)
- **检查点**:
  - 所有后端端点是否都有对应的前端调用
  - 数据结构是否匹配
  - 错误处理是否完善

#### 1.3 前端页面实现
- **页面列表**:
  - Shield.tsx - 智能体防护
  - Preflight.tsx - 上线前扫描
  - SecurityEvents.tsx - 安全事件
  - ProtectionRules.tsx - 防护规则
  - LocalSLM.tsx - 本地小模型
  - SystemDoctor.tsx - 系统诊断
  - RuntimeObserver.tsx - 运行观察
  - BackupRestore.tsx - 备份恢复

- **发现的关键问题**:
  - `Preflight.tsx` 使用 demo 数据而非真实 API
  - 多个页面可能缺少完整的 API 调用
  - 需要检查每个页面的数据流

### 2. ClawKeeper 集成分析

#### 2.1 集成架构
- **Skill 层**: 安全策略注入系统提示词
- **Plugin 层**: 运行时 Hook 拦截
- **API 层**: 6个 ClawKeeper 专用端点

#### 2.2 后端实现
- **路由**: `backend/app/routers/clawkeeper.py` (202行)
- **端点**:
  - GET `/api/clawkeeper/status`
  - GET `/api/clawkeeper/audit`
  - POST `/api/clawkeeper/scan`
  - POST `/api/clawkeeper/harden`
  - GET `/api/clawkeeper/logs`
  - GET `/api/clawkeeper/threats`

#### 2.3 前端集成
- **问题**: 根据 README 开发计划，ClawKeeper 前端可视化页面标记为 `[ ]` 未完成
- **检查点**:
  - 是否有独立的前端页面
  - 是否在其他页面中集成
  - API 调用是否完整

#### 2.4 Skill 注入机制
- **文件**: `backend/app/services/openclaw_client.py`
- **逻辑**: 在发送消息时判断是否是安全龙虾 (端口 20789)，注入安全策略
- **检查点**:
  - 注入逻辑是否正确
  - 是否影响裸奔龙虾
  - 错误处理是否完善

### 3. 前后端 API 对接检查

#### 3.1 API 路由注册
从 `backend/app/main.py` 检查所有注册的路由:
- `/api/openclaw` - OpenClaw 交互
- `/api/security` - 安全管理
- `/api/demos` - 演示场景
- `/ws` - WebSocket
- `/api/qise` - qise 防护 ⭐
- `/api/eval` - 模型评估
- `/api/datasets` - 数据集管理
- `/api/hardening` - 安全加固
- `/api/automotive` - 车用安全 ⭐
- `/api/clawkeeper` - ClawKeeper 防护 ⭐

#### 3.2 前端 API 调用
检查前端各页面使用的 API:
- Sandbox.tsx - `/api/demos/*`
- Evaluation.tsx - `/api/eval/*`
- DatasetManager.tsx - `/api/datasets/*`
- HardeningGuide.tsx - `/api/hardening/*`
- AutomotiveDashboard.tsx - `/api/automotive/*`
- TARAAnalysis.tsx - `/api/automotive/*`
- ComplianceCheck.tsx - `/api/automotive/*`
- **缺失**: qise 相关页面的 API 调用
- **缺失**: clawkeeper 相关页面的 API 调用

### 4. 前端设计质量

#### 4.1 页面完整性
- 21个页面是否都实现完整
- 是否有页面使用 mock/demo 数据而非真实 API
- 路由配置是否正确

#### 4.2 用户体验
- 错误处理是否完善
- 加载状态管理
- 数据刷新机制
- 表单验证

#### 4.3 代码质量
- TypeScript 类型定义
- 组件复用
- 状态管理
- 代码组织

### 5. Automotive 车用安全集成

#### 5.1 后端服务
- `tara_service.py` - TARA 分析
- `compliance_service.py` - 合规检查
- API 端点完整性

#### 5.2 前端页面
- AutomotiveDashboard.tsx
- TARAAnalysis.tsx
- ComplianceCheck.tsx
- API 调用是否正确

#### 5.3 数据流
- 前后端数据结构匹配
- 错误处理
- 用户体验

## 审查方法

### 第一阶段：静态代码分析
1. 检查所有 Python 路由文件的 import 和依赖
2. 检查前端页面的 API 调用
3. 比对前后端数据结构
4. 检查配置文件

### 第二阶段：集成点验证
1. qise 包导入路径验证
2. clawkeeper CLI 调用验证
3. 环境变量配置检查
4. 文件路径验证

### 第三阶段：前端完整性
1. 逐个页面检查 API 调用
2. 检查 mock 数据使用
3. 验证用户体验流程
4. 检查错误处理

## 预期输出

生成一份详细的问题报告，包括:
1. **Critical 问题**: 导致功能完全不可用的问题
2. **High 问题**: 功能部分受损或数据不正确
3. **Medium 问题**: 用户体验问题或代码质量问题
4. **Low 问题**: 优化建议和改进空间

每个问题包含:
- 问题描述
- 影响范围
- 复现步骤
- 修复建议
- 优先级

## 关键文件清单

### 后端核心文件
- `Adamantine-OpenClaw/backend/app/main.py`
- `Adamantine-OpenClaw/backend/app/routers/qise.py`
- `Adamantine-OpenClaw/backend/app/routers/clawkeeper.py`
- `Adamantine-OpenClaw/backend/app/routers/demos.py`
- `Adamantine-OpenClaw/backend/app/services/openclaw_client.py`
- `Adamantine-OpenClaw/backend/app/config.py`
- `Adamantine-OpenClaw/backend/requirements.txt`

### 前端核心文件
- `Adamantine-OpenClaw/frontend/src/App.tsx`
- `Adamantine-OpenClaw/frontend/src/lib/qiseApi.ts`
- `Adamantine-OpenClaw/frontend/src/lib/apiClient.ts`
- `Adamantine-OpenClaw/frontend/src/lib/types.ts`
- `Adamantine-OpenClaw/frontend/src/pages/Shield.tsx`
- `Adamantine-OpenClaw/frontend/src/pages/Preflight.tsx`
- `Adamantine-OpenClaw/frontend/src/pages/Sandbox.tsx`

### 集成配置文件
- `Adamantine-OpenClaw/clawkeeper-integration/COMPLETION_REPORT.md`
- `Adamantine-OpenClaw/clawkeeper-integration/adapter/skill_loader.py`
- `Adamantine-OpenClaw/start.sh`
- `Adamantine-OpenClaw/backend/.env.example`

### qise 项目文件
- `qise/` 目录结构
- `qise/pyproject.toml`
- `qise/src/qise/` 或 `qise/qise/` 核心模块

## 时间安排

预计完成时间: 2-3 小时
- 静态分析: 45 分钟
- 集成点验证: 30 分钟
- 前端完整性检查: 45 分钟
- 报告生成: 30 分钟
