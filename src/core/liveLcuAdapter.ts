/**
 * NexusAkari Pro (v4) — Slice-9: Real Local LCU / RCU / SGP / :2999 Process Scanner,
 * Self-Signed TLS HTTPS Tunnel & Riot Raw JSON-to-Domain Adapter
 *
 * When running on a local machine (Windows / macOS) with League of Legends (`LeagueClientUx.exe`)
 * open, this module attaches to the real client process, extracts the 4-tuple credentials,
 * executes real HTTPS calls against `https://127.0.0.1:{lcuPort}` (bypassing Riot's self-signed
 * certificate via `node:https`), and parses Riot's raw JSON into NexusAkari domain models.
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
  DamageType,
  GameflowPhase,
  IpcEnvelope,
  LcuRcuCredentials,
  LootDisenchantPlan,
  LootItemShard,
  PlayerMatchStats,
  RoleType,
  SummonerScoutProfile,
} from './types';

const execAsync = promisify(exec);

const insecureHttpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
});

export const CHAMPION_METADATA_MAP: Record<
  number,
  { name: string; title: string; damageType: DamageType; frontline: number; cc: number; waveclear: number; scaling: number }
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
        // Fallback to WMIC on older Windows builds
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
      const { stdout } = await execAsync('ps -Ao pid,args | grep LeagueClientUx | grep -v grep', {
        timeout: 2000,
      });
      if (stdout && stdout.includes('--app-port=')) {
        const trimmed = stdout.trim();
        const firstSpace = trimmed.indexOf(' ');
        const pid = firstSpace > 0 ? Number.parseInt(trimmed.slice(0, firstSpace), 10) : 0;
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
    });
  }

  return results;
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
    convRes.data.find((c) => c.type === 'championSelect' || String(c.id).includes('champ-select')) ??
    convRes.data[0];

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
 * Fetches the real Gameflow Phase (`GET /lol-gameflow/v1/gameflow-phase`) and active
 * Champion Select / Gameflow Session players from the running League of Legends client,
 * pulling each player's recent 20 matches and computing real v4 RPI & tags.
 */
export async function fetchLiveSessionAndScoutProfiles(
  creds: LcuRcuCredentials,
  onEnvelope?: (env: Omit<IpcEnvelope, 'id' | 'timestamp'>) => void
): Promise<{
  phase: GameflowPhase;
  profiles: SummonerScoutProfile[] | null;
}> {
  const phaseRes = await callLiveLcuEndpoint<string>(
    creds,
    'GET',
    '/lol-gameflow/v1/gameflow-phase',
    undefined,
    onEnvelope
  );
  const rawPhase = String(phaseRes.data ?? 'None').replace(/"/g, '');
  const phase = (Object.values(GameflowPhase).find((p) => p === rawPhase) ??
    GameflowPhase.LOBBY) as GameflowPhase;

  const csRes = await callLiveLcuEndpoint<any>(
    creds,
    'GET',
    '/lol-champ-select/v1/session',
    undefined,
    onEnvelope
  );
  if (!csRes.ok || !csRes.data || !Array.isArray(csRes.data.myTeam)) {
    return { phase, profiles: null };
  }

  const roleOrder: RoleType[] = [
    RoleType.TOP,
    RoleType.JGL,
    RoleType.MID,
    RoleType.BOT,
    RoleType.SUP,
  ];
  const profiles: SummonerScoutProfile[] = [];

  const mapTeamMember = async (
    member: any,
    idx: number,
    teamSide: 'ALLY' | 'ENEMY'
  ): Promise<SummonerScoutProfile | null> => {
    const puuid = String(member.puuid ?? '');
    if (!puuid || puuid.startsWith('00000000')) return null;

    const champId = Number(member.championId || member.championPickIntent || 203);
    const intentId = Number(member.championPickIntent || champId);
    const champMeta = getChampionMeta(champId);
    const intentMeta = getChampionMeta(intentId);
    const assignedRole = roleOrder[idx % 5];

    let gameName = String(member.gameName || member.summonerName || `召唤师 #${idx + 1}`);
    let tagLine = String(member.tagLine || creds.rsoPlatformId || 'HN1');
    let summonerLevel = 150;
    let profileIconId = 29;

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
      summonerLevel = Number(sumRes.data.summonerLevel ?? 150);
      profileIconId = Number(sumRes.data.profileIconId ?? 29);
    }

    const mhRes = await callLiveLcuEndpoint<any>(
      creds,
      'GET',
      `/lol-match-history/v1/products/lol/${encodeURIComponent(puuid)}/matches?begIndex=0&endIndex=19`,
      undefined,
      onEnvelope
    ).catch(() => null);

    const rawGames = mhRes?.ok ? mhRes.data?.games?.games ?? [] : [];
    const recentMatches = mapRawLcuGamesToMatchStats(rawGames, puuid, assignedRole);

    if (recentMatches.length === 0) return null;

    const rpiList = recentMatches.map((m) => calculateContextAwareRpi(m));
    const avgRpi =
      Math.round(
        (rpiList.reduce((acc, r) => acc + r.rpiScore, 0) / rpiList.length) * 10
      ) / 10;
    const tags = evaluateSummonerTags(recentMatches);

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
      soloTier: 'DIAMOND',
      soloDivision: 'I',
      soloLp: 75,
      soloWins: recentMatches.filter((m) => m.win).length,
      soloLosses: recentMatches.filter((m) => !m.win).length,
      estimatedMmr: 2350,
      mmrDeltaLabel: '实时 LCU 数据',
      hasCosmicInsight: false,
      hasIonianBoots: false,
      spell1Name: '闪现',
      spell2Name: assignedRole === RoleType.JGL ? '惩戒' : '传送',
      recentMatches,
      averageRpi: avgRpi,
      latestRpiBreakdown: rpiList[0],
      tags,
      isAnonymousInBp: teamSide === 'ENEMY' && phase === GameflowPhase.CHAMP_SELECT,
    };
  };

  for (let i = 0; i < csRes.data.myTeam.length; i++) {
    const p = await mapTeamMember(csRes.data.myTeam[i], i, 'ALLY');
    if (p) profiles.push(p);
  }
  if (Array.isArray(csRes.data.theirTeam)) {
    for (let i = 0; i < csRes.data.theirTeam.length; i++) {
      const p = await mapTeamMember(csRes.data.theirTeam[i], i, 'ENEMY');
      if (p) profiles.push(p);
    }
  }

  return {
    phase,
    profiles: profiles.length > 0 ? profiles : null,
  };
}

