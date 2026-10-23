"""
Step 3: Gen v2 LoRA 训练
- 复用 v1 配置: rank=16, lr=1e-4, batch=1, acc=32, epochs=3, max_length=1024
- 使用新数据: gen_v2/data/train.jsonl + val.jsonl
- 每 epoch 保存 checkpoint
"""
import sys, os, json, torch
sys.path.insert(0, os.path.dirname(__file__) + '/../..')

from transformers import (
    AutoModelForCausalLM, AutoTokenizer,
    TrainingArguments, Trainer, DataCollatorForSeq2Seq,
)
from peft import LoraConfig, get_peft_model, TaskType
from torch.utils.data import Dataset

# ============================================================
# 1. 配置
# ============================================================
MODEL_NAME = "Qwen/Qwen3-0.6B"
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data')
OUTPUT_DIR = os.path.join(BASE_DIR, 'outputs', 'lora')
MAX_LENGTH = 1024
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ============================================================
# 2. 数据集
# ============================================================
class GuardDataset(Dataset):
    def __init__(self, data_path, tokenizer, max_length=1024):
        self.data = [json.loads(line) for line in open(data_path)]
        self.tokenizer = tokenizer
        self.max_length = max_length

    def __len__(self):
        return len(self.data)

    def __getitem__(self, idx):
        item = self.data[idx]
        input_ids = self.tokenizer.encode(item["text"], add_special_tokens=False)
        label_ids = self.tokenizer.encode(item["labels_text"], add_special_tokens=False)
        full_ids = input_ids + label_ids
        labels = [-100] * len(input_ids) + label_ids
        if len(full_ids) > self.max_length:
            full_ids = full_ids[:self.max_length]
            labels = labels[:self.max_length]
        return {
            "input_ids": torch.tensor(full_ids, dtype=torch.long),
            "labels": torch.tensor(labels, dtype=torch.long),
            "attention_mask": torch.ones(len(full_ids), dtype=torch.long),
        }

# ============================================================
# 3. 加载模型
# ============================================================
print(f"Loading {MODEL_NAME}...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, trust_remote_code=True)
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

model = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME,
    torch_dtype=torch.float16,
    trust_remote_code=True,
)

# LoRA
lora_config = LoraConfig(
    r=16,
    lora_alpha=32,
    lora_dropout=0.05,
    bias="none",
    task_type=TaskType.CAUSAL_LM,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
)
model = get_peft_model(model, lora_config)
model.print_trainable_parameters()

# ============================================================
# 4. 加载数据
# ============================================================
train_dataset = GuardDataset(os.path.join(DATA_DIR, 'train.jsonl'), tokenizer, MAX_LENGTH)
val_dataset = GuardDataset(os.path.join(DATA_DIR, 'val.jsonl'), tokenizer, MAX_LENGTH)
print(f"Train: {len(train_dataset)}, Val: {len(val_dataset)}")

# ============================================================
# 5. 训练参数
# ============================================================
training_args = TrainingArguments(
    output_dir=OUTPUT_DIR,
    num_train_epochs=3,
    per_device_train_batch_size=1,
    per_device_eval_batch_size=1,
    gradient_accumulation_steps=32,
    learning_rate=1e-4,
    warmup_ratio=0.1,
    lr_scheduler_type="cosine",
    weight_decay=0.01,
    logging_steps=10,
    eval_strategy="no",           # 跳过训练中评估，避免 OOM
    save_strategy="steps",         # 每 N 步保存，防止丢失进度
    save_steps=50,
    fp16=True,
    gradient_checkpointing=True,
    optim="adamw_torch",
    report_to="none",
    remove_unused_columns=False,
)

# ============================================================
# 6. 训练
# ============================================================
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=val_dataset,
    data_collator=DataCollatorForSeq2Seq(tokenizer, pad_to_multiple_of=8),
)
print("Starting training...")
trainer.train()

# ============================================================
# 7. 保存
# ============================================================
trainer.save_model(OUTPUT_DIR)
tokenizer.save_pretrained(OUTPUT_DIR)
print(f"Model saved to: {OUTPUT_DIR}")