"""ClawKeeper API路由 - 提供安全审计、加固等功能"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import asyncio
import subprocess
import json
from pathlib import Path
from datetime import datetime

router = APIRouter()


class AuditReport(BaseModel):
    """审计报告模型"""
    tool: str
    version: str
    timestamp: str
    score: int
    summary: Dict[str, Any]
    threatSummary: Dict[str, Any]
    findings: List[Dict[str, Any]]
    nextSteps: List[str]


class ProtectionStatus(BaseModel):
    """防护状态模型"""
    skill: Dict[str, Any]
    plugin: Dict[str, Any]
    audit_score: Optional[int] = None
    last_audit: Optional[str] = None


@router.get("/status", response_model=ProtectionStatus)
async def get_protection_status():
    """获取ClawKeeper防护状态"""
    # 获取最近的审计报告
    try:
        audit_result = await run_clawkeeper_audit()
        audit_score = audit_result.get("score", 0)
        last_audit = audit_result.get("timestamp", "")
    except Exception:
        audit_score = None
        last_audit = None
    
    return ProtectionStatus(
        skill={
            "enabled": True,
            "name": "lobster-safety-guide",
            "description": "金刚龙虾安全策略"
        },
        plugin={
            "enabled": True,
            "plugins": ["clawkeeper", "clawkeeper-watcher"],
            "hooks_registered": [
                "before_tool_call",
                "message_received", 
                "message_sending",
                "llm_input",
                "llm_output",
                "before_agent_reply"
            ]
        },
        audit_score=audit_score,
        last_audit=last_audit
    )


@router.get("/audit", response_model=AuditReport)
async def run_audit():
    """执行安全审计"""
    result = await run_clawkeeper_audit()
    return AuditReport(**result)


@router.post("/scan")
async def trigger_security_scan():
    """触发安全扫描(同audit)"""
    return await run_clawkeeper_audit()


@router.post("/harden")
async def run_hardening():
    """执行安全加固"""
    try:
        result = await asyncio.create_subprocess_exec(
            "npx", "openclaw", "clawkeeper", "harden",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(Path.home() / ".openclaw-hardened")
        )
        stdout, stderr = await result.communicate()
        
        return {
            "status": "completed" if result.returncode == 0 else "failed",
            "output": stdout.decode()[:1000],
            "error": stderr.decode()[:500] if stderr else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs")
async def get_security_logs(
    limit: int = 50,
    date: Optional[str] = None
):
    """获取安全日志"""
    try:
        # 获取日志目录
        workspace = Path.home() / ".openclaw-hardened" / "workspace" / "log"
        
        if not workspace.exists():
            return {"logs": [], "message": "暂无日志"}
        
        # 如果指定了日期,只读取该日期的日志
        if date:
            log_files = [workspace / f"{date}.jsonl"]
        else:
            # 获取最近的文件
            log_files = sorted(workspace.glob("*.jsonl"))[-limit:]
        
        logs = []
        for log_file in log_files:
            if log_file.exists():
                with open(log_file, 'r') as f:
                    for line in f:
                        try:
                            logs.append(json.loads(line.strip()))
                        except:
                            continue
        
        # 按时间倒序
        logs = logs[-limit:]
        logs.reverse()
        
        return {"logs": logs, "total": len(logs)}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/threats")
async def get_threats(
    severity: Optional[str] = None,
    limit: int = 20
):
    """获取威胁列表(从审计结果中提取)"""
    try:
        audit_result = await run_clawkeeper_audit()
        findings = audit_result.get("findings", [])
        
        # 按严重程度过滤
        if severity:
            findings = [f for f in findings if f.get("severity") == severity.upper()]
        
        # 提取关键信息
        threats = []
        for finding in findings[:limit]:
            threats.append({
                "id": finding.get("id"),
                "severity": finding.get("severity"),
                "title": finding.get("title"),
                "category": finding.get("category"),
                "threat": finding.get("threat"),
                "autoFixable": finding.get("autoFixable", False),
                "remediation": finding.get("remediation")
            })
        
        return {"threats": threats, "total": len(threats)}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ====== 安全策略管理 ======

CLAWKEEPER_CONFIG_PATH = Path(__file__).parent.parent.parent.parent / "ClawKeeper" / "clawkeeper-plugin" / "src" / "config" / "core-rules.json"

class PolicyConfig(BaseModel):
    """安全策略配置"""
    budgetGuard: Dict[str, Any]
    inputValidator: Dict[str, Any]
    pathGuard: Dict[str, Any]
    executionGate: Dict[str, Any]


class PolicyUpdateRequest(BaseModel):
    """策略更新请求"""
    budgetGuard: Optional[Dict[str, Any]] = None
    inputValidator: Optional[Dict[str, Any]] = None
    pathGuard: Optional[Dict[str, Any]] = None
    executionGate: Optional[Dict[str, Any]] = None


@router.get("/policy", response_model=PolicyConfig)
async def get_security_policy():
    """获取当前安全策略配置"""
    try:
        if not CLAWKEEPER_CONFIG_PATH.exists():
            raise HTTPException(status_code=404, detail="ClawKeeper 配置文件不存在")
        
        with open(CLAWKEEPER_CONFIG_PATH, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        return PolicyConfig(
            budgetGuard=config.get("budgetGuard", {}),
            inputValidator=config.get("inputValidator", {}),
            pathGuard=config.get("pathGuard", {}),
            executionGate=config.get("executionGate", {})
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"读取配置失败: {str(e)}")


@router.post("/policy")
async def update_security_policy(request: PolicyUpdateRequest):
    """更新安全策略配置"""
    try:
        if not CLAWKEEPER_CONFIG_PATH.exists():
            raise HTTPException(status_code=404, detail="ClawKeeper 配置文件不存在")
        
        # 读取现有配置
        with open(CLAWKEEPER_CONFIG_PATH, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        # 更新策略
        updates = []
        if request.budgetGuard is not None:
            config["budgetGuard"].update(request.budgetGuard)
            updates.append("budgetGuard")
        
        if request.inputValidator is not None:
            config["inputValidator"].update(request.inputValidator)
            updates.append("inputValidator")
        
        if request.pathGuard is not None:
            config["pathGuard"].update(request.pathGuard)
            updates.append("pathGuard")
        
        if request.executionGate is not None:
            config["executionGate"].update(request.executionGate)
            updates.append("executionGate")
        
        # 保存配置
        with open(CLAWKEEPER_CONFIG_PATH, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        
        return {
            "status": "success",
            "message": f"已更新策略: {', '.join(updates)}",
            "updated": updates,
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新配置失败: {str(e)}")


@router.post("/policy/reset")
async def reset_security_policy():
    """重置安全策略为默认值"""
    try:
        if not CLAWKEEPER_CONFIG_PATH.exists():
            raise HTTPException(status_code=404, detail="ClawKeeper 配置文件不存在")
        
        # 读取现有配置
        with open(CLAWKEEPER_CONFIG_PATH, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        # 重置为严格默认值
        config["budgetGuard"] = {
            "enabled": True,
            "unlimited": False,
            "windowDays": 1,
            "warnRatio": 0.8,
            "limits": {
                "input": 500000,
                "output": 250000,
                "total": 750000
            }
        }
        
        config["inputValidator"] = {
            "enabled": True,
            "failurePolicy": "fail-closed",
            "unknownToolPolicy": "block"
        }
        
        # 保存配置
        with open(CLAWKEEPER_CONFIG_PATH, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        
        return {
            "status": "success",
            "message": "已重置为严格默认策略",
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"重置配置失败: {str(e)}")


async def run_clawkeeper_audit() -> Dict[str, Any]:
    """调用ClawKeeper CLI执行审计"""
    try:
        result = await asyncio.create_subprocess_exec(
            "npx", "openclaw", "clawkeeper", "audit", "--json",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(Path.home() / ".openclaw-hardened"),
            env={**__import__('os').environ}  # 继承环境变量
        )
        stdout, stderr = await result.communicate()
        
        if result.returncode != 0:
            raise Exception(f"审计失败: {stderr.decode()}")
        
        # 解析JSON输出(跳过前面的日志行)
        output = stdout.decode()
        json_start = output.find('{')
        if json_start == -1:
            raise Exception("无法解析审计输出")
        
        json_str = output[json_start:]
        return json.loads(json_str)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"审计执行失败: {str(e)}")
