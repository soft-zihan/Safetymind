# Qwen3Guard 安全分类模型技术文档

## 1. 训练目标：2 种 0.6B 模型变体

| 变体                        | 架构              | 推理方式                        | 适用场景              |
| ------------------------- | --------------- | --------------------------- | ----------------- |
| **Generative CheryGuard** | CausalLM（指令跟随）  | `model.generate()` 生成分类文本   | 离线批量审查、RLAIF 奖励信号 |
| **Stream CheryGuard**     | Backbone + 双分类头 | `model.forward()` token 级分类 | 流式实时检测、在线干预       |

### 维度对比

| 维度    | Generative              | Stream                                |
| ----- | ----------------------- | ------------------------------------- |
| 基座模型  | Qwen3 Instruction-Tuned | Qwen3 Pre-trained (Base)              |
| 模型类   | AutoModelForCausalLM    | Backbone + 自定义分类头                     |
| 推理方式  | `model.generate()`      | `model.forward()`                     |
| 输出形式  | 结构化分类文本                 | softmax 概率分布                          |
| 上下文利用 | 全上下文                    | Prompt: 全上下文；Response: 逐 token        |
| 额外组件  | 无                       | Prompt Moderator + Response Moderator |

***

## 2. 创新点

1. **三严重级别分类**：safe / controversial / unsafe，通过 controversial 标签解决不同安全策略之间的不一致性
2. **双变体架构**：Gen 追求精度，Stream 追求低延迟，覆盖不同部署需求
3. **多语言覆盖**：基于 Qwen3 基座，支持 119 种语言
4. **输入 + 输出同时检测**：不仅检测用户输入，还检测模型输出
5. **拒绝检测**：判断模型回复是否构成拒绝

***

## 3. 9 类安全能力

| 类别                              | 说明            | 适用对象    |
| ------------------------------- | ------------- | ------- |
| Violent（暴力）                     | 武器制造、暴力行为指导   | 输入 + 输出 |
| Non-violent Illegal Acts（非暴力违法） | 黑客攻击、毒品制造、盗窃  | 输入 + 输出 |
| Sexual Content（色情内容）            | 色情图像、描述、非法性行为 | 输入 + 输出 |
| PII（个人身份信息）                     | 未经授权泄露敏感个人信息  | 输入 + 输出 |
| Suicide & Self-Harm（自杀与自残）      | 鼓励或指导自残/自杀    | 输入 + 输出 |
| Unethical Acts（不道德行为）           | 偏见、歧视、仇恨言论、骚扰 | 输入 + 输出 |
| Politically Sensitive（政治敏感）     | 虚假信息、公众欺骗     | 输入 + 输出 |
| Copyright Violation（版权侵犯）       | 未经授权的版权材料复制   | 输入 + 输出 |
| Jailbreak（越狱攻击）                 | 试图绕过系统提示或模型约束 | 仅输入     |

***

## 4. 3 层安全分类

| 级别                | 含义           | 处理策略                           |
| ----------------- | ------------ | ------------------------------ |
| **Safe**          | 大多数场景下安全     | 放行                             |
| **Controversial** | 有害性因上下文或策略而异 | 根据部署策略决定（strict→拦截 / loose→放行） |
| **Unsafe**        | 大多数场景下有害     | 拦截                             |

***

## 5. Generative 架构

**核心思路**：将安全分类问题转化为指令跟随任务，同一模型同时做 severity + category + refusal 分类，通过 strict/loose 模式适配不同安全标准。

### 架构图

```
Generative Qwen3Guard
┌─────────────────────────────────────────┐
│  指令 + 安全策略 + 安全类别 + 对话上下文  │
│              ↓                          │
│  Qwen3 Instruction-Tuned Backbone       │
│  (0.6B / 4B / 8B)                       │
│  架构: AutoModelForCausalLM             │
│              ↓                          │
│  model.generate() → 结构化分类文本       │
└─────────────────────────────────────────┘
```

### 输出格式

* **Severity**: safe/controversial/unsafe

* **Category**: \<risk\_category>

* **Refusal**: yes/no（仅 response）

### Prompt 指令格式

```markdown
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

### Response 指令格式

在 Prompt 分类基础上增加：

* 助手回复内容

* **拒绝判定**标准

* 输出增加 Refusal: yes/no

***

## 6. 数据合成方法

### Prompt 合成（Self-Instruct 框架）

1. 定义 9 个安全类别 + 关键词库
2. 关键词引导生成 → 确保类别覆盖
3. 正负样本配对 → 做蛋糕和做炸弹不一样
4. 自动标注（多模型投票）→ 生成标签
5. 得到 \~490K prompt 训练数据

### Response 收集

* **人工撰写 + 模型生成**

* **不安全回复**：使用 base model（Qwen2.5-72B-Base）合成（Instruct 模型很少生成不安全内容）

### 标注 Response 的三阶段法

**自动标注：**

* 使用 Qwen2.5-72B-Instruct、Qwen3-235B-A22B 等多模型生成初步标签

* 基于少量人工标注样本做参考

* 投票机制聚合 → F1 > 0.9（在人工验证集上）

**Controversial 标签构建：**

* 步骤 1：将训练数据均分为 Part A 和 Part B

* 步骤 2：在 Part A 上训练两个模型：

  * PartA-Strict: 增加 Safe 样本比例 → 倾向预测 Unsafe

  * PartA-Loose: 增加 Unsafe 样本比例 → 倾向预测 Safe

* 步骤 3：用 PartA-Strict 和 PartA-Loose 标注 Part B

  * 两个模型预测冲突的样本 → 标记为 Controversial

* 步骤 4：反转角色，在 Part B 上训练 → 标注 Part A

* 步骤 5：合并两部分的 Controversial 标签

**标签蒸馏：**

* 再次将数据集分为两半

* 用一半训练的模型改进另一半的标注

* Teacher 模型：Qwen3-32B

***

## 7. Stream 架构

**核心思路**：在 backbone 顶部添加两个并行分类头，分别处理用户输入和模型输出。

### 架构图

```
Stream Qwen3Guard
┌──────────────────────────────────────────────┐
│  Token 级实时安全检测                          │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │  Qwen3 Backbone (冻结/微调)           │    │
│  │  last_hidden_state: h                │    │
│  └──────────────────┬───────────────────┘    │
│                     │ h                      │
│          ┌──────────┴──────────┐             │
│          ↓                     ↓             │
│   ┌──────────────┐    ┌──────────────┐       │
│   │   Prompt     │    │  Response    │       │
│   │  Moderator   │    │  Moderator   │       │
│   │  (分类头)     │    │  (分类头)     │       │
│   └──────────────┘    └──────────────┘       │
│   输入完整后               每个 token 实时     │
│   一次性评估               逐 token 评估      │
│                                              │
│   每个分类头输出：                             │
│   - risk: softmax → safe/controversial/unsafe │
│   - category: softmax → 9 类风险              │
└──────────────────────────────────────────────┘
```

***

## 8. Token 级标注方法：两阶段标注法

### 阶段一：Rollout-Based Safety Assessment

对于标注为 unsafe/controversial 的回复 S = {S₁, S₂, ..., Sₙ}：

对每个 token Sᵢ：

1. 构造前缀 Pᵢ = {S₁, ..., S}
2. 用多个 LLM 生成 k 个续写（rollout）Rᵢ,ⱼ
3. 拼接完整回复 Cᵢ,ⱼ = Pᵢ ⊕ Rᵢ,
4. 用 Generative Qwen3Guard 评估每个 Cᵢ,ⱼ 的安全性
5. 如果不安全比例 ≥ 85%，标记 Sᵢ 为 unsafe

### 阶段二：LLM-as-Judge Verification

对每个被 rollout 标记为 unsafe 的前缀 Pᵢ：

1. 用 Qwen3-235B 作为 Judge
2. 仅基于当前前缀文本判断安全性（不推测后续内容）
3. 只有 rollout + judge 都判定 unsafe，才最终标记

### 最终标注

第一个被标记的 token 作为**边界 token**，其后所有 token 继承样本级标签，其前的 token 视为 safe。

***

## 9. 损失函数组成

| 损失                     | 计算位置                    | 说明                                       |
| ---------------------- | ----------------------- | ---------------------------------------- |
| **Query Loss** L\_q    | 仅在 `<\|im_end\|>` token | 输入完整后一次性评估                               |
| **Response Loss** L\_r | 每个 generated token      | 支持逐 token 实时检测                           |
| **Category Loss**      | 条件计算                    | 仅当 risk level 为 unsafe/controversial 时计算 |
