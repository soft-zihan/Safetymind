"""ClawKeeper Hermes 适配占位 — 等待上游更新"""
from fastapi import APIRouter

router = APIRouter()


@router.get("/status")
async def clawkeeper_hermes_status():
    """ClawKeeper 对 Hermes 的适配状态"""
    return {
        "status": "pending_upstream",
        "message": "ClawKeeper Hermes 适配正在等待上游更新",
        "upstream_repo": "clawkeeper-watcher",
        "expected_branch": "v0.2-refactor 或后续版本",
        "features_planned": [
            "guard-chain 抽象（Agent 无关的守卫链）",
            "pre_tool_call / post_tool_call 拦截",
            "Hermes plugin event-bus 集成",
        ]
    }


@router.post("/install")
async def install_clawkeeper_hermes():
    """安装 ClawKeeper 到 Hermes（暂不可用）"""
    return {
        "status": "not_available",
        "message": "ClawKeeper 尚未发布 Hermes 适配器，请关注上游仓库更新"
    }
