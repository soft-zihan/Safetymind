# LoRA 微调小模型做安全分类（Safety Guard / Content Moderation）调研报告

> 调研时间：2025年7月  
> 调研范围：2024-2025年公开论文、开源项目、HuggingFace 模型卡片  
> 目标：为 CheryGuard 项目提供技术方案参考

---

## 目录

1. [类似项目与论文](#1-类似项目与论文)
2. [架构变体](#2-架构变体)
3. [数据策略](#3-数据策略)
4. [训练技巧](#4-训练技巧)
5. [评估方法](#5-评估方法)
6. [对 CheryGuard 项目的具体建议](#6-对-cheryguard-项目的具体建议)

---

## 1. 类似项目与论文

### 1.1 Qwen3Guard（Qwen Team, 2025）

| 项目 | 详情 |
|------|------|
| **项目名** | Qwen3Guard |
| **模型** | 基于 Qwen3 基础架构，提供 0.6B / 4B / 8B 三种尺寸 |
| **数据量** | 119 万条样本（prompt + response），涵盖 119 种语言/方言 |
| **方法** | 两种变体：Gen（生成式 SFT）和 Stream（分类头） |
| **关键结果** | 0.6B 模型在多个 benchmark 上达到或超过 10 倍大模型的性能 |

**核心要点：**

- **Generative Qwen3Guard**：将安全分类建模为指令跟随任务，使用 vanilla SFT 在 Qwen3 instruction-tuned 模型上训练。输出三级分类（Safe / Controversial / Unsafe）+ 安全类别。
- **Stream Qwen3Guard**：在 backbone 最后一层隐藏状态上添加两个并行分类头（Prompt Moderator + Response Moderator），实现 token 级实时安全检测。使用交叉熵损失训练分类头，backbone 冻结。
- **训练数据构建**：
  - Prompt 合成：Self-Instruct 框架 + 关键词引导 + 正负样本配对
  - Response 收集：人工撰写 + 模型生成（含 base model 生成 unsafe response）
  - 自动标注：多版本 Qwen 模型投票，F1 > 0.9
  - Controversial 标签：通过训练 Strict/Loose 两个模型，对预测冲突的样本标记为 Controversial
  - 标签蒸馏：使用 Qwen3-32B 作为 teacher 精炼标签
- **关键发现**：
  - 0.6B-Gen 模型英文 prompt 分类平均 F1 达 88.1%，接近 8B 模型的 90.0%
  - 0.6B-Gen 模型中文 response 分类平均 F1 达 84.9%，超过多数 7B+ 模型
  - Stream 变体相比 Gen 变体性能仅下降约 2 个点，但推理效率大幅提升
  - **数据平衡对模型行为影响显著**：Safe/Unsafe 比例从 1:1 变为 2:1 时，模型会变得更宽松

**论文来源**：https://arxiv.org/abs/2510.14276  
**模型权重**：https://huggingface.co/Qwen/Qwen3Guard-Gen-4B 等（Apache 2.0）

---

### 1.2 WildGuard（Allen AI, 2024）

| 项目 | 详情 |
|------|------|
| **项目名** | WildGuard |
| **模型** | 基于 Mistral-7B-v0.3 instruction-tune |
| **数据量** | WildGuardTrain: 86,759 条（48,783 独立 prompt + 37,976 prompt-response 对） |
| **方法** | 统一输入输出格式的 instruction-tune，多任务联合训练 |
| **关键结果** | 在 prompt 有害性、response 有害性、refusal 检测三个任务上全面超越 Llama-Guard2 |

**核心要点：**

- 统一格式设计：同时处理三个任务（prompt harm / response harm / refusal detection）
- 数据来源四类：合成对抗样本、合成普通样本、In-the-Wild 数据、标注数据集
- 覆盖 13 个风险类别
- **多任务训练优于单任务**：ablation 证实联合训练提升整体性能
- WildGuardTest: 5,299 条人工标注高质量测试集
- **base model 选择实验**：Mistral-7B-v0.3 表现最佳，但差异不大，说明数据质量比模型选择更重要
- Refusal 检测 F1 达 92.8%，远超 Llama-Guard2 的 64.1%

**论文来源**：https://arxiv.org/abs/2406.18495  
**代码/数据**：https://github.com/allenai/wildguard（Apache 2.0）

---

### 1.3 Aegis 2.0 / Aegis Guard（NVIDIA, 2024-2025）

| 项目 | 详情 |
|------|------|
| **项目名** | Aegis 2.0 |
| **模型** | 基于 Llama 系列微调 |
| **数据量** | Aegis 数据集约 10,800 条（NVIDIA Aegis AI Content Safety Dataset） |
| **方法** | 基于 Llama-Guard 架构，参数高效微调（PEFT） |
| **关键结果** | 被广泛用作 benchmark，Aegis-Guard-P 的 prompt F1 约 80% |

**核心要点：**

- Aegis 2.0 数据集是目前最大的多源安全数据集之一，被 NeurIPS 2024 收录
- NVIDIA 的 Aegis-AI-Content-Safety-LlamaGuard-Defensive-1.0 是基于 Llama2-7B 的 PEFT 微调版本
- 使用 Nemotron Content Safety 数据集训练，覆盖 23 个不安全类别
- Llama-3.1-NemoGuard-8B-Content-Safety 是更新版本，基于 Llama 3.1

**论文来源**：https://aclanthology.org/2025.naacl-long.306.pdf  
**数据集**：https://huggingface.co/datasets/nvidia/Aegis-AI-Content-Safety-Dataset-1.0

---

### 1.4 OmniGuard（UW + Microsoft, 2025）

| 项目 | 详情 |
|------|------|
| **项目名** | OmniGuard |
| **模型** | 基于 LLM 内部表示 + MLP 分类头（不修改原模型） |
| **数据量** | 仅 2,800 条 Aegis 数据（平衡类别），比 baseline 少 18 倍 |
| **方法** | 提取 LLM 中间层 universal representations → 训练轻量 MLP 分类器 |
| **关键结果** | 多语言有害 prompt 检测平均准确率 86.22%（53 种自然语言），训练数据极少 |

**核心要点：**

- **架构创新**：不训练独立的 guard 模型，而是在已有 LLM 内部表示上构建分类器
- 使用 U-Score 指标选择跨语言/跨模态 universal 的层
- 分类器为 2 层 MLP（hidden sizes: 512, 256）
- 训练时只学习分类器参数，LLM 完全不修改
- **极高的数据效率**：仅 2,800 条样本即可达到优秀效果
- 推理时复用 LLM 已有 embedding，无额外前向传播开销
- 支持文本（73 种语言）、图像、音频多模态

**论文来源**：https://arxiv.org/abs/2505.23856（EMNLP 2025）

---

### 1.5 Llama Guard 系列（Meta, 2023-2025）

| 项目 | 详情 |
|------|------|
| **项目名** | Llama Guard 3 / Llama Guard 4 |
| **模型** | Llama Guard 3 基于 Llama 3.1-8B，Llama Guard 4 基于 12B |
| **数据量** | 未公开训练数据 |
| **方法** | 基于 instruction-tuned LLM 的安全分类，生成式输出 |
| **关键结果** | Llama Guard 3-8B 平均 prompt F1 约 79.4%，response F1 约 70.7% |

**核心要点：**

- 将安全分类建模为指令跟随任务
- 使用可定制的安全风险分类体系
- 开源模型权重但不公开训练数据
- 被广泛用作 baseline，但性能已被 WildGuard 和 Qwen3Guard 超越

---

### 1.6 ShieldGemma（Google, 2024）

| 项目 | 详情 |
|------|------|
| **项目名** | ShieldGemma |
| **模型** | 基于 Gemma 2 架构，提供 2B / 9B / 27B 三种尺寸 |
| **数据量** | 未公开 |
| **方法** | 类似 Llama Guard 的生成式安全分类 |
| **关键结果** | 9B 模型 prompt F1 约 70.4%，表现不如同级别的 WildGuard 和 Qwen3Guard |

---

### 1.7 Simple-Safety（eepy-engineering, 2024）

| 项目 | 详情 |
|------|------|
| **项目名** | Simple-Safety |
| **模型** | 微调 LLM 做 content moderation |
| **数据量** | 未公开详细数据 |
| **方法** | 针对内容分类任务的 fine-tuned LM |
| **关键结果** | 开源模型权重，适合轻量部署 |

**代码**：https://github.com/eepy-engineering/simple-safety

---

### 1.8 SaLoRA（ICLR 2025）

| 项目 | 详情 |
|------|------|
| **项目名** | SaLoRA (Safety-Alignment Preserved LoRA) |
| **模型** | 通用 LoRA 变体 |
| **方法** | 在 LoRA 微调时保持原有安全对齐不被破坏 |
| **关键结果** | 解决了 LoRA 微调导致安全性下降的问题 |

**核心要点：**

- 发现 LoRA 相比全量微调，权重更新与原始权重的重叠更小
- 提出针对性方法保持安全对齐
- 对安全分类场景有重要参考价值

**论文来源**：https://yangzhangalmo.github.io/papers/ICLR25.pdf

---

### 1.9 Safe LoRA（NeurIPS 2024）

| 项目 | 详情 |
|------|------|
| **项目名** | Safe LoRA |
| **方法** | 在 LoRA 微调过程中减少安全风险 |
| **关键结果** | 在保持模型效用的同时大幅降低安全风险，utility 达到 49.04%（接近全量微调），harmfulness score 降低约 0.4 |

**论文来源**：https://neurips.cc/virtual/2024/poster/95821

---

## 2. 架构变体

### 2.1 CausalLM SFT（生成式安全分类）

**原理**：将安全分类建模为文本生成任务，模型接收指令 + 待分类内容，生成安全标签。

**代表项目**：Qwen3Guard-Gen、WildGuard、Llama Guard、ShieldGemma

**优点**：
- 利用 LLM 强大的语言理解能力
- 可生成细粒度分类（Safe / Controversial / Unsafe）+ 安全类别
- 灵活适配不同安全策略（通过修改指令）
- 支持 refusal 检测等多任务

**缺点**：
- 推理延迟高（需自回归生成）
- 不适合流式检测
- 小模型可能无法很好地遵循复杂指令

**Qwen3Guard 实验数据**：
- 0.6B-Gen 英文 prompt 平均 F1: 88.1%
- 4B-Gen 英文 prompt 平均 F1: 89.3%
- 8B-Gen 英文 prompt 平均 F1: 90.0%

---

### 2.2 SeqClassification Head（分类头方式）

**原理**：冻结 backbone，在最后一层隐藏状态上添加线性分类头（MLP），用交叉熵损失训练。

**代表项目**：Qwen3Guard-Stream、OmniGuard

**Qwen3Guard-Stream 架构细节**：
```
h = backbone_last_hidden_state
x_r = LayerNorm(W_r-pre · h)    # Response 分支
x_q = LayerNorm(W_q-pre · h)    # Query 分支
y_r-risk = Softmax(W_r-risk · x_r)  # Response 风险等级
y_r-cat  = Softmax(W_r-cat · x_r)   # Response 安全类别
y_q-risk = Softmax(W_q-risk · x_q)  # Query 风险等级
y_q-cat  = Softmax(W_q-cat · x_q)   # Query 安全类别
```

**优点**：
- 推理极快，支持 token 级流式检测
- 分类头参数极少（仅几个小矩阵）
- 训练简单，只优化分类头
- 延迟与响应长度几乎线性相关（vs 生成式呈平方增长）

**缺点**：
- 仅利用最后一层表示，语义理解可能不够深入
- 性能略低于生成式（Qwen3Guard 实验显示约 2 个点差距）
- 灵活性较低，难以适配动态安全策略

**Qwen3Guard-Stream 实验数据**：
- 0.6B-Stream 英文 prompt 平均 F1: 86.3%（vs Gen 88.1%，差距 1.8）
- 4B-Stream 英文 prompt 平均 F1: 89.1%（vs Gen 89.3%，差距 0.2）
- 8B-Stream 英文 prompt 平均 F1: 88.3%（vs Gen 90.0%，差距 1.7）

---

### 2.3 Backbone LoRA + Classification Head 混合架构

**原理**：对 backbone 施加 LoRA 微调（而非完全冻结），同时保留分类头。

**代表项目**：PolyGuard、DuoGuard（LoRA rank=8, alpha=16）

**OmniGuard 的对比实验**：
- PolyGuard 使用 LoRA 微调所有线性层，rank=8, alpha=16
- OmniGuard 仅训练 MLP 分类头（backbone 完全冻结）
- 结果：OmniGuard 在多语言场景下比 LoRA 微调的 PolyGuard 更高效，且性能相当或更优

**适用场景分析**：
- 如果数据量充足（>10K），LoRA + 分类头可能带来额外收益
- 如果数据量有限（<5K），完全冻结 backbone + 分类头可能更稳健（避免过拟合）
- LoRA 可帮助模型适配特定领域的安全策略

---

### 2.4 不同 LoRA Rank/Alpha 对安全分类效果的影响

**通用经验**（来自多个项目和 LoRA 超参数指南）：

| Rank | Alpha | 适用场景 | 说明 |
|------|-------|---------|------|
| 4 | 8-16 | 简单分类任务 | 参数最少，适合数据量小的场景 |
| 8 | 16 | 安全分类推荐起点 | OmniGuard/PolyGuard 实验验证 |
| 16 | 32 | 复杂安全策略 | 更多可学习参数，适合需要细粒度分类的场景 |
| 32 | 64 | 多任务/多语言 | 适合需要跨语言泛化的场景 |
| 64+ | 128+ | 接近全量微调 | 小模型上可能过拟合 |

**关键发现**：
- **Rank 应 ≥ Alpha**（Unsloth 指南建议）
- 小模型（<2B）建议使用较大的 rank（相对模型尺寸），因为可学习容量有限
- 安全分类任务通常不需要很高的 rank，8-16 是良好起点
- Alpha 通常设为 rank 的 1-2 倍

---

## 3. 数据策略

### 3.1 数据量需求

| 数据量 | 适用方法 | 预期效果 | 参考案例 |
|--------|---------|---------|---------|
| **50-100 条** | Few-shot prompting | 基线水平 | OpenAI 文档建议的最低限度 |
| **500-1,000 条** | 分类头训练 | 可用水平 | OmniGuard 用 2,800 条达到优秀效果 |
| **2,000-5,000 条** | LoRA SFT | 良好水平 | 多数安全分类项目的起步数据量 |
| **10,000-50,000 条** | LoRA/全量 SFT | 优秀水平 | WildGuard 用 87K 条达到 SOTA |
| **100,000+ 条** | 全量 SFT + 多阶段训练 | 顶尖水平 | Qwen3Guard 用 1.19M 条 |

**关键洞察**：
- OmniGuard 仅用 2,800 条数据（来自 Aegis 数据集的子集）就达到了跨 73 种语言的良好效果，说明 **数据质量 >> 数据数量**
- WildGuard 的 ablation 显示每个数据组成部分都对最终效果有贡献
- 对于简单二分类任务，1,000-5,000 条高质量数据通常足够
- 对于多类别 + 多级分类，建议至少 10,000 条

---

### 3.2 数据平衡（Safe/Unsafe 比例）

**Qwen3Guard 的关键发现**：

> "训练数据中的标签分布显著影响模型对潜在有害内容的容忍度。例如，相比 1:1 的 Safe/Unsafe 平衡训练集，将 Safe 样本比例翻倍会导致模型变得更宽松，使其将某些边界测试样本从 Unsafe 重新分类为 Safe。"

**最佳实践**：

| 比例 (Safe:Unsafe) | 效果 | 适用场景 |
|---------------------|------|---------|
| 1:1 | 平衡的精确率/召回率 | 通用安全分类 |
| 2:1 (偏 Safe) | 模型更宽松，recall 更高但 precision 下降 | 对误拦截敏感的场景 |
| 1:2 (偏 Unsafe) | 模型更保守，precision 更高但 recall 下降 | 安全优先的场景 |
| 动态调整 | 通过 Strict/Loose 模式适配不同策略 | Qwen3Guard 的 Controversial 方案 |

**建议**：
- 初始实验使用 1:1 平衡比例
- 部署时根据实际误报/漏报情况调整
- 考虑引入 Controversial 类别来处理边界样本

---

### 3.3 多源数据混合 vs 单一数据集

**各项目的数据策略**：

| 项目 | 数据源 | 混合策略 |
|------|--------|---------|
| Qwen3Guard | 人工标注 + 合成 + 模型生成 + 翻译 | 多源混合，119 语言 |
| WildGuard | 合成 + In-the-Wild + 标注数据 | 4 种来源，精心平衡 |
| OmniGuard | Aegis 子集 + 翻译 | 单源扩展至多语言 |
| Aegis 2.0 | 多源众包 + 合成 | 10,800 条，覆盖广泛 |

**最佳实践**：
1. **多源混合优于单一来源**：WildGuard 的 ablation 证实每个数据组成部分都不可或缺
2. **合成数据 + 真实数据混合**：
   - 合成数据保证覆盖度和平衡性
   - 真实数据保证分布一致性
3. **正负样本配对**（Qwen3Guard 策略）：生成结构相似但标签相反的样本对，防止模型学习虚假的语法线索
4. **数据去噪**：Qwen3Guard 使用蒸馏方法精炼标签，平均提升 0.47-1.10 个 F1 点

---

## 4. 训练技巧

### 4.1 小模型 LoRA 微调的常见超参数配置

**推荐配置（0.6B-1.5B 模型，安全分类任务）**：

```yaml
# LoRA 配置
lora_r: 8                    # rank，安全分类不需要太高
lora_alpha: 16               # alpha = 2 * rank
lora_dropout: 0.05           # 防止过拟合
target_modules:              # 目标模块
  - q_proj
  - k_proj
  - v_proj
  - o_proj
  # 可选：gate_proj, up_proj, down_proj（增加容量但更多参数）

# 训练配置
learning_rate: 2e-4          # LoRA 常用学习率
lr_scheduler: cosine         # 余弦退火
warmup_ratio: 0.03           # 3% warmup
num_train_epochs: 3-5        # 小数据 3 epoch，大数据 5 epoch
per_device_train_batch_size: 8-16
gradient_accumulation_steps: 4-8
max_seq_length: 512-1024     # 安全分类通常不需要太长
weight_decay: 0.01
bf16: true                   # 如果硬件支持

# 数据配置
safe_unsafe_ratio: 1:1       # 初始平衡
max_samples: 5000-10000      # 起步数据量
```

**参考来源**：
- PolyGuard/DuoGuard: rank=8, alpha=16, lr=2e-4, 1 epoch
- Unsloth LoRA 指南: rank ≥ alpha，小模型用较大 rank
- Qwen3Guard Stream: 仅训练分类头，使用交叉熵损失

---

### 4.2 MPS (Apple Silicon) 训练注意事项

**支持情况**：
- PyTorch MPS backend 已支持大部分 LoRA 训练操作
- HuggingFace Transformers + PEFT 在 MPS 上基本可用
- MLX 框架提供原生 Apple Silicon 支持

**已知问题和解决方案**：

| 问题 | 解决方案 |
|------|---------|
| 部分操作不支持 | 使用 `torch.backends.mps.is_available()` 检查，fallback 到 CPU |
| bf16 不支持 | MPS 目前主要支持 fp16/fp32，使用 fp16 替代 bf16 |
| 内存限制 | 0.6B-1.5B 模型在 16GB 内存的 Mac 上可训练 |
| 训练速度慢于 CUDA | 预期行为，0.6B 模型可接受 |
| `torch.compile` 不支持 | 去掉 compile 调用 |

**推荐工具链**：
1. **MLX + mlx-lm**：Apple 原生框架，效率最高
   ```bash
   pip install mlx mlx-lm
   # 支持 LoRA 微调，原生 MPS 加速
   ```

2. **HuggingFace + PEFT**：通用性最好
   ```python
   import torch
   device = "mps" if torch.backends.mps.is_available() else "cpu"
   model = AutoModelForCausalLM.from_pretrained(..., torch_dtype=torch.float16)
   # 使用 PEFT 的 LoRA
   ```

3. **Unsloth**：优化的 LoRA 训练框架
   - 部分支持 MPS
   - 提供 2x 训练加速

**实际建议**：
- 0.6B 模型在 M1/M2 Mac（16GB+）上可以直接训练
- 1.5B 模型建议使用 32GB+ 内存的 Mac
- batch size 设小（1-4），用 gradient accumulation 补偿
- 使用 fp16 而非 bf16
- 监控内存使用，必要时启用 gradient checkpointing

---

### 4.3 过拟合检测和缓解策略

**检测方法**：

1. **训练/验证 loss 曲线**：
   - 训练 loss 持续下降但验证 loss 开始上升 → 过拟合信号
   - 安全分类任务中，验证集应包含多样化的边界样本

2. **F1 分数监控**：
   - 训练 F1 接近 1.0 但验证 F1 停滞或下降
   - 特别关注 Unsafe 类别的 recall（过拟合时往往先下降）

3. **分类边界测试**：
   - 定期在 Controversial 样本上测试
   - 过拟合模型往往对边界样本的预测变得极端

**缓解策略**：

| 策略 | 说明 | 效果 |
|------|------|------|
| **LoRA dropout** | 设为 0.05-0.1 | 基础正则化 |
| **Early stopping** | 监控验证集 F1，patience=2-3 epochs | 最直接的防过拟合 |
| **数据增强** | 正负样本配对、回译增强 | Qwen3Guard 验证有效 |
| **标签平滑** | label smoothing = 0.05-0.1 | 减少过置信 |
| **减少 LoRA rank** | 从 16 降到 8 或 4 | 减少可学习参数 |
| **增加 weight decay** | 0.01 → 0.05 | 限制权重大小 |
| **减少训练 epoch** | 3 → 1-2 | 小数据集尤其重要 |
| **冻结更多层** | 只训练最后几层的 LoRA | 减少适配容量 |

**Qwen3Guard 的经验**：
- 使用多阶段训练 + 数据精炼来避免过拟合
- 将数据分为两部分，交叉训练和验证标签
- Controversial 标签的引入本身就是一种正则化手段

---

## 5. 评估方法

### 5.1 标准评估指标

| 指标 | 公式 | 侧重点 | 安全分类中的意义 |
|------|------|--------|----------------|
| **F1 Score** | 2·P·R/(P+R) | 精确率与召回率的调和平均 | **最核心指标**，平衡误报和漏报 |
| **Precision** | TP/(TP+FP) | 预测为 Unsafe 中真正 Unsafe 的比例 | 高 precision → 少误报（不过度拦截） |
| **Recall** | TP/(TP+FN) | 真正 Unsafe 中被检出的比例 | 高 recall → 少漏报（不放过有害内容） |
| **F1 (Safe)** | 同上 | Safe 类别的 F1 | 评估模型对安全内容的识别 |
| **Refusal F1** | 同上 | Refusal 检测的 F1 | 评估模型判断是否拒绝回答 |

**安全分类的特殊考量**：
- **Strict vs Loose 模式**（Qwen3Guard 提出）：
  - Strict: Controversial → Unsafe（高 recall，低 precision）
  - Loose: Controversial → Safe（高 precision，低 recall）
- 不同 benchmark 的安全策略差异很大，需要根据部署场景选择模式
- **Refusal 检测**同样重要：避免过度拒绝安全请求

---

### 5.2 常用 Benchmark 数据集对比

| Benchmark | 任务 | 规模 | 语言 | 特点 |
|-----------|------|------|------|------|
| **ToxicChat** | Prompt 分类 | ~10K | 英文 | In-the-wild 用户数据 |
| **OpenAIMod** | Prompt 分类 | ~10K | 英文 | OpenAI 标注，标准较宽松 |
| **Aegis / Aegis 2.0** | Prompt + Response | 10.8K | 英文 | 多类别，NeurIPS 数据集 |
| **HarmBench** | Prompt + Response | ~500 | 英文 | 对抗性样本为主 |
| **SimpleSafetyTests** | Prompt 分类 | ~100 | 英文 | 简单直接的安全测试 |
| **WildGuardTest** | 三任务 | 5,299 | 英文 | 人工标注，覆盖对抗样本 |
| **SafeRLHF** | Response 分类 | ~3K | 英文 | 含 helpfulness 标注 |
| **BeaverTails** | Response 分类 | ~30K | 英文 | 14 个有害类别 |
| **XSTest** | Response + Refusal | ~450 | 英文 | 过度安全测试 |
| **RTP-LX** | Prompt 分类 | 30.3K | 28 语言 | 多语言基准 |
| **PolyGuard** | Response 分类 | - | 10 语言 | 多语言 response 安全 |

**评估建议**：
- 至少评估 3 个以上 benchmark 以获得全面结果
- 英文 + 中文 benchmark 必须覆盖
- 注意不同 benchmark 的安全策略差异（Qwen3Guard 论文 Figure 4 清楚展示了这一点）
- 对抗性样本（如 HarmBench）和普通样本（如 ToxicChat）的性能差距值得关注

---

### 5.3 LoRA vs 全量微调的性能差距量化

**现有证据**：

| 研究/项目 | 任务 | LoRA 性能 | 全量微调性能 | 差距 |
|-----------|------|----------|-------------|------|
| Safe LoRA (NeurIPS 2024) | 安全对齐 | utility 49.04% | ~50% | <1% |
| Qwen3Guard-Stream vs Gen | 安全分类 | N/A（分类头） | N/A（SFT） | Stream 比 Gen 低约 2 F1 |
| PolyGuard (LoRA) vs OmniGuard | 多语言安全 | rank=8 LoRA | 冻结 backbone | OmniGuard 更优 |
| 通用 LoRA 研究 | 多种任务 | 接近全量 | 全量 | 通常 <2% |

**关键结论**：
1. **LoRA 在安全分类任务上与全量微调差距很小**（通常 <2 个 F1 点）
2. 对于小模型（<2B），LoRA 的优势更明显：
   - 训练成本低得多
   - 不容易破坏预训练知识
   - 可以方便地切换不同安全策略的 adapter
3. 全量微调的优势在于：
   - 可以更深入地改变模型行为
   - 适合需要大幅调整安全策略的场景
4. **对于 CheryGuard 的 0.6B-1.5B 模型，LoRA 是最佳选择**

---

## 6. 对 CheryGuard 项目的具体建议

### 6.1 架构选择

**推荐方案：双轨并行**

1. **快速方案（CheryGuard-Stream）**：
   - 基于 Qwen3-0.6B 或 Qwen2.5-1.5B
   - 冻结 backbone，添加分类头（参考 Qwen3Guard-Stream 架构）
   - 用于实时流式安全检测
   - 训练简单，推理快速

2. **高精度方案（CheryGuard-Gen）**：
   - 基于 Qwen3-0.6B 或 Qwen2.5-1.5B-Instruct
   - LoRA 微调（rank=8, alpha=16）做生成式安全分类
   - 用于离线安全评估和 RL 反馈信号
   - 支持细粒度分类和安全策略定制

### 6.2 数据策略

**阶段一（快速启动）**：
- 收集 2,000-5,000 条高质量标注数据
- Safe:Unsafe = 1:1 平衡
- 来源：公开数据集子集（Aegis, BeaverTails, WildGuardTrain）+ 内部业务数据
- 包含正负样本配对（结构相似但标签相反）

**阶段二（持续优化）**：
- 扩展到 10,000-50,000 条
- 引入 Controversial 类别
- 使用 teacher model（如 Qwen3Guard-4B/8B）进行自动标注 + 人工审核
- 标签蒸馏精炼

**阶段三（生产优化）**：
- 100,000+ 条多语言数据
- 多阶段训练 + 数据精炼
- 针对中文场景优化

### 6.3 训练配置建议

```yaml
# 推荐训练配置（CheryGuard-Gen，LoRA 方案）
model_name: Qwen/Qwen2.5-1.5B-Instruct  # 或 Qwen3-0.6B
lora_r: 8
lora_alpha: 16
lora_dropout: 0.05
target_modules: [q_proj, k_proj, v_proj, o_proj]
learning_rate: 2e-4
lr_scheduler: cosine
warmup_ratio: 0.05
num_train_epochs: 3
per_device_train_batch_size: 8
gradient_accumulation_steps: 4
max_seq_length: 512
weight_decay: 0.01
fp16: true  # MPS 兼容

# 评估策略
eval_strategy: epoch
metric_for_best_model: eval_f1
load_best_model_at_end: true
early_stopping_patience: 2
```

### 6.4 评估方案

**必须评估的 benchmark**：
1. ToxicChat（英文 prompt）
2. WildGuardTest（英文三任务）
3. HarmBench（对抗样本）
4. Aegis 2.0（多类别）
5. 中文 benchmark（如有）
6. 内部业务测试集

**目标性能**（参考 Qwen3Guard-0.6B）：
- 英文 Prompt F1 ≥ 85%
- 英文 Response F1 ≥ 80%
- 中文 Prompt F1 ≥ 80%
- Refusal F1 ≥ 90%

### 6.5 MPS 训练建议

如果团队使用 Apple Silicon Mac 开发：
1. 0.6B 模型 + LoRA 可在 16GB Mac 上训练
2. 使用 fp16（不用 bf16）
3. batch size 设为 1-4，gradient accumulation 补偿
4. 推荐先用 MLX 框架快速验证，再用 HuggingFace 正式训练
5. 正式训练建议使用 CUDA GPU（云服务器）

### 6.6 关键风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| 数据量不足 | 先用公开数据集 + 合成数据，teacher model 辅助标注 |
| 过拟合 | LoRA dropout + early stopping + 数据增强 |
| 安全策略不一致 | 引入 Controversial 类别，提供 Strict/Loose 两种模式 |
| 小模型能力有限 | 优先选 Qwen3-0.6B（已验证有效），必要时升级到 1.5B |
| 微调破坏安全性 | 参考 SaLoRA/Safe LoRA 的方法，保留安全对齐 |
| 中文效果不佳 | 增加中文数据比例，利用 Qwen3 的多语言基础 |

---

## 附录：关键论文和项目链接

| 资源 | 链接 |
|------|------|
| Qwen3Guard 论文 | https://arxiv.org/abs/2510.14276 |
| Qwen3Guard 模型 | https://huggingface.co/Qwen/Qwen3Guard-Gen-4B |
| WildGuard 论文 | https://arxiv.org/abs/2406.18495 |
| WildGuard 代码 | https://github.com/allenai/wildguard |
| OmniGuard 论文 | https://arxiv.org/abs/2505.23856 |
| Aegis 2.0 论文 | https://aclanthology.org/2025.naacl-long.306.pdf |
| Aegis 数据集 | https://huggingface.co/datasets/nvidia/Aegis-AI-Content-Safety-Dataset-1.0 |
| Safe LoRA | https://neurips.cc/virtual/2024/poster/95821 |
| SaLoRA | https://yangzhangalmo.github.io/papers/ICLR25.pdf |
| Llama Guard 3 | https://huggingface.co/meta-llama/Llama-Guard-3-8B |
| ShieldGemma | https://huggingface.co/google/shieldgemma-9b |
| Simple-Safety | https://github.com/eepy-engineering/simple-safety |
| Unsloth LoRA 指南 | https://unsloth.ai/docs/get-started/fine-tuning-llms-guide/lora-hyperparameters-guide |
| MLX 框架 | https://github.com/ml-explore/mlx |
| LoRA 原论文 | https://arxiv.org/abs/2106.09685 |
