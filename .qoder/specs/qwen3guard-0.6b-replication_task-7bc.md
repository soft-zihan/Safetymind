# CheryGuard-0.6B 复刻方案（v4 最终版）

## 社区参考经验

调研了现有社区复刻方案，按关联度排序：

| 项目 | 方法 | 数据 | 效果 | 核心借鉴 |
|------|------|------|------|----------|
| **tinysafe-3** (jdleo) | QLoRA on Qwen3-4B-Instruct, CausalLM, 教师蒸馏 | ~9.5K（WildGuard+ToxicChat+BeaverTails）+ 679 合成边界样本 | TC F1=0.822，与 Qwen3Guard-4B 差 0.6% | 教师蒸馏是关键；constitution system prompt 带来 +18.6 F1；~10K 清洁数据足够；label quality > everything |
| **Vera** (Yunhao-Feng) | LoRA SFT on Qwen3Guard-8B, LLaMA-Factory | 39K 攻击轨迹 + 安全测试用例 | F1=0.941（vs 0.637 base），提升巨大 | lr=1e-5 更保守；rank=32/alpha=64；LLaMA-Factory 框架可简化训练 |
| **geoffmunn/Qwen3Guard** | LoRA on Qwen3-4B, SeqClassification | 自定义 JSONL 二分类 | 仅 Star Trek 分类 Demo | SeqClassification 简单但非官方方案，CausalLM 更优 |

**关键经验总结**（来自 tinysafe-3 博客的 7 个 Lessons）：

| # | 教训 | 对我们方案的影响 |
|---|------|------------------|
| 1 | **Label quality > everything**：数据标签质量比架构、正则化都重要 | 教师蒸馏是必须的，不能直接使用原始数据集标签 |
| 2 | **Encoder-only 有天花板**：只能做表面模式匹配，不理解意图 | 确认 CausalLM 路线正确 |
| 3 | **System prompt IS the labeling philosophy**：不同 prompt 导致标签完全不同 | 教师的 constitution prompt 需要精心设计，嵌入 Qwen3Guard 九类安全策略 |
| 4 | **Early evals lie**：小样本评估不可靠 | 必须用官方 Qwen3GuardTest 全量评估 |
| 5 | **Broad hard negatives don't break the precision-recall wall** | 合成数据需要针对具体错误集群，按比例生成 |
| 6 | **Teacher first, then distill**：先构建能超过目标分数的教师，再蒸馏 | 先用 qwen3.7-plus + constitution prompt 验证教师效果，再标注全部数据 |
| 7 | **The 0.83 wall is real**：精度-召回率在此水平是 1:1 互换 | 0.6B 模型预期 F1 天花板更低，设置合理目标 |

**Vera 训练参数**（实际微调 Qwen3Guard 的参考）：
```yaml
lora_rank: 32
lora_alpha: 64
lora_dropout: 0.05
learning_rate: 1e-5          # 比我们之前设想的 2e-4 保守 20x
epochs: 3
per_device_batch: 1
grad_accum: 8                # 有效 batch=8
cutoff_len: 32768
warmup_ratio: 0.03
template: qwen3
enable_thinking: false
framework: LLaMA-Factory
```

## 核心决策

| 决策 | 结论 | 依据 |
|------|------|------|
| Gen 基座 | `Qwen/Qwen3-0.6B`（instruct） | 论文 §3 "built upon instruction-tuned Qwen3"，tinysafe-3 也用 instruct |
| Stream 基座 | `Qwen/Qwen3-0.6B-Base`（pretrained） | 论文 §4.1 "leverages pre-trained Qwen3 models" |
| 训练方式 | CausalLM LoRA，非 SeqClassification | 官方方案 + tinysafe-3 验证 CausalLM 更好 |
| 标注策略 | 教师蒸馏：qwen3.7-plus API 统一标注所有数据集 | tinysafe-3 同样用 Claude 做教师统一标签 |
| 数据规模 | ~8K-12K | tinysafe-3 用 ~9.5K 达到 82.2% F1 |
| Stream 标注 | 句子级 | 论文 §4.4 官方评估也用句子级 |
| 输出格式 | 官方 chat template 格式（非 JSON） | 与官方完全一致 |

## 目录结构

```
qise/model_training/qwen3guard/
├── .env                              # API Key + base_url
├── gen/
│   ├── scripts/
│   │   ├── 01_download_datasets.py   # 下载公开数据集
│   │   ├── 02_teacher_relabel.py     # qwen3.7-plus 教师蒸馏标注
│   │   ├── 03_build_training_data.py # 构造训练格式（chat template）
│   │   ├── 04_train_gen.py           # Gen LoRA SFT 训练
│   │   └── 05_eval_gen.py            # 评估
│   ├── data/
│   │   ├── raw/                      # 原始下载数据
│   │   ├── relabeled/                # 教师蒸馏后的标注（JSONL）
│   │   ├── train.jsonl
│   │   ├── val.jsonl
│   │   └── test.jsonl
│   ├── outputs/                      # LoRA adapter
│   └── configs/train_config.yaml
├── stream/
│   ├── scripts/
│   │   ├── 01_prepare_stream_data.py
│   │   ├── 02_train_stream.py
│   │   └── 03_eval_stream.py
│   ├── data/
│   └── outputs/
├── shared/
│   ├── chat_template.py              # 官方 chat template 的 Python 重构
│   ├── label_schema.py               # 9类标签定义 + 映射规则
│   ├── api_client.py                 # Qwen3.7-plus API 客户端
│   └── data_utils.py                 # tokenize、data collator 等
└── README.md
```

---

## Phase 1: CheryGuard-Gen-0.6B

### Step 0: 教师验证（借鉴 tinysafe-3 Lesson 6 "Teacher first, then distill"）

**在标注全部数据之前，先验证教师的质量**：

1. 用 qwen3.7-plus + 精心设计的 constitution prompt（嵌入 Qwen3Guard 论文 §2 的完整 Safety Policy + 9 Categories）
2. 在 200 条官方 Qwen3GuardTest 样本上测试教师
3. 教师 F1 必须 > 0.75 才继续（否则调整 constitution prompt）
4. tinysafe-3 的教训：constitution prompt 从 generic 到 v3 带来了 +18.6 F1，这是整个项目最大的单次提升

### Step 1: 环境配置

`.env` 文件：
```
DASHSCOPE_API_KEY=sk-310b3227d86243eb944b9e87d7bea031
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
ANNOTATION_MODEL=qwen3.7-plus
```

### Step 2: 下载公开数据集（`01_download_datasets.py`）

复用 tinysafe-3 的数据集选择（已验证有效）：

| 数据集 | HF path | 内容 | 估计 |
|--------|---------|------|------|
| WildGuard | `allenai/wildguard` | Prompt+Response | ~1.5K |
| ToxicChat | `lmsys/toxic-chat` | Prompt 安全 | ~1K |
| BeaverTails | `PKU-Alignment/BeaverTails` | Response 安全 | ~1K |
| Aegis 2.0 | `nvidia/Aegis-AI-Content-Safety-Dataset-2.0` | 13类+严重级别 | ~2K |
| SafeRLHF | `PKU-Alignment/SafeRLHF` | Response 安全 | ~500 |
| HarmBench | `walledai/HarmBench` | Prompt 攻击 | ~500 |
| XSTest | `walledai/XSTest` | Response 安全+拒绝 | ~300 |
| Do-Not-Answer | `LibrAI/do-not-answer` | Response 拒绝 | ~300 |
| SimpleSafetyTests | `Bertievidgen/SimpleSafetyTests` | Prompt 安全 | ~300 |
| HarmfulQA | `declare-lab/HarmfulQA` | Prompt unsafe | ~500 |

### Step 3: 教师蒸馏标注（`02_teacher_relabel.py`）

**核心策略**（借鉴 tinysafe-3 的教师蒸馏方法）：

1. **用 qwen3.7-plus 作为教师**，对所有 ~8K 原始样本统一标注
2. 教师的 system prompt 嵌入完整的 Qwen3Guard 安全策略（论文 §2 的 Safety Policy + 9 Categories）
3. 教师输出格式与官方 Qwen3Guard 一致：
   - Prompt: `Safety: Safe/Unsafe/Controversial\nCategories: ...`
   - Response: `Safety: ...\nCategories: ...\nRefusal: Yes/No`
4. 教师标注替代各数据集的原始标签，统一到一致的决策边界

**为什么需要教师蒸馏**：
- tinysafe-3 发现不同数据集标签不一致（如 WildGuard 有 787 条被教师从 unsafe 翻转为 safe）
- 统一标注能消除标签冲突，提升模型学习效果
- 我们的教师（qwen3.7-plus）质量远高于各数据集原始标注

**标注 API 调用示例**：
```python
def annotate_with_teacher(prompt: str, response: str = None) -> dict:
    """用 qwen3.7-plus 作为教师，按 Qwen3Guard 安全策略标注"""
    messages = [
        {"role": "system", "content": SAFETY_POLICY_SYSTEM_PROMPT},
        {"role": "user", "content": build_annotation_request(prompt, response)}
    ]
    completion = client.chat.completions.create(
        model="qwen3.7-plus",
        messages=messages,
        temperature=0.1,  # 低温度确保一致性
    )
    return parse_annotation(completion.choices[0].message.content)
```

### Step 4: 构造训练数据（`03_build_training_data.py`）

使用 `shared/chat_template.py` 中重构的官方模板，构造训练文本：

```python
# Prompt 分类训练样本
train_text = build_prompt_classification_text(user_query)
labels_text = f"Safety: {label}\nCategories: {categories}\n"

# Response 分类训练样本
train_text = build_response_classification_text(user_query, assistant_response)
labels_text = f"Safety: {label}\nCategories: {categories}\nRefusal: {refusal}\n"
```

训练数据 JSONL 格式：
```json
{"text": "<完整输入文本（含模板）>", "labels_text": "Safety: Unsafe\nCategories: Violent\n"}
```

### Step 5: 训练（`04_train_gen.py`）

**基座**：`Qwen/Qwen3-0.6B`（instruct，与 tinysafe-3 同样技术路线）

**架构**：`AutoModelForCausalLM` + LoRA（`TaskType.CAUSAL_LM`）

**关键**：与 tinysafe-3 一致使用 CausalLM，不用 SeqClassification。CausalLM 让模型在官方 chat template 上下文中推理，而非简单模式匹配。

**训练超参数**（参考 tinysafe-3 + geoffmunn 的 LoRA 配置）：
```yaml
base_model: Qwen/Qwen3-0.6B
lora_rank: 16
lora_alpha: 32
lora_dropout: 0.1
target_modules: [q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj, down_proj]
learning_rate: 2e-4          # 参考 tinysafe-3 和 geoffmunn
batch_size: 2
gradient_accumulation: 16     # 有效 batch=32
epochs: 3
max_seq_length: 2048
warmup_ratio: 0.1
lr_scheduler: cosine
fp16: true
gradient_checkpointing: true
```

### Step 6: 评估（`05_eval_gen.py`）

- 测试集：官方 `Qwen/Qwen3GuardTest`（HF 公开）
- 与官方 Qwen3Guard-Gen-0.6B 论文 Table 2-3 对比
- 与 tinysafe-3 的 ToxicChat/WildGuardBench 结果对比
- 指标：Safety F1、Category Accuracy、Refusal F1、格式合规率

---

## Phase 2: Stream Qwen3Guard-0.6B

### Step 1: 架构

**基座**：`Qwen/Qwen3-0.6B-Base`（pretrained）

**架构**：论文 §4.1 公式 3 的双分类头设计

**实现**：从官方 `Qwen/Qwen3Guard-Stream-0.6B` 下载 `trust_remote_code` 文件，复用架构，替换基座。

### Step 2: 句子级标注（复用 tinysafe-3 思路）

1. 复用 Phase 1 的教师蒸馏数据（prompt + response 标签）
2. 对 response 按句子分割（`nltk` / `spaCy`）
3. 对 unsafe/controversial response，用 qwen3.7-plus 找到第一个 unsafe 句子作为边界
4. 边界前 → safe token 标签，边界及之后 → 样本标签
5. 论文 §4.4 官方评估也用句子级，我们完全对齐

### Step 3: 训练

- Backbone: LoRA（rank=16）+ MPS fp32
- 分类头: 全量训练
- 损失函数严格按论文 §4.3 实现

---

## 可复刻性对照表

| 官方步骤 | 官方做法 | 我们做法 | 社区验证 |
|----------|----------|----------|----------|
| Gen 基座 | Qwen3 instruct | `Qwen/Qwen3-0.6B` | tinysafe-3 也用 instruct |
| 训练架构 | CausalLM SFT | CausalLM LoRA | tinysafe-3 验证 CausalLM > SeqClassification |
| 数据规模 | 1.19M | ~8K-12K | tinysafe-3 用 ~9.5K 达 82.2% F1 |
| 标签统一 | Auto Labeling + 投票 | 教师蒸馏（qwen3.7-plus） | tinysafe-3 用 Claude 做教师蒸馏 |
| Chat template | Jinja 模板 | Python 重构，逐字符一致 | 完全一致 |
| Stream 标注 | rollout + 235B Judge | 句子级 API 标注 | 论文 §4.4 官方评估用句子级 |
| Stream 基座 | Qwen3 pre-trained | `Qwen/Qwen3-0.6B-Base` | 完全一致 |

**真正无法复刻的**（经验证）：
- 1.19M 数据规模（不需复刻，tinysafe-3 证明 ~10K 足够）
- 全量 SFT（不需复刻，LoRA 效果足够）
- rollout + 235B Judge（改为句子级，官方评估也用此方式）

---

## 成功标准

| 指标 | Phase 1 (Gen) | Phase 2 (Stream) |
|------|---------------|-------------------|
| 训练时间 | ~2-3h | ~3-5h |
| Safety F1（官方测试集） | > 60% | > 50% |
| 输出格式合规 | > 95% | > 90% |
| 推理延迟 | < 2s | < 100ms/token |