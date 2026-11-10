# NexusAkari Pro (v4) — 磁盘物理分母与原子切片追踪账本 (Disk Slice Ledger)

- **锁定物理分母（Total Slices）**：`6`
- **当前已完成且无简化的切片数（Completed Slices）**：`2 / 6` (`33.33%`)
- **架构底座**：`Rust (src-tauri) + Tauri 2 (ACL & IPC Channel) + React 19 + TypeScript`

---

## 原子切片队列与状态明细

### [x] Slice-1: v4 确定性数学引擎、三通道协议报文库与单元测试底座 (`已完成 1/6`)
- **核心文件**：
  - `/src/core/types.ts`：三通道（LCU + RCU/SGP + `:2999`）强类型契约、16 类牛马标签、胜率曲线葬送点、恩怨账本、战利品工坊与 Tauri 2 IPC 模型。
  - `/src/core/mathEngine.ts`：
    1. `calculateContextAwareRpi`：分位置（TOP/JGL/MID/BOT/SUP）Z-Score + 逆风抗压补偿 $\gamma_{\text{deficit}} \in [1.0, 1.35]$ + 输出/承伤双经济转化率 $\eta_{\text{dmg}}, \eta_{\text{tank}}$。
    2. `evaluateSummonerTags`：16 类动态牛马/大腿标签判定状态机与优先级消歧。
    3. `detectPremadeSquads`：时序衰减并查集（Time-Decayed Union-Find）开黑车队与高分段撞车宿敌识别。
    4. `analyzeWinProbabilityAndThrows`：逐分钟实时胜率逻辑回归 $P(\text{Win}\mid t)$ 与 Top 3 胜率暴跌转折点（Throw Points）取证。
    5. `diagnoseTeamComposition`：BP 阵容三维伤害香农熵偏科诊断与坦度/控制/清线评分。
    6. `calculateDodgeExpectedValue`：排位秒退期望净收益（Dodge EV）与当日惩罚阶梯计算。
    7. `formatAntiFilterLobbyChat`：选人聊天室三模式战报与零宽字符/同义词防屏蔽脱敏编码器。
    8. `calculateSummonerSpellCooldown` / `calculateSmiteThreshold` / `calculateAramEhpMetrics` / `calculateLootDisenchantPlan`。
  - `/src/core/telemetryFixtures.ts`：全真 LCU/SGP/`:2999` 录制数据集、大区路由注册表、大乱斗平衡库、斗魂竞技场海克斯库、战利品库存与恩怨黑名单种子。
  - `/src/core/mathEngine.test.ts`：`node:test` 全分支确定性单元测试（`5/5` 全通过）。

### [x] Slice-2: Rust + Tauri 2 (ACL & Channel) 原生内核与同构桥接/AI 审判网关 (`已完成 2/6`)
- **核心文件**：
  - `/src-tauri/Cargo.toml`、`/src-tauri/tauri.conf.json`、`/src-tauri/capabilities/default.json`
  - `/src-tauri/src/main.rs`、`/src-tauri/src/lib.rs`、`/src-tauri/src/lcu_connector.rs`、`/src-tauri/src/sgp_client.rs`、`/src-tauri/src/automation.rs`
  - `/src/core/rustKernelSources.ts`：Tauri 2 Rust 原生模块源码注册表。
  - `/src/bridge/tauriClient.ts`：前端双模透明 IPC 桥接器（Tauri 2 Native `invoke/Channel` <-> Web 同构网关）。
  - `/server.ts`：Express 同构三通道网关、令牌桶限流与 `RingBuffer<IpcEnvelope, 256>`、服务端 `@google/genai` (`gemini-3.8-flash`) 赛后审判庭路由。

### [ ] Slice-3: 战术暗色工作台主框架、双阶段智能 BP 查房、秒退决策与聊天室脱敏广播台 (`待推进`)
- **核心文件**：
  - `/src/index.css`：Tailwind v4 主题变量、字体绑定与 `tabular-nums` 规范。
  - `/src/components/TopBar.tsx`、`/src/components/LeftTelemetryRail.tsx`
  - `/src/components/SmartBpWorkspace.tsx`：双阶段 10 人查房看板、阵容三维诊断、秒退 EV 决策卡、防误 Ban 秒锁控制台、一键符文页热写入、选人聊天室防屏蔽战报广播。

### [ ] Slice-4: 深度战绩穿透、胜率曲线 $P(\text{Win}\mid t)$ 葬送点取证、2D 峡谷坐标与 AI 审判庭 (`待推进`)
- **核心文件**：
  - `/src/components/MatchAnalyticsWorkspace.tsx`：跨区战绩穿透、10 人双转化率对比表、六维 SVG 雷达图、实时胜率曲线 $P(\text{Win}\mid t)$ 与葬送转折点标注、2D 召唤师峡谷坐标热区图、恩怨黑名单管理、Gemini 3.8 Flash 赛后审判庭面板。

### [ ] Slice-5: 极地大乱斗 5ms 秒抢（带回滚锁）与斗魂竞技场双人协同助手 (`待推进`)
- **核心文件**：
  - `/src/components/AramArenaWorkspace.tsx`：大乱斗 9 槽备选席（Bench）5ms 秒抢与一键回滚锁、全英雄 EHP 等效生命值与净强度偏移透视表、斗魂竞技场棱彩/黄金/白银海克斯与双人流派协同矩阵。

### [ ] Slice-6: 客户端全能工具箱（`:2999` 闪现计时 + 战利品分解 + 跨区 OB）、Tauri 2 内核检视器与全链路验证 (`待推进`)
- **核心文件**：
  - `/src/components/ClientToolkitWorkspace.tsx`：`:2999` 敌方闪现急速折算倒计时器、海克斯战利品批量分解精粹工坊、SGP 跨区 OB 观战启动器、无皮村全皮肤背景替换、段位/挑战水晶伪装、5v5 训练房创建。
  - `/src/components/TauriKernelInspector.tsx`：Tauri 2 Rust 源码检视器、ACL 权限矩阵与 IPC `RingBuffer` 实时监控台。
  - `/src/App.tsx`：全工作区整合、高保真视觉资产与 Ultra Mode 真实浏览器验证。
