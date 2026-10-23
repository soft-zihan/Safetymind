# QiseGuard-SC-0.8B 三分类安全模型训练方案

## 1. 环境概况

| 项目 | 值 |
|------|------|
| 设备 | Apple M4 Mac mini |
| 统一内存 | 16 GB |
| MPS 可用显存 | ~10-12 GB（系统占用约 4-6 GB） |
| PyTorch | 2.12.1 |
| 精度 | float16 (MPS 推荐) |
| 基座模型 | Qwen/Qwen3.5-0.8B-Instruct (需下载) |
| 输出模型名 | QiseGuard-SC-0.8B (SC = Safety Classifier) |

## 2. 训练目标

将原来的多字段 JSON 输出简化为**三分类单 token 输出**：`safe` / `suspicious` / `dangerous`。

- 推理时只需生成 1 个 token，延迟极低
- LoRA 权重独立保存，不合并到基座模型

## 3. 基座模型选型：Instruct vs Base

| 维度 | Instruct (Qwen3.5-0.8B-Instruct) | Base (Qwen3.5-0.8B-Base) |
|---|---|---|
| 指令跟随 | 已具备，天然适合 chat 格式输入 | 不具备，需额外训练 |
| 分类任务适配 | 只需微调输出层映射 | 需同时学习指令跟随 + 分类 |
| 数据效率 | 高，2400 条样本足够 | 低，可能需要更多数据 |
| 推理格式 | 原生支持 apply_chat_template | 无 chat template |

**结论：选用 Instruct 版本**。任务是三分类，数据量有限（~2400 条），Instruct 模型已具备指令跟随能力，LoRA 只需学习三分类映射。

## 4. 数据准备

### 4.1 现有数据概况

9 个 synthetic 任务文件，共 2407 条样本。原始 verdict 分布：

| 原始 verdict | 数量 | 占比 |
|---|---|---|
| suspicious | 745 | 31.0% |
| malicious | 664 | 27.6% |
| safe | 654 | 27.2% |
| alarmed | 208 | 8.6% |
| concerned | 136 | 5.7% |

### 4.2 三分类映射规则

| 原始 verdict | 映射目标 | 说明 |
|---|---|---|
| safe | **safe** | 正常操作 |
| suspicious | **suspicious** | 可疑但非恶意 |
| concerned | **suspicious** | 与 suspicious 语义相近 |
| malicious | **dangerous** | 明确恶意行为 |
| alarmed | **dangerous** | 高危告警，归入 dangerous |

映射后分布：

| 类别 | 数量 | 占比 |
|---|---|---|
| suspicious | 881 | 36.6% |
| dangerous | 872 | 36.2% |
| safe | 654 | 27.2% |

三分类分布相当均匀（27%~37%），**无需过采样**。

### 4.3 数据质量处理

- **task4 特殊处理**：task4 包含 `alarmed`/`concerned` 两个非标准 verdict，分别映射为 `dangerous` 和 `suspicious`
- **数据划分**：80% 训练 / 10% 验证 / 10% 测试（分层采样，测试集完全不参与训练）
- **输出目录**：`datasets/triclass/` 下生成 `train.jsonl`、`val.jsonl`、`test.jsonl`

### 4.4 新数据格式

转换后 assistant 输出只保留一个词：`safe` / `suspicious` / `dangerous`

新的 system prompt：
```
You are a security classifier. Analyze the input and respond with exactly one word: "safe", "suspicious", or "dangerous". Do not output anything else.
```

### 4.5 数据转换脚本 `scripts/convert_to_triclass.py`

功能：
1. 读取 `datasets/synthetic/*.jsonl`
2. 按映射规则转换 verdict
3. 替换 system prompt 为三分类版本
4. 替换 assistant content 为 `safe` / `suspicious` / `dangerous`
5. 按 80/10/10 分层采样划分 train/val/test
6. 输出到 `datasets/triclass/` 目录
7. 打印数据统计报告

## 5. 模型与 LoRA 配置

### 5.1 LoRA 参数

| 参数 | 值 | 说明 |
|---|---|---|
| r (rank) | 16 | 0.8B 模型较小，rank 无需太大 |
| lora_alpha | 32 | alpha/r = 2，标准缩放比 |
| lora_dropout | 0.05 | 轻度 dropout 防过拟合 |
| target_modules | q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj, down_proj | 全部 7 个 Linear 层 |
| task_type | CAUSAL_LM | 因果语言模型 |
| bias | none | 不训练 bias |

预计可训练参数：约 5-6M（0.8B 的 ~0.7%）

## 6. 训练超参数

基于 M4 16GB 统一内存，MPS 可用约 10-12 GB：

| 参数 | 值 | 说明 |
|---|---|---|
| learning_rate | 3e-4 | 0.8B 小模型用较高学习率 |
| num_epochs | 5 | 三分类任务简单，5 epoch 足够 |
| per_device_batch_size | 4 | 16GB 内存下的安全值，0.8B fp16 约 1.6GB |
| gradient_accumulation | 8 | 有效 batch = 4*8 = 32 |
| max_seq_length | 256 | 输入短 + 输出仅 1 token |
| weight_decay | 0.01 | 标准 L2 正则化 |
| warmup_ratio | 0.1 | 前 10% steps 线性预热 |
| lr_scheduler | cosine | 余弦退火 |
| optimizer | AdamW | 标准优化器 |
| grad_clip | 1.0 | 梯度裁剪防爆炸 |
| seed | 42 | 可复现 |

### 6.1 训练资源估算

- 训练集约 ~1925 条（80% of 2407）
- 每 epoch ~60 steps（1925/32）
- 5 epochs ~300 total steps
- 预计 MPS 显存占用：~4-5 GB
- 预计训练时间：MPS 上约 10-20 分钟

## 7. 代码修改清单

### 7.1 新建 `scripts/convert_to_triclass.py`

数据转换脚本，功能如 4.5 所述。输出 train/val/test 三个文件。

### 7.2 新建 `scripts/train_triclass.py`（替代 train_ddp.py）

从 train_ddp.py 重写，主要改动：

1. **SYSTEM_PROMPT**：替换为三分类 prompt
2. **QiseGuardDataset.__getitem__**：简化 label masking，assistant 输出只有 1 个 token
3. **默认参数**：
   - `--model` 默认 `Qwen/Qwen3.5-0.8B-Instruct`
   - `--output` 默认 `QiseGuard-SC-0.8B`
   - `--lora_rank` 默认 16
   - `--lora_alpha` 默认 32
   - `--batch_size` 默认 4
   - `--grad_accum` 默认 8
   - `--epochs` 默认 5
   - `--lr` 默认 3e-4
   - `--max_seq_len` 默认 256
   - `--data` 默认 `model_training/datasets/triclass/train.jsonl`
   - `--val_data` 默认 `model_training/datasets/triclass/val.jsonl`
4. **新增验证逻辑**：每 epoch 结束在 val 集上计算 loss 和准确率
5. **MPS 精度**：使用 float16
6. **保存逻辑**：只保存 LoRA 权重（PEFT save_pretrained 默认行为）
7. **训练日志**：输出每 step 的 loss、lr、val_loss、val_accuracy

### 7.3 新建 `scripts/eval_triclass.py`

测试评估脚本，功能：

1. 加载测试集 `datasets/triclass/test.jsonl`
2. 分别用**微调后模型（LoRA）**和**原始 Qwen3.5-0.8B-Instruct 模型**进行推理
3. 对每个样本生成 1 个 token，判断 safe/suspicious/dangerous
4. 计算指标：
   - 准确率 (Accuracy)
   - 每类的 Precision / Recall / F1
   - 混淆矩阵
5. 找出两个模型**判定不一致的样本**
6. 生成测试报告 `logs/eval_triclass_report.md`，包含：
   - 两个模型的指标对比表
   - 不一致案例列表（含 user 输入、原模型判定、微调模型判定、真实标签）
   - 分析总结

### 7.4 修改 `configs/training_config.yaml`

更新所有配置项：模型名 Qwen3.5-0.8B-Instruct，输出名 QiseGuard-SC-0.8B，三分类参数。

### 7.5 重写 `docs/lora_finetuning_tutorial.md`

完整的三分类微调教程，包含：

1. 环境准备（M4 16GB + MPS 注意事项）
2. 数据准备（转换脚本用法 + 数据格式说明）
3. 基座模型选型分析（Instruct vs Base）
4. LoRA 配置讲解
5. 训练命令和参数说明
6. **训练过程观察与调参记录**：
   - 初始训练 loss 曲线分析
   - 如果发现过拟合/欠拟合的调参策略
   - 学习率、epoch 数、rank 等关键参数的调整过程
7. 测试评估（eval 脚本用法 + 报告解读）
8. 推理使用方式
9. 问题记录

## 8. 训练执行流程

```bash
cd qise

# Step 1: 数据转换（生成 train/val/test）
python model_training/scripts/convert_to_triclass.py

# Step 2: 训练（MPS 单机，M4 16GB）
python model_training/scripts/train_triclass.py \
    --model Qwen/Qwen3.5-0.8B-Instruct \
    --data model_training/datasets/triclass/train.jsonl \
    --val_data model_training/datasets/triclass/val.jsonl \
    --output QiseGuard-SC-0.8B \
    --lora_rank 16 --lora_alpha 32 \
    --batch_size 4 --grad_accum 8 \
    --epochs 5 --lr 3e-4 --max_seq_len 256

# Step 3: 观察训练日志，判断是否需要调参
# 如果 val_loss 持续上升 -> 降低 lr / 减少 epoch / 增大 dropout
# 如果 train_loss 下降但 val_loss 不降 -> 过拟合，减小 rank 或增大数据

# Step 4: 测试评估（对比微调模型 vs 原模型）
python model_training/scripts/eval_triclass.py \
    --base_model Qwen/Qwen3.5-0.8B-Instruct \
    --lora_path model_training/models/QiseGuard-SC-0.8B \
    --test_data model_training/datasets/triclass/test.jsonl

# Step 5: 根据评估结果决定是否调参后重新训练
```

## 9. 实施步骤

1. 新建 `scripts/convert_to_triclass.py` 数据转换脚本
2. 运行数据转换，生成 `datasets/triclass/train.jsonl`、`val.jsonl`、`test.jsonl`
3. 新建 `scripts/train_triclass.py` 训练脚本
4. 新建 `scripts/eval_triclass.py` 测试评估脚本
5. 运行训练，观察日志
6. 根据训练趋势决定是否调参（记录在教程中）
7. 运行测试评估，生成对比报告
8. 更新 `configs/training_config.yaml`
9. 重写 `docs/lora_finetuning_tutorial.md` 完整教程
