/**
 * NexusAkari Pro (v4) — Smart BP, Team Comp Diagnosis, Dodge EV,
 * Anti-Censorship Chat Broadcaster & Two-Stage 10-Player SGP Scout Workspace
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  BpSimulationResult,
  ExternalChampionBuildDetailDto,
  tauriBridgeClient,
} from '../bridge/tauriClient';
import {
  ALL_CHAMPIONS_SORTED,
  buildAdaptiveRunePresetForChampion,
  FULL_CHAMPION_CATALOG,
} from '../core/championCatalog';
import {
  calculateDodgeExpectedValue,
  detectPremadeSquads,
  diagnoseTeamComposition,
  formatAntiFilterLobbyChat,
} from '../core/mathEngine';
import { RUNE_PAGE_PRESETS } from '../core/telemetryFixtures';
import {
  AutomationConfig,
  BlacklistEntry,
  ChatReportMode,
  GameflowPhase,
  SummonerScoutProfile,
  TagPolarity,
} from '../core/types';

interface SmartBpWorkspaceProps {
  scoutProfiles: SummonerScoutProfile[];
  automation: AutomationConfig;
  blacklist: BlacklistEntry[];
  gameflowPhase: GameflowPhase;
  onUpdateAutomation: (patch: Partial<AutomationConfig>) => void;
  onRunBpSimulation: (teammateHoveredId: number) => Promise<BpSimulationResult>;
  onInjectRunePage: (presetId: string) => Promise<string>;
  onInjectCustomRunePage?: (customPage: {
    name: string;
    primaryStyleId: number;
    subStyleId: number;
    selectedPerkIds: number[];
    winRate?: number;
  }) => Promise<string>;
  onBroadcastChat: (mode: ChatReportMode, lines: string[]) => Promise<number>;
  onToggleInGameUnlock: () => void;
  onInspectPlayerInAnalytics: (puuid: string) => void;
}

type ScoutFilterMode = 'ALL' | 'CARRY_ONLY' | 'HAZARD_ONLY' | 'PREMADE_ONLY' | 'BLACKLIST_ONLY';

const HOVER_CANDIDATES = [
  { id: 53, name: '布里茨 (命中5楼预选·触发防误Ban)' },
  { id: 412, name: '锤石 (无冲突·正常Ban首选)' },
  { id: 897, name: '奎桑提 (命中第2顺位Ban)' },
];

export const SmartBpWorkspace: React.FC<SmartBpWorkspaceProps> = ({
  scoutProfiles,
  automation,
  blacklist,
  gameflowPhase,
  onUpdateAutomation,
  onRunBpSimulation,
  onInjectRunePage,
  onInjectCustomRunePage,
  onBroadcastChat,
  onToggleInGameUnlock,
  onInspectPlayerInAnalytics,
}) => {
  const [dodgeCountToday, setDodgeCountToday] = useState<number>(0);
  const [champSearchQuery, setChampSearchQuery] = useState<string>('');
  const [selectedTeammateHoverId, setSelectedTeammateHoverId] = useState<number>(53);
  const [bpDrillResult, setBpDrillResult] = useState<BpSimulationResult | null>(null);
  const [selectedRunePresetId, setSelectedRunePresetId] = useState<string>(RUNE_PAGE_PRESETS[0].id);
  const [runeStatusMessage, setRuneStatusMessage] = useState<string | null>(null);

  const [chatMode, setChatMode] = useState<ChatReportMode>(ChatReportMode.FULL_TEAM_BRIEF);
  const [enableZeroWidthObfuscation, setEnableZeroWidthObfuscation] = useState<boolean>(true);
  const [chatDeliveredNotice, setChatDeliveredNotice] = useState<string | null>(null);

  const [scoutFilter, setScoutFilter] = useState<ScoutFilterMode>('ALL');
  const [hoveredPremadeId, setHoveredPremadeId] = useState<string | null>(null);

  const [externalChampId, setExternalChampId] = useState<number>(
    automation.primaryPickChampionIds[0] ?? 266
  );
  const [externalPosition, setExternalPosition] = useState<
    'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT' | 'ARAM'
  >('TOP');
  const [externalBuild, setExternalBuild] =
    useState<ExternalChampionBuildDetailDto | null>(null);
  const [selectedOpggRuneIndex, setSelectedOpggRuneIndex] = useState<number>(0);
  const [loadingExternalBuild, setLoadingExternalBuild] = useState<boolean>(false);

  const roleToExternalPos = (
    role?: string
  ): 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT' => {
    if (role === 'TOP') return 'TOP';
    if (role === 'JGL' || role === 'JUNGLE') return 'JUNGLE';
    if (role === 'ADC') return 'ADC';
    if (role === 'SUP' || role === 'SUPPORT') return 'SUPPORT';
    return 'MID';
  };

  useEffect(() => {
    let cancelled = false;
    setLoadingExternalBuild(true);
    tauriBridgeClient
      .getExternalChampionBuild(externalChampId, externalPosition)
      .then((res) => {
        if (!cancelled) {
          setExternalBuild(res.detail);
          setSelectedOpggRuneIndex(0);
        }
      })
      .catch(() => {
        // Keep existing state on transient error
      })
      .finally(() => {
        if (!cancelled) setLoadingExternalBuild(false);
      });
    return () => {
      cancelled = true;
    };
  }, [externalChampId, externalPosition]);

  const filteredCatalogChampions = useMemo(() => {
    const q = champSearchQuery.trim().toLowerCase();
    if (!q) return ALL_CHAMPIONS_SORTED;
    return ALL_CHAMPIONS_SORTED.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        String(c.id).includes(q) ||
        c.primaryRole.toLowerCase().includes(q)
    );
  }, [champSearchQuery]);

  const buildSelectListWithCurrent = (currentId: number) => {
    const exists = filteredCatalogChampions.some((c) => c.id === currentId);
    if (exists) return filteredCatalogChampions;
    const currentEntry = FULL_CHAMPION_CATALOG[currentId];
    return currentEntry
      ? [currentEntry, ...filteredCatalogChampions]
      : filteredCatalogChampions;
  };

  const allies = useMemo(
    () => scoutProfiles.filter((p) => p.teamSide === 'ALLY'),
    [scoutProfiles]
  );
  const enemies = useMemo(
    () => scoutProfiles.filter((p) => p.teamSide === 'ENEMY'),
    [scoutProfiles]
  );

  const compDiagnosis = useMemo(() => diagnoseTeamComposition(allies), [allies]);
  const dodgeEv = useMemo(
    () => calculateDodgeExpectedValue(allies, compDiagnosis, blacklist, dodgeCountToday),
    [allies, compDiagnosis, blacklist, dodgeCountToday]
  );

  const { premadeGroups, rivalries } = useMemo(
    () => detectPremadeSquads(scoutProfiles),
    [scoutProfiles]
  );

  const chatPreviewLines = useMemo(
    () => formatAntiFilterLobbyChat(allies, chatMode, enableZeroWidthObfuscation),
    [allies, chatMode, enableZeroWidthObfuscation]
  );

  const selectedRunePreset = useMemo(() => {
    if (selectedRunePresetId.startsWith('auto-champ-')) {
      const champId =
        Number.parseInt(selectedRunePresetId.replace('auto-champ-', ''), 10) || 203;
      return buildAdaptiveRunePresetForChampion(champId);
    }
    return (
      RUNE_PAGE_PRESETS.find((r) => r.id === selectedRunePresetId) ?? RUNE_PAGE_PRESETS[0]
    );
  }, [selectedRunePresetId]);

  const handleTriggerBpDrill = async () => {
    const res = await onRunBpSimulation(selectedTeammateHoverId);
    setBpDrillResult(res);
  };

  const handleInjectRune = async () => {
    const activeOpggRune =
      externalBuild?.runeBuilds?.[selectedOpggRuneIndex] ??
      externalBuild?.runeBuilds?.[0];
    if (activeOpggRune && activeOpggRune.selectedPerkIds.length >= 6) {
      const payload = {
        name: activeOpggRune.name,
        primaryStyleId: activeOpggRune.primaryStyleId,
        subStyleId: activeOpggRune.subStyleId,
        selectedPerkIds: activeOpggRune.selectedPerkIds,
        winRate: activeOpggRune.winRate,
      };
      if (onInjectCustomRunePage) {
        const msg = await onInjectCustomRunePage(payload);
        setRuneStatusMessage(msg);
      } else {
        const res = await tauriBridgeClient.injectCustomRunePage(payload);
        setRuneStatusMessage(res.message);
      }
      return;
    }
    const fallbackPresetId = selectedRunePresetId.startsWith('auto-champ-')
      ? selectedRunePresetId
      : `auto-champ-${externalChampId}`;
    const msg = await onInjectRunePage(fallbackPresetId);
    setRuneStatusMessage(msg);
  };

  const handleSendChat = async () => {
    const count = await onBroadcastChat(chatMode, chatPreviewLines);
    setChatDeliveredNotice(
      `已按 350ms/行 防禁言节流向选人聊天室投递 ${count} 行战术简报（零宽脱敏 ${
        enableZeroWidthObfuscation ? '已开启' : '关闭'
      }）`
    );
  };

  const filterPlayers = (list: SummonerScoutProfile[]) => {
    return list.filter((p) => {
      if (scoutFilter === 'CARRY_ONLY') {
        return p.averageRpi >= 70 || p.tags.some((t) => t.polarity === TagPolarity.CARRY);
      }
      if (scoutFilter === 'HAZARD_ONLY') {
        return p.averageRpi <= 45 || p.tags.some((t) => t.polarity === TagPolarity.HAZARD);
      }
      if (scoutFilter === 'PREMADE_ONLY') {
        return Boolean(p.premadeGroupId);
      }
      if (scoutFilter === 'BLACKLIST_ONLY') {
        return p.tags.some(
          (t) => t.id === 'BLACKLIST_HIT' || t.id === 'FOLLOW_CARRY_HIT'
        );
      }
      return true;
    });
  };

  const filteredAllies = filterPlayers(allies);
  const filteredEnemies = filterPlayers(enemies);

  return (
    <div className="space-y-6">
      {/* Row 1: Team Composition 3D Damage Entropy Diagnosis & Ranked Dodge EV Decision Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 7 Cols: 3D Damage Composition & Tactical Ratings */}
        <section className="lg:col-span-7 p-5 rounded-xl bg-gray-900/90 border border-slate-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-base font-bold text-slate-100">
                  01. 己方阵容三维伤害构成与控制链诊断仪
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  基于香农信息熵评估物理 / 魔法 / 真实伤害分布，预防纯菜刀队或纯AP阵容被针对性护甲/魔抗锁死
                </p>
              </div>
              <div className="text-right shrink-0 font-mono tabular-nums">
                <span className="text-xs text-slate-400">阵容评级 · </span>
                <span className="text-lg font-bold text-sky-400">
                  {compDiagnosis.overallCompGrade} 级
                </span>
                <div className="text-[11px] text-slate-400">
                  伤害熵 H = {compDiagnosis.shannonEntropy} bits
                </div>
              </div>
            </div>

            {/* 3-Color Damage Ratio Bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs font-mono tabular-nums mb-1.5">
                <span className="text-amber-400">
                  物理伤害 (AD) {Math.round(compDiagnosis.physicalRatio * 100)}%
                </span>
                <span className="text-sky-400">
                  魔法伤害 (AP) {Math.round(compDiagnosis.magicRatio * 100)}%
                </span>
                <span className="text-slate-200">
                  真实伤害 (True) {Math.round(compDiagnosis.trueDamageRatio * 100)}%
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-950 overflow-hidden flex border border-slate-800">
                <div
                  style={{ width: `${Math.round(compDiagnosis.physicalRatio * 100)}%` }}
                  className="bg-amber-500 h-full transition-all"
                />
                <div
                  style={{ width: `${Math.round(compDiagnosis.magicRatio * 100)}%` }}
                  className="bg-sky-500 h-full transition-all"
                />
                <div
                  style={{ width: `${Math.round(compDiagnosis.trueDamageRatio * 100)}%` }}
                  className="bg-slate-200 h-full transition-all"
                />
              </div>
            </div>

            {/* 4 Tactical Dimension Metrics */}
            <div className="grid grid-cols-4 gap-3 mt-4 pt-3.5 border-t border-slate-800/80 font-mono tabular-nums">
              <div>
                <div className="text-[11px] text-slate-400">前排坦度指数</div>
                <div className="text-sm font-bold text-slate-100 mt-0.5">
                  {compDiagnosis.frontlineScore} / 100
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">先手控制链</div>
                <div className="text-sm font-bold text-slate-100 mt-0.5">
                  {compDiagnosis.engageCcScore} / 100
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">兵线清理效率</div>
                <div className="text-sm font-bold text-slate-100 mt-0.5">
                  {compDiagnosis.waveclearScore} / 100
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">后期大核缩放</div>
                <div className="text-sm font-bold text-emerald-400 mt-0.5">
                  {compDiagnosis.scalingScore} / 100
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-300">{compDiagnosis.tacticalAdvice}</span>
            <span className="font-mono tabular-nums text-slate-400 shrink-0 ml-3">
              宿敌撞车 {rivalries.length} 组
            </span>
          </div>
        </section>

        {/* Right 5 Cols: Ranked Dodge EV Decision Calculator */}
        <section className="lg:col-span-5 p-5 rounded-xl bg-gray-900/90 border border-slate-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold text-slate-100">
                  02. 排位秒退数学期望决策器 (Dodge EV)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  秒退仅扣表面胜点且隐藏分 MMR 损益恒为 0
                </p>
              </div>

              {/* Today's Dodge Count Selector */}
              <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
                {[0, 1, 2].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setDodgeCountToday(cnt)}
                    className={`px-2 py-1 text-xs font-mono tabular-nums rounded transition-colors whitespace-nowrap ${
                      dodgeCountToday === cnt
                        ? 'bg-sky-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    今日{cnt}次
                  </button>
                ))}
              </div>
            </div>

            <div
              className={`mt-3.5 p-3 rounded-lg border text-xs ${
                dodgeEv.shouldDodge
                  ? 'bg-rose-950/35 border-rose-500/50 text-rose-200'
                  : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
              }`}
            >
              <div className="font-bold text-sm">{dodgeEv.headlineVerdict}</div>
              <div className="mt-1.5 space-y-1 text-slate-300">
                {dodgeEv.reasoningSteps.map((step, i) => (
                  <p key={i} className="leading-relaxed">
                    {i + 1}. {step}
                  </p>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800/80 font-mono tabular-nums text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">预测我方胜率</span>
              <span className="text-slate-100 font-bold">
                {(dodgeEv.estimatedTeamWinProb * 100).toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">强打期望 LP</span>
              <span
                className={`font-bold ${
                  dodgeEv.expectedPlayLpDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {dodgeEv.expectedPlayLpDelta >= 0
                  ? `+${dodgeEv.expectedPlayLpDelta}`
                  : dodgeEv.expectedPlayLpDelta}{' '}
                LP
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">本次秒退成本</span>
              <span className="text-amber-400 font-bold">
                -{dodgeEv.dodgeLpPenalty} LP / {dodgeEv.dodgeLockoutMinutes}m
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* Row 2: Safe Automation FSM, Auto-Rune Injector & Lobby Chat Broadcaster */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Col 1-5: Safe Automation FSM & Anti-Friendly-Ban Drill */}
        <section className="lg:col-span-5 p-5 rounded-xl bg-gray-900/90 border border-slate-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-slate-100">
                03. 防误Ban拟人自动化状态机 (Safe Automation FSM)
              </h3>
              <span className="font-mono tabular-nums text-xs text-sky-400">
                抖动 {automation.humanizedJitterMinMs}~{automation.humanizedJitterMaxMs}ms
              </span>
            </div>

            <div className="mt-3.5 space-y-2.5 text-xs">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-slate-300">
                  自动接受对局 (防误触延迟 {automation.autoAcceptDelayMs}ms)
                </span>
                <input
                  type="checkbox"
                  checked={automation.autoAcceptEnabled}
                  onChange={(e) =>
                    onUpdateAutomation({ autoAcceptEnabled: e.target.checked })
                  }
                  className="accent-sky-500 w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-slate-300 font-medium">
                  队友预选防误 Ban 仲裁护栏 (championPickIntent 保护)
                </span>
                <input
                  type="checkbox"
                  checked={automation.protectTeammateIntentGuard}
                  onChange={(e) =>
                    onUpdateAutomation({ protectTeammateIntentGuard: e.target.checked })
                  }
                  className="accent-sky-500 w-4 h-4"
                />
              </label>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-slate-300">开启自动秒锁英雄</span>
                  <input
                    type="checkbox"
                    checked={automation.autoPickEnabled}
                    onChange={(e) =>
                      onUpdateAutomation({ autoPickEnabled: e.target.checked })
                    }
                    className="accent-sky-500 w-4 h-4"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-slate-300">开启自动禁用英雄</span>
                  <input
                    type="checkbox"
                    checked={automation.autoBanEnabled}
                    onChange={(e) =>
                      onUpdateAutomation({ autoBanEnabled: e.target.checked })
                    }
                    className="accent-sky-500 w-4 h-4"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-slate-400">掉线 5s 自动重连</span>
                  <input
                    type="checkbox"
                    checked={automation.autoReconnectEnabled}
                    onChange={(e) =>
                      onUpdateAutomation({ autoReconnectEnabled: e.target.checked })
                    }
                    className="accent-sky-500 w-4 h-4"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-slate-400">赛后秒跳过点赞回房</span>
                  <input
                    type="checkbox"
                    checked={automation.autoPlayAgainEnabled}
                    onChange={(e) =>
                      onUpdateAutomation({ autoPlayAgainEnabled: e.target.checked })
                    }
                    className="accent-sky-500 w-4 h-4"
                  />
                </label>
              </div>

              <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400">
                    全英雄库 ({ALL_CHAMPIONS_SORTED.length} 名英雄实时检索)：
                  </span>
                  <input
                    type="search"
                    value={champSearchQuery}
                    onChange={(e) => setChampSearchQuery(e.target.value)}
                    placeholder="搜英雄名/称号/ID (如: 梅尔, 800, 盲僧)..."
                    aria-label="检索169名英雄"
                    className="w-48 px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-[11px] text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      主选秒锁英雄
                    </label>
                    <select
                      aria-label="主选秒锁英雄"
                      value={automation.primaryPickChampionIds[0] ?? 203}
                      onChange={(e) => {
                        const chosenId = Number(e.target.value);
                        onUpdateAutomation({
                          primaryPickChampionIds: [
                            chosenId,
                            ...automation.primaryPickChampionIds.slice(1),
                          ],
                        });
                        setSelectedRunePresetId(`auto-champ-${chosenId}`);
                        setExternalChampId(chosenId);
                        const role = FULL_CHAMPION_CATALOG[chosenId]?.primaryRole;
                        if (role) setExternalPosition(roleToExternalPos(role));
                      }}
                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-100 text-xs"
                    >
                      {buildSelectListWithCurrent(
                        automation.primaryPickChampionIds[0] ?? 203
                      ).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}·{c.title} ({c.id})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      备选秒锁英雄
                    </label>
                    <select
                      aria-label="备选秒锁英雄"
                      value={automation.backupPickChampionIds[0] ?? 412}
                      onChange={(e) =>
                        onUpdateAutomation({
                          backupPickChampionIds: [Number(e.target.value)],
                        })
                      }
                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-100 text-xs"
                    >
                      {buildSelectListWithCurrent(
                        automation.backupPickChampionIds[0] ?? 412
                      ).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}·{c.title} ({c.id})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      首选禁用英雄
                    </label>
                    <select
                      aria-label="首选禁用英雄"
                      value={automation.banChampionIds[0] ?? 53}
                      onChange={(e) =>
                        onUpdateAutomation({
                          banChampionIds: [
                            Number(e.target.value),
                            automation.banChampionIds[1] ?? 897,
                            automation.banChampionIds[2] ?? 238,
                          ],
                        })
                      }
                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-100 text-xs"
                    >
                      {buildSelectListWithCurrent(automation.banChampionIds[0] ?? 53).map(
                        (c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}·{c.title} ({c.id})
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80">
                <label
                  htmlFor="teammate-hover-select"
                  className="block text-slate-400 mb-1"
                >
                  模拟 5 楼队友当前预选亮出英雄 (或立即执行一次真机 BP 检查)：
                </label>
                <div className="flex items-center gap-2">
                  <select
                    id="teammate-hover-select"
                    value={selectedTeammateHoverId}
                    onChange={(e) => setSelectedTeammateHoverId(Number(e.target.value))}
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-xs"
                  >
                    {HOVER_CANDIDATES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                    {ALL_CHAMPIONS_SORTED.filter(
                      (ch) => !HOVER_CANDIDATES.some((hc) => hc.id === ch.id)
                    ).map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.name} ({ch.title} · #{ch.id})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleTriggerBpDrill}
                    className="px-3.5 py-1.5 rounded-lg bg-sky-500 text-slate-950 font-semibold hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0"
                  >
                    触发 BP 仲裁演练
                  </button>
                </div>
              </div>
            </div>
          </div>

          {bpDrillResult ? (
            <div className="mt-3 p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono tabular-nums space-y-1 text-slate-300">
              {bpDrillResult.auditTrail.map((line, idx) => (
                <div key={idx} className="leading-snug">
                  {line}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-xs text-slate-400 font-mono tabular-nums">
              当前禁用队列：#{automation.banChampionIds.join(' -> #')} · 主选：#
              {automation.primaryPickChampionIds[0] ?? 203} (
              {FULL_CHAMPION_CATALOG[automation.primaryPickChampionIds[0] ?? 203]?.name ??
                '千珏'}
              )
            </div>
          )}
        </section>

        {/* Col 6-8: Live OP.GG + 169 Champion Auto-Rune & Core Build Hot Injector */}
        <section className="lg:col-span-3 p-5 rounded-xl bg-gray-900/90 border border-slate-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-bold text-slate-100">
                04. OP.GG 实时大数据符文与核心出装
              </h3>
              <button
                type="button"
                onClick={() => {
                  const activeChampId =
                    allies[0]?.currentChampionId ||
                    automation.primaryPickChampionIds[0] ||
                    266;
                  setExternalChampId(activeChampId);
                  setSelectedRunePresetId(`auto-champ-${activeChampId}`);
                }}
                className="text-[11px] text-sky-400 hover:text-sky-300 underline whitespace-nowrap"
              >
                同步当前英雄
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              直连 <code className="text-sky-400">lol-api-champion.op.gg</code> 翡翠+与大乱斗实时样本
            </p>

            {/* Champion + Position Selector */}
            <div className="grid grid-cols-3 gap-1.5 mt-2.5">
              <select
                aria-label="选择OP.GG实时查询英雄"
                value={externalChampId}
                onChange={(e) => {
                  const cid = Number(e.target.value);
                  setExternalChampId(cid);
                  setSelectedRunePresetId(`auto-champ-${cid}`);
                  const defRole = FULL_CHAMPION_CATALOG[cid]?.primaryRole;
                  if (defRole && externalPosition !== 'ARAM') {
                    setExternalPosition(roleToExternalPos(defRole));
                  }
                }}
                className="col-span-2 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-slate-100"
              >
                {ALL_CHAMPIONS_SORTED.map((c) => (
                  <option key={`opgg-c-${c.id}`} value={c.id}>
                    {c.name}·{c.title} (#{c.id})
                  </option>
                ))}
              </select>
              <select
                aria-label="选择OP.GG分路或大乱斗"
                value={externalPosition}
                onChange={(e) =>
                  setExternalPosition(
                    e.target.value as 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT' | 'ARAM'
                  )
                }
                className="px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-slate-100 font-mono"
              >
                <option value="TOP">TOP 上单</option>
                <option value="JUNGLE">JUG 打野</option>
                <option value="MID">MID 中单</option>
                <option value="ADC">ADC 下路</option>
                <option value="SUPPORT">SUP 辅助</option>
                <option value="ARAM">ARAM 乱斗</option>
              </select>
            </div>

            {externalBuild && (
              <div className="mt-2.5 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono tabular-nums px-2 py-1 rounded bg-slate-950 border border-slate-800/90">
                  <span className="text-sky-400 font-semibold">
                    {externalBuild.source === 'OPGG_LIVE'
                      ? `OP.GG KR v${externalBuild.patchVersion}`
                      : '本地自适应库'}
                    {' · '}
                    {externalBuild.tierLabel} (#{externalBuild.rank})
                  </span>
                  <span className="text-emerald-400">
                    胜率 {(externalBuild.winRate * 100).toFixed(2)}% ·{' '}
                    {externalBuild.samplePlayCount.toLocaleString()}场
                  </span>
                </div>

                {/* OP.GG Rune Page Build Selector */}
                {externalBuild.runeBuilds.length > 0 && (
                  <select
                    aria-label="切换OP.GG高胜率符文页分支"
                    value={selectedOpggRuneIndex}
                    onChange={(e) => setSelectedOpggRuneIndex(Number(e.target.value))}
                    className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-[11px] text-slate-100 font-mono"
                  >
                    {externalBuild.runeBuilds.map((rb, idx) => (
                      <option key={rb.id} value={idx}>
                        方案#{idx + 1}: {rb.perkNames[0]} ({(rb.winRate * 100).toFixed(1)}%胜率 ·{' '}
                        {rb.playCount.toLocaleString()}场)
                      </option>
                    ))}
                  </select>
                )}

                {(() => {
                  const activeRune =
                    externalBuild.runeBuilds[selectedOpggRuneIndex] ||
                    externalBuild.runeBuilds[0];
                  if (!activeRune) return null;
                  return (
                    <div className="p-2 rounded-lg bg-slate-950/90 border border-slate-800/80 text-[11px] space-y-1">
                      <div className="flex items-center justify-between font-mono tabular-nums text-slate-300">
                        <span>{activeRune.primaryStyleName}</span>
                        <span>+</span>
                        <span>{activeRune.subStyleName}</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-snug">
                        {activeRune.perkNames.join(' · ')}
                      </p>
                      <div className="text-[10px] font-mono tabular-nums text-sky-400/90">
                        9-Perks: [{activeRune.selectedPerkIds.join(', ')}]
                      </div>
                    </div>
                  );
                })()}

                {/* Core Items & Skill Order from OP.GG + Tencent GTImg */}
                {externalBuild.coreItems.length > 0 && (
                  <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 text-[11px] font-mono tabular-nums space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>核心三件套 ({externalBuild.coreItems[0].names.join(' → ')})</span>
                      <span className="text-emerald-400">
                        {(externalBuild.coreItems[0].winRate * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-slate-400 flex items-center justify-between">
                      <span>
                        加点：{externalBuild.skillOrder.masteryPriority.join(' > ')} (前6级:{' '}
                        {externalBuild.skillOrder.levelOrder.slice(0, 6).join('')})
                      </span>
                      {externalBuild.strongAgainst[0] && (
                        <span className="text-amber-400">
                          克制 {externalBuild.strongAgainst[0].enemyChampionName.split('·')[1] || externalBuild.strongAgainst[0].enemyChampionName}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800/80">
            <button
              type="button"
              onClick={handleInjectRune}
              disabled={loadingExternalBuild}
              className="w-full py-2 px-4 rounded-lg bg-sky-500 text-slate-950 text-xs font-semibold hover:bg-sky-400 transition-colors whitespace-nowrap disabled:opacity-60"
            >
              {loadingExternalBuild
                ? '正在同步 OP.GG 实时数据...'
                : `热写入 OP.GG【${externalBuild?.championTitle || selectedRunePreset.championName}·${externalPosition}】9槽符文`}
            </button>
            {runeStatusMessage && (
              <p className="text-[11px] text-emerald-400 mt-1.5 font-mono">
                {runeStatusMessage}
              </p>
            )}
          </div>
        </section>

        {/* Col 9-12: Lobby Chat Anti-Censorship Broadcaster */}
        <section className="lg:col-span-4 p-5 rounded-xl bg-gray-900/90 border border-slate-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-bold text-slate-100">
                05. 选人聊天室防屏蔽脱敏战报
              </h3>
              <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableZeroWidthObfuscation}
                  onChange={(e) => setEnableZeroWidthObfuscation(e.target.checked)}
                  className="accent-sky-500"
                />
                <span>零宽脱敏</span>
              </label>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 mt-2.5">
              {[
                { mode: ChatReportMode.FULL_TEAM_BRIEF, label: '全队5人速报' },
                { mode: ChatReportMode.TEAMMATE_CONFIDENCE, label: '大腿定心丸' },
                { mode: ChatReportMode.HAZARD_ALERT, label: '边路防守提醒' },
              ].map((item) => (
                <button
                  key={item.mode}
                  type="button"
                  onClick={() => setChatMode(item.mode)}
                  className={`flex-1 py-1 px-2 text-xs rounded transition-colors whitespace-nowrap ${
                    chatMode === item.mode
                      ? 'bg-sky-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mt-2.5 p-2.5 rounded-lg bg-slate-950 border border-slate-800 max-h-28 overflow-y-auto text-[11px] font-mono tabular-nums space-y-1 text-slate-300">
              {chatPreviewLines.map((line, i) => (
                <div key={i} className="truncate" title={line}>
                  {line}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800/80">
            <button
              type="button"
              onClick={handleSendChat}
              className="w-full py-2 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold transition-colors whitespace-nowrap"
            >
              一键发送至选人聊天室 (350ms/行节流)
            </button>
            {chatDeliveredNotice && (
              <p className="text-[11px] text-sky-400 mt-1.5 font-mono">
                {chatDeliveredNotice}
              </p>
            )}
          </div>
        </section>
      </div>

      {/* Row 3: Two-Stage 10-Player SGP Cross-Region Scout Matrix */}
      <section className="p-5 rounded-xl bg-gray-900/90 border border-slate-800/80">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <h2 className="font-display text-base font-bold text-slate-100">
              06. 双阶段 10 人 SGP 穿透查房与牛马/车队拓扑矩阵
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              已识别组排车队：{premadeGroups.map((g) => `${g.groupId} (同队胜率 ${Math.round(g.synergyWinRate * 100)}%)`).join(' · ')}
            </p>
          </div>

          {/* Interactive Filter Tabs (Functional Buttons Allowed per Zero-Pill Discipline) */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
            {[
              { id: 'ALL', label: '全部 10 人' },
              { id: 'CARRY_ONLY', label: '仅看真大腿' },
              { id: 'HAZARD_ONLY', label: '仅看高危牛马' },
              { id: 'PREMADE_ONLY', label: '仅看开黑车队' },
              { id: 'BLACKLIST_ONLY', label: '仅看恩怨账本' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setScoutFilter(tab.id as ScoutFilterMode)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  scoutFilter === tab.id
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-5">
          {/* Ally 5 Column */}
          <div>
            <div className="flex items-center justify-between mb-3 text-xs font-mono tabular-nums">
              <span className="font-semibold text-sky-400">
                我方阵营 (BLUE TEAM · 5人实名穿透)
              </span>
              <span className="text-slate-400">
                平均 RPI{' '}
                {(
                  allies.reduce((s, a) => s + a.averageRpi, 0) / Math.max(1, allies.length)
                ).toFixed(1)}
              </span>
            </div>

            <div className="space-y-3">
              {filteredAllies.map((player) => {
                const isPremadeHighlighted =
                  hoveredPremadeId && player.premadeGroupId === hoveredPremadeId;
                const hasBlacklistAlert = player.tags.some(
                  (t) => t.id === 'BLACKLIST_HIT'
                );

                return (
                  <div
                    key={player.puuid}
                    onMouseEnter={() =>
                      player.premadeGroupId && setHoveredPremadeId(player.premadeGroupId)
                    }
                    onMouseLeave={() => setHoveredPremadeId(null)}
                    className={`p-3.5 rounded-lg border transition-colors ${
                      hasBlacklistAlert
                        ? 'bg-rose-950/25 border-rose-500/60'
                        : isPremadeHighlighted
                        ? 'bg-sky-950/30 border-sky-400'
                        : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    {/* Top Row: Role · Champion · Summoner Name · Tier & RPI */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono tabular-nums">
                          <span className="text-sky-400 font-bold">{player.assignedRole}</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-100 font-semibold">
                            {player.currentChampionName}
                          </span>
                          <span aria-hidden="true">·</span>
                          <button
                            type="button"
                            onClick={() => onInspectPlayerInAnalytics(player.puuid)}
                            className="text-slate-200 hover:text-sky-400 underline decoration-slate-700 truncate font-sans font-medium"
                          >
                            {player.gameName}#{player.tagLine}
                          </button>
                        </div>

                        {/* Zero-Pill Metadata Line: Tier · Winrate · Dual Eta · Premade */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 font-mono tabular-nums mt-1">
                          <span>
                            {player.soloTier} {player.soloDivision} ({player.soloLp}LP)
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            输出转化{' '}
                            {Math.round(
                              (player.latestRpiBreakdown?.damageEfficiencyEta ?? 1) * 100
                            )}
                            %
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            承伤转化{' '}
                            {Math.round(
                              (player.latestRpiBreakdown?.tankEfficiencyEta ?? 1) * 100
                            )}
                            %
                          </span>
                          {player.premadeGroupId && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-sky-400 font-semibold">
                                [{player.premadeGroupId}]
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0 font-mono tabular-nums">
                        <div
                          className={`text-base font-bold ${
                            player.averageRpi >= 75
                              ? 'text-amber-400'
                              : player.averageRpi <= 42
                              ? 'text-rose-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          RPI {player.averageRpi}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          评级 {player.latestRpiBreakdown?.gradeLabel}
                        </div>
                      </div>
                    </div>

                    {/* Unboxed Tag Line with Typographic Separators (Zero-Pill Discipline) */}
                    <div className="mt-2.5 pt-2 border-t border-slate-800/70 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        {player.tags.map((tag, idx) => (
                          <React.Fragment key={tag.id}>
                            {idx > 0 && (
                              <span aria-hidden="true" className="text-slate-600">
                                /
                              </span>
                            )}
                            <span
                              title={`${tag.description} (${tag.metricProof})`}
                              className={`font-medium ${
                                tag.polarity === TagPolarity.HAZARD
                                  ? 'text-rose-400 font-semibold'
                                  : tag.polarity === TagPolarity.CARRY
                                  ? 'text-amber-400 font-semibold'
                                  : tag.polarity === TagPolarity.WARNING
                                  ? 'text-amber-300'
                                  : 'text-slate-300'
                              }`}
                            >
                              {tag.label}
                            </span>
                          </React.Fragment>
                        ))}
                      </div>

                      <span className="font-mono tabular-nums text-[11px] text-slate-400">
                        近4场:{' '}
                        {player.recentMatches
                          .map((m) => `${m.kills}/${m.deaths}/${m.assists}`)
                          .join(' · ')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Enemy 5 Column (Supports Two-Stage BP Anonymity -> InGame Unlocker) */}
          <div>
            <div className="flex items-center justify-between mb-3 text-xs font-mono tabular-nums">
              <span className="font-semibold text-rose-400">
                敌方阵营 (RED TEAM ·{' '}
                {gameflowPhase === GameflowPhase.CHAMP_SELECT
                  ? '单双排BP匿名保护中'
                  : '局内会话已全量解锁'}
                )
              </span>
              <button
                type="button"
                onClick={onToggleInGameUnlock}
                className="text-sky-400 hover:text-sky-300 underline"
              >
                {gameflowPhase === GameflowPhase.CHAMP_SELECT
                  ? '一键模拟进入对局解锁敌方PUUID'
                  : '切回BP匿名视图'}
              </button>
            </div>

            <div className="space-y-3">
              {filteredEnemies.map((player) => {
                const isMasked = player.isAnonymousInBp;
                const isBreakthroughTarget =
                  !isMasked &&
                  (player.averageRpi <= 42 ||
                    player.tags.some((t) => t.id === 'BLACKLIST_HIT'));

                return (
                  <div
                    key={player.puuid}
                    onMouseEnter={() =>
                      !isMasked &&
                      player.premadeGroupId &&
                      setHoveredPremadeId(player.premadeGroupId)
                    }
                    onMouseLeave={() => setHoveredPremadeId(null)}
                    className={`p-3.5 rounded-lg border transition-colors ${
                      isBreakthroughTarget
                        ? 'bg-emerald-950/25 border-emerald-500/60'
                        : 'bg-slate-950/80 border-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono tabular-nums">
                          <span className="text-rose-400 font-bold">
                            {player.assignedRole}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-100 font-semibold">
                            {player.currentChampionName}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-200 font-sans font-medium truncate">
                            {isMasked
                              ? `敌方召唤师 [${player.assignedRole} 匿名加密]`
                              : `${player.gameName}#${player.tagLine}`}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 font-mono tabular-nums mt-1">
                          {isMasked ? (
                            <span>
                              英雄伤害类型: {player.championDamageType} · 前排指数{' '}
                              {player.frontlineRating}/10 · 控制指数 {player.ccRating}/10
                            </span>
                          ) : (
                            <>
                              <span>
                                {player.soloTier} {player.soloDivision} ({player.soloLp}LP)
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>预估MMR {player.estimatedMmr}</span>
                              {player.premadeGroupId && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="text-rose-400 font-semibold">
                                    [{player.premadeGroupId}]
                                  </span>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0 font-mono tabular-nums">
                        {isMasked ? (
                          <span className="text-xs text-slate-400">加载阶段解锁</span>
                        ) : (
                          <>
                            <div
                              className={`text-base font-bold ${
                                isBreakthroughTarget
                                  ? 'text-emerald-400'
                                  : 'text-amber-400'
                              }`}
                            >
                              RPI {player.averageRpi}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {isBreakthroughTarget ? '建议重点军训' : '警惕敌方核心'}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-800/70 flex flex-wrap items-center justify-between gap-2 text-xs">
                      {isMasked ? (
                        <span className="text-slate-400">
                          单双排选人阶段敌方 PUUID 处于服务端脱敏态，进入加载界面后将通过 /lol-gameflow/v1/session 自动穿透
                        </span>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            {isBreakthroughTarget && (
                              <span className="text-emerald-400 font-bold">
                                [复仇提款机 · 头号军训突破口] /
                              </span>
                            )}
                            {player.tags.map((tag, idx) => (
                              <React.Fragment key={tag.id}>
                                {idx > 0 && (
                                  <span aria-hidden="true" className="text-slate-600">
                                    /
                                  </span>
                                )}
                                <span className="text-slate-300 font-medium">
                                  {tag.label}
                                </span>
                              </React.Fragment>
                            ))}
                          </div>
                          <span className="font-mono tabular-nums text-[11px] text-slate-400">
                            近战绩:{' '}
                            {player.recentMatches
                              .map((m) => `${m.kills}/${m.deaths}/${m.assists}`)
                              .join(' · ')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
