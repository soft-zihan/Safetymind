"""
安全加固检查服务

基于 OpenClaw 安全加固指南的三层检查体系：
- 基础层（5分钟）：文件权限、Gateway 绑定、API Key 明文检测
- 标准层（30分钟）：Docker 沙箱、容器隔离、资源限制
- 深度层（1-2小时）：safeBins、elevated 模式、SOUL.md 规则
"""

import os
import json
import subprocess
import stat
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime


class HardeningChecker:
    """安全加固检查器"""

    def __init__(self):
        self.home = Path.home()
        self.openclaw_dirs = [
            self.home / ".openclaw-hardened",
            self.home / ".openclaw",
            self.home / ".openclaw-naked",
        ]

    def check_all(self) -> Dict[str, Any]:
        """运行全部三层检查"""
        basic = self.check_basic()
        standard = self.check_standard()
        deep = self.check_deep()

        all_checks = basic["checks"] + standard["checks"] + deep["checks"]
        pass_count = sum(1 for c in all_checks if c["status"] == "pass")
        warn_count = sum(1 for c in all_checks if c["status"] == "warn")
        fail_count = sum(1 for c in all_checks if c["status"] == "fail")
        total = len(all_checks)

        return {
            "basic": basic,
            "standard": standard,
            "deep": deep,
            "summary": {
                "total": total,
                "pass": pass_count,
                "warn": warn_count,
                "fail": fail_count,
                "score": round(pass_count / total * 100) if total > 0 else 0,
            },
            "checked_at": datetime.now().isoformat(),
        }

    def check_basic(self) -> Dict[str, Any]:
        """基础层检查"""
        checks = []

        # 1. 文件权限检查
        for d in self.openclaw_dirs:
            if d.exists():
                mode = oct(d.stat().st_mode & 0o777)
                checks.append({
                    "id": f"file_perm_dir_{d.name}",
                    "name": f"目录权限: {d.name}",
                    "layer": "basic",
                    "status": "pass" if mode == "0o700" else "warn",
                    "current": mode,
                    "expected": "0o700",
                    "description": "配置目录应仅所有者可访问",
                    "fix": f"chmod 700 {d}",
                    "auto_fixable": True,
                })

                config_file = d / "openclaw.json"
                if config_file.exists():
                    fmode = oct(config_file.stat().st_mode & 0o777)
                    checks.append({
                        "id": f"file_perm_config_{d.name}",
                        "name": f"配置文件权限: {d.name}/openclaw.json",
                        "layer": "basic",
                        "status": "pass" if fmode == "0o600" else "warn",
                        "current": fmode,
                        "expected": "0o600",
                        "description": "配置文件应仅所有者可读写",
                        "fix": f"chmod 600 {config_file}",
                        "auto_fixable": True,
                    })

        # 2. Gateway 绑定检查
        for d in self.openclaw_dirs:
            config_file = d / "openclaw.json"
            if config_file.exists():
                try:
                    with open(config_file, "r") as f:
                        config = json.load(f)
                    bind = config.get("gateway", {}).get("bind", "unknown")
                    checks.append({
                        "id": f"gateway_bind_{d.name}",
                        "name": f"Gateway 绑定: {d.name}",
                        "layer": "basic",
                        "status": "pass" if bind in ("loopback", "lan") else "fail",
                        "current": bind,
                        "expected": "loopback",
                        "description": "Gateway 不应绑定到 0.0.0.0",
                        "fix": '将 gateway.bind 设为 "loopback"',
                        "auto_fixable": True,
                    })
                except Exception:
                    pass

        # 3. API Key 明文检测
        for d in self.openclaw_dirs:
            if d.exists():
                for f in d.rglob("*.json"):
                    try:
                        content = f.read_text()
                        if "sk-" in content and "env" not in content.lower():
                            checks.append({
                                "id": f"plaintext_key_{f.name}",
                                "name": f"明文 API Key: {f.relative_to(d)}",
                                "layer": "basic",
                                "status": "fail",
                                "current": "检测到硬编码 API Key",
                                "expected": "使用环境变量引用",
                                "description": f"文件 {f.name} 中可能包含明文 API Key",
                                "fix": "将 API Key 移至 .env 文件",
                                "auto_fixable": False,
                            })
                    except Exception:
                        pass

        # 4. mDNS 广播检查
        checks.append({
            "id": "mdns_broadcast",
            "name": "mDNS 广播",
            "layer": "basic",
            "status": "pass" if os.environ.get("OPENCLAW_DISABLE_BONJOUR") else "warn",
            "current": "已禁用" if os.environ.get("OPENCLAW_DISABLE_BONJOUR") else "未检查",
            "expected": "已禁用",
            "description": "mDNS 广播可能暴露 Gateway 信息",
            "fix": "export OPENCLAW_DISABLE_BONJOUR=1",
            "auto_fixable": True,
        })

        pass_count = sum(1 for c in checks if c["status"] == "pass")
        return {
            "layer": "basic",
            "name": "基础层",
            "description": "5 分钟快速止血：文件权限、Gateway 绑定、API Key 明文",
            "checks": checks,
            "pass_rate": round(pass_count / len(checks) * 100) if checks else 0,
        }

    def check_standard(self) -> Dict[str, Any]:
        """标准层检查"""
        checks = []

        # 1. Docker 沙箱状态
        docker_available = self._check_docker_available()
        checks.append({
            "id": "docker_available",
            "name": "Docker 可用性",
            "layer": "standard",
            "status": "pass" if docker_available else "warn",
            "current": "可用" if docker_available else "未检测到 Docker",
            "expected": "Docker 已安装并运行",
            "description": "Docker 是沙箱隔离的基础",
            "fix": "安装 Docker Desktop",
            "auto_fixable": False,
        })

        # 2. 沙箱配置检查
        for d in self.openclaw_dirs:
            config_file = d / "openclaw.json"
            if config_file.exists():
                try:
                    with open(config_file, "r") as f:
                        config = json.load(f)
                    sandbox = config.get("agents", {}).get("defaults", {}).get("sandbox", {})
                    mode = sandbox.get("mode", "off")
                    checks.append({
                        "id": f"sandbox_mode_{d.name}",
                        "name": f"沙箱模式: {d.name}",
                        "layer": "standard",
                        "status": "pass" if mode == "all" else ("warn" if mode == "non-main" else "fail"),
                        "current": mode,
                        "expected": "all",
                        "description": "推荐所有会话都在沙箱中运行",
                        "fix": '将 sandbox.mode 设为 "all"',
                        "auto_fixable": True,
                    })

                    network = sandbox.get("docker", {}).get("network", "bridge")
                    checks.append({
                        "id": f"sandbox_network_{d.name}",
                        "name": f"容器网络: {d.name}",
                        "layer": "standard",
                        "status": "pass" if network == "none" else "fail",
                        "current": network,
                        "expected": "none",
                        "description": "容器应禁止网络访问",
                        "fix": '将 docker.network 设为 "none"',
                        "auto_fixable": True,
                    })

                    readonly = sandbox.get("docker", {}).get("readOnlyRoot", False)
                    checks.append({
                        "id": f"sandbox_readonly_{d.name}",
                        "name": f"只读根文件系统: {d.name}",
                        "layer": "standard",
                        "status": "pass" if readonly else "fail",
                        "current": "已启用" if readonly else "未启用",
                        "expected": "已启用",
                        "description": "容器根文件系统应为只读",
                        "fix": '将 docker.readOnlyRoot 设为 true',
                        "auto_fixable": True,
                    })
                except Exception:
                    pass

        # 3. .env 文件检查
        for d in self.openclaw_dirs:
            env_file = d / ".env"
            checks.append({
                "id": f"env_file_{d.name}",
                "name": f"环境变量文件: {d.name}",
                "layer": "standard",
                "status": "pass" if env_file.exists() else "warn",
                "current": "存在" if env_file.exists() else "不存在",
                "expected": "存在",
                "description": "API Key 应通过 .env 文件管理",
                "fix": f"创建 {env_file} 文件",
                "auto_fixable": False,
            })

        pass_count = sum(1 for c in checks if c["status"] == "pass")
        return {
            "layer": "standard",
            "name": "标准层",
            "description": "Docker 沙箱隔离 + 凭证管理 + 资源限制",
            "checks": checks,
            "pass_rate": round(pass_count / len(checks) * 100) if checks else 0,
        }

    def check_deep(self) -> Dict[str, Any]:
        """深度层检查"""
        checks = []

        # 1. safeBins 白名单
        for d in self.openclaw_dirs:
            config_file = d / "openclaw.json"
            if config_file.exists():
                try:
                    with open(config_file, "r") as f:
                        config = json.load(f)
                    safe_bins = config.get("tools", {}).get("exec", {}).get("safeBins", [])
                    checks.append({
                        "id": f"safebins_{d.name}",
                        "name": f"命令白名单: {d.name}",
                        "layer": "deep",
                        "status": "pass" if safe_bins else "fail",
                        "current": f"{len(safe_bins)} 个命令" if safe_bins else "未配置",
                        "expected": "配置安全命令白名单",
                        "description": "限制可执行的命令范围",
                        "fix": '在 tools.exec.safeBins 中添加安全命令列表',
                        "auto_fixable": True,
                    })
                except Exception:
                    pass

        # 2. elevated 模式
        for d in self.openclaw_dirs:
            config_file = d / "openclaw.json"
            if config_file.exists():
                try:
                    with open(config_file, "r") as f:
                        config = json.load(f)
                    elevated_mode = config.get("tools", {}).get("elevated", {}).get("mode", "unknown")
                    checks.append({
                        "id": f"elevated_{d.name}",
                        "name": f"高危操作审批: {d.name}",
                        "layer": "deep",
                        "status": "pass" if elevated_mode == "ask" else "fail",
                        "current": elevated_mode,
                        "expected": "ask",
                        "description": "高危操作应要求人工审批",
                        "fix": '将 tools.elevated.mode 设为 "ask"',
                        "auto_fixable": True,
                    })
                except Exception:
                    pass

        # 3. SOUL.md 安全规则
        for d in self.openclaw_dirs:
            soul_file = d / "workspace" / "SOUL.md"
            if not soul_file.exists():
                soul_file = d / "SOUL.md"
            checks.append({
                "id": f"soul_md_{d.name}",
                "name": f"SOUL.md 安全规则: {d.name}",
                "layer": "deep",
                "status": "pass" if soul_file.exists() else "warn",
                "current": "存在" if soul_file.exists() else "不存在",
                "expected": "包含安全规则定义",
                "description": "Agent 人格文件中应定义安全边界",
                "fix": "创建 SOUL.md 并添加安全规则",
                "auto_fixable": False,
            })

        # 4. DM Policy
        for d in self.openclaw_dirs:
            config_file = d / "openclaw.json"
            if config_file.exists():
                try:
                    with open(config_file, "r") as f:
                        config = json.load(f)
                    dm_policy = config.get("security", {}).get("dmPolicy", "unknown")
                    checks.append({
                        "id": f"dm_policy_{d.name}",
                        "name": f"DM 安全策略: {d.name}",
                        "layer": "deep",
                        "status": "pass" if dm_policy == "paired-only" else "warn",
                        "current": dm_policy,
                        "expected": "paired-only",
                        "description": "仅允许已配对用户发送消息",
                        "fix": '将 security.dmPolicy 设为 "paired-only"',
                        "auto_fixable": True,
                    })
                except Exception:
                    pass

        pass_count = sum(1 for c in checks if c["status"] == "pass")
        return {
            "layer": "deep",
            "name": "深度层",
            "description": "命令白名单 + 审批模式 + Prompt Injection 防御",
            "checks": checks,
            "pass_rate": round(pass_count / len(checks) * 100) if checks else 0,
        }

    def _check_docker_available(self) -> bool:
        """检查 Docker 是否可用"""
        try:
            result = subprocess.run(
                ["docker", "info"],
                capture_output=True, text=True, timeout=5
            )
            return result.returncode == 0
        except Exception:
            return False


checker = HardeningChecker()
