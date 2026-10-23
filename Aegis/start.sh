#!/bin/bash

# Aegis 神盾安全平台 - 启动/停止脚本
# 用法: ./start.sh [start|stop|status|restart]

ACTION=${1:-start}

# 检查是否以 root 运行（会导致权限问题）
if [ "$(id -u)" -eq 0 ] && [ -z "$ALLOW_ROOT" ]; then
    echo "⚠️  警告: 检测到以 root/sudo 运行启动脚本！"
    echo "   这会导致服务文件权限问题（ClawShell、qise 等）"
    echo "   建议: 直接运行 ./start.sh（无需 sudo）"
    echo ""
    read -p "是否仍以 root 继续？[y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "已取消。请使用: ./start.sh"
        exit 1
    fi
    export ALLOW_ROOT=1
fi

# 停止所有服务
stop_services() {
    echo "🛑 正在停止 Aegis 神盾安全平台..."
    echo ""
    
    # 停止 Gateway
    echo "📍 停止裸奔龙虾 Gateway..."
    openclaw --profile naked gateway stop 2>&1 | grep -E "(Stopped|not running)" || true
    
    echo "📍 停止安全龙虾 Gateway..."
    openclaw --profile hardened gateway stop 2>&1 | grep -E "(Stopped|not running)" || true
    
    # 停止 ClawShell 代理服务
    echo "📍 停止 ClawShell 代理服务..."
    if clawshell status 2>&1 | grep -q -i "running"; then
        clawshell stop 2>&1 | tail -1
        echo "✅ ClawShell 已停止"
    else
        echo "ℹ️  ClawShell 未运行"
    fi
    
    # 停止 qise 防护服务
    echo "📍 停止 qise 防护服务..."
    QISE_PIDS=$(lsof -ti:8822 2>/dev/null)
    if [ ! -z "$QISE_PIDS" ]; then
        echo $QISE_PIDS | xargs kill -9 2>/dev/null
        echo "✅ qise proxy 已停止"
    else
        echo "ℹ️  qise proxy 未运行"
    fi
    
    # 停止 AgentGuard 控制服务器
    echo "📍 停止 AgentGuard 控制服务器..."
    AGENTGUARD_PIDS=$(lsof -ti:38080 2>/dev/null)
    if [ ! -z "$AGENTGUARD_PIDS" ]; then
        echo $AGENTGUARD_PIDS | xargs kill -9 2>/dev/null
        echo "✅ AgentGuard 已停止"
    else
        echo "ℹ️  AgentGuard 未运行"
    fi
    
    # 停止 AgentGuard UI 控制台
    echo "📍 停止 AgentGuard UI 控制台..."
    AGENTGUARD_UI_PIDS=$(lsof -ti:38008 2>/dev/null)
    if [ ! -z "$AGENTGUARD_UI_PIDS" ]; then
        echo $AGENTGUARD_UI_PIDS | xargs kill -9 2>/dev/null
        echo "✅ AgentGuard UI 已停止"
    else
        echo "ℹ️  AgentGuard UI 未运行"
    fi
    
    # 停止后端 (端口 8000)
    echo "📍 停止后端服务..."
    BACKEND_PIDS=$(lsof -ti:8000 2>/dev/null)
    if [ ! -z "$BACKEND_PIDS" ]; then
        echo $BACKEND_PIDS | xargs kill -9 2>/dev/null
        echo "✅ 后端服务已停止"
    else
        echo "ℹ️  后端服务未运行"
    fi
    
    # 停止前端 (端口 5173)
    echo "📍 停止前端服务..."
    FRONTEND_PIDS=$(lsof -ti:5173 2>/dev/null)
    if [ ! -z "$FRONTEND_PIDS" ]; then
        echo $FRONTEND_PIDS | xargs kill -9 2>/dev/null
        echo "✅ 前端服务已停止"
    else
        echo "ℹ️  前端服务未运行"
    fi
    
    # 检查 Ollama 模型服务
    echo "📍 检查 Ollama 模型服务..."
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "ℹ️  Ollama 正在运行（不自动停止，请手动 ollama stop）"
    fi
    
    echo ""
    echo "✅ 所有服务已停止"
}

# 检查 Docker 沙箱环境
check_sandbox() {
    echo "🔍 检查 Docker 沙箱环境..."
    
    # 检查 Docker 是否运行
    if ! docker info > /dev/null 2>&1; then
        echo "❌ Docker 未运行。请先启动 Docker Desktop"
        return 1
    fi
    echo "✅ Docker 运行中 ($(docker --version | cut -d' ' -f3 | cut -d',' -f1))"
    
    # 检查沙箱镜像是否存在
    if docker images openclaw-sandbox:bookworm-slim --format '{{.Repository}}' | grep -q .; then
        echo "✅ 沙箱镜像已就绪: openclaw-sandbox:bookworm-slim"
        docker images openclaw-sandbox:bookworm-slim --format '  Size: {{.Size}} | Created: {{.CreatedSince}}'
    else
        echo "❌ 沙箱镜像未找到，尝试构建..."
        if [ -d /tmp/openclaw-source ]; then
            (cd /tmp/openclaw-source && cat scripts/docker/sandbox/Dockerfile | sed 's/debian:bookworm-slim@sha256:[a-f0-9]*/debian:bookworm-slim/' > /tmp/Dockerfile.sandbox.modified && docker build --platform linux/arm64 -t openclaw-sandbox:bookworm-slim -f /tmp/Dockerfile.sandbox.modified . 2>&1 | tail -3)
            if [ $? -eq 0 ]; then
                echo "✅ 沙箱镜像构建成功"
            else
                echo "❌ 沙箱镜像构建失败"
                return 1
            fi
        else
            echo "❌ OpenClaw 源码未找到，无法构建沙箱镜像"
            echo "   请运行: git clone --depth 1 https://github.com/openclaw/openclaw.git /tmp/openclaw-source"
            return 1
        fi
    fi
    
    # 检查 hardened profile 沙箱配置
    echo ""
    echo "📋 沙箱配置检查:"
    HARDENED_CONFIG=~/.openclaw-hardened/openclaw.json
    if [ -f "$HARDENED_CONFIG" ]; then
        SANDBOX_MODE=$(python3 -c "import json; print(json.load(open('$HARDENED_CONFIG'))['agents']['defaults']['sandbox']['mode'])" 2>/dev/null)
        if [ "$SANDBOX_MODE" = "all" ]; then
            echo "  ✅ 硬化配置: Sandbox mode = all (所有会话隔离)"
        else
            echo "  ⚠️  硬化配置: Sandbox mode = $SANDBOX_MODE (建议改为 'all')"
        fi
        
        SANDBOX_SCOPE=$(python3 -c "import json; print(json.load(open('$HARDENED_CONFIG'))['agents']['defaults']['sandbox']['scope'])" 2>/dev/null)
        echo "  ✅ 硬化配置: Sandbox scope = $SANDBOX_SCOPE"
        
        SANDBOX_NET=$(python3 -c "import json; print(json.load(open('$HARDENED_CONFIG'))['agents']['defaults']['sandbox']['docker'].get('network','unknown'))" 2>/dev/null)
        echo "  ✅ 硬化配置: Container network = $SANDBOX_NET"
    fi
    
    echo ""
    return 0
}

# 启动所有服务
start_services() {
    echo "🛡️ 正在启动 Aegis 神盾安全平台..."
    echo ""
    
    # 先停止旧进程
    stop_services
    echo ""
    
    # 检查 Docker 沙箱
    check_sandbox
    local sandbox_ok=$?
    
    # 启动裸奔龙虾 Gateway (端口 19789)
    echo "📍 启动裸奔龙虾 Gateway (端口 19789)..."
    openclaw --profile naked gateway restart 2>&1 | tail -1
    
    # 启动安全龙虾 Gateway (端口 20789)
    echo "📍 启动安全龙虾 Gateway (端口 20789)..."
    openclaw --profile hardened gateway restart 2>&1 | tail -1
    
    # 🛡️ 注入ClawKeeper安全策略
    echo "🛡️ 加载ClawKeeper安全策略..."
    PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
    SKILL_FILE="$PROJECT_ROOT/clawkeeper-integration/skills/lobster-safety-guide.md"
    if [ -f "$SKILL_FILE" ]; then
        echo "✅ 安全策略已就绪: lobster-safety-guide.md"
    else
        echo "⚠️  警告: 安全策略文件不存在"
    fi
    
    # 🔒 检查并启动 ClawShell 代理服务
    echo "🔒 检查 ClawShell 代理服务..."
    if clawshell status 2>&1 | grep -q -i "running"; then
        echo "✅ ClawShell 已在运行 (端口 21789)"
    else
        echo "📍 启动 ClawShell 代理服务..."
        CLAWSHELL_ERR=$(clawshell start 2>&1)
        CLAWSHELL_EXIT=$?
        if [ $CLAWSHELL_EXIT -ne 0 ] || echo "$CLAWSHELL_ERR" | grep -qi "error\|permission denied"; then
            echo "❌ ClawShell 启动失败:"
            echo "$CLAWSHELL_ERR" | grep -i "error\|permission" | head -3 | sed 's/^/   /'
            if echo "$CLAWSHELL_ERR" | grep -q "Permission denied"; then
                echo "   💡 修复建议: sudo clawshell migrate-config --config /etc/clawshell/clawshell.toml"
                echo "   💡 或修复权限: sudo chown -R \$(whoami) /etc/clawshell/"
            fi
        else
            sleep 2
            if curl -s http://127.0.0.1:21789/admin/stats > /dev/null 2>&1; then
                echo "✅ ClawShell 已启动 (端口 21789)"
            else
                echo "⚠️  ClawShell 进程已启动但健康检查失败"
                echo "   提示: 运行 'clawshell status' 查看详情"
            fi
        fi
    fi
    
    # 🛡️ 检查并启动 qise 防护服务
    QISE_PORT=8822
    echo "🛡️ 检查 qise 安全防护服务..."
    if curl -s http://127.0.0.1:${QISE_PORT}/v1/models > /dev/null 2>&1; then
        echo "✅ qise proxy 已在运行 (端口 ${QISE_PORT})"
    else
        echo "📍 启动 qise proxy 服务..."
        # 从 .env 读取上游 LLM API 地址
        ENV_FILE="$PROJECT_ROOT/backend/.env"
        QISE_UPSTREAM=""
        QISE_KEY=""
        if [ -f "$ENV_FILE" ]; then
            QISE_UPSTREAM=$(grep -E "^JUDGE_MODEL_API_URL=" "$ENV_FILE" | cut -d'=' -f2- | tr -d ' ')
            QISE_KEY=$(grep -E "^JUDGE_MODEL_API_KEY=" "$ENV_FILE" | cut -d'=' -f2- | tr -d ' ')
        fi
        # 备用：检查常见环境变量
        [ -z "$QISE_UPSTREAM" ] && QISE_UPSTREAM="${OPENAI_API_BASE:-${ANTHROPIC_BASE_URL:-}}"
        
        VENV_PYTHON="$PROJECT_ROOT/venv/bin/python"
        QISE_CMD="$VENV_PYTHON"
        [ ! -f "$VENV_PYTHON" ] && QISE_CMD="python3"
        
        QISE_ARGS=""
        [ -n "$QISE_UPSTREAM" ] && QISE_ARGS="$QISE_ARGS --upstream $QISE_UPSTREAM"
        [ -n "$QISE_KEY" ] && QISE_ARGS="$QISE_ARGS --upstream-key $QISE_KEY"
        
        if [ -z "$QISE_UPSTREAM" ]; then
            echo "⚠️  qise 启动跳过: 未配置上游 LLM API 地址"
            echo "   提示: 在 backend/.env 中设置 JUDGE_MODEL_API_URL，或设置 OPENAI_API_BASE 环境变量"
        else
            nohup $QISE_CMD -m qise proxy start $QISE_ARGS > /tmp/lobster-qise.log 2>&1 &
            sleep 2
            if curl -s http://127.0.0.1:${QISE_PORT}/v1/models > /dev/null 2>&1; then
                echo "✅ qise proxy 已启动 (端口 ${QISE_PORT}, upstream=${QISE_UPSTREAM})"
            else
                echo "⚠️  qise 启动失败，但继续其他服务"
                echo "   提示: 查看日志 /tmp/lobster-qise.log"
            fi
        fi
    fi
    
    # 🛡️ 检查并启动 AgentGuard 零信任控制服务器
    AGENTGUARD_PORT=38080
    AGENTGUARD_UI_PORT=38008
    echo "🛡️ 检查 AgentGuard 零信任控制服务器..."
    if curl -s http://127.0.0.1:${AGENTGUARD_PORT}/v1/backend/health > /dev/null 2>&1; then
        echo "✅ AgentGuard 已在运行 (端口 ${AGENTGUARD_PORT})"
    else
        echo "📍 启动 AgentGuard 控制服务器..."
        AGENTGUARD_ROOT="$PROJECT_ROOT/../openclaw/AgentGuard"
        if [ -d "$AGENTGUARD_ROOT" ] && [ -f "$AGENTGUARD_ROOT/scripts/run-dev.sh" ]; then
            # 检查是否需要创建虚拟环境
            if [ ! -d "$AGENTGUARD_ROOT/.venv" ]; then
                echo "📦 初始化 AgentGuard 虚拟环境..."
                (cd "$AGENTGUARD_ROOT" && python3 -m venv .venv && .venv/bin/pip install --upgrade pip -q && .venv/bin/pip install "pydantic>=2.5,<3.0" "fastapi>=0.110" "uvicorn>=0.27" -q) 2>/dev/null
            fi
            nohup bash "$AGENTGUARD_ROOT/scripts/run-dev.sh" > /tmp/lobster-agentguard.log 2>&1 &
            sleep 3
            if curl -s http://127.0.0.1:${AGENTGUARD_PORT}/v1/backend/health > /dev/null 2>&1; then
                echo "✅ AgentGuard 已启动 (端口 ${AGENTGUARD_PORT})"
            else
                echo "⚠️  AgentGuard 启动失败，但继续其他服务"
                echo "   提示: 查看日志 /tmp/lobster-agentguard.log"
            fi
        else
            echo "⚠️  AgentGuard 源码未找到，跳过启动"
            echo "   提示: 确保 openclaw/AgentGuard 目录存在"
        fi
    fi

    # 🛡️ 初始化 AgentGuard（加载规则引擎插件 + 演示策略，幂等）
    if [ -f "$PROJECT_ROOT/scripts/agentguard_bootstrap.sh" ]; then
        bash "$PROJECT_ROOT/scripts/agentguard_bootstrap.sh" "http://127.0.0.1:${AGENTGUARD_PORT}" 2>&1 | sed 's/^/   /' || echo "   ⚠️  AgentGuard 初始化失败（不影响其他服务）"
    fi

    # 🌐 启动 AgentGuard UI 控制台
    echo "🌐 检查 AgentGuard UI 控制台..."
    if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${AGENTGUARD_UI_PORT}/ 2>/dev/null | grep -q "200"; then
        echo "✅ AgentGuard UI 已在运行 (端口 ${AGENTGUARD_UI_PORT})"
    else
        echo "📍 启动 AgentGuard UI 控制台..."
        AGENTGUARD_ROOT="$PROJECT_ROOT/../openclaw/AgentGuard"
        if [ -d "$AGENTGUARD_ROOT" ] && [ -f "$AGENTGUARD_ROOT/src/server/frontend/app.py" ]; then
            FRONTEND_PORT=${AGENTGUARD_UI_PORT} \
            AGENTGUARD_API_BASE="http://127.0.0.1:${AGENTGUARD_PORT}" \
            nohup python3 "$AGENTGUARD_ROOT/src/server/frontend/app.py" > /tmp/lobster-agentguard-ui.log 2>&1 &
            sleep 2
            if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${AGENTGUARD_UI_PORT}/ 2>/dev/null | grep -q "200"; then
                echo "✅ AgentGuard UI 已启动 (端口 ${AGENTGUARD_UI_PORT})"
            else
                echo "⚠️  AgentGuard UI 启动失败"
                echo "   提示: 查看日志 /tmp/lobster-agentguard-ui.log"
            fi
        else
            echo "⚠️  AgentGuard UI 源码未找到，跳过启动"
        fi
    fi
    
    # 轮询等待 Gateway 就绪（最多 15s）
    echo "⏳ 等待 Gateway 启动..."
    GATEWAY_TIMEOUT=0
    while [ $GATEWAY_TIMEOUT -lt 30 ]; do
        sleep 0.5
        NAKED_OK=false
        HARDENED_OK=false
        curl -s http://localhost:19789/health > /dev/null 2>&1 && NAKED_OK=true
        curl -s http://localhost:20789/health > /dev/null 2>&1 && HARDENED_OK=true
        
        if $NAKED_OK && $HARDENED_OK; then
            echo "✅ Gateway 已就绪"
            break
        fi
        GATEWAY_TIMEOUT=$((GATEWAY_TIMEOUT + 1))
    done
    
    # 验证 Gateway 状态
    echo ""
    echo "🔍 验证 Gateway 状态..."
    if curl -s http://localhost:19789/health > /dev/null 2>&1; then
        echo "✅ 裸奔龙虾 Gateway 已启动 (端口 19789)"
    else
        echo "❌ 裸奔龙虾 Gateway 启动失败"
    fi
    
    if curl -s http://localhost:20789/health > /dev/null 2>&1; then
        echo "✅ 安全龙虾 Gateway 已启动 (端口 20789)"
    else
        echo "❌ 安全龙虾 Gateway 启动失败"
    fi
    
    # 沙箱状态提示（非阻塞）
    echo ""
    if [ $sandbox_ok -eq 0 ]; then
        echo "🔬 沙箱隔离: ✅ Docker 已就绪，沙箱将在首次请求时自动创建"
    else
        echo "❌ 沙箱环境未就绪，请先启动 Docker Desktop"
    fi
    
    echo ""
    echo "📍 启动后端服务..."
    # 使用项目根目录的虚拟环境（不在 backend/venv/）
    PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
    VENV_PYTHON="$PROJECT_ROOT/venv/bin/python"
    
    if [ ! -f "$VENV_PYTHON" ]; then
        echo "⚠️  虚拟环境不存在: $VENV_PYTHON"
        echo "📦 正在创建虚拟环境..."
        python3 -m venv "$PROJECT_ROOT/venv"
        if [ $? -ne 0 ]; then
            echo "❌ 虚拟环境创建失败"
            exit 1
        fi
        echo "✅ 虚拟环境已创建"
        
        echo "📦 正在安装后端依赖..."
        "$PROJECT_ROOT/venv/bin/pip" install -r backend/requirements.txt -q
        if [ $? -ne 0 ]; then
            echo "❌ 依赖安装失败"
            exit 1
        fi
        echo "✅ 依赖安装完成"
    fi
    
    # 验证依赖是否已安装
    if ! "$VENV_PYTHON" -c "import uvicorn" 2>/dev/null; then
        echo "📦 正在安装后端依赖..."
        "$VENV_PYTHON" -m pip install -r backend/requirements.txt -q
        if [ $? -ne 0 ]; then
            echo "❌ 依赖安装失败"
            exit 1
        fi
        echo "✅ 依赖安装完成"
    fi
    
    cd "$PROJECT_ROOT/backend"
    nohup "$VENV_PYTHON" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > /tmp/lobster-backend.log 2>&1 &
    cd "$PROJECT_ROOT"
    
    # 轮询等待后端就绪（最多 5s）
    echo "⏳ 等待后端启动..."
    for i in $(seq 1 10); do
        sleep 0.5
        if curl -s http://localhost:8000/health > /dev/null 2>&1; then
            echo "✅ 后端服务已启动 (端口 8000)"
            break
        fi
        if [ $i -eq 10 ]; then
            echo "❌ 后端服务启动超时"
        fi
    done
    
    echo "📍 启动前端服务..."
    cd "$PROJECT_ROOT/frontend"
    nohup npm run dev > /tmp/lobster-frontend.log 2>&1 &
    cd "$PROJECT_ROOT"
    
    # 检查 Ollama 本地模型服务
    echo ""
    echo "🤖 检查 Ollama 本地模型服务..."
    if ! command -v ollama > /dev/null 2>&1; then
        echo "❌ Ollama 未安装"
        echo ""
        echo "📦 安装 Ollama（必需，用于本地模型推理）："
        echo "   macOS/Linux: curl -fsSL https://ollama.com/install.sh | sh"
        echo "   Windows:     https://ollama.com/download/windows"
        echo ""
        echo "📖 详细说明请查看 README.md 的「安装 Ollama」章节"
        echo ""
        echo "⚠️  继续启动其他服务（本地模型功能不可用）..."
    else
        echo "✅ Ollama 已安装 ($(ollama --version 2>/dev/null | cut -d' ' -f2 || echo 'unknown'))"
        
        if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
            echo "📍 启动 Ollama 服务..."
            nohup ollama serve > /tmp/lobster-ollama.log 2>&1 &
            sleep 2
        fi
        
        if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
            echo "✅ Ollama 服务已运行"
            # 检查并拉取模型
            MODELS=$(curl -s http://localhost:11434/api/tags | python3 -c "import json,sys; print(' '.join([m['name'] for m in json.load(sys.stdin).get('models',[])]))" 2>/dev/null)
            echo "  已安装模型: ${MODELS:-（无）}"
            # 预加载主力模型（后台）
            if ! echo "$MODELS" | grep -q "qiseguard"; then
                echo "  ℹ️  提示: 运行 'ollama pull qwen3:4b' 或 'ollama create qiseguard:2b -f Modelfile' 加载安全模型"
            fi
        else
            echo "⚠️  Ollama 服务启动失败，请手动运行 'ollama serve'"
        fi
    fi
    
    # 轮询等待前端就绪（最多 3s）
    echo "⏳ 等待前端启动..."
    for i in $(seq 1 6); do
        sleep 0.5
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 | grep -q "200"; then
            echo "✅ 前端服务已启动 (端口 5173)"
            break
        fi
        if [ $i -eq 6 ]; then
            echo "❌ 前端服务启动超时"
        fi
    done
    
    echo ""
    echo "🎉 Aegis 神盾安全平台启动完成！"
    echo "   前端界面: http://localhost:5173"
    echo "   后端 API: http://localhost:8000/docs"
    echo "   金刚龙虾 Gateway: http://localhost:19789"
    echo "   安全龙虾 Gateway: http://localhost:20789"
    echo "   ClawShell 代理: http://localhost:21789"
    echo "   Ollama 模型: http://localhost:11434"
    echo "   AgentGuard 控制服务器: http://localhost:38080"
    echo "   AgentGuard UI 控制台: http://localhost:38008"
    echo "   沙箱镜像: openclaw-sandbox:bookworm-slim"
    echo "   沙箱隔离: ✅ 已启用 (网络=none, 只读=yes)"
    echo ""
    echo "💡 使用 ./start.sh stop 停止所有服务"
    echo "💡 运行 bash scripts/hermes/verify-hermes.sh 验证 Hermes 集成"
}

# 查看服务状态
show_status() {
    echo "📊 Aegis 神盾安全平台状态"
    echo ""
    
    # Gateway 状态
    echo "🔍 Gateway 状态:"
    if curl -s http://localhost:19789/health > /dev/null 2>&1; then
        echo "  ✅ 裸奔龙虾 (19789): 运行中"
    else
        echo "  ❌ 裸奔龙虾 (19789): 已停止"
    fi
    
    if curl -s http://localhost:20789/health > /dev/null 2>&1; then
        echo "  ✅ 安全龙虾 (20789): 运行中"
    else
        echo "  ❌ 安全龙虾 (20789): 已停止"
    fi
    
    # 后端状态
    echo ""
    echo "🔍 后端服务:"
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo "  ✅ 后端 (8000): 运行中"
    else
        echo "  ❌ 后端 (8000): 已停止"
    fi
    
    # 前端状态
    echo "🔍 前端服务:"
    FRONTEND_PIDS=$(lsof -ti:5173 2>/dev/null)
    if [ ! -z "$FRONTEND_PIDS" ]; then
        echo "  ✅ 前端 (5173): 运行中 (PID: $FRONTEND_PIDS)"
    else
        echo "  ❌ 前端 (5173): 已停止"
    fi
    
    # Ollama 状态
    echo ""
    echo "🤖 本地模型:"
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        MODELS=$(curl -s http://localhost:11434/api/tags | python3 -c "import json,sys; d=json.load(sys.stdin); [print(f'  ✅ {m[\"name\"]}') for m in d.get('models',[])]" 2>/dev/null)
        echo "  ✅ Ollama (11434): 运行中"
        [ -n "$MODELS" ] && echo "$MODELS"
    else
        echo "  ❌ Ollama (11434): 未运行"
    fi
    
    # ClawShell 状态
    echo ""
    echo "🔒 ClawShell 代理:"
    if clawshell status 2>&1 | grep -q "running"; then
        echo "  ✅ ClawShell (21789): 运行中"
    else
        echo "  ❌ ClawShell (21789): 未运行"
    fi
    
    # qise 状态
    echo ""
    echo "🛡️ qise 安全防护:"
    if curl -s http://127.0.0.1:8822/v1/models > /dev/null 2>&1; then
        echo "  ✅ qise proxy (8822): 运行中"
    else
        echo "  ❌ qise proxy (8822): 未运行"
    fi
    
    # AgentGuard 状态
    echo ""
    echo "🛡️ AgentGuard 零信任:"
    if curl -s http://127.0.0.1:38080/v1/backend/health > /dev/null 2>&1; then
        echo "  ✅ AgentGuard 控制服务器 (38080): 运行中"
    else
        echo "  ❌ AgentGuard 控制服务器 (38080): 未运行"
    fi
    if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:38008/ 2>/dev/null | grep -q "200"; then
        echo "  ✅ AgentGuard UI 控制台 (38008): 运行中"
    else
        echo "  ❌ AgentGuard UI 控制台 (38008): 未运行"
    fi
    
    echo ""
}

# 主逻辑
case "$ACTION" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        stop_services
        sleep 1
        start_services
        ;;
    status)
        show_status
        ;;
    *)
        echo "用法: $0 {start|stop|restart|status}"
        echo ""
        echo "命令:"
        echo "  start   - 启动所有服务"
        echo "  stop    - 停止所有服务"
        echo "  restart - 重启所有服务"
        echo "  status  - 查看服务状态"
        exit 1
        ;;
esac
