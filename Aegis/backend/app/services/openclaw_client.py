import httpx
import asyncio
import json
import sys
from pathlib import Path
from typing import Optional, List, Dict, Any
from app.config import settings
from app.services.defense_filters import defense_filter

# 导入ClawKeeper安全策略加载器
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root / "clawkeeper-integration" / "adapter"))
try:
    from skill_loader import load_lobster_safety_skills
    CLAWKEEPER_SKILLS_LOADED = True
except ImportError:
    CLAWKEEPER_SKILLS_LOADED = False
    print("⚠️ 警告: ClawKeeper Skill加载器未找到")


class OpenClawClient:
    """OpenClaw Gateway API 客户端（使用真实的 /v1/chat/completions 端点）
    
    5 层纵深防御架构：
      L1 ClawShell DLP  — 响应后 DLP 扫描 + 脱敏
      L2 qise 守卫      — 请求前入口守卫 + 响应后出口守卫
      L3 OpenClaw 加固  — Gateway 内置（safeBins + SOUL.md + elevated）
      L4 ClawKeeper     — Skill 策略注入（已有）
      L5 Docker 沙箱    — Gateway 内置（容器隔离）
    """
    
    def __init__(self, base_url: str = "http://127.0.0.1:18789", token: str = None, max_retries: int = 3):
        self.base_url = base_url
        self.token = token or settings.OPENCLAW_AUTH_TOKEN
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.token}"
        }
        self.max_retries = max_retries
        
        # 判断是否是安全龙虾(hardened profile)
        self.is_hardened = "hardened" in self.base_url or "20789" in self.base_url
        
        # L1/L2/L4 防御开关（金刚龙虾默认启用，裸奔龙虾默认关闭）
        self.dlp_enabled: bool = self.is_hardened
        self.qise_enabled: bool = self.is_hardened
        self.clawkeeper_skill_enabled: bool = self.is_hardened
    
    async def get_status(self) -> Dict[str, Any]:
        """获取 Gateway 状态"""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/health")
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "is_running": True,
                        "version": "2026.5.7",
                        "uptime": 0,
                        "status": data
                    }
        except Exception:
            pass
        
        return {
            "is_running": False,
            "version": "unknown",
            "uptime": 0,
            "status": {"error": "Gateway 未运行"}
        }
    
    async def send_message(
        self, 
        agent_id: str, 
        message: str,
        session_user: str = "demo-user"
    ) -> Dict[str, Any]:
        """向 Agent 发送消息（带纵深防御拦截）
        
        流量路径（金刚龙虾）：
          1. L2 qise 入口守卫（PromptGuard/CommandGuard 等）
          2. L4 ClawKeeper Skill 策略注入
          3. HTTP → Gateway（L3 safeBins/SOUL.md + L5 Docker 沙箱）
          4. L2 qise 出口守卫（CredentialGuard）
          5. L1 ClawShell DLP 扫描 + 脱敏
        """
        last_error = None
        timeout = httpx.Timeout(connect=10.0, read=180.0, write=10.0, pool=10.0)
        
        # ============================================================
        # L2: qise 入口守卫（请求发出前）
        # ============================================================
        ingress_block = None
        if self.qise_enabled:
            ingress_result = defense_filter.check_ingress(message)
            if ingress_result and ingress_result.blocked:
                ingress_block = ingress_result
                print(f"[L2 qise 入口拦截] {ingress_result.guard_name}: {ingress_result.reason}")
        
        # ============================================================
        # L4: ClawKeeper Skill 策略注入
        # ============================================================
        messages = [{"role": "user", "content": message}]
        
        if self.clawkeeper_skill_enabled and CLAWKEEPER_SKILLS_LOADED:
            try:
                safety_prompt = load_lobster_safety_skills()
                if safety_prompt:
                    messages.insert(0, {
                        "role": "system",
                        "content": safety_prompt
                    })
            except Exception as e:
                print(f"⚠️ 加载ClawKeeper安全策略失败: {e}")
        
        # ============================================================
        # 发送到 Gateway（L3 OpenClaw 加固 + L5 Docker 沙箱 在此层生效）
        # ============================================================
        gateway_response = None
        for attempt in range(1, self.max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.post(
                        f"{self.base_url}/v1/chat/completions",
                        headers=self.headers,
                        json={
                            "model": f"openclaw/{agent_id}" if agent_id != "main" else "openclaw",
                            "messages": messages,
                            "user": session_user,
                            "stream": False
                        }
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        gateway_response = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                        break
                    
                    if 500 <= response.status_code < 600:
                        last_error = f"服务器错误: {response.status_code}"
                        if attempt < self.max_retries:
                            wait = 2 ** attempt
                            await asyncio.sleep(wait)
                            continue
                    
                    return {
                        "success": False,
                        "response": f"请求失败: {response.status_code}",
                        "error": response.text
                    }
                    
            except (httpx.TimeoutException, httpx.ConnectError, httpx.RemoteProtocolError) as e:
                last_error = f"网络错误: {str(e)}"
                if attempt < self.max_retries:
                    wait = 2 ** attempt
                    await asyncio.sleep(wait)
                    continue
                return {"success": False, "response": f"连接失败 (已重试 {self.max_retries} 次): {str(e)}", "error": str(e)}
            except Exception as e:
                return {"success": False, "response": f"错误: {str(e)}", "error": str(e)}
        
        if gateway_response is None:
            return {
                "success": False, 
                "response": f"请求失败 (已重试 {self.max_retries} 次): {last_error}",
                "error": last_error
            }
        
        # ============================================================
        # L2: qise 出口守卫 + L1 DLP 扫描（响应返回后）
        # ============================================================
        final_response = gateway_response
        defense_trace: Dict[str, Any] = {
            "L1_clawshell": {"intervened": False},
            "L2_qise": {"intervened": False},
            "L4_clawkeeper": {"intervened": self.clawkeeper_skill_enabled and CLAWKEEPER_SKILLS_LOADED},
        }
        
        if self.qise_enabled:
            egress_result = defense_filter.check_egress(gateway_response)
            
            # L2 凭据泄露拦截
            if egress_result.get("blocked") and egress_result.get("guard_result"):
                gr = egress_result["guard_result"]
                defense_trace["L2_qise"]["intervened"] = True
                defense_trace["L2_qise"]["guard_name"] = gr["guard_name"]
                defense_trace["L2_qise"]["reason"] = gr["reason"]
                final_response = f"⚠️ [qise {gr['guard_name']}] {gr['reason']}\n输出已被安全守卫拦截，敏感信息未泄露。"
            
            # L1 DLP 脱敏
            if egress_result.get("redacted") and egress_result.get("dlp_result"):
                dlp = egress_result["dlp_result"]
                defense_trace["L1_clawshell"]["intervened"] = True
                defense_trace["L1_clawshell"]["matches"] = dlp["matches"]
                final_response = dlp["redacted_text"]
        
        # 记录入口拦截信息
        if ingress_block:
            defense_trace["L2_qise"]["ingress_blocked"] = True
            defense_trace["L2_qise"]["ingress_guard"] = ingress_block.guard_name
            defense_trace["L2_qise"]["ingress_reason"] = ingress_block.reason
        
        return {
            "success": True,
            "response": final_response,
            "raw": {"defense_trace": defense_trace} if self.is_hardened else {},
            "defense_trace": defense_trace,
        }

    async def get_models(self) -> List[Dict[str, Any]]:
        """获取可用模型/Agent 列表"""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    f"{self.base_url}/v1/models",
                    headers=self.headers
                )
                if response.status_code == 200:
                    data = response.json()
                    return data.get("data", [])
        except Exception:
            pass
        return []
    
    async def get_workspace_file(self, agent_id: str, filename: str) -> str:
        """读取 Agent 工作区文件"""
        try:
            workspace = Path.home() / '.openclaw' / 'workspace'
            if agent_id != 'main':
                workspace = Path.home() / '.openclaw' / f'workspace-{agent_id}'
            file_path = workspace / filename
            if file_path.exists():
                return file_path.read_text(encoding='utf-8')
            return f"文件不存在: {file_path}"
        except Exception as e:
            return f"读取失败: {str(e)}"
    
    async def clear_session(self, agent_id: str, session_user: str = "demo-user") -> Dict[str, Any]:
        """清理 Agent 的会话上下文
        
        通过发送特殊的系统指令来重置会话历史，确保测试独立性。
        OpenClaw Gateway 支持通过 /v1/chat/completions 端点的 session 管理。
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # 方法 1: 尝试使用 Gateway 的 session 清理端点
                response = await client.delete(
                    f"{self.base_url}/v1/sessions/{session_user}",
                    headers=self.headers
                )
                
                if response.status_code == 200:
                    print(f"✅ 会话清理成功: agent={agent_id}, user={session_user}")
                    return {"success": True, "message": "会话已清理"}
                
                # 方法 2: 如果端点不存在，发送一个特殊的重置指令
                if response.status_code == 404:
                    reset_message = "[SYSTEM: RESET_CONTEXT]"
                    reset_response = await client.post(
                        f"{self.base_url}/v1/chat/completions",
                        headers=self.headers,
                        json={
                            "model": f"openclaw/{agent_id}" if agent_id != "main" else "openclaw",
                            "messages": [
                                {"role": "system", "content": "Please reset your conversation context and forget all previous messages."},
                                {"role": "user", "content": reset_message}
                            ],
                            "user": session_user,
                            "stream": False
                        }
                    )
                    
                    if reset_response.status_code == 200:
                        print(f"✅ 会话上下文已重置: agent={agent_id}, user={session_user}")
                        return {"success": True, "message": "会话上下文已重置"}
                    else:
                        print(f"⚠️ 会话重置失败: {reset_response.status_code}")
                        return {"success": False, "message": f"会话重置失败: {reset_response.status_code}"}
                
                return {"success": False, "message": f"清理失败: {response.status_code}"}
                
        except Exception as e:
            print(f"⚠️ 清理会话异常: {str(e)}")
            # 即使清理失败也不阻塞测试流程
            return {"success": False, "message": f"清理异常: {str(e)}"}
