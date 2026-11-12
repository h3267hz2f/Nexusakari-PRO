/**
 * NexusAkari Pro (v4) — Slice-6: Client Omni-Toolkit Workspace
 * Implements:
 * 1. :2999 In-Game Enemy 5 Summoner Spell Haste Cooldown Timer & Jungle Pet Smite Threshold Tracker
 * 2. Hextech Loot Mass Disenchant Blue/Orange Essence Calculator & LCU Batch Craft Executor
 * 3. SGP Cross-Region Delay-Free OB Spectator Command Builder
 * 4. Client Profile Cosmetics (Skin Background Changer, Ranked Tier/Crystal Spoofer) & 5v5 Practice Lobby Builder
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ClientCosmeticPayload,
  SpectatorLaunchResult,
  SpectatorQueryResult,
} from '../bridge/tauriClient';
import {
  calculateLootDisenchantPlan,
  calculateSmiteThreshold,
  calculateSummonerSpellCooldown,
} from '../core/mathEngine';
import {
  LOOT_SHARDS_INVENTORY,
  SGP_REGION_REGISTRY,
} from '../core/telemetryFixtures';
import {
  LootDisenchantPlan,
  LootItemShard,
  SummonerScoutProfile,
} from '../core/types';

interface ClientToolkitWorkspaceProps {
  scoutProfiles: SummonerScoutProfile[];
  lootShards?: LootItemShard[];
  activeRegion: string;
  installDirectory: string;
  onExecuteLootDisenchant: (plan: LootDisenchantPlan) => Promise<{
    craftedRecipesCount: number;
    blueEssenceAdded: number;
    orangeEssenceAdded: number;
  }>;
  onApplyClientCosmetic: (payload: ClientCosmeticPayload) => Promise<string[]>;
  onCreatePracticeLobby: (
    lobbyName: string,
    botCount: number
  ) => Promise<{ lobbyId: string; message: string }>;
  onQuerySpectatorSession: (
    targetSummoner: string,
    regionCode: string
  ) => Promise<SpectatorQueryResult>;
  onLaunchLocalSpectator: (params: {
    spectatorDomain: string;
    spectatorPort: number;
    encryptionKey: string;
    gameId: string;
    regionCode: string;
  }) => Promise<SpectatorLaunchResult>;
}

interface EnemySpellOverride {
  hasCosmicInsight: boolean;
  hasIonianBoots: boolean;
  flashRemainingSec: number;
  secondaryRemainingSec: number;
}

const SKIN_SPLASH_PRESETS: Array<{ skinSplashId: number; skinName: string; champion: string }> = [
  { skinSplashId: 203023, skinName: '至臻 灵魂莲华 千珏 (Prestige Spirit Blossom)', champion: '千珏' },
  { skinSplashId: 103085, skinName: 'Faker 殿堂传奇 不灭魔王 阿狸 (Immortalized Legend)', champion: '阿狸' },
  { skinSplashId: 157009, skinName: '黑夜使者 亚索 (Nightbringer Yasuo)', champion: '亚索' },
  { skinSplashId: 122015, skinName: '神王 德莱厄斯 (God-King Darius)', champion: '德莱厄斯' },
  { skinSplashId: 126024, skinName: '双城之战 幸存者 杰斯 (Arcane Survivor Jayce)', champion: '杰斯' },
];

const SPELL_BASE_CD_SECONDS: Record<string, number> = {
  闪现: 300,
  传送: 360,
  引燃: 180,
  惩戒: 90,
  虚弱: 210,
  净化: 210,
  治疗术: 240,
  治疗: 240,
  幽灵疾步: 240,
  疾跑: 240,
  屏障: 180,
  清晰术: 240,
  '标记 (雪球)': 80,
};

export const ClientToolkitWorkspace: React.FC<ClientToolkitWorkspaceProps> = ({
  scoutProfiles,
  lootShards,
  activeRegion,
  installDirectory,
  onExecuteLootDisenchant,
  onApplyClientCosmetic,
  onCreatePracticeLobby,
  onQuerySpectatorSession,
  onLaunchLocalSpectator,
}) => {
  const activeLootShards = useMemo(
    () => (lootShards && lootShards.length > 0 ? lootShards : LOOT_SHARDS_INVENTORY),
    [lootShards]
  );

  const enemyPlayers = useMemo(
    () => scoutProfiles.filter((p) => p.teamSide === 'ENEMY'),
    [scoutProfiles]
  );

  // 1. :2999 Spell Haste & Countdown state
  const [spellStateMap, setSpellStateMap] = useState<Record<string, EnemySpellOverride>>(() => {
    const initial: Record<string, EnemySpellOverride> = {};
    for (const enemy of scoutProfiles.filter((p) => p.teamSide === 'ENEMY')) {
      initial[enemy.puuid] = {
        hasCosmicInsight: enemy.hasCosmicInsight,
        hasIonianBoots: enemy.hasIonianBoots,
        flashRemainingSec: 0,
        secondaryRemainingSec: 0,
      };
    }
    return initial;
  });

  // Sync live :2999 Ionian Boots (3158) & Cosmic Insight (8347) updates when scoutProfiles refreshes
  // without overwriting manual toggles made by the user
  useEffect(() => {
    setSpellStateMap((prev) => {
      const next = { ...prev };
      for (const enemy of enemyPlayers) {
        const existing = next[enemy.puuid];
        next[enemy.puuid] = {
          hasCosmicInsight: existing
            ? existing.hasCosmicInsight || enemy.hasCosmicInsight
            : enemy.hasCosmicInsight,
          hasIonianBoots: existing
            ? existing.hasIonianBoots || enemy.hasIonianBoots
            : enemy.hasIonianBoots,
          flashRemainingSec: existing?.flashRemainingSec ?? 0,
          secondaryRemainingSec: existing?.secondaryRemainingSec ?? 0,
        };
      }
      return next;
    });
  }, [enemyPlayers]);

  const [petStacks, setPetStacks] = useState<number>(40);
  const [copiedTimerAlert, setCopiedTimerAlert] = useState<string | null>(null);

  // Tick active timers every 1 second
  useEffect(() => {
    const timer = window.setInterval(() => {
      setSpellStateMap((prev) => {
        let changed = false;
        const next: Record<string, EnemySpellOverride> = {};
        for (const [puuid, state] of Object.entries(prev)) {
          const nextFlash = Math.max(0, state.flashRemainingSec - 1);
          const nextSec = Math.max(0, state.secondaryRemainingSec - 1);
          if (nextFlash !== state.flashRemainingSec || nextSec !== state.secondaryRemainingSec) {
            changed = true;
          }
          next[puuid] = {
            ...state,
            flashRemainingSec: nextFlash,
            secondaryRemainingSec: nextSec,
          };
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const smiteMetrics = useMemo(() => calculateSmiteThreshold(petStacks), [petStacks]);

  const handleToggleEnemyHaste = (
    puuid: string,
    field: 'hasCosmicInsight' | 'hasIonianBoots'
  ) => {
    setSpellStateMap((prev) => {
      const current = prev[puuid] ?? {
        hasCosmicInsight: false,
        hasIonianBoots: false,
        flashRemainingSec: 0,
        secondaryRemainingSec: 0,
      };
      return {
        ...prev,
        [puuid]: {
          ...current,
          [field]: !current[field],
        },
      };
    });
  };

  const handleStartSpellCountdown = (
    enemy: SummonerScoutProfile,
    spellType: 'FLASH' | 'SECONDARY'
  ) => {
    const st = spellStateMap[enemy.puuid] ?? {
      hasCosmicInsight: enemy.hasCosmicInsight,
      hasIonianBoots: enemy.hasIonianBoots,
      flashRemainingSec: 0,
      secondaryRemainingSec: 0,
    };

    const baseCd =
      spellType === 'FLASH'
        ? SPELL_BASE_CD_SECONDS[enemy.spell1Name] ?? 300
        : SPELL_BASE_CD_SECONDS[enemy.spell2Name] ?? 210;

    const cdInfo = calculateSummonerSpellCooldown(
      baseCd,
      st.hasCosmicInsight,
      st.hasIonianBoots
    );

    setSpellStateMap((prev) => ({
      ...prev,
      [enemy.puuid]: {
        ...st,
        flashRemainingSec:
          spellType === 'FLASH' ? cdInfo.realCooldownSeconds : st.flashRemainingSec,
        secondaryRemainingSec:
          spellType === 'SECONDARY'
            ? cdInfo.realCooldownSeconds
            : st.secondaryRemainingSec,
      },
    }));

    const spellName = spellType === 'FLASH' ? enemy.spell1Name || '闪现' : enemy.spell2Name;
    const alertText = `[NexusAkari:2999] 敌方 ${enemy.assignedRole} ${enemy.currentChampionName} [${spellName}] 已交 · 技能急速 +${cdInfo.totalSpellHaste} (真实CD ${cdInfo.realCooldownSeconds}s，省 ${cdInfo.secondsSaved}s)`;
    setCopiedTimerAlert(alertText);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(alertText).catch(() => {});
    }
  };

  // 2. Hextech Loot Mass Disenchant Workshop state
  const [lootStrategy, setLootStrategy] = useState<LootDisenchantPlan['strategy']>(
    'KEEP_MASTERY_AND_UNOWNED'
  );
  const [lootReceipt, setLootReceipt] = useState<{
    craftedRecipesCount: number;
    blueEssenceAdded: number;
    orangeEssenceAdded: number;
  } | null>(null);
  const [isExecutingLoot, setIsExecutingLoot] = useState(false);

  const disenchantPlan = useMemo(
    () => calculateLootDisenchantPlan(activeLootShards, lootStrategy),
    [activeLootShards, lootStrategy]
  );

  const handleRunDisenchant = async () => {
    setIsExecutingLoot(true);
    try {
      const res = await onExecuteLootDisenchant(disenchantPlan);
      setLootReceipt(res);
    } finally {
      setIsExecutingLoot(false);
    }
  };

  // 3. SGP Cross-Region Delay-Free OB Spectator Builder state
  const [selectedObRegion, setSelectedObRegion] = useState<string>(activeRegion || 'HN1');
  const [targetObSummoner, setTargetObSummoner] = useState<string>(
    () => scoutProfiles[0]?.gameName ?? '北枫千珏绝活'
  );
  const [obGameId, setObGameId] = useState<string>('7845920144');
  const [obEncryptionKey, setObEncryptionKey] = useState<string>(
    'k9X2mQpL8vR4wN7tY1zB5cF3hJ6gD0sA'
  );
  const [customObDomain, setCustomObDomain] = useState<string | null>(null);
  const [customObPort, setCustomObPort] = useState<number | null>(null);
  const [obCopiedNotice, setObCopiedNotice] = useState<string | null>(null);
  const [isQueryingOb, setIsQueryingOb] = useState<boolean>(false);

  const obRegionConfig = useMemo(
    () =>
      SGP_REGION_REGISTRY.find((r) => r.regionCode === selectedObRegion) ??
      SGP_REGION_REGISTRY[0],
    [selectedObRegion]
  );

  const activeObDomain = customObDomain || obRegionConfig.spectatorDomain;
  const activeObPort = customObPort || obRegionConfig.spectatorPort;

  const spectatorCliString = useMemo(() => {
    const cleanDir = installDirectory.replace(/\\+$/, '');
    return `"${cleanDir}\\Game\\League of Legends.exe" "spectator ${activeObDomain}:${activeObPort} ${obEncryptionKey} ${obGameId} ${obRegionConfig.regionCode}" -UseRads -Locale=zh_CN`;
  }, [installDirectory, activeObDomain, activeObPort, obRegionConfig, obEncryptionKey, obGameId]);

  const handleFetchLiveObCredentials = async () => {
    setIsQueryingOb(true);
    try {
      const res = await onQuerySpectatorSession(targetObSummoner, selectedObRegion);
      setObGameId(res.gameId);
      setObEncryptionKey(res.encryptionKey);
      setCustomObDomain(res.spectatorDomain);
      setCustomObPort(res.spectatorPort);
      setObCopiedNotice(`[${res.source}] ${res.message}`);
    } finally {
      setIsQueryingOb(false);
    }
  };

  const handleCopyAndLaunchOb = async () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(spectatorCliString).catch(() => {});
    }
    const launchRes = await onLaunchLocalSpectator({
      spectatorDomain: activeObDomain,
      spectatorPort: activeObPort,
      encryptionKey: obEncryptionKey,
      gameId: obGameId,
      regionCode: obRegionConfig.regionCode,
    });
    setObCopiedNotice(launchRes.message);
  };

  // 4. Client Profile Cosmetics & 5v5 Practice Tool Lobby state
  const [skinSplashId, setSkinSplashId] = useState<number>(SKIN_SPLASH_PRESETS[0].skinSplashId);
  const [spoofTier, setSpoofTier] = useState<string>('CHALLENGER');
  const [spoofDivision, setSpoofDivision] = useState<string>('I');
  const [spoofLp, setSpoofLp] = useState<number>(1888);
  const [challengeCrystalLevel, setChallengeCrystalLevel] = useState<string>('CHALLENGER');
  const [statusMessage, setStatusMessage] = useState<string>(
    'NexusAkari Pro v4 · 峡谷之巅千珏绝活'
  );
  const [cosmeticNotice, setCosmeticNotice] = useState<string | null>(null);

  const [practiceLobbyName, setPracticeLobbyName] = useState<string>(
    'NexusAkari · 5v5 极限韩服团战演练房'
  );
  const [practiceBotCount, setPracticeBotCount] = useState<number>(9);
  const [practiceLobbyNotice, setPracticeLobbyNotice] = useState<string | null>(null);

  const handleApplyCosmetics = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosenSkin =
      SKIN_SPLASH_PRESETS.find((s) => s.skinSplashId === skinSplashId) ??
      SKIN_SPLASH_PRESETS[0];
    const endpoints = await onApplyClientCosmetic({
      skinSplashId: chosenSkin.skinSplashId,
      skinName: chosenSkin.skinName,
      spoofTier,
      spoofDivision,
      spoofLp,
      challengeCrystalLevel,
      statusMessage,
    });
    setCosmeticNotice(`已写入 LCU 端点：${endpoints.join(' & ')} (${chosenSkin.skinName})`);
  };

  const handleBuildPracticeLobby = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await onCreatePracticeLobby(practiceLobbyName, practiceBotCount);
    setPracticeLobbyNotice(`${res.message} · 房间标识 ${res.lobbyId}`);
  };

  return (
    <div className="space-y-6">
      {/* Row 1: :2999 In-Game Enemy 5 Summoner Spell Haste Timer & Smite Threshold */}
      <section className="p-5 rounded-xl bg-gray-900/90 border border-slate-800/80">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <h2 className="font-display text-base font-bold text-slate-100">
              01. 局内 :2999 敌方五人召唤师技能急速折算计时器与惩戒斩杀线
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              自动读取敌方五人【星界洞悉 (+18)】与【明朗之靴 (+10)】技能急速，按公式 CD = 300 / (1 + H/100) 实时折算真实闪现冷却
            </p>
          </div>

          <div className="flex items-center gap-4 bg-slate-950/90 px-4 py-2.5 rounded-lg border border-slate-800/80">
            <div>
              <label
                htmlFor="pet-stacks-slider"
                className="block text-[11px] text-slate-400 font-medium"
              >
                打野宠物进化层数：{petStacks} 层 ({smiteMetrics.smiteTierName})
              </label>
              <input
                id="pet-stacks-slider"
                type="range"
                min={0}
                max={40}
                step={5}
                value={petStacks}
                onChange={(e) => setPetStacks(Number(e.target.value))}
                className="w-48 mt-1 accent-sky-400 cursor-pointer"
              />
            </div>
            <div className="text-right font-mono tabular-nums pl-3 border-l border-slate-800">
              <div className="text-xs text-slate-400">史诗野怪斩杀真实伤害</div>
              <div className="text-lg font-bold text-amber-400">
                {smiteMetrics.trueDamageMonster} DMG
              </div>
            </div>
          </div>
        </div>

        {copiedTimerAlert && (
          <div className="mt-3 px-3.5 py-2 rounded-lg bg-sky-500/10 border border-sky-500/40 flex items-center justify-between text-xs text-sky-300 font-mono tabular-nums">
            <span>已生成并复制小队报点指令：{copiedTimerAlert}</span>
            <button
              type="button"
              onClick={() => setCopiedTimerAlert(null)}
              className="text-slate-400 hover:text-slate-200 ml-4"
            >
              关闭
            </button>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-3.5">
          {enemyPlayers.map((enemy) => {
            const st = spellStateMap[enemy.puuid] ?? {
              hasCosmicInsight: enemy.hasCosmicInsight,
              hasIonianBoots: enemy.hasIonianBoots,
              flashRemainingSec: 0,
              secondaryRemainingSec: 0,
            };
            const primaryBaseCd = SPELL_BASE_CD_SECONDS[enemy.spell1Name] ?? 300;
            const flashCalc = calculateSummonerSpellCooldown(
              primaryBaseCd,
              st.hasCosmicInsight,
              st.hasIonianBoots
            );
            const secBaseCd = SPELL_BASE_CD_SECONDS[enemy.spell2Name] ?? 210;
            const secCalc = calculateSummonerSpellCooldown(
              secBaseCd,
              st.hasCosmicInsight,
              st.hasIonianBoots
            );

            return (
              <div
                key={enemy.puuid}
                className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800/80 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-rose-400">
                      {enemy.assignedRole} · {enemy.currentChampionName}
                    </span>
                    <span className="font-mono tabular-nums text-[11px] text-slate-400">
                      急速 +{flashCalc.totalSpellHaste}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 truncate mt-0.5">{enemy.gameName}</p>

                  {/* Haste toggles */}
                  <div className="mt-2.5 flex flex-col gap-1.5 text-xs">
                    <label className="flex items-center justify-between px-2 py-1 rounded bg-gray-900/80 border border-slate-800 cursor-pointer">
                      <span className="text-slate-300">星界洞悉 (+18)</span>
                      <input
                        type="checkbox"
                        checked={st.hasCosmicInsight}
                        onChange={() =>
                          handleToggleEnemyHaste(enemy.puuid, 'hasCosmicInsight')
                        }
                        className="accent-sky-400"
                      />
                    </label>
                    <label className="flex items-center justify-between px-2 py-1 rounded bg-gray-900/80 border border-slate-800 cursor-pointer">
                      <span className="text-slate-300">明朗之靴 (+10)</span>
                      <input
                        type="checkbox"
                        checked={st.hasIonianBoots}
                        onChange={() =>
                          handleToggleEnemyHaste(enemy.puuid, 'hasIonianBoots')
                        }
                        className="accent-sky-400"
                      />
                    </label>
                  </div>
                </div>

                {/* Spell countdown triggers */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800/80 font-mono tabular-nums">
                  <button
                    type="button"
                    onClick={() => handleStartSpellCountdown(enemy, 'FLASH')}
                    className={`w-full px-2.5 py-1.5 rounded text-xs font-semibold flex items-center justify-between transition-colors ${
                      st.flashRemainingSec > 0
                        ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300'
                        : 'bg-sky-500/15 border border-sky-500/40 text-sky-300 hover:bg-sky-500/25'
                    }`}
                  >
                    <span>
                      {enemy.spell1Name || '闪现'} ({flashCalc.realCooldownSeconds}s)
                    </span>
                    <span>
                      {st.flashRemainingSec > 0
                        ? `冷却 ${st.flashRemainingSec}s`
                        : '点主技能'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStartSpellCountdown(enemy, 'SECONDARY')}
                    className={`w-full px-2.5 py-1.5 rounded text-xs font-medium flex items-center justify-between transition-colors ${
                      st.secondaryRemainingSec > 0
                        ? 'bg-rose-500/20 border border-rose-500/50 text-rose-300'
                        : 'bg-gray-900 border border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span>
                      {enemy.spell2Name} ({secCalc.realCooldownSeconds}s)
                    </span>
                    <span>
                      {st.secondaryRemainingSec > 0
                        ? `冷却 ${st.secondaryRemainingSec}s`
                        : '记副技能'}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Row 2: Hextech Loot Mass Disenchant Workshop */}
      <section className="p-5 rounded-xl bg-gray-900/90 border border-slate-800/80">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <h2 className="font-display text-base font-bold text-slate-100">
              02. 海克斯战利品批量分解精粹计算工坊 (Hextech Loot Mass Disenchant)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              对标 LeagueAkari / Seraphine 战利品工坊：智能识别未拥有英雄与 6/7 级成就专精升级碎片，一键通过 LCU 批量合成接口回收精粹
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                {
                  id: 'KEEP_MASTERY_AND_UNOWNED',
                  label: '智能保留 (留未拥有+专精升级)',
                },
                {
                  id: 'DISENCHANT_DUPLICATES_ONLY',
                  label: '仅分解已拥有与多余重复项',
                },
                {
                  id: 'DISENCHANT_ALL',
                  label: '暴力全清 (全部分解换精粹)',
                },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setLootStrategy(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  lootStrategy === opt.id
                    ? 'bg-sky-500/20 border-sky-500/60 text-sky-300 font-semibold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Yield summary metrics */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3.5 font-mono tabular-nums">
          <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800/80">
            <div className="text-xs text-slate-400">预计回收蓝色精粹 (BE)</div>
            <div className="text-xl font-bold text-sky-400 mt-1">
              +{disenchantPlan.totalBlueEssenceYield.toLocaleString()} BE
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              CHAMPION_RENTAL_disenchant
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800/80">
            <div className="text-xs text-slate-400">预计回收橙色精粹 (OE)</div>
            <div className="text-xl font-bold text-amber-400 mt-1">
              +{disenchantPlan.totalOrangeEssenceYield.toLocaleString()} OE
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              SKIN_RENTAL_disenchant
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800/80">
            <div className="text-xs text-slate-400">本次分解 / 安全保留碎片数</div>
            <div className="text-lg font-bold text-emerald-400 mt-1 whitespace-nowrap">
              分解 {disenchantPlan.selectedShardsCount} 件 · 保留{' '}
              {disenchantPlan.retainedShardsCount} 件
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              共生成 {disenchantPlan.lcuBatchCraftCommands.length} 条 LCU 批处理指令
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800/80 flex flex-col justify-between">
            <div className="text-xs text-slate-400">LCU 战利品工坊批处理执行</div>
            <button
              type="button"
              disabled={isExecutingLoot}
              onClick={handleRunDisenchant}
              className="mt-2 w-full py-2 px-3 rounded-lg bg-sky-500 text-slate-950 font-sans text-xs font-semibold hover:bg-sky-400 transition-colors disabled:opacity-50"
            >
              {isExecutingLoot
                ? '正在提交 LCU 批处理...'
                : `一键批量分解 (${disenchantPlan.selectedShardsCount} 枚碎片)`}
            </button>
          </div>
        </div>

        {lootReceipt && (
          <div className="mt-3 px-4 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/40 text-xs text-emerald-300 font-mono tabular-nums">
            LCU 战利品批处理回执：已成功执行 {lootReceipt.craftedRecipesCount} 组 Recipe
            接口调用，入账 +{lootReceipt.blueEssenceAdded} 蓝色精粹 / +
            {lootReceipt.orangeEssenceAdded} 橙色精粹。
          </div>
        )}

        {/* Inventory Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 whitespace-nowrap">
                <th className="py-2 px-3">战利品碎片名称 (Loot ID)</th>
                <th className="py-2 px-3">库存数量</th>
                <th className="py-2 px-3">已拥有状态</th>
                <th className="py-2 px-3">成就专精需求</th>
                <th className="py-2 px-3">单件分解价值</th>
                <th className="py-2 px-3">当前策略执行动作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
              {activeLootShards.map((shard) => {
                const cmd = disenchantPlan.lcuBatchCraftCommands.find(
                  (c) => c.lootId === shard.lootId
                );
                const disenchantQty = cmd?.repeat ?? 0;
                const keepQty = shard.count - disenchantQty;

                return (
                  <tr key={shard.lootId} className="hover:bg-slate-950/60">
                    <td className="py-2.5 px-3 font-sans">
                      <span className="font-semibold text-slate-200">{shard.itemName}</span>
                      <span className="ml-2 font-mono text-[11px] text-slate-400">
                        ({shard.lootId})
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-200">x{shard.count}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={
                          shard.isOwnedChampionOrSkin ? 'text-slate-300' : 'text-amber-400'
                        }
                      >
                        {shard.isOwnedChampionOrSkin ? '已拥有' : '未拥有新藏品'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={
                          shard.neededForMasteryUpgrade
                            ? 'text-sky-400'
                            : 'text-slate-400'
                        }
                      >
                        {shard.neededForMasteryUpgrade ? '需保留升专精' : '无专精占用'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-200">
                      +{shard.valuePerUnit}{' '}
                      {shard.disenchantCurrency === 'BLUE_ESSENCE' ? 'BE' : 'OE'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-emerald-400">
                        分解 {disenchantQty} 件
                      </span>
                      <span className="text-slate-500 mx-1.5">·</span>
                      <span className="text-slate-400">保留 {keepQty} 件</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Row 3: SGP Cross-Region Spectator Builder + Client Profile Cosmetics & 5v5 Practice Lobby */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SGP Cross-Region Delay-Free Spectator Builder */}
        <section className="p-5 rounded-xl bg-gray-900/90 border border-slate-800/80 flex flex-col justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-bold text-slate-100">
              03. SGP 跨区免延迟 OB 观战启动器 (Cross-Region Spectator Launcher)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              通过 SGP 网关直接拉取任意大区在玩对局 EncryptionKey，生成原生客户端直连命令行
            </p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label
                  htmlFor="ob-summoner-input"
                  className="block text-slate-400 mb-1"
                >
                  目标召唤师名称或 PUUID (通过 RCU JWT → SGP /gsm/v1/ledge/spectator 穿透查询)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="ob-summoner-input"
                    type="text"
                    value={targetObSummoner}
                    onChange={(e) => setTargetObSummoner(e.target.value)}
                    placeholder="输入召唤师昵称或PUUID..."
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100"
                  />
                  <button
                    type="button"
                    disabled={isQueryingOb}
                    onClick={handleFetchLiveObCredentials}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-sky-400 border border-sky-500/40 font-semibold hover:bg-slate-700 transition-colors whitespace-nowrap disabled:opacity-50"
                  >
                    {isQueryingOb ? '查询中...' : '抓取实时对局密钥'}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="ob-region-select" className="block text-slate-400 mb-1">
                  目标观战大区节点
                </label>
                <select
                  id="ob-region-select"
                  value={selectedObRegion}
                  onChange={(e) => {
                    setSelectedObRegion(e.target.value);
                    setCustomObDomain(null);
                    setCustomObPort(null);
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100"
                >
                  {SGP_REGION_REGISTRY.map((reg) => (
                    <option key={reg.regionCode} value={reg.regionCode}>
                      {reg.regionName} ({reg.regionCode} · {reg.spectatorDomain})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="ob-gameid-input" className="block text-slate-400 mb-1">
                  SGP 对局 Game ID
                </label>
                <input
                  id="ob-gameid-input"
                  type="text"
                  value={obGameId}
                  onChange={(e) => setObGameId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 font-mono tabular-nums"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="ob-key-input" className="block text-slate-400 mb-1">
                  Spectator EncryptionKey (由 SGP /gsm/v1/ledge/spectator 动态签发)
                </label>
                <input
                  id="ob-key-input"
                  type="text"
                  value={obEncryptionKey}
                  onChange={(e) => setObEncryptionKey(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 font-mono"
                />
              </div>
            </div>

            <div className="mt-3 p-3 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-sky-300 break-all">
              {spectatorCliString}
            </div>
          </div>

          <div className="space-y-2">
            {obCopiedNotice && (
              <p className="text-xs text-emerald-400 font-mono">{obCopiedNotice}</p>
            )}
            <button
              type="button"
              onClick={handleCopyAndLaunchOb}
              className="w-full py-2 px-4 rounded-lg bg-sky-500 text-slate-950 text-xs font-semibold hover:bg-sky-400 transition-colors"
            >
              复制跨区 OB 直连命令行 / 唤起本地客户端观战
            </button>
          </div>
        </section>

        {/* Client Cosmetics Spoofer & 5v5 Practice Lobby Builder */}
        <section className="p-5 rounded-xl bg-gray-900/90 border border-slate-800/80 flex flex-col justify-between gap-4">
          <form onSubmit={handleApplyCosmetics} className="space-y-3 text-xs">
            <div>
              <h2 className="font-display text-base font-bold text-slate-100">
                04. 生涯皮肤背景替换、段位伪装与 5v5 训练房构建器
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                整合 Frank 与 LeaguePrank 特色功能：突破未拥有皮肤限制挂载生涯原画，定制展示段位与多人训练模式
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label htmlFor="skin-splash-select" className="block text-slate-400 mb-1">
                  生涯背景高清原画 (backgroundSkinId)
                </label>
                <select
                  id="skin-splash-select"
                  value={skinSplashId}
                  onChange={(e) => setSkinSplashId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100"
                >
                  {SKIN_SPLASH_PRESETS.map((skin) => (
                    <option key={skin.skinSplashId} value={skin.skinSplashId}>
                      {skin.skinName} (#{skin.skinSplashId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="spoof-tier-select" className="block text-slate-400 mb-1">
                  伪装展示段位 (PUT /lol-chat/v1/me)
                </label>
                <select
                  id="spoof-tier-select"
                  value={spoofTier}
                  onChange={(e) => setSpoofTier(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100"
                >
                  <option value="CHALLENGER">CHALLENGER (最强王者)</option>
                  <option value="GRANDMASTER">GRANDMASTER (傲世宗师)</option>
                  <option value="MASTER">MASTER (超凡大师)</option>
                  <option value="DIAMOND">DIAMOND (璀璨钻石)</option>
                </select>
              </div>

              <div>
                <label htmlFor="spoof-lp-input" className="block text-slate-400 mb-1">
                  伪装胜点 (LP) 与挑战水晶等级
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="spoof-lp-input"
                    type="number"
                    value={spoofLp}
                    onChange={(e) => setSpoofLp(Number(e.target.value))}
                    className="w-24 px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 font-mono tabular-nums"
                  />
                  <select
                    aria-label="挑战水晶等级"
                    value={challengeCrystalLevel}
                    onChange={(e) => setChallengeCrystalLevel(e.target.value)}
                    className="flex-1 px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100"
                  >
                    <option value="CHALLENGER">王者水晶</option>
                    <option value="GRANDMASTER">宗师水晶</option>
                    <option value="MASTER">大师水晶</option>
                  </select>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="status-msg-input" className="block text-slate-400 mb-1">
                  客户端好友列表自定义签名
                </label>
                <input
                  id="status-msg-input"
                  type="text"
                  value={statusMessage}
                  onChange={(e) => setStatusMessage(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100"
                />
              </div>
            </div>

            {cosmeticNotice && (
              <p className="text-xs text-emerald-400 font-mono">{cosmeticNotice}</p>
            )}

            <button
              type="submit"
              className="w-full py-2 px-4 rounded-lg bg-amber-500 text-slate-950 font-semibold hover:bg-amber-400 transition-colors"
            >
              同步应用生涯皮肤背景与王者段位伪装
            </button>
          </form>

          {/* 5v5 Practice Lobby Builder */}
          <form
            onSubmit={handleBuildPracticeLobby}
            className="pt-3 border-t border-slate-800/80 space-y-2.5 text-xs"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200">
                5v5 自定义训练模式房间解锁 (PRACTICETOOL)
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                POST /lol-lobby/v2/lobby
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                aria-label="训练房名称"
                value={practiceLobbyName}
                onChange={(e) => setPracticeLobbyName(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100"
              />
              <select
                aria-label="电脑人数量"
                value={practiceBotCount}
                onChange={(e) => setPracticeBotCount(Number(e.target.value))}
                className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 font-mono tabular-nums"
              >
                <option value={9}>+9 AI 机器人</option>
                <option value={5}>+5 AI 机器人</option>
                <option value={0}>无 AI 纯净房</option>
              </select>
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-sky-400 border border-sky-500/40 font-semibold hover:bg-slate-700 transition-colors whitespace-nowrap"
              >
                创建 5v5 训练房
              </button>
            </div>
            {practiceLobbyNotice && (
              <p className="text-xs text-sky-300 font-mono">{practiceLobbyNotice}</p>
            )}
          </form>
        </section>
      </div>
    </div>
  );
};
