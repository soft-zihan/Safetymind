from fastapi import APIRouter
from app.services.security_analyzer import SecurityAnalyzer
from app.models.security import SecurityScore

router = APIRouter()
analyzer = SecurityAnalyzer()


@router.get("/score", response_model=SecurityScore)
async def get_security_score(agent_id: str = "hardened-lobster"):
    """获取安全评分"""
    score = analyzer.calculate_score(agent_id)
    return SecurityScore(**score)


@router.get("/score/details")
async def get_score_details(agent_id: str = "hardened-lobster"):
    """获取安全评分详情"""
    return analyzer.calculate_score(agent_id)


@router.get("/compare")
async def get_comparison():
    """获取双 Agent 对比数据"""
    return analyzer.get_comparison()


@router.post("/audit")
async def trigger_audit():
    """触发安全审计 - 返回真实审计历史"""
    audit_history = analyzer.get_audit_history()
    return {
        "success": True,
        "message": f"审计完成，共 {len(audit_history)} 条测试记录",
        "audits": audit_history,
        "total_tests": len(audit_history)
    }


@router.get("/audit/history")
async def get_audit_history():
    """获取审计历史记录"""
    return analyzer.get_audit_history()


@router.post("/test-results")
async def save_test_result(scenario_id: int, result: dict):
    """保存测试结果到历史记录"""
    analyzer.add_test_result(scenario_id, result)
    return {"success": True, "message": "测试结果已保存"}
