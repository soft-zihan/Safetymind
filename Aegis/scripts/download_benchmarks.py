"""下载公开安全评测基准数据集

Downloads:
  - AgentDojo (ffuuugor/agentdojo-dump) - Prompt Injection 攻防评测
  - AgentHarm (ai-safety-institute/AgentHarm) - Agent 有害行为评测
  - CyberSecEval (walledai/CyberSecEval) - 网络安全评测
"""
import json
from pathlib import Path

OUT_DIR = Path(__file__).parent.parent / "benchmark_datasets"
OUT_DIR.mkdir(exist_ok=True)


def download_agentdojo():
    """下载 AgentDojo"""
    print("📥 下载 AgentDojo...")
    try:
        from datasets import load_dataset
        ds = load_dataset("ffuuugor/agentdojo-dump", trust_remote_code=False)
        samples = []
        for split_name in ds:
            split_data = ds[split_name]
            for row in split_data:
                samples.append({
                    "split": split_name,
                    "task": row.get("task", row.get("name", "")),
                    "input": row.get("prompt", row.get("input", row.get("question", ""))),
                    "label": str(row.get("label", row.get("expected_outcome", ""))),
                    "category": row.get("category", row.get("task_type", "")),
                })
        out_file = OUT_DIR / "agentdojo.json"
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump({"name": "AgentDojo", "samples": samples, "total": len(samples)}, f, ensure_ascii=False, indent=2)
        print(f"✅ AgentDojo: {len(samples)} 条 -> {out_file}")
        return len(samples)
    except Exception as e:
        print(f"❌ AgentDojo 下载失败: {e}")
        # 尝试备用源
        try:
            print("📥 尝试备用源 Junzj/agentdojo-dump...")
            from datasets import load_dataset
            ds = load_dataset("Junzj/agentdojo-dump", trust_remote_code=False)
            samples = []
            for split_name in ds:
                for row in ds[split_name]:
                    samples.append({
                        "split": split_name,
                        "task": row.get("task", row.get("name", "")),
                        "input": row.get("prompt", row.get("input", row.get("question", ""))),
                        "label": str(row.get("label", row.get("expected_outcome", ""))),
                        "category": row.get("category", row.get("task_type", "")),
                    })
            out_file = OUT_DIR / "agentdojo.json"
            with open(out_file, "w", encoding="utf-8") as f:
                json.dump({"name": "AgentDojo", "samples": samples, "total": len(samples)}, f, ensure_ascii=False, indent=2)
            print(f"✅ AgentDojo (备用): {len(samples)} 条 -> {out_file}")
            return len(samples)
        except Exception as e2:
            print(f"❌ 备用源也失败: {e2}")
            return 0


def download_agentharm():
    """下载 AgentHarm"""
    print("📥 下载 AgentHarm...")
    try:
        from datasets import load_dataset
        ds = load_dataset("ai-safety-institute/AgentHarm", trust_remote_code=False)
        samples = []
        for split_name in ds:
            for row in ds[split_name]:
                samples.append({
                    "split": split_name,
                    "behavior": row.get("behavior", row.get("behavior_id", "")),
                    "category": row.get("category", row.get("harm_category", "")),
                    "input": row.get("prompt", row.get("input", row.get("query", ""))),
                    "severity": row.get("severity", ""),
                })
        out_file = OUT_DIR / "agentharm.json"
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump({"name": "AgentHarm", "samples": samples, "total": len(samples)}, f, ensure_ascii=False, indent=2)
        print(f"✅ AgentHarm: {len(samples)} 条 -> {out_file}")
        return len(samples)
    except Exception as e:
        print(f"❌ AgentHarm 下载失败: {e}")
        return 0


def download_cyberseceval():
    """下载 CyberSecEval"""
    print("📥 下载 CyberSecEval...")
    try:
        from datasets import load_dataset
        ds = load_dataset("walledai/CyberSecEval", trust_remote_code=False)
        samples = []
        for split_name in ds:
            for row in ds[split_name]:
                samples.append({
                    "split": split_name,
                    "input": row.get("prompt", row.get("input", row.get("text", ""))),
                    "category": row.get("category", row.get("type", "")),
                    "label": str(row.get("label", row.get("target", ""))),
                })
        out_file = OUT_DIR / "cyberseceval.json"
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump({"name": "CyberSecEval", "samples": samples, "total": len(samples)}, f, ensure_ascii=False, indent=2)
        print(f"✅ CyberSecEval: {len(samples)} 条 -> {out_file}")
        return len(samples)
    except Exception as e:
        print(f"❌ CyberSecEval (walledai) 失败: {e}")
        # 尝试 facebook 官方
        try:
            print("📥 尝试 facebook/cyberseceval3-visual-prompt-injection...")
            from datasets import load_dataset
            ds = load_dataset("facebook/cyberseceval3-visual-prompt-injection", trust_remote_code=False)
            samples = []
            for split_name in ds:
                for row in ds[split_name]:
                    samples.append({
                        "split": split_name,
                        "input": row.get("prompt", row.get("input", row.get("text", ""))),
                        "category": row.get("category", row.get("type", "prompt_injection")),
                        "label": str(row.get("label", "")),
                    })
            out_file = OUT_DIR / "cyberseceval.json"
            with open(out_file, "w", encoding="utf-8") as f:
                json.dump({"name": "CyberSecEval", "samples": samples, "total": len(samples)}, f, ensure_ascii=False, indent=2)
            print(f"✅ CyberSecEval (fb): {len(samples)} 条 -> {out_file}")
            return len(samples)
        except Exception as e2:
            print(f"❌ 备用源也失败: {e2}")
            return 0


if __name__ == "__main__":
    print(f"📂 输出目录: {OUT_DIR}\n")
    total = 0
    total += download_agentdojo()
    print()
    total += download_agentharm()
    print()
    total += download_cyberseceval()
    print(f"\n🎉 完成! 共下载 {total} 条样本到 {OUT_DIR}")
