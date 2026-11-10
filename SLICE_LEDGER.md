# NexusAkari Pro (v4) — 磁盘物理分母与原子切片追踪账本 (Disk Slice Ledger)

- **锁定物理分母（Total Slices）**：`8`（含原计划 `Slice-1`～`Slice-6` 及代码审查后追加的桌面端补完切片 `Slice-7`～`Slice-8`）
- **当前已完成且无简化的切片数（Completed Slices）**：`8 / 8` (`100.00%`)
- **架构底座**：`Rust (src-tauri: Tokio + Reqwest + Tungstenite + DashMap) + Tauri 2 + React 19 + TypeScript`

---

## 原子切片队列与状态明细

### [x] Slice-1: v4 确定性数学引擎、三通道协议报文库与单元测试底座 (`已完成 1/8`)
- **核心文件**：`/src/core/types.ts`、`/src/core/mathEngine.ts`、`/src/core/telemetryFixtures.ts`、`/src/core/mathEngine.test.ts`（`5/5` 全通过）。

### [x] Slice-2: 同构协议网关与 Gemini 3.8 Flash 赛后审判庭后端 (`已完成 2/8`)
- **核心文件**：`/server.ts`、`/.github/workflows/rust-tauri-ci.yml`。

### [x] Slice-3: 战术暗色工作台主框架、双阶段智能 BP 查房、秒退决策与聊天室脱敏广播台 (`已完成 3/8`)
- **核心文件**：`/src/index.css`、`/src/components/TopBar.tsx`、`/src/components/LeftTelemetryRail.tsx`、`/src/components/SmartBpWorkspace.tsx`。

### [x] Slice-4: 深度战绩穿透、胜率曲线 $P(\text{Win}\mid t)$ 葬送点取证、2D 峡谷坐标与 AI 审判庭 (`已完成 4/8`)
- **核心文件**：`/src/components/MatchAnalyticsWorkspace.tsx`。

### [x] Slice-5: 极地大乱斗 5ms 秒抢（带回滚锁）与斗魂竞技场双人协同助手 (`已完成 5/8`)
- **核心文件**：`/src/components/AramArenaWorkspace.tsx`。

### [x] Slice-6: 客户端全能工具箱（`:2999` 闪现计时 + 战利品分解 + 跨区 OB）与 Tauri 2 内核检视器 (`已完成 6/8`)
- **核心文件**：`/src/components/ClientToolkitWorkspace.tsx`、`/src/components/TauriKernelInspector.tsx`、`/src/App.tsx`。

### [x] Slice-7: Rust 原生 HTTPS/WAMP/看门狗网络层与 `:2999` 轮询全量补完 (`已完成 7/8`)
- **核心文件**：
  - `/src-tauri/Cargo.toml`：引入 `reqwest` (`rustls-tls`)、`tokio-tungstenite` (`rustls-tls-webpki-roots`) 与 `futures-util`。
  - `/src-tauri/src/lcu_connector.rs`：实现忽略自签名证书的 `LcuRestClient`、RCU `/entitlements/v1/token` RSO JWT 提取器、WAMP `[8, "OnJsonApiEvent"]` 报文解析器、异步 WebSocket 订阅循环 `spawn_wamp_subscriber_loop` 与 2 秒级 `spawn_pid_watchdog` 进程热重连看门狗。
  - `/src-tauri/src/sgp_client.rs`：实现 `SgpHttpClient`、`DashMap` L1 缓存命中短路、15 req/s 令牌桶限流请求与 10 人并发 `batch_scout_players`。
  - `/src-tauri/src/automation.rs`：实现 `:2999` 局内 `poll_live_client_2999` 实时轮询器、自动接受/断线重连/赛后秒回房执行器与 350ms 节流零宽字符聊天室广播器。

### [x] Slice-8: Tauri 2 完整 IPC 命令路由、前端 `tauriClient.ts` 真实 `invoke` 双模分流与赛后符文真实收益拆解面板 (`已完成 8/8`)
- **核心文件**：
  - `/src-tauri/src/lib.rs`：汇总暴露全部 14 个原生内核 API 方法，对接 `LcuRestClient`、`SgpHttpClient` 与后台看门狗生命周期，并附带 `test_kernel_state_initialization_and_ring_buffer_recording` 单元测试。
  - `/src/bridge/tauriClient.ts`：实现真正的 `invokeOrFetch` 双模分发器，当检测到 `window.__TAURI_INTERNALS__.invoke` 时优先调用原生 Rust IPC 命令，Web 预览环境下无缝回退至同构 HTTP 网关。
  - `/src/components/MatchAnalyticsWorkspace.tsx` & `/src/core/rustKernelSources.ts`：补齐单局赛后“07. 单局符文真实触发收益与等效经济拆解 (Post-Game Rune Perk Telemetry)”面板，并同步最新 Rust 核心源码。
