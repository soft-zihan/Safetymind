"""
Step 6: Stream v2 训练 (v2 — 双 head 修复版)
- 基座: Qwen3-0.6B-Base, Backbone LoRA + 双分类头 (二分类)
- Response Risk Head: Safe/Unsafe (2 类)
- Query Risk Head: Safe/Unsafe (2 类)
- 砍掉 category head 和 Controversial
- Loss masking: prompt 样本只训练 query head, response 样本只训练 response head
- 配置: rank=16, lr=1e-4/5e-4, epochs=3
- 输出: stream_v2/outputs/
"""
import json
import os
import sys
from datetime import datetime

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from shared.data_utils import load_jsonl
from transformers import AutoModel, AutoTokenizer, AutoConfig
from peft import LoraConfig, get_peft_model


# ── 类别映射 (二分类) ─────────────────────────────────────
RISK_MAP = {0: "Safe", 1: "Unsafe"}
RISK_TO_ID = {v: k for k, v in RISK_MAP.items()}


# ── RMSNorm ───────────────────────────────────────────────
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


# ── CheryGuardStreamModel (v2: 2 heads, binary) ──────────
class CheryGuardStreamModel(nn.Module):
    """Stream v2 模型 — 双 risk head (二分类)

    架构:
      Input → Qwen3-0.6B-Base + LoRA → last_hidden_state[:, -1, :]
                                          ↓
                        ┌───────────────┴───────────────┐
                        ↓                               ↓
                   RMSNorm + Linear              RMSNorm + Linear
                   (1024→512)                     (1024→512)
                        ↓                               ↓
                  Response Risk Head            Query Risk Head
                  Linear(512→2) → Softmax       Linear(512→2) → Softmax
                  (Safe / Unsafe)                (Safe / Unsafe)

    训练时:
      - prompt 样本: input = "USER: {prompt}"        → last token = prompt 末尾 → 只训练 query head
      - response 样本: input = "USER: {prompt}\n\nASSISTANT: {response}" → last token = response 末尾 → 只训练 response head
    """

    def __init__(
        self,
        base_model_name: str = "Qwen/Qwen3-0.6B-Base",
        hidden_size: int = 1024,
        guard_inner_size: int = 512,
        num_classes: int = 2,  # Safe=0, Unsafe=1
        lora_rank: int = 16,
        lora_alpha: int = 32,
        rms_eps: float = 1e-6,
    ):
        super().__init__()
        print(f"  加载基座: {base_model_name}")
        config = AutoConfig.from_pretrained(base_model_name, trust_remote_code=True)
        self.backbone = AutoModel.from_pretrained(
            base_model_name, config=config,
            torch_dtype=torch.float16, trust_remote_code=True,
        )

        lora_config = LoraConfig(
            r=lora_rank, lora_alpha=lora_alpha, lora_dropout=0.05, bias="none",
            target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                            "gate_proj", "up_proj", "down_proj"],
        )
        self.backbone = get_peft_model(self.backbone, lora_config)

        # Response risk head
        self.response_risk_pre = nn.Linear(hidden_size, guard_inner_size, bias=False)
        self.response_risk_norm = RMSNorm(guard_inner_size, eps=rms_eps)
        self.response_risk_head = nn.Linear(guard_inner_size, num_classes, bias=False)

        # Query risk head
        self.query_risk_pre = nn.Linear(hidden_size, guard_inner_size, bias=False)
        self.query_risk_norm = RMSNorm(guard_inner_size, eps=rms_eps)
        self.query_risk_head = nn.Linear(guard_inner_size, num_classes, bias=False)

        # 初始化分类头
        for m in [self.response_risk_pre, self.response_risk_head,
                  self.query_risk_pre, self.query_risk_head]:
            m.weight.data.normal_(mean=0.0, std=0.02)

    def forward(self, input_ids, attention_mask=None, position_ids=None):
        outputs = self.backbone(input_ids=input_ids, attention_mask=attention_mask,
                                position_ids=position_ids)
        last_hidden = outputs.last_hidden_state[:, -1:, :]  # [batch, 1, hidden]

        # Response risk head
        resp_x = self.response_risk_pre(last_hidden)
        resp_x = self.response_risk_norm(resp_x)
        response_risk_logits = self.response_risk_head(resp_x)  # [batch, 1, 2]

        # Query risk head
        query_x = self.query_risk_pre(last_hidden)
        query_x = self.query_risk_norm(query_x)
        query_risk_logits = self.query_risk_head(query_x)  # [batch, 1, 2]

        return {
            "response_risk_logits": response_risk_logits,
            "query_risk_logits": query_risk_logits,
        }


# ── 损失函数 (loss masking per sample type) ────────────────
def compute_loss(outputs, resp_label, query_label, device):
    """
    resp_label: int or None  — response 样本的 risk label (0=Safe, 1=Unsafe)
    query_label: int or None — prompt 样本的 risk label
    """
    total_loss = torch.tensor(0.0, device=device)
    losses = {}

    if resp_label is not None:
        resp_loss = F.cross_entropy(
            outputs["response_risk_logits"].view(1, -1),
            torch.tensor([resp_label], device=device),
        )
        total_loss = total_loss + resp_loss
        losses["resp_loss"] = resp_loss.item()

    if query_label is not None:
        query_loss = F.cross_entropy(
            outputs["query_risk_logits"].view(1, -1),
            torch.tensor([query_label], device=device),
        )
        total_loss = total_loss + query_loss
        losses["query_loss"] = query_loss.item()

    return total_loss, losses


# ── 数据集 ────────────────────────────────────────────────
class StreamDataset(Dataset):
    def __init__(self, data_path: str, tokenizer, max_length: int = 1024):
        self.data = load_jsonl(data_path)
        self.tokenizer = tokenizer
        self.max_length = max_length

    def __len__(self):
        return len(self.data)

    def __getitem__(self, idx):
        sample = self.data[idx]
        task_type = sample.get("task_type", "response")
        prompt = sample["prompt"]
        response = sample.get("response", "")
        safety_label = sample.get("safety_label", "Safe")
        risk_label = RISK_TO_ID.get(safety_label, 0)  # 0=Safe, 1=Unsafe

        if task_type == "prompt":
            # prompt-only: 只训练 query head
            text = f"USER: {prompt}"
            resp_label = None
            query_label = risk_label
        else:
            # response: 只训练 response head
            text = f"USER: {prompt}\n\nASSISTANT: {response}"
            resp_label = risk_label
            query_label = None

        input_ids = self.tokenizer.encode(
            text, add_special_tokens=True,
            max_length=self.max_length, truncation=True,
        )

        return {
            "input_ids": torch.tensor(input_ids, dtype=torch.long),
            "attention_mask": torch.ones(len(input_ids), dtype=torch.long),
            "resp_label": resp_label,
            "query_label": query_label,
            "task_type": task_type,
        }


def collate_fn(batch):
    max_len = max(len(b["input_ids"]) for b in batch)
    for b in batch:
        pad_len = max_len - len(b["input_ids"])
        b["input_ids"] = F.pad(b["input_ids"], (0, pad_len), value=0)
        b["attention_mask"] = F.pad(b["attention_mask"], (0, pad_len), value=0)

    return {
        "input_ids": torch.stack([b["input_ids"] for b in batch]),
        "attention_mask": torch.stack([b["attention_mask"] for b in batch]),
        "resp_label": [b["resp_label"] for b in batch],
        "query_label": [b["query_label"] for b in batch],
        "task_type": [b["task_type"] for b in batch],
    }


# ── 训练主函数 ────────────────────────────────────────────
def train_stream(data_path, output_dir, base_model="Qwen/Qwen3-0.6B-Base",
                 epochs=3, lr=1e-4, batch_size=1, grad_accum=32):
    print("=" * 60)
    print("  CheryGuard Stream v2 - 训练 (双 head 修复版)")
    print("=" * 60)

    if torch.cuda.is_available():
        device = "cuda"
    elif torch.backends.mps.is_available():
        device = "mps"
    else:
        device = "cpu"
    print(f"  设备: {device}")

    tokenizer = AutoTokenizer.from_pretrained(base_model, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] 加载数据...")
    dataset = StreamDataset(data_path, tokenizer)
    print(f"  训练样本: {len(dataset)}")

    # 统计
    prompt_cnt = sum(1 for i in range(len(dataset)) if dataset[i]["task_type"] == "prompt")
    resp_cnt = len(dataset) - prompt_cnt
    prompt_safe = sum(1 for i in range(len(dataset))
                      if dataset[i]["task_type"] == "prompt" and dataset[i]["query_label"] == 0)
    prompt_unsafe = sum(1 for i in range(len(dataset))
                        if dataset[i]["task_type"] == "prompt" and dataset[i]["query_label"] == 1)
    resp_safe = sum(1 for i in range(len(dataset))
                    if dataset[i]["task_type"] == "response" and dataset[i]["resp_label"] == 0)
    resp_unsafe = sum(1 for i in range(len(dataset))
                      if dataset[i]["task_type"] == "response" and dataset[i]["resp_label"] == 1)
    print(f"  Prompt: {prompt_cnt} (Safe={prompt_safe}, Unsafe={prompt_unsafe})")
    print(f"  Response: {resp_cnt} (Safe={resp_safe}, Unsafe={resp_unsafe})")

    dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True,
                            collate_fn=collate_fn, num_workers=0)

    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] 创建模型...")
    model = CheryGuardStreamModel(base_model_name=base_model)

    if device in ("cuda", "mps"):
        model = model.to(device)

    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"  总参数: {total_params/1e6:.1f}M")
    print(f"  可训练: {trainable_params/1e6:.1f}M ({100*trainable_params/total_params:.1f}%)")

    # 优化器
    backbone_params = [p for n, p in model.backbone.named_parameters() if p.requires_grad]
    head_params = (
        list(model.response_risk_pre.parameters())
        + list(model.response_risk_norm.parameters())
        + list(model.response_risk_head.parameters())
        + list(model.query_risk_pre.parameters())
        + list(model.query_risk_norm.parameters())
        + list(model.query_risk_head.parameters())
    )

    optimizer = torch.optim.AdamW(
        [{"params": backbone_params, "lr": lr},
         {"params": head_params, "lr": lr * 5}],
        weight_decay=0.01,
    )

    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] 开始训练...")
    print(f"  epochs: {epochs}, batch_size: {batch_size} x {grad_accum}", flush=True)

    model.train()
    global_step = 0

    for epoch in range(epochs):
        epoch_total_loss = 0.0
        epoch_resp_loss = 0.0
        epoch_query_loss = 0.0
        num_batches = 0
        num_resp = 0
        num_query = 0

        for batch_idx, batch in enumerate(dataloader):
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)

            outputs = model(input_ids=input_ids, attention_mask=attention_mask)

            batch_loss = torch.tensor(0.0, device=device)
            batch_resp = 0.0
            batch_query = 0.0

            for i in range(len(batch["resp_label"])):
                sample_outputs = {
                    "response_risk_logits": outputs["response_risk_logits"][i:i+1],
                    "query_risk_logits": outputs["query_risk_logits"][i:i+1],
                }
                loss, losses = compute_loss(
                    sample_outputs,
                    resp_label=batch["resp_label"][i],
                    query_label=batch["query_label"][i],
                    device=device,
                )
                batch_loss = batch_loss + loss / len(batch["resp_label"])
                if "resp_loss" in losses:
                    batch_resp += losses["resp_loss"]
                    num_resp += 1
                if "query_loss" in losses:
                    batch_query += losses["query_loss"]
                    num_query += 1

            batch_loss = batch_loss / grad_accum
            batch_loss.backward()

            epoch_total_loss += batch_loss.item() * grad_accum
            epoch_resp_loss += batch_resp
            epoch_query_loss += batch_query
            num_batches += 1

            del outputs, batch_loss, loss, losses
            if device == "mps":
                torch.mps.empty_cache()

            if (batch_idx + 1) % grad_accum == 0:
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                optimizer.step()
                optimizer.zero_grad()
                global_step += 1
                if device == "mps":
                    torch.mps.empty_cache()

            if (batch_idx + 1) % 100 == 0:
                print(f"  Epoch {epoch+1} | Batch {batch_idx+1}/{len(dataloader)} | "
                      f"Loss: {epoch_total_loss/max(1,num_batches):.4f} | "
                      f"Resp: {epoch_resp_loss/max(1,num_resp):.4f} | "
                      f"Query: {epoch_query_loss/max(1,num_query):.4f}", flush=True)

        avg_loss = epoch_total_loss / max(1, num_batches)
        avg_resp = epoch_resp_loss / max(1, num_resp)
        avg_query = epoch_query_loss / max(1, num_query)
        print(f"\n  Epoch {epoch+1} 完成 | Loss: {avg_loss:.4f} | "
              f"Resp: {avg_resp:.4f} | Query: {avg_query:.4f}", flush=True)

        # 保存 checkpoint
        ckpt_dir = os.path.join(output_dir, f"checkpoint-epoch-{epoch+1}")
        os.makedirs(ckpt_dir, exist_ok=True)
        torch.save({"epoch": epoch, "model_state": model.state_dict(),
                     "optimizer_state": optimizer.state_dict()},
                    os.path.join(ckpt_dir, "checkpoint.pt"))
        print(f"  Checkpoint: {ckpt_dir}")

    # 最终保存
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] 保存最终模型...")
    os.makedirs(output_dir, exist_ok=True)
    model.backbone.save_pretrained(os.path.join(output_dir, "lora_adapter"))
    tokenizer.save_pretrained(output_dir)

    head_state = {
        "response_risk_pre": model.response_risk_pre.state_dict(),
        "response_risk_norm": model.response_risk_norm.state_dict(),
        "response_risk_head": model.response_risk_head.state_dict(),
        "query_risk_pre": model.query_risk_pre.state_dict(),
        "query_risk_norm": model.query_risk_norm.state_dict(),
        "query_risk_head": model.query_risk_head.state_dict(),
    }
    torch.save(head_state, os.path.join(output_dir, "stream_heads.pt"))

    config = {
        "base_model": base_model, "hidden_size": 1024, "guard_inner_size": 512,
        "num_classes": 2, "classes": ["Safe", "Unsafe"],
        "lora_rank": 16, "lora_alpha": 32, "epochs": epochs,
        "learning_rate": lr, "batch_size": batch_size, "gradient_accumulation": grad_accum,
        "device": device, "timestamp": datetime.now().isoformat(),
        "architecture": "v2_dual_head_binary: response_risk_head + query_risk_head, "
                         "no category heads, no Controversial",
        "training_data": {
            "total": len(dataset), "prompt": prompt_cnt, "response": resp_cnt,
            "prompt_safe": prompt_safe, "prompt_unsafe": prompt_unsafe,
            "response_safe": resp_safe, "response_unsafe": resp_unsafe,
        },
    }
    with open(os.path.join(output_dir, "training_config.json"), "w") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*60}")
    print(f"  ✅ Stream v2 训练完成!")
    print(f"  LoRA adapter: {output_dir}/lora_adapter/")
    print(f"  Stream heads: {output_dir}/stream_heads.pt")
    print(f"  Config: {output_dir}/training_config.json")
    print(f"{'='*60}")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="CheryGuard Stream v2 训练")
    parser.add_argument("--data", type=str, default=None)
    parser.add_argument("--output", type=str, default=None)
    parser.add_argument("--base-model", type=str, default="Qwen/Qwen3-0.6B-Base")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--lr", type=float, default=1e-4)
    parser.add_argument("--batch-size", type=int, default=1)
    parser.add_argument("--gradient-accumulation", type=int, default=32)
    args = parser.parse_args()

    data_path = args.data or os.path.join(os.path.dirname(__file__), "..", "data", "stream_train.jsonl")
    output_dir = args.output or os.path.join(os.path.dirname(__file__), "..", "outputs")

    if not os.path.exists(data_path):
        print(f"❌ 训练数据不存在: {data_path}")
        sys.exit(1)

    train_stream(data_path, output_dir, args.base_model,
                 args.epochs, args.lr, args.batch_size, args.gradient_accumulation)


if __name__ == "__main__":
    main()
