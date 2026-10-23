import json
import httpx
from pathlib import Path
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict, Any, List
from app.services.openclaw_client import OpenClawClient
from app.services.cli_executor import CLIExecutor
from app.services.dual_agent_manager import DualAgentManager
from app.models.security import GatewayStatus, AgentStatus

router = APIRouter()
# 使用正确的 Gateway 端口（裸奔 19789，安全 20789）
# 默认检查裸奔龙虾状态
client = OpenClawClient(base_url="http://127.0.0.1:19789")
cli_executor = CLIExecutor()
dual_agent_manager = DualAgentManager()

NAKED_PORT = 19789
HARDENED_PORT = 20789
NAKED_CONFIG = Path.home() / ".openclaw-naked" / "openclaw.json"
HARDENED_CONFIG = Path.home() / ".openclaw-hardened" / "openclaw.json"


async def _check_gateway_health(port: int) -> Dict[str, Any]:
    """检查指定端口的 Gateway 是否存活"""
    try:
        async with httpx.AsyncClient(timeout=3.0) as http:
            resp = await http.get(f"http://127.0.0.1:{port}/health")
            if resp.status_code == 200:
                return resp.json()
    except Exception:
        pass
    return {}


def _read_profile_config(config_path: Path) -> Dict[str, Any]:
    """读取 openclaw profile 配置文件"""
    try:
        if config_path.exists():
            return json.loads(config_path.read_text(encoding="utf-8"))
    except Exception:
        pass
    return {}


def _get_model_from_config(config: Dict[str, Any]) -> str:
    """从配置中提取默认模型名称"""
    try:
        model = config.get("agents", {}).get("defaults", {}).get("model", "")
        # model 可能是 dict（如 {"primary": "qwen/..."}）或字符串
        if isinstance(model, dict):
            return model.get("primary", "") or next(iter(model.values()), "")
        return str(model) if model else ""
    except Exception:
        return ""


def _build_agent_status(
    name: str,
    port: int,
    config_path: Path,
    is_hardened: bool = False,
) -> Dict[str, Any]:
    """构建前端所需的 AgentStatus 响应"""
    health = {}  # 不能用 asyncio.run，这里是同步上下文
    config = _read_profile_config(config_path)
    model = _get_model_from_config(config)

    return {
        "name": name,
        "status": "running",  # 由调用方覆盖
        "port": port,
        "version": config.get("version", "2026.5.7"),
        "model": model or "openclaw",
        "uptime": "-",
        "memory_usage": "-",
        "skills_count": 0,
        "plugins_count": 0,
    }


# ─────────────────────────────────────────────────────────────
# 裸奔龙虾 (Naked Lobster) 路由
# ─────────────────────────────────────────────────────────────

@router.get("/naked/status")
async def get_naked_status():
    """获取裸奔龙虾状态"""
    health = await _check_gateway_health(NAKED_PORT)
    config = _read_profile_config(NAKED_CONFIG)
    model = _get_model_from_config(config)
    is_running = bool(health)

    return {
        "name": "裸奔龙虾 (Naked Lobster)",
        "status": "running" if is_running else "stopped",
        "port": NAKED_PORT,
        "version": config.get("version", "2026.5.7"),
        "model": model or "openclaw",
        "uptime": "-",
        "memory_usage": "-",
        "skills_count": 0,
        "plugins_count": 0,
    }


@router.get("/naked/skills")
async def get_naked_skills():
    """获取裸奔龙虾 Skills 列表"""
    return {"skills": []}


@router.get("/naked/plugins")
async def get_naked_plugins():
    """获取裸奔龙虾 Plugins 列表"""
    return {"plugins": []}


# ─────────────────────────────────────────────────────────────
# 金刚龙虾 (Hardened Lobster) 路由
# ─────────────────────────────────────────────────────────────

@router.get("/hardened/status")
async def get_hardened_status():
    """获取金刚龙虾状态"""
    health = await _check_gateway_health(HARDENED_PORT)
    config = _read_profile_config(HARDENED_CONFIG)
    model = _get_model_from_config(config)
    is_running = bool(health)

    # 读取沙箱配置
    sandbox_cfg = config.get("agents", {}).get("defaults", {}).get("sandbox", {})
    sandbox_mode = sandbox_cfg.get("mode", "unknown")

    active_defenses = []
    if is_running:
        active_defenses = [
            "输入过滤 (L2 qise)",
            "DLP 扫描 (L1 ClawShell)",
            "ClawKeeper 策略注入 (L4)",
            f"沙箱隔离 (L5 Docker, mode={sandbox_mode})",
        ]

    return {
        "name": "金刚龙虾 (Hardened Lobster)",
        "status": "running" if is_running else "stopped",
        "port": HARDENED_PORT,
        "version": config.get("version", "2026.5.7"),
        "model": model or "openclaw",
        "uptime": "-",
        "memory_usage": "-",
        "skills_count": 0,
        "plugins_count": 0,
        "security_level": "高",
        "active_defenses": active_defenses,
    }


@router.get("/hardened/skills")
async def get_hardened_skills():
    """获取金刚龙虾 Skills 列表"""
    return {"skills": []}


@router.get("/hardened/plugins")
async def get_hardened_plugins():
    """获取金刚龙虾 Plugins 列表"""
    return {"plugins": []}


@router.get("/hardened/defense")
async def get_hardened_defense():
    """获取金刚龙虾防御层配置"""
    config = _read_profile_config(HARDENED_CONFIG)
    sandbox_cfg = config.get("agents", {}).get("defaults", {}).get("sandbox", {})
    sandbox_mode = sandbox_cfg.get("mode", "unknown")
    sandbox_net = sandbox_cfg.get("docker", {}).get("network", "unknown")

    return {
        "layers": [
            {
                "id": "L1",
                "name": "ClawShell DLP 扫描",
                "enabled": True,
                "description": "响应后 DLP 扫描 + 敏感信息脱敏",
            },
            {
                "id": "L2",
                "name": "qise 安全守卫",
                "enabled": True,
                "description": "请求前 PromptGuard/CommandGuard + 响应后 CredentialGuard",
            },
            {
                "id": "L3",
                "name": "OpenClaw 加固",
                "enabled": True,
                "description": "Gateway 内置 safeBins + SOUL.md + elevated 权限控制",
            },
            {
                "id": "L4",
                "name": "ClawKeeper 策略注入",
                "enabled": True,
                "description": "Skill 安全策略注入到系统提示词",
            },
            {
                "id": "L5",
                "name": "Docker 沙箱隔离",
                "enabled": sandbox_mode == "all",
                "description": f"容器隔离 (mode={sandbox_mode}, network={sandbox_net})",
            },
        ]
    }


class MessageRequest(BaseModel):
    message: str
    session_user: str = "demo-user"


@router.get("/status", response_model=GatewayStatus)
async def get_gateway_status():
    """获取双 Gateway 状态（裸奔 + 安全）"""
    # 检查两个 Gateway 的状态
    naked_client = OpenClawClient(base_url="http://127.0.0.1:19789")
    hardened_client = OpenClawClient(base_url="http://127.0.0.1:20789")
    
    naked_status = await naked_client.get_status()
    hardened_status = await hardened_client.get_status()
    
    # 返回聚合状态
    return GatewayStatus(
        version="2026.5.7",
        uptime=0,
        agents_count=2,
        sessions_count=0,
        is_running=naked_status.get("is_running", False) or hardened_status.get("is_running", False)
    )


@router.get("/agents")
async def get_agents():
    """获取 Agent 列表"""
    # 演示模式，返回固定数据
    return {
        "agents": [
            {
                "id": "hardened-lobster",
                "name": "金刚龙虾（安全加固版）",
                "status": "active",
                "security_score": 95,
                "is_hardened": True
            },
            {
                "id": "naked-lobster",
                "name": "裸奔龙虾（未加固版）",
                "status": "active",
                "security_score": 20,
                "is_hardened": False
            }
        ]
    }


@router.post("/agents/{agent_id}/message")
async def send_message(agent_id: str, req: MessageRequest):
    """向 Agent 发送消息"""
    result = await client.send_message(agent_id, req.message, req.session_user)
    return result


@router.get("/agents/{agent_id}/sessions")
async def get_sessions(agent_id: str):
    """获取会话列表"""
    history = await client.get_session_history(agent_id)
    return {"sessions": history}


@router.get("/agents/{agent_id}/skills")
async def get_skills(agent_id: str):
    """获取 Skills 列表"""
    skills = await client.get_skills(agent_id)
    return {"skills": skills}


@router.post("/agents/setup")
async def setup_dual_agents():
    """初始化双 Agent"""
    result = await dual_agent_manager.setup_agents()
    return result


@router.get("/cron")
async def get_cron_jobs():
    """获取 Cron 任务"""
    jobs = await client.get_cron_jobs()
    return {"cron_jobs": jobs}
