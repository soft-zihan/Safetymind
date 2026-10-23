
# AI-SAFE Privacy：以“隐私仪表盘”建立用户可感知的数据边界

不改变 Carmind Memory 核心逻辑，先建立 AI 数据使用的可见、可控与可追溯能力。

### 左侧：核心技术

**从“数据权限”升级为“AI 数据使用边界”**

**用户数据资产**（左侧输入）：

- Camera（摄像头）
- Mic（麦克风）
- Location（位置）
- Contacts（通讯录）
- Vehicle Data（车辆数据）
- Carmind Memory

这些数据流入中间的 **AI 隐私仪表盘**，仪表盘包含四个模块：

- 用户授权
- 访问审计
- 隐私探针
- 边界校验

仪表盘下方特别标注：**Context Minimization（最小化 / 脱敏 / 裁剪）**

仪表盘输出到 **AI-SAFE Privacy Engine**，再分别连接：

- Carmind Agent
- 第三方 Agent
- 云端模型 / Skill

底部有一条虚线连接，标注红色文字 **“量子安全通道”**（带锁图标）。

### 右侧：三步走

**① Privacy Probe | 看得见**（红色虚线框突出显示）

- AI 安心状态
- AI 安心记录
- AI 隐私锁

底部口号：**看得见 · 锁得住 · 查得到**

**② Privacy Context Broker | 管得住**

- Agent 身份 × 用途 × 数据类型授权
- Context 最小披露 / 脱敏
- 第三方 Agent 数据边界

说明：让不同 Agent 只拿到完成任务最小 Context

**③ Privacy Control Plane | 持续治理**

- 多车型多地域 Profile 策略
- 多 Agent / MCP 生态复用
- 区域化合规与量子安全通道协同

说明：模型可换、Agent 可加，数据边界由奇瑞定义

### 技术价值（四个板块）

1. **用户信任入口**
   把 AI 数据边界第一次变成用户可见、可控、可追溯的产品能力
2. **最小侵入集成**
   不改 Carmind Memory 核心逻辑，兼容现有能力体系
3. **快速落地**
   Probe + Dashboard 先行，形成 TP1 可交付闭环
4. **沉淀奇瑞数据主权**
   为多车型、多 Agent、多区域的 AI 数据策略打基础

### 底部：关键指标（四个全部 100%）

- 项目约定敏感 AI 数据授权场景覆盖率：**100%**
- 关键 AI 数据访问可追溯：**100%**
- 用户授权撤销成功率：**100%**
- 敏感车云 AI 数据安全传输覆盖率：**100%**

# AI-SAFE Harness：以“AI权限守护”建立 Agent 能力调用边界

不改变 Carmind Planner 与车辆服务体系，先通过 Harness Probe 看清风险，再逐步建立运行时准入能力。

### 顶部三大优势

1. **非侵入接入**  
   通过标准 Hook 与适配器接入，不改 Carmind 核心，不重构现有车辆服务体系。

2. **快速扩展**  
   新增模型、Agent、Skill 或车型时，只需注册能力与策略，无需重复建设安全架构。

3. **统一管控**  
   所有 AI 对车辆能力的调用统一经过安全准入，执行边界始终由奇瑞集中定义。

### 左侧：技术体系 —— AI请求可信链

展示从上层 AI 请求到车辆底层能力的完整防护链路：

- 上层来源：Carmind、第三方 Agent、手机智能体、云端大模型、MCP生态  
- 中间经过 **Mixed Prompts & Tool Calls** 漏斗，由 **Harness Sidecar Engine** 综合身份、意图、车辆状态与委托链，进行毫秒级裁决  
- 决策结果颜色标识：  
  - 绿色 Allow（放行）  
  - 黄色 Limit（限幅）  
  - 橙色 Confirm（再确认）  
  - 红色 Block（阻断）

**两道防线：**
- **防线一：Soft Hook**  
  无缝接入 Carmind，不侵入协作逻辑，仅提取上下文（Context、Intention）
- **防线二：AI Capability Broker**  
  拦截裸车控 API 调用，仅向 AI 暴露抽象的“安全业务能力”

最终落地到车辆侧：
- Vehicle SOA
- FuSa（功能安全）
- ADAS 底盘控制

底部说明：**车辆动作最终物理安全仍由奇瑞既有车辆体系负责**。

### 中间：三步走

**第一步  Harness Probe | 看得见**（红色虚线框突出）
- 核心能力：Prompt / Agent风险检测、Tool调用监测、Reason Code / Risk Event  
- 低先建立AI执行行为可见性，不改变原业务调用结果

**第二步  Harness Sidecar | 管得住**
- 核心能力：Agent / Tool Policy、Delegation / Identity 校验、Capability白名单、高风险确认  
- 让每一次AI能力调用都经过独立准入判断

**第三步  Harness Security | 持续治理**
- 核心能力：多模型 / 多 Agent / 多 Skill统一 Profile、Runtime Policy持续优化  
- 模型可换、Agent可加，但执行边界由奇瑞统一定义

### 右侧：技术收益

1. **补齐 AI 新攻击面**  
   从传统网络安全升级到 Agent Runtime 行为安全

2. **低侵入接入现有系统**  
   Hook / Adapter / Sidecar渐进接入，不改变 Planner

3. **执行边界奇瑞自主**  
   不依赖单一模型厂商定义 Tool / Vehicle Capability 权限

4. **跨车型复用**  
   Runtime Core统一，车型差异通过 Adapter + Policy Profile 配置

### 底部：关键指标

- 关键 Agent / Tool 纳管覆盖率：**100%**
- 项目约定高危 AI 风险场景检测率：**≥95%**
- 关键 AI 行为链可追溯率：**≥95%**

# AI-SAFE Monitor：以“AI行为记录仪”建立 Agent 审计边界

不采集模型“思维过程”，通过统一 Trace + 行为分析记录 AI 做了什么、为何异常、能否追溯。

右上角黄色高亮标注：  
**奇瑞车辆真实运行过程中产生的高质量 AI 安全行为数据，应该属于奇瑞。**

### 左侧：技术体系

**AI Runtime Trace（发生了什么）** 共 8 层：
1. 用户意图  
2. Context / Memory  
3. Agent  
4. Plan  
5. Tool / Skill  
6. Harness 决策  
7. Vehicle Capability  
8. 执行结果  

配套三大能力模块：
- **AI Flight Recorder**：异常前后关键事件冻结留证  
- **Behavior Graph**：Tool Sequence / Goal Drift / Agent行为链识别  
- **Evidence by Design**：版本、策略、Agent、行为、结果形成证据链  

底部总结：**Trace 是底座，Recorder 是留证，Graph 是分析，Evidence 是结果。**

### 中间：三步走

**第一步  Monitor Probe | 看得见**
- Probe / Hook 接入，建立 Trace、Agent / Tool / Result 关键行为记录  
- **结果**：先拥有奇瑞自己的 AI Runtime 行为数据

**第二步  Behavior Analytics | 看得懂**
- 行为基线、Tool Sequence、Goal Drift、Version Risk Radar  
- **结果**：定位哪个 Agent、哪个版本、哪条行为链开始偏离

**第三步  AI Monitor Platform | 持续治理**
- Fleet Risk、VSOC / PSIRT / OTA 联动、Evidence Pack  
- **结果**：把一次异常转化为车型级安全治理能力

### 右侧：技术收益

1. **掌握 AI 审计权**  
   模型和 Agent 可变，但车辆上的 AI 行为证据必须掌握在奇瑞手中

2. **沉淀 Chery AI Safe Dataset**  
   积累真实车辆中的高风险行为、异常版本与策略反馈数据

3. **支撑全球规模化上车**  
   One Monitor Core + Regional Evidence Profile，降低出海合规与运营成本

4. **让 AI 黑盒变玻璃盒**  
   谁发起、谁调用、谁放行、结果如何可追溯

### 底部：关键指标 + 合规支撑

**关键指标**：
- 关键 AI Event 采集覆盖率：**100%**
- 高危 AI 风险场景检测率：**≥95%**
- 关键 AI 资产版本可追溯率：**100%**

**合规支撑**：  
面向奇瑞出海 EU / ASEAN / CSMS 区域 Profile 后续扩展

---

**底部核心口号：**  
**Carmind 负责让 AI 越来越聪明，AI-SAFE Monitor 负责让 Carmind 越来越安全。**