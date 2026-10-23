import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Alert, Button, Space } from 'antd';
import { ReloadOutlined, RollbackOutlined } from '@ant-design/icons';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * React Error Boundary 组件
 * 
 * 用于捕获子组件树中的 JavaScript 错误,防止整个应用崩溃
 * 明确显示错误信息,提供重试和回退按钮
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 记录错误信息
    console.error('❌ ErrorBoundary caught an error:', error);
    console.error('Error Info:', errorInfo);

    // 调用可选的错误回调
    this.props.onError?.(error, errorInfo);

    // 更新状态
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoBack = () => {
    window.history.back();
  };

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // 如果提供了自定义 fallback,使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 默认错误 UI
      return (
        <Alert
          type="error"
          message="组件加载失败"
          description={
            <div>
              <p style={{ marginBottom: 8 }}>
                {this.state.error?.message || '发生未知错误'}
              </p>
              {import.meta.env.DEV && this.state.errorInfo && (
                <details style={{ marginTop: 8, maxHeight: 200, overflow: 'auto' }}>
                  <summary style={{ cursor: 'pointer', color: '#888' }}>
                    查看错误堆栈 (开发模式)
                  </summary>
                  <pre
                    style={{
                      marginTop: 8,
                      padding: 8,
                      background: '#f5f5f5',
                      borderRadius: 4,
                      fontSize: 12,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>
          }
          action={
            <Space>
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={this.handleRetry}
              >
                重试
              </Button>
              <Button
                size="small"
                icon={<RollbackOutlined />}
                onClick={this.handleGoBack}
              >
                返回
              </Button>
              <Button
                size="small"
                type="primary"
                icon={<ReloadOutlined />}
                onClick={this.handleReload}
              >
                刷新页面
              </Button>
            </Space>
          }
          style={{ margin: '24px 0' }}
          showIcon
        />
      );
    }

    return this.props.children;
  }
}

/**
 * 带错误边界的异步组件包装器
 * 
 * 用法:
 * const LazyComponent = withErrorBoundary(lazy(() => import('./MyComponent')));
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

export default ErrorBoundary;
