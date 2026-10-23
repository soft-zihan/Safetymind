# CheryGuard — 安全分类模型

> 基于 Qwen3-0.6B 大语言模型微调的 AI 安全护栏，支持 Prompt/Response 双向风险分类，为智能体交互提供实时安全防护。

**语言**：Python  
**基座模型**：Qwen3-0.6B  
**训练方式**：PEFT (LoRA) 微调

---

## 核心定位

CheryGuard 是 SafetyMind 的**本地安全分类引擎**，用极小的模型参数量（仅训练 1.67% 参数）实现生产级安全分类性能。它提供两种架构选择，适应不同场景需求。

---

## 双架构对比

| 维度 | Gen v2（生成式） | Stream v2（判别式） |
|------|-----------------|-------------------|
| **基座模型** | Qwen3-0.6B-Instruct | Qwen3-0.6B-Base |
| **分类方式** | 自回归生成文本标签 | 双 Risk Head 直接输出概率 |
| **输出粒度** | 9 类安全类别 + 3 级风险等级 | 二分类 Safe/Unsafe |
| **推理速度** | ~954ms（需解码生成） | ~14ms（单次前向传播，68× 加速） |
| **输出可靠性** | 需解析，可能失败 | 100% 有效 |
| **适用场景** | 离线评估、精细分类 | 实时流式拦截 |

### Gen 架构 — 精细分类

生成式架构通过自回归生成输出安全标签：

- 3 级风险等级 + 9 类安全类别 + Refusal 判定
- 适合需要精细分类的离线审查场景
- 基于 Qwen3-0.6B-Instruct，LoRA 微调

### Stream 架构 — 实时检测

判别式架构通过 Dual Risk Heads 直接输出分类概率：

```
输入 → Backbone (Qwen3-0.6B-Base + LoRA)
         ↓
    last_hidden_state[:, -1:, :]
         ↓
    ┌────┴────┐
    │         │
Response   Query
Risk Head  Risk Head
    │         │
  Safe/     Safe/
  Unsafe    Unsafe
```

- 纯二分类 Safe/Unsafe，延迟仅 ~14ms
- 根据 task_type 选择 head：`prompt` → Query Head，`response` → Response Head
- 适合流式实时检测场景

---

## 核心技术

### LoRA 高效微调

```python
lora_config = LoraConfig(
    r=16,                          # LoRA rank
    lora_alpha=32,                 # 2×r
    target_modules=[
        "q_proj", "k_proj", "v_proj", "o_proj",  # Attention 层
        "gate_proj", "up_proj", "down_proj"       # MLP 层
    ]
)
# 可训练参数: 10M (1.67%) | 冻结参数: 596M (98.33%)
```

### Dual Risk Heads（Stream 架构）

通过 **Loss Masking** 实现双头独立训练：

- Response Risk Head：训练 response 样本
- Query Risk Head：训练 prompt 样本
- 两个 Head 通过 RMSNorm 归一化，互不干扰

### 教师蒸馏标注

使用 Qwen3Guard 作为教师模型生成训练标签：

- 翻转率仅 5.2%（原始数据质量已很好）
- 保证标签一致性和质量

---

## 训练数据

| 数据集 | 来源 | 用途 |
|--------|------|------|
| Aegis 2.0 | NVIDIA | 44K 样本，prompt/response 双维度标注 |
| BeaverTails | PKU-Alignment | 2K 样本，14 种有害类别 |
| HarmfulQA | declare-lab | 500 样本，全 unsafe |

**数据处理流程**：
1. 原始数据混合 → 去重
2. Teacher 标注（Qwen3Guard）
3. Gen 训练集：5,128 条（sample_balanced 采样）
4. Stream 训练集：5,076 条（句子级边界标注）

---

## 技术栈

- **框架**：PyTorch · HuggingFace Transformers · PEFT (LoRA) · TRL (SFTTrainer)
- **基座**：Qwen3-0.6B
- **数据管线**：JSONL 数据管线
- **推理**：model.generate() (Gen) / model.forward() (Stream)
