import { Card, Tabs, Tag, Alert, Space } from 'antd'
import { CodeOutlined, RocketOutlined, ToolOutlined } from '@ant-design/icons'

const { TabPane } = Tabs

function CodeBlock({ code, title }: { code: string; title?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {title && (
        <div style={{
          background: '#f5f5f5', padding: '8px 12px', borderRadius: '6px 6px 0 0',
          border: '1px solid #d9d9d9', borderBottom: 'none', fontSize: 12, fontWeight: 600, color: '#262626'
        }}>{title}</div>
      )}
      <pre style={{
        background: '#1e1e1e', color: '#d4d4d4', padding: 16,
        borderRadius: title ? '0 0 6px 6px' : '6px', border: '1px solid #d9d9d9',
        fontSize: 12, lineHeight: 1.8, overflow: 'auto', margin: 0,
        fontFamily: 'Menlo, Consolas, monospace',
      }}><code>{code}</code></pre>
    </div>
  )
}

// 伪代码块：浅色背景，适合教学说明
function PseudoBlock({ code, title }: { code: string; title?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {title && (
        <div style={{
          background: '#e6f7ff', padding: '8px 12px', borderRadius: '6px 6px 0 0',
          border: '1.5px solid #1890ff', borderBottom: 'none', fontSize: 12, fontWeight: 600, color: '#1890ff'
        }}>{title}</div>
      )}
      <pre style={{
        background: '#f0f5ff', color: '#333', padding: 16,
        borderRadius: title ? '0 0 6px 6px' : '6px', border: '1.5px solid #1890ff',
        fontSize: 12, lineHeight: 1.8, overflow: 'auto', margin: 0,
        fontFamily: 'Menlo, Consolas, monospace',
      }}><code>{code}</code></pre>
    </div>
  )
}

export default function CodeTab() {
  return (
    <div>
      <Alert message="代码实践教学"
        description="通过 CheryGuard Gen / Stream 两个变体的实际训练代码学习 LoRA 微调全流程。蓝色背景是伪代码教学版，黑色背景是实际代码。"
        type="info" showIcon style={{ marginBottom: 16 }} />

      <Tabs defaultActiveKey="training" type="card">

        {/* ========== Gen 模型训练 ========== */}
        <TabPane tab={<span><ToolOutlined /> Gen 模型训练</span>} key="training">
          <Card title="Gen 变体：CausalLM + LoRA → 指令跟随式安全分类" bordered={false}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 10 }}>本页用到的核心函数 — 先看脉络，再看代码：</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, marginBottom: 16 }}>
              <thead><tr style={{ background: '#fafafa', borderBottom: '1.5px solid #d9d9d9' }}>
                <th style={{ padding: '4px 8px', textAlign: 'left', width: 70 }}>库</th>
                <th style={{ padding: '4px 8px', textAlign: 'left', width: 160 }}>函数</th>
                <th style={{ padding: '4px 8px', textAlign: 'left' }}>作用</th>
                <th style={{ padding: '4px 8px', textAlign: 'left', width: 120 }}>Stream 对应</th>
              </tr></thead>
              <tbody>
                {[
                  ['PEFT','LoraConfig','配置 LoRA 超参数：r=16, alpha=32, target_modules=[7层]','一致'],
                  ['PEFT','get_peft_model()','注入 LoRA 适配器，冻结原始权重，只训练 1.66% 参数','一致'],
                  ['PEFT','save_pretrained()','只保存 LoRA 适配器（~40MB），不保存基座模型','一致，额外 torch.save 分类头'],
                  ['PEFT','PeftModel.from_pretrained()','推理时加载 LoRA 适配器','一致，额外 torch.load 分类头'],
                  ['Transformers','AutoModelForCausalLM','加载带 LM Head 的基座（可 .generate()）','→ AutoModel（无 LM Head）'],
                  ['Transformers','AutoTokenizer','文本⟷token互转，训练时做 label masking','一致'],
                  ['Transformers','TrainingArguments','定义训练超参：fp16, cosine, grad_accum=32','→ 手写训练循环中直接设定'],
                  ['Transformers','Trainer','封装训练循环，.train() 一行完成','→ nn.Module + 手写 loop'],
                  ['Transformers','DataCollatorForSeq2Seq','自动 padding + label masking','→ 手动处理'],
                ].map(([lib, func, desc, stream], i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '3px 8px' }}><Tag style={{ fontSize: 9 }}>{lib}</Tag></td>
                    <td style={{ padding: '3px 8px' }}><code style={{ fontSize: 10 }}>{func}</code></td>
                    <td style={{ padding: '3px 8px', color: '#555' }}>{desc}</td>
                    <td style={{ padding: '3px 8px', color: '#8c8c8c', fontSize: 9 }}>{stream.startsWith('→') ? <span style={{ color: '#1890ff' }}>{stream}</span> : stream}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* === 第1步：伪代码教学 === */}
            <div style={{ padding: '8px 12px', borderRadius: 6, background: '#f6ffed', border: '1px solid #52c41a', marginBottom: 8, fontSize: 11, lineHeight: 1.8 }}>
              <div style={{ color: '#389e0d', fontWeight: 600, marginBottom: 4 }}>📖 本段核心函数：</div>
              <span><Tag style={{ fontSize: 9 }} color="#722ed1">AutoModelForCausalLM</Tag>加载带 LM Head 的基座模型，可 .generate() 生成文本。Stream 用 AutoModel（无 LM Head）</span><br />
              <span><Tag style={{ fontSize: 9 }} color="#722ed1">AutoTokenizer</Tag>文本⟷token 互转。训练时 prompt 部分设为 -100 做 label masking</span><br />
              <span><Tag style={{ fontSize: 9 }} color="#1890ff">LoraConfig(r, alpha, target_modules)</Tag>r=16 控制秩，alpha=32 使缩放=2倍，target_modules 指定注入 7 个 Linear 层</span><br />
              <span><Tag style={{ fontSize: 9 }} color="#1890ff">get_peft_model()</Tag>注入 A(d×r)、B(r×d) 矩阵，冻结原始权重 W，只训练 ΔW=BA。604M→10M 可训练</span>
            </div>
            <PseudoBlock title="📍 第1步：加载模型 + 注入 LoRA"
              code={`// 1. 加载基座模型
model = AutoModelForCausalLM.from_pretrained("Qwen/Qwen3-0.6B")
//    ↑ 带 LM Head 的 CausalLM → 可以 .generate() 生成文本
//    ↑ Stream 变体用的是 AutoModel（无 LM Head）→ 接分类头

tokenizer = AutoTokenizer.from_pretrained("Qwen/Qwen3-0.6B")

// 2. 配置 LoRA 超参数
lora_config = LoraConfig(
    r=16,           // 低秩矩阵秩，越大表达力越强但参数越多
    lora_alpha=32,  // 实际缩放 = alpha/r = 2 倍
    target_modules=[                        // 注入这 7 个 Linear 层
        "q_proj","k_proj","v_proj","o_proj",  // Attention
        "gate_proj","up_proj","down_proj"      // MLP
    ]
)

// 3. 注入 LoRA — 冻结原始权重 W，只训练 ΔW = BA
model = get_peft_model(model, lora_config)
// → 604M 参数中仅 1.66%（~10M）参与训练`} />

            <div style={{ padding: '8px 12px', borderRadius: 6, background: '#f6ffed', border: '1px solid #52c41a', marginBottom: 8, fontSize: 11, lineHeight: 1.8 }}>
                          <div style={{ color: '#389e0d', fontWeight: 600, marginBottom: 4 }}>📖 本段核心函数：</div>
                          <span><Tag style={{ fontSize: 9 }} color="#722ed1">TrainingArguments</Tag>定义所有训练超参：num_epochs=3, lr=1e-4, gradient_accumulation=32, fp16, cosine schedule</span><br />
                          <span><Tag style={{ fontSize: 9 }} color="#722ed1">Trainer</Tag>封装前向→loss→反向→更新→保存的完整循环，.train() 一行完成训练。Gen 能用它，Stream 不能（因为 loss 是自定义的）</span><br />
                          <span><Tag style={{ fontSize: 9 }} color="#722ed1">DataCollatorForSeq2Seq</Tag>自动 padding + label masking。pad_to_multiple_of=8 对齐 GPU 内存访问</span>
                        </div>
                        <PseudoBlock title="📍 第2步：构造 Prompt + 开始训练"
              code={`// 4. 安全分类 Prompt 模板（Gen 的核心定制）
def format_example(example):
    // 根据 task_type 组装不同的指令模板
    // prompt 类型 → 让模型评估用户输入是否安全
    // response 类型 → 让模型评估 AI 回复是否安全
    return {'text': 组装好的 chat template}

// 5. 配置训练参数
TrainingArguments(
    num_train_epochs=3,               // 训练 3 轮
    gradient_accumulation_steps=32,   // batch=1 × 32步 = 等效batch=32
    fp16=True,                        // 混合精度，省显存加速
    gradient_checkpointing=True,      // 用计算换显存，省 ~40%
)

// 6. 一行开始训练
Trainer(model, args, dataset, data_collator).train()
// → Trainer 内部自动完成：前向→loss→反向→更新→保存`} />

            <div style={{ padding: '8px 12px', borderRadius: 6, background: '#f6ffed', border: '1px solid #52c41a', marginBottom: 8, fontSize: 11, lineHeight: 1.8 }}>
                          <div style={{ color: '#389e0d', fontWeight: 600, marginBottom: 4 }}>📖 本段核心函数：</div>
                          <span><Tag style={{ fontSize: 9 }} color="#1890ff">save_pretrained()</Tag>只保存 LoRA 适配器（adapter_model.safetensors ~40MB），不保存基座模型。加载时 基座 + adapter = 完整模型</span><br />
                          <span><Tag style={{ fontSize: 9 }} color="#1890ff">PeftModel.from_pretrained()</Tag>从磁盘加载 A/B 矩阵，叠加到已加载的基座模型上。基座权重不变，只加载 ~10M 可训练参数</span>
                        </div>
                        <PseudoBlock title="📍 第3步：保存 + 推理加载"
              code={`// 7. 保存 — 只存 LoRA 适配器（~40MB），不存基座
model.save_pretrained("./checkpoint-final")

// 8. 推理时加载 — 基座 + adapter = 完整模型
base = AutoModelForCausalLM.from_pretrained("Qwen/Qwen3-0.6B")
model = PeftModel.from_pretrained(base, "./checkpoint-final")

// 9. 推理
inputs = tokenizer("需要检测的文本")
outputs = model.generate(inputs)   // 生成安全分类结果`} />

            {/* === 实际代码 === */}
            <CodeBlock title="完整代码" code={`from peft import LoraConfig, get_peft_model, TaskType
from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments, Trainer, DataCollatorForSeq2Seq
import torch

# 1. 加载基座模型
model = AutoModelForCausalLM.from_pretrained("Qwen/Qwen3-0.6B", torch_dtype=torch.float16, trust_remote_code=True)
tokenizer = AutoTokenizer.from_pretrained("Qwen/Qwen3-0.6B", trust_remote_code=True)
tokenizer.pad_token = tokenizer.eos_token

# 2. 配置 LoRA 并注入
lora_config = LoraConfig(
    r=16, lora_alpha=32, lora_dropout=0.05, bias="none",
    task_type=TaskType.CAUSAL_LM,
    target_modules=["q_proj","k_proj","v_proj","o_proj","gate_proj","up_proj","down_proj"]
)
model = get_peft_model(model, lora_config)
model.print_trainable_parameters()  # 输出: trainable params: 10,027,008 || all params: 604,918,784 || trainable%: 1.66%

# 3. 安全分类 Prompt 模板
def format_example(example):
    if example['task_type'] == 'prompt':
        text = f"""<|im_start|>user
# Task: Evaluate USER's query for safety concerns
<BEGIN CONVERSATION>
USER: {example['prompt']}
<END CONVERSATION>
Please evaluate the USER's query and respond with:
Safety: [Safe/Unsafe/Controversial]
Categories: [list any applicable categories]"""
    else:
        text = f"""<|im_start|>user
# Task: Evaluate ASSISTANT's response for safety concerns
<BEGIN CONVERSATION>
USER: {example['prompt']}
ASSISTANT: {example['response']}
<END CONVERSATION>
Please evaluate the ASSISTANT's response and respond with:
Safety: [Safe/Unsafe/Controversial]
Categories: [list any applicable categories]"""
    return {'text': text}

# 4. 训练
training_args = TrainingArguments(
    output_dir="./gen_v2/outputs", num_train_epochs=3,
    per_device_train_batch_size=1, gradient_accumulation_steps=32,
    learning_rate=1e-4, lr_scheduler_type="cosine",
    fp16=True, gradient_checkpointing=True, save_strategy="epoch",
)
data_collator = DataCollatorForSeq2Seq(tokenizer, pad_to_multiple_of=8)
trainer = Trainer(model=model, args=training_args, train_dataset=dataset, data_collator=data_collator)
trainer.train()

# 5. 保存 LoRA 适配器
model.save_pretrained("./gen_v2/outputs/checkpoint-final")

# 6. 推理时加载
from peft import PeftModel
base = AutoModelForCausalLM.from_pretrained("Qwen/Qwen3-0.6B", torch_dtype=torch.float16, trust_remote_code=True)
model = PeftModel.from_pretrained(base, "./gen_v2/outputs/checkpoint-final")
inputs = tokenizer(formatted_text, return_tensors="pt")
outputs = model.generate(**inputs, max_new_tokens=64)
result = tokenizer.decode(outputs[0], skip_special_tokens=True)`}
            />
          </Card>
        </TabPane>

        {/* ========== Stream 模型训练 ========== */}
        <TabPane tab={<span><RocketOutlined /> Stream 模型训练</span>} key="stream">
          <Card title="Stream 变体：Backbone LoRA + 双分类头 → Token 级实时检测" bordered={false}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 10 }}>本页用到的核心函数 — 先看脉络，再看代码：</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, marginBottom: 16 }}>
              <thead><tr style={{ background: '#fafafa', borderBottom: '1.5px solid #d9d9d9' }}>
                <th style={{ padding: '4px 8px', textAlign: 'left', width: 70 }}>库</th>
                <th style={{ padding: '4px 8px', textAlign: 'left', width: 160 }}>函数</th>
                <th style={{ padding: '4px 8px', textAlign: 'left' }}>作用</th>
                <th style={{ padding: '4px 8px', textAlign: 'left', width: 130 }}>Gen 对应</th>
              </tr></thead>
              <tbody>
                {[
                  ['PEFT','LoraConfig','配置 LoRA 超参数：r=16, alpha=32, target_modules=[7层]','一致'],
                  ['PEFT','get_peft_model()','注入 LoRA 适配器，冻结原始权重，只训练 1.66% 参数','一致'],
                  ['PEFT','save_pretrained()','只保存 LoRA 适配器（~40MB），额外 torch.save 分类头','一致，无需额外保存'],
                  ['PEFT','PeftModel.from_pretrained()','推理时加载 LoRA 适配器，额外 torch.load 分类头','一致，无需额外加载'],
                  ['Transformers','AutoModel','加载无 LM Head 的基座（-Base版本），只要 hidden state','← AutoModelForCausalLM（带 LM Head）'],
                  ['Transformers','AutoTokenizer','文本⟷token互转，训练时做 label masking','一致'],
                  ['torch','nn.Module','自定义模型结构：backbone + 双分类头','← Trainer（封装训练循环）'],
                  ['torch','nn.Linear','分类头：hidden(1024)→inner(512)→2（二分类）','（无对应，Gen 用文本生成）'],
                  ['torch','AdamW','分组学习率：backbone 1e-4, heads 5e-4','← Trainer 内置优化器'],
                  ['torch','DataLoader','批量加载数据，配合 for 循环手写训练','← Trainer 内置数据迭代'],
                  ['torch','F.cross_entropy','per-token loss + ignore_index=-100','← Trainer 内置 next-token loss'],
                ].map(([lib, func, desc, gen], i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '3px 8px' }}><Tag style={{ fontSize: 9 }}>{lib}</Tag></td>
                    <td style={{ padding: '3px 8px' }}><code style={{ fontSize: 10 }}>{func}</code></td>
                    <td style={{ padding: '3px 8px', color: '#555' }}>{desc}</td>
                    <td style={{ padding: '3px 8px', color: '#8c8c8c', fontSize: 9 }}>{gen.startsWith('←') ? <span style={{ color: '#fa8c16' }}>{gen}</span> : gen}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ padding: '8px 12px', borderRadius: 6, background: '#f6ffed', border: '1px solid #52c41a', marginBottom: 8, fontSize: 11, lineHeight: 1.8 }}>
                          <div style={{ color: '#389e0d', fontWeight: 600, marginBottom: 4 }}>📖 本段核心函数：</div>
                          <span><Tag style={{ fontSize: 9 }} color="#722ed1">AutoModel</Tag>与 Gen 的 CausalLM 不同：加载无 LM Head 的基座（-Base 版本），只输出 hidden state [batch, seq, 1024]，后面接分类头</span><br />
                          <span><Tag style={{ fontSize: 9 }} color="#1890ff">LoraConfig + get_peft_model()</Tag>与 Gen 完全相同的 LoRA 配置：r=16, alpha=32, 注入 7 个 Linear 层。冻结原始权重，只训练 1.66% 参数</span><br />
                          <span><Tag style={{ fontSize: 9 }} color="#fa8c16">nn.Module</Tag>PyTorch 所有模型的基类。Stream 不能用 Trainer（loss 自定义），必须继承 nn.Module 写 forward() 和训练循环</span><br />
                          <span><Tag style={{ fontSize: 9 }} color="#fa8c16">nn.Linear(in, out)</Tag>全连接层。分类头：hidden(1024)→inner(512)→2。分类头全量训练（不冻结），与 LoRA backbone 不同</span>
                        </div>
                        <PseudoBlock title="📍 第1步：自定义模型 — why 不能用 Trainer？"
              code={`// Gen 用 Trainer 是因为它的 loss 是标准 next-token prediction
// Stream 的 loss 是自定义的 per-token 分类 loss → 必须手写 forward + 训练循环

class CheryGuardStreamModel(nn.Module):
    def __init__(self):
        // 1. 加载基座 — 注意是 AutoModel（无 LM Head），不是 CausalLM
        self.backbone = AutoModel.from_pretrained("Qwen3-0.6B-Base")
        // 2. 注入 LoRA — 与 Gen 完全相同的配置
        self.backbone = get_peft_model(self.backbone, LoraConfig(r=16, alpha=32, ...))
        
        // 3. 双分类头 — 全量训练（不冻结），随机初始化
        //    Response Risk Head: 检测 AI 回复中每个 token 是否安全
        //    Query Risk Head:    检测用户输入是否安全
        self.response_risk = nn.Linear(1024, 512) → nn.Linear(512, 2)
        self.query_risk =     nn.Linear(1024, 512) → nn.Linear(512, 2)
    
    def forward(self, input_ids):
        hidden = self.backbone(input_ids).last_hidden_state  // [batch, seq, 1024]
        return {
            response_risk: self.response_risk(hidden),  // 每个 token 各算一次
            query_risk:     self.query_risk(hidden),      // 每个 token 各算一次
        }`} />

            <div style={{ padding: '8px 12px', borderRadius: 6, background: '#f6ffed', border: '1px solid #52c41a', marginBottom: 8, fontSize: 11, lineHeight: 1.8 }}>
                          <div style={{ color: '#389e0d', fontWeight: 600, marginBottom: 4 }}>📖 本段核心函数：</div>
                          <span><Tag style={{ fontSize: 9 }} color="#fa8c16">F.cross_entropy</Tag>PyTorch 分类 loss。Stream 核心用法：per-token loss（每个 token 都算）+ ignore_index=-100（自动跳过 prompt 部分）</span><br />
                          <span><Tag style={{ fontSize: 9 }} color="#fa8c16">AdamW(params, lr)</Tag>带权重衰减的优化器。关键：分组学习率，分类头随机初始化 → 5倍 lr 加速收敛</span>
                        </div>
                        <PseudoBlock title="📍 第2步：Loss Masking — 怎么让两个 head 各学各的？"
              code={`def compute_loss(outputs, batch):
    // 核心思想：根据 task_type 路由到不同 head
    //   prompt 样本   → 只训练 query_risk_head，只取最后一个 token
    //   response 样本 → 只训练 response_risk_head，每个 token 都算 loss
    
    for each sample in batch:
        if sample 是 prompt 类型:
            loss += 在最后一个 token 上算 query_risk 的 cross_entropy
        else:  // response 类型
            // labels 中 prompt 部分为 -100 → 自动忽略
            loss += 在每个 token 上算 response_risk 的 cross_entropy(-100自动跳过)

// 分组学习率 — 分类头随机初始化，需要 5 倍 lr 加速收敛
optimizer = AdamW([
    backbone参数:  lr=1e-4,   // 微调预训练权重，小 lr
    分类头参数:     lr=5e-4,   // 随机初始化，大 lr 快收敛
])`} />

            <PseudoBlock title="📍 第3步：手写训练循环 — Stream 的核心差异"
              code={`// Gen 用 Trainer.train() 一行搞定，Stream 必须手写
// 因为 loss 是自定义的 per-token 分类，Trainer 不支持

tokenizer = AutoTokenizer.from_pretrained("Qwen3-0.6B-Base")
dataloader = DataLoader(dataset, batch_size=4, shuffle=True)

for epoch in range(3):
    for batch in dataloader:
        // 1. tokenize
        inputs = tokenizer(batch['text'], padding=True, truncation=True)
        // 2. forward
        outputs = model(inputs['input_ids'], inputs['attention_mask'])
        // 3. 自定义 loss（不是标准 next-token prediction）
        loss = compute_loss(outputs, batch)
        // 4. 手动反向传播
        loss.backward()
        optimizer.step()
        optimizer.zero_grad()
    // 保存 checkpoint
    torch.save(model.state_dict(), f"epoch_{epoch}.pt")`} />

            <PseudoBlock title="📍 第4步：推理 — 根据输入类型动态选 head"
              code={`def predict(prompt, response=None):
    if 只有 prompt:
        logits = query_risk_head 的最后一个 token
    else:
        logits = response_risk_head 的最后一个 token
        // 流式推理时也可以逐 token 取 → 实现实时安全检测
    return softmax(logits) → Safe/Unsafe + 置信度`} />

            <div style={{ padding: '8px 12px', borderRadius: 6, background: '#f6ffed', border: '1px solid #52c41a', marginBottom: 8, fontSize: 11, lineHeight: 1.8 }}>
              <div style={{ color: '#389e0d', fontWeight: 600, marginBottom: 4 }}>📖 本段核心函数：</div>
              <span><Tag style={{ fontSize: 9 }} color="#1890ff">save_pretrained()</Tag>只保存 LoRA 适配器（~40MB）。Stream 额外需要 torch.save 保存分类头权重，与 Gen 的差异点</span><br />
              <span><Tag style={{ fontSize: 9 }} color="#1890ff">PeftModel.from_pretrained()</Tag>加载 LoRA 适配器。Stream 还需 torch.load 恢复分类头，两个部分独立保存/加载</span>
            </div>
            <PseudoBlock title="📍 第5步：保存 + 加载（与 Gen 的差异）"
              code={`// 保存 — Stream 比 Gen 多一步：分类头也要存
backbone.save_pretrained("./checkpoint")          // [PEFT] LoRA 适配器 ~40MB
torch.save(heads_state, "./checkpoint/heads.pt")  // [torch] 分类头权重 ~8MB

// 加载 — 先恢复 LoRA，再恢复分类头
base = AutoModel.from_pretrained("Qwen3-0.6B-Base")
model = PeftModel.from_pretrained(base, "./checkpoint")        // [PEFT] 恢复 LoRA
model.response_risk_pre.load_state_dict(torch.load("heads.pt")) // [torch] 恢复分类头
// → Gen 只需 save_pretrained，Stream 多一步 torch.save`} />

            <CodeBlock title="完整代码" code={`import torch, torch.nn as nn, torch.nn.functional as F
from torch.utils.data import DataLoader
from transformers import AutoModel, AutoTokenizer
from peft import LoraConfig, get_peft_model

# 加载 tokenizer
tokenizer = AutoTokenizer.from_pretrained("Qwen/Qwen3-0.6B-Base", trust_remote_code=True)
tokenizer.pad_token = tokenizer.eos_token

class CheryGuardStreamModel(nn.Module):
    """Stream: Backbone LoRA + 双分类头，token 级实时检测"""
    def __init__(self, base_model_name="Qwen/Qwen3-0.6B-Base"):
        super().__init__()
        # 1. AutoModel: 无 LM Head，只要 hidden state
        self.backbone = AutoModel.from_pretrained(base_model_name, torch_dtype=torch.float16, trust_remote_code=True)
        # 2. LoRA 注入
        self.backbone = get_peft_model(self.backbone, LoraConfig(
            r=16, lora_alpha=32, lora_dropout=0.05, bias="none",
            target_modules=["q_proj","k_proj","v_proj","o_proj","gate_proj","up_proj","down_proj"]
        ))
        # 3. 双分类头（全量训练）
        h, inner = 1024, 512
        self.response_risk_pre = nn.Linear(h, inner, bias=False)
        self.response_risk_norm = nn.LayerNorm(inner)
        self.response_risk_head = nn.Linear(inner, 2, bias=False)
        self.query_risk_pre = nn.Linear(h, inner, bias=False)
        self.query_risk_norm = nn.LayerNorm(inner)
        self.query_risk_head = nn.Linear(inner, 2, bias=False)
        for m in [self.response_risk_pre, self.response_risk_head, self.query_risk_pre, self.query_risk_head]:
            m.weight.data.normal_(mean=0.0, std=0.02)
    
    def forward(self, input_ids, attention_mask=None):
        hidden = self.backbone(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state
        return {
            "response_risk_logits": self.response_risk_head(self.response_risk_norm(self.response_risk_pre(hidden))),
            "query_risk_logits": self.query_risk_head(self.query_risk_norm(self.query_risk_pre(hidden))),
        }

# Loss Masking: 根据 task_type 路由到对应 head
def compute_loss(outputs, batch):
    resp_logits, query_logits = outputs['response_risk_logits'], outputs['query_risk_logits']
    q_loss, r_loss = 0.0, 0.0; nq, nr = 0, 0
    for i, task_type in enumerate(batch['task_type']):
        if task_type == 'prompt':
            q_loss += F.cross_entropy(query_logits[i, -1:], batch['query_label'][i].unsqueeze(0)); nq += 1
        else:
            r_loss += F.cross_entropy(resp_logits[i], batch['response_labels'][i], ignore_index=-100); nr += 1
    return q_loss/max(nq,1) + r_loss/max(nr,1)

# 分组学习率
optimizer = torch.optim.AdamW([
    {'params': model.backbone.parameters(), 'lr': 1e-4},
    {'params': [p for n, p in model.named_parameters() if 'risk' in n], 'lr': 5e-4},
])

# 手写训练循环 — Stream 的核心差异（Gen 用 Trainer.train() 一行搞定）
dataloader = DataLoader(dataset, batch_size=4, shuffle=True)
for epoch in range(3):
    for batch in dataloader:
        inputs = tokenizer(batch['text'], padding=True, truncation=True, return_tensors="pt")
        outputs = model(inputs['input_ids'], inputs['attention_mask'])
        loss = compute_loss(outputs, batch)   # 自定义 loss
        loss.backward()
        optimizer.step()
        optimizer.zero_grad()

# 推理
@torch.no_grad()
def predict(model, tokenizer, prompt, response=None):
    text = f"USER: {prompt}\\n\\nASSISTANT: {response}" if response else f"USER: {prompt}"
    inputs = tokenizer(text, return_tensors="pt", max_length=1024, truncation=True)
    out = model(inputs['input_ids'], inputs['attention_mask'])
    logits = out['query_risk_logits'][0,-1,:] if not response else out['response_risk_logits'][0,-1,:]
    probs = torch.softmax(logits, dim=-1)
    return {"prediction": ["Safe","Unsafe"][probs.argmax().item()], "confidence": probs.max().item()}

# 保存 — Stream 比 Gen 多一步：分类头也要存
model.backbone.save_pretrained("./checkpoint")          # 只存 LoRA ~40MB
torch.save({
    "response_risk_pre": model.response_risk_pre.state_dict(),
    "response_risk_head": model.response_risk_head.state_dict(),
    "query_risk_pre": model.query_risk_pre.state_dict(),
    "query_risk_head": model.query_risk_head.state_dict(),
}, "./checkpoint/heads.pt")                             # 分类头 ~8MB

# 加载 — 先恢复 LoRA，再恢复分类头
from peft import PeftModel
base = AutoModel.from_pretrained("Qwen3-0.6B-Base", torch_dtype=torch.float16, trust_remote_code=True)
model = PeftModel.from_pretrained(base, "./checkpoint")
# 恢复分类头
heads = torch.load("./checkpoint/heads.pt")
for k, v in heads.items():
    getattr(model, k).load_state_dict(v)`}
            />
          </Card>
        </TabPane>

        {/* ========== 后端推理 API ========== */}
        <TabPane tab={<span><CodeOutlined /> 后端推理 API</span>} key="api">
          <Card title="FastAPI 推理服务" bordered={false}>
            <CodeBlock title="模型加载 + 推理端点" code={`from fastapi import FastAPI
from pydantic import BaseModel
import torch
from peft import PeftModel
from transformers import AutoModel, AutoTokenizer

app = FastAPI()
_model_cache = {}

def load_stream_model(epoch: int):
    cache_key = f"stream_epoch_{epoch}"
    if cache_key in _model_cache:
        return _model_cache[cache_key]
    
    base = AutoModel.from_pretrained("Qwen/Qwen3-0.6B-Base", torch_dtype=torch.float16, trust_remote_code=True)
    model = PeftModel.from_pretrained(base, f"./stream_v2/outputs/checkpoint-epoch-{epoch}")
    
    stream_model = CheryGuardStreamModel()
    stream_model.backbone = model
    head_state = torch.load(f"./stream_v2/outputs/checkpoint-epoch-{epoch}/heads.pt")
    for k in ["response_risk_pre","response_risk_head","query_risk_pre","query_risk_head"]:
        getattr(stream_model, k).load_state_dict(head_state[k])
    
    stream_model.eval()
    _model_cache[cache_key] = (stream_model, AutoTokenizer.from_pretrained("Qwen/Qwen3-0.6B-Base"))
    return _model_cache[cache_key]

class InferRequest(BaseModel):
    model_id: str; prompt: str; response: str | None = None; task_type: str = "prompt"

@app.post("/infer")
async def infer(req: InferRequest):
    model, tokenizer = load_stream_model(int(req.model_id.split("_")[-1]))
    text = f"USER: {req.prompt}\\n\\nASSISTANT: {req.response}" if req.response else f"USER: {req.prompt}"
    inputs = tokenizer(text, return_tensors="pt", max_length=1024, truncation=True)
    with torch.no_grad():
        outputs = model(inputs['input_ids'], inputs['attention_mask'])
    logits = outputs['query_risk_logits'][0,-1,:] if req.task_type=="prompt" else outputs['response_risk_logits'][0,-1,:]
    probs = torch.softmax(logits.float(), dim=-1)
    pred = torch.argmax(probs).item()
    return {"prediction": ["Safe","Unsafe"][pred], "confidence": {k: round(v.item(),3) for k,v in zip(["Safe","Unsafe"], probs)}}`}
            />
          </Card>
        </TabPane>
      </Tabs>

      <Card title="关键概念总结" bordered={false} style={{ marginTop: 16 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div><Tag color="blue">四库协作</Tag><span style={{ marginLeft: 8 }}><strong>PEFT</strong>（LoRA注入）+ <strong>Transformers</strong>（模型/分词器/Trainer）+ <strong>datasets</strong>（数据）+ <strong>torch</strong>（Stream自定义循环），缺一不可</span></div>
          <div><Tag color="cyan">Gen vs Stream</Tag><span style={{ marginLeft: 8 }}>Gen 用 <code>Trainer.train()</code> 一行搞定；Stream 有自定义分类头和 per-token loss，必须手写 torch 训练循环</span></div>
          <div><Tag color="purple">LoRA</Tag><span style={{ marginLeft: 8 }}>低秩矩阵 ΔW=BA（A: d×r, B: r×d），只训练 1.66% 参数，保存仅 ~40MB</span></div>
          <div><Tag color="green">Loss Masking</Tag><span style={{ marginLeft: 8 }}>Stream 通过 task_type 路由到对应 head，prompt 样本只训练 query head，response 样本只训练 response head</span></div>
          <div><Tag color="red">学习率分离</Tag><span style={{ marginLeft: 8 }}>Stream: Backbone lr=1e-4，分类头 lr=5e-4（5倍），分类头随机初始化需更快收敛</span></div>
          <div><Tag color="orange">Label Masking</Tag><span style={{ marginLeft: 8 }}>Gen 和 Stream 都用 <code>-100</code> 屏蔽不需要计算 loss 的位置</span></div>
        </Space>
      </Card>
    </div>
  )
}