#!/bin/bash

# ClawShell 快速启动脚本
# 用于开发环境

set -e

CLAWSHELL_CONFIG="clawshell/clawshell.dev.toml"
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "🦞 ClawShell 快速启动脚本"
echo "========================"
echo ""

# 检查配置文件
if [ ! -f "$PROJECT_ROOT/$CLAWSHELL_CONFIG" ]; then
    echo "❌ 配置文件不存在: $CLAWSHELL_CONFIG"
    echo "请先创建配置文件"
    exit 1
fi

echo "📋 配置文件: $CLAWSHELL_CONFIG"
echo ""

# 检查 clawshell 是否安装
if ! command -v clawshell &> /dev/null; then
    echo "❌ ClawShell 未安装"
    echo ""
    echo "请选择安装方式："
    echo ""
    echo "方式 1: NPM 安装（推荐）"
    echo "  npm install -g @clawshell/clawshell"
    echo ""
    echo "方式 2: Cargo 安装"
    echo "  cargo install clawshell --locked"
    echo ""
    echo "方式 3: 从源码编译"
    echo "  cd clawshell"
    echo "  cargo build --release"
    echo ""
    exit 1
fi

echo "✅ ClawShell 已安装: $(clawshell --version 2>/dev/null || echo '未知版本')"
echo ""

# 检查配置中的 API 密钥
if grep -q "sk-your-openai-key-here" "$PROJECT_ROOT/$CLAWSHELL_CONFIG" || \
   grep -q "sk-ant-your-anthropic-key-here" "$PROJECT_ROOT/$CLAWSHELL_CONFIG"; then
    echo "⚠️  警告: 配置文件中使用示例 API 密钥"
    echo "请编辑 $CLAWSHELL_CONFIG 并替换为你的真实 API 密钥"
    echo ""
    read -p "是否继续启动？(y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "🚀 启动 ClawShell..."
echo ""

# 启动 ClawShell
cd "$PROJECT_ROOT"
clawshell start -c "$CLAWSHELL_CONFIG" --foreground
