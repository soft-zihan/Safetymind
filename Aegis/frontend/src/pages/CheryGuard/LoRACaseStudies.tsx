import { Card, Row, Col, Tag, Alert } from 'antd'

// ====== Local helper components ======
function CaseBox({ label, sub, color, bg, w }: { label: string; sub?: string; color: string; bg: string; w?: number }) {
  return (
    <div style={{
      minWidth: w || 80, padding: '4px 8px', borderRadius: 5, textAlign: 'center',
      background: bg, border: `1.5px solid ${color}`, fontSize: 10,
    }}>
      <div style={{ fontWeight: 700, color, fontSize: 10 }}>{label}</div>
      {sub && <div style={{ fontSize: 9, color: '#888', marginTop: 1 }}>{sub}</div>}
    </div>
  )
}

function Arrow({ text }: { text?: string }) {
  return <span style={{ color: '#bbb', fontSize: 14, margin: '0 2px' }}>{text || '→'}</span>
}

function CaseCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <Card size="small" style={{ marginBottom: 16, border: '1px solid #e8e8e8' }}
      title={<span style={{ fontSize: 13 }}>{icon} {title}</span>}>
      {children}
    </Card>
  )
}

export default function LoRACaseStudies() {
  return (
    <div>
      <Alert type="info" banner showIcon style={{ marginBottom: 16 }}
        message="业界 LoRA 工程创新案例"
        description="以下方案展示了 LoRA 微调在架构设计、数据生成、知识编辑等方面的工程创新，不限于安全领域。" />

      {/* ====== 1. SingGuard-NSFA ====== */}
      <CaseCard title="1. SingGuard-NSFA — 双模式护栏 + 可扩展分类头" icon="🛡️">
        <div style={{ background: '#fafafa', padding: 12, borderRadius: 8, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            <CaseBox label="输入" sub="prompt / agent action" color="#1890ff" bg="#e6f7ff" w={100} />
            <Arrow />
            <CaseBox label="Frozen Backbone" sub="Qwen3.5-0.8~9B" color="#722ed1" bg="#f9f0ff" w={120} />
          </div>
          <div style={{ textAlign: 'center', fontSize: 12, color: '#bbb', marginBottom: 6 }}>↓ last_token embedding 分发到两种模式</div>
          <Row gutter={12}>
            <Col span={12}>
              <div style={{ padding: 8, borderRadius: 6, background: '#f6ffed', border: '1.5px solid #52c41a', textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: '#52c41a', fontSize: 11 }}>审计模式 (生成式)</div>
                <div style={{ fontSize: 9, color: '#888', marginTop: 2 }}>自回归生成 CoT 分析</div>
                <div style={{ fontSize: 9, color: '#888' }}>"该请求涉及提示注入..."</div>
                <div style={{ fontSize: 9, color: '#52c41a', marginTop: 2 }}>→ 结构化风险报告</div>
              </div>
            </Col>
            <Col span={12}>
              <div style={{ padding: 8, borderRadius: 6, background: '#fff7e6', border: '1.5px solid #fa8c16', textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: '#fa8c16', fontSize: 11 }}>实时模式 (判别式)</div>
                <div style={{ fontSize: 9, color: '#888', marginTop: 2 }}>单次 forward → 7 个 MLP head 并行</div>
                <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                  {['注入', '窃取', '恶意代码', '工具滥用', '资源耗尽', '危险生成', '信息泄露'].map(d => (
                    <Tag key={d} style={{ fontSize: 8, margin: 1, padding: '0 4px' }}>{d}</Tag>
                  ))}
                </div>
                <div style={{ fontSize: 9, color: '#fa8c16', marginTop: 2 }}>→ 50ms 判定 ✓</div>
              </div>
            </Col>
          </Row>
        </div>
        <div style={{ fontSize: 11, lineHeight: 1.8 }}>
          <strong style={{ color: '#722ed1' }}>核心创新：</strong>
          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
            <li><strong>双模式同模型</strong>：一条 backbone 两种推理 — 生成式出审计报告，判别式做 50ms 实时拦截</li>
            <li><strong>可扩展分类头</strong>：7 个独立 MLP head 挂载在 frozen backbone 上。新增风险类别？只训练一个新的轻量 head，不动 backbone</li>
            <li><strong>插件增强</strong>：把 NSFA head 挂到 Llama Guard 3 上，F1 直接 +17.6 分</li>
            <li><strong>零种子数据合成</strong>：74 个 LLM 生成器 + 4 阶段流水线 → 93K 样本，133 种语言，无需人工标注</li>
            <li><strong>0.8B 打 8B</strong>：小模型 + 多 head 架构超过大模型</li>
          </ul>
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Tag color="purple">蚂蚁集团 inclusionAI</Tag>
          <Tag color="blue">arXiv 2607.13081</Tag>
          <Tag color="green">0.8B / 2B / 4B / 9B</Tag>
          <Tag color="orange">F1 &gt;94%</Tag>
          <Tag color="cyan">ModelScope 开源</Tag>
        </div>
      </CaseCard>

      {/* ====== 2. MoDULA ====== */}
      <CaseCard title="2. MoDULA — 通用 LoRA + 领域 LoRA 混合专家" icon="🔀">
        <div style={{ background: '#fafafa', padding: 12, borderRadius: 8, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            <CaseBox label="输入" color="#1890ff" bg="#e6f7ff" />
            <Arrow />
            <CaseBox label="Frozen Base" sub="LLM" color="#722ed1" bg="#f9f0ff" />
          </div>
          <div style={{ textAlign: 'center', fontSize: 11, color: '#bbb', marginBottom: 6 }}>↓ 并行分支</div>
          <Row gutter={8}>
            <Col span={8}>
              <div style={{ padding: 8, borderRadius: 6, background: '#e6f7ff', border: '1.5px solid #1890ff', textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: '#1890ff', fontSize: 10 }}>Universal LoRA</div>
                <div style={{ fontSize: 9, color: '#888' }}>通用能力 · 始终激活</div>
                <div style={{ fontSize: 8, color: '#bbb', marginTop: 2 }}>(所有任务训练)</div>
              </div>
            </Col>
            <Col span={8}>
              <div style={{ padding: 8, borderRadius: 6, background: '#fff7e6', border: '1.5px solid #fa8c16', textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: '#fa8c16', fontSize: 10 }}>Router</div>
                <div style={{ fontSize: 9, color: '#888' }}>路由到领域专家</div>
                <div style={{ fontSize: 8, color: '#bbb', marginTop: 2 }}>gate(input) → weights</div>
              </div>
            </Col>
            <Col span={8}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {[
                  { name: 'Domain A', sub: '医疗', c: '#52c41a', bg: '#f6ffed' },
                  { name: 'Domain B', sub: '法律', c: '#722ed1', bg: '#f9f0ff' },
                  { name: 'Domain C', sub: '安全', c: '#ff4d4f', bg: '#fff2f0' },
                ].map(e => (
                  <div key={e.name} style={{ padding: '3px 6px', borderRadius: 4, background: e.bg, border: `1px solid ${e.c}`, textAlign: 'center' }}>
                    <span style={{ fontSize: 9, color: e.c, fontWeight: 600 }}>{e.name}</span>
                    <span style={{ fontSize: 8, color: '#999', marginLeft: 4 }}>{e.sub}</span>
                  </div>
                ))}
              </div>
            </Col>
          </Row>
          <div style={{ textAlign: 'center', fontSize: 11, color: '#bbb', marginTop: 6, marginBottom: 4 }}>↓ 残差连接 (Residual)</div>
          <div style={{ padding: 6, borderRadius: 6, background: '#f9f0ff', border: '1.5px dashed #722ed1', textAlign: 'center' }}>
            <span style={{ fontSize: 10, color: '#722ed1', fontWeight: 700 }}>Output = Universal + Σ(router_weight × Domain_LoRA)</span>
          </div>
        </div>
        <div style={{ fontSize: 11, lineHeight: 1.8 }}>
          <strong style={{ color: '#722ed1' }}>核心创新：</strong>
          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
            <li><strong>通用 + 领域分离</strong>：Universal LoRA 学通用能力，Domain LoRA 各管一个领域，残差连接保证不遗忘</li>
            <li><strong>渐进式训练</strong>：新增领域只训练新的 Domain LoRA + 更新 Router，不动 Universal 和已有 Domain LoRA</li>
            <li><strong>训练成本降低 80%</strong>：不需要同时训练所有任务，避免数据平衡问题</li>
            <li><strong>可插拔</strong>：像乐高一样组装能力模块</li>
          </ul>
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Tag color="purple">EMNLP 2024</Tag>
          <Tag color="blue">arXiv 2412.07405</Tag>
          <Tag color="green">训练成本 ↓80%</Tag>
        </div>
      </CaseCard>

      {/* ====== 3. DLP-LoRA ====== */}
      <CaseCard title="3. DLP-LoRA — 5M 参数 MLP 动态融合多 LoRA" icon="🎛️">
        <div style={{ background: '#fafafa', padding: 12, borderRadius: 8, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            <CaseBox label="输入句子" color="#1890ff" bg="#e6f7ff" />
            <Arrow />
            <CaseBox label="Frozen Base" color="#722ed1" bg="#f9f0ff" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 6 }}>
            <div style={{ padding: '6px 10px', borderRadius: 6, background: '#fffbe6', border: '1.5px solid #faad14', textAlign: 'center' }}>
              <div style={{ fontWeight: 700, color: '#faad14', fontSize: 10 }}>Mini-MLP</div>
              <div style={{ fontSize: 9, color: '#888' }}>仅 5M 参数</div>
              <div style={{ fontSize: 8, color: '#bbb' }}>分析句子特征</div>
            </div>
            <Arrow />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[
                { l: 'Security LoRA', w: '0.7', c: '#ff4d4f', bg: '#fff2f0' },
                { l: 'Code LoRA', w: '0.3', c: '#1890ff', bg: '#e6f7ff' },
              ].map(e => (
                <div key={e.l} style={{ padding: '2px 6px', borderRadius: 3, background: e.bg, border: `1px solid ${e.c}`, fontSize: 9, color: e.c }}>
                  {e.l} <span style={{ color: '#999' }}>×{e.w}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ textAlign: 'center', fontSize: 10, color: '#bbb', marginBottom: 4 }}>↓ 动态加权融合</div>
          <div style={{ padding: 6, borderRadius: 6, background: '#f9f0ff', border: '1.5px dashed #722ed1', textAlign: 'center' }}>
            <span style={{ fontSize: 10, color: '#722ed1', fontWeight: 700 }}>Merged LoRA = 0.7 × Security + 0.3 × Code</span>
          </div>
        </div>
        <div style={{ fontSize: 11, lineHeight: 1.8 }}>
          <strong style={{ color: '#722ed1' }}>核心创新：</strong>
          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
            <li><strong>句子级软融合</strong>：不是路由到某一个 expert，而是动态加权组合多个 LoRA</li>
            <li><strong>极轻量路由器</strong>：仅 5M 参数的 MLP 决定融合权重，几乎零额外开销</li>
            <li><strong>动态而非静态</strong>：同一模型，不同句子自动切换不同能力组合</li>
          </ul>
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Tag color="purple">arXiv 2410.01497</Tag>
          <Tag color="green">5M router</Tag>
        </div>
      </CaseCard>

      {/* ====== 4. SoLA ====== */}
      <CaseCard title="4. SoLA — 每个知识编辑一个独立 LoRA，可插拔热更新" icon="🔌">
        <div style={{ background: '#fafafa', padding: 12, borderRadius: 8, marginBottom: 10 }}>
          <Row gutter={12}>
            <Col span={14}>
              <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>知识库 (每个编辑 = 独立 LoRA)</div>
              {[
                { e: 'Edit 1', t: '"法国首都=巴黎"', c: '#52c41a', bg: '#f6ffed' },
                { e: 'Edit 2', t: '"Python 3.12 特性"', c: '#1890ff', bg: '#e6f7ff' },
                { e: 'Edit 3', t: '"OWASP Top 10"', c: '#ff4d4f', bg: '#fff2f0' },
                { e: 'Edit 4', t: '"新 jailbreak 模式"', c: '#fa8c16', bg: '#fff7e6' },
              ].map(item => (
                <div key={item.e} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <div style={{ padding: '3px 8px', borderRadius: 4, background: item.bg, border: `1px solid ${item.c}`, fontSize: 9, color: item.c, fontWeight: 600, minWidth: 55, textAlign: 'center' }}>
                    {item.e}
                  </div>
                  <Arrow />
                  <span style={{ fontSize: 9, color: '#888' }}>LoRA Module</span>
                </div>
              ))}
            </Col>
            <Col span={10}>
              <div style={{ padding: 8, borderRadius: 6, background: '#fffbe6', border: '1.5px solid #faad14', textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: '#faad14', fontSize: 10 }}>Semantic Router</div>
                <div style={{ fontSize: 9, color: '#888', marginTop: 2 }}>语义匹配输入 → 选择 LoRA</div>
                <div style={{ fontSize: 9, color: '#888' }}>输入"法国首都?" → Edit 1</div>
                <div style={{ fontSize: 9, color: '#888' }}>输入"越狱?" → Edit 4</div>
              </div>
              <div style={{ textAlign: 'center', marginTop: 6, fontSize: 9, color: '#52c41a' }}>
                ✓ 可随时添加/移除编辑<br/>
                ✓ 不影响其他知识<br/>
                ✓ 终身学习无遗忘
              </div>
            </Col>
          </Row>
        </div>
        <div style={{ fontSize: 11, lineHeight: 1.8 }}>
          <strong style={{ color: '#722ed1' }}>核心创新：</strong>
          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
            <li><strong>知识 = 补丁</strong>：每条知识编辑训练一个独立 LoRA 模块，像给系统打补丁</li>
            <li><strong>语义路由</strong>：推理时根据输入语义自动匹配到对应的 LoRA 模块</li>
            <li><strong>可逆 + 终身</strong>：可以随时移除某个编辑，不影响其他知识，无灾难性遗忘</li>
            <li><strong>安全场景</strong>：新出现的安全威胁 → 训练新 LoRA 模块 → 热加载，不用重训模型</li>
          </ul>
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Tag color="purple">arXiv 2603.11239</Tag>
          <Tag color="green">可逆热更新</Tag>
          <Tag color="blue">终身编辑</Tag>
        </div>
      </CaseCard>

      {/* ====== 5. CYCLE-INSTRUCT ====== */}
      <CaseCard title="5. CYCLE-INSTRUCT — 零种子指令微调 (双模型自博弈)" icon="♻️">
        <div style={{ background: '#fafafa', padding: 12, borderRadius: 8, marginBottom: 10 }}>
          <Row gutter={8}>
            <Col span={11}>
              <div style={{ padding: 8, borderRadius: 6, background: '#e6f7ff', border: '1.5px solid #1890ff', textAlign: 'center', minHeight: 90 }}>
                <div style={{ fontWeight: 700, color: '#1890ff', fontSize: 10 }}>Answer Generator</div>
                <div style={{ fontSize: 9, color: '#888', marginTop: 4 }}>从空 prompt 生成问答对</div>
                <div style={{ fontSize: 9, color: '#888' }}>Q: "什么是 XSS?"</div>
                <div style={{ fontSize: 9, color: '#888' }}>A: "跨站脚本攻击是..."</div>
              </div>
            </Col>
            <Col span={2} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 18, color: '#bbb' }}>⇄</span>
            </Col>
            <Col span={11}>
              <div style={{ padding: 8, borderRadius: 6, background: '#f6ffed', border: '1.5px solid #52c41a', textAlign: 'center', minHeight: 90 }}>
                <div style={{ fontWeight: 700, color: '#52c41a', fontSize: 10 }}>Question Generator</div>
                <div style={{ fontSize: 9, color: '#888', marginTop: 4 }}>把回答变回问题</div>
                <div style={{ fontSize: 9, color: '#888' }}>A: "跨站脚本攻击..."</div>
                <div style={{ fontSize: 9, color: '#888' }}>Q': "什么是 XSS 攻击?"</div>
              </div>
            </Col>
          </Row>
          <div style={{ textAlign: 'center', marginTop: 8, marginBottom: 6 }}>
            <div style={{ padding: 6, borderRadius: 6, background: '#fffbe6', border: '1.5px solid #faad14', display: 'inline-block' }}>
              <span style={{ fontSize: 10, color: '#faad14', fontWeight: 700 }}>Cycle Consistency 检查: Q ≈ Q' ?</span>
            </div>
          </div>
          <div style={{ textAlign: 'center', fontSize: 10, color: '#888' }}>
            ✓ 一致 → 保留为训练数据 → 训练 Answer Generator (LoRA)<br/>
            ✗ 不一致 → 丢弃 → 重复循环
          </div>
        </div>
        <div style={{ fontSize: 11, lineHeight: 1.8 }}>
          <strong style={{ color: '#722ed1' }}>核心创新：</strong>
          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
            <li><strong>零种子</strong>：不需要任何人工标注数据，两个模型互相博弈生成训练数据</li>
            <li><strong>循环一致性</strong>：A 生成问答 → B 把答案变回问题 → 检查原始问题是否 ≈ 重建问题</li>
            <li><strong>自举提升</strong>：每轮用保留的数据训练，下一轮生成质量更高，迭代提升</li>
            <li><strong>数据困境解法</strong>：安全领域标注数据稀缺时的全自动数据生成方案</li>
          </ul>
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Tag color="purple">EMNLP 2025</Tag>
          <Tag color="blue">arXiv 2508.16100</Tag>
          <Tag color="green">零种子</Tag>
          <Tag color="orange">自博弈</Tag>
        </div>
      </CaseCard>

      {/* ====== 6. Qwen3Guard (基线) ====== */}
      <CaseCard title="6. Qwen3Guard — LoRA SFT 安全分类 (基线参考)" icon="🤖">
        <div style={{ background: '#fafafa', padding: 12, borderRadius: 8, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            <CaseBox label="输入" sub="USER: {prompt}" color="#1890ff" bg="#e6f7ff" w={100} />
            <Arrow />
            <CaseBox label="Qwen3-0.6B" sub="+ LoRA (r=16)" color="#722ed1" bg="#f9f0ff" />
            <Arrow />
            <CaseBox label="自回归生成" sub="max_new_tokens=64" color="#fa541c" bg="#fff2e8" />
          </div>
          <div style={{ textAlign: 'center', fontSize: 10, color: '#bbb', marginBottom: 4 }}>↓ 模板化输出</div>
          <div style={{ padding: 8, borderRadius: 6, background: '#f9f0ff', border: '1px dashed #722ed1', textAlign: 'center', fontFamily: 'monospace', fontSize: 10 }}>
            Safety: [Safe/Unsafe/Controversial]<br/>
            Categories: [Violent, PII, ...]<br/>
            Refusal: [Yes/No]
          </div>
          <div style={{ textAlign: 'center', fontSize: 10, color: '#bbb', marginTop: 4 }}>↓ 解析输出</div>
          <div style={{ padding: 6, borderRadius: 6, background: '#f6ffed', border: '1.5px solid #52c41a', textAlign: 'center' }}>
            <span style={{ fontSize: 10, color: '#52c41a', fontWeight: 700 }}>prediction = "Unsafe", categories = ["Violent"], refusal = "Yes"</span>
          </div>
        </div>
        <div style={{ fontSize: 11, lineHeight: 1.8 }}>
          <strong style={{ color: '#722ed1' }}>设计要点：</strong>
          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
            <li><strong>生成式分类</strong>：不是加分类头，而是让模型自回归生成结构化标签</li>
            <li><strong>模板设计</strong>：Safety / Categories / Refusal 三行模板，用正则解析</li>
            <li><strong>简单但有效</strong>：0.6B + LoRA 微调 6.5K 数据 ≈ 官方 1.19M 全量 SFT</li>
            <li>这是 CheryGuard Gen 所采用的基础架构</li>
          </ul>
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Tag color="purple">Qwen 官方</Tag>
          <Tag color="blue">0.6B + LoRA</Tag>
          <Tag color="green">F1=0.714</Tag>
        </div>
      </CaseCard>

      {/* ====== 全景对比 ====== */}
      <Card title="全景对比" size="small" style={{ marginTop: 8 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#fafafa' }}>
                <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>方案</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>核心思路</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>独特之处</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>训练成本</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['SingGuard-NSFA', '双模式 + 多 head', '同一模型两种推理，head 可插拔扩展', '中等'],
                ['MoDULA', '通用 + 领域 LoRA', '渐进式训练，新增领域不重训', '低 (↓80%)'],
                ['DLP-LoRA', '5M MLP 动态融合', '句子级软融合多个 LoRA', '极低'],
                ['SoLA', '每编辑一个 LoRA', '语义路由 + 可逆 + 终身编辑', '极低'],
                ['CYCLE-INSTRUCT', '双模型自博弈', '零种子，循环一致性质检', '中等'],
                ['Qwen3Guard', 'LoRA SFT 生成式', '模板输出，简单有效', '低'],
              ].map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  {row.map((cell, j) => (
                    <td key={j} style={{ padding: '6px 8px', fontSize: 11, color: j === 0 ? '#722ed1' : '#666', fontWeight: j === 0 ? 600 : 400 }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Alert type="warning" banner showIcon style={{ marginTop: 16 }}
        message="与 CheryGuard 的关系"
        description={
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
            <li>CheryGuard Gen 采用 Qwen3Guard 式生成式架构（方案 6）</li>
            <li>CheryGuard Stream 采用 SingGuard 式双 head 架构（方案 1 的简化版）</li>
            <li>未来可尝试 MoDULA 式多领域 LoRA + SoLA 式热更新</li>
            <li>数据匮乏时可用 CYCLE-INSTRUCT 式自博弈生成</li>
          </ul>
        } />

      {/* ====== QLoRA vs LoRA ====== */}
      <CaseCard title="附: QLoRA vs LoRA — 算力受限场景的选择" icon="💡">
        <div style={{ fontSize: 11, lineHeight: 1.8, color: '#444' }}>
          <p>
            <strong style={{ color: '#722ed1' }}>核心问题：</strong>
            既然 LoRA 已经极大降低了训练成本，QLoRA (4-bit 量化基座 + LoRA) 是否是算力受限下的最优选择?
          </p>
          <div style={{ overflowX: 'auto', marginBottom: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  <th style={{ padding: '4px 6px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>来源</th>
                  <th style={{ padding: '4px 6px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>模型</th>
                  <th style={{ padding: '4px 6px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>方法</th>
                  <th style={{ padding: '4px 6px', textAlign: 'right', borderBottom: '1px solid #e8e8e8' }}>显存</th>
                  <th style={{ padding: '4px 6px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>准确率</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['PMC 2025', '8B', 'LoRA (fp16)', '4×GPU', '+10-20pts'],
                  ['PMC 2025', '8B', 'QLoRA (4-bit)', '2×GPU (-33%)', '+8-14pts (-2-4)'],
                  ['Medium 2025', '7B', 'LoRA', '98% mem', '93.79%'],
                  ['Medium 2025', '7B', 'QLoRA', '17% mem', '94.48% ⬆'],
                  ['Contra 2026', '8B', 'LoRA (fp16)', '~34 GB', '—'],
                  ['Contra 2026', '8B', 'QLoRA (4-bit)', '~14 GB (-59%)', '—'],
                  ['Contra 2026', '14B', 'QLoRA (4-bit)', '~22 GB', '—'],
                  ['我们 (Mac Mini 16G)', '0.6B', 'LoRA (fp16)', '~3-5 GB', 'F1=0.833'],
                  ['我们 (如用 QLoRA)', '0.6B', 'QLoRA (4-bit)', '~2-4 GB', '预计 -2-4 pts'],
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f0f0f0', background: row[0].includes('我们') ? '#f9f0ff' : 'transparent' }}>
                    {row.map((cell, j) => (
                      <td key={j} style={{ padding: '3px 6px', fontSize: 10, color: j === 2 && cell.includes('LoRA') && !cell.includes('Q') ? '#722ed1' : j === 2 && cell.includes('QLoRA') ? '#52c41a' : '#666', fontWeight: row[0].includes('我们') ? 600 : 400 }}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ background: '#fafafa', padding: 10, borderRadius: 8, marginBottom: 8 }}>
            <div style={{ fontWeight: 700, color: '#722ed1', fontSize: 11, marginBottom: 6 }}>关键发现</div>
            <ul style={{ margin: '0 0 0 16px', padding: 0, fontSize: 10, lineHeight: 1.7 }}>
              <li><strong>显存优势随模型规模放大</strong>：0.6B 只省 ~1GB，8B 省 ~20GB，14B 省 ~35GB</li>
              <li><strong>准确率损失 2-4 个 F1 点</strong>：但偶尔反超 (QLoRA 量化噪声可起到正则化效果)</li>
              <li><strong>训练慢 28-32%</strong>：反量化 (dequantization) 开销</li>
              <li><strong>分界线</strong>：模型 &lt;2B + 内存充裕 → LoRA 更优; 模型 ≥7B + 内存紧张 → QLoRA 唯一选择</li>
            </ul>
          </div>
          <div style={{ padding: 8, background: '#f6ffed', border: '1px solid #52c41a', borderRadius: 6, fontSize: 10, color: '#389e0d' }}>
            <strong>我们 CheryGuard 的结论：</strong>0.6B 在 16GB Mac Mini 上 LoRA 仅占 3-5GB，QLoRA 只能再省 ~1GB 但要承受 -2~4 F1 + 30% 减速。
            <strong>LoRA 是正确选择</strong>。若未来扩展到 7B+ 安全模型 (需 ~34GB fp16)，QLoRA 是 16GB 机器上唯一可行方案。
          </div>
          <div style={{ marginTop: 6, fontSize: 9, color: '#999' }}>
            来源: arXiv:2305.14314 (QLoRA 原始论文), PMC12633606 (临床数据提取), arXiv:2509.12229 (RTX 4060 profiling), Contra Collective 2026 (M5 Max), Medium 2025
          </div>
        </div>
      </CaseCard>

      {/* ====== LoRA 超参数调参 ====== */}
      <CaseCard title="附: LoRA 超参数调参 — 为什么我们不需要反复调?" icon="🔧">
        <div style={{ fontSize: 11, lineHeight: 1.8, color: '#444' }}>
          <p>
            <strong style={{ color: '#722ed1' }}>核心问题：</strong>
            我们的训练用固定超参数 (r=16, α=32, lr=1e-4)，没有做超参数搜索。这符合业界实践吗?
          </p>
          <div style={{ overflowX: 'auto', marginBottom: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  <th style={{ padding: '4px 6px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>超参数</th>
                  <th style={{ padding: '4px 6px', textAlign: 'center', borderBottom: '1px solid #e8e8e8' }}>我们的选择</th>
                  <th style={{ padding: '4px 6px', textAlign: 'left', borderBottom: '1px solid #e8e8e8' }}>业界推荐</th>
                  <th style={{ padding: '4px 6px', textAlign: 'center', borderBottom: '1px solid #e8e8e8' }}>符合?</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['rank r', '16', '16 (分类任务 16-32)', '✅'],
                  ['alpha α', '32 (=2r)', '2r (popular heuristic)', '✅'],
                  ['dropout', '0.05', '0.05 (标准值)', '✅'],
                  ['learning rate', '1e-4', '2e-4 (Unsloth); 1e-4 偏保守', '⚠️'],
                  ['batch_size', '1×32 (eff=32)', '视显存调整', '✅'],
                  ['epochs', '3', '3-5 (标准范围)', '✅'],
                  ['target_modules', '全部 7 层 (attn+ffn)', 'attn+ffn (需新知识时)', '✅'],
                  ['scheduler', 'cosine', 'cosine (推荐)', '✅'],
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    {row.map((cell, j) => (
                      <td key={j} style={{
                        padding: '3px 6px', fontSize: 10,
                        color: j === 3 ? (cell === '✅' ? '#52c41a' : cell === '⚠️' ? '#fa8c16' : '#666') : '#666',
                        fontWeight: j === 1 ? 600 : 400,
                        textAlign: j === 1 || j === 3 ? 'center' : 'left',
                      }}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ background: '#fafafa', padding: 10, borderRadius: 8, marginBottom: 8 }}>
            <div style={{ fontWeight: 700, color: '#722ed1', fontSize: 11, marginBottom: 6 }}>业界共识</div>
            <ul style={{ margin: '0 0 0 16px', padding: 0, fontSize: 10, lineHeight: 1.7 }}>
              <li><strong>Learnixo (2026)</strong>: "r=16 is a reliable starting point that rarely requires adjustment"</li>
              <li><strong>arXiv:2602.04998 (2026)</strong>: "Vanilla LoRA May Suffice"——原始 LoRA 在标准超参数下已接近最优</li>
              <li><strong>Unsloth (2026)</strong>: r=16, alpha=2r, lr=2e-4 作为默认值，基于数百篇论文</li>
              <li><strong>Sebastian Raschka</strong>: 小数据集 ({'<10K'}) 高 rank 反而过拟合</li>
            </ul>
          </div>
          <div style={{ background: '#fafafa', padding: 10, borderRadius: 8, marginBottom: 8 }}>
            <div style={{ fontWeight: 700, color: '#722ed1', fontSize: 11, marginBottom: 6 }}>何时需要调参?</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <tbody>
                {[
                  ['F1 远低于预期', '✅', 'rank ↑, lr sweep, target_modules'],
                  ['训练 loss 不收敛', '✅', 'lr ↑, warmup 调整'],
                  ['验证 loss 早早干涸', '✅', 'rank ↓, dropout ↑, epochs ↓'],
                  ['训练↓但验证↑ (过拟合)', '✅', 'rank ↓, dropout ↑, lr ↓'],
                  ['结果已达预期且稳定', '❌', '不需要调参'],
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f0f0f0', background: row[4] === '❌' ? '#f6ffed' : 'transparent' }}>
                    <td style={{ padding: '3px 6px', fontSize: 10, color: '#666' }}>{row[0]}</td>
                    <td style={{ padding: '3px 6px', fontSize: 10, textAlign: 'center', color: row[1] === '✅' ? '#ff4d4f' : '#52c41a', fontWeight: 600 }}>{row[1]}</td>
                    <td style={{ padding: '3px 6px', fontSize: 10, color: '#666' }}>{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: 8, background: '#f6ffed', border: '1px solid #52c41a', borderRadius: 6, fontSize: 10, color: '#389e0d' }}>
            <strong>我们的结论：</strong>F1=0.833 与官方 Qwen3Guard (0.814) 持平，超参数符合业界默认值，属于"结果已达预期且稳定"——<strong>不需要调参</strong>。
            我们用 checkpoint 选择 (10 个 checkpoint 全评估选最优) 代替了超参数搜索，效果类似且更高效。
          </div>
        </div>
      </CaseCard>
    </div>
  )
}
