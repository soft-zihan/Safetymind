"""
Token 概率置信度分析器

双置信度方案：
1. self_confidence: 模型自报的置信度（从 JSON 输出中解析）
2. token_confidence: 基于 token logprobs 计算的置信度（从输出 token 概率中提取）
"""

import math
import json
import re
from typing import Dict, Any, List, Optional


# verdict 关键词到中文的映射
VERDICT_KEYWORDS = {
    "safe": ["safe", "安全", "pass", "通过"],
    "suspicious": ["suspicious", "可疑", "warn", "警告"],
    "malicious": ["malicious", "恶意", "block", "拦截", "dangerous", "危险"],
    "concerned": ["concerned", "担忧"],
    "alarmed": ["alarmed", "警觉"],
}


def extract_self_confidence(model_output: str) -> Optional[float]:
    """从模型输出 JSON 中提取自报置信度"""
    try:
        # 尝试直接解析
        data = json.loads(model_output)
        return float(data.get("confidence", None))
    except (json.JSONDecodeError, TypeError, ValueError):
        pass

    # 尝试从 markdown 代码块中提取
    json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', model_output, re.DOTALL)
    if json_match:
        try:
            data = json.loads(json_match.group(1))
            return float(data.get("confidence", None))
        except (json.JSONDecodeError, TypeError, ValueError):
            pass

    # 尝试正则匹配 confidence 字段
    conf_match = re.search(r'"confidence"\s*:\s*([\d.]+)', model_output)
    if conf_match:
        try:
            return float(conf_match.group(1))
        except ValueError:
            pass

    return None


def extract_verdict(model_output: str) -> Optional[str]:
    """从模型输出中提取 verdict"""
    try:
        data = json.loads(model_output)
        return data.get("verdict", None)
    except (json.JSONDecodeError, TypeError):
        pass

    verdict_match = re.search(r'"verdict"\s*:\s*"([^"]+)"', model_output)
    if verdict_match:
        return verdict_match.group(1)
    return None


def compute_token_confidence_from_logprobs(
    logprobs_data: List[Dict],
    verdict: Optional[str] = None
) -> Dict[str, float]:
    """
    从 OpenAI 兼容 API 返回的 logprobs 数据中计算 token 置信度。

    原理：
    - 在输出序列中找到 verdict 关键词出现的位置
    - 提取该位置 token 的 logprob
    - 用 softmax 计算该 token 相对于其他候选 token 的概率

    Args:
        logprobs_data: logprobs 内容列表，每项包含 token, logprob, top_logprobs
        verdict: 模型的 verdict 值，用于定位关键 token

    Returns:
        Dict 包含每个 verdict 类别的概率
    """
    if not logprobs_data:
        return {}

    # 收集所有候选 verdict 关键词
    all_keywords = []
    for cat, keywords in VERDICT_KEYWORDS.items():
        all_keywords.extend(keywords)

    # 在 logprobs 中找到 verdict 关键词出现的位置
    verdict_probs = {}

    for i, item in enumerate(logprobs_data):
        token = item.get("token", "").strip().lower()
        top_logprobs = item.get("top_logprobs", [])

        # 检查这个 token 是否是 verdict 关键词
        for cat, keywords in VERDICT_KEYWORDS.items():
            for kw in keywords:
                if token == kw.lower() or kw.lower() in token:
                    if cat not in verdict_probs:
                        # 计算此位置的 softmax 概率
                        probs = _softmax_from_top_logprobs(top_logprobs, token)
                        if probs:
                            verdict_probs[cat] = probs.get(token, probs.get(kw.lower(), 0))

    # 如果有多个匹配，取第一个（通常最可靠）
    if verdict_probs:
        # 归一化
        total = sum(verdict_probs.values())
        if total > 0:
            return {k: v / total for k, v in verdict_probs.items()}

    return verdict_probs


def _softmax_from_top_logprobs(
    top_logprobs: List[Dict],
    target_token: str
) -> Dict[str, float]:
    """从 top_logprobs 计算 softmax 概率"""
    if not top_logprobs:
        return {}

    logprobs = {}
    for entry in top_logprobs:
        tok = entry.get("token", "").strip().lower()
        lp = entry.get("logprob", -100)
        if tok:
            logprobs[tok] = lp

    if not logprobs:
        return {}

    # softmax
    max_lp = max(logprobs.values())
    exp_sum = sum(math.exp(lp - max_lp) for lp in logprobs.values())

    result = {}
    for tok, lp in logprobs.items():
        result[tok] = math.exp(lp - max_lp) / exp_sum

    return result


def compute_token_confidence_from_completion(
    completion_response: Dict[str, Any]
) -> Dict[str, Any]:
    """
    从完整的 API 响应中计算 token 置信度。

    Args:
        completion_response: OpenAI 兼容 API 的完整响应

    Returns:
        包含 self_confidence, token_confidence, verdict 的字典
    """
    result = {
        "self_confidence": None,
        "token_confidence": {},
        "verdict": None,
        "confidence_comparison": None,
    }

    # 提取模型输出内容
    choices = completion_response.get("choices", [])
    if not choices:
        return result

    content = choices[0].get("message", {}).get("content", "")
    result["self_confidence"] = extract_self_confidence(content)
    result["verdict"] = extract_verdict(content)

    # 提取 logprobs
    logprobs_data = choices[0].get("logprobs", {}).get("content", [])
    if logprobs_data:
        result["token_confidence"] = compute_token_confidence_from_logprobs(
            logprobs_data, result["verdict"]
        )

    # 计算置信度差异
    if result["self_confidence"] is not None and result["token_confidence"]:
        verdict = result["verdict"]
        if verdict and verdict in result["token_confidence"]:
            token_conf = result["token_confidence"][verdict]
            diff = abs(result["self_confidence"] - token_conf)
            result["confidence_comparison"] = {
                "self": result["self_confidence"],
                "token": token_conf,
                "difference": diff,
                "agreement": diff < 0.1,  # 差异小于 10% 认为一致
            }

    return result


def analyze_batch(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """批量分析评估结果的置信度对比"""
    self_confs = []
    token_confs = []
    agreements = 0
    total = 0

    for r in results:
        sc = r.get("self_confidence")
        tc = r.get("token_confidence", {})
        verdict = r.get("verdict")

        if sc is not None:
            self_confs.append(sc)

        if verdict and verdict in tc:
            token_confs.append(tc[verdict])

        comp = r.get("confidence_comparison")
        if comp:
            total += 1
            if comp.get("agreement"):
                agreements += 1

    return {
        "total_samples": len(results),
        "self_confidence_stats": _compute_stats(self_confs) if self_confs else None,
        "token_confidence_stats": _compute_stats(token_confs) if token_confs else None,
        "agreement_rate": agreements / total if total > 0 else None,
        "avg_self_confidence": sum(self_confs) / len(self_confs) if self_confs else None,
        "avg_token_confidence": sum(token_confs) / len(token_confs) if token_confs else None,
    }


def _compute_stats(values: List[float]) -> Dict[str, float]:
    """计算统计信息"""
    if not values:
        return {}
    sorted_vals = sorted(values)
    return {
        "mean": sum(values) / len(values),
        "min": min(values),
        "max": max(values),
        "median": sorted_vals[len(sorted_vals) // 2],
        "std": (sum((v - sum(values) / len(values)) ** 2 for v in values) / len(values)) ** 0.5,
    }
