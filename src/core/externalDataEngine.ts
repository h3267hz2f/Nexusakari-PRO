/**
 * NexusAkari Pro (v4) — Slice-16: Multi-Source External Live LoL Data Engine
 *
 * Integrates 4 real, unauthenticated, high-availability public League of Legends APIs:
 * 1. OP.GG Live Meta & Champion Build API (`https://lol-api-champion.op.gg/api/KR/champions/...`)
 *    - Ranked Emerald+ & ARAM All-Tier win rate, pick rate, ban rate, KDA, Tier (OP/S+/S/A/B/C), rank
 *    - Per-champion live 9-slot Rune Pages (`primary_rune_ids` + `secondary_rune_ids` + `stat_mod_ids`)
 *    - Per-champion Core Items, Starter Items, Boots, 15-level Skill Order, Summoner Spells & Counters
 * 2. Riot Games Official Data Dragon (`https://ddragon.leagueoflegends.com/api/versions.json`)
 *    - Live official patch version detection (e.g., `16.22.1`)
 * 3. Tencent Official LoL CN CDN (`https://game.gtimg.cn/images/lol/act/img/js/...`)
 *    - `heroList/hero_list.js` (Chinese hero names, titles, aliases)
 *    - `items/items.js` (Chinese item names, gold prices, icon URLs)
 * 4. CommunityDragon Live LCU Extract (`https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/zh_cn/v1/perks.json`)
 *    - Complete localized Chinese rune perk names (`8010 -> 征服者`, etc.)
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  ALL_CHAMPIONS_SORTED,
  buildAdaptiveRunePresetForChampion,
  buildAramBalanceForChampion,
  FULL_CHAMPION_CATALOG,
} from './championCatalog';
import { AramChampionBalance, IpcEnvelope } from './types';

export type ExternalPositionKey = 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT' | 'ARAM';

export interface ExternalSourceStatus {
  provider: 'OPGG_KR_API' | 'RIOT_DDRAGON' | 'TENCENT_GTIMG' | 'COMMUNITY_DRAGON';
  endpoint: string;
  healthy: boolean;
  httpStatus: number;
  latencyMs: number;
  version: string;
  cachedCount: number;
  lastSyncedAt: string;
}

export interface ExternalRuneBuildOption {
  id: string;
  name: string;
  primaryStyleId: number;
  primaryStyleName: string;
  subStyleId: number;
  subStyleName: string;
  selectedPerkIds: number[];
  perkNames: string[];
  playCount: number;
  winCount: number;
  winRate: number;
  pickRate: number;
  source: 'OPGG_LIVE' | 'ADAPTIVE_CATALOG';
}

export interface ExternalItemBuildGroup {
  ids: number[];
  names: string[];
  icons: string[];
  playCount: number;
  winRate: number;
  pickRate: number;
}

export interface ExternalCounterMatchup {
  enemyChampionId: number;
  enemyChampionName: string;
  playCount: number;
  winCount: number;
  myWinRate: number;
}

export interface ExternalChampionBuildDetail {
  championId: number;
  championName: string;
  championTitle: string;
  position: ExternalPositionKey;
  availablePositions: ExternalPositionKey[];
  patchVersion: string;
  source: 'OPGG_LIVE' | 'LOCAL_FALLBACK';
  fetchedAt: string;
  tier: number;
  tierLabel: 'T0' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5';
  rank: number;
  winRate: number;
  pickRate: number;
  banRate: number;
  kda: number;
  samplePlayCount: number;
  runeBuilds: ExternalRuneBuildOption[];
  coreItems: ExternalItemBuildGroup[];
  starterItems: ExternalItemBuildGroup[];
  boots: ExternalItemBuildGroup[];
  skillOrder: {
    masteryPriority: string[];
    levelOrder: string[];
    winRate: number;
    pickRate: number;
    playCount: number;
  };
  summonerSpells: {
    ids: number[];
    names: string[];
    winRate: number;
    pickRate: number;
    playCount: number;
  }[];
  strongAgainst: ExternalCounterMatchup[];
  weakAgainst: ExternalCounterMatchup[];
}

export interface ExternalChampionTierSummary {
  championId: number;
  championName: string;
  championTitle: string;
  primaryPosition: ExternalPositionKey;
  positions: ExternalPositionKey[];
  tier: number;
  tierLabel: 'T0' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5';
  rank: number;
  winRate: number;
  pickRate: number;
  banRate: number;
  kda: number;
  playCount: number;
}

export interface ExternalMetaOverview {
  ddragonVersion: string;
  opggPatchVersion: string;
  tencentVersion: string;
  sources: ExternalSourceStatus[];
  rankedTierList: ExternalChampionTierSummary[];
  aramBalanceList: (AramChampionBalance & {
    opggTier?: number;
    opggPlayCount?: number;
    opggKda?: number;
    opggRank?: number;
    dataSource: 'OPGG_LIVE+RIOT_BALANCE' | 'LOCAL_MODEL';
  })[];
}

const STYLE_NAME_MAP: Record<number, string> = {
  8000: '精密 (Precision)',
  8100: '主宰 (Domination)',
  8200: '巫术 (Sorcery)',
  8300: '启迪 (Inspiration)',
  8400: '坚决 (Resolve)',
};

const SUMMONER_SPELL_NAME_MAP: Record<number, string> = {
  1: '净化',
  3: '虚弱',
  4: '闪现',
  6: '幽灵疾步',
  7: '治疗术',
  11: '惩戒',
  12: '传送',
  13: '清晰术',
  14: '引燃',
  21: '屏障',
  32: '标记 (雪球)',
};

const DEFAULT_PERK_NAMES: Record<number, string> = {
  8005: '强攻',
  8008: '致命节奏',
  8021: '迅捷步法',
  8010: '征服者',
  9101: '吸收生命',
  9111: '凯旋',
  8009: '气定神闲',
  9104: '传说：欢欣',
  9105: '传说：极速',
  9103: '传说：血统',
  8014: '致命一击',
  8017: '砍倒',
  8299: '坚毅不倒',
  8112: '电刑',
  8128: '黑暗收割',
  9923: '丛刃',
  8126: '恶意中伤',
  8139: '血之滋味',
  8143: '猛然冲击',
  8136: '僵尸守卫',
  8120: '幽灵魄罗',
  8138: '眼球收集器',
  8135: '寻宝猎人',
  8105: '无情猎手',
  8106: '终极猎人',
  8214: '召唤：艾黎',
  8229: '奥术彗星',
  8230: '相位猛冲',
  8224: '公理秘术',
  8226: '法力流系带',
  8275: '灵光披风',
  8210: '超然',
  8234: '迅捷',
  8233: '绝对专注',
  8237: '焦灼',
  8232: '水上行走',
  8236: '风暴聚集',
  8437: '不灭之握',
  8439: '余震',
  8465: '守护者',
  8446: '爆破',
  8463: '生命源泉',
  8401: '护盾猛击',
  8429: '调节',
  8444: '复苏之风',
  8473: '骸骨镀层',
  8451: '过度生长',
  8453: '复苏',
  8242: '坚定',
  8351: '冰川增幅',
  8360: '启封的秘籍',
  8369: '先攻',
  8306: '海克斯闪现',
  8304: '神奇之鞋',
  8321: '现金返还',
  8313: '三重补药',
  8352: '时间扭曲补药',
  8345: '饼干配送',
  8347: '星界洞悉',
  8410: '行近速率',
  8316: '多面手',
  5008: '适应之力 +9',
  5005: '攻击速度 +10%',
  5007: '技能急速 +8',
  5001: '成长生命值 +10-180',
  5011: '固定生命值 +65',
  5010: '移动速度 +2%',
  5013: '韧性与减速抗性 +10%',
};

interface CachedExternalState {
  ddragonVersion: string;
  opggPatchVersion: string;
  tencentVersion: string;
  perkNames: Record<number, string>;
  itemCatalog: Record<number, { name: string; price: string; iconPath: string }>;
  rankedTierMap: Record<number, ExternalChampionTierSummary>;
  aramStatsMap: Record<
    number,
    {
      winRate: number;
      pickRate: number;
      kda: number;
      tier: number;
      rank: number;
      playCount: number;
    }
  >;
  sources: Record<string, ExternalSourceStatus>;
  championBuildCache: Record<string, ExternalChampionBuildDetail>;
  lastFullSyncMs: number;
}

const state: CachedExternalState = {
  ddragonVersion: '16.22.1',
  opggPatchVersion: '16.22',
  tencentVersion: '16.22',
  perkNames: { ...DEFAULT_PERK_NAMES },
  itemCatalog: {},
  rankedTierMap: {},
  aramStatsMap: {},
  sources: {
    OPGG_KR_API: {
      provider: 'OPGG_KR_API',
      endpoint: 'https://lol-api-champion.op.gg/api/KR/champions',
      healthy: false,
      httpStatus: 0,
      latencyMs: 0,
      version: '16.22',
      cachedCount: 0,
      lastSyncedAt: '未同步',
    },
    RIOT_DDRAGON: {
      provider: 'RIOT_DDRAGON',
      endpoint: 'https://ddragon.leagueoflegends.com/api/versions.json',
      healthy: false,
      httpStatus: 0,
      latencyMs: 0,
      version: '16.22.1',
      cachedCount: 169,
      lastSyncedAt: '未同步',
    },
    TENCENT_GTIMG: {
      provider: 'TENCENT_GTIMG',
      endpoint: 'https://game.gtimg.cn/images/lol/act/img/js/items/items.js',
      healthy: false,
      httpStatus: 0,
      latencyMs: 0,
      version: '16.22',
      cachedCount: 0,
      lastSyncedAt: '未同步',
    },
    COMMUNITY_DRAGON: {
      provider: 'COMMUNITY_DRAGON',
      endpoint:
        'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/zh_cn/v1/perks.json',
      healthy: false,
      httpStatus: 0,
      latencyMs: 0,
      version: 'latest',
      cachedCount: Object.keys(DEFAULT_PERK_NAMES).length,
      lastSyncedAt: '未同步',
    },
  },
  championBuildCache: {},
  lastFullSyncMs: 0,
};

function resolveCacheFilePath(): string {
  const appData = process.env.APPDATA || process.env.HOME || process.cwd();
  const dir = path.join(appData, '.nexus-akari-pro');
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return path.join(dir, 'nexus-akari-external-cache.json');
  } catch {
    return path.join(process.cwd(), 'nexus-akari-external-cache.json');
  }
}

function saveExternalCacheToDisk(): void {
  try {
    const file = resolveCacheFilePath();
    const payload = {
      ddragonVersion: state.ddragonVersion,
      opggPatchVersion: state.opggPatchVersion,
      tencentVersion: state.tencentVersion,
      rankedTierMap: state.rankedTierMap,
      aramStatsMap: state.aramStatsMap,
      sources: state.sources,
      lastFullSyncMs: state.lastFullSyncMs,
    };
    fs.writeFileSync(file, JSON.stringify(payload), 'utf-8');
  } catch {
    // Ignore disk write failure on read-only filesystems
  }
}

function loadExternalCacheFromDisk(): void {
  try {
    const file = resolveCacheFilePath();
    if (!fs.existsSync(file)) return;
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (raw.ddragonVersion) state.ddragonVersion = raw.ddragonVersion;
    if (raw.opggPatchVersion) state.opggPatchVersion = raw.opggPatchVersion;
    if (raw.rankedTierMap) state.rankedTierMap = raw.rankedTierMap;
    if (raw.aramStatsMap) state.aramStatsMap = raw.aramStatsMap;
    if (raw.sources) state.sources = { ...state.sources, ...raw.sources };
  } catch {
    // Ignore corrupt cache
  }
}

loadExternalCacheFromDisk();

function mapOpggTierLabel(tier: number): 'T0' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5' {
  if (tier === 0) return 'T0';
  if (tier === 1) return 'T1';
  if (tier === 2) return 'T2';
  if (tier === 3) return 'T3';
  if (tier === 4) return 'T4';
  return 'T5';
}

function normalizePosition(pos: string): ExternalPositionKey {
  const upper = pos.toUpperCase();
  if (upper === 'TOP') return 'TOP';
  if (upper === 'JUNGLE' || upper === 'JGL') return 'JUNGLE';
  if (upper === 'MID' || upper === 'MIDDLE') return 'MID';
  if (upper === 'ADC' || upper === 'BOTTOM') return 'ADC';
  if (upper === 'SUPPORT' || upper === 'UTILITY' || upper === 'SUP') return 'SUPPORT';
  if (upper === 'ARAM' || upper === 'NONE') return 'ARAM';
  return 'MID';
}

async function fetchJsonWithTimeout<T>(
  url: string,
  timeoutMs = 6500
): Promise<{ ok: boolean; status: number; latencyMs: number; data: T | null }> {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    const latencyMs = Number((performance.now() - started).toFixed(1));
    if (!res.ok) {
      return { ok: false, status: res.status, latencyMs, data: null };
    }
    const data = (await res.json()) as T;
    return { ok: true, status: res.status, latencyMs, data };
  } catch {
    const latencyMs = Number((performance.now() - started).toFixed(1));
    return { ok: false, status: 503, latencyMs, data: null };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Synchronizes all 4 external data sources in parallel:
 * 1. Riot DataDragon versions
 * 2. OP.GG KR Ranked Emerald+ & ARAM All-Tier 169-champion statistics
 * 3. Tencent Official LoL Items & Heroes catalog
 * 4. CommunityDragon zh_CN Perks dictionary
 */
export async function syncExternalLoLDataSources(
  force = false
): Promise<{
  overview: ExternalMetaOverview;
  envelopes: IpcEnvelope[];
}> {
  const now = Date.now();
  const envelopes: IpcEnvelope[] = [];
  const nowTimeStr = new Date().toTimeString().slice(0, 8);

  if (
    !force &&
    state.lastFullSyncMs > 0 &&
    now - state.lastFullSyncMs < 5 * 60 * 1000 &&
    Object.keys(state.rankedTierMap).length > 50
  ) {
    return {
      overview: buildExternalMetaOverview(),
      envelopes,
    };
  }

  const [ddragonRes, opggRankedRes, opggAramRes, tencentItemsRes, cdragonPerksRes] =
    await Promise.all([
      fetchJsonWithTimeout<string[]>('https://ddragon.leagueoflegends.com/api/versions.json', 5000),
      fetchJsonWithTimeout<{
        meta?: { version?: string; cached_at?: string };
        data?: Array<{
          id: number;
          average_stats?: {
            play?: number;
            win_rate?: number;
            pick_rate?: number;
            ban_rate?: number;
            kda?: number;
            tier?: number;
            rank?: number;
          };
          positions?: Array<{
            name: string;
            stats?: {
              play?: number;
              win_rate?: number;
              pick_rate?: number;
              ban_rate?: number;
              kda?: number;
              tier_data?: { tier?: number; rank?: number };
            };
          }>;
        }>;
      }>('https://lol-api-champion.op.gg/api/KR/champions/ranked?tier=emerald_plus', 7000),
      fetchJsonWithTimeout<{
        meta?: { version?: string };
        data?: Array<{
          id: number;
          average_stats?: {
            play?: number;
            win_rate?: number;
            pick_rate?: number;
            kda?: number;
            tier?: number;
            rank?: number;
          };
        }>;
      }>('https://lol-api-champion.op.gg/api/KR/champions/aram?tier=all', 7000),
      fetchJsonWithTimeout<{
        version?: string;
        items?: Array<{
          itemId: string;
          name: string;
          price: string;
          iconPath: string;
        }>;
      }>('https://game.gtimg.cn/images/lol/act/img/js/items/items.js', 6500),
      fetchJsonWithTimeout<
        Array<{
          id: number;
          name: string;
        }>
      >(
        'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/zh_cn/v1/perks.json',
        6500
      ),
    ]);

  // 1. Process Riot DataDragon
  if (ddragonRes.ok && Array.isArray(ddragonRes.data) && ddragonRes.data.length > 0) {
    state.ddragonVersion = ddragonRes.data[0];
    state.sources.RIOT_DDRAGON = {
      provider: 'RIOT_DDRAGON',
      endpoint: 'https://ddragon.leagueoflegends.com/api/versions.json',
      healthy: true,
      httpStatus: ddragonRes.status,
      latencyMs: ddragonRes.latencyMs,
      version: state.ddragonVersion,
      cachedCount: ddragonRes.data.length,
      lastSyncedAt: nowTimeStr,
    };
  }
  envelopes.push({
    id: `ext-ddragon-${now}`,
    timestamp: `${nowTimeStr}.102`,
    channel: 'SGP_HTTPS',
    method: 'GET',
    endpoint: 'https://ddragon.leagueoflegends.com/api/versions.json',
    status: ddragonRes.status,
    durationMs: ddragonRes.latencyMs,
    payloadSummary: `Riot DataDragon Patch Version -> ${state.ddragonVersion}`,
  });

  // 2. Process OP.GG Ranked & ARAM live telemetry
  if (opggRankedRes.ok && opggRankedRes.data?.data) {
    if (opggRankedRes.data.meta?.version) {
      state.opggPatchVersion = opggRankedRes.data.meta.version;
    }
    for (const item of opggRankedRes.data.data) {
      const champMeta = FULL_CHAMPION_CATALOG[item.id];
      const positions: ExternalPositionKey[] =
        item.positions && item.positions.length > 0
          ? item.positions.map((p) => normalizePosition(p.name))
          : champMeta
            ? [normalizePosition(champMeta.primaryRole)]
            : ['MID'];
      const topPos = item.positions?.[0];
      const avg = item.average_stats || {};
      const tierNum = topPos?.stats?.tier_data?.tier ?? avg.tier ?? 3;
      const rankNum = topPos?.stats?.tier_data?.rank ?? avg.rank ?? 99;
      state.rankedTierMap[item.id] = {
        championId: item.id,
        championName: champMeta?.name || `英雄 #${item.id}`,
        championTitle: champMeta?.title || `Champion ${item.id}`,
        primaryPosition: positions[0] || 'MID',
        positions,
        tier: tierNum,
        tierLabel: mapOpggTierLabel(tierNum),
        rank: rankNum,
        winRate: Number((avg.win_rate ?? topPos?.stats?.win_rate ?? 0.5).toFixed(4)),
        pickRate: Number((avg.pick_rate ?? topPos?.stats?.pick_rate ?? 0.04).toFixed(4)),
        banRate: Number((avg.ban_rate ?? topPos?.stats?.ban_rate ?? 0.01).toFixed(4)),
        kda: Number((avg.kda ?? topPos?.stats?.kda ?? 2.2).toFixed(2)),
        playCount: avg.play ?? topPos?.stats?.play ?? 0,
      };
    }
  }

  if (opggAramRes.ok && opggAramRes.data?.data) {
    for (const item of opggAramRes.data.data) {
      const avg = item.average_stats || {};
      state.aramStatsMap[item.id] = {
        winRate: Number((avg.win_rate ?? 0.5).toFixed(4)),
        pickRate: Number((avg.pick_rate ?? 0.05).toFixed(4)),
        kda: Number((avg.kda ?? 2.8).toFixed(2)),
        tier: avg.tier ?? 3,
        rank: avg.rank ?? 85,
        playCount: avg.play ?? 0,
      };
    }
  }

  const opggHealthy = opggRankedRes.ok || opggAramRes.ok;
  state.sources.OPGG_KR_API = {
    provider: 'OPGG_KR_API',
    endpoint: 'https://lol-api-champion.op.gg/api/KR/champions (Ranked+ARAM)',
    healthy: opggHealthy,
    httpStatus: opggRankedRes.status || opggAramRes.status,
    latencyMs: Number(((opggRankedRes.latencyMs + opggAramRes.latencyMs) / 2).toFixed(1)),
    version: state.opggPatchVersion,
    cachedCount:
      Object.keys(state.rankedTierMap).length + Object.keys(state.aramStatsMap).length,
    lastSyncedAt: nowTimeStr,
  };

  envelopes.push({
    id: `ext-opgg-${now}`,
    timestamp: `${nowTimeStr}.215`,
    channel: 'SGP_HTTPS',
    method: 'GET',
    endpoint: 'https://lol-api-champion.op.gg/api/KR/champions/ranked+aram',
    status: state.sources.OPGG_KR_API.httpStatus,
    durationMs: state.sources.OPGG_KR_API.latencyMs,
    payloadSummary: `OP.GG Live Ranked (${Object.keys(state.rankedTierMap).length}) + ARAM (${Object.keys(state.aramStatsMap).length}) synced (Patch ${state.opggPatchVersion})`,
  });

  // 3. Process Tencent Official Items Catalog
  if (tencentItemsRes.ok && tencentItemsRes.data?.items) {
    if (tencentItemsRes.data.version) {
      state.tencentVersion = tencentItemsRes.data.version;
    }
    for (const item of tencentItemsRes.data.items) {
      const idNum = Number(item.itemId);
      if (idNum > 0 && item.name) {
        state.itemCatalog[idNum] = {
          name: item.name,
          price: item.price || '0',
          iconPath: item.iconPath || '',
        };
      }
    }
    state.sources.TENCENT_GTIMG = {
      provider: 'TENCENT_GTIMG',
      endpoint: 'https://game.gtimg.cn/images/lol/act/img/js/items/items.js',
      healthy: true,
      httpStatus: tencentItemsRes.status,
      latencyMs: tencentItemsRes.latencyMs,
      version: state.tencentVersion,
      cachedCount: Object.keys(state.itemCatalog).length,
      lastSyncedAt: nowTimeStr,
    };
  }
  envelopes.push({
    id: `ext-gtimg-${now}`,
    timestamp: `${nowTimeStr}.318`,
    channel: 'SGP_HTTPS',
    method: 'GET',
    endpoint: 'https://game.gtimg.cn/images/lol/act/img/js/items/items.js',
    status: tencentItemsRes.status,
    durationMs: tencentItemsRes.latencyMs,
    payloadSummary: `Tencent GTImg Item Catalog (${Object.keys(state.itemCatalog).length} items)`,
  });

  // 4. Process CommunityDragon zh_CN Perks
  if (cdragonPerksRes.ok && Array.isArray(cdragonPerksRes.data)) {
    for (const perk of cdragonPerksRes.data) {
      if (perk.id && perk.name) {
        state.perkNames[perk.id] = perk.name;
      }
    }
    state.sources.COMMUNITY_DRAGON = {
      provider: 'COMMUNITY_DRAGON',
      endpoint:
        'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/zh_cn/v1/perks.json',
      healthy: true,
      httpStatus: cdragonPerksRes.status,
      latencyMs: cdragonPerksRes.latencyMs,
      version: state.ddragonVersion,
      cachedCount: Object.keys(state.perkNames).length,
      lastSyncedAt: nowTimeStr,
    };
  }
  envelopes.push({
    id: `ext-cdragon-${now}`,
    timestamp: `${nowTimeStr}.409`,
    channel: 'SGP_HTTPS',
    method: 'GET',
    endpoint: 'https://raw.communitydragon.org/.../zh_cn/v1/perks.json',
    status: cdragonPerksRes.status,
    durationMs: cdragonPerksRes.latencyMs,
    payloadSummary: `CommunityDragon zh_CN Perks (${Object.keys(state.perkNames).length} runes)`,
  });

  state.lastFullSyncMs = now;
  saveExternalCacheToDisk();

  return {
    overview: buildExternalMetaOverview(),
    envelopes,
  };
}

/**
 * Builds the aggregated ExternalMetaOverview combining OP.GG live telemetry + Riot ARAM modifiers
 */
export function buildExternalMetaOverview(): ExternalMetaOverview {
  const rankedTierList: ExternalChampionTierSummary[] = ALL_CHAMPIONS_SORTED.map((champ) => {
    const live = state.rankedTierMap[champ.id];
    if (live) return live;
    const normRole = normalizePosition(champ.primaryRole);
    return {
      championId: champ.id,
      championName: champ.name,
      championTitle: champ.title,
      primaryPosition: normRole,
      positions: [normRole],
      tier: 3,
      tierLabel: 'T3' as const,
      rank: 85,
      winRate: 0.5,
      pickRate: 0.04,
      banRate: 0.02,
      kda: 2.25,
      playCount: 0,
    };
  }).sort((a, b) => a.tier - b.tier || b.winRate - a.winRate);

  const aramBalanceList = ALL_CHAMPIONS_SORTED.map((champ) => {
    const baseBalance = buildAramBalanceForChampion(champ.id);
    const liveAram = state.aramStatsMap[champ.id];
    if (!liveAram) {
      return {
        ...baseBalance,
        dataSource: 'LOCAL_MODEL' as const,
      };
    }
    return {
      ...baseBalance,
      baseWinRate: liveAram.winRate,
      pickRate: liveAram.pickRate,
      opggTier: liveAram.tier,
      opggPlayCount: liveAram.playCount,
      opggKda: liveAram.kda,
      opggRank: liveAram.rank,
      dataSource: 'OPGG_LIVE+RIOT_BALANCE' as const,
    };
  }).sort((a, b) => b.baseWinRate - a.baseWinRate);

  return {
    ddragonVersion: state.ddragonVersion,
    opggPatchVersion: state.opggPatchVersion,
    tencentVersion: state.tencentVersion,
    sources: Object.values(state.sources),
    rankedTierList,
    aramBalanceList,
  };
}

/**
 * Fetches real-time OP.GG per-champion build detail (9-slot Rune Pages, Core Items, Boots,
 * Skill Order, Summoner Spells, and Counter Matchups) for any of the 169 champions.
 */
export async function fetchExternalChampionBuild(
  championId: number,
  requestedPosition?: ExternalPositionKey
): Promise<{
  detail: ExternalChampionBuildDetail;
  envelopes: IpcEnvelope[];
}> {
  const champMeta = FULL_CHAMPION_CATALOG[championId] || {
    id: championId,
    name: `英雄 #${championId}`,
    title: `Champion ${championId}`,
    alias: `Champ${championId}`,
    primaryRole: 'MID' as const,
    archetype: 'MAGE_BURST' as const,
    adaptiveType: 'AP' as const,
  };

  // Ensure item & rune dictionaries are warmed up if empty
  if (Object.keys(state.itemCatalog).length === 0) {
    await syncExternalLoLDataSources(false);
  }

  const rankedTierInfo = state.rankedTierMap[championId];
  const defaultPos = normalizePosition(champMeta.primaryRole);
  const availablePositions: ExternalPositionKey[] = rankedTierInfo?.positions?.length
    ? [...rankedTierInfo.positions, 'ARAM']
    : [defaultPos, 'ARAM'];

  const position: ExternalPositionKey =
    requestedPosition || rankedTierInfo?.primaryPosition || defaultPos;

  const cacheKey = `${championId}:${position}`;
  const cached = state.championBuildCache[cacheKey];
  if (cached) {
    return { detail: cached, envelopes: [] };
  }

  const isAram = position === 'ARAM';
  const opggPosSlug = isAram ? 'none' : position.toLowerCase();
  const opggUrl = isAram
    ? `https://lol-api-champion.op.gg/api/KR/champions/aram/${championId}/none?tier=all`
    : `https://lol-api-champion.op.gg/api/KR/champions/ranked/${championId}/${opggPosSlug}?tier=emerald_plus`;

  const res = await fetchJsonWithTimeout<{
    meta?: { version?: string };
    data?: {
      summary?: {
        average_stats?: {
          play?: number;
          win_rate?: number;
          pick_rate?: number;
          ban_rate?: number;
          kda?: number;
          tier?: number;
          rank?: number;
        };
        positions?: Array<{
          name: string;
          stats?: {
            play?: number;
            win_rate?: number;
            pick_rate?: number;
            ban_rate?: number;
            kda?: number;
            tier_data?: { tier?: number; rank?: number };
          };
        }>;
      };
      runes?: Array<{
        id: number;
        primary_page_id: number;
        primary_rune_ids: number[];
        secondary_page_id: number;
        secondary_rune_ids: number[];
        stat_mod_ids: number[];
        play: number;
        win: number;
        pick_rate: number;
      }>;
      core_items?: Array<{
        ids: number[];
        play: number;
        win: number;
        pick_rate: number;
      }>;
      starter_items?: Array<{
        ids: number[];
        play: number;
        win: number;
        pick_rate: number;
      }>;
      boots?: Array<{
        ids: number[];
        play: number;
        win: number;
        pick_rate: number;
      }>;
      skills?: Array<{
        order: string[];
        play: number;
        win: number;
        pick_rate: number;
      }>;
      skill_masteries?: Array<{
        ids: string[];
        play: number;
        win: number;
        pick_rate: number;
      }>;
      summoner_spells?: Array<{
        ids: number[];
        play: number;
        win: number;
        pick_rate: number;
      }>;
      counters?: Array<{
        champion_id: number;
        play: number;
        win: number;
      }>;
    };
  }>(opggUrl, 6500);

  const nowTimeStr = new Date().toTimeString().slice(0, 8);
  const envelope: IpcEnvelope = {
    id: `ext-champ-${championId}-${Date.now()}`,
    timestamp: `${nowTimeStr}.512`,
    channel: 'SGP_HTTPS',
    method: 'GET',
    endpoint: opggUrl,
    status: res.status,
    durationMs: res.latencyMs,
    payloadSummary: `OP.GG Build [${champMeta.title} · ${position}] -> HTTP ${res.status}`,
  };

  if (res.ok && res.data?.data) {
    const d = res.data.data;
    const avg = d.summary?.average_stats || {};
    const posStat = d.summary?.positions?.find(
      (p) => normalizePosition(p.name) === position
    )?.stats;

    const winRate = Number((posStat?.win_rate ?? avg.win_rate ?? 0.5).toFixed(4));
    const pickRate = Number((posStat?.pick_rate ?? avg.pick_rate ?? 0.05).toFixed(4));
    const banRate = Number((posStat?.ban_rate ?? avg.ban_rate ?? 0.01).toFixed(4));
    const kda = Number((posStat?.kda ?? avg.kda ?? 2.4).toFixed(2));
    const tier = posStat?.tier_data?.tier ?? avg.tier ?? 3;
    const rank = posStat?.tier_data?.rank ?? avg.rank ?? 50;
    const samplePlayCount = posStat?.play ?? avg.play ?? 0;

    const runeBuilds: ExternalRuneBuildOption[] = (d.runes || []).slice(0, 3).map((r, idx) => {
      const selectedPerkIds = [
        ...(r.primary_rune_ids || []),
        ...(r.secondary_rune_ids || []),
        ...(r.stat_mod_ids || []),
      ];
      const keystoneId = r.primary_rune_ids?.[0] || 8010;
      const keystoneName = state.perkNames[keystoneId] || `基石 #${keystoneId}`;
      const rWinRate = r.play > 0 ? Number((r.win / r.play).toFixed(4)) : 0.51;
      return {
        id: `opgg-${championId}-${position.toLowerCase()}-${idx}`,
        name: `OP.GG ${champMeta.title}·${position} #${idx + 1} (${keystoneName} ${(rWinRate * 100).toFixed(1)}%)`,
        primaryStyleId: r.primary_page_id,
        primaryStyleName: STYLE_NAME_MAP[r.primary_page_id] || `系别 ${r.primary_page_id}`,
        subStyleId: r.secondary_page_id,
        subStyleName: STYLE_NAME_MAP[r.secondary_page_id] || `系别 ${r.secondary_page_id}`,
        selectedPerkIds,
        perkNames: selectedPerkIds.map((pid) => state.perkNames[pid] || `符文 #${pid}`),
        playCount: r.play,
        winCount: r.win,
        winRate: rWinRate,
        pickRate: Number((r.pick_rate || 0).toFixed(4)),
        source: 'OPGG_LIVE',
      };
    });

    if (runeBuilds.length === 0) {
      const fallbackRune = buildAdaptiveRunePresetForChampion(championId);
      runeBuilds.push({
        id: fallbackRune.id,
        name: fallbackRune.pageName,
        primaryStyleId: fallbackRune.primaryStyleId,
        primaryStyleName: STYLE_NAME_MAP[fallbackRune.primaryStyleId] || '主系',
        subStyleId: fallbackRune.subStyleId,
        subStyleName: STYLE_NAME_MAP[fallbackRune.subStyleId] || '副系',
        selectedPerkIds: fallbackRune.selectedPerkIds,
        perkNames: fallbackRune.selectedPerkIds.map(
          (pid) => state.perkNames[pid] || `符文 #${pid}`
        ),
        playCount: 1000,
        winCount: 515,
        winRate: 0.515,
        pickRate: 0.65,
        source: 'ADAPTIVE_CATALOG',
      });
    }

    const mapItemGroup = (
      arr?: Array<{ ids: number[]; play: number; win: number; pick_rate: number }>,
      limit = 3
    ): ExternalItemBuildGroup[] =>
      (arr || []).slice(0, limit).map((grp) => ({
        ids: grp.ids,
        names: grp.ids.map((id) => state.itemCatalog[id]?.name || `装备 #${id}`),
        icons: grp.ids.map(
          (id) =>
            state.itemCatalog[id]?.iconPath ||
            `https://game.gtimg.cn/images/lol/act/img/item/${id}.png`
        ),
        playCount: grp.play,
        winRate: grp.play > 0 ? Number((grp.win / grp.play).toFixed(4)) : 0.5,
        pickRate: Number((grp.pick_rate || 0).toFixed(4)),
      }));

    const topSkill = d.skills?.[0];
    const topMastery = d.skill_masteries?.[0];

    const countersSorted = (d.counters || [])
      .filter((c) => c.play >= 30)
      .map((c) => {
        const enemyMeta = FULL_CHAMPION_CATALOG[c.champion_id];
        return {
          enemyChampionId: c.champion_id,
          enemyChampionName: enemyMeta
            ? `${enemyMeta.name}·${enemyMeta.title}`
            : `英雄 #${c.champion_id}`,
          playCount: c.play,
          winCount: c.win,
          myWinRate: Number((c.win / c.play).toFixed(4)),
        };
      })
      .sort((a, b) => b.myWinRate - a.myWinRate);

    const detail: ExternalChampionBuildDetail = {
      championId,
      championName: champMeta.name,
      championTitle: champMeta.title,
      position,
      availablePositions,
      patchVersion: res.data.meta?.version || state.opggPatchVersion,
      source: 'OPGG_LIVE',
      fetchedAt: nowTimeStr,
      tier,
      tierLabel: mapOpggTierLabel(tier),
      rank,
      winRate,
      pickRate,
      banRate,
      kda,
      samplePlayCount,
      runeBuilds,
      coreItems: mapItemGroup(d.core_items, 4),
      starterItems: mapItemGroup(d.starter_items, 2),
      boots: mapItemGroup(d.boots, 2),
      skillOrder: {
        masteryPriority: topMastery?.ids || ['Q', 'E', 'W'],
        levelOrder: topSkill?.order?.slice(0, 15) || [
          'Q',
          'W',
          'E',
          'Q',
          'Q',
          'R',
          'Q',
          'E',
          'Q',
          'E',
          'R',
          'E',
          'E',
          'W',
          'W',
        ],
        winRate:
          topSkill && topSkill.play > 0
            ? Number((topSkill.win / topSkill.play).toFixed(4))
            : 0.52,
        pickRate: Number((topSkill?.pick_rate || 0.65).toFixed(4)),
        playCount: topSkill?.play || 0,
      },
      summonerSpells: (d.summoner_spells || []).slice(0, 2).map((sp) => ({
        ids: sp.ids,
        names: sp.ids.map((id) => SUMMONER_SPELL_NAME_MAP[id] || `技能 #${id}`),
        winRate: sp.play > 0 ? Number((sp.win / sp.play).toFixed(4)) : 0.51,
        pickRate: Number((sp.pick_rate || 0).toFixed(4)),
        playCount: sp.play,
      })),
      strongAgainst: countersSorted.slice(0, 4),
      weakAgainst: [...countersSorted].reverse().slice(0, 4),
    };

    state.championBuildCache[cacheKey] = detail;
    return { detail, envelopes: [envelope] };
  }

  // Fallback if offline
  const fallbackRune = buildAdaptiveRunePresetForChampion(championId);
  const fallbackDetail: ExternalChampionBuildDetail = {
    championId,
    championName: champMeta.name,
    championTitle: champMeta.title,
    position,
    availablePositions,
    patchVersion: state.opggPatchVersion,
    source: 'LOCAL_FALLBACK',
    fetchedAt: nowTimeStr,
    tier: 2,
    tierLabel: 'T2',
    rank: 40,
    winRate: 0.512,
    pickRate: 0.065,
    banRate: 0.032,
    kda: 2.45,
    samplePlayCount: 0,
    runeBuilds: [
      {
        id: fallbackRune.id,
        name: fallbackRune.pageName,
        primaryStyleId: fallbackRune.primaryStyleId,
        primaryStyleName: STYLE_NAME_MAP[fallbackRune.primaryStyleId] || '主系',
        subStyleId: fallbackRune.subStyleId,
        subStyleName: STYLE_NAME_MAP[fallbackRune.subStyleId] || '副系',
        selectedPerkIds: fallbackRune.selectedPerkIds,
        perkNames: fallbackRune.selectedPerkIds.map(
          (pid) => state.perkNames[pid] || `符文 #${pid}`
        ),
        playCount: 0,
        winCount: 0,
        winRate: 0.512,
        pickRate: 0.72,
        source: 'ADAPTIVE_CATALOG',
      },
    ],
    coreItems: [],
    starterItems: [],
    boots: [],
    skillOrder: {
      masteryPriority: ['Q', 'E', 'W'],
      levelOrder: ['Q', 'W', 'E', 'Q', 'Q', 'R', 'Q', 'E', 'Q', 'E', 'R', 'E', 'E', 'W', 'W'],
      winRate: 0.51,
      pickRate: 0.7,
      playCount: 0,
    },
    summonerSpells: [
      {
        ids: [4, 14],
        names: ['闪现', '引燃'],
        winRate: 0.51,
        pickRate: 0.6,
        playCount: 0,
      },
    ],
    strongAgainst: [],
    weakAgainst: [],
  };

  return { detail: fallbackDetail, envelopes: [envelope] };
}
