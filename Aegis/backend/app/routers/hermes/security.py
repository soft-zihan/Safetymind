"""铁翼信使安全路由"""
from fastapi import APIRouter
from app.services.hermes_security import security_service

router = APIRouter()


@router.get("/overview")
async def get_security_overview():
    """7 层安全架构总览"""
    return await security_service.get_security_overview()


@router.post("/scan")
async def run_security_scan(scan_type: str = "full"):
    """触发 Tirith 安全扫描"""
    return await security_service.run_scan(scan_type)


@router.get("/audit")
async def get_audit_report():
    """安全审计报告"""
    return await security_service.get_audit_report()


@router.post("/harden")
async def run_hardening():
    """执行加固检查"""
    return await security_service.run_hardening()
