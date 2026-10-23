from fastapi import APIRouter, HTTPException
from pathlib import Path

router = APIRouter()

# 幻灯片图片存储目录
PPTS_DIR = Path(__file__).parent.parent.parent.parent / "frontend" / "public" / "ppts"

IMAGE_EXTS = {'.png', '.jpg', '.jpeg', '.gif', '.webp'}

@router.get("/{directory}")
async def list_ppt_files(directory: str):
    """列出指定目录下的幻灯片图片文件"""
    dir_path = PPTS_DIR / directory

    if not dir_path.exists():
        return {"files": []}

    if not dir_path.is_dir():
        raise HTTPException(status_code=400, detail="Invalid directory")

    files = []
    for file_path in dir_path.iterdir():
        if file_path.is_file() and file_path.suffix.lower() in IMAGE_EXTS:
            files.append({
                "name": file_path.name,
                "path": f"/ppts/{directory}/{file_path.name}",
                "type": "image"
            })

    # 按文件名排序（自然排序：_01, _02, ... _10, _11 ...）
    files.sort(key=lambda x: x["name"])

    return {"files": files}
