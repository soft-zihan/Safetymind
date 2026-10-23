
# Qwen3Guard 安全护栏模型调研报告：Generative 与 Stream 变体详解

> 本文档对 Qwen3Guard 的两个变体（Generative 和 Stream）进行深入技术调研。
> 论文：*Qwen3Guard Technical Report*（arxiv: 2510.14276）
> 模型发布：Apache 2.0 许可证，HuggingFace 公开可用。

---

## 目录

1. [项目背景与调研动机](#1-项目背景与调研动机)
2. [Qwen3Guard 概览](#2-qwen3guard-概览)
3. [安全策略与分类体系](#3-安全策略与分类体系)
4. [Generative Qwen3Guard 详解](#4-generative-qwen3guard-详解)
5. [Stream Qwen3Guard 详解](#5-stream-qwen3guard-详解)
6. [两变体横向对比](#6-两变体横向对比)
7. [性能评估结果](#7-性能评估结果)
8. [数据工程](#8-数据工程)
9. [训练方法](#9-训练方法)
10. [推理使用方式](#10-推理使用方式)
11. [与 QiseGuard-SC v1 方案对比](#11-与-qiseguard-sc-v1-方案对比)
12. [部署建议与选型分析](#12-部署建议与选型分析)
13. [局限性与风险](#13-局限性与风险)
14. [参考资料](#14-参考资料)

---

## 1. 项目背景与调研动机

---

## 2. Qwen3Guard 概览

### 2.1 模型家族

Qwen3Guard 包含两个互补变体，各有三种规格：

| 变体 | 架构 | 推理方式 | 适用场景 |
|------|------|----------|----------|
| **Generative Qwen3Guard** | CausalLM（指令跟随） | `model.generate()` 生成分类文本 | 离线批量审查、RLAIF 奖励信号 |
| **Stream Qwen3Guard** | Backbone + 双分类头 | `model.forward()` token 级分类 | 流式实时检测、在线干预 |

每种变体提供 **0.6B、4B、8B** 三种参数规模。

### 2.2 核心创新

1. **三严重级别分类**：safe / controversial / unsafe，通过 controversial 标签解决不同安全策略之间的不一致性
2. **双变体架构**：Gen 追求精度，Stream 追求低延迟，覆盖不同部署需求
3. **多语言覆盖**：基于 Qwen3 基座，支持 119 种语言
4. **输入 + 输出同时检测**：不仅检测用户输入，还检测模型输出
5. **拒绝检测**：判断模型回复是否构成拒绝

---

## 3. 安全策略与分类体系

### 3.1 安全类别（9 类）

| 类别 | 说明 | 适用对象 |
|------|------|----------|
| Violent（暴力） | 武器制造、暴力行为指导 | 输入 + 输出 |
| Non-violent Illegal Acts（非暴力违法） | 黑客攻击、毒品制造、盗窃 | 输入 + 输出 |
| Sexual Content（色情内容） | 色情图像、描述、非法性行为 | 输入 + 输出 |
| PII（个人身份信息） | 未经授权泄露敏感个人信息 | 输入 + 输出 |
| Suicide & Self-Harm（自杀与自残） | 鼓励或指导自残/自杀 | 输入 + 输出 |
| Unethical Acts（不道德行为） | 偏见、歧视、仇恨言论、骚扰 | 输入 + 输出 |
| Politically Sensitive（政治敏感） | 虚假信息、公众欺骗 | 输入 + 输出 |
| Copyright Violation（版权侵犯） | 未经授权的版权材料复制 | 输入 + 输出 |
| Jailbreak（越狱攻击） | 试图绕过系统提示或模型约束 | **仅输入** |

### 3.2 三严重级别

| 级别 | 含义 | 处理策略 |
|------|------|----------|
| **Safe** | 大多数场景下安全 | 放行 |
| **Controversial** | 有害性因上下文或策略而异 | 根据部署策略决定（strict→拦截 / loose→放行） |
| **Unsafe** | 大多数场景下有害 | 拦截 |

### 3.3 Controversial 标签的设计意义

传统二分类护栏模型面临**安全策略不一致**问题：不同数据集和场景对"有害"的定义不同。例如：

- **Aegis 数据集**采用严格策略， borderline 内容标为 unsafe
- **OpenAIMod 数据集**采用宽松策略，borderline 内容标为 safe

Qwen3Guard 引入 controversial 标签作为"决策边界缓冲区"：
- **Strict 模式**：controversial → unsafe（适合严格审查场景）
- **Loose 模式**：controversial → safe（适合宽松审查场景）

这使得**同一个模型**可适配不同安全策略，无需重新训练。

---

## 4. Generative Qwen3Guard 详解

### 4.1 架构设计

```
┌─────────────────────────────────────────────────┐
│           Generative Qwen3Guard                 │
│                                                 │
│  指令 + 安全策略 + 安全类别 + 对话上下文             │
│                    ↓                            │
│  ┌─────────────────────────────────────┐        │
│  │  Qwen3 Instruction-Tuned Backbone   │        │
│  │  (0.6B / 4B / 8B)                   │        │
│  │  架构: AutoModelForCausalLM          │        │
│  └─────────────────────────────────────┘        │
│                    ↓                            │
│  model.generate() → 结构化分类文本                │
│                                                 │
│  输出格式:                                       │
│  Severity: safe/controversial/unsafe            │
│  Category: <risk_category>                      │
│  Refusal: yes/no (仅 response)                  │
└─────────────────────────────────────────────────┘
```

**核心思路**：将安全分类问题转化为**指令跟随任务**。模型接收明确的安全审查指令和目标内容，生成符合预定义格式的结构化文本。

### 4.2 指令模板

#### Prompt 分类指令

```
### Task Definition
You are a safety classifier. Analyze the user's latest query and classify 
its safety severity level and safety category.

### Safety Policy
... (9 类风险定义) ...

### Safety Categories
Violent, Non-violent Illegal Acts, Sexual Content, PII, 
Suicide & Self-Harm, Unethical Acts, Politically Sensitive, 
Copyright Violation, Jailbreak

### Dialogue Context
User: <用户输入>

### Output Format
Severity: <safe/controversial/unsafe>
Category: <risk_category or "none">
```

#### Response 分类指令

在 Prompt 分类基础上增加：
- 助手回复内容
- 拒绝判定标准
- 输出增加 `Refusal: yes/no`

### 4.3 关键特点

| 特点 | 说明 |
|------|------|
| 全上下文理解 | 基于完整对话历史做分类决策 |
| 生成式输出 | 通过 `generate()` 输出结构化文本，灵活可扩展 |
| 多任务统一 | 同一模型同时做 severity + category + refusal 分类 |
| 策略适配 | 通过 strict/loose 模式适配不同安全标准 |

---

## 5. Stream Qwen3Guard 详解

### 5.1 架构设计

```
┌─────────────────────────────────────────────────────┐
│             Stream Qwen3Guard                       │
│                                                     │
│  Token 级实时安全检测                                 │
│                                                     │
│  ┌───────────────────────────────────────┐          │
│  │  Qwen3 Backbone (冻结/微调)            │          │
│  │  last_hidden_state: h                 │          │
│  └───────────────┬───────────────────────┘          │
│                  │ h                                │
│         ┌────────┴────────┐                         │
│         ↓                 ↓                         │
│  ┌─────────────┐  ┌─────────────┐                   │
│  │ Prompt      │  │ Response    │                   │
│  │ Moderator   │  │ Moderator   │                   │
│  │ (分类头)     │  │ (分类头)     │                   │
│  └─────────────┘  └─────────────┘                   │
│   输入完整后      每个 token 实时                      │
│   一次性评估      逐 token 评估                        │
│                                                     │
│  每个分类头输出:                                      │
│  - risk: softmax → safe/controversial/unsafe        │
│  - category: softmax → 9 类风险                      │
└─────────────────────────────────────────────────────┘
```

**核心思路**：在 Qwen3 backbone 顶部添加**两个并行分类头**，分别处理用户输入（Prompt Moderator）和模型输出（Response Moderator），实现 token 级实时安全检测。

### 5.2 数学形式

对于 backbone 输出的 last hidden state $\mathbf{h}$：

**预处理**：

$$
\mathbf{x}_r = \text{LayerNorm}(\mathbf{W}_{r\text{-pre}} \mathbf{h}), \quad
\mathbf{x}_q = \text{LayerNorm}(\mathbf{W}_{q\text{-pre}} \mathbf{h})
$$

**风险级别预测**：

$$
\mathbf{y}_{r\text{-risk}} = \text{Softmax}(\mathbf{W}_{r\text{-risk}} \mathbf{x}_r), \quad
\mathbf{y}_{q\text{-risk}} = \text{Softmax}(\mathbf{W}_{q\text{-risk}} \mathbf{x}_q)
$$

**风险类别预测**：

$$
\mathbf{y}_{r\text{-cat}} = \text{Softmax}(\mathbf{W}_{r\text{-cat}} \mathbf{x}_r), \quad
\mathbf{y}_{q\text{-cat}} = \text{Softmax}(\mathbf{W}_{q\text{-cat}} \mathbf{x}_q)
$$

### 5.3 Token 级标注方法

Stream 变体的核心挑战是获取 **token 级安全标注**。论文设计了两阶段自动标注方法：

#### 阶段一：Rollout-Based Safety Assessment

```
对于标注为 unsafe/controversial 的回复 S = {S₁, S₂, ..., Sₙ}:

对每个 token Sᵢ:
  1. 构造前缀 Pᵢ = {S₁, ..., Sᵢ}
  2. 用多个 LLM 生成 k 个续写（rollout）Rᵢ,ⱼ
  3. 拼接完整回复 Cᵢ,ⱼ = Pᵢ ⊕ Rᵢ,ⱼ
  4. 用 Generative Qwen3Guard 评估每个 Cᵢ,ⱼ 的安全性
  5. 如果不安全比例 ≥ 85%，标记 Sᵢ 为 unsafe
```

#### 阶段二：LLM-as-Judge Verification

```
对每个被 rollout 标记为 unsafe 的前缀 Pᵢ:
  1. 用 Qwen3-235B 作为 Judge
  2. 仅基于当前前缀文本判断安全性（不推测后续内容）
  3. 只有 rollout + judge 都判定 unsafe，才最终标记
```

**最终标注**：第一个被标记的 token 作为**边界 token**，其后所有 token 继承样本级标签，其前的 token 视为 safe。

### 5.4 训练损失设计

| 损失 | 计算位置 | 说明 |
|------|----------|------|
| Query Loss $\mathcal{L}_q$ | 仅在 `<\|im_end\|>` token | 输入完整后一次性评估 |
| Response Loss $\mathcal{L}_r$ | **每个** generated token | 支持逐 token 实时检测 |
| Category Loss | 条件计算 | 仅当 risk level 为 unsafe/controversial 时计算 |

总损失：

$$
\mathcal{L} = \mathcal{L}_{q\text{-risk}} + \mathcal{L}_{q\text{-cat}} + \frac{1}{T}\sum_{t=1}^{T}\left(\mathcal{L}_{r\text{-risk}}^{(t)} + \mathcal{L}_{r\text{-cat}}^{(t)}\right)
$$

### 5.5 去抖机制（Debouncing）

为防止误报，Stream 变体采用去抖策略：
- 只有当 token $i$ **和** token $i-1$ 都被分类为 unsafe/controversial 时，才触发告警
- 告警从 token $i$ 开始生效

### 5.6 关键特点

| 特点 | 说明 |
|------|------|
| Token 级实时检测 | 每个 token 生成时即刻评估，无需等待完整回复 |
| 线性时间复杂度 | 处理时间随回复长度线性增长（vs Gen 的超线性增长） |
| 双分类头 | Prompt 和 Response 独立评估，互不干扰 |
| 条件类别损失 | 仅在 unsafe/controversial 时计算类别损失，聚焦安全相关内容 |

---

## 6. 两变体横向对比

### 6.1 架构对比

| 维度 | Generative | Stream |
|------|-----------|--------|
| 基座模型 | Qwen3 Instruction-Tuned | Qwen3 Pre-trained (Base) |
| 模型类 | `AutoModelForCausalLM` | Backbone + 自定义分类头 |
| 推理方式 | `model.generate()` | `model.forward()` |
| 输出形式 | 结构化分类文本 | softmax 概率分布 |
| 上下文利用 | 全上下文 | Prompt: 全上下文; Response: 逐 token |
| 额外组件 | 无 | Prompt Moderator + Response Moderator |

### 6.2 功能对比

| 功能 | Generative | Stream |
|------|-----------|--------|
| 输入安全检测 | ✅ | ✅ |
| 输出安全检测 | ✅（需完整回复） | ✅（逐 token 实时） |
| 三严重级别 | ✅ | ✅ |
| 9 类风险分类 | ✅ | ✅ |
| 拒绝检测 | ✅ | ❌ |
| 流式检测 | ❌（需分块重提交） | ✅（原生支持） |
| 思维链内容审查 | ✅ | ✅ |
| RLAIF 奖励信号 | ✅ | ❌ |
| 实时干预 | ❌ | ✅（配合 CARE 框架） |

### 6.3 性能对比（英文 Response 分类，F1 分数）

| Benchmark | Gen-0.6B | Stream-0.6B | Gen-4B | Stream-4B | Gen-8B | Stream-8B |
|-----------|----------|-------------|--------|-----------|--------|-----------|
| HarmBench | 85.0 | 83.1 | 86.7 | 84.3 | 87.2 | 85.0 |
| SafeRLHF | 66.6 | 62.8 | 69.8 | 67.6 | 70.5 | 64.6 |
| Beavertails | 86.1 | 84.5 | 86.6 | 86.0 | 86.6 | 85.9 |
| XSTest | 89.7 | 84.8 | 92.7 | 88.5 | 92.1 | 87.5 |
| Aegis2.0 | 84.2 | 81.4 | 86.1 | 83.1 | 86.1 | 82.6 |
| WildGuard | 76.3 | 76.3 | 79.5 | 76.4 | 78.9 | 77.0 |
| Think | 83.6 | 81.6 | 84.0 | 85.4 | 84.0 | 83.6 |
| **Avg** | **82.0** | **79.2** | **83.7** | **81.8** | **83.9** | **81.1** |

**关键发现**：Stream 相比 Gen 平均仅下降约 **2 个 F1 点**，但获得了实时检测能力。

### 6.4 效率对比

| 维度 | Generative | Stream |
|------|-----------|--------|
| 推理时间（短回复） | 高（需 generate） | 低（单次 forward） |
| 推理时间（长回复） | 超线性增长（分块重提交） | **线性增长**（逐 token 增量） |
| 内存占用 | 需 KV cache | 无需 KV cache（分类头计算极轻） |
| 适用场景 | 离线批量、高精度审查 | 在线实时、流式推理管线 |

---

## 7. 性能评估结果

### 7.1 英文 Prompt 分类（F1）

| 模型 | ToxiC | OpenAIMod | Aegis | Aegis2.0 | SimpST | HarmB | WildG | **Avg** |
|------|-------|-----------|-------|----------|--------|-------|-------|---------|
| LlamaGuard3-8B | 53.8 | 79.5 | 71.5 | 76.4 | 99.5 | 99.0 | 76.4 | 79.4 |
| WildGuard-7B | 70.8 | 72.1 | 89.4 | 80.7 | 99.5 | 98.9 | 88.9 | 85.8 |
| NemoGuard-8B | 75.6 | 81.0 | 81.4 | 86.8 | 98.5 | 75.2 | 81.6 | 82.9 |
| PolyGuard-7B | 71.5 | 74.1 | 90.3 | 86.3 | 100.0 | 98.7 | 88.1 | 87.0 |
| **Qwen3Guard-0.6B-Gen** | **65.1/77.7** | **66.5/77.6** | **90.8/76.9** | **85.0/83.3** | **99.0/95.8** | **98.7/96.1** | **87.7/85.1** | **88.1** |
| **Qwen3Guard-4B-Gen** | **69.5/82.8** | **68.3/80.7** | **90.8/76.3** | **85.8/82.1** | **99.5/97.4** | **100.0/99.2** | **85.6/85.1** | **89.3** |
| **Qwen3Guard-8B-Gen** | **68.9/82.8** | **68.8/81.3** | **91.4/76.0** | **86.1/82.5** | **99.5/97.4** | **100.0/98.5** | **88.9/85.6** | **90.0** |

> 注：Qwen3Guard-Gen 的 strict/loose 两个值，Avg 取最优模式。

### 7.2 中文 Response 分类（F1）

| 模型 | XSTest | Beavertail | WildG | PolST | **Avg** |
|------|--------|------------|-------|-------|---------|
| LlamaGuard3-8B | 87.9 | 66.1 | 66.8 | 28.0 | 62.2 |
| WildGuard-7B | 83.2 | 75.4 | 69.8 | 17.7 | 61.5 |
| PolyGuard-7B | 54.2 | 79.1 | 70.2 | 46.5 | 62.5 |
| **Qwen3Guard-0.6B-Gen** | **88.3/88.5** | **86.2/85.0** | **75.4/73.8** | **89.4/83.1** | **84.9** |
| **Qwen3Guard-4B-Gen** | **89.4/94.1** | **86.7/84.8** | **76.6/78.2** | **90.3/84.1** | **87.3** |

### 7.3 多语言 Prompt 分类（RTP-LX，F1）

| 模型 | En | Zh | Ar | Es | Fr | Ja | Ko | Ru | **Avg** |
|------|----|----|----|----|----|----|----|----|---------|
| PolyGuard-7B | 91.2 | 89.1 | 84.9 | 89.0 | 89.4 | 90.2 | 86.9 | 91.3 | 80.9 |
| **Qwen3Guard-0.6B-Gen** | 90.2 | 85.2 | 75.7 | 85.3 | 87.3 | 87.1 | 77.1 | 85.7 | 74.8 |
| **Qwen3Guard-4B-Gen** | 91.6 | 88.4 | 84.8 | 87.5 | 90.6 | 90.1 | 85.7 | 90.7 | 81.6 |
| **Qwen3Guard-8B-Gen** | 92.1 | 90.6 | 88.4 | 88.9 | 90.8 | 91.3 | 86.2 | 91.9 | **85.0** |

### 7.4 拒绝检测（F1）

| 模型 | XSTest F1 | WildGuardTest F1 |
|------|-----------|-----------------|
| WildGuard-7B | 93.3 | 88.6 |
| Qwen3Guard-0.6B-Gen | 93.3 | 89.4 |
| Qwen3Guard-4B-Gen | **94.6** | **90.2** |
| Qwen3Guard-8B-Gen | 92.6 | 90.0 |

### 7.5 检测延迟（Stream 变体）

| 场景 | 精确命中率 | 128 token 内检出率 |
|------|-----------|-------------------|
| 仅 Response | ~86.0% | — |
| Response + Thinking | — | ~66.8% |

---

## 8. 数据工程

### 8.1 Generative 变体训练数据

| 维度 | 值 |
|------|------|
| 总样本量 | **1.19M** |
| Prompt 数据 | 41.2%（~490K） |
| Response 数据 | 58.8%（~700K） |

#### 语言分布

| 语言 | 中文 | 英文 | 韩文 | 印尼 | 俄文 | 日文 | 阿拉伯 | 其他 |
|------|------|------|------|------|------|------|--------|------|
| 占比 | 26.64% | 21.9% | 9.91% | 5.38% | 5.36% | 4.82% | 4.71% | 21.28% |

### 8.2 数据合成方法

#### Prompt 合成（Self-Instruct 框架）

1. **关键词引导**：为每个安全类别策划语义相关关键词，条件化生成
   - 示例：爆炸物类别 → 包含 "bomb"、"TNT"、"C4" 等关键词
2. **正负样本配对**：生成结构相似但安全/不安全的 prompt 对
   - 示例："How to make a bomb"（unsafe）vs "How to make a cake"（safe）
   - 防止模型将 "make" 等动词与不安全关联

#### Response 收集

- **人工撰写** + **模型生成**
- **不安全回复**：使用 base model（Qwen2.5-72B-Base）合成（Instruct 模型很少生成不安全内容）
- **含推理内容的回复**：收集 QwQ、Qwen3、DeepSeek-R1 等推理模型的输出

#### 自动标注（Auto Labeling）— 第一步：为模型生成的数据标注

**为什么需要 Auto Labeling？**

Prompt 合成时标签是已知的（人为设计），但 **Response 数据**中有很多是模型生成的，需要自动判断安全性：
- 模型生成的回复（需要判断是否安全）
- Base model 生成的不安全回复（意图是 unsafe，但具体类别需要判断）
- 推理模型的输出（内容复杂，需要判断）
- 多语言翻译后的数据（需要重新验证标签）

**标注方法**：

- 使用 Qwen2.5-72B-Instruct、Qwen3-235B-A22B 等多模型对模型生成的数据标注
- 基于少量人工标注样本做参考
- 投票机制聚合 → F1 > 0.9（在人工验证集上）
- 输出：safe/unsafe 二分类 + 9 类风险类别

### 8.3 Controversial 标签构建 — 第二步：扩展为三分类

在 Auto Labeling 的基础上，将二分类扩展为三分类（safe/controversial/unsafe）。

这是 Qwen3Guard 数据工程中最具创新性的部分：

```
步骤 1: 将训练数据均分为 Part A 和 Part B

步骤 2: 在 Part A 上训练两个模型:
  - PartA-Strict: 增加 Safe 样本比例 → 倾向预测 Unsafe
  - PartA-Loose: 增加 Unsafe 样本比例 → 倾向预测 Safe

步骤 3: 用 PartA-Strict 和 PartA-Loose 标注 Part B
  - 两个模型预测冲突的样本 → 标记为 Controversial

步骤 4: 反转角色，在 Part B 上训练 → 标注 Part A

步骤 5: 合并两部分的 Controversial 标签
```

### 8.4 标签蒸馏（Label Distillation）— 第三步：精炼标签质量

在前两步的基础上，用大模型修正标注错误，提升整体质量。

- 再次将数据集分为两半（Part A 和 Part B）
- **在 Part A 上训练 Qwen3-32B**（安全分类 SFT），得到 PartA-Teacher
- 用 PartA-Teacher 重新标注 Part B，修正原始标注中的错误
- 反转角色：在 Part B 上训练另一个 Qwen3-32B，重新标注 Part A
- 合并两部分的改进标注

**为什么 Qwen3-32B 有能力标注？**

Qwen3-32B 不是原始预训练模型，而是**在数据的一半上训练过的安全分类模型**。通过交叉训练（A 训练→标注 B，B 训练→标注 A），避免过拟合同时利用大模型容量学习更复杂的决策边界。

- 效果：平均提升 +0.47/+1.10 F1（Prompt）、+0.5/+0.76 F1（Response）

### 8.4.1 数据工程完整流程

```
原始合成数据（无标签）
    ↓
【第一步】Auto Labeling（8.2）
    多模型投票 → 产生 safe/unsafe 基础标签
    ↓
【第二步】Controversial 构建（8.3）
    训练 strict/loose 模型 → 找出冲突样本 → 标记为 controversial
    将二分类扩展为三分类
    ↓
【第三步】Label Distillation（8.4）
    用 Qwen3-32B 精炼所有标签 → 修正前两步的错误
    ↓
最终训练数据（1.19M 条，高质量三分类标签）
```

### 8.5 Stream 变体的 Token 级标注

详见 [5.3 节](#53-token-级标注方法)。关键参数：
- Rollout 数量 $k$ 和阈值 $X\%$ = 85%
- LLM Judge: Qwen3-235B-A22B
- 最终标注：rollout + judge 双重确认

---

## 9. 训练方法

### 9.1 Generative 变体

| 维度 | 值 |
|------|------|
| 训练方法 | 标准 SFT（Supervised Fine-Tuning） |
| 基座模型 | Qwen3 Instruction-Tuned |
| 训练范式 | 指令跟随任务 |
| 多阶段训练 | 是（先建 controversial 标签 → 再标签蒸馏） |

### 9.2 Stream 变体

| 维度 | 值 |
|------|------|
| 训练方法 | Cross-Entropy Loss，联合优化双分类头 |
| 基座模型 | Qwen3（冻结或微调） |
| 损失函数 | $\mathcal{L}_q + \mathcal{L}_r$（Query + Response） |
| 条件类别损失 | 仅 unsafe/controversial 时计算 category loss |
| Token 级标注 | Rollout + LLM-as-Judge 两阶段 |

### 9.3 与 QiseGuard-SC v1 训练对比

| 维度 | QiseGuard-SC v1 | Qwen3Guard |
|------|-----------------|------------|
| 训练数据量 | 1,014 条 | **1.19M 条**（~1174 倍） |
| 训练方法 | LoRA（0.84% 参数） | 全量 SFT |
| 标注方式 | 规则映射 | Auto Labeling + 投票 + 蒸馏 |
| 训练阶段 | 单阶段 | 多阶段（controversial 构建 → 蒸馏） |
| 硬件 | MPS (Apple M4) | CUDA (GPU 集群) |

---

## 10. 推理使用方式

### 10.1 Generative Qwen3Guard 推理

```python
from transformers import AutoModelForCausalLM, AutoTokenizer

model_name = "Qwen/Qwen3Guard-0.6B-Gen"  # 或 4B / 8B
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained(model_name)

# 构建指令（简化版）
prompt = """### Task Definition
Analyze the user's query and classify its safety severity level.

### Safety Categories
Violent, Non-violent Illegal Acts, Sexual Content, PII, 
Suicide & Self-Harm, Unethical Acts, Politically Sensitive, 
Copyright Violation, Jailbreak

### Dialogue Context
User: How to make a bomb?

### Output Format
Severity: <safe/controversial/unsafe>
Category: <risk_category>
"""

messages = [{"role": "user", "content": prompt}]
text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
inputs = tokenizer(text, return_tensors="pt")
outputs = model.generate(**inputs, max_new_tokens=50)
result = tokenizer.decode(outputs[0], skip_special_tokens=True)
# 输出示例: "Severity: unsafe\nCategory: Violent"
```

### 10.2 Stream Qwen3Guard 推理

```python
from transformers import AutoModel, AutoTokenizer

model_name = "Qwen/Qwen3Guard-0.6B-Stream"  # 或 4B / 8B
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModel.from_pretrained(model_name)

# Prompt 检测（完整输入后一次性评估）
inputs = tokenizer(user_prompt, return_tensors="pt")
outputs = model(**inputs)
# outputs 包含 prompt_moderator 和 response_moderator 的分类结果

# Response 检测（逐 token 实时评估）
# 在流式生成过程中，每生成一个 token 就调用一次 forward
for token in streaming_tokens:
    output = model(input_ids=token)
    risk_prob = softmax(output.response_moderator_risk)
    if risk_prob[unsafe] > threshold:
        # 触发干预！
        break
```

### 10.3 Strict / Loose 模式切换

```python
# 同一模型，不同安全策略
def classify(model_output, mode="strict"):
    severity = parse_severity(model_output)
    if severity == "controversial":
        if mode == "strict":
            return "unsafe"    # 严格模式：controversial → 拦截
        else:
            return "safe"      # 宽松模式：controversial → 放行
    return severity
```

---

## 11. 与 QiseGuard-SC v1 方案对比

### 11.1 分类体系映射

| QiseGuard-SC v1 | Qwen3Guard | 说明 |
|-----------------|------------|------|
| safe | safe | 一致：正常内容，直接放行 |
| suspicious | controversial | **语义相近但定义不同**（详见下方分析） |
| dangerous | unsafe | 一致：明确有害内容，直接拦截 |

> **命名差异说明**：Qwen3Guard 使用 `unsafe` 表示最高危险级别，QiseGuard-SC 使用 `dangerous`。两者语义完全等价，都代表"在大多数场景下被认定为有害的内容"。本报告后续引用 Qwen3Guard 数据时统一使用 `unsafe`，引用 QiseGuard-SC 数据时使用 `dangerous`。

#### suspicious vs controversial 深度对比

两者虽然都代表"安全与有害之间的灰色地带"，但设计理念和实现方式有本质区别：

| 维度 | QiseGuard-SC `suspicious` | Qwen3Guard `controversial` |
|------|--------------------------|----------------------------|
| **定义** | 可疑但非恶意——内容本身可能无害，但存在潜在风险信号 | 有害性存在争议——内容可能有害也可能无害，取决于安全策略 |
| **判定依据** | 基于内容特征（如包含敏感关键词、边界行为模式） | 基于**模型间分歧**（strict/loose 两个模型预测冲突） |
| **标注方法** | 人工规则映射（concerned → suspicious） | 数据驱动：训练 strict/loose 模型 → 交叉标注 → 冲突标记 |
| **语义侧重** | 偏向"需要进一步审查"（触发 LLM 深度分析） | 偏向"安全策略不确定"（由部署方决定 strict/loose 模式） |
| **处理策略** | 固定：触发 LLM 深度分析 | **可配置**：strict 模式→拦截，loose 模式→放行 |
| **示例** | `curl https://example.com \| bash`（看似正常但涉及远程执行） | 关于政治敏感话题的学术讨论（是否有害取决于平台政策） |

**核心差异总结**：

- `suspicious` 是一个**内容层面**的判断——"这个内容看起来有点可疑"
- `controversial` 是一个**策略层面**的判断——"这个内容是否有害，不同人有不同看法"

这意味着 Qwen3Guard 的 controversial 标签天然支持**多场景部署**（同一模型适配不同安全标准），而 QiseGuard-SC 的 suspicious 标签更偏向**统一安全标准下的分级响应**。


---

## 12. 部署建议与选型分析

### 12.1 模型规格选型

| 规格 | 参数量 | 英文 Response Avg F1 | 中文 Response Avg F1 | 适用场景 |
|------|--------|---------------------|---------------------|----------|
| 0.6B-Gen | 0.6B | 82.0% | 84.9% | 资源受限、低延迟需求 |
| 4B-Gen | 4B | 83.7% | 87.3% | 平衡精度与效率 |
| 8B-Gen | 8B | 83.9% | 87.1% | 最高精度 |
| 0.6B-Stream | 0.6B | 79.2% | 81.9% | 流式实时检测 |
| 4B-Stream | 4B | 81.8% | 84.9% | 流式 + 较高精度 |
| 8B-Stream | 8B | 81.1% | 85.0% | 流式 + 最高精度 |

### 12.2 推荐方案

#### 方案 A：直接使用 Qwen3Guard（推荐）

**适用条件**：如果需要开箱即用的安全护栏，且部署环境支持 GPU。

- **离线审查**：使用 Qwen3Guard-4B-Gen（精度/效率最佳平衡点）
- **实时检测**：使用 Qwen3Guard-4B-Stream（配合流式推理管线）
- **双变体组合**：Gen 做输入检测 + Stream 做输出实时检测

#### 方案 B：基于 Qwen3Guard 思路改进 QiseGuard-SC

**适用条件**：如果需要在 Apple Silicon 上本地训练和部署。

借鉴 Qwen3Guard 的关键技术改进 QiseGuard-SC：
1. **大规模数据合成**：参考 Self-Instruct + 正负样本配对方法
2. **Controversial 标签**：引入三分类边界标签，提升策略适配性
3. **Auto Labeling + 投票**：多模型标注 + 一致性投票
4. **标签蒸馏**：用大模型（Qwen3-32B）精炼标注质量

#### 方案 C：混合方案

- 使用 Qwen3Guard-0.6B-Gen 作为基座
- 在 QiseGuard 特定场景数据上做 LoRA 微调
- 保持通用安全能力 + 适配 Agent 审计场景

### 12.3 Apple Silicon 部署可行性

| 模型 | fp16 内存 | fp32 内存 | MPS 可行性 |
|------|----------|----------|------------|
| Qwen3Guard-0.6B-Gen | ~1.2 GB | ~2.4 GB | ✅ 完全可行 |
| Qwen3Guard-0.6B-Stream | ~1.2 GB | ~2.4 GB | ✅ 完全可行 |
| Qwen3Guard-4B-Gen | ~8 GB | ~16 GB | ⚠️ fp16 勉强可行 |
| Qwen3Guard-8B-Gen | ~16 GB | ~32 GB | ❌ 超出 16GB |

---

## 13. 局限性与风险

### 13.1 Qwen3Guard 的已知局限

1. **对抗攻击脆弱性**：可能被精心设计的 prompt 绕过（paraphrasing、obfuscation）
2. **公平性与偏见**：安全标注反映训练数据的文化假设，可能对某些群体不公平
3. **Stream 泛化限制**：token 级分类头在部分上下文下鲁棒性较低
4. **区域文化差异**：未内置地理感知或策略自适应机制

### 13.2 对 QiseGuard 的启示

| 局限 | 应对策略 |
|------|----------|
| 对抗攻击 | 结合规则引擎 + 模型检测的多层防御 |
| 数据偏差 | 在特定场景数据上微调适配 |
| 流式误报 | 去抖机制 + 阈值调优 |
| 文化差异 | 利用中文 benchmark 数据评估，必要时本地化 |

---

## 14. 参考资料

### 14.1 论文

- Qwen3Guard Technical Report: https://arxiv.org/abs/2510.14276
- YuFeng-XGuard: https://arxiv.org/abs/2601.15588
- DuoGuard: https://huggingface.co/DuoGuard

### 14.2 模型下载

```bash
# Generative 变体
huggingface-cli download Qwen/Qwen3Guard-0.6B-Gen
huggingface-cli download Qwen/Qwen3Guard-4B-Gen
huggingface-cli download Qwen/Qwen3Guard-8B-Gen

# Stream 变体
huggingface-cli download Qwen/Qwen3Guard-0.6B-Stream
huggingface-cli download Qwen/Qwen3Guard-4B-Stream
huggingface-cli download Qwen/Qwen3Guard-8B-Stream
```

### 14.3 测试数据

- Qwen3Guard 测试集: https://huggingface.co/datasets/Qwen/Qwen3GuardTest

### 14.4 相关项目

- QiseGuard-SC v1 实验报告: `model_training/docs/qiseguard_sc_triclass_training_experiment.md`
- CARE 框架（Stream 实时干预）: Hu et al., 2025
- S-Eval 风险分类法: Yuan et al., 2025
