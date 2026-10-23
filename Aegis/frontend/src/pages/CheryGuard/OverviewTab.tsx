import { Card, Table, Tag, Row, Col, Statistic } from 'antd'
import { ThunderboltOutlined, RobotOutlined, ApiOutlined } from '@ant-design/icons'
import { type ModelInfo } from './shared'

// ====== 架构对比图 (CheryGuard Gen vs Stream) ======
const LAYER_COLORS: Record<string, string> = {
  q_proj: '#1890ff', k_proj: '#13c2c2', v_proj: '#52c41a', o_proj: '#fa8c16',
  gate_proj: '#722ed1', up_proj: '#eb2f96', down_proj: '#faad14',
}

function ArchCompareDiagram() {
  return (
    <Card title={<span><ApiOutlined /> 架构对比 — Gen (CausalLM) vs Stream (4-Head Classification)</span>} size="small" style={{ marginBottom: 16 }}>
      {/* 共享 Backbone（只画一次） */}
      <div style={{ border: '2px dashed #d9d9d9', borderRadius: 8, padding: 12, marginBottom: 16, background: '#fafafa' }}>
        <div style={{ textAlign: 'center', color: '#888', fontSize: 11, marginBottom: 10, fontWeight: 600 }}>
          共享 Backbone: Qwen3-0.6B (frozen + LoRA)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ padding: 8, borderRadius: 5, background: '#fffbe6', border: '1.5px solid #faad14', textAlign: 'center', fontSize: 10 }}>
            <strong>Embedding</strong>: 151,936 × 1024 = 155.6M <Tag style={{ fontSize: 7 }}>frozen</Tag>
          </div>
          <div style={{ padding: 10, borderRadius: 5, background: '#f0f5ff', border: '1.5px solid #adc6ff' }}>
            <div style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: '#2f54eb', marginBottom: 8 }}>
              Transformer Block × 28 层
            </div>
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 9, color: '#888', marginBottom: 3, fontWeight: 600 }}>Self-Attention:</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {['q_proj', 'k_proj', 'v_proj', 'o_proj'].map(m => (
                  <div key={m} style={{
                    flex: 1, padding: '3px 0', borderRadius: 3, fontSize: 9, fontWeight: 600, textAlign: 'center',
                    background: `${LAYER_COLORS[m]}15`, border: `1.5px solid ${LAYER_COLORS[m]}`, color: LAYER_COLORS[m],
                  }}>
                    {m} <span style={{ fontSize: 7 }}>LoRA</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 9, color: '#888', marginBottom: 3, fontWeight: 600 }}>MLP:</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {['gate_proj', 'up_proj', 'down_proj'].map(m => (
                  <div key={m} style={{
                    flex: 1, padding: '3px 0', borderRadius: 3, fontSize: 9, fontWeight: 600, textAlign: 'center',
                    background: `${LAYER_COLORS[m]}15`, border: `1.5px solid ${LAYER_COLORS[m]}`, color: LAYER_COLORS[m],
                  }}>
                    {m} <span style={{ fontSize: 7 }}>LoRA</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: '3px 8px', borderRadius: 3, background: '#f5f5f5', border: '1px solid #d9d9d9', textAlign: 'center', fontSize: 9, color: '#999' }}>
              RMSNorm × 2 <Tag style={{ fontSize: 7 }}>frozen</Tag>
            </div>
          </div>
          <div style={{ padding: 6, borderRadius: 4, background: '#f6ffed', border: '1px solid #b7eb8f', textAlign: 'center', fontSize: 9 }}>
            <span style={{ color: '#52c41a', fontWeight: 600 }}>LoRA: r=16, α=32</span> · 7 target modules × 28 layers · ΔW = BA (10M params, 1.67%)
          </div>
          <div style={{ padding: 8, borderRadius: 5, background: '#f0f0f0', border: '1.5px solid #d9d9d9', textAlign: 'center', fontSize: 10 }}>
            RMSNorm → last_hidden_state[:, -1, :] <span style={{ color: '#999' }}>(1024维)</span>
          </div>
        </div>
      </div>

      {/* 分叉点 */}
      <div style={{ textAlign: 'center', margin: '12px 0' }}>
        <div style={{ color: '#722ed1', fontSize: 12, fontWeight: 600 }}>↓ 架构分叉点 ↓</div>
      </div>

      {/* 左右分叉：Gen vs Stream 输出头 */}
      <Row gutter={16}>
        {/* Gen 输出头 */}
        <Col span={12}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#ff4d4f' }}>Gen (CausalLM 生成式)</span>
            <div style={{ fontSize: 9, color: '#999' }}>基座: Qwen3-0.6B-Instruct</div>
          </div>
          <div style={{ padding: 10, borderRadius: 6, background: '#fff1f0', border: '2px solid #ff4d4f', marginBottom: 8, textAlign: 'center' }}>
            <div style={{ fontWeight: 700, color: '#ff4d4f', fontSize: 12, marginBottom: 4 }}>
              lm_head (与 Embedding 共享权重)
            </div>
            <div style={{ fontSize: 10, color: '#666' }}>
              151,936 × 1024 = 155.6M <Tag style={{ fontSize: 7 }}>frozen, tied</Tag>
            </div>
          </div>
          <div style={{ padding: 10, borderRadius: 6, background: '#fff1f0', border: '2px solid #ff4d4f', marginBottom: 8, textAlign: 'center' }}>
            <div style={{ fontWeight: 700, color: '#ff4d4f', fontSize: 12, marginBottom: 4 }}>
              model.generate() 自回归推理
            </div>
            <div style={{ fontSize: 10, color: '#666' }}>
              max_new_tokens = 1~5 · 多次 forward + KV cache
            </div>
          </div>
          <div style={{ padding: 10, borderRadius: 6, background: '#fff1f0', border: '2px solid #ff4d4f', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, color: '#ff4d4f', fontSize: 12, marginBottom: 4 }}>
              文本解析 → 分类结果
            </div>
            <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>
              <code>Safety: Unsafe / Categories: ...</code>
            </div>
            <div style={{ fontSize: 9, color: '#faad14' }}>⚠️ 可能生成无效输出</div>
            <div style={{ marginTop: 6, fontSize: 9, color: '#999' }}>3分类 + 9类别 + Refusal · 延迟 ~954ms</div>
          </div>
        </Col>

        {/* Stream 输出头 */}
        <Col span={12}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#52c41a' }}>Stream (4-Head Classification)</span>
            <div style={{ fontSize: 9, color: '#999' }}>基座: Qwen3-0.6B-Base · 参考 Qwen3Guard-Stream 完整架构</div>
          </div>
          <div style={{ padding: 10, borderRadius: 6, background: '#f6ffed', border: '2px solid #52c41a', marginBottom: 8, textAlign: 'center' }}>
            <div style={{ fontWeight: 700, color: '#52c41a', fontSize: 12, marginBottom: 4 }}>
              Linear(1024→512) + RMSNorm
            </div>
            <div style={{ fontSize: 10, color: '#666' }}>
              取最后一个 token 的隐藏状态，投影到 512 维
            </div>
          </div>

          {/* 4 个 Head：2×2 布局 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
            {/* Query Risk Head */}
            <div style={{ padding: 8, borderRadius: 6, background: '#e6f7ff', border: '2px solid #1890ff' }}>
              <div style={{ fontWeight: 700, color: '#1890ff', fontSize: 10, marginBottom: 4, textAlign: 'center' }}>
                Query Risk Head
              </div>
              <div style={{ fontSize: 8, color: '#555', lineHeight: 1.7, textAlign: 'center' }}>
                Linear(512→3) → Softmax<br/>
                <Tag color="green" style={{ fontSize: 7 }}>Safe</Tag>
                <Tag color="red" style={{ fontSize: 7 }}>Unsafe</Tag>
                <Tag color="orange" style={{ fontSize: 7 }}>Controversial</Tag>
              </div>
              <div style={{ marginTop: 3, fontSize: 7, color: '#999', textAlign: 'center' }}>仅最后 token (＜|im_end|＞)</div>
            </div>

            {/* Response Risk Head */}
            <div style={{ padding: 8, borderRadius: 6, background: '#f6ffed', border: '2px solid #52c41a' }}>
              <div style={{ fontWeight: 700, color: '#52c41a', fontSize: 10, marginBottom: 4, textAlign: 'center' }}>
                Response Risk Head
              </div>
              <div style={{ fontSize: 8, color: '#555', lineHeight: 1.7, textAlign: 'center' }}>
                Linear(512→3) → Softmax<br/>
                <Tag color="green" style={{ fontSize: 7 }}>Safe</Tag>
                <Tag color="red" style={{ fontSize: 7 }}>Unsafe</Tag>
                <Tag color="orange" style={{ fontSize: 7 }}>Controversial</Tag>
              </div>
              <div style={{ marginTop: 3, fontSize: 7, color: '#999', textAlign: 'center' }}>每个 token 计算 (1/T 均值)</div>
            </div>

            {/* Query Category Head */}
            <div style={{ padding: 8, borderRadius: 6, background: '#fff7e6', border: '2px solid #fa8c16' }}>
              <div style={{ fontWeight: 700, color: '#fa8c16', fontSize: 10, marginBottom: 4, textAlign: 'center' }}>
                Query Category Head
              </div>
              <div style={{ fontSize: 8, color: '#555', lineHeight: 1.7, textAlign: 'center' }}>
                Linear(512→11) → Softmax<br/>
                <Tag color="gold" style={{ fontSize: 7 }}>Violence</Tag>
                <Tag color="gold" style={{ fontSize: 7 }}>SelfHarm</Tag>
                <Tag color="gold" style={{ fontSize: 7 }}>Sexual</Tag>
                <span style={{ fontSize: 7, color: '#999' }}>+8 more</span>
              </div>
              <div style={{ marginTop: 3, fontSize: 7, color: '#ff4d4f', textAlign: 'center' }}>🔒 仅 risk≠Safe 时计算</div>
            </div>

            {/* Response Category Head */}
            <div style={{ padding: 8, borderRadius: 6, background: '#f9f0ff', border: '2px solid #722ed1' }}>
              <div style={{ fontWeight: 700, color: '#722ed1', fontSize: 10, marginBottom: 4, textAlign: 'center' }}>
                Response Category Head
              </div>
              <div style={{ fontSize: 8, color: '#555', lineHeight: 1.7, textAlign: 'center' }}>
                Linear(512→11) → Softmax<br/>
                <Tag color="purple" style={{ fontSize: 7 }}>Violence</Tag>
                <Tag color="purple" style={{ fontSize: 7 }}>SelfHarm</Tag>
                <Tag color="purple" style={{ fontSize: 7 }}>Sexual</Tag>
                <span style={{ fontSize: 7, color: '#999' }}>+8 more</span>
              </div>
              <div style={{ marginTop: 3, fontSize: 7, color: '#ff4d4f', textAlign: 'center' }}>🔒 仅 risk≠Safe 时计算 (逐 token)</div>
            </div>
          </div>

          <div style={{ padding: 6, borderRadius: 4, background: '#f0f5ff', border: '1px solid #adc6ff', textAlign: 'center', fontSize: 8, color: '#2f54eb', marginBottom: 8 }}>
            💡 Loss = L<sub>q-risk</sub> + L<sub>q-cat</sub>(条件) + 1/T Σ L<sub>r-risk</sub>(t) + L<sub>r-cat</sub>(t, 条件)
          </div>

          <div style={{ padding: 10, borderRadius: 6, background: '#f6ffed', border: '2px solid #52c41a', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, color: '#52c41a', fontSize: 12, marginBottom: 4 }}>
              model(input_ids) 单次推理
            </div>
            <div style={{ fontSize: 10, color: '#666' }}>
              1 次 forward pass · 无 KV cache · 延迟 ~14ms (1/68)
            </div>
            <div style={{ marginTop: 4, fontSize: 9, color: '#52c41a' }}>✅ 100% 有效输出，无解析风险</div>
          </div>
        </Col>
      </Row>

      {/* 关键差异总结 */}
      <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: '#fafafa', border: '1px solid #d9d9d9' }}>
        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10, textAlign: 'center' }}>关键差异对比</div>
        <Row gutter={[12, 12]}>
          {[
            { label: '输出头', gen: 'lm_head (155.6M, tied)', stream: '4-Head 分类 (~3M, 全量训练)' },
            { label: '推理方式', gen: '自回归 generate()', stream: '单次 forward()' },
            { label: '推理延迟', gen: '~954ms', stream: '~14ms (68×)' },
            { label: '输出可靠性', gen: '需解析，可能失败', stream: '100% 有效' },
            { label: '分类粒度', gen: '3类 + 9类别 + Refusal', stream: '3类 Risk + 9类别 Category (条件计算)' },
            { label: '适用场景', gen: '离线批量审查', stream: '流式实时检测' },
          ].map(item => (
            <Col span={8} key={item.label}>
              <div style={{ padding: 8, borderRadius: 5, background: '#fff', border: '1px solid #f0f0f0', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: '#999', marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 9, color: '#ff4d4f', marginBottom: 2 }}>Gen: {item.gen}</div>
                <div style={{ fontSize: 9, color: '#52c41a' }}>Stream: {item.stream}</div>
              </div>
            </Col>
          ))}
        </Row>
      </div>
    </Card>
  )
}

export default function OverviewTab({ models }: { models: any }) {

  const genCols = [
    { title: 'Checkpoint', dataIndex: 'name', key: 'name', render: (v: string, r: any) =>
      <span>{v} {r.available ? <Tag color="green">exists</Tag> : <Tag>missing</Tag>}</span> },
    { title: 'Epoch', dataIndex: 'epoch', key: 'epoch', width: 60 },
    { title: 'F1', dataIndex: 'f1', key: 'f1', width: 70, render: (v: number) => <strong style={{ color: '#722ed1' }}>{v.toFixed(3)}</strong> },
    { title: 'Acc', dataIndex: 'acc', key: 'acc', width: 70, render: (v: number) => v.toFixed(3) },
    { title: 'P', dataIndex: 'precision', key: 'p', width: 70, render: (v: number) => v.toFixed(3) },
    { title: 'R', dataIndex: 'recall', key: 'r', width: 70, render: (v: number) => v.toFixed(3) },
  ]

  const streamCols = [
    { title: 'Model', dataIndex: 'name', key: 'name', render: (v: string, r: any) =>
      <span>{v} {r.available ? <Tag color="green">exists</Tag> : <Tag>missing</Tag>}</span> },
    { title: 'Epoch', dataIndex: 'epoch', key: 'epoch', width: 60 },
    { title: 'Resp F1', dataIndex: 'resp_f1', key: 'rf', width: 80, render: (v: number) => <strong style={{ color: '#722ed1' }}>{v.toFixed(3)}</strong> },
    { title: 'Resp Acc', dataIndex: 'resp_acc', key: 'ra', width: 80, render: (v: number) => v.toFixed(3) },
    { title: 'Think F1', dataIndex: 'think_f1', key: 'tf', width: 80, render: (v: number) => <strong>{v.toFixed(3)}</strong> },
    { title: 'Think Acc', dataIndex: 'think_acc', key: 'ta', width: 80, render: (v: number) => v.toFixed(3) },
  ]

  const refCols = [
    { title: 'Model', dataIndex: 'name', key: 'name' },
    { title: 'F1', dataIndex: 'f1', key: 'f1', width: 70, render: (v: number) => v?.toFixed(3) || '—' },
    { title: 'Acc', dataIndex: 'acc', key: 'acc', width: 70, render: (v: number) => v?.toFixed(3) || '—' },
    { title: 'Train Data', dataIndex: 'train_data', key: 'td' },
  ]

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card size="small"><Statistic title="Gen Checkpoints" value={models?.gen_models?.length || 0} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Stream Epochs" value={models?.stream_models?.length || 0} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Best Gen F1" value={0.712} precision={3} valueStyle={{ color: '#722ed1' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Best Stream F1" value={0.929} precision={3} valueStyle={{ color: '#722ed1' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="交叉评估 Avg F1" value={0.833} precision={3} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Stream 加速比" value={68} suffix="x" valueStyle={{ color: '#52c41a' }} /></Card></Col>
      </Row>

      <Card size="small" style={{ marginBottom: 16, border: '1px solid #d9d9d9' }}
        title={<span><ThunderboltOutlined /> 架构对比摘要: 生成式 vs Softmax (交叉评估 5 数据集)</span>}
        extra={<Tag color="green">F1 打平</Tag>}>
        <Row gutter={16}>
          <Col span={12}>
            <div style={{ padding: '8px 12px', background: '#f9f0ff', borderRadius: 6, borderLeft: '3px solid #722ed1' }}>
              <div style={{ fontWeight: 700, color: '#722ed1', fontSize: 12 }}>Gen — 生成式输出头</div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                F1: <strong>0.833</strong> | 延迟: <strong>954ms</strong> | 3 分类 + Categories + Refusal<br/>
                优势: 标签丰富, prompt 分类更优 | 劣势: 慢, 长文本不稳定<br/>
                <span style={{ fontSize: 9, color: '#999' }}>基座: Qwen3-0.6B-Instruct · 推理: model.generate()</span>
              </div>
            </div>
          </Col>
          <Col span={12}>
            <div style={{ padding: '8px 12px', background: '#f6ffed', borderRadius: 6, borderLeft: '3px solid #52c41a' }}>
              <div style={{ fontWeight: 700, color: '#52c41a', fontSize: 12 }}>Stream — Softmax 分类头</div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                F1: <strong>0.833</strong> | 延迟: <strong>14ms (68x )</strong> | 2 分类 Safe/Unsafe (无 category/controversial)<br/>
                优势: 极快, 长文本稳定 | 劣势: 仅二分类, 无拒绝判断<br/>
                <span style={{ fontSize: 9, color: '#999' }}>基座: Qwen3-0.6B-Base · 推理: model.forward() + dual heads</span>
              </div>
            </div>
          </Col>
        </Row>
      </Card>

      <ArchCompareDiagram />

      <Row gutter={16}>
        <Col span={24}>
          <Card title={<span><RobotOutlined /> Gen Checkpoints (LoRA CausalLM SFT)</span>} size="small" style={{ marginBottom: 16 }}>
            <Table dataSource={models?.gen_models || []} columns={genCols} rowKey="id" pagination={false} size="small"
              rowClassName={(r: ModelInfo) => r.id === 'gen_v2_ckpt_300' ? 'ant-table-row-selected' : ''}
            />
          </Card>
          <Card title={<span><ThunderboltOutlined /> Stream Epochs (Dual Classification Heads)</span>} size="small" style={{ marginBottom: 16 }}>
            <Table dataSource={models?.stream_models || []} columns={streamCols} rowKey="id" pagination={false} size="small"
              rowClassName={(r: ModelInfo) => r.id === 'stream_v2_epoch_2' ? 'ant-table-row-selected' : ''}
            />
          </Card>
          <Card title="Reference Models (Comparison)" size="small">
            <Table dataSource={models?.reference_models || []} columns={refCols} rowKey="id" pagination={false} size="small" />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
