"""铁翼信使 × qise 安全防护接入路由

通过 qise SDK (QiseHermesAdapter) 为 Hermes Agent 提供安全防护。
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, Dict, Any
from app.services.hermes_qise import hermes_qise

router = APIRouter()


class ToolCheckRequest(BaseModel):
    tool_name: str
    tool_args: Dict[str, Any]


class OutputCheckRequest(BaseModel):
    text: str


@router.get("/qise/status", summary="qise 接入状态")
async def get_qise_status():
    """获取 qise 安全防护接入 Hermes 的状态"""
    return hermes_qise.get_status()


@router.post("/qise/check-tool", summary="工具调用安全检查")
async def check_tool_call(request: ToolCheckRequest):
    """通过 qise Shield 检查 Hermes 工具调用安全性"""
    return hermes_qise.check_tool_call(request.tool_name, request.tool_args)


@router.post("/qise/check-output", summary="输出安全检查")
async def check_output(request: OutputCheckRequest):
    """通过 qise Shield 检查 Hermes Agent 输出安全性"""
    return hermes_qise.check_output(request.text)


@router.get("/qise/sdk-snippet", summary="SDK 接入代码片段")
async def get_sdk_snippet():
    """返回 Hermes 接入 qise 的 Python SDK 代码示例"""
    return {"snippet": hermes_qise.get_sdk_snippet()}
