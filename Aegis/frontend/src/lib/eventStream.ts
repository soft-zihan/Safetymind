import { normalizeSecurityEvent } from './normalize';
import type { SecurityEvent } from './types';

export function subscribeSecurityEvents(
  onEvent: (event: SecurityEvent) => void
): () => void {
  // 连接到后端 WebSocket（通过 vite proxy 或直接连接）
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws/qise-events`;
  
  let ws: WebSocket | null = null;
  let reconnectTimer: number | null = null;

  const connect = () => {
    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket 已连接');
      };

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          const event = normalizeSecurityEvent(data);
          onEvent(event);
        } catch (err) {
          console.error('解析安全事件失败:', err);
        }
      };

      ws.onerror = () => {
        // WebSocket 错误静默处理，不影响页面功能
      };

      ws.onclose = () => {
        console.log('WebSocket 已断开，5秒后重连...');
        reconnectTimer = window.setTimeout(connect, 5000);
      };
    } catch (err) {
      console.error('WebSocket 连接失败:', err);
      reconnectTimer = window.setTimeout(connect, 5000);
    }
  };

  connect();

  return () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
    if (ws) {
      ws.close();
    }
  };
}
