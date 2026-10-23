"""
对比测试: qwen3.7-plus (大模型) vs CheryGuard Gen/Stream (0.6B 微调小模型)
在同一批测试集上公平对比安全分类性能。

测试集 (与 cross_eval.py 一致):
  - thinking: prompt-only (取 200 条)
  - response_loc: prompt+response (取 200 条)
  - toxicchat: prompt-only (全部 200 条)
  - simplesafety: prompt-only (全部 100 条)

输出: CheryGuard/eval_results/big_model_compare.json
"""
import json, os, sys, time
from collections import Counter
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from openai import OpenAI
from datasets import load_dataset

from shared.label_schema import parse_annotation
from shared.chat_template import build_prompt_classification_text, build_response_classification_text

# ==================== 配置 ====================
API_KEY = "sk-310b3227d86243eb944b9e87d7bea031"
BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
MODEL = "qwen3.7-plus"

EVAL_DIR = PROJECT_ROOT / "eval_results"
EVAL_DIR.mkdir(exist_ok=True)

# 每个测试集取多少条
MAX_SAMPLES = 200

# 二分类映射
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
def load_thinking(n=200):
    ds = load_dataset("Qwen/Qwen3GuardTest", split="thinking")
    samples = []
    for s in ds.select(range(min(n, len(ds)))):
        msgs = s["message"]
        prompt = ""
        for m in msgs:
            if m["role"] == "user":
                prompt = m["content"]
        samples.append({
            "text": build_prompt_classification_text(prompt),
            "label": s["label"],
            "type": "prompt",
        })
    return samples

def load_response_loc(n=200):
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
            "text": build_response_classification_text(prompt, response),
            "label": s["label"],
            "type": "response",
        })
    return samples

def load_toxicchat(n=200):
    ds = load_dataset("lmsys/toxic-chat", "toxicchat0124", split="test")
    samples = []
    for s in ds.select(range(min(n, len(ds)))):
        prompt = s["user_input"]
        label = "Unsafe" if s["toxicity"] == 1 else "Safe"
        samples.append({
            "text": build_prompt_classification_text(prompt),
            "label": label,
            "type": "prompt",
        })
    return samples

def load_simplesafety():
    ds = load_dataset("Bertievidgen/SimpleSafetyTests", split="test")
    samples = []
    for s in ds:
        samples.append({
            "text": build_prompt_classification_text(s["prompt"]),
            "label": "Unsafe",
            "type": "prompt",
        })
    return samples

# ==================== 调用大模型 ====================
def eval_big_model(client, samples):
    """用 qwen3.7-plus 评估"""
    preds, gts = [], []
    latencies = []
    errors = 0

    for idx, s in enumerate(samples):
        text = s["text"]

        t0 = time.time()
        try:
            response = client.chat.completions.create(
                model=MODEL,
                messages=[{"role": "user", "content": text}],
                max_tokens=128,
                temperature=0.0,
            )
            raw = response.choices[0].message.content or ""
        except Exception as e:
            print(f"    [ERROR] {e}")
            errors += 1
            raw = ""
        elapsed = (time.time() - t0) * 1000
        latencies.append(elapsed)

        parsed = parse_annotation(raw)
        pred = parsed.get("safety") or "Safe"
        preds.append(pred)
        gts.append(s["label"])

        if (idx + 1) % 50 == 0:
            avg_lat = sum(latencies[-50:]) / 50
            print(f"    [{idx+1}/{len(samples)}] avg_latency={avg_lat:.0f}ms errors={errors}", flush=True)

    metrics = calc_metrics(preds, gts)
    metrics["n_samples"] = len(samples)
    metrics["errors"] = errors
    metrics["latency_ms"] = {
        "mean": round(sum(latencies) / len(latencies), 1),
        "p50": round(sorted(latencies)[len(latencies)//2], 1),
        "p95": round(sorted(latencies)[int(len(latencies)*0.95)], 1),
    }
    metrics["pred_distribution"] = dict(Counter(preds))
    metrics["gt_distribution"] = dict(Counter(gts))
    return metrics

# ==================== 主流程 ====================
def main():
    print("=" * 60)
    print(f"  对比测试: {MODEL} vs CheryGuard (0.6B + LoRA)")
    print("=" * 60)

    client = OpenAI(api_key=API_KEY, base_url=BASE_URL)

    # 加载测试集
    print("\n加载测试集...")
    test_sets = {
        "thinking": load_thinking(MAX_SAMPLES),
        "response_loc": load_response_loc(MAX_SAMPLES),
        "toxicchat": load_toxicchat(MAX_SAMPLES),
        "simplesafety": load_simplesafety(),
    }
    for name, samples in test_sets.items():
        labels = Counter(s["label"] for s in samples)
        print(f"  {name}: {len(samples)} samples, labels={dict(labels)}")

    # 评估大模型
    print(f"\n开始评估 {MODEL}...")
    results = {}
    for name, samples in test_sets.items():
        print(f"\n  --- {name} ---", flush=True)
        results[name] = eval_big_model(client, samples)
        m = results[name]
        print(f"    F1={m['f1']:.4f} Acc={m['accuracy']:.4f} "
              f"P={m['precision']:.4f} R={m['recall']:.4f} "
              f"latency={m['latency_ms']['mean']:.0f}ms", flush=True)

    # 加载 CheryGuard 结果对比
    cross_eval_path = EVAL_DIR / "cross_eval.json"
    if cross_eval_path.exists():
        with open(cross_eval_path) as f:
            cg_results = json.load(f)
    else:
        cg_results = {}

    # 保存结果
    output = {"big_model": results, "model": MODEL}
    output_path = EVAL_DIR / "big_model_compare.json"
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    # 打印对比汇总
    print("\n" + "=" * 80)
    print("  三方对比汇总 (F1 / Accuracy / Latency)")
    print("=" * 80)
    print(f"{'测试集':<15} {'qwen3.7-plus':>20} {'Gen v2 (0.6B)':>20} {'Stream v2 (0.6B)':>20}")
    print(f"{'':15} {'F1':>6} {'Acc':>6} {'ms':>6}  {'F1':>6} {'Acc':>6} {'ms':>6}  {'F1':>6} {'Acc':>6} {'ms':>6}")
    print("-" * 80)

    for name in test_sets:
        big = results.get(name, {})
        gen = cg_results.get("gen_v2", {}).get(name, {})
        stream = cg_results.get("stream_v2", {}).get(name, {})

        bf1, ba, bl = big.get("f1", 0), big.get("accuracy", 0), big.get("latency_ms", {}).get("mean", 0)
        gf1, ga, gl = gen.get("f1", 0), gen.get("accuracy", 0), gen.get("latency_ms", {}).get("mean", 0)
        sf1, sa, sl = stream.get("f1", 0), stream.get("accuracy", 0), stream.get("latency_ms", {}).get("mean", 0)

        print(f"{name:<15} {bf1:>6.4f} {ba:>6.4f} {bl:>6.0f}  {gf1:>6.4f} {ga:>6.4f} {gl:>6.0f}  {sf1:>6.4f} {sa:>6.4f} {sl:>6.0f}")

    print("\n" + "=" * 80)
    print("  结论分析")
    print("=" * 80)

    # 计算平均 F1
    big_avg_f1 = sum(results[n]["f1"] for n in test_sets) / len(test_sets)
    gen_f1s = [cg_results.get("gen_v2", {}).get(n, {}).get("f1", 0) for n in test_sets]
    stream_f1s = [cg_results.get("stream_v2", {}).get(n, {}).get("f1", 0) for n in test_sets]
    gen_avg_f1 = sum(gen_f1s) / len(gen_f1s) if gen_f1s else 0
    stream_avg_f1 = sum(stream_f1s) / len(stream_f1s) if stream_f1s else 0

    print(f"\n  平均 F1:")
    print(f"    {MODEL}: {big_avg_f1:.4f}")
    print(f"    Gen v2 (0.6B): {gen_avg_f1:.4f}")
    print(f"    Stream v2 (0.6B): {stream_avg_f1:.4f}")
    print(f"\n  时延对比:")
    print(f"    {MODEL}: ~{results['thinking']['latency_ms']['mean']:.0f}ms")
    print(f"    Gen v2: ~{cg_results.get('gen_v2', {}).get('thinking', {}).get('latency_ms', {}).get('mean', 0):.0f}ms")
    print(f"    Stream v2: ~{cg_results.get('stream_v2', {}).get('thinking', {}).get('latency_ms', {}).get('mean', 0):.0f}ms")

    print(f"\n  结果已保存: {output_path}")

if __name__ == "__main__":
    main()
