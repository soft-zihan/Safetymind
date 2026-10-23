# AgentGuard 攻击链检测与规则设计 —— 深度原理详解

## 一、攻击链检测的核心思想

传统的安全防护往往只关注**单次工具调用**的参数是否危险（如是否包含 `rm -rf`），但真实的攻击往往是**多步骤的**：

```
读取机密文档 → 构造HTTP请求 → 发送到外部服务器
```

每一步单独看都是"正常"操作，但组合起来就构成了一条完整的数据外泄攻击链。AgentGuard 的攻击链检测（Trace Pattern）正是为了解决这个问题——它不只看当前这一次调用，而是**回溯整个会话历史中的工具调用序列**，检测是否存在预定义的危险行为模式。

---

## 二、TRACE 模式语法

AgentGuard 定义了一套声明式的调用链模式描述语言（TRACE DSL），用占位符和分隔符来表达工具调用之间的时序关系：

### 2.1 四种分隔符

| 语法 | 含义 | 正则等价 | 使用场景 |
|------|------|---------|---------|
| `A -> B` | **严格相邻**：A 之后紧邻 B，中间无任何其他调用 | `,` | 检测"读取后立即发送"的紧密耦合行为 |
| `A -> * -> B` | **间隔一步**：A 和 B 之间恰好有一个工具调用 | `,[^,]+,` | 检测"经过一个中间步骤后的行为链" |
| `A -> ... -> B` | **至少间隔一步**：A 和 B 之间至少有一个工具调用 | `,(?:[^,]+,)+` | 检测"非相邻但存在中间步骤"的行为链 |
| `A -> ...? -> B` | **零或更多间隔**：A 在 B 之前的任意位置 | `,(?:[^,]+,)*` | **最常用**，检测"A 是否在会话中最终导致了 B" |

### 2.2 多跳链

分隔符可以自由组合，形成多跳攻击链模式：

```
# 三跳链：外部输入 → 特权操作 → 外部泄露
TRACE: ExtIn ->...?-> PrivOp ->...?-> Sink

# 四跳链：外部输入 → 权限提升 → 数据库写入 → 外部泄露
TRACE: External ->...?-> Elevated ->...?-> DbOp ->...?-> Leak
```

每一跳都可以使用不同的分隔符，实现精确的时序约束。

### 2.3 占位符命名

TRACE 中的每个步骤都是一个**命名占位符**（如 `SecRead`、`Sink`、`Reader`），它们不仅用于模式匹配，还会在匹配成功后**绑定到实际的工具调用记录**，供后续 CONDITION 子句引用。

---

## 三、攻击链匹配算法

### 3.1 模式解析

TRACE 模式的解析过程是一个**状态机扫描**：

```
输入: "SecRead ->...?-> Sink"
         │
         ▼
[1] 识别占位符 "SecRead"（正则: [A-Za-z_][\w-]*）
[2] 识别分隔符 "->...?->"（依次尝试 ...? / ... / *）
[3] 识别占位符 "Sink"
         │
         ▼
输出: [TraceStep(name="SecRead", sep=""),
       TraceStep(name="Sink", sep="-> ...?")]
```

解析后的步骤列表同时支持两种匹配模式：
- **正则编译模式**：将步骤序列编译为正则表达式，用于快速布尔匹配
- **回溯搜索模式**：用于在轨迹窗口中查找匹配并返回占位符绑定

### 3.2 正则编译匹配

对于简单的"是否匹配"判断，系统将 TRACE 步骤编译为正则表达式：

```python
# TRACE: A ->...?-> B -> C
# 编译为:
r"(?:^|,)A,(?:[^,]+,)*B,C(?=,|$)"
```

工具调用序列被逗号连接为字符串后，用此正则进行匹配。这种方式利用正则引擎的高效回溯实现快速判断，并通过 `lru_cache` 缓存编译结果（最多 512 条）。

### 3.3 带绑定的回溯匹配

当需要将占位符绑定到实际调用记录时（用于后续 CONDITION 求值），系统使用**带回溯的深度优先搜索（DFS）**：

```
轨迹窗口: [call_1, call_2, call_3, call_4, call_5]
TRACE:    SecRead ->...?-> Sink

搜索过程:
  step=0 (SecRead):
    尝试 call_1 → 绑定 SecRead=call_1
      step=1 (Sink, sep="-> ...?"):
        候选范围: range(1, 5) → call_2, call_3, call_4, call_5
        尝试 call_2 → 绑定 Sink=call_2 → 检查 CONDITION → 不匹配
        尝试 call_3 → 绑定 Sink=call_3 → 检查 CONDITION → 不匹配
        ...
    尝试 call_2 → 绑定 SecRead=call_2
      step=1 (Sink):
        候选范围: range(3, 5) → call_3, call_4, call_5
        ...
```

**分隔符决定候选范围**：

| 分隔符 | 候选范围计算 | 含义 |
|--------|------------|------|
| `->` | `range(prev+1, prev+2)` | 仅下一个位置 |
| `-> * ->` | `range(prev+2, prev+3)` | 跳过恰好一个 |
| `-> ... ->` | `range(prev+2, n)` | 跳过至少一个 |
| `-> ...? ->` | `range(prev+1, n)` | 跳过零个或多个 |

**返回最近匹配**：算法收集所有匹配结果，返回**最后一个**（即时间上最近的匹配），确保策略评估基于最新的攻击链实例。

### 3.4 占位符属性访问

匹配成功后，CONDITION 子句可以通过占位符名访问绑定调用的属性：

| 访问路径 | 含义 | 示例 |
|---------|------|------|
| `P.name` | 工具名称 | `SecRead.name == "secret.read"` |
| `P.boundary` | 边界标签 | `Sink.boundary == "external"` |
| `P.sensitivity` | 敏感度标签 | `DataOp.sensitivity == "high"` |
| `P.integrity` | 完整性标签 | `Src.integrity == "unfiltered"` |
| `P.result` | 调用返回值 | `Reader.result == "restricted"` |
| `P.<param>` | 调用参数 | `Mailer.addr != "admin@example.com"` |

属性解析逻辑：

```python
def _resolve_trace_binding(binding, parts):
    head = parts[0]
    if head == "name":        return binding["tool_name"]
    if head in labels:        return binding["labels"][head]
    if head == "result":      return binding["result"]
    # 其他路径 → 从 arguments 字典中查找
    return binding["arguments"].get(head)
```

---

## 四、规则匹配与策略裁决的完整流程

### 4.1 单条规则的匹配过程

当一条规则同时包含 TRACE 和 CONDITION 子句时，匹配过程如下：

```
当前工具调用事件 event
轨迹窗口 trace_window（历史调用序列）
         │
         ▼
[1] 基础过滤
    ├── agent_id 匹配？
    ├── event_type 匹配？
    ├── tool_names 匹配？（支持通配符）
    ├── capabilities 交集非空？
    └── risk_signals 交集非空？
         │
         ▼
[2] TRACE 子句匹配
    ├── 从轨迹窗口提取所有 tool_invoke 事件
    ├── 将当前事件追加到序列末尾
    ├── 调用 match_with_bindings() 进行回溯搜索
    ├── 无匹配 → 规则不匹配，返回 False
    └── 有匹配 → 获得占位符绑定字典
         │
         ▼
[3] CONDITION 子句求值
    ├── 构建 match_root 字典：
    │   {
    │     **event_dict,           # 当前事件的完整字典
    │     "principal": {...},     # 主体信息（role, trust_level, agent_id）
    │     "tool": {...},          # 工具信息（name, 参数, 标签）
    │     "target": {...},        # 目标信息（url, domain）
    │     "_trace_bindings": {...} # TRACE 占位符绑定
    │   }
    ├── 解析 condition_expr 为布尔表达式树
    │   支持: AND / OR / NOT / 括号分组
    ├── 递归求值表达式树：
    │   ├── atom → 解析为 field op value，从 match_root 中取值比较
    │   ├── AND  → 左右子树都为 True
    │   ├── OR   → 左右子树至少一个为 True
    │   └── NOT  → 子树取反
    └── 返回 True/False
         │
         ▼
[4] 规则匹配成功 → 进入冲突解决
```

### 4.2 多规则冲突解决（Deny-Overrides）

当多条规则同时匹配当前事件时，采用**双重排序**确定胜出规则：

```python
sort_key(rule) = (priority, effect_rank)
winner = max(matched_rules, key=sort_key)
```

**效果严格度排名**：

| 效果 | 排名 | 含义 |
|------|------|------|
| `deny` | 7 | 硬拒绝，工具不执行 |
| `require_remote_review` | 6 | 需要远程服务端审查 |
| `require_approval` | 5 | 需要人工审批 |
| `degrade` | 4 | 降级到安全替代工具 |
| `sanitize` | 3 | 对结果进行脱敏 |
| `log_only` | 2 | 仅记录审计日志 |
| `allow` | 1 | 放行 |

**核心语义**：无论其他规则如何，只要有一条规则判定 `deny`，最终结果就是 `deny`。这就是 **deny-overrides** 策略——安全策略中的"一票否决"。

### 4.3 DSL 默认优先级映射

当使用 DSL 编写规则时，POLICY 动作会自动映射为默认优先级：

| POLICY 动作 | 默认优先级 |
|------------|-----------|
| `DENY` | 90 |
| `HUMAN_CHECK` | 70 |
| `LLM_CHECK` | 60 |
| `DEGRADE` | 50 |
| `ALLOW` | 10 |

---

## 五、规则体系设计

AgentGuard 的规则体系按**防御层次**组织，从单步拦截到跨步攻击链检测，形成纵深防御：

### 5.1 第一层：身份与能力基线（Identity & Capability）

**核心问题**：这个 Agent 有没有基本权利调用这个工具？

```
RULE: deny-shell-basic
ON:        tool_call(shell_exec)
CONDITION: principal.role == "basic"
POLICY:    DENY
```

**设计原则**：
- 基于 **RBAC（基于角色的访问控制）**：`basic` / `default` / `privileged` / `system` 四级角色
- 基于 **信任等级**：`trust_level` 0-5 级，数值越高越可信
- **最小权限**：零信任 Agent 不能生成子 Agent，低信任 Agent 不能执行 Shell

### 5.2 第二层：数据操作安全（Data Operations）

**核心问题**：这个数据操作是否安全？

```
RULE: deny-db-write-basic
ON:        tool_call(database_query)
CONDITION: tool.mode == "write" AND principal.role == "basic"
POLICY:    DENY

RULE: deny-fs-write-system-paths
ON:        tool_call(file_write)
CONDITION: tool.path IN {"/etc/passwd", "/etc/shadow", ...}
POLICY:    DENY
```

**设计原则**：
- 读写分离：读操作通常允许，写操作需要更高权限
- 路径黑名单：系统关键路径禁止写入
- 降级策略：低信任 Agent 的向量搜索自动降级到公开索引

### 5.3 第三层：攻击链检测（Chain Defense）

**核心问题**：这个工具调用是否是一条攻击链的一部分？

这是 AgentGuard 最有特色的防御层，通过 TRACE 子句实现跨步骤行为检测：

#### 5.3.1 数据外泄检测

```
RULE: chain-deny-secret-to-external
TRACE:     SecRead ->...?-> Sink
CONDITION: SecRead.name == "secret.read"
           AND Sink.name IN {"http_post", "email_send", "slack.post"}
POLICY:    DENY
```

**检测逻辑**：在会话历史中，如果 `secret.read` 在任何位置出现过，且当前调用是外部发送工具，则判定为密钥外泄攻击链。

#### 5.3.2 提示注入到执行检测

```
RULE: chain-deny-llm-output-to-shell
TRACE:     LLMOut ->...?-> Shell
CONDITION: LLMOut.name IN {"llm.respond", "llm_respond"}
           AND Shell.name IN {"shell_exec", "shell.exec"}
POLICY:    DENY
```

**检测逻辑**：LLM 的输出如果最终流入了 Shell 执行工具，无论中间经过多少步骤，都视为提示注入攻击的执行阶段。

#### 5.3.3 权限提升链检测

```
RULE: trace-deny-external-to-privileged-to-sink
TRACE:     ExtIn ->...?-> PrivOp ->...?-> Sink
CONDITION: ExtIn.boundary == "external"
           AND PrivOp.boundary == "privileged"
           AND Sink.boundary == "external"
POLICY:    DENY
```

**检测逻辑**：外部输入 → 特权操作 → 外部泄露，这是经典的"提权+外泄"组合攻击。三跳链精确捕捉了攻击的完整路径。

#### 5.3.4 邮件注入转发检测

```
RULE: ws-read-then-send-email-llm
TRACE:     Reader -> Sender
CONDITION: Reader.name IN {"read_email", "read_inbox", "get_email"}
           AND Sender.name == "send_email"
POLICY:    LLM_CHECK
```

**检测逻辑**：邮件读取**紧邻**邮件发送（中间无其他调用），这是提示注入攻击中"读取邮件内容后转发给攻击者"的典型模式。使用严格相邻分隔符 `->` 是因为如果有其他操作介入，转发的可能性大大降低。

#### 5.3.5 四跳升级攻击检测

```
RULE: trace-deny-four-hop-escalation
TRACE:     External ->...?-> Elevated ->...?-> DbOp ->...?-> Leak
CONDITION: External.boundary == "external"
           AND Elevated.boundary == "privileged"
           AND DbOp.name == "db_write"
           AND Leak.boundary == "external"
POLICY:    DENY
```

**检测逻辑**：这是最复杂的攻击链模式，捕捉了"外部输入 → 权限提升 → 数据库篡改 → 数据外泄"的完整 APT（高级持续性威胁）攻击路径。

### 5.4 第四层：行为异常检测

**核心问题**：Agent 的行为模式是否异常？

```
RULE: chain-review-http-burst
ON:        tool_call.requested
CONDITION: tool.name IN {"http_post", "http.post"}
           AND repeated_attempts(tool="http_post", window="5m") > 4
POLICY:    HUMAN_CHECK
```

**设计原则**：即使单次调用看起来正常，频率异常也可能表明 Agent 被劫持。

### 5.5 第五层：目标漂移检测

```
RULE: chain-review-goal-drift-with-user-input
ON:        tool_call.requested
CONDITION: tool.name IN {"shell_exec", "http_post", "agent.spawn"}
           AND goal_drift_detected()
           AND exists_path(source.label IN {"user_input"}, sink = current_call, max_hops = 8)
POLICY:    HUMAN_CHECK
```

**设计原则**：当 Agent 偏离原始目标，且调用链中可以追溯到用户输入的影响时，高风险操作需要人工审核。这是对抗提示注入的高级防御。

---

## 六、规则 DSL 完整语法参考

### 6.1 规则骨架

```
RULE: <rule_id>                    # 必填，规则唯一标识
ON:   tool_call[.subtype][(tool)]  # 可选，事件匹配
TRACE: <pattern>                   # 可选，调用链模式
CONDITION: <expr>                  # 可选，条件表达式
POLICY: <action>                   # 必填，裁决动作
Severity: <level>                  # 可选，严重级别
Category: <category>               # 可选，分类
Reason: "<explanation>"            # 可选，原因说明
Prompt: "<llm_prompt>"             # 可选，LLM审查提示词
```

### 6.2 ON 子句 — 事件匹配

| 语法 | 含义 |
|------|------|
| `tool_call` | 匹配所有工具调用阶段 |
| `tool_call.requested` | 仅匹配执行前（可 DENY 的唯一阶段） |
| `tool_call.completed` | 仅匹配执行成功后 |
| `tool_call.failed` | 仅匹配执行失败后 |
| `tool_call(tool_name)` | 精确匹配工具名 |
| `tool_call.requested(tool_name)` | 组合：阶段 + 工具名 |

### 6.3 CONDITION 子句 — 条件表达式

**可访问的字段命名空间**：

| 命名空间 | 字段 | 类型 | 说明 |
|---------|------|------|------|
| `principal` | `role` | string | 角色：basic/default/privileged/system |
| `principal` | `trust_level` | int | 信任等级：0-5 |
| `principal` | `agent_id` | string | Agent 唯一标识 |
| `tool` | `name` | string | 工具注册名 |
| `tool` | `<param>` | any | 工具调用参数（按参数名访问） |
| `tool` | `boundary` | string | 边界标签：internal/external/privileged |
| `tool` | `sensitivity` | string | 敏感度标签：low/moderate/high |
| `tool` | `integrity` | string | 完整性标签：trusted/unfiltered |
| `target` | `domain` | string | 从 URL/邮箱提取的域名 |
| `target` | `url` | string | 原始 URL |
| `<Placeholder>` | `name/boundary/...` | any | TRACE 占位符绑定的属性 |

**支持的操作符**：

| 操作符 | DSL 语法 | 含义 |
|--------|---------|------|
| `eq` | `==` | 等于 |
| `ne` | `!=` | 不等于 |
| `gt` | `>` | 大于 |
| `lt` | `<` | 小于 |
| `gte` | `>=` | 大于等于 |
| `lte` | `<=` | 小于等于 |
| `in` | `IN {"a", "b"}` | 集合包含 |
| `not_in` | `NOT IN {"a", "b"}` | 集合不包含 |
| `contains` | `CONTAINS` | 字符串包含 |
| `regex` | `MATCHES "pattern"` | 正则匹配 |

**布尔组合**：`AND`、`OR`、`NOT`，支持括号嵌套。

### 6.4 POLICY 动作

| 动作 | 效果 | 使用场景 |
|------|------|---------|
| `DENY` | 硬拒绝 | 明确的危险操作 |
| `ALLOW` | 放行 | 安全操作 |
| `HUMAN_CHECK` | 暂停等待人工审批 | 需要人工判断的高风险操作 |
| `LLM_CHECK` | 发送给 LLM 审查 | 需要上下文理解的复杂判断 |
| `DEGRADE TO "tool"` | 降级到安全替代工具 | 可用更安全方式完成的操作 |

### 6.5 义务（Obligations）

可附加在 ALLOW 或 DEGRADE 之后：

```
ALLOW WITH AUDIT(severity="low", category="db_access")
ALLOW WITH REDACT(fields={"email", "phone", "ssn"})
ALLOW WITH RATE_LIMIT(max=20, window="1m")
```

多个义务可链式组合。

---

## 七、轨迹窗口管理

攻击链检测的关键依赖是**轨迹窗口**（trajectory_window）——它决定了检测的时间范围和上下文。

### 7.1 窗口的构建

```
客户端                                    服务端
  │                                        │
  ├── 本地 trace（window_size=8）           │
  │   └── 最近 8 个事件                     │
  │                                        │
  ├── ClientSyncBuffer                     │
  │   └── 批量异步上传本地决策记录 ──────────▶│
  │                                        ├── TraceStore
  │                                        │   └── 按 session 持久化
  │                                        │
  │   ◀──── 合并后的轨迹窗口 ────────────────│
  │                                        │
```

### 7.2 窗口合并

服务端在决策时，会合并以下来源的事件：

1. **客户端上传的缓存条目**（`client_cached_entries`）：客户端本地决策的历史记录
2. **请求中携带的轨迹窗口**（`trajectory_window`）：客户端当前窗口中的事件
3. **服务端 TraceStore 中的记录**：服务端已持久化的历史事件

合并时通过 `event_id` 去重，确保同一事件不会被重复处理。

### 7.3 窗口大小配置

客户端的 `window_size` 参数（默认 8）控制本地保留的事件数量。较大的窗口可以检测更长的攻击链，但会增加内存占用和网络传输开销。

---

## 八、工具标签体系与攻击链检测的协同

工具标签是攻击链检测的重要输入。每个工具在注册时可以标注三个维度的标签：

### 8.1 标签维度

| 维度 | 取值 | 含义 |
|------|------|------|
| `boundary` | `internal` / `external` / `privileged` | 工具的网络边界和权限级别 |
| `sensitivity` | `low` / `moderate` / `high` | 工具处理数据的敏感程度 |
| `integrity` | `trusted` / `unfiltered` | 工具输入的可信程度 |

### 8.2 标签在攻击链中的应用

标签使得攻击链规则可以**脱离具体工具名**，实现通用的安全策略：

```
# 不关心具体工具名，只关心数据流方向
RULE: trace-deny-unfiltered-to-exec
TRACE:     Src ->...?-> Exec
CONDITION: Src.integrity == "unfiltered"
           AND Exec.name IN {"shell.exec", "code_exec"}
POLICY:    DENY
```

这条规则的含义是：**任何"不可信"来源的数据，只要最终流入了代码执行工具，就一律拒绝**。这比针对具体工具名写规则更加通用和健壮。

### 8.3 标签注入机制

服务端在决策时，会从控制台的工具记录中自动注入标签：

```python
def _inject_console_tool_labels(event, context):
    record = get_console().tool_record(agent_id, tool_name)
    labels = dict(record.get("labels") or {})
    event.metadata["tool_labels"] = labels
```

这意味着标签可以在运行时通过控制台 UI 动态更新，无需修改规则。

---

## 九、LLM 辅助的攻击链审查

对于复杂的攻击链场景，简单的规则匹配可能不够，AgentGuard 支持将攻击链上下文提交给 LLM 进行智能审查：

### 9.1 触发条件

当规则的 `metadata.review_kind == "llm_check"` 或规则包含 `llm_prompt` 时，触发 LLM 审查。

### 9.2 审查 Prompt 构造

```
You are the AgentGuard LLM rule reviewer.
<instruction from rule's Prompt field>
Use the current tool call as the primary evidence.
Use recent events only when they clarify the meaning or provenance of the current call.
If important evidence is missing or redacted, return "human_check" instead of "allow".
Ignore AgentGuard transport, framework, and alignment metadata.
Respond with compact JSON: {"decision":"allow|deny|human_check","reason":"..."}
Rule: {"rule_id": "...", "rule_reason": "...", "review_kind": "llm_check"}
Current Call: {"event_type": "tool_invoke", "tool_name": "...", "arguments": {...}}
Relevant Context: {"session_id": "...", "principal": {...}, "policy": {...}}
Recent Events: [{"event_type": "tool_invoke", "tool_name": "...", ...}, ...]
```

### 9.3 审查结果解析

LLM 返回的 JSON 被解析为三种决策之一：
- `allow` → 放行
- `deny` → 拒绝
- `human_check` → 升级为人工审查

如果 LLM 调用失败（超时/异常），自动降级为 `human_check`，确保安全底线。

### 9.4 审计脱敏

提交给 LLM 的 Prompt 中，敏感数据（如 API Key、密码）会被 `redact()` 函数自动脱敏，防止审查过程本身造成信息泄露。

---

## 十、规则加载与热更新

### 10.1 规则加载链路

```
rules/ 目录
    ├── *.rules 文件（DSL 文本格式）
    │   └── dsl_compat.py / console/dsl.py 解析
    │       └── parse_legacy_rules() → list[PolicyRule]
    │
    ├── *.json 文件（JSON 格式）
    │   └── PolicyRule.from_dict() 反序列化
    │
    └── builtin.py（内置基线规则）
            └── builtin_rules() → list[PolicyRule]
                    │
                    ▼
            PolicyStore（版本化规则存储）
                ├── _global_rules（全局规则）
                └── _agent_rules（Agent 专属规则）
                    │
                    ▼
            PolicySnapshot（策略快照）
                ├── 按 capability 索引
                ├── 按 risk_signal 索引
                └── 按 event_type 索引
```

### 10.2 规则格式自动检测

加载器通过内容嗅探（而非文件扩展名）判断格式：

```python
looks_like_json = text.lstrip()[:1] in ("[", "{")
if p.suffix.lower() == ".rules" and not looks_like_json:
    # DSL 文本解析
else:
    # JSON 解析
```

### 10.3 热更新

规则支持运行时热更新：
- 通过控制台 UI 修改规则后，`PolicyStore.set_rules()` 替换规则集并重新计算版本号
- `RuleBasedPlugin` 通过 `attach_policy()` 绑定到最新的策略存储
- 策略版本号用于客户端-服务端的策略同步检测

---

## 十一、攻击链检测的设计哲学总结

1. **声明式而非编程式**：安全策略用声明式 DSL 描述，无需编写代码，降低了策略配置的门槛。

2. **模式匹配而非硬编码**：通过 TRACE 模式 + 占位符绑定，一套机制可以表达任意复杂的攻击链，而非为每种攻击写死检测逻辑。

3. **标签驱动而非名称绑定**：通过 `boundary`/`sensitivity`/`integrity` 标签，规则可以脱离具体工具名，实现通用的安全策略。新增工具只需标注正确的标签，无需修改规则。

4. **分层防御**：从单步身份检查 → 单步参数检查 → 跨步攻击链检测 → 行为异常检测 → 目标漂移检测，层层递进，形成纵深防御。

5. **Deny-Overrides 语义**：安全策略天然适合"一票否决"，任何一条规则说"不"，结果就是"不"。

6. **可解释性**：每条规则都有 `rule_id`、`reason`、`category`、`severity`，决策结果包含完整的匹配规则列表和解释，便于审计和追溯。

7. **渐进式严格度**：从 `log_only`（仅记录）到 `allow`（放行）到 `sanitize`（脱敏）到 `degrade`（降级）到 `require_approval`（人工审批）到 `deny`（硬拒绝），提供了丰富的严格度梯度，可以根据实际风险选择最合适的响应。
