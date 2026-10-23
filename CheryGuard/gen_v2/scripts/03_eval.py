"""
Step 4: Gen v2 统一评估
- 评估 4 模型: 基座 / 官方 Qwen3Guard / CheryGuard v1 / CheryGuard v2 (所有 epoch)
- 3 个测试集: Qwen3GuardTest/thinking (1059), ToxicChat/test (200), SimpleSafetyTests (100)
- 输出: gen_v2/eval_results/ 下每个模型一个 JSON
"""
import sys, os, json, re, torch, time
sys.path.insert(0, os.path.dirname(__file__) + '/../..')

from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
from datasets import load_dataset
from collections import Counter
from shared.label_schema import parse_annotation
from shared.chat_template import build_prompt_classification_text

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EVAL_DIR = os.path.join(BASE_DIR, 'eval_results')
os.makedirs(EVAL_DIR, exist_ok=True)

# ============================================================
# 评估工具
# ============================================================
def to_bin(label):
    return 'Unsafe' if label in ('Unsafe', 'Controversial') else 'Safe'

def calc_metrics(preds, gts):
    bp = [to_bin(p) for p in preds]
    bg = [to_bin(g) for g in gts]
    tp = sum(1 for p, g in zip(bp, bg) if p == 'Unsafe' and g == 'Unsafe')
    fp = sum(1 for p, g in zip(bp, bg) if p == 'Unsafe' and g == 'Safe')
    fn = sum(1 for p, g in zip(bp, bg) if p == 'Safe' and g == 'Unsafe')
    prec = tp / (tp + fp) if (tp + fp) > 0 else 0
    rec = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * prec * rec / (prec + rec) if (prec + rec) > 0 else 0
    acc = sum(1 for p, g in zip(preds, gts) if p == g) / len(preds)
    return {"accuracy": acc, "f1": f1, "precision": prec, "recall": rec, "tp": tp, "fp": fp, "fn": fn}

def eval_model(name, model, tokenizer, test_samples, device, max_new=64):
    """评估单个模型"""
    preds = []
    gts = []
    t0 = time.time()
    for s in test_samples:
        text = s["text"]
        inputs = tokenizer(text, return_tensors="pt").to(device)
        with torch.no_grad():
            outputs = model.generate(**inputs, max_new_tokens=max_new, do_sample=False,
                                     pad_token_id=tokenizer.eos_token_id)
        raw = tokenizer.decode(outputs[0][inputs.input_ids.shape[1]:], skip_special_tokens=True)
        parsed = parse_annotation(raw)
        preds.append(parsed['safety'] if parsed['safety'] else 'Safe')
        gts.append(s['label'])
    elapsed = time.time() - t0
    metrics = calc_metrics(preds, gts)
    metrics['model'] = name
    metrics['n_samples'] = len(test_samples)
    metrics['time_seconds'] = elapsed
    metrics['pred_distribution'] = dict(Counter(preds))
    metrics['gt_distribution'] = dict(Counter(gts))
    return metrics

# ============================================================
# 加载测试集
# ============================================================
print("Loading test sets...")

def load_qwen3guard_test(n=1059):
    """Qwen3GuardTest/thinking"""
    ds = load_dataset('Qwen/Qwen3GuardTest', split='thinking')
    samples = []
    for s in ds.select(range(min(n, len(ds)))):
        msgs = s['message']
        prompt = ''
        for m in msgs:
            if m['role'] == 'user':
                prompt = m['content']
        text = build_prompt_classification_text(prompt)
        samples.append({"text": text, "label": s['label'], "id": s.get('unique_id', '')})
    return samples

def load_toxicchat_test(n=200):
    """ToxicChat/test"""
    ds = load_dataset('lmsys/toxic-chat', 'toxicchat0124', split='test')
    samples = []
    for s in ds.select(range(min(n, len(ds)))):
        prompt = s['user_input']
        text = build_prompt_classification_text(prompt)
        label = 'Unsafe' if s['toxicity'] == 1 else 'Safe'
        samples.append({"text": text, "label": label, "id": s.get('id', '')})
    return samples

def load_simplesafety_test():
    """SimpleSafetyTests/test"""
    ds = load_dataset('Bertievidgen/SimpleSafetyTests', split='test')
    samples = []
    for s in ds:
        text = build_prompt_classification_text(s['prompt'])
        samples.append({"text": text, "label": "Unsafe", "id": s.get('id', '')})
    return samples

test_sets = {
    "Qwen3GuardTest": load_qwen3guard_test(1059),
    "ToxicChat": load_toxicchat_test(200),
    "SimpleSafetyTests": load_simplesafety_test(),
}
for name, samples in test_sets.items():
    labels = Counter(s['label'] for s in samples)
    print(f"  {name}: {len(samples)} samples, labels={dict(labels)}")

# ============================================================
# 评估所有模型
# ============================================================
all_results = {}

# --- 模型 1: 基座 Qwen3-0.6B ---
print("\n=== 评估基座 Qwen3-0.6B ===")
base_model = AutoModelForCausalLM.from_pretrained(
    'Qwen/Qwen3-0.6B', torch_dtype=torch.float16, trust_remote_code=True
).to('mps')
base_tokenizer = AutoTokenizer.from_pretrained('Qwen/Qwen3-0.6B', trust_remote_code=True)
if base_tokenizer.pad_token is None:
    base_tokenizer.pad_token = base_tokenizer.eos_token

base_results = {}
for name, samples in test_sets.items():
    print(f"  {name}...")
    base_results[name] = eval_model("base_qwen3_0.6B", base_model, base_tokenizer, samples, 'mps')
all_results['base_model'] = base_results
del base_model
torch.mps.empty_cache()

# --- 模型 2: 官方 Qwen3Guard-0.6B ---
print("\n=== 评估官方 Qwen3Guard-0.6B ===")
official_model = AutoModelForCausalLM.from_pretrained(
    'Qwen/Qwen3Guard-Gen-0.6B', torch_dtype=torch.float16, trust_remote_code=True
).to('mps')
official_tokenizer = AutoTokenizer.from_pretrained('Qwen/Qwen3Guard-Gen-0.6B', trust_remote_code=True)

official_results = {}
for name, samples in test_sets.items():
    print(f"  {name}...")
    official_results[name] = eval_model("official_qwen3guard_0.6B", official_model, official_tokenizer, samples, 'mps')
all_results['official_qwen3guard'] = official_results
del official_model
torch.mps.empty_cache()

# --- 模型 3: CheryGuard v1 (第一次训练) ---
print("\n=== 评估 CheryGuard v1 ===")
v1_ckpt = os.path.join(os.path.dirname(BASE_DIR), 'gen', 'outputs', 'checkpoint-150')
if not os.path.exists(v1_ckpt):
    print(f"  ⚠️ v1 checkpoint 不存在: {v1_ckpt}，跳过")
    all_results['cheryguard_v1'] = {"error": "checkpoint not found"}
else:
    v1_model = PeftModel.from_pretrained(
        AutoModelForCausalLM.from_pretrained('Qwen/Qwen3-0.6B', torch_dtype=torch.float16, trust_remote_code=True).to('mps'),
        v1_ckpt
    )
    v1_tokenizer = AutoTokenizer.from_pretrained('Qwen/Qwen3-0.6B', trust_remote_code=True)
    if v1_tokenizer.pad_token is None:
        v1_tokenizer.pad_token = v1_tokenizer.eos_token

    v1_results = {}
    for name, samples in test_sets.items():
        print(f"  {name}...")
        v1_results[name] = eval_model("cheryguard_v1", v1_model, v1_tokenizer, samples, 'mps')
    all_results['cheryguard_v1'] = v1_results
    del v1_model
    torch.mps.empty_cache()

# --- 模型 4: CheryGuard v2 (所有 epoch checkpoint) ---
print("\n=== 评估 CheryGuard v2 ===")
v2_tokenizer = AutoTokenizer.from_pretrained('Qwen/Qwen3-0.6B', trust_remote_code=True)
if v2_tokenizer.pad_token is None:
    v2_tokenizer.pad_token = v2_tokenizer.eos_token

# 查找所有 checkpoint
import glob
checkpoints = sorted(glob.glob(os.path.join(BASE_DIR, 'outputs', 'lora', 'checkpoint-*')))
if not checkpoints:
    checkpoints = [os.path.join(BASE_DIR, 'outputs', 'lora')]

for ckpt_path in checkpoints:
    ckpt_name = os.path.basename(ckpt_path)
    print(f"\n  {ckpt_name}...")
    base = AutoModelForCausalLM.from_pretrained('Qwen/Qwen3-0.6B', torch_dtype=torch.float16, trust_remote_code=True).to('mps')
    v2_model = PeftModel.from_pretrained(base, ckpt_path)
    v2_results = {}
    for name, samples in test_sets.items():
        print(f"    {name}...")
        v2_results[name] = eval_model(f"cheryguard_v2_{ckpt_name}", v2_model, v2_tokenizer, samples, 'mps')
    all_results[f'cheryguard_v2_{ckpt_name}'] = v2_results
    del v2_model, base
    torch.mps.empty_cache()

# ============================================================
# 保存结果
# ============================================================
output_path = os.path.join(EVAL_DIR, 'all_results.json')
with open(output_path, 'w') as f:
    json.dump(all_results, f, indent=2, ensure_ascii=False)

print(f"\n=== 评估完成 ===")
print(f"Results saved to: {output_path}")

# 打印汇总
print("\n=== 汇总 ===")
for model_name, model_results in all_results.items():
    if 'Qwen3GuardTest' in model_results:
        r = model_results['Qwen3GuardTest']
        print(f"{model_name:40s} F1={r['f1']:.4f} Acc={r['accuracy']:.4f}")