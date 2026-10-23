"""Hermes × qise 接入服务 — 通过 qise SDK 为 Hermes Agent 提供安全防护

本模块在 Aegis 后端实现，不修改 qise 源码。
通过 qise.adapters.hermes.QiseHermesAdapter SDK 接入。

接入方式：
  1. SDK Adapter — 用 adapter.wrap_tool() 包装 Hermes 工具函数
  2. Proxy Mode — Hermes 的 OPENAI_API_BASE 指向 qise proxy (localhost:8822)
  3. Output Check — 用 adapter.check_agent_output() 检查 Hermes 输出
"""
import sys
import logging
from pathlib import Path
from app.config import settings

logger = logging.getLogger("aegis.hermes_qise")

# qise 源码路径加入 sys.path
QISE_SRC = Path(__file__).resolve().parents[3] / "qise" / "src"
if str(QISE_SRC) not in sys.path:
    sys.path.insert(0, str(QISE_SRC))


class HermesQiseService:
    """Hermes 通过 qise SDK 接入的安全防护服务"""

    def __init__(self):
        self._adapter = None
        self._shield = None
        self._sdk_initialized = False
        self._proxy_enabled = False

    def _init_shield(self):
        """延迟初始化 Shield 和 Adapter"""
        if self._shield is not None:
            return
        try:
            from qise.core.shield import Shield
            self._shield = Shield.from_config()
            guard_count = len(list(self._shield.pipeline.all_guards))
            logger.info("qise Shield 初始化成功，加载 %d 个守卫", guard_count)
            
            from qise.adapters.hermes import QiseHermesAdapter
            self._adapter = QiseHermesAdapter(self._shield, session_id="hermes-aegis")
            self._adapter.install()
            self._sdk_initialized = True
            logger.info("QiseHermesAdapter 初始化成功")
        except Exception as e:
            logger.warning("qise SDK 初始化失败: %s", e)
            self._shield = None
            self._adapter = None
            self._sdk_initialized = False

    def _check_proxy_mode(self) -> bool:
        """检查 qise proxy 模式是否可用"""
        try:
            import httpx
            # 检查 qise proxy 是否在运行
            proxy_url = getattr(settings, 'QISE_PROXY_URL', 'http://localhost:8822')
            response = httpx.get(f"{proxy_url}/health", timeout=2.0)
            if response.status_code == 200:
                self._proxy_enabled = True
                return True
        except Exception:
            pass
        self._proxy_enabled = False
        return False

    def get_status(self) -> dict:
        """获取 qise 接入 Hermes 的状态"""
        self._init_shield()
        self._check_proxy_mode()

        if self._adapter is None and not self._proxy_enabled:
            return {
                "integrated": False,
                "method": None,
                "shield_loaded": False,
                "sdk_available": False,
                "proxy_available": False,
                "message": "qise 未安装或 Shield 加载失败，Hermes 暂无安全防护",
                "integration_guide": {
                    "sdk": "from qise.adapters.hermes import QiseHermesAdapter",
                    "proxy": "export OPENAI_API_BASE=http://localhost:8822/v1",
                    "env": "在 .env 中设置 QISE_PROXY_URL=http://localhost:8822",
                },
            }

        # 获取守卫数量
        guard_count = 0
        if self._shield:
            try:
                guard_count = len(list(self._shield.pipeline.all_guards))
            except Exception:
                pass

        return {
            "integrated": True,
            "method": "sdk_adapter" if self._sdk_initialized else "proxy_only",
            "shield_loaded": self._shield is not None,
            "adapter": "QiseHermesAdapter" if self._adapter else None,
            "session_id": "hermes-aegis",
            "guards_available": guard_count,
            "sdk_mode": {
                "enabled": self._sdk_initialized,
                "adapter_installed": self._adapter is not None,
                "note": "SDK 模式：工具包装 + 输出检查",
            },
            "proxy_mode": {
                "enabled": self._proxy_enabled,
                "endpoint": getattr(settings, 'QISE_PROXY_URL', 'http://localhost:8822'),
                "note": "Proxy 模式：全流量防护，设置 OPENAI_API_BASE 即可",
            },
            "tool_wrapping": {
                "available": self._sdk_initialized,
                "usage": "adapter.wrap_tool(tool) — 包装工具函数，执行前自动安全检查",
            },
            "output_check": {
                "available": self._sdk_initialized,
                "usage": "adapter.check_agent_output(text) — 检查输出中的凭据/PII泄露",
            },
        }

    def check_tool_call(self, tool_name: str, tool_args: dict) -> dict:
        """手动检查工具调用安全性"""
        self._init_shield()
        if self._adapter is None:
            return {"verdict": "pass", "note": "qise SDK 未接入，放行"}

        try:
            result = self._adapter.check_tool_call(
                tool_name=tool_name,
                tool_args=tool_args,
                session_id="hermes-aegis",
            )
            return {
                "verdict": "block" if result.should_block else "pass",
                "blocked_by": result.blocked_by,
                "warnings": result.warnings,
                "results": [
                    {
                        "guard": gr.guard_name,
                        "verdict": gr.verdict,
                        "confidence": gr.confidence,
                        "message": gr.message,
                    }
                    for gr in result.results
                ],
            }
        except Exception as e:
            logger.error("工具调用检查失败: %s", e)
            return {"verdict": "error", "message": str(e)}

    def check_output(self, text: str) -> dict:
        """检查 Hermes Agent 输出安全性"""
        self._init_shield()
        if self._adapter is None:
            return {"verdict": "pass", "note": "qise SDK 未接入，放行"}

        try:
            result = self._adapter.check_agent_output(text)
            return {
                "verdict": getattr(result, "verdict", "pass"),
                "should_block": getattr(result, "should_block", False),
                "warnings": getattr(result, "warnings", []),
                "results": [
                    {
                        "guard": gr.guard_name,
                        "verdict": gr.verdict,
                        "confidence": gr.confidence,
                        "message": gr.message,
                    }
                    for gr in getattr(result, "results", [])
                ],
            }
        except Exception as e:
            logger.error("输出检查失败: %s", e)
            return {"verdict": "error", "message": str(e)}

    def get_sdk_snippet(self) -> str:
        """返回 Hermes 接入 qise 的 SDK 代码片段"""
        return '''# Hermes × qise 接入示例
from qise import Shield
from qise.adapters.hermes import QiseHermesAdapter

# 1. 加载 Shield
shield = Shield.from_config()
adapter = QiseHermesAdapter(shield, session_id="hermes-session")

# 2. 包装工具函数（执行前自动安全检查）
safe_tools = [adapter.wrap_tool(tool) for tool in my_tools]
agent = Agent(provider="openai", model="gpt-4", tools=safe_tools)

# 3. 检查 Agent 输出（凭据/PII 泄露检测）
response = agent.run(prompt)
result = adapter.check_agent_output(response)

# 或者使用 Proxy 模式（全流量防护）：
# export OPENAI_API_BASE=http://localhost:8822/v1
# 或在 .env 中设置: QISE_PROXY_URL=http://localhost:8822
'''


# 全局实例
hermes_qise = HermesQiseService()
