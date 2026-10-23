"""Hermes 上游项目服务 — 扫描 hermes/ 目录下的上游项目"""
from pathlib import Path
from app.config import settings


# 上游项目定义
HERMES_UPSTREAM_PROJECTS = {
    "hermes-plugins": {
        "name": "hermes-plugins",
        "description": "Evey 的 23 个 Hermes 社区插件",
        "category": "plugins",
    },
    "hermes-labyrinth": {
        "name": "hermes-labyrinth",
        "description": "Hermes Agent 可观测性黑匣子",
        "category": "observability",
    },
    "icarus-plugin": {
        "name": "icarus-plugin",
        "description": "Icarus 记忆与训练插件",
        "category": "plugins",
    },
    "evey-setup": {
        "name": "evey-setup",
        "description": "Evey 一键部署 Hermes 完整栈",
        "category": "setup",
    },
}


class HermesUpstreamService:
    """Hermes 上游项目服务"""

    def __init__(self):
        self.hermes_root = self._detect_hermes_root()

    def _detect_hermes_root(self) -> Path:
        """检测 Hermes 上游项目根目录"""
        # 优先使用配置的路径
        if settings.HERMES_UPSTREAM_PATH:
            return Path(settings.HERMES_UPSTREAM_PATH)

        # 自动检测：从当前项目目录向上查找 hermes/ 目录
        current = Path(__file__).resolve().parent
        for _ in range(5):
            candidate = current / "hermes"
            if candidate.is_dir():
                return candidate
            current = current.parent

        # 默认路径
        return Path("/Users/han/Documents/projects/Safetymind/hermes")

    async def list_projects(self) -> list[dict]:
        """列出所有上游项目及基本信息"""
        projects = []

        for key, info in HERMES_UPSTREAM_PROJECTS.items():
            project_path = self.hermes_root / key
            exists = project_path.is_dir()

            project_info = {
                "key": key,
                "name": info["name"],
                "description": info["description"],
                "category": info["category"],
                "exists": exists,
                "path": str(project_path) if exists else None,
            }

            if exists:
                # 尝试读取 README 获取更多信息
                readme_path = project_path / "README.md"
                project_info["has_readme"] = readme_path.exists()

                # 统计子目录数量
                subdirs = [d for d in project_path.iterdir() if d.is_dir() and not d.name.startswith('.')]
                project_info["subdirs_count"] = len(subdirs)
            else:
                project_info["has_readme"] = False
                project_info["subdirs_count"] = 0

            projects.append(project_info)

        return projects

    async def get_project_detail(self, project_key: str) -> dict:
        """获取单个项目详情"""
        if project_key not in HERMES_UPSTREAM_PROJECTS:
            return {"error": f"未知项目: {project_key}"}

        info = HERMES_UPSTREAM_PROJECTS[project_key]
        project_path = self.hermes_root / project_key

        if not project_path.is_dir():
            return {
                "key": project_key,
                "name": info["name"],
                "description": info["description"],
                "exists": False,
                "message": f"项目目录不存在: {project_path}",
            }

        # 获取文件结构
        files = []
        for item in sorted(project_path.iterdir()):
            if item.name.startswith('.'):
                continue
            files.append({
                "name": item.name,
                "type": "dir" if item.is_dir() else "file",
            })

        return {
            "key": project_key,
            "name": info["name"],
            "description": info["description"],
            "category": info["category"],
            "exists": True,
            "path": str(project_path),
            "files": files,
        }

    async def get_project_readme(self, project_key: str) -> str:
        """读取项目 README.md 内容"""
        project_path = self.hermes_root / project_key
        readme_path = project_path / "README.md"

        if not readme_path.exists():
            return f"# {project_key}\n\nREADME.md 不存在"

        try:
            return readme_path.read_text(encoding="utf-8")
        except Exception as e:
            return f"# {project_key}\n\n读取 README 失败: {str(e)}"


# 全局实例
upstream_service = HermesUpstreamService()
