/**
 * NexusAkari Pro (v4) — Smart BP, Team Comp Diagnosis, Dodge EV,
 * Anti-Censorship Chat Broadcaster & Two-Stage 10-Player SGP Scout Workspace
 */

import React, { useMemo, useState } from 'react';
import { BpSimulationResult } from '../bridge/tauriClient';
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
  onBroadcastChat,
  onToggleInGameUnlock,
  onInspectPlayerInAnalytics,
}) => {
  const [dodgeCountToday, setDodgeCountToday] = useState<number>(0);
  const [selectedTeammateHoverId, setSelectedTeammateHoverId] = useState<number>(53);
  const [bpDrillResult, setBpDrillResult] = useState<BpSimulationResult | null>(null);
  const [selectedRunePresetId, setSelectedRunePresetId] = useState<string>(RUNE_PAGE_PRESETS[0].id);
  const [runeStatusMessage, setRuneStatusMessage] = useState<string | null>(null);

  const [chatMode, setChatMode] = useState<ChatReportMode>(ChatReportMode.FULL_TEAM_BRIEF);
  const [enableZeroWidthObfuscation, setEnableZeroWidthObfuscation] = useState<boolean>(true);
  const [chatDeliveredNotice, setChatDeliveredNotice] = useState<string | null>(null);

  const [scoutFilter, setScoutFilter] = useState<ScoutFilterMode>('ALL');
  const [hoveredPremadeId, setHoveredPremadeId] = useState<string | null>(null);

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

  const selectedRunePreset = useMemo(
    () => RUNE_PAGE_PRESETS.find((r) => r.id === selectedRunePresetId) ?? RUNE_PAGE_PRESETS[0],
    [selectedRunePresetId]
  );

  const handleTriggerBpDrill = async () => {
    const res = await onRunBpSimulation(selectedTeammateHoverId);
    setBpDrillResult(res);
  };

  const handleInjectRune = async () => {
    const msg = await onInjectRunePage(selectedRunePresetId);
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

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    主选秒锁英雄
                  </label>
                  <select
                    aria-label="主选秒锁英雄"
                    value={automation.primaryPickChampionIds[0] ?? 203}
                    onChange={(e) =>
                      onUpdateAutomation({
                        primaryPickChampionIds: [
                          Number(e.target.value),
                          ...automation.primaryPickChampionIds.slice(1),
                        ],
                      })
                    }
                    className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-100 text-xs"
                  >
                    <option value={203}>千珏 (203)</option>
                    <option value={516}>奥恩 (516)</option>
                    <option value={145}>卡莎 (145)</option>
                    <option value={266}>亚托克斯 (266)</option>
                    <option value={64}>李青 (64)</option>
                    <option value={103}>阿狸 (103)</option>
                    <option value={202}>烬 (202)</option>
                    <option value={126}>杰斯 (126)</option>
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
                    <option value={412}>锤石 (412)</option>
                    <option value={516}>奥恩 (516)</option>
                    <option value={81}>伊泽瑞尔 (81)</option>
                    <option value={61}>奥莉安娜 (61)</option>
                    <option value={122}>德莱厄斯 (122)</option>
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
                          897,
                          238,
                        ],
                      })
                    }
                    className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-100 text-xs"
                  >
                    <option value={53}>布里茨 (53)</option>
                    <option value={897}>奎桑提 (897)</option>
                    <option value={238}>劫 (238)</option>
                    <option value={157}>亚索 (157)</option>
                    <option value={114}>菲奥娜 (114)</option>
                  </select>
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
              {automation.primaryPickChampionIds[0] ?? 203}
            </div>
          )}
        </section>

        {/* Col 6-8: Auto-Rune Hot Injector */}
        <section className="lg:col-span-3 p-5 rounded-xl bg-gray-900/90 border border-slate-800/80 flex flex-col justify-between">
          <div>
            <h3 className="font-display text-sm font-bold text-slate-100">
              04. 一键符文页热写入 (LCU Perks)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              锁定英雄瞬间自动替换当前客户端符文页
            </p>

            <div className="mt-3">
              <label htmlFor="rune-preset-select" className="sr-only">
                选择高胜率符文配置
              </label>
              <select
                id="rune-preset-select"
                value={selectedRunePresetId}
                onChange={(e) => setSelectedRunePresetId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100"
              >
                {RUNE_PAGE_PRESETS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.championName} · {r.pageName} ({r.winRate}%)
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 p-2.5 rounded-lg bg-slate-950/90 border border-slate-800/80 text-xs space-y-1">
              <div className="flex items-center justify-between font-mono tabular-nums text-slate-300">
                <span>{selectedRunePreset.primaryStyleName}</span>
                <span>+</span>
                <span>{selectedRunePreset.subStyleName}</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                {selectedRunePreset.perkNames.join(' · ')}
              </p>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800/80">
            <button
              type="button"
              onClick={handleInjectRune}
              className="w-full py-2 px-4 rounded-lg bg-sky-500 text-slate-950 text-xs font-semibold hover:bg-sky-400 transition-colors whitespace-nowrap"
            >
              热写入至客户端符文页
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
