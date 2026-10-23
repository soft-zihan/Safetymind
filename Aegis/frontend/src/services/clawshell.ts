import axios from 'axios';
import { message } from 'antd';

// ClawShell 默认地址
const CLAWSHELL_BASE_URL = 'http://127.0.0.1:21789';

// 创建 axios 实例
const clawshellAPI = axios.create({
  baseURL: CLAWSHELL_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
clawshellAPI.interceptors.request.use(
  (config) => {
    console.log('🔒 ClawShell API Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    console.error('❌ ClawShell API Request Error:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器 - 严格错误处理,不允许降级
clawshellAPI.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    // 格式化错误消息
    let errorMsg: string;
    
    if (error.code === 'ECONNREFUSED' || !error.response) {
      errorMsg = 'ClawShell 服务未启动或无法连接,请先启动 ClawShell';
    } else if (error.code === 'ETIMEDOUT') {
      errorMsg = 'ClawShell 服务响应超时';
    } else {
      const status = error.response?.status;
      const detail = error.response?.data?.detail || error.response?.data?.message;
      errorMsg = detail || `ClawShell 请求失败 [${status}]: ${error.message}`;
    }
    
    // 明确显示错误
    message.error(errorMsg, 5);
    
    // 控制台输出详细信息
    console.error('❌ ClawShell API Response Error:', {
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

// API 接口
export const clawshellService = {
  // 获取运行时统计
  getStats: () => clawshellAPI.get('/admin/stats'),
  
  // 获取配置（需要通过后端代理，ClawShell 本身不提供配置读取 API）
  getConfig: () => clawshellAPI.get('/admin/config'),
  
  // 健康检查
  healthCheck: () => clawshellAPI.get('/health'),
  
  // 代理服务状态
  getServiceStatus: () => clawshellAPI.get('/admin/status'),
};

export default clawshellService;
