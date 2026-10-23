# Aegis 前端错误处理改进总结

## 改进日期
2026-06-25

## 改进目标
彻底移除前端的降级策略和 mock 数据回退机制,确保在后端不可用时**明确报错**,而不是静默失败或显示假数据。

---

## 核心原则

- ❌ **不允许**: 后端不可用时显示 mock 数据
- ❌ **不允许**: 后端返回错误时静默失败
- ❌ **不允许**: 使用降级策略掩盖问题
- ✅ **必须**: 明确显示错误信息,提供重试按钮

---

## 创建的文件 (2个)

### 1. `/frontend/src/api/request.ts`
统一 API 请求封装,包含:
- `ApiError` 自定义错误类
- `formatErrorMessage` 错误消息格式化函数
- `request` 通用请求函数
- `api.get/post/put/delete` 便捷方法
- `requestWithRetry` 带重试的请求函数

**关键特性**:
- 智能识别网络错误 (ECONNREFUSED, ETIMEDOUT, ERR_NETWORK)
- 智能识别 HTTP 错误 (400, 401, 403, 404, 500, 502, 503)
- 自动显示 `message.error` (5秒)
- 控制台输出详细错误信息
- 抛出错误,不允许静默失败

### 2. `/frontend/src/components/ErrorBoundary.tsx`
React 错误边界组件,包含:
- `ErrorBoundary` 类组件
- `withErrorBoundary` HOC 包装器

**关键特性**:
- 捕获子组件树中的 JavaScript 运行时错误
- 显示友好的错误 Alert
- 提供重试、返回、刷新页面按钮
- 开发模式显示错误堆栈
- 支持自定义 fallback 和 onError 回调

---

## 修改的文件 (7个)

### 1. `/frontend/src/lib/apiClient.ts`
**改进内容**:
- ✅ 添加请求拦截器,记录请求日志
- ✅ 改进响应拦截器,格式化错误消息
- ✅ 区分网络错误和 HTTP 错误
- ✅ 明确显示错误 (5秒 message.error)
- ✅ 控制台输出详细错误信息
- ✅ 抛出错误,不允许静默失败

### 2. `/frontend/src/services/clawshell.ts`
**改进内容**:
- ✅ 添加 `message` 导入
- ✅ 改进错误消息格式化
- ✅ 区分连接拒绝、超时等错误类型
- ✅ 明确显示错误信息

### 3. `/frontend/src/pages/overview/Home.tsx`
**改进内容**:
- ✅ 添加 `loadingErrors` 状态
- ✅ 使用 `Promise.allSettled` 分别处理每个请求
- ✅ 收集所有错误并显示
- ✅ 错误时显示 Alert 组件
- ✅ 提供重试按钮

### 4. `/frontend/src/pages/openclaw/Sandbox.tsx`
**改进内容**:
- ✅ 改进 `fetchScenarios` 错误处理
- ✅ 改进 `fetchAttackChain` 错误处理,清除旧数据
- ✅ 改进 `fetchModelConfig` 错误处理,清除旧数据
- ✅ 所有错误都显示详细错误信息

### 5. `/frontend/src/lib/demoData.ts`
**改进内容**:
- ✅ 标记为 `@deprecated`
- ✅ 添加废弃说明

### 6. `/frontend/src/components/index.ts`
**改进内容**:
- ✅ 导出 `ApiErrorState`, `DataEmpty`
- ✅ 导出 `ErrorBoundary`, `withErrorBoundary`

### 7. `/frontend/src/App.tsx`
**改进内容**:
- ✅ 导入 `ErrorBoundary`
- ✅ 在 Content 区域添加全局错误边界

---

## 已有良好实践

### `/frontend/src/pages/tools/Shield.tsx`
这个页面已经是错误处理的典范,其他页面应该参考:

```typescript
const [error, setError] = useState<string | null>(null);

const loadStatus = async () => {
  setLoading(true);
  setError(null);
  try {
    const data = await getStatus();
    setStatus(normalizeStatus(data));
  } catch (err: any) {
    setError(err.message || '无法加载系统状态');
  } finally {
    setLoading(false);
  }
};

if (error) {
  return <ApiErrorState error={error} onRetry={loadStatus} />;
}
```

---

## 验证方法

### 步骤 1: 停止后端服务
```bash
pkill -f "python.*aegis"
```

### 步骤 2: 启动前端
```bash
cd /Users/han/Documents/projects/Safetymind/Aegis/frontend
npm run dev
```

### 步骤 3: 访问各页面验证
访问以下页面,验证是否**明确显示错误**:

| 页面 | URL | 预期结果 |
|-----|-----|---------|
| 总览 | http://localhost:5173/ | 显示 Alert,告知哪些服务加载失败 |
| 攻防演练 | http://localhost:5173/openclaw/sandbox | 显示错误提示,不提供场景列表 |
| 智能体防护 | http://localhost:5173/qise/shield | 显示 ApiErrorState 组件 |
| 数据集管理 | http://localhost:5173/qise/datasets | 显示错误提示 |
| ClawShell | http://localhost:5173/clawshell | 显示连接失败提示 |

### 步骤 4: 检查控制台
打开浏览器开发者工具,检查 Console:
- ✅ 应该看到详细的错误日志
- ✅ 应该看到 `❌ API Error` 前缀的日志
- ❌ 不应该看到静默失败 (无任何输出)

### 步骤 5: 重启后端验证恢复
```bash
cd /Users/han/Documents/projects/Safetymind/Aegis/backend
source venv/bin/activate
python -m uvicorn app.main:app --reload
```

刷新页面,验证:
- ✅ 错误提示消失
- ✅ 数据正常加载
- ✅ 重试按钮有效

---

## 错误处理标准模式

所有使用 API 的组件都应该遵循以下模式:

```typescript
import { useState, useEffect } from 'react';
import { Spin } from 'antd';
import { ApiErrorState, DataEmpty } from '@/components';
import { api } from '@/api/request';

function MyComponent() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get('/my-endpoint');
      setData(result);
    } catch (err: any) {
      setError(err.message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  if (error) {
    return <ApiErrorState error={error} onRetry={loadData} />;
  }

  if (!data) {
    return <DataEmpty description="暂无数据" />;
  }

  return <div>{/* 正常渲染 */}</div>;
}
```

---

## 待改进的页面

以下页面需要按照标准模式逐步改进:

- [ ] Dashboard.tsx - 金刚龙虾仪表盘
- [ ] NakedAgent.tsx - 裸奔龙虾
- [ ] HardenedAgent.tsx - 金刚龙虾
- [ ] HardeningGuide.tsx - 加固指南
- [ ] Audit.tsx - 审计报告
- [ ] ClawKeeperManager.tsx - ClawKeeper 管理
- [ ] DatasetManager.tsx - 数据集管理
- [ ] Evaluation.tsx - 模型评估
- [ ] Preflight.tsx - 上线前扫描
- [ ] SecurityEvents.tsx - 安全事件
- [ ] ProtectionRules.tsx - 防护规则
- [ ] LocalSLM.tsx - 本地小模型
- [ ] SystemDoctor.tsx - 系统诊断
- [ ] RuntimeObserver.tsx - 运行观察
- [ ] BackupRestore.tsx - 备份恢复
- [ ] Integrations.tsx - 集成管理
- [ ] ClawShellDualAgent.tsx - ClawShell 代理
- [ ] HermesAgent.tsx - Hermes Agent
- [ ] HermesSecurityScan.tsx - 安全扫描
- [ ] HermesAudit.tsx - 审计报告
- [ ] HermesPlugins.tsx - 插件管理
- [ ] HermesHardening.tsx - 加固指南

**改进优先级**: 高流量页面优先 (Dashboard > Sandbox > Shield > 其他)

---

## 技术亮点

### 1. 统一的错误处理
所有 API 请求都通过 `api/request.ts` 或 `apiClient.ts`,确保错误处理一致性。

### 2. 智能错误分类
- 网络错误: ECONNREFUSED, ETIMEDOUT, ERR_NETWORK
- HTTP 错误: 400, 401, 403, 404, 500, 502, 503
- 每种错误都有用户友好的提示消息

### 3. 多层错误捕获
- **第 1 层**: axios 拦截器 (apiClient.ts, clawshell.ts)
- **第 2 层**: 组件级 try-catch
- **第 3 层**: 全局 ErrorBoundary

### 4. 明确的错误提示
- message.error (5秒自动消失)
- Alert 组件 (持久显示,直到用户操作)
- ApiErrorState 组件 (带重试按钮)
- 控制台详细日志 (开发调试)

### 5. 错误恢复机制
- 重试按钮: 重新调用数据加载函数
- 返回按钮: 返回上一页
- 刷新按钮: 重新加载整个页面

---

## 编译状态

TypeScript 编译检查发现一些**已有代码**的警告 (非本次改进引入):
- 未使用的变量/导入
- 这些警告不影响本次改进的功能

核心错误处理代码编译通过,无新增错误。

---

## 下一步建议

### 短期 (1-2 天)
1. 逐个改进待改进列表中的页面
2. 测试所有页面的错误处理
3. 修复编译警告

### 中期 (1 周)
1. 集成错误监控服务 (Sentry)
2. 添加性能监控
3. 编写单元测试

### 长期 (1 月)
1. 添加用户反馈机制
2. 错误分析和优化
3. 完善文档和示例

---

## 总结

本次改进建立了严格的错误处理机制:

✅ 统一的 API 请求封装 (`api/request.ts`)
✅ 全局错误边界 (`ErrorBoundary`)
✅ 明确的错误提示 (不允许静默失败)
✅ 友好的重试机制 (提供重试按钮)
✅ 废弃 mock 数据 (标记 `demoData.ts` 为废弃)

**核心目标**: 让错误可见、可追踪、可恢复,而不是掩盖问题。

---

## 相关文档

- 详细指南: `/frontend/ERROR_HANDLING_GUIDE.md`
- API 封装: `/frontend/src/api/request.ts`
- 错误边界: `/frontend/src/components/ErrorBoundary.tsx`
- 错误状态组件: `/frontend/src/components/ApiErrorState.tsx`
