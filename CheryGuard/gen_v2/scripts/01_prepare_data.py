"""
Step 2: Gen v2 数据准备
- 多源数据采样（Aegis2.0 + BeaverTails + HarmfulQA）
- 平衡 Safe/Unsafe ~50/50
- 使用原始标签，跳过教师蒸馏
- 构造 Qwen3Guard 官方训练格式
- 80/10/10 分层划分
"""
import sys, os, json, random
sys.path.insert(0, os.path.dirname(__file__) + '/../..')
from collections import Counter
from datasets import load_dataset
from shared.data_utils import load_jsonl, save_jsonl
from shared.chat_template import build_prompt_classification_text, build_response_classification_text

random.seed(42)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(BASE_DIR, 'data')
os.makedirs(OUTPUT_DIR, exist_ok=True)

def sample_balanced(items, label_key, n_per_class):
    """分层采样: 从每类中随机采样 n 条"""
    by_label = {}
    for item in items:
        lbl = item[label_key]
        by_label.setdefault(lbl, []).append(item)
    sampled = []
    for lbl in by_label:
        avail = min(len(by_label[lbl]), n_per_class)
        sampled.extend(random.sample(by_label[lbl], avail))
    random.shuffle(sampled)
    return sampled

def build_sample(source, task_type, prompt, response, safety_label):
    """构造训练样本"""
    if task_type == 'prompt':
        text = build_prompt_classification_text(prompt)
        labels_text = f"Safety: {safety_label}\nCategories: None\n"
    else:
        text = build_response_classification_text(prompt, response)
        refusal = "Yes" if safety_label == "Safe" else "No"
        labels_text = f"Safety: {safety_label}\nCategories: None\nRefusal: {refusal}\n"
    return {"text": text, "labels_text": labels_text}

# ============================================================
# 1. Aegis2.0: 2000 prompt + 2000 response
# ============================================================
print("Loading Aegis2.0 from HF...")
aegis = load_dataset('nvidia/Aegis-AI-Content-Safety-Dataset-2.0', split='train')
print(f"  Total: {len(aegis)}")

# prompt 样本
aegis_prompts = []
for s in aegis:
    lbl = s['prompt_label']
    if lbl in ('safe', 'unsafe'):
        aegis_prompts.append({
            'source': 'aegis2', 'task_type': 'prompt',
            'prompt': s['prompt'], 'response': None,
            'raw_label': lbl
        })

aegis_prompts_sampled = sample_balanced(aegis_prompts, 'raw_label', 1000)
print(f"  Aegis2.0 prompt: {len(aegis_prompts_sampled)} (safe={sum(1 for s in aegis_prompts_sampled if s['raw_label']=='safe')}, unsafe={sum(1 for s in aegis_prompts_sampled if s['raw_label']=='unsafe')})")

# response 样本（跳过 response_label=None）
aegis_responses = []
for s in aegis:
    lbl = s['response_label']
    if lbl in ('safe', 'unsafe') and s['response'] is not None:
        aegis_responses.append({
            'source': 'aegis2', 'task_type': 'response',
            'prompt': s['prompt'], 'response': s['response'],
            'raw_label': lbl
        })

aegis_responses_sampled = sample_balanced(aegis_responses, 'raw_label', 1000)
print(f"  Aegis2.0 response: {len(aegis_responses_sampled)} (safe={sum(1 for s in aegis_responses_sampled if s['raw_label']=='safe')}, unsafe={sum(1 for s in aegis_responses_sampled if s['raw_label']=='unsafe')})")

# ============================================================
# 2. BeaverTails: 1000 prompt + 1000 response
# ============================================================
print("Loading BeaverTails...")
bt = load_jsonl('gen/data/raw/beavertails.jsonl')

bt_prompts = [s for s in bt if s['task_type'] == 'prompt']
bt_responses = [s for s in bt if s['task_type'] == 'response']

bt_prompts_sampled = sample_balanced(bt_prompts, 'raw_label', 500)
bt_responses_sampled = sample_balanced(bt_responses, 'raw_label', 500)
print(f"  BeaverTails prompt: {len(bt_prompts_sampled)} (safe={sum(1 for s in bt_prompts_sampled if s['raw_label']=='safe')}, unsafe={sum(1 for s in bt_prompts_sampled if s['raw_label']=='unsafe')})")
print(f"  BeaverTails response: {len(bt_responses_sampled)} (safe={sum(1 for s in bt_responses_sampled if s['raw_label']=='safe')}, unsafe={sum(1 for s in bt_responses_sampled if s['raw_label']=='unsafe')})")

# ============================================================
# 3. HarmfulQA: 500 prompt (全部 unsafe)
# ============================================================
print("Loading HarmfulQA...")
hq = load_jsonl('gen/data/raw/harmfulqa.jsonl')
hq_prompts = [s for s in hq if s['task_type'] == 'prompt']
random.shuffle(hq_prompts)
hq_prompts_sampled = hq_prompts[:500]
print(f"  HarmfulQA prompt: {len(hq_prompts_sampled)} (all unsafe)")

# ============================================================
# 4. 合并 & 构造训练格式
# ============================================================
all_raw = aegis_prompts_sampled + aegis_responses_sampled + bt_prompts_sampled + bt_responses_sampled + hq_prompts_sampled
random.shuffle(all_raw)

label_map = {'safe': 'Safe', 'unsafe': 'Unsafe'}

train_samples = []
for s in all_raw:
    safety = label_map.get(s['raw_label'], 'Safe')
    sample = build_sample(s['source'], s['task_type'], s['prompt'], s['response'], safety)
    sample['source'] = s['source']
    sample['task_type'] = s['task_type']
    sample['safety_label'] = safety
    train_samples.append(sample)

# ============================================================
# 5. 分层划分 80/10/10
# ============================================================
by_safety = {}
for s in train_samples:
    by_safety.setdefault(s['safety_label'], []).append(s)

train, val, test = [], [], []
for lbl in by_safety:
    items = by_safety[lbl]
    random.shuffle(items)
    n = len(items)
    n_train = int(n * 0.8)
    n_val = int(n * 0.1)
    train.extend(items[:n_train])
    val.extend(items[n_train:n_train + n_val])
    test.extend(items[n_train + n_val:])

random.shuffle(train)
random.shuffle(val)
random.shuffle(test)

# ============================================================
# 6. 保存
# ============================================================
save_jsonl(train, os.path.join(OUTPUT_DIR, 'train.jsonl'))
save_jsonl(val, os.path.join(OUTPUT_DIR, 'val.jsonl'))
save_jsonl(test, os.path.join(OUTPUT_DIR, 'test.jsonl'))

# 统计
def stats(samples, name):
    sources = Counter(s['source'] for s in samples)
    types = Counter(s['task_type'] for s in samples)
    labels = Counter(s['safety_label'] for s in samples)
    return {
        'name': name, 'count': len(samples),
        'sources': dict(sources), 'task_types': dict(types),
        'labels': dict(labels)
    }

summary = {
    'train': stats(train, 'train'),
    'val': stats(val, 'val'),
    'test': stats(test, 'test'),
    'total': len(train_samples),
    'sampling': {
        'aegis2_prompt': len(aegis_prompts_sampled),
        'aegis2_response': len(aegis_responses_sampled),
        'beavertails_prompt': len(bt_prompts_sampled),
        'beavertails_response': len(bt_responses_sampled),
        'harmfulqa_prompt': len(hq_prompts_sampled),
    }
}

with open(os.path.join(OUTPUT_DIR, 'data_summary.json'), 'w') as f:
    json.dump(summary, f, indent=2)

print(f"\n=== 数据准备完成 ===")
print(f"Train: {len(train)}, Val: {len(val)}, Test: {len(test)}, Total: {len(train_samples)}")
print(f"Train labels: {dict(Counter(s['safety_label'] for s in train))}")
print(f"Val labels: {dict(Counter(s['safety_label'] for s in val))}")
print(f"Test labels: {dict(Counter(s['safety_label'] for s in test))}")
print(f"Summary saved to: {os.path.join(OUTPUT_DIR, 'data_summary.json')}")