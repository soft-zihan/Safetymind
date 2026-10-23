from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from app.config import settings

# ── Core ──
from app.routers.core import security, demos, websocket
# ── 金刚龙虾 ──
from app.routers.openclaw import gateway, hardening, clawkeeper, agentguard
# ── 铁翼信使 ──
from app.routers.hermes import agent as hermes_agent, security as hermes_security
from app.routers.hermes import upstream as hermes_upstream
from app.routers.hermes import qise_integration as hermes_qise_router
# ── ClawShell ──
from app.routers.clawshell import proxy as clawshell_proxy
# ── CheryGuard ──
from app.routers import cheryguard
# ── 平台工具 ──
from app.routers.tools import qise, evaluation, datasets
# ── PPT 文件服务 ──
from app.routers import ppts

app = FastAPI(
    title="Aegis 神盾安全平台",
    description="OpenClaw（金刚龙虾）+ Hermes（铁翼信使）双轨安全加固与评测平台",
    version="2.0.0"
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Core 路由 ──
app.include_router(security.router, prefix="/api/security", tags=["安全核心"])
app.include_router(demos.router, prefix="/api/demos", tags=["攻防演示"])
app.include_router(websocket.router, prefix="/ws", tags=["WebSocket"])

# ── 金刚龙虾路由 ──
app.include_router(gateway.router, prefix="/api/openclaw", tags=["金刚龙虾"])
app.include_router(hardening.router, prefix="/api/openclaw/hardening", tags=["金刚龙虾·加固"])
app.include_router(clawkeeper.router, prefix="/api/openclaw/clawkeeper", tags=["金刚龙虾·ClawKeeper"])
app.include_router(agentguard.router, prefix="/api/openclaw/agentguard", tags=["AgentGuard 零信任"])

# ── 铁翼信使路由 ──
app.include_router(hermes_agent.router, prefix="/api/hermes", tags=["铁翼信使"])
app.include_router(hermes_security.router, prefix="/api/hermes/security", tags=["铁翼信使·安全"])
app.include_router(hermes_upstream.router, prefix="/api/hermes/upstream", tags=["铁翼信使·上游"])
app.include_router(hermes_qise_router.router, prefix="/api/hermes", tags=["铁翼信使·qise接入"])

# ── ClawShell 代理路由 ──
app.include_router(clawshell_proxy.router, prefix="/api/clawshell", tags=["ClawShell"])

# ── CheryGuard 路由 ──
app.include_router(cheryguard.router, prefix="/api/cheryguard", tags=["CheryGuard 安全模型"])

# ── 平台工具路由 ──
app.include_router(qise.router, prefix="/api/tools/qise", tags=["qise 安全防护"])
app.include_router(evaluation.router, prefix="/api/tools/eval", tags=["模型评估"])
app.include_router(datasets.router, prefix="/api/tools/datasets", tags=["数据集管理"])

# ── PPT 文件服务路由 ──
app.include_router(ppts.router, prefix="/api/ppts", tags=["PPT 文件服务"])


# ── 旧路径兼容重定向（保留一个版本后移除）──
@app.get("/api/qise/{path:path}", include_in_schema=False)
async def redirect_qise(path: str):
    return RedirectResponse(url=f"/api/tools/qise/{path}", status_code=307)

@app.post("/api/qise/{path:path}", include_in_schema=False)
async def redirect_qise_post(path: str):
    return RedirectResponse(url=f"/api/tools/qise/{path}", status_code=307)

@app.get("/api/eval/{path:path}", include_in_schema=False)
async def redirect_eval(path: str):
    return RedirectResponse(url=f"/api/tools/eval/{path}", status_code=307)

@app.post("/api/eval/{path:path}", include_in_schema=False)
async def redirect_eval_post(path: str):
    return RedirectResponse(url=f"/api/tools/eval/{path}", status_code=307)

@app.get("/api/datasets/{path:path}", include_in_schema=False)
async def redirect_datasets(path: str):
    return RedirectResponse(url=f"/api/tools/datasets/{path}", status_code=307)

@app.post("/api/datasets/{path:path}", include_in_schema=False)
async def redirect_datasets_post(path: str):
    return RedirectResponse(url=f"/api/tools/datasets/{path}", status_code=307)

@app.get("/api/hardening/{path:path}", include_in_schema=False)
async def redirect_hardening(path: str):
    return RedirectResponse(url=f"/api/openclaw/hardening/{path}", status_code=307)

@app.post("/api/hardening/{path:path}", include_in_schema=False)
async def redirect_hardening_post(path: str):
    return RedirectResponse(url=f"/api/openclaw/hardening/{path}", status_code=307)

@app.get("/api/clawkeeper/{path:path}", include_in_schema=False)
async def redirect_clawkeeper(path: str):
    return RedirectResponse(url=f"/api/openclaw/clawkeeper/{path}", status_code=307)

@app.post("/api/clawkeeper/{path:path}", include_in_schema=False)
async def redirect_clawkeeper_post(path: str):
    return RedirectResponse(url=f"/api/openclaw/clawkeeper/{path}", status_code=307)


@app.on_event("startup")
async def startup_event():
    """应用启动事件"""
    print("🛡️ Aegis 神盾安全平台已启动")
    print(f"📍 API 文档: http://localhost:{settings.BACKEND_PORT}/docs")


@app.get("/")
async def root():
    """根路径"""
    return {
        "name": "Aegis 神盾安全平台",
        "subtitle": "OpenClaw（金刚龙虾）· Hermes（铁翼信使）双轨安全防护",
        "version": "2.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "ok"}
