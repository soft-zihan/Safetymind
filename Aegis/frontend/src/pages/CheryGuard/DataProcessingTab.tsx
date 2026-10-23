import { Card, Row, Col, Tag, Alert, Progress, Table } from 'antd'
import { DatabaseOutlined } from '@ant-design/icons'
import { FlowBox, FlowArrow, DPCard } from './shared'

export default function DataProcessingTab() {
  return (
    <div>
      <Alert type="info" banner showIcon style={{ marginBottom: 16 }}
        message="训练数据处理思路全景"
        description="聚焦方法论的「为什么」和「怎么做」——不是罗列工具，而是理解每种设计背后的权衡与智慧。" />

      {/* ====== 0. 数据来源全链路 ====== */}
      <DPCard title="  CheryGuard 训练数据全链路 — 从原始语料到双 Head 训练" icon="🔗">
        <div style={{ fontSize: 11, lineHeight: 1.9, color: '#444', marginBottom: 12 }}>
          <p>
            <strong style={{ color: '#722ed1' }}>数据来源：</strong>
            Aegis 2.0 + BeaverTails + HarmfulQA 等开源安全数据集。
            Gen 直接从 HF 加载并采样；Stream 复用 gen 的 Teacher 标注数据 (relabeled)，
            再由 <code>01_prepare_stream_data.py</code> 调用 API 生成句子级边界标注供双 Head 训练使用。
          </p>
        </div>

        {/* === Stage 1: Raw Sources === */}
        <div style={{ marginBottom: 12 }}>
          <Tag color="blue" style={{ fontSize: 9 }}>① 原始数据源</Tag>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {[
              { name: 'Aegis 2.0', n: '~44K', c: '#1890ff' },
              { name: 'BeaverTails', n: '2K', c: '#722ed1' },
              { name: 'HarmfulQA', n: '500', c: '#ff4d4f' },
            ].map(s => (
              <FlowBox key={s.name} label={s.name} sub={s.n} color={s.c} bg={`${s.c}10`} w={80} />
            ))}
            <FlowArrow />
            <FlowBox label="混合 & 去重" sub="质量过滤" color="#faad14" bg="#fffbe6" w={80} />
          </div>
        </div>

        {/* === 数据集介绍 === */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: '#888', marginBottom: 8, fontWeight: 600 }}>数据来源与处理策略</div>
          
          {/* 两条路径说明 */}
          <Alert type="warning" banner showIcon style={{ marginBottom: 12, fontSize: 11 }}
            message="两条独立的数据处理路径"
            description={
              <span>
                <strong>路径 A (gen/)</strong>：原始数据 → qwen3.7-plus Teacher 标注 → relabeled (2K) → Stream 句子级边界标注 → Stream 训练<br/>
                <strong>路径 B (gen_v2/)</strong>：直接从 HF 加载 Aegis2 + BeaverTails + HarmfulQA → sample_balanced() → Gen 训练 (5K)
              </span>
            } />

          <Row gutter={[12, 12]}>
            {[
              {
                name: 'Aegis 2.0',
                raw: '44,437 条',
                used: '4,000 条',
                strategy: '路径 B: sample_balanced(n=1000) 每类采样',
                note: 'Prompt safe=12K/unsafe=18K → 各取 1000; Response safe=12K/unsafe=4K → 各取 1000',
                color: '#1890ff',
              },
              {
                name: 'BeaverTails',
                raw: '2,000 条',
                used: '2,000 条',
                strategy: '路径 B: sample_balanced(n=500) 每类采样',
                note: '原始截取 1000 条 → Prompt/Response 各 500 safe + 500 unsafe',
                color: '#722ed1',
              },
              {
                name: 'HarmfulQA',
                raw: '500 条',
                used: '500 条',
                strategy: '路径 B: 全部使用 (all unsafe)',
                note: '1000 条有害问题 → 截取 500 条 prompt，全部 unsafe 标签',
                color: '#ff4d4f',
              },
            ].map(ds => (
              <Col span={8} key={ds.name}>
                <div style={{
                  padding: 10, borderRadius: 6, background: '#fafafa',
                  border: `1.5px solid ${ds.color}30`, borderLeft: `3px solid ${ds.color}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: ds.color, fontSize: 11 }}>{ds.name}</span>
                  </div>
                  <div style={{ fontSize: 9, color: '#666', marginBottom: 4 }}>
                    原始：<strong>{ds.raw}</strong> → 使用：<strong style={{ color: ds.used.includes('❌') ? '#ff4d4f' : '#52c41a' }}>{ds.used}</strong>
                  </div>
                  <div style={{ fontSize: 9, color: '#888', marginBottom: 2 }}>
                    <strong>策略：</strong>{ds.strategy}
                  </div>
                  <div style={{ fontSize: 8, color: '#bbb', lineHeight: 1.5 }}>
                    {ds.note}
                  </div>
                </div>
              </Col>
            ))}
          </Row>

          {/* 采样策略说明 */}
          <div style={{ marginTop: 12, padding: 10, borderRadius: 6, background: '#fffbe6', border: '1.5px solid #faad14' }}>
            <div style={{ fontWeight: 700, color: '#fa8c16', fontSize: 11, marginBottom: 6 }}>采样策略：sample_balanced()</div>
            <div style={{ fontSize: 10, color: '#666', lineHeight: 1.8 }}>
              <code style={{ display: 'block', marginBottom: 6, padding: 6, background: '#f5f5f5', borderRadius: 4 }}>
                def sample_balanced(items, label_key, n_per_class):<br/>
                &nbsp;&nbsp;by_label = group_by(items, label_key)<br/>
                &nbsp;&nbsp;for lbl in by_label:<br/>
                &nbsp;&nbsp;&nbsp;&nbsp;avail = min(len(by_label[lbl]), n_per_class)<br/>
                &nbsp;&nbsp;&nbsp;&nbsp;sampled.extend(random.sample(by_label[lbl], avail))
              </code>
              <strong>核心逻辑：</strong>从每个标签类中随机采样 n 条，强制类别平衡。<br/>
              <strong>问题：</strong>当前 n=1000 硬编码，导致 Aegis2 的 44K 数据只用了 4K (9%)。<br/>
              <strong>改进方向：</strong>改为 n=min(count_safe, count_unsafe)，保留全部少数类，只采样多数类 → 可从 4K 提升到 31K。
            </div>
          </div>
        </div>

        {/* === Stage 2: Gen Chat Template === */}
        <div style={{ marginBottom: 12 }}>
          <Tag color="purple" style={{ fontSize: 9 }}>② Gen 训练集 — Chat Template 格式 (text 字段)</Tag>
          <div style={{ background: '#fafafa', padding: 10, borderRadius: 6, marginTop: 6, marginBottom: 6 }}>
            <Row gutter={[12, 12]}>
              <Col span={12}>
                <div style={{ padding: 8, borderRadius: 6, background: '#e6f7ff', border: '1.5px solid #1890ff' }}>
                  <div style={{ fontWeight: 700, color: '#1890ff', fontSize: 11, marginBottom: 4 }}>
                    prompt 样本 <Tag style={{ fontSize: 8 }}>2,755 条</Tag>
                  </div>
                  <code style={{ fontSize: 9, color: '#555', display: 'block', lineHeight: 1.6 }}>
                    {'<|im_start|>user'}<br/>
                    # Task: Evaluate USER's query...<br/>
                    {'<BEGIN CONVERSATION>'}<br/>
                    <strong>USER: {'{'}prompt{'}'}</strong><br/>
                    <span style={{ color: '#ff4d4f' }}>{'// ← 没有 ASSISTANT 部分'}</span><br/>
                    {'<END CONVERSATION>'}
                  </code>
                  <div style={{ fontSize: 9, color: '#888', marginTop: 4 }}>
                    用途: 判断用户输入本身是否安全
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ padding: 8, borderRadius: 6, background: '#f6ffed', border: '1.5px solid #52c41a' }}>
                  <div style={{ fontWeight: 700, color: '#52c41a', fontSize: 11, marginBottom: 4 }}>
                    response 样本 <Tag style={{ fontSize: 8 }}>2,373 条</Tag>
                  </div>
                  <code style={{ fontSize: 9, color: '#555', display: 'block', lineHeight: 1.6 }}>
                    {'<|im_start|>user'}<br/>
                    # Task: Evaluate ASSISTANT's response...<br/>
                    {'<BEGIN CONVERSATION>'}<br/>
                    USER: {'{'}prompt{'}'}<br/>
                    <strong>ASSISTANT: {'{'}response{'}'}</strong><br/>
                    {'<END CONVERSATION>'}
                  </code>
                  <div style={{ fontSize: 9, color: '#888', marginTop: 4 }}>
                    用途: 判断 AI 回复内容是否安全
                  </div>
                </div>
              </Col>
            </Row>
          </div>
        </div>

        {/* === Stage 3: Extract & Filter === */}
        <div style={{ marginBottom: 12 }}>
          <Tag color="orange" style={{ fontSize: 9 }}>③ 01_prepare_data.py — 正则提取 & 过滤</Tag>
          <div style={{ background: '#fff7e6', padding: 8, borderRadius: 6, marginTop: 6, marginBottom: 6, border: '1px solid #faad14' }}>
            <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
              <strong>提取逻辑：</strong>
              <code style={{ fontSize: 9 }}>regex: USER: (.+?) → prompt | ASSISTANT: (.+?) → response</code><br/>
              <strong>过滤规则：</strong>
              ① prompt 为空 → 跳过 &nbsp;
              ② safety_label 为 Controversial → 跳过 (只保留 Safe/Unsafe) &nbsp;
              ③ response 为空或分句失败 → 跳过
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <Tag color="purple" style={{ fontSize: 9 }}>Gen: 5,128</Tag>
              <FlowArrow text="→" />
              <Tag color="green" style={{ fontSize: 9 }}>Stream: 5,076</Tag>
              <span style={{ fontSize: 9, color: '#ff4d4f' }}>丢弃 52 条 (空 response / Controversial / 分句失败)</span>
            </div>
          </div>
        </div>

        {/* === Stage 4: Stream structured data === */}
        <div style={{ marginBottom: 12 }}>
          <Tag color="green" style={{ fontSize: 9 }}> Stream 训练集 — 句子级边界标注 (stream_train.jsonl)</Tag>
          <Alert type="info" banner showIcon style={{ marginTop: 6, marginBottom: 6, fontSize: 10 }}
            message="句子级标注来源"
            description="原始数据集只有整条 prompt/response 的 Safe/Unsafe 标签，没有逐句标注。Stream 的句子级边界由 01_prepare_stream_data.py 调用 qwen3.7-plus API 生成：对 Unsafe response 用 NLTK 分句后，逐句判断前缀安全性，找到第一个 unsafe 句子作为边界。" />
          <div style={{ background: '#fafafa', padding: 10, borderRadius: 6, marginTop: 6 }}>
            <Row gutter={[12, 12]}>
              <Col span={12}>
                <div style={{ padding: 8, borderRadius: 6, background: '#e6f7ff', border: '1.5px solid #1890ff' }}>
                  <div style={{ fontWeight: 700, color: '#1890ff', fontSize: 11, marginBottom: 4 }}>
                    prompt 样本 <Tag style={{ fontSize: 8 }}>2,755 条</Tag>
                  </div>
                  <div style={{ fontSize: 9, color: '#555', lineHeight: 1.6 }}>
                    <code>task_type: "prompt"</code><br/>
                    <code>prompt: "How to make a bomb?"</code><br/>
                    <code style={{ color: '#ff4d4f' }}>response: ""  ← 空，设计如此</code><br/>
                    <code>safety_label: "Unsafe"</code>
                  </div>
                  <div style={{ marginTop: 6, padding: 4, borderRadius: 4, background: '#e6f7ff', fontSize: 9, color: '#1890ff', fontWeight: 600, textAlign: 'center' }}>
                    → 训练 query_risk_head
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ padding: 8, borderRadius: 6, background: '#f6ffed', border: '1.5px solid #52c41a' }}>
                  <div style={{ fontWeight: 700, color: '#52c41a', fontSize: 11, marginBottom: 4 }}>
                    response 样本 <Tag style={{ fontSize: 8 }}>2,321 条</Tag>
                  </div>
                  <div style={{ fontSize: 9, color: '#555', lineHeight: 1.6 }}>
                    <code>task_type: "response"</code><br/>
                    <code>prompt: "How to make a bomb?"</code><br/>
                    <code style={{ color: '#52c41a' }}>response: "A pipe bomb can be made..."</code><br/>
                    <code>sentences: ["A pipe bomb...", ...]</code><br/>
                    <code style={{ color: '#fa8c16' }}>boundary_idx: 2  ← API 逐句判断得到</code>
                  </div>
                  <div style={{ marginTop: 6, padding: 4, borderRadius: 4, background: '#f6ffed', fontSize: 9, color: '#52c41a', fontWeight: 600, textAlign: 'center' }}>
                    → 训练 response_risk_head
                  </div>
                </div>
              </Col>
            </Row>
          </div>
        </div>

        {/* === Stage 5: Training routing === */}
        <div style={{ marginBottom: 12 }}>
          <Tag color="red" style={{ fontSize: 9 }}>⑤ 02_train.py — Loss Masking 路由</Tag>
          <div style={{ background: '#fafafa', padding: 10, borderRadius: 6, marginTop: 6 }}>
            <Table
              size="small"
              pagination={false}
              dataSource={[
                { key: '1', type: 'prompt', input: 'USER: {prompt}', head: 'query_risk_head', loss: 'CE(query_label)', resp_label: 'None (跳过)', query_label: 'risk_label' },
                { key: '2', type: 'response', input: 'USER: {prompt}\\nASSISTANT: {resp}', head: 'response_risk_head', loss: 'CE(resp_label)', resp_label: 'risk_label', query_label: 'None (跳过)' },
              ]}
              columns={[
                { title: '样本类型', dataIndex: 'type', key: 'type', width: 90, render: (v: string) => <Tag color={v === 'prompt' ? 'blue' : 'green'}>{v}</Tag> },
                { title: '输入拼接', dataIndex: 'input', key: 'input', width: 200, render: (v: string) => <code style={{ fontSize: 9 }}>{v}</code> },
                { title: '训练 Head', dataIndex: 'head', key: 'head', width: 140, render: (v: string) => <span style={{ fontWeight: 700, color: '#722ed1', fontSize: 10 }}>{v}</span> },
                { title: 'Loss 函数', dataIndex: 'loss', key: 'loss', width: 120, render: (v: string) => <code style={{ fontSize: 9 }}>{v}</code> },
                { title: 'resp_label', dataIndex: 'resp_label', key: 'rl', width: 100, render: (v: string) => <span style={{ fontSize: 9, color: v === 'None (跳过)' ? '#ff4d4f' : '#52c41a' }}>{v}</span> },
                { title: 'query_label', dataIndex: 'query_label', key: 'ql', width: 100, render: (v: string) => <span style={{ fontSize: 9, color: v === 'None (跳过)' ? '#ff4d4f' : '#52c41a' }}>{v}</span> },
              ]}
            />
            <div style={{ marginTop: 8, fontSize: 10, color: '#888', lineHeight: 1.7 }}>
              <strong style={{ color: '#722ed1' }}>关键设计：</strong>
              通过 Loss Masking（将不需要训练的 head 的 label 设为 None），每个样本只训练对应的 head。
              prompt 样本的 <code>resp_label=None</code> → response head 不产生 loss；
              response 样本的 <code>query_label=None</code> → query head 不产生 loss。
              这就是为什么 prompt 样本的 response 字段为空 — 它根本不会被拼接进输入文本。
            </div>
          </div>
        </div>

        {/* === Label distribution summary === */}
        <div style={{ background: '#f9f0ff', padding: 10, borderRadius: 6, border: '1px solid #722ed1' }}>
          <div style={{ fontWeight: 700, color: '#722ed1', fontSize: 11, marginBottom: 8 }}>
            <DatabaseOutlined /> 标签分布全景
          </div>
          <Row gutter={[12, 8]}>
            <Col span={8}>
              <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>Gen 训练集 (5,128)</div>
              <Progress percent={45.4} size="small" status="success" format={() => 'Safe 2,329'} />
              <Progress percent={54.6} size="small" status="exception" format={() => 'Unsafe 2,799'} />
            </Col>
            <Col span={8}>
              <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>Stream Prompt (2,755)</div>
              <Progress percent={44.8} size="small" status="success" format={() => 'Safe 1,235'} />
              <Progress percent={55.2} size="small" status="exception" format={() => 'Unsafe 1,520'} />
            </Col>
            <Col span={8}>
              <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>Stream Response (2,321)</div>
              <Progress percent={44.8} size="small" status="success" format={() => 'Safe 1,041'} />
              <Progress percent={55.2} size="small" status="exception" format={() => 'Unsafe 1,280'} />
            </Col>
          </Row>
          <div style={{ fontSize: 9, color: '#888', marginTop: 6 }}>
            ≈ 1:1 Safe:Unsafe，Unsafe 略多 → 模型偏保守，符合安全分类器需求
          </div>
        </div>
      </DPCard>

      {/* ====== 1. Qwen3Guard 方法论参考 ====== */}
      <DPCard title="  Qwen3Guard 方法论参考 — CheryGuard 的设计起点" icon="📚">
        <Alert type="warning" banner showIcon style={{ marginBottom: 10 }}
          message="以下内容来自 Qwen3Guard 论文 (arXiv:2510.14276)，是 CheryGuard 的设计参考。CheryGuard 只复现了部分方法，未复现的部分已标注。"
          description="CheryGuard 基于 Qwen3-0.6B 基座，聚焦安全分类核心能力。Gen 参考了 Qwen3Guard 的指令跟随 + 多标签输出架构；Stream 参考了双 Head 判别式架构，但砍掉了 category head 和 Controversial 类别，简化为纯二分类 Safe/Unsafe。" />

        <div style={{ fontSize: 11, lineHeight: 1.9, color: '#444' }}>
          <p>
            <strong style={{ color: '#722ed1' }}>Qwen3Guard 的核心贡献：</strong>
            安全分类天然是模糊的。「如何制造炸弹」显然是 unsafe，「如何做蛋糕」显然是 safe。
            但「如何制造烟花」呢？不同场景下答案不同——这就是 Controversial 的来源。
            Qwen3Guard 提出用 Strict/Loose 双模型投票来自动发现 Controversial 样本，无需人工标注。
          </p>

          <div style={{ background: '#fafafa', padding: 12, borderRadius: 8, marginBottom: 10 }}>
            <div style={{ fontWeight: 700, color: '#722ed1', fontSize: 12, marginBottom: 8 }}>Qwen3Guard 的五阶段流水线（CheryGuard 参考了哪些？）</div>

            {/* Stage 1 */}
            <div style={{ marginBottom: 12 }}>
              <Tag color="blue" style={{ fontSize: 9 }}>第一阶段：从策略到种子</Tag>
              <Tag color="green" style={{ fontSize: 8, marginLeft: 4 }}>✅ CheryGuard 已复现</Tag>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                <FlowBox label="安全策略" sub="9类×3级" color="#1890ff" bg="#e6f7ff" w={75} />
                <FlowArrow />
                <FlowBox label="Seed Prompt" sub="每类人工写几条" color="#722ed1" bg="#f9f0ff" w={85} />
                <FlowArrow />
                <div style={{ padding: 4, borderRadius: 4, background: '#f6ffed', border: '1.5px solid #52c41a', fontSize: 9, textAlign: 'center' }}>
                  <span style={{ color: '#52c41a', fontWeight: 600 }}>正负配对</span>
                  <div style={{ color: '#888', fontSize: 8 }}>"bomb" vs "cake"</div>
                </div>
                <FlowArrow />
                <FlowBox label="~5K prompts" color="#52c41a" bg="#f6ffed" />
              </div>
              <div style={{ fontSize: 9, color: '#888', marginTop: 4, paddingLeft: 8 }}>
                CheryGuard 实际做法：从 Aegis2.0 + BeaverTails + HarmfulQA 等开源数据集混合，
                未使用 Self-Instruct 扩展（数据量足够）。
              </div>
            </div>

            {/* Stage 2 */}
            <div style={{ marginBottom: 12 }}>
              <Tag color="orange" style={{ fontSize: 9 }}>第二阶段：Response 的三源混合</Tag>
              <Tag color="green" style={{ fontSize: 8, marginLeft: 4 }}>✅ CheryGuard 已复现</Tag>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                <FlowBox label="人工撰写" color="#fa8c16" bg="#fff7e6" />
                <span style={{ color: '#999' }}>+</span>
                <FlowBox label="Instruct 模型" sub="安全回复" color="#1890ff" bg="#e6f7ff" />
                <span style={{ color: '#999' }}>+</span>
                <FlowBox label="Base 模型" sub="故意生成 unsafe" color="#ff4d4f" bg="#fff2f0" w={85} />
              </div>
              <div style={{ fontSize: 9, color: '#888', marginTop: 4, paddingLeft: 8 }}>
                CheryGuard 实际做法：从 BeaverTails 等数据集获取 response 样本，
                未使用 Base 模型故意生成 unsafe（数据量足够）。
              </div>
            </div>

            {/* Stage 3 */}
            <div style={{ marginBottom: 12 }}>
              <Tag color="purple" style={{ fontSize: 9 }}>第三阶段：Teacher 模型标注</Tag>
              <Tag color="orange" style={{ fontSize: 8, marginLeft: 4 }}>⚠️ 实际效果有限</Tag>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                <FlowBox label="qwen3.7-plus" sub="DashScope API" color="#722ed1" bg="#f9f0ff" w={95} />
                <FlowArrow />
                <div style={{ padding: 4, borderRadius: 4, background: '#fffbe6', border: '1.5px solid #faad14', fontSize: 9, textAlign: 'center' }}>
                  <span style={{ color: '#faad14', fontWeight: 600 }}>Constitution Prompt</span>
                  <div style={{ color: '#888', fontSize: 8 }}>统一标注所有数据</div>
                </div>
              </div>
              <div style={{ fontSize: 9, color: '#888', marginTop: 4, paddingLeft: 8, padding: 8, background: '#fffbe6', borderRadius: 4, borderLeft: '3px solid #faad14' }}>
                <strong style={{ color: '#fa8c16' }}>实际发现：</strong>
                标签翻转率仅 5.2%（103/1989），标注失败率 0.6%。
                说明原始数据集（Aegis2.0 + BeaverTails + HarmfulQA）的标注质量已经很好，
                Teacher 模型（qwen3.7-plus）的效益不高——只修正了极少数标签。
                成本约 ¥16（8K 条 × ¥0.004/1K tokens）。
              </div>
            </div>

            {/* Stage 4: Controversial */}
            <div style={{ marginBottom: 12 }}>
              <Tag color="red" style={{ fontSize: 9 }}>第四阶段：Controversial — Strict/Loose 双模型投票</Tag>
              <Tag color="red" style={{ fontSize: 8, marginLeft: 4 }}>❌ CheryGuard 未复现</Tag>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <div style={{ flex: 1, padding: 10, borderRadius: 6, background: '#fff2f0', border: '2px solid #ff4d4f', textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, color: '#ff4d4f', fontSize: 11, marginBottom: 4 }}>Strict 模型</div>
                  <div style={{ fontSize: 9, color: '#888', marginBottom: 4 }}>训练时 Safe:Unsafe = 3:7</div>
                  <div style={{ fontSize: 9, color: '#ff4d4f', fontWeight: 600 }}>→ 倾向于判 Unsafe</div>
                </div>
                <div style={{ fontSize: 18, color: '#bbb', fontWeight: 700 }}>VS</div>
                <div style={{ flex: 1, padding: 10, borderRadius: 6, background: '#f6ffed', border: '2px solid #52c41a', textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, color: '#52c41a', fontSize: 11, marginBottom: 4 }}>Loose 模型</div>
                  <div style={{ fontSize: 9, color: '#888', marginBottom: 4 }}>训练时 Safe:Unsafe = 7:3</div>
                  <div style={{ fontSize: 9, color: '#52c41a', fontWeight: 600 }}>→ 倾向于判 Safe</div>
                </div>
              </div>
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <div style={{ padding: 8, borderRadius: 6, background: '#fff7e6', border: '2px dashed #fa8c16', display: 'inline-block' }}>
                  <span style={{ fontSize: 10, color: '#fa8c16', fontWeight: 700 }}>
                    两者预测冲突 = Controversial
                  </span>
                </div>
              </div>
              <div style={{ fontSize: 9, color: '#888', marginTop: 6, paddingLeft: 8, padding: 8, background: '#fff2f0', borderRadius: 4, borderLeft: '3px solid #ff4d4f' }}>
                <strong style={{ color: '#ff4d4f' }}>为什么 CheryGuard 没复现：</strong>
                ① 数据量有限（5K vs Qwen3Guard 的 1.19M），不足以支撑双模型训练 + 交叉标注；
                ② Stream 已简化为二分类，Controversial 无对应 head；
                ③ 工程复杂度：需要训练 2 个模型 + 交叉标注 + 合并标签，ROI 不高。
              </div>
            </div>

            {/* Stage 5 */}
            <div>
              <Tag color="green" style={{ fontSize: 9 }}>第五阶段：标签蒸馏</Tag>
              <Tag color="red" style={{ fontSize: 8, marginLeft: 4 }}>❌ CheryGuard 未复现</Tag>
              <div style={{ fontSize: 9, color: '#888', marginTop: 4, paddingLeft: 8, padding: 8, background: '#fff2f0', borderRadius: 4, borderLeft: '3px solid #ff4d4f' }}>
                <strong style={{ color: '#ff4d4f' }}>为什么未复现：</strong>
                ① Teacher 模型（qwen3.7-plus）的标签翻转率仅 5.2%，说明原始标注质量已经很好，交叉训练迭代的收益有限；
                ② 数据量有限（2K relabeled），不足以支撑 A 标 B → B 标 A 的交叉训练；
                ③ 工程复杂度：需要训练 2 个模型 + 交叉标注 + 合并标签，ROI 不高。
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 8, padding: 10, background: '#f9f0ff', borderRadius: 6, border: '1.5px solid #722ed1' }}>
          <div style={{ fontWeight: 700, color: '#722ed1', fontSize: 11, marginBottom: 6 }}>CheryGuard vs Qwen3Guard 关键差异</div>
          <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
            <strong>模型规模：</strong>Qwen3Guard 有 0.6B/4B/8B 三个尺寸，CheryGuard 只有 0.6B<br/>
            <strong>数据规模：</strong>Qwen3Guard 1.19M 样本，CheryGuard 5,128 样本（Gen）/ 5,076 样本（Stream）<br/>
            <strong>分类粒度：</strong>Qwen3Guard 3 分类 (Safe/Controversial/Unsafe) + 9 类别 + Refusal，CheryGuard Gen 保留 3 分类 + 类别 + Refusal，Stream 简化为 2 分类 (Safe/Unsafe)<br/>
            <strong>多语言：</strong>Qwen3Guard 支持 119 种语言，CheryGuard 仅支持中英文<br/>
            <strong>标注方法：</strong>Qwen3Guard 用多模型投票 + Strict/Loose 双模型，CheryGuard 用 qwen3.7-plus Teacher 标注（翻转率仅 5.2%，原始标注质量已很好）
          </div>
        </div>
      </DPCard>

      {/* ====== 2. 合成数据的四种思路 ====== */}
      <DPCard title="  合成数据 — 四种产生训练数据的思路" icon="🧪">
        <div style={{ fontSize: 11, lineHeight: 1.9, color: '#444' }}>
          <p>
            当标注数据不够时，用大模型自己生成训练数据。但「怎么生成」决定了「生成什么质量的」。
            以下是四种不同的思路，每种适合不同的场景。
          </p>
        </div>
        <Row gutter={[12, 12]}>
          {[
            { name: 'Self-Instruct 式', tag: '种子驱动', icon: '🌱', color: '#52c41a', bg: '#f6ffed',
              desc: '给定一批种子指令，让 LLM 模仿着生成更多同类指令。问题：种子的分布决定了生成数据的分布——种子偏了，生成的就偏了。',
              use: '场景：有少量高质量种子，想批量扩展', ex: 'Qwen3Guard 的 prompt 合成' },
            { name: 'Magpie 式', tag: '零种子', icon: '🪄', color: '#722ed1', bg: '#f9f0ff',
              desc: '不给任何种子，直接利用已对齐 LLM 的系统提示模板。当输入为空时，LLM 会自动生成有意义的指令。本质是「利用对齐模型已经学会的指令分布」。',
              use: '场景：什么都没标注，想从零开始', ex: '通用对齐数据合成' },
            { name: 'Evol-Instruct 式', tag: '指令进化', icon: '🧬', color: '#1890ff', bg: '#e6f7ff',
              desc: '不是生成新指令，而是在已有指令上「进化」——加约束、加推理步骤、切换领域。从简单指令逐步变复杂，让模型学会处理困难场景。',
              use: '场景：已有数据但太简单，需要复杂化', ex: '安全指令复杂度提升' },
            { name: 'GraphGen 式', tag: '盲点驱动', icon: '🎯', color: '#fa8c16', bg: '#fff7e6',
              desc: '先让模型对领域文本做预测，计算 ECE(预期校准误差) 找到模型「不懂」的地方——知识盲点。然后优先在盲点处生成 QA 对。不是随机生成，而是精准补短。',
              use: '场景：垂直领域，模型有明确的知识缺口', ex: '医疗/农业/海事领域 QA' },
          ].map(item => (
            <Col span={12} key={item.name}>
              <Card size="small" style={{ height: '100%', borderLeft: `3px solid ${item.color}` }}
                title={<span style={{ fontSize: 11 }}>{item.icon} {item.name} <Tag style={{ fontSize: 9, marginLeft: 4 }}>{item.tag}</Tag></span>}>
                <div style={{ fontSize: 10, lineHeight: 1.7, color: '#555', marginBottom: 8, minHeight: 70 }}>{item.desc}</div>
                <div style={{ padding: 4, borderRadius: 4, background: item.bg, fontSize: 9, color: item.color, fontWeight: 600 }}>
                  {item.use}
                </div>
                <div style={{ fontSize: 9, color: '#bbb', marginTop: 4 }}>例：{item.ex}</div>
              </Card>
            </Col>
          ))}
        </Row>
      </DPCard>

      {/* ====== 3. 数据清洗的思路 ====== */}
      <DPCard title="  数据清洗 — 从粗到精的分层过滤思路" icon="🧹">
        <div style={{ fontSize: 11, lineHeight: 1.9, color: '#444' }}>
          <p>
            数据清洗不是一股脑把所有过滤规则都跑一遍，而是要分层——从快到慢、从粗到精。
            每一层过滤掉一批数据，剩下的数据量更少但质量更高，下一层才值得用更精细的方法。
          </p>
        </div>
        <Row gutter={[12, 12]}>
          {[
            { layer: 'L1 格式层', time: 'ms级', desc: 'HTML 解析、编码检测、长度过滤、语言识别。这些规则极快，直接过滤掉 30-50% 的明显垃圾。', color: '#1890ff', bg: '#e6f7ff' },
            { layer: 'L2 去重层', time: '秒级', desc: '精确去重(MD5) → 近似去重(MinHash LSH)。Llama 3 还加了语义去重(RoBERTa 聚类+贪婪选择)。重复数据不仅浪费算力，还会让模型过拟合。', color: '#52c41a', bg: '#f6ffed' },
            { layer: 'L3 质量层', time: '分钟级', desc: 'Perplexity 过滤(噪声检测) → IFD 评分(学习价值) → LLM-as-Judge(精细打分)。这层最贵，但数据量已被前两层大幅削减，值得投入。', color: '#fa8c16', bg: '#fff7e6' },
            { layer: 'L4 安全层', time: '分钟级', desc: 'PII 正则屏蔽 → 有害内容 fastText 分类器 → 去污染(N-gram 匹配测试集)。最后一道防线，确保数据合规。', color: '#ff4d4f', bg: '#fff2f0' },
          ].map(item => (
            <Col span={12} key={item.layer}>
              <Card size="small" style={{ borderLeft: `3px solid ${item.color}` }}
                title={<span style={{ fontSize: 11 }}>{item.layer} <Tag style={{ fontSize: 9 }}>{item.time}</Tag></span>}>
                <div style={{ fontSize: 10, lineHeight: 1.7, color: '#555', minHeight: 70 }}>{item.desc}</div>
              </Card>
            </Col>
          ))}
        </Row>
        <div style={{ fontSize: 10, color: '#888', marginTop: 8, padding: '8px 12px', background: '#fafafa', borderRadius: 6 }}>
          <strong>Llama 3 的数据清洗还有一个关键设计：</strong>不是简单过滤，而是先做主题分类(粗粒度+细粒度桶)，
          然后每个桶内按质量×难度分数排序，再贪婪选择。这样保证每个主题都有最高质量的样本，而不是某个主题被大量噪声淹没。
        </div>
      </DPCard>

      {/* ====== 4. 数据多样性 ====== */}
      <DPCard title="  数据多样性 — 为什么这是最难的问题？" icon="🌈">
        <div style={{ fontSize: 11, lineHeight: 1.9, color: '#444' }}>
          <p>
            合成数据最大的陷阱不是质量差，而是<strong style={{ color: '#ff4d4f' }}>同质化</strong>。
            模型生成的数据天然倾向于「安全」的回答——模板化、中庸、千篇一律。
            用这样的数据训练模型，模型会越来越保守、越来越无趣。
          </p>
          <p>
            <strong>多样性的三个维度：</strong>主题多样性（覆盖多少领域）、风格多样性（表达方式不同）、难度多样性（简单到复杂）。
            三个维度缺一不可，但最难的是<strong>在保证质量同时不牺牲多样性</strong>——这是一个 trade-off。
          </p>
        </div>

        <Row gutter={[12, 12]}>
          {[
            { name: 'D3 三维度精选', icon: '🎯', color: '#722ed1', bg: '#f9f0ff',
              detail: 'D3 把数据价值拆成三个维度：Diversity(样本间差异性)、Difficulty(模型预测的不确定性)、Dependability(LLM 评分的可靠性)。不是简单打分，而是加权核心集优化——在三个维度之间找最优平衡。', result: '仅需10%数据达到全量效果' },
            { name: 'Diversity as Reward', icon: '🏆', color: '#fa8c16', bg: '#fff7e6',
              detail: '让模型自己判断哪些数据对自己有多样性价值。模型同时扮演两个角色：输出模型去「探针」候选数据，用 diversity reward 选择；输入模型被选中的数据微调。闭环自适应。', result: 'NeurIPS 2025 最佳思路' },
            { name: 'K-Means 语义覆盖', icon: '📊', color: '#52c41a', bg: '#f6ffed',
              detail: '最朴素但最实用的方法。把所有数据的 embedding 做 K-Means 聚类，然后从每个簇中均匀采样。Llama 3 更进一步：在每个簇内按质量×难度排序，贪婪选择。', result: 'Llama 3 实际使用' },
            { name: 'GraphGen 盲点补全', icon: '🎓', color: '#1890ff', bg: '#e6f7ff',
              detail: '换个角度解决多样性：不是从数据中选，而是先找到模型的知识盲点(ECE)，再针对盲点生成数据。不是「有什么数据」驱动，而是「缺什么数据」驱动。', result: '垂直领域 comprehension loss 降低' },
          ].map(item => (
            <Col span={12} key={item.name}>
              <Card size="small" style={{ height: '100%', borderLeft: `3px solid ${item.color}` }}
                title={<span style={{ fontSize: 11 }}>{item.icon} {item.name}</span>}>
                <div style={{ fontSize: 10, lineHeight: 1.7, color: '#555', minHeight: 85 }}>{item.detail}</div>
                <div style={{ padding: 4, borderRadius: 4, background: item.bg, border: `1px solid ${item.color}`, fontSize: 9, color: item.color, fontWeight: 600, textAlign: 'center', marginTop: 6 }}>
                  {item.result}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </DPCard>

      {/* ====== 5. 安全/不安全数据配比 ====== */}
      <DPCard title="⚖️ 安全/不安全数据配比 — 1:1 是共识还是误解？" icon="⚖️">
        <Row gutter={[16, 16]}>
          <Col span={14}>
            <div style={{ fontSize: 11, lineHeight: 1.9, color: '#444' }}>
              <p style={{ marginBottom: 8 }}>
                <strong style={{ color: '#ff4d4f', fontSize: 12 }}>核心问题：</strong>
                实际应用中 99%+ 的输入是安全数据。那训练时安全/不安全数据到底该 1:1 还是模拟真实分布？
              </p>
              <div style={{ background: '#fffbe6', padding: 10, borderRadius: 6, marginBottom: 8, border: '1.5px solid #faad14' }}>
                <div style={{ fontWeight: 700, color: '#d48806', fontSize: 11, marginBottom: 6 }}>
                  安全分类器数据配比共识（Qwen3Guard / WildGuard / CheryGuard 均采用）
                </div>
                <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
                  <em>"Our preliminary experiments reveal that the <strong>label distribution in the training data significantly influences the model's tolerance</strong> toward potentially harmful content. For instance, compared to a balanced training set with a <strong>1:1 ratio</strong> of Safe to Unsafe samples, <strong>doubling the proportion of Safe examples leads the model to become more permissive</strong>, causing it to reclassify certain borderline test samples from Unsafe to Safe."</em>
                </div>
              </div>
            </div>
          </Col>
          <Col span={10}>
            <Card size="small" style={{ background: '#fafafa' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#722ed1', marginBottom: 8 }}>CheryGuard 实际分布</div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, color: '#888', marginBottom: 2 }}>Gen 训练集（5,128 条）</div>
                <Progress percent={45.4} size="small" status="success" format={() => 'Safe 45.4%'} />
                <Progress percent={54.6} size="small" status="exception" format={() => 'Unsafe 54.6%'} />
              </div>
              <div>
                <div style={{ fontSize: 9, color: '#888', marginBottom: 2 }}>Stream 训练集（5,076 条）</div>
                <Progress percent={44.8} size="small" status="success" format={() => 'Safe 44.8%'} />
                <Progress percent={55.2} size="small" status="exception" format={() => 'Unsafe 55.2%'} />
              </div>
              <div style={{ fontSize: 9, color: '#888', marginTop: 8, padding: 6, background: '#f9f0ff', borderRadius: 4 }}>
                ≈ 1:1，Unsafe 略多 → 模型偏保守，符合安全分类器需求
              </div>
            </Card>
          </Col>
        </Row>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 700, color: '#333', fontSize: 11, marginBottom: 8 }}>数据配比如何影响模型行为？</div>
          <Row gutter={[12, 12]}>
            {[
              { ratio: 'Safe:Unsafe = 1:3', label: '极度保守', desc: '模型倾向于判 Unsafe。宁可错杀也不放过。适合高安全要求场景（金融、医疗）', color: '#ff4d4f', bg: '#fff2f0', tag: 'Strict 配置' },
              { ratio: 'Safe:Unsafe = 1:1', label: '平衡', desc: '业界默认基线。Qwen3Guard、WildGuard、Aegis 等主流模型均采用此配比。适合通用场景', color: '#722ed1', bg: '#f9f0ff', tag: 'CheryGuard 当前' },
              { ratio: 'Safe:Unsafe = 3:1', label: '宽松', desc: '模型倾向于判 Safe。只有在明显不安全时才告警。适合内容创作平台', color: '#52c41a', bg: '#f6ffed', tag: 'Loose 配置' },
              { ratio: 'Safe:Unsafe = 99:1', label: '真实分布', desc: '模拟线上真实流量。但 F1 会暴跌——模型学会「偷懒」：遇到任何输入都猜 Safe，正确率 99% 但召回率为 0', color: '#fa8c16', bg: '#fff7e6', tag: '❌ 不推荐' },
            ].map(item => (
              <Col span={12} key={item.ratio}>
                <Card size="small" style={{ borderLeft: `3px solid ${item.color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700 }}>{item.ratio}</span>
                    <Tag color={item.color === '#ff4d4f' ? 'red' : item.color === '#722ed1' ? 'purple' : item.color === '#52c41a' ? 'green' : 'orange'} style={{ fontSize: 9 }}>{item.tag}</Tag>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: item.color, marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 9, color: '#555', lineHeight: 1.6 }}>{item.desc}</div>
                </Card>
              </Col>
            ))}
          </Row>
        </div>

        <div style={{ marginTop: 12, padding: 10, background: '#f0f5ff', borderRadius: 6, border: '1.5px solid #1890ff' }}>
          <div style={{ fontWeight: 700, color: '#1890ff', fontSize: 11, marginBottom: 6 }}>结论：1:1 是安全分类器的工程共识</div>
          <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
            <strong>不是</strong>因为真实世界是 1:1，而是因为<strong>模型的行为由训练分布决定，而非测试分布</strong>。
            安全分类器的核心指标是召回率（不能漏掉 unsafe），而非准确率（大量 safe 猜对无意义）。
            1:1 配比让模型在 Safe 和 Unsafe 之间「不偏不倚」，Discriminative 分类头在这个分布下学到最优决策边界。
            如果追求特定场景的保守/宽松度，可以<strong>微调配比</strong>（如 1:3 或 3:1），但<strong>不建议用 99:1 的真实分布</strong>——那会导致模型退化。
          </div>
        </div>
      </DPCard>

      {/* ====== 6. 思路总结 ====== */}
      <Alert type="success" banner showIcon style={{ marginTop: 8 }}
        message="思路总结：构建训练数据的思维框架"
        description={
          <div style={{ fontSize: 12, lineHeight: 2 }}>
            <p style={{ margin: 0 }}><strong>1. 先问「数据从哪来」</strong>——种子扩展(Self-Instruct)？零种子生成(Magpie)？指令进化(Evol-Instruct)？盲点补全(GraphGen)？</p>
            <p style={{ margin: 0 }}><strong>2. 再问「怎么清洗」</strong>——分层过滤，从快到慢、从粗到精。先砍掉 50% 明显垃圾，再精细处理剩下的。</p>
            <p style={{ margin: 0 }}><strong>3. 最难的是「多样性」</strong>——不是质量 vs 多样性的二选一，而是用聚类/盲点/自适应选择在两者之间找平衡。</p>
            <p style={{ margin: 0 }}><strong>4. Qwen3Guard 的 Controversial</strong>——用 Strict/Loose 双模型行为差异来逼近人类标注的模糊性，这是数据工程中最优雅的设计之一（CheryGuard 未复现，但值得学习）。</p>
            <p style={{ margin: 0, marginTop: 8, padding: 8, background: '#f9f0ff', borderRadius: 4 }}>
              <strong style={{ color: '#722ed1' }}>CheryGuard 的数据路线：</strong>
              从开源安全数据集混合（Aegis2.0 + BeaverTails + HarmfulQA）→ 用 qwen3.7-plus Teacher 标注（翻转率 5.2%，原始质量已很好）→ Gen 三分类 + Stream 二分类 → Loss Masking 双 Head 训练。
              未复现 Qwen3Guard 的 Self-Instruct 扩展、Controversial 双模型投票、Rollout 标注等方法（数据量有限，ROI 不高）。
            </p>
          </div>
        } />
    </div>
  )
}
