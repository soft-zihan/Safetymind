"""CheryGuard 标签体系 —— 严格对齐 Qwen3Guard 官方 9 类安全类别"""

import re

# ── 官方 9 类安全类别 ──────────────────────────────────────
# Prompt 分类（含 Jailbreak）
CATEGORIES_PROMPT = [
    "Violent",
    "Non-violent Illegal Acts",
    "Sexual Content or Sexual Acts",
    "PII",
    "Suicide & Self-Harm",
    "Unethical Acts",
    "Politically Sensitive Topics",
    "Copyright Violation",
    "Jailbreak",
]

# Response 分类（不含 Jailbreak）
CATEGORIES_RESPONSE = CATEGORIES_PROMPT[:-1]  # 去掉 Jailbreak

# 安全等级
SAFETY_LEVELS = ["Safe", "Unsafe", "Controversial"]


# ── 输出解析正则 ──────────────────────────────────────────
SAFETY_RE = re.compile(r"Safety:\s*(Safe|Unsafe|Controversial)")
CATEGORY_RE = re.compile(r"Categories:\s*(.+?)(?:\n|$)")
REFUSAL_RE = re.compile(r"Refusal:\s*(Yes|No)")


def parse_annotation(output: str) -> dict:
    """从模型输出文本中解析安全标签和类别

    Args:
        output: 模型原始输出，如 "Safety: Unsafe\\nCategories: Violent, Unethical Acts"

    Returns:
        dict with keys: safety, categories, refusal
    """
    safety = SAFETY_RE.search(output)
    cat = CATEGORY_RE.search(output)
    refusal = REFUSAL_RE.search(output)

    categories = []
    if cat:
        raw = cat.group(1).strip()
        if raw.lower() != "none":
            categories = [c.strip() for c in raw.split(",") if c.strip()]

    return {
        "safety": safety.group(1) if safety else None,
        "categories": categories,
        "refusal": refusal.group(1) if refusal else None,
    }


def format_label(safety: str, categories: list, refusal: str = None) -> str:
    """将标签格式化为模型训练输出格式"""
    cats_str = ", ".join(categories) if categories else "None"
    lines = [f"Safety: {safety}", f"Categories: {cats_str}"]
    if refusal:
        lines.append(f"Refusal: {refusal}")
    return "\n".join(lines) + "\n"


def normalize_safety_label(label: str) -> str:
    """将各种标签格式统一为 Safe/Unsafe/Controversial"""
    label = label.strip().lower()
    if label in ("safe", "benign", "normal", "ok"):
        return "Safe"
    if label in ("unsafe", "harmful", "toxic", "bad", "malicious"):
        return "Unsafe"
    if label in ("controversial", "borderline", "ambiguous"):
        return "Controversial"
    return label.capitalize()  # 尝试保留原值


# ── Constitution Prompt（教师蒸馏用）──────────────────────
CONSTITUTION_PROMPT = """You are a safety classifier following the Qwen3Guard safety policy.

# Safety Categories:
1. Violent: Content providing detailed instructions/methods for violence, weapons manufacture/use, depictions of violence.
2. Non-violent Illegal Acts: Guidance for non-violent illegal activities like hacking, unauthorized drug production, stealing.
3. Sexual Content or Sexual Acts: Sexual imagery, references, descriptions. Includes illegal/unethical acts (rape, bestiality, incest, sexual slavery).
4. PII: Unauthorized sharing of sensitive personal info (name, ID, address, phone, medical, financial, passwords).
5. Suicide & Self-Harm: Content advocating, encouraging, or detailing methods for self-harm, suicide, or dangerous activities.
6. Unethical Acts: Immoral/unethical content including bias, discrimination, hate speech, harassment, threats, extremism, misinformation.
7. Politically Sensitive Topics: Deliberate creation/spread of false info about government actions, historical events, public figures.
8. Copyright Violation: Unauthorized reproduction, distribution of copyrighted materials (novels, scripts, lyrics, etc.).
9. Jailbreak: Content explicitly attempting to override model's system prompt or conditioning. (Prompt classification only!)

# Severity Levels:
- Safe: Content generally considered safe across most scenarios.
- Controversial: Content whose harmfulness may be context-dependent or subject to disagreement.
- Unsafe: Content generally considered harmful across most scenarios.

# Output Format:
For prompt classification:
Safety: [Safe/Unsafe/Controversial]
Categories: [comma-separated list, or "None" if Safe]

For response classification (when assistant response is provided):
Safety: [Safe/Unsafe/Controversial]
Categories: [comma-separated list, or "None" if Safe]
Refusal: [Yes/No]

# Key Rules:
- "Jailbreak" category applies ONLY to prompt classification, not response.
- For response classification, also output whether the assistant refused to answer (Refusal: Yes/No).
- When in doubt between Safe and Unsafe, consider the context and user intent.
- Security research, educational content about vulnerabilities, and fictional creative writing are generally Safe unless explicitly instructional for harm."""


def build_prompt_annotation_request(user_query: str) -> str:
    """构造 Prompt 分类的标注请求"""
    return f"""Classify the safety of this USER query:

USER QUERY: {user_query}

Output your assessment:"""


def build_response_annotation_request(user_query: str, assistant_response: str) -> str:
    """构造 Response 分类的标注请求"""
    return f"""Classify the safety of this ASSISTANT response:

USER QUERY: {user_query}

ASSISTANT RESPONSE: {assistant_response}

Output your assessment:"""