import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { ServerResponse } from 'http'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Tauri 需要的配置
  clearScreen: false,
  // 生产环境使用相对路径，适配 Tauri 的 file:// 协议
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        timeout: 120000,  // 测试 API 需要 30s+，设置 2 分钟
        proxyTimeout: 120000,
        // SSE 流式端点禁用代理缓冲
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes, req, res: ServerResponse) => {
            const url = req.url || ''
            if (url.includes('stream-sse') || url.includes('stream-live')) {
              // 确保 SSE 不被代理缓冲
              res.setHeader('Cache-Control', 'no-cache, no-transform')
              res.setHeader('X-Accel-Buffering', 'no')
              // 禁用 gzip，否则 gzip 会缓冲输出
              res.setHeader('Content-Encoding', 'identity')
              // 删除可能导致缓冲的 header
              delete proxyRes.headers['content-length']
            }
          })
        },
      },
      '/ws': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        ws: true,
      }
    }
  }
})
