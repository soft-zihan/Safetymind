from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    """应用配置"""
    
    # OpenClaw 配置
    OPENCLAW_AUTH_TOKEN: str = ""
    
    # 演示用敏感信息（不设默认值，从 .env 读取）
    ALIPAY_KEY: str = ""
    ID_CARD_NUMBER: str = ""
    MOBILE_NUMBER: str = ""
    
    # 大模型 API 配置（用于 AI 评判）
    JUDGE_MODEL_API_URL: str = "https://model.cherygpt.com/ada/v1"
    JUDGE_MODEL_API_KEY: str = "gqmjtJ3rMNnaEbCW"
    JUDGE_MODEL_NAME: str = "deepseek-v4-flash"
    
    # 服务器配置
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    
    # OpenClaw 配置路径（优先 hardened 版本）
    OPENCLAW_CONFIG_PATH: Path = Path.home() / ".openclaw-hardened" / "openclaw.json"
    
    # Docker 沙箱配置
    SANDBOX_IMAGE: str = "openclaw-sandbox:bookworm-slim"
    SANDBOX_CONTAINER_PREFIX: str = "openclaw-sbx-"
    SANDBOX_NETWORK: str = "none"
    SANDBOX_READONLY_ROOT: bool = True
    SANDBOX_MEMORY: str = "2g"
    SANDBOX_CPUS: str = "1.0"
    
    # 安全策略配置
    SAFE_BINS: str = "ls,grep,cat,head,tail,wc,find,date,echo,curl,jq,python3"
    ELEVATED_MODE: str = "ask"
    ELEVATED_GATES: str = "exec,browser,write,apply_patch"
    DM_POLICY: str = "paired-only"
    GROUP_POLICY: str = "allowlisted"
    
    # 本地模型配置
    LOCAL_MODEL_BASE_URL: str = "http://localhost:11434/v1"
    LOCAL_MODEL_NAME: str = "qiseguard:2b"
    LOCAL_MODEL_API_KEY: str = "local"
    LOCAL_MODEL_TIMEOUT: int = 30000
    USE_LOCAL_JUDGE: bool = True  # True=优先本地模型，False=仅远程 API
    
    # ── 铁翼信使 (Hermes) 配置 ──
    HERMES_CONFIG_PATH: Path = Path.home() / ".hermes" / "config.yaml"
    HERMES_AGENT_URL: str = "http://localhost:8081"
    HERMES_PLUGINS_PATH: Path = Path.home() / ".hermes" / "plugins"
    HERMES_TIRITH_PATH: str = ""  # 空=自动检测
    HERMES_UPSTREAM_PATH: str = ""  # Hermes 上游项目目录，空=自动检测
    
    # ── ClawShell 配置 ──
    CLAWSHELL_BASE_URL: str = "http://127.0.0.1:21789"
    CLAWSHELL_BIN_PATH: str = ""  # 空=自动检测
    CLAWSHELL_CONFIG_PATH: str = ""  # ClawShell 配置文件路径
    
    # ── qise 安全框架配置 ──
    QISE_ENABLED: bool = True
    QISE_PROXY_URL: str = "http://localhost:8822"
    QISE_USE_SDK: bool = True  # OpenClaw 使用 SDK, Hermes 使用 SDK + Proxy 双模式
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


settings = Settings()
