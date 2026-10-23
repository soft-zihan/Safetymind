#!/bin/bash
# 将 Hermes 接入 qise 安全防护

set -e

echo "========================================="
echo "  铁翼信使 × Qise 安全防护集成"
echo "========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

QISE_PATH="/Users/han/Documents/projects/Safetymind/qise"

# 1. 检查 qise 是否已安装
echo "检查 Qise 安装状态..."
if [ -d "$QISE_PATH" ]; then
    echo -e "${GREEN}✓${NC} Qise 源码目录存在: $QISE_PATH"
else
    echo -e "${RED}❌${NC} Qise 目录不存在: $QISE_PATH"
    echo ""
    echo "请先 clone Qise 仓库："
    echo "  cd ~/Documents/projects/Safetymind"
    echo "  git clone https://github.com/your-org/qise.git"
    echo ""
    exit 1
fi

# 检查 Python 导入
if python3 -c "import qise" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Qise Python 包已安装"
    QISE_VERSION=$(python3 -c "import qise; print(getattr(qise, '__version__', '未知'))" 2>/dev/null || echo "未知")
    echo "  版本: $QISE_VERSION"
else
    echo -e "${YELLOW}⚠️${NC} Qise Python 包未安装，正在安装..."
    echo ""
    echo "执行: pip3 install -e $QISE_PATH"
    pip3 install -e "$QISE_PATH" 2>&1 | tail -5
    
    if python3 -c "import qise" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Qise 安装成功"
    else
        echo -e "${RED}❌${NC} Qise 安装失败"
        echo ""
        echo "手动安装步骤："
        echo "  cd $QISE_PATH"
        echo "  pip3 install -e ."
        echo ""
        exit 1
    fi
fi

echo ""

# 2. 检查 Qise Hermes Adapter
echo "检查 Qise Hermes Adapter..."
if python3 -c "from qise.adapters.hermes import QiseHermesAdapter" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} QiseHermesAdapter 可用"
else
    echo -e "${YELLOW}⚠️${NC} QiseHermesAdapter 不可用"
    echo ""
    echo "可能原因："
    echo "  1. Qise 版本过旧，请更新：pip install -e $QISE_PATH --upgrade"
    echo "  2. Adapter 模块路径变更，请检查 qise/adapters/ 目录"
    echo ""
fi

# 3. 配置 Qise Shield
echo ""
echo "配置 Qise Shield 环境变量..."
export QISE_SHIELD_CONFIG="$HOME/.hermes/shield.yaml"
echo -e "${GREEN}✓${NC} QISE_SHIELD_CONFIG=$QISE_SHIELD_CONFIG"

# 生成默认 shield 配置
if [ ! -f "$HOME/.hermes/shield.yaml" ]; then
    echo -e "${YELLOW}⚠️${NC} Shield 配置文件不存在，生成默认配置..."
    mkdir -p "$HOME/.hermes"
    cat > "$HOME/.hermes/shield.yaml" << 'EOF'
# Qise Shield 配置 - Hermes 模式
mode: hermes

# 安全检查
checks:
  prompt_injection: true
  data_leakage: true
  credential_protection: true
  sandbox_enforcement: true
  
# 日志
logging:
  level: info
  file: ~/.hermes/shield.log
EOF
    echo -e "${GREEN}✓${NC} 已生成默认配置: $HOME/.hermes/shield.yaml"
else
    echo -e "${GREEN}✓${NC} Shield 配置文件已存在"
fi

# 4. 检查 Qise Proxy
echo ""
echo "检查 Qise Proxy 状态..."
if curl -s http://localhost:8822/health &>/dev/null; then
    echo -e "${GREEN}✓${NC} Qise Proxy 正在运行 (localhost:8822)"
    echo ""
    echo "健康检查："
    curl -s http://localhost:8822/health
else
    echo -e "${YELLOW}⚠️${NC} Qise Proxy 未运行"
    echo ""
    echo "启动 Qise Proxy："
    echo "  cd $QISE_PATH"
    echo "  python -m qise.proxy.server --port 8822"
    echo ""
fi

# 5. 提供配置指南
echo "========================================="
echo -e "${GREEN}=== 集成检查完成 ===${NC}"
echo "========================================="
echo ""
echo -e "${YELLOW}推荐配置方式：${NC}"
echo ""
echo "方式 1: Proxy 模式（推荐）"
echo "  设置环境变量："
echo "    export OPENAI_API_BASE=http://localhost:8822/v1"
echo "    export OPENAI_API_KEY=your-api-key"
echo ""
echo "方式 2: SDK 集成模式"
echo "  在 Python 代码中："
echo "    from qise.adapters.hermes import QiseHermesAdapter"
echo "    adapter = QiseHermesAdapter(shield_config='~/.hermes/shield.yaml')"
echo "    adapter.protect_hermes_session()"
echo ""
echo "后续步骤："
echo "  1. 启动 Qise Proxy（如果使用 proxy 模式）"
echo "  2. 配置 Hermes 通过 Qise 代理发送请求"
echo "  3. 运行 verify-hermes.sh 进行完整验证"
echo ""
