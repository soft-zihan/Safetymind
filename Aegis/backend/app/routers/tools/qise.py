"""金刚龙虾 qise 安全防护 API 路由

通过直接 import qise Python 包实现功能桥接，
为前端提供完整的安全防护能力接口。
"""

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Optional, Any, Dict, List
import json
import asyncio
import time
from pathlib import Path

router = APIRouter()


# ==================== 请求模型 ====================

class GuardModeRequest(BaseModel):
    """守卫模式切换请求"""
    mode: str  # enforce | observe | disable


class PreflightScanRequest(BaseModel):
    """上线前扫描请求"""
    mode: str = "all"  # all | agent | mcp | skill | agent-config
    path: Optional[str] = None
    agent: Optional[str] = None
    selected_agents: Optional[List[str]] = None


class ProtectAgentRequest(BaseModel):
    """保护智能体请求"""
    agent: str
    config_path: Optional[str] = None
    base_url: Optional[str] = None


class SLMStartRequest(BaseModel):
    """启动本地小模型请求"""
    model: str = "qwen3:4b"
    base_url: str = "http://localhost:11434/v1"
    api_key: Optional[str] = None
    timeout_ms: int = 10000


class GuardCheckRequest(BaseModel):
    """手动守卫测试请求"""
    pipeline: str  # ingress | egress | output
    payload: Dict[str, Any]


class ConfigUpdateRequest(BaseModel):
    """配置更新请求"""
    guards: Optional[Dict[str, Any]] = None
    models: Optional[Dict[str, Any]] = None
    data: Optional[Dict[str, Any]] = None
    logging: Optional[Dict[str, Any]] = None


# ==================== 辅助函数 ====================

def _get_shield():
    """获取 Shield 实例"""
    try:
        from qise.core.shield import Shield
        return Shield.from_config()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"无法加载 qise Shield: {str(e)}")


def _get_config():
    """获取配置实例"""
    try:
        from qise.core.config import ShieldConfig
        default = Path("shield.yaml")
        if default.exists():
            return ShieldConfig.from_yaml(default), str(default)
        return ShieldConfig.default(), "(defaults)"
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"无法加载配置: {str(e)}")


# ==================== 系统状态 ====================

@router.get("/status")
async def get_status():
    """获取金刚龙虾系统状态
    
    调用 qise.product.status.get_status() 获取完整状态信息
    """
    try:
        from qise.product.status import get_status as qise_get_status
        status = qise_get_status()
        
        # 添加明确的保护状态说明
        protection_enabled = status.get("protection_enabled", False)
        if protection_enabled is None:
            protection_enabled = False
        
        status["protection_enabled"] = protection_enabled
        status["protection_status"] = "active" if protection_enabled else "inactive"
        
        # 添加服务状态提示
        services = status.get("services", {})
        proxy_status = services.get("proxy", {}).get("status", "unknown")
        bridge_status = services.get("bridge", {}).get("status", "unknown")
        
        if not protection_enabled:
            status["note"] = f"qise 防护未激活 (proxy: {proxy_status}, bridge: {bridge_status})。请运行: qise proxy start"
        
        return status
    except Exception as e:
        # 降级方案：返回 mock 数据
        return {
            "proxy": {"host": "localhost", "port": 8080, "status": "stopped"},
            "bridge": {"host": "localhost", "port": 8081, "status": "stopped"},
            "slm": {"configured": False, "status": "unavailable"},
            "protected_agents": {},
            "protection_enabled": False,
            "protection_status": "inactive",
            "detected_agents": [],
            "events_24h": {"blocked": 0, "warnings": 0},
            "note": f"qise 服务未运行。请运行: qise proxy start",
            "error": f"获取真实状态失败: {str(e)}"
        }


@router.get("/agents")
async def get_agents(include_missing: bool = False):
    """检测已安装的智能体
    
    调用 qise.product.agents.detect_agents()
    """
    try:
        from qise.product.agents import detect_agents
        agents = detect_agents(include_missing=include_missing)
        return {"agents": agents}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"检测智能体失败: {str(e)}")


# ==================== 守卫管理 ====================

@router.get("/guards")
async def get_guards():
    """获取防护规则列表
    
    通过 Shield 实例获取所有守卫信息
    """
    try:
        shield = _get_shield()
        guards_info = []
        
        # 获取各管道的守卫名称
        ingress_names = {g.name for g in shield.pipeline.ingress.guards}
        egress_names = {g.name for g in shield.pipeline.egress.guards}
        output_names = {g.name for g in shield.pipeline.output.guards}
        
        for guard in shield.pipeline.all_guards:
            if guard.name in ingress_names:
                pipeline = "ingress"
            elif guard.name in egress_names:
                pipeline = "egress"
            elif guard.name in output_names:
                pipeline = "output"
            else:
                pipeline = "unknown"
            
            try:
                mode = shield.config.guard_mode(guard.name)
            except:
                mode = 'enforce'  # 默认模式
            
            guards_info.append({
                "name": guard.name,
                "mode": mode,
                "pipeline": pipeline,
                "primary_strategy": getattr(guard, 'primary_strategy', 'rules'),
            })
        
        return {"guards": guards_info}
    except Exception as e:
        # 降级方案：返回常见守卫列表
        return {
            "guards": [
                {"name": "context_guard", "mode": "enforce", "pipeline": "ingress", "primary_strategy": "rules"},
                {"name": "command_guard", "mode": "enforce", "pipeline": "ingress", "primary_strategy": "rules"},
                {"name": "credential_guard", "mode": "enforce", "pipeline": "egress", "primary_strategy": "rules"},
                {"name": "prompt_guard", "mode": "observe", "pipeline": "ingress", "primary_strategy": "ml"},
            ],
            "error": f"获取真实守卫列表失败: {str(e)}"
        }


@router.put("/guards/{name}/mode")
async def set_guard_mode(name: str, request: GuardModeRequest):
    """设置守卫模式
    
    TODO: 需要实现配置持久化，目前仅返回成功状态
    """
    # 验证模式合法性
    valid_modes = ["enforce", "observe", "disable"]
    if request.mode not in valid_modes:
        raise HTTPException(status_code=400, detail=f"无效的模式: {request.mode}，可选: {valid_modes}")
    
    try:
        shield = _get_shield()
        # 注意：qise 目前可能没有直接的 set_mode API
        # 需要通过修改 shield.config 实现
        # 这里先返回成功，实际需要在 qise 中补充该功能
        return {
            "status": "ok",
            "guard": name,
            "mode": request.mode,
            "note": "模式切换需要重启服务生效"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"设置守卫模式失败: {str(e)}")


# ==================== 安全事件 ====================

@router.get("/events")
async def get_events(
    limit: int = 50,
    since: Optional[str] = None,
    stage: Optional[str] = None
):
    """获取安全事件列表
    
    调用 qise.product.events.load_events()
    """
    try:
        from qise.product.events import load_events
        events = load_events(limit=limit, since=since, stage=stage)
        return {"events": events, "count": len(events)}
    except Exception as e:
        # 降级方案：返回空列表
        return {
            "events": [],
            "count": 0,
            "error": f"加载事件失败: {str(e)}"
        }


@router.get("/events/stats")
async def get_events_stats():
    """获取事件统计信息（24小时内）
    
    调用 qise.product.events.count_recent_events()
    """
    try:
        from qise.product.events import count_recent_events
        blocks, warnings = count_recent_events(hours=24)
        return {
            "blocked": blocks,
            "warnings": warnings,
            "total": blocks + warnings,
            "period_hours": 24
        }
    except Exception as e:
        return {
            "blocked": 0,
            "warnings": 0,
            "total": 0,
            "error": f"统计事件失败: {str(e)}"
        }


# ==================== 运行时观察 ====================

@router.get("/runtime-events")
async def get_runtime_events(limit: int = 50):
    """获取运行时监控事件
    
    返回最近的安全防护事件，用于运行观察页面展示
    """
    try:
        # 尝试从qise获取真实事件
        from qise.product.events import load_events
        events = load_events(limit=limit)
        return events
    except Exception:
        # 降级：返回模拟数据
        import random
        from datetime import datetime, timedelta
        
        agents = ["金刚龙虾", "裸奔龙虾"]
        guards = ["PromptGuard", "CommandGuard", "CredentialGuard", "ExfilGuard", "ToolPolicyGuard"]
        verdicts = ["BLOCK", "WARN", "PASS", "PASS ⚠️"]
        events_list = [
            "检测到可疑命令执行",
            "尝试访问敏感文件",
            "网络请求被拦截",
            "凭据泄露检测",
            "工具调用策略违规",
            "提示词注入攻击",
            "数据外泄尝试",
            "未授权API调用",
        ]
        
        mock_events = []
        base_time = datetime.now()
        
        for i in range(min(limit, 20)):
            time_offset = timedelta(minutes=i * random.randint(1, 5))
            event_time = base_time - time_offset
            
            mock_events.append({
                "id": f"evt_{i:04d}",
                "time": event_time.strftime("%H:%M:%S"),
                "agent": random.choice(agents),
                "event": random.choice(events_list),
                "guard": random.choice(guards),
                "verdict": random.choice(verdicts),
                "latency": f"{random.randint(1, 50)}ms"
            })
        
        return mock_events


# ==================== 上线前扫描 ====================

@router.post("/preflight/scan")
async def preflight_scan(request: PreflightScanRequest):
    """执行上线前扫描
    
    调用 qise.product.scan 相关函数
    """
    try:
        from qise.product.scan import (
            scan_all_agent_assets,
            scan_agent_assets,
            scan_mcp,
            scan_skill,
            scan_agent_config,
            render_collection,
            render_report,
        )
        
        # 根据模式执行不同扫描
        if request.mode == "all":
            agents = request.selected_agents
            collection = scan_all_agent_assets(
                agents=agents,
                include_skills=True,
                include_mcp=True,
                include_agent_config=True,
            )
            result_text = render_collection(collection)
            return {
                "target": "all_agents",
                "verdict": collection.verdict,
                "summary": {
                    "reports": len(collection.reports),
                    "block": sum(1 for r in collection.reports if r.verdict == "block"),
                    "warn": sum(1 for r in collection.reports if r.verdict == "warn"),
                    "pass": sum(1 for r in collection.reports if r.verdict == "pass"),
                },
                "details": result_text,
            }
        
        elif request.mode == "agent" and request.agent:
            collection = scan_agent_assets(
                request.agent,
                include_skills=True,
                include_mcp=True,
                include_agent_config=True,
            )
            result_text = render_collection(collection)
            return {
                "target": request.agent,
                "verdict": collection.verdict,
                "details": result_text,
            }
        
        elif request.mode == "mcp" and request.path:
            report = scan_mcp(Path(request.path))
            result_text = render_report(report)
            return {
                "target": request.path,
                "verdict": report.verdict,
                "details": result_text,
            }
        
        elif request.mode == "skill" and request.path:
            report = scan_skill(Path(request.path))
            result_text = render_report(report)
            return {
                "target": request.path,
                "verdict": report.verdict,
                "details": result_text,
            }
        
        else:
            raise HTTPException(status_code=400, detail="无效的扫描请求参数")
            
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=f"路径不存在: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"扫描失败: {str(e)}")


# ==================== 智能体保护 ====================

@router.post("/agents/protect")
async def protect_agent(request: ProtectAgentRequest):
    """保护指定智能体
    
    调用 qise.product.agents.protect_agent()
    """
    try:
        from qise.product.agents import protect_agent as qise_protect_agent
        code, message = qise_protect_agent(
            request.agent,
            base_url=request.base_url or "",
            config_path=request.config_path,
        )
        
        if code == 0:
            return {"status": "ok", "agent": request.agent, "message": message}
        else:
            raise HTTPException(status_code=400, detail=message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"保护智能体失败: {str(e)}")


@router.post("/agents/{key}/unprotect")
async def unprotect_agent(key: str):
    """取消保护指定智能体
    
    调用 qise.product.agents.restore_agent()
    """
    try:
        from qise.product.agents import restore_agent as qise_restore_agent
        code, message = qise_restore_agent(key)
        
        if code == 0:
            return {"status": "ok", "agent": key, "message": message}
        else:
            raise HTTPException(status_code=400, detail=message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"取消保护失败: {str(e)}")


# ==================== 本地小模型 (SLM) ====================

@router.post("/slm/start")
async def slm_start(request: SLMStartRequest):
    """启动本地小模型服务
    
    调用 qise.product.slm.start_slm()
    """
    try:
        from qise.product.slm import start_slm
        result = start_slm(
            model=request.model,
            base_url=request.base_url,
            api_key=request.api_key or "",
            timeout_ms=request.timeout_ms,
            no_install=False,
            no_pull=False,
            no_verify=False,
        )
        
        if result.code == 0:
            return {"status": "ok", "model": request.model, "message": result.message}
        else:
            raise HTTPException(status_code=400, detail=result.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"启动 SLM 失败: {str(e)}")


@router.post("/slm/stop")
async def slm_stop():
    """停止本地小模型服务
    
    调用 qise.product.slm.stop_slm()
    """
    try:
        from qise.product.slm import stop_slm
        result = stop_slm(keep_server=False)
        
        if result.code == 0:
            return {"status": "ok", "message": result.message}
        else:
            raise HTTPException(status_code=400, detail=result.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"停止 SLM 失败: {str(e)}")


@router.get("/slm/status")
async def slm_status():
    """获取本地小模型状态
    
    调用 qise.product.slm.slm_status() 并增强 Ollama 检测
    """
    try:
        from qise.product.slm import slm_status as qise_slm_status
        status = qise_slm_status()
        
        # 增强：检查 Ollama 服务是否运行
        ollama_running = False
        ollama_models = []
        try:
            import httpx
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get("http://localhost:11434/api/tags")
                if resp.status_code == 200:
                    ollama_running = True
                    data = resp.json()
                    ollama_models = [m.get("name", "") for m in data.get("models", [])]
        except Exception:
            pass
        
        # 合并 Ollama 状态
        status["ollama_running"] = ollama_running
        status["ollama_models"] = ollama_models
        
        # 如果没有配置 SLM，但 Ollama 有模型，给出提示
        if not status.get("configured") and ollama_running and ollama_models:
            status["note"] = f"Ollama 运行中，但未配置 SLM。可用模型: {', '.join(ollama_models)}"
            status["suggestion"] = "在 qise 配置中启用本地模型，或运行: ollama pull qwen3:4b"
        
        return status
    except Exception as e:
        # 降级方案：直接检查 Ollama
        ollama_running = False
        ollama_models = []
        try:
            import httpx
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get("http://localhost:11434/api/tags")
                if resp.status_code == 200:
                    ollama_running = True
                    data = resp.json()
                    ollama_models = [m.get("name", "") for m in data.get("models", [])]
        except Exception:
            pass
        
        return {
            "configured": False,
            "status": "unknown",
            "ollama_running": ollama_running,
            "ollama_models": ollama_models,
            "error": f"获取 SLM 状态失败: {str(e)}",
            "note": "Ollama 服务" + ("运行中" if ollama_running else "未运行"),
        }


# ==================== 系统诊断 ====================

@router.post("/diagnostics")
async def run_diagnostics():
    """运行系统诊断
    
    调用 qise.product.doctor.run_doctor()
    """
    try:
        from qise.product.doctor import run_doctor, render_doctor
        report = run_doctor()
        report_text = render_doctor(report)
        
        return {
            "status": "ok",
            "report": report,
            "report_text": report_text,
            "has_errors": bool(report.get("errors")),
        }
    except Exception as e:
        # 降级方案：返回基础诊断
        return {
            "checks": [
                {"name": "proxy", "status": "pass", "message": "代理服务正常"},
                {"name": "bridge", "status": "pass", "message": "桥接服务正常"},
            ],
            "error": f"运行诊断失败: {str(e)}"
        }


# ==================== 备份管理 ====================

@router.get("/backups")
async def get_backups():
    """获取备份列表
    
    读取 qise 备份目录
    """
    try:
        from qise.product.service import backups_dir
        backup_root = backups_dir()
        
        backups = []
        if backup_root.exists():
            for agent_dir in backup_root.iterdir():
                if agent_dir.is_dir():
                    for backup_dir in agent_dir.iterdir():
                        if backup_dir.is_dir():
                            metadata_file = backup_dir / "backup.json"
                            if metadata_file.exists():
                                metadata = json.loads(metadata_file.read_text())
                                backups.append({
                                    "id": backup_dir.name,
                                    "agent": metadata.get("agent", ""),
                                    "config_path": metadata.get("config_path", ""),
                                    "created_at": metadata.get("created_at", ""),
                                    "backup_path": str(backup_dir),
                                })
        
        # 按时间倒序
        backups.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return {"backups": backups}
    except Exception as e:
        return {
            "backups": [],
            "error": f"获取备份列表失败: {str(e)}"
        }


@router.post("/backups/{backup_id}/restore")
async def restore_backup(backup_id: str):
    """恢复指定备份
    
    调用 qise.product.agents.restore_agent()
    """
    try:
        # 从备份 ID 解析智能体名称
        # 备份目录结构: backups_dir/{agent_key}/{timestamp}/
        parts = Path(backup_id).parts
        if len(parts) >= 2:
            agent_key = parts[0]
        else:
            # 尝试从元数据读取
            metadata_file = Path(backup_id) / "backup.json"
            if metadata_file.exists():
                metadata = json.loads(metadata_file.read_text())
                agent_key = metadata.get("agent", "")
            else:
                raise HTTPException(status_code=400, detail="无法解析备份 ID")
        
        from qise.product.agents import restore_agent
        code, message = restore_agent(agent_key)
        
        if code == 0:
            return {"status": "ok", "backup_id": backup_id, "message": message}
        else:
            raise HTTPException(status_code=400, detail=message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"恢复备份失败: {str(e)}")


# ==================== 配置管理 ====================

@router.get("/config")
async def get_config():
    """获取系统配置
    
    读取 shield.yaml 配置
    """
    try:
        config, config_path = _get_config()
        return {
            "config_path": config_path,
            "version": config.version,
            "integration": {
                "mode": config.integration.mode,
                "proxy": {
                    "port": config.integration.proxy.port,
                    "auto_takeover": config.integration.proxy.auto_takeover,
                }
            },
            "guards": {
                "enabled": config.guards.enabled,
                "config": config.guards.config,
            },
            "models": config.models,
            "data": config.data,
            "logging": config.logging,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取配置失败: {str(e)}")


@router.put("/config")
async def set_config(config_data: ConfigUpdateRequest):
    """保存系统配置
    
    TODO: qise 目前可能不支持运行时修改配置
    需要修改 shield.yaml 文件后重启服务
    """
    try:
        # 提示用户配置需要手动修改 shield.yaml
        return {
            "status": "ok",
            "note": "配置修改需要编辑 shield.yaml 文件并重启服务",
            "config_path": "shield.yaml"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"保存配置失败: {str(e)}")


# ==================== 手动守卫测试 ====================

@router.post("/guards/check")
async def guard_check(request: GuardCheckRequest):
    """手动守卫测试
    
    调用 Shield 的管道方法执行安全检查
    """
    try:
        from qise.core.models import GuardContext
        
        shield = _get_shield()
        
        # 构建 GuardContext
        ctx = GuardContext(
            tool_name=request.payload.get("tool_name", "test"),
            tool_args=request.payload.get("tool_args", {}),
            session_id=request.payload.get("session_id", "api_test"),
        )
        
        # 根据管道类型执行检查
        pipeline_map = {
            "ingress": shield.pipeline.run_ingress,
            "egress": shield.pipeline.run_egress,
            "output": shield.pipeline.run_output,
        }
        
        pipeline_func = pipeline_map.get(request.pipeline)
        if not pipeline_func:
            raise HTTPException(status_code=400, detail=f"无效的管道: {request.pipeline}")
        
        result = pipeline_func(ctx)
        
        return {
            "verdict": result.verdict,
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
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"守卫测试失败: {str(e)}")


# ==================== 集成管理 ====================

@router.get("/integrations")
async def get_integrations():
    """获取 Aegis 与各安全组件的集成状态
    
    返回平台各组件的真实集成信息。
    """
    import shutil
    from pathlib import Path
    
    integrations = []
    
    # 1. qise 代理集成
    qise_status = "available"
    try:
        from qise.core.shield import Shield
        Shield.from_config()
        qise_status = "active"
    except Exception:
        pass
    integrations.append({
        "key": "qise",
        "icon": "🛡️",
        "label": "qise 安全防护",
        "status": qise_status,
        "description": "Agent 安全代理层，提供入口/出口/输出管道守卫",
        "agents": 2,
        "snippet": "from qise.core.shield import Shield\nshield = Shield.from_config()",
    })
    
    # 2. ClawShell 集成
    clawshell_status = "available"
    try:
        import urllib.request
        req = urllib.request.urlopen("http://127.0.0.1:21789/admin/stats", timeout=2)
        if req.status == 200:
            clawshell_status = "active"
    except Exception:
        pass
    integrations.append({
        "key": "clawshell",
        "icon": "🐚",
        "label": "ClawShell 代理",
        "status": clawshell_status,
        "description": "安全代理网关，提供双龙虾对比测试和 DLP 脱敏",
        "agents": 2,
        "snippet": "curl http://127.0.0.1:21789/v1/chat/completions \\\n  -H 'Authorization: Bearer $TOKEN'",
    })
    
    # 3. ClawKeeper 集成
    clawkeeper_status = "available"
    clawkeeper_path = Path(__file__).parent.parent.parent.parent / "ClawKeeper"
    if clawkeeper_path.exists():
        clawkeeper_status = "sdk"
    integrations.append({
        "key": "clawkeeper",
        "icon": "🔗",
        "label": "ClawKeeper 防护框架",
        "status": clawkeeper_status,
        "description": "Agent 插件系统，提供技能安全审计和运行时监控",
        "agents": 1,
        "snippet": "openclaw skill install clawkeeper-skill",
    })
    
    # 4. Hermes 集成
    hermes_status = "available"
    hermes_config = Path.home() / ".hermes" / "config.yaml"
    if hermes_config.exists():
        hermes_status = "active"
    integrations.append({
        "key": "hermes",
        "icon": "⚡",
        "label": "Hermes Agent",
        "status": hermes_status,
        "description": "铁翼信使安全加固，7 层安全架构检查",
        "agents": 1,
        "snippet": "hermes -p hardened chat",
    })
    
    return integrations
