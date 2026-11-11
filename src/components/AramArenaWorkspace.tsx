/**
 * NexusAkari Pro (v4) — Slice-5: ARAM <5ms WAMP Bench Diff Sniper (with Instant Rollback Lock),
 * Effective Health Pool (EHP) Multiplier Truth Table & Arena Duo Augment Synergy Helper
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  AramSnipeResult,
  ExternalMetaOverviewDto,
  LiveAramSessionDto,
  tauriBridgeClient,
} from '../bridge/tauriClient';
import {
  ALL_CHAMPIONS_SORTED,
  buildAramBalanceForChampion,
} from '../core/championCatalog';
import { calculateAramEhpMetrics } from '../core/mathEngine';
import {
  ARAM_BALANCE_DATABASE,
  ARENA_AUGMENTS_DATABASE,
} from '../core/telemetryFixtures';
import { AramChampionBalance, AutomationConfig } from '../core/types';

interface AramArenaWorkspaceProps {
  automation: AutomationConfig;
  liveAramSession?: LiveAramSessionDto | null;
  onUpdateAutomation: (patch: Partial<AutomationConfig>) => void;
  onExecuteAramSwap: (params: {
    action: 'REROLL' | 'MANUAL_SWAP' | 'ROLLBACK';
    currentChampionId: number;
    targetChampionId?: number;
    benchPoolIds: number[];
  }) => Promise<AramSnipeResult>;
}

type AramFilterType = 'ALL' | 'SEVERE_TRAP' | 'GOD_BUFF' | 'FULL_169';
type ArenaRarityFilter = 'ALL' | 'PRISMATIC' | 'GOLD' | 'SILVER';

export const AramArenaWorkspace: React.FC<AramArenaWorkspaceProps> = ({
  automation,
  liveAramSession,
  onUpdateAutomation,
  onExecuteAramSwap,
}) => {
  const [currentChampId, setCurrentChampId] = useState<number>(37); // Default Sona (Trap) so user sees dramatic snipe upgrade!
  const [rollbackChampId, setRollbackChampId] = useState<number | null>(null);
  const [benchPoolIds, setBenchPoolIds] = useState<number[]>([115, 54, 236, 64]);
  const [lastSnipeLog, setLastSnipeLog] = useState<string>(
    'WAMP [5, "OnJsonApiEvent"] 备选席差分监听器已挂载，等待队友或本人点击摇骰子 (Reroll)...'
  );
  const [lastElapsedUs, setLastElapsedUs] = useState<number>(2140);

  const [aramFilter, setAramFilter] = useState<AramFilterType>('ALL');
  const [aramSearch, setAramSearch] = useState<string>('');
  const [arenaRarityFilter, setArenaRarityFilter] = useState<ArenaRarityFilter>('ALL');
  const [arenaSearch, setArenaSearch] = useState<string>('');

  const [externalOverview, setExternalOverview] =
    useState<ExternalMetaOverviewDto | null>(null);
  const [syncingExternal, setSyncingExternal] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    tauriBridgeClient
      .getExternalOverview()
      .then((res) => {
        if (!cancelled) setExternalOverview(res.overview);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, []);

  const handleForceSyncExternal = async () => {
    setSyncingExternal(true);
    try {
      const res = await tauriBridgeClient.syncExternalData();
      setExternalOverview(res.overview);
    } finally {
      setSyncingExternal(false);
    }
  };

  // Automatically sync live ARAM session from /lol-champ-select/v1/session when connected
  useEffect(() => {
    if (!liveAramSession) return;
    if (liveAramSession.currentChampionId > 0) {
      setCurrentChampId(liveAramSession.currentChampionId);
    }
    if (liveAramSession.benchChampionIds.length > 0) {
      setBenchPoolIds(liveAramSession.benchChampionIds);
    }
  }, [liveAramSession]);

  const full169AramMap = useMemo(() => {
    const liveMap = new Map<
      number,
      ExternalMetaOverviewDto['aramBalanceList'][number]
    >();
    if (externalOverview?.aramBalanceList) {
      for (const item of externalOverview.aramBalanceList) {
        liveMap.set(item.championId, item);
      }
    }

    const map = new Map<
      number,
      {
        entry: AramChampionBalance & {
          opggPlayCount?: number;
          opggKda?: number;
          opggRank?: number;
          dataSource?: string;
        };
        metrics: ReturnType<typeof calculateAramEhpMetrics>;
        isFeatured: boolean;
      }
    >();
    for (const entry of ARAM_BALANCE_DATABASE) {
      const live = liveMap.get(entry.championId);
      const mergedEntry = live
        ? {
            ...entry,
            baseWinRate: live.baseWinRate,
            pickRate: live.pickRate,
            opggPlayCount: live.opggPlayCount,
            opggKda: live.opggKda,
            opggRank: live.opggRank,
            dataSource: live.dataSource,
          }
        : entry;
      map.set(entry.championId, {
        entry: mergedEntry,
        metrics: calculateAramEhpMetrics(mergedEntry),
        isFeatured: true,
      });
    }
    for (const champ of ALL_CHAMPIONS_SORTED) {
      if (!map.has(champ.id)) {
        const live = liveMap.get(champ.id);
        const fallbackEntry = live || buildAramBalanceForChampion(champ.id);
        map.set(champ.id, {
          entry: fallbackEntry,
          metrics: calculateAramEhpMetrics(fallbackEntry),
          isFeatured: false,
        });
      }
    }
    return map;
  }, [externalOverview]);

  const aramEnrichedList = useMemo(() => {
    return Array.from(full169AramMap.values()).sort(
      (a, b) => b.metrics.netPowerDeltaPercent - a.metrics.netPowerDeltaPercent
    );
  }, [full169AramMap]);

  const currentHeldItem = useMemo(() => {
    return (
      full169AramMap.get(currentChampId) ??
      aramEnrichedList[0]
    );
  }, [full169AramMap, aramEnrichedList, currentChampId]);

  const benchItems = useMemo(() => {
    return benchPoolIds
      .map((id) => full169AramMap.get(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [benchPoolIds, full169AramMap]);

  const filteredAramTable = useMemo(() => {
    const q = aramSearch.trim().toLowerCase();
    return aramEnrichedList.filter(({ entry, metrics, isFeatured }) => {
      if (q) {
        const hit =
          entry.championName.toLowerCase().includes(q) ||
          entry.roleClass.toLowerCase().includes(q) ||
          String(entry.championId) === q;
        if (!hit) return false;
      }
      if (aramFilter === 'SEVERE_TRAP') return metrics.trapLevel === 'SEVERE_TRAP';
      if (aramFilter === 'GOD_BUFF') return metrics.trapLevel === 'GOD_BUFF';
      if (aramFilter === 'ALL' && !q) return isFeatured;
      return true;
    });
  }, [aramEnrichedList, aramFilter, aramSearch]);

  const filteredArenaAugments = useMemo(() => {
    return ARENA_AUGMENTS_DATABASE.filter((aug) => {
      if (arenaRarityFilter !== 'ALL' && aug.rarity !== arenaRarityFilter) return false;
      if (arenaSearch.trim()) {
        const q = arenaSearch.trim().toLowerCase();
        return (
          aug.augmentName.toLowerCase().includes(q) ||
          aug.duoArchetypeName.toLowerCase().includes(q) ||
          aug.synergyChampions.some((c) => c.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [arenaRarityFilter, arenaSearch]);

  const handleRerollBench = async () => {
    const res = await onExecuteAramSwap({
      action: 'REROLL',
      currentChampionId: currentChampId,
      benchPoolIds,
    });
    if (res.swapped) {
      setRollbackChampId(res.previousChampionId);
      setCurrentChampId(res.newChampionId);
    }
    setBenchPoolIds(res.benchPoolIds);
    setLastElapsedUs(res.elapsedMicroseconds);
    setLastSnipeLog(res.auditMessage);
  };

  const handleManualSwapFromBench = async (targetId: number) => {
    const res = await onExecuteAramSwap({
      action: 'MANUAL_SWAP',
      currentChampionId: currentChampId,
      targetChampionId: targetId,
      benchPoolIds,
    });
    setRollbackChampId(res.previousChampionId);
    setCurrentChampId(res.newChampionId);
    setBenchPoolIds(res.benchPoolIds);
    setLastElapsedUs(res.elapsedMicroseconds);
    setLastSnipeLog(res.auditMessage);
  };

  const handleInstantRollback = async () => {
    if (!rollbackChampId) return;
    const res = await onExecuteAramSwap({
      action: 'ROLLBACK',
      currentChampionId: currentChampId,
      targetChampionId: rollbackChampId,
      benchPoolIds,
    });
    setCurrentChampId(res.newChampionId);
    setRollbackChampId(null);
    setBenchPoolIds(res.benchPoolIds);
    setLastElapsedUs(res.elapsedMicroseconds);
    setLastSnipeLog(`[一键回滚锁生效] 已瞬间抢回原持有英雄【${res.newChampionName}】！`);
  };

  const toggleWishlistChampion = (championId: number) => {
    const exists = automation.aramWishlistChampionIds.includes(championId);
    const updated = exists
      ? automation.aramWishlistChampionIds.filter((id) => id !== championId)
      : [...automation.aramWishlistChampionIds, championId];
    onUpdateAutomation({ aramWishlistChampionIds: updated });
  };

  return (
    <div className="space-y-6">
      {/* Row 1: ARAM <5ms WAMP Bench Diff Sniper & Instant Rollback Console */}
      <section className="p-5 rounded-xl bg-gray-900/90 border border-slate-800/80">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <h2 className="font-display text-base font-bold text-slate-100">
              01. 极地大乱斗 WAMP &lt;5ms 备选席 (Bench) 差分秒抢器与回滚保护锁
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              直接订阅 /lol-champ-select/v1/session 的 benchChampions 数组增量，一旦摇出心愿单英雄即在 5 毫秒内执行交换
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-slate-200 font-medium">
              <input
                type="checkbox"
                checked={automation.aramBenchSniperEnabled}
                onChange={(e) =>
                  onUpdateAutomation({ aramBenchSniperEnabled: e.target.checked })
                }
                className="accent-sky-500 w-4 h-4"
              />
              <span>启用 &lt;5ms 自动秒抢心愿单</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-slate-200 font-medium">
              <input
                type="checkbox"
                checked={automation.aramInstantRollbackLock}
                onChange={(e) =>
                  onUpdateAutomation({ aramInstantRollbackLock: e.target.checked })
                }
                className="accent-sky-500 w-4 h-4"
              />
              <span>保留原英雄一键回滚锁</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-5 items-stretch">
          {/* Left 4 Cols: Currently Held Champion & Rollback Control */}
          <div className="lg:col-span-4 p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                <span className="text-sky-400 font-semibold">当前持有英雄槽</span>
                <span className="text-slate-400">
                  响应耗时 {(lastElapsedUs / 1000).toFixed(2)} ms
                </span>
              </div>

              <div className="mt-3">
                <div className="font-display text-lg font-bold text-slate-100">
                  {currentHeldItem.entry.championName} ·{' '}
                  <span className="text-sm font-normal text-slate-400">
                    {currentHeldItem.entry.roleClass}
                  </span>
                </div>

                <div
                  className={`mt-1.5 text-xs font-semibold ${
                    currentHeldItem.metrics.trapLevel === 'SEVERE_TRAP'
                      ? 'text-rose-400'
                      : currentHeldItem.metrics.trapLevel === 'GOD_BUFF'
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}
                >
                  [{currentHeldItem.metrics.tierGrade} 级] ·{' '}
                  {currentHeldItem.metrics.summaryBadge}
                </div>

                <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs font-mono tabular-nums">
                  <div>
                    <span className="text-slate-400 block text-[11px]">输出伤害修正</span>
                    <span className="text-slate-100 font-bold">
                      {Math.round(currentHeldItem.entry.damageDealtMod * 100)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">
                      真实等效生命值 (EHP)
                    </span>
                    <span className="text-sky-400 font-bold">
                      ×{currentHeldItem.metrics.ehpMultiplier.toFixed(3)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-2">
              <button
                type="button"
                onClick={handleRerollBench}
                className="flex-1 py-2 px-3 rounded-lg bg-sky-500 text-slate-950 text-xs font-bold hover:bg-sky-400 transition-colors whitespace-nowrap"
              >
                摇骰子刷新备选席 (Reroll)
              </button>

              {rollbackChampId && automation.aramInstantRollbackLock && (
                <button
                  type="button"
                  onClick={handleInstantRollback}
                  className="py-2 px-3 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0"
                >
                  回滚原英雄 (#{rollbackChampId})
                </button>
              )}
            </div>
          </div>

          {/* Right 8 Cols: Bench Pool Slots & WAMP Snipe Log */}
          <div className="lg:col-span-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs mb-2.5">
                <span className="text-slate-300 font-semibold">
                  顶部摇骰子备选席 (Bench Pool · 点击卡片可立即手动秒换)
                </span>
                <span className="font-mono tabular-nums text-slate-400">
                  心愿单已勾选 {automation.aramWishlistChampionIds.length} 名英雄
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {benchItems.map(({ entry, metrics }) => {
                  const isWishlist = automation.aramWishlistChampionIds.includes(
                    entry.championId
                  );
                  return (
                    <button
                      key={entry.championId}
                      type="button"
                      onClick={() => handleManualSwapFromBench(entry.championId)}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        isWishlist
                          ? 'bg-sky-950/35 border-sky-500/70 hover:bg-sky-900/40'
                          : metrics.trapLevel === 'SEVERE_TRAP'
                          ? 'bg-rose-950/20 border-rose-500/40 hover:border-rose-400'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                        <span className="font-bold text-slate-100 truncate font-sans">
                          {entry.championName}
                        </span>
                        <span
                          className={`font-bold ${
                            metrics.trapLevel === 'SEVERE_TRAP'
                              ? 'text-rose-400'
                              : metrics.trapLevel === 'GOD_BUFF'
                              ? 'text-emerald-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {metrics.tierGrade}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-1">
                        输出 {Math.round(entry.damageDealtMod * 100)}% · 承伤{' '}
                        {Math.round(entry.damageTakenMod * 100)}%
                      </div>
                      <div className="text-[11px] font-mono tabular-nums mt-1">
                        <span
                          className={
                            metrics.netPowerDeltaPercent >= 0
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }
                        >
                          净强度{' '}
                          {metrics.netPowerDeltaPercent >= 0
                            ? `+${metrics.netPowerDeltaPercent}%`
                            : `${metrics.netPowerDeltaPercent}%`}
                        </span>
                        {isWishlist && (
                          <span className="text-sky-400 ml-1.5 font-semibold">
                            · 心愿单
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono tabular-nums text-slate-300">
              {lastSnipeLog}
            </div>
          </div>
        </div>
      </section>

      {/* Row 2: ARAM Full Champion Balance & Effective Health Pool (EHP) Truth Table */}
      <section className="p-5 rounded-xl bg-gray-900/90 border border-slate-800/80">
        {/* Live 4-Source External API Telemetry Strip */}
        {externalOverview && (
          <div className="mb-4 p-3 rounded-lg bg-slate-950 border border-slate-800/90 flex flex-wrap items-center justify-between gap-3 text-xs font-mono tabular-nums">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sky-400 font-semibold">
                外部实时数据源已接入 (Patch {externalOverview.ddragonVersion})：
              </span>
              {externalOverview.sources.map((src) => (
                <span
                  key={src.provider}
                  className={src.healthy ? 'text-emerald-400' : 'text-amber-400'}
                >
                  {src.provider} [{src.httpStatus || 200} · {src.latencyMs}ms · {src.cachedCount}项]
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={handleForceSyncExternal}
              disabled={syncingExternal}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 text-[11px] font-sans font-semibold transition-colors whitespace-nowrap disabled:opacity-50"
            >
              {syncingExternal ? '正在刷新四源 API...' : '重刷 OP.GG / DDragon / 腾讯GTImg'}
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <h2 className="font-display text-base font-bold text-slate-100">
              02. 大乱斗全英雄官方平衡 Buff 透视与真实等效生命值 (EHP) 乘区表
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              公式：EHP_mult = 1 / 承伤修正；综合输出、承伤、治疗、护盾、急速与韧性计算真实换血盈亏，一眼识破版本陷阱
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={aramSearch}
              onChange={(e) => setAramSearch(e.target.value)}
              placeholder="搜全部 169 名英雄加入心愿单..."
              aria-label="检索169名大乱斗英雄"
              className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100"
            />
            <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
              {[
                { id: 'ALL', label: '精选改版英雄' },
                { id: 'FULL_169', label: '全部 169 英雄' },
                { id: 'GOD_BUFF', label: '仅看亲爹 Buff (S+/S)' },
                { id: 'SEVERE_TRAP', label: '仅看数值陷阱 (D级避坑)' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setAramFilter(tab.id as AramFilterType)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    aramFilter === tab.id
                      ? 'bg-sky-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto mt-3">
          <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2.5 px-2 font-sans">秒抢心愿单</th>
                <th className="py-2.5 px-2 font-sans">英雄 & 定位</th>
                <th className="py-2.5 px-2 text-right">输出修正</th>
                <th className="py-2.5 px-2 text-right">承伤修正</th>
                <th className="py-2.5 px-2 text-right">真实EHP倍率</th>
                <th className="py-2.5 px-2 text-right">急速/韧性</th>
                <th className="py-2.5 px-2 text-right">净强度偏移</th>
                <th className="py-2.5 px-2 font-sans">核心出装与避坑指南</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredAramTable.map(({ entry, metrics }) => {
                const inWishlist = automation.aramWishlistChampionIds.includes(
                  entry.championId
                );
                return (
                  <tr key={entry.championId} className="hover:bg-slate-900/70">
                    <td className="py-2.5 px-2 font-sans">
                      <button
                        type="button"
                        onClick={() => toggleWishlistChampion(entry.championId)}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors whitespace-nowrap ${
                          inWishlist
                            ? 'bg-sky-500 text-slate-950'
                            : 'bg-slate-950 border border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {inWishlist ? '已加入秒抢' : '+ 设为心愿'}
                      </button>
                    </td>
                    <td className="py-2.5 px-2 font-sans">
                      <div className="font-bold text-slate-100">
                        [{metrics.tierGrade}] {entry.championName}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                        {entry.roleClass} · OP.GG胜率 {(entry.baseWinRate * 100).toFixed(2)}%
                        {entry.opggPlayCount
                          ? ` (${entry.opggPlayCount.toLocaleString()}场 · #${entry.opggRank})`
                          : ''}
                      </div>
                    </td>
                    <td
                      className={`py-2.5 px-2 text-right font-semibold ${
                        entry.damageDealtMod > 1
                          ? 'text-emerald-400'
                          : entry.damageDealtMod < 1
                          ? 'text-rose-400'
                          : 'text-slate-300'
                      }`}
                    >
                      {Math.round(entry.damageDealtMod * 100)}%
                    </td>
                    <td
                      className={`py-2.5 px-2 text-right font-semibold ${
                        entry.damageTakenMod < 1
                          ? 'text-emerald-400'
                          : entry.damageTakenMod > 1
                          ? 'text-rose-400'
                          : 'text-slate-300'
                      }`}
                    >
                      {Math.round(entry.damageTakenMod * 100)}%
                    </td>
                    <td className="py-2.5 px-2 text-right font-bold text-sky-400">
                      ×{metrics.ehpMultiplier.toFixed(3)}
                    </td>
                    <td className="py-2.5 px-2 text-right text-slate-300">
                      {entry.abilityHasteMod >= 0
                        ? `+${entry.abilityHasteMod}`
                        : entry.abilityHasteMod}{' '}
                      AH / +{entry.tenacityMod}% 韧性
                    </td>
                    <td
                      className={`py-2.5 px-2 text-right font-bold ${
                        metrics.netPowerDeltaPercent >= 4
                          ? 'text-emerald-400'
                          : metrics.netPowerDeltaPercent <= -10
                          ? 'text-rose-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {metrics.netPowerDeltaPercent >= 0
                        ? `+${metrics.netPowerDeltaPercent}%`
                        : `${metrics.netPowerDeltaPercent}%`}
                    </td>
                    <td className="py-2.5 px-2 font-sans text-slate-300">
                      <div>{entry.recommendedMythicCore.join(' · ')}</div>
                      <div className="text-[11px] text-slate-400">
                        {metrics.summaryBadge}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Row 3: Arena (斗魂竞技场) Prismatic/Gold/Silver Augment & Duo Synergy Matrix */}
      <section className="p-5 rounded-xl bg-gray-900/90 border border-slate-800/80">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <h2 className="font-display text-base font-bold text-slate-100">
              03. 斗魂竞技场 (Arena 2v2v2v2) 海克斯强化符文与双人流派协同矩阵
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              覆盖棱彩 (Prismatic) / 黄金 (Gold) / 白银 (Silver) 三阶 S+ 级强化符文与双人组合化学反应
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={arenaSearch}
              onChange={(e) => setArenaSearch(e.target.value)}
              placeholder="搜索英雄或海克斯强化..."
              aria-label="搜索斗魂竞技场英雄或海克斯强化"
              className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100"
            />
            <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
              {[
                { id: 'ALL', label: '全部阶位' },
                { id: 'PRISMATIC', label: '棱彩阶' },
                { id: 'GOLD', label: '黄金阶' },
                { id: 'SILVER', label: '白银阶' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setArenaRarityFilter(tab.id as ArenaRarityFilter)}
                  className={`px-2.5 py-1 text-xs rounded transition-colors whitespace-nowrap ${
                    arenaRarityFilter === tab.id
                      ? 'bg-sky-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {filteredArenaAugments.map((aug) => (
            <div
              key={aug.augmentId}
              className="p-4 rounded-xl bg-slate-950/90 border border-slate-800/90 flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-xs font-mono tabular-nums">
                  <span
                    className={`font-bold ${
                      aug.rarity === 'PRISMATIC'
                        ? 'text-sky-400'
                        : aug.rarity === 'GOLD'
                        ? 'text-amber-400'
                        : 'text-slate-300'
                    }`}
                  >
                    [{aug.rarity} · {aug.tier} 级]
                  </span>
                  <span className="text-emerald-400 font-bold">
                    登顶胜率 {aug.winRatePercent}%
                  </span>
                </div>

                <h3 className="font-display text-sm font-bold text-slate-100 mt-1">
                  {aug.augmentName} · {aug.duoArchetypeName}
                </h3>

                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  {aug.mechanicExplanation}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800/80 space-y-1.5 text-xs">
                <div className="text-slate-400">
                  <span className="text-slate-200 font-semibold">本命契合英雄: </span>
                  {aug.synergyChampions.join(' · ')}
                </div>
                <div className="text-slate-400">
                  <span className="text-sky-400 font-semibold">双人组队推荐: </span>
                  {aug.duoPartnerRecommendation}
                </div>
                <div className="text-slate-400 font-mono tabular-nums text-[11px]">
                  核心神装: {aug.coreItems.join(' / ')}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
