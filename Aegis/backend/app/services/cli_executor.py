import asyncio
import json
from typing import Dict, Any, List, Optional


class CLIExecutor:
    """OpenClaw CLI 命令执行器"""
    
    async def execute_command(
        self, 
        command: str, 
        args: List[str] = None,
        timeout: int = 30
    ) -> Dict[str, Any]:
        """执行 CLI 命令"""
        cmd = ["openclaw", command] + (args or [])
        
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await asyncio.wait_for(
                process.communicate(), 
                timeout=timeout
            )
            
            if process.returncode != 0:
                return {
                    "success": False,
                    "error": stderr.decode('utf-8', errors='ignore'),
                    "output": ""
                }
            
            output = stdout.decode('utf-8', errors='ignore')
            
            # 尝试解析 JSON
            try:
                data = json.loads(output)
                return {"success": True, "data": data, "output": output}
            except json.JSONDecodeError:
                return {"success": True, "data": None, "output": output}
                
        except asyncio.TimeoutError:
            return {"success": False, "error": "命令执行超时", "output": ""}
        except FileNotFoundError:
            return {"success": False, "error": "openclaw 命令未找到", "output": ""}
        except Exception as e:
            return {"success": False, "error": str(e), "output": ""}
    
    async def security_audit_deep(self) -> Dict[str, Any]:
        """深度安全审计"""
        return await self.execute_command("security", ["audit", "--deep", "--json"])
    
    async def security_audit_fix(self) -> Dict[str, Any]:
        """自动修复安全问题"""
        return await self.execute_command("security", ["audit", "--fix"])
    
    async def doctor_check(self) -> Dict[str, Any]:
        """系统健康检查"""
        return await self.execute_command("doctor", ["--deep", "--json"])
    
    async def agents_list(self) -> Dict[str, Any]:
        """列出所有 Agent"""
        return await self.execute_command("agents", ["list", "--json"])
    
    async def agents_add(self, agent_id: str) -> Dict[str, Any]:
        """创建新 Agent"""
        return await self.execute_command("agents", ["add", agent_id])
