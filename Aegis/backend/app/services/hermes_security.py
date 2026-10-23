"""Hermes 安全分析服务 — 铁翼信使 7 层安全架构检查"""
from pathlib import Path
from app.config import settings
from app.services.hermes_client import client as hermes_client


# Hermes 7 层安全架构定义
SECURITY_LAYERS = [
    {
        "name": "用户授权",
        "key": "auth",
        "description": "allowlist/DM 配对，控制谁能与 Agent 交互",
        "config_key": "allowlist",
    },
    {
        "name": "命令审批",
        "key": "approval",
        "description": "human-in-the-loop 审批回路（manual/smart/off）",
        "config_key": "approval_mode",
    },
    {
        "name": "容器隔离",
        "key": "sandbox",
        "description": "Docker/Singularity/Modal 沙箱，硬化配置",
        "config_key": "sandbox",
    },
    {
        "name": "MCP 凭据过滤",
        "key": "mcp_creds",
        "description": "环境变量隔离，MCP 子进程无法访问敏感凭据",
        "config_key": "mcp_credential_filter",
    },
    {
        "name": "上下文文件扫描",
        "key": "context_scan",
        "description": "检测项目文件中的 prompt 注入攻击",
        "config_key": "context_file_scan",
    },
    {
        "name": "跨会话隔离",
        "key": "session_iso",
        "description": "会话之间不能互相访问数据或状态",
        "config_key": "session_isolation",
    },
    {
        "name": "输入消毒",
        "key": "input_sanitize",
        "description": "终端工具后端的工作目录参数白名单验证",
        "config_key": "input_sanitization",
    },
]


class HermesSecurityService:
    """铁翼信使安全服务"""

    async def get_security_overview(self) -> dict:
        """7 层安全架构总览（检查 Hermes 配置和运行状态）"""
        config_path = settings.HERMES_CONFIG_PATH
        layers_result = []

        # 读取 Hermes 配置（如果存在）
        hermes_config = {}
        if config_path.exists():
            try:
                import yaml
                with open(config_path) as f:
                    hermes_config = yaml.safe_load(f) or {}
            except Exception:
                pass

        for layer in SECURITY_LAYERS:
            status = "unknown"
            detail = "无法检测"

            # 根据 config_key 检查具体配置项
            config_key = layer.get("config_key", "")
            if config_path.exists():
                # 检查配置文件中是否有对应的安全配置
                if config_key and config_key in hermes_config:
                    status = "pass"
                    detail = f"{layer['name']}配置已启用 ({config_key})"
                elif config_key:
                    status = "warn"
                    detail = f"配置文件存在但未找到 {layer['name']} 配置项 ({config_key})"
                else:
                    status = "pass"
                    detail = f"配置文件已就绪 ({config_path.name})"
            else:
                status = "fail"
                detail = f"Hermes 配置文件未找到，{layer['name']}未配置"

            layers_result.append({
                "name": layer["name"],
                "key": layer["key"],
                "description": layer["description"],
                "status": status,
                "detail": detail,
            })

        # 计算综合评分
        pass_count = sum(1 for l in layers_result if l["status"] == "pass")
        total = len(layers_result)
        score = int((pass_count / total) * 100) if total > 0 else 0

        return {
            "score": score,
            "layers": layers_result,
            "total_layers": total,
            "pass_count": pass_count,
            "warn_count": sum(1 for l in layers_result if l["status"] == "warn"),
            "fail_count": sum(1 for l in layers_result if l["status"] == "fail"),
            "unknown_count": sum(1 for l in layers_result if l["status"] == "unknown"),
        }

    async def run_scan(self, scan_type: str = "full") -> dict:
        """执行安全扫描（基于 Hermes 7 层架构 + 基础设施检查）"""
        import time
        import httpx
        start = time.time()
        findings = []

        # 1. Hermes 7 层配置检查
        overview = await self.get_security_overview()
        for layer in overview.get("layers", []):
            if layer["status"] == "fail":
                findings.append({
                    "severity": "high",
                    "category": "Hermes 安全层",
                    "title": f"{layer['name']}未配置",
                    "detail": layer["detail"],
                    "recommendation": f"请检查 Hermes 配置中的 {layer.get('key', '')} 项",
                })
            elif layer["status"] == "warn":
                findings.append({
                    "severity": "medium",
                    "category": "Hermes 安全层",
                    "title": f"{layer['name']}配置不完整",
                    "detail": layer["detail"],
                    "recommendation": f"建议完善 {layer.get('key', '')} 配置",
                })

        # 2. Gateway 状态检查
        async with httpx.AsyncClient(timeout=3.0) as client:
            for name, port in [("裸奔龙虾 Gateway", 19789), ("安全龙虾 Gateway", 20789)]:
                try:
                    resp = await client.get(f"http://localhost:{port}/health")
                    if resp.status_code == 200:
                        findings.append({
                            "severity": "info",
                            "category": "Gateway",
                            "title": f"{name}运行中",
                            "detail": f"端口 {port} 响应正常",
                            "recommendation": "",
                        })
                    else:
                        findings.append({
                            "severity": "high",
                            "category": "Gateway",
                            "title": f"{name}异常",
                            "detail": f"HTTP {resp.status_code}",
                            "recommendation": "检查 Gateway 进程状态",
                        })
                except Exception as e:
                    findings.append({
                        "severity": "high",
                        "category": "Gateway",
                        "title": f"{name}未响应",
                        "detail": f"端口 {port} 连接失败: {e}",
                        "recommendation": f"运行 openclaw --profile {'naked' if port == 19789 else 'hardened'} gateway start",
                    })

        # 3. ClawShell 检查
        async with httpx.AsyncClient(timeout=3.0) as client:
            try:
                resp = await client.get("http://localhost:21789/admin/stats")
                if resp.status_code == 200:
                    findings.append({
                        "severity": "info",
                        "category": "ClawShell",
                        "title": "ClawShell 代理服务运行中",
                        "detail": "端口 21789 响应正常",
                        "recommendation": "",
                    })
                else:
                    findings.append({
                        "severity": "medium",
                        "category": "ClawShell",
                        "title": "ClawShell 响应异常",
                        "detail": f"HTTP {resp.status_code}",
                        "recommendation": "检查 ClawShell 配置",
                    })
            except Exception:
                findings.append({
                    "severity": "medium",
                    "category": "ClawShell",
                    "title": "ClawShell 未运行",
                    "detail": "端口 21789 连接失败",
                    "recommendation": "运行 clawshell start",
                })

        # 4. Docker 沙箱检查
        import subprocess
        try:
            result = subprocess.run(["docker", "info"], capture_output=True, timeout=5)
            if result.returncode == 0:
                findings.append({
                    "severity": "info",
                    "category": "沙箱隔离",
                    "title": "Docker 沙箱环境就绪",
                    "detail": "Docker 守护进程运行中",
                    "recommendation": "",
                })
            else:
                findings.append({
                    "severity": "medium",
                    "category": "沙箱隔离",
                    "title": "Docker 未运行",
                    "detail": "沙箱隔离功能不可用",
                    "recommendation": "启动 Docker Desktop",
                })
        except Exception:
            findings.append({
                "severity": "medium",
                "category": "沙箱隔离",
                "title": "Docker 未安装或未运行",
                "detail": "无法检测 Docker 状态",
                "recommendation": "安装并启动 Docker Desktop",
            })

        # 5. 后端服务检查
        async with httpx.AsyncClient(timeout=3.0) as client:
            try:
                resp = await client.get("http://localhost:8000/health")
                if resp.status_code == 200:
                    findings.append({
                        "severity": "info",
                        "category": "后端服务",
                        "title": "Aegis 后端运行中",
                        "detail": "端口 8000 响应正常",
                        "recommendation": "",
                    })
            except Exception:
                pass  # 后端自己检查自己，通常不会失败

        duration = round(time.time() - start, 2)
        high_count = sum(1 for f in findings if f["severity"] == "high")
        medium_count = sum(1 for f in findings if f["severity"] == "medium")
        
        status = "completed"
        message = f"扫描完成，发现 {high_count} 个高危问题，{medium_count} 个中危问题"

        return {
            "status": status,
            "scan_type": scan_type,
            "message": message,
            "findings": findings,
            "scanned_files": overview.get("total_layers", 7),
            "duration_seconds": duration,
            "summary": {
                "high": high_count,
                "medium": medium_count,
                "low": sum(1 for f in findings if f["severity"] == "low"),
                "info": sum(1 for f in findings if f["severity"] == "info"),
            },
        }

    async def get_audit_report(self) -> dict:
        """生成安全审计报告"""
        overview = await self.get_security_overview()
        plugins = await hermes_client.get_plugins()

        issues = []

        # 从安全层检查结果生成问题
        for layer in overview.get("layers", []):
            if layer["status"] in ("fail", "warn", "unknown"):
                issues.append({
                    "severity": "high" if layer["status"] == "fail" else "medium",
                    "layer": layer["name"],
                    "description": layer["detail"],
                    "recommendation": f"请检查 {layer['name']} 配置",
                })

        # 插件安全评级
        for plugin in plugins:
            if plugin.get("safety_rating", 5) < 3:
                issues.append({
                    "severity": "medium",
                    "layer": "插件安全",
                    "description": f"插件 {plugin['name']} 安全评级较低",
                    "recommendation": f"审查插件 {plugin['name']} 的权限和环境变量访问",
                })

        return {
            "score": overview["score"],
            "total_issues": len(issues),
            "high_issues": sum(1 for i in issues if i["severity"] == "high"),
            "medium_issues": sum(1 for i in issues if i["severity"] == "medium"),
            "low_issues": sum(1 for i in issues if i["severity"] == "low"),
            "issues": issues,
            "plugins_count": len(plugins),
        }

    async def run_hardening(self) -> dict:
        """执行加固检查"""
        overview = await self.get_security_overview()
        results = []

        for layer in overview.get("layers", []):
            results.append({
                "name": layer["name"],
                "key": layer["key"],
                "before_status": layer["status"],
                "action": "check" if layer["status"] == "pass" else "needs_fix",
                "detail": layer["detail"],
            })

        return {
            "status": "completed",
            "results": results,
            "fixed_count": 0,
            "needs_attention": sum(1 for r in results if r["action"] == "needs_fix"),
            "message": "加固检查完成，请根据结果手动配置对应安全层",
        }


# 全局实例
security_service = HermesSecurityService()
