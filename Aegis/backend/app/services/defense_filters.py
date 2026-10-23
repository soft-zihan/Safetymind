"""
defense_filters.py — L1 ClawShell DLP + L2 qise SDK 守卫（应用层拦截）

直接在 Aegis 后端进程内执行规则检查，无需启动独立服务。
- L1: ClawShell DLP 正则扫描（SSN、信用卡、手机号、邮箱等）
- L2: qise SDK 守卫（PromptGuard、CommandGuard、CredentialGuard 等 15 个守卫）
"""

import re
import sys
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field

logger = logging.getLogger("aegis.defense_filters")

# qise 源码路径加入 sys.path
QISE_SRC = Path(__file__).resolve().parents[3] / "qise" / "src"
if str(QISE_SRC) not in sys.path:
    sys.path.insert(0, str(QISE_SRC))

# ============================================================================
# L2: qise SDK 守卫
# ============================================================================

_qise_shield = None
_qise_adapter = None

def _get_qise_shield():
    """懒加载 qise Shield"""
    global _qise_shield
    if _qise_shield is not None:
        return _qise_shield
    
    try:
        from qise.core.shield import Shield
        _qise_shield = Shield.from_config()
        logger.info("qise Shield 初始化成功，加载 %d 个守卫", len(list(_qise_shield.pipeline.all_guards)))
        return _qise_shield
    except Exception as e:
        logger.warning("qise Shield 初始化失败: %s", e)
        return None

def _get_qise_adapter():
    """懒加载 qise OpenClaw Adapter"""
    global _qise_adapter
    if _qise_adapter is not None:
        return _qise_adapter
    
    shield = _get_qise_shield()
    if shield is None:
        return None
    
    try:
        from qise.adapters.openai_agents import QiseOpenAIAgentsGuardrails
        # 使用 OpenAI Agents adapter 作为 OpenClaw 的代理（兼容 OpenAI API）
        _qise_adapter = QiseOpenAIAgentsGuardrails(shield, session_id="openclaw-aegis")
        logger.info("qise OpenClaw Adapter 初始化成功")
        return _qise_adapter
    except Exception as e:
        logger.warning("qise Adapter 初始化失败: %s", e)
        return None


def qise_check_ingress(message: str) -> Optional[Dict[str, Any]]:
    """使用 qise SDK 执行入口检查（请求发出前）
    
    Returns:
        dict with keys: blocked, guard_name, reason, confidence
        or None if no qise or not blocked
    """
    adapter = _get_qise_adapter()
    if adapter is None:
        logger.debug("qise adapter 不可用，跳过入口检查")
        return None
    
    try:
        result = adapter.check_user_input(
            content=message,
            trust_boundary="user_input",
            session_id="openclaw-aegis",
        )
        
        if result.should_block:
            blocked_by = result.blocked_by or "unknown"
            warnings = "; ".join(result.warnings) if result.warnings else ""
            return {
                "blocked": True,
                "guard_name": blocked_by,
                "reason": f"qise {blocked_by} 拦截: {warnings}" if warnings else f"qise {blocked_by} 拦截",
                "confidence": 0.9,
                "layer": "L2_qise_sdk",
            }
        
        return None
    except Exception as e:
        logger.error("qise 入口检查失败: %s", e)
        return None


def qise_check_egress(response_text: str) -> Optional[Dict[str, Any]]:
    """使用 qise SDK 执行出口检查（响应返回后）
    
    Returns:
        dict with keys: blocked, guard_name, reason, redacted, cleaned_text
        or None if no qise
    """
    adapter = _get_qise_adapter()
    if adapter is None:
        logger.debug("qise adapter 不可用，跳过出口检查")
        return None
    
    try:
        # 检查输出中的凭据/PII 泄露
        result = adapter.check_output(
            text=response_text,
            session_id="openclaw-aegis",
        )
        
        if result.should_block:
            blocked_by = result.blocked_by or "unknown"
            warnings = "; ".join(result.warnings) if result.warnings else ""
            return {
                "blocked": True,
                "guard_name": blocked_by,
                "reason": f"qise {blocked_by} 拦截: {warnings}" if warnings else f"qise {blocked_by} 拦截",
                "redacted": False,
                "layer": "L2_qise_sdk",
            }
        
        # 未拦截，但可能有警告
        return {
            "blocked": False,
            "guard_name": None,
            "reason": None,
            "redacted": False,
            "warnings": result.warnings if result.warnings else [],
        }
    except Exception as e:
        logger.error("qise 出口检查失败: %s", e)
        return None


# ============================================================================
# L1: ClawShell DLP 数据防泄漏扫描
# ============================================================================

@dataclass
class DLPResult:
    detected: bool = False
    redacted_text: str = ""
    matches: List[Dict[str, Any]] = field(default_factory=list)


# ClawShell DLP 正则规则（来自 clawshell.dev.toml）
_DLP_PATTERNS: List[tuple] = [
    # 社会安全号码 (US SSN)
    (re.compile(r'\b\d{3}-\d{2}-\d{4}\b'), "ssn", "社会安全号码"),
    # 邮箱地址
    (re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b'), "email", "邮箱地址"),
    # Visa 信用卡
    (re.compile(r'\b4[0-9]{12}(?:[0-9]{3})?\b'), "visa_card", "Visa 信用卡"),
    # 中国大陆手机号
    (re.compile(r'\b1[3-9]\d{9}\b'), "china_mobile", "中国大陆手机号"),
    # 支付宝密码（项目特有敏感数据）
    (re.compile(r'\b142536\b'), "alipay_password", "支付宝密码"),
    # 身份证号（18位）
    (re.compile(r'\b\d{17}[\dXx]\b'), "id_card", "身份证号"),
    # RSA/EC 私钥
    (re.compile(r'-----BEGIN\s+(RSA|EC|DSA|OPENSSH)\s+PRIVATE\s+KEY-----'), "private_key", "私钥"),
    # 通用 API Key 格式
    (re.compile(r'(?:sk-|AKIA|ghp_|xox[baprs]-|sk_live_)[A-Za-z0-9\-_]{16,}'), "api_key", "API Key"),
]


def dlp_scan(text: str) -> DLPResult:
    """扫描文本中的敏感数据，返回脱敏结果"""
    result = DLPResult(redacted_text=text)
    
    for pattern, pattern_name, label in _DLP_PATTERNS:
        matches = pattern.finditer(text)
        for match in matches:
            result.detected = True
            result.matches.append({
                "pattern": pattern_name,
                "label": label,
                "value": match.group()[:4] + "***" if len(match.group()) > 4 else "***",
                "start": match.start(),
                "end": match.end(),
            })
    
    # 执行脱敏替换
    if result.detected:
        redacted = text
        for pattern, pattern_name, label in _DLP_PATTERNS:
            redacted = pattern.sub(f"[REDACTED:{label}]", redacted)
        result.redacted_text = redacted
    
    return result


# ============================================================================
# L2: qise 守卫规则检查（轻量级规则引擎）
# ============================================================================

@dataclass
class GuardCheckResult:
    blocked: bool = False
    guard_name: str = ""
    reason: str = ""
    confidence: float = 0.0
    layer: str = "L2_qise"


# --- PromptGuard: 提示注入检测 ---
_PROMPT_INJECTION_PATTERNS: List[tuple] = [
    # 直接指令覆盖
    (re.compile(r"ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|rules|directives)", re.I), "指令覆盖"),
    (re.compile(r"disregard\s+(all\s+)?(previous|prior|above)\s+(instructions|rules)", re.I), "指令覆盖"),
    (re.compile(r"forget\s+(all\s+)?(previous|prior|above)\s+(instructions|rules)", re.I), "指令覆盖"),
    # 身份覆盖
    (re.compile(r"you\s+are\s+now\s+\w+", re.I), "身份覆盖"),
    (re.compile(r"you\s+are\s+(?:DAN|jailbroken|unrestricted|unfiltered)", re.I), "身份覆盖"),
    # 系统消息注入
    (re.compile(r"SYSTEM\s*[:=]\s*(?:new\s+)?instructions?\s+activated", re.I), "系统消息注入"),
    (re.compile(r"SYSTEM\s*[:=]\s*(?:update|override|new)", re.I), "系统消息注入"),
    # 绕过安全
    (re.compile(r"bypass\s+(?:all\s+)?(?:security|safety|guard|check)", re.I), "安全绕过指令"),
    (re.compile(r"disable\s+(?:all\s+)?(?:security|safety|guard|scanning|monitoring)", re.I), "安全禁用指令"),
    # 模式切换
    (re.compile(r"(?:switch|change)\s+to\s+(?:unrestricted|unfiltered|developer)\s+mode", re.I), "模式切换"),
    (re.compile(r"activate\s+(?:developer|unrestricted)\s+mode", re.I), "模式切换"),
    # 忽略安全规则
    (re.compile(r"(?:ignore|skip|disable)\s+(?:all\s+)?(?:your\s+)?(?:safety|security)\s+(?:rules|guidelines|restrictions)", re.I), "忽略安全规则"),
    (re.compile(r"no\s+(?:safety|security)\s+(?:rules|restrictions|limits)", re.I), "无安全限制"),
]


def check_prompt_injection(text: str) -> GuardCheckResult:
    """检查输入是否包含提示注入"""
    for pattern, desc in _PROMPT_INJECTION_PATTERNS:
        if pattern.search(text):
            return GuardCheckResult(
                blocked=True,
                guard_name="PromptGuard",
                reason=f"检测到提示注入: {desc}",
                confidence=0.9,
            )
    return GuardCheckResult()


# --- CommandGuard: 危险命令检测 ---
_COMMAND_CRITICAL_PATTERNS: List[tuple] = [
    (re.compile(r"rm\s+-rf\s+/", re.I), "递归强制删除根目录"),
    (re.compile(r"curl\s+.*\|\s*(ba)?sh", re.I), "curl 管道到 shell"),
    (re.compile(r"wget\s+.*\|\s*(ba)?sh", re.I), "wget 管道到 shell"),
    (re.compile(r"mkfs\.", re.I), "格式化文件系统"),
    (re.compile(r"dd\s+if=.*of=/dev/", re.I), "写入原始设备"),
    (re.compile(r">\s*/etc/", re.I), "写入 /etc 目录"),
    (re.compile(r"chmod\s+777", re.I), "设置全局可写权限"),
    (re.compile(r":\(\)\{.*:\(&\)\}", re.I), "Fork 炸弹"),
]

_COMMAND_HIGH_PATTERNS: List[tuple] = [
    (re.compile(r"\|\s*sudo", re.I), "管道到 sudo"),
    (re.compile(r"\|\s*(ba)?sh\b", re.I), "管道到 shell"),
    (re.compile(r"sudo\s+rm\b", re.I), "sudo 删除"),
    (re.compile(r"sudo\s+chmod\b", re.I), "sudo 修改权限"),
]


def check_command_safety(text: str) -> GuardCheckResult:
    """检查文本中是否包含危险命令"""
    for pattern, desc in _COMMAND_CRITICAL_PATTERNS:
        if pattern.search(text):
            return GuardCheckResult(
                blocked=True,
                guard_name="CommandGuard",
                reason=f"检测到危险命令: {desc}",
                confidence=0.95,
            )
    for pattern, desc in _COMMAND_HIGH_PATTERNS:
        if pattern.search(text):
            return GuardCheckResult(
                blocked=True,
                guard_name="CommandGuard",
                reason=f"检测到高危命令: {desc}",
                confidence=0.85,
            )
    return GuardCheckResult()


# --- CredentialGuard: 凭据泄露检测（输出检查） ---
_CREDENTIAL_PATTERNS: List[tuple] = [
    (re.compile(r"AKIA[0-9A-Z]{16}"), "AWS Access Key ID", 0.95),
    (re.compile(r"ghp_[A-Za-z0-9_]{36,}"), "GitHub PAT", 0.95),
    (re.compile(r"sk_live_[0-9a-zA-Z]{24,}"), "Stripe Live Key", 0.95),
    (re.compile(r"sk-ant-[a-zA-Z0-9\-_]{20,}"), "Anthropic API Key", 0.95),
    (re.compile(r"-----BEGIN\s+(RSA|EC|DSA|OPENSSH)\s+PRIVATE\s+KEY-----"), "私钥", 0.98),
    (re.compile(r"(?i)api[_-]?key\s*[:=]\s*['\"]?[A-Za-z0-9\-_]{20,}['\"]?"), "API Key", 0.7),
    (re.compile(r"(?i)password\s*[:=]\s*['\"][^\s'\"]{8,}['\"]"), "密码", 0.65),
    (re.compile(r"eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+"), "JWT Token", 0.8),
]


def check_credential_leak(text: str) -> GuardCheckResult:
    """检查输出中是否包含凭据"""
    for pattern, label, confidence in _CREDENTIAL_PATTERNS:
        if pattern.search(text):
            return GuardCheckResult(
                blocked=True,
                guard_name="CredentialGuard",
                reason=f"检测到凭据泄露: {label}",
                confidence=confidence,
            )
    return GuardCheckResult()


# --- ExfilGuard: 数据外泄检测 ---
_EXFIL_PATTERNS: List[tuple] = [
    (re.compile(r"curl\s+.*\s+(-d|--data)\s+.*(?:password|secret|key|token)", re.I), "curl 外泄敏感数据"),
    (re.compile(r"wget\s+.*--post-data\s+.*(?:password|secret|key|token)", re.I), "wget 外泄敏感数据"),
    (re.compile(r"(?:send|upload|post|transmit)\s+.*(?:password|secret|key|token)\s+.*(?:to|to\s+url|externally)", re.I), "外泄指令"),
    (re.compile(r"curl\s+.*evil\.com", re.I), "恶意域名请求"),
    (re.compile(r"curl\s+.*\s+-d\s+@/", re.I), "curl 发送文件内容"),
]


def check_exfiltration(text: str) -> GuardCheckResult:
    """检查是否存在数据外泄行为"""
    for pattern, desc in _EXFIL_PATTERNS:
        if pattern.search(text):
            return GuardCheckResult(
                blocked=True,
                guard_name="ExfilGuard",
                reason=f"检测到数据外泄: {desc}",
                confidence=0.85,
            )
    return GuardCheckResult()


# --- FilesystemGuard: 文件系统访问检测 ---
_FS_PATTERNS: List[tuple] = [
    (re.compile(r"(?:cat|read|open|ls|find)\s+.*(?:/etc/passwd|/etc/shadow|/var/root|~/.ssh)", re.I), "访问敏感文件"),
    (re.compile(r"(?:write|echo|cat)\s+.*>\s*/etc/", re.I), "写入系统目录"),
    (re.compile(r"(?:read|cat|find)\s+.*(?:\.ssh/id_rsa|\.ssh/id_ed25519)", re.I), "读取 SSH 私钥"),
]


def check_filesystem_access(text: str) -> GuardCheckResult:
    """检查是否存在危险文件系统访问"""
    for pattern, desc in _FS_PATTERNS:
        if pattern.search(text):
            return GuardCheckResult(
                blocked=True,
                guard_name="FilesystemGuard",
                reason=f"检测到危险文件访问: {desc}",
                confidence=0.85,
            )
    return GuardCheckResult()


# --- NetworkGuard: 网络请求检测 ---
_NETWORK_PATTERNS: List[tuple] = [
    (re.compile(r"(?:curl|wget|ssh|scp|nc)\s+.*(?:evil|malicious|attacker|exfil)", re.I), "恶意网络请求"),
    (re.compile(r"ssh\s+\w+@\d+\.\d+\.\d+\.\d+", re.I), "SSH 到内网机器"),
]


def check_network_safety(text: str) -> GuardCheckResult:
    """检查是否存在危险网络请求"""
    for pattern, desc in _NETWORK_PATTERNS:
        if pattern.search(text):
            return GuardCheckResult(
                blocked=True,
                guard_name="NetworkGuard",
                reason=f"检测到危险网络请求: {desc}",
                confidence=0.8,
            )
    return GuardCheckResult()


# ============================================================================
# 统一入口：DefenseFilterService
# ============================================================================

class DefenseFilterService:
    """统一防御过滤服务，管理 L1/L2 层开关
    
    L2 优先使用 qise SDK，如果 SDK 不可用则回退到模拟守卫
    """
    
    def __init__(self):
        # 默认启用状态（金刚龙虾全部启用，裸奔龙虾全部关闭）
        self.dlp_enabled: bool = True
        self.qise_enabled: bool = True
        self.qise_sdk_available: bool = _get_qise_shield() is not None
    
    def check_ingress(self, message: str) -> Optional[Any]:
        """入口检查（请求发出前）— L2 qise 守卫"""
        if not self.qise_enabled:
            return None
        
        # 优先使用 qise SDK
        if self.qise_sdk_available:
            result = qise_check_ingress(message)
            if result:
                # 转换为 GuardCheckResult 格式（兼容 openclaw_client.py）
                from dataclasses import dataclass
                @dataclass
                class GuardCheckResult:
                    blocked: bool = False
                    guard_name: str = ""
                    reason: str = ""
                    confidence: float = 0.0
                    layer: str = "L2_qise"
                
                return GuardCheckResult(
                    blocked=result["blocked"],
                    guard_name=result["guard_name"],
                    reason=result["reason"],
                    confidence=result.get("confidence", 0.9),
                    layer=result.get("layer", "L2_qise_sdk"),
                )
            return None
        
        # 回退到模拟守卫（向后兼容）
        return self._fallback_check_ingress(message)
    
    def _fallback_check_ingress(self, message: str) -> Optional[Any]:
        """模拟守卫回退（仅当 qise SDK 不可用时使用）"""
        from dataclasses import dataclass
        @dataclass
        class GuardCheckResult:
            blocked: bool = False
            guard_name: str = ""
            reason: str = ""
            confidence: float = 0.0
            layer: str = "L2_qise_fallback"
        
        # 按优先级检查
        checks = [
            check_prompt_injection,
            check_command_safety,
            check_exfiltration,
            check_filesystem_access,
            check_network_safety,
        ]
        
        for check_fn in checks:
            result = check_fn(message)
            if result.blocked:
                return result
        
        return None
    
    def check_egress(self, response_text: str) -> Dict[str, Any]:
        """出口检查（响应返回后）— L2 qise + L1 DLP"""
        result: Dict[str, Any] = {
            "blocked": False,
            "redacted": False,
            "guard_result": None,
            "dlp_result": None,
        }
        
        # L2: qise SDK 凭据泄露检查
        if self.qise_enabled:
            if self.qise_sdk_available:
                qise_result = qise_check_egress(response_text)
                if qise_result:
                    if qise_result.get("blocked"):
                        result["blocked"] = True
                        result["guard_result"] = {
                            "guard_name": qise_result["guard_name"],
                            "reason": qise_result["reason"],
                            "confidence": 0.9,
                            "layer": "L2_qise_sdk",
                        }
                        return result
            else:
                # 回退到模拟守卫
                cred_result = check_credential_leak(response_text)
                if cred_result.blocked:
                    result["blocked"] = True
                    result["guard_result"] = {
                        "guard_name": cred_result.guard_name,
                        "reason": cred_result.reason,
                        "confidence": cred_result.confidence,
                        "layer": "L2_qise_fallback",
                    }
                    return result
        
        # L1: DLP 扫描
        if self.dlp_enabled:
            dlp_result = dlp_scan(response_text)
            if dlp_result.detected:
                result["redacted"] = True
                result["dlp_result"] = {
                    "detected": True,
                    "matches": dlp_result.matches,
                    "redacted_text": dlp_result.redacted_text,
                }
        
        return result


# 全局单例
defense_filter = DefenseFilterService()
