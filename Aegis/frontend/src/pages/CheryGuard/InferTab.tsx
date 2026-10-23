import { useState, useEffect } from 'react'
import {
  Card, Table, Tag, Row, Col, Statistic, Button, Select, Input,
  Space, Alert, message, Progress, Tooltip, Badge, Collapse, Timeline, Spin,
} from 'antd'
import {
  PlayCircleOutlined, ThunderboltOutlined, CheckCircleOutlined, CloseCircleOutlined,
} from '@ant-design/icons'
import axios from 'axios'
import { API_BASE, type ModelInfo, type InferResult, type PresetSample, predColor } from './shared'

const { TextArea } = Input
const { Option } = Select

export default function InferTab({ models }: { models: any }) {
  const [modelId, setModelId] = useState('gen_v2_ckpt_300')
  const [taskType, setTaskType] = useState('prompt')
  const [prompt, setPrompt] = useState('')
  const [response, setResponse] = useState('')
  const [result, setResult] = useState<InferResult | null>(null)
  const [inferLoading, setInferLoading] = useState(false)
  const [presets, setPresets] = useState<PresetSample[]>([])
  const [expected, setExpected] = useState('')
  const [streamMode, setStreamMode] = useState(false)
  const [streamResult, setStreamResult] = useState<any>(null)
  const [batchResults, setBatchResults] = useState<any[]>([])
  const [batchLoading, setBatchLoading] = useState(false)
  const [liveMode, setLiveMode] = useState(false)
  const [liveLoading, setLiveLoading] = useState(false)
  const [liveTimeline, setLiveTimeline] = useState<any[]>([])
  const [liveInterrupted, setLiveInterrupted] = useState(false)
  const [liveDone, setLiveDone] = useState(false)
  const [unsafeThreshold, setUnsafeThreshold] = useState<number>(0.25)

  const isStream = modelId.startsWith('stream_v2')
  const selectedModel = [...(models?.gen_models || []), ...(models?.stream_models || [])].find(m => m.id === modelId)
  const selectedModelName = selectedModel?.name || modelId
  const isCorrect = !!(result && expected && result.prediction === expected)

  useEffect(() => {
    axios.get(`${API_BASE}/preset-samples`).then(r => setPresets(r.data.samples || [])).catch(() => {})
  }, [])

  const runInfer = async () => {
    if (!prompt) { message.warning('Please enter a prompt'); return }
    if ((taskType === 'response' || isStream) && !response) { message.warning('Please enter a response'); return }

    if (isStream && !liveMode) {
      return runStreamSSE()
    }

    setInferLoading(true); setResult(null); setStreamResult(null); setBatchResults([])
    try {
      const res = await axios.post(`${API_BASE}/infer`, {
        model_id: modelId, task_type: taskType, prompt,
        response: (taskType === 'response' || isStream) ? response : null,
        unsafe_threshold: isStream && unsafeThreshold > 0 ? unsafeThreshold : null,
      })
      setResult(res.data)
    } catch (err: any) {
      console.error('Infer error:', err)
      message.error(`Inference failed: ${err.response?.data?.detail || err.message}`)
    } finally { setInferLoading(false) }
  }

  const runStreamSSE = async () => {
    setLiveLoading(true); setLiveTimeline([]); setLiveInterrupted(false); setLiveDone(false)
    setResult(null); setStreamResult(null); setBatchResults([])
    try {
      const resp = await fetch(`${API_BASE}/infer/stream-sse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_id: modelId, task_type: 'response',
          prompt, response,
          unsafe_threshold: unsafeThreshold > 0 ? unsafeThreshold : null,
        }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: resp.statusText }))
        throw new Error(err.detail || `HTTP ${resp.status}`)
      }
      const reader = resp.body?.getReader()
      if (!reader) throw new Error('No response body')
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() || ''
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6))
              if (event.type === 'sentence') {
                setLiveTimeline(prev => [...prev, { index: event.index, sentence: event.sentence, judgment: null }])
              } else if (event.type === 'judgment') {
                setLiveTimeline(prev => prev.map(item =>
                  item.index === event.index ? { ...item, judgment: { ...event, risk_all: event.risk_all || event.risk_confidence } } : item
                ))
              } else if (event.type === 'interrupted') {
                setLiveInterrupted(true)
              } else if (event.type === 'done') {
                setLiveDone(true)
              } else if (event.type === 'error') {
                message.error(event.message)
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch (err: any) {
      console.error('Stream SSE error:', err)
      message.error(`Stream inference failed: ${err.message}`)
    } finally { setLiveLoading(false) }
  }

  const runBatchPresets = async () => {
    setBatchLoading(true); setBatchResults([]); setResult(null); setStreamResult(null)
    const results: any[] = []
    for (const p of presets) {
      try {
        const res = await axios.post(`${API_BASE}/infer`, {
          model_id: modelId, task_type: p.task_type, prompt: p.prompt,
          response: p.response,
          unsafe_threshold: isStream && unsafeThreshold > 0 ? unsafeThreshold : null,
        })
        const pred = res.data.prediction
        results.push({ ...p, prediction: pred, latency: res.data.latency_ms, correct: pred === p.expected })
      } catch (err: any) {
        results.push({ ...p, prediction: 'ERROR', latency: 0, correct: false, error: err.response?.data?.detail || err.message })
      }
      setBatchResults([...results])
    }
    setBatchLoading(false)
  }

  const loadPreset = (p: PresetSample) => {
    setTaskType(p.task_type); setPrompt(p.prompt)
    setResponse(p.response || ''); setExpected(p.expected)
    setResult(null); setStreamResult(null); setBatchResults([])
    setLiveTimeline([]); setLiveInterrupted(false); setLiveDone(false)
  }

  const runLiveInfer = async () => {
    if (!prompt) { message.warning('Please enter a prompt'); return }
    setLiveLoading(true); setLiveTimeline([]); setLiveInterrupted(false); setLiveDone(false)
    setResult(null); setStreamResult(null); setBatchResults([])
    try {
      const resp = await fetch(`${API_BASE}/infer/stream-live`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_id: modelId, task_type: 'response', prompt, response: null, unsafe_threshold: unsafeThreshold > 0 ? unsafeThreshold : null }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: resp.statusText }))
        throw new Error(err.detail || `HTTP ${resp.status}`)
      }
      const reader = resp.body?.getReader()
      if (!reader) throw new Error('No response body')
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() || ''
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6))
              if (event.type === 'sentence') {
                setLiveTimeline(prev => [...prev, { index: event.index, sentence: event.sentence, judgment: null }])
              } else if (event.type === 'judgment') {
                setLiveTimeline(prev => prev.map(item =>
                  item.index === event.index ? { ...item, judgment: { ...event, risk_all: event.risk_all || event.risk_confidence } } : item
                ))
              } else if (event.type === 'interrupted') {
                setLiveInterrupted(true)
              } else if (event.type === 'done') {
                setLiveDone(true)
              } else if (event.type === 'error') {
                message.error(event.message)
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch (err: any) {
      console.error('Live infer error:', err)
      message.error(`Live inference failed: ${err.message}`)
    } finally { setLiveLoading(false) }
  }

  return (
    <div>
      <Row gutter={16}>
        <Col span={14}>
          <Card title={<><PlayCircleOutlined /> Inference Playground</>} size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space wrap>
                <Select value={modelId} onChange={setModelId} style={{ width: 260 }}>
                  {(models?.gen_models || []).map((m: ModelInfo) => <Option key={m.id} value={m.id} disabled={!m.available}>{m.name}</Option>)}
                  {(models?.stream_models || []).map((m: ModelInfo) => <Option key={m.id} value={m.id} disabled={!m.available}>{m.name}</Option>)}
                </Select>
                {!isStream && (
                  <Select value={taskType} onChange={setTaskType} style={{ width: 140 }}>
                    <Option value="prompt">Prompt Classification</Option>
                    <Option value="response">Response Classification</Option>
                  </Select>
                )}
                {isStream && (
                  <Space size={4}>
                    <span style={{ fontSize: 11, color: '#999' }}>模式:</span>
                    <Button size="small" type={!liveMode ? 'primary' : 'default'}
                      onClick={() => { setLiveMode(false); setStreamMode(true) }}>手动</Button>
                    <Button size="small" type={liveMode ? 'primary' : 'default'}
                      onClick={() => { setLiveMode(true); setStreamMode(false) }}>Live 生成</Button>
                  </Space>
                )}
                {isStream && (
                  <Space size={4} align="center">
                    <span style={{ fontSize: 11, color: '#999' }}>Unsafe 阈值:</span>
                    <input type="range" min={0} max={0.5} step={0.05} value={unsafeThreshold}
                      onChange={e => setUnsafeThreshold(parseFloat(e.target.value))}
                      style={{ width: 80, verticalAlign: 'middle' }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: unsafeThreshold > 0 ? '#ff4d4f' : '#999' }}>
                      {unsafeThreshold > 0 ? `≥${unsafeThreshold.toFixed(2)}` : '关闭'}
                    </span>
                    <Tooltip title="模型 argmax 偏保守（倾向 Safe）。设阈值后，当 P(Unsafe)≥阈值时覆盖为 Unsafe。0=纯 argmax。参考：安全内容 P(Unsafe)≈0.02-0.17，危险内容≈0.20-0.27，明显危险≈0.9+">
                      <span style={{ fontSize: 10, color: '#bbb', cursor: 'help' }}>(?)</span>
                    </Tooltip>
                  </Space>
                )}
                {!liveMode && (
                  <Button type="primary" icon={<PlayCircleOutlined />} onClick={runInfer} loading={inferLoading}>Run</Button>
                )}
                {liveMode && (
                  <Button type="primary" danger icon={<ThunderboltOutlined />}
                    onClick={runLiveInfer} loading={liveLoading}>生成并检测</Button>
                )}
              </Space>

              <div>
                <label style={{ fontWeight: 600 }}>Prompt:</label>
                <TextArea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3}
                  placeholder={liveMode ? '输入问题，AI 将现场生成回答并逐句检测...' : 'Enter user query...'}
                  style={{ marginTop: 4 }} />
              </div>

              {!liveMode && (taskType === 'response' || isStream) && (
                <div>
                  <label style={{ fontWeight: 600 }}>Response:</label>
                  <TextArea value={response} onChange={e => setResponse(e.target.value)} rows={4}
                    placeholder="Enter assistant responses..." style={{ marginTop: 4 }} />
                </div>
              )}
            </Space>
          </Card>
        </Col>

        <Col span={10}>
          <Card title={<span><ThunderboltOutlined /> Preset Samples</span>} size="small"
            extra={<Space>
              <Badge count={presets.length} />
              <Button size="small" type="dashed" icon={<PlayCircleOutlined />}
                onClick={runBatchPresets} loading={batchLoading}>Run All</Button>
            </Space>}>
            {presets.map(p => (
              <div key={p.id} style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                <Row justify="space-between" align="middle">
                  <Col flex="auto">
                    <Tag color={p.task_type === 'prompt' ? 'blue' : 'purple'}>{p.task_type}</Tag>
                    <Tag color={p.expected === 'Safe' ? 'green' : 'red'}>{p.expected}</Tag>
                    <span style={{ fontSize: 12, color: '#666' }}>{(p.prompt || '').slice(0, 50)}...</span>
                  </Col>
                  <Col><Button size="small" type="link" onClick={() => loadPreset(p)}>Load</Button></Col>
                </Row>
                <div style={{ fontSize: 10, color: '#999', marginLeft: 8 }}>{p.note}</div>
              </div>
            ))}
          </Card>
        </Col>
      </Row>

      {/* Live Timeline */}
      {(liveTimeline.length > 0 || liveLoading) && (
        <Card
          title={
            <span>
              <ThunderboltOutlined /> {liveMode ? 'Live 生成检测' : '逐句流式检测'} — {selectedModelName}
              {liveDone && !liveInterrupted && <Tag color="green" style={{ marginLeft: 8 }}>完成</Tag>}
              {liveInterrupted && <Tag color="red" style={{ marginLeft: 8 }}>已打断</Tag>}
              {liveLoading && <Tag color="processing" style={{ marginLeft: 8 }}>{liveMode ? '生成中...' : '检测中...'}</Tag>}
            </span>
          }
          size="small" style={{ marginTop: 16 }}
        >
          {liveInterrupted && (
            <Alert type="error" banner showIcon style={{ marginBottom: 12 }}
              message="检测到不安全内容，输出已自动打断和冻结" />
          )}
          {liveMode && unsafeThreshold > 0 && (
            <div style={{ marginBottom: 8, fontSize: 11, color: '#999' }}>
              Unsafe 阈值覆盖: 当 Unsafe 概率 ≥ {unsafeThreshold.toFixed(2)} 时判定为 Unsafe（模型 argmax 偏保守）
            </div>
          )}
          <Timeline
            items={liveTimeline.map((t: any) => {
              const j = t.judgment
              const risk = j?.risk_level
              const judging = !j
              return {
                key: t.index,
                color: judging ? 'gray' : risk === 'Unsafe' ? 'red' : risk === 'Controversial' ? 'orange' : 'green',
                children: (
                  <div style={{ paddingBottom: 4 }}>
                    <div style={{
                      fontSize: 13, color: '#333', padding: '6px 10px', borderRadius: 4,
                      background: judging ? '#f5f5f5' : risk === 'Unsafe' ? '#fff2f0' : risk === 'Controversial' ? '#fffbe6' : '#f6ffed',
                      borderLeft: judging ? '3px solid #d9d9d9' : `3px solid ${risk === 'Unsafe' ? '#ff4d4f' : risk === 'Controversial' ? '#faad14' : '#52c41a'}`,
                    }}>
                      {t.sentence}
                    </div>
                    {judging ? (
                      <div style={{ marginTop: 4, fontSize: 11, color: '#999' }}>
                        <Spin size="small" style={{ marginRight: 4 }} /> 判定中...
                      </div>
                    ) : (
                      <div style={{ marginTop: 4 }}>
                        <Space wrap size={4} align="center">
                          <Tag color={predColor(risk)} style={{ fontSize: 12, fontWeight: 600 }}>{risk}</Tag>
                          {j.threshold_applied && (
                            <Tag color="volcano" style={{ fontSize: 10 }}>阈值覆盖 (argmax: {j.argmax_risk})</Tag>
                          )}
                          {j.category && risk !== 'Safe' && <Tag color="orange" style={{ fontSize: 10 }}>{j.category}</Tag>}
                          <span style={{ fontSize: 10, color: '#bbb' }}>⏱ {j.judge_latency_ms}ms</span>
                        </Space>
                        <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 10 }}>
                          {Object.keys(j.risk_all || { Safe: 0, Unsafe: 0 }).map(lbl => {
                            const v = j.risk_all?.[lbl] ?? 0
                            const isPred = lbl === risk
                            const c = lbl === 'Safe' ? '#52c41a' : lbl === 'Unsafe' ? '#ff4d4f' : '#faad14'
                            return (
                              <div key={lbl} style={{ flex: 1, minWidth: 60 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}>
                                  <span style={{ color: isPred ? c : '#bbb', fontWeight: isPred ? 700 : 400 }}>{lbl}</span>
                                  <span style={{ color: isPred ? c : '#bbb', fontWeight: isPred ? 700 : 400 }}>{v.toFixed(3)}</span>
                                </div>
                                <div style={{ height: 4, background: '#f0f0f0', borderRadius: 2 }}>
                                  <div style={{ width: `${v * 100}%`, height: '100%', background: c, borderRadius: 2, opacity: isPred ? 1 : 0.4 }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ),
              }
            })}
            pending={liveLoading ? '等待 AI 生成下一句...' : undefined}
          />
        </Card>
      )}

      {/* Result */}
      {result && (isStream && result.response_assessment && result.query_assessment ? (
        <StreamResultCard result={result} selectedModelName={selectedModelName}
          prompt={prompt} response={response}
          expected={expected} isCorrect={isCorrect} predColor={predColor} />
      ) : (
        <Card title={`Inference Result — ${selectedModelName}`} size="small" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic title="Prediction" value={result.prediction}
                valueStyle={{ color: predColor(result.prediction) }} />
              {expected && (
                <div style={{ marginTop: 4 }}>
                  Expected: <Tag color={predColor(expected)}>{expected}</Tag>
                  {isCorrect
                    ? <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18, marginLeft: 8 }} />
                    : <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 18, marginLeft: 8 }} />}
                </div>
              )}
            </Col>
            <Col span={4}>
              <Statistic title="Latency" value={result.latency_ms} suffix="ms" />
            </Col>
            {result.confidence && (
              <Col span={14}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Confidence Distribution:</div>
                {Object.entries(result.confidence).map(([k, v]) => (
                  <div key={k} style={{ marginBottom: 4 }}>
                    <Tag color={predColor(k)} style={{ width: 90 }}>{k}</Tag>
                    <Progress percent={Math.round(v * 100)} size="small" style={{ width: '60%', display: 'inline-flex' }}
                      strokeColor={predColor(k)} format={() => v.toFixed(3)} />
                  </div>
                ))}
              </Col>
            )}
            {result.categories && result.categories.length > 0 && (
              <Col span={14}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Categories:</div>
                {result.categories.map((c: string) => <Tag key={c} color="orange">{c}</Tag>)}
              </Col>
            )}
            {result.refusal && (
              <Col span={6}>
                <Statistic title="Refusal" value={result.refusal} />
              </Col>
            )}
          </Row>
          <Collapse style={{ marginTop: 12 }} items={[{
            key: 'raw', label: 'Raw Output', children: <pre style={{ fontSize: 12 }}>{typeof result.raw_output === 'string' ? result.raw_output : JSON.stringify(result.raw_output, null, 2)}</pre>,
          }]} />
        </Card>
      ))}

      {/* Stream Timeline */}
      {streamResult && (
        <Card title={`逐句流式推理 — ${selectedModelName} (${streamResult.total_sentences} 句, ${streamResult.latency_ms}ms)`}
          size="small" style={{ marginTop: 16 }}>
          <Alert type="info" banner style={{ marginBottom: 12 }}
            message="模型逐句累积输入 ASSISTANT 回复，使用 Response heads 判定每句安全性。不安全时在 Live 模式下自动打断。" />
          <Timeline items={streamResult.timeline.map((t: any) => ({
            key: t.index,
            color: t.risk_level === 'Unsafe' ? 'red' : t.risk_level === 'Controversial' ? 'orange' : 'green',
            children: (
              <div style={{ paddingBottom: 4 }}>
                <Space wrap size={4} align="center">
                  <Tag color={predColor(t.risk_level)} style={{ fontSize: 12, fontWeight: 600 }}>{t.risk_level}</Tag>
                  {t.threshold_applied && (
                    <Tag color="volcano" style={{ fontSize: 10 }}>阈值覆盖 (argmax: {t.argmax_risk})</Tag>
                  )}
                  {t.category && t.risk_level !== 'Safe' && <Tag color="orange" style={{ fontSize: 10 }}>{t.category}</Tag>}
                  <span style={{ fontSize: 10, color: '#bbb' }}>⏱ {t.judge_latency_ms}ms</span>
                </Space>
                <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 10 }}>
                  {Object.keys(t.risk_all || { Safe: 0, Unsafe: 0 }).map(lbl => {
                    const v = t.risk_all?.[lbl] ?? 0
                    const isPred = lbl === t.risk_level
                    const c = lbl === 'Safe' ? '#52c41a' : lbl === 'Unsafe' ? '#ff4d4f' : '#faad14'
                    return (
                      <div key={lbl} style={{ flex: 1, minWidth: 60 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}>
                          <span style={{ color: isPred ? c : '#bbb', fontWeight: isPred ? 700 : 400 }}>{lbl}</span>
                          <span style={{ color: isPred ? c : '#bbb', fontWeight: isPred ? 700 : 400 }}>{v.toFixed(3)}</span>
                        </div>
                        <div style={{ height: 4, background: '#f0f0f0', borderRadius: 2 }}>
                          <div style={{ width: `${v * 100}%`, height: '100%', background: c, borderRadius: 2, opacity: isPred ? 1 : 0.4 }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div style={{ fontSize: 12, color: '#333', marginTop: 4, padding: '4px 8px',
                  background: t.risk_level === 'Unsafe' ? '#fff2f0' : t.risk_level === 'Controversial' ? '#fffbe6' : '#f6ffed',
                  borderRadius: 4 }}>
                  {t.sentence}
                </div>
              </div>
            ),
          }))} />
        </Card>
      )}

      {/* Batch Results */}
      {batchResults.length > 0 && (
        <Card title={`批量测试结果 — ${selectedModelName} (${batchResults.filter(r => r.correct).length}/${batchResults.length} correct)`}
          size="small" style={{ marginTop: 16 }}>
          <Table dataSource={batchResults} rowKey="id" size="small" pagination={false}
            columns={[
              { title: 'Type', dataIndex: 'task_type', key: 'type', width: 70,
                render: (v: string) => <Tag color={v === 'prompt' ? 'blue' : 'purple'}>{v}</Tag> },
              { title: 'Prompt', dataIndex: 'prompt', key: 'prompt', ellipsis: true,
                render: (v: string) => <code style={{ fontSize: 11 }}>{(v || '').slice(0, 60)}</code> },
              { title: 'Expected', dataIndex: 'expected', key: 'exp', width: 80,
                render: (v: string) => <Tag color={predColor(v)}>{v}</Tag> },
              { title: 'Prediction', dataIndex: 'prediction', key: 'pred', width: 90,
                render: (v: string) => <Tag color={predColor(v)} style={{ fontWeight: 600 }}>{v}</Tag> },
              { title: '', key: 'ok', width: 40,
                render: (_: any, r: any) => r.correct
                  ? <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />
                  : <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 16 }} /> },
              { title: 'Latency', dataIndex: 'latency', key: 'lat', width: 80,
                render: (v: number) => v ? `${v}ms` : '—' },
            ]}
          />
        </Card>
      )}
    </div>
  )
}

function StreamResultCard({ result, selectedModelName, prompt, response, expected, isCorrect, predColor }: {
  result: InferResult; selectedModelName: string; prompt: string; response: string
  expected: string; isCorrect: boolean
  predColor: (pred: string) => string
}) {
  const AssessmentPanel = ({ title, assessment, accent }: { title: string; assessment: any; accent: string }) => {
    if (!assessment) return null
    return (
      <div style={{ flex: 1, padding: '8px 12px', background: '#fafafa', borderRadius: 8, minWidth: 0, borderLeft: `3px solid ${accent}` }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: '#333' }}>{title}</div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>Risk Level</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tag color={predColor(assessment.risk_level)} style={{ fontSize: 14, padding: '2px 10px' }}>
              {assessment.risk_level}
            </Tag>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{(assessment.risk_confidence?.[assessment.risk_level] || 0).toFixed(3)}</span>
          </div>
          {assessment.risk_confidence && (
            <div style={{ marginTop: 4 }}>
              {Object.entries(assessment.risk_confidence as Record<string, number>).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 1 }}>
                  <span style={{ fontSize: 10, width: 80, color: '#666' }}>{k}</span>
                  <Progress percent={Math.round(v * 100)} size="small" showInfo={false}
                    style={{ flex: 1, margin: 0 }} strokeColor={predColor(k)} />
                  <span style={{ fontSize: 10, width: 36, textAlign: 'right' }}>{v.toFixed(3)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>Category</div>
          <Tag color="orange" style={{ fontSize: 12 }}>{assessment.category}</Tag>
          <span style={{ fontWeight: 600, fontSize: 12, marginLeft: 4 }}>
            {(assessment.category_confidence?.[assessment.category] || 0).toFixed(3)}
          </span>
          {assessment.category_confidence && (
            <div style={{ marginTop: 6, maxHeight: 140, overflowY: 'auto', padding: '2px 4px' }}>
              {Object.entries(assessment.category_confidence as Record<string, number>)
                .filter(([, v]) => v > 0.01)
                .sort(([, a], [, b]) => b - a)
                .map(([k, v]) => {
                  const isPred = k === assessment.category
                  return (
                    <div key={k} style={{
                      display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2,
                      padding: isPred ? '2px 4px' : '0',
                      background: isPred ? 'rgba(250,173,20,0.12)' : 'transparent',
                      borderRadius: 3,
                    }}>
                      <span style={{
                        fontSize: 10, width: 150, color: isPred ? '#d48806' : '#666',
                        fontWeight: isPred ? 600 : 400,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{k}</span>
                      <Progress percent={Math.round(v * 100)} size="small" showInfo={false}
                        style={{ flex: 1, margin: 0 }} strokeColor={isPred ? '#d48806' : '#faad14'} />
                      <span style={{
                        fontSize: 10, width: 48, textAlign: 'right',
                        fontWeight: isPred ? 600 : 400, color: isPred ? '#d48806' : '#999',
                      }}>
                        {Math.round(v * 100)}% ({v.toFixed(3)})
                      </span>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <Card title={`Inference Result — ${selectedModelName}`} size="small" style={{ marginTop: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 12, color: '#888', marginBottom: 4 }}>Input Echo</div>
        <div style={{ background: '#f5f5f5', padding: '8px 12px', borderRadius: 6 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <Tag color="blue" style={{ fontSize: 10, flexShrink: 0 }}>USER</Tag>
            <span style={{ fontSize: 12, color: '#333' }}>{prompt}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginTop: 6 }}>
            <Tag color="purple" style={{ fontSize: 10, flexShrink: 0 }}>ASSISTANT</Tag>
            <span style={{ fontSize: 12, color: '#333', whiteSpace: 'pre-wrap' }}>{response || '(empty)'}</span>
          </div>
        </div>
      </div>

      <Alert type="info" style={{ marginBottom: 12 }}
        message="Stream model evaluates both Response (left) and Query (right) simultaneously"
        banner />
      <div style={{ display: 'flex', gap: 12 }}>
        <AssessmentPanel title="📤 Response Assessment" assessment={result.response_assessment} accent="#722ed1" />
        <AssessmentPanel title="📥 Query Assessment" assessment={result.query_assessment} accent="#1890ff" />
      </div>
      <Row gutter={16} style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
        <Col span={6}>
          <Statistic title="Latency" value={result.latency_ms} suffix="ms" />
        </Col>
        {expected && (
          <Col span={8}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Expected vs Actual</div>
            <div>
              <Tag color={predColor(expected)}>Expected: {expected}</Tag>
              <Tag color={predColor(result.prediction)}>Actual: {result.prediction}</Tag>
              {isCorrect
                ? <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18, marginLeft: 8 }} />
                : <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 18, marginLeft: 8 }} />}
            </div>
          </Col>
        )}
      </Row>
      <Collapse style={{ marginTop: 12 }} items={[{
        key: 'raw', label: 'Raw Logits (response + query heads)',
        children: <pre style={{ fontSize: 11 }}>{JSON.stringify(result.raw_output, null, 2)}</pre>,
      }]} />
    </Card>
  )
}
