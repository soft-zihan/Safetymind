"""AgentGuard 零信任安全框架 — API 路由（代理到 AgentGuard 控制服务器）"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from typing import Any, Optional

from app.services import agentguard_client

router = APIRouter()


@router.get("/status")
async def get_status():
    """AgentGuard 控制服务器健康状态"""
    data = await agentguard_client.get_health()
    if data is None:
        raise HTTPException(status_code=502, detail="无法连接 AgentGuard 控制服务器")
    return data


@router.get("/stats")
async def get_stats():
    """全局统计（Agent 数、规则数、Session 数等）— 聚合多个 AgentGuard 端点"""
    stats = await agentguard_client.get_stats()
    if stats is None:
        raise HTTPException(status_code=502, detail="无法获取 AgentGuard 统计数据")

    # 聚合前端所需字段：agents / rules / sessions
    health = await agentguard_client.get_health() or {}
    tools = await agentguard_client.list_tools() or []
    traffic = await agentguard_client.get_traffic(n=1000) or []

    agent_ids = {t.get("owner_agent_id") for t in tools if t.get("owner_agent_id")}
    agent_ids |= {e.get("agent") for e in traffic if e.get("agent")}

    sessions: list = []
    try:
        data = await agentguard_client._get("/v1/backend/sessions")
        sessions = (data or {}).get("sessions", []) if isinstance(data, dict) else []
    except Exception:
        pass

    return {
        **stats,
        "agents": len(agent_ids),
        "agent_ids": sorted(agent_ids),
        "rules": health.get("rules", 0),
        "rule_version": health.get("rule_version", ""),
        "sessions": len(sessions),
    }


@router.get("/rules")
async def get_rules():
    """访问控制规则列表"""
    data = await agentguard_client.list_rules()
    if data is None:
        raise HTTPException(status_code=502, detail="无法获取 AgentGuard 规则列表")
    return data


@router.get("/traffic")
async def get_traffic(
    n: int = Query(30, description="返回条数"),
    action: Optional[str] = Query(None, description="按 action 过滤"),
    tool: Optional[str] = Query(None, description="按 tool 过滤"),
):
    """最近流量记录"""
    data = await agentguard_client.get_traffic(n=n, action=action, tool=tool)
    if data is None:
        raise HTTPException(status_code=502, detail="无法获取 AgentGuard 流量记录")
    return data


@router.get("/audit")
async def get_audit(n: int = Query(20, description="返回条数")):
    """最近审计事件"""
    data = await agentguard_client.get_audit_recent(n=n)
    if data is None:
        raise HTTPException(status_code=502, detail="无法获取 AgentGuard 审计事件")
    return data


@router.get("/approvals")
async def get_approvals():
    """待审批列表"""
    data = await agentguard_client.get_approvals()
    if data is None:
        raise HTTPException(status_code=502, detail="无法获取 AgentGuard 审批列表")
    return data


@router.get("/tools")
async def get_tools():
    """已注册工具列表"""
    data = await agentguard_client.list_tools()
    if data is None:
        raise HTTPException(status_code=502, detail="无法获取 AgentGuard 工具列表")
    return data


@router.get("/skills")
async def get_skills():
    """已扫描 Skill 列表"""
    data = await agentguard_client.list_skills()
    if data is None:
        raise HTTPException(status_code=502, detail="无法获取 AgentGuard Skill 列表")
    return data


@router.get("/mcps")
async def get_mcps():
    """已扫描 MCP 列表"""
    data = await agentguard_client.list_mcps()
    if data is None:
        raise HTTPException(status_code=502, detail="无法获取 AgentGuard MCP 列表")
    return data


@router.get("/agents/{agent_id}/stats")
async def get_agent_stats(agent_id: str):
    """单个 Agent 运行时统计"""
    data = await agentguard_client.get_agent_stats(agent_id)
    if data is None:
        raise HTTPException(status_code=502, detail=f"无法获取 Agent '{agent_id}' 的统计数据")
    return data


@router.get("/agents/{agent_id}/traffic")
async def get_agent_traffic(
    agent_id: str,
    n: int = Query(30, description="返回条数"),
):
    """单个 Agent 流量"""
    data = await agentguard_client.get_agent_traffic(agent_id, n=n)
    if data is None:
        raise HTTPException(status_code=502, detail=f"无法获取 Agent '{agent_id}' 的流量记录")
    return data


@router.get("/agents")
async def list_agents():
    """受管 Agent 列表（聚合 tools + traffic 中的 agent_id）"""
    tools = await agentguard_client.list_tools() or []
    traffic = await agentguard_client.get_traffic(n=1000) or []

    agent_ids = {t.get("owner_agent_id") for t in tools if t.get("owner_agent_id")}
    agent_ids |= {e.get("agent") for e in traffic if e.get("agent")}
    return {"agents": sorted(agent_ids)}


@router.post("/demo/run")
async def run_demo():
    """一键演示：模拟安全龙虾工具调用，展示 AgentGuard 实时 allow/deny 决策"""
    result = await agentguard_client.run_demo()
    if not result.get("ok"):
        raise HTTPException(status_code=502, detail=result.get("error", "演示执行失败"))
    return result


@router.post("/inventory/sync")
async def sync_inventory():
    """扫描 OpenClaw-hardened 真实配置并同步到 AgentGuard"""
    result = await agentguard_client.sync_openclaw_inventory()
    if not result.get("ok"):
        raise HTTPException(status_code=502, detail=result.get("error", "同步失败"))
    return result
