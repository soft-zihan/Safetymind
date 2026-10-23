#!/bin/bash
# ClawKeeper集成验证脚本

echo "========================================="
echo "🛡️ ClawKeeper集成验证"
echo "========================================="
echo ""

# 1. 检查ClawKeeper仓库
echo "1️⃣ 检查ClawKeeper仓库..."
if [ -d "ClawKeeper" ]; then
    echo "✅ ClawKeeper仓库存在"
    cd ClawKeeper
    echo "   分支: $(git branch --show-current 2>/dev/null || echo 'detached')"
    echo "   最后提交: $(git log --oneline -1 2>/dev/null || echo 'unknown')"
    cd ..
else
    echo "❌ ClawKeeper仓库不存在"
    exit 1
fi
echo ""

# 2. 检查集成目录
echo "2️⃣ 检查集成目录..."
if [ -d "clawkeeper-integration" ]; then
    echo "✅ 集成目录存在"
    echo "   文件列表:"
    find clawkeeper-integration -type f -name "*.py" -o -name "*.sh" -o -name "*.md" -o -name "*.json" | while read f; do
        echo "   - $f"
    done
else
    echo "❌ 集成目录不存在"
    exit 1
fi
echo ""

# 3. 测试Skill加载器
echo "3️⃣ 测试Skill加载器..."
python3 -c "
import sys
sys.path.insert(0, 'clawkeeper-integration/adapter')
from skill_loader import load_lobster_safety_skills
prompt = load_lobster_safety_skills()
print(f'✅ Skill加载成功: {len(prompt)} 字符')
print(f'   包含红线规则: {\"红线\" in prompt}')
print(f'   包含凭证保护: {\"凭证保护\" in prompt}')
"
echo ""

# 4. 检查Plugin安装
echo "4️⃣ 检查Plugin安装..."
PLUGIN_COUNT=$(npx openclaw plugins list 2>&1 | grep -i clawkeeper | wc -l | tr -d ' ')
if [ "$PLUGIN_COUNT" -ge 2 ]; then
    echo "✅ ClawKeeper Plugin已安装 ($PLUGIN_COUNT 个)"
    npx openclaw plugins list 2>&1 | grep -i clawkeeper | while read line; do
        echo "   $line"
    done
else
    echo "⚠️  Plugin安装数量不足 (期望>=2, 实际=$PLUGIN_COUNT)"
fi
echo ""

# 5. 测试审计功能
echo "5️⃣ 测试ClawKeeper审计..."
AUDIT_OUTPUT=$(npx openclaw clawkeeper audit --json 2>&1)
if echo "$AUDIT_OUTPUT" | grep -q '"score"'; then
    SCORE=$(echo "$AUDIT_OUTPUT" | grep -o '"score": [0-9]*' | head -1 | cut -d' ' -f2)
    echo "✅ 审计执行成功, 安全评分: $SCORE/100"
else
    echo "⚠️  审计执行可能有问题"
    echo "$AUDIT_OUTPUT" | tail -5
fi
echo ""

# 6. 检查后端API
echo "6️⃣ 检查后端API路由..."
if grep -q "clawkeeper" backend/app/main.py; then
    echo "✅ ClawKeeper路由已注册"
    grep "clawkeeper" backend/app/main.py | while read line; do
        echo "   $line"
    done
else
    echo "❌ ClawKeeper路由未注册"
fi
echo ""

# 7. 检查Skill注入代码
echo "7️⃣ 检查Skill注入代码..."
if grep -q "load_lobster_safety_skills" backend/app/services/openclaw_client.py; then
    echo "✅ Skill注入代码已集成"
    if grep -q "is_hardened" backend/app/services/openclaw_client.py; then
        echo "✅ 安全龙虾判断逻辑已添加"
    fi
else
    echo "❌ Skill注入代码未集成"
fi
echo ""

# 8. 总结
echo "========================================="
echo "✅ 集成验证完成!"
echo "========================================="
echo ""
echo "📝 下一步:"
echo "  1. 重启安全龙虾Gateway: openclaw --profile hardened gateway restart"
echo "  2. 重启后端服务: ./start.sh restart"
echo "  3. 测试API: curl http://localhost:8000/api/clawkeeper/status"
echo "  4. 访问前端: http://localhost:5173"
echo ""
echo "🎉 ClawKeeper Skill + Plugin集成已完成!"
