from fastapi import APIRouter, Request
from typing import Optional, Dict
from app.services.attack_simulator import AttackSimulator
from app.services.ai_judge import load_judge_criteria
from app.services.security_analyzer import SecurityAnalyzer
import json
from pathlib import Path

router = APIRouter()
simulator = AttackSimulator()
analyzer = SecurityAnalyzer()

# 提示词持久化存储路径
PROMPTS_FILE = Path(__file__).parent.parent / "data" / "custom_prompts.json"
# 评判标准持久化存储路径
JUDGE_CRITERIA_FILE = Path(__file__).parent.parent / "data" / "custom_judge_criteria.json"

def _load_custom_prompts() -> Dict[str, str]:
    """加载自定义提示词"""
    if PROMPTS_FILE.exists():
        try:
            with open(PROMPTS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {}
    return {}

def _save_custom_prompts(prompts: Dict[str, str]):
    """保存自定义提示词"""
    PROMPTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(PROMPTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(prompts, f, indent=2, ensure_ascii=False)


def _load_custom_judge_criteria() -> Dict:
    """加载自定义评判标准"""
    if JUDGE_CRITERIA_FILE.exists():
        try:
            with open(JUDGE_CRITERIA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {}
    return {}


def _save_custom_judge_criteria(criteria: Dict):
    """保存自定义评判标准"""
    JUDGE_CRITERIA_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(JUDGE_CRITERIA_FILE, 'w', encoding='utf-8') as f:
        json.dump(criteria, f, indent=2, ensure_ascii=False)


@router.get("/scenarios")
async def get_scenarios():
    """获取所有演示场景"""
    scenarios = simulator.get_scenarios()
    
    # 加载自定义评判标准
    custom_judge_criteria = _load_custom_judge_criteria()
    all_criteria = load_judge_criteria()
    
    # 按风险等级分类
    categories = {
        "critical": [],
        "high": [],
        "medium": [],
        "low": []
    }
    
    for scenario in scenarios:
        risk_level = scenario.get("risk_level", "low")
        if risk_level in categories:
            # 深拷贝
            scenario_copy = dict(scenario)
            scenario_id = str(scenario.get("id"))
            
            # 标记是否有评判标准
            scenario_copy["has_custom_judge_criteria"] = scenario_id in custom_judge_criteria
            
            categories[risk_level].append(scenario_copy)
    
    # 每个风险等级内按 ID 排序
    for level in categories:
        categories[level].sort(key=lambda x: x.get("id", 0))
    
    return {"categories": categories, "total": len(scenarios)}


@router.get("/scenarios/{scenario_id}")
async def get_scenario(scenario_id: int):
    """获取单个场景详情"""
    scenario = simulator.get_scenario(scenario_id)
    if not scenario:
        return {"error": "场景不存在"}
    
    # 合并自定义评判标准
    custom_judge_criteria = _load_custom_judge_criteria()
    all_criteria = load_judge_criteria()
    judge_criteria_ref = scenario.get("judge_criteria_ref", "")
    default_criteria = all_criteria.get(judge_criteria_ref, {})
    custom_criteria = custom_judge_criteria.get(judge_criteria_ref, {})
    
    # 合并：自定义覆盖默认
    merged_criteria = {**default_criteria, **custom_criteria}
    scenario["judge_criteria"] = merged_criteria
    
    return scenario


@router.get("/prompts")
async def get_custom_prompts():
    """获取所有自定义提示词"""
    return {"prompts": _load_custom_prompts()}


@router.post("/scenarios/{scenario_id}/prompt")
async def save_scenario_prompt(scenario_id: int, request: Request):
    """保存场景的提示词（直接修改 demo_scenarios.json）"""
    # 从请求体获取纯文本
    prompt = await request.body()
    prompt_text = prompt.decode('utf-8')
    
    # 直接更新 JSON 文件
    success = simulator.update_scenario_prompt(scenario_id, prompt_text)
    if success:
        return {"success": True, "message": "提示词已保存"}
    else:
        return {"success": False, "error": "场景不存在"}


@router.post("/scenarios/{scenario_id}/test")
async def test_scenario(scenario_id: int, prompt_override: Optional[str] = None):
    """执行场景测试 - 并自动保存测试结果"""
    result = await simulator.simulate_attack(scenario_id, prompt_override)
    
    # 保存测试结果到历史记录
    if "error" not in result:
        analyzer.add_test_result(scenario_id, result)
    
    return result


@router.post("/test-all")
async def test_all_scenarios():
    """批量测试所有场景"""
    scenarios = simulator.get_scenarios()
    results = []
    
    for scenario in scenarios:
        result = await simulator.simulate_attack(scenario["id"])
        results.append({
            "id": scenario["id"],
            "name": scenario["name"],
            "naked": result.get("naked_result", "fail"),
            "hardened": result.get("hardened_result", "pass"),
            "risk_level": scenario["risk_level"]
        })
    
    # 统计
    total = len(results)
    naked_fail = sum(1 for r in results if r["naked"] == "fail")
    hardened_pass = sum(1 for r in results if r["hardened"] == "pass")
    
    return {
        "results": results,
        "summary": {
            "total": total,
            "critical": sum(1 for s in scenarios if s["risk_level"] == "critical"),
            "high": sum(1 for s in scenarios if s["risk_level"] == "high"),
            "medium": sum(1 for s in scenarios if s["risk_level"] == "medium"),
            "naked_fail_rate": f"{naked_fail/total*100:.1f}%" if total > 0 else "0%",
            "hardened_pass_rate": f"{hardened_pass/total*100:.1f}%" if total > 0 else "0%"
        }
    }


# ========== AI 评判标准 API ==========


@router.get("/judge-criteria")
async def get_all_judge_criteria():
    """获取所有场景的评判标准（含默认 + 自定义合并）"""
    custom = _load_custom_judge_criteria()
    all_criteria = load_judge_criteria()
    
    result = {}
    for ref_id, default_criteria in all_criteria.items():
        custom_part = custom.get(ref_id, {})
        merged = {**default_criteria, **custom_part}
        result[ref_id] = merged
    
    return {
        "criteria": result,
        "has_custom": list(custom.keys())
    }


@router.get("/judge-criteria/{scenario_id}")
async def get_scenario_judge_criteria(scenario_id: int):
    """获取单个场景的评判标准"""
    ref_id = str(scenario_id)
    all_criteria = load_judge_criteria()
    default = all_criteria.get(ref_id, {})
    custom = _load_custom_judge_criteria().get(ref_id, {})
    
    return {
        "scenario_id": scenario_id,
        "default": default,
        "custom": custom,
        "merged": {**default, **custom}
    }


@router.put("/judge-criteria/{scenario_id}")
async def update_scenario_judge_criteria(scenario_id: int, request: Request):
    """更新单个场景的评判标准"""
    body = await request.json()
    ref_id = str(scenario_id)
    
    custom = _load_custom_judge_criteria()
    custom[ref_id] = body
    _save_custom_judge_criteria(custom)
    
    return {"success": True, "message": "评判标准已更新"}


@router.post("/judge-criteria/{scenario_id}/reset")
async def reset_scenario_judge_criteria(scenario_id: int):
    """重置单个场景的评判标准为默认值"""
    ref_id = str(scenario_id)
    
    custom = _load_custom_judge_criteria()
    if ref_id in custom:
        del custom[ref_id]
        _save_custom_judge_criteria(custom)
    
    return {"success": True, "message": "评判标准已重置为默认值"}


# ========== 纵深防御 API ==========

# 防御层元数据路径
DEFENSE_LAYERS_META_FILE = Path(__file__).parent.parent / "data" / "defense_layers_meta.json"


def _load_defense_layers_meta() -> Dict:
    """加载防御层元数据"""
    try:
        with open(DEFENSE_LAYERS_META_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {"layers": []}


# 防御层开关状态（运行时状态，不持久化）
_defense_toggle_state: Dict[str, bool] = {
    "L1_clawshell": True,   # 金刚龙虾默认启用
    "L2_qise": True,
    "L3_openclaw": True,
    "L4_clawkeeper": True,
    "L5_docker": True,
}


@router.get("/defense-layers")
async def get_defense_layers():
    """获取 5 层防御体系元数据"""
    meta = _load_defense_layers_meta()
    # 附加当前开关状态
    for layer in meta.get("layers", []):
        layer_id = layer.get("id")
        layer["enabled"] = _defense_toggle_state.get(layer_id, True)
    return meta


@router.get("/defense-status")
async def get_defense_status():
    """获取当前各层防御开关状态"""
    return {
        "status": _defense_toggle_state,
        "requires_restart": {
            "L3_openclaw": True,
            "L5_docker": True,
        }
    }


@router.post("/defense-toggle")
async def toggle_defense_layer(request: Request):
    """切换某层防御开关
    
    Body: {"layer": "L1_clawshell", "enabled": false}
    
    即时生效：L1/L2/L4（应用层标志位）
    需重启 Gateway：L3/L5（修改配置文件）
    """
    body = await request.json()
    layer = body.get("layer")
    enabled = body.get("enabled", True)
    
    if layer not in _defense_toggle_state:
        return {"success": False, "error": f"未知的防御层: {layer}"}
    
    _defense_toggle_state[layer] = enabled
    
    # 同步到 OpenClawClient 实例
    from app.services.attack_simulator import AttackSimulator
    # 获取 simulator 实例的 dual_client 并更新开关
    try:
        naked_client = simulator.dual_client.naked_client
        hardened_client = simulator.dual_client.hardened_client
        
        if layer == "L1_clawshell":
            hardened_client.dlp_enabled = enabled
        elif layer == "L2_qise":
            hardened_client.qise_enabled = enabled
        elif layer == "L4_clawkeeper":
            hardened_client.clawkeeper_skill_enabled = enabled
        elif layer in ("L3_openclaw", "L5_docker"):
            # 需要重启 Gateway，返回提示
            return {
                "success": True,
                "message": f"{layer} 开关已更新，需要重启 Gateway 才能生效",
                "requires_restart": True,
                "layer": layer,
                "enabled": enabled,
            }
    except Exception as e:
        print(f"⚠️ 同步防御开关失败: {e}")
    
    return {
        "success": True,
        "message": f"{layer} 已{'启用' if enabled else '关闭'}",
        "requires_restart": False,
        "layer": layer,
        "enabled": enabled,
    }


@router.get("/model-config")
async def get_model_config():
    """获取两个 Agent 的模型配置"""
    from app.services.dual_agent_manager import DualAgentManager
    manager = DualAgentManager()
    config = manager._load_config()
    
    agents = config.get("agents", {}).get("list", [])
    result = {}
    for agent in agents:
        agent_id = agent.get("id")
        if agent_id in ("naked-lobster", "hardened-lobster"):
            result[agent_id] = {
                "name": agent.get("name"),
                "model": agent.get("model", {}).get("primary", "unknown"),
            }
    
    return {"models": result}


@router.put("/model-config")
async def update_model_config(request: Request):
    """修改模型配置（需重启 Gateway）
    
    Body: {"agent_id": "naked-lobster", "model": "anthropic/claude-sonnet-4-5"}
    """
    from app.services.dual_agent_manager import DualAgentManager
    body = await request.json()
    agent_id = body.get("agent_id")
    new_model = body.get("model")
    
    if not agent_id or not new_model:
        return {"success": False, "error": "缺少 agent_id 或 model 参数"}
    
    manager = DualAgentManager()
    config = manager._load_config()
    
    agents = config.get("agents", {}).get("list", [])
    found = False
    for agent in agents:
        if agent.get("id") == agent_id:
            agent["model"] = {"primary": new_model}
            found = True
            break
    
    if not found:
        return {"success": False, "error": f"Agent {agent_id} 不存在"}
    
    config["agents"]["list"] = agents
    manager._save_config(config)
    
    return {
        "success": True,
        "message": f"模型已更新，需要重启 Gateway 才能生效",
        "requires_restart": True,
        "agent_id": agent_id,
        "model": new_model,
    }


# ========== 攻击链 API ==========


@router.get("/scenarios/{scenario_id}/attack-chain")
async def get_attack_chain(scenario_id: int):
    """执行多阶段攻击链测试并返回真实结果"""
    result = await simulator.simulate_multi_stage_attack(scenario_id)
    return result


@router.post("/scenarios/{scenario_id}/attack-chain")
async def post_attack_chain(scenario_id: int, body: Dict):
    """用自定义 prompts 重新执行多阶段攻击链测试
    
    body: { "prompt_overrides": { "1": "custom prompt for stage 1", "2": "..." } }
    """
    prompt_overrides = body.get("prompt_overrides", None)
    # 将字符串 key 转为 int key
    if prompt_overrides:
        prompt_overrides = {int(k): v for k, v in prompt_overrides.items()}
    result = await simulator.simulate_multi_stage_attack(scenario_id, prompt_overrides=prompt_overrides)
    return result


@router.get("/defense-matrix")
async def get_defense_matrix():
    """获取所有场景 × 所有防御层的覆盖矩阵"""
    return simulator.get_defense_matrix()


# ========== 会话管理 API ==========


@router.post("/sessions/clear")
async def clear_sessions():
    """清理所有 Agent 的会话上下文
    
    在执行对比测试前调用，确保测试独立性。
    清理裸奔龙虾和金刚龙虾的会话历史。
    """
    try:
        result = await simulator.dual_client.clear_both_sessions(session_user="demo-user")
        
        # 检查是否至少有一个成功
        naked_success = result.get("naked", {}).get("success", False)
        hardened_success = result.get("hardened", {}).get("success", False)
        
        if naked_success or hardened_success:
            return {
                "success": True,
                "message": "会话已清理",
                "details": result
            }
        else:
            return {
                "success": False,
                "message": "会话清理失败",
                "details": result
            }
    except Exception as e:
        print(f"⚠️ 清理会话异常: {e}")
        return {
            "success": False,
            "message": f"清理异常: {str(e)}"
        }
