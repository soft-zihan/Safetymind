#!/bin/bash
# 将 Hermes 接入 ClawShell 安全代理
# ClawShell 已原生支持 Hermes（hermes_cli.rs + OnboardTarget::Hermes）

set -e

echo "========================================="
echo "  铁翼信使 × ClawShell 安全代理集成"
echo "========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. 检查 clawshell 是否已安装
if ! command -v clawshell &> /dev/null; then
    echo -e "${RED}❌ ClawShell 未安装${NC}"
    echo ""
    echo "安装步骤："
    echo "  1. 从源码编译（推荐）："
    echo "     cd ~/clawshell && cargo build --release"
    echo "     sudo cp target/release/clawshell /usr/local/bin/"
    echo ""
    echo "  2. 或使用 npm 安装："
    echo "     npm install -g @anthropic/clawshell"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓${NC} ClawShell 已安装: $(command -v clawshell)"
echo "  版本: $(clawshell --version 2>/dev/null || echo '未知')"
echo ""

# 2. 检查 ClawShell 是否正在运行
if curl -s http://127.0.0.1:18790/admin/stats &>/dev/null; then
    echo -e "${GREEN}✓${NC} ClawShell 代理正在运行 (localhost:18790)"
else
    echo -e "${YELLOW}⚠️${NC} ClawShell 代理未运行"
    echo ""
    echo "启动 ClawShell："
    echo "  clawshell start --profile hermes"
    echo ""
fi

# 3. 运行 onboard 向导（目标 Hermes）
echo "正在检查 Hermes 接入配置..."
if [ -f "$HOME/.hermes/config.yaml" ]; then
    echo -e "${GREEN}✓${NC} Hermes 配置文件存在: $HOME/.hermes/config.yaml"
else
    echo -e "${YELLOW}⚠️${NC} Hermes 配置文件不存在，将运行 onboard 向导..."
    echo ""
    echo "运行 Hermes 接入向导（交互式）："
    echo "  clawshell onboard --target hermes"
    echo ""
    # 取消下面的注释以实际运行
    # clawshell onboard --target hermes
fi

# 4. 验证 Hermes 配置已指向 ClawShell 代理
if grep -q "localhost:18790" ~/.hermes/config.yaml 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Hermes 已配置为通过 ClawShell 代理"
else
    echo -e "${YELLOW}⚠️${NC} Hermes 配置未指向 ClawShell"
    echo ""
    echo -e "${YELLOW}手动配置指南：${NC}"
    echo "  编辑 ~/.hermes/config.yaml，添加或修改："
    echo ""
    echo "  proxy:"
    echo "    base_url: http://localhost:18790/v1"
    echo "    api_key: your-api-key-here"
    echo ""
fi

# 5. 测试连接
echo ""
echo "测试 ClawShell 代理连接..."
if curl -s http://127.0.0.1:18790/admin/stats &>/dev/null; then
    echo -e "${GREEN}✓${NC} ClawShell 代理响应正常"
    echo ""
    echo "代理统计信息："
    curl -s http://127.0.0.1:18790/admin/stats | head -20
else
    echo -e "${YELLOW}⚠️${NC} 无法连接到 ClawShell 代理（可能未启动）"
fi

echo ""
echo "========================================="
echo -e "${GREEN}=== 集成检查完成 ===${NC}"
echo "========================================="
echo ""
echo "后续步骤："
echo "  1. 确保 ClawShell 代理正在运行"
echo "  2. 验证 Hermes CLI 可以正常工作"
echo "  3. 运行 verify-hermes.sh 进行完整验证"
echo ""
