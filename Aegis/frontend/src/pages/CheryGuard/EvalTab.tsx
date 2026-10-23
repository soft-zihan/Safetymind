import { useState, useEffect } from 'react'
import { Card, Table, Tag, Row, Col, Statistic, Tooltip, Alert, Empty, Spin, Collapse } from 'antd'
import {
  ThunderboltOutlined, BarChartOutlined, SafetyOutlined,
  BulbOutlined, FilterOutlined, TrophyOutlined,
} from '@ant-design/icons'
import axios from 'axios'
import { API_BASE } from './shared'

const { Panel } = Collapse

// 指标单元格组件
function MetricCell({ val, best, color }: { val: number; best: boolean; color: string }) {
  return (
    <Tooltip title={best ? '胜出' : ''}>
      <span style={{ fontWeight: best ? 700 : 400, color: best ? color : '#999' }}>
        {val.toFixed(3)}
      </span>
    </Tooltip>
  )
}

// ====== 交叉评估组件 ======
function CrossEvalSection({ data }: { data: any }) {
  const gen = data.gen_v2 || {}
  const stream = data.stream_v2 || {}
  const datasets = Object.keys(gen).filter(d => stream[d])
  if (datasets.length === 0) return null

  const datasetMeta: Record<string, { desc: string; type: string }> = {
    thinking: { desc: 'Qwen3GuardTest/thinking', type: 'prompt' },
    response_loc: { desc: 'Qwen3GuardTest/response_loc', type: 'response' },
    thinking_loc: { desc: 'Qwen3GuardTest/thinking_loc', type: 'response' },
    toxicchat: { desc: 'ToxicChat/test', type: 'prompt' },
    simplesafety: { desc: 'SimpleSafetyTests', type: 'prompt' },
  }

  const compareCols = [
    { title: '测试集', dataIndex: 'dataset', key: 'ds', width: 130,
      render: (v: string) => (
        <div>
          <strong>{v}</strong>
          {datasetMeta[v] && <div style={{ fontSize: 9, color: '#bbb' }}>{datasetMeta[v].desc}</div>}
        </div>
      ) },
    { title: '类型', dataIndex: 'type', key: 'type', width: 70,
      render: (v: string) => <Tag style={{ fontSize: 9 }} color={v === 'prompt' ? 'blue' : 'purple'}>{v}</Tag> },
    { title: 'N', dataIndex: 'n', key: 'n', width: 50 },
    { title: 'F1', key: 'gf', width: 70,
      render: (_: any, r: any) => <MetricCell val={r.gF1} best={r.gF1 >= r.sF1} color="#722ed1" /> },
    { title: 'P', key: 'gp', width: 60,
      render: (_: any, r: any) => <MetricCell val={r.gPrec} best={r.gPrec >= r.sPrec} color="#722ed1" /> },
    { title: 'R', key: 'gr', width: 60,
      render: (_: any, r: any) => <MetricCell val={r.gRecall} best={r.gRecall >= r.sRecall} color="#722ed1" /> },
    { title: 'Acc', key: 'ga', width: 60,
      render: (_: any, r: any) => <MetricCell val={r.gAcc} best={r.gAcc >= r.sAcc} color="#722ed1" /> },
    { title: 'F1', key: 'sf', width: 70,
      render: (_: any, r: any) => <MetricCell val={r.sF1} best={r.sF1 >= r.gF1} color="#52c41a" /> },
    { title: 'P', key: 'sp', width: 60,
      render: (_: any, r: any) => <MetricCell val={r.sPrec} best={r.sPrec >= r.gPrec} color="#52c41a" /> },
    { title: 'R', key: 'sr', width: 60,
      render: (_: any, r: any) => <MetricCell val={r.sRecall} best={r.sRecall >= r.gRecall} color="#52c41a" /> },
    { title: 'Acc', key: 'sa', width: 60,
      render: (_: any, r: any) => <MetricCell val={r.sAcc} best={r.sAcc >= r.gAcc} color="#52c41a" /> },
    { title: 'Gen ms', key: 'gl', width: 75,
      render: (_: any, r: any) => <span style={{ color: '#1890ff', fontWeight: 600 }}>{r.gLatency?.toFixed(0)}</span> },
    { title: 'Stream ms', key: 'sl', width: 75,
      render: (_: any, r: any) => <span style={{ color: '#52c41a', fontWeight: 600 }}>{r.sLatency?.toFixed(0)}</span> },
    { title: '加速比', key: 'sp2', width: 70,
      render: (_: any, r: any) => {
        if (!r.gLatency || !r.sLatency) return '—'
        const ratio = r.gLatency / r.sLatency
        return <Tag color="green" style={{ fontWeight: 700 }}>{ratio.toFixed(0)}x</Tag>
      } },
  ]

  const compareData = datasets.map(ds => {
    const g = gen[ds] || {}; const s = stream[ds] || {}
    return {
      key: ds, dataset: ds, type: datasetMeta[ds]?.type || g.type || s.type || '',
      n: g.n_samples || s.n_samples || 0,
      gF1: g.f1 || 0, sF1: s.f1 || 0,
      gPrec: g.precision || 0, sPrec: s.precision || 0,
      gRecall: g.recall || 0, sRecall: s.recall || 0,
      gAcc: g.accuracy || 0, sAcc: s.accuracy || 0,
      gLatency: g.latency_ms?.mean || 0, sLatency: s.latency_ms?.mean || 0,
      gP50: g.latency_ms?.p50 || 0, sP50: s.latency_ms?.p50 || 0,
      gP95: g.latency_ms?.p95 || 0, sP95: s.latency_ms?.p95 || 0,
      gMin: g.latency_ms?.min || 0, sMin: s.latency_ms?.min || 0,
      gMax: g.latency_ms?.max || 0, sMax: s.latency_ms?.max || 0,
      gTotal: g.total_time_s || 0, sTotal: s.total_time_s || 0,
      gPred: g.pred_distribution || {}, sPred: s.pred_distribution || {},
      gGt: g.gt_distribution || {}, sGt: s.gt_distribution || {},
    }
  })

  const maxLatency = Math.max(...compareData.map(d => Math.max(d.gLatency, d.sLatency)), 1)
  const avgGenF1 = compareData.reduce((s, d) => s + d.gF1, 0) / compareData.length
  const avgStreamF1 = compareData.reduce((s, d) => s + d.sF1, 0) / compareData.length
  const avgGenLat = compareData.reduce((s, d) => s + d.gLatency, 0) / compareData.length
  const avgStreamLat = compareData.reduce((s, d) => s + d.sLatency, 0) / compareData.length
  const genWins = compareData.filter(d => d.gF1 > d.sF1).length
  const streamWins = compareData.filter(d => d.sF1 > d.gF1).length

  return (
    <div>
      <Card title={<span><ThunderboltOutlined /> 交叉评估: 生成式输出头 vs Softmax 分类头</span>}
        size="small" style={{ marginTop: 16, border: '2px solid #722ed1' }}>
        <Alert type="success" banner showIcon style={{ marginBottom: 12 }}
          message="同一测试集公平对比两种 LoRA 架构"
          description={
            <span style={{ fontSize: 12 }}>
              <strong>Gen</strong> (生成式 CausalLM + LoRA, r=16, 1.67% 可训练参数) 输出 <code>Safety: Safe/Unsafe/Controversial</code> 文本
              <strong> vs </strong>
              <strong>Stream</strong> (Backbone LoRA + Dual Softmax Head, r=16) 直接输出二分类 logits。
              训练数据同源 (Aegis2.0/BeaverTails/HarmfulQA) 但标签不同 (3分类 vs 2分类)，测试集与训练集无重叠。
            </span>
          } />

        <Row gutter={8} style={{ marginBottom: 12 }}>
          <Col span={4}><Statistic title="测试集数" value={datasets.length} /></Col>
          <Col span={4}><Statistic title="总样本数" value={compareData.reduce((s, d) => s + d.n, 0)} /></Col>
          <Col span={4}><Statistic title="Gen 胜场" value={genWins} valueStyle={{ color: '#722ed1' }} /></Col>
          <Col span={4}><Statistic title="Stream 胜场" value={streamWins} valueStyle={{ color: '#52c41a' }} /></Col>
          <Col span={4}><Statistic title="平均加速比" value={(avgGenLat / avgStreamLat).toFixed(0) + 'x'} valueStyle={{ color: '#52c41a' }} /></Col>
          <Col span={4}><Statistic title="Δ F1 均值" value={(avgStreamF1 - avgGenF1).toFixed(3)} valueStyle={{ color: avgStreamF1 > avgGenF1 ? '#52c41a' : '#ff4d4f' }} /></Col>
        </Row>

        <div style={{ overflowX: 'auto' }}>
          <Table dataSource={compareData} columns={compareCols} pagination={false} size="small" scroll={{ x: 1000 }}
            summary={(pageData) => {
              const tgF1 = pageData.reduce((s, r) => s + r.gF1, 0) / pageData.length
              const tsF1 = pageData.reduce((s, r) => s + r.sF1, 0) / pageData.length
              const tgLat = pageData.reduce((s, r) => s + r.gLatency, 0) / pageData.length
              const tsLat = pageData.reduce((s, r) => s + r.sLatency, 0) / pageData.length
              return (
                <Table.Summary.Row style={{ background: '#f9f0ff', fontWeight: 700 }}>
                  <Table.Summary.Cell index={0}>平均</Table.Summary.Cell>
                  <Table.Summary.Cell index={1} />
                  <Table.Summary.Cell index={2} />
                  <Table.Summary.Cell index={3}><span style={{ color: '#722ed1' }}>{tgF1.toFixed(3)}</span></Table.Summary.Cell>
                  <Table.Summary.Cell index={4} /><Table.Summary.Cell index={5} /><Table.Summary.Cell index={6} />
                  <Table.Summary.Cell index={7}><span style={{ color: '#52c41a' }}>{tsF1.toFixed(3)}</span></Table.Summary.Cell>
                  <Table.Summary.Cell index={8} /><Table.Summary.Cell index={9} /><Table.Summary.Cell index={10} />
                  <Table.Summary.Cell index={11}><span style={{ color: '#1890ff' }}>{tgLat.toFixed(0)}</span></Table.Summary.Cell>
                  <Table.Summary.Cell index={12}><span style={{ color: '#52c41a' }}>{tsLat.toFixed(0)}</span></Table.Summary.Cell>
                  <Table.Summary.Cell index={13}><Tag color="green">{(tgLat / tsLat).toFixed(0)}x</Tag></Table.Summary.Cell>
                </Table.Summary.Row>
              )
            }}
          />
        </div>

        <div style={{ marginTop: 4, marginBottom: 8, display: 'flex', justifyContent: 'center', gap: 24 }}>
          <Tag color="purple">← Gen 指标 (F1/P/R/Acc)</Tag>
          <Tag color="green">Stream 指标 (F1/P/R/Acc) →</Tag>
          <Tag color="blue">时延 (ms/样本)</Tag>
        </div>
      </Card>

      {/* F1 对比柱状图 */}
      <Card title={<span><BarChartOutlined /> F1 对比 (越高越好)</span>} size="small" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 240, padding: '0 20px' }}>
          {compareData.map(d => (
            <div key={d.dataset} style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ display: 'flex', gap: 3, justifyContent: 'center', alignItems: 'flex-end', height: 200 }}>
                <div style={{ width: 20, height: `${d.gF1 * 200}px`,
                  background: '#722ed1', borderRadius: '3px 3px 0 0',
                  opacity: d.gF1 >= d.sF1 ? 1 : 0.4,
                  border: d.gF1 >= d.sF1 ? '2px solid #531dab' : 'none' }} />
                <div style={{ width: 20, height: `${d.sF1 * 200}px`,
                  background: '#52c41a', borderRadius: '3px 3px 0 0',
                  opacity: d.sF1 >= d.gF1 ? 1 : 0.4,
                  border: d.sF1 >= d.gF1 ? '2px solid #389e0d' : 'none' }} />
              </div>
              <div style={{ fontSize: 9, color: '#999', marginTop: 3 }}>
                <span style={{ color: '#722ed1', fontWeight: 600 }}>{d.gF1.toFixed(2)}</span>
                {' / '}
                <span style={{ color: '#52c41a', fontWeight: 600 }}>{d.sF1.toFixed(2)}</span>
              </div>
              <div style={{ fontSize: 9, color: '#666', marginTop: 2 }}>{d.dataset}</div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <Tag color="purple">■ Gen (生成式)</Tag>
          <Tag color="green">■ Stream (Softmax)</Tag>
        </div>
      </Card>

      {/* 时延对比柱状图 */}
      <Card title={<span><ThunderboltOutlined /> 时延对比 ms/样本 (越低越好)</span>} size="small" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 240, padding: '0 20px' }}>
          {compareData.map(d => (
            <div key={d.dataset} style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ display: 'flex', gap: 3, justifyContent: 'center', alignItems: 'flex-end', height: 200 }}>
                <div style={{ width: 20, height: `${(d.gLatency / maxLatency) * 200}px`,
                  background: '#1890ff', borderRadius: '3px 3px 0 0' }} />
                <div style={{ width: 20, height: `${(d.sLatency / maxLatency) * 200}px`,
                  background: '#52c41a', borderRadius: '3px 3px 0 0' }} />
              </div>
              <div style={{ fontSize: 9, color: '#999', marginTop: 3 }}>
                <span style={{ color: '#1890ff', fontWeight: 600 }}>{d.gLatency.toFixed(0)}</span>
                {' / '}
                <span style={{ color: '#52c41a', fontWeight: 600 }}>{d.sLatency.toFixed(0)}</span>
              </div>
              <div style={{ fontSize: 9, color: '#666', marginTop: 2 }}>{d.dataset}</div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <Tag color="blue">■ Gen (生成式)</Tag>
          <Tag color="green">■ Stream (Softmax)</Tag>
        </div>
      </Card>

      {/* 延迟分布明细 */}
      <Card title={<span><FilterOutlined /> 延迟分布明细 (ms)</span>} size="small" style={{ marginTop: 16 }}>
        <Table dataSource={compareData} pagination={false} size="small"
          columns={[
            { title: '测试集', dataIndex: 'dataset', key: 'ds', width: 120,
              render: (v: string) => <strong>{v}</strong> },
            { title: 'Gen Mean', key: 'gm', width: 80, render: (_: any, r: any) => <span style={{ color: '#1890ff' }}>{r.gLatency.toFixed(1)}</span> },
            { title: 'Gen P50', key: 'gp50', width: 80, render: (_: any, r: any) => r.gP50.toFixed(1) },
            { title: 'Gen P95', key: 'gp95', width: 80, render: (_: any, r: any) => <span style={{ color: '#fa8c16' }}>{r.gP95.toFixed(1)}</span> },
            { title: 'Gen Min~Max', key: 'gmm', width: 110,
              render: (_: any, r: any) => <span style={{ fontSize: 10 }}>{r.gMin.toFixed(0)}~{r.gMax.toFixed(0)}</span> },
            { title: 'Stream Mean', key: 'sm', width: 80, render: (_: any, r: any) => <span style={{ color: '#52c41a' }}>{r.sLatency.toFixed(1)}</span> },
            { title: 'Stream P50', key: 'sp50', width: 80, render: (_: any, r: any) => r.sP50.toFixed(1) },
            { title: 'Stream P95', key: 'sp95', width: 80, render: (_: any, r: any) => <span style={{ color: '#fa8c16' }}>{r.sP95.toFixed(1)}</span> },
            { title: 'Stream Min~Max', key: 'smm', width: 110,
              render: (_: any, r: any) => <span style={{ fontSize: 10 }}>{r.sMin.toFixed(0)}~{r.sMax.toFixed(0)}</span> },
          ]} />
      </Card>

      {/* 预测分布对比 */}
      <Card title={<span><SafetyOutlined /> 预测分布对比 (模型倾向性分析)</span>} size="small" style={{ marginTop: 16 }}>
        <Table dataSource={compareData} pagination={false} size="small"
          columns={[
            { title: '测试集', dataIndex: 'dataset', key: 'ds', width: 120,
              render: (v: string) => <strong>{v}</strong> },
            { title: 'GT 分布', key: 'gt', width: 140,
              render: (_: any, r: any) => {
                const entries = Object.entries(r.gGt || {})
                return entries.map(([k, v]: any) => <Tag key={k} color={k === 'Unsafe' ? 'red' : 'green'} style={{ fontSize: 9 }}>{k}:{v}</Tag>)
              } },
            { title: 'Gen 预测', key: 'gp', width: 160,
              render: (_: any, r: any) => {
                const entries = Object.entries(r.gPred || {})
                return entries.map(([k, v]: any) => <Tag key={k} color={k === 'Unsafe' ? 'red' : k === 'Safe' ? 'green' : 'orange'} style={{ fontSize: 9 }}>{k}:{v}</Tag>)
              } },
            { title: 'Stream 预测', key: 'sp', width: 160,
              render: (_: any, r: any) => {
                const entries = Object.entries(r.sPred || {})
                return entries.map(([k, v]: any) => <Tag key={k} color={k === 'Unsafe' ? 'red' : 'green'} style={{ fontSize: 9 }}>{k}:{v}</Tag>)
              } },
          ]} />
      </Card>

      {/* 深度发现 */}
      <Card title={<span><BulbOutlined /> 深度发现</span>} size="small" style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12, lineHeight: 1.9, color: '#444' }}>
          <p><strong style={{ color: '#722ed1' }}>发现 1: thinking_loc 上的截断效应</strong></p>
          <p style={{ paddingLeft: 12 }}>
            初评时 Gen 在 thinking_loc 上 F1 仅 0.276 (444 条输出 null)，原因是 <code>max_length=1024</code> 截断了长思维链输入。
            修正为 <code>max_length=4096</code> + <code>max_new_tokens=128</code> 后 F1 回升到 <strong>0.807</strong>。
            Stream 也从 0.891 微升到 <strong>0.904</strong> (完整输入使 last_hidden_state 更有信息量)。
            <strong>结论</strong>: 截断是评估的伪误差，修正后平均 F1 几乎打平 (0.833 vs 0.833)。
          </p>
          <p><strong style={{ color: '#52c41a' }}>发现 2: 时延差距的本质</strong></p>
          <p style={{ paddingLeft: 12 }}>
            Stream 平均 14ms vs Gen 平均 954ms，差距 <strong>68 倍</strong>。本质是:
            <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
              <li>Gen: 自回归生成 = 前向 ×N 次 (逐 token 解码, N=64~128)</li>
              <li>Stream: 前向 ×1 次 (取 last_hidden_state 直接过分类头)</li>
            </ul>
            输入越长，Gen 的劣势越大 (thinking_loc 达到 1370ms)，但 Stream 几乎不受影响 (19ms)。
          </p>
          <p><strong style={{ color: '#fa8c16' }}>发现 3: Precision vs Recall 的权衡</strong></p>
          <p style={{ paddingLeft: 12 }}>
            两个模型在 response 类测试集上 Precision 都达到 1.0 (零误报)，但 Recall 不同。
            Gen response_loc Recall=0.910, Stream=0.879。修正后 Gen thinking_loc Recall=0.677
            (仍有 184 条漏报)。Stream 更稳定: thinking_loc Recall=0.824。
          </p>
          <p><strong style={{ color: '#1890ff' }}>发现 4: Gen 的高假阳性</strong></p>
          <p style={{ paddingLeft: 12 }}>
            Gen 在 thinking 测试集上预测 995 条 Unsafe / 64 条 Safe (GT 569 Unsafe / 490 Safe)。
            FP=438，Precision 仅 0.560。生成式模型倾向于「宁可错杀不可放过」——
            这是因为训练数据中 Unsafe 占比 (54.7%) 略高于 Safe。
          </p>
          <p><strong style={{ color: '#722ed1' }}>发现 5: 行业共识——分类头时延远优，准确率一致</strong></p>
          <div style={{ paddingLeft: 12, padding: 8, background: '#f9f0ff', borderRadius: 6 }}>
            <p style={{ margin: '0 0 4px 0' }}><strong>arXiv:2512.12677 (2025.12)</strong>: Embedding Head (分类头) vs Instruction Tuning (生成式)</p>
            <ul style={{ margin: '0 0 4px 16px', padding: 0, fontSize: 11 }}>
              <li>F1 差异不显著 (McNemar p=0.24/0.51，95% CI 跨零)</li>
              <li>分类头推理吞吐比生成式高 ~30% (4.54 vs 3.54 samples/s)</li>
              <li>分类头仅需 5.6-42M 参数，生成式需 45-167.8M</li>
            </ul>
            <p style={{ margin: '0 0 4px 0' }}><strong>Qwen3Guard 官方 (2025.10)</strong>: Stream vs Gen 平均 F1 仅差 2 个百分点 (79.2 vs 82.0)，但 Stream 获得实时检测能力</p>
            <p style={{ margin: '0 0 4px 0' }}><strong>我们实测 (2026.07)</strong>: 平均 F1 完全打平 (0.833 vs 0.833)，Stream 快 <strong>68 倍</strong></p>
            <p style={{ margin: 0, fontWeight: 600, color: '#722ed1' }}>→ 三方独立验证: 分类任务下 Softmax 分类头时延远优于 CausalLM，准确率几乎一致</p>
          </div>
        </div>
      </Card>

      {/* 架构对比总结 */}
      <Alert style={{ marginTop: 16 }} type="warning" showIcon
        message="架构对比总结与选型建议"
        description={
          <div style={{ fontSize: 12, lineHeight: 1.8 }}>
            <Row gutter={16}>
              <Col span={12}>
                <div style={{ fontWeight: 700, color: '#722ed1', marginBottom: 4 }}>Gen — 生成式输出头</div>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  <li>架构: CausalLM + LoRA → 自回归生成标签文本</li>
                  <li>输出: <code>Safety: Safe/Unsafe/Controversial</code> (需正则解析)</li>
                  <li>优势: 可输出多分类 + Categories + Refusal 三种标签, 灵活性高</li>
                  <li>劣势: 生成 64 tokens, 时延高 (725~2519ms), 长文本截断风险</li>
                  <li>适用: 离线精细分析, 需要多维度标签的场景</li>
                </ul>
              </Col>
              <Col span={12}>
                <div style={{ fontWeight: 700, color: '#52c41a', marginBottom: 4 }}>Stream — Softmax 分类头</div>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  <li>架构: Backbone LoRA → last_hidden → RMSNorm → Linear → Softmax</li>
                  <li>输出: 2 维 logits → argmax (直接取概率, 无需解析)</li>
                  <li>优势: 单次前向传播, 时延极低 (12~15ms), 输入长度无影响</li>
                  <li>劣势: 仅二分类, 无拒绝判断, 需额外 head 扩展</li>
                  <li>适用: 实时流式检测, 高并发场景, 低延迟要求</li>
                </ul>
              </Col>
            </Row>
            <div style={{ marginTop: 8, padding: 8, background: '#f9f0ff', borderRadius: 4 }}>
              <strong style={{ color: '#722ed1' }}>选型建议:</strong>
              追求 F1 → 平均打平 (0.833 vs 0.833)，Gen 在 prompt-only 场景更优;
              追求延迟 → Stream (68x 加速);
              追求长文本鲁棒性 → Stream (thinking_loc F1=0.904 vs 0.807);
              追求丰富标签 → Gen (三分类 + Categories + Refusal)
            </div>
          </div>
        } />
    </div>
  )
}

// ====== Tab 4: Eval Results ======
export default function EvalTab() {
  const [results, setResults] = useState<any>(null)
  const [crossEval, setCrossEval] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      axios.get(`${API_BASE}/eval-results`),
      axios.get(`${API_BASE}/cross-eval`),
    ]).then(([r1, r2]) => {
      setResults(r1.data); setCrossEval(r2.data); setLoading(false)
    }).catch(() => { setLoading(false) })
  }, [])

  if (loading) return <Spin />
  if (!results || (!results.gen && !results.stream)) return <Empty description="No evaluation results" />

  const genModels = results.gen ? Object.keys(results.gen) : []
  const genDatasets = genModels.length > 0 ? Object.keys(results.gen[genModels[0]]) : []

  const genCols: any[] = [
    { title: 'Model', dataIndex: 'model', key: 'model', width: 200,
      render: (v: string) => <strong>{v}</strong> },
    ...genDatasets.map(ds => ({
      title: ds, key: ds, width: 100,
      render: (_: any, r: any) => {
        const data = r[ds]
        if (!data || data.error) return <Tag>N/A</Tag>
        return <Tooltip title={`Acc: ${data.accuracy?.toFixed(3)}, P: ${data.precision?.toFixed(3)}, R: ${data.recall?.toFixed(3)}`}>
          <span style={{ fontWeight: 600, color: '#722ed1' }}>{data.f1?.toFixed(3)}</span>
        </Tooltip>
      },
    })),
  ]

  const genData = genModels.map(m => ({ key: m, model: m, ...results.gen[m] }))

  const streamModels = results.stream ? Object.keys(results.stream).filter(k => !results.stream[k].error) : []
  const streamData = streamModels.map(m => {
    const d = results.stream[m]
    return { key: m, model: m, resp: d.response_loc, think: d.thinking_loc }
  })

  const streamCols = [
    { title: 'Model', dataIndex: 'model', key: 'model', width: 250, render: (v: string) => <strong>{v}</strong> },
    { title: 'response_loc F1', key: 'rf', width: 120, render: (r: any) => r.resp ? <strong style={{ color: '#722ed1' }}>{r.resp.f1?.toFixed(3)}</strong> : '—' },
    { title: 'response_loc Acc', key: 'ra', width: 120, render: (r: any) => r.resp ? r.resp.accuracy?.toFixed(3) : '—' },
    { title: 'thinking_loc F1', key: 'tf', width: 120, render: (r: any) => r.think ? <strong style={{ color: '#722ed1' }}>{r.think.f1?.toFixed(3)}</strong> : '—' },
    { title: 'thinking_loc Acc', key: 'ta', width: 120, render: (r: any) => r.think ? r.think.accuracy?.toFixed(3) : '—' },
  ]

  return (
    <div>
      <Card title="Gen Model Comparison (F1 Score)" size="small" style={{ marginBottom: 16 }}>
        <Table dataSource={genData} columns={genCols} pagination={false} size="small" />
      </Card>

      <Card title="Stream Model Comparison (F1 Score)" size="small" style={{ marginBottom: 16 }}>
        <Table dataSource={streamData} columns={streamCols} pagination={false} size="small" />
      </Card>

      <Card title="Gen Checkpoint F1 Trend (Qwen3GuardTest)" size="small">
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 200, padding: '0 20px' }}>
          {genModels.filter(m => m.startsWith('cheryguard_v2')).map(m => {
            const data = results.gen[m]?.Qwen3GuardTest
            if (!data) return null
            const f1 = data.f1 || 0
            const isBest = f1 >= 0.712
            return (
              <div key={m} style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 10, color: isBest ? '#722ed1' : '#999', fontWeight: isBest ? 700 : 400 }}>{f1.toFixed(3)}</div>
                <div style={{
                  height: `${f1 * 200}px`, background: isBest ? '#722ed1' : '#1890ff',
                  borderRadius: '4px 4px 0 0', opacity: isBest ? 1 : 0.6, marginTop: 4,
                }} />
                <div style={{ fontSize: 9, color: '#666', marginTop: 4 }}>{m.replace('cheryguard_v2_checkpoint-', 'ckpt-')}</div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card title="Stream F1 Trend (response_loc)" size="small" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 200, padding: '0 20px' }}>
          {streamModels.filter(m => m.includes('stream_v1') || m.includes('stream_v2')).sort().map(m => {
            const d = results.stream[m]?.response_loc
            if (!d) return null
            const f1 = d.f1 || 0
            const isV2 = m.includes('_v2_')
            const isBest = f1 >= 0.929
            const color = isV2 ? '#722ed1' : '#69b1ff'
            return (
              <div key={m} style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 10, color: isBest ? '#722ed1' : '#999', fontWeight: isBest ? 700 : 400 }}>{f1.toFixed(3)}</div>
                <div style={{
                  height: `${f1 * 200}px`, background: color,
                  borderRadius: '4px 4px 0 0', opacity: isBest ? 1 : 0.7, marginTop: 4,
                }} />
                <div style={{ fontSize: 9, color: '#666', marginTop: 4 }}>
                  {m.includes('_v1_') ? 'v1-' : 'v2-'}epoch-{m.slice(-1)}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Alert style={{ marginTop: 16 }} type="info" showIcon
        message="Key Findings"
        description={
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>
            <li><strong>交叉评估</strong>: Gen vs Stream 平均 F1 打平 (0.833 vs 0.833)，但 Stream 快 68 倍 (14ms vs 954ms)</li>
            <li>Gen ckpt-300 F1=0.712 (Qwen3GuardTest)，matching official Qwen3Guard F1=0.714 (difference 0.002)</li>
            <li>Stream epoch-2 F1=0.929 (response_loc)，thinking_loc 修正后 F1=0.904</li>
            <li>三方独立验证: 分类任务下 Softmax 分类头时延远优于 CausalLM，准确率几乎一致</li>
            <li>QLoRA vs LoRA: 0.6B 模型 LoRA 更优 (避免量化噪声)；7B+ 模型 QLoRA 是 16GB 机器唯一方案</li>
          </ul>
        }
      />

      {/* ============================================================ */}
      {/* 官方论文 Benchmark: Gen vs Stream */}
      {/* ============================================================ */}
      <OfficialBenchmarkSection />

      {crossEval && crossEval.gen_v2 && crossEval.stream_v2 && Object.keys(crossEval.gen_v2).length > 0 && (
        <CrossEvalSection data={crossEval} />
      )}
    </div>
  )
}

// ====== 官方论文 Benchmark 组件 ======
function OfficialBenchmarkSection() {
  // --- 数据定义 (论文 Table 11-13, F1 scores, optimal mode) ---
  // Gen = Generative Qwen3Guard, Stream = Stream Qwen3Guard
  // 每个数字为该 benchmark 的 optimal mode (strict/loose 中较高者)

  const promptData = [
    { key: '0.6B', model: '0.6B', gen_toxic: 77.7, gen_oai: 77.6, gen_aegis: 90.8, gen_aegis2: 85.0, gen_simp: 99.0, gen_harm: 98.7, gen_wild: 87.7, gen_avg: 88.1, str_toxic: 75.5, str_oai: 76.0, str_aegis: 85.2, str_aegis2: 84.9, str_simp: 98.0, str_harm: 97.2, str_wild: 87.1, str_avg: 86.3 },
    { key: '4B', model: '4B', gen_toxic: 82.8, gen_oai: 80.7, gen_aegis: 90.8, gen_aegis2: 85.8, gen_simp: 99.5, gen_harm: 100.0, gen_wild: 85.6, gen_avg: 89.3, str_toxic: 81.7, str_oai: 81.2, str_aegis: 85.9, str_aegis2: 86.6, str_simp: 99.5, str_harm: 100.0, str_wild: 88.6, str_avg: 89.1 },
    { key: '8B', model: '8B', gen_toxic: 82.8, gen_oai: 81.3, gen_aegis: 91.4, gen_aegis2: 86.1, gen_simp: 99.5, gen_harm: 100.0, gen_wild: 88.9, gen_avg: 90.0, str_toxic: 80.1, str_oai: 80.3, str_aegis: 85.7, str_aegis2: 86.1, str_simp: 99.0, str_harm: 99.4, str_wild: 87.5, str_avg: 88.3 },
  ]

  const responseData = [
    { key: '0.6B', model: '0.6B', gen_harm: 85.0, gen_safe: 66.6, gen_beaver: 86.1, gen_xst: 91.3, gen_aegis2: 84.2, gen_wild: 77.3, gen_think: 83.6, gen_avg: 82.0, str_harm: 83.1, str_safe: 62.8, str_beaver: 84.5, str_xst: 84.8, str_aegis2: 81.4, str_wild: 76.3, str_think: 81.6, str_avg: 79.2 },
    { key: '4B', model: '4B', gen_harm: 86.7, gen_safe: 69.8, gen_beaver: 86.6, gen_xst: 92.7, gen_aegis2: 86.5, gen_wild: 79.5, gen_think: 84.0, gen_avg: 83.7, str_harm: 84.3, str_safe: 67.6, str_beaver: 86.0, str_xst: 88.9, str_aegis2: 83.3, str_wild: 77.4, str_think: 85.4, str_avg: 81.8 },
    { key: '8B', model: '8B', gen_harm: 87.2, gen_safe: 70.5, gen_beaver: 86.6, gen_xst: 93.7, gen_aegis2: 86.4, gen_wild: 78.9, gen_think: 84.0, gen_avg: 83.9, str_harm: 85.0, str_safe: 64.6, str_beaver: 85.9, str_xst: 88.9, str_aegis2: 82.6, str_wild: 77.0, str_think: 83.6, str_avg: 81.1 },
  ]

  const chineseData = [
    { key: '0.6B', model: '0.6B', gen_tc: 80.8, gen_wc: 84.9, str_tc: 80.5, str_wc: 81.9 },
    { key: '4B', model: '4B', gen_tc: 84.6, gen_wc: 87.3, str_tc: 84.1, str_wc: 84.9 },
    { key: '8B', model: '8B', gen_tc: 85.1, gen_wc: 87.1, str_tc: 84.4, str_wc: 85.0 },
  ]

  // 柱状图数据：Gen vs Stream avg F1 per model size
  const barGroups = [
    { label: '0.6B Prompt', gen: 88.1, str: 86.3 },
    { label: '0.6B Response', gen: 82.0, str: 79.2 },
    { label: '4B Prompt', gen: 89.3, str: 89.1 },
    { label: '4B Response', gen: 83.7, str: 81.8 },
    { label: '8B Prompt', gen: 90.0, str: 88.3 },
    { label: '8B Response', gen: 83.9, str: 81.1 },
  ]
  const maxBar = 100

  // 计算总平均
  const genPromptAvg = (88.1 + 89.3 + 90.0) / 3  // 89.13
  const strPromptAvg = (86.3 + 89.1 + 88.3) / 3  // 87.9
  const genRespAvg = (82.0 + 83.7 + 83.9) / 3    // 83.2
  const strRespAvg = (79.2 + 81.8 + 81.1) / 3    // 80.7

  return (
    <Card
      title={<span><TrophyOutlined /> 官方论文 Benchmark: Qwen3Guard-Gen vs Stream (arXiv:2510.14276)</span>}
      style={{ marginTop: 16, border: '2px solid #faad14' }}
      size="small"
    >
      <Alert type="warning" banner showIcon style={{ marginBottom: 12 }}
        message="数据来源: Qwen3Guard 官方论文 Table 11-13"
        description={
          <span style={{ fontSize: 11 }}>
            所有 F1 分数取自 optimal mode (strict/loose 中较高者)。Gen 使用完整上下文做分类，Stream 使用 token-level 分类头做实时检测。
            论文结论: Stream 平均仅比 Gen 低约 2 个百分点，但获得了实时检测能力。
          </span>
        }
      />

      {/* 概览统计 */}
      <Row gutter={8} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Statistic title="Prompt Avg (Gen)" value={genPromptAvg.toFixed(1)} suffix="%" valueStyle={{ color: '#722ed1' }} />
        </Col>
        <Col span={6}>
          <Statistic title="Prompt Avg (Stream)" value={strPromptAvg.toFixed(1)} suffix="%" valueStyle={{ color: '#52c41a' }} />
        </Col>
        <Col span={6}>
          <Statistic title="Response Avg (Gen)" value={genRespAvg.toFixed(1)} suffix="%" valueStyle={{ color: '#722ed1' }} />
        </Col>
        <Col span={6}>
          <Statistic title="Response Avg (Stream)" value={strRespAvg.toFixed(1)} suffix="%" valueStyle={{ color: '#52c41a' }} />
        </Col>
      </Row>

      {/* F1 柱状对比图 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: '#333', marginBottom: 8 }}>Gen vs Stream 平均 F1 对比 (%)</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', height: 180, padding: '0 8px' }}>
          {barGroups.map(g => (
            <div key={g.label} style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ display: 'flex', gap: 3, justifyContent: 'center', alignItems: 'flex-end', height: 160 }}>
                <Tooltip title={`Gen: ${g.gen}`}>
                  <div style={{
                    width: 18, height: `${(g.gen / maxBar) * 160}px`,
                    background: '#722ed1', borderRadius: '3px 3px 0 0',
                    opacity: g.gen >= g.str ? 1 : 0.5,
                  }} />
                </Tooltip>
                <Tooltip title={`Stream: ${g.str}`}>
                  <div style={{
                    width: 18, height: `${(g.str / maxBar) * 160}px`,
                    background: '#52c41a', borderRadius: '3px 3px 0 0',
                    opacity: g.str >= g.gen ? 1 : 0.5,
                  }} />
                </Tooltip>
              </div>
              <div style={{ fontSize: 8, color: '#999', marginTop: 2 }}>
                <span style={{ color: '#722ed1', fontWeight: 600 }}>{g.gen}</span>{' / '}
                <span style={{ color: '#52c41a', fontWeight: 600 }}>{g.str}</span>
              </div>
              <div style={{ fontSize: 8, color: '#666', marginTop: 1 }}>{g.label}</div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 6 }}>
          <Tag color="purple">■ Gen (生成式)</Tag>
          <Tag color="green">■ Stream (分类头)</Tag>
        </div>
      </div>

      {/* 详细数据表 */}
      <Collapse defaultActiveKey={['prompt']} size="small" style={{ marginBottom: 12 }}>
        <Panel header={<span style={{ fontWeight: 700, color: '#1890ff' }}>English Prompt Classification F1 (Table 11)</span>} key="prompt">
          <Table dataSource={promptData} pagination={false} size="small"
            columns={[
              { title: 'Model', dataIndex: 'model', key: 'm', width: 60, render: (v: string) => <Tag color="blue">{v}</Tag> },
              { title: '', key: 'arch', width: 70, render: (_: any, __: any) =>
                <div>
                  <div style={{ color: '#722ed1', fontWeight: 700, fontSize: 10 }}>Gen</div>
                  <div style={{ color: '#52c41a', fontWeight: 700, fontSize: 10 }}>Stream</div>
                </div>
              },
              ...[
                { key: 'toxic', label: 'ToxiC' }, { key: 'oai', label: 'OAIMod' },
                { key: 'aegis', label: 'Aegis' }, { key: 'aegis2', label: 'Aegis2.0' },
                { key: 'simp', label: 'SimpST' }, { key: 'harm', label: 'HarmB' },
                { key: 'wild', label: 'WildG' }, { key: 'avg', label: 'Avg.' },
              ].map(c => ({
                title: c.label, key: c.key, width: c.key === 'avg' ? 65 : 58,
                render: (_: any, r: any) => {
                  const gv = r[`gen_${c.key}`]; const sv = r[`str_${c.key}`]
                  const diff = gv - sv
                  return (
                    <div style={{ fontSize: 10, lineHeight: 1.6 }}>
                      <div style={{ color: '#722ed1', fontWeight: 600 }}>{gv.toFixed(1)}</div>
                      <div style={{ color: '#52c41a', fontWeight: 600 }}>{sv.toFixed(1)}
                        {c.key === 'avg' && <span style={{ color: diff > 0 ? '#ff4d4f' : '#52c41a', fontSize: 9, marginLeft: 4 }}>({diff > 0 ? '-' : '+'}{Math.abs(diff).toFixed(1)})</span>}
                      </div>
                    </div>
                  )
                },
              })),
            ]}
          />
        </Panel>

        <Panel header={<span style={{ fontWeight: 700, color: '#722ed1' }}>English Response Classification F1 (Table 12)</span>} key="response">
          <Table dataSource={responseData} pagination={false} size="small"
            columns={[
              { title: 'Model', dataIndex: 'model', key: 'm', width: 60, render: (v: string) => <Tag color="blue">{v}</Tag> },
              { title: '', key: 'arch', width: 70, render: () =>
                <div>
                  <div style={{ color: '#722ed1', fontWeight: 700, fontSize: 10 }}>Gen</div>
                  <div style={{ color: '#52c41a', fontWeight: 700, fontSize: 10 }}>Stream</div>
                </div>
              },
              ...[
                { key: 'harm', label: 'HarmB' }, { key: 'safe', label: 'SafeRLHF' },
                { key: 'beaver', label: 'Beaver' }, { key: 'xst', label: 'XSTest' },
                { key: 'aegis2', label: 'Aegis2.0' }, { key: 'wild', label: 'WildG' },
                { key: 'think', label: 'Think' }, { key: 'avg', label: 'Avg.' },
              ].map(c => ({
                title: c.label, key: c.key, width: c.key === 'avg' ? 65 : 58,
                render: (_: any, r: any) => {
                  const gv = r[`gen_${c.key}`]; const sv = r[`str_${c.key}`]
                  const diff = gv - sv
                  return (
                    <div style={{ fontSize: 10, lineHeight: 1.6 }}>
                      <div style={{ color: '#722ed1', fontWeight: 600 }}>{gv.toFixed(1)}</div>
                      <div style={{ color: '#52c41a', fontWeight: 600 }}>{sv.toFixed(1)}
                        {c.key === 'avg' && <span style={{ color: diff > 0 ? '#ff4d4f' : '#52c41a', fontSize: 9, marginLeft: 4 }}>({diff > 0 ? '-' : '+'}{Math.abs(diff).toFixed(1)})</span>}
                      </div>
                    </div>
                  )
                },
              })),
            ]}
          />
        </Panel>

        <Panel header={<span style={{ fontWeight: 700, color: '#fa8c16' }}>Chinese Classification F1 Avg (Table 13)</span>} key="chinese">
          <Table dataSource={chineseData} pagination={false} size="small"
            columns={[
              { title: 'Model', dataIndex: 'model', key: 'm', width: 60, render: (v: string) => <Tag color="blue">{v}</Tag> },
              { title: '', key: 'arch', width: 70, render: () =>
                <div>
                  <div style={{ color: '#722ed1', fontWeight: 700, fontSize: 10 }}>Gen</div>
                  <div style={{ color: '#52c41a', fontWeight: 700, fontSize: 10 }}>Stream</div>
                </div>
              },
              ...[
                { key: 'tc', label: 'Prompt Avg' },
                { key: 'wc', label: 'Response Avg' },
              ].map(c => ({
                title: c.label, key: c.key, width: 120,
                render: (_: any, r: any) => {
                  const gv = r[`gen_${c.key}`]; const sv = r[`str_${c.key}`]
                  const diff = gv - sv
                  return (
                    <div style={{ fontSize: 10, lineHeight: 1.6 }}>
                      <div style={{ color: '#722ed1', fontWeight: 600 }}>{gv.toFixed(1)}%</div>
                      <div style={{ color: '#52c41a', fontWeight: 600 }}>{sv.toFixed(1)}%
                        <span style={{ color: diff > 0 ? '#ff4d4f' : '#52c41a', fontSize: 9, marginLeft: 4 }}>({diff > 0 ? '-' : '+'}{Math.abs(diff).toFixed(1)})</span>
                      </div>
                    </div>
                  )
                },
              })),
            ]}
          />
        </Panel>
      </Collapse>

      {/* 论文关键发现 */}
      <div style={{ padding: 10, background: '#fffbe6', borderRadius: 6, border: '1.5px solid #faad14', fontSize: 11, lineHeight: 1.9 }}>
        <div style={{ fontWeight: 700, color: '#d48806', marginBottom: 4 }}>论文关键发现</div>
        <ul style={{ margin: 0, paddingLeft: 16 }}>
          <li><strong>性能差距仅约 2 个百分点</strong>: Stream 在所有 test set 上的平均 F1 仅比 Gen 低 ~2 分，但获得了逐 token 实时检测能力</li>
          <li><strong>0.6B 模型差距最大</strong>: Response 分类上 0.6B 的 Gen(82.0) vs Stream(79.2) 差距 2.8 分 — 小模型上下文理解能力弱，分类头更受影响</li>
          <li><strong>4B 模型最均衡</strong>: Prompt 上 Gen(89.3) vs Stream(89.1) 几乎打平，仅差 0.2 分 — 性价比最优</li>
          <li><strong>8B 模型 Stream 在 Prompt 上差距大</strong>: Gen(90.0) vs Stream(88.3) 差 1.7 分，但 Response 差距更大 Gen(83.9) vs Stream(81.1) 差 2.8 分</li>
          <li><strong>Thinking 内容检测</strong>: 4B Stream(85.4) 甚至超过 Gen(84.0) — 分类头在长文本上反而更稳定</li>
          <li><strong>Detection Latency</strong>: Response-only 场景下 ~86% 的情况在正确句子内检测到第一个 unsafe token；含思维链场景 ~66.8% 在前 128 token 内检测到</li>
          <li><strong>效率优势</strong>: Stream 处理时间随 response 长度近线性增长，Gen 则因重复处理已生成内容呈超线性增长</li>
        </ul>
      </div>
    </Card>
  )
}
