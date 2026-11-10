/**
 * NexusAkari Pro (v4) — Core Domain & Tri-Channel Protocol Types
 * Covers LCU + RCU 4-Tuple Credentials, SGP Regional Registry, LiveClientData (:2999),
 * Context-Aware RPI v4, 16-Tag System, Win-Probability Logistic Regression, Dodge EV,
 * ARAM EHP Multiplier Math, Arena Augments, and Hextech Loot Disenchanting.
 */

export enum GameflowPhase {
  NONE = 'None',
  LOBBY = 'Lobby',
  MATCHMAKING = 'Matchmaking',
  READY_CHECK = 'ReadyCheck',
  CHAMP_SELECT = 'ChampSelect',
  IN_PROGRESS = 'InProgress',
  END_OF_GAME = 'EndOfGame',
}

export enum RoleType {
  TOP = 'TOP',
  JGL = 'JGL',
  MID = 'MID',
  BOT = 'BOT',
  SUP = 'SUP',
}

export enum DamageType {
  PHYSICAL = 'PHYSICAL',
  MAGIC = 'MAGIC',
  TRUE = 'TRUE',
  MIXED = 'MIXED',
}

export enum TagPolarity {
  CARRY = 'CARRY',
  NEUTRAL = 'NEUTRAL',
  WARNING = 'WARNING',
  HAZARD = 'HAZARD',
}

export enum ChatReportMode {
  TEAMMATE_CONFIDENCE = 'TEAMMATE_CONFIDENCE',
  HAZARD_ALERT = 'HAZARD_ALERT',
  FULL_TEAM_BRIEF = 'FULL_TEAM_BRIEF',
}

export enum AiJudgePersona {
  SHARP_JUDGE = 'SHARP_JUDGE',
  PRO_COACH = 'PRO_COACH',
}

export interface LcuRcuCredentials {
  lcuPid: number;
  lcuPort: number;
  lcuAuthToken: string;
  rcuPid: number;
  rcuPort: number;
  rcuAuthToken: string;
  rsoPlatformId: string;
  region: string;
  installDirectory: string;
  isWeGameLauncher: boolean;
  lastHeartbeatAt: string;
}

export interface SgpEndpointConfig {
  regionCode: string;
  regionName: string;
  operator: 'Tencent-CN' | 'Riot-Global';
  matchHistoryUrl: string;
  summonerLedgeUrl: string;
  spectatorDomain: string;
  spectatorPort: number;
  latencyMs: number;
}

export interface TriChannelStatus {
  mode: 'tauri-native' | 'protocol-replay';
  lcuConnected: boolean;
  rcuConnected: boolean;
  sgpJwtValid: boolean;
  liveClient2999Active: boolean;
  activeRegion: string;
  tokenBucketAvailable: number;
  tokenBucketCapacity: number;
  dashMapCachedPlayers: number;
  ringBufferCount: number;
  gameflowPhase: GameflowPhase;
  credentials: LcuRcuCredentials;
}

export interface IpcEnvelope {
  id: string;
  timestamp: string;
  channel: 'LCU_REST' | 'LCU_WAMP' | 'RCU_AUTH' | 'SGP_HTTPS' | 'LIVE_2999' | 'TAURI_CMD';
  method: string;
  endpoint: string;
  status: number;
  durationMs: number;
  payloadSummary: string;
}

export interface PlayerMatchStats {
  matchId: string;
  gameTimestamp: number; // Unix timestamp in ms
  durationMinutes: number;
  queueId: number;
  queueName: string;
  championId: number;
  championName: string;
  championTitle: string;
  role: RoleType;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  goldEarned: number;
  damageDealt: number;
  damageTaken: number;
  selfMitigatedDamage: number;
  visionScore: number;
  csDiffAt15: number;
  goldDiffAt15: number;
  teamTotalKills: number;
  teamTotalDeaths: number;
  teamTotalGold: number;
  enemyTotalGold: number;
  teamTotalDamage: number;
  teamTotalDamageTaken: number;
  firstBloodKill: boolean;
  objectiveStolen: number;
  ccScoreSeconds: number;
  coPlayerPuuids: string[];
  enemyPuuids: string[];
}

export interface RpiBreakdown {
  rpiScore: number; // 0 - 100
  rawZScoreSum: number;
  damageEfficiencyEta: number; // DamageShare / GoldShare
  tankEfficiencyEta: number; // (DamageTakenShare * (1 + 0.5 * MitigatedRatio)) / GoldShare
  deficitCompensationGamma: number; // 1.0 - 1.35
  killParticipation: number; // 0 - 1
  damageShare: number; // 0 - 1
  damageTakenShare: number; // 0 - 1
  goldShare: number; // 0 - 1
  deathShare: number; // 0 - 1
  dpm: number;
  vspm: number;
  kdaRatio: number;
  gradeLabel: 'S+' | 'S' | 'A' | 'B' | 'C' | 'D';
  sixDimRadar: {
    combatOutput: number; // 0 - 100
    goldConversion: number; // 0 - 100
    frontlineSurvival: number; // 0 - 100
    macroVision: number; // 0 - 100
    laningDominance: number; // 0 - 100
    objectiveTempo: number; // 0 - 100
  };
}

export interface SummonerTag {
  id: string;
  label: string;
  polarity: TagPolarity;
  priority: number;
  description: string;
  metricProof: string;
}

export interface PremadeGroup {
  groupId: string; // e.g., "双排车队 #A", "三排银河战舰 #B"
  teamSide: 'ALLY' | 'ENEMY';
  memberPuuids: string[];
  coOccurrenceCount: number;
  decayedWeight: number;
  synergyWinRate: number;
}

export interface RivalryCollision {
  allyPuuid: string;
  enemyPuuid: string;
  previousClashes: number;
  note: string;
}

export interface SummonerScoutProfile {
  puuid: string;
  gameName: string;
  tagLine: string;
  summonerLevel: number;
  profileIconId: number;
  teamSide: 'ALLY' | 'ENEMY';
  assignedRole: RoleType;
  currentChampionId: number;
  currentChampionName: string;
  intendedChampionId: number;
  intendedChampionName: string;
  championDamageType: DamageType;
  frontlineRating: number; // 1 - 10
  ccRating: number; // 1 - 10
  waveclearRating: number; // 1 - 10
  lateScalingRating: number; // 1 - 10
  soloTier: string;
  soloDivision: string;
  soloLp: number;
  soloWins: number;
  soloLosses: number;
  estimatedMmr: number;
  mmrDeltaLabel: string;
  hasCosmicInsight: boolean;
  hasIonianBoots: boolean;
  spell1Name: string;
  spell2Name: string;
  recentMatches: PlayerMatchStats[];
  averageRpi: number;
  latestRpiBreakdown: RpiBreakdown;
  tags: SummonerTag[];
  premadeGroupId?: string;
  isAnonymousInBp: boolean;
}

export interface TimelineMinutePoint {
  minute: number;
  blueGold: number;
  redGold: number;
  blueKills: number;
  redKills: number;
  blueDragons: number;
  redDragons: number;
  blueBarons: number;
  redBarons: number;
  blueTowers: number;
  redTowers: number;
  eventSummary?: string;
  involvedPlayerName?: string;
  involvedChampionName?: string;
  mapX?: number; // 0 - 15000 Summoner's Rift coordinate
  mapY?: number; // 0 - 15000 Summoner's Rift coordinate
  eventType?: 'FIRST_BLOOD' | 'DRAGON' | 'BARON' | 'TEAMFIGHT_ACE' | 'SOLO_PICK' | 'TOWER_FALL';
}

export interface WinProbPoint {
  minute: number;
  blueWinProbability: number; // 0 - 1
  goldDiff: number;
  probDelta2Min: number; // P(t) - P(t-2)
  isTurningPoint: boolean;
  eventSummary?: string;
}

export interface ThrowPointEvidence {
  minute: number;
  probBefore: number;
  probAfter: number;
  probSwing: number; // Negative means Blue threw, positive means Blue surged
  favoredTeamAfter: 'BLUE' | 'RED';
  culpritOrHeroName: string;
  championName: string;
  eventDescription: string;
  severityLabel: '致命葬送点 (Fatal Throw)' | '核心胜负手 (Critical Swing)' | '节奏断档点 (Tempo Loss)';
}

export interface TeamCompDiagnosis {
  physicalRatio: number; // 0 - 1
  magicRatio: number; // 0 - 1
  trueDamageRatio: number; // 0 - 1
  shannonEntropy: number; // 0 - 1.585 bits
  skewWarning: string | null;
  isSkewed: boolean;
  frontlineScore: number; // 0 - 100
  engageCcScore: number; // 0 - 100
  waveclearScore: number; // 0 - 100
  scalingScore: number; // 0 - 100
  overallCompGrade: 'S' | 'A' | 'B' | 'C' | 'D';
  tacticalAdvice: string;
}

export interface DodgeEvResult {
  dodgeCountToday: number;
  dodgeLpPenalty: number; // 5 or 15
  dodgeLockoutMinutes: number; // 6, 30, or 720
  mmrLossOnDodge: 0;
  estimatedTeamWinProb: number; // 0 - 1
  expectedPlayLpDelta: number;
  expectedPlayMmrDelta: number;
  netLpAdvantageOfDodging: number;
  blacklistHits: BlacklistEntry[];
  shouldDodge: boolean;
  headlineVerdict: string;
  reasoningSteps: string[];
}

export interface BlacklistEntry {
  puuid: string;
  gameName: string;
  tagLine: string;
  region: string;
  listType: 'BLACKLIST_DODGE' | 'FOLLOW_CARRY';
  reasonTag: string;
  customNote: string;
  recordedMatchId: string;
  createdAt: string;
}

export interface AutomationConfig {
  autoAcceptEnabled: boolean;
  autoAcceptDelayMs: number;
  autoPickEnabled: boolean;
  primaryPickChampionIds: number[];
  backupPickChampionIds: number[];
  autoBanEnabled: boolean;
  banChampionIds: number[];
  protectTeammateIntentGuard: boolean;
  humanizedJitterMinMs: number;
  humanizedJitterMaxMs: number;
  autoReconnectEnabled: boolean;
  autoPlayAgainEnabled: boolean;
  aramBenchSniperEnabled: boolean;
  aramWishlistChampionIds: number[];
  aramInstantRollbackLock: boolean;
}

export interface AramChampionBalance {
  championId: number;
  championName: string;
  championTitle: string;
  roleClass: string;
  baseWinRate: number;
  pickRate: number;
  damageDealtMod: number; // e.g., 0.85 (-15%) or 1.10 (+10%)
  damageTakenMod: number; // e.g., 1.15 (+15% damage taken) or 0.90 (-10%)
  healingMod: number; // e.g., 0.80 (-20%) or 1.0
  shieldingMod: number; // e.g., 0.80 (-20%) or 1.0
  abilityHasteMod: number; // e.g., -20 or +15
  tenacityMod: number; // e.g., 0 or +20
  recommendedMythicCore: string[];
}

export interface AramEhpMetrics {
  championId: number;
  championName: string;
  ehpMultiplier: number; // 1 / damageTakenMod
  effectiveTradeIndex: number; // damageDealtMod * ehpMultiplier
  netPowerDeltaPercent: number; // Comprehensive net shift %
  trapLevel: 'SEVERE_TRAP' | 'MILD_NERF' | 'NEUTRAL' | 'GOD_BUFF';
  tierGrade: 'S+' | 'S' | 'A' | 'B' | 'C' | 'D';
  summaryBadge: string;
}

export interface ArenaAugmentSynergy {
  augmentId: string;
  augmentName: string;
  rarity: 'PRISMATIC' | 'GOLD' | 'SILVER';
  tier: 'S+' | 'S' | 'A';
  synergyChampions: string[];
  duoArchetypeName: string;
  duoPartnerRecommendation: string;
  coreItems: string[];
  winRatePercent: number;
  mechanicExplanation: string;
}

export interface LootItemShard {
  lootId: string;
  itemName: string;
  category: 'CHAMPION_SHARD' | 'SKIN_SHARD' | 'ETERNALS_CAPSULE';
  count: number;
  isOwnedChampionOrSkin: boolean;
  neededForMasteryUpgrade: boolean;
  disenchantCurrency: 'BLUE_ESSENCE' | 'ORANGE_ESSENCE';
  valuePerUnit: number;
  upgradeCostPerUnit: number;
}

export interface LootDisenchantPlan {
  strategy: 'DISENCHANT_DUPLICATES_ONLY' | 'KEEP_MASTERY_AND_UNOWNED' | 'DISENCHANT_ALL';
  selectedShardsCount: number;
  totalBlueEssenceYield: number;
  totalOrangeEssenceYield: number;
  retainedShardsCount: number;
  lcuBatchCraftCommands: Array<{
    recipeName: string;
    lootId: string;
    repeat: number;
    expectedYield: number;
  }>;
}

export interface RunePagePreset {
  id: string;
  championId: number;
  championName: string;
  role: RoleType;
  pageName: string;
  primaryStyleId: number;
  primaryStyleName: string;
  subStyleId: number;
  subStyleName: string;
  selectedPerkIds: number[];
  perkNames: string[];
  winRate: number;
  pickCount: number;
}

export interface AiPlayerVerdict {
  summonerName: string;
  championName: string;
  role: string;
  verdictTitle: string;
  blameSharePercent: number;
  sharpCommentary: string;
  tacticalFix: string;
}

export interface AiJudgeReport {
  matchId: string;
  persona: AiJudgePersona;
  generatedAt: string;
  headlineSummary: string;
  topCulpritName: string;
  trueCarryName: string;
  turningPointAnalysis: string;
  playerVerdicts: AiPlayerVerdict[];
}
