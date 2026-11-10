/**
 * NexusAkari Pro (v4) — Isomorphic Tauri 2 IPC & Web Gateway Client
 * Transparently routes typed commands to either:
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
  SummonerScoutProfile,
  ThrowPointEvidence,
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
  }> {
    return apiJson('/api/bridge/bootstrap');
  },

  async setGameflowPhase(phase: GameflowPhase): Promise<{
    status: TriChannelStatus;
    scoutProfiles: SummonerScoutProfile[];
    ringBuffer: IpcEnvelope[];
  }> {
    return apiJson('/api/bridge/phase', {
      method: 'POST',
      body: JSON.stringify({ phase }),
    });
  },

  async switchSgpRegion(regionCode: string): Promise<{
    status: TriChannelStatus;
    ringBuffer: IpcEnvelope[];
  }> {
    return apiJson('/api/bridge/region', {
      method: 'POST',
      body: JSON.stringify({ regionCode }),
    });
  },

  async updateCredentials(credentials: Partial<LcuRcuCredentials>): Promise<{
    status: TriChannelStatus;
    ringBuffer: IpcEnvelope[];
  }> {
    return apiJson('/api/bridge/credentials', {
      method: 'POST',
      body: JSON.stringify({ credentials }),
    });
  },

  async updateAutomationConfig(config: Partial<AutomationConfig>): Promise<{
    automation: AutomationConfig;
    ringBuffer: IpcEnvelope[];
  }> {
    return apiJson('/api/bridge/automation', {
      method: 'POST',
      body: JSON.stringify({ config }),
    });
  },

  async triggerBpSimulation(teammateHoveredId = 53): Promise<BpSimulationResult> {
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
    return apiJson('/api/ai/match-review', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },
};
