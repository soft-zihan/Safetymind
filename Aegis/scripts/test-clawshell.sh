#!/bin/bash

# 测试 ClawShell 启动
echo "🧪 测试 ClawShell 启动..."
echo ""

cd /Users/han/Documents/projects/Safetymind/Adamantine-OpenClaw

# 后台启动
clawshell start -c clawshell/clawshell.dev.toml &
CLAWSHELL_PID=$!

echo "⏳ 等待 ClawShell 启动..."
sleep 3

# 测试连接
if curl -s http://localhost:18790/admin/stats > /dev/null 2>&1; then
    echo "✅ ClawShell 启动成功！"
    echo ""
    echo "📊 统计信息:"
    curl -s http://localhost:18790/admin/stats | python3 -m json.tool 2>/dev/null || echo "无法获取统计"
    echo ""
    echo "🛑 停止 ClawShell..."
    kill $CLAWSHELL_PID 2>/dev/null
    echo "✅ 测试完成"
else
    echo "❌ ClawShell 启动失败"
    echo ""
    echo "📋 检查配置文件:"
    cat clawshell/clawshell.dev.toml
    kill $CLAWSHELL_PID 2>/dev/null
fi
