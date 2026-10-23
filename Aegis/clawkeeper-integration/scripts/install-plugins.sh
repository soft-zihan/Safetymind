#!/bin/bash
set -euo pipefail

# ClawKeeper Plugin安装脚本
# 安装ClawKeeper Plugin和Watcher Plugin到安全龙虾Gateway

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CLAWKEEPER_DIR="$PROJECT_ROOT/ClawKeeper"

echo "🛡️ 开始安装ClawKeeper Plugin..."

# 1. 安装Clawkeeper Plugin
echo ""
echo "📦 安装Clawkeeper Plugin..."
cd "$CLAWKEEPER_DIR/clawkeeper-plugin"
npx openclaw plugins install -l . --dangerously-force-unsafe-install

if [ $? -eq 0 ]; then
    echo "✅ Clawkeeper Plugin安装成功"
else
    echo "❌ Clawkeeper Plugin安装失败"
    exit 1
fi

# 2. 安装Clawkeeper-Watcher Plugin  
echo ""
echo "📦 安装Clawkeeper-Watcher Plugin..."
cd "$CLAWKEEPER_DIR/clawkeeper-watcher/plugins/clawkeeper-watcher"
npx openclaw plugins install -l . --dangerously-force-unsafe-install

if [ $? -eq 0 ]; then
    echo "✅ Clawkeeper-Watcher Plugin安装成功"
else
    echo "❌ Clawkeeper-Watcher Plugin安装失败"
    exit 1
fi

# 3. 验证安装
echo ""
echo "🔍 验证Plugin安装..."
npx openclaw plugins list 2>&1 | grep -i clawkeeper

echo ""
echo "✅ ClawKeeper Plugin安装完成!"
echo ""
echo "📝 下一步:"
echo "  1. 重启安全龙虾Gateway: openclaw --profile hardened gateway restart"
echo "  2. 测试审计功能: npx openclaw clawkeeper audit --json"
echo "  3. 测试加固功能: npx openclaw clawkeeper harden"
