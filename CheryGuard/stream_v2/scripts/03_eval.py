"""
Step 7: Stream v2 评估
- 评估 3 模型: 官方 Stream / CheryGuard Stream v1 / CheryGuard Stream v2
- 2 个测试集: Qwen3GuardTest/response_loc (813), thinking_loc (569)
- 输出: stream_v2/eval_results/
"""
import json
import os
import sys
import time
import torch
from collections import Counter
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from datasets import load_dataset
from transformers import AutoTokenizer

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EVAL_DIR = os.path.join(BASE_DIR, "eval_results")
os.makedirs(EVAL_DIR, exist_ok=True)

# ============================================================
# 评估工具
# ============================================================
def to_bin(label):
    return "Unsafe" if label in ("Unsafe", "Controversial") else "Safe"

def calc_metrics(preds, gts):
    bp = [to_bin(p) for p in preds]
    bg = [to_bin(g) for g in gts]
    tp = sum(1 for p, g in zip(bp, bg) if p == "Unsafe" and g == "Unsafe")
    fp = sum(1 for p, g in zip(bp, bg) if p == "Unsafe" and g == "Safe")
    fn = sum(1 for p, g in zip(bp, bg) if p == "Safe" and g == "Unsafe")
    prec = tp / (tp + fp) if (tp + fp) > 0 else 0
    rec = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * prec * rec / (prec + rec) if (prec + rec) > 0 else 0
    acc = sum(1 for p, g in zip(preds, gts) if p == g) / max(1, len(preds))
    return {"accuracy": acc, "f1": f1, "precision": prec, "recall": rec, "tp": tp, "fp": fp, "fn": fn}


# ============================================================
# 加载测试集
# ============================================================
RISK_LEVEL_MAP = {0: "Safe", 1: "Unsafe", 2: "Controversial"}

def load_response_loc(n=813):
    """Qwen3GuardTest/response_loc - 评估 response 安全分类"""
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
        text = f"USER: {prompt}\n\nASSISTANT: {response}"
        samples.append({"text": text, "label": s["label"], "id": s.get("unique_id", "")})
    return samples

def load_thinking_loc(n=569):
    """Qwen3GuardTest/thinking_loc - 评估带 thinking 前缀的分类"""
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
        # thinking_loc 的 assistant 消息已包含 <think> 标签内容
        text = f"USER: {prompt}\n\nASSISTANT: {assistant_content}"
        samples.append({"text": text, "label": s["label"], "id": s.get("unique_id", "")})
    return samples


# ============================================================
# 模型评估函数
# ============================================================
def eval_stream_model(name, model, tokenizer, test_samples, device):
    """评估 Stream 模型"""
    preds = []
    gts = []
    t0 = time.time()

    model.eval()
    for idx, s in enumerate(test_samples):
        text = s["text"]
        inputs = tokenizer(text, return_tensors="pt", max_length=1024, truncation=True).to(device)

        with torch.no_grad():
            outputs = model(input_ids=inputs["input_ids"], attention_mask=inputs["attention_mask"])

        # 兼容两种输出格式: dict (CheryGuard) 和 attribute (官方模型)
        if isinstance(outputs, dict):
            risk_logits = outputs["risk_level_logits"][0, 0, :]
        else:
            risk_logits = outputs.risk_level_logits[0, -1, :]  # 官方模型返回全序列 logits，取最后一个
        pred_idx = torch.argmax(risk_logits).item()
        pred_label = RISK_LEVEL_MAP.get(pred_idx, "Safe")

        preds.append(pred_label)
        gts.append(s["label"])

        del outputs, inputs, risk_logits
        if (idx + 1) % 100 == 0:
            print(f"    [{idx+1}/{len(test_samples)}]", flush=True)
            if device == "mps":
                torch.mps.empty_cache()

    elapsed = time.time() - t0
    metrics = calc_metrics(preds, gts)
    metrics["model"] = name
    metrics["n_samples"] = len(test_samples)
    metrics["time_seconds"] = elapsed
    metrics["pred_distribution"] = dict(Counter(preds))
    metrics["gt_distribution"] = dict(Counter(gts))
    return metrics


# ============================================================
# 主流程
# ============================================================
def main():
    print("=" * 60)
    print("  CheryGuard Stream v2 - 评估")
    print("=" * 60)

    # 检测设备
    if torch.cuda.is_available():
        device = "cuda"
    elif torch.backends.mps.is_available():
        device = "mps"
    else:
        device = "cpu"
    print(f"  设备: {device}", flush=True)

    # 官方 Stream 模型使用自定义代码，MPS 兼容性差，强制使用 CPU
    official_device = "cpu"
    print(f"  官方模型设备: {official_device} (MPS 兼容性)", flush=True)

    # 加载测试集
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] 加载测试集...")
    test_sets = {
        "response_loc": load_response_loc(),
        "thinking_loc": load_thinking_loc(),
    }
    for name, samples in test_sets.items():
        labels = Counter(s["label"] for s in samples)
        print(f"  {name}: {len(samples)} samples, labels={dict(labels)}")

    all_results = {}

    # ── 模型 1: 官方 Qwen3Guard-Stream-0.6B ──
    skip_official = os.environ.get("SKIP_OFFICIAL", "0") == "1"
    if not skip_official:
        print(f"\n{'='*60}")
        print(f"[{datetime.now().strftime('%H:%M:%S')}] 评估官方 Qwen3Guard-Stream-0.6B")
        print("=" * 60, flush=True)

    try:
        if skip_official:
            raise RuntimeError("跳过官方模型评估")
        from transformers import AutoModel
        # 官方 Stream 模型用 AutoModel 加载 (CPU 上运行)
        print("  加载官方模型...", flush=True)
        official_model = AutoModel.from_pretrained(
            "Qwen/Qwen3Guard-Stream-0.6B",
            torch_dtype=torch.float16,
            trust_remote_code=True,
        ).to(official_device)
        print("  模型加载完成", flush=True)
        official_tokenizer = AutoTokenizer.from_pretrained(
            "Qwen/Qwen3Guard-Stream-0.6B", trust_remote_code=True
        )
        if official_tokenizer.pad_token is None:
            official_tokenizer.pad_token = official_tokenizer.eos_token

        official_results = {}
        for name, samples in test_sets.items():
            print(f"  {name} ({len(samples)} samples)...", flush=True)
            official_results[name] = eval_stream_model(
                "official_stream", official_model, official_tokenizer, samples, official_device
            )
            print(f"    F1={official_results[name]['f1']:.4f} Acc={official_results[name]['accuracy']:.4f}", flush=True)
        all_results["official_stream"] = official_results
        del official_model
        if official_device == "mps":
            torch.mps.empty_cache()
    except Exception as e:
        print(f"  ⚠️ 官方 Stream 模型加载失败: {e}")
        all_results["official_stream"] = {"error": str(e)}

    # ── 模型 2: CheryGuard Stream v1 ──
    print(f"\n{'='*60}")
    print(f"[{datetime.now().strftime('%H:%M:%S')}] 评估 CheryGuard Stream v1")
    print("=" * 60)

    try:
        import importlib.util
        import glob

        # 用 importlib 加载 v1 训练脚本（模块名以数字开头，无法直接 import）
        v1_script = os.path.join(os.path.dirname(BASE_DIR), "stream", "scripts", "02_train_stream.py")
        spec = importlib.util.spec_from_file_location("v1_train", v1_script)
        v1_train = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(v1_train)

        v1_tokenizer = AutoTokenizer.from_pretrained("Qwen/Qwen3-0.6B-Base", trust_remote_code=True)
        if v1_tokenizer.pad_token is None:
            v1_tokenizer.pad_token = v1_tokenizer.eos_token

        v1_output_dir = os.path.join(os.path.dirname(BASE_DIR), "stream", "outputs")
        v1_checkpoints = sorted(glob.glob(os.path.join(v1_output_dir, "checkpoint-epoch-*")))

        if not v1_checkpoints:
            print(f"  ⚠️ v1 checkpoint 不存在: {v1_output_dir}")
            all_results["cheryguard_stream_v1"] = {"error": "checkpoint not found"}
        else:
            for ckpt_dir in v1_checkpoints:
                ckpt_name = os.path.basename(ckpt_dir)
                ckpt_path = os.path.join(ckpt_dir, "checkpoint.pt")
                if not os.path.exists(ckpt_path):
                    continue

                print(f"  {ckpt_name}...", flush=True)
                v1_model = v1_train.CheryGuardStreamModel(base_model_name="Qwen/Qwen3-0.6B-Base")
                state = torch.load(ckpt_path, map_location=device, weights_only=True)
                v1_model.load_state_dict(state["model_state"])
                v1_model = v1_model.to(device)

                v1_results = {}
                for name, samples in test_sets.items():
                    print(f"    {name} ({len(samples)} samples)...", flush=True)
                    v1_results[name] = eval_stream_model(
                        f"cheryguard_stream_v1_{ckpt_name}", v1_model, v1_tokenizer, samples, device
                    )
                all_results[f"cheryguard_stream_v1_{ckpt_name}"] = v1_results
                del v1_model
                if device == "mps":
                    torch.mps.empty_cache()
    except Exception as e:
        print(f"  ⚠️ v1 模型加载失败: {e}")
        import traceback
        traceback.print_exc()
        all_results["cheryguard_stream_v1"] = {"error": str(e)}

    # ── 模型 3: CheryGuard Stream v2 ──
    print(f"\n{'='*60}")
    print(f"[{datetime.now().strftime('%H:%M:%S')}] 评估 CheryGuard Stream v2")
    print("=" * 60)

    try:
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "train_v2", os.path.join(os.path.dirname(__file__), "..", "scripts", "02_train.py")
        )
        train_v2 = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(train_v2)

        v2_tokenizer = AutoTokenizer.from_pretrained("Qwen/Qwen3-0.6B-Base", trust_remote_code=True)
        if v2_tokenizer.pad_token is None:
            v2_tokenizer.pad_token = v2_tokenizer.eos_token

        v2_output_dir = os.path.join(BASE_DIR, "outputs")

        # 查找所有 checkpoint
        import glob
        checkpoints = sorted(glob.glob(os.path.join(v2_output_dir, "checkpoint-epoch-*")))
        if not checkpoints:
            # 尝试最终模型
            final_ckpt = os.path.join(v2_output_dir, "checkpoint.pt")
            if os.path.exists(final_ckpt):
                checkpoints = [v2_output_dir]

        if not checkpoints:
            print(f"  ⚠️ v2 checkpoint 不存在，跳过")
            all_results["cheryguard_stream_v2"] = {"error": "no checkpoints found"}
        else:
            for ckpt_dir in checkpoints:
                ckpt_name = os.path.basename(ckpt_dir) if ckpt_dir != v2_output_dir else "final"
                ckpt_path = os.path.join(ckpt_dir, "checkpoint.pt")

                if not os.path.exists(ckpt_path):
                    print(f"  ⚠️ checkpoint 文件不存在: {ckpt_path}")
                    continue

                print(f"  {ckpt_name}...", flush=True)
                v2_model = train_v2.CheryGuardStreamModel(base_model_name="Qwen/Qwen3-0.6B-Base")
                state = torch.load(ckpt_path, map_location=device)
                v2_model.load_state_dict(state["model_state"])
                v2_model = v2_model.to(device)

                v2_results = {}
                for name, samples in test_sets.items():
                    print(f"    {name} ({len(samples)} samples)...", flush=True)
                    v2_results[name] = eval_stream_model(
                        f"cheryguard_stream_v2_{ckpt_name}", v2_model, v2_tokenizer, samples, device
                    )
                all_results[f"cheryguard_stream_v2_{ckpt_name}"] = v2_results
                del v2_model
                if device == "mps":
                    torch.mps.empty_cache()
    except Exception as e:
        print(f"  ⚠️ v2 模型加载失败: {e}")
        import traceback
        traceback.print_exc()
        all_results["cheryguard_stream_v2"] = {"error": str(e)}

    # ── 保存结果 ──
    output_path = os.path.join(EVAL_DIR, "all_results.json")
    with open(output_path, "w") as f:
        json.dump(all_results, f, indent=2, ensure_ascii=False)

    print(f"\n{'='*60}")
    print(f"  ✅ 评估完成!")
    print(f"  Results saved to: {output_path}")
    print("=" * 60)

    # 打印汇总
    print(f"\n{'='*60}")
    print("  汇总")
    print("=" * 60)
    for model_name, model_results in all_results.items():
        if isinstance(model_results, dict) and "response_loc" in model_results:
            r = model_results["response_loc"]
            if isinstance(r, dict) and "f1" in r:
                print(f"  {model_name:45s} response_loc: F1={r['f1']:.4f} Acc={r['accuracy']:.4f}")
        if isinstance(model_results, dict) and "thinking_loc" in model_results:
            r = model_results["thinking_loc"]
            if isinstance(r, dict) and "f1" in r:
                print(f"  {model_name:45s} thinking_loc: F1={r['f1']:.4f} Acc={r['accuracy']:.4f}")


if __name__ == "__main__":
    main()