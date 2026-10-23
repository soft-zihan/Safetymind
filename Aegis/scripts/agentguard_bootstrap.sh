#!/usr/bin/env bash
# agentguard_bootstrap.sh — 初始化 AgentGuard 控制服务器（幂等）
#
# AgentGuard 服务器是纯内存状态，重启后需要加载 server plugin 配置。
# plugins.json 已在 llm_before / llm_after / tool_before / tool_after 四个
# 相位激活 rule_based_plugin，并通过 env.policy_path 指向全相位演示策略
# （config/demo_policy_full.json，含 LLM 前后、工具前后及多步 TRACE 规则）。
#
# 用法: ./agentguard_bootstrap.sh [server_url]
set -euo pipefail

SERVER_URL="${1:-http://127.0.0.1:38080}"
AGENTGUARD_ROOT="$(cd "$(dirname "$0")/../../openclaw/AgentGuard" && pwd)"
PLUGINS_CONFIG="$AGENTGUARD_ROOT/config/plugins.json"

echo "🛡️ AgentGuard 初始化: $SERVER_URL"

# 等待服务器就绪
for i in $(seq 1 10); do
    if curl -s -m 2 "$SERVER_URL/v1/backend/health" > /dev/null 2>&1; then
        break
    fi
    if [ "$i" = "10" ]; then
        echo "❌ AgentGuard 服务器未就绪 ($SERVER_URL)"
        exit 1
    fi
    sleep 1
done

python3 - "$SERVER_URL" "$PLUGINS_CONFIG" <<'PYEOF'
import json, sys, urllib.request

server_url, plugins_config_path = sys.argv[1], sys.argv[2]

def post(path, body):
    req = urllib.request.Request(
        server_url + path,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    return json.loads(urllib.request.urlopen(req, timeout=10).read().decode())

# 激活全相位 server plugin（rule_based_plugin + policy_path 指向演示策略 JSON）
with open(plugins_config_path) as f:
    plugins_cfg = json.load(f)
res = post("/v1/backend/plugins/config", {"config": plugins_cfg})
print(f"  ✅ plugins: {res.get('loaded_plugins', [])}")

# 验证
health = json.loads(urllib.request.urlopen(server_url + "/v1/backend/health", timeout=5).read())
print(f"  ✅ health: rules={health.get('rules')} mode={health.get('mode')} version={health.get('rule_version')}")
PYEOF

echo "✅ AgentGuard 初始化完成"
