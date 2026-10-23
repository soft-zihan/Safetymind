"""铁翼信使 Agent 管理路由"""
from fastapi import APIRouter
from app.services.hermes_client import client

router = APIRouter()


@router.get("/status")
async def get_hermes_status():
    """Hermes agent 运行状态"""
    return await client.get_status()


@router.get("/agents")
async def get_hermes_agents():
    """Hermes Agent 列表"""
    return await client.get_agents()


@router.get("/plugins")
async def get_hermes_plugins():
    """已安装插件列表（含安全评级）"""
    return await client.get_plugins()


@router.get("/tirith")
async def get_tirith_status():
    """Tirith 扫描器状态与最近结果"""
    return await client.get_tirith_status()
