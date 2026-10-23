"""CheryGuard - Stream Phase 2: 句子级边界标注

目的: 复用 Phase 1 教师蒸馏数据，为 response 添加句子级边界标注。
输入: gen/data/relabeled/all_samples.jsonl
输出: stream/data/stream_train.jsonl

标注逻辑:
  - Safe response → 无边界，全部 safe
  - Unsafe/Controversial response → 找到第一个 unsafe 句子，之前为 safe，之后为 unsafe
  - 调用 qwen3.7-plus API 逐句判断前缀安全性
"""

import json
import os
import sys
import time
from datetime import datetime

import nltk

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from shared.api_client import call_api
from shared.data_utils import load_jsonl, save_jsonl
from shared.label_schema import parse_annotation


def ensure_nltk():
    """确保 nltk punkt_tab 数据可用"""
    try:
        nltk.data.find("tokenizers/punkt_tab")
    except LookupError:
        print("  警告: NLTK punkt_tab 未找到，使用简单分句")
        raise


def simple_sent_tokenize(text: str) -> list:
    """简单分句回退方案"""
    return [s.strip() for s in re.split(r'(?<=[.!?])\s+', text) if s.strip()]


def judge_prefix_safety(user_query: str, prefix: str) -> dict:
    """用 API 判断前缀安全性"""
    messages = [
        {
            "role": "system",
            "content": (
                "You are a safety classifier. Judge if the partial response "
                "contains unsafe content. Output format: Safety: Safe/Unsafe"
            ),
        },
        {
            "role": "user",
            "content": (
                f"User query: {user_query}\n\n"
                f"Partial response: {prefix}\n\n"
                f"Is this partial response safe? Output: Safety: Safe/Unsafe"
            ),
        },
    ]
    output = call_api(messages, temperature=0.1, max_tokens=64)
    return parse_annotation(output)


def find_boundary_sentence(
    user_query: str, response: str, sample_label: str
) -> int | None:
    """找到第一个 unsafe 句子的索引

    Args:
        user_query: 用户查询
        response: 模型回复
        sample_label: 整个回复的安全标签 (Safe/Unsafe/Controversial)

    Returns:
        边界句子索引（0-based），None 表示全部 safe
    """
    if sample_label == "Safe":
        return None

    sentences = nltk.sent_tokenize(response)
    if len(sentences) <= 1:
        return 0  # 单句 unsafe 回复

    # 二分查找第一个 unsafe 句子
    for i in range(len(sentences)):
        prefix = " ".join(sentences[: i + 1])
        try:
            result = judge_prefix_safety(user_query, prefix)
            if result["safety"] in ("Unsafe", "Controversial"):
                return i
            time.sleep(0.05)  # API 限流
        except Exception as e:
            print(f"    警告: 边界检测失败 [句子 {i}]: {e}")
            return i  # 保守策略：假设当前句子为边界

    return len(sentences) - 1  # 未找到则默认最后一个


def prepare_stream_data(
    samples: list,
    max_samples: int = None,
    resume_from: int = 0,
) -> list:
    """准备 Stream 训练数据"""
    ensure_nltk()

    total = len(samples)
    if max_samples:
        samples = samples[:max_samples]
        total = len(samples)

    stream_data = []
    skipped = 0

    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] 开始句子级边界标注...")
    print(f"  总样本数: {total}")
    print(f"  仅处理 response 分类样本（含非空 response）")

    for i in range(resume_from, total):
        sample = samples[i].copy()

        # 只处理有 response 的样本
        if sample.get("task_type") != "response":
            skipped += 1
            continue
        if not sample.get("response") or not sample["response"].strip():
            skipped += 1
            continue

        try:
            user_query = sample["prompt"]
            response = sample["response"]
            label = sample.get("teacher_safety", "Unknown")

            # 对 Safe 样本也需要句子列表（全部 safe）
            sentences = nltk.sent_tokenize(response)

            if label == "Safe":
                boundary_idx = None
            else:
                boundary_idx = find_boundary_sentence(user_query, response, label)

            stream_sample = {
                "id": sample.get("id", f"stream_{i:04d}"),
                "prompt": user_query,
                "response": response,
                "sentences": sentences,
                "boundary_idx": boundary_idx,
                "teacher_safety": label,
                "teacher_categories": sample.get("teacher_categories", []),
            }
            stream_data.append(stream_sample)

            if (i + 1) % 20 == 0:
                processed = i + 1 - resume_from
                print(f"  进度: {i+1}/{total} | 有效: {len(stream_data)} | 跳过: {skipped}")

            time.sleep(0.05)

        except Exception as e:
            print(f"  错误 [{i}]: {e}")
            skipped += 1

    print(f"\n  完成: {len(stream_data)} 条有效样本, {skipped} 条跳过")

    # 统计
    no_boundary = sum(1 for s in stream_data if s["boundary_idx"] is None)
    has_boundary = sum(1 for s in stream_data if s["boundary_idx"] is not None)
    print(f"  无边界 (Safe): {no_boundary}")
    print(f"  有边界 (Unsafe/Controversial): {has_boundary}")

    return stream_data


def main():
    import argparse

    parser = argparse.ArgumentParser(description="CheryGuard Stream 数据准备")
    parser.add_argument("--input", type=str, default=None, help="输入 JSONL 路径")
    parser.add_argument("--max-samples", type=int, default=None, help="最大处理样本数")
    parser.add_argument("--resume", type=int, default=0, help="从第几条恢复")
    args = parser.parse_args()

    if args.input:
        input_path = args.input
    else:
        input_path = os.path.join(
            os.path.dirname(__file__), "..", "..", "gen", "data", "relabeled", "all_samples.jsonl"
        )

    if not os.path.exists(input_path):
        print(f"❌ 输入文件不存在: {input_path}")
        print("  请先运行 gen/scripts/02_teacher_relabel.py")
        sys.exit(1)

    print("=" * 60)
    print("  CheryGuard - Stream 句子级边界标注")
    print("=" * 60)

    samples = load_jsonl(input_path)
    print(f"  加载样本: {len(samples)}")

    stream_data = prepare_stream_data(samples, args.max_samples, args.resume)

    # 保存
    output_dir = os.path.join(os.path.dirname(__file__), "..", "data")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "stream_train.jsonl")
    save_jsonl(stream_data, output_path)

    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] 保存到: {output_path}")
    print(f"  样本数: {len(stream_data)}")


if __name__ == "__main__":
    main()