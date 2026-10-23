import apiClient from './apiClient'

// ── Hermes Agent 管理 ──
export const getHermesStatus = () => apiClient.get('/hermes/status').then(r => r.data)
export const getHermesAgents = () => apiClient.get('/hermes/agents').then(r => r.data)
export const getHermesPlugins = () => apiClient.get('/hermes/plugins').then(r => r.data)
export const getTirithStatus = () => apiClient.get('/hermes/tirith').then(r => r.data)

// ── Hermes 安全 ──
export const getSecurityOverview = () => apiClient.get('/hermes/security/overview').then(r => r.data)
export const runSecurityScan = (type = 'full') =>
  apiClient.post('/hermes/security/scan', null, { params: { scan_type: type } }).then(r => r.data)
export const getAuditReport = () => apiClient.get('/hermes/security/audit').then(r => r.data)
export const runHardening = () => apiClient.post('/hermes/security/harden').then(r => r.data)
