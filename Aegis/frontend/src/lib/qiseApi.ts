import apiClient from './apiClient';
import type { AppStatus, GuardInfo, SecurityEvent } from './types';

export async function getStatus(): Promise<AppStatus> {
  const { data } = await apiClient.get('/tools/qise/status');
  return data;
}

export async function getGuards(): Promise<GuardInfo[]> {
  const { data } = await apiClient.get('/tools/qise/guards');
  // 后端返回 {guards: [...]} 或直接是数组
  return Array.isArray(data) ? data : (data.guards || []);
}

export async function setGuardMode(name: string, mode: string): Promise<void> {
  await apiClient.put(`/tools/qise/guards/${name}/mode`, { mode });
}

export async function getEvents(): Promise<SecurityEvent[]> {
  const { data } = await apiClient.get('/tools/qise/events');
  return data;
}

export async function preflightScan(req: any): Promise<any> {
  const { data } = await apiClient.post('/tools/qise/preflight/scan', req, {
    headers: { 'Content-Type': 'application/json' }
  });
  return data;
}

export async function protectAgent(req: any): Promise<void> {
  await apiClient.post('/tools/qise/agents/protect', req);
}

export async function unprotectAgent(key: string): Promise<void> {
  await apiClient.post(`/tools/qise/agents/${key}/unprotect`);
}

export async function slmStart(req: any): Promise<void> {
  await apiClient.post('/tools/qise/slm/start', req);
}

export async function slmStop(): Promise<void> {
  await apiClient.post('/tools/qise/slm/stop');
}

export async function runDiagnostics(): Promise<any> {
  const { data } = await apiClient.post('/tools/qise/diagnostics');
  return data;
}

export async function getBackups(): Promise<any[]> {
  const { data } = await apiClient.get('/tools/qise/backups');
  return data;
}

export async function restoreBackup(id: string): Promise<void> {
  await apiClient.post(`/tools/qise/backups/${id}/restore`);
}

export async function getConfig(): Promise<any> {
  const { data } = await apiClient.get('/tools/qise/config');
  return data;
}

export async function setConfig(cfg: any): Promise<void> {
  await apiClient.put('/tools/qise/config', cfg);
}

export async function guardCheck(payload: any): Promise<any> {
  const { data } = await apiClient.post('/tools/qise/guards/check', payload);
  return data;
}
