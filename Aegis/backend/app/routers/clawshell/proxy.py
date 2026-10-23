"""ClawShell 代理路由 — 双 Agent 安全代理管理"""
from fastapi import APIRouter, HTTPException
from app.services.clawshell_proxy import proxy_service

router = APIRouter()


@router.get("/status", summary="ClawShell 聚合状态")
async def get_status():
    """获取 ClawShell 服务状态及双 Agent 连接状态"""
    return await proxy_service.get_status()


@router.post("/start", summary="启动 ClawShell")
async def start_service():
    """启动 ClawShell 代理服务"""
    result = await proxy_service.start_service()
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    return result


@router.post("/stop", summary="停止 ClawShell")
async def stop_service():
    """停止 ClawShell 代理服务"""
    result = await proxy_service.stop_service()
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    return result


@router.post("/restart", summary="重启 ClawShell")
async def restart_service():
    """重启 ClawShell 代理服务"""
    result = await proxy_service.restart_service()
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    return result


@router.get("/config", summary="获取 ClawShell 配置")
async def get_config():
    """获取 ClawShell 配置（代理转发）"""
    result = await proxy_service.proxy_request("admin/config")
    if not result["success"]:
        raise HTTPException(status_code=502, detail=result["message"])
    return result.get("data", {})


@router.get("/stats", summary="获取 ClawShell 统计")
async def get_stats():
    """获取 ClawShell 监控统计（代理转发）"""
    result = await proxy_service.proxy_request("admin/stats")
    if not result["success"]:
        raise HTTPException(status_code=502, detail=result["message"])
    return result.get("data", {})
