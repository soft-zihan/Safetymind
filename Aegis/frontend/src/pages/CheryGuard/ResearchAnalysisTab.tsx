import { Row, Col, Tag, Alert, Table, Collapse } from 'antd'
import { QuestionCircleOutlined, BulbOutlined } from '@ant-design/icons'
import { DPCard } from './shared'

const { Panel } = Collapse

// ====== 内联样式常量 ======
const qBox = (color: string, bg: string) => ({
  padding: 12, borderRadius: 8, background: bg, border: `2px solid ${color}`, marginBottom: 12,
})

const qTitle = (color: string) => ({
  fontWeight: 700 as const, color, fontSize: 14, marginBottom: 8,
})

const qText = { fontSize: 11, lineHeight: 2, color: '#444' }

const codeBlock = {
  fontSize: 9, padding: 8, background: '#f5f5f5', borderRadius: 4,
  fontFamily: 'monospace', lineHeight: 1.8, marginBottom: 8, color: '#333',
}

const insightBox = (color: string) => ({
  padding: 10, borderRadius: 6, background: '#fffbe6', border: `1.5px solid ${color}`,
  borderLeft: `4px solid ${color}`, marginBottom: 10,
})

// ====== 主组件 ======
export default function ResearchAnalysisTab() {
  return (
    <div>
      <Alert type="info" banner showIcon style={{ marginBottom: 16 }}
        message="Qwen3Guard 论文深度研究 — 三个关键问题分析与方法溯源"
        description="基于原论文 (arXiv:2510.14276) 及官方博客解读，深入分析：① 人工标注数据的真实角色；② Refusal 检测的独立价值；③ Controversial 标签为什么不能用置信度替代。同时追溯每项技术的学术前身。" />

      {/* ============================================================ */}
      {/* Q1: 人工标注 */}
      {/* ============================================================ */}
      <DPCard title="  问题一：人工标注的数据具体是怎么用的？" icon="🏷️">
        <div style={qBox('#1890ff', '#f0f5ff')}>
          <div style={qTitle('#1890ff')}>
            <QuestionCircleOutlined /> 常见误解 vs 实际情况
          </div>
          <div style={qText}>
            <p>
              <strong style={{ color: '#ff4d4f' }}>误解：</strong>人工标注数据是主要训练数据，模型通过人类标注迭代改善。
            </p>
            <p>
              <strong style={{ color: '#52c41a' }}>实际：</strong>人工标注在整个管线中并不作为主要训练数据，而是扮演<strong style={{ color: '#722ed1' }}>「锚点 / 校准器」</strong>的角色——
              用少量高质量人类标注作为质检标准，验证自动标注管线的输出质量是否合格。
            </p>
          </div>
        </div>

        <div style={{ fontSize: 11, lineHeight: 2, color: '#444' }}>
          <p style={{ marginBottom: 8 }}>论文 Section 3.2 Auto Labeling 原文：</p>
          <div style={{ padding: 12, background: '#fafafa', borderRadius: 6, borderLeft: '4px solid #722ed1', marginBottom: 12, fontStyle: 'italic', fontSize: 11, color: '#555' }}>
            "Using a <strong>small set of manually annotated samples as a reference</strong>, we aggregate the model outputs
            via a voting mechanism. This ensemble-based strategy produces safety-level labels with an F1 score exceeding 0.9
            <strong> on the human-annotated validation set</strong>."
          </div>

          <div style={{ fontWeight: 700, fontSize: 12, color: '#722ed1', marginBottom: 8 }}>人工标注的三层用途</div>
          <Row gutter={[12, 12]}>
            {[
              {
                use: 'Auto Labeling 校准参考',
                detail: '先用 Qwen2.5-72B-Instruct、Qwen3-235B-A22B 等大模型对无标签数据做自动标注，再用少量人工标注样本作为 validation set 来验证和校准自动标注的质量（F1 > 0.9 才算合格）',
                color: '#1890ff', bg: '#e6f7ff',
              },
              {
                use: '投票机制的质量门控',
                detail: '多模型投票结果需要在人工标注验证集上达标。人工标注相当于「考试答案」，用来判断投票机制是否可靠。如果不达标，改善的对象是标注管线（调 prompt、换模型、调投票策略），而非 Qwen3Guard 本身',
                color: '#722ed1', bg: '#f9f0ff',
              },
              {
                use: '翻译质量抽检',
                detail: '多语言翻译后用 random sampling followed by manual review 做质量抽检。确保翻译后的安全标签在多语言中仍然准确',
                color: '#52c41a', bg: '#f6ffed',
              },
            ].map(item => (
              <Col span={8} key={item.use}>
                <div style={{ padding: 10, borderRadius: 6, background: item.bg, border: `1.5px solid ${item.color}`, height: '100%' }}>
                  <div style={{ fontWeight: 700, color: item.color, fontSize: 11, marginBottom: 6 }}>{item.use}</div>
                  <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>{item.detail}</div>
                </div>
              </Col>
            ))}
          </Row>

          <div style={insightBox('#faad14')}>
            <div style={{ fontWeight: 700, color: '#fa8c16', fontSize: 11, marginBottom: 6 }}>
              <BulbOutlined /> 关键洞察：人工标注 ≈ 质检标准，不是训练信号
            </div>
            <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
              1.19M 的数据量全部人工标注成本极高。论文的巧妙之处在于：用<strong>少量高质量人工标注</strong>作为锚点，
              让多个大模型的自动标注「对齐」到人类标准上。这和 RLHF 里用人类偏好训练 reward model 的思路类似——
              人类提供方向，模型放大规模。如果自动标注 F1 不达标，改善的是<strong>标注管线的工程参数</strong>（人工调参），
              不是让模型自动迭代学习。
            </div>
          </div>

          <div style={{ fontWeight: 700, fontSize: 12, color: '#722ed1', marginBottom: 8, marginTop: 12 }}>
            数据管线中的完整流程
          </div>
          <div style={codeBlock}>
{`多模型 (Qwen2.5-72B, Qwen3-235B 等) 对无标签数据做自动标注
        ↓
投票聚合 → 产生初步标签
        ↓
在人工标注验证集上测 F1 → 达到 0.9 以上？
        ↓ Yes                      ↓ No
标签合格，拿去训练        调整 prompt / 换模型 / 调投票策略
                                 （人工工程调优，不是模型自动调）`}
          </div>
        </div>
      </DPCard>

      {/* ============================================================ */}
      {/* Q2: Refusal */}
      {/* ============================================================ */}
      <DPCard title="  问题二：Refusal: yes/no 是干啥的，判断为 unsafe 不就可以拒绝了吗？" icon="🚫">
        <div style={qBox('#722ed1', '#f9f0ff')}>
          <div style={qTitle('#722ed1')}>
            <QuestionCircleOutlined /> 核心洞察：Safety 分类和 Refusal 检测是两个正交的任务
          </div>
          <div style={qText}>
            <p>
              <strong>Safety 分类</strong>问的是：「这段回复的内容有害吗？」——检测回复内容本身的危害性。
            </p>
            <p>
              <strong>Refusal 检测</strong>问的是：「这段回复是在拒绝用户吗？」——检测回复的<strong>行为模式</strong>（是否说了「我不能...」）。
            </p>
          </div>
        </div>

        <div style={{ fontWeight: 700, fontSize: 12, color: '#722ed1', marginBottom: 8 }}>四种组合——为什么两个维度必须独立</div>
        <Table
          size="small"
          pagination={false}
          dataSource={[
            { key: '1', combo: 'Safe + Refusal: Yes', example: '模型说「抱歉我无法回答」', result: '正确拒绝（可能过度谨慎）', color: '#faad14', impact: '不危险但浪费用户体验' },
            { key: '2', combo: 'Safe + Refusal: No', example: '模型正常回答了安全请求', result: '理想情况', color: '#52c41a', impact: '最佳' },
            { key: '3', combo: 'Unsafe + Refusal: Yes', example: '拒绝了但回复中仍包含有害内容', result: '拒绝不彻底', color: '#fa8c16', impact: '需要进一步审查' },
            { key: '4', combo: 'Unsafe + Refusal: No', example: '直接输出了有害内容', result: '最危险！', color: '#ff4d4f', impact: '安全防线失效' },
          ]}
          columns={[
            { title: '组合', dataIndex: 'combo', key: 'combo', width: 180, render: (v: string, r: any) => <Tag color={r.color} style={{ fontSize: 10 }}>{v}</Tag> },
            { title: '示例', dataIndex: 'example', key: 'example', render: (v: string) => <span style={{ fontSize: 10 }}>{v}</span> },
            { title: '结果', dataIndex: 'result', key: 'result', width: 160, render: (v: string) => <span style={{ fontSize: 10, fontWeight: 600 }}>{v}</span> },
            { title: '影响', dataIndex: 'impact', key: 'impact', width: 160, render: (v: string) => <span style={{ fontSize: 10, color: '#888' }}>{v}</span> },
          ]}
        />

        <div style={{ marginTop: 16, fontWeight: 700, fontSize: 12, color: '#722ed1', marginBottom: 8 }}>
          论文 Section 3.5 给出了最直接的答案——RL 奖励设计
        </div>
        <div style={{ fontSize: 11, lineHeight: 2, color: '#444' }}>
          <p>
            论文展示了 Qwen3Guard-Gen 作为<strong>下游 RL 应用</strong>的奖励信号（不是 Qwen3Guard 自身的训练）。
            在 RL 训练中，Refusal 检测解决了「过度拒绝」这一关键退化问题：
          </p>
        </div>

        <Row gutter={[12, 12]} style={{ marginTop: 8 }}>
          <Col span={12}>
            <div style={{ padding: 12, borderRadius: 8, background: '#fff2f0', border: '2px solid #ff4d4f' }}>
              <div style={{ fontWeight: 700, color: '#ff4d4f', fontSize: 12, marginBottom: 8 }}>
                Guard-Only Reward（只用 Safety）
              </div>
              <div style={codeBlock}>
{`r(x,t,y) =
  1.0  if is_safe(x,t) ∧ is_safe(x,y)
  0.0  otherwise`}
              </div>
              <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
                <strong>结果：</strong>安全率 99.7%，但拒绝率飙升到 <strong style={{ color: '#ff4d4f' }}>96.6%</strong>——模型学会了「一律拒绝」来保安全。
              </div>
            </div>
          </Col>
          <Col span={12}>
            <div style={{ padding: 12, borderRadius: 8, background: '#f6ffed', border: '2px solid #52c41a' }}>
              <div style={{ fontWeight: 700, color: '#52c41a', fontSize: 12, marginBottom: 8 }}>
                Hybrid Reward（Safety + Refusal + Helpfulness）
              </div>
              <div style={codeBlock}>
{`r(x,t,y) =
  min(-10, WorldPM)  if is_unsafe    ← 不安全重罚
  min(-5,  WorldPM)  if is_refusal   ← 过度拒绝轻罚
  WorldPM            otherwise       ← 正常奖励`}
              </div>
              <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
                <strong>结果：</strong>安全率 97%+，拒绝率降到 <strong style={{ color: '#52c41a' }}>5-6%</strong>。模型既安全又有用。
              </div>
            </div>
          </Col>
        </Row>

        <div style={insightBox('#ff4d4f')}>
          <div style={{ fontWeight: 700, color: '#ff4d4f', fontSize: 11, marginBottom: 6 }}>
            <BulbOutlined /> 关键结论
          </div>
          <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
            如果没有独立的 Refusal 检测，就无法区分「安全地回答了」和「过度拒绝了」，RL 训练时就会陷入「为了安全而拒绝一切」的退化陷阱。
            Refusal 检测的价值主要体现在<strong>下游 RL 应用</strong>——这是 Qwen3Guard 作为产品的一个卖点展示。
            <strong style={{ color: '#722ed1' }}> Qwen3Guard 自身的训练就是纯 SFT（指令跟随），不涉及 RL，不涉及对齐。</strong>
          </div>
        </div>

        <div style={{ padding: 10, borderRadius: 6, background: '#f0f5ff', border: '1.5px solid #1890ff' }}>
          <div style={{ fontWeight: 700, color: '#1890ff', fontSize: 11, marginBottom: 6 }}>两个阶段的关系</div>
          <Table
            size="small"
            pagination={false}
            dataSource={[
              { key: '1', stage: 'Qwen3Guard 自身训练', method: 'SFT（指令跟随）', rl: '不涉及', target: 'Qwen3Guard（安全分类器）' },
              { key: '2', stage: '用 Qwen3Guard 改进其他模型', method: 'RL reward signal', rl: '涉及', target: 'Qwen3-4B 等对话模型' },
            ]}
            columns={[
              { title: '阶段', dataIndex: 'stage', key: 'stage', render: (v: string) => <span style={{ fontSize: 10, fontWeight: 600 }}>{v}</span> },
              { title: '方法', dataIndex: 'method', key: 'method', render: (v: string) => <Tag color="blue" style={{ fontSize: 9 }}>{v}</Tag> },
              { title: '涉及 RL?', dataIndex: 'rl', key: 'rl', render: (v: string) => <Tag color={v === '不涉及' ? 'green' : 'orange'} style={{ fontSize: 9 }}>{v}</Tag> },
              { title: '训练对象', dataIndex: 'target', key: 'target', render: (v: string) => <span style={{ fontSize: 10 }}>{v}</span> },
            ]}
          />
        </div>
      </DPCard>

      {/* ============================================================ */}
      {/* Q3: Controversial */}
      {/* ============================================================ */}
      <DPCard title="  问题三：为什么标注 Controversial 那么麻烦，直接用 unsafe 的置信度不行吗？" icon="🤔">
        <div style={qBox('#fa8c16', '#fff7e6')}>
          <div style={qTitle('#fa8c16')}>
            <QuestionCircleOutlined /> 核心答案：置信度 ≠ 策略分歧，两者在语义上有本质区别
          </div>
        </div>

        <div style={{ fontWeight: 700, fontSize: 12, color: '#722ed1', marginBottom: 8 }}>论文的核心发现</div>
        <div style={{ fontSize: 11, lineHeight: 2, color: '#444', marginBottom: 12 }}>
          <p>论文 Section 3.4.1 揭示了一个关键现象：</p>
          <div style={{ padding: 12, background: '#fafafa', borderRadius: 6, borderLeft: '4px solid #fa8c16', marginBottom: 8, fontStyle: 'italic', fontSize: 11, color: '#555' }}>
            "Safety policies naturally vary across cultures and application contexts...
            WildGuard-7B aligns well with the Aegis dataset but behaves <strong>overly conservatively on OpenAIMod</strong>."
          </div>
          <p>不同的 benchmark 对「有害」的定义本身就不同：</p>
          <Row gutter={[12, 12]}>
            <Col span={12}>
              <div style={{ padding: 10, borderRadius: 6, background: '#fff2f0', border: '1.5px solid #ff4d4f' }}>
                <div style={{ fontWeight: 700, color: '#ff4d4f', fontSize: 11, marginBottom: 4 }}>Aegis 数据集</div>
                <div style={{ fontSize: 10, color: '#555' }}>采用 "prevent-at-source" 策略，borderline 内容标为 unsafe。宁可错杀不放过。</div>
              </div>
            </Col>
            <Col span={12}>
              <div style={{ padding: 10, borderRadius: 6, background: '#f6ffed', border: '1.5px solid #52c41a' }}>
                <div style={{ fontWeight: 700, color: '#52c41a', fontSize: 11, marginBottom: 4 }}>OpenAIMod 数据集</div>
                <div style={{ fontSize: 10, color: '#555' }}>采用 "trust-but-verify" 策略，borderline 内容标为 safe。信任模型会给出安全回答。</div>
              </div>
            </Col>
          </Row>
        </div>

        <div style={{ fontWeight: 700, fontSize: 12, color: '#ff4d4f', marginBottom: 8 }}>为什么置信度方法不行——三个根本问题</div>

        <Collapse style={{ marginBottom: 12 }} defaultActiveKey={['1']}>
          <Panel header={<span style={{ fontWeight: 700, color: '#ff4d4f' }}>问题一：置信度反映的是「模型不确定性」，不是「策略分歧」</span>} key="1">
            <div style={{ fontSize: 10, lineHeight: 1.8, color: '#555' }}>
              <div style={codeBlock}>
{`置信度低的样本可能是：
  - 噪声数据 / OOD 数据（模型看不懂）   ← 不是 controversial
  - 标注错误的样本                       ← 不是 controversial
  - 真正的策略边界样本                    ← 这才是 controversial`}
              </div>
              <p>置信度无法区分这三类，会把大量「垃圾数据」误标为 controversial。</p>
            </div>
          </Panel>
          <Panel header={<span style={{ fontWeight: 700, color: '#fa8c16' }}>问题二：单模型置信度阈值无法适配不同 benchmark</span>} key="2">
            <div style={{ fontSize: 10, lineHeight: 1.8, color: '#555' }}>
              <p>论文 Table 8 ablation 实验给出了决定性证据：</p>
              <Table
                size="small"
                pagination={false}
                dataSource={[
                  { key: '1', method: '无 Controversial（二分类）', toxic: '71.1', aegis: '86.1' },
                  { key: '2', method: '有 Controversial + strict', toxic: '66.2', aegis: '90.9' },
                  { key: '3', method: '有 Controversial + loose', toxic: '80.9', aegis: '75.3' },
                ]}
                columns={[
                  { title: '方法', dataIndex: 'method', key: 'method', render: (v: string) => <span style={{ fontSize: 10, fontWeight: 600 }}>{v}</span> },
                  { title: 'ToxiC（宽松标准）', dataIndex: 'toxic', key: 'toxic', width: 140, render: (v: string) => <span style={{ fontSize: 10, fontWeight: 700, color: parseFloat(v) > 75 ? '#52c41a' : '#ff4d4f' }}>{v}</span> },
                  { title: 'Aegis（严格标准）', dataIndex: 'aegis', key: 'aegis', width: 140, render: (v: string) => <span style={{ fontSize: 10, fontWeight: 700, color: parseFloat(v) > 80 ? '#52c41a' : '#ff4d4f' }}>{v}</span> },
                ]}
              />
              <p style={{ marginTop: 8 }}>
                <strong>同一个 controversial 标签</strong>，在严格 benchmark 里归为 unsafe 效果更好，
                在宽松 benchmark 里归为 safe 效果更好。这证明 controversial 捕获的确实是<strong>策略分歧</strong>，而不是模型不确定性。
              </p>
            </div>
          </Panel>
          <Panel header={<span style={{ fontWeight: 700, color: '#722ed1' }}>问题三：论文方法的精妙之处在于「用数据分布操纵决策边界」</span>} key="3">
            <div style={{ fontSize: 10, lineHeight: 1.8, color: '#555' }}>
              <div style={codeBlock}>
{`PartA-Strict 模型：增加 Safe 样本比例 → 决策边界右移 → 倾向预测 Unsafe
PartA-Loose 模型：增加 Unsafe 样本比例 → 决策边界左移 → 倾向预测 Safe

两个模型模拟了两种不同的安全策略（类似 Aegis vs OpenAIMod 的哲学差异）
它们预测冲突的样本 = "不同策略下会有不同判断"的样本 → 这正是 controversial 的定义`}
              </div>
              <p>
                而单模型置信度方法本质上只有一个决策边界，阈值调来调去只是在同一个边界附近划定一个窄带，
                无法模拟出两种不同策略之间的<strong>系统性分歧</strong>。
              </p>
            </div>
          </Panel>
        </Collapse>

        <div style={{ fontWeight: 700, fontSize: 12, color: '#722ed1', marginBottom: 8 }}>总结对比</div>
        <Table
          size="small"
          pagination={false}
          dataSource={[
            { key: '1', dim: '捕获的信号', conf: '模型不确定性（含噪声）', dual: '策略分歧（目标信号）' },
            { key: '2', dim: '对噪声数据', conf: '误标为 controversial', dual: '通过交叉验证和蒸馏排除' },
            { key: '3', dim: '适配不同 benchmark', conf: '需要重新调阈值', dual: '切换 strict/loose 即可' },
            { key: '4', dim: '语义意义', conf: '「我不确定」', dual: '「不同标准下结论不同」' },
          ]}
          columns={[
            { title: '维度', dataIndex: 'dim', key: 'dim', width: 140, render: (v: string) => <span style={{ fontSize: 10, fontWeight: 700 }}>{v}</span> },
            { title: '单模型置信度阈值', dataIndex: 'conf', key: 'conf', render: (v: string) => <span style={{ fontSize: 10, color: '#ff4d4f' }}>{v}</span> },
            { title: '论文 strict/loose 双模型', dataIndex: 'dual', key: 'dual', render: (v: string) => <span style={{ fontSize: 10, color: '#52c41a' }}>{v}</span> },
          ]}
        />
      </DPCard>

      {/* ============================================================ */}
      {/* 方法溯源 */}
      {/* ============================================================ */}
      <DPCard title="  方法溯源 — 哪些是原创，哪些有前身？" icon="📜">
        <Alert type="warning" banner showIcon style={{ marginBottom: 12 }}
          message="核心结论：都不是完全原创，但具体实现方法有创新"
          description="Qwen3Guard 的核心创新不在于发明任何单一新技术，而在于将多个成熟技术精巧地组合成一个完整的安全护栏数据管线，并在具体实现上做了针对性的工程创新。论文 Related Work 部分对每个前身工作都做了引用和区分。" />

        <Table
          size="small"
          pagination={false}
          dataSource={[
            {
              key: '1', tech: 'Controversial 概念',
              prior: 'ShieldLM (Zhang et al., 2024) — 首次提出 controversial 概念，用人工规则标注',
              contribution: '用 strict/loose 双模型数据驱动替代人工规则',
              original: '概念非原创，标注方法创新',
            },
            {
              key: '2', tech: '策略不一致问题',
              prior: 'ShieldGemma (Zeng et al., 2024) — 动态调整分类器阈值',
              contribution: '提出三分类 + strict/loose 推理时切换',
              original: '问题定义非原创，解决方案创新',
            },
            {
              key: '3', tech: '交叉训练标注',
              prior: 'Co-Training (Blum & Mitchell, 1998) — 半监督学习经典范式',
              contribution: '应用于安全标签去噪，结合交叉验证思想',
              original: '经典方法的新应用场景',
            },
            {
              key: '4', tech: '标签蒸馏',
              prior: 'Knowledge Distillation (Hinton et al., 2015) + Noisy Label Learning (Bhardwaj 2021, Lukasik 2020)',
              contribution: '组合应用于安全分类场景的标签精炼',
              original: '经典方法的组合应用',
            },
            {
              key: '5', tech: 'Token 级标注（Rollout）',
              prior: 'Process Reward Models (Zhang et al., 2025) — 数学推理中的过程奖励',
              contribution: '从数学推理迁移到安全检测，加上 LLM-as-Judge 二次验证',
              original: '跨领域迁移 + 验证机制创新',
            },
            {
              key: '6', tech: '流式检测',
              prior: 'CARE 框架 (Hu et al., 2025) — detect-rollback-intervene',
              contribution: '首次实现原生 token 级分类头，配合去抖机制',
              original: '架构创新',
            },
          ]}
          columns={[
            { title: '技术点', dataIndex: 'tech', key: 'tech', width: 140, render: (v: string) => <span style={{ fontSize: 10, fontWeight: 700, color: '#722ed1' }}>{v}</span> },
            { title: '前身工作', dataIndex: 'prior', key: 'prior', render: (v: string) => <span style={{ fontSize: 10 }}>{v}</span> },
            { title: 'Qwen3Guard 的贡献', dataIndex: 'contribution', key: 'contribution', width: 220, render: (v: string) => <span style={{ fontSize: 10, color: '#52c41a', fontWeight: 600 }}>{v}</span> },
            { title: '原创性判断', dataIndex: 'original', key: 'original', width: 170, render: (v: string) => <Tag color="orange" style={{ fontSize: 9 }}>{v}</Tag> },
          ]}
        />

        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: '#722ed1', marginBottom: 8 }}>关键引用原文（论文 Related Work）</div>
          <div style={{ padding: 12, background: '#fafafa', borderRadius: 6, borderLeft: '4px solid #722ed1', fontStyle: 'italic', fontSize: 11, color: '#555', lineHeight: 2 }}>
            "To address the challenge of inconsistent safety policies across different contexts,
            <strong> Zhang et al. (2024) propose the concept of a "controversial" label</strong>, which they annotate using rule-based heuristics.
            In our approach, we instead derive the controversial labels through ensemble voting among multiple models.
            Additionally, <strong>Zeng et al. (2024) mitigate policy inconsistency from a different angle</strong> by dynamically adjusting classifier thresholds."
          </div>
          <div style={{ padding: 12, background: '#fafafa', borderRadius: 6, borderLeft: '4px solid #52c41a', fontStyle: 'italic', fontSize: 11, color: '#555', lineHeight: 2, marginTop: 8 }}>
            "A main obstacle to training such token-level guard models is to collect a fine-grained, token-level annotations for model responses.
            <strong> Inspired by Zhang et al. (2025)</strong>, we design a method to automatically convert coarse, sample-level labels into the requisite token-level annotations."
          </div>
        </div>

        <div style={insightBox('#722ed1')}>
          <div style={{ fontWeight: 700, color: '#722ed1', fontSize: 11, marginBottom: 6 }}>
            <BulbOutlined /> 一句话总结
          </div>
          <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
            Qwen3Guard 是<strong>工程系统层面的创新</strong>，而非方法论层面的原始创新。
            将 controversial 标签 + 双模型交叉标注 + 标签蒸馏 + rollout token 标注等多个成熟技术精巧组合，
            配合数据分布操纵决策边界、LLM-as-Judge 双重验证等针对性工程创新，构建了一个完整的安全护栏数据管线。
            论文也没有声称这些技术是原创——Related Work 部分对每个前身工作都做了引用和区分。
          </div>
        </div>
      </DPCard>

      {/* ============================================================ */}
      {/* 标签蒸馏深入 */}
      {/* ============================================================ */}
      <DPCard title="  补充：标签蒸馏的完整原理" icon="🧪">
        <div style={{ fontSize: 11, lineHeight: 2, color: '#444' }}>
          <p>
            标签蒸馏（Label Distillation）解决的核心问题：前面的 Auto Labeling + Controversial 构建虽然产出了标签，
            但<strong>一定有噪声</strong>——投票可能出错，边界可能模糊。
          </p>
        </div>

        <div style={{ fontWeight: 700, fontSize: 12, color: '#722ed1', marginBottom: 8 }}>交叉训练的核心思路</div>
        <div style={codeBlock}>
{`前两步产出的带标签数据
        ↓
    均分为 Part A 和 Part B
        ↓
┌──────────────────────────────────────────┐
│ 第一轮：                                  │
│  用 Part A 的数据 SFT 训练 Qwen3-32B      │
│       → 得到 PartA-Teacher               │
│  用 PartA-Teacher 重新标注 Part B         │
│       → 修正 Part B 中的标注错误           │
├──────────────────────────────────────────┤
│ 第二轮（反转角色）：                        │
│  用 Part B 的数据 SFT 训练 Qwen3-32B      │
│       → 得到 PartB-Teacher               │
│  用 PartB-Teacher 重新标注 Part A         │
│       → 修正 Part A 中的标注错误           │
├──────────────────────────────────────────┤
│ 合并 Part A + Part B → 最终高质量标签      │
└──────────────────────────────────────────┘`}
        </div>

        <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
          <Col span={12}>
            <div style={{ padding: 12, borderRadius: 8, background: '#fff2f0', border: '2px solid #ff4d4f' }}>
              <div style={{ fontWeight: 700, color: '#ff4d4f', fontSize: 11, marginBottom: 6 }}>
                为什么必须交叉（A→标注B，B→标注A）
              </div>
              <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
                <strong>防止过拟合导致「自我强化错误」。</strong>如果用同一份数据既训练又标注：
                Teacher 会过拟合 Part A 的噪声，把错误的标签「强化」一遍——「错的更错，对的可能也变错」。
              </div>
            </div>
          </Col>
          <Col span={12}>
            <div style={{ padding: 12, borderRadius: 8, background: '#f6ffed', border: '2px solid #52c41a' }}>
              <div style={{ fontWeight: 700, color: '#52c41a', fontSize: 11, marginBottom: 6 }}>
                交叉训练为什么有效
              </div>
              <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
                Teacher 在标注时面对的是<strong>没训练过的数据</strong>，它的判断基于「学到的规律」而非「记住的答案」。
                这和 cross-validation 思想一模一样——用训练集以外的数据来评估/修正。
              </div>
            </div>
          </Col>
        </Row>

        <div style={{ marginTop: 12, fontWeight: 700, fontSize: 12, color: '#722ed1', marginBottom: 8 }}>蒸馏效果（论文 Table 9）</div>
        <Table
          size="small"
          pagination={false}
          dataSource={[
            { key: '1', dim: 'Prompt Avg F1', before: '—', after: '—', delta: '+0.47 / +1.10 (strict/loose)' },
            { key: '2', dim: 'Response Avg F1', before: '—', after: '—', delta: '+0.50 / +0.76 (strict/loose)' },
          ]}
          columns={[
            { title: '维度', dataIndex: 'dim', key: 'dim', render: (v: string) => <span style={{ fontSize: 10, fontWeight: 700 }}>{v}</span> },
            { title: '蒸馏前', dataIndex: 'before', key: 'before', width: 100 },
            { title: '蒸馏后', dataIndex: 'after', key: 'after', width: 100 },
            { title: '提升', dataIndex: 'delta', key: 'delta', render: (v: string) => <span style={{ fontSize: 10, fontWeight: 700, color: '#52c41a' }}>{v}</span> },
          ]}
        />

        <div style={{ marginTop: 12, padding: 10, borderRadius: 6, background: '#f0f5ff', border: '1.5px solid #1890ff' }}>
          <div style={{ fontWeight: 700, color: '#1890ff', fontSize: 11, marginBottom: 6 }}>为什么选 Qwen3-32B 而非 235B？</div>
          <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
            工程权衡的甜区——容量大到能学到复杂的安全决策边界，但小到训练两轮（Part A 一轮、Part B 一轮）成本可接受。
            32B 是 Dense 模型，容量适中；235B 是 MoE 架构，虽然总参数多但训练成本极高。
          </div>
        </div>

        <div style={{ fontWeight: 700, fontSize: 12, color: '#722ed1', marginBottom: 8, marginTop: 16 }}>学术前身</div>
        <Row gutter={[12, 12]}>
          {[
            { name: 'Co-Training', paper: 'Blum & Mitchell (1998)', idea: '半监督学习经典范式：两个分类器各自标注无标签数据，互相补充训练集', color: '#1890ff' },
            { name: 'Knowledge Distillation', paper: 'Hinton et al. (2015)', idea: '用大模型（teacher）的输出指导小模型（student）训练', color: '#722ed1' },
            { name: 'Noisy Label Learning', paper: 'Bhardwaj (2021), Lukasik (2020)', idea: '用蒸馏/重标注方法在噪声标签下学习更鲁棒的模型', color: '#52c41a' },
            { name: 'Process Reward Models', paper: 'Zhang et al. (2025)', idea: '数学推理中的过程奖励——rollout 方法评估每步正确性', color: '#fa8c16' },
          ].map(item => (
            <Col span={12} key={item.name}>
              <div style={{ padding: 10, borderRadius: 6, background: '#fafafa', borderLeft: `3px solid ${item.color}` }}>
                <div style={{ fontWeight: 700, color: item.color, fontSize: 11, marginBottom: 4 }}>{item.name}</div>
                <div style={{ fontSize: 9, color: '#888', marginBottom: 4 }}>{item.paper}</div>
                <div style={{ fontSize: 10, color: '#555', lineHeight: 1.6 }}>{item.idea}</div>
              </div>
            </Col>
          ))}
        </Row>
      </DPCard>

      {/* ============================================================ */}
      {/* 完整数据管线总览 */}
      {/* ============================================================ */}
      <DPCard title="  Qwen3Guard 完整数据管线总览" icon="🔗">
        <div style={codeBlock}>
{`原始无标签数据
    ↓
【第一步】Auto Labeling
    多模型投票 → 粗标签 (safe/unsafe)
    人类标注验证集：质检，F1 > 0.9 才放行
    ↓
【第二步】Controversial 构建
    strict/loose 双模型交叉标注 → 冲突样本标为 controversial
    将二分类扩展为三分类
    ↓
【第三步】Label Distillation
    用 Qwen3-32B 精炼所有标签 → 修正前两步的错误
    ↓
最终 1.19M 条高质量三分类标签
    ↓
用这些数据 SFT 训练 Qwen3Guard-Gen (0.6B / 4B / 8B)`}
        </div>

        <div style={{ fontWeight: 700, fontSize: 11, color: '#722ed1', marginBottom: 8 }}>每一步解决不同的数据质量问题</div>
        <Row gutter={[12, 12]}>
          {[
            { step: '第一步 Auto Labeling', solves: '从无到有', method: '多模型投票 + 人类验证', color: '#1890ff' },
            { step: '第二步 Controversial', solves: '灰色地带', method: '数据分布操纵决策边界', color: '#fa8c16' },
            { step: '第三步 Distillation', solves: '去噪精炼', method: '交叉训练 + 大模型重标注', color: '#722ed1' },
          ].map(item => (
            <Col span={8} key={item.step}>
              <div style={{ padding: 10, borderRadius: 6, background: '#fafafa', borderLeft: `3px solid ${item.color}`, textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: item.color, fontSize: 11, marginBottom: 4 }}>{item.step}</div>
                <div style={{ fontSize: 10, color: '#333', fontWeight: 600, marginBottom: 4 }}>解决：{item.solves}</div>
                <div style={{ fontSize: 9, color: '#888' }}>{item.method}</div>
              </div>
            </Col>
          ))}
        </Row>
      </DPCard>

      {/* ============================================================ */}
      {/* Stream 两阶段标注法 */}
      {/* ============================================================ */}
      <DPCard title="  Stream 变体的两阶段标注法 — 从样本级到 token 级" icon="🔬">
        <div style={{ fontSize: 11, lineHeight: 2, color: '#444' }}>
          <Alert type="warning" banner showIcon style={{ marginBottom: 12 }}
            message="核心难题：从哪搞 token 级标注？"
            description="Stream 变体要在每个 token 上做分类，但现有的安全数据集只有整条回复的标签（safe/unsafe）。两阶段标注法解决的问题就是：如何在一条 unsafe 回复中，找到那个「从第几个 token 开始变 unsafe」的边界。" />

          <div style={{ fontWeight: 700, fontSize: 13, color: '#722ed1', marginBottom: 10 }}>
            用一个具体例子走完全流程
          </div>
          <div style={{ padding: 12, borderRadius: 8, background: '#fafafa', border: '1.5px solid #d9d9d9', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontFamily: 'monospace', lineHeight: 2, color: '#555' }}>
              <div>假设有一条 unsafe 回复（整条标签为 unsafe）：</div>
              <div style={{ marginTop: 6 }}>
                <Tag style={{ fontSize: 9 }}>S₁="I"</Tag>
                <Tag style={{ fontSize: 9 }}>S₂=" can"</Tag>
                <Tag style={{ fontSize: 9 }}>S₃=" help"</Tag>
                <Tag style={{ fontSize: 9 }}>S₄=" you"</Tag>
                <Tag style={{ fontSize: 9 }}>S₅=" make"</Tag>
                <Tag style={{ fontSize: 9 }}>S₆=" an"</Tag>
                <Tag style={{ fontSize: 9 }}>S₇=" improvised"</Tag>
                <Tag color="red" style={{ fontSize: 9 }}>S₈=" explosive" ← 边界</Tag>
                <Tag color="red" style={{ fontSize: 9 }}>S₉=" device"</Tag>
                <Tag color="red" style={{ fontSize: 9 }}>S₁₀=" using"</Tag>
              </div>
            </div>
          </div>

          {/* === 阶段一 === */}
          <div style={{ fontWeight: 700, fontSize: 12, color: '#1890ff', marginBottom: 8 }}>阶段一：Rollout-Based Safety Assessment（续写投票）</div>
          <div style={insightBox('#1890ff')}>
            <div style={{ fontWeight: 700, color: '#1890ff', fontSize: 11, marginBottom: 6 }}>
              <BulbOutlined /> 核心思想
            </div>
            <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
              从每个位置「截断」，让多个 LLM 续写，看续写结果是否危险。如果大多数续写都危险，说明<strong>截至这个位置的内容已经「走上歪路」了</strong>。
            </div>
          </div>

          <div style={{ fontWeight: 700, fontSize: 11, color: '#333', marginBottom: 6 }}>对每个 token Sᵢ 执行以下 5 步：</div>
          <div style={codeBlock}>
{`Step 1: 截取前缀 Pᵢ = {S₁, S₂, ..., Sᵢ}

Step 2: 把 Pᵢ 喂给多个 LLM（ensemble），让每个模型续写 k 个 rollout
        Rᵢ,₁, Rᵢ,₂, ..., Rᵢ,ₖ

Step 3: 拼接成完整回复
        Cᵢ,₁ = Pᵢ ⊕ Rᵢ,₁    ("I can help you make an" + LLM续写部分)
        Cᵢ,₂ = Pᵢ ⊕ Rᵢ,₂
        ...
        Cᵢ,ₖ = Pᵢ ⊕ Rᵢ,ₖ

Step 4: 用 Generative CheryGuard 评估每个 Cᵢ,ⱼ 的安全性

Step 5: 统计不安全比例
        unsafe_ratio = count(unsafe or controversial) / k`}
          </div>

          <div style={{ fontWeight: 700, fontSize: 11, color: '#333', marginBottom: 6 }}>判定规则（论文 Eq. 4，阈值 X% = 85%）：</div>
          <div style={{ padding: 10, background: '#f0f5ff', borderRadius: 6, border: '1.5px solid #1890ff', marginBottom: 12, fontSize: 11, textAlign: 'center' }}>
            is_unsafe<sub>rollout</sub>(Sᵢ) = 1 &nbsp; iff &nbsp; unsafe_ratio ≥ 85%
          </div>

          <div style={{ fontWeight: 700, fontSize: 11, color: '#333', marginBottom: 6 }}>用例子走一遍：</div>
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            {[
              { prefix: 'P₁ = "I"', ratio: '5%', result: 'safe', reason: '续写都是无害的正常句子', color: '#52c41a' },
              { prefix: 'P₅ = "I can help you make"', ratio: '40%', result: 'safe', reason: '方向分化，做蛋糕/做炸弹各半', color: '#52c41a' },
              { prefix: 'P₇ = "...make an improvised"', ratio: '90%', result: 'unsafe!', reason: '"improvised" 强烈引向危险内容', color: '#ff4d4f' },
              { prefix: 'P₈ = "...an improvised explosive"', ratio: '98%', result: 'unsafe!', reason: '几乎所有续写都是危险内容', color: '#ff4d4f' },
            ].map((item, idx) => (
              <Col span={12} key={idx}>
                <div style={{ padding: 10, borderRadius: 6, background: `${item.color}08`, border: `1.5px solid ${item.color}` }}>
                  <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#555', marginBottom: 4 }}>{item.prefix}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Tag color={item.color === '#52c41a' ? 'green' : 'red'} style={{ fontSize: 9 }}>{item.ratio}</Tag>
                    <span style={{ fontSize: 10, fontWeight: 700, color: item.color }}>{item.result}</span>
                  </div>
                  <div style={{ fontSize: 9, color: '#888' }}>{item.reason}</div>
                </div>
              </Col>
            ))}
          </Row>

          <div style={{ fontSize: 10, color: '#888', marginBottom: 12, padding: 8, background: '#fffbe6', borderRadius: 4, borderLeft: '3px solid #faad14' }}>
            <strong style={{ color: '#fa8c16' }}>为什么是 85% 而非 50%？</strong> 论文说："In our pilot experiments, we found that setting X%=85% yields strong alignment with human safety annotations."
            50% 意味着「有一半概率续写出不安全内容」就标记——太敏感了，会把大量正常 token 误标。85% 是「绝大多数续写都危险」才算。
          </div>

          {/* === 阶段二 === */}
          <div style={{ fontWeight: 700, fontSize: 12, color: '#722ed1', marginBottom: 8 }}>阶段二：LLM-as-Judge Verification（大模型复核）</div>

          <div style={insightBox('#ff4d4f')}>
            <div style={{ fontWeight: 700, color: '#ff4d4f', fontSize: 11, marginBottom: 6 }}>
              <BulbOutlined /> 为什么需要第二阶段？
            </div>
            <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
              Rollout 有一个关键缺陷：<strong>它可能高估某些 token 的风险</strong>。即使 token Sᵢ 本身是无害的，LLM 的续写也可能出现高比例的不安全内容——因为 LLM 本身就有可能生成有害内容，不管前缀是什么。
              Rollout 会把一些本来安全的 token 误标为 unsafe。
            </div>
          </div>

          <div style={{ fontSize: 11, lineHeight: 2, color: '#444', marginBottom: 12 }}>
            <p>论文原文（Section 4.2）：</p>
            <div style={{ padding: 10, background: '#fafafa', borderRadius: 6, borderLeft: '4px solid #722ed1', fontStyle: 'italic', fontSize: 11, color: '#555', marginBottom: 8 }}>
              "A critical limitation of the rollout mechanism is that it may overestimate the risk of certain tokens.
              Even when a token Sᵢ itself is safe/harmless, the rollouts may contain a high proportion of unsafe continuations
              because language models can be susceptible to generating harmful content regardless of the specific prompting token."
            </div>

            <p><strong>解决方法</strong>：用 Qwen3-235B-A22B 作为 Judge，<strong>只看前缀文本本身</strong>来判断安全性（不推测后续内容）：</p>
          </div>

          <div style={{ padding: 10, background: '#f9f0ff', borderRadius: 6, border: '1.5px solid #722ed1', marginBottom: 12, fontSize: 11, textAlign: 'center' }}>
            is_unsafe<sub>judge</sub>(Sᵢ) = 1 &nbsp; iff &nbsp; f<sub>judge</sub>(Pᵢ) = unsafe
          </div>

          <div style={{ fontWeight: 700, fontSize: 11, color: '#333', marginBottom: 6 }}>Rollout vs Judge 的本质区别：</div>
          <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
            <Col span={12}>
              <div style={{ padding: 10, borderRadius: 6, background: '#e6f7ff', border: '1.5px solid #1890ff' }}>
                <div style={{ fontWeight: 700, color: '#1890ff', fontSize: 11, marginBottom: 4 }}>Rollout 问的是</div>
                <div style={{ fontSize: 10, color: '#555' }}>「如果从这里继续写，<strong>大概率</strong>会写出不安全内容吗？」——评估<strong>未来的可能性</strong></div>
              </div>
            </Col>
            <Col span={12}>
              <div style={{ padding: 10, borderRadius: 6, background: '#f9f0ff', border: '1.5px solid #722ed1' }}>
                <div style={{ fontWeight: 700, color: '#722ed1', fontSize: 11, marginBottom: 4 }}>Judge 问的是</div>
                <div style={{ fontSize: 10, color: '#555' }}>「就这段文本<strong>本身</strong>来看，它已经不安全了吗？」——评估<strong>当前的安全性</strong></div>
              </div>
            </Col>
          </Row>

          <div style={{ fontWeight: 700, fontSize: 11, color: '#333', marginBottom: 6 }}>用例子说明 Judge 如何纠正 Rollout 的误判：</div>
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col span={12}>
              <div style={{ padding: 10, borderRadius: 6, background: '#fff2f0', border: '1.5px solid #ff4d4f' }}>
                <div style={{ fontWeight: 700, color: '#ff4d4f', fontSize: 11, marginBottom: 4 }}>P₇ = "...make an improvised"</div>
                <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
                  <strong>Rollout：</strong>unsafe (90%) — 续写大多指向危险<br/>
                  <strong>Judge：</strong>"improvised" 可能指即兴表演、即兴烹饪...<br/>
                  <Tag color="orange" style={{ fontSize: 9, marginTop: 4 }}>复核否决！rollout 假阳性</Tag>
                </div>
              </div>
            </Col>
            <Col span={12}>
              <div style={{ padding: 10, borderRadius: 6, background: '#f6ffed', border: '1.5px solid #52c41a' }}>
                <div style={{ fontWeight: 700, color: '#52c41a', fontSize: 11, marginBottom: 4 }}>P₈ = "...an improvised explosive"</div>
                <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
                  <strong>Rollout：</strong>unsafe (98%) — 续写几乎全危险<br/>
                  <strong>Judge：</strong>文本本身已明确涉及爆炸物<br/>
                  <Tag color="red" style={{ fontSize: 9, marginTop: 4 }}>复核通过！双重确认 unsafe</Tag>
                </div>
              </div>
            </Col>
          </Row>

          {/* === 最终标注 === */}
          <div style={{ fontWeight: 700, fontSize: 12, color: '#52c41a', marginBottom: 8 }}>最终标注确定（Final Label Determination）</div>
          <div style={{ fontSize: 11, lineHeight: 2, color: '#444', marginBottom: 12 }}>
            <p>论文原文：</p>
            <div style={{ padding: 10, background: '#fafafa', borderRadius: 6, borderLeft: '4px solid #52c41a', fontStyle: 'italic', fontSize: 11, color: '#555', marginBottom: 8 }}>
              "A definitive unsafe label is assigned to a token Sᵢ <strong>if and only if both</strong> the rollout assessment
              and the LLM-as-judge verification concur that the content is unsafe at that point."
            </div>

            <p><strong>双重确认</strong>：只有 rollout + judge 都判 unsafe，才最终标记。然后：</p>
            <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
              ① 找到<strong>第一个</strong>被双重确认的 token Sᵢ → 这就是<strong>边界 token</strong><br/>
              ② Sᵢ 及其后面的所有 token → 继承样本级标签（unsafe 或 controversial）<br/>
              ③ Sᵢ 之前的所有 token → 标记为 safe
            </div>
          </div>

          <div style={{ fontWeight: 700, fontSize: 11, color: '#333', marginBottom: 6 }}>例子最终结果：</div>
          <div style={{ padding: 12, borderRadius: 8, background: '#fafafa', border: '1.5px solid #d9d9d9', marginBottom: 16 }}>
            <Row gutter={[4, 4]}>
              {[
                { token: 'S₁="I"', safe: true, note: '' },
                { token: 'S₂=" can"', safe: true, note: '' },
                { token: 'S₃=" help"', safe: true, note: '' },
                { token: 'S₄=" you"', safe: true, note: '' },
                { token: 'S₅=" make"', safe: true, note: '' },
                { token: 'S₆=" an"', safe: true, note: '' },
                { token: 'S₇=" improvised"', safe: true, note: 'rollout标记但judge否决' },
                { token: 'S₈=" explosive"', safe: false, note: '边界token！双重确认' },
                { token: 'S₉=" device"', safe: false, note: '继承样本级标签' },
                { token: 'S₁₀=" using"', safe: false, note: '继承样本级标签' },
              ].map((item, idx) => (
                <Col span={12} key={idx} style={{ marginBottom: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Tag color={item.safe ? 'green' : 'red'} style={{ fontSize: 8 }}>{item.safe ? 'safe' : 'unsafe'}</Tag>
                    <code style={{ fontSize: 9, color: '#555' }}>{item.token}</code>
                    {item.note && <span style={{ fontSize: 8, color: '#fa8c16' }}>← {item.note}</span>}
                  </div>
                </Col>
              ))}
            </Row>
          </div>

          {/* === 设计决策分析 === */}
          <div style={{ fontWeight: 700, fontSize: 12, color: '#722ed1', marginBottom: 8 }}>为什么这么设计？——每个设计决策的原因</div>
          <Table
            size="small"
            pagination={false}
            style={{ marginBottom: 16 }}
            dataSource={[
              { key: '1', decision: '为什么用 rollout？', reason: '直接看前缀文本很难判断安全性（"I can help you make an" 到底是安全还是不安全？），但续写的统计分布能揭示前缀的「危险倾向」' },
              { key: '2', decision: '为什么用多个 LLM 续写？', reason: '单个 LLM 的续写有偏好偏差，多个 LLM ensemble 可以消除单一模型的偏见' },
              { key: '3', decision: '为什么阈值是 85% 而非 50%？', reason: '50% 太敏感，会把大量正常 token 误标。85% 是「绝大多数续写都危险」才算' },
              { key: '4', decision: '为什么需要 Judge 复核？', reason: 'Rollout 评估的是「未来的可能性」而非「当前的安全性」。LLM 本身可能生成有害内容，不管前缀是什么。Judge 验证「前缀文本本身是否已经不安全」' },
              { key: '5', decision: '为什么 Judge 用 235B？', reason: 'Judge 需要极强的语义理解能力来判断模糊文本的安全性。235B 是 Qwen3 系列最大模型' },
              { key: '6', decision: '为什么双重确认而非单一阶段？', reason: '单用 rollout → 假阳性太多；单用 judge → 假阴性太多。双重确认取交集，精度最高' },
            ]}
            columns={[
              { title: '设计决策', dataIndex: 'decision', key: 'decision', width: 200, render: (v: string) => <span style={{ fontSize: 10, fontWeight: 700, color: '#722ed1' }}>{v}</span> },
              { title: '原因', dataIndex: 'reason', key: 'reason', render: (v: string) => <span style={{ fontSize: 10 }}>{v}</span> },
            ]}
          />

          {/* === 方法溯源 === */}
          <div style={{ fontWeight: 700, fontSize: 12, color: '#722ed1', marginBottom: 8 }}>方法溯源：从数学推理到安全检测</div>
          <div style={{ fontSize: 11, lineHeight: 2, color: '#444', marginBottom: 8 }}>
            <p>论文原文明确写了（Section 4.2）：</p>
            <div style={{ padding: 10, background: '#fafafa', borderRadius: 6, borderLeft: '4px solid #722ed1', fontStyle: 'italic', fontSize: 11, color: '#555', marginBottom: 8 }}>
              "<strong>Inspired by Zhang et al. (2025)</strong>, we design a method to automatically convert coarse, sample-level labels into the requisite token-level annotations."
            </div>
            <p>Zhang et al. (2025) 是 <em>"The Lessons of Developing Process Reward Models in Mathematical Reasoning"</em>——来自数学推理领域。</p>
          </div>

          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col span={12}>
              <div style={{ padding: 10, borderRadius: 6, background: '#e6f7ff', border: '1.5px solid #1890ff' }}>
                <div style={{ fontWeight: 700, color: '#1890ff', fontSize: 11, marginBottom: 4 }}>数学推理（PRM）</div>
                <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
                  <strong>问题：</strong>数学证明的每一步是否正确？<br/>
                  <strong>方法：</strong>在每个推理步骤截断 → rollout 续写 → 看最终答案是否正确 → 标注每步的 reward
                </div>
              </div>
            </Col>
            <Col span={12}>
              <div style={{ padding: 10, borderRadius: 6, background: '#f6ffed', border: '1.5px solid #52c41a' }}>
                <div style={{ fontWeight: 700, color: '#52c41a', fontSize: 11, marginBottom: 4 }}>安全检测（Stream）</div>
                <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
                  <strong>问题：</strong>回复的每个 token 是否危险？<br/>
                  <strong>方法：</strong>在每个 token 截断 → rollout 续写 → 用 Guard 模型评估安全性 → 标注每 token 的风险
                </div>
              </div>
            </Col>
          </Row>

          <div style={insightBox('#722ed1')}>
            <div style={{ fontWeight: 700, color: '#722ed1', fontSize: 11, marginBottom: 6 }}>
              <BulbOutlined /> Qwen3Guard 的两个创新
            </div>
            <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
              ① 把 rollout 方法从数学推理<strong>迁移到安全检测</strong>（跨领域迁移）<br/>
              ② 加了 <strong>LLM-as-Judge 二次验证</strong>——数学推理不需要这一步（答案对错是客观的），但安全性是主观的，需要复核
            </div>
          </div>

          {/* === 训练 Loss === */}
          <div style={{ fontWeight: 700, fontSize: 12, color: '#722ed1', marginBottom: 8, marginTop: 16 }}>标注好后的训练 Loss 设计</div>
          <Table
            size="small"
            pagination={false}
            style={{ marginBottom: 12 }}
            dataSource={[
              { key: '1', loss: 'Query Loss', where: '仅在 <|im_end|> token', desc: 'prompt 完整输入后一次性评估，只在最后一个 token 算 loss' },
              { key: '2', loss: 'Response Risk Loss', where: '每个 token', desc: '支持逐 token 实时检测，所有 token 都参与 risk level 的 loss 计算' },
              { key: '3', loss: 'Response Category Loss', where: '条件计算', desc: '仅当 ground-truth 为 unsafe/controversial 时才算 category loss' },
            ]}
            columns={[
              { title: 'Loss', dataIndex: 'loss', key: 'loss', width: 170, render: (v: string) => <span style={{ fontSize: 10, fontWeight: 700, color: '#722ed1' }}>{v}</span> },
              { title: '计算位置', dataIndex: 'where', key: 'where', width: 150, render: (v: string) => <Tag color="blue" style={{ fontSize: 9 }}>{v}</Tag> },
              { title: '说明', dataIndex: 'desc', key: 'desc', render: (v: string) => <span style={{ fontSize: 10 }}>{v}</span> },
            ]}
          />

          <div style={{ fontSize: 10, color: '#888', padding: 8, background: '#fffbe6', borderRadius: 4, borderLeft: '3px solid #faad14', marginBottom: 12 }}>
            <strong style={{ color: '#fa8c16' }}>Conditional Category Loss 的理由：</strong>如果一条回复是 safe 的，那它就没有风险类别，强行让它预测 category 会产生噪声。
            只在 unsafe/controversial 时计算 category loss，让模型聚焦安全相关内容。
          </div>

          {/* === 去抖 === */}
          <div style={{ fontWeight: 700, fontSize: 12, color: '#722ed1', marginBottom: 8 }}>推理时的去抖机制（Debouncing）</div>
          <div style={{ fontSize: 11, lineHeight: 2, color: '#444' }}>
            <p>训练好的模型在实际推理时还有一个防误报机制：</p>
            <div style={{ padding: 10, background: '#f9f0ff', borderRadius: 6, border: '1.5px solid #722ed1', marginBottom: 8, fontSize: 11, textAlign: 'center' }}>
              只有 token <em>i</em> <strong>和</strong> token <em>i-1</em> 都判为 unsafe/controversial 时，才从 token <em>i</em> 触发告警
            </div>
            <p style={{ fontSize: 10, color: '#555' }}>
              <strong>为什么需要去抖？</strong>Stream 模型在每个 token 上独立做分类，预测天然有噪声——可能某个 token 突然判为 unsafe，下一个 token 又变回 safe。
              如果每个单点误判都触发告警，用户体验会很差。去抖的效果：必须连续两个 token 都判 unsafe 才触发 → 大幅降低假阳性，代价是检测延迟增加 1 个 token。
            </p>
          </div>
        </div>
      </DPCard>

      {/* ============================================================ */}
      {/* 流式安全检测相关工作 */}
      {/* ============================================================ */}
      <DPCard title="  流式安全检测相关工作 — SCM & SentGuard" icon="🌊">
        <Alert type="info" banner showIcon style={{ marginBottom: 12 }}
          message="Qwen3Guard-Stream 并非流式安全检测的首创"
          description="「逐 token/逐句实时安全检测」在 2025 年已非常活跃。SCM（中科院，NeurIPS 2025）比 Qwen3Guard 早 4 个月；SentGuard（复旦/上海AI Lab，2026）提出了更实用的句子级方案。" />

        {/* === SCM === */}
        <div style={{ fontWeight: 700, fontSize: 13, color: '#1890ff', marginBottom: 10 }}>SCM — Streaming Content Monitor (NeurIPS 2025, 中科院)</div>
        <div style={{ fontSize: 11, lineHeight: 2, color: '#444', marginBottom: 12 }}>
          <p>
            <strong>论文：</strong><em>"From Judgment to Interference: Early Stopping LLM Harmful Outputs via Streaming Content Monitoring"</em>
            — <a href="https://arxiv.org/html/2506.09996v3" target="_blank" rel="noreferrer">arXiv:2506.09996</a> (Li et al., 2025.06)
          </p>
          <p>SCM 是最早系统解决「LLM 流式输出实时安全检测」的工作，比 Qwen3Guard-Stream（2025.10）<strong>早 4 个月</strong>。</p>
        </div>

        <div style={{ padding: 12, borderRadius: 8, background: '#e6f7ff', border: '2px solid #1890ff', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, color: '#1890ff', fontSize: 12, marginBottom: 8 }}>SCM 核心架构：Feature Extractor + Token Scorer + Holistic Scorer</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ padding: 10, borderRadius: 6, background: '#fff', border: '1.5px solid #1890ff' }}>
              <div style={{ fontWeight: 700, color: '#1890ff', fontSize: 11, marginBottom: 4 }}>Token Scorer (推理时使用)</div>
              <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
                <p><strong>输入：</strong>每个 token 的 hidden state h<sub>i</sub> = z(P, T<sub>&lt;i</sub>, t<sub>i</sub>)</p>
                <p><strong>输出：</strong>c<sub>t_i</sub> = P(y=1 | h<sub>i</sub>) — 该 token 对有害性的贡献分数</p>
                <p><strong>基座：</strong>Qwen2.5-0.5B/1.5B/7B（全参数微调）</p>
              </div>
            </div>
            <div style={{ padding: 10, borderRadius: 6, background: '#fff', border: '1.5px solid #722ed1' }}>
              <div style={{ fontWeight: 700, color: '#722ed1', fontSize: 11, marginBottom: 4 }}>Holistic Scorer (仅训练时使用)</div>
              <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
                <p><strong>输入：</strong>最后一个 token 的 hidden state（整体表示）</p>
                <p><strong>输出：</strong>c<sub>hol</sub> = P(y=1 | 完整回复)</p>
                <p><strong>作用：</strong>注入「全局视野」和「未来预测」能力，推理时丢弃</p>
              </div>
            </div>
          </div>
        </div>

        <div style={{ fontWeight: 700, fontSize: 12, color: '#722ed1', marginBottom: 8 }}>SCM 的三个关键创新</div>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          {[
            {
              title: '① 层次一致性学习',
              desc: 'L = α·L_tok + (1-α)·L_hol + β·L_logic。逻辑约束：如果 holistic scorer 判整体有害，至少一个 token 必须被判有害。用命题逻辑 F = f_hol(h_n) ⇒ g({f_tok(h_i)}) 构建 loss，g 用 max-pooling',
              color: '#1890ff', bg: '#e6f7ff',
            },
            {
              title: '② Delay-k 检测',
              desc: '累计 ≥k 个有害 token 才触发拦截（而非 1 个就触发）。k 越大，FAR 越低但 MAR 越高。允许按场景调整严格度：儿童内容用小 k（宁可误拦），客服用大 k（减少误拦）',
              color: '#52c41a', bg: '#f6ffed',
            },
            {
              title: '③ POS 启发式标注',
              desc: 'token 级标注难题：用词性标注 (POS) 过滤虚词（介词、连词等），只标实词（名词、动词、形容词）为有害。比 likelihood difference 法和 LLM 标注法更可靠',
              color: '#fa8c16', bg: '#fff7e6',
            },
          ].map((item, idx) => (
            <Col span={8} key={idx}>
              <div style={{ padding: 10, borderRadius: 6, background: item.bg, border: `1.5px solid ${item.color}`, height: '100%' }}>
                <div style={{ fontWeight: 700, color: item.color, fontSize: 11, marginBottom: 4 }}>{item.title}</div>
                <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>{item.desc}</div>
              </div>
            </Col>
          ))}
        </Row>

        <div style={insightBox('#1890ff')}>
          <div style={{ fontWeight: 700, color: '#1890ff', fontSize: 11, marginBottom: 6 }}>
            <BulbOutlined /> SCM 核心结果
          </div>
          <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
            <strong>及时性：</strong>约 50% 有害回复在前 10% token 内检测，80%+ 在前 30% 内检测（平均 18%）<br/>
            <strong>延迟：</strong>检测延迟 &lt; 生成延迟（t_det &lt; t_gen），1 个 token 延迟即可并行，不影响用户体验<br/>
            <strong>FineHarm 数据集：</strong>29K prompt-response 对，带细粒度 token 级标签
          </div>
        </div>

        {/* === SentGuard === */}
        <div style={{ fontWeight: 700, fontSize: 13, color: '#52c41a', marginBottom: 10, marginTop: 20 }}>SentGuard — Sentence-Level Streaming Guardrails (复旦/上海AI Lab, 2026)</div>
        <div style={{ fontSize: 11, lineHeight: 2, color: '#444', marginBottom: 12 }}>
          <p>
            <strong>论文：</strong><em>"SentGuard: Sentence-Level Streaming Guardrails for Large Language Models"</em>
            — <a href="https://arxiv.org/html/2606.02041v1" target="_blank" rel="noreferrer">arXiv:2606.02041</a> (Yu et al., 2026.06)
          </p>
          <p>SentGuard 提出了一个更实用的折中粒度：<strong>句子级</strong>流式检测——比 token 级粗（语义更完整），比 response 级细（检测更早）。</p>
        </div>

        <div style={{ padding: 12, borderRadius: 8, background: '#f6ffed', border: '2px solid #52c41a', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, color: '#52c41a', fontSize: 12, marginBottom: 8 }}>SentGuard 三种粒度对比</div>
          <Row gutter={[12, 12]}>
            {[
              { level: 'Response 级', desc: '生成完毕后才检测。语义完整但用户已看到有害内容', color: '#ff4d4f', border: '#ff4d4f' },
              { level: 'Sentence 级 (SentGuard)', desc: '每完成一个句子就检测。语义足够完整 + 检测足够早', color: '#52c41a', border: '#52c41a' },
              { level: 'Token 级 (Qwen3Guard/SCM)', desc: '每个 token 检测。最及时但语义碎片化，频繁调用 guard，决策不稳定', color: '#1890ff', border: '#1890ff' },
            ].map((item, idx) => (
              <Col span={8} key={idx}>
                <div style={{ padding: 10, borderRadius: 6, background: `${item.color}08`, border: `2px solid ${item.border}`, textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, color: item.color, fontSize: 11, marginBottom: 4 }}>{item.level}</div>
                  <div style={{ fontSize: 9, color: '#555', lineHeight: 1.7 }}>{item.desc}</div>
                </div>
              </Col>
            ))}
          </Row>
        </div>

        <div style={{ fontWeight: 700, fontSize: 12, color: '#722ed1', marginBottom: 8 }}>SentGuard 的核心设计</div>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          {[
            {
              title: '① 句子边界检测',
              desc: 'τᵢ = inf{t > τᵢ₋₁: b(y≤t) = 1 or t = T}。基于标点符号检测句子边界，每个边界点触发一次 guard 评估',
              color: '#52c41a', bg: '#f6ffed',
            },
            {
              title: '② Coarse-to-Fine 训练',
              desc: '两阶段 SFT：先用完整对话学基本判断能力，再用句子前缀监督学「何时首次触发」。采样策略集中在 unsafe 证据最早出现的句子附近',
              color: '#1890ff', bg: '#e6f7ff',
            },
            {
              title: '③ 三状态分类',
              desc: '输出 Safe / Uncertain / Unsafe 三种状态。Uncertain 支持灵活部署：可触发继续监控或早期干预。StreamSafe 数据集 62K 条，含 8 类风险标注',
              color: '#722ed1', bg: '#f9f0ff',
            },
          ].map((item, idx) => (
            <Col span={8} key={idx}>
              <div style={{ padding: 10, borderRadius: 6, background: item.bg, border: `1.5px solid ${item.color}`, height: '100%' }}>
                <div style={{ fontWeight: 700, color: item.color, fontSize: 11, marginBottom: 4 }}>{item.title}</div>
                <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>{item.desc}</div>
              </div>
            </Col>
          ))}
        </Row>

        <div style={insightBox('#52c41a')}>
          <div style={{ fontWeight: 700, color: '#52c41a', fontSize: 11, marginBottom: 6 }}>
            <BulbOutlined /> SentGuard 核心结果
          </div>
          <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
            <strong>及时性：</strong>90.5% 不安全内容在 <strong>2 句话内</strong>被检测，FPR 仅 7.41%<br/>
            <strong>F1：</strong>5 个 benchmark 平均 88.3%，超过 Qwen3Guard-8B-Stream<br/>
            <strong>对比 Gemini/GPT：</strong>在 WildGuardTest 上 Det@1 = 83.45%（vs Gemini 18.38%、GPT-5.5 23.36%），优势碾压级
          </div>
        </div>

        {/* === SCM vs SentGuard vs Qwen3Guard 三方对比 === */}
        <div style={{ fontWeight: 700, fontSize: 12, color: '#722ed1', marginBottom: 8, marginTop: 16 }}>三方核心设计对比</div>
        <Table
          size="small"
          pagination={false}
          style={{ marginBottom: 16 }}
          dataSource={[
            { key: '1', dim: '检测粒度', scm: 'Token 级（每个 token 评分）', sent: 'Sentence 级（句子边界触发）', qg: 'Token 级（每个 token 分类）' },
            { key: '2', dim: 'Token 标注获取', scm: 'POS 启发式：词性过滤 + 标实词为有害', sent: '无需 token 标注（句子级标注）', qg: 'Rollout + Judge 双重确认' },
            { key: '3', dim: '训练架构', scm: 'Token Scorer + Holistic Scorer（推理丢弃后者）', sent: 'Full-context SFT + Coarse-to-Fine 前缀 SFT', qg: 'Backbone LoRA + 4-Head 分类' },
            { key: '4', dim: '全局感知方式', scm: 'Holistic Scorer + 命题逻辑约束', sent: 'Full-context 阶段学完整语义 + 前缀阶段学早期触发', qg: 'Conditional Category Loss' },
            { key: '5', dim: '触发/去抖机制', scm: 'Delay-k：累计 ≥k 个有害 token 才拦截', sent: '句子边界自然去抖，无需额外机制', qg: 'Debouncing：连续 2 token unsafe 才触发' },
            { key: '6', dim: '基座模型', scm: 'Qwen2.5-0.5B/1.5B/7B（全参数）', sent: '未公开规模', qg: 'Qwen3-0.6B/4B/8B-Base（LoRA）' },
            { key: '7', dim: '类别检测', scm: '仅二分类 (safe/unsafe)', sent: '三状态 (safe/uncertain/unsafe) + 8 类', qg: '3 分类 Risk + 11 类 Category' },
            { key: '8', dim: '时间', scm: '2025.06（最早）', sent: '2026.06（最新）', qg: '2025.10' },
          ]}
          columns={[
            { title: '维度', dataIndex: 'dim', key: 'dim', width: 100, render: (v: string) => <span style={{ fontSize: 9, fontWeight: 700, color: '#722ed1' }}>{v}</span> },
            { title: 'SCM (中科院)', dataIndex: 'scm', key: 'scm', render: (v: string) => <span style={{ fontSize: 9, color: '#1890ff' }}>{v}</span> },
            { title: 'SentGuard (复旦)', dataIndex: 'sent', key: 'sent', render: (v: string) => <span style={{ fontSize: 9, color: '#52c41a' }}>{v}</span> },
            { title: 'Qwen3Guard-Stream', dataIndex: 'qg', key: 'qg', render: (v: string) => <span style={{ fontSize: 9, color: '#fa8c16' }}>{v}</span> },
          ]}
        />

        {/* === 核心洞察 === */}
        <div style={insightBox('#722ed1')}>
          <div style={{ fontWeight: 700, color: '#722ed1', fontSize: 11, marginBottom: 6 }}>
            <BulbOutlined /> 流式安全检测的核心难题：token 级标注的获取
          </div>
          <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
            现有安全数据集只有整条回复的标签（safe/unsafe），但流式检测需要知道「从第几个 token/句子开始变 unsafe」。<br/>
            • <strong>SCM</strong>：POS 词性过滤——简单直接，但标注质量受限于 POS tagger 精度<br/>
            • <strong>SentGuard</strong>：绕开 token 标注——直接用句子级标注 + Coarse-to-Fine 训练<br/>
            • <strong>Qwen3Guard</strong>：Rollout + Judge——最精确但最贵（需多 LLM 续写 + 235B 复核）
          </div>
        </div>
      </DPCard>

      {/* ============================================================ */}
      {/* 损失函数深度分析 */}
      {/* ============================================================ */}
      <DPCard title="  损失函数设计 — 两个架构的精髓差异" icon="🎯">
        <Alert type="warning" banner showIcon style={{ marginBottom: 12 }}
          message="为什么损失函数设计是精髓？"
          description="Gen 和 Stream 表面上看只是「生成文本 vs 分类头」的区别，但损失函数设计决定了它们各自能学到什么、不能学到什么。两者的损失函数从目标、计算位置、条件机制到优化策略都完全不同。" />

        {/* === Gen 损失函数 === */}
        <div style={{ fontWeight: 700, fontSize: 13, color: '#ff4d4f', marginBottom: 10 }}>Gen：标准 SFT 的 Next-Token Prediction Loss</div>

        <div style={{ fontSize: 11, lineHeight: 2, color: '#444', marginBottom: 12 }}>
          <p>
            Gen 架构本质上就是标准的指令跟随微调——模型看到安全审查指令 + 对话内容，生成结构化分类文本。
            它的损失函数就是标准 CausalLM 的 <strong>next-token prediction cross-entropy loss</strong>，没有任何特殊设计。
          </p>
        </div>

        <div style={{ padding: 12, borderRadius: 8, background: '#fff1f0', border: '2px solid #ff4d4f', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, color: '#ff4d4f', fontSize: 12, marginBottom: 6 }}>
            Gen 的 Loss 公式（标准 CausalLM）
          </div>
          <div style={{ fontSize: 12, fontFamily: 'monospace', textAlign: 'center', padding: 10, background: '#fff', borderRadius: 4 }}>
            L<sub>Gen</sub> = -Σ<sub>t</sub> log P(y<sub>t</sub> | y<sub>&lt;t</sub>, x)
          </div>
          <div style={{ fontSize: 10, color: '#666', marginTop: 8, lineHeight: 1.8 }}>
            其中 x = 指令 + 安全策略 + 对话上下文，y = 生成的分类文本（如 "Safety: Unsafe\nCategories: Violent\nRefusal: No"）
          </div>
        </div>

        <div style={{ fontWeight: 700, fontSize: 11, color: '#333', marginBottom: 6 }}>Gen 损失函数的关键特点</div>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          {[
            { title: '所有 token 等权', desc: '指令部分的 token 和分类输出部分的 token 都参与 loss 计算（虽然实践中通常 mask 掉指令部分）。模型需要学会生成正确的格式化文本', color: '#ff4d4f', bg: '#fff2f0' },
            { title: '多任务统一在一个序列里', desc: 'Severity + Category + Refusal 三个任务被编码在同一个输出序列中，模型通过自回归的方式一步步生成，loss 在整个序列上计算', color: '#fa8c16', bg: '#fff7e6' },
            { title: '隐式的条件依赖', desc: '模型生成 Category 时已经「看到」了自己生成的 Severity。如果 Severity 判错了，后面的 Category 也会跟着错——这是自回归架构的固有问题', color: '#722ed1', bg: '#f9f0ff' },
          ].map((item, idx) => (
            <Col span={8} key={idx}>
              <div style={{ padding: 10, borderRadius: 6, background: item.bg, border: `1.5px solid ${item.color}`, height: '100%' }}>
                <div style={{ fontWeight: 700, color: item.color, fontSize: 11, marginBottom: 4 }}>{item.title}</div>
                <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>{item.desc}</div>
              </div>
            </Col>
          ))}
        </Row>

        {/* === Stream 损失函数 === */}
        <div style={{ fontWeight: 700, fontSize: 13, color: '#52c41a', marginBottom: 10 }}>Stream：精心设计的多组件 Loss</div>

        <div style={{ fontSize: 11, lineHeight: 2, color: '#444', marginBottom: 12 }}>
          <p>
            Stream 的损失函数是整个架构中最精妙的部分。它不是简单的 cross-entropy，而是由<strong>四个组件</strong>精心组合而成，
            每个组件解决一个特定的问题。
          </p>
        </div>

        <div style={{ padding: 12, borderRadius: 8, background: '#f6ffed', border: '2px solid #52c41a', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, color: '#52c41a', fontSize: 12, marginBottom: 6 }}>
            Stream 的总 Loss 公式
          </div>
          <div style={{ fontSize: 12, fontFamily: 'monospace', textAlign: 'center', padding: 10, background: '#fff', borderRadius: 4 }}>
            L<sub>Stream</sub> = L<sub>q-risk</sub> + L<sub>q-cat</sub> + (1/T) Σ<sub>t=1..T</sub> [ L<sub>r-risk</sub><sup>(t)</sup> + L<sub>r-cat</sub><sup>(t)</sup> ]
          </div>
          <div style={{ fontSize: 10, color: '#666', marginTop: 8, lineHeight: 1.8, textAlign: 'center' }}>
            q = query (prompt)，r = response，risk = 风险级别，cat = 风险类别，t = 第 t 个 token
          </div>
        </div>

        <div style={{ fontWeight: 700, fontSize: 12, color: '#722ed1', marginBottom: 8 }}>四个 Loss 组件逐一拆解</div>

        {/* 组件1: Query Risk Loss */}
        <div style={{ padding: 12, borderRadius: 8, background: '#e6f7ff', border: '1.5px solid #1890ff', marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, color: '#1890ff', fontSize: 12 }}>① Query Risk Loss — L<sub>q-risk</sub></span>
            <Tag color="blue" style={{ fontSize: 9 }}>仅在最后一个 token 计算</Tag>
          </div>
          <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
            <p><strong>计算位置：</strong>仅在 <code>{`<|im_end|>`}</code> token（即 prompt 的最后一个 token）</p>
            <p><strong>为什么只在最后一个 token？</strong>用户输入是一个完整的序列，不需要逐 token 检测。模型需要看完整个 prompt 后才能做出判断——就像人需要看完一整句话才能判断是否安全。</p>
            <p><strong>直觉：</strong>backbone 的 transformer 在最后一个 token 的 hidden state 中已经编码了整个序列的信息，所以只需要在这里做一次分类。</p>
          </div>
        </div>

        {/* 组件2: Query Category Loss */}
        <div style={{ padding: 12, borderRadius: 8, background: '#f9f0ff', border: '1.5px solid #722ed1', marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, color: '#722ed1', fontSize: 12 }}>② Query Category Loss — L<sub>q-cat</sub></span>
            <Tag color="purple" style={{ fontSize: 9 }}>条件计算 ⚠️</Tag>
          </div>
          <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
            <p><strong>计算位置：</strong>同 Query Risk Loss，仅在最后一个 token</p>
            <p><strong>条件机制：</strong>仅当 ground-truth risk level 为 <strong>unsafe 或 controversial</strong> 时才计算。如果 risk level 是 safe，<strong>category loss = 0</strong>，直接跳过。</p>
            <p><strong>为什么这样设计？</strong>如果一条内容是 safe 的，它就没有风险类别。强行让模型预测「这条安全内容属于 9 类风险中的哪一类」会产生噪声，干扰模型学习。</p>
          </div>
        </div>

        {/* 组件3: Response Risk Loss */}
        <div style={{ padding: 12, borderRadius: 8, background: '#f6ffed', border: '1.5px solid #52c41a', marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, color: '#52c41a', fontSize: 12 }}>③ Response Risk Loss — (1/T) Σ L<sub>r-risk</sub><sup>(t)</sup></span>
            <Tag color="green" style={{ fontSize: 9 }}>每个 token 都计算 🔑</Tag>
          </div>
          <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
            <p><strong>计算位置：</strong><strong style={{ color: '#ff4d4f' }}>每一个</strong> generated token——这是 Stream 能实现实时检测的核心。</p>
            <p><strong>公式细节：</strong>(1/T) Σ<sub>t=1..T</sub> CE(r-risk<sup>(t)</sup>, label<sup>(t)</sup>)——对所有 T 个 token 的 loss 取平均。</p>
            <p><strong>这意味着什么？</strong>在训练时，模型在每个 token 位置都被要求判断「到目前为止是否安全」。如果第 8 个 token 是边界（从 safe 变成 unsafe），那么 token 1-7 的 label 是 safe，token 8-T 的 label 是 unsafe。模型必须学会在 token 8 的位置突然「警觉」起来。</p>
            <p><strong>与 Gen 的根本区别：</strong>Gen 只在生成完整分类文本时算一次 loss；Stream 在每个 token 位置都算 loss，所以 Stream 天然支持流式推理——推理时每个 token 的 forward pass 就已经在输出分类结果了。</p>
          </div>
        </div>

        {/* 组件4: Response Category Loss */}
        <div style={{ padding: 12, borderRadius: 8, background: '#fff7e6', border: '1.5px solid #fa8c16', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, color: '#fa8c16', fontSize: 12 }}>④ Response Category Loss — (1/T) Σ L<sub>r-cat</sub><sup>(t)</sup></span>
            <Tag color="orange" style={{ fontSize: 9 }}>条件计算 + 逐 token ⚠️</Tag>
          </div>
          <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
            <p><strong>计算位置：</strong>每个 token（同 Response Risk Loss）</p>
            <p><strong>条件机制：</strong>同 Query Category Loss——仅当 risk level 为 unsafe/controversial 时才计算。</p>
            <p><strong>双重条件叠加：</strong>这是整个 Loss 中最「挑剔」的组件——既要 risk level 不是 safe（条件 1），又要是在 response 流中的每个 token（条件 2）。</p>
            <p><strong>为什么 category 也需要逐 token？</strong>因为 Stream 在实时推理时，每个 token 不仅输出 risk level，还输出 category。模型需要在检测到 unsafe 的<strong>同一时刻</strong>就知道是哪个类别——不能等回复生成完再判断类别。</p>
          </div>
        </div>

        {/* === 核心对比 === */}
        <div style={{ fontWeight: 700, fontSize: 13, color: '#722ed1', marginBottom: 10 }}>Gen vs Stream 损失函数的核心差异</div>

        <Table
          size="small"
          pagination={false}
          style={{ marginBottom: 16 }}
          dataSource={[
            { key: '1', dim: 'Loss 本质', gen: 'Next-token prediction（语言建模）', stream: 'Classification cross-entropy（分类）' },
            { key: '2', dim: '计算位置', gen: '输出序列的所有 token', stream: 'Query: 仅最后 1 个 token; Response: 每个 token' },
            { key: '3', dim: '条件机制', gen: '无——所有输出 token 等权参与', stream: '有——category loss 仅在 unsafe/controversial 时计算' },
            { key: '4', dim: '多任务方式', gen: '隐式：通过自回归序列编码（Severity→Category→Refusal）', stream: '显式：risk head 和 category head 独立 loss，联合优化' },
            { key: '5', dim: '错误传播', gen: '有——Severity 判错会导致后续 Category/Refusal 跟着错', stream: '无——两个 head 独立，互不影响' },
            { key: '6', dim: '与推理方式的关系', gen: '训练时算 loss 的 token = 推理时生成的 token', stream: '训练时每个 token 都算 loss = 推理时每个 token 都能输出结果' },
          ]}
          columns={[
            { title: '维度', dataIndex: 'dim', key: 'dim', width: 130, render: (v: string) => <span style={{ fontSize: 10, fontWeight: 700, color: '#722ed1' }}>{v}</span> },
            { title: 'Gen（CausalLM SFT）', dataIndex: 'gen', key: 'gen', render: (v: string) => <span style={{ fontSize: 10, color: '#ff4d4f' }}>{v}</span> },
            { title: 'Stream（Dual Heads）', dataIndex: 'stream', key: 'stream', render: (v: string) => <span style={{ fontSize: 10, color: '#52c41a' }}>{v}</span> },
          ]}
        />

        {/* === Conditional Category Loss 深度分析 === */}
        <div style={{ fontWeight: 700, fontSize: 12, color: '#722ed1', marginBottom: 8 }}>Conditional Category Loss — 最精妙的设计</div>

        <div style={insightBox('#fa8c16')}>
          <div style={{ fontWeight: 700, color: '#fa8c16', fontSize: 11, marginBottom: 6 }}>
            <BulbOutlined /> 为什么这是最精妙的设计？
          </div>
          <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
            Conditional Category Loss 体现了对安全分类任务本质的深刻理解：<strong>风险类别是风险级别的「附属信息」</strong>。
            如果一条内容根本不安全，讨论它「属于哪种不安全」毫无意义。这个条件机制做了三件事：
          </div>
        </div>

        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          {[
            { title: '① 消除噪声梯度', desc: '如果 safe 样本也算 category loss，模型被迫学习「safe 内容属于哪类风险」——这是个伪命题，会产生噪声梯度，干扰模型学习真正的风险分类边界', color: '#ff4d4f', bg: '#fff2f0' },
            { title: '② 聚焦学习能力', desc: '模型的容量是有限的。把 category loss 限制在 unsafe/controversial 样本上，等于告诉模型：「你只需要在检测到危险时才去细分风险类别，safe 样本不用管类别」', color: '#1890ff', bg: '#e6f7ff' },
            { title: '③ 避免类别预测退化', desc: '如果不加条件，safe 样本占比 ~50%，模型会学到「大多数情况下预测某个默认类别（如 None）」的捷径。条件机制让 category head 只看到真正需要分类的样本', color: '#52c41a', bg: '#f6ffed' },
          ].map((item, idx) => (
            <Col span={8} key={idx}>
              <div style={{ padding: 10, borderRadius: 6, background: item.bg, border: `1.5px solid ${item.color}`, height: '100%' }}>
                <div style={{ fontWeight: 700, color: item.color, fontSize: 11, marginBottom: 4 }}>{item.title}</div>
                <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>{item.desc}</div>
              </div>
            </Col>
          ))}
        </Row>

        {/* === Response Loss 的 1/T 归一化 === */}
        <div style={{ fontWeight: 700, fontSize: 12, color: '#722ed1', marginBottom: 8 }}>Response Loss 的 (1/T) 归一化 — 为什么要取平均？</div>

        <div style={{ fontSize: 11, lineHeight: 2, color: '#444', marginBottom: 12 }}>
          <p>
            Response Loss 对所有 T 个 token 取平均 <code>(1/T) Σ</code>，而不是求和 <code>Σ</code>。
            这不是随意的工程选择，而是有深刻原因：
          </p>
        </div>

        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col span={12}>
            <div style={{ padding: 10, borderRadius: 6, background: '#fff2f0', border: '1.5px solid #ff4d4f' }}>
              <div style={{ fontWeight: 700, color: '#ff4d4f', fontSize: 11, marginBottom: 4 }}>如果求和（不取平均）</div>
              <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
                长回复的 loss 天然比短回复大得多。一个 1000 token 的回复 loss 是 10 token 回复的 100 倍。
                模型会被长回复主导训练方向，短回复的学习信号被淹没。
              </div>
            </div>
          </Col>
          <Col span={12}>
            <div style={{ padding: 10, borderRadius: 6, background: '#f6ffed', border: '1.5px solid #52c41a' }}>
              <div style={{ fontWeight: 700, color: '#52c41a', fontSize: 11, marginBottom: 4 }}>取平均（当前设计）</div>
              <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
                每条回复的 response loss 被归一化到「per-token」级别，不同长度的回复对训练的贡献更均衡。
                模型不会因为一条超长回复而忽略大量短回复的学习信号。
              </div>
            </div>
          </Col>
        </Row>

        {/* === 训练信号传递图 === */}
        <div style={{ fontWeight: 700, fontSize: 12, color: '#722ed1', marginBottom: 8 }}>训练信号的传递方式对比</div>

        <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8, marginBottom: 8 }}>
          用一个 unsafe 回复的例子，看 Gen 和 Stream 的训练信号有什么不同：
        </div>

        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col span={12}>
            <div style={{ padding: 12, borderRadius: 8, background: '#fff1f0', border: '2px solid #ff4d4f' }}>
              <div style={{ fontWeight: 700, color: '#ff4d4f', fontSize: 11, marginBottom: 6 }}>
                Gen 的训练信号
              </div>
              <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
                <p><strong>输入：</strong>指令 + 对话内容</p>
                <p><strong>目标输出：</strong>"Safety: Unsafe\nCategories: Violent\nRefusal: No"</p>
                <p><strong>Loss：</strong>模型需要学会<strong>生成这段文本</strong>——包括格式（换行、冒号）、关键词（Safety/Categories/Refusal）和值（Unsafe/Violent/No）</p>
                <p><strong>问题：</strong>模型可能在格式上出错（如生成 "unsafe" 而非 "Unsafe"），导致解析失败。这是 Gen 的固有风险。</p>
              </div>
            </div>
          </Col>
          <Col span={12}>
            <div style={{ padding: 12, borderRadius: 8, background: '#f6ffed', border: '2px solid #52c41a' }}>
              <div style={{ fontWeight: 700, color: '#52c41a', fontSize: 11, marginBottom: 6 }}>
                Stream 的训练信号
              </div>
              <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
                <p><strong>输入：</strong>对话的每个 token 的 hidden state</p>
                <p><strong>目标输出：</strong>每个 token 位置的 [risk_level, category] 分类标签</p>
                <p><strong>Loss：</strong>risk head 和 category head 各自独立的 cross-entropy，在每个 token 位置计算</p>
                <p><strong>优势：</strong>不存在格式错误问题——分类头输出的是固定维度的向量，经过 softmax 就是概率分布。100% 有效输出。</p>
              </div>
            </div>
          </Col>
        </Row>

        {/* === 总结 === */}
        <div style={insightBox('#722ed1')}>
          <div style={{ fontWeight: 700, color: '#722ed1', fontSize: 11, marginBottom: 6 }}>
            <BulbOutlined /> 损失函数设计的本质洞察
          </div>
          <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
            <p>
              <strong>Gen 的损失函数简单但脆弱：</strong>标准 next-token prediction，依赖模型学会生成正确的格式化文本。
              优点是灵活（可以加 Refusal 等新字段），缺点是可能有格式错误和错误传播。
            </p>
            <p>
              <strong>Stream 的损失函数复杂但精确：</strong>四个组件各司其职——Query 只看最后一个 token（完整性判断），
              Response 看每个 token（实时性保证），Conditional Category 只在需要时激活（效率优化），
              1/T 归一化消除长度偏差（公平训练）。每个设计决策都有明确的工程动机。
            </p>
            <p style={{ marginTop: 6, padding: 6, background: '#f9f0ff', borderRadius: 4 }}>
              <strong>一句话总结：</strong>Gen 的损失函数让模型学会「写安全报告」，Stream 的损失函数让模型学会「在每个位置做安全判断」。
              前者是语言建模问题，后者是序列标注问题。
            </p>
          </div>
        </div>
      </DPCard>

      {/* 参考文献 */}
      <Alert type="success" banner showIcon style={{ marginTop: 8 }}
        message="参考文献"
        description={
          <div style={{ fontSize: 11, lineHeight: 2 }}>
            <p style={{ margin: 0 }}>
              <strong>原论文：</strong>Qwen3Guard Technical Report — <a href="https://arxiv.org/abs/2510.14276" target="_blank" rel="noreferrer">arXiv:2510.14276</a> (Zhao et al., 2025)
            </p>
            <p style={{ margin: 0 }}><strong>官方博客：</strong><a href="https://qwenlm.github.io/blog/qwen3guard/" target="_blank" rel="noreferrer">Qwen3Guard: Real-time Safety for Your Token Stream</a></p>
            <p style={{ margin: 0 }}><strong>前身工作：</strong></p>
            <p style={{ margin: '0 0 0 16px' }}>ShieldLM — Zhang et al. (2024) — controversial 概念的首次提出</p>
            <p style={{ margin: '0 0 0 16px' }}>ShieldGemma — Zeng et al. (2024) — 动态阈值方法</p>
            <p style={{ margin: '0 0 0 16px' }}>Co-Training — Blum & Mitchell (1998) — 交叉训练范式</p>
            <p style={{ margin: '0 0 0 16px' }}>Knowledge Distillation — Hinton et al. (2015) — 知识蒸馏</p>
            <p style={{ margin: '0 0 0 16px' }}>Process Reward Models — Zhang et al. (2025) — rollout 标注方法</p>
            <p style={{ margin: 0 }}><strong>流式安全检测相关工作：</strong></p>
            <p style={{ margin: '0 0 0 16px' }}>SCM — Li et al. (2025) — <a href="https://arxiv.org/html/2506.09996v3" target="_blank" rel="noreferrer">arXiv:2506.09996</a> — 最早的系统性流式安全检测 (NeurIPS 2025)</p>
            <p style={{ margin: '0 0 0 16px' }}>SentGuard — Yu et al. (2026) — <a href="https://arxiv.org/html/2606.02041v1" target="_blank" rel="noreferrer">arXiv:2606.02041</a> — 句子级流式 Guardrail (复旦/上海AI Lab)</p>
          </div>
        } />
    </div>
  )
}
