#!/bin/bash
# 配置 NemoClaw OpenShell 沙箱

set -e

echo "========================================="
echo "  铁翼信使 × NemoClaw 沙箱集成"
echo "========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SAFETYHERMES_PATH="/Users/han/Documents/projects/Safetymind/SafetyHermes"
NEMOCLAW_PATH="$SAFETYHERMES_PATH/NemoClaw"

# 1. 检查 NemoClaw 仓库
echo "检查 NemoClaw 仓库..."
if [ ! -d "$NEMOCLAW_PATH" ]; then
    echo -e "${RED}❌${NC} NemoClaw 目录不存在"
    echo ""
    echo "Clone NemoClaw 仓库："
    echo "  cd $SAFETYHERMES_PATH"
    echo "  git clone --depth 1 https://github.com/NVIDIA/NemoClaw.git"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓${NC} NemoClaw 目录存在: $NEMOCLAW_PATH"

# 检查关键文件
if [ -f "$NEMOCLAW_PATH/README.md" ]; then
    echo -e "${GREEN}✓${NC} README.md 存在"
else
    echo -e "${YELLOW}⚠️${NC} README.md 不存在"
fi

if [ -d "$NEMOCLAW_PATH/openshell" ] || [ -d "$NEMOCLAW_PATH/sandbox" ]; then
    echo -e "${GREEN}✓${NC} OpenShell/Sandbox 目录存在"
else
    echo -e "${YELLOW}⚠️${NC} 未找到 OpenShell/Sandbox 目录"
fi

echo ""

# 2. 检查 Docker 环境
echo "检查 Docker 环境..."
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓${NC} Docker 已安装: $(docker --version)"
    if docker info &>/dev/null; then
        echo -e "${GREEN}✓${NC} Docker 守护进程正在运行"
    else
        echo -e "${YELLOW}⚠️${NC} Docker 守护进程未运行，请启动 Docker Desktop"
    fi
else
    echo -e "${YELLOW}⚠️${NC} Docker 未安装"
    echo ""
    echo "安装 Docker："
    echo "  访问 https://www.docker.com/products/docker-desktop/"
    echo ""
fi

echo ""

# 3. OpenShell 沙箱配置步骤
echo "========================================="
echo -e "${YELLOW}OpenShell 沙箱配置步骤${NC}"
echo "========================================="
echo ""
echo "步骤 1: 查看 NemoClaw 文档"
echo "  cd $NEMOCLAW_PATH"
echo "  cat README.md"
echo ""
echo "步骤 2: 构建 OpenShell Docker 镜像"
echo "  cd $NEMOCLAW_PATH"
echo "  # 根据 README 中的指引构建镜像"
echo "  # 通常类似："
echo "  docker build -t openshell:latest -f openshell/Dockerfile ."
echo ""
echo "步骤 3: 配置沙箱环境"
echo "  编辑沙箱配置文件（示例）："
echo "  cat > openshell-config.yaml << 'EOF'"
echo "sandbox:"
echo "  image: openshell:latest"
echo "  network: isolated"
echo "  resources:"
echo "    memory: 2G"
echo "    cpu: 1"
echo "  volumes:"
echo "    - type: tmpfs"
echo "      target: /tmp"
echo "EOF"
echo ""

# 4. 凭据隔离配置
echo "========================================="
echo -e "${YELLOW}凭据隔离配置${NC}"
echo "========================================="
echo ""
echo "关键原则：Agent 不应直接访问敏感凭据"
echo ""
echo "配置步骤："
echo "  1. 使用 Agent Vault 管理凭据"
echo "     ./connect-agent-vault.sh"
echo ""
echo "  2. 配置 NemoClaw 凭据代理"
echo "     在 NemoClaw 配置中设置："
echo "     credentials:"
echo "       provider: agent-vault"
echo "       endpoint: http://localhost:8080"
echo ""
echo "  3. 确保以下凭据对 Agent 不可见："
echo "     - Slack tokens"
echo "     - Outlook API keys"
echo "     - Database passwords"
echo "     - Cloud provider credentials"
echo ""

# 5. 启动 NemoClaw
echo "========================================="
echo -e "${YELLOW}启动 NemoClaw 守护进程${NC}"
echo "========================================="
echo ""
echo "启动命令（示例）："
echo "  cd $NEMOCLAW_PATH"
echo "  # 根据实际项目结构调整"
echo "  python -m nemoclaw.daemon start --config config.yaml"
echo ""
echo "或使用 Docker Compose："
echo "  docker-compose up -d"
echo ""

echo "========================================="
echo -e "${GREEN}=== 集成检查完成 ===${NC}"
echo "========================================="
echo ""
echo "后续步骤："
echo "  1. 完成 OpenShell 沙箱构建"
echo "  2. 配置凭据隔离"
echo "  3. 启动 NemoClaw 守护进程"
echo "  4. 运行 verify-hermes.sh 进行完整验证"
echo ""
