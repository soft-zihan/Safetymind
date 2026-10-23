import os
import json
import time
from openai import OpenAI
from dotenv import load_dotenv

# 加载 .env 配置（从 shared/ 的上级目录）
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

client = OpenAI(
    api_key=os.getenv("DASHSCOPE_API_KEY"),
    base_url=os.getenv("DASHSCOPE_BASE_URL"),
)
MODEL = os.getenv("ANNOTATION_MODEL", "qwen3.7-plus")


def call_api(messages, temperature=0.1, max_tokens=128, max_retries=3):
    """带重试的 API 调用（max_tokens=128 以加速响应）"""
    last_exception = None
    for attempt in range(max_retries):
        try:
            resp = client.chat.completions.create(
                model=MODEL,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            content = resp.choices[0].message.content
            if content is None:
                raise ValueError("API 返回空内容")
            return content.strip()
        except Exception as e:
            last_exception = e
            if attempt < max_retries - 1:
                wait = 2**attempt
                time.sleep(wait)
    raise last_exception


def call_api_concurrent(messages_list, temperature=0.1, max_tokens=128, max_workers=5):
    """并发批量 API 调用"""
    from concurrent.futures import ThreadPoolExecutor, as_completed
    results = [None] * len(messages_list)

    def _call(idx, messages):
        try:
            result = call_api(messages, temperature, max_tokens, max_retries=3)
            return idx, True, result
        except Exception as e:
            return idx, False, str(e)

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(_call, i, msgs) for i, msgs in enumerate(messages_list)]
        for future in as_completed(futures):
            idx, success, output = future.result()
            results[idx] = {"index": idx, "success": success, "output": output}
    return results