"""
Step 5: Stream v2 数据准备 (v2 — 双 head 修复版)
- 同时加载 Gen v2 的 prompt 样本和 response 样本
- prompt 样本 → 训练 query risk head (二分类: Safe/Unsafe)
- response 样本 → 训练 response risk head (二分类: Safe/Unsafe)
- 砍掉 category head 和 Controversial 类别
- 输出: stream_v2/data/stream_train.jsonl
"""
import json
import os
import re
import sys
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from shared.data_utils import load_jsonl, save_jsonl

# ============================================================
# 1. 配置
# ============================================================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEN_DATA_DIR = os.path.join(os.path.dirname(BASE_DIR), "gen_v2", "data")
OUTPUT_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ============================================================
# 2. NLTK 分句（带回退）
# ============================================================
def ensure_nltk():
    try:
        import nltk
        nltk.data.find("tokenizers/punkt_tab")
        return True
    except LookupError:
        print("  下载 NLTK punkt_tab...")
        import nltk
        nltk.download("punkt_tab", quiet=True)
        return True
    except Exception:
        return False

def sent_tokenize(text: str) -> list:
    """分句，NLTK 不可用时回退简单规则"""
    try:
        import nltk
        return nltk.sent_tokenize(text)
    except Exception:
        return [s.strip() for s in re.split(r'(?<=[.!?])\s+', text) if s.strip()]

# ============================================================
# 3. 从 Gen v2 chat template 中提取 prompt 和 response
# ============================================================
def extract_prompt_response(text: str) -> tuple[str, str]:
    """从 Gen v2 训练文本中提取 prompt 和 response

    Gen v2 文本格式:
      <|im_start|>user
      # Task: ...
      <BEGIN SAFETY POLICY> ...
      <BEGIN CONVERSATION>
      USER: {prompt}
      ASSISTANT: {response}      ← 只有 response 样本有
      <END CONVERSATION>

    对于 prompt-only 样本，没有 ASSISTANT 部分。
    """
    user_match = re.search(r'USER:\s*(.+?)(?:\n\n|\nASSISTANT:)', text, re.DOTALL)
    assistant_match = re.search(r'ASSISTANT:\s*(.+?)(?:\n\n<END CONVERSATION>)', text, re.DOTALL)
    prompt = user_match.group(1).strip() if user_match else ""
    response = assistant_match.group(1).strip() if assistant_match else ""
    return prompt, response

# ============================================================
# 4. 简单规则找边界（response 样本用）
# ============================================================
def find_boundary_simple(safety_label: str, sentences: list) -> int | None:
    """Unsafe → 边界为第一个句子；Safe → 无边界"""
    if safety_label == "Safe":
        return None
    if len(sentences) == 0:
        return None
    return 0

# ============================================================
# 5. 主流程
# ============================================================
def main():
    print("=" * 60)
    print("  CheryGuard Stream v2 - 数据准备 (双 head 修复版)")
    print("=" * 60)

    nltk_ok = ensure_nltk()
    print(f"  NLTK: {'可用' if nltk_ok else '回退简单分句'}")

    # 加载 Gen v2 训练数据（包含 prompt 和 response 两种类型）
    train_path = os.path.join(GEN_DATA_DIR, "train.jsonl")
    if not os.path.exists(train_path):
        print(f"❌ 训练数据不存在: {train_path}")
        sys.exit(1)

    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] 加载数据...")
    all_samples = load_jsonl(train_path)
    print(f"  总样本: {len(all_samples)}")

    prompt_samples = [s for s in all_samples if s.get("task_type") == "prompt"]
    response_samples = [s for s in all_samples if s.get("task_type") == "response"]
    print(f"  Prompt 样本: {len(prompt_samples)} (用于训练 query risk head)")
    print(f"  Response 样本: {len(response_samples)} (用于训练 response risk head)")

    # 统计标签分布
    for name, samples in [("Prompt", prompt_samples), ("Response", response_samples)]:
        safe = sum(1 for s in samples if s.get("safety_label") == "Safe")
        unsafe = sum(1 for s in samples if s.get("safety_label") == "Unsafe")
        other = len(samples) - safe - unsafe
        print(f"    {name}: Safe={safe}, Unsafe={unsafe}, Other={other}")

    stream_data = []
    skipped = 0

    # === 处理 prompt 样本 ===
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] 处理 prompt 样本...")
    for i, sample in enumerate(prompt_samples):
        try:
            text = sample.get("text", "")
            prompt, response = extract_prompt_response(text)

            if not prompt or not prompt.strip():
                skipped += 1
                continue

            safety_label = sample.get("safety_label", "Safe")
            # 只保留 Safe/Unsafe，跳过 Controversial
            if safety_label not in ("Safe", "Unsafe"):
                skipped += 1
                continue

            stream_sample = {
                "id": sample.get("id", f"prompt_{i:04d}"),
                "task_type": "prompt",
                "prompt": prompt,
                "response": "",
                "safety_label": safety_label,
                "source": sample.get("source", "unknown"),
            }
            stream_data.append(stream_sample)

            if (i + 1) % 500 == 0:
                print(f"  prompt 进度: {i+1}/{len(prompt_samples)} | 有效: {len(stream_data)}")

        except Exception as e:
            print(f"  prompt 错误 [{i}]: {e}")
            skipped += 1

    prompt_count = len(stream_data)
    print(f"  prompt 样本完成: {prompt_count} 条有效")

    # === 处理 response 样本 ===
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] 处理 response 样本...")
    for i, sample in enumerate(response_samples):
        try:
            text = sample.get("text", "")
            prompt, response = extract_prompt_response(text)

            if not response or not response.strip():
                skipped += 1
                continue

            safety_label = sample.get("safety_label", "Safe")
            if safety_label not in ("Safe", "Unsafe"):
                skipped += 1
                continue

            sentences = sent_tokenize(response)
            if len(sentences) == 0:
                skipped += 1
                continue

            boundary_idx = find_boundary_simple(safety_label, sentences)

            sentence_labels = []
            for j in range(len(sentences)):
                if boundary_idx is None:
                    sentence_labels.append("Safe")
                elif j < boundary_idx:
                    sentence_labels.append("Safe")
                else:
                    sentence_labels.append("Unsafe")

            stream_sample = {
                "id": sample.get("id", f"response_{i:04d}"),
                "task_type": "response",
                "prompt": prompt,
                "response": response,
                "sentences": sentences,
                "boundary_idx": boundary_idx,
                "sentence_labels": sentence_labels,
                "safety_label": safety_label,
                "source": sample.get("source", "unknown"),
            }
            stream_data.append(stream_sample)

            if (i + 1) % 500 == 0:
                print(f"  response 进度: {i+1}/{len(response_samples)} | 有效: {len(stream_data) - prompt_count}")

        except Exception as e:
            print(f"  response 错误 [{i}]: {e}")
            skipped += 1

    response_count = len(stream_data) - prompt_count
    print(f"  response 样本完成: {response_count} 条有效")

    # === 统计 ===
    print(f"\n  总计: {len(stream_data)} 条有效样本, {skipped} 条跳过")

    prompt_safe = sum(1 for s in stream_data if s["task_type"] == "prompt" and s["safety_label"] == "Safe")
    prompt_unsafe = sum(1 for s in stream_data if s["task_type"] == "prompt" and s["safety_label"] == "Unsafe")
    resp_safe = sum(1 for s in stream_data if s["task_type"] == "response" and s["safety_label"] == "Safe")
    resp_unsafe = sum(1 for s in stream_data if s["task_type"] == "response" and s["safety_label"] == "Unsafe")

    print(f"\n=== 标签分布 ===")
    print(f"  Prompt  — Safe: {prompt_safe}, Unsafe: {prompt_unsafe} (合计 {prompt_count})")
    print(f"  Response — Safe: {resp_safe}, Unsafe: {resp_unsafe} (合计 {response_count})")
    print(f"  总计    — Safe: {prompt_safe + resp_safe}, Unsafe: {prompt_unsafe + resp_unsafe}")

    # 来源分布
    from collections import Counter
    src_dist = Counter(s.get("source", "?") for s in stream_data)
    print(f"\n=== 来源分布 ===")
    for src, count in src_dist.most_common():
        print(f"  {src}: {count}")

    # 保存
    output_path = os.path.join(OUTPUT_DIR, "stream_train.jsonl")
    save_jsonl(stream_data, output_path)

    summary = {
        "total": len(stream_data),
        "prompt_samples": prompt_count,
        "response_samples": response_count,
        "skipped": skipped,
        "prompt_safe": prompt_safe,
        "prompt_unsafe": prompt_unsafe,
        "response_safe": resp_safe,
        "response_unsafe": resp_unsafe,
        "timestamp": datetime.now().isoformat(),
        "notes": "v2: 双 head 修复版。砍掉 category head 和 Controversial，二分类 Safe/Unsafe。prompt 样本训练 query risk head，response 样本训练 response risk head。",
    }
    summary_path = os.path.join(OUTPUT_DIR, "stream_data_summary.json")
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] 保存到: {output_path}")
    print(f"  样本数: {len(stream_data)}")
    print(f"  统计: {summary_path}")


if __name__ == "__main__":
    main()
