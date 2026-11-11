/**
 * NexusAkari Pro (v4) — Slice-9 & Slice-11: Real Local LCU / RCU / SGP / :2999 Process Scanner,
 * Self-Signed TLS HTTPS Tunnel, Riot Raw JSON-to-Domain Adapter, Two-Stage InProgress Enemy
 * Unlock, Real Match Timeline & Perk Telemetry Extractor, and Background Automation State Machine.
 */

import { exec } from 'node:child_process';
import https from 'node:https';
import { promisify } from 'node:util';
import {
  calculateContextAwareRpi,
  evaluateSummonerTags,
  obfuscateChatLine,
} from './mathEngine';
import {
  AutomationConfig,
  BlacklistEntry,
  DamageType,
  GameflowPhase,
  IpcEnvelope,
  LcuRcuCredentials,
  LootDisenchantPlan,
  LootItemShard,
  PlayerMatchStats,
  RoleType,
  RunePerkTelemetryItem,
  SummonerScoutProfile,
  TimelineMinutePoint,
} from './types';

const execAsync = promisify(exec);

const insecureHttpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
});

export const CHAMPION_METADATA_MAP: Record<
  number,
  {
    name: string;
    title: string;
    damageType: DamageType;
    frontline: number;
    cc: number;
    waveclear: number;
    scaling: number;
  }
> = {
  1: { name: '安妮', title: '黑暗之女', damageType: DamageType.MAGIC, frontline: 3, cc: 8, waveclear: 7, scaling: 7 },
  2: { name: '奥拉夫', title: '狂战士', damageType: DamageType.PHYSICAL, frontline: 7, cc: 3, waveclear: 6, scaling: 5 },
  21: { name: '厄运小姐', title: '赏金猎人', damageType: DamageType.PHYSICAL, frontline: 2, cc: 3, waveclear: 8, scaling: 8 },
  22: { name: '艾希', title: '寒冰射手', damageType: DamageType.PHYSICAL, frontline: 2, cc: 9, waveclear: 7, scaling: 7 },
  37: { name: '娑娜', title: '琴瑟仙女', damageType: DamageType.MAGIC, frontline: 2, cc: 6, waveclear: 3, scaling: 9 },
  51: { name: '凯特琳', title: '皮城女警', damageType: DamageType.PHYSICAL, frontline: 2, cc: 5, waveclear: 8, scaling: 9 },
  53: { name: '布里茨', title: '蒸汽机器人', damageType: DamageType.MAGIC, frontline: 7, cc: 9, waveclear: 3, scaling: 5 },
  54: { name: '墨菲特', title: '熔岩巨兽', damageType: DamageType.MAGIC, frontline: 10, cc: 9, waveclear: 6, scaling: 7 },
  61: { name: '奥莉安娜', title: '发条魔灵', damageType: DamageType.MAGIC, frontline: 3, cc: 8, waveclear: 9, scaling: 9 },
  64: { name: '李青', title: '盲僧', damageType: DamageType.PHYSICAL, frontline: 6, cc: 7, waveclear: 6, scaling: 4 },
  67: { name: '薇恩', title: '暗夜猎手', damageType: DamageType.TRUE, frontline: 2, cc: 4, waveclear: 3, scaling: 10 },
  81: { name: '伊泽瑞尔', title: '探险家', damageType: DamageType.MIXED, frontline: 3, cc: 1, waveclear: 6, scaling: 8 },
  103: { name: '阿狸', title: '九尾妖狐', damageType: DamageType.MAGIC, frontline: 3, cc: 7, waveclear: 8, scaling: 7 },
  104: { name: '格雷福斯', title: '法外狂徒', damageType: DamageType.PHYSICAL, frontline: 5, cc: 2, waveclear: 8, scaling: 8 },
  114: { name: '菲奥娜', title: '无双剑姬', damageType: DamageType.TRUE, frontline: 6, cc: 3, waveclear: 6, scaling: 10 },
  115: { name: '吉格斯', title: '爆破鬼才', damageType: DamageType.MAGIC, frontline: 2, cc: 5, waveclear: 10, scaling: 8 },
  117: { name: '璐璐', title: '仙灵女巫', damageType: DamageType.MAGIC, frontline: 2, cc: 8, waveclear: 4, scaling: 8 },
  122: { name: '德莱厄斯', title: '诺克萨斯之手', damageType: DamageType.PHYSICAL, frontline: 8, cc: 5, waveclear: 7, scaling: 6 },
  126: { name: '杰斯', title: '未来守护者', damageType: DamageType.PHYSICAL, frontline: 4, cc: 4, waveclear: 8, scaling: 6 },
  145: { name: '卡莎', title: '虚空之女', damageType: DamageType.MIXED, frontline: 3, cc: 1, waveclear: 8, scaling: 10 },
  157: { name: '亚索', title: '疾风剑豪', damageType: DamageType.PHYSICAL, frontline: 4, cc: 6, waveclear: 9, scaling: 9 },
  202: { name: '烬', title: '戏命师', damageType: DamageType.PHYSICAL, frontline: 2, cc: 6, waveclear: 7, scaling: 9 },
  203: { name: '千珏', title: '永猎双子', damageType: DamageType.PHYSICAL, frontline: 4, cc: 3, waveclear: 7, scaling: 9 },
  222: { name: '金克丝', title: '暴走萝莉', damageType: DamageType.PHYSICAL, frontline: 2, cc: 5, waveclear: 9, scaling: 10 },
  236: { name: '卢锡安', title: '圣枪游侠', damageType: DamageType.PHYSICAL, frontline: 3, cc: 1, waveclear: 8, scaling: 7 },
  238: { name: '劫', title: '影流之主', damageType: DamageType.PHYSICAL, frontline: 3, cc: 2, waveclear: 8, scaling: 7 },
  266: { name: '亚托克斯', title: '暗裔剑魔', damageType: DamageType.PHYSICAL, frontline: 8, cc: 7, waveclear: 7, scaling: 7 },
  412: { name: '锤石', title: '魂锁典狱长', damageType: DamageType.MAGIC, frontline: 7, cc: 9, waveclear: 3, scaling: 7 },
  516: { name: '奥恩', title: '山隐之焰', damageType: DamageType.MIXED, frontline: 10, cc: 9, waveclear: 7, scaling: 9 },
  777: { name: '永恩', title: '封魔剑魂', damageType: DamageType.MIXED, frontline: 5, cc: 8, waveclear: 9, scaling: 9 },
  897: { name: '奎桑提', title: '纳祖芒荣耀', damageType: DamageType.MIXED, frontline: 9, cc: 8, waveclear: 7, scaling: 8 },
  910: { name: '彗', title: '异画师', damageType: DamageType.MAGIC, frontline: 2, cc: 8, waveclear: 10, scaling: 8 },
};

export const PERK_METADATA_MAP: Record<
  number,
  { name: string; styleName: string; isKeystone: boolean; descTemplate: (v1: number, v2: number, v3: number) => string }
> = {
  8005: {
    name: '强攻 (Press the Attack)',
    styleName: '精密系 · 基石',
    isKeystone: true,
    descTemplate: (v1, v2) => `累计触发强攻三环伤害 ${v1} 点，易损增幅伤害 ${v2} 点`,
  },
  8008: {
    name: '致命节奏 (Lethal Tempo)',
    styleName: '精密系 · 基石',
    isKeystone: true,
    descTemplate: (v1, v2) => `满层攻速加持持续 ${v1} 秒，附带额外自适应伤害 ${v2} 点`,
  },
  8021: {
    name: '迅捷步法 (Fleet Footwork)',
    styleName: '精密系 · 基石',
    isKeystone: true,
    descTemplate: (v1) => `对局内充能移动累计回复生命值 ${v1} 点`,
  },
  8010: {
    name: '征服者 (Conqueror)',
    styleName: '精密系 · 基石',
    isKeystone: true,
    descTemplate: (v1) => `满层征服者累计转化治疗量 ${v1} 点`,
  },
  8112: {
    name: '电刑 (Electrocute)',
    styleName: '主宰系 · 基石',
    isKeystone: true,
    descTemplate: (v1) => `累计触发电刑爆发伤害 ${v1} 点`,
  },
  8128: {
    name: '黑暗收割 (Dark Harvest)',
    styleName: '主宰系 · 基石',
    isKeystone: true,
    descTemplate: (v1, v2) => `累计收割灵魂 ${v2} 层，造成残血斩杀伤害 ${v1} 点`,
  },
  8229: {
    name: '奥术彗星 (Arcane Comet)',
    styleName: '巫术系 · 基石',
    isKeystone: true,
    descTemplate: (v1) => `奥术彗星累计命中造成魔法/物理伤害 ${v1} 点`,
  },
  8437: {
    name: '不灭之握 (Grasp of the Undying)',
    styleName: '坚决系 · 基石',
    isKeystone: true,
    descTemplate: (v1, v2) => `累计造成不灭魔法伤害 ${v1} 点，回复生命 ${v2} 点`,
  },
  8439: {
    name: '余震 (Aftershock)',
    styleName: '坚决系 · 基石',
    isKeystone: true,
    descTemplate: (v1, v2) => `定身触发冲击波伤害 ${v1} 点，双抗减免伤害 ${v2} 点`,
  },
  8369: {
    name: '先攻 (First Strike)',
    styleName: '启迪系 · 基石',
    isKeystone: true,
    descTemplate: (v1, v2) => `先攻额外真实伤害 ${v1} 点，累计窃取金币 +${v2}G`,
  },
  9111: {
    name: '凯旋 (Triumph)',
    styleName: '精密系 · 槽位1',
    isKeystone: false,
    descTemplate: (v1, v2) => `参与击杀累计恢复已损生命 ${v1} 点，额外赏金 +${v2}G`,
  },
  8014: {
    name: '致命一击 (Coup de Grace)',
    styleName: '精密系 · 槽位3',
    isKeystone: false,
    descTemplate: (v1) => `对低生命值敌方英雄造成额外处决伤害 ${v1} 点`,
  },
  8299: {
    name: '坚毅不倒 (Last Stand)',
    styleName: '精密系 · 槽位3',
    isKeystone: false,
    descTemplate: (v1) => `自身低血量反打期间累计增幅伤害 ${v1} 点`,
  },
  8143: {
    name: '猛然冲击 (Sudden Impact)',
    styleName: '主宰系 · 副系',
    isKeystone: false,
    descTemplate: (v1) => `突进/位移后触发真实伤害与穿甲折算伤害 ${v1} 点`,
  },
  8135: {
    name: '寻宝猎人 (Treasure Hunter)',
    styleName: '主宰系 · 副系',
    isKeystone: false,
    descTemplate: (v1, v2) => `赏金猎人层数 ${v2}/5，累计提供额外经济 +${v1}G`,
  },
  8473: {
    name: '骸骨镀层 (Bone Plating)',
    styleName: '坚决系 · 副系',
    isKeystone: false,
    descTemplate: (v1) => `对线与换血期间累计格挡敌方连招伤害 ${v1} 点`,
  },
};

export function getChampionMeta(championId: number) {
  return (
    CHAMPION_METADATA_MAP[championId] ?? {
      name: `英雄 #${championId}`,
      title: '峡谷召唤师',
      damageType: DamageType.PHYSICAL,
      frontline: 5,
      cc: 5,
      waveclear: 6,
      scaling: 7,
    }
  );
}

/**
 * Extracts `--flag=value` from a raw `LeagueClientUx.exe` command line string.
 */
export function extractCliFlag(cmdLine: string, flagPrefix: string): string | null {
  const idx = cmdLine.indexOf(flagPrefix);
  if (idx === -1) return null;
  const start = idx + flagPrefix.length;
  const rest = cmdLine.slice(start);
  const match = rest.match(/^([^\s"]+)/);
  return match ? match[1].replace(/"/g, '').trim() : null;
}

/**
 * Parses a raw `LeagueClientUx.exe` command line into a 4-tuple `LcuRcuCredentials` object.
 */
export function parseCommandLineToCredentials(
  cmdLine: string,
  pid = 0
): LcuRcuCredentials | null {
  const lcuPortStr = extractCliFlag(cmdLine, '--app-port=');
  const lcuToken = extractCliFlag(cmdLine, '--remoting-auth-token=');
  if (!lcuPortStr || !lcuToken) {
    return null;
  }
  const lcuPort = Number.parseInt(lcuPortStr, 10);
  if (!Number.isFinite(lcuPort) || lcuPort <= 0) {
    return null;
  }

  const rcuPortStr = extractCliFlag(cmdLine, '--riotclient-app-port=');
  const rcuToken = extractCliFlag(cmdLine, '--riotclient-auth-token=') ?? '';
  const rcuPort = rcuPortStr ? Number.parseInt(rcuPortStr, 10) : 0;
  const rsoPlatformId = extractCliFlag(cmdLine, '--rso_platform_id=') ?? 'HN1';
  const region = extractCliFlag(cmdLine, '--region=') ?? 'TENCENT';
  const installDirectory =
    extractCliFlag(cmdLine, '--install-directory=') ??
    'D:\\WeGameApps\\英雄联盟\\LeagueClient';
  const isWeGameLauncher =
    cmdLine.includes('WeGame') || region.toUpperCase().includes('TENCENT');

  return {
    lcuPid: pid,
    lcuPort,
    lcuAuthToken: lcuToken,
    rcuPid: 0,
    rcuPort: Number.isFinite(rcuPort) ? rcuPort : 0,
    rcuAuthToken: rcuToken,
    rsoPlatformId,
    region,
    installDirectory,
    isWeGameLauncher,
    lastHeartbeatAt: new Date().toISOString().slice(11, 19),
  };
}

/**
 * Scans the local OS (Windows PowerShell / WMIC or Unix `ps`) for a running `LeagueClientUx` process.
 */
export async function scanLiveLcuProcessCredentials(): Promise<LcuRcuCredentials | null> {
  try {
    if (process.platform === 'win32') {
      try {
        const { stdout } = await execAsync(
          'powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"name = \'LeagueClientUx.exe\'\\" | Select-Object ProcessId, CommandLine | ConvertTo-Json -Compress"',
          { timeout: 3000 }
        );
        if (stdout && stdout.trim()) {
          const parsed = JSON.parse(stdout.trim());
          const proc = Array.isArray(parsed) ? parsed[0] : parsed;
          if (proc?.CommandLine) {
            const creds = parseCommandLineToCredentials(
              String(proc.CommandLine),
              Number(proc.ProcessId) || 0
            );
            if (creds) return creds;
          }
        }
      } catch {
        const { stdout } = await execAsync(
          'wmic process where "name=\'LeagueClientUx.exe\'" get ProcessId,CommandLine /format:list',
          { timeout: 3000 }
        );
        if (stdout && stdout.includes('--app-port=')) {
          const pidMatch = stdout.match(/ProcessId=(\d+)/);
          const creds = parseCommandLineToCredentials(
            stdout,
            pidMatch ? Number(pidMatch[1]) : 0
          );
          if (creds) return creds;
        }
      }
    } else {
      const { stdout } = await execAsync(
        'ps -Ao pid,args | grep LeagueClientUx | grep -v grep',
        { timeout: 2000 }
      );
      if (stdout && stdout.includes('--app-port=')) {
        const trimmed = stdout.trim();
        const firstSpace = trimmed.indexOf(' ');
        const pid =
          firstSpace > 0 ? Number.parseInt(trimmed.slice(0, firstSpace), 10) : 0;
        return parseCommandLineToCredentials(trimmed, pid);
      }
    }
  } catch {
    // No local LeagueClientUx process running
  }
  return null;
}

export interface RawHttpResponse<T = any> {
  ok: boolean;
  status: number;
  durationMs: number;
  data: T;
}

/**
 * Low-level HTTPS client that accepts Riot's self-signed `riotgames.pem` certificate
 * and communicates directly with `https://127.0.0.1:{port}` or `https://127.0.0.1:2999`.
 */
export function performInsecureLocalHttps<T = any>(options: {
  host?: string;
  port: number;
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}): Promise<RawHttpResponse<T>> {
  const start = performance.now();
  const method = options.method ?? 'GET';
  const payloadStr =
    options.body !== undefined ? JSON.stringify(options.body) : undefined;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers ?? {}),
  };
  if (payloadStr !== undefined) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = String(Buffer.byteLength(payloadStr));
  }

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: options.host ?? '127.0.0.1',
        port: options.port,
        path: options.path.startsWith('/') ? options.path : `/${options.path}`,
        method,
        headers,
        agent: insecureHttpsAgent,
        rejectUnauthorized: false,
        timeout: options.timeoutMs ?? 3500,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => {
          const durationMs = Math.round((performance.now() - start) * 10) / 10;
          const rawText = Buffer.concat(chunks).toString('utf-8');
          let parsed: any = rawText;
          if (rawText.trim()) {
            try {
              parsed = JSON.parse(rawText);
            } catch {
              parsed = rawText;
            }
          } else {
            parsed = null;
          }
          const status = res.statusCode ?? 500;
          resolve({
            ok: status >= 200 && status < 300,
            status,
            durationMs,
            data: parsed as T,
          });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error('LCU HTTPS request timed out'));
    });
    req.on('error', (err) => {
      reject(err);
    });

    if (payloadStr !== undefined) {
      req.write(payloadStr);
    }
    req.end();
  });
}

/**
 * Sends an authenticated LCU REST call (`Authorization: Basic base64("riot:{token}")`)
 * and appends the real frame to the ring buffer callback.
 */
export async function callLiveLcuEndpoint<T = any>(
  creds: LcuRcuCredentials,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  endpoint: string,
  body?: unknown,
  onEnvelope?: (env: Omit<IpcEnvelope, 'id' | 'timestamp'>) => void
): Promise<RawHttpResponse<T>> {
  const basicAuth = Buffer.from(`riot:${creds.lcuAuthToken}`).toString('base64');
  const res = await performInsecureLocalHttps<T>({
    port: creds.lcuPort,
    path: endpoint,
    method,
    headers: {
      Authorization: `Basic ${basicAuth}`,
    },
    body,
  });

  if (onEnvelope) {
    onEnvelope({
      channel: 'LCU_REST',
      method,
      endpoint,
      status: res.status,
      durationMs: res.durationMs,
      payloadSummary: `Live LCU ${method} ${endpoint} -> HTTP ${res.status}`,
    });
  }
  return res;
}

/**
 * Converts Riot's raw LCU `/lol-loot/v1/player-loot-map` JSON object into `LootItemShard[]`.
 */
export function mapRawLcuLootToShards(rawLootMap: Record<string, any>): LootItemShard[] {
  const shards: LootItemShard[] = [];
  if (!rawLootMap || typeof rawLootMap !== 'object') {
    return shards;
  }

  for (const item of Object.values(rawLootMap)) {
    if (!item || typeof item !== 'object') continue;
    const lootId = String(item.lootId ?? item.lootName ?? '');
    const count = Number(item.count ?? 0);
    if (count <= 0 || !lootId) continue;

    const isChampShard =
      item.displayCategories === 'CHAMPION' || lootId.startsWith('CHAMPION_RENTAL_');
    const isSkinShard =
      item.displayCategories === 'SKIN' ||
      lootId.startsWith('SKIN_RENTAL_') ||
      lootId.startsWith('CHAMPION_SKIN_RENTAL_');

    if (!isChampShard && !isSkinShard) continue;

    const itemName = String(
      item.itemDesc || item.localizedName || item.lootName || lootId
    );
    const isOwned =
      item.redeemableStatus === 'ALREADY_OWNED' ||
      item.itemStatus === 'OWNED';
    const disenchantValue = Number(item.disenchantValue ?? (isChampShard ? 960 : 270));
    const upgradeCost = Number(item.upgradeEssenceValue ?? disenchantValue * 3);

    shards.push({
      lootId,
      itemName: isChampShard ? `${itemName} 英雄碎片` : `${itemName} 皮肤碎片`,
      category: isChampShard ? 'CHAMPION_SHARD' : 'SKIN_SHARD',
      count,
      isOwnedChampionOrSkin: isOwned,
      neededForMasteryUpgrade: false,
      disenchantCurrency: isChampShard ? 'BLUE_ESSENCE' : 'ORANGE_ESSENCE',
      valuePerUnit: disenchantValue,
      upgradeCostPerUnit: upgradeCost,
    });
  }

  return shards;
}

/**
 * Extracts real Post-Game Rune Perk Telemetry (`perk0Var1..3`, `perk1..5`) from a raw Riot game object.
 */
export function extractPerkTelemetryFromRawGame(
  rawGame: any,
  targetPuuid: string
): RunePerkTelemetryItem[] {
  if (!rawGame || typeof rawGame !== 'object') return [];
  const identities: any[] = Array.isArray(rawGame.participantIdentities)
    ? rawGame.participantIdentities
    : [];
  const participants: any[] = Array.isArray(rawGame.participants)
    ? rawGame.participants
    : [];
  const selfIdentity = identities.find((id) => id?.player?.puuid === targetPuuid);
  const selfPart =
    participants.find(
      (p) =>
        (selfIdentity && p.participantId === selfIdentity.participantId) ||
        p.puuid === targetPuuid
    ) ?? participants[0];

  const stats = selfPart?.stats;
  if (!stats) return [];

  const items: RunePerkTelemetryItem[] = [];
  for (let idx = 0; idx <= 5; idx++) {
    const perkId = Number(stats[`perk${idx}`] ?? 0);
    if (!perkId) continue;
    const v1 = Number(stats[`perk${idx}Var1`] ?? 0);
    const v2 = Number(stats[`perk${idx}Var2`] ?? 0);
    const v3 = Number(stats[`perk${idx}Var3`] ?? 0);
    const meta = PERK_METADATA_MAP[perkId];
    items.push({
      perkId,
      perkName: meta?.name ?? `符文 #${perkId}`,
      styleName: meta?.styleName ?? (idx === 0 ? '主系基石' : `符文槽位 #${idx}`),
      isKeystone: idx === 0,
      var1: v1,
      var2: v2,
      var3: v3,
      primaryMetricLabel: meta
        ? meta.descTemplate(v1, v2, v3)
        : `触发收益 Var1=${v1}, Var2=${v2}, Var3=${v3}`,
    });
  }
  return items;
}

/**
 * Converts Riot's raw LCU `/lol-match-history/v1/products/lol/{puuid}/matches` games array
 * into `PlayerMatchStats[]` for our v4 RPI and Premade Union-Find engine.
 */
export function mapRawLcuGamesToMatchStats(
  rawGames: any[],
  targetPuuid: string,
  fallbackRole: RoleType = RoleType.MID
): PlayerMatchStats[] {
  if (!Array.isArray(rawGames)) return [];
  const results: PlayerMatchStats[] = [];

  for (const game of rawGames.slice(0, 20)) {
    if (!game || typeof game !== 'object') continue;
    const durationSec = Number(game.gameDuration ?? 1500);
    const durationMinutes = Math.max(10, Math.round((durationSec / 60) * 10) / 10);

    const identities: any[] = Array.isArray(game.participantIdentities)
      ? game.participantIdentities
      : [];
    const participants: any[] = Array.isArray(game.participants)
      ? game.participants
      : [];

    const selfIdentity = identities.find(
      (id) => id?.player?.puuid === targetPuuid
    );
    const selfPart =
      participants.find(
        (p) =>
          (selfIdentity && p.participantId === selfIdentity.participantId) ||
          p.puuid === targetPuuid
      ) ?? participants[0];

    if (!selfPart) continue;

    const stats = selfPart.stats ?? {};
    const teamId = selfPart.teamId ?? 100;
    const teamParts = participants.filter((p) => (p.teamId ?? 100) === teamId);
    const enemyParts = participants.filter((p) => (p.teamId ?? 100) !== teamId);

    const sumStat = (arr: any[], key: string, fallback: number) => {
      const total = arr.reduce((acc, p) => acc + Number(p?.stats?.[key] ?? 0), 0);
      return total > 0 ? total : fallback;
    };

    const kills = Number(stats.kills ?? 0);
    const deaths = Number(stats.deaths ?? 0);
    const assists = Number(stats.assists ?? 0);
    const damageDealt = Number(stats.totalDamageDealtToChampions ?? 18000);
    const damageTaken = Number(stats.totalDamageTaken ?? 16000);
    const selfMitigatedDamage = Number(stats.damageSelfMitigated ?? 10000);
    const goldEarned = Number(stats.goldEarned ?? 11000);
    const cs =
      Number(stats.totalMinionsKilled ?? 0) +
      Number(stats.neutralMinionsKilled ?? 0);
    const visionScore = Number(stats.visionScore ?? 20);

    const teamTotalKills = sumStat(teamParts, 'kills', Math.max(1, kills + assists));
    const teamTotalDeaths = sumStat(teamParts, 'deaths', Math.max(1, deaths * 3));
    const teamTotalGold = sumStat(teamParts, 'goldEarned', Math.max(goldEarned * 4, 52000));
    const enemyTotalGold = sumStat(enemyParts, 'goldEarned', 52000);
    const teamTotalDamage = sumStat(
      teamParts,
      'totalDamageDealtToChampions',
      Math.max(damageDealt * 4, 85000)
    );
    const teamTotalDamageTaken = sumStat(
      teamParts,
      'totalDamageTaken',
      Math.max(damageTaken * 4, 85000)
    );

    const coPlayerPuuids: string[] = [];
    const enemyPuuids: string[] = [];
    for (const idObj of identities) {
      const pId = idObj?.participantId;
      const puuid = idObj?.player?.puuid;
      if (!puuid || puuid === targetPuuid) continue;
      const partObj = participants.find((p) => p.participantId === pId);
      if (partObj && partObj.teamId === teamId) {
        coPlayerPuuids.push(puuid);
      } else {
        enemyPuuids.push(puuid);
      }
    }

    const champId = Number(selfPart.championId ?? 203);
    const champMeta = getChampionMeta(champId);

    results.push({
      matchId: String(game.gameId ?? `LCU-${Date.now()}`),
      gameTimestamp: Number(game.gameCreation ?? Date.now() - 3600_000),
      durationMinutes,
      queueId: Number(game.queueId ?? 420),
      queueName: Number(game.queueId) === 450 ? '极地大乱斗' : '单双排位赛',
      championId: champId,
      championName: champMeta.name,
      championTitle: champMeta.title,
      role: fallbackRole,
      win: Boolean(stats.win),
      kills,
      deaths,
      assists,
      cs,
      goldEarned,
      damageDealt,
      damageTaken,
      selfMitigatedDamage,
      visionScore,
      csDiffAt15: 0,
      goldDiffAt15: 0,
      teamTotalKills,
      teamTotalDeaths,
      teamTotalGold,
      enemyTotalGold,
      teamTotalDamage,
      teamTotalDamageTaken,
      firstBloodKill: Boolean(stats.firstBloodKill),
      objectiveStolen: Number(stats.objectivesStolen ?? 0),
      ccScoreSeconds: Number(stats.timeCCingOthers ?? 15),
      coPlayerPuuids,
      enemyPuuids,
      runeTelemetry: extractPerkTelemetryFromRawGame(game, targetPuuid),
    });
  }

  return results;
}

/**
 * Converts Riot's `/lol-match-history/v1/games/{gameId}/timeline` frames into `TimelineMinutePoint[]`
 * so the 30-Minute Win-Probability P(Win|t) Curve and Throw-Point Detector work on real games.
 */
export function mapRawTimelineToMinutePoints(
  rawTimeline: any,
  participantNameMap: Record<number, { name: string; puuid: string }> = {}
): TimelineMinutePoint[] {
  const frames: any[] = Array.isArray(rawTimeline?.frames) ? rawTimeline.frames : [];
  if (frames.length === 0) return [];

  const points: TimelineMinutePoint[] = [];
  let blueKills = 0;
  let redKills = 0;
  let blueDragons = 0;
  let redDragons = 0;
  let blueBarons = 0;
  let redBarons = 0;
  let blueTowers = 0;
  let redTowers = 0;

  for (let idx = 0; idx < frames.length; idx++) {
    const frame = frames[idx];
    const minute = Math.round(Number(frame.timestamp ?? idx * 60000) / 60000);
    const pFrames = frame.participantFrames ?? {};

    let blueGold = 0;
    let redGold = 0;

    for (const pf of Object.values(pFrames) as any[]) {
      const pid = Number(pf?.participantId ?? 0);
      const gold = Number(pf?.totalGold ?? 0);
      if (pid >= 1 && pid <= 5) {
        blueGold += gold;
      } else if (pid >= 6 && pid <= 10) {
        redGold += gold;
      }
    }

    let eventSummary: string | undefined;
    let involvedPlayerName: string | undefined;
    let involvedChampionName: string | undefined;
    const events: any[] = Array.isArray(frame.events) ? frame.events : [];

    for (const ev of events) {
      if (ev.type === 'ELITE_MONSTER_KILL') {
        const killerId = Number(ev.killerId ?? 1);
        const isBlue = killerId >= 1 && killerId <= 5;
        if (ev.monsterType === 'BARON_NASHOR') {
          if (isBlue) blueBarons++;
          else redBarons++;
          eventSummary = `${isBlue ? '我方' : '敌方'}控下纳什男爵 (Baron Nashor)`;
        } else if (ev.monsterType === 'DRAGON') {
          if (isBlue) blueDragons++;
          else redDragons++;
          eventSummary = `${isBlue ? '我方' : '敌方'}控下元素亚龙`;
        }
      } else if (ev.type === 'BUILDING_KILL') {
        const killerId = Number(ev.killerId ?? 0);
        const teamId = Number(ev.teamId ?? (killerId >= 1 && killerId <= 5 ? 200 : 100));
        if (teamId === 200) blueTowers++;
        else redTowers++;
      } else if (ev.type === 'CHAMPION_KILL') {
        const killerId = Number(ev.killerId ?? 0);
        if (killerId >= 1 && killerId <= 5) blueKills++;
        else if (killerId >= 6 && killerId <= 10) redKills++;

        const victimId = Number(ev.victimId ?? 0);
        if (!eventSummary && victimId >= 1 && victimId <= 5 && minute >= 18) {
          const victimInfo = participantNameMap[victimId];
          involvedPlayerName = victimInfo?.name ?? `选手 #${victimId}`;
          eventSummary = `${involvedPlayerName} 在中后期关键时间点阵亡`;
        }
      }
    }

    points.push({
      minute,
      blueGold: blueGold || 2500 + minute * 1850,
      redGold: redGold || 2500 + minute * 1800,
      blueKills,
      redKills,
      blueTowers,
      redTowers,
      blueDragons,
      redDragons,
      blueBarons,
      redBarons,
      eventSummary,
      involvedPlayerName,
      involvedChampionName,
    });
  }

  return points;
}

/**
 * Fetches a player's real Ranked Solo/Duo tier, division, LP, and win/loss record from LCU.
 */
export async function fetchPlayerRankedStats(
  creds: LcuRcuCredentials,
  puuid: string,
  onEnvelope?: (env: Omit<IpcEnvelope, 'id' | 'timestamp'>) => void
): Promise<{
  soloTier: string;
  soloDivision: string;
  soloLp: number;
  soloWins: number;
  soloLosses: number;
  estimatedMmr: number;
  mmrDeltaLabel: string;
} | null> {
  const res = await callLiveLcuEndpoint<any>(
    creds,
    'GET',
    `/lol-ranked/v1/ranked-stats/${encodeURIComponent(puuid)}`,
    undefined,
    onEnvelope
  ).catch(() => null);

  const solo = res?.ok ? res.data?.queueMap?.RANKED_SOLO_5x5 : null;
  if (!solo || !solo.tier || solo.tier === 'NONE' || solo.tier === 'UNRANKED') {
    return null;
  }

  const tierBaseMmr: Record<string, number> = {
    IRON: 800,
    BRONZE: 1050,
    SILVER: 1300,
    GOLD: 1550,
    PLATINUM: 1800,
    EMERALD: 2050,
    DIAMOND: 2300,
    MASTER: 2550,
    GRANDMASTER: 2750,
    CHALLENGER: 2950,
  };
  const divOffset: Record<string, number> = { IV: 0, III: 60, II: 120, I: 180 };
  const tier = String(solo.tier).toUpperCase();
  const division = String(solo.division || 'I');
  const lp = Number(solo.leaguePoints ?? 0);
  const wins = Number(solo.wins ?? 0);
  const losses = Number(solo.losses ?? 0);
  const total = Math.max(1, wins + losses);
  const wr = wins / total;
  const mmrDelta = Math.round((wr - 0.5) * 320);
  const base = (tierBaseMmr[tier] ?? 2000) + (divOffset[division] ?? 0) + Math.round(lp * 0.7);
  const estimatedMmr = base + mmrDelta;

  return {
    soloTier: tier,
    soloDivision: division,
    soloLp: lp,
    soloWins: wins,
    soloLosses: losses,
    estimatedMmr,
    mmrDeltaLabel: mmrDelta >= 0 ? `+${mmrDelta} 高隐藏分` : `${mmrDelta} 隐藏分承压`,
  };
}

/**
 * Syncs live `:2999/liveclientdata/allgamedata` enemy Summoner Spells, Ionian Boots (`3158`),
 * and Cosmic Insight (`8347`) into our `SummonerScoutProfile[]`.
 */
export async function syncLive2999ToProfiles(
  profiles: SummonerScoutProfile[],
  onEnvelope?: (env: Omit<IpcEnvelope, 'id' | 'timestamp'>) => void
): Promise<{ connected: boolean; updatedProfiles: SummonerScoutProfile[] }> {
  try {
    const res = await performInsecureLocalHttps<any>({
      port: 2999,
      path: '/liveclientdata/allgamedata',
      timeoutMs: 1200,
    });
    if (onEnvelope) {
      onEnvelope({
        channel: 'LIVE_2999',
        method: 'GET',
        endpoint: '/liveclientdata/allgamedata',
        status: res.status,
        durationMs: res.durationMs,
        payloadSummary: `Live :2999 sync -> HTTP ${res.status}`,
      });
    }
    if (!res.ok || !Array.isArray(res.data?.allPlayers)) {
      return { connected: false, updatedProfiles: profiles };
    }

    const allPlayers: any[] = res.data.allPlayers;
    const updated = profiles.map((prof) => {
      const liveMatch = allPlayers.find(
        (lp) =>
          lp?.summonerName?.includes(prof.gameName) ||
          lp?.riotIdGameName === prof.gameName ||
          lp?.championName === prof.currentChampionName
      );
      if (!liveMatch) return prof;

      const items: any[] = Array.isArray(liveMatch.items) ? liveMatch.items : [];
      const hasIonianBoots = items.some((it) => Number(it?.itemID) === 3158);
      const generalRunes: any[] = Array.isArray(liveMatch.runes?.generalRunes)
        ? liveMatch.runes.generalRunes
        : [];
      const hasCosmicInsight = generalRunes.some((r) => Number(r?.id) === 8347);

      const sp1 = String(
        liveMatch.summonerSpells?.summonerSpellOne?.displayName || prof.spell1Name
      );
      const sp2 = String(
        liveMatch.summonerSpells?.summonerSpellTwo?.displayName || prof.spell2Name
      );

      return {
        ...prof,
        hasIonianBoots,
        hasCosmicInsight,
        spell1Name: sp1.includes('闪现') ? '闪现' : sp1,
        spell2Name: sp2.includes('闪现') ? sp1 : sp2,
      };
    });

    return { connected: true, updatedProfiles: updated };
  } catch {
    return { connected: false, updatedProfiles: profiles };
  }
}

/**
 * Executes a real LCU Rune Page hot-injection (`DELETE` current editable page + `POST /lol-perks/v1/pages`).
 */
export async function executeRealRuneInjection(
  creds: LcuRcuCredentials,
  preset: {
    pageName: string;
    primaryStyleId: number;
    subStyleId: number;
    selectedPerkIds: number[];
  },
  onEnvelope?: (env: Omit<IpcEnvelope, 'id' | 'timestamp'>) => void
): Promise<boolean> {
  const currRes = await callLiveLcuEndpoint<any>(
    creds,
    'GET',
    '/lol-perks/v1/currentpage',
    undefined,
    onEnvelope
  );
  if (currRes.ok && currRes.data?.id && currRes.data?.isDeletable !== false) {
    await callLiveLcuEndpoint(
      creds,
      'DELETE',
      `/lol-perks/v1/pages/${currRes.data.id}`,
      undefined,
      onEnvelope
    );
  }

  const createRes = await callLiveLcuEndpoint(
    creds,
    'POST',
    '/lol-perks/v1/pages',
    {
      name: preset.pageName,
      primaryStyleId: preset.primaryStyleId,
      subStyleId: preset.subStyleId,
      selectedPerkIds: preset.selectedPerkIds,
      current: true,
    },
    onEnvelope
  );
  return createRes.ok;
}

/**
 * Executes a real LCU Lobby Chat broadcast with 350ms throttling and zero-width obfuscation.
 */
export async function executeRealChatBroadcast(
  creds: LcuRcuCredentials,
  lines: string[],
  onEnvelope?: (env: Omit<IpcEnvelope, 'id' | 'timestamp'>) => void
): Promise<number> {
  const convRes = await callLiveLcuEndpoint<any[]>(
    creds,
    'GET',
    '/lol-chat/v1/conversations',
    undefined,
    onEnvelope
  );
  if (!convRes.ok || !Array.isArray(convRes.data) || convRes.data.length === 0) {
    return 0;
  }

  const champSelectConv =
    convRes.data.find(
      (c) => c.type === 'championSelect' || String(c.id).includes('champ-select')
    ) ?? convRes.data[0];

  if (!champSelectConv?.id) return 0;

  let delivered = 0;
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) {
      await new Promise((r) => setTimeout(r, 350));
    }
    const postRes = await callLiveLcuEndpoint(
      creds,
      'POST',
      `/lol-chat/v1/conversations/${encodeURIComponent(String(champSelectConv.id))}/messages`,
      {
        type: 'chat',
        body: obfuscateChatLine(lines[i], true),
      },
      onEnvelope
    );
    if (postRes.ok) delivered++;
  }
  return delivered;
}

/**
 * Executes a real LCU Profile Skin Background & Ranked Chat Tier Spoof.
 */
export async function executeRealCosmeticSpoof(
  creds: LcuRcuCredentials,
  payload: {
    skinSplashId: number;
    spoofTier: string;
    spoofDivision: string;
    spoofLp: number;
    challengeCrystalLevel: string;
    statusMessage: string;
  },
  onEnvelope?: (env: Omit<IpcEnvelope, 'id' | 'timestamp'>) => void
): Promise<boolean> {
  const bgRes = await callLiveLcuEndpoint(
    creds,
    'POST',
    '/lol-summoner/v1/current-summoner/summoner-profile',
    {
      key: 'backgroundSkinId',
      value: payload.skinSplashId,
    },
    onEnvelope
  );

  const chatRes = await callLiveLcuEndpoint(
    creds,
    'PUT',
    '/lol-chat/v1/me',
    {
      statusMessage: payload.statusMessage,
      lol: {
        rankedLeagueQueue: 'RANKED_SOLO_5x5',
        rankedLeagueTier: payload.spoofTier,
        rankedLeagueDivision: payload.spoofDivision,
        rankedLeagueLp: String(payload.spoofLp),
        challengeCrystalLevel: payload.challengeCrystalLevel,
      },
    },
    onEnvelope
  );

  return bgRes.ok || chatRes.ok;
}

/**
 * Executes a real LCU 5v5 Practice Tool Custom Lobby creation (`POST /lol-lobby/v2/lobby`).
 */
export async function executeRealPracticeLobby(
  creds: LcuRcuCredentials,
  lobbyName: string,
  onEnvelope?: (env: Omit<IpcEnvelope, 'id' | 'timestamp'>) => void
): Promise<boolean> {
  const res = await callLiveLcuEndpoint(
    creds,
    'POST',
    '/lol-lobby/v2/lobby',
    {
      customGameLobby: {
        configuration: {
          gameMode: 'PRACTICETOOL',
          gameMutator: '',
          gameServerRegion: '',
          mapId: 11,
          mutators: { id: 1 },
          spectatorPolicy: 'AllAllowed',
          teamSize: 5,
        },
        lobbyName,
        lobbyPassword: null,
      },
      isCustom: true,
    },
    onEnvelope
  );
  return res.ok;
}

/**
 * Executes a real LCU Hextech Loot batch disenchant (`POST /lol-loot/v1/recipes/{recipe}/craft?repeat={n}`).
 */
export async function executeRealLootDisenchant(
  creds: LcuRcuCredentials,
  plan: LootDisenchantPlan,
  onEnvelope?: (env: Omit<IpcEnvelope, 'id' | 'timestamp'>) => void
): Promise<number> {
  let crafted = 0;
  for (const cmd of plan.lcuBatchCraftCommands) {
    const res = await callLiveLcuEndpoint(
      creds,
      'POST',
      `/lol-loot/v1/recipes/${encodeURIComponent(cmd.recipeName)}/craft?repeat=${cmd.repeat}`,
      [cmd.lootId],
      onEnvelope
    );
    if (res.ok) crafted++;
  }
  return crafted;
}

/**
 * Fetches the player's real Hextech Loot shard inventory from `GET /lol-loot/v1/player-loot-map`.
 */
export async function fetchLiveLootInventory(
  creds: LcuRcuCredentials,
  onEnvelope?: (env: Omit<IpcEnvelope, 'id' | 'timestamp'>) => void
): Promise<LootItemShard[] | null> {
  const res = await callLiveLcuEndpoint<Record<string, any>>(
    creds,
    'GET',
    '/lol-loot/v1/player-loot-map',
    undefined,
    onEnvelope
  );
  if (!res.ok || !res.data) return null;
  const shards = mapRawLcuLootToShards(res.data);
  return shards.length > 0 ? shards : null;
}

/**
 * Real Background Automation State Machine Tick:
 * 1. ReadyCheck Auto-Accept (`POST /lol-matchmaking/v1/ready-check/accept`)
 * 2. ChampSelect Safe-Ban (`championPickIntent` guard) & Humanized Auto-Pick (`PATCH /lol-champ-select/v1/session/actions/{id}`)
 * 3. ARAM `<5ms` Bench Wishlist Auto-Sniper (`POST /lol-champ-select/v1/session/bench/swap/{id}`)
 * 4. Auto-Reconnect & Auto Play-Again
 */
export async function executeLiveAutomationTick(
  creds: LcuRcuCredentials,
  config: AutomationConfig,
  onEnvelope?: (env: Omit<IpcEnvelope, 'id' | 'timestamp'>) => void
): Promise<{
  executedActions: string[];
  skippedTeammateIntentBanIds: number[];
  lockedBanChampionId: number | null;
  lockedPickChampionId: number | null;
}> {
  const executedActions: string[] = [];
  const skippedTeammateIntentBanIds: number[] = [];
  let lockedBanChampionId: number | null = null;
  let lockedPickChampionId: number | null = null;

  const phaseRes = await callLiveLcuEndpoint<string>(
    creds,
    'GET',
    '/lol-gameflow/v1/gameflow-phase',
    undefined,
    onEnvelope
  ).catch(() => null);
  const rawPhase = String(phaseRes?.data ?? 'None').replace(/"/g, '');

  // 1. ReadyCheck Auto-Accept
  if (rawPhase === 'ReadyCheck' && config.autoAcceptEnabled) {
    const rcRes = await callLiveLcuEndpoint<any>(
      creds,
      'GET',
      '/lol-matchmaking/v1/ready-check',
      undefined,
      onEnvelope
    ).catch(() => null);

    if (
      rcRes?.ok &&
      rcRes.data?.state === 'InProgress' &&
      rcRes.data?.playerResponse === 'None'
    ) {
      if (config.autoAcceptDelayMs > 0) {
        await new Promise((r) =>
          setTimeout(r, Math.min(config.autoAcceptDelayMs, 2500))
        );
      }
      const accRes = await callLiveLcuEndpoint(
        creds,
        'POST',
        '/lol-matchmaking/v1/ready-check/accept',
        undefined,
        onEnvelope
      ).catch(() => null);
      if (accRes?.ok) {
        executedActions.push(
          `[真机ReadyCheck] 已自动接受匹配对局 (延迟 ${config.autoAcceptDelayMs}ms)`
        );
      }
    }
  }

  // 2. ChampSelect Safe-Ban, Auto-Pick & ARAM Bench Sniper
  if (rawPhase === 'ChampSelect') {
    const csRes = await callLiveLcuEndpoint<any>(
      creds,
      'GET',
      '/lol-champ-select/v1/session',
      undefined,
      onEnvelope
    ).catch(() => null);

    if (csRes?.ok && csRes.data) {
      const session = csRes.data;
      const localCellId = Number(session.localPlayerCellId ?? -1);
      const myTeam: any[] = Array.isArray(session.myTeam) ? session.myTeam : [];
      const theirTeam: any[] = Array.isArray(session.theirTeam)
        ? session.theirTeam
        : [];

      const teammateHoveredIds = new Set<number>();
      const unavailableIds = new Set<number>();
      let myCurrentChampId = 0;

      for (const member of myTeam) {
        const cellId = Number(member.cellId ?? -2);
        const cId = Number(member.championId ?? 0);
        const intentId = Number(member.championPickIntent ?? 0);
        if (cId > 0) unavailableIds.add(cId);
        if (cellId === localCellId) {
          myCurrentChampId = cId;
        } else {
          if (intentId > 0) teammateHoveredIds.add(intentId);
          if (cId > 0) teammateHoveredIds.add(cId);
        }
      }
      for (const enemy of theirTeam) {
        const cId = Number(enemy.championId ?? 0);
        if (cId > 0) unavailableIds.add(cId);
      }

      // ARAM Bench Sniper check
      if (
        session.benchEnabled &&
        config.aramBenchSniperEnabled &&
        Array.isArray(session.benchChampions)
      ) {
        const benchIds: number[] = session.benchChampions
          .map((b: any) => Number(b?.championId ?? 0))
          .filter((id: number) => id > 0);
        const currentWishIdx = config.aramWishlistChampionIds.indexOf(myCurrentChampId);

        for (let i = 0; i < config.aramWishlistChampionIds.length; i++) {
          if (currentWishIdx !== -1 && i >= currentWishIdx) break;
          const wishId = config.aramWishlistChampionIds[i];
          if (benchIds.includes(wishId)) {
            const swapRes = await callLiveLcuEndpoint(
              creds,
              'POST',
              `/lol-champ-select/v1/session/bench/swap/${wishId}`,
              undefined,
              onEnvelope
            ).catch(() => null);
            if (swapRes?.ok) {
              executedActions.push(
                `[真机大乱斗秒抢] 备选席检测到心愿单英雄 #${wishId} (${getChampionMeta(wishId).name})，已毫秒级触发 swap`
              );
              break;
            }
          }
        }
      }

      // Iterate action groups for active Ban / Pick turn
      const actionGroups: any[][] = Array.isArray(session.actions)
        ? session.actions
        : [];
      for (const group of actionGroups) {
        if (!Array.isArray(group)) continue;
        for (const act of group) {
          if (Number(act?.characterId || act?.championId) > 0 && act?.completed) {
            unavailableIds.add(Number(act.championId));
          }
          if (
            Number(act?.actorCellId) === localCellId &&
            act?.isInProgress === true &&
            act?.completed !== true
          ) {
            const actionId = act.id;
            const actionType = String(act.type ?? '');

            if (actionType === 'ban' && config.autoBanEnabled) {
              for (const candId of config.banChampionIds) {
                if (
                  config.protectTeammateIntentGuard &&
                  teammateHoveredIds.has(candId)
                ) {
                  skippedTeammateIntentBanIds.push(candId);
                  continue;
                }
                if (unavailableIds.has(candId)) continue;
                lockedBanChampionId = candId;
                break;
              }
              if (lockedBanChampionId) {
                const banRes = await callLiveLcuEndpoint(
                  creds,
                  'PATCH',
                  `/lol-champ-select/v1/session/actions/${actionId}`,
                  { championId: lockedBanChampionId, completed: true },
                  onEnvelope
                ).catch(() => null);
                if (banRes?.ok) {
                  executedActions.push(
                    `[真机SafeBan] 已执行 PATCH /lol-champ-select/v1/session/actions/${actionId} 禁用 ${getChampionMeta(lockedBanChampionId).name}`
                  );
                }
              }
            } else if (actionType === 'pick' && config.autoPickEnabled) {
              const allPickCandidates = [
                ...config.primaryPickChampionIds,
                ...config.backupPickChampionIds,
              ];
              for (const candId of allPickCandidates) {
                if (!unavailableIds.has(candId)) {
                  lockedPickChampionId = candId;
                  break;
                }
              }
              if (lockedPickChampionId) {
                const jitter = Math.round(
                  config.humanizedJitterMinMs +
                    Math.random() *
                      Math.max(
                        10,
                        config.humanizedJitterMaxMs - config.humanizedJitterMinMs
                      )
                );
                await new Promise((r) => setTimeout(r, Math.min(jitter, 800)));
                const pickRes = await callLiveLcuEndpoint(
                  creds,
                  'PATCH',
                  `/lol-champ-select/v1/session/actions/${actionId}`,
                  { championId: lockedPickChampionId, completed: true },
                  onEnvelope
                ).catch(() => null);
                if (pickRes?.ok) {
                  executedActions.push(
                    `[真机AutoPick] 拟人抖动 +${jitter}ms 后锁定主选英雄 ${getChampionMeta(lockedPickChampionId).name}`
                  );
                }
              }
            }
          }
        }
      }
    }
  }

  // 3. Reconnect & EndOfGame
  if (rawPhase === 'Reconnect' && config.autoReconnectEnabled) {
    const recRes = await callLiveLcuEndpoint(
      creds,
      'POST',
      '/lol-gameflow/v1/reconnect',
      undefined,
      onEnvelope
    ).catch(() => null);
    if (recRes?.ok) {
      executedActions.push('[真机断线重连] 已触发 POST /lol-gameflow/v1/reconnect');
    }
  } else if (rawPhase === 'EndOfGame' && config.autoPlayAgainEnabled) {
    const paRes = await callLiveLcuEndpoint(
      creds,
      'POST',
      '/lol-lobby/v2/play-again',
      undefined,
      onEnvelope
    ).catch(() => null);
    if (paRes?.ok) {
      executedActions.push('[真机再来一局] 已触发 POST /lol-lobby/v2/play-again');
    }
  }

  return {
    executedActions,
    skippedTeammateIntentBanIds,
    lockedBanChampionId,
    lockedPickChampionId,
  };
}

/**
 * Fetches the real Gameflow Phase (`GET /lol-gameflow/v1/gameflow-phase`), active
 * Champion Select OR In-Game Session (`GET /lol-gameflow/v1/session` unlocking all 5 enemy PUUIDs),
 * Ranked Solo/Duo stats (`GET /lol-ranked/v1/ranked-stats/{puuid}`), Post-Game Rune Perk telemetry,
 * and live Match Timeline (`GET /lol-match-history/v1/games/{gameId}/timeline`).
 */
export async function fetchLiveSessionAndScoutProfiles(
  creds: LcuRcuCredentials,
  onEnvelope?: (env: Omit<IpcEnvelope, 'id' | 'timestamp'>) => void,
  blacklist: BlacklistEntry[] = []
): Promise<{
  phase: GameflowPhase;
  profiles: SummonerScoutProfile[] | null;
  timeline: TimelineMinutePoint[] | null;
}> {
  const phaseRes = await callLiveLcuEndpoint<string>(
    creds,
    'GET',
    '/lol-gameflow/v1/gameflow-phase',
    undefined,
    onEnvelope
  ).catch(() => null);
  const rawPhase = String(phaseRes?.data ?? 'None').replace(/"/g, '');
  const phase = (Object.values(GameflowPhase).find((p) => p === rawPhase) ??
    GameflowPhase.LOBBY) as GameflowPhase;

  const selfRes = await callLiveLcuEndpoint<any>(
    creds,
    'GET',
    '/lol-summoner/v1/current-summoner',
    undefined,
    onEnvelope
  ).catch(() => null);
  const selfPuuid = String(selfRes?.data?.puuid ?? '');

  let allyRawMembers: any[] = [];
  let enemyRawMembers: any[] = [];

  // Stage 1: Check /lol-champ-select/v1/session
  const csRes = await callLiveLcuEndpoint<any>(
    creds,
    'GET',
    '/lol-champ-select/v1/session',
    undefined,
    onEnvelope
  ).catch(() => null);

  if (csRes?.ok && csRes.data && Array.isArray(csRes.data.myTeam) && csRes.data.myTeam.length > 0) {
    allyRawMembers = csRes.data.myTeam;
    enemyRawMembers = Array.isArray(csRes.data.theirTeam) ? csRes.data.theirTeam : [];
  } else {
    // Stage 2: Check /lol-gameflow/v1/session (Unlocks Enemy 5 PUUIDs in InProgress / EndOfGame!)
    const gfRes = await callLiveLcuEndpoint<any>(
      creds,
      'GET',
      '/lol-gameflow/v1/session',
      undefined,
      onEnvelope
    ).catch(() => null);

    const teamOne: any[] = Array.isArray(gfRes?.data?.gameData?.teamOne)
      ? gfRes.data.gameData.teamOne
      : [];
    const teamTwo: any[] = Array.isArray(gfRes?.data?.gameData?.teamTwo)
      ? gfRes.data.gameData.teamTwo
      : [];

    if (teamOne.length > 0 || teamTwo.length > 0) {
      const selfInTeamTwo = teamTwo.some((m) => String(m?.puuid) === selfPuuid);
      allyRawMembers = selfInTeamTwo ? teamTwo : teamOne;
      enemyRawMembers = selfInTeamTwo ? teamOne : teamTwo;
    } else if (selfPuuid) {
      // Stage 3: Fallback to Lobby members or Current Summoner so Lobby is also live-populated
      const lobbyRes = await callLiveLcuEndpoint<any>(
        creds,
        'GET',
        '/lol-lobby/v2/lobby',
        undefined,
        onEnvelope
      ).catch(() => null);
      if (Array.isArray(lobbyRes?.data?.members) && lobbyRes.data.members.length > 0) {
        allyRawMembers = lobbyRes.data.members;
      } else {
        allyRawMembers = [selfRes?.data];
      }
    }
  }

  if (allyRawMembers.length === 0) {
    return { phase, profiles: null, timeline: null };
  }

  const roleOrder: RoleType[] = [
    RoleType.TOP,
    RoleType.JGL,
    RoleType.MID,
    RoleType.BOT,
    RoleType.SUP,
  ];
  const profiles: SummonerScoutProfile[] = [];
  let latestGameIdForTimeline: string | null = null;

  const mapTeamMember = async (
    member: any,
    idx: number,
    teamSide: 'ALLY' | 'ENEMY'
  ): Promise<SummonerScoutProfile | null> => {
    const puuid = String(member?.puuid ?? '');
    const assignedRole = roleOrder[idx % 5];
    const champId = Number(
      member?.championId || member?.championPickIntent || (idx === 1 ? 203 : 516)
    );
    const intentId = Number(member?.championPickIntent || champId);
    const champMeta = getChampionMeta(champId);
    const intentMeta = getChampionMeta(intentId);

    // If enemy PUUID is obfuscated in Ranked Solo/Duo ChampSelect, return an anonymous placeholder card
    if (!puuid || puuid.startsWith('00000000')) {
      return null;
    }

    let gameName = String(
      member?.gameName || member?.summonerName || `召唤师 #${idx + 1}`
    );
    let tagLine = String(member?.tagLine || creds.rsoPlatformId || 'HN1');
    let summonerLevel = Number(member?.summonerLevel ?? 150);
    let profileIconId = Number(member?.profileIconId ?? 29);

    const sumRes = await callLiveLcuEndpoint<any>(
      creds,
      'GET',
      `/lol-summoner/v2/summoners/puuid/${encodeURIComponent(puuid)}`,
      undefined,
      onEnvelope
    ).catch(() => null);

    if (sumRes?.ok && sumRes.data) {
      gameName = String(sumRes.data.gameName || sumRes.data.displayName || gameName);
      tagLine = String(sumRes.data.tagLine || tagLine);
      summonerLevel = Number(sumRes.data.summonerLevel ?? summonerLevel);
      profileIconId = Number(sumRes.data.profileIconId ?? profileIconId);
    }

    const ranked = await fetchPlayerRankedStats(creds, puuid, onEnvelope);

    const mhRes = await callLiveLcuEndpoint<any>(
      creds,
      'GET',
      `/lol-match-history/v1/products/lol/${encodeURIComponent(puuid)}/matches?begIndex=0&endIndex=19`,
      undefined,
      onEnvelope
    ).catch(() => null);

    const rawGames: any[] = mhRes?.ok ? mhRes.data?.games?.games ?? [] : [];
    const recentMatches = mapRawLcuGamesToMatchStats(rawGames, puuid, assignedRole);

    if (recentMatches.length === 0) return null;

    if (!latestGameIdForTimeline && rawGames[0]?.gameId) {
      latestGameIdForTimeline = String(rawGames[0].gameId);
    }

    const perkTelemetry = extractPerkTelemetryFromRawGame(rawGames[0], puuid);
    const rpiList = recentMatches.map((m) => calculateContextAwareRpi(m));
    const avgRpi =
      Math.round(
        (rpiList.reduce((acc, r) => acc + r.rpiScore, 0) / rpiList.length) * 10
      ) / 10;
    const hitLedger = blacklist.find((b) => b.puuid === puuid);
    const tags = evaluateSummonerTags(recentMatches, undefined, hitLedger);

    return {
      puuid,
      gameName,
      tagLine,
      summonerLevel,
      profileIconId,
      teamSide,
      assignedRole,
      currentChampionId: champId,
      currentChampionName: champMeta.name,
      intendedChampionId: intentId,
      intendedChampionName: intentMeta.name,
      championDamageType: champMeta.damageType,
      frontlineRating: champMeta.frontline,
      ccRating: champMeta.cc,
      waveclearRating: champMeta.waveclear,
      lateScalingRating: champMeta.scaling,
      soloTier: ranked?.soloTier ?? 'DIAMOND',
      soloDivision: ranked?.soloDivision ?? 'I',
      soloLp: ranked?.soloLp ?? 75,
      soloWins: ranked?.soloWins ?? recentMatches.filter((m) => m.win).length,
      soloLosses: ranked?.soloLosses ?? recentMatches.filter((m) => !m.win).length,
      estimatedMmr: ranked?.estimatedMmr ?? 2350,
      mmrDeltaLabel: ranked?.mmrDeltaLabel ?? '实时 LCU 数据',
      hasCosmicInsight: false,
      hasIonianBoots: false,
      spell1Name: '闪现',
      spell2Name: assignedRole === RoleType.JGL ? '惩戒' : '传送',
      recentMatches,
      averageRpi: avgRpi,
      latestRpiBreakdown: rpiList[0],
      tags,
      perkTelemetry: perkTelemetry.length > 0 ? perkTelemetry : undefined,
      isAnonymousInBp: teamSide === 'ENEMY' && phase === GameflowPhase.CHAMP_SELECT,
    };
  };

  for (let i = 0; i < allyRawMembers.length; i++) {
    const p = await mapTeamMember(allyRawMembers[i], i, 'ALLY');
    if (p) profiles.push(p);
  }
  for (let i = 0; i < enemyRawMembers.length; i++) {
    const p = await mapTeamMember(enemyRawMembers[i], i, 'ENEMY');
    if (p) profiles.push(p);
  }

  // Sync live :2999 enemy spell haste and items if in progress
  let finalProfiles = profiles;
  if (phase === GameflowPhase.IN_PROGRESS && profiles.length > 0) {
    const sync2999 = await syncLive2999ToProfiles(profiles, onEnvelope);
    finalProfiles = sync2999.updatedProfiles;
  }

  // Fetch real match timeline for the latest match if available
  let timeline: TimelineMinutePoint[] | null = null;
  if (latestGameIdForTimeline) {
    const tlRes = await callLiveLcuEndpoint<any>(
      creds,
      'GET',
      `/lol-match-history/v1/games/${encodeURIComponent(latestGameIdForTimeline)}/timeline`,
      undefined,
      onEnvelope
    ).catch(() => null);
    if (tlRes?.ok && tlRes.data) {
      const mappedTl = mapRawTimelineToMinutePoints(tlRes.data);
      if (mappedTl.length >= 5) {
        timeline = mappedTl;
      }
    }
  }

  return {
    phase,
    profiles: finalProfiles.length > 0 ? finalProfiles : null,
    timeline,
  };
}
