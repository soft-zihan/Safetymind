#!/bin/bash
# 配置 Infisical Agent Vault 凭据代理

set -e

echo "========================================="
echo "  铁翼信使 × Agent Vault 凭据管理集成"
echo "========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SAFETYHERMES_PATH="/Users/han/Documents/projects/Safetymind/SafetyHermes"
VAULT_PATH="$SAFETYHERMES_PATH/agent-vault"

# 1. 检查 agent-vault 仓库
echo "检查 Agent Vault 仓库..."
if [ ! -d "$VAULT_PATH" ]; then
    echo -e "${RED}❌${NC} agent-vault 目录不存在"
    echo ""
    echo "Clone agent-vault 仓库："
    echo "  cd $SAFETYHERMES_PATH"
    echo "  git clone --depth 1 https://github.com/Infisical/agent-vault.git"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓${NC} agent-vault 目录存在: $VAULT_PATH"

# 检查关键文件
if [ -f "$VAULT_PATH/README.md" ]; then
    echo -e "${GREEN}✓${NC} README.md 存在"
else
    echo -e "${YELLOW}⚠️${NC} README.md 不存在"
fi

if [ -f "$VAULT_PATH/package.json" ] || [ -f "$VAULT_PATH/pyproject.toml" ]; then
    echo -e "${GREEN}✓${NC} 项目配置文件存在"
else
    echo -e "${YELLOW}⚠️${NC} 未找到项目配置文件"
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
    echo -e "${YELLOW}⚠️${NC} Docker 未安装（Agent Vault 通常需要 Docker）"
    echo ""
    echo "安装 Docker："
    echo "  访问 https://www.docker.com/products/docker-desktop/"
    echo ""
fi

echo ""

# 3. Agent Vault 启动步骤
echo "========================================="
echo -e "${YELLOW}Agent Vault 启动步骤${NC}"
echo "========================================="
echo ""
echo "步骤 1: 查看文档"
echo "  cd $VAULT_PATH"
echo "  cat README.md"
echo ""
echo "步骤 2: 安装依赖"
echo "  cd $VAULT_PATH"
echo "  # 如果是 Node.js 项目："
echo "  npm install"
echo "  # 如果是 Python 项目："
echo "  pip install -e ."
echo ""
echo "步骤 3: 配置 Vault"
echo "  创建配置文件："
echo "  cat > vault-config.yaml << 'EOF'"
echo "vault:"
echo "  port: 8080"
echo "  host: localhost"
echo "  encryption:"
echo "    algorithm: aes-256-gcm"
echo "    key_file: ~/.agent-vault/encryption.key"
echo "  storage:"
echo "    type: file"
echo "    path: ~/.agent-vault/data"
echo "EOF"
echo ""
echo "步骤 4: 启动 Vault 服务"
echo "  cd $VAULT_PATH"
echo "  # 根据实际项目结构调整"
echo "  npm start -- --config vault-config.yaml"
echo "  # 或"
echo "  python -m agent_vault.server --config vault-config.yaml"
echo ""
echo "或使用 Docker："
echo "  docker-compose up -d"
echo ""

echo "========================================="
echo -e "${YELLOW}验证 Vault 运行状态${NC}"
echo "========================================="
echo ""
echo "检查 Vault 健康状态："
echo "  curl http://localhost:8080/health"
echo ""
if curl -s http://localhost:8080/health &>/dev/null; then
    echo -e "${GREEN}✓${NC} Agent Vault 正在运行 (localhost:8080)"
else
    echo -e "${YELLOW}⚠️${NC} Agent Vault 未运行"
fi

echo ""

# 4. 密钥配置流程
echo "========================================="
echo -e "${YELLOW}密钥配置流程${NC}"
echo "========================================="
echo ""
echo "关键原则：Agent 按名称引用密钥，永远看不到实际值"
echo ""
echo "配置步骤："
echo ""
echo "1. 存储密钥到 Vault"
echo "  使用 Vault CLI 或 API："
echo "  curl -X POST http://localhost:8080/secrets \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{"
echo "      \"name\": \"slack-token\","
echo "      \"value\": \"xoxb-your-token\","
echo "      \"project\": \"hermes-agent\""
echo "    }'"
echo ""
echo "2. 在 Agent 配置中引用密钥"
echo "  编辑 Hermes 配置："
echo "  credentials:"
echo "    slack: \${vault:slack-token}"
echo "    database: \${vault:db-password}"
echo "    openai: \${vault:openai-api-key}"
echo ""
echo "3. 配置访问控制"
echo "  确保只有授权的 Agent 可以访问特定密钥"
echo "  在 Vault 中设置 ACL："
echo "  - Agent A 可以访问: slack-token, openai-api-key"
echo "  - Agent B 可以访问: db-password, openai-api-key"
echo ""

# 5. 与 Hermes 集成
echo "========================================="
echo -e "${YELLOW}与 Hermes 集成${NC}"
echo "========================================="
echo ""
echo "配置 Hermes 通过 Vault 代理发送 API 请求："
echo ""
echo "在 ~/.hermes/config.yaml 中添加："
echo "  vault:"
echo "    enabled: true"
echo "    endpoint: http://localhost:8080"
echo "    timeout: 5s"
echo "    retry: 3"
echo ""
echo "或使用环境变量："
echo "  export HERMES_VAULT_ENDPOINT=http://localhost:8080"
echo "  export HERMES_VAULT_ENABLED=true"
echo ""

echo "========================================="
echo -e "${GREEN}=== 集成检查完成 ===${NC}"
echo "========================================="
echo ""
echo "后续步骤："
echo "  1. 启动 Agent Vault 服务"
echo "  2. 存储所需密钥到 Vault"
echo "  3. 配置 Hermes 使用 Vault 凭据"
echo "  4. 运行 verify-hermes.sh 进行完整验证"
echo ""
