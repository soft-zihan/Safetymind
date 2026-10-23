/** 金刚龙虾平台状态归一化辅助函数 */

import type { AppStatus, AgentInfo } from '../types';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function normalizeAgentInfo(value: unknown): AgentInfo {
  const raw = asRecord(value) as any;
  const key = stringValue(raw.key, stringValue(raw.agent_type, ''));
  const name = stringValue(raw.name, stringValue(raw.display_name, key || 'Unknown'));

  return {
    key,
    name,
    installed: booleanValue(raw.installed),
    protected: booleanValue(raw.protected, booleanValue(raw.taken_over)),
    experimental: booleanValue(raw.experimental),
    cli_path: stringValue(raw.cli_path),
    config_path: stringValue(raw.config_path),
    note: stringValue(raw.note),
  };
}

export function normalizeStatus(value: unknown): AppStatus {
  const raw = asRecord(value) as AppStatus;
  const detected = Array.isArray(raw.detected_agents)
    ? raw.detected_agents.map(normalizeAgentInfo)
    : undefined;
  const lastEvent = raw.last_event ? normalizeSecurityEvent(raw.last_event) : raw.last_event;

  return {
    ...raw,
    detected_agents: detected,
    last_event: lastEvent,
  };
}

export function statusProtectionEnabled(status: AppStatus | null): boolean {
  if (!status) return false;
  if (typeof status.protection_enabled === 'boolean') return status.protection_enabled;
  return Object.keys(status.protected_agents ?? {}).length > 0;
}

export function statusEventCounts(status: AppStatus | null): { blocked: number; warnings: number } {
  if (!status) return { blocked: 0, warnings: 0 };
  return {
    blocked: status.events_24h?.blocked ?? status.blocked_count ?? 0,
    warnings: status.events_24h?.warnings ?? status.warning_count ?? 0,
  };
}

export function slmLabel(status: AppStatus | null): string {
  if (!status) return '未配置';
  if (status.slm?.verification) return status.slm.verification;
  return status.slm_status ?? '未配置';
}

export function normalizeSecurityEvent(raw: any): any {
  return {
    id: raw.id || raw.event_id || `event-${Date.now()}`,
    schema_version: raw.schema_version || '1.0',
    timestamp: raw.timestamp || new Date().toISOString(),
    stage: raw.stage || 'unknown',
    source: raw.source || 'unknown',
    agent: raw.agent || { name: 'unknown', type: 'unknown', session_id: '' },
    action: raw.action || { type: 'unknown', name: 'unknown', resource: '' },
    risk: raw.risk || { category: 'unknown', severity: 'low', confidence: 0 },
    decision: raw.decision || { verdict: 'pass', mode: 'observe', blocked_by: [] },
    evidence: raw.evidence || [],
    recommendation: raw.recommendation || '',
    correlation_id: raw.correlation_id || '',
    raw_ref: raw.raw_ref || '',
  };
}
