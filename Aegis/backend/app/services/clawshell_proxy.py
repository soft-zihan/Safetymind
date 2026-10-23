"""ClawShell 代理服务 — 转发请求到 ClawShell 并聚合双 Agent 连接状态"""
import subprocess
import shutil
import httpx
from pathlib import Path
from app.config import settings


class ClawShellProxyService:
    """ClawShell 代理服务"""

    def __init__(self):
        self.base_url = settings.CLAWSHELL_BASE_URL
        self.bin_path = settings.CLAWSHELL_BIN_PATH or shutil.which("clawshell") or ""
        self.config_path = settings.CLAWSHELL_CONFIG_PATH

    def _clawshell_installed(self) -> bool:
        """检测 ClawShell 是否已安装"""
        return bool(self.bin_path)

    async def get_status(self) -> dict:
        """获取 ClawShell 聚合状态（服务本身 + 双 Agent 连接）"""
        clawshell_status = await self._check_clawshell_status()
        agents_status = await self._check_agents_connection()

        return {
            "clawshell": clawshell_status,
            "agents": agents_status,
        }

    async def _check_clawshell_status(self) -> dict:
        """检测 ClawShell 服务状态"""
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{self.base_url}/health")
                # 200 或 401 都表示服务在运行（401 是需要认证）
                if resp.status_code in (200, 401):
                    # 尝试获取统计信息
                    stats = {}
                    try:
                        stats_resp = await client.get(f"{self.base_url}/admin/stats")
                        if stats_resp.status_code == 200:
                            stats = stats_resp.json()
                    except Exception:
                        pass

                    return {
                        "running": True,
                        "url": self.base_url,
                        "stats": stats,
                    }
        except Exception:
            pass

        # 服务未运行，返回明确状态
        return {
            "running": False,
            "url": self.base_url,
            "stats": {},
            "message": "ClawShell 服务未运行，请先启动: clawshell start",
        }

    async def _check_agents_connection(self) -> dict:
        """检测两个 Agent 与 ClawShell 的连接状态"""
        openclaw_connected = False
        hermes_connected = False

        # 检查 OpenClaw 是否配置了 ClawShell 代理（优先检测 .openclaw-hardened）
        openclaw_configs = [
            Path.home() / ".openclaw-hardened" / "openclaw.json",
            Path.home() / ".openclaw" / "openclaw.json",
        ]
        openclaw_config = None
        for config_path in openclaw_configs:
            if config_path.exists():
                try:
                    import json
                    with open(config_path) as f:
                        data = json.load(f)
                    # OpenClaw-hardened 通过 env.CLAWSHELL_API_KEY 连接 ClawShell
                    clawshell_key = data.get("env", {}).get("CLAWSHELL_API_KEY", "")
                    if clawshell_key:
                        openclaw_connected = True
                        openclaw_config = config_path
                        break
                except Exception:
                    pass
        if openclaw_config is None:
            openclaw_config = settings.OPENCLAW_CONFIG_PATH

        # 检查 Hermes 是否配置了 ClawShell 代理
        hermes_config = settings.HERMES_CONFIG_PATH
        if hermes_config.exists():
            try:
                content = hermes_config.read_text()
                if "21789" in content or "clawshell" in content.lower():
                    hermes_connected = True
            except Exception:
                pass

        return {
            "openclaw": {
                "connected": openclaw_connected,
                "config_path": str(openclaw_config),
            },
            "hermes": {
                "connected": hermes_connected,
                "config_path": str(hermes_config),
            },
        }

    async def start_service(self) -> dict:
        """启动 ClawShell 服务"""
        if not self._clawshell_installed():
            return {"success": False, "message": "ClawShell 未安装"}

        # 检查是否已运行
        status = await self._check_clawshell_status()
        if status["running"]:
            return {"success": True, "message": "ClawShell 已在运行"}

        try:
            cmd = [self.bin_path, "start"]
            if self.config_path:
                cmd.extend(["-c", self.config_path])

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                return {"success": True, "message": "ClawShell 已启动"}
            else:
                return {"success": False, "message": f"启动失败: {result.stderr}"}
        except Exception as e:
            return {"success": False, "message": f"启动异常: {str(e)}"}

    async def stop_service(self) -> dict:
        """停止 ClawShell 服务"""
        if not self._clawshell_installed():
            return {"success": False, "message": "ClawShell 未安装"}

        try:
            result = subprocess.run(
                [self.bin_path, "stop"],
                capture_output=True, text=True, timeout=10
            )
            if result.returncode == 0:
                return {"success": True, "message": "ClawShell 已停止"}
            else:
                return {"success": False, "message": f"停止失败: {result.stderr}"}
        except Exception as e:
            return {"success": False, "message": f"停止异常: {str(e)}"}

    async def restart_service(self) -> dict:
        """重启 ClawShell 服务"""
        await self.stop_service()
        import asyncio
        await asyncio.sleep(1)
        return await self.start_service()

    async def proxy_request(self, path: str) -> dict:
        """代理转发请求到 ClawShell"""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self.base_url}/{path}")
                return {
                    "success": True,
                    "status_code": resp.status_code,
                    "data": resp.json() if resp.status_code == 200 else None,
                }
        except Exception as e:
            return {
                "success": False,
                "message": f"ClawShell 请求失败: {str(e)}",
            }


# 全局实例
proxy_service = ClawShellProxyService()
