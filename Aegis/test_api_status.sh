#!/bin/bash

# Aegis API 状态验证脚本
# 用于验证所有 API 端点返回正确的状态信息

BASE_URL="http://localhost:8000"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧪 Aegis API 状态验证"
echo "========================"
echo ""

# 检查后端是否运行
echo "📡 检查后端服务..."
if ! curl -s $BASE_URL/health > /dev/null 2>&1; then
    echo -e "${RED}❌ 后端服务未运行${NC}"
    echo "请先运行: ./start.sh"
    exit 1
fi
echo -e "${GREEN}✅ 后端服务运行中${NC}"
echo ""

# 测试函数
test_api() {
    local endpoint=$1
    local description=$2
    local expected_field=$3
    local expected_value=$4
    
    echo "🔍 测试 $description..."
    echo "   端点: $endpoint"
    
    response=$(curl -s $BASE_URL$endpoint)
    
    if [ $? -ne 0 ]; then
        echo -e "   ${RED}❌ 请求失败${NC}"
        return 1
    fi
    
    # 检查是否返回 null
    if echo "$response" | grep -q ": null"; then
        echo -e "   ${YELLOW}⚠️  响应包含 null 值${NC}"
        echo "   响应: $(echo $response | head -c 200)..."
    else
        echo -e "   ${GREEN}✅ 响应正常（无 null）${NC}"
    fi
    
    # 显示关键字段
    if [ -n "$expected_field" ]; then
        value=$(echo "$response" | python3 -c "import sys,json; data=json.load(sys.stdin); print(data.get('$expected_field', 'N/A'))" 2>/dev/null)
        echo "   $expected_field = $value"
    fi
    
    echo ""
    return 0
}

# 测试各个 API 端点
echo "========================"
echo "开始测试 API 端点"
echo "========================"
echo ""

# 1. OpenClaw Gateway 状态
test_api "/api/openclaw/status" "OpenClaw Gateway 状态" "is_running"

# 2. ClawShell 状态
test_api "/api/clawshell/status" "ClawShell 代理状态" "clawshell"

# 3. Hermes 状态
test_api "/api/hermes/status" "Hermes Agent 状态" "installed"

# 4. Qise 状态
test_api "/api/tools/qise/status" "Qise 安全防护状态" "protection_enabled"

# 5. Qise SLM 状态
test_api "/api/tools/qise/slm/status" "本地小模型状态" "ollama_running"

# 6. 数据集列表
test_api "/api/tools/datasets/" "数据集列表" "total"

echo "========================"
echo "验证完成"
echo "========================"
echo ""
echo "💡 如果看到 null 值或错误，请检查对应服务是否已启动"
echo "💡 运行 ./start.sh 启动所有服务"
