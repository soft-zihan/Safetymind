import axios from 'axios';
import { message } from 'antd';

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    console.log('🔒 API Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    console.error('❌ API Request Error:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器 - 严格错误处理,不允许降级
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // 格式化错误消息
    let errorMsg: string;
    
    if (!error.response) {
      // 网络错误
      if (error.code === 'ECONNREFUSED') {
        errorMsg = '后端服务未启动或无法连接,请检查服务状态';
      } else if (error.code === 'ETIMEDOUT') {
        errorMsg = '请求超时,后端服务响应过慢';
      } else {
        errorMsg = `网络错误: ${error.message}`;
      }
    } else {
      // HTTP 错误
      const status = error.response.status;
      const detail = error.response.data?.detail || error.response.data?.message;
      errorMsg = detail || `请求失败 [${status}]: ${error.message}`;
    }
    
    // 明确显示错误
    message.error(errorMsg, 5);
    
    // 控制台输出详细信息
    console.error('❌ API Response Error:', {
      url: error.config?.url,
      method: error.config?.method?.toUpperCase(),
      status: error.response?.status,
      detail: error.response?.data?.detail,
      message: error.message,
      code: error.code,
    });
    
    // 抛出错误,不允许静默失败
    return Promise.reject(error);
  }
);

export default apiClient;
