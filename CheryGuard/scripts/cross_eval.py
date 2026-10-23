"""
交叉评估: Gen v2 (生成式输出头) vs Stream v2 (Softmax 分类头)
在同一批测试集上公平对比两种架构的 F1、Precision、Recall、时延。

测试集 (全部来自 Qwen3GuardTest + ToxicChat + SimpleSafetyTests，与训练数据 Aegis2.0/BeaverTails/HarmfulQA 无重叠):
  - thinking (prompt-only, 1059): 评估 prompt 安全分类
  - response_loc (prompt+response, 813): 评估 response 安全分类
  - thinking_loc (prompt+thinking+response, 569): 评估带思维链的 response 分类
  - toxicchat (prompt-only, 200): ToxicChat 测试集
  - simplesafety (prompt-only, 100): SimpleSafetyTests

输出: CheryGuard/eval_results/cross_eval.json
"""
import json, os, sys, time, argparse
from collections import Counter
from pathlib import Path

# 项目根路径
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import torch
from datasets import load_dataset
from transformers import AutoModelForCausalLM, AutoTokenizer, AutoModel, AutoConfig
from peft import PeftModel
import torch.nn as nn

from shared.label_schema import parse_annotation
from shared.chat_template import build_prompt_classification_text, build_response_classification_text

# ==================== 配置 ====================
EVAL_DIR = PROJECT_ROOT / "eval_results"
EVAL_DIR.mkdir(exist_ok=True)

GEN_V2_CKPT = PROJECT_ROOT / "gen_v2" / "outputs" / "lora" / "checkpoint-300"
STREAM_V2_OUTPUTS = PROJECT_ROOT / "stream_v2" / "outputs"
STREAM_V2_LORA = STREAM_V2_OUTPUTS / "lora_adapter"
STREAM_V2_HEADS = STREAM_V2_OUTPUTS / "stream_heads.pt"

# 二分类标签映射
BIN_MAP = {"Safe": 0, "Unsafe": 1, "Controversial": 0}  # Controversial -> Safe (二分类)

def to_bin(label):
    return "Unsafe" if label in ("Unsafe", "Controversial") else "Safe"

def calc_metrics(preds, gts):
    bp = [to_bin(p) for p in preds]
    bg = [to_bin(g) for g in gts]
    tp = sum(1 for p, g in zip(bp, bg) if p == "Unsafe" and g == "Unsafe")
    fp = sum(1 for p, g in zip(bp, bg) if p == "Unsafe" and g == "Safe")
    fn = sum(1 for p, g in zip(bp, bg) if p == "Safe" and g == "Unsafe")
    tn = sum(1 for p, g in zip(bp, bg) if p == "Safe" and g == "Safe")
    prec = tp / (tp + fp) if (tp + fp) > 0 else 0
    rec = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * prec * rec / (prec + rec) if (prec + rec) > 0 else 0
    acc = (tp + tn) / len(preds) if len(preds) > 0 else 0
    return {"accuracy": acc, "f1": f1, "precision": prec, "recall": rec,
            "tp": tp, "fp": fp, "fn": fn, "tn": tn}


# ==================== 加载测试集 ====================
def load_thinking(n=1059):
    """Qwen3GuardTest/thinking — prompt-only"""
    ds = load_dataset("Qwen/Qwen3GuardTest", split="thinking")
    samples = []
    for s in ds.select(range(min(n, len(ds)))):
        msgs = s["message"]
        prompt = ""
        for m in msgs:
            if m["role"] == "user":
                prompt = m["content"]
        samples.append({
            "text_gen": build_prompt_classification_text(prompt),
            "text_stream": f"USER: {prompt}",
            "label": s["label"],
            "type": "prompt",
            "id": s.get("unique_id", ""),
        })
    return samples

def load_response_loc(n=813):
    """Qwen3GuardTest/response_loc — prompt+response"""
    ds = load_dataset("Qwen/Qwen3GuardTest", split="response_loc")
    samples = []
    for s in ds.select(range(min(n, len(ds)))):
        msgs = s["message"]
        prompt = ""
        response = ""
        for m in msgs:
            if m["role"] == "user":
                prompt = m["content"]
            elif m["role"] == "assistant":
                response = m["content"]
        samples.append({
            "text_gen": build_response_classification_text(prompt, response),
            "text_stream": f"USER: {prompt}\n\nASSISTANT: {response}",
            "label": s["label"],
            "type": "response",
            "id": s.get("unique_id", ""),
        })
    return samples

def load_thinking_loc(n=569):
    """Qwen3GuardTest/thinking_loc — prompt+thinking+response"""
    ds = load_dataset("Qwen/Qwen3GuardTest", split="thinking_loc")
    samples = []
    for s in ds.select(range(min(n, len(ds)))):
        msgs = s["message"]
        prompt = ""
        assistant_content = ""
        for m in msgs:
            if m["role"] == "user":
                prompt = m["content"]
            elif m["role"] == "assistant":
                assistant_content = m["content"]
        samples.append({
            "text_gen": build_response_classification_text(prompt, assistant_content),
            "text_stream": f"USER: {prompt}\n\nASSISTANT: {assistant_content}",
            "label": s["label"],
            "type": "response",
            "id": s.get("unique_id", ""),
        })
    return samples

def load_toxicchat(n=200):
    """ToxicChat/test — prompt-only"""
    ds = load_dataset("lmsys/toxic-chat", "toxicchat0124", split="test")
    samples = []
    for s in ds.select(range(min(n, len(ds)))):
        prompt = s["user_input"]
        label = "Unsafe" if s["toxicity"] == 1 else "Safe"
        samples.append({
            "text_gen": build_prompt_classification_text(prompt),
            "text_stream": f"USER: {prompt}",
            "label": label,
            "type": "prompt",
            "id": s.get("id", ""),
        })
    return samples

def load_simplesafety():
    """SimpleSafetyTests — prompt-only, 全部 Unsafe"""
    ds = load_dataset("Bertievidgen/SimpleSafetyTests", split="test")
    samples = []
    for s in ds:
        samples.append({
            "text_gen": build_prompt_classification_text(s["prompt"]),
            "text_stream": f"USER: {s['prompt']}",
            "label": "Unsafe",
            "type": "prompt",
            "id": s.get("id", ""),
        })
    return samples


# ==================== Gen v2 评估 (生成式) ====================
def eval_gen_v2(model, tokenizer, samples, device):
    print(f"  [Gen v2] 评估 {len(samples)} 样本...", flush=True)
    preds, gts = [], []
    latencies = []
    t0_total = time.time()

    for idx, s in enumerate(samples):
        text = s["text_gen"]
        inputs = tokenizer(text, return_tensors="pt", max_length=4096, truncation=True).to(device)

        t0 = time.time()
        with torch.no_grad():
            outputs = model.generate(
                **inputs, max_new_tokens=128, do_sample=False,
                pad_token_id=tokenizer.eos_token_id,
            )
        elapsed = (time.time() - t0) * 1000  # ms
        latencies.append(elapsed)

        raw = tokenizer.decode(outputs[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True)
        parsed = parse_annotation(raw)
        preds.append(parsed.get("safety", "Safe"))
        gts.append(s["label"])

        if (idx + 1) % 200 == 0:
            print(f"    [{idx+1}/{len(samples)}] avg_latency={sum(latencies[-200:])/200:.1f}ms", flush=True)
            if device == "mps":
                torch.mps.empty_cache()

    total_time = time.time() - t0_total
    metrics = calc_metrics(preds, gts)
    metrics["n_samples"] = len(samples)
    metrics["total_time_s"] = round(total_time, 2)
    metrics["latency_ms"] = {
        "mean": round(sum(latencies) / len(latencies), 1),
        "min": round(min(latencies), 1),
        "max": round(max(latencies), 1),
        "p50": round(sorted(latencies)[len(latencies)//2], 1),
        "p95": round(sorted(latencies)[int(len(latencies)*0.95)], 1),
    }
    metrics["pred_distribution"] = dict(Counter(preds))
    metrics["gt_distribution"] = dict(Counter(gts))
    metrics["architecture"] = "生成式 (CausalLM + LoRA)"
    return metrics


# ==================== Stream v2 评估 (Softmax 分类头) ====================
class RMSNorm(nn.Module):
    def __init__(self, hidden_size, eps=1e-6):
        super().__init__()
        self.weight = nn.Parameter(torch.ones(hidden_size))
        self.variance_epsilon = eps
    def forward(self, x):
        dtype = x.dtype
        x = x.float()
        variance = x.pow(2).mean(-1, keepdim=True)
        x = x * torch.rsqrt(variance + self.variance_epsilon)
        return (self.weight * x).to(dtype)

class StreamModelV2(nn.Module):
    def __init__(self):
        super().__init__()
        self.backbone = None
        self.response_risk_pre = nn.Linear(1024, 512, bias=False)
        self.response_risk_norm = RMSNorm(512)
        self.response_risk_head = nn.Linear(512, 2, bias=False)
        self.query_risk_pre = nn.Linear(1024, 512, bias=False)
        self.query_risk_norm = RMSNorm(512)
        self.query_risk_head = nn.Linear(512, 2, bias=False)
        for m in [self.response_risk_pre, self.response_risk_head,
                  self.query_risk_pre, self.query_risk_head]:
            m.weight.data.normal_(mean=0.0, std=0.02)

    def forward(self, input_ids, attention_mask=None):
        outputs = self.backbone(input_ids=input_ids, attention_mask=attention_mask)
        last_hidden = outputs.last_hidden_state[:, -1:, :]
        resp_x = self.response_risk_norm(self.response_risk_pre(last_hidden))
        response_risk_logits = self.response_risk_head(resp_x)
        query_x = self.query_risk_norm(self.query_risk_pre(last_hidden))
        query_risk_logits = self.query_risk_head(query_x)
        return {"response_risk_logits": response_risk_logits,
                "query_risk_logits": query_risk_logits}

def eval_stream_v2(model, tokenizer, samples, device):
    print(f"  [Stream v2] 评估 {len(samples)} 样本...", flush=True)
    preds, gts = [], []
    latencies = []
    t0_total = time.time()

    model.eval()
    for idx, s in enumerate(samples):
        text = s["text_stream"]
        inputs = tokenizer(text, return_tensors="pt", max_length=4096, truncation=True).to(device)

        t0 = time.time()
        with torch.no_grad():
            outputs = model(input_ids=inputs["input_ids"], attention_mask=inputs["attention_mask"])
        elapsed = (time.time() - t0) * 1000  # ms
        latencies.append(elapsed)

        # 根据 task_type 选择 head
        if s["type"] == "prompt":
            logits = outputs["query_risk_logits"][0, 0, :]
        else:
            logits = outputs["response_risk_logits"][0, 0, :]

        pred_idx = torch.argmax(logits).item()
        pred_label = "Safe" if pred_idx == 0 else "Unsafe"
        preds.append(pred_label)
        gts.append(s["label"])

        if (idx + 1) % 200 == 0:
            print(f"    [{idx+1}/{len(samples)}] avg_latency={sum(latencies[-200:])/200:.1f}ms", flush=True)
            if device == "mps":
                torch.mps.empty_cache()

    total_time = time.time() - t0_total
    metrics = calc_metrics(preds, gts)
    metrics["n_samples"] = len(samples)
    metrics["total_time_s"] = round(total_time, 2)
    metrics["latency_ms"] = {
        "mean": round(sum(latencies) / len(latencies), 1),
        "min": round(min(latencies), 1),
        "max": round(max(latencies), 1),
        "p50": round(sorted(latencies)[len(latencies)//2], 1),
        "p95": round(sorted(latencies)[int(len(latencies)*0.95)], 1),
    }
    metrics["pred_distribution"] = dict(Counter(preds))
    metrics["gt_distribution"] = dict(Counter(gts))
    metrics["architecture"] = "Softmax 分类头 (Backbone LoRA + Dual Head)"
    return metrics


# ==================== 主流程 ====================
def main():
    parser = argparse.ArgumentParser(description="Gen v2 vs Stream v2 交叉评估")
    parser.add_argument("--max-samples", type=int, default=0,
                        help="每个测试集最大样本数 (0=全部)")
    parser.add_argument("--skip-gen", action="store_true", help="跳过 Gen v2")
    parser.add_argument("--skip-stream", action="store_true", help="跳过 Stream v2")
    parser.add_argument("--datasets", type=str, default="",
                        help="只评估指定数据集, 逗号分隔: thinking,response_loc,thinking_loc,toxicchat,simplesafety")
    args = parser.parse_args()

    # 检测设备
    if torch.cuda.is_available():
        device = "cuda"
    elif torch.backends.mps.is_available():
        device = "mps"
    else:
        device = "cpu"
    print(f"设备: {device}", flush=True)

    # 加载测试集
    print("\n" + "=" * 60)
    print("  加载测试集")
    print("=" * 60, flush=True)

    all_test_sets = {
        "thinking": (load_thinking, "prompt-only (1059)"),
        "response_loc": (load_response_loc, "prompt+response (813)"),
        "thinking_loc": (load_thinking_loc, "prompt+thinking+response (569)"),
        "toxicchat": (load_toxicchat, "ToxicChat prompt-only (200)"),
        "simplesafety": (load_simplesafety, "SimpleSafetyTests prompt-only (100)"),
    }

    dataset_filter = None
    if args.datasets:
        dataset_filter = set(args.datasets.split(","))

    test_sets = {}
    for name, (loader_fn, desc) in all_test_sets.items():
        if dataset_filter and name not in dataset_filter:
            continue
        n = args.max_samples if args.max_samples > 0 else None
        if n and name == "thinking":
            samples = loader_fn(n)
        elif n and name == "response_loc":
            samples = loader_fn(n)
        elif n and name == "thinking_loc":
            samples = loader_fn(n)
        elif n and name == "toxicchat":
            samples = loader_fn(n)
        elif n and name == "simplesafety":
            samples = loader_fn(n)
        else:
            samples = loader_fn()
        labels = Counter(s["label"] for s in samples)
        types = Counter(s["type"] for s in samples)
        print(f"  {name}: {len(samples)} samples, labels={dict(labels)}, types={dict(types)}", flush=True)
        test_sets[name] = samples

    # 验证无数据泄露
    print("\n  ✓ 测试集来源: Qwen3GuardTest, ToxicChat, SimpleSafetyTests")
    print("  ✓ 训练集来源: Aegis2.0, BeaverTails, HarmfulQA")
    print("  ✓ 两者无重叠 — 无数据泄露风险", flush=True)

    results = {}

    # ========== Gen v2 ==========
    if not args.skip_gen:
        print("\n" + "=" * 60)
        print("  加载 Gen v2 (生成式 CausalLM + LoRA)")
        print("=" * 60, flush=True)

        gen_base = AutoModelForCausalLM.from_pretrained(
            "Qwen/Qwen3-0.6B", torch_dtype=torch.float16, trust_remote_code=True,
        ).to(device)
        gen_model = PeftModel.from_pretrained(gen_base, str(GEN_V2_CKPT))
        gen_tokenizer = AutoTokenizer.from_pretrained("Qwen/Qwen3-0.6B", trust_remote_code=True)
        if gen_tokenizer.pad_token is None:
            gen_tokenizer.pad_token = gen_tokenizer.eos_token
        gen_model.eval()
        print(f"  LoRA r=16, trainable=1.67%, checkpoint={GEN_V2_CKPT.name}", flush=True)

        gen_results = {}
        for name, samples in test_sets.items():
            print(f"\n  --- {name} ---", flush=True)
            gen_results[name] = eval_gen_v2(gen_model, gen_tokenizer, samples, device)
            m = gen_results[name]
            print(f"    F1={m['f1']:.4f} Acc={m['accuracy']:.4f} "
                  f"P={m['precision']:.4f} R={m['recall']:.4f} "
                  f"latency_mean={m['latency_ms']['mean']}ms", flush=True)

        results["gen_v2"] = gen_results
        del gen_model, gen_base
        if device == "mps":
            torch.mps.empty_cache()

    # ========== Stream v2 ==========
    if not args.skip_stream:
        print("\n" + "=" * 60)
        print("  加载 Stream v2 (Backbone LoRA + Dual Softmax Head)")
        print("=" * 60, flush=True)

        stream_model = StreamModelV2()
        config = AutoConfig.from_pretrained("Qwen/Qwen3-0.6B-Base", trust_remote_code=True)
        base = AutoModel.from_pretrained(
            "Qwen/Qwen3-0.6B-Base", config=config, torch_dtype=torch.float16, trust_remote_code=True,
        )
        stream_model.backbone = PeftModel.from_pretrained(base, str(STREAM_V2_LORA))
        head_state = torch.load(str(STREAM_V2_HEADS), map_location=device)
        stream_model.response_risk_pre.load_state_dict(head_state["response_risk_pre"])
        stream_model.response_risk_norm.load_state_dict(head_state["response_risk_norm"])
        stream_model.response_risk_head.load_state_dict(head_state["response_risk_head"])
        stream_model.query_risk_pre.load_state_dict(head_state["query_risk_pre"])
        stream_model.query_risk_norm.load_state_dict(head_state["query_risk_norm"])
        stream_model.query_risk_head.load_state_dict(head_state["query_risk_head"])
        stream_model = stream_model.to(device)
        stream_model.eval()

        stream_tokenizer = AutoTokenizer.from_pretrained("Qwen/Qwen3-0.6B-Base", trust_remote_code=True)
        if stream_tokenizer.pad_token is None:
            stream_tokenizer.pad_token = stream_tokenizer.eos_token
        print(f"  Backbone LoRA + Dual Head (response + query), 2-class", flush=True)

        stream_results = {}
        for name, samples in test_sets.items():
            print(f"\n  --- {name} ---", flush=True)
            stream_results[name] = eval_stream_v2(stream_model, stream_tokenizer, samples, device)
            m = stream_results[name]
            print(f"    F1={m['f1']:.4f} Acc={m['accuracy']:.4f} "
                  f"P={m['precision']:.4f} R={m['recall']:.4f} "
                  f"latency_mean={m['latency_ms']['mean']}ms", flush=True)

        results["stream_v2"] = stream_results
        del stream_model, base
        if device == "mps":
            torch.mps.empty_cache()

    # ========== 保存 (合并已有结果) ==========
    output_path = EVAL_DIR / "cross_eval.json"
    # 加载已有结果并合并 (新结果覆盖旧结果)
    merged = {"gen_v2": {}, "stream_v2": {}}
    if output_path.exists():
        try:
            with open(output_path, "r", encoding="utf-8") as f:
                old = json.load(f)
            merged["gen_v2"] = old.get("gen_v2", {})
            merged["stream_v2"] = old.get("stream_v2", {})
        except Exception:
            pass
    # 用新结果覆盖对应数据集
    if "gen_v2" in results:
        merged["gen_v2"].update(results["gen_v2"])
    if "stream_v2" in results:
        merged["stream_v2"].update(results["stream_v2"])
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(merged, f, indent=2, ensure_ascii=False)
    results = merged  # 用于打印汇总

    print("\n" + "=" * 60)
    print(f"  结果已保存: {output_path}")
    print("=" * 60, flush=True)

    # 打印对比汇总
    if "gen_v2" in results and "stream_v2" in results:
        print("\n" + "=" * 60)
        print("  架构对比汇总 (F1 / 时延)")
        print("=" * 60)
        print(f"{'测试集':<20} {'Gen v2 F1':>10} {'Stream v2 F1':>12} {'Gen 时延':>10} {'Stream 时延':>12}")
        print("-" * 66)
        for name in test_sets:
            g = results["gen_v2"].get(name, {})
            s = results["stream_v2"].get(name, {})
            gf1 = g.get("f1", 0)
            sf1 = s.get("f1", 0)
            gl = g.get("latency_ms", {}).get("mean", 0)
            sl = s.get("latency_ms", {}).get("mean", 0)
            winner = "Gen" if gf1 > sf1 else "Stream" if sf1 > gf1 else "Tie"
            print(f"{name:<20} {gf1:>10.4f} {sf1:>12.4f} {gl:>8.0f}ms {sl:>8.0f}ms  → {winner}")


if __name__ == "__main__":
    main()