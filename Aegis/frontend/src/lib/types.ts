/** 金刚龙虾安全平台核心类型定义 */

export interface PortStatus {
  host: string;
  port: number;
  status: string;
  detail?: string;
}

export interface ServiceStatus {
  pid?: number | null;
  port?: number;
  status?: string;
  managed_by?: string;
  command?: string;
  started_at?: string;
  upstream_url?: string;
}

export interface SlmStatus {
  configured?: boolean;
  provider?: string;
  model?: string;
  base_url?: string;
  verification?: string;
  server_running?: boolean;
  timeout_ms?: number;
  state?: Record<string, unknown>;
}

export interface AgentInfo {
  key: string;
  name: string;
  installed: boolean;
  protected: boolean;
  experimental: boolean;
  cli_path: string;
  config_path: string;
  note: string;
}

export interface ProtectedAgentRecord {
  agent?: string;
  display_name?: string;
  config_path?: string;
  backup_path?: string;
  proxy_url?: string;
  upstream_url?: string;
  protected_at?: string;
  [key: string]: unknown;
}

export interface AppStatus {
  config?: string;
  state_path?: string;
  events_path?: string;
  services?: Record<string, ServiceStatus>;
  proxy?: PortStatus;
  bridge?: PortStatus;
  slm?: SlmStatus;
  protected_agents?: Record<string, ProtectedAgentRecord>;
  detected_agents?: AgentInfo[];
  events_24h?: {
    blocked: number;
    warnings: number;
  };
  last_event?: SecurityEvent | null;

  /** Legacy Tauri in-memory status fields kept as a temporary fallback. */
  protection_enabled?: boolean;
  proxy_port?: number;
  bridge_port?: number;
  blocked_count?: number;
  warning_count?: number;
  slm_status?: string;
  slm_latency_ms?: number;
}

export interface GuardInfo {
  name: string;
  mode: string;
  pipeline: string;
  primary_strategy: string;
}

export interface EventAgent {
  name: string;
  type: string;
  session_id: string;
}

export interface EventAction {
  type: string;
  name: string;
  resource: string;
}

export interface EventRisk {
  category: string;
  severity: string;
  confidence: number;
}

export interface EventDecision {
  verdict: string;
  mode: string;
  blocked_by: string[];
}

export interface EventEvidence {
  type: string;
  rule_id?: string;
  message?: string;
  path?: string;
  snippet?: string;
  guard?: string;
  verdict?: string;
  risk_source?: string;
  confidence?: number | null;
}

export interface SecurityEvent {
  id: string;
  schema_version: string;
  timestamp: string;
  stage: string;
  source: string;
  agent: EventAgent;
  action: EventAction;
  risk: EventRisk;
  decision: EventDecision;
  evidence: EventEvidence[];
  recommendation: string;
  correlation_id: string;
  raw_ref: string;
}

/** 预飞行扫描相关类型 */

export interface ScanFinding {
  verdict?: string;
  category?: string;
  severity?: string;
  confidence?: number;
  message?: string;
  path?: string;
  snippet?: string;
  rule_id?: string;
}

export interface ScanReport {
  target?: string;
  target_type?: string;
  verdict?: string;
  risk?: {
    category?: string;
    severity?: string;
  };
  findings?: ScanFinding[];
  recommendation?: string;
}

export interface ScanSkip {
  agent?: string;
  target_type?: string;
  reason?: string;
}

export interface ScanCollection {
  target?: string;
  target_type?: string;
  verdict?: string;
  reports?: ScanReport[];
  skipped?: ScanSkip[];
  recommendation?: string;
  summary?: {
    reports?: number;
    block?: number;
    warn?: number;
    pass?: number;
    skipped?: number;
  };
}

export type ScanResult = ScanReport | ScanCollection;
