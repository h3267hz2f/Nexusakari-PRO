# NexusAkari Pro (v4) — 磁盘切片账本 (Disk Slice Ledger)

> **进度核算唯一公式**：`已完成且无简化的切片数 / 切片总数`
> **当前全工程总进度**：`10 / 10` (**100.00%**)

## 物理分母与切片队列 (Slice Queue)

### [x] `Slice-1`: 核心类型契约、无简化 v4 数学引擎与全量遥测基座 (已完成 · 单元测试 6/6 全绿)
- **包含文件**：
  - `/src/core/types.ts` (446 行)
  - `/src/core/mathEngine.ts` (1,251 行)
  - `/src/core/telemetryFixtures.ts` (1,661 行)
  - `/src/core/mathEngine.test.ts` (295 行 · `6/6` 测试用例通过)
- **核心职责（零简化）**：
  - 完整定义 LCU + RCU + SGP + `:2999` 三通道类型契约、`RingBuffer<IpcEnvelope, 256>`、恩怨黑名单与上分大腿关注账本。
  - **Context-Aware RPI v4 局势感知相对表现指数**：分位置期望基准（TOP/JGL/MID/ADC/SUP）+ 双经济转化率（输出转化率 $\eta_{\text{dmg}}$ + 承伤转化率 $\eta_{\text{tank}}$）+ 逆风抗压补偿系数 $\gamma_{\text{deficit}} \in [1.0, 1.35]$。
  - **Time-Decayed Union-Find 组排黑店侦测器**、**P(Win|t) 实时胜率逻辑回归与头号战犯拐点抓手**、**BP 阵容香农熵与秒退期望值 (Dodge EV) 精算器**、**大厅零宽字符防屏蔽播报器**、**召唤师技能急速折算与大乱斗真实有效生命值 (EHP) 评级器**、**海克斯战利品批量分解精算器**。

### [x] `Slice-2`: 同构三通道网关服务、Rust Tauri 2 内核基础源码与 GitHub Actions CI (已完成)
- **包含文件**：
  - `/server.ts` (975 行)
  - `/src/core/rustKernelSources.ts` (865 行)
  - `/.github/workflows/rust-tauri-ci.yml` (104 行)
- **核心职责（零简化）**：
  - 实现同构三通道状态机（`RingBuffer<IpcEnvelope, 256>` 零泄漏环形队列、`15 req/s` 令牌桶限流、生命周期两阶段情报解锁、安全自动化仲裁接口、海克斯战利品批处理、生涯皮肤原画挂载与段位伪装、5v5 训练房创建）。
  - 实现服务端 `@google/genai` (`gemini-3.8-flash`) AI 赛后毒舌审判庭与金牌赛训教练双人格接口（含确定性离线兜底引擎）。

### [x] `Slice-3`: 顶栏导航、左侧三通道状态栏与 Tab 1 战前智能 BP 与安全自动化工作台 (已完成)
- **包含文件**：
  - `/src/index.css` (68 行)
  - `/src/components/TopBar.tsx` (128 行)
  - `/src/components/LeftTelemetryRail.tsx` (315 行)
  - `/src/components/SmartBpWorkspace.tsx` (782 行)
- **核心职责（零简化）**：
  - 遵循 Tactical Dark Glass 美学与 Zero-Pill 铁律。
  - 实现战前 BP 10 人全息态势感知、队友预选意图护栏 (`championPickIntent` 防误 Ban 仲裁器)、高斯拟人抖动锁人、阵容香农熵偏科诊断、秒退期望值 (Dodge EV) 精算器、一键高胜率符文热注入与大厅零宽字符防屏蔽战报发送器。

### [x] `Slice-4`: Tab 2 跨区战绩溯源、组排黑店雷达、胜率葬送点曲线、符文收益审计与 AI 赛后审判庭工作台 (已完成)
- **包含文件**：
  - `/src/components/MatchAnalyticsWorkspace.tsx` (1,150 行)
- **核心职责（零简化）**：
  - 实现 SGP 跨区 10 人战绩溯源矩阵（双阶段情报解锁）、Time-Decayed Union-Find 组排黑店与宿敌碰撞拓扑图、SVG 5 维位置归一战术雷达、30 分钟黄金差与 $P(\text{Win}|t)$ 实时胜率面积图 + 战犯拐点标注、单局符文 `perk0Var1..3` 真实收益审计表、Gemini 3.8 Flash 赛后审判庭双人格裁决面板，以及本地恩怨黑名单与上分大腿关注账本 CRUD。

### [x] `Slice-5`: Tab 3 大乱斗与海克斯斗魂竞技场专项增强工作台 (已完成)
- **包含文件**：
  - `/src/components/AramArenaWorkspace.tsx` (567 行)
- **核心职责（零简化）**：
  - 实现大乱斗全英雄平衡性 Buffer 透视与真实有效生命值 (EHP) 折算陷阱预警、WAMP `<5ms` 备选席心愿单秒抢自动机与瞬间后悔药回滚锁，以及海克斯斗魂竞技场流派强化符文协同评级矩阵。

### [x] `Slice-6`: Tab 4 客户端全能工具箱、Tab 5 Rust 内核检视器与主应用外壳组装 (已完成)
- **包含文件**：
  - `/src/components/ClientToolkitWorkspace.tsx` (844 行)
  - `/src/components/TauriKernelInspector.tsx` (306 行)
  - `/src/App.tsx` (358 行)
- **核心职责（零简化）**：
  - 实现局内 `:2999` 敌方五人召唤师技能急速折算计时器与打野宠物惩戒斩杀线追踪、海克斯战利品批量分解精粹计算工坊、SGP 跨区免延迟 OB 观战命令行生成器、生涯背景未拥有皮肤高清原画替换 + 王者段位伪装器 + 5v5 训练房构建器，以及 Tauri 2 Rust 内核源码检视器与 256 帧 IPC 环形队列监控台。

### [x] `Slice-7`: Rust 桌面端真机 HTTPS/WSS 协议栈与 `:2999` 实时轮询器补齐 (已完成 · GitHub Actions Run #5 全绿验证)
- **包含文件**：
  - `/src-tauri/Cargo.toml` (38 行)
  - `/src-tauri/src/lcu_connector.rs` (438 行)
  - `/src-tauri/src/sgp_client.rs` (296 行)
  - `/src-tauri/src/automation.rs` (340 行)
- **核心职责（零简化）**：
  - 引入 `reqwest` (`rustls-tls`, `danger_accept_invalid_certs(true)`)、`tokio-tungstenite` (`rustls-tls-webpki-roots`) 与 `dashmap` 并发缓存。
  - 实现 `LcuRestClient`、RCU `/entitlements/v1/token` JWT 提取、WAMP `[8, "OnJsonApiEvent"]` 帧解析与 WebSocket 订阅循环、进程存活守护 (`spawn_pid_watchdog`)。
  - 实现 `SgpHttpClient` 跨区战绩拉取（`DashMap` L1 命中 + `15 req/s` 令牌桶限流）与 `:2999/liveclientdata/allgamedata` 局内轮询器。

### [x] `Slice-8`: Tauri 2 原生 IPC 双模路由与单局符文收益 `perk0Var1..3` 深度透视面板 (已完成)
- **包含文件**：
  - `/src-tauri/src/lib.rs` (325 行)
  - `/src/bridge/tauriClient.ts` (363 行)
  - `/src/components/MatchAnalyticsWorkspace.tsx` (Section 07 单局符文真实触发收益审计表)
- **核心职责（零简化）**：
  - 在 `tauriClient.ts` 中实现 `invokeOrFetch` 双模分发器：优先调用 `window.__TAURI_INTERNALS__.invoke` 原生 Rust 命令，Web 预览态下自动回退至同构 HTTP 桥接。
  - 在 `MatchAnalyticsWorkspace.tsx` 中新增 `07. 单局符文真实触发收益审计 (Post-Game Rune Perk Telemetry Breakdown)`，完整呈现主系基石与副系小符文的 `Var1 / Var2 / Var3` 伤害、治疗与冷却折算收益。

### [x] `Slice-9`: 本地真机 `LeagueClientUx.exe` 进程扫描器、免证书校验 HTTPS 客户端与 Riot 原始 JSON 转换适配器 (已完成)
- **包含文件**：
  - `/src/core/liveLcuAdapter.ts` (858 行)
  - `/src/core/mathEngine.test.ts` (`Slice-1.6` 命令行解析与 Riot 原始 JSON 转换单元测试)
- **核心职责（零简化）**：
  - 实现跨平台 `scanLiveLcuProcessCredentials()`（Windows PowerShell `Get-CimInstance Win32_Process` + WMIC 兜底 + Unix `ps`），自动提取运行中 `LeagueClientUx.exe` 的 `--app-port`、`--remoting-auth-token`、`--riotclient-app-port`、`--riotclient-auth-token` 与 `--rso_platform_id`。
  - 实现基于 `node:https` (`rejectUnauthorized: false`) 的 `callLiveLcuEndpoint()` 与 `pollLiveClient2999()`，穿透拳头自签名证书直连 `https://127.0.0.1:{lcuPort}` 与 `:2999`。
  - 实现 `mapRawLcuLootToShards()` 与 `mapRawLcuGamesToMatchStats()`，将拳头原始 `/lol-loot/v1/player-loot-map`、`/lol-champ-select/v1/session` 与 `/lol-match-history/v1/products/lol/{puuid}/matches` JSON 实时转换为 `SummonerScoutProfile[]`（含 Context-Aware RPI v4 实时计算）与 `LootItemShard[]`。

### [x] `Slice-10`: 全栈真机 LCU 读写闭环接线与「真机直连 / 复盘沙箱」自适应切换 (已完成)
- **包含文件**：
  - `/server.ts` (接入 `liveLcuAdapter.ts` 真机探测、实时会话/战利品拉取与真机符文写入/喊话/备选席秒抢/批量分解/生涯伪装/5v5训练房创建)
  - `/src/components/LeftTelemetryRail.tsx` (新增「数据源模式：真机 LCU 直连 / 全真复盘沙箱」状态指示与「探测本地 LOL 进程并同步」按钮)
  - `/src/components/ClientToolkitWorkspace.tsx` & `/src/App.tsx` (动态挂载真机战利品碎片库存与实时召唤师档案)
- **核心职责（零简化）**：
  - 当本地运行 `LeagueClientUx.exe` 时，一键探测自动切换至 `真机 LCU 直连` 模式，真实读写玩家本地客户端；当处于云端无客户端环境或未启动游戏时，自动维持 `全真复盘沙箱` 模式。
