import { Card, Tag } from 'antd'

// ====== Types ======
export type ModelInfo = {
  id: string; name: string; epoch?: number; checkpoint?: string
  f1?: number; acc?: number; precision?: number; recall?: number
  resp_f1?: number; resp_acc?: number; think_f1?: number; think_acc?: number
  available?: boolean; path?: string; train_data?: string
}
export type DatasetInfo = {
  id: string; name: string; type: string; split: string; count: number
  sources?: Record<string, number>; labels?: Record<string, number>
  path?: string
}
export type Sample = {
  [key: string]: any
}
export type InferResult = {
  model_id: string; prediction: string; categories?: string[]
  refusal?: string | null; confidence?: Record<string, number>
  raw_output: any; latency_ms: number
  response_assessment?: {
    risk_level: string; risk_confidence: Record<string, number>
    category: string; category_confidence: Record<string, number>
  }
  query_assessment?: {
    risk_level: string; risk_confidence: Record<string, number>
    category: string; category_confidence: Record<string, number>
  }
}
export type PresetSample = {
  id: string; task_type: string; prompt: string; response: string | null
  expected: string; note: string
}

// ====== Constants ======
export const API_BASE = '/api/cheryguard'

// ====== Utility Functions ======
export const labelColor = (label: string) => {
  if (label === 'Safe') return 'green'
  if (label === 'Unsafe') return 'red'
  if (label === 'Controversial') return 'orange'
  return 'default'
}

export const predColor = (pred: string) => {
  if (pred === 'Safe') return 'green'
  if (pred === 'Unsafe') return 'red'
  if (pred === 'Controversial') return 'orange'
  return 'default'
}

export const isCorrect = (pred: string, expected: string) => pred === expected

// ====== Shared Components ======
export function FlowBox({ label, sub, detail, color, bg, w }: { label: string; sub?: string; detail?: string; color: string; bg: string; w?: number }) {
  return (
    <div style={{
      minWidth: w || 70, padding: '3px 7px', borderRadius: 4, textAlign: 'center',
      background: bg, border: `1.5px solid ${color}`, fontSize: 10,
    }}>
      <div style={{ fontWeight: 700, color, fontSize: 10 }}>{label}</div>
      {sub && <div style={{ fontSize: 8, color: '#888', marginTop: 1 }}>{sub}</div>}
      {detail && <div style={{ fontSize: 8, color: '#bbb', marginTop: 1 }}>{detail}</div>}
    </div>
  )
}

export function FlowArrow({ text, dir }: { text?: string; dir?: 'down' }) {
  if (dir === 'down') return <div style={{ textAlign: 'center', color: '#bbb', fontSize: 12, margin: '2px 0' }}>↓ {text || ''}</div>
  return <span style={{ color: '#bbb', fontSize: 14, margin: '0 3px' }}>{text || '→'}</span>
}

export function DPCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return <Card size="small" style={{ marginBottom: 16 }} title={<span style={{ fontSize: 13 }}>{icon} {title}</span>}>{children}</Card>
}

export function MetricCell({ value, best, suffix }: { value: number; best?: boolean; suffix?: string }) {
  return (
    <span style={{ fontWeight: best ? 700 : 400, color: best ? '#52c41a' : '#333' }}>
      {value.toFixed(3)}{suffix || ''}
    </span>
  )
}

export function CaseBox({ title, children, color = '#1890ff' }: { title: string; children: React.ReactNode; color?: string }) {
  return (
    <div style={{ padding: 12, borderRadius: 6, background: '#fafafa', border: `1.5px solid ${color}`, marginBottom: 12 }}>
      <div style={{ fontWeight: 700, color, fontSize: 12, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  )
}

export function Arrow({ text }: { text?: string }) {
  return <div style={{ textAlign: 'center', color: '#bbb', fontSize: 14, margin: '8px 0' }}>↓ {text || ''}</div>
}

export function CaseCard({ title, tag, children }: { title: string; tag: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: 12, borderRadius: 6, background: '#f9f0ff', border: '1.5px solid #722ed1', marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, color: '#722ed1', fontSize: 12 }}>{title}</span>
        <Tag color="purple" style={{ fontSize: 9 }}>{tag}</Tag>
      </div>
      {children}
    </div>
  )
}
