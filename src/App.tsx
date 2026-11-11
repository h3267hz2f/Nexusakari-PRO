/**
 * NexusAkari Pro (v4) — Main Application Shell
 * Synthesizes LeagueAkari, wnzzer/rank-analysis, Seraphine, Frank, and LeaguePrank
 * into a unified Rust + Tauri 2 + React 19 tactical dark glass workspace.
 */

import React, { useEffect, useState } from 'react';
import {
  AramSnipeResult,
  BpSimulationResult,
  ClientCosmeticPayload,
  tauriBridgeClient,
} from './bridge/tauriClient';
import { AramArenaWorkspace } from './components/AramArenaWorkspace';
import { ClientToolkitWorkspace } from './components/ClientToolkitWorkspace';
import { LeftTelemetryRail } from './components/LeftTelemetryRail';
import { MatchAnalyticsWorkspace } from './components/MatchAnalyticsWorkspace';
import { SmartBpWorkspace } from './components/SmartBpWorkspace';
import { TauriKernelInspector } from './components/TauriKernelInspector';
import { TopBar, WorkspaceTabId } from './components/TopBar';
import {
  buildHydratedScoutProfiles,
  INITIAL_AUTOMATION_CONFIG,
  INITIAL_BLACKLIST_LEDGER,
  INITIAL_IPC_RING_BUFFER,
  INITIAL_TRI_CHANNEL_STATUS,
  LOOT_SHARDS_INVENTORY,
  MATCH_TIMELINE_FIXTURE,
} from './core/telemetryFixtures';
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
} from './core/types';

export function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTabId>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') as WorkspaceTabId | null;
      if (
        tabParam &&
        [
          'smart-bp',
          'match-analytics',
          'aram-arena',
          'client-toolkit',
          'tauri-kernel',
        ].includes(tabParam)
      ) {
        return tabParam;
      }
    }
    return 'smart-bp';
  });

  const [status, setStatus] = useState<TriChannelStatus>(INITIAL_TRI_CHANNEL_STATUS);
  const [automation, setAutomation] = useState<AutomationConfig>(
    INITIAL_AUTOMATION_CONFIG
  );
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>(
    INITIAL_BLACKLIST_LEDGER
  );
  const [ringBuffer, setRingBuffer] = useState<IpcEnvelope[]>(
    INITIAL_IPC_RING_BUFFER
  );
  const [scoutProfiles, setScoutProfiles] = useState<SummonerScoutProfile[]>(() =>
    buildHydratedScoutProfiles(INITIAL_BLACKLIST_LEDGER)
  );
  const [lootShards, setLootShards] = useState<LootItemShard[]>(
    LOOT_SHARDS_INVENTORY
  );
  const [matchTimeline, setMatchTimeline] = useState<TimelineMinutePoint[]>(
    MATCH_TIMELINE_FIXTURE
  );
  const [selectedPlayerPuuid, setSelectedPlayerPuuid] = useState<string | null>(
    () => buildHydratedScoutProfiles(INITIAL_BLACKLIST_LEDGER)[0]?.puuid ?? null
  );

  // Hydrate from Express / Tauri 2 Bridge on mount
  useEffect(() => {
    let mounted = true;
    tauriBridgeClient
      .getBootstrapState()
      .then((res) => {
        if (!mounted) return;
        setStatus(res.status);
        setAutomation(res.automation);
        setBlacklist(res.blacklist);
        setRingBuffer(res.ringBuffer);
        setScoutProfiles(res.scoutProfiles);
        if (res.lootShards && res.lootShards.length > 0) {
          setLootShards(res.lootShards);
        }
        if (res.matchTimeline && res.matchTimeline.length > 0) {
          setMatchTimeline(res.matchTimeline);
        }
      })
      .catch(() => {
        // Fallback to deterministic initial fixtures if offline
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Automatically poll live LCU state every 3.5s when connected to a real LeagueClientUx.exe
  useEffect(() => {
    if (status.mode !== 'tauri-native') return;
    const timer = window.setInterval(() => {
      tauriBridgeClient
        .getBootstrapState()
        .then((res) => {
          setStatus(res.status);
          setRingBuffer(res.ringBuffer);
          setScoutProfiles(res.scoutProfiles);
          if (res.lootShards && res.lootShards.length > 0) {
            setLootShards(res.lootShards);
          }
          if (res.matchTimeline && res.matchTimeline.length > 0) {
            setMatchTimeline(res.matchTimeline);
          }
        })
        .catch(() => {
          // Ignore transient polling errors
        });
    }, 3500);
    return () => window.clearInterval(timer);
  }, [status.mode]);

  const handleProbeLiveClient = async (): Promise<{
    connected: boolean;
    message: string;
  }> => {
    try {
      const res = await tauriBridgeClient.probeLiveClient();
      setStatus(res.status);
      setScoutProfiles(res.scoutProfiles);
      if (res.lootShards && res.lootShards.length > 0) {
        setLootShards(res.lootShards);
      }
      if (res.matchTimeline && res.matchTimeline.length > 0) {
        setMatchTimeline(res.matchTimeline);
      }
      setRingBuffer(res.ringBuffer);
      return { connected: res.connected, message: res.message };
    } catch {
      return {
        connected: false,
        message: '本地桥接网关未响应，当前维持全真排位复盘沙箱模式',
      };
    }
  };

  const handlePhaseChange = async (phase: GameflowPhase) => {
    try {
      const res = await tauriBridgeClient.setGameflowPhase(phase);
      setStatus(res.status);
      setScoutProfiles(res.scoutProfiles);
      if (res.matchTimeline && res.matchTimeline.length > 0) {
        setMatchTimeline(res.matchTimeline);
      }
      setRingBuffer(res.ringBuffer);
    } catch {
      setStatus((prev) => ({ ...prev, gameflowPhase: phase }));
    }
  };

  const handleToggleInGameUnlock = () => {
    const nextPhase =
      status.gameflowPhase === GameflowPhase.IN_PROGRESS ||
      status.gameflowPhase === GameflowPhase.END_OF_GAME
        ? GameflowPhase.CHAMP_SELECT
        : GameflowPhase.IN_PROGRESS;
    void handlePhaseChange(nextPhase);
  };

  const handleRegionChange = async (regionCode: string) => {
    try {
      const res = await tauriBridgeClient.switchSgpRegion(regionCode);
      setStatus(res.status);
      setRingBuffer(res.ringBuffer);
    } catch {
      setStatus((prev) => ({ ...prev, activeRegion: regionCode }));
    }
  };

  const handleUpdateCredentials = async (creds: Partial<LcuRcuCredentials>) => {
    try {
      const res = await tauriBridgeClient.updateCredentials(creds);
      setStatus(res.status);
      if (res.scoutProfiles && res.scoutProfiles.length > 0) {
        setScoutProfiles(res.scoutProfiles);
      }
      if (res.lootShards && res.lootShards.length > 0) {
        setLootShards(res.lootShards);
      }
      if (res.matchTimeline && res.matchTimeline.length > 0) {
        setMatchTimeline(res.matchTimeline);
      }
      setRingBuffer(res.ringBuffer);
    } catch {
      setStatus((prev) => ({
        ...prev,
        credentials: { ...prev.credentials, ...creds },
      }));
    }
  };

  const handleUpdateAutomation = async (patch: Partial<AutomationConfig>) => {
    setAutomation((prev) => ({ ...prev, ...patch }));
    try {
      const res = await tauriBridgeClient.updateAutomationConfig(patch);
      setAutomation(res.automation);
      setRingBuffer(res.ringBuffer);
    } catch {
      // Optimistic state already applied
    }
  };

  const handleRunBpSimulation = async (
    teammateHoveredId: number
  ): Promise<BpSimulationResult> => {
    const res = await tauriBridgeClient.triggerBpSimulation(teammateHoveredId);
    setRingBuffer(res.ringBufferUpdated);
    return res;
  };

  const handleInjectRunePage = async (presetId: string): Promise<string> => {
    const res = await tauriBridgeClient.injectRunePage(presetId);
    setRingBuffer(res.ringBuffer);
    return res.message;
  };

  const handleBroadcastChat = async (
    mode: ChatReportMode,
    lines: string[]
  ): Promise<number> => {
    const res = await tauriBridgeClient.broadcastLobbyChat(mode, lines);
    setRingBuffer(res.ringBuffer);
    return res.deliveredCount;
  };

  const handleInspectPlayerInAnalytics = (puuid: string) => {
    setSelectedPlayerPuuid(puuid);
    setActiveTab('match-analytics');
  };

  const handleAddBlacklistEntry = async (
    entry: Omit<BlacklistEntry, 'createdAt'>
  ) => {
    const res = await tauriBridgeClient.addBlacklistEntry(entry);
    setBlacklist(res.blacklist);
    setScoutProfiles(res.scoutProfiles);
    setRingBuffer(res.ringBuffer);
  };

  const handleRemoveBlacklistEntry = async (puuid: string) => {
    const res = await tauriBridgeClient.removeBlacklistEntry(puuid);
    setBlacklist(res.blacklist);
    setScoutProfiles(res.scoutProfiles);
    setRingBuffer(res.ringBuffer);
  };

  const handleRequestAiJudge = async (
    persona: AiJudgePersona,
    throwPoints: ThrowPointEvidence[]
  ): Promise<AiJudgeReport> => {
    return tauriBridgeClient.requestAiMatchReview({
      matchId: 'HN1-784512098',
      persona,
      players: scoutProfiles,
      throwPoints,
    });
  };

  const handleExecuteAramSwap = async (params: {
    action: 'REROLL' | 'MANUAL_SWAP' | 'ROLLBACK';
    currentChampionId: number;
    targetChampionId?: number;
    benchPoolIds: number[];
  }): Promise<AramSnipeResult> => {
    const res = await tauriBridgeClient.executeAramBenchSwap(params);
    setRingBuffer(res.ringBufferUpdated);
    return res;
  };

  const handleExecuteLootDisenchant = async (plan: LootDisenchantPlan) => {
    const res = await tauriBridgeClient.executeLootDisenchant(plan);
    setRingBuffer(res.ringBuffer);
    return {
      craftedRecipesCount: res.craftedRecipesCount,
      blueEssenceAdded: res.blueEssenceAdded,
      orangeEssenceAdded: res.orangeEssenceAdded,
    };
  };

  const handleApplyClientCosmetic = async (
    payload: ClientCosmeticPayload
  ): Promise<string[]> => {
    const res = await tauriBridgeClient.applyClientCosmetic(payload);
    setRingBuffer(res.ringBuffer);
    return res.lcuEndpointsCalled;
  };

  const handleCreatePracticeLobby = async (
    lobbyName: string,
    botCount: number
  ) => {
    const res = await tauriBridgeClient.createCustomPracticeLobby(
      lobbyName,
      botCount
    );
    setRingBuffer(res.ringBuffer);
    return { lobbyId: res.lobbyId, message: res.message };
  };

  return (
    <div id="top" className="min-h-screen flex flex-col bg-[#090D16] text-slate-100">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        gameflowPhase={status.gameflowPhase}
        onToggleInGameUnlock={handleToggleInGameUnlock}
      />

      <div className="flex-1 flex flex-col lg:flex-row">
        <LeftTelemetryRail
          status={status}
          blacklistCount={blacklist.length}
          onPhaseChange={handlePhaseChange}
          onRegionChange={handleRegionChange}
          onUpdateCredentials={handleUpdateCredentials}
          onProbeLiveClient={handleProbeLiveClient}
        />

        <main className="flex-1 min-w-0 p-6 overflow-y-auto">
          {activeTab === 'smart-bp' && (
            <SmartBpWorkspace
              scoutProfiles={scoutProfiles}
              automation={automation}
              blacklist={blacklist}
              gameflowPhase={status.gameflowPhase}
              onUpdateAutomation={handleUpdateAutomation}
              onRunBpSimulation={handleRunBpSimulation}
              onInjectRunePage={handleInjectRunePage}
              onBroadcastChat={handleBroadcastChat}
              onToggleInGameUnlock={handleToggleInGameUnlock}
              onInspectPlayerInAnalytics={handleInspectPlayerInAnalytics}
            />
          )}

          {activeTab === 'match-analytics' && (
            <MatchAnalyticsWorkspace
              scoutProfiles={scoutProfiles}
              matchTimeline={matchTimeline}
              blacklist={blacklist}
              activeRegion={status.activeRegion}
              selectedPlayerPuuid={selectedPlayerPuuid}
              onSelectPlayerPuuid={setSelectedPlayerPuuid}
              onAddBlacklistEntry={handleAddBlacklistEntry}
              onRemoveBlacklistEntry={handleRemoveBlacklistEntry}
              onRequestAiJudge={handleRequestAiJudge}
            />
          )}

          {activeTab === 'aram-arena' && (
            <AramArenaWorkspace
              automation={automation}
              onUpdateAutomation={handleUpdateAutomation}
              onExecuteAramSwap={handleExecuteAramSwap}
            />
          )}

          {activeTab === 'client-toolkit' && (
            <ClientToolkitWorkspace
              scoutProfiles={scoutProfiles}
              lootShards={lootShards}
              activeRegion={status.activeRegion}
              installDirectory={status.credentials.installDirectory}
              onExecuteLootDisenchant={handleExecuteLootDisenchant}
              onApplyClientCosmetic={handleApplyClientCosmetic}
              onCreatePracticeLobby={handleCreatePracticeLobby}
            />
          )}

          {activeTab === 'tauri-kernel' && (
            <TauriKernelInspector status={status} ringBuffer={ringBuffer} />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
