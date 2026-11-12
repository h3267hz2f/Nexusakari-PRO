/**
 * NexusAkari Pro (v4) — Deterministic Mathematical & Tactical Engine
 * Implements zero-simplification formulas for:
 * 1. Context-Aware Role Performance Index (RPI v4) with Deficit Compensation & Dual Efficiency
 * 2. 16-Class NiuMa / Carry Dynamic Tagging State Machine
 * 3. Time-Decayed Union-Find Premade Squad & Rivalry Graph Detector
 * 4. Live Win-Probability Logistic Regression P(Win|t) & Throw-Point Extractor
 * 5. BP Team Composition Shannon Entropy & Skew Diagnosis
 * 6. Ranked Dodge Expected Value (EV) Decision Calculator
 * 7. Lobby Chat Anti-Censorship Obfuscator & Broadcaster
 * 8. Summoner Spell Haste Cooldown, Smite Threshold, ARAM EHP & Loot Mass Disenchant Math
 */

import {
  AramChampionBalance,
  AramEhpMetrics,
  BlacklistEntry,
  ChatReportMode,
  DamageType,
  DodgeEvResult,
  LootDisenchantPlan,
  LootItemShard,
  PlayerMatchStats,
  PremadeGroup,
  RivalryCollision,
  RoleType,
  RpiBreakdown,
  SummonerScoutProfile,
  SummonerTag,
  TagPolarity,
  TeamCompDiagnosis,
  ThrowPointEvidence,
  TimelineMinutePoint,
  WinProbPoint,
} from './types';

interface RoleBaselineVector {
  meanKda: number;
  stdKda: number;
  meanDpm: number;
  stdDpm: number;
  meanDmgEff: number;
  stdDmgEff: number;
  meanTankEff: number;
  stdTankEff: number;
  meanKp: number;
  stdKp: number;
  meanVspm: number;
  stdVspm: number;
  meanCsd15: number;
  stdCsd15: number;
  weights: {
    kda: number;
    dpm: number;
    dmgEff: number;
    tankEff: number;
    kp: number;
    vspm: number;
    csd15: number;
  };
}

const ROLE_BASELINES: Record<RoleType, RoleBaselineVector> = {
  [RoleType.TOP]: {
    meanKda: 2.4,
    stdKda: 1.15,
    meanDpm: 680,
    stdDpm: 210,
    meanDmgEff: 1.05,
    stdDmgEff: 0.28,
    meanTankEff: 1.45,
    stdTankEff: 0.42,
    meanKp: 0.48,
    stdKp: 0.14,
    meanVspm: 0.95,
    stdVspm: 0.35,
    meanCsd15: 0,
    stdCsd15: 14,
    weights: { kda: 0.16, dpm: 0.16, dmgEff: 0.16, tankEff: 0.22, kp: 0.12, vspm: 0.06, csd15: 0.12 },
  },
  [RoleType.JGL]: {
    meanKda: 3.1,
    stdKda: 1.35,
    meanDpm: 560,
    stdDpm: 185,
    meanDmgEff: 0.95,
    stdDmgEff: 0.25,
    meanTankEff: 1.35,
    stdTankEff: 0.38,
    meanKp: 0.64,
    stdKp: 0.13,
    meanVspm: 1.35,
    stdVspm: 0.42,
    meanCsd15: 0,
    stdCsd15: 12,
    weights: { kda: 0.18, dpm: 0.12, dmgEff: 0.14, tankEff: 0.16, kp: 0.22, vspm: 0.10, csd15: 0.08 },
  },
  [RoleType.MID]: {
    meanKda: 2.85,
    stdKda: 1.25,
    meanDpm: 760,
    stdDpm: 230,
    meanDmgEff: 1.22,
    stdDmgEff: 0.30,
    meanTankEff: 0.85,
    stdTankEff: 0.28,
    meanKp: 0.56,
    stdKp: 0.13,
    meanVspm: 1.05,
    stdVspm: 0.35,
    meanCsd15: 0,
    stdCsd15: 13,
    weights: { kda: 0.18, dpm: 0.22, dmgEff: 0.24, tankEff: 0.06, kp: 0.14, vspm: 0.06, csd15: 0.10 },
  },
  [RoleType.BOT]: {
    meanKda: 3.0,
    stdKda: 1.3,
    meanDpm: 820,
    stdDpm: 250,
    meanDmgEff: 1.28,
    stdDmgEff: 0.32,
    meanTankEff: 0.72,
    stdTankEff: 0.24,
    meanKp: 0.54,
    stdKp: 0.13,
    meanVspm: 1.0,
    stdVspm: 0.32,
    meanCsd15: 0,
    stdCsd15: 15,
    weights: { kda: 0.18, dpm: 0.24, dmgEff: 0.26, tankEff: 0.04, kp: 0.12, vspm: 0.04, csd15: 0.12 },
  },
  [RoleType.SUP]: {
    meanKda: 3.2,
    stdKda: 1.4,
    meanDpm: 320,
    stdDpm: 140,
    meanDmgEff: 0.82,
    stdDmgEff: 0.26,
    meanTankEff: 1.25,
    stdTankEff: 0.45,
    meanKp: 0.68,
    stdKp: 0.12,
    meanVspm: 2.45,
    stdVspm: 0.65,
    meanCsd15: 0,
    stdCsd15: 6,
    weights: { kda: 0.18, dpm: 0.06, dmgEff: 0.08, tankEff: 0.16, kp: 0.24, vspm: 0.24, csd15: 0.04 },
  },
};

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function roundTo(val: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

/**
 * 1. Context-Aware Role Performance Index (RPI v4)
 * Incorporates role-normalized Z-scores, dual gold efficiency (Damage & Tank),
 * and deficit anti-pressure compensation factor gamma_deficit in [1.0, 1.35].
 */
export function calculateContextAwareRpi(stats: PlayerMatchStats): RpiBreakdown {
  const baseline = ROLE_BASELINES[stats.role] ?? ROLE_BASELINES[RoleType.MID];
  const duration = Math.max(stats.durationMinutes, 10);

  const kdaRatio = (stats.kills + stats.assists) / Math.max(1, stats.deaths);
  const dpm = stats.damageDealt / duration;
  const vspm = stats.visionScore / duration;

  const goldShare = clamp(stats.goldEarned / Math.max(1, stats.teamTotalGold), 0.08, 0.45);
  const damageShare = clamp(stats.damageDealt / Math.max(1, stats.teamTotalDamage), 0, 0.75);
  const damageTakenShare = clamp(
    stats.damageTaken / Math.max(1, stats.teamTotalDamageTaken),
    0,
    0.75
  );
  const deathShare = clamp(stats.deaths / Math.max(1, stats.teamTotalDeaths), 0, 1);
  const killParticipation = clamp(
    (stats.kills + stats.assists) / Math.max(1, stats.teamTotalKills),
    0,
    1
  );

  // Dual Efficiency Metrics
  const damageEfficiencyEta = damageShare / Math.max(goldShare, 0.08);
  const selfMitigatedRatio = clamp(
    stats.selfMitigatedDamage / Math.max(1, stats.damageTaken + stats.selfMitigatedDamage),
    0,
    0.85
  );
  const tankEfficiencyEta =
    (damageTakenShare * (1 + 0.5 * selfMitigatedRatio)) / Math.max(goldShare, 0.08);

  // Standardized Z-scores clamped to [-2.6, +2.8] to prevent extreme outlier distortion
  const zKda = clamp((kdaRatio - baseline.meanKda) / baseline.stdKda, -2.6, 2.8);
  const zDpm = clamp((dpm - baseline.meanDpm) / baseline.stdDpm, -2.6, 2.8);
  const zDmgEff = clamp(
    (damageEfficiencyEta - baseline.meanDmgEff) / baseline.stdDmgEff,
    -2.6,
    2.8
  );
  const zTankEff = clamp(
    (tankEfficiencyEta - baseline.meanTankEff) / baseline.stdTankEff,
    -2.6,
    2.8
  );
  const zKp = clamp((killParticipation - baseline.meanKp) / baseline.stdKp, -2.6, 2.8);
  const zVspm = clamp((vspm - baseline.meanVspm) / baseline.stdVspm, -2.6, 2.8);
  const zCsd15 = clamp((stats.csDiffAt15 - baseline.meanCsd15) / baseline.stdCsd15, -2.6, 2.8);

  const rawZScoreSum =
    baseline.weights.kda * zKda +
    baseline.weights.dpm * zDpm +
    baseline.weights.dmgEff * zDmgEff +
    baseline.weights.tankEff * zTankEff +
    baseline.weights.kp * zKp +
    baseline.weights.vspm * zVspm +
    baseline.weights.csd15 * zCsd15;

  // Deficit Anti-Pressure Compensation Gamma
  const teamGoldDeficitRatio =
    (stats.teamTotalGold - stats.enemyTotalGold) / Math.max(1, stats.enemyTotalGold);
  let deficitCompensationGamma = 1.0;
  if (teamGoldDeficitRatio < -0.06 && deathShare <= 0.20 && killParticipation >= 0.52) {
    deficitCompensationGamma =
      1.0 + clamp(Math.abs(teamGoldDeficitRatio) * 1.25 * (1 - deathShare), 0, 0.35);
  }

  const baseScore = 52 + 16.5 * rawZScoreSum + (stats.win ? 3.5 : -2.0);
  const rpiScore = roundTo(clamp(baseScore * deficitCompensationGamma, 8, 99.5), 1);

  let gradeLabel: RpiBreakdown['gradeLabel'] = 'B';
  if (rpiScore >= 86) gradeLabel = 'S+';
  else if (rpiScore >= 76) gradeLabel = 'S';
  else if (rpiScore >= 65) gradeLabel = 'A';
  else if (rpiScore >= 52) gradeLabel = 'B';
  else if (rpiScore >= 40) gradeLabel = 'C';
  else gradeLabel = 'D';

  const sixDimRadar = {
    combatOutput: Math.round(clamp(50 + 20 * (0.6 * zDpm + 0.4 * zKp), 15, 99)),
    goldConversion: Math.round(clamp(50 + 22 * zDmgEff, 15, 99)),
    frontlineSurvival: Math.round(
      clamp(50 + 18 * zTankEff + 15 * (0.22 - deathShare), 15, 99)
    ),
    macroVision: Math.round(clamp(50 + 22 * zVspm, 15, 99)),
    laningDominance: Math.round(
      clamp(50 + 18 * zCsd15 + (stats.goldDiffAt15 / 1200) * 16, 15, 99)
    ),
    objectiveTempo: Math.round(
      clamp(
        50 +
          18 * zKp +
          (stats.firstBloodKill ? 10 : 0) +
          stats.objectiveStolen * 12 +
          (stats.ccScoreSeconds / duration) * 8,
        15,
        99
      )
    ),
  };

  return {
    rpiScore,
    rawZScoreSum: roundTo(rawZScoreSum, 3),
    damageEfficiencyEta: roundTo(damageEfficiencyEta, 2),
    tankEfficiencyEta: roundTo(tankEfficiencyEta, 2),
    deficitCompensationGamma: roundTo(deficitCompensationGamma, 2),
    killParticipation: roundTo(killParticipation, 2),
    damageShare: roundTo(damageShare, 2),
    damageTakenShare: roundTo(damageTakenShare, 2),
    goldShare: roundTo(goldShare, 2),
    deathShare: roundTo(deathShare, 2),
    dpm: Math.round(dpm),
    vspm: roundTo(vspm, 2),
    kdaRatio: roundTo(kdaRatio, 2),
    gradeLabel,
    sixDimRadar,
  };
}

/**
 * 2. 16-Class Dynamic NiuMa / Carry Tagging State Machine
 * Evaluates recent match history and RPI breakdowns to produce prioritized, non-conflicting tags.
 */
export function evaluateSummonerTags(
  matches: PlayerMatchStats[],
  premadeGroupId?: string,
  blacklistHit?: BlacklistEntry
): SummonerTag[] {
  if (matches.length === 0) return [];

  const breakdowns = matches.map((m) => calculateContextAwareRpi(m));
  const avgRpi = breakdowns.reduce((acc, b) => acc + b.rpiScore, 0) / breakdowns.length;
  const avgDmgEta =
    breakdowns.reduce((acc, b) => acc + b.damageEfficiencyEta, 0) / breakdowns.length;
  const avgTankEta =
    breakdowns.reduce((acc, b) => acc + b.tankEfficiencyEta, 0) / breakdowns.length;
  const avgKp = breakdowns.reduce((acc, b) => acc + b.killParticipation, 0) / breakdowns.length;
  const avgVspm = breakdowns.reduce((acc, b) => acc + b.vspm, 0) / breakdowns.length;
  const avgDeathShare =
    breakdowns.reduce((acc, b) => acc + b.deathShare, 0) / breakdowns.length;
  const avgKda = breakdowns.reduce((acc, b) => acc + b.kdaRatio, 0) / breakdowns.length;

  const wins = matches.filter((m) => m.win).length;
  const winRate = wins / matches.length;

  // Consecutive streak from index 0 (most recent)
  let winStreak = 0;
  let lossStreak = 0;
  for (const m of matches) {
    if (m.win) {
      if (lossStreak > 0) break;
      winStreak++;
    } else {
      if (winStreak > 0) break;
      lossStreak++;
    }
  }

  // Champion pool concentration
  const champCounts = new Map<string, number>();
  for (const m of matches) {
    champCounts.set(m.championName, (champCounts.get(m.championName) ?? 0) + 1);
  }
  let topChamp = '';
  let topChampCount = 0;
  champCounts.forEach((cnt, name) => {
    if (cnt > topChampCount) {
      topChampCount = cnt;
      topChamp = name;
    }
  });

  const svpGames = matches.filter((m, idx) => !m.win && breakdowns[idx].rpiScore >= 73).length;

  const tags: SummonerTag[] = [];

  // Tag 0: Blacklist / Follow Ledger Hit
  if (blacklistHit) {
    if (blacklistHit.listType === 'BLACKLIST_DODGE') {
      tags.push({
        id: 'BLACKLIST_HIT',
        label: `黑名单高危 · ${blacklistHit.reasonTag}`,
        polarity: TagPolarity.HAZARD,
        priority: 100,
        description: blacklistHit.customNote,
        metricProof: `曾于 ${blacklistHit.recordedMatchId} 触发拉黑`,
      });
    } else {
      tags.push({
        id: 'FOLLOW_CARRY_HIT',
        label: `关注榜大腿 · ${blacklistHit.reasonTag}`,
        polarity: TagPolarity.CARRY,
        priority: 98,
        description: blacklistHit.customNote,
        metricProof: `历史标记真大腿`,
      });
    }
  }

  // Tag 1: 通天代·真神
  if (avgRpi >= 80 && winRate >= 0.7) {
    tags.push({
      id: 'GOD_CARRY',
      label: '通天代 · 真神核心',
      polarity: TagPolarity.CARRY,
      priority: 95,
      description: '近期综合 RPI 与胜率双项碾压同分段基准',
      metricProof: `RPI ${roundTo(avgRpi, 1)} · 胜率 ${Math.round(winRate * 100)}%`,
    });
  }

  // Tag 2: 尽力局·悲情SVP
  if (svpGames >= 2 || (avgRpi >= 72 && winRate < 0.5)) {
    tags.push({
      id: 'TRAGIC_SVP',
      label: '尽力局 · 孤胆SVP',
      polarity: TagPolarity.CARRY,
      priority: 90,
      description: '多次在团队逆风溃败中打出极高抗压评分与伤害转化',
      metricProof: `近期 ${svpGames} 场逆风SVP · RPI ${roundTo(avgRpi, 1)}`,
    });
  }

  // Tag 3: 纯血牛马·突破口
  if (avgRpi <= 42 && avgDeathShare >= 0.26) {
    tags.push({
      id: 'PURE_NIUMA',
      label: '纯血牛马 · 突破口',
      polarity: TagPolarity.HAZARD,
      priority: 94,
      description: '近期死亡占比极高且经济转化严重断档，极易成为对线突破口',
      metricProof: `RPI ${roundTo(avgRpi, 1)} · 死亡占比 ${Math.round(avgDeathShare * 100)}%`,
    });
  }

  // Tag 4: 高危连败·心态爆炸
  if (lossStreak >= 3) {
    tags.push({
      id: 'LOSS_STREAK_TILT',
      label: `高危 ${lossStreak} 连败 · 谨防摆烂`,
      polarity: TagPolarity.HAZARD,
      priority: 88,
      description: '正处于连续落败区间，操作变形与投降倾向显著上升',
      metricProof: `近期连续 ${lossStreak} 场落败`,
    });
  }

  // Tag 5: 连胜火热手感
  if (winStreak >= 3) {
    tags.push({
      id: 'WIN_STREAK_HOT',
      label: `${winStreak} 连胜 · 手感发烫`,
      polarity: TagPolarity.CARRY,
      priority: 84,
      description: '正处于连胜上升期，竞技状态与滚雪球节奏极佳',
      metricProof: `近期连续 ${winStreak} 场获胜`,
    });
  }

  // Tag 6: 伤害转化机器
  if (avgDmgEta >= 1.32) {
    tags.push({
      id: 'DAMAGE_ENGINE',
      label: '伤害转化机器',
      polarity: TagPolarity.CARRY,
      priority: 82,
      description: '每一分经济均能打出远超位置基准的爆炸输出',
      metricProof: `平均伤害转化率 ${roundTo(avgDmgEta * 100, 0)}%`,
    });
  }

  // Tag 7: 吃草挤奶·蓝领磐石
  if (avgTankEta >= 1.55 && avgDeathShare <= 0.22) {
    tags.push({
      id: 'BLUE_COLLAR_ROCK',
      label: '吃草挤奶 · 蓝领磐石',
      polarity: TagPolarity.CARRY,
      priority: 80,
      description: '以极低经济占比承担全队核心前排抗伤与控制职责',
      metricProof: `承伤转化率 ${roundTo(avgTankEta * 100, 0)}%`,
    });
  }

  // Tag 8: 隐身混子·KDA保卫者
  if (avgKda >= 3.2 && avgKp <= 0.42 && avgDmgEta <= 0.85) {
    tags.push({
      id: 'KDA_PASSENGER',
      label: '隐身混子 · KDA保卫者',
      polarity: TagPolarity.WARNING,
      priority: 78,
      description: '账面 KDA 尚可，但参团率与实际伤害转化显著偏低，团战边缘OB',
      metricProof: `参团率 ${Math.round(avgKp * 100)}% · 转化 ${roundTo(avgDmgEta * 100, 0)}%`,
    });
  }

  // Tag 9: 节奏发动机
  if (avgKp >= 0.68 && avgRpi >= 64) {
    tags.push({
      id: 'TEMPO_ENGINE',
      label: '全图节奏发动机',
      polarity: TagPolarity.CARRY,
      priority: 76,
      description: '游走支援与小规模团战参与度极高，擅长带动前期节奏',
      metricProof: `场均参团率 ${Math.round(avgKp * 100)}%`,
    });
  }

  // Tag 10: 绝活哥·专精怪
  if (topChampCount / matches.length >= 0.6 && matches.length >= 4 && winRate >= 0.55) {
    tags.push({
      id: 'ONE_TRICK_MASTER',
      label: `${topChamp} 绝活哥`,
      polarity: TagPolarity.CARRY,
      priority: 75,
      description: `高度专精单一英雄，熟练度与对线细节拉满`,
      metricProof: `${topChamp} 占比 ${Math.round((topChampCount / matches.length) * 100)}%`,
    });
  }

  // Tag 11: 视野灯塔
  if (avgVspm >= 2.2) {
    tags.push({
      id: 'VISION_BEACON',
      label: '全图视野灯塔',
      polarity: TagPolarity.CARRY,
      priority: 72,
      description: '眼位布控与排眼效率极高，极大压缩敌方打野Gank空间',
      metricProof: `分均视野得分 ${roundTo(avgVspm, 2)}`,
    });
  }

  // Tag 12: 视野盲区
  if (avgVspm <= 0.68 && matches[0].role !== RoleType.BOT) {
    tags.push({
      id: 'VISION_BLIND',
      label: '视野盲区 · 易被抓',
      polarity: TagPolarity.WARNING,
      priority: 70,
      description: '分均插眼与控制守卫购买极少，极易遭到敌方野辅军训',
      metricProof: `分均视野仅 ${roundTo(avgVspm, 2)}`,
    });
  }

  // Tag 13: 暴毙惯犯
  if (avgDeathShare >= 0.28 && avgRpi > 42) {
    tags.push({
      id: 'CHRONIC_OVEREXTENDER',
      label: '上头暴毙惯犯',
      polarity: TagPolarity.WARNING,
      priority: 68,
      description: '打法激进但容易在中后期单带或团战站位脱节给机会',
      metricProof: `场均死亡占比 ${Math.round(avgDeathShare * 100)}%`,
    });
  }

  // Tag 14: 开黑车队标签
  if (premadeGroupId) {
    tags.push({
      id: 'PREMADE_MEMBER',
      label: premadeGroupId,
      polarity: TagPolarity.NEUTRAL,
      priority: 86,
      description: '通过近期对局共现图谱识别出的固定组排车队成员',
      metricProof: `组排协同连线已锁定`,
    });
  }

  // Ensure at least one neutral summary tag if none triggered
  if (tags.length === 0) {
    tags.push({
      id: 'STEADY_REGULAR',
      label: '稳健常规轮换',
      polarity: TagPolarity.NEUTRAL,
      priority: 50,
      description: '各项指标处于当前分段标准差区间内，发挥平稳',
      metricProof: `RPI ${roundTo(avgRpi, 1)} · KDA ${roundTo(avgKda, 2)}`,
    });
  }

  return tags.sort((a, b) => b.priority - a.priority).slice(0, 4);
}

/**
 * 3. Time-Decayed Union-Find Premade Squad & Rivalry Detector
 * Analyzes co-occurrence across players' recent match histories with decay w(t) = exp(-lambda * dt_hours).
 */
export function detectPremadeSquads(players: SummonerScoutProfile[]): {
  premadeGroups: PremadeGroup[];
  rivalries: RivalryCollision[];
} {
  const lambda = 0.035; // Decay per hour
  const premadeThreshold = 1.35; // Requires >= 2 recent co-games or high recency weight
  const allMatchTimestamps = players.flatMap((p) =>
    p.recentMatches.map((m) => m.gameTimestamp)
  );
  const nowMs =
    allMatchTimestamps.length > 0 ? Math.max(...allMatchTimestamps) : Date.now();

  const premadeGroups: PremadeGroup[] = [];
  const rivalries: RivalryCollision[] = [];

  for (const side of ['ALLY', 'ENEMY'] as const) {
    const sidePlayers = players.filter((p) => p.teamSide === side);
    const parent = new Map<string, string>();
    sidePlayers.forEach((p) => parent.set(p.puuid, p.puuid));

    const find = (x: string): string => {
      const p = parent.get(x) ?? x;
      if (p !== x) {
        const root = find(p);
        parent.set(x, root);
        return root;
      }
      return x;
    };

    const union = (a: string, b: string) => {
      const rootA = find(a);
      const rootB = find(b);
      if (rootA !== rootB) parent.set(rootB, rootA);
    };

    const pairStats = new Map<
      string,
      { count: number; weight: number; wins: number }
    >();

    for (let i = 0; i < sidePlayers.length; i++) {
      for (let j = i + 1; j < sidePlayers.length; j++) {
        const u = sidePlayers[i];
        const v = sidePlayers[j];
        let count = 0;
        let weight = 0;
        let wins = 0;

        for (const match of u.recentMatches) {
          if (match.coPlayerPuuids.includes(v.puuid)) {
            count++;
            if (match.win) wins++;
            const hoursAgo = Math.max(0, (nowMs - match.gameTimestamp) / (1000 * 3600));
            weight += Math.exp(-lambda * hoursAgo);
          }
        }

        if (count >= 2 && weight >= premadeThreshold) {
          union(u.puuid, v.puuid);
          pairStats.set(`${u.puuid}:${v.puuid}`, { count, weight, wins });
        }
      }
    }

    // Group connected components with size >= 2
    const components = new Map<string, SummonerScoutProfile[]>();
    for (const p of sidePlayers) {
      const root = find(p.puuid);
      const list = components.get(root) ?? [];
      list.push(p);
      components.set(root, list);
    }

    let squadIndex = 0;
    const squadLetters = ['A', 'B', 'C', 'D'];
    components.forEach((members) => {
      if (members.length >= 2) {
        const letter = squadLetters[squadIndex % squadLetters.length];
        squadIndex++;
        const sizePrefix =
          members.length === 2
            ? '双排车队'
            : members.length === 3
            ? '三排车队'
            : '多排车队';
        const sidePrefix = side === 'ALLY' ? '我方' : '敌方';

        let maxCount = 2;
        let maxWeight = premadeThreshold;
        let totalWins = 0;
        let totalPairs = 0;

        for (let i = 0; i < members.length; i++) {
          for (let j = i + 1; j < members.length; j++) {
            const key = `${members[i].puuid}:${members[j].puuid}`;
            const st = pairStats.get(key);
            if (st) {
              maxCount = Math.max(maxCount, st.count);
              maxWeight = Math.max(maxWeight, st.weight);
              totalWins += st.wins / Math.max(1, st.count);
              totalPairs++;
            }
          }
        }

        premadeGroups.push({
          groupId: `${sidePrefix}${sizePrefix} #${letter}`,
          teamSide: side,
          memberPuuids: members.map((m) => m.puuid),
          coOccurrenceCount: maxCount,
          decayedWeight: roundTo(maxWeight, 2),
          synergyWinRate: roundTo(totalPairs > 0 ? totalWins / totalPairs : 0.6, 2),
        });
      }
    });
  }

  // Detect Cross-Team Rivalry Collisions (宿敌撞车)
  const allies = players.filter((p) => p.teamSide === 'ALLY');
  const enemies = players.filter((p) => p.teamSide === 'ENEMY');
  for (const ally of allies) {
    for (const enemy of enemies) {
      let clashCount = 0;
      for (const m of ally.recentMatches) {
        if (m.enemyPuuids.includes(enemy.puuid) || m.coPlayerPuuids.includes(enemy.puuid)) {
          clashCount++;
        }
      }
      if (clashCount >= 2) {
        rivalries.push({
          allyPuuid: ally.puuid,
          enemyPuuid: enemy.puuid,
          previousClashes: clashCount,
          note: `${ally.gameName} 与 ${enemy.gameName} 近期高分段撞车 ${clashCount} 次`,
        });
      }
    }
  }

  return { premadeGroups, rivalries };
}

/**
 * 4. Live Win-Probability Logistic Regression P(Win|t) & Throw-Point Detector
 * Computes minute-by-minute win probability and extracts top turning/throw points.
 */
export function analyzeWinProbabilityAndThrows(
  timeline: TimelineMinutePoint[],
  blueScalingBonus = 0
): {
  winProbCurve: WinProbPoint[];
  throwPoints: ThrowPointEvidence[];
} {
  const winProbCurve: WinProbPoint[] = [];
  const rawSwings: Array<{
    point: TimelineMinutePoint;
    probBefore: number;
    probAfter: number;
    swing: number;
  }> = [];

  for (let i = 0; i < timeline.length; i++) {
    const pt = timeline[i];
    const t = Math.max(1, pt.minute);
    const goldDiff = pt.blueGold - pt.redGold;
    const dragonDiff = pt.blueDragons - pt.redDragons;
    const baronDiff = pt.blueBarons - pt.redBarons;
    const towerDiff = pt.blueTowers - pt.redTowers;
    const killDiff = pt.blueKills - pt.redKills;

    // Logistic regression logit z(t)
    const normalizedGoldTerm = (0.34 * goldDiff) / (1000 * (1 + 0.075 * t));
    const objectiveTerm =
      0.42 * dragonDiff + 0.96 * baronDiff + 0.26 * towerDiff + 0.04 * killDiff;
    const scalingTerm = t >= 25 ? blueScalingBonus * ((t - 22) / 15) : 0;

    const logit = normalizedGoldTerm + objectiveTerm + scalingTerm;
    const blueWinProbability = roundTo(clamp(1 / (1 + Math.exp(-logit)), 0.02, 0.98), 3);

    // Walk backward to find a sample point at least 2 minutes earlier (supports both 1-min live LCU timelines and coarse replay frames)
    let lookbackIdx = Math.max(0, i - 1);
    while (lookbackIdx > 0 && pt.minute - timeline[lookbackIdx].minute < 2) {
      lookbackIdx--;
    }
    const prevProb = i === 0 ? 0.5 : winProbCurve[lookbackIdx].blueWinProbability;
    const probDelta2Min = roundTo(blueWinProbability - prevProb, 3);
    const isTurningPoint = Math.abs(probDelta2Min) >= 0.16 && Boolean(pt.eventSummary);

    winProbCurve.push({
      minute: pt.minute,
      blueWinProbability,
      goldDiff,
      probDelta2Min,
      isTurningPoint,
      eventSummary: pt.eventSummary,
    });

    if (isTurningPoint && pt.eventSummary) {
      rawSwings.push({
        point: pt,
        probBefore: prevProb,
        probAfter: blueWinProbability,
        swing: probDelta2Min,
      });
    }
  }

  // Sort by absolute swing magnitude descending, take Top 3
  const throwPoints: ThrowPointEvidence[] = rawSwings
    .sort((a, b) => Math.abs(b.swing) - Math.abs(a.swing))
    .slice(0, 3)
    .map((item) => {
      const absSwing = Math.abs(item.swing);
      let severityLabel: ThrowPointEvidence['severityLabel'] = '节奏断档点 (Tempo Loss)';
      if (absSwing >= 0.28) severityLabel = '致命葬送点 (Fatal Throw)';
      else if (absSwing >= 0.20) severityLabel = '核心胜负手 (Critical Swing)';

      return {
        minute: item.point.minute,
        probBefore: item.probBefore,
        probAfter: item.probAfter,
        probSwing: item.swing,
        favoredTeamAfter: item.probAfter >= 0.5 ? 'BLUE' : 'RED',
        culpritOrHeroName: item.point.involvedPlayerName ?? '核心团战位',
        championName: item.point.involvedChampionName ?? '未知英雄',
        eventDescription: item.point.eventSummary ?? '关键资源团战转折',
        severityLabel,
      };
    });

  return { winProbCurve, throwPoints };
}

const ROLE_DAMAGE_CONTRIBUTION_WEIGHT: Record<RoleType, number> = {
  [RoleType.TOP]: 1.0,
  [RoleType.JGL]: 0.85,
  [RoleType.MID]: 1.3,
  [RoleType.BOT]: 1.4,
  [RoleType.SUP]: 0.25,
};

/**
 * 5. BP Team Composition 3D Damage Entropy & Frontline/CC Diagnosis
 */
export function diagnoseTeamComposition(allies: SummonerScoutProfile[]): TeamCompDiagnosis {
  if (allies.length === 0) {
    return {
      physicalRatio: 0.5,
      magicRatio: 0.4,
      trueDamageRatio: 0.1,
      shannonEntropy: 1.2,
      skewWarning: null,
      isSkewed: false,
      frontlineScore: 50,
      engageCcScore: 50,
      waveclearScore: 50,
      scalingScore: 50,
      overallCompGrade: 'B',
      tacticalAdvice: '等待选人锁定以评估阵容三维构成',
    };
  }

  let adWeight = 0;
  let apWeight = 0;
  let trueWeight = 0;
  let frontlineSum = 0;
  let ccSum = 0;
  let waveclearSum = 0;
  let scalingSum = 0;

  for (const p of allies) {
    const roleWeight = ROLE_DAMAGE_CONTRIBUTION_WEIGHT[p.assignedRole] ?? 1.0;
    if (p.championDamageType === DamageType.PHYSICAL) {
      adWeight += roleWeight * 0.94;
      trueWeight += roleWeight * 0.06;
    } else if (p.championDamageType === DamageType.MAGIC) {
      apWeight += roleWeight * 0.94;
      trueWeight += roleWeight * 0.06;
    } else if (p.championDamageType === DamageType.TRUE) {
      adWeight += roleWeight * 0.55;
      trueWeight += roleWeight * 0.45;
    } else {
      adWeight += roleWeight * 0.46;
      apWeight += roleWeight * 0.46;
      trueWeight += roleWeight * 0.08;
    }
    frontlineSum += p.frontlineRating;
    ccSum += p.ccRating;
    waveclearSum += p.waveclearRating;
    scalingSum += p.lateScalingRating;
  }

  const totalDmg = Math.max(0.01, adWeight + apWeight + trueWeight);
  const physicalRatio = roundTo(adWeight / totalDmg, 2);
  const magicRatio = roundTo(apWeight / totalDmg, 2);
  const trueDamageRatio = roundTo(Math.max(0, 1 - physicalRatio - magicRatio), 2);

  // Shannon Entropy H = -sum(p_i * log2(p_i))
  const probs = [physicalRatio, magicRatio, Math.max(0.01, trueDamageRatio)];
  const shannonEntropy = roundTo(
    -probs.reduce((acc, p) => (p > 0 ? acc + p * Math.log2(p) : acc), 0),
    3
  );

  let skewWarning: string | null = null;
  let isSkewed = false;
  if (physicalRatio >= 0.76 && trueDamageRatio < 0.16) {
    isSkewed = true;
    skewWarning = `高危纯菜刀队预警（物理占比 ${Math.round(physicalRatio * 100)}%），敌方叠护甲后团战极难处理前排！`;
  } else if (magicRatio >= 0.76 && trueDamageRatio < 0.16) {
    isSkewed = true;
    skewWarning = `高危纯AP阵容预警（魔法占比 ${Math.round(magicRatio * 100)}%），敌方出自然之力/振奋后输出严重匮乏！`;
  }

  const frontlineScore = Math.round(clamp((frontlineSum / (allies.length * 7.5)) * 100, 15, 99));
  const engageCcScore = Math.round(clamp((ccSum / (allies.length * 7.2)) * 100, 15, 99));
  const waveclearScore = Math.round(clamp((waveclearSum / (allies.length * 7.0)) * 100, 15, 99));
  const scalingScore = Math.round(clamp((scalingSum / (allies.length * 7.2)) * 100, 15, 99));

  const composite =
    0.28 * frontlineScore +
    0.28 * engageCcScore +
    0.22 * waveclearScore +
    0.22 * scalingScore -
    (isSkewed ? 18 : 0);

  let overallCompGrade: TeamCompDiagnosis['overallCompGrade'] = 'B';
  if (composite >= 82) overallCompGrade = 'S';
  else if (composite >= 70) overallCompGrade = 'A';
  else if (composite >= 56) overallCompGrade = 'B';
  else if (composite >= 44) overallCompGrade = 'C';
  else overallCompGrade = 'D';

  let tacticalAdvice = '阵容伤害结构均衡，具备标准前排与控制链，可围绕下半区小龙稳步推进。';
  if (isSkewed) {
    tacticalAdvice = `${skewWarning} 建议尽早合成黑切/轻语或虚空之杖，并在25分钟前终结比赛。`;
  } else if (frontlineScore < 48) {
    tacticalAdvice = '己方前排坦度严重不足（脆皮阵容），切忌河道狭窄地形接正面对冲团，建议分带拉扯。';
  }

  return {
    physicalRatio,
    magicRatio,
    trueDamageRatio,
    shannonEntropy,
    skewWarning,
    isSkewed,
    frontlineScore,
    engageCcScore,
    waveclearScore,
    scalingScore,
    overallCompGrade,
    tacticalAdvice,
  };
}

/**
 * 6. Ranked Dodge Expected Value (EV) Decision Calculator
 */
export function calculateDodgeExpectedValue(
  allies: SummonerScoutProfile[],
  compDiagnosis: TeamCompDiagnosis,
  blacklistLedger: BlacklistEntry[],
  dodgeCountToday: number
): DodgeEvResult {
  const blacklistMap = new Map<string, BlacklistEntry>();
  for (const entry of blacklistLedger) {
    if (entry.listType === 'BLACKLIST_DODGE') {
      blacklistMap.set(entry.puuid, entry);
    }
  }

  const blacklistHits: BlacklistEntry[] = [];
  for (const ally of allies) {
    const hit = blacklistMap.get(ally.puuid);
    if (hit) blacklistHits.push(hit);
  }

  // Penalty Tiers in Ranked Solo
  const dodgeLpPenalty = dodgeCountToday === 0 ? 5 : 15;
  const dodgeLockoutMinutes =
    dodgeCountToday === 0 ? 6 : dodgeCountToday === 1 ? 30 : 720;

  // Estimate team win probability from allies' average RPI, comp skew, and blacklist hits
  const avgTeamRpi =
    allies.length > 0
      ? allies.reduce((s, a) => s + a.averageRpi, 0) / allies.length
      : 55;
  const niumaCount = allies.filter((a) =>
    a.tags.some((t) => t.id === 'PURE_NIUMA' || t.id === 'LOSS_STREAK_TILT')
  ).length;

  const baseWinProb = 0.5 + (avgTeamRpi - 58) * 0.0085;
  const skewPenalty = compDiagnosis.isSkewed ? -0.055 : 0;
  const blacklistPenalty = blacklistHits.length * -0.11;
  const niumaPenalty = Math.max(0, niumaCount - 1) * -0.045;

  const estimatedTeamWinProb = roundTo(
    clamp(baseWinProb + skewPenalty + blacklistPenalty + niumaPenalty, 0.18, 0.82),
    3
  );

  const lpGainOnWin = 24;
  const lpLossOnDefeat = 22;
  const expectedPlayLpDelta = roundTo(
    estimatedTeamWinProb * lpGainOnWin - (1 - estimatedTeamWinProb) * lpLossOnDefeat,
    1
  );
  const expectedPlayMmrDelta = roundTo((estimatedTeamWinProb - 0.5) * 36, 1);

  // Net LP advantage of dodging vs playing (considering MMR preservation value)
  const netLpAdvantageOfDodging = roundTo(-dodgeLpPenalty - expectedPlayLpDelta, 1);
  const shouldDodge =
    dodgeCountToday < 2 &&
    (blacklistHits.length > 0 ||
      estimatedTeamWinProb <= 0.39 ||
      expectedPlayLpDelta < -dodgeLpPenalty - 1.5);

  const reasoningSteps: string[] = [
    `我方 5 人近期综合 RPI 均值为 ${roundTo(avgTeamRpi, 1)}，模型预测本局胜率 ${Math.round(
      estimatedTeamWinProb * 100
    )}%`,
    `强开本局数学期望胜点变动为 ${
      expectedPlayLpDelta >= 0 ? `+${expectedPlayLpDelta}` : expectedPlayLpDelta
    } LP（隐藏分期望 ${
      expectedPlayMmrDelta >= 0 ? `+${expectedPlayMmrDelta}` : expectedPlayMmrDelta
    } MMR）`,
    `当前为今日第 ${dodgeCountToday + 1} 次秒退窗口：成本仅 -${dodgeLpPenalty} LP / 冷却 ${dodgeLockoutMinutes} 分钟，且隐藏分 MMR 损益恒为 0`,
  ];

  if (blacklistHits.length > 0) {
    reasoningSteps.unshift(
      `一级警报：我方匹配到恩怨黑名单玩家【${blacklistHits
        .map((b) => `${b.gameName} (${b.reasonTag})`)
        .join('、')}】！`
    );
  }

  const lpDiffText =
    netLpAdvantageOfDodging >= 0
      ? `且表面胜点期望少亏 ${netLpAdvantageOfDodging} LP`
      : `虽表面多付 ${Math.abs(netLpAdvantageOfDodging)} LP 成本，但可 100% 规避隐藏分 MMR 下跌`;
  const headlineVerdict = shouldDodge
    ? `强烈建议秒退 (Dodge) · ${lpDiffText}`
    : `建议正常对局 (Play) · 当前阵容与队友状态具备正期望收益`;

  return {
    dodgeCountToday,
    dodgeLpPenalty,
    dodgeLockoutMinutes,
    mmrLossOnDodge: 0,
    estimatedTeamWinProb,
    expectedPlayLpDelta,
    expectedPlayMmrDelta,
    netLpAdvantageOfDodging,
    blacklistHits,
    shouldDodge,
    headlineVerdict,
    reasoningSteps,
  };
}

/**
 * 7. Lobby Chat Anti-Censorship Obfuscator & Tactical Broadcaster
 * Replaces sensitive keywords with zero-width separators or tactical synonyms to bypass client chat filters.
 */
const SENSITIVE_SYNONYM_MAP: Array<[RegExp, string]> = [
  [/纯血牛马/g, '抗压待唤醒位'],
  [/牛马/g, '高危波动位'],
  [/混子/g, '稳健发育型'],
  [/摆烂/g, '心态波动'],
  [/暴毙/g, '激进给机会'],
  [/通天代/g, '凯瑞核心大腿'],
  [/连败/g, '连跪需帮扶'],
  [/杀/g, '击破'],
  [/死/g, '阵亡'],
];

export function obfuscateChatLine(raw: string, enableZeroWidth = true): string {
  if (raw.includes('\u200C') || raw.includes('\u200B')) {
    return raw;
  }
  let cleaned = raw;
  for (const [pattern, replacement] of SENSITIVE_SYNONYM_MAP) {
    cleaned = cleaned.replace(pattern, replacement);
  }
  if (enableZeroWidth) {
    // Insert zero-width non-joiner \u200C inside bracketed tags to prevent regex chat muting
    cleaned = cleaned.replace(/·/g, ' \u200C·\u200C ');
  }
  return cleaned;
}

export function formatAntiFilterLobbyChat(
  allies: SummonerScoutProfile[],
  mode: ChatReportMode,
  enableZeroWidth = true
): string[] {
  const lines: string[] = [];

  if (mode === ChatReportMode.TEAMMATE_CONFIDENCE) {
    const carries = allies.filter((a) => a.averageRpi >= 68);
    lines.push(
      obfuscateChatLine(
        `[NexusAkari 战术简报] 我方核心凯瑞点已锁定，围绕优势路打稳赢：`,
        enableZeroWidth
      )
    );
    for (const c of carries) {
      const winCount = c.recentMatches.filter((m) => m.win).length;
      const winPct = Math.round((winCount / Math.max(1, c.recentMatches.length)) * 100);
      lines.push(
        obfuscateChatLine(
          `[${c.assignedRole}] ${c.gameName} (${c.currentChampionName}) · 近战绩胜率 ${winPct}% · 综合评分 ${c.averageRpi} (${c.tags[0]?.label ?? '核心大腿'})`,
          enableZeroWidth
        )
      );
    }
  } else if (mode === ChatReportMode.HAZARD_ALERT) {
    const hazards = allies.filter((a) => a.averageRpi <= 50 || a.tags.some((t) => t.polarity === TagPolarity.HAZARD));
    lines.push(
      obfuscateChatLine(
        `[NexusAkari 防守提醒] 以下边路近期对线压力较大，建议打野多做反蹲保护视野：`,
        enableZeroWidth
      )
    );
    for (const h of hazards) {
      lines.push(
        obfuscateChatLine(
          `[${h.assignedRole}] ${h.gameName} (${h.currentChampionName}) · 近期评分 ${h.averageRpi} · 状态标记：${h.tags[0]?.label ?? '需视野保护'}`,
          enableZeroWidth
        )
      );
    }
  } else {
    lines.push(
      obfuscateChatLine(
        `[NexusAkari SGP 五人战力速报] (已开启防屏蔽脱敏排版 · 350ms节流发送)：`,
        enableZeroWidth
      )
    );
    for (const a of allies) {
      const winCount = a.recentMatches.filter((m) => m.win).length;
      const winPct = Math.round((winCount / Math.max(1, a.recentMatches.length)) * 100);
      const avgKda =
        a.recentMatches.reduce((s, m) => s + (m.kills + m.assists) / Math.max(1, m.deaths), 0) /
        Math.max(1, a.recentMatches.length);
      lines.push(
        obfuscateChatLine(
          `[${a.assignedRole}] ${a.currentChampionName} (${a.gameName}) · RPI ${a.averageRpi} · 胜率 ${winPct}% · 场均KDA ${roundTo(avgKda, 1)} · [${a.tags[0]?.label ?? '稳健'}]`,
          enableZeroWidth
        )
      );
    }
  }

  return lines;
}

/**
 * 8. Summoner Spell Haste Cooldown, Smite Threshold, ARAM EHP & Loot Mass Disenchant Math
 */
export function calculateSummonerSpellCooldown(
  baseCooldownSeconds: number,
  hasCosmicInsight: boolean,
  hasIonianBoots: boolean
): {
  totalSpellHaste: number;
  realCooldownSeconds: number;
  secondsSaved: number;
} {
  const totalSpellHaste = (hasCosmicInsight ? 18 : 0) + (hasIonianBoots ? 10 : 0);
  const realCooldownSeconds = Math.round(baseCooldownSeconds / (1 + totalSpellHaste / 100));
  return {
    totalSpellHaste,
    realCooldownSeconds,
    secondsSaved: baseCooldownSeconds - realCooldownSeconds,
  };
}

export function calculateSmiteThreshold(petStacks: number): {
  smiteTierName: string;
  trueDamageMonster: number;
  championDamageBase: number;
} {
  if (petStacks >= 40) {
    return {
      smiteTierName: '苍穹/原始惩戒 (满层觉醒 · 40层)',
      trueDamageMonster: 1200,
      championDamageBase: 165,
    };
  }
  if (petStacks >= 20) {
    return {
      smiteTierName: '释放惩戒 (二阶进化 · 20层)',
      trueDamageMonster: 900,
      championDamageBase: 125,
    };
  }
  return {
    smiteTierName: '基础惩戒 (初始阶段 · <20层)',
    trueDamageMonster: 600,
    championDamageBase: 0,
  };
}

export function calculateAramEhpMetrics(entry: AramChampionBalance): AramEhpMetrics {
  const ehpMultiplier = roundTo(1 / Math.max(0.5, entry.damageTakenMod), 3);
  const effectiveTradeIndex = roundTo(entry.damageDealtMod * ehpMultiplier, 3);

  // Net power shift % combining damage dealt, EHP multiplier, healing/shielding, ability haste, tenacity
  const netPowerDeltaPercent = roundTo(
    (effectiveTradeIndex - 1) * 100 +
      0.25 * (entry.healingMod + entry.shieldingMod - 2) * 100 +
      0.4 * entry.abilityHasteMod +
      0.25 * entry.tenacityMod,
    1
  );

  let trapLevel: AramEhpMetrics['trapLevel'] = 'NEUTRAL';
  let tierGrade: AramEhpMetrics['tierGrade'] = 'B';
  let summaryBadge = '平衡数值正常';

  if (netPowerDeltaPercent <= -15) {
    trapLevel = 'SEVERE_TRAP';
    tierGrade = 'D';
    summaryBadge = `重度数值陷阱 (对拼换血亏模 ${Math.abs(netPowerDeltaPercent)}%)`;
  } else if (netPowerDeltaPercent <= -5) {
    trapLevel = 'MILD_NERF';
    tierGrade = 'B';
    summaryBadge = `轻度削弱受限 (净强度 ${netPowerDeltaPercent}%)`;
  } else if (netPowerDeltaPercent >= 12) {
    trapLevel = 'GOD_BUFF';
    tierGrade = 'S+';
    summaryBadge = `官方亲爹数值怪 (净强度 +${netPowerDeltaPercent}%)`;
  } else if (netPowerDeltaPercent >= 4) {
    trapLevel = 'GOD_BUFF';
    tierGrade = 'S';
    summaryBadge = `优质Buff增益 (净强度 +${netPowerDeltaPercent}%)`;
  } else {
    tierGrade = entry.baseWinRate >= 0.52 ? 'A' : 'B';
  }

  return {
    championId: entry.championId,
    championName: entry.championName,
    ehpMultiplier,
    effectiveTradeIndex,
    netPowerDeltaPercent,
    trapLevel,
    tierGrade,
    summaryBadge,
  };
}

export function calculateLootDisenchantPlan(
  shards: LootItemShard[],
  strategy: LootDisenchantPlan['strategy']
): LootDisenchantPlan {
  let selectedShardsCount = 0;
  let totalBlueEssenceYield = 0;
  let totalOrangeEssenceYield = 0;
  let retainedShardsCount = 0;
  const lcuBatchCraftCommands: LootDisenchantPlan['lcuBatchCraftCommands'] = [];

  for (const shard of shards) {
    let disenchantCount = 0;
    if (strategy === 'DISENCHANT_ALL') {
      disenchantCount = shard.count;
    } else if (strategy === 'DISENCHANT_DUPLICATES_ONLY') {
      disenchantCount = shard.isOwnedChampionOrSkin
        ? shard.count
        : Math.max(0, shard.count - 1);
    } else {
      // KEEP_MASTERY_AND_UNOWNED
      if (!shard.isOwnedChampionOrSkin) {
        disenchantCount = Math.max(0, shard.count - 1);
      } else if (shard.neededForMasteryUpgrade) {
        disenchantCount = Math.max(0, shard.count - 1);
      } else {
        disenchantCount = shard.count;
      }
    }

    const retained = shard.count - disenchantCount;
    retainedShardsCount += retained;

    if (disenchantCount > 0) {
      selectedShardsCount += disenchantCount;
      const yieldValue = disenchantCount * shard.valuePerUnit;
      if (shard.disenchantCurrency === 'BLUE_ESSENCE') {
        totalBlueEssenceYield += yieldValue;
      } else {
        totalOrangeEssenceYield += yieldValue;
      }

      const recipeName =
        shard.category === 'CHAMPION_SHARD'
          ? 'CHAMPION_RENTAL_disenchant'
          : 'SKIN_RENTAL_disenchant';

      lcuBatchCraftCommands.push({
        recipeName,
        lootId: shard.lootId,
        repeat: disenchantCount,
        expectedYield: yieldValue,
      });
    }
  }

  return {
    strategy,
    selectedShardsCount,
    totalBlueEssenceYield,
    totalOrangeEssenceYield,
    retainedShardsCount,
    lcuBatchCraftCommands,
  };
}
