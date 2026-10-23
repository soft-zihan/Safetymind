"""Hermes 上游项目路由 — 浏览 Hermes 专属上游仓库"""
from fastapi import APIRouter, HTTPException
from app.services.hermes_upstream import upstream_service

router = APIRouter()


@router.get("/projects", summary="上游项目列表")
async def list_projects():
    """列出所有 Hermes 上游项目"""
    return await upstream_service.list_projects()


@router.get("/{project_key}", summary="项目详情")
async def get_project_detail(project_key: str):
    """获取单个上游项目详情"""
    result = await upstream_service.get_project_detail(project_key)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.get("/{project_key}/readme", summary="项目 README")
async def get_project_readme(project_key: str):
    """获取上游项目 README 内容"""
    if project_key not in ["hermes-plugins", "hermes-labyrinth", "icarus-plugin", "evey-setup"]:
        raise HTTPException(status_code=404, detail=f"未知项目: {project_key}")
    content = await upstream_service.get_project_readme(project_key)
    return {"content": content}
