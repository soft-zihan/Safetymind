from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class RiskLevel(str, Enum):
    """风险等级"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class AgentStatus(BaseModel):
    """Agent 状态"""
    id: str
    name: str
    workspace: str
    status: str = "unknown"
    security_score: int = 0
    is_hardened: bool = False


class GatewayStatus(BaseModel):
    """Gateway 状态"""
    version: str = "unknown"
    uptime: int = 0
    agents_count: int = 0
    sessions_count: int = 0
    is_running: bool = False


class SecurityScore(BaseModel):
    """安全评分"""
    total_score: int = 0
    categories: Dict[str, Dict[str, Any]] = {}
    recommendations: List[str] = []
    tested_scenarios: Optional[int] = 0
    passed_scenarios: Optional[int] = 0
    failed_scenarios: Optional[int] = 0


class DemoScenario(BaseModel):
    """演示场景"""
    id: int
    name: str
    description: str
    config_path: str
    risk_level: RiskLevel
    prompt: str
    expected_naked: str
    expected_hardened: str
    detection_rules: List[str] = []
    is_visual: bool = True


class TestResult(BaseModel):
    """测试结果"""
    scenario_id: int
    naked_response: str = ""
    hardened_response: str = ""
    naked_result: str = "unknown"  # pass/fail
    hardened_result: str = "unknown"  # pass/fail
    leak_detected: bool = False
    report: Dict[str, Any] = {}


class AuditReport(BaseModel):
    """审计报告"""
    id: str
    timestamp: datetime
    score: int
    issues: List[Dict[str, Any]] = []
    recommendations: List[str] = []
