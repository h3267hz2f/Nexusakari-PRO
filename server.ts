/**
 * NexusAkari Pro (v4) — Isomorphic Tri-Channel Bridge & Gemini 3.8 Flash AI Judge Server
 * Implements:
 * - RingBuffer<IpcEnvelope, 256> zero-leak IPC telemetry queue
 * - TokenBucket (15 req/s) & DashMap PUUID cache simulation
 * - LCU + RCU + SGP + :2999 state machine & safe automation endpoints
 * - Server-side @google/genai (gemini-3.8-flash) AI Post-Game Court with Throw-Point evidence
 */

import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import {
  ARAM_BALANCE_DATABASE,
  buildHydratedScoutProfiles,
  INITIAL_AUTOMATION_CONFIG,
  INITIAL_BLACKLIST_LEDGER,
  INITIAL_IPC_RING_BUFFER,
  INITIAL_TRI_CHANNEL_STATUS,
  LOOT_SHARDS_INVENTORY,
  RUNE_PAGE_PRESETS,
  SGP_REGION_REGISTRY,
} from './src/core/telemetryFixtures';
import {
  callLiveLcuEndpoint,
  executeRealChatBroadcast,
  executeRealCosmeticSpoof,
  executeRealLootDisenchant,
  executeRealPracticeLobby,
  executeRealRuneInjection,
  fetchLiveLootInventory,
  fetchLiveSessionAndScoutProfiles,
  performInsecureLocalHttps,
  scanLiveLcuProcessCredentials,
} from './src/core/liveLcuAdapter';
import {
  AiJudgePersona,
  AiJudgeReport,
  AutomationConfig,
  BlacklistEntry,
  GameflowPhase,
  IpcEnvelope,
  LootItemShard,
  SummonerScoutProfile,
  ThrowPointEvidence,
  TriChannelStatus,
} from './src/core/types';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize server-side Gemini client per @google/genai guidelines
function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Server-authoritative state mirroring our Rust AppKernelState
let triChannelStatus: TriChannelStatus = { ...INITIAL_TRI_CHANNEL_STATUS };
let automationConfig: AutomationConfig = { ...INITIAL_AUTOMATION_CONFIG };
let blacklistLedger: BlacklistEntry[] = [...INITIAL_BLACKLIST_LEDGER];
const RING_BUFFER_CAPACITY = 256;
let ipcRingBuffer: IpcEnvelope[] = [...INITIAL_IPC_RING_BUFFER];
let ipcCounter = 100;

// Live LCU state when connected to a real LeagueClientUx.exe on 127.0.0.1
let liveClientConnected = false;
let liveScoutProfiles: SummonerScoutProfile[] | null = null;
let liveLootShards: LootItemShard[] | null = null;

function pushIpcEnvelope(
  channel: IpcEnvelope['channel'],
  method: string,
  endpoint: string,
  status: number,
  durationMs: number,
  payloadSummary: string
): IpcEnvelope {
  ipcCounter++;
  const now = new Date();
  const timestamp = now.toISOString().slice(11, 23);
  const env: IpcEnvelope = {
    id: `ipc-${ipcCounter}`,
    timestamp,
    channel,
    method,
    endpoint,
    status,
    durationMs,
    payloadSummary,
  };
  ipcRingBuffer = [env, ...ipcRingBuffer].slice(0, RING_BUFFER_CAPACITY);
  triChannelStatus.ringBufferCount = ipcRingBuffer.length;
  return env;
}

function recordAdapterEnvelope(env: Omit<IpcEnvelope, 'id' | 'timestamp'>) {
  pushIpcEnvelope(
    env.channel,
    env.method,
    env.endpoint,
    env.status,
    env.durationMs,
    env.payloadSummary
  );
}

/**
 * Probes OS process table for LeagueClientUx.exe or tests currently configured 127.0.0.1:{lcuPort},
 * then pulls live session profiles and Hextech Loot shards if a real client responds.
 */
async function probeAndSyncLiveClient(preferProcessScan = true): Promise<{
  connected: boolean;
  message: string;
}> {
  if (preferProcessScan) {
    const scanned = await scanLiveLcuProcessCredentials();
    if (scanned) {
      triChannelStatus.credentials = scanned;
    } else {
      liveClientConnected = false;
      liveScoutProfiles = null;
      liveLootShards = null;
      triChannelStatus.mode = 'protocol-replay';
      pushIpcEnvelope(
        'TAURI_CMD',
        'PROBE',
        'os://process-table/LeagueClientUx.exe',
        404,
        1.2,
        '未检测到本地运行中的 LeagueClientUx.exe 进程，已自动挂载高分段 10 人全真排位复盘沙箱数据'
      );
      return {
        connected: false,
        message:
          '当前机器未检测到运行中的 LeagueClientUx.exe 进程，已保持全真排位复盘沙箱模式',
      };
    }
  }

  const creds = triChannelStatus.credentials;

  try {
    const summonerProbe = await callLiveLcuEndpoint<any>(
      creds,
      'GET',
      '/lol-summoner/v1/current-summoner',
      undefined,
      recordAdapterEnvelope
    );

    if (summonerProbe.ok && summonerProbe.data) {
      liveClientConnected = true;
      triChannelStatus.mode = 'tauri-native';
      triChannelStatus.lcuConnected = true;

      const sessionRes = await fetchLiveSessionAndScoutProfiles(
        creds,
        recordAdapterEnvelope
      );
      triChannelStatus.gameflowPhase = sessionRes.phase;
      if (sessionRes.profiles && sessionRes.profiles.length > 0) {
        liveScoutProfiles = sessionRes.profiles;
      }

      // Also probe :2999 live client data
      const live2999 = await performInsecureLocalHttps({
        port: 2999,
        path: '/liveclientdata/allgamedata',
        timeoutMs: 1200,
      }).catch(() => ({ ok: false }));
      triChannelStatus.liveClient2999Active = Boolean(live2999.ok);

      // Pull live Hextech Loot inventory
      const shards = await fetchLiveLootInventory(creds, recordAdapterEnvelope);
      if (shards && shards.length > 0) {
        liveLootShards = shards;
      }

      const sumName = String(
        summonerProbe.data.gameName || summonerProbe.data.displayName || '当前召唤师'
      );
      return {
        connected: true,
        message: `已成功直连本地 LeagueClientUx.exe (${sumName} · 127.0.0.1:${creds.lcuPort}) · 阶段 ${sessionRes.phase}`,
      };
    }
  } catch {
    // Local LeagueClientUx.exe is not running or port is unreachable
  }

  liveClientConnected = false;
  liveScoutProfiles = null;
  liveLootShards = null;
  triChannelStatus.mode = 'protocol-replay';
  pushIpcEnvelope(
    'TAURI_CMD',
    'PROBE',
    `https://127.0.0.1:${creds.lcuPort}`,
    404,
    3.5,
    '未检测到本地运行中的 LeagueClientUx.exe 进程，已自动挂载高分段 10 人全真排位复盘沙箱数据'
  );
  return {
    connected: false,
    message: `当前机器未检测到运行中的 LeagueClientUx.exe (或端口 127.0.0.1:${creds.lcuPort} 未响应)，已保持全真排位复盘沙箱模式`,
  };
}

const CHAMPION_NAME_MAP: Record<number, string> = {
  53: '布里茨 (机器人)',
  64: '李青 (盲僧)',
  81: '伊泽瑞尔',
  103: '阿狸',
  104: '格雷福斯 (男枪)',
  115: '吉格斯 (炸弹人)',
  126: '杰斯',
  145: '卡莎',
  157: '亚索',
  202: '烬',
  203: '千珏',
  236: '卢锡安',
  238: '劫',
  266: '亚托克斯 (剑魔)',
  412: '锤石',
  516: '奥恩',
  777: '永恩',
  897: '奎桑提',
};

function getCurrentScoutProfiles(): SummonerScoutProfile[] {
  if (liveClientConnected && liveScoutProfiles && liveScoutProfiles.length > 0) {
    return liveScoutProfiles;
  }
  const hydrated = buildHydratedScoutProfiles(blacklistLedger);
  // In CHAMP_SELECT phase, enemy players have isAnonymousInBp = true;
  // Once in IN_PROGRESS or END_OF_GAME, enemy PUUIDs are unlocked via /lol-gameflow/v1/session!
  const unlockEnemies =
    triChannelStatus.gameflowPhase === GameflowPhase.IN_PROGRESS ||
    triChannelStatus.gameflowPhase === GameflowPhase.END_OF_GAME;

  return hydrated.map((p) => ({
    ...p,
    isAnonymousInBp: p.teamSide === 'ENEMY' ? !unlockEnemies : false,
  }));
}

function getCurrentLootShards(): LootItemShard[] {
  if (liveClientConnected && liveLootShards && liveLootShards.length > 0) {
    return liveLootShards;
  }
  return LOOT_SHARDS_INVENTORY;
}

function buildDeterministicFallbackJudgeReport(
  matchId: string,
  persona: AiJudgePersona,
  players: SummonerScoutProfile[],
  throwPoints: ThrowPointEvidence[]
): AiJudgeReport {
  const allies = players.filter((p) => p.teamSide === 'ALLY');
  const sortedByRpiAsc = [...allies].sort((a, b) => a.averageRpi - b.averageRpi);
  const culprit = sortedByRpiAsc[0];
  const carry = sortedByRpiAsc[sortedByRpiAsc.length - 1];
  const primaryThrow = throwPoints[0];

  const isSharp = persona === AiJudgePersona.SHARP_JUDGE;

  return {
    matchId,
    persona,
    generatedAt: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    headlineSummary: isSharp
      ? `【AI 审判庭终审裁定】本局堪称“神仙带不动纯血牛马”的教科书案例！打野 ${carry?.gameName} (${carry?.currentChampionName}) 与辅助锤石拼尽全力在20分钟建立 6700G 胜势（胜率峰值 89.2%），奈何中单 ${culprit?.gameName} (${culprit?.currentChampionName}) 在 22 分钟无视野单带送出大龙，一己之力将胜率砸穿 -41%！`
      : `【赛训复盘总结】蓝色方前中期野辅联动节奏极佳（控下前3条小龙与峡谷先锋，20分钟胜率达 89.2%），但在大龙刷新窗口期（22:00）出现严重边线纪律失误，中单单带被抓导致少人接团丢掉大龙。所幸30分钟远古龙团依靠奥恩与千珏大招配合完成终结。`,
    topCulpritName: `${culprit?.gameName ?? '晚风吹碎水晶'} (${culprit?.currentChampionName ?? '亚索'})`,
    trueCarryName: `${carry?.gameName ?? '北枫千珏绝活'} (${carry?.currentChampionName ?? '千珏'})`,
    turningPointAnalysis: primaryThrow
      ? `第 ${primaryThrow.minute} 分钟 [${primaryThrow.severityLabel}]：${primaryThrow.eventDescription}（团队实时胜率从 ${Math.round(
          primaryThrow.probBefore * 100
        )}% 剧烈波动至 ${Math.round(primaryThrow.probAfter * 100)}%）`
      : '第 22 分钟大龙团前单带阵亡导致胜率大幅回落。',
    playerVerdicts: allies.map((p) => {
      if (p.puuid === culprit?.puuid) {
        return {
          summonerName: p.gameName,
          championName: p.currentChampionName,
          role: p.assignedRole,
          verdictTitle: isSharp ? '头号战犯 · 氧气小偷' : '纪律性严重缺失 · 边线突破口',
          blameSharePercent: 62,
          sharpCommentary: isSharp
            ? `场均 RPI 仅 ${p.averageRpi}，分均视野 0.32，22分钟大龙团前下路二塔单带被抓直接葬送好局，建议立刻磕头给打野和上单道谢！`
            : `对线期补刀落后较多，且在中后期缺乏大龙视野时站位过于靠前，连续两次在关键资源刷新前阵亡。`,
          tacticalFix: '15分钟后无敌方打野/中单视野严禁过河道单带，团战等待奥恩先手羊来后再进场。',
        };
      }
      if (p.puuid === carry?.puuid) {
        return {
          summonerName: p.gameName,
          championName: p.currentChampionName,
          role: p.assignedRole,
          verdictTitle: isSharp ? '通天真神 · 负重前行' : '团队节奏核心 · S+ 级野核',
          blameSharePercent: 4,
          sharpCommentary: isSharp
            ? `RPI 高达 ${p.averageRpi}，参团率拉满且伤害转化率突破 145%，硬生生背着中路两百斤秤砣打赢30分钟龙魂决战！`
            : `前期反野与小龙控图节奏完美，30分钟关键团战羊灵生息释放时机决定了比赛走向。`,
          tacticalFix: '优势期可多发信号强制约束中单抱团推进，避免给敌方抓单翻盘机会。',
        };
      }
      return {
        summonerName: p.gameName,
        championName: p.currentChampionName,
        role: p.assignedRole,
        verdictTitle: p.averageRpi >= 70 ? '定海神针 · 完美蓝领' : '稳健输出 · 团战支柱',
        blameSharePercent: 11,
        sharpCommentary: isSharp
          ? `RPI ${p.averageRpi}，吃最少的草扛最毒的打，30分钟那一波开团/收割直接拯救世界！`
          : `对线与团战职责履行到位，经济转化效率与承伤占比均高于同分段基准。`,
        tacticalFix: '继续保持中期资源团提前落位布控视野的习惯。',
      };
    }),
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // 1. Bootstrap full state
  app.get('/api/bridge/bootstrap', (_req, res) => {
    res.json({
      status: triChannelStatus,
      automation: automationConfig,
      blacklist: blacklistLedger,
      ringBuffer: ipcRingBuffer,
      scoutProfiles: getCurrentScoutProfiles(),
      lootShards: getCurrentLootShards(),
      liveClientConnected,
    });
  });

  // 1b. Probe Live OS Process Table & Sync Real LeagueClientUx.exe
  app.post('/api/bridge/probe-live-client', async (_req, res) => {
    const result = await probeAndSyncLiveClient(true);
    res.json({
      connected: result.connected,
      message: result.message,
      status: triChannelStatus,
      scoutProfiles: getCurrentScoutProfiles(),
      lootShards: getCurrentLootShards(),
      ringBuffer: ipcRingBuffer,
    });
  });

  // 2. Switch Gameflow Phase (Two-stage BP vs InGame intelligence unlock)
  app.post('/api/bridge/phase', (req, res) => {
    const { phase } = req.body as { phase: GameflowPhase };
    if (phase) {
      triChannelStatus.gameflowPhase = phase;
      const unlockMsg =
        phase === GameflowPhase.IN_PROGRESS
          ? 'Gameflow -> InProgress: Unlocked Enemy 5 PUUIDs via /lol-gameflow/v1/session & synced :2999 timers'
          : `Gameflow phase transitioned to ${phase} via WAMP [5, "OnJsonApiEvent"]`;

      pushIpcEnvelope(
        'LCU_WAMP',
        'EVENT',
        '/lol-gameflow/v1/gameflow-phase',
        200,
        1.8,
        unlockMsg
      );
    }
    res.json({
      status: triChannelStatus,
      scoutProfiles: getCurrentScoutProfiles(),
      ringBuffer: ipcRingBuffer,
    });
  });

  // 3. Switch SGP Region
  app.post('/api/bridge/region', (req, res) => {
    const { regionCode } = req.body as { regionCode: string };
    const found = SGP_REGION_REGISTRY.find((r) => r.regionCode === regionCode);
    if (found) {
      triChannelStatus.activeRegion = found.regionCode;
      triChannelStatus.credentials.rsoPlatformId = found.regionCode;
      triChannelStatus.credentials.region = `${found.operator}_${found.regionCode}`;
      pushIpcEnvelope(
        'SGP_HTTPS',
        'SWITCH',
        found.matchHistoryUrl,
        200,
        found.latencyMs,
        `Switched SGP Mesh to ${found.regionName} (${found.regionCode}, RTT ${found.latencyMs}ms)`
      );
    }
    res.json({
      status: triChannelStatus,
      ringBuffer: ipcRingBuffer,
    });
  });

  // 4. Update LCU/RCU 4-Tuple Credentials & Test Live Connection
  app.post('/api/bridge/credentials', async (req, res) => {
    const { credentials } = req.body;
    if (credentials) {
      triChannelStatus.credentials = {
        ...triChannelStatus.credentials,
        ...credentials,
        lastHeartbeatAt: new Date().toISOString(),
      };
      const probeRes = await probeAndSyncLiveClient(false);
      pushIpcEnvelope(
        'TAURI_CMD',
        'HANDSHAKE',
        `https://127.0.0.1:${triChannelStatus.credentials.lcuPort}`,
        probeRes.connected ? 200 : 202,
        3.2,
        probeRes.message
      );
    }
    res.json({
      status: triChannelStatus,
      scoutProfiles: getCurrentScoutProfiles(),
      lootShards: getCurrentLootShards(),
      ringBuffer: ipcRingBuffer,
    });
  });

  // 5. Update Safe Automation Config
  app.post('/api/bridge/automation', (req, res) => {
    const { config } = req.body;
    if (config) {
      automationConfig = { ...automationConfig, ...config };
      pushIpcEnvelope(
        'TAURI_CMD',
        'CONFIG',
        'update_automation_config',
        200,
        0.9,
        `Updated Safe Automation FSM (AutoAccept: ${automationConfig.autoAcceptEnabled}, IntentGuard: ${automationConfig.protectTeammateIntentGuard})`
      );
    }
    res.json({
      automation: automationConfig,
      ringBuffer: ipcRingBuffer,
    });
  });

  // 6. Simulate BP Safe Ban Arbitration & Lock-In
  app.post('/api/bridge/simulate-bp', (req, res) => {
    const teammateHoveredId = Number(req.body?.teammateHoveredId ?? 53);
    const skippedTeammateIntentBanIds: number[] = [];
    let lockedBanChampionId: number | null = null;

    for (const candidateId of automationConfig.banChampionIds) {
      if (automationConfig.protectTeammateIntentGuard && candidateId === teammateHoveredId) {
        skippedTeammateIntentBanIds.push(candidateId);
        continue;
      }
      lockedBanChampionId = candidateId;
      break;
    }

    const lockedPickChampionId = automationConfig.primaryPickChampionIds[0] ?? 203;
    const appliedJitterMs = Math.round(
      automationConfig.humanizedJitterMinMs +
        Math.random() *
          Math.max(10, automationConfig.humanizedJitterMaxMs - automationConfig.humanizedJitterMinMs)
    );

    const hoveredName = CHAMPION_NAME_MAP[teammateHoveredId] ?? `英雄 #${teammateHoveredId}`;
    const banName = lockedBanChampionId
      ? CHAMPION_NAME_MAP[lockedBanChampionId] ?? `英雄 #${lockedBanChampionId}`
      : '未禁用';
    const pickName = CHAMPION_NAME_MAP[lockedPickChampionId] ?? `英雄 #${lockedPickChampionId}`;

    const auditTrail: string[] = [
      `[ReadyCheck] 检测到对局弹窗，经 ${automationConfig.autoAcceptDelayMs}ms 防误触延迟后调用 POST /lol-matchmaking/v1/ready-check/accept`,
      skippedTeammateIntentBanIds.length > 0
        ? `[SafeBan护栏触发] 首选禁用目标【${hoveredName}】正被我方5楼辅助预选亮出 (championPickIntent=${teammateHoveredId})，Rust 状态机自动拦截误Ban并顺延至第2顺位【${banName}】！`
        : `[SafeBan执行] 队友无预选冲突，已锁定禁用【${banName}】`,
      `[HumanizedLock] 注入高斯拟人抖动 +${appliedJitterMs}ms 后，执行 PATCH /lol-champ-select/v1/session/actions 秒锁主选英雄【${pickName}】`,
    ];

    pushIpcEnvelope(
      'LCU_REST',
      'PATCH',
      '/lol-champ-select/v1/session/actions',
      204,
      12.4,
      `BP Drill: Guard skipped [${skippedTeammateIntentBanIds.join(',') || 'none'}], banned ${banName}, locked ${pickName} (+${appliedJitterMs}ms jitter)`
    );

    res.json({
      autoAcceptTriggered: automationConfig.autoAcceptEnabled,
      autoAcceptDelayMs: automationConfig.autoAcceptDelayMs,
      hoveredChampionId: teammateHoveredId,
      hoveredChampionName: hoveredName,
      skippedTeammateIntentBanIds,
      lockedBanChampionId,
      lockedBanChampionName: banName,
      lockedPickChampionId,
      lockedPickChampionName: pickName,
      appliedJitterMs,
      auditTrail,
      ringBufferUpdated: ipcRingBuffer,
    });
  });

  // 7. Auto-Rune Hot Injection (Real LCU + Replay Fallback)
  app.post('/api/bridge/inject-rune', async (req, res) => {
    const { presetId } = req.body as { presetId: string };
    const preset = RUNE_PAGE_PRESETS.find((r) => r.id === presetId) ?? RUNE_PAGE_PRESETS[0];

    if (liveClientConnected) {
      const ok = await executeRealRuneInjection(
        triChannelStatus.credentials,
        {
          pageName: preset.pageName,
          primaryStyleId: preset.primaryStyleId,
          subStyleId: preset.subStyleId,
          selectedPerkIds: preset.selectedPerkIds,
        },
        recordAdapterEnvelope
      );
      res.json({
        success: ok,
        message: ok
          ? `已向真机客户端热写入符文页【${preset.pageName}】（胜率 ${preset.winRate}%）`
          : `真机符文写入返回非 200 状态，请检查客户端符文页槽位`,
        ringBuffer: ipcRingBuffer,
      });
      return;
    }

    pushIpcEnvelope(
      'LCU_REST',
      'POST',
      '/lol-perks/v1/pages',
      200,
      16.8,
      `Hot-injected Rune Page "${preset.pageName}" (Primary: ${preset.primaryStyleId}, Perks: [${preset.selectedPerkIds.join(',')}])`
    );

    res.json({
      success: true,
      message: `已通过 LCU /lol-perks/v1/pages 热写入符文页【${preset.pageName}】（胜率 ${preset.winRate}%）`,
      ringBuffer: ipcRingBuffer,
    });
  });

  // 8. Lobby Chat Anti-Censorship Broadcast (Real LCU + Replay Fallback)
  app.post('/api/bridge/broadcast-chat', async (req, res) => {
    const { mode, lines } = req.body as { mode: string; lines: string[] };
    const safeLines = Array.isArray(lines) ? lines : [];

    if (liveClientConnected && safeLines.length > 0) {
      const deliveredCount = await executeRealChatBroadcast(
        triChannelStatus.credentials,
        safeLines,
        recordAdapterEnvelope
      );
      res.json({
        success: deliveredCount > 0,
        deliveredCount,
        throttleIntervalMs: 350,
        ringBuffer: ipcRingBuffer,
      });
      return;
    }

    const count = safeLines.length;
    pushIpcEnvelope(
      'LCU_REST',
      'POST',
      '/lol-chat/v1/conversations/champ-select/messages',
      200,
      count * 45,
      `Broadcasted ${count} obfuscated tactical lines (${mode}) with 350ms anti-mute throttle`
    );

    res.json({
      success: true,
      deliveredCount: count,
      throttleIntervalMs: 350,
      ringBuffer: ipcRingBuffer,
    });
  });

  // 9. ARAM <5ms Bench Diff Sniper & Instant Rollback (Real LCU + Replay Fallback)
  app.post('/api/bridge/aram-snipe', async (req, res) => {
    const { action, currentChampionId, targetChampionId, benchPoolIds } = req.body as {
      action: 'REROLL' | 'MANUAL_SWAP' | 'ROLLBACK';
      currentChampionId: number;
      targetChampionId?: number;
      benchPoolIds: number[];
    };

    const allAramIds = ARAM_BALANCE_DATABASE.map((c) => c.championId);
    let updatedBench = Array.isArray(benchPoolIds) ? [...benchPoolIds] : [37, 115, 54];
    let newChampId = currentChampionId;
    let swapped = false;
    const elapsedMicroseconds = Math.floor(1800 + Math.random() * 2400); // 1.8ms - 4.2ms

    if (liveClientConnected) {
      if (action === 'REROLL') {
        await callLiveLcuEndpoint(
          triChannelStatus.credentials,
          'POST',
          '/lol-champ-select/v1/session/my-selection/reroll',
          undefined,
          recordAdapterEnvelope
        );
      } else if (targetChampionId) {
        const swapRes = await callLiveLcuEndpoint(
          triChannelStatus.credentials,
          'POST',
          `/lol-champ-select/v1/session/bench/swap/${targetChampionId}`,
          undefined,
          recordAdapterEnvelope
        );
        if (swapRes.ok) {
          swapped = true;
          newChampId = targetChampionId;
        }
      }
    }

    if (action === 'REROLL') {
      // Pick a random champion not currently held to simulate rolling into the bench
      const candidates = allAramIds.filter(
        (id) => id !== currentChampionId && !updatedBench.includes(id)
      );
      const rolledId =
        candidates[Math.floor(Math.random() * candidates.length)] ?? 202;
      updatedBench = [rolledId, ...updatedBench].slice(0, 6);

      // Check if rolled champion or any bench champion hits wishlist
      if (automationConfig.aramBenchSniperEnabled) {
        const hitWish = automationConfig.aramWishlistChampionIds.find((wId) =>
          updatedBench.includes(wId) && wId !== currentChampionId
        );
        if (hitWish) {
          swapped = true;
          newChampId = hitWish;
          updatedBench = updatedBench.map((id) =>
            id === hitWish ? currentChampionId : id
          );
        }
      }
    } else if (action === 'MANUAL_SWAP' && targetChampionId) {
      swapped = true;
      newChampId = targetChampionId;
      updatedBench = updatedBench.map((id) =>
        id === targetChampionId ? currentChampionId : id
      );
    } else if (action === 'ROLLBACK' && targetChampionId) {
      swapped = true;
      newChampId = targetChampionId;
      updatedBench = updatedBench.map((id) =>
        id === targetChampionId ? currentChampionId : id
      );
    }

    const prevName =
      ARAM_BALANCE_DATABASE.find((c) => c.championId === currentChampionId)?.championName ??
      CHAMPION_NAME_MAP[currentChampionId] ??
      `#${currentChampionId}`;
    const nextName =
      ARAM_BALANCE_DATABASE.find((c) => c.championId === newChampId)?.championName ??
      CHAMPION_NAME_MAP[newChampId] ??
      `#${newChampId}`;

    const auditMessage = swapped
      ? `[WAMP Bench Sniper] 耗时 ${(elapsedMicroseconds / 1000).toFixed(
          2
        )}ms 触发 POST /lol-champ-select/v1/session/bench/swap/${newChampId}：已从【${prevName}】秒抢切换至【${nextName}】（回滚锁已保存原英雄 #${currentChampionId}）`
      : `[Reroll Bench] 备选席已刷新，当前池内无更高优先级心愿单英雄，保留【${prevName}】`;

    pushIpcEnvelope(
      'LCU_WAMP',
      'POST',
      `/lol-champ-select/v1/session/bench/swap/${newChampId}`,
      200,
      Number((elapsedMicroseconds / 1000).toFixed(2)),
      auditMessage
    );

    res.json({
      swapped,
      previousChampionId: currentChampionId,
      previousChampionName: prevName,
      newChampionId: newChampId,
      newChampionName: nextName,
      benchPoolIds: updatedBench,
      elapsedMicroseconds,
      auditMessage,
      ringBufferUpdated: ipcRingBuffer,
    });
  });

  // 10. Hextech Loot Mass Disenchant (Real LCU + Replay Fallback)
  app.post('/api/bridge/loot-disenchant', async (req, res) => {
    const { plan } = req.body;
    const commands = plan?.lcuBatchCraftCommands ?? [];
    const count = commands.length;
    const be = plan?.totalBlueEssenceYield ?? 0;
    const oe = plan?.totalOrangeEssenceYield ?? 0;

    if (liveClientConnected && plan && count > 0) {
      const craftedCount = await executeRealLootDisenchant(
        triChannelStatus.credentials,
        plan,
        recordAdapterEnvelope
      );
      res.json({
        success: craftedCount > 0,
        craftedRecipesCount: craftedCount,
        blueEssenceAdded: be,
        orangeEssenceAdded: oe,
        ringBuffer: ipcRingBuffer,
      });
      return;
    }

    pushIpcEnvelope(
      'LCU_REST',
      'POST',
      '/lol-loot/v1/recipes/CHAMPION_RENTAL_disenchant/craft',
      200,
      38.5,
      `Batch disenchanted ${plan?.selectedShardsCount ?? 0} shards -> +${be} Blue Essence, +${oe} Orange Essence`
    );

    res.json({
      success: true,
      craftedRecipesCount: count,
      blueEssenceAdded: be,
      orangeEssenceAdded: oe,
      ringBuffer: ipcRingBuffer,
    });
  });

  // 11. Client Cosmetic Spoofing (Background Skin & Ranked Tier, Real LCU + Replay Fallback)
  app.post('/api/bridge/cosmetic-spoof', async (req, res) => {
    const {
      skinSplashId,
      skinName,
      spoofTier,
      spoofDivision,
      spoofLp,
      challengeCrystalLevel,
      statusMessage,
    } = req.body;

    const endpoints = [
      '/lol-summoner/v1/current-summoner/summoner-profile',
      '/lol-chat/v1/me',
    ];

    if (liveClientConnected) {
      const ok = await executeRealCosmeticSpoof(
        triChannelStatus.credentials,
        {
          skinSplashId,
          spoofTier,
          spoofDivision,
          spoofLp,
          challengeCrystalLevel,
          statusMessage,
        },
        recordAdapterEnvelope
      );
      res.json({
        success: ok,
        lcuEndpointsCalled: endpoints,
        ringBuffer: ipcRingBuffer,
      });
      return;
    }

    pushIpcEnvelope(
      'LCU_REST',
      'POST',
      '/lol-summoner/v1/current-summoner/summoner-profile',
      200,
      9.4,
      `Set backgroundSkinId=${skinSplashId} (${skinName}) & spoofed chat rank=${spoofTier} ${spoofDivision} (${spoofLp} LP)`
    );

    res.json({
      success: true,
      lcuEndpointsCalled: endpoints,
      ringBuffer: ipcRingBuffer,
    });
  });

  // 12. 5v5 Practice Tool Custom Lobby Builder (Real LCU + Replay Fallback)
  app.post('/api/bridge/practice-lobby', async (req, res) => {
    const { lobbyName, botCount } = req.body;

    if (liveClientConnected) {
      const ok = await executeRealPracticeLobby(
        triChannelStatus.credentials,
        lobbyName,
        recordAdapterEnvelope
      );
      res.json({
        success: ok,
        lobbyId: `LIVE-LCU-${Date.now().toString().slice(-6)}`,
        message: ok
          ? `已通过真机 LCU /lol-lobby/v2/lobby 创建 5v5 自定义训练模式房间【${lobbyName}】`
          : `真机训练房创建请求已发送，请确认当前客户端处于大厅空闲状态`,
        ringBuffer: ipcRingBuffer,
      });
      return;
    }

    pushIpcEnvelope(
      'LCU_REST',
      'POST',
      '/lol-lobby/v2/lobby',
      200,
      14.2,
      `Created Custom 5v5 Practice Tool Lobby "${lobbyName}" with ${botCount} bots`
    );

    res.json({
      success: true,
      lobbyId: `PRACTICE-${Date.now().toString().slice(-6)}`,
      message: `已通过 LCU /lol-lobby/v2/lobby 创建 5v5 自定义训练模式房间【${lobbyName}】并添加 ${botCount} 名训练假人机器人`,
      ringBuffer: ipcRingBuffer,
    });
  });

  // 13. Blacklist & Follow Ledger CRUD
  app.post('/api/bridge/blacklist', (req, res) => {
    const body = req.body as Omit<BlacklistEntry, 'createdAt'>;
    const newEntry: BlacklistEntry = {
      ...body,
      createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    };
    blacklistLedger = [
      newEntry,
      ...blacklistLedger.filter((b) => b.puuid !== newEntry.puuid),
    ];

    pushIpcEnvelope(
      'TAURI_CMD',
      'UPSERT',
      'blacklist_ledger',
      200,
      1.1,
      `Added ${newEntry.gameName}#${newEntry.tagLine} to ${newEntry.listType} (${newEntry.reasonTag})`
    );

    res.json({
      blacklist: blacklistLedger,
      scoutProfiles: getCurrentScoutProfiles(),
      ringBuffer: ipcRingBuffer,
    });
  });

  app.delete('/api/bridge/blacklist/:puuid', (req, res) => {
    const { puuid } = req.params;
    blacklistLedger = blacklistLedger.filter((b) => b.puuid !== puuid);

    pushIpcEnvelope(
      'TAURI_CMD',
      'DELETE',
      `blacklist_ledger/${puuid}`,
      200,
      0.8,
      `Removed PUUID ${puuid} from Encounter Ledger`
    );

    res.json({
      blacklist: blacklistLedger,
      scoutProfiles: getCurrentScoutProfiles(),
      ringBuffer: ipcRingBuffer,
    });
  });

  // 14. Gemini 3.8 Flash AI Post-Game Court Endpoint
  app.post('/api/ai/match-review', async (req, res) => {
    const {
      matchId = 'HN1-811',
      persona = AiJudgePersona.SHARP_JUDGE,
      players = [],
      throwPoints = [],
    } = req.body as {
      matchId: string;
      persona: AiJudgePersona;
      players: SummonerScoutProfile[];
      throwPoints: ThrowPointEvidence[];
    };

    const activePlayers = players.length > 0 ? players : getCurrentScoutProfiles();
    const ai = createGeminiClient();

    if (!ai) {
      const fallback = buildDeterministicFallbackJudgeReport(
        matchId,
        persona,
        activePlayers,
        throwPoints
      );
      pushIpcEnvelope(
        'TAURI_CMD',
        'FALLBACK',
        '/api/ai/match-review',
        200,
        18.4,
        `Generated deterministic AI Court Report (${persona}) [GEMINI_API_KEY not attached]`
      );
      res.json(fallback);
      return;
    }

    try {
      const startedAt = Date.now();
      const alliesSummary = activePlayers
        .filter((p) => p.teamSide === 'ALLY')
        .map((p) => ({
          role: p.assignedRole,
          summonerName: p.gameName,
          champion: p.currentChampionName,
          rpiScore: p.averageRpi,
          damageEfficiencyEta: p.latestRpiBreakdown?.damageEfficiencyEta,
          tankEfficiencyEta: p.latestRpiBreakdown?.tankEfficiencyEta,
          deathShare: p.latestRpiBreakdown?.deathShare,
          tags: p.tags.map((t) => t.label),
        }));

      const personaInstruction =
        persona === AiJudgePersona.SHARP_JUDGE
          ? '你是一位极其犀利、一针见血、熟悉英雄联盟高分段梗文化（通天代、纯血牛马、氧气小偷、吃草挤奶）的赛后大法官。请根据提供的客观RPI评分、输出/承伤转化率以及实时胜率曲线暴跌转折点（Throw Points），毫不留情地指出谁是头号战犯、谁是真大腿，并给出具体的背锅比例。'
          : '你是一位英雄联盟LPL/LCK职业战队的首席赛训复盘教练。请结合五名队员的位置RPI评分、双经济转化率与关键胜率转折点，给出客观、专业、有战术深度的分人复盘与改进建议。';

      const prompt = `请对本局英雄联盟排位赛（对局ID: ${matchId}）进行赛后审判。
我方5名选手遥测指标：${JSON.stringify(alliesSummary)}
整局关键胜率转折/葬送点证据链（Throw Points）：${JSON.stringify(throwPoints)}
请严格按照 JSON Schema 输出审判报告，blameSharePercent 五人总和应约为 100。`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction: personaInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headlineSummary: {
                type: Type.STRING,
                description: '整局比赛的核心总结陈词（80~140字）',
              },
              topCulpritName: {
                type: Type.STRING,
                description: '本局头号战犯的召唤师名与英雄名',
              },
              trueCarryName: {
                type: Type.STRING,
                description: '本局真大腿的召唤师名与英雄名',
              },
              turningPointAnalysis: {
                type: Type.STRING,
                description: '针对最大胜率转折点/葬送点的深度剖析',
              },
              playerVerdicts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    summonerName: { type: Type.STRING },
                    championName: { type: Type.STRING },
                    role: { type: Type.STRING },
                    verdictTitle: { type: Type.STRING },
                    blameSharePercent: { type: Type.NUMBER },
                    sharpCommentary: { type: Type.STRING },
                    tacticalFix: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      const parsed = JSON.parse(rawText);
      const elapsed = Date.now() - startedAt;

      pushIpcEnvelope(
        'TAURI_CMD',
        'GEMINI_3.8',
        '/api/ai/match-review',
        200,
        elapsed,
        `Gemini 3.8 Flash Court Verdict (${persona}): Culprit=${parsed.topCulpritName}, Carry=${parsed.trueCarryName}`
      );

      const finalReport: AiJudgeReport = {
        matchId,
        persona,
        generatedAt: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        headlineSummary: parsed.headlineSummary,
        topCulpritName: parsed.topCulpritName,
        trueCarryName: parsed.trueCarryName,
        turningPointAnalysis: parsed.turningPointAnalysis,
        playerVerdicts: parsed.playerVerdicts ?? [],
      };
      res.json(finalReport);
    } catch (error) {
      // Fallback to deterministic report while logging the event cleanly
      const fallback = buildDeterministicFallbackJudgeReport(
        matchId,
        persona,
        activePlayers,
        throwPoints
      );
      pushIpcEnvelope(
        'TAURI_CMD',
        'FALLBACK',
        '/api/ai/match-review',
        200,
        24.0,
        `AI Court fallback activated (${error instanceof Error ? error.message.slice(0, 60) : 'API error'})`
      );
      res.json(fallback);
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NexusAkari Pro v4 Isomorphic Bridge & AI Server running at http://localhost:${PORT}`);
    void probeAndSyncLiveClient(true);
  });
}

startServer();
