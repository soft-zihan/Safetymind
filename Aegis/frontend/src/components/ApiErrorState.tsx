import { Result, Button, Empty } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

interface ApiErrorStateProps {
  title?: string;
  error: string;
  onRetry?: () => void;
}

/**
 * API 错误状态组件
 * 用于替代 demo 数据降级，明确告知用户 API 调用失败
 */
export const ApiErrorState: React.FC<ApiErrorStateProps> = ({ 
  title = '数据加载失败', 
  error, 
  onRetry 
}) => (
  <Result
    status="error"
    title={title}
    subTitle={error}
    extra={
      onRetry && (
        <Button type="primary" icon={<ReloadOutlined />} onClick={onRetry}>
          重试
        </Button>
      )
    }
  />
);

/**
 * 空状态组件
 * 用于 API 成功但返回空数据的情况
 */
export const DataEmpty: React.FC<{ description?: string }> = ({ 
  description = '暂无数据' 
}) => (
  <Empty
    description={description}
    image={Empty.PRESENTED_IMAGE_SIMPLE}
  />
);
