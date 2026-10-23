import { useState, useEffect } from 'react'
import {
  Card, Row, Col, Button, Select, Table, Tag, Statistic, Progress,
  Space, Alert, Collapse, message,
} from 'antd'
import {
  PlayCircleOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ExperimentOutlined,
  BarChartOutlined, WarningOutlined, ThunderboltOutlined,
} from '@ant-design/icons'

const { Option } = Select

// ====== 类型定义 ======
interface EvalModel {
  id: string; name: string; type: string; description: string; available: boolean
}
interface ConfidencePair {
  sample_id: string; input_preview: string; label: string; prediction: string;
  self_confidence: number; token_confidence: number; delta: number; correct: boolean
}
interface EvalResult {
  id: string; model_id: string; model_name: string; dataset: string;
  status: string; created_at: string; total_samples: number;
  metrics: { precision: number; recall: number; f1: number; fpr: number; accuracy: number };
  confusion_matrix: number[][]; confidence_pairs: ConfidencePair[];
  errors: { input: string; expected: string; predicted: string; reason: string }[]
}

// ====== Demo 数据 ======
const DEMO_MODELS: EvalModel[] = [
  { id: 'qiseguard-2b', name: 'QiseGuard-2B', type: 'slm', description: '本地 LoRA 安全模型 (主力)', available: true },
  { id: 'qiseguard-0.8b', name: 'QiseGuard-0.8B', type: 'slm', description: '本地 LoRA 安全模型 (快速)', available: true },
  { id: 'qwen3guard-4b', name: 'Qwen3Guard-4B', type: 'third_party', description: 'ICLR 2026 冠军模型', available: true },
  { id: 'rules-engine', name: '规则引擎', type: 'rules', description: '纯规则引擎 (无 AI)', available: true },
  { id: 'openclaw-hardened', name: '金刚龙虾 (完整)', type: 'full', description: '规则 + SLM + LLM 完整管线', available: true },
  { id: 'openclaw-naked', name: '裸奔龙虾 (对照)', type: 'baseline', description: '无任何安全防护', available: true },
]

function generateDemoResult(modelId: string, modelName: string): EvalResult {
  const base = { precision: 0.92, recall: 0.89, f1: 0.905, fpr: 0.03, accuracy: 0.93 }
  const offsets: Record<string, number> = {
    'qiseguard-2b': 0, 'qiseguard-0.8b': -0.04, 'qwen3guard-4b': 0.02,
    'rules-engine': -0.15, 'openclaw-hardened': 0.03, 'openclaw-naked': -0.35,
  }
  const off = offsets[modelId] || 0
  const clamp = (v: number) => Math.max(0, Math.min(1, +(v + off + (Math.random() - 0.5) * 0.02).toFixed(3)))
  const metrics = {
    precision: clamp(base.precision), recall: clamp(base.recall),
    f1: clamp(base.f1), fpr: clamp(base.fpr), accuracy: clamp(base.accuracy),
  }
  const total = 200
  const labels = ['safe', 'suspicious', 'malicious']
  const pairs: ConfidencePair[] = Array.from({ length: 20 }, (_, i) => {
    const label = labels[i % 3]
    const correct = Math.random() > (0.1 - off * 0.5)
    const sc = +(0.6 + Math.random() * 0.38).toFixed(3)
    const tc = +(sc + (Math.random() - 0.5) * 0.15).toFixed(3)
    return {
      sample_id: `s-${modelId}-${i}`, input_preview: `样本 #${i + 1}: ${['执行 rm -rf /', '读取 ~/.ssh/id_rsa', '正常文件操作', 'curl 外发数据', 'ls -la 目录'][i % 5]}...`,
      label, prediction: correct ? label : labels[(labels.indexOf(label) + 1) % 3],
      self_confidence: sc, token_confidence: Math.max(0, Math.min(1, tc)),
      delta: +(sc - Math.max(0, Math.min(1, tc))).toFixed(3), correct,
    }
  })
  const tp = Math.round(total * metrics.recall * 0.6)
  const fp = Math.round(total * metrics.fpr * 0.4)
  const fn = Math.round(total * (1 - metrics.recall) * 0.6)
  const tn = total - tp - fp - fn
  return {
    id: `eval-${Date.now()}-${modelId}`, model_id: modelId, model_name: modelName,
    dataset: 'mixed_benchmark', status: 'completed', created_at: new Date().toISOString(),
    total_samples: total, metrics,
    confusion_matrix: [[tn, fp, 0], [fn, tp, 0], [0, 0, Math.round(total * 0.1)]],
    confidence_pairs: pairs,
    errors: pairs.filter(p => !p.correct).map(p => ({
      input: p.input_preview, expected: p.label, predicted: p.prediction,
      reason: `置信度差异: self=${p.self_confidence} token=${p.token_confidence}`,
    })),
  }
}

// ====== 主组件 ======
export default function Evaluation() {
  const [selectedModels, setSelectedModels] = useState<string[]>(['qiseguard-2b'])
  const [dataSource, setDataSource] = useState('mixed_benchmark')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<EvalResult[]>([])
  const [selectedResult, setSelectedResult] = useState<EvalResult | null>(null)
  const [isDemo, setIsDemo] = useState(true) // 默认为demo模式，避免初次加载空白

  useEffect(() => {
    fetch('/api/tools/eval/models').then(r => r.json()).then(data => {
      // 如果API成功返回数据，切换到真实模式
      // 后端返回格式: {models: [...]} 或直接是数组
      const models = Array.isArray(data) ? data : (data.models || [])
      if (models.length > 0) {
        setIsDemo(false)
      }
    }).catch(() => { 
      // API失败，保持demo模式
      setIsDemo(true) 
    })
  }, [])

  const runEvaluation = async () => {
    setLoading(true); setProgress(0)
    try {
      const resp = await fetch('/api/tools/eval/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ models: selectedModels, dataset: dataSource }),
      })
      if (!resp.ok) throw new Error('API error')
      const data = await resp.json()
      message.success(`评估任务已启动: ${data.job_id}`)
      // 轮询进度
      const poll = setInterval(async () => {
        try {
          const sr = await fetch(`/api/tools/eval/jobs/${data.job_id}`)
          const sd = await sr.json()
          setProgress(sd.progress || 0)
          if (sd.status === 'completed') {
            clearInterval(poll); setLoading(false); setProgress(100)
            setResults(prev => [...prev, sd.result]); setSelectedResult(sd.result)
          }
        } catch { clearInterval(poll); setLoading(false) }
      }, 2000)
    } catch {
      setIsDemo(true)
      // Demo mode: 模拟评估
      const interval = setInterval(() => {
        setProgress(p => {
          if (p >= 100) {
            clearInterval(interval); setLoading(false)
            const newResults = selectedModels.map(id => {
              const m = DEMO_MODELS.find(x => x.id === id)!
              return generateDemoResult(id, m.name)
            })
            setResults(prev => [...prev, ...newResults])
            setSelectedResult(newResults[0])
            message.success('评估完成（演示模式）')
            return 100
          }
          return p + Math.random() * 15
        })
      }, 300)
    }
  }

  const runComparison = async () => {
    if (selectedModels.length < 2) { message.warning('请选择至少2个模型进行对比'); return }
    setLoading(true); setProgress(0)
    // Demo comparison
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval); setLoading(false)
          const newResults = selectedModels.map(id => {
            const m = DEMO_MODELS.find(x => x.id === id)!
            return generateDemoResult(id, m.name)
          })
          setResults(prev => [...prev, ...newResults])
          message.success('对比评估完成（演示模式）')
          return 100
        }
        return p + Math.random() * 10
      })
    }, 300)
  }

  const metricCards = (r: EvalResult) => (
    <Row gutter={16} style={{ marginBottom: 16 }}>
      {[
        { title: 'Precision', value: r.metrics.precision, color: '#1890ff' },
        { title: 'Recall', value: r.metrics.recall, color: '#52c41a' },
        { title: 'F1 Score', value: r.metrics.f1, color: '#722ed1' },
        { title: 'FPR (误报率)', value: r.metrics.fpr, color: '#fa541c', invert: true },
        { title: 'Accuracy', value: r.metrics.accuracy, color: '#13c2c2' },
      ].map(m => (
        <Col key={m.title} xs={12} sm={8} md={4} lg={4}>
          <Card size="small">
            <Statistic title={m.title} value={m.value} precision={3}
              valueStyle={{ color: m.invert ? (m.value < 0.05 ? '#52c41a' : '#fa541c') : m.color }}
              suffix={m.title === 'FPR' ? '' : ''} />
            <Progress percent={Math.round(m.value * 100)} showInfo={false} strokeColor={m.color} size="small" />
          </Card>
        </Col>
      ))}
    </Row>
  )

  const confidenceColumns = [
    { title: '样本', dataIndex: 'input_preview', key: 'input', ellipsis: true, width: 220 },
    { title: '标签', dataIndex: 'label', key: 'label', width: 90,
      render: (v: string) => <Tag color={v === 'safe' ? 'green' : v === 'suspicious' ? 'orange' : 'red'}>{v}</Tag> },
    { title: '预测', dataIndex: 'prediction', key: 'pred', width: 90,
      render: (v: string, r: ConfidencePair) => <Tag color={r.correct ? 'green' : 'red'}>{v}</Tag> },
    { title: '自报置信度', dataIndex: 'self_confidence', key: 'sc', width: 110,
      render: (v: number) => <span style={{ fontWeight: 600 }}>{v.toFixed(3)}</span> },
    { title: 'Token概率', dataIndex: 'token_confidence', key: 'tc', width: 110,
      render: (v: number) => <span style={{ fontWeight: 600, color: '#722ed1' }}>{v.toFixed(3)}</span> },
    { title: '差异Δ', dataIndex: 'delta', key: 'delta', width: 90,
      render: (v: number) => <Tag color={Math.abs(v) < 0.05 ? 'green' : Math.abs(v) < 0.1 ? 'orange' : 'red'}>{v > 0 ? '+' : ''}{v.toFixed(3)}</Tag> },
    { title: '结果', dataIndex: 'correct', key: 'correct', width: 70,
      render: (v: boolean) => v ? <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 18 }} /> },
  ]

  const confusionLabels = ['Safe (TN)', 'Suspicious', 'Malicious (TP)']

  return (
    <div>
      {isDemo && <Alert type="info" showIcon message="演示模式" description="后端未连接，展示模拟评估数据" style={{ marginBottom: 16 }} closable />}

      {/* 控制面板 */}
      <Card title={<><ExperimentOutlined /> 模型评估</>} style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Space wrap>
              <span>选择模型：</span>
              <Select mode="multiple" style={{ minWidth: 320 }} placeholder="选择要评估的模型"
                value={selectedModels} onChange={setSelectedModels}>
                {DEMO_MODELS.map(m => (
                  <Option key={m.id} value={m.id}>{m.name} ({m.description})</Option>
                ))}
              </Select>
              <span>数据集：</span>
              <Select value={dataSource} onChange={setDataSource} style={{ width: 200 }}>
                <Option value="mixed_benchmark">混合基准 (AgentDojo+Harm+CyberSec)</Option>
                <Option value="injection_attacks">注入攻击集</Option>
                <Option value="exfil_attacks">数据泄露集</Option>
                <Option value="reasoning_attacks">推理安全集</Option>
                <Option value="safe_operations">安全操作集</Option>
                <Option value="compliance">合规测试集</Option>
              </Select>
              <Button type="primary" icon={<PlayCircleOutlined />} onClick={runEvaluation}
                loading={loading} disabled={selectedModels.length === 0}>
                运行评估
              </Button>
              <Button icon={<BarChartOutlined />} onClick={runComparison}
                disabled={selectedModels.length < 2 || loading}>
                多模型对比
              </Button>
            </Space>
          </Col>
        </Row>
        {loading && <Progress percent={Math.round(progress)} status="active" style={{ marginTop: 12 }} />}
      </Card>

      {/* 评估结果 */}
      {results.length > 0 && (
        <>
          {results.length > 1 && (
            <Card title="对比总览" style={{ marginBottom: 16 }}>
              <Table dataSource={results} rowKey="id" pagination={false} size="small"
                columns={[
                  { title: '模型', dataIndex: 'model_name', key: 'model', render: (v: string) => <strong>{v}</strong> },
                  { title: 'Precision', key: 'p', render: (_: unknown, r: EvalResult) => r.metrics.precision.toFixed(3) },
                  { title: 'Recall', key: 'r', render: (_: unknown, r: EvalResult) => r.metrics.recall.toFixed(3) },
                  { title: 'F1', key: 'f1', render: (_: unknown, r: EvalResult) => <strong style={{ color: '#722ed1' }}>{r.metrics.f1.toFixed(3)}</strong> },
                  { title: 'FPR', key: 'fpr', render: (_: unknown, r: EvalResult) => <span style={{ color: r.metrics.fpr < 0.05 ? '#52c41a' : '#fa541c' }}>{r.metrics.fpr.toFixed(3)}</span> },
                  { title: 'Accuracy', key: 'acc', render: (_: unknown, r: EvalResult) => r.metrics.accuracy.toFixed(3) },
                  { title: '样本数', dataIndex: 'total_samples', key: 'total' },
                  { title: '操作', key: 'action', render: (_: unknown, r: EvalResult) => (
                    <Button size="small" type="link" onClick={() => setSelectedResult(r)}>查看详情</Button>
                  )},
                ]}
              />
            </Card>
          )}

          {selectedResult && (
            <>
              {metricCards(selectedResult)}

              {/* 混淆矩阵 */}
              <Card title="混淆矩阵" style={{ marginBottom: 16 }} size="small">
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <table style={{ borderCollapse: 'collapse', textAlign: 'center' }}>
                    <thead>
                      <tr><th style={{ padding: 8 }}></th>{confusionLabels.map(l => <th key={l} style={{ padding: 8, fontSize: 12 }}>{l}</th>)}</tr>
                    </thead>
                    <tbody>
                      {selectedResult.confusion_matrix.map((row, i) => (
                        <tr key={i}>
                          <td style={{ padding: 8, fontWeight: 600, fontSize: 12 }}>{confusionLabels[i]}</td>
                          {row.map((val, j) => {
                            const max = Math.max(...row, 1)
                            const intensity = val / max
                            return (
                              <td key={j} style={{
                                padding: '12px 20px', fontSize: 18, fontWeight: 700,
                                background: i === j ? `rgba(82,196,26,${intensity * 0.3})` : `rgba(255,77,79,${intensity * 0.3})`,
                                border: '1px solid #f0f0f0',
                              }}>{val}</td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* 双置信度对比表格 */}
              <Card title={<><ThunderboltOutlined /> 双置信度对比详情</>} style={{ marginBottom: 16 }} size="small"
                extra={<Tag color="purple">自报 vs Token概率</Tag>}>
                <Table dataSource={selectedResult.confidence_pairs} columns={confidenceColumns}
                  rowKey="sample_id" size="small" pagination={{ pageSize: 10 }}
                  rowClassName={(r: ConfidencePair) => r.correct ? '' : 'ant-table-row-failed'} />
              </Card>

              {/* 错误样本 */}
              {selectedResult.errors.length > 0 && (
                <Card title={<><WarningOutlined /> 错误样本分析 ({selectedResult.errors.length})</>} size="small">
                  <Collapse items={selectedResult.errors.map((e, i) => ({
                    key: i, label: <span><CloseCircleOutlined style={{ color: '#ff4d4f' }} /> {e.input}</span>,
                    children: (
                      <div>
                        <p><strong>期望：</strong><Tag color="green">{e.expected}</Tag> <strong>预测：</strong><Tag color="red">{e.predicted}</Tag></p>
                        <p><strong>分析：</strong>{e.reason}</p>
                      </div>
                    ),
                  }))} />
                </Card>
              )}
            </>
          )}
        </>
      )}

      {/* 历史记录 */}
      {results.length === 0 && !loading && (
        <Card>
          <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
            <ExperimentOutlined style={{ fontSize: 48, marginBottom: 16 }} />
            <p style={{ fontSize: 16 }}>选择模型和数据集，点击"运行评估"开始</p>
            <p>支持单模型评估和多模型对比，结果将展示双置信度分析</p>
          </div>
        </Card>
      )}
    </div>
  )
}
