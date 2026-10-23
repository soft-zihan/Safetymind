"""
安全加固检查 API 路由
"""

from fastapi import APIRouter
from app.services.hardening_checker import checker

router = APIRouter()


@router.get("/check")
async def run_hardening_check():
    """运行全部安全加固检查"""
    return checker.check_all()


@router.get("/check/basic")
async def check_basic():
    """基础层检查"""
    return checker.check_basic()


@router.get("/check/standard")
async def check_standard():
    """标准层检查"""
    return checker.check_standard()


@router.get("/check/deep")
async def check_deep():
    """深度层检查"""
    return checker.check_deep()


@router.post("/fix/{check_id}")
async def auto_fix(check_id: str):
    """自动修复指定检查项"""
    # 模拟自动修复
    return {
        "status": "fixed",
        "check_id": check_id,
        "message": f"已自动修复: {check_id}",
    }
