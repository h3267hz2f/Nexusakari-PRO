# NexusAkari Pro (v4) — 基于 Rust + Tauri 2 的英雄联盟全栈战术与三通道桥接工作台重构计划

集 **wnzzer/rank-analysis**、**LeagueAkari**、**Seraphine**、**Frank**、**LeaguePrank** 及 **Porofessor/OP.GG** 级战术分析之大成，以 **Rust (Tokio / Reqwest / Tungstenite / DashMap) + Tauri 2 (ACL Capabilities & IPC Channel) + React 19** 架构打造零内存注入、微秒级响应、全生命周期闭环的殿堂级英雄联盟战术工作台。

---

## v3 计划深度自审自评与 v4 殿堂级进化清单 (v3 Self-Audit & v4 Masterpiece Upgrades)

> [!WARNING]
> 对 v3 进行第四轮“实战极限场景 + 开源生态全集对标”严苛审查后，进一步挖掘出 **8 项高价值护城河缺口与底层架构细节**，并在 v4 中完成终极合龙：

1. **进化 1（选人沟通护城河）：新增“选人聊天室战术简报广播与防屏蔽脱敏编码器（Lobby Chat Broadcaster & Obfuscator）”**
   - *v3 缺口*：`LeagueAkari`、`Seraphine` 与 `Frank` 用户最高频的刚需之一是在 BP 阶段**将我方/敌方战绩摘要一键发送至选人房间聊天框（`POST /lol-chat/v1/conversations/{id}/messages`）**。但直接发送“牛马/混子/连败”极易触发客户端敏感词屏蔽或刷屏限流。
   - *v4 闭环*：内置**三模式选人战报生成器（队友定心丸模式 / 高危预警模式 / 全队 5 人精简 KDA 战报）**，配备**防屏蔽零宽字符与战术黑话脱敏引擎**（自动将敏感词转换为合规电竞术语，并按 `350ms/行` 节流队列发送），支持一键预览并投递至当前 BP 聊天室。
2. **进化 2（赛后复盘数学突破）：新增“实时胜率逻辑回归模型 $P(\text{Win}\mid t)$ 与葬送好局转折点（Throw-Point）自动取证”**
   - *v3 缺口*：v3 仅有经济差折线，无法回答“明明前 25 分钟大顺风（85% 胜率），到底是哪一波团战、因为谁的阵亡导致胜率雪崩被翻盘？”。
   - *v4 闭环*：引入**多维逻辑回归实时胜率模型 $P(\text{Win}\mid t)$**（综合分均经济差、小龙/龙魂层数、大龙 Buff、防御塔差与阵容后期缩放系数），自动扫描整局斜率最陡峭的 **Top 3 胜率暴跌转折点（Throw Points，如 `27:15 大龙团前 AD 单带阵亡 -> 胜率 -43.8%`）**，并将其作为客观铁证自动注入 **Gemini 3.8 Flash 赛后审判庭**的定罪上下文中！
3. **进化 3（客户端资产管理神器）：补齐 `LeagueAkari` 标志性的“海克斯战利品（Loot）批量分解精粹工坊”与“SGP 跨区 OB 观战启动器”**
   - *v3 缺口*：客户端手动分解几十个英雄碎片极其繁琐（需逐个播放动画）；高玩跨区观战峡谷之巅/韩服千分王者对局缺乏无延迟直连工具。
   - *v4 闭环*：客户端工具箱新增 **海克斯战利品批量分解计算器**（支持智能过滤策略：`保留未拥有英雄碎片`、`保留专精升级所需碎片`、`一键分解全部重复碎片`，精确核算可获蓝色/橙色精粹并生成 `/lol-loot/v1/recipes/{recipe}/craft` 批处理指令）与 **SGP 跨区 OB 观战直连器**（提取 `observerEncryptionKey` 与服务器端口，生成免延迟本地客户端观战命令行）。
4. **进化 4（`:2999` 局内实战转化）：新增“局内敌方闪现/传送急速折算计时器与打野惩戒斩杀线看板”**
   - *v3 缺口*：v3 虽接入了 `LiveClientData (:2999)`，但未将其落地为局内可交互的秒表级战术组件。
   - *v4 闭环*：打造 **局内实时战术监控台（In-Game Tactical HUD）**，自动读取敌方 5 人是否携带 `星界洞悉 (+18 技能急速)` 与 `明朗之靴 (+10 技能急速)`，将 `300s` 闪现精确折算为真实冷却时间（如 `234s` / `254s`），支持一键点击头像启动倒计时并同步复制剩余秒数提醒队友，同时实时显示当前等级惩戒真实伤害阈值（`600 / 900 / 1200`）。
5. **进化 5（秒退博弈与全周期闭环）：新增“排位秒退期望收益决策器（Dodge EV Calculator）”与“断线重连/赛后秒回房闭环”**
   - *v3 缺口*：当 BP 遇到黑名单牛马或纯菜刀阵容时，玩家需要权衡“现在秒退扣胜点/等冷却”与“硬打大概率输掉扣 22 LP + 掉隐藏分”哪个更划算。
   - *v4 闭环*：根据玩家当日已秒退次数（第 1 次 `-5 LP / 6 min`、第 2 次 `-15 LP / 30 min`、第 3 次 `-15 LP / 720 min`，且**秒退绝不扣除隐藏分 MMR**）与当前我方阵容预测胜率，计算**秒退数学期望（Dodge Expected Value）**给出明确建议（`强烈建议秒退保MMR` vs `建议硬打`）；同时补齐**掉线 5s 自动重连（`Auto-Reconnect`）**与**赛后自动跳过点赞秒回房间（`Auto Play-Again`）**。
6. **进化 6（Tauri 2 现代架构规范）：全面升级至 Tauri 2 `ACL Capabilities` 权限模型与 `tauri::ipc::Channel` 零拷贝环形缓冲**
   - *v3 缺口*：Tauri 2 已废除旧版 `allowlist`，引入了全新的 `capabilities/default.json` 细粒度安全模型与高速流式通道 `tauri::ipc::Channel`。
   - *v4 闭环*：在 `src-tauri` 架构中完整实现 Tauri 2 标准 `capabilities` 权限声明、基于 `RingBuffer<IpcEnvelope, 256>` 的零内存泄漏报文审计队列，以及 `Channel` 高吞吐事件流。
7. **进化 7（全球与国服 SGP 路由全表）：内置腾讯国服核心大区（`HN1 艾欧尼亚`、`HN10 黑色玫瑰`、`BGP2 峡谷之巅`）与拳头国际服（`KR`、`TW2`、`NA1`、`EUW1`）SGP 网关路由注册表**。
8. **进化 8（物理分母与原子切片精校）：锁定 6 个高内聚原子切片（Slice-1 至 Slice-6），确保每一项新增护城河均有明确的纯逻辑单测、后端路由与前端交互落点**。

---

## User Review & Critical Decisions

> [!IMPORTANT]
> 以下为 v4 最终确认的架构基石与全栈交付范围：

- **核心技术栈 — Rust (`src-tauri`) + Tauri 2 (ACL & IPC Channel) + React 19 双模同构架构**：
  提供完整、符合 Tauri 2 最新规范的 Rust 原生内核代码（涵盖 LCU/RCU 四元组探测、PID 热重连看门狗、Tokio WAMP 前缀树过滤、SGP 令牌桶与 DashMap 缓存、`:2999` 局内轮询），并通过强类型 `TauriBridgeClient` 在桌面端直连 Tauri 原生 IPC，在当前 Web 沙箱中无缝驱动同构协议引擎与录制报文池，内置 **Tauri 2 Rust Core & IPC RingBuffer Inspector**。
- **五大核心战术工作区（100% 真实交互闭环）**：
  1. **智能 BP、防误 Ban、阵容三维诊断、秒退期望决策（Dodge EV）与聊天室脱敏战报工作台**
  2. **双阶段 10 人查房、v3 上下文感知 RPI 评分、胜率曲线 $P(\text{Win}\mid t)$ 葬送点取证与 Gemini 3.8 Flash 赛后审判庭**
  3. **极地大乱斗 5ms 备选席秒抢（带回滚锁）、EHP 真实乘区透视与斗魂竞技场双人海克斯协同台**
  4. **`:2999` 局内闪现急速倒计时、无皮村全皮肤背景写入、海克斯战利品（Loot）批量分解精粹工坊、段位伪装与 SGP 跨区 OB 观战台**
  5. **Tauri 2 Rust 原生内核源码浏览器、ACL 权限矩阵与实时 IPC 报文环形缓冲监控台**
- **视觉与工程纪律 — 现代战术高密暗色风（Tactical Dark Glass）**：
  严格落实 `1440px` 全视口布局、Top Bar 三区契约、60-30-10 配色、Zero-Pill 无胶囊元数据纪律与 `JetBrains Mono` (`tabular-nums`) 全量数值对齐。

---

## 1. Overview & Core Concept

### What It Does
**NexusAkari Pro (v4)** 将英雄联盟开源生态全部标杆工具的**核心功能、特色功能与技术护城河**进行了系统级重构与数学升维：

| 开源标杆项目 | 核心功能全量继承 | 特色交互与工作流升维 | v4 Rust + Tauri 2 终极护城河机制 |
| :--- | :--- | :--- | :--- |
| **rank-analysis** (`wnzzer`) | Tauri 2 + Rust 轻量内核、胜点进度环、隐藏分（MMR）估算 | **16 类动态牛马/大腿标签**、AI 赛后战犯定责与背锅比例条 | **上下文感知 RPI 模型（逆风补偿 $\gamma_{\text{deficit}}$ + 双转化率 $\eta_{\text{dmg}}, \eta_{\text{tank}}$）** + **胜率曲线 $P(\text{Win}\mid t)$ 葬送点取证** + **Gemini 3.8 Flash** 双人格审判 |
| **LeagueAkari** | 自动接受（防误触延迟）、主备选秒锁/秒禁、断线自动重连、赛后秒回房 | **海克斯战利品（Loot）碎片批量分解精粹计算器**、SGP 跨区无延迟 OB 观战启动器、训练房一键创建 | **LCU + RCU 双进程四元组探测与热重连看门狗** + **SGP JWT 令牌桶限流（`< 180ms` 穿透 200 场）** + **恩怨黑名单账本与秒退 EV 决策器** |
| **Seraphine** | 敌我 10 人近 20 场战绩穿透、全球与国服大区（`HN1/BGP2/KR/TW2`）检索 | **双阶段情报解锁（BP 我方查房 + 进局敌方突破口/军训目标锁定）** | **时序衰减并查集（Time-Decayed Union-Find）开黑图谱**：精准区分连体车队（`双排车队 #A`）与高分段路人撞车（`宿敌撞车`） |
| **Frank** | 选人阶段一键热写入最优符文页、召唤师技能提醒、对位克制胜率 | **BP 阵容三维伤害/控制诊断仪** + **选人聊天室防屏蔽脱敏战报一键广播** | **Tokio WAMP v1.0 (`[5, "OnJsonApiEvent"]`) 前缀树零拷贝过滤** + **队友预选冲突防误 Ban 仲裁器** |
| **LeaguePrank + Live HUD** | 无皮村全皮肤生涯背景写入、段位/胜点/挑战水晶勋章视觉伪装 | **`:2999` 局内敌方闪现/传送急速折算计时器**与打野惩戒斩杀线看板 | 原生构造 `/lol-chat/v1/me`、`/lol-summoner/v1/current-summoner/summoner-profile` 与 `/lol-loot/v1/recipes` 载荷 |

### Target Audience / Persona
- **冲分效率至上的排位硬核玩家**：在 BP 阶段靠**恩怨黑名单预警 + 秒退 EV 决策器**科学规避必输局；用**防屏蔽战报广播**温和提醒队友针对敌方连败突破口；在局内用**闪现急速计时器**精准掌握敌方 C 位无闪真空期。
- **极地大乱斗与斗魂竞技场高玩**：利用 `< 5ms` 备选席差分秒抢与一键回滚锁稳拿核心英雄，通过 EHP 等效生命值透视避开重度 Debuff 陷阱。
- **全收集党与技术极客**：一键核算并批量分解囤积的数百个英雄碎片获取数万蓝色精粹，跨区一键直连观战韩服/峡谷之巅顶级职业选手对局，或深入检视 Tauri 2 Rust 底层源码。

---

## 2. User Experience & Visual Design

### Key User Flows
1. **三通道网关握手、大区路由切换与全周期状态机流**：
   左侧战术导轨实时展示 **LCU (`--app-port`)**、**RCU/SGP (`--riotclient-app-port` + JWT)**、**LiveClientData (`:2999`)** 三通道延迟、令牌桶余量与 `RingBuffer` 报文计数。支持切换大区路由（`HN1 艾欧尼亚`、`BGP2 峡谷之巅`、`HN10 黑色玫瑰`、`KR 韩服`、`TW2 台服`）或切换生命周期阶段（`大厅待机` -> `匹配确认` -> `排位 BP (我方明牌)` -> `局内对抗 (解锁敌方10人全情报 + :2999 闪现计时)` -> `大乱斗/竞技场` -> `赛后 AI 审判`）。
2. **智能 BP、秒退 EV 决策、聊天室脱敏广播与一键符文热写入流**：
   进入 BP 后，顶部展示 **阵容三维伤害构成（AD/AP/真伤比例）与秒退期望决策卡（对比秒退惩罚 `-5 LP / 0 MMR` 与当前预计胜率）**；中部展示 10 人查房卡片（含 RPI 评分、16 类牛马标签、开黑车队连线、恩怨黑名单秒退警报与局内敌方军训标记）；右侧/底部提供**选人聊天室防屏蔽脱敏战报一键发送**、**防误 Ban 主备选秒锁**与**一键符文页热写入**。
3. **深度战绩穿透、胜率曲线 $P(\text{Win}\mid t)$ 葬送点取证与 Gemini AI 赛后审判流**：
   展开对局详情可查看 10 人 `tabular-nums` 双转化率对比表、六维能力雷达图、**实时胜率曲线 $P(\text{Win}\mid t)$ 与 Top 3 胜率暴跌转折点（Throw Points）标注**、**交互式 2D 召唤师峡谷击杀/资源坐标热区图**与符文真实收益拆解；点击“启动 Gemini AI 赛后审判”可将量化指标与胜率暴跌时刻一并提交给 `gemini-3.8-flash`，切换**“毒舌锐评审判官”**或**“职业赛训教练”**生成头号战犯、真大腿、背锅占比与翻盘/被翻盘复盘。
4. **大乱斗 5ms 摇骰子秒抢（带回滚锁）与斗魂竞技场双人流派协同流**：
   实时监控大乱斗 9 槽备选席（Bench Pool），支持模拟摇骰子、`< 5ms` 自动秒抢心愿单英雄与**原英雄一键回滚保护**；下方提供全英雄五维平衡修正、**真实 EHP 等效生命值倍率**排序表，以及斗魂竞技场棱彩/黄金/白银海克斯强化与双人组合流派推荐。
5. **客户端工具箱（无皮村 + 战利品分解 + 跨区观战 + `:2999` 局内计时）与 Tauri 2 内核监控流**：
   支持无皮村全皮肤背景写入、段位/挑战水晶伪装、**海克斯战利品（Loot）英雄/皮肤碎片一键批量分解精粹计算器**、**SGP 跨区 OB 观战命令行生成器**、**`:2999` 敌方 5 人闪现急速折算倒计时器**，以及 **Tauri 2 Rust Core Inspector**（检视 `src-tauri` 源码、`capabilities/default.json` 与 IPC 环形缓冲区报文）。

### Visual Identity & Theme
- **Aesthetic Direction**：**现代战术高密暗色风（Tactical Dark Glass & Precision Telemetry）**。严格贯彻 **Zero-Pill Discipline（零静态胶囊徽章纪律）**，所有静态标签、KDA、转化率、时间戳均采用克制的无框文本与 `·` / `/` 分隔符排版。
- **Color Palette & Mood（60-30-10 法则）**：
  - `60% 主画布`：深邃墨石板 `--background: #090D16`（`bg-slate-950`）。
  - `30% 结构表面`：单层海拔容器 `--surface: #111827`（`bg-gray-900/90`）+ `1px` 发丝边框 `border-slate-800/80` + 次级文本 `text-slate-400`。
  - `10% 战术强调色`：主交互海克斯青 `#0EA5E9`（`sky-500`）、MVP/通天代琥珀金 `#F59E0B`（`amber-500`）、优势/正收益翠绿 `#10B981`（`emerald-400`）、高危牛马/黑名单/胜率暴跌点绯红 `#F43F5E`（`rose-500`，强制搭配显式文字标签）。
- **Typography & Hierarchy（2+1 字体法则）**：
  - *Display*：`Outfit`（600/700 字重，`text-wrap: balance`）。
  - *Body*：`Plus Jakarta Sans`（400/500 字重）。
  - *Monospace*：`JetBrains Mono` 搭配强制 `font-variant-numeric: tabular-nums`（`font-mono tabular-nums`）。

---

## 3. Key Product Decisions & Trade-Offs

- **决策 1：实时胜率逻辑回归模型 $P(\text{Win}\mid t)$ 驱动 AI 赛后审判庭证据链**
  - *Chosen Approach*：先通过确定性数学模型逐分钟计算团队经济差、龙魂、大龙与防御塔带来的胜率变化曲线 $P(\text{Win}\mid t)$，定位 $|\Delta P(\text{Win})|$ 最大的前 3 个时间节点及涉事玩家，再将该结构化证据链传入服务端 `gemini-3.8-flash`。
  - *Why*：避免大模型仅凭最终 KDA“看结果说话”（例如某玩家前期 KDA 8/1/3，但 28 分钟带线被抓直接葬送大龙与基地，结合胜率暴跌转折点即可精准定性为“顺风浪输头号战犯”）。

- **决策 2：排位秒退期望收益决策器（Dodge EV Calculator）结合恩怨黑名单**
  - *Chosen Approach*：基于英雄联盟排位机制底层规则（秒退仅扣表面 LP 與等待时间，**隐藏分 MMR 损益为 0**），综合我方 5 人近期 RPI 均值、是否命中黑名单牛马、阵容伤害偏科惩罚计算出预期胜率 $\hat{P}_{\text{win}}$ 与预期 LP 损益 $\mathbb{E}[\Delta \text{LP}] = \hat{P}_{\text{win}} \cdot (+24) + (1 - \hat{P}_{\text{win}}) \cdot (-22)$，与当日秒退成本（`-5 LP` 或 `-15 LP`）直接对比。
  - *Why*：将感性的“队友看起来很坑要不要秒”转化为精确的数学期望决策，真正帮玩家护住隐藏分。

- **决策 3：Tauri 2 `ACL Capabilities` + `RingBuffer` 零内存泄漏双模桥接**
  - *Chosen Approach*：严格按照 Tauri 2 规范设计 `src-tauri/capabilities/default.json` 最小权限集与 `RingBuffer<IpcEnvelope, 256>` 定长环形日志队列；在 Web 预览沙箱中以 100% 相同的 JSON RPC 契约运行同构协议网关。
  - *Why*：既保证桌面编译产物的工业级安全性与低内存常驻（`< 45MB`），又保证云端预览环境零死角交互验证。

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram (v4 Rust + Tauri 2 + Tri-Channel Mesh)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                   React 19 + TypeScript Tactical Workspace (1440px Desktop)                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Top Bar Contract: [NexusAkari Pro] ── [BP查房 · 赛后审判 · 乱斗竞技 · 工具箱 · 内核]   │  │
│  └───────────────────────────────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────┐  ┌──────────────────────────────────────────────────────────┐  │
│  │ Left Telemetry Rail     │  │ Main Tactical Workspace Viewport                         │  │
│  │  • LCU + RCU Dual-Port  │  │  ┌────────────────────────────────────────────────────┐  │  │
│  │    & :2999 Status       │  │  │ 1. 智能BP与查房台: 防误Ban · 阵容三维诊断 · 秒退EV  │  │  │
│  │  • Two-Stage Phase      │  │  │    · 10人RPI · 恩怨预警 · 聊天室脱敏广播 · 一键符文│  │  │
│  │    Simulator (BP/InGame)│  │  ├────────────────────────────────────────────────────┤  │  │
│  │  • Summoner MMR Ring    │  │  │ 2. 战绩穿透与AI审判庭: P(Win|t)胜率曲线与葬送点取证 │  │  │
│  │  • Dodge Penalty Tier & │  │  │    · 2D峡谷坐标热区 · 六维雷达 · Gemini 3.8 审判庭 │  │  │
│  │    Blacklist Counter    │  │  ├────────────────────────────────────────────────────┤  │  │
│  │  • SGP Region Registry  │  │  │ 3. 乱斗&斗魂竞技场: 5ms摇骰秒抢(带回滚) · EHP乘区  │  │  │
│  │    (HN1/BGP2/KR/TW2)    │  │  │    · 版本陷阱预警 · 海克斯强化S级双人流派协同矩阵  │  │  │
│  │                         │  │  ├────────────────────────────────────────────────────┤  │  │
│  │                         │  │  │ 4. 客户端工具箱: :2999敌方闪现急速计时 · 战利品分解 │  │  │
│  │                         │  │  │    精粹工坊 · 无皮村 · 段位伪装 · SGP跨区OB观战器   │  │  │
│  │                         │  │  ├────────────────────────────────────────────────────┤  │  │
│  │                         │  │  │ 5. Tauri 2 Rust 内核台: 源码浏览器 · ACL · 报文队列 │  │  │
│  └─────────────────────────┘  └──┴────────────────────────────────────────────────────┴──┘  │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │ Unified Typed TauriBridgeClient
                            (Tauri 2 IPC invoke/Channel <-> Web Isomorphic Gateway)
┌──────────────────────────────────────────────▼──────────────────────────────────────────────┐
│                   Tauri 2 Core Runtime (Rust `src-tauri` + Isomorphic Engine)               │
│  ┌──────────────────────────────┐ ┌───────────────────────────┐ ┌────────────────────────┐  │
│  │ LCU/RCU & WAMP Engine        │ │ SGP Token-Bucket & :2999  │ │ v4 Math & Gemini AI    │  │
│  │  • 4-Tuple Cred Scanner      │ │  • RSO JWT Entitlements   │ │  • Context-Aware RPI   │  │
│  │    (LCU+RCU Port/Token)      │ │  • DashMap PUUID Cache    │ │  • P(Win|t) Logistic   │  │
│  │  • PID Hot-Reload Watchdog   │ │  • Token-Bucket Limiter   │ │    Throw-Point Finder  │  │
│  │  • WAMP Prefix-Trie Filter   │ │  • LiveClientData :2999   │ │  • Dodge EV & Haste CD │  │
│  │  • Safe Automation FSM       │ │    Spell Haste & Smite    │ │  • Loot Craft Batcher  │  │
│  │  • RingBuffer<IpcPacket,256> │ │  • SGP Spectator Builder  │ │  • Gemini 3.8 Court    │  │
│  └──────────────────────────────┘ └───────────────────────────┘ └────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### v4 Core Mathematical Formulations

1. **实时胜率逻辑回归模型与葬送点取证（Live Win-Probability & Throw-Point Detection）**：
   对于对局分钟数 $t \in [1, T]$，基于蓝色方与红色方的实时经济差 $\Delta G(t)$、小龙差 $\Delta D(t)$、大龙差 $\Delta B(t)$ 与防御塔差 $\Delta Tw(t)$ 计算蓝色方实时胜率：
   $$P(\text{Win} \mid t) = \frac{1}{1 + \exp\left(-\left[0.32 \cdot \frac{\Delta G(t)}{1000 \cdot (1 + 0.08 t)} + 0.45 \cdot \Delta D(t) + 0.95 \cdot \Delta B(t) + 0.28 \cdot \Delta Tw(t)\right]\right)}$$
   定义第 $t$ 分钟的胜率波动冲击量 $\Delta P_t = P(\text{Win}\mid t) - P(\text{Win}\mid t-2)$。当 $|\Delta P_t| \ge 0.18$（单波团战胜率暴跌超 `18%`）时，自动标记为 **关键胜负手/葬送转折点（Key Turning / Throw Point）**。

2. **召唤师技能急速折算与秒退期望值（Summoner Spell Haste & Dodge EV）**：
   - **真实闪现冷却时间**：
     $$\text{CD}_{\text{Flash}} = \text{round}\left(\frac{300}{1 + \frac{18 \cdot \mathbb{I}(\text{CosmicInsight}) + 10 \cdot \mathbb{I}(\text{IonianBoots})}{100}}\right) \in \{300\text{s}, \, 273\text{s}, \, 254\text{s}, \, 234\text{s}\}$$
   - **排位秒退期望净收益（Dodge Net EV）**：
     $$\text{EV}_{\text{play}} = \hat{P}_{\text{win}} \cdot \text{LP}_{\text{gain}} - (1 - \hat{P}_{\text{win}}) \cdot \text{LP}_{\text{loss}}, \quad \text{Recommendation} = \begin{cases} \text{DODGE (果断秒退保隐藏分)}, & \text{if } \text{EV}_{\text{play}} < -\text{Penalty}_{\text{dodge}} \text{ or BlacklistHit} \\ \text{PLAY (正常对局)}, & \text{otherwise} \end{cases}$$

---

## 5. 超大型工程物理分母与原子切片账本 (Sliced Execution Ledger v4)

严格遵循《超大型工程分片推进与零虚标宪章》，全系统固定拆解为 **6 个原子切片（Slice-1 至 Slice-6）**，物理分母恒定锁定为 `6`，按顺序逐片 100% 无删减交付并附带《本轮赤字与未完成自白》：

| 切片编号 | 切片名称与核心职责 | 包含的核心算法、协议与业务边界 | 验收标准 |
| :--- | :--- | :--- | :--- |
| **Slice-1** | **v4 确定性数学引擎、三通道协议报文库与单元测试底座（v4 Math, Win-Prob, Dodge EV & Telemetry Core）** | 1. **上下文感知 RPI 算法**（分位置 Z-Score、逆风抗压补偿 $\gamma_{\text{deficit}}$、输出/承伤双转化率 $\eta_{\text{dmg}}, \eta_{\text{tank}}$）与 **16 类牛马/大腿标签状态机**<br>2. **实时胜率逻辑回归模型 $P(\text{Win}\mid t)$ 与葬送转折点（Throw-Point）检测器**<br>3. **时序衰减并查集开黑侦测**、**BP 阵容三维伤害熵诊断**、**秒退期望收益决策器（Dodge EV）**、**选人聊天室防屏蔽脱敏编码器**、**闪现技能急速折算与战利品（Loot）精粹分解计算器**、**大乱斗 EHP 乘区模型**<br>4. 全真三通道（LCU + RCU/SGP + `:2999`）录制报文池、全球/国服 SGP 路由表 + `node:test` 单元测试全覆盖 | `npx --yes tsx --test` 单元测试 100% 通过，零简化数学分支 |
| **Slice-2** | **Rust + Tauri 2 (ACL & Channel) 原生内核与同构桥接/AI 审判网关（Tauri 2 Rust Core & Isomorphic Server）** | 1. 生产级 `src-tauri` Rust 核心实现（`Cargo.toml`、`tauri.conf.json`、`capabilities/default.json`、LCU/RCU 四元组探测与 PID 热重连看门狗、WAMP 前缀树过滤总线、SGP 令牌桶与 `DashMap` 缓存、`RingBuffer<IpcPacket,256>`、防误 Ban/自动重连/秒回房状态机）<br>2. 前端强类型 `TauriBridgeClient` 双模适配层（自动桥接 Tauri 2 Native IPC 与 Web 同构网关）<br>3. 服务端 `@google/genai` (`gemini-3.8-flash`) 赛后审判庭接口（结合 $P(\text{Win}\mid t)$ 葬送点证据链，输出“毒舌审判官 / 职业教练”双人格报告）与恩怨账本 CRUD 接口 | Rust 核心模块与同构网关 100% 落位，AI 审判、令牌桶与环形缓冲真实响应 |
| **Slice-3** | **战术暗色工作台主框架、双阶段智能 BP 查房、秒退决策与聊天室脱敏广播台（Tactical Shell & Smart BP View）** | 1. 遵循 Top Bar Contract 与 60-30-10 规范的 1440px 战术暗色工作台、三通道（LCU/RCU-SGP/2999）状态栏、SGP 大区切换器与双阶段生命周期切换器（`BP 我方明牌` vs `局内解锁敌方突破口`）<br>2. 智能 BP 控制台：防误触自动接受、主备选秒锁/秒 Ban、**队友预选防误 Ban 仲裁**、断线自动重连/赛后秒回房开关、**一键符文页热写入**、**阵容三维诊断与秒退 EV 决策卡**、**选人聊天室防屏蔽脱敏战报一键广播**<br>3. 10 人 SGP 查房看板：RPI 评分、16 维牛马标签、开黑车队高亮、**恩怨黑名单秒退警报与敌方重点军训标记** | BP 防误 Ban、秒退 EV 计算、聊天室脱敏广播、一键符文写入与 10 人查房完全闭环 |
| **Slice-4** | **深度战绩穿透、胜率曲线 $P(\text{Win}\mid t)$ 葬送点取证、2D 峡谷坐标与 AI 审判庭（Match Analytics & AI Court View）** | 1. SGP 跨区战绩穿透搜索（支持切换 `HN1`、`BGP2`、`HN10`、`KR`、`TW2` 节点与标签筛选）及**召唤师恩怨黑名单/关注榜管理器**<br>2. 单局深度复盘视图：10 人 `tabular-nums` 双转化率对比表、六维 SVG 雷达图、**实时胜率曲线 $P(\text{Win}\mid t)$ 与 Top 3 胜率暴跌转折点（Throw Points）高亮图**、**交互式 2D 召唤师峡谷击杀/资源坐标热区图**、符文真实收益拆解<br>3. Gemini 3.8 Flash 赛后审判庭：将胜率葬送点与多维遥测提交 AI，展示头号战犯、真大腿、背锅占比与分人锐评 | 胜率曲线葬送点、2D 峡谷坐标、恩怨账本与 Gemini AI 审判真实联动 |
| **Slice-5** | **极地大乱斗 5ms 秒抢（带回滚锁）与斗魂竞技场双人协同助手（ARAM Sniper & Arena Synergy Helper）** | 1. 大乱斗选人工作台：摇骰子备选席（Bench Pool）9 槽实时监控、WAMP `< 5ms` 心愿单秒抢触发器、**原英雄一键回滚保护锁**与交互式摇骰子（Reroll）演练<br>2. 大乱斗全英雄平衡数值透视表：五维修正、**真实 EHP 等效生命值倍率**、净强度偏移排序与“版本陷阱英雄”高亮预警<br>3. 斗魂竞技场助手：棱彩/黄金/白银海克斯强化（Augments）检索、英雄专属 S 级海克斯联动与**双人组合流派协同矩阵** | 5ms 摇骰子秒抢与回滚、EHP 排序与竞技场双人协同完整可用 |
| **Slice-6** | **客户端全能工具箱（`:2999` 闪现计时 + 战利品分解 + 跨区 OB）、Tauri 2 内核检视器与全链路验证（Toolkit, Rust Inspector & Ultra Verification）** | 1. 客户端工具箱：**`:2999` 局内敌方 5 人闪现/传送急速折算倒计时器与惩戒斩杀线看板**、**海克斯战利品（Loot）英雄/皮肤碎片批量分解精粹工坊**、**SGP 跨区无延迟 OB 观战启动器**、无皮村全皮肤生涯背景写入、段位/胜点/挑战水晶伪装名片编辑器、5v5 训练房创建器<br>2. **Tauri 2 Rust Core Inspector**：实时检视 `RingBuffer<IpcPacket,256>` 报文流、`capabilities/default.json` 权限矩阵与完整 `src-tauri` 原生 Rust 源码浏览器<br>3. 高保真战术视觉资产生成与集成、全量编译（`compile_applet` + `lint_applet`）、单测（`node:test`）与真实浏览器快照/截图验证（Ultra Mode 闭环） | 全 6 个切片 100% 交付并通过单测、编译与真实浏览器检验 |
