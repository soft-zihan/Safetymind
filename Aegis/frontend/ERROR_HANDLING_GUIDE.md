# Aegis 前端错误处理改进指南

## 改进概述

本次改进彻底移除了前端的降级策略和 mock 数据回退机制,确保在后端不可用时**明确报错**,而不是静默失败或显示假数据。

## 核心原则

- ❌ **不允许**: 后端不可用时显示 mock 数据
- ❌ **不允许**: 后端返回错误时静默失败
- ❌ **不允许**: 使用降级策略掩盖问题
- ✅ **必须**: 明确显示错误信息,提供重试按钮

---

## 创建的文件

### 1. `/frontend/src/api/request.ts` - 统一 API 请求封装

**功能**:
- 统一的错误处理和格式化
- 自定义 `ApiError` 错误类,包含状态码和详细信息
- 智能错误消息格式化(网络错误、HTTP 错误分类处理)
- 提供 `request`、`api.get/post/put/delete`、`requestWithRetry` 等方法

**使用示例**:
```typescript
import { api, request, ApiError } from '@/api/request';

// 方式 1: 使用 api 对象
const data = await api.get('/scenarios');

// 方式 2: 使用 request 函数
const data = await request('/scenarios', { method: 'GET' });

// 方式 3: 带重试的请求
const data = await requestWithRetry('/scenarios', { method: 'GET' }, 2, 1000);

// 错误处理
try {
  const data = await api.get('/scenarios');
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`API 错误 [${error.status}]: ${error.detail}`);
  }
}
```

### 2. `/frontend/src/components/ErrorBoundary.tsx` - React 错误边界

**功能**:
- 捕获子组件树中的 JavaScript 错误
- 防止整个应用崩溃
- 显示友好的错误信息
- 提供重试、返回、刷新页面按钮
- 开发模式下显示错误堆栈

**使用示例**:
```typescript
import { ErrorBoundary, withErrorBoundary } from '@/components/ErrorBoundary';

// 方式 1: 直接使用组件
<ErrorBoundary>
  <MyComponent />
</ErrorBoundary>

// 方式 2: 使用 HOC 包装懒加载组件
const LazyComponent = withErrorBoundary(
  lazy(() => import('./MyComponent'))
);

// 方式 3: 自定义 fallback
<ErrorBoundary
  fallback={<CustomErrorUI />}
  onError={(error, errorInfo) => {
    // 上报错误到监控服务
    reportError(error, errorInfo);
  }}
>
  <MyComponent />
</ErrorBoundary>
```

---

## 修改的文件

### 1. `/frontend/src/lib/apiClient.ts`

**改进**:
- 添加请求拦截器,记录请求日志
- 改进响应拦截器,格式化错误消息
- 区分网络错误和 HTTP 错误
- 明确显示错误,不允许静默失败

### 2. `/frontend/src/services/clawshell.ts`

**改进**:
- 添加 `message` 导入
- 改进错误消息格式化
- 区分连接拒绝、超时等错误类型
- 明确显示错误信息

### 3. `/frontend/src/pages/overview/Home.tsx`

**改进**:
- 添加 `loadingErrors` 状态追踪错误
- 使用 `Promise.allSettled` 分别处理每个请求的结果
- 收集所有错误并显示
- 提供重试按钮
- 错误时显示 Alert 组件而不是静默失败

### 4. `/frontend/src/pages/openclaw/Sandbox.tsx`

**改进**:
- 改进 `fetchScenarios` 错误处理,显示详细错误信息
- 改进 `fetchAttackChain` 错误处理,清除旧数据
- 改进 `fetchModelConfig` 错误处理,清除旧数据
- 所有错误都显示 5 秒的 message.error

### 5. `/frontend/src/lib/demoData.ts`

**改进**:
- 标记为 `@deprecated`
- 添加废弃说明,明确不再允许使用 mock 数据降级

### 6. `/frontend/src/components/index.ts`

**改进**:
- 导出 `ApiErrorState`、`DataEmpty` 错误状态组件
- 导出 `ErrorBoundary`、`withErrorBoundary` 错误边界组件

### 7. `/frontend/src/App.tsx`

**改进**:
- 在 Content 区域添加全局 `ErrorBoundary`
- 捕获所有路由组件的运行时错误

---

## 已有的良好实践

### `/frontend/src/pages/tools/Shield.tsx`

这个页面已经是错误处理的典范:

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

**其他页面应该参考这种模式!**

---

## 检查清单

以下页面需要检查和改进错误处理:

### 已完成 ✅
- [x] Home.tsx - 总览页
- [x] Sandbox.tsx - 攻防演练
- [x] Shield.tsx - 智能体防护 (已有良好实践)
- [x] apiClient.ts - API 客户端
- [x] clawshell.ts - ClawShell 服务
- [x] App.tsx - 全局错误边界

### 待改进 ⚠️
以下页面需要按照 Shield.tsx 的模式改进:

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

---

## 标准错误处理模式

所有使用 API 的组件都应该遵循以下模式:

```typescript
import { useState, useEffect } from 'react';
import { Spin, Alert, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { ApiErrorState } from '@/components';
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
      // 错误已由 apiClient 拦截器显示 message.error
      // 这里只需记录错误状态
      setError(err.message || '加载数据失败');
      console.error('加载数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 加载状态
  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  // 错误状态 - 使用 ApiErrorState 组件
  if (error) {
    return <ApiErrorState error={error} onRetry={loadData} />;
  }

  // 空数据状态
  if (!data) {
    return <DataEmpty description="暂无数据" />;
  }

  // 正常渲染
  return (
    <div>
      {/* 组件内容 */}
    </div>
  );
}
```

---

## 验证方法

### 1. 停止后端服务

```bash
# 找到后端进程并停止
pkill -f "python.*aegis"
# 或者
# 在运行后端的终端按 Ctrl+C
```

### 2. 访问各页面并验证

启动前端:
```bash
cd /Users/han/Documents/projects/Safetymind/Aegis/frontend
npm run dev
```

访问以下页面,验证是否**明确显示错误**:

- http://localhost:5173/ - 总览页
- http://localhost:5173/openclaw/dashboard - 仪表盘
- http://localhost:5173/openclaw/sandbox - 攻防演练
- http://localhost:5173/qise/shield - 智能体防护
- http://localhost:5173/qise/datasets - 数据集管理
- http://localhost:5173/clawshell - ClawShell 代理

### 3. 预期结果

✅ **正确的行为**:
- 显示红色 Alert 组件,明确告知用户错误原因
- 提供"重试"按钮
- 控制台显示详细的错误信息
- **不显示**任何 mock 数据或空壳数据

❌ **错误的行为**:
- 页面空白无任何提示
- 显示假的/过期的数据
- 静默失败,用户不知道发生了什么
- 使用 demoData.ts 中的数据降级

### 4. 重启后端验证恢复

```bash
cd /Users/han/Documents/projects/Safetymind/Aegis/backend
source venv/bin/activate
python -m uvicorn app.main:app --reload
```

刷新页面,验证:
- 错误提示消失
- 数据正常加载
- 重试按钮有效

---

## 错误类型对照表

| 错误场景 | 错误代码 | 用户提示 |
|---------|---------|---------|
| 后端未启动 | ECONNREFUSED | 后端服务未启动或无法连接,请检查服务状态 |
| 请求超时 | ETIMEDOUT | 请求超时,后端服务响应过慢 |
| 网络断开 | ERR_NETWORK | 网络连接失败,请检查后端服务是否正常运行 |
| 参数错误 | 400 | 请求错误: [详细信息] |
| 未授权 | 401 | 认证失败: 未授权访问 |
| 权限不足 | 403 | 权限不足: 禁止访问 |
| 资源不存在 | 404 | 资源不存在: [详细信息] |
| 服务器错误 | 500 | 服务器错误: [详细信息] |
| 网关错误 | 502 | 网关错误: 后端服务不可达 |
| 服务不可用 | 503 | 服务不可用: 后端服务正在维护或过载 |

---

## 下一步工作

1. **逐步改进其他页面**: 按照标准错误处理模式,逐个改进待改进列表中的页面
2. **添加错误监控**: 集成 Sentry 或其他错误监控服务
3. **添加性能监控**: 追踪 API 请求耗时,识别性能瓶颈
4. **编写单元测试**: 测试错误处理逻辑
5. **用户反馈机制**: 添加错误报告功能,让用户可以反馈问题

---

## 技术细节

### ApiError 类

```typescript
export class ApiError extends Error {
  public status: number;      // HTTP 状态码
  public code?: string;       // 错误代码 (如 ECONNREFUSED)
  public detail?: string;     // 后端返回的详细错误信息
  
  constructor(message: string, status: number, detail?: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    // ...
  }
}
```

### 错误处理流程

```
用户操作
  ↓
发起 API 请求 (api.get/post/put/delete)
  ↓
axios 拦截器
  ├─ 成功: 返回数据
  └─ 失败: 
      ├─ 格式化错误消息
      ├─ 显示 message.error (5秒)
      ├─ 控制台输出详细信息
      └─ 抛出 ApiError
  ↓
组件 catch 错误
  ├─ 设置 error 状态
  └─ 显示 ApiErrorState 组件
```

---

## 常见问题

### Q: 为什么不允许使用 mock 数据降级?

**A**: mock 数据会掩盖真实问题,导致:
1. 用户看到过期或错误的数据,做出错误决策
2. 开发者难以发现后端故障
3. 调试困难,不知道问题是前端还是后端

### Q: 如何处理多个独立 API 请求?

**A**: 使用 `Promise.allSettled`,分别处理每个请求的结果:

```typescript
const results = await Promise.allSettled([
  api.get('/api1'),
  api.get('/api2'),
  api.get('/api3'),
]);

const errors: string[] = [];
if (results[0].status === 'rejected') {
  errors.push(`API 1 失败: ${results[0].reason.message}`);
}
// ... 处理其他结果

if (errors.length > 0) {
  setError(errors.join('\n'));
}
```

### Q: 重试按钮应该如何实现?

**A**: 直接调用数据加载函数:

```typescript
<ApiErrorState 
  error={error} 
  onRetry={() => loadData()} 
/>
```

### Q: 开发模式和生产模式的错误显示有何不同?

**A**: 
- **开发模式**: ErrorBoundary 显示错误堆栈,方便调试
- **生产模式**: 只显示用户友好的错误信息,不暴露技术细节

---

## 总结

本次改进建立了严格的错误处理机制:

1. ✅ 统一的 API 请求封装 (`api/request.ts`)
2. ✅ 全局错误边界 (`ErrorBoundary`)
3. ✅ 明确的错误提示 (不允许静默失败)
4. ✅ 友好的重试机制 (提供重试按钮)
5. ✅ 废弃 mock 数据 (标记 `demoData.ts` 为废弃)

**核心目标**: 让错误可见、可追踪、可恢复,而不是掩盖问题。
