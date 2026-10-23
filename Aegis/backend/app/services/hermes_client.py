"""Hermes Agent CLI/HTTP 客户端 — 铁翼信使状态查询"""
import subprocess
import json
import shutil
from pathlib import Path
from app.config import settings


class HermesClient:
    """通过 Hermes CLI 和文件系统交互获取 Agent 状态"""

    def __init__(self):
        self.config_path = settings.HERMES_CONFIG_PATH
        self.plugins_path = settings.HERMES_PLUGINS_PATH
        self.hermes_bin = shutil.which("hermes") or "hermes"

    def _hermes_installed(self) -> bool:
        """检测 Hermes CLI 是否已安装"""
        return shutil.which("hermes") is not None or (self.config_path.exists())

    async def get_status(self) -> dict:
        """检测 Hermes 是否安装及运行状态"""
        installed = self._hermes_installed()
        config_exists = self.config_path.exists()
        plugins_exist = self.plugins_path.exists()

        if not installed:
            return {
                "installed": False,
                "version": None,
                "running": False,
                "config_path": str(self.config_path),
                "config_exists": config_exists,
                "plugins_path": str(self.plugins_path),
                "plugins_exist": plugins_exist,
                "proxy_url": None,
                "message": "Hermes Agent 未检测到，请先安装 Hermes 或运行集成脚本",
                "status": "not_installed",
            }

        # 尝试获取版本
        version = None
        try:
            result = subprocess.run(
                [self.hermes_bin, "--version"],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode == 0:
                version = result.stdout.strip()
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass

        # 检查 Hermes 是否实际在运行（通过 HTTP 或进程检测）
        running = False
        active_sessions = 0
        try:
            import httpx
            # 尝试连接 Hermes agent URL
            async with httpx.AsyncClient(timeout=2.0) as http_client:
                resp = await http_client.get("http://localhost:8081/health")
                if resp.status_code == 200:
                    running = True
                    data = resp.json()
                    active_sessions = data.get("active_sessions", 0)
        except Exception:
            # HTTP 检查失败，尝试进程检查
            try:
                proc_result = subprocess.run(
                    ["pgrep", "-f", "hermes"],
                    capture_output=True, text=True, timeout=2
                )
                running = proc_result.returncode == 0
            except Exception:
                running = False

        return {
            "installed": True,
            "version": version or "unknown",
            "running": running,
            "config_path": str(self.config_path),
            "config_exists": config_exists,
            "plugins_path": str(self.plugins_path),
            "plugins_exist": plugins_exist,
            "proxy_url": "http://localhost:21789",  # ClawShell
            "active_sessions": active_sessions,
            "uptime": "unknown",
            "status": "running" if running else "installed_but_stopped",
        }

    async def get_agents(self) -> list[dict]:
        """获取 Hermes Agent 配置列表"""
        if not self.config_path.exists():
            return []

        agents = []
        try:
            # 尝试读取 hermes 配置
            config_dir = self.config_path.parent
            for yaml_file in config_dir.glob("*.yaml"):
                agents.append({
                    "name": yaml_file.stem,
                    "config_path": str(yaml_file),
                    "type": "agent",
                })
        except Exception:
            pass

        if not agents:
            return []
        return agents

    async def get_plugins(self) -> list[dict]:
        """扫描 ~/.hermes/plugins/ 获取已安装插件"""
        plugins = []
        if not self.plugins_path.exists():
            return plugins

        try:
            for plugin_dir in self.plugins_path.iterdir():
                if plugin_dir.is_dir():
                    plugin_yaml = plugin_dir / "plugin.yaml"
                    plugin_info = {
                        "name": plugin_dir.name,
                        "path": str(plugin_dir),
                        "enabled": True,
                        "version": "unknown",
                        "safety_rating": 0,
                    }
                    if plugin_yaml.exists():
                        try:
                            import yaml
                            with open(plugin_yaml) as f:
                                data = yaml.safe_load(f) or {}
                            plugin_info["version"] = data.get("version", "unknown")
                            plugin_info["description"] = data.get("description", "")
                        except Exception:
                            pass
                    plugins.append(plugin_info)
        except Exception:
            pass

        return plugins

    async def get_tirith_status(self) -> dict:
        """获取 Tirith 扫描器状态和最近扫描结果"""
        tirith_path = settings.HERMES_TIRITH_PATH or shutil.which("tirith") or ""
        tirith_installed = bool(tirith_path) and Path(tirith_path).exists() if tirith_path else False

        return {
            "installed": tirith_installed,
            "path": tirith_path or None,
            "last_scan": None,
            "last_results": [],
            "message": "Tirith 已就绪" if tirith_installed else "Tirith 未安装，请通过 hermes-agent 自动安装",
        }


# 全局实例
client = HermesClient()
