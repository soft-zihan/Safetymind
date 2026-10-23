import axios, { AxiosError } from 'axios';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { message } from 'antd';

/**
 * 统一的 API 请求函数
 * 
 * 核心原则:
 * - ❌ 不允许后端不可用时显示 mock 数据
 * - ❌ 不允许后端返回错误时静默失败
 * - ❌ 不允许使用降级策略掩盖问题
 * - ✅ 必须明确显示错误信息,提供重试按钮
 */

// 自定义 API 错误类
export class ApiError extends Error {
  public status: number;
  public code?: string;
  public detail?: string;

  constructor(message: string, status: number, detail?: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.code = code;
  }
}

// 格式化错误消息
function formatErrorMessage(error: AxiosError): string {
  // 网络错误
  if (!error.response) {
    if (error.code === 'ECONNREFUSED') {
      return '后端服务未启动或无法连接,请检查服务状态';
    }
    if (error.code === 'ETIMEDOUT') {
      return '请求超时,后端服务响应过慢';
    }
    if (error.code === 'ERR_NETWORK') {
      return '网络连接失败,请检查后端服务是否正常运行';
    }
    return `网络错误: ${error.message}`;
  }

  // HTTP 错误
  const { status, data } = error.response;
  const detail = (data as any)?.detail || (data as any)?.message || (data as any)?.error;

  switch (status) {
    case 400:
      return `请求错误: ${detail || '参数错误'}`;
    case 401:
      return '认证失败: 未授权访问';
    case 403:
      return '权限不足: 禁止访问';
    case 404:
      return `资源不存在: ${detail || 'API 端点未找到'}`;
    case 500:
      return `服务器错误: ${detail || '后端服务内部错误'}`;
    case 502:
      return '网关错误: 后端服务不可达';
    case 503:
      return '服务不可用: 后端服务正在维护或过载';
    default:
      return `请求失败 [${status}]: ${detail || error.message}`;
  }
}

// 通用请求函数
export async function request<T = any>(
  url: string,
  options?: AxiosRequestConfig
): Promise<T> {
  try {
    const response: AxiosResponse<T> = await axios(url, {
      baseURL: '/api',
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    return response.data;
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      const errorMsg = formatErrorMessage(error);
      
      // 显示错误提示
      message.error(errorMsg, 5); // 5秒后自动消失
      
      // 控制台输出详细错误
      console.error(`❌ API Error [${error.config?.method?.toUpperCase()} ${error.config?.url}]:`, {
        status: error.response?.status,
        detail: error.response?.data?.detail,
        message: error.message,
        code: error.code,
      });

      // 抛出自定义错误,不允许静默失败
      throw new ApiError(
        errorMsg,
        error.response?.status || 0,
        error.response?.data?.detail,
        error.code
      );
    }
    
    // 非 Axios 错误
    console.error('❌ Unexpected Error:', error);
    message.error(`未知错误: ${error.message || '请检查控制台获取详情'}`, 5);
    throw error;
  }
}

// 便捷的请求方法
export const api = {
  get: <T = any>(url: string, config?: AxiosRequestConfig) => 
    request<T>(url, { method: 'GET', ...config }),
  
  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) => 
    request<T>(url, { method: 'POST', data, ...config }),
  
  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) => 
    request<T>(url, { method: 'PUT', data, ...config }),
  
  delete: <T = any>(url: string, config?: AxiosRequestConfig) => 
    request<T>(url, { method: 'DELETE', ...config }),
};

// 带重试的请求函数
export async function requestWithRetry<T = any>(
  url: string,
  options?: AxiosRequestConfig,
  retries: number = 2,
  retryDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await request<T>(url, options);
    } catch (error: any) {
      lastError = error;
      
      // 如果是客户端错误(4xx),不重试
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        throw error;
      }

      // 最后一次尝试失败,抛出错误
      if (attempt === retries) {
        break;
      }

      // 等待后重试
      console.log(`⏳ 请求失败,${retryDelay}ms 后重试 (${attempt + 1}/${retries}): ${url}`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  throw lastError;
}
