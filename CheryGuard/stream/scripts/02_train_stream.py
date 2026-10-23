"""CheryGuard - Stream Phase 2: 训练脚本

基座: Qwen/Qwen3-0.6B-Base（pretrained）
架构: 严格对齐官方 Qwen3ForGuardModel（stream/model_ref/modeling_qwen3_guard.py）
损失函数: 论文 §4.3 四头损失

官方架构:
  - backbone: Qwen3Model（纯 Transformer，无 LM head）
  - Response head: Linear(hidden→inner) + RMSNorm → risk_level(3) + category(8)
  - Query head: Linear(hidden→inner) + RMSNorm → query_risk_level(3) + query_category(9)
  - guard_inner_size=512, num_risk_level=3, num_category=8, num_query_category=9

训练配置:
  - Backbone: LoRA (rank=16) + fp32（分类头随机初始化，fp16 不稳定）
  - 分类头: 全量训练（~2M 参数）
  - 条件类别损失: 仅 unsafe/controversial 时计算
"""

import json
import math
import os
import sys
from datetime import datetime
from dataclasses import dataclass
from typing import Optional, Tuple, Dict

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from shared.data_utils import load_jsonl

from transformers import AutoModel, AutoTokenizer, AutoConfig
from peft import LoraConfig, get_peft_model


# ── 类别映射（与官方 config.json 完全一致）──────────────────
RISK_LEVEL_MAP = {0: "Safe", 1: "Unsafe", 2: "Controversial"}
CATEGORY_MAP = {
    0: "Violent", 1: "Sexual Content", 2: "Self-Harm", 3: "Political",
    4: "PII", 5: "Copyright", 6: "Illegal Acts", 7: "Unethical",
}
QUERY_CATEGORY_MAP = {**CATEGORY_MAP, 8: "Jailbreak"}

# 反向映射
RISK_LEVEL_TO_ID = {v: k for k, v in RISK_LEVEL_MAP.items()}
CATEGORY_TO_ID = {v: k for k, v in CATEGORY_MAP.items()}
QUERY_CATEGORY_TO_ID = {v: k for k, v in QUERY_CATEGORY_MAP.items()}


# ── RMSNorm（与官方一致）──────────────────────────────────
class RMSNorm(nn.Module):
    def __init__(self, hidden_size: int, eps: float = 1e-6):
        super().__init__()
        self.weight = nn.Parameter(torch.ones(hidden_size))
        self.variance_epsilon = eps

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        input_dtype = x.dtype
        x = x.float()
        variance = x.pow(2).mean(-1, keepdim=True)
        x = x * torch.rsqrt(variance + self.variance_epsilon)
        return (self.weight * x).to(input_dtype)


# ── CheryGuardStreamModel ─────────────────────────────────
class CheryGuardStreamModel(nn.Module):
    """CheryGuard Stream 模型

    严格对齐官方 Qwen3ForGuardModel 架构:
    - backbone: Qwen3-0.6B-Base + LoRA
    - Response heads: Linear(1024→512) + RMSNorm → risk_level(3) + category(8)
    - Query heads: Linear(1024→512) + RMSNorm → query_risk_level(3) + query_category(9)
    """

    def __init__(
        self,
        base_model_name: str = "Qwen/Qwen3-0.6B-Base",
        hidden_size: int = 1024,
        guard_inner_size: int = 512,
        num_risk_level: int = 3,
        num_category: int = 8,
        num_query_risk_level: int = 3,
        num_query_category: int = 9,
        lora_rank: int = 16,
        lora_alpha: int = 32,
        rms_eps: float = 1e-6,
    ):
        super().__init__()

        # 加载 Qwen3 backbone（纯 Model，非 CausalLM）
        print(f"  加载基座: {base_model_name}")
        config = AutoConfig.from_pretrained(base_model_name, trust_remote_code=True)
        self.backbone = AutoModel.from_pretrained(
            base_model_name,
            config=config,
            torch_dtype=torch.float32,
            trust_remote_code=True,
        )

        # LoRA 注入
        lora_config = LoraConfig(
            r=lora_rank,
            lora_alpha=lora_alpha,
            lora_dropout=0.05,
            bias="none",
            target_modules=[
                "q_proj", "k_proj", "v_proj", "o_proj",
                "gate_proj", "up_proj", "down_proj",
            ],
        )
        self.backbone = get_peft_model(self.backbone, lora_config)

        # ── Response 分类头 ──
        self.risk_level_category_pre = nn.Linear(hidden_size, guard_inner_size, bias=False)
        self.risk_level_category_layernorm = RMSNorm(guard_inner_size, eps=rms_eps)
        self.risk_level_head = nn.Linear(guard_inner_size, num_risk_level, bias=False)
        self.category_head = nn.Linear(guard_inner_size, num_category, bias=False)

        # ── Query 分类头 ──
        self.query_risk_level_category_pre = nn.Linear(hidden_size, guard_inner_size, bias=False)
        self.query_risk_level_category_layernorm = RMSNorm(guard_inner_size, eps=rms_eps)
        self.query_risk_level_head = nn.Linear(guard_inner_size, num_query_risk_level, bias=False)
        self.query_category_head = nn.Linear(guard_inner_size, num_query_category, bias=False)

        self.risk_level_category_pre.weight.data.normal_(mean=0.0, std=0.02)
        self.risk_level_head.weight.data.normal_(mean=0.0, std=0.02)
        self.category_head.weight.data.normal_(mean=0.0, std=0.02)
        self.query_risk_level_category_pre.weight.data.normal_(mean=0.0, std=0.02)
        self.query_risk_level_head.weight.data.normal_(mean=0.0, std=0.02)
        self.query_category_head.weight.data.normal_(mean=0.0, std=0.02)

    def forward(
        self,
        input_ids: torch.LongTensor,
        attention_mask: Optional[torch.Tensor] = None,
        position_ids: Optional[torch.LongTensor] = None,
    ):
        """前向传播

        Returns:
            dict with: risk_level_logits, category_logits,
                       query_risk_level_logits, query_category_logits
        """
        outputs = self.backbone(
            input_ids=input_ids,
            attention_mask=attention_mask,
            position_ids=position_ids,
        )
        hidden_states = outputs.last_hidden_state  # [batch, seq_len, hidden]

        # 取最后一个 token 的 hidden state
        last_hidden = hidden_states[:, -1:, :]  # [batch, 1, hidden]

        # Response heads
        resp_x = self.risk_level_category_pre(last_hidden)
        resp_x = self.risk_level_category_layernorm(resp_x)
        risk_level_logits = self.risk_level_head(resp_x)
        category_logits = self.category_head(resp_x)

        # Query heads
        query_x = self.query_risk_level_category_pre(last_hidden)
        query_x = self.query_risk_level_category_layernorm(query_x)
        query_risk_level_logits = self.query_risk_level_head(query_x)
        query_category_logits = self.query_category_head(query_x)

        return {
            "risk_level_logits": risk_level_logits,
            "category_logits": category_logits,
            "query_risk_level_logits": query_risk_level_logits,
            "query_category_logits": query_category_logits,
        }


# ── 损失函数（论文 §4.3）──────────────────────────────────
def compute_stream_loss(
    outputs: dict,
    risk_level_label: Optional[int],
    category_label: Optional[int],
    query_risk_level_label: Optional[int],
    query_category_label: Optional[int],
    category_loss_weight: float = 0.5,
) -> dict:
    """计算 Stream 四头损失

    Args:
        outputs: 模型输出
        risk_level_label: response risk level 标签 (0/1/2) or None
        category_label: response category 标签 (0-7) or None
        query_risk_level_label: query risk level 标签 or None
        query_category_label: query category 标签 or None
        category_loss_weight: 类别损失权重

    Returns:
        dict with total_loss, risk_loss, category_loss, query_risk_loss, query_category_loss
    """
    total_loss = torch.tensor(0.0, device=next(iter(outputs.values())).device)
    losses = {}

    # Response risk level
    if risk_level_label is not None:
        risk_loss = F.cross_entropy(
            outputs["risk_level_logits"].view(1, -1),
            torch.tensor([risk_level_label], device=outputs["risk_level_logits"].device),
        )
        total_loss = total_loss + risk_loss
        losses["risk_loss"] = risk_loss.item()
    else:
        losses["risk_loss"] = 0.0

    # Response category（仅 unsafe/controversial 时计算）
    if category_label is not None and risk_level_label in (1, 2):
        cat_loss = F.cross_entropy(
            outputs["category_logits"].view(1, -1),
            torch.tensor([category_label], device=outputs["category_logits"].device),
        )
        total_loss = total_loss + category_loss_weight * cat_loss
        losses["category_loss"] = cat_loss.item()
    else:
        losses["category_loss"] = 0.0

    # Query risk level
    if query_risk_level_label is not None:
        query_risk_loss = F.cross_entropy(
            outputs["query_risk_level_logits"].view(1, -1),
            torch.tensor([query_risk_level_label], device=outputs["query_risk_level_logits"].device),
        )
        total_loss = total_loss + query_risk_loss
        losses["query_risk_loss"] = query_risk_loss.item()
    else:
        losses["query_risk_loss"] = 0.0

    # Query category（仅 unsafe/controversial 时计算）
    if query_category_label is not None and query_risk_level_label in (1, 2):
        query_cat_loss = F.cross_entropy(
            outputs["query_category_logits"].view(1, -1),
            torch.tensor([query_category_label], device=outputs["query_category_logits"].device),
        )
        total_loss = total_loss + category_loss_weight * query_cat_loss
        losses["query_category_loss"] = query_cat_loss.item()
    else:
        losses["query_category_loss"] = 0.0

    losses["total_loss"] = total_loss
    return losses


# ── 数据集 ────────────────────────────────────────────────
class StreamDataset(Dataset):
    """Stream 训练数据集"""

    def __init__(self, data_path: str, tokenizer, max_length: int = 2048):
        self.data = load_jsonl(data_path)
        self.tokenizer = tokenizer
        self.max_length = max_length

    def __len__(self):
        return len(self.data)

    def __getitem__(self, idx):
        sample = self.data[idx]
        prompt = sample["prompt"]
        response = sample.get("response", "")
        teacher_safety = sample.get("teacher_safety", "Safe")
        teacher_categories = sample.get("teacher_categories", [])

        # 映射标签
        risk_level_label = RISK_LEVEL_TO_ID.get(teacher_safety, 0)

        # 类别标签: 取第一个匹配的类别
        category_label = None
        if teacher_categories and risk_level_label in (1, 2):
            for cat in teacher_categories:
                if cat in CATEGORY_TO_ID:
                    category_label = CATEGORY_TO_ID[cat]
                    break
            if category_label is None:
                # 尝试模糊匹配
                for cat in teacher_categories:
                    for key, val in CATEGORY_TO_ID.items():
                        if key.lower() in cat.lower() or cat.lower() in key.lower():
                            category_label = val
                            break
                    if category_label is not None:
                        break

        # 构造输入: prompt + response
        if response:
            text = f"USER: {prompt}\n\nASSISTANT: {response}"
        else:
            text = f"USER: {prompt}"

        input_ids = self.tokenizer.encode(
            text,
            add_special_tokens=True,
            max_length=self.max_length,
            truncation=True,
        )

        return {
            "input_ids": torch.tensor(input_ids, dtype=torch.long),
            "attention_mask": torch.ones(len(input_ids), dtype=torch.long),
            "risk_level_label": risk_level_label,
            "category_label": category_label,
            "query_risk_level_label": risk_level_label,
            "query_category_label": category_label,
        }


def collate_fn(batch):
    """动态 padding"""
    max_len = max(len(b["input_ids"]) for b in batch)
    for b in batch:
        pad_len = max_len - len(b["input_ids"])
        b["input_ids"] = F.pad(b["input_ids"], (0, pad_len), value=0)
        b["attention_mask"] = F.pad(b["attention_mask"], (0, pad_len), value=0)

    return {
        "input_ids": torch.stack([b["input_ids"] for b in batch]),
        "attention_mask": torch.stack([b["attention_mask"] for b in batch]),
        "risk_level_label": [b["risk_level_label"] for b in batch],
        "category_label": [b["category_label"] for b in batch],
        "query_risk_level_label": [b["query_risk_level_label"] for b in batch],
        "query_category_label": [b["query_category_label"] for b in batch],
    }


# ── 训练主函数 ────────────────────────────────────────────
def train_stream(
    data_path: str,
    output_dir: str,
    base_model: str = "Qwen/Qwen3-0.6B-Base",
    epochs: int = 3,
    learning_rate: float = 1e-4,
    batch_size: int = 4,
    gradient_accumulation: int = 8,
):
    """训练 Stream 模型"""
    print("=" * 60)
    print("  CheryGuard - Stream 训练")
    print("=" * 60)

    # 检测设备
    if torch.cuda.is_available():
        device = "cuda"
    elif torch.backends.mps.is_available():
        device = "mps"
    else:
        device = "cpu"
    print(f"  设备: {device}")

    # 加载 tokenizer
    tokenizer = AutoTokenizer.from_pretrained(base_model, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    # 加载数据
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] 加载数据...")
    dataset = StreamDataset(data_path, tokenizer)
    print(f"  训练样本: {len(dataset)}")

    dataloader = DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=True,
        collate_fn=collate_fn,
        num_workers=0,
    )

    # 创建模型
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] 创建模型...")
    model = CheryGuardStreamModel(base_model_name=base_model, lora_rank=16, lora_alpha=32)

    if device in ("cuda", "mps"):
        model = model.to(device)

    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"  总参数: {total_params/1e6:.1f}M")
    print(f"  可训练: {trainable_params/1e6:.1f}M ({100*trainable_params/total_params:.1f}%)")

    # 优化器: backbone LoRA 和分类头分开学习率
    backbone_params = [p for n, p in model.backbone.named_parameters() if p.requires_grad]
    head_params = (
        list(model.risk_level_category_pre.parameters())
        + list(model.risk_level_category_layernorm.parameters())
        + list(model.risk_level_head.parameters())
        + list(model.category_head.parameters())
        + list(model.query_risk_level_category_pre.parameters())
        + list(model.query_risk_level_category_layernorm.parameters())
        + list(model.query_risk_level_head.parameters())
        + list(model.query_category_head.parameters())
    )

    optimizer = torch.optim.AdamW(
        [
            {"params": backbone_params, "lr": learning_rate},
            {"params": head_params, "lr": learning_rate * 5},
        ],
        weight_decay=0.01,
    )

    # 训练循环
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] 开始训练...")
    print(f"  epochs: {epochs}")
    print(f"  batch_size: {batch_size} x {gradient_accumulation} accumulation")

    model.train()
    global_step = 0

    for epoch in range(epochs):
        epoch_total_loss = 0.0
        epoch_risk_loss = 0.0
        epoch_cat_loss = 0.0
        num_batches = 0

        for batch_idx, batch in enumerate(dataloader):
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)

            outputs = model(input_ids=input_ids, attention_mask=attention_mask)

            batch_loss = torch.tensor(0.0, device=device)
            batch_risk = 0.0
            batch_cat = 0.0

            for i in range(len(batch["risk_level_label"])):
                # 每个样本单独计算 loss
                sample_outputs = {
                    "risk_level_logits": outputs["risk_level_logits"][i:i+1],
                    "category_logits": outputs["category_logits"][i:i+1],
                    "query_risk_level_logits": outputs["query_risk_level_logits"][i:i+1],
                    "query_category_logits": outputs["query_category_logits"][i:i+1],
                }

                losses = compute_stream_loss(
                    sample_outputs,
                    risk_level_label=batch["risk_level_label"][i],
                    category_label=batch["category_label"][i],
                    query_risk_level_label=batch["query_risk_level_label"][i],
                    query_category_label=batch["query_category_label"][i],
                )

                batch_loss = batch_loss + losses["total_loss"] / len(batch["risk_level_label"])
                batch_risk += losses["risk_loss"]
                batch_cat += losses["category_loss"]

            batch_loss = batch_loss / gradient_accumulation
            batch_loss.backward()

            epoch_total_loss += losses["total_loss"].item()
            epoch_risk_loss += batch_risk
            epoch_cat_loss += batch_cat
            num_batches += 1

            if (batch_idx + 1) % gradient_accumulation == 0:
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                optimizer.step()
                optimizer.zero_grad()
                global_step += 1

            if (batch_idx + 1) % 50 == 0:
                print(f"  Epoch {epoch+1} | Batch {batch_idx+1}/{len(dataloader)} | "
                      f"Loss: {epoch_total_loss/max(1,num_batches):.4f} | "
                      f"Risk: {epoch_risk_loss/max(1,num_batches):.4f} | "
                      f"Cat: {epoch_cat_loss/max(1,num_batches):.4f}")

        avg_loss = epoch_total_loss / max(1, num_batches)
        avg_risk = epoch_risk_loss / max(1, num_batches)
        avg_cat = epoch_cat_loss / max(1, num_batches)

        print(f"\n  Epoch {epoch+1} 完成 | "
              f"Avg Loss: {avg_loss:.4f} | Risk: {avg_risk:.4f} | Cat: {avg_cat:.4f}")

        # 保存 checkpoint
        ckpt_dir = os.path.join(output_dir, f"checkpoint-epoch-{epoch+1}")
        os.makedirs(ckpt_dir, exist_ok=True)
        torch.save(
            {"epoch": epoch, "model_state": model.state_dict(), "optimizer_state": optimizer.state_dict()},
            os.path.join(ckpt_dir, "checkpoint.pt"),
        )
        print(f"  Checkpoint: {ckpt_dir}")

    # ── 最终保存 ────────────────────────────────────────────
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] 保存最终模型...")
    os.makedirs(output_dir, exist_ok=True)

    # 保存 LoRA adapter
    model.backbone.save_pretrained(os.path.join(output_dir, "lora_adapter"))
    tokenizer.save_pretrained(output_dir)

    # 保存分类头权重
    head_state = {
        "risk_level_category_pre": model.risk_level_category_pre.state_dict(),
        "risk_level_category_layernorm": model.risk_level_category_layernorm.state_dict(),
        "risk_level_head": model.risk_level_head.state_dict(),
        "category_head": model.category_head.state_dict(),
        "query_risk_level_category_pre": model.query_risk_level_category_pre.state_dict(),
        "query_risk_level_category_layernorm": model.query_risk_level_category_layernorm.state_dict(),
        "query_risk_level_head": model.query_risk_level_head.state_dict(),
        "query_category_head": model.query_category_head.state_dict(),
    }
    torch.save(head_state, os.path.join(output_dir, "stream_heads.pt"))

    # 保存模型配置
    config = {
        "base_model": base_model,
        "hidden_size": 1024,
        "guard_inner_size": 512,
        "num_risk_level": 3,
        "num_category": 8,
        "num_query_category": 9,
        "lora_rank": 16,
        "lora_alpha": 32,
        "epochs": epochs,
        "learning_rate": learning_rate,
        "batch_size": batch_size,
        "gradient_accumulation": gradient_accumulation,
        "device": device,
        "timestamp": datetime.now().isoformat(),
    }
    with open(os.path.join(output_dir, "training_config.json"), "w") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*60}")
    print(f"  ✅ Stream 训练完成!")
    print(f"  LoRA adapter: {output_dir}/lora_adapter/")
    print(f"  Stream heads: {output_dir}/stream_heads.pt")
    print(f"{'='*60}")


def main():
    import argparse

    parser = argparse.ArgumentParser(description="CheryGuard Stream 训练")
    parser.add_argument("--data", type=str, default=None, help="训练数据路径")
    parser.add_argument("--output", type=str, default=None, help="输出目录")
    parser.add_argument("--base-model", type=str, default="Qwen/Qwen3-0.6B-Base")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--lr", type=float, default=1e-4)
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--gradient-accumulation", type=int, default=8)
    args = parser.parse_args()

    data_path = args.data or os.path.join(
        os.path.dirname(__file__), "..", "data", "stream_train.jsonl"
    )
    output_dir = args.output or os.path.join(
        os.path.dirname(__file__), "..", "outputs"
    )

    if not os.path.exists(data_path):
        print(f"❌ 训练数据不存在: {data_path}")
        print("  请先运行 01_prepare_stream_data.py")
        sys.exit(1)

    train_stream(
        data_path=data_path,
        output_dir=output_dir,
        base_model=args.base_model,
        epochs=args.epochs,
        learning_rate=args.lr,
        batch_size=args.batch_size,
        gradient_accumulation=args.gradient_accumulation,
    )


if __name__ == "__main__":
    main()