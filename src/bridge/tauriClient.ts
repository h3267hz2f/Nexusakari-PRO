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

async function apiJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || `Bridge HTTP Error ${response.status}`);
  }
  return response.json() as Promise<T>;
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
    if (isTauriNativeRuntime()) {
      const { tauriNativeEngine } = await import('./tauriNativeEngine');
      return tauriNativeEngine.getBootstrapState();
    }
    return apiJson('/api/bridge/bootstrap');
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
    if (isTauriNativeRuntime()) {
      const { tauriNativeEngine } = await import('./tauriNativeEngine');
      return tauriNativeEngine.probeLiveClient();
    }
    return apiJson('/api/bridge/probe-live-client', { method: 'POST' });
  },

  async setGameflowPhase(phase: GameflowPhase): Promise<{
    status: TriChannelStatus;
    scoutProfiles: SummonerScoutProfile[];
    matchTimeline?: TimelineMinutePoint[];
    ringBuffer: IpcEnvelope[];
  }> {
    if (isTauriNativeRuntime()) {
      const { tauriNativeEngine } = await import('./tauriNativeEngine');
      return tauriNativeEngine.setGameflowPhase(phase);
    }
    return apiJson('/api/bridge/phase', {
      method: 'POST',
      body: JSON.stringify({ phase }),
    });
  },

  async switchSgpRegion(regionCode: string): Promise<{
    status: TriChannelStatus;
    ringBuffer: IpcEnvelope[];
  }> {
    if (isTauriNativeRuntime()) {
      const { tauriNativeEngine } = await import('./tauriNativeEngine');
      return tauriNativeEngine.switchSgpRegion(regionCode);
    }
    return apiJson('/api/bridge/region', {
      method: 'POST',
      body: JSON.stringify({ regionCode }),
    });
  },

  async updateCredentials(credentials: Partial<LcuRcuCredentials>): Promise<{
    status: TriChannelStatus;
    scoutProfiles?: SummonerScoutProfile[];
    lootShards?: LootItemShard[];
    matchTimeline?: TimelineMinutePoint[];
    ringBuffer: IpcEnvelope[];
  }> {
    if (isTauriNativeRuntime()) {
      const { tauriNativeEngine } = await import('./tauriNativeEngine');
      return tauriNativeEngine.updateCredentials(credentials);
    }
    return apiJson('/api/bridge/credentials', {
      method: 'POST',
      body: JSON.stringify({ credentials }),
    });
  },

  async updateAutomationConfig(config: Partial<AutomationConfig>): Promise<{
    automation: AutomationConfig;
    ringBuffer: IpcEnvelope[];
  }> {
    if (isTauriNativeRuntime()) {
      const { tauriNativeEngine } = await import('./tauriNativeEngine');
      return tauriNativeEngine.updateAutomationConfig(config);
    }
    return apiJson('/api/bridge/automation', {
      method: 'POST',
      body: JSON.stringify({ config }),
    });
  },

  async triggerBpSimulation(teammateHoveredId = 53): Promise<BpSimulationResult> {
    if (isTauriNativeRuntime()) {
      const { tauriNativeEngine } = await import('./tauriNativeEngine');
      return tauriNativeEngine.triggerBpSimulation(teammateHoveredId);
    }
    return apiJson('/api/bridge/simulate-bp', {
      method: 'POST',
      body: JSON.stringify({ teammateHoveredId }),
    });
  },

  async injectRunePage(presetId: string): Promise<{
    success: boolean;
    message: string;
    ringBuffer: IpcEnvelope[];
  }> {
    if (isTauriNativeRuntime()) {
      const { tauriNativeEngine } = await import('./tauriNativeEngine');
      return tauriNativeEngine.injectRunePage(presetId);
    }
    return apiJson('/api/bridge/inject-rune', {
      method: 'POST',
      body: JSON.stringify({ presetId }),
    });
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
    if (isTauriNativeRuntime()) {
      const { tauriNativeEngine } = await import('./tauriNativeEngine');
      return tauriNativeEngine.broadcastLobbyChat(mode, lines);
    }
    return apiJson('/api/bridge/broadcast-chat', {
      method: 'POST',
      body: JSON.stringify({ mode, lines }),
    });
  },

  async executeAramBenchSwap(params: {
    action: 'REROLL' | 'MANUAL_SWAP' | 'ROLLBACK';
    currentChampionId: number;
    targetChampionId?: number;
    benchPoolIds: number[];
  }): Promise<AramSnipeResult> {
    if (isTauriNativeRuntime()) {
      const { tauriNativeEngine } = await import('./tauriNativeEngine');
      return tauriNativeEngine.executeAramBenchSwap(params);
    }
    return apiJson('/api/bridge/aram-snipe', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async executeLootDisenchant(plan: LootDisenchantPlan): Promise<{
    success: boolean;
    craftedRecipesCount: number;
    blueEssenceAdded: number;
    orangeEssenceAdded: number;
    ringBuffer: IpcEnvelope[];
  }> {
    if (isTauriNativeRuntime()) {
      const { tauriNativeEngine } = await import('./tauriNativeEngine');
      return tauriNativeEngine.executeLootDisenchant(plan);
    }
    return apiJson('/api/bridge/loot-disenchant', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    });
  },

  async applyClientCosmetic(payload: ClientCosmeticPayload): Promise<{
    success: boolean;
    lcuEndpointsCalled: string[];
    ringBuffer: IpcEnvelope[];
  }> {
    if (isTauriNativeRuntime()) {
      const { tauriNativeEngine } = await import('./tauriNativeEngine');
      return tauriNativeEngine.applyClientCosmetic(payload);
    }
    return apiJson('/api/bridge/cosmetic-spoof', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async createCustomPracticeLobby(lobbyName: string, botCount: number): Promise<{
    success: boolean;
    lobbyId: string;
    message: string;
    ringBuffer: IpcEnvelope[];
  }> {
    if (isTauriNativeRuntime()) {
      const { tauriNativeEngine } = await import('./tauriNativeEngine');
      return tauriNativeEngine.createCustomPracticeLobby(lobbyName, botCount);
    }
    return apiJson('/api/bridge/practice-lobby', {
      method: 'POST',
      body: JSON.stringify({ lobbyName, botCount }),
    });
  },

  async addBlacklistEntry(
    entry: Omit<BlacklistEntry, 'createdAt'>
  ): Promise<{
    blacklist: BlacklistEntry[];
    scoutProfiles: SummonerScoutProfile[];
    ringBuffer: IpcEnvelope[];
  }> {
    if (isTauriNativeRuntime()) {
      const { tauriNativeEngine } = await import('./tauriNativeEngine');
      return tauriNativeEngine.addBlacklistEntry(entry);
    }
    return apiJson('/api/bridge/blacklist', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  },

  async removeBlacklistEntry(puuid: string): Promise<{
    blacklist: BlacklistEntry[];
    scoutProfiles: SummonerScoutProfile[];
    ringBuffer: IpcEnvelope[];
  }> {
    if (isTauriNativeRuntime()) {
      const { tauriNativeEngine } = await import('./tauriNativeEngine');
      return tauriNativeEngine.removeBlacklistEntry(puuid);
    }
    return apiJson(`/api/bridge/blacklist/${encodeURIComponent(puuid)}`, {
      method: 'DELETE',
    });
  },

  async requestAiMatchReview(params: {
    matchId: string;
    persona: AiJudgePersona;
    players: SummonerScoutProfile[];
    throwPoints: ThrowPointEvidence[];
  }): Promise<AiJudgeReport> {
    if (isTauriNativeRuntime()) {
      const { tauriNativeEngine } = await import('./tauriNativeEngine');
      return tauriNativeEngine.requestAiMatchReview(params);
    }
    return apiJson('/api/ai/match-review', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async querySpectatorSession(params: {
    targetSummoner: string;
    regionCode: string;
  }): Promise<SpectatorQueryResult> {
    if (isTauriNativeRuntime()) {
      const { tauriNativeEngine } = await import('./tauriNativeEngine');
      return tauriNativeEngine.querySpectatorSession(params);
    }
    return apiJson('/api/bridge/spectator-query', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async launchLocalSpectator(params: {
    spectatorDomain: string;
    spectatorPort: number;
    encryptionKey: string;
    gameId: string;
    regionCode: string;
  }): Promise<SpectatorLaunchResult> {
    if (isTauriNativeRuntime()) {
      const { tauriNativeEngine } = await import('./tauriNativeEngine');
      return tauriNativeEngine.launchLocalSpectator(params);
    }
    return apiJson('/api/bridge/launch-spectator', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async getExternalOverview(): Promise<{
    overview: ExternalMetaOverviewDto;
    ringBuffer: IpcEnvelope[];
  }> {
    if (isTauriNativeRuntime()) {
      const { tauriNativeEngine } = await import('./tauriNativeEngine');
      return tauriNativeEngine.getExternalOverview(false);
    }
    return apiJson('/api/external/overview');
  },

  async syncExternalData(): Promise<{
    overview: ExternalMetaOverviewDto;
    ringBuffer: IpcEnvelope[];
  }> {
    if (isTauriNativeRuntime()) {
      const { tauriNativeEngine } = await import('./tauriNativeEngine');
      return tauriNativeEngine.getExternalOverview(true);
    }
    return apiJson('/api/external/sync', { method: 'POST' });
  },

  async getExternalChampionBuild(
    championId: number,
    position?: string
  ): Promise<{
    detail: ExternalChampionBuildDetailDto;
    ringBuffer: IpcEnvelope[];
  }> {
    if (isTauriNativeRuntime()) {
      const { tauriNativeEngine } = await import('./tauriNativeEngine');
      return tauriNativeEngine.getExternalChampionBuild(championId, position);
    }
    const query = position
      ? `?championId=${championId}&position=${encodeURIComponent(position)}`
      : `?championId=${championId}`;
    return apiJson(`/api/external/champion-build${query}`);
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
    if (isTauriNativeRuntime()) {
      const { tauriNativeEngine } = await import('./tauriNativeEngine');
      return tauriNativeEngine.injectCustomRunePage(customRunePage);
    }
    return apiJson('/api/bridge/inject-rune', {
      method: 'POST',
      body: JSON.stringify({ customRunePage }),
    });
  },
};



