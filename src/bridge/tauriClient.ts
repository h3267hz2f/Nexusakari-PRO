/**
 * NexusAkari Pro (v4) — Isomorphic Tauri 2 IPC & Web Gateway Client
 * Transparently routes typed commands to:
 * 1. Native Tauri 2 Rust Runtime (`window.__TAURI_INTERNALS__.invoke`) when running as a desktop app
 * 2. Express Isomorphic Tri-Channel Bridge (`/api/bridge/*` & `/api/ai/*`) when running in Web Preview
 */

import {
  AiJudgePersona,
  AiJudgeReport,
  AutomationConfig,
  BlacklistEntry,
  ChatReportMode,
  GameflowPhase,
  IpcEnvelope,
  LcuRcuCredentials,
  LootDisenchantPlan,
  LootItemShard,
  SummonerScoutProfile,
  ThrowPointEvidence,
  TimelineMinutePoint,
  TriChannelStatus,
} from '../core/types';

declare global {
  interface Window {
    __TAURI_INTERNALS__?: {
      invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
    };
  }
}

export interface BpSimulationResult {
  autoAcceptTriggered: boolean;
  autoAcceptDelayMs: number;
  hoveredChampionId: number;
  hoveredChampionName: string;
  skippedTeammateIntentBanIds: number[];
  lockedBanChampionId: number | null;
  lockedBanChampionName: string;
  lockedPickChampionId: number;
  lockedPickChampionName: string;
  appliedJitterMs: number;
  auditTrail: string[];
  ringBufferUpdated: IpcEnvelope[];
}

export interface AramSnipeResult {
  swapped: boolean;
  previousChampionId: number;
  previousChampionName: string;
  newChampionId: number;
  newChampionName: string;
  benchPoolIds: number[];
  elapsedMicroseconds: number;
  auditMessage: string;
  ringBufferUpdated: IpcEnvelope[];
}

export interface ClientCosmeticPayload {
  skinSplashId: number;
  skinName: string;
  spoofTier: string;
  spoofDivision: string;
  spoofLp: number;
  challengeCrystalLevel: string;
  statusMessage: string;
}

export interface LiveAramSessionDto {
  benchEnabled: boolean;
  currentChampionId: number;
  benchChampionIds: number[];
}

export interface SpectatorQueryResult {
  found: boolean;
  source: 'SGP_GSM' | 'LCU_GAMEFLOW' | 'REPLAY_SYNTHESIS';
  regionCode: string;
  spectatorDomain: string;
  spectatorPort: number;
  gameId: string;
  encryptionKey: string;
  targetName: string;
  message: string;
  ringBuffer: IpcEnvelope[];
}

export interface SpectatorLaunchResult {
  launched: boolean;
  executablePath: string;
  cliCommand: string;
  message: string;
  ringBuffer: IpcEnvelope[];
}

export interface ExternalSourceStatusDto {
  provider: 'OPGG_KR_API' | 'RIOT_DDRAGON' | 'TENCENT_GTIMG' | 'COMMUNITY_DRAGON';
  endpoint: string;
  healthy: boolean;
  httpStatus: number;
  latencyMs: number;
  version: string;
  cachedCount: number;
  lastSyncedAt: string;
}

export interface ExternalRuneBuildOptionDto {
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

export interface ExternalItemBuildGroupDto {
  ids: number[];
  names: string[];
  icons: string[];
  playCount: number;
  winRate: number;
  pickRate: number;
}

export interface ExternalChampionBuildDetailDto {
  championId: number;
  championName: string;
  championTitle: string;
  position: 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT' | 'ARAM';
  availablePositions: ('TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT' | 'ARAM')[];
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
  runeBuilds: ExternalRuneBuildOptionDto[];
  coreItems: ExternalItemBuildGroupDto[];
  starterItems: ExternalItemBuildGroupDto[];
  boots: ExternalItemBuildGroupDto[];
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
  strongAgainst: {
    enemyChampionId: number;
    enemyChampionName: string;
    playCount: number;
    winCount: number;
    myWinRate: number;
  }[];
  weakAgainst: {
    enemyChampionId: number;
    enemyChampionName: string;
    playCount: number;
    winCount: number;
    myWinRate: number;
  }[];
}

export interface ExternalMetaOverviewDto {
  ddragonVersion: string;
  opggPatchVersion: string;
  tencentVersion: string;
  sources: ExternalSourceStatusDto[];
  rankedTierList: {
    championId: number;
    championName: string;
    championTitle: string;
    primaryPosition: 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT' | 'ARAM';
    positions: ('TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT' | 'ARAM')[];
    tier: number;
    tierLabel: 'T0' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5';
    rank: number;
    winRate: number;
    pickRate: number;
    banRate: number;
    kda: number;
    playCount: number;
  }[];
  aramBalanceList: (import('../core/types').AramChampionBalance & {
    opggTier?: number;
    opggPlayCount?: number;
    opggKda?: number;
    opggRank?: number;
    dataSource: 'OPGG_LIVE+RIOT_BALANCE' | 'LOCAL_MODEL';
  })[];
}

export function isTauriNativeRuntime(): boolean {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__?.invoke);
}

function resolveBridgeUrl(url: string): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const proto = window.location.protocol;
    if (host === 'tauri.localhost' || proto === 'tauri:' || proto === 'asset:') {
      return `http://127.0.0.1:32100${url}`;
    }
  }
  return url;
}

async function apiJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(resolveBridgeUrl(url), {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || `Bridge HTTP Error ${response.status}`);
  }
  return response.json() as Promise<T>;
}

/**
 * Dual-mode dispatcher: invokes Tauri 2 native Rust command when `window.__TAURI_INTERNALS__.invoke`
 * is present, and seamlessly falls back to the Express isomorphic bridge in Web Preview or Sidecar.
 */
async function invokeOrFetch<T>(
  tauriCmd: string,
  tauriArgs: Record<string, unknown>,
  httpUrl: string,
  httpOptions?: RequestInit
): Promise<T> {
  if (isTauriNativeRuntime() && window.__TAURI_INTERNALS__?.invoke) {
    try {
      return await window.__TAURI_INTERNALS__.invoke<T>(tauriCmd, tauriArgs);
    } catch {
      // Fallback to local HTTP sidecar bridge if command delegates to Express sidecar
      return apiJson<T>(httpUrl, httpOptions);
    }
  }
  return apiJson<T>(httpUrl, httpOptions);
}

export const tauriBridgeClient = {
  async getBootstrapState(): Promise<{
    status: TriChannelStatus;
    automation: AutomationConfig;
    blacklist: BlacklistEntry[];
    ringBuffer: IpcEnvelope[];
    scoutProfiles: SummonerScoutProfile[];
    lootShards?: LootItemShard[];
    matchTimeline?: TimelineMinutePoint[];
    aramSession?: LiveAramSessionDto | null;
    liveClientConnected?: boolean;
  }> {
    return invokeOrFetch('get_bootstrap_state', {}, '/api/bridge/bootstrap');
  },

  async probeLiveClient(): Promise<{
    connected: boolean;
    message: string;
    status: TriChannelStatus;
    scoutProfiles: SummonerScoutProfile[];
    lootShards: LootItemShard[];
    matchTimeline?: TimelineMinutePoint[];
    aramSession?: LiveAramSessionDto | null;
    ringBuffer: IpcEnvelope[];
  }> {
    return invokeOrFetch(
      'probe_live_lcu_client',
      {},
      '/api/bridge/probe-live-client',
      {
        method: 'POST',
      }
    );
  },

  async setGameflowPhase(phase: GameflowPhase): Promise<{
    status: TriChannelStatus;
    scoutProfiles: SummonerScoutProfile[];
    matchTimeline?: TimelineMinutePoint[];
    ringBuffer: IpcEnvelope[];
  }> {
    return invokeOrFetch(
      'set_gameflow_phase',
      { phase },
      '/api/bridge/phase',
      {
        method: 'POST',
        body: JSON.stringify({ phase }),
      }
    );
  },

  async switchSgpRegion(regionCode: string): Promise<{
    status: TriChannelStatus;
    ringBuffer: IpcEnvelope[];
  }> {
    return invokeOrFetch(
      'switch_sgp_region',
      { regionCode },
      '/api/bridge/region',
      {
        method: 'POST',
        body: JSON.stringify({ regionCode }),
      }
    );
  },

  async updateCredentials(credentials: Partial<LcuRcuCredentials>): Promise<{
    status: TriChannelStatus;
    scoutProfiles?: SummonerScoutProfile[];
    lootShards?: LootItemShard[];
    matchTimeline?: TimelineMinutePoint[];
    ringBuffer: IpcEnvelope[];
  }> {
    return invokeOrFetch(
      'update_credentials',
      { credentials },
      '/api/bridge/credentials',
      {
        method: 'POST',
        body: JSON.stringify({ credentials }),
      }
    );
  },

  async updateAutomationConfig(config: Partial<AutomationConfig>): Promise<{
    automation: AutomationConfig;
    ringBuffer: IpcEnvelope[];
  }> {
    return invokeOrFetch(
      'update_automation_config',
      { config },
      '/api/bridge/automation',
      {
        method: 'POST',
        body: JSON.stringify({ config }),
      }
    );
  },

  async triggerBpSimulation(teammateHoveredId = 53): Promise<BpSimulationResult> {
    return invokeOrFetch(
      'trigger_bp_simulation',
      { teammateHoveredId },
      '/api/bridge/simulate-bp',
      {
        method: 'POST',
        body: JSON.stringify({ teammateHoveredId }),
      }
    );
  },

  async injectRunePage(presetId: string): Promise<{
    success: boolean;
    message: string;
    ringBuffer: IpcEnvelope[];
  }> {
    return invokeOrFetch(
      'inject_lcu_rune_page',
      { presetId },
      '/api/bridge/inject-rune',
      {
        method: 'POST',
        body: JSON.stringify({ presetId }),
      }
    );
  },

  async broadcastLobbyChat(
    mode: ChatReportMode,
    lines: string[]
  ): Promise<{
    success: boolean;
    deliveredCount: number;
    throttleIntervalMs: number;
    ringBuffer: IpcEnvelope[];
  }> {
    return invokeOrFetch(
      'broadcast_lcu_lobby_chat',
      { mode, lines },
      '/api/bridge/broadcast-chat',
      {
        method: 'POST',
        body: JSON.stringify({ mode, lines }),
      }
    );
  },

  async executeAramBenchSwap(params: {
    action: 'REROLL' | 'MANUAL_SWAP' | 'ROLLBACK';
    currentChampionId: number;
    targetChampionId?: number;
    benchPoolIds: number[];
  }): Promise<AramSnipeResult> {
    return invokeOrFetch(
      'execute_lcu_aram_bench_swap',
      { ...params },
      '/api/bridge/aram-snipe',
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
  },

  async executeLootDisenchant(plan: LootDisenchantPlan): Promise<{
    success: boolean;
    craftedRecipesCount: number;
    blueEssenceAdded: number;
    orangeEssenceAdded: number;
    ringBuffer: IpcEnvelope[];
  }> {
    return invokeOrFetch(
      'execute_lcu_loot_batch_craft',
      { plan },
      '/api/bridge/loot-disenchant',
      {
        method: 'POST',
        body: JSON.stringify({ plan }),
      }
    );
  },

  async applyClientCosmetic(payload: ClientCosmeticPayload): Promise<{
    success: boolean;
    lcuEndpointsCalled: string[];
    ringBuffer: IpcEnvelope[];
  }> {
    return invokeOrFetch(
      'apply_lcu_cosmetic_spoof',
      { ...payload },
      '/api/bridge/cosmetic-spoof',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  async createCustomPracticeLobby(lobbyName: string, botCount: number): Promise<{
    success: boolean;
    lobbyId: string;
    message: string;
    ringBuffer: IpcEnvelope[];
  }> {
    return invokeOrFetch(
      'create_lcu_practice_lobby',
      { lobbyName, botCount },
      '/api/bridge/practice-lobby',
      {
        method: 'POST',
        body: JSON.stringify({ lobbyName, botCount }),
      }
    );
  },

  async addBlacklistEntry(
    entry: Omit<BlacklistEntry, 'createdAt'>
  ): Promise<{
    blacklist: BlacklistEntry[];
    scoutProfiles: SummonerScoutProfile[];
    ringBuffer: IpcEnvelope[];
  }> {
    return invokeOrFetch(
      'add_blacklist_entry',
      { entry },
      '/api/bridge/blacklist',
      {
        method: 'POST',
        body: JSON.stringify(entry),
      }
    );
  },

  async removeBlacklistEntry(puuid: string): Promise<{
    blacklist: BlacklistEntry[];
    scoutProfiles: SummonerScoutProfile[];
    ringBuffer: IpcEnvelope[];
  }> {
    return invokeOrFetch(
      'remove_blacklist_entry',
      { puuid },
      `/api/bridge/blacklist/${encodeURIComponent(puuid)}`,
      {
        method: 'DELETE',
      }
    );
  },

  async requestAiMatchReview(params: {
    matchId: string;
    persona: AiJudgePersona;
    players: SummonerScoutProfile[];
    throwPoints: ThrowPointEvidence[];
  }): Promise<AiJudgeReport> {
    return invokeOrFetch(
      'request_ai_match_review',
      { ...params },
      '/api/ai/match-review',
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
  },

  async querySpectatorSession(params: {
    targetSummoner: string;
    regionCode: string;
  }): Promise<SpectatorQueryResult> {
    return invokeOrFetch(
      'query_sgp_spectator_session',
      { ...params },
      '/api/bridge/spectator-query',
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
  },

  async launchLocalSpectator(params: {
    spectatorDomain: string;
    spectatorPort: number;
    encryptionKey: string;
    gameId: string;
    regionCode: string;
  }): Promise<SpectatorLaunchResult> {
    return invokeOrFetch(
      'launch_local_spectator_process',
      { ...params },
      '/api/bridge/launch-spectator',
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
  },

  async getExternalOverview(): Promise<{
    overview: ExternalMetaOverviewDto;
    ringBuffer: IpcEnvelope[];
  }> {
    return invokeOrFetch('get_external_overview', {}, '/api/external/overview');
  },

  async syncExternalData(): Promise<{
    overview: ExternalMetaOverviewDto;
    ringBuffer: IpcEnvelope[];
  }> {
    return invokeOrFetch('sync_external_data', {}, '/api/external/sync', {
      method: 'POST',
    });
  },

  async getExternalChampionBuild(
    championId: number,
    position?: string
  ): Promise<{
    detail: ExternalChampionBuildDetailDto;
    ringBuffer: IpcEnvelope[];
  }> {
    const query = position
      ? `?championId=${championId}&position=${encodeURIComponent(position)}`
      : `?championId=${championId}`;
    return invokeOrFetch(
      'get_external_champion_build',
      { championId, position },
      `/api/external/champion-build${query}`
    );
  },

  async injectCustomRunePage(customRunePage: {
    name: string;
    primaryStyleId: number;
    subStyleId: number;
    selectedPerkIds: number[];
    winRate?: number;
  }): Promise<{
    success: boolean;
    message: string;
    ringBuffer: IpcEnvelope[];
  }> {
    return invokeOrFetch(
      'inject_custom_lcu_rune_page',
      { customRunePage },
      '/api/bridge/inject-rune',
      {
        method: 'POST',
        body: JSON.stringify({ customRunePage }),
      }
    );
  },
};


