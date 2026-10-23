import apiClient from './apiClient';

export interface ClawKeeperStatus {
  skill: {
    enabled: boolean;
    name: string;
    description: string;
  };
  plugin: {
    enabled: boolean;
    plugins: string[];
    hooks_registered: string[];
  };
  audit_score?: number;
  last_audit?: string;
}

export interface AuditReport {
  tool: string;
  version: string;
  timestamp: string;
  score: number;
  summary: Record<string, any>;
  threatSummary: Record<string, any>;
  findings: Array<Record<string, any>>;
  nextSteps: string[];
}

export interface Threat {
  id: string;
  severity: string;
  title: string;
  category: string;
  threat: string;
  autoFixable: boolean;
  remediation: string;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  [key: string]: any;
}

/**
 * 获取 ClawKeeper 防护状态
 */
export async function getClawKeeperStatus(): Promise<ClawKeeperStatus> {
  const { data } = await apiClient.get('/openclaw/clawkeeper/status');
  return data;
}

/**
 * 执行安全审计
 */
export async function runAudit(): Promise<AuditReport> {
  const { data } = await apiClient.get('/openclaw/clawkeeper/audit');
  return data;
}

/**
 * 触发安全扫描
 */
export async function triggerScan(): Promise<any> {
  const { data } = await apiClient.post('/openclaw/clawkeeper/scan');
  return data;
}

/**
 * 执行安全加固
 */
export async function runHardening(): Promise<any> {
  const { data } = await apiClient.post('/openclaw/clawkeeper/harden');
  return data;
}

/**
 * 获取安全日志
 */
export async function getSecurityLogs(limit: number = 50, date?: string): Promise<{ logs: LogEntry[]; total: number }> {
  const params: any = { limit };
  if (date) params.date = date;
  const { data } = await apiClient.get('/openclaw/clawkeeper/logs', { params });
  return data;
}

/**
 * 获取威胁列表
 */
export async function getThreats(severity?: string, limit: number = 20): Promise<{ threats: Threat[]; total: number }> {
  const params: any = { limit };
  if (severity) params.severity = severity;
  const { data } = await apiClient.get('/openclaw/clawkeeper/threats', { params });
  return data;
}
