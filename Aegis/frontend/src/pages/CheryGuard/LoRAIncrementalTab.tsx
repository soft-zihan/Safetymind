import { Card, Table, Tag, Row, Col, Alert } from 'antd'

export default function LoRAIncrementalTab() {
  return (
    <div>
      <Alert type="info" banner showIcon style={{ marginBottom: 16 }}
        message="LoRA 增量训练 — 学新不忘旧"
        description="安全分类器需要持续更新：新攻击模式出现、新安全类别定义、场景策略变更。如何在已有模型上增量训练，而不破坏已学到的知识？" />

      {/* ====== 核心矛盾 ====== */}
      <Card size="small" style={{ marginBottom: 16, borderLeft: '4px solid #ff4d4f' }}
        title={<span style={{ fontSize: 12 }}>🔥 核心矛盾：Stability-Plasticity Trade-off</span>}>
        <Row gutter={[16, 8]}>
          <Col span={12}>
            <Card size="small" style={{ background: '#f6ffed', border: '1.5px solid #52c41a' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#52c41a', marginBottom: 4 }}>🧠 Stability（稳定性）</div>
              <div style={{ fontSize: 10, color: '#555', lineHeight: 1.7 }}>
                学新任务时，不能遗忘旧任务的知识。在安全分类中，这意味着：新增一个类别后，不能把之前训练好的"暴力检测"能力搞丢。
              </div>
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small" style={{ background: '#e6f7ff', border: '1.5px solid #1890ff' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1890ff', marginBottom: 4 }}>🔧 Plasticity（可塑性）</div>
              <div style={{ fontSize: 10, color: '#555', lineHeight: 1.7 }}>
                必须有足够的能力学习新任务。不能因为"保护旧知识"而让新任务学不进去。在安全分类中：新攻击模式必须能学会识别。
              </div>
            </Card>
          </Col>
        </Row>
      </Card>

      {/* ====== 三大方案对比 ====== */}
      <Card size="small" style={{ marginBottom: 16 }}
        title={<span style={{ fontSize: 12 }}>📊 三大方案全景对比</span>}>
        <Table
          dataSource={[
            { key: '1', approach: '单 LoRA 顺序增量', problem: '一个 LoRA 学完所有任务，不遗忘', keywords: 'Continual Learning', best: 'C-LoRA / Janus-LoRA', complexity: '⭐⭐⭐⭐', suitability: '任务数多、存储受限' },
            { key: '2', approach: '多 LoRA 并行组合', problem: '每个任务一个 LoRA，推理时合并', keywords: 'Adapter Composition', best: 'TIES-Merging', complexity: '⭐⭐', suitability: '任务数少、快速迭代' },
            { key: '3', approach: '动态路由多 LoRA', problem: '多个 LoRA 同时存在，路由器动态选择', keywords: 'MoE-style', best: 'C-LoRA 路由 / LoRAX', complexity: '⭐⭐⭐⭐⭐', suitability: '大规模部署、数百任务' },
          ]}
          columns={[
            { title: '方案', dataIndex: 'approach', key: 'approach', width: 140, render: (v: string) => <span style={{ fontWeight: 700, fontSize: 11 }}>{v}</span> },
            { title: '核心思路', dataIndex: 'problem', key: 'problem', width: 180, render: (v: string) => <span style={{ fontSize: 10 }}>{v}</span> },
            { title: '领域', dataIndex: 'keywords', key: 'kw', width: 120, render: (v: string) => <Tag color="blue">{v}</Tag> },
            { title: '代表作', dataIndex: 'best', key: 'best', width: 150, render: (v: string) => <Tag color="purple">{v}</Tag> },
            { title: '复杂度', dataIndex: 'complexity', key: 'cx', width: 80 },
            { title: '适合场景', dataIndex: 'suitability', key: 'suit', width: 160, render: (v: string) => <span style={{ fontSize: 10 }}>{v}</span> },
          ]}
          pagination={false} size="small"
        />
      </Card>

      {/* ====== 方案一：单 LoRA 顺序增量 ====== */}
      <Card size="small" style={{ marginBottom: 16 }}
        title={<span style={{ fontSize: 12 }}>🔗 方案一：单 LoRA 顺序增量（Continual Learning）</span>}>
        <div style={{ fontSize: 11, lineHeight: 1.9, color: '#444' }}>
          <p style={{ marginBottom: 8 }}>
            <strong style={{ color: '#722ed1' }}>核心问题：</strong>
            如果只有一个 LoRA 模块，任务 A 训练完后，再用任务 B 的数据训练同一个 LoRA，B 会覆盖 A 的知识。
            能不能<strong>一个 LoRA 学完所有任务，不遗忘</strong>？
          </p>
        </div>
        <Row gutter={[12, 12]}>
          {[
            {
              name: 'C-LoRA', src: 'arXiv:2502.17920', tag: '路由矩阵', icon: '🧭', color: '#722ed1',
              desc: '在 LoRA 中嵌入一个 r×r 的可学习路由矩阵 R。R 的每个元素控制不同子空间的激活程度。新任务训练时，R 动态调整子空间分配，通过正交约束确保新任务不干扰旧任务子空间。',
              key_idea: '一个 LoRA 替代多个 LoRA——路由矩阵 R 在子空间内划分任务区域',
              device: '单 LoRA'
            },
            {
              name: 'Janus-LoRA', src: 'ICML 2026', tag: '梯度矫正', icon: '🔬', color: '#ff4d4f',
              desc: 'ICML 2026 最新 SOTA。用闭式解（closed-form solution）在反向传播时直接修正梯度方向，使其不侵入旧知识区域。同时用解耦间隔损失（Decoupled Margin Loss）在特征层面推新任务表示远离旧任务。',
              key_idea: '理论最优的 stability-plasticity 平衡——参数层正交 + 特征层分离',
              device: '单 LoRA'
            },
            {
              name: 'Merge before Forget', src: 'ICLR 2026', tag: '顺序合并', icon: '🔗', color: '#1890ff',
              desc: '每学一个新任务：正交初始化新 LoRA → 训练 → 合并进已有 LoRA（加权平均）→ 重复。最终只有一个 LoRA 文件，但包含了所有任务的知识。',
              key_idea: '真正单 LoRA 文件——顺序合并，无存储膨胀',
              device: '单 LoRA（合并后）'
            },
            {
              name: 'InfLoRA', src: '2025', tag: '子空间投影', icon: '📐', color: '#52c41a',
              desc: 'Interference-Free LoRA。在训练新任务前，先计算旧任务的参数子空间，然后强制新任务的更新投影到旧任务子空间的正交补空间上。数学上保证零干扰。',
              key_idea: '显式消除任务间干扰——数学上保证不遗忘',
              device: '单 LoRA + 子空间存储'
            },
          ].map(item => (
            <Col span={12} key={item.name}>
              <Card size="small" style={{ height: '100%', borderLeft: `3px solid ${item.color}` }}
                title={
                  <span style={{ fontSize: 11 }}>
                    {item.icon} {item.name}
                    <Tag style={{ marginLeft: 4, fontSize: 9 }} color={item.color === '#722ed1' ? 'purple' : item.color === '#ff4d4f' ? 'red' : item.color === '#1890ff' ? 'blue' : 'green'}>{item.tag}</Tag>
                    <span style={{ fontSize: 9, color: '#bbb', marginLeft: 4 }}>{item.src}</span>
                  </span>
                }>
                <div style={{ fontSize: 10, lineHeight: 1.7, color: '#555', minHeight: 70, marginBottom: 8 }}>{item.desc}</div>
                <div style={{ padding: 6, borderRadius: 4, background: '#fafafa', fontSize: 9, color: item.color, fontWeight: 600, marginBottom: 4 }}>
                  💡 {item.key_idea}
                </div>
                <Tag color="default" style={{ fontSize: 8 }}>{item.device}</Tag>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* ====== 方案二：多 LoRA 并行组合 ====== */}
      <Card size="small" style={{ marginBottom: 16 }}
        title={<span style={{ fontSize: 12 }}>🧩 方案二：多 LoRA 并行组合（Adapter Composition）</span>}>
        <div style={{ fontSize: 11, lineHeight: 1.9, color: '#444', marginBottom: 12 }}>
          <p>
            <strong style={{ color: '#fa8c16' }}>核心问题：</strong>
            每个任务训一个 LoRA（基础安全、补丁修复、新类别），推理时合并使用。
            但<strong>两个独立训练的 LoRA 会「打架」</strong>——符号冲突、幅度冲突、语义冲突。
          </p>
        </div>

        <div style={{ background: '#fff2f0', padding: 10, borderRadius: 6, marginBottom: 12, border: '1.5px solid #ff4d4f' }}>
          <div style={{ fontWeight: 700, color: '#ff4d4f', fontSize: 11, marginBottom: 6 }}>⚠️ 生产实践教训（2026 年生产博客）</div>
          <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
            <em>"Teams ship this design, it works fine in development, and then <strong>falls apart in production</strong> when two adapters start fighting over the same weight regions and the output quality <strong>collapses to something indistinguishable from the untrained base model</strong>. Not slightly worse. Completely untuned."</em>
          </div>
        </div>

        <Row gutter={[12, 12]}>
          {[
            {
              name: '线性组合', complexity: '⭐', quality: '❌ 不可靠',
              desc: 'merged = w1·A + w2·B。最简单但最危险——符号冲突导致效果抵消，两个 adapter 的效果都丢失。',
              color: '#ff4d4f',
              verdict: '仅适配器任务高度相似时才可用'
            },
            {
              name: 'Task Vectors', complexity: '⭐⭐', quality: '⚠️ 需预判',
              desc: '定义 δ = W_fine-tuned - W_base，在 delta 空间做算术（加、减、缩放）。SVD 压缩后可用奇异值对齐度预判冲突。',
              color: '#fa8c16',
              verdict: 'SVD 对齐度高 → 可安全合并'
            },
            {
              name: 'TIES-Merging', complexity: '⭐⭐⭐', quality: '✅ 推荐',
              desc: 'Trim(去小值) → Elect Sign(投票选方向) → Merge(同向平均)。专治符号冲突——不同方向的参数不合并，按投票结果选方向。',
              color: '#52c41a',
              verdict: '已集成进 HuggingFace PEFT，一行代码'
            },
            {
              name: 'DARE', complexity: '⭐⭐', quality: '⚠️ 不稳定',
              desc: 'Drop(随机丢弃参数) → Rescale(重新缩放)。稀疏化减少冲突区域，但随机性导致结果不稳定。',
              color: '#1890ff',
              verdict: '适合作为 TIES 的预处理步骤'
            },
          ].map(item => (
            <Col span={12} key={item.name}>
              <Card size="small" style={{ borderLeft: `3px solid ${item.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700 }}>{item.name}</span>
                  <span style={{ fontSize: 10 }}>复杂度: {item.complexity} | 质量: {item.quality}</span>
                </div>
                <div style={{ fontSize: 10, lineHeight: 1.7, color: '#555', minHeight: 55, marginBottom: 6 }}>{item.desc}</div>
                <div style={{ padding: 4, borderRadius: 4, background: '#fafafa', fontSize: 9, color: item.color, fontWeight: 600 }}>
                  {item.verdict}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* ====== CheryGuard v3 增量方案 ====== */}
      <Card size="small" style={{ marginBottom: 16, border: '2px solid #722ed1' }}
        title={<span style={{ fontSize: 12 }}>🚀 CheryGuard v3 推荐的增量方案</span>}>
        <Row gutter={[16, 16]}>
          <Col span={16}>
            <div style={{ fontSize: 11, lineHeight: 1.9, color: '#444' }}>
              <p style={{ marginBottom: 6 }}>
                <strong style={{ color: '#722ed1' }}>为什么选 TIES-Merging 作为增量方案？</strong>
              </p>
              <div style={{ padding: 8, background: '#f9f0ff', borderRadius: 6, marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: '#555', lineHeight: 1.8 }}>
                  1. <strong>工程成本最低</strong>——HuggingFace PEFT 已内置，一行代码 `merge_and_unload()`<br/>
                  2. <strong>专治符号冲突</strong>——多 LoRA 合并时最常见的问题就是符号冲突，TIES 的 Elect Sign 专门解决这个<br/>
                  3. <strong>不需要额外训练</strong>——不需要训练路由器（C-LoRA 式），也不需要在线估计子空间（Janus 式）<br/>
                  4. <strong>可回滚</strong>——基础 LoRA 保持不动，补丁 LoRA 有问题直接摘掉<br/>
                  5. <strong>适合小规模</strong>——CheryGuard 的补丁数量预计在 5-10 个以内，TIES 在这个规模下效果最好
                </div>
              </div>
            </div>
          </Col>
          <Col span={8}>
            <Card size="small" style={{ background: '#fafafa' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#722ed1', marginBottom: 8 }}>增量更新流程</div>
              <div style={{ fontSize: 9, lineHeight: 2, color: '#555' }}>
                <div>1️⃣ 发现新问题（误判/漏判）</div>
                <div>2️⃣ 搜集相关数据（~100-500 条）</div>
                <div>3️⃣ 训练小补丁 LoRA（r=8）</div>
                <div>4️⃣ TIES 合并到基础 LoRA</div>
                <div>5️⃣ 评估验证（不退化 + 修复）</div>
                <div>6️⃣ 如果有问题 → 摘掉补丁回滚</div>
              </div>
            </Card>
          </Col>
        </Row>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 8, color: '#333' }}>未来演进路线</div>
          <Row gutter={[12, 12]}>
            {[
              { stage: '现在', plan: 'TIES 合并补丁 LoRA', desc: '基础 LoRA (r=16) + 补丁 LoRA (r=8) × N，TIES 合并。最多 5-10 个补丁。', tag: '当前方案', color: '#52c41a' },
              { stage: '中期', plan: 'C-LoRA 式路由矩阵', desc: '补丁数量超过 10 个时，TIES 合并可能累积误差。切换到路由矩阵，动态选择激活哪些补丁。', tag: '补丁≥10个', color: '#1890ff' },
              { stage: '远期', plan: 'Janus-LoRA 梯度矫正', desc: '如果需要严格保证不遗忘（如合规审计），用 Janus 的闭式解梯度矫正，数学上保证零干扰。', tag: '合规要求', color: '#722ed1' },
            ].map(item => (
              <Col span={8} key={item.stage}>
                <Card size="small" style={{ borderLeft: `3px solid ${item.color}`, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: item.color, marginBottom: 4 }}>{item.stage}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{item.plan}</div>
                  <div style={{ fontSize: 9, color: '#555', lineHeight: 1.6, marginBottom: 6 }}>{item.desc}</div>
                  <Tag color={item.color === '#52c41a' ? 'green' : item.color === '#1890ff' ? 'blue' : 'purple'} style={{ fontSize: 9 }}>{item.tag}</Tag>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      </Card>

      {/* ====== 生产环境架构 ====== */}
      <Card size="small" style={{ marginBottom: 16 }}
        title={<span style={{ fontSize: 12 }}>🏗️ 生产环境多 LoRA 架构</span>}>
        <div style={{ fontSize: 11, lineHeight: 1.9, color: '#444' }}>
          <p style={{ marginBottom: 8 }}>
            <strong style={{ color: '#fa8c16' }}>业界实践：</strong>
            vLLM 和 LoRAX 都原生支持多 LoRA 热加载。一个基座模型可以同时服务数百个 LoRA adapter，
            每个请求根据路由规则选择激活哪个 adapter。
          </p>
        </div>
        <Row gutter={[12, 12]}>
          {[
            {
              name: 'vLLM Multi-LoRA', tag: '推理引擎',
              desc: 'vLLM 原生支持多 LoRA 推理。一个基座模型加载多个 adapter，按请求动态路由。支持热加载——不停服务即可添加新 adapter。已有大型生产集群在用。',
              color: '#1890ff'
            },
            {
              name: 'LoRAX (Predibase)', tag: '专用服务',
              desc: '专门为多 LoRA 服务设计的推理框架。支持数百个 adapter 并发路由，每个 adapter 可独立更新。内置 adapter 版本管理和灰度发布。',
              color: '#722ed1'
            },
            {
              name: 'Adapter 隔离', tag: '冲突防护',
              desc: '如果两个 adapter 注定冲突（如一个要求严格、一个要求宽松），不要合并——用路由隔离。不同请求走不同 adapter，互不干扰。',
              color: '#ff4d4f'
            },
            {
              name: 'LoRA 版本管理', tag: '运维',
              desc: '将 LoRA 视为代码分支——每个补丁是一个 commit。基础 LoRA 是 main 分支，补丁是 feature 分支。合并后打 tag。可回滚到任意版本。',
              color: '#52c41a'
            },
          ].map(item => (
            <Col span={12} key={item.name}>
              <Card size="small" style={{ borderLeft: `3px solid ${item.color}` }}
                title={
                  <span style={{ fontSize: 11 }}>{item.name}
                    <Tag style={{ marginLeft: 4, fontSize: 9 }} color={item.color === '#1890ff' ? 'blue' : item.color === '#722ed1' ? 'purple' : item.color === '#ff4d4f' ? 'red' : 'green'}>{item.tag}</Tag>
                  </span>
                }>
                <div style={{ fontSize: 10, lineHeight: 1.7, color: '#555', minHeight: 60 }}>{item.desc}</div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Alert type="success" banner showIcon
        message="总结：CheryGuard 增量训练路线"
        description={
          <div style={{ fontSize: 12, lineHeight: 2 }}>
            <p style={{ margin: 0 }}><strong>1. 当前（v0.1 → v0.2）：</strong>多分类头架构 + 基础 LoRA 训练，不涉及增量</p>
            <p style={{ margin: 0 }}><strong>2. 近期（v3 稳定后）：</strong>TIES 合并补丁 LoRA（r=8），每次修复/新增功能只需训练小补丁</p>
            <p style={{ margin: 0 }}><strong>3. 中期（补丁≥10）：</strong>切换到 C-LoRA 式路由矩阵，动态选择激活哪些补丁</p>
            <p style={{ margin: 0 }}><strong>4. 远期（合规要求）：</strong>Janus-LoRA 梯度矫正，数学上保证零遗忘</p>
            <p style={{ margin: 0, marginTop: 8, padding: 8, background: '#f9f0ff', borderRadius: 4 }}>
              <strong style={{ color: '#722ed1' }}>核心原则：</strong>
              增量训练不是「重训模型」，而是「给模型打补丁」。每个补丁独立、可回滚、可组合。
              基础 LoRA 是稳定的基石，补丁 LoRA 是灵活的扩展。TIES-Merging 保证它们和平共处。
            </p>
          </div>
        } />
    </div>
  )
}
