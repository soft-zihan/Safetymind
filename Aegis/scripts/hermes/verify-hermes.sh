#!/bin/bash
# 验证各组件对 Hermes 的集成状态

echo "==================================================================="
echo "          铁翼信使 (Hermes) 安全集成验证报告"
echo "==================================================================="
echo ""
echo "验证时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 计数器
TOTAL=0
PASSED=0
FAILED=0
WARNINGS=0

check() {
    local name=$1
    local cmd=$2
    local critical=${3:-true}
    TOTAL=$((TOTAL + 1))
    
    if eval "$cmd" &>/dev/null; then
        echo -e "  ${GREEN}✓${NC} $name"
        PASSED=$((PASSED + 1))
        return 0
    else
        if [ "$critical" = "true" ]; then
            echo -e "  ${RED}✗${NC} $name"
            FAILED=$((FAILED + 1))
        else
            echo -e "  ${YELLOW}⚠️${NC} $name (可选)"
            WARNINGS=$((WARNINGS + 1))
        fi
        return 1
    fi
}

section() {
    echo ""
    echo -e "${BLUE}── $1 ──${NC}"
}

SAFETYHERMES_PATH="/Users/han/Documents/projects/Safetymind/hermes"
ADAMANTINE_PATH="/Users/han/Documents/projects/Safetymind/Aegis"

# ============================================================
section "1. 上游仓库状态 (9 个)"
# ============================================================

echo ""
check "hermes-example-plugins" "test -d $SAFETYHERMES_PATH/hermes-example-plugins" false
check "hermes-plugins" "test -d $SAFETYHERMES_PATH/hermes-plugins"
check "evey-setup" "test -d $SAFETYHERMES_PATH/evey-setup"
check "hermes-labyrinth" "test -d $SAFETYHERMES_PATH/hermes-labyrinth"
check "NemoClaw" "test -d $SAFETYHERMES_PATH/NemoClaw"
check "agent-vault" "test -d $SAFETYHERMES_PATH/agent-vault"
check "icarus-plugin" "test -d $SAFETYHERMES_PATH/icarus-plugin"
check "openclaw-security-assistant" "test -d $SAFETYHERMES_PATH/openclaw-security-assistant"
check "pipelock" "test -d $SAFETYHERMES_PATH/pipelock"

# ============================================================
section "2. 基础环境"
# ============================================================

echo ""
check "Hermes CLI" "command -v hermes" false
check "Hermes 配置" "test -f ~/.hermes/config.yaml" false
check "Hermes 插件目录" "test -d ~/.hermes/plugins" false
check "Python 3" "command -v python3"
check "Node.js" "command -v node" false
check "Docker" "command -v docker" false

# ============================================================
section "3. ClawShell 安全代理"
# ============================================================

echo ""
check "ClawShell 已安装" "command -v clawshell" false
check "ClawShell 运行中" "curl -s http://127.0.0.1:18790/admin/stats" false
check "Hermes 指向 ClawShell" "grep -q 'localhost:18790' ~/.hermes/config.yaml 2>/dev/null" false

if [ -f "$HOME/.hermes/config.yaml" ]; then
    echo ""
    echo -e "  ${BLUE}📄${NC} Hermes 配置摘要:"
    grep -E '(base_url|api_key|proxy)' ~/.hermes/config.yaml 2>/dev/null | head -5 | sed 's/^/     /'
fi

# ============================================================
section "4. Qise 安全防护"
# ============================================================

echo ""
check "Qise Python 包" "python3 -c 'import qise'" false
check "Qise Proxy 运行中" "curl -s http://localhost:8822/health" false
check "Hermes Adapter" "python3 -c 'from qise.adapters.hermes import QiseHermesAdapter'" false
check "Shield 配置" "test -f ~/.hermes/shield.yaml" false

# ============================================================
section "5. NemoClaw 沙箱"
# ============================================================

echo ""
check "NemoClaw 目录" "test -d $SAFETYHERMES_PATH/NemoClaw"
check "Docker 运行中" "docker info" false

if [ -d "$SAFETYHERMES_PATH/NemoClaw" ]; then
    echo -e "  ${GREEN}✓${NC} NemoClaw 仓库大小: $(du -sh $SAFETYHERMES_PATH/NemoClaw 2>/dev/null | cut -f1)"
fi

# ============================================================
section "6. Agent Vault 凭据管理"
# ============================================================

echo ""
check "Agent Vault 目录" "test -d $SAFETYHERMES_PATH/agent-vault"
check "Agent Vault 运行中" "curl -s http://localhost:8080/health" false

if [ -d "$SAFETYHERMES_PATH/agent-vault" ]; then
    echo -e "  ${GREEN}✓${NC} Agent Vault 仓库大小: $(du -sh $SAFETYHERMES_PATH/agent-vault 2>/dev/null | cut -f1)"
fi

# ============================================================
section "7. Aegis 后端 API (金刚龙虾)"
# ============================================================

echo ""
check "Aegis 后端可访问" "curl -s http://localhost:8000/docs" false
check "Hermes 状态 API" "curl -s http://localhost:8000/api/hermes/status" false
check "安全评分 API" "curl -s http://localhost:8000/api/security/compare" false

# ============================================================
section "8. 集成脚本"
# ============================================================

echo ""
HERMES_SCRIPTS="$ADAMANTINE_PATH/scripts/hermes"
check "connect-clawshell.sh" "test -x $HERMES_SCRIPTS/connect-clawshell.sh"
check "connect-qise.sh" "test -x $HERMES_SCRIPTS/connect-qise.sh"
check "connect-nemoclaw.sh" "test -x $HERMES_SCRIPTS/connect-nemoclaw.sh"
check "connect-agent-vault.sh" "test -x $HERMES_SCRIPTS/connect-agent-vault.sh"
check "verify-hermes.sh" "test -x $HERMES_SCRIPTS/verify-hermes.sh"

# ============================================================
# 汇总报告
# ============================================================
echo ""
echo "==================================================================="
echo "                        验证汇总"
echo "==================================================================="
echo ""
echo -e "  总检查项:  ${BLUE}$TOTAL${NC}"
echo -e "  通过:      ${GREEN}$PASSED${NC}"
echo -e "  失败:      ${RED}$FAILED${NC}"
echo -e "  警告:      ${YELLOW}$WARNINGS${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "  ${GREEN}✅ 所有关键检查通过！${NC}"
    echo ""
    echo "  建议操作："
    echo "    1. 运行 connect-*.sh 脚本完成各组件集成"
    echo "    2. 启动 Aegis 后端: cd $ADAMANTINE_PATH/backend && python -m uvicorn app.main:app --reload"
    echo "    3. 启动前端: cd $ADAMANTINE_PATH/frontend && npm run dev"
    echo "    4. 访问 http://localhost:5173 查看安全平台界面"
else
    echo -e "  ${RED}❌ 存在 $FAILED 个失败项${NC}"
    echo ""
    echo "  建议操作："
    echo "    1. 检查上述标记为 ✗ 的项目"
    echo "    2. 运行对应的 connect-*.sh 脚本进行集成"
    echo "    3. 确保所有依赖服务已安装并启动"
fi

echo ""
echo "==================================================================="
echo "                     验证完成"
echo "==================================================================="
echo ""
