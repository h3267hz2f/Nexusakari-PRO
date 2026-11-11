import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeWinProbabilityAndThrows,
  calculateAramEhpMetrics,
  calculateContextAwareRpi,
  calculateDodgeExpectedValue,
  calculateLootDisenchantPlan,
  calculateSmiteThreshold,
  calculateSummonerSpellCooldown,
  detectPremadeSquads,
  diagnoseTeamComposition,
  evaluateSummonerTags,
  formatAntiFilterLobbyChat,
} from './mathEngine';
import {
  ARAM_BALANCE_DATABASE,
  buildHydratedScoutProfiles,
  INITIAL_BLACKLIST_LEDGER,
  LOOT_SHARDS_INVENTORY,
  MATCH_TIMELINE_FIXTURE,
} from './telemetryFixtures';
import { ChatReportMode, DamageType, RoleType } from './types';

test('Slice-1.1: Context-Aware RPI v4 differentiates God Carry, Blue-Collar Tank SVP, and Pure NiuMa', () => {
  const profiles = buildHydratedScoutProfiles();
  const ornnTop = profiles.find((p) => p.gameName === '山巅铸星铁匠')!;
  const kindredJgl = profiles.find((p) => p.gameName === '北枫千珏绝活')!;
  const yasuoMid = profiles.find((p) => p.gameName === '晚风吹碎水晶')!;
  const threshSup = profiles.find((p) => p.gameName === '深海钩锁引路人')!;

  // Kindred has dominant RPI (> 80) and carries GOD_CARRY tag
  assert.ok(kindredJgl.averageRpi >= 80, `Expected Kindred RPI >= 80, got ${kindredJgl.averageRpi}`);
  assert.ok(
    kindredJgl.tags.some((t) => t.id === 'GOD_CARRY' || t.id === 'FOLLOW_CARRY_HIT'),
    'Kindred should carry GOD_CARRY or FOLLOW_CARRY_HIT tag'
  );

  // Ornn in a heavy team gold deficit loss receives gamma_deficit > 1.0 and high tank efficiency
  const ornnLossBreakdown = calculateContextAwareRpi(ornnTop.recentMatches[0]);
  assert.ok(
    ornnLossBreakdown.deficitCompensationGamma > 1.05,
    `Expected Ornn deficit compensation > 1.05, got ${ornnLossBreakdown.deficitCompensationGamma}`
  );
  assert.ok(
    ornnLossBreakdown.tankEfficiencyEta >= 2.0,
    `Expected Ornn tank efficiency >= 2.0, got ${ornnLossBreakdown.tankEfficiencyEta}`
  );

  // Yasuo Mid 0-10 streak has low RPI (<= 40) and triggers BLACKLIST_HIT + PURE_NIUMA / LOSS_STREAK_TILT
  assert.ok(yasuoMid.averageRpi <= 35, `Expected Yasuo RPI <= 35, got ${yasuoMid.averageRpi}`);
  assert.equal(yasuoMid.tags[0].id, 'BLACKLIST_HIT');
  assert.ok(
    yasuoMid.tags.some((t) => t.id === 'PURE_NIUMA' || t.id === 'LOSS_STREAK_TILT'),
    'Yasuo should trigger PURE_NIUMA or LOSS_STREAK_TILT'
  );

  // Thresh SUP gets high RPI despite low kills thanks to SUP role baseline (vision & KP%)
  assert.ok(threshSup.averageRpi >= 75, `Expected Thresh SUP RPI >= 75, got ${threshSup.averageRpi}`);
});

test('Slice-1.2: Time-Decayed Union-Find Premade Detector identifies Ally & Enemy Duos and Rivalry Clashes', () => {
  const profiles = buildHydratedScoutProfiles();
  const { premadeGroups, rivalries } = detectPremadeSquads(profiles);

  // Should find 1 Ally premade (Kindred + Thresh) and 1 Enemy premade (Lee Sin + Orianna)
  assert.equal(premadeGroups.length, 2);
  const allyGroup = premadeGroups.find((g) => g.teamSide === 'ALLY')!;
  const enemyGroup = premadeGroups.find((g) => g.teamSide === 'ENEMY')!;

  assert.ok(allyGroup.memberPuuids.includes('puuid-ally-jgl-02'));
  assert.ok(allyGroup.memberPuuids.includes('puuid-ally-sup-05'));
  assert.ok(enemyGroup.memberPuuids.includes('puuid-enemy-jgl-07'));
  assert.ok(enemyGroup.memberPuuids.includes('puuid-enemy-mid-08'));

  // Should detect high-elo rivalry collision between Kindred and Lee Sin
  assert.ok(rivalries.length >= 1, 'Expected at least 1 cross-team rivalry clash');
  assert.equal(rivalries[0].previousClashes, 2);
});

test('Slice-1.3: Live Win-Probability P(Win|t) Logistic Regression & Throw-Point Detector', () => {
  const { winProbCurve, throwPoints } = analyzeWinProbabilityAndThrows(MATCH_TIMELINE_FIXTURE);

  assert.equal(winProbCurve.length, MATCH_TIMELINE_FIXTURE.length);
  // At minute 20 (6700G lead + 3 dragons), Blue win prob should be > 0.85
  const min20 = winProbCurve.find((p) => p.minute === 20)!;
  assert.ok(min20.blueWinProbability >= 0.85, `Expected min20 win prob >= 0.85, got ${min20.blueWinProbability}`);

  // At minute 22 (Yasuo caught + Baron lost), win prob drops sharply -> detected in throwPoints
  assert.ok(throwPoints.length >= 2, 'Expected at least 2 key turning/throw points');
  const yasuoThrow = throwPoints.find((tp) => tp.minute === 22)!;
  assert.ok(yasuoThrow, 'Minute 22 Baron throw should be captured');
  assert.ok(yasuoThrow.probSwing < -0.18, `Expected negative swing < -0.18, got ${yasuoThrow.probSwing}`);
  assert.equal(yasuoThrow.culpritOrHeroName, '晚风吹碎水晶');
});

test('Slice-1.4: BP Team Composition Diagnosis & Dodge EV Decision Calculator', () => {
  const profiles = buildHydratedScoutProfiles();
  const allies = profiles.filter((p) => p.teamSide === 'ALLY');
  const comp = diagnoseTeamComposition(allies);

  assert.ok(comp.shannonEntropy > 1.0, 'Mixed team comp should have healthy Shannon entropy');
  assert.ok(comp.frontlineScore >= 65, 'Ornn + Thresh should yield solid frontline score');

  // Test Pure AD Skew detection
  const pureAdAllies = allies.map((a) => ({ ...a, championDamageType: DamageType.PHYSICAL }));
  const skewedComp = diagnoseTeamComposition(pureAdAllies);
  assert.equal(skewedComp.isSkewed, true);
  assert.ok(skewedComp.skewWarning?.includes('纯菜刀队'));

  // Test Dodge EV Calculator when Blacklist player (Yasuo) is on Ally team
  const dodgeEv = calculateDodgeExpectedValue(allies, comp, INITIAL_BLACKLIST_LEDGER, 0);
  assert.equal(dodgeEv.blacklistHits.length, 1);
  assert.equal(dodgeEv.dodgeLpPenalty, 5);
  assert.equal(dodgeEv.mmrLossOnDodge, 0);
  assert.equal(dodgeEv.shouldDodge, true);
});

test('Slice-1.5: Lobby Chat Obfuscator, Spell Haste Cooldown, ARAM EHP & Loot Disenchant Math', () => {
  const profiles = buildHydratedScoutProfiles();
  const allies = profiles.filter((p) => p.teamSide === 'ALLY');

  // Chat obfuscator replaces sensitive words and inserts zero-width characters
  const chatLines = formatAntiFilterLobbyChat(allies, ChatReportMode.FULL_TEAM_BRIEF, true);
  assert.equal(chatLines.length, 6);
  assert.ok(!chatLines.some((line) => line.includes('纯血牛马')), 'Sensitive term should be obfuscated');
  assert.ok(chatLines[0].includes('\u200C'), 'Zero-width non-joiner should be injected');

  // Summoner Spell Haste: 300s Flash with Cosmic Insight (+18) & Ionian Boots (+10) -> 300 / 1.28 = 234s
  const flashCd = calculateSummonerSpellCooldown(300, true, true);
  assert.equal(flashCd.totalSpellHaste, 28);
  assert.equal(flashCd.realCooldownSeconds, 234);
  assert.equal(flashCd.secondsSaved, 66);

  // Smite Thresholds
  assert.equal(calculateSmiteThreshold(10).trueDamageMonster, 600);
  assert.equal(calculateSmiteThreshold(25).trueDamageMonster, 900);
  assert.equal(calculateSmiteThreshold(40).trueDamageMonster, 1200);

  // ARAM EHP Math: Sona (0.85 dmg, 1.15 taken, 0.8 heal/shield, -20 AH) -> SEVERE_TRAP
  const sonaMetrics = calculateAramEhpMetrics(ARAM_BALANCE_DATABASE[0]);
  assert.equal(sonaMetrics.trapLevel, 'SEVERE_TRAP');
  assert.equal(sonaMetrics.tierGrade, 'D');
  assert.ok(sonaMetrics.ehpMultiplier < 0.88);

  // LeBlanc (1.15 dmg, 0.85 taken, +20 AH, +20 Tenacity) -> GOD_BUFF
  const lbMetrics = calculateAramEhpMetrics(ARAM_BALANCE_DATABASE[3]);
  assert.equal(lbMetrics.trapLevel, 'GOD_BUFF');
  assert.equal(lbMetrics.tierGrade, 'S+');

  // Loot Disenchant Plan: KEEP_MASTERY_AND_UNOWNED
  const lootPlan = calculateLootDisenchantPlan(
    LOOT_SHARDS_INVENTORY,
    'KEEP_MASTERY_AND_UNOWNED'
  );
  // Aatrox (5 owned, no mastery needed -> 5), Kindred (3 owned, mastery needed -> keep 1, disenchant 2),
  // Hwei (2 unowned -> keep 1, disenchant 1), Yasuo (7 owned -> 7)
  // Skins: Aatrox skin (2 owned -> 2), Kai'Sa skin (1 unowned -> 0)
  assert.equal(lootPlan.selectedShardsCount, 5 + 2 + 1 + 7 + 2);
  assert.ok(lootPlan.totalBlueEssenceYield > 14000);
  assert.equal(lootPlan.totalOrangeEssenceYield, 540);
});

test('Slice-1.6: Live LCU Command-Line Parser & Riot Raw JSON-to-Domain Mappers', async () => {
  const {
    parseCommandLineToCredentials,
    mapRawLcuLootToShards,
    mapRawLcuGamesToMatchStats,
  } = await import('./liveLcuAdapter');

  // 1. Parse Windows LeagueClientUx.exe command line into 4-Tuple
  const sampleCmd =
    '"D:\\WeGameApps\\英雄联盟\\LeagueClient\\LeagueClientUx.exe" "--app-port=54321" "--remoting-auth-token=RealSecretToken99" "--riotclient-app-port=54322" "--riotclient-auth-token=RcuToken88" "--rso_platform_id=HN1" "--region=TENCENT_HN1" "--app-pid=18888"';
  const creds = parseCommandLineToCredentials(sampleCmd, 18888);
  assert.ok(creds, 'Credentials should be extracted from valid command line');
  assert.equal(creds!.lcuPort, 54321);
  assert.equal(creds!.lcuAuthToken, 'RealSecretToken99');
  assert.equal(creds!.rcuPort, 54322);
  assert.equal(creds!.rcuAuthToken, 'RcuToken88');
  assert.equal(creds!.rsoPlatformId, 'HN1');

  // 2. Map raw Riot /lol-loot/v1/player-loot-map JSON to LootItemShard[]
  const rawLootMap = {
    CHAMPION_RENTAL_203: {
      lootId: 'CHAMPION_RENTAL_203',
      localizedName: '千珏 英雄碎片',
      type: 'CHAMPION_RENTAL',
      count: 3,
      disenchantValue: 960,
      upgradeEssenceValue: 2880,
      itemStatus: 'OWNED',
    },
    CHAMPION_SKIN_RENTAL_103085: {
      lootId: 'CHAMPION_SKIN_RENTAL_103085',
      localizedName: '殿堂传奇 阿狸 皮肤碎片',
      type: 'CHAMPION_SKIN_RENTAL',
      count: 1,
      disenchantValue: 650,
      upgradeEssenceValue: 2950,
      itemStatus: 'NONE',
    },
  };
  const mappedShards = mapRawLcuLootToShards(rawLootMap);
  assert.equal(mappedShards.length, 2);
  assert.equal(mappedShards[0].disenchantCurrency, 'BLUE_ESSENCE');
  assert.equal(mappedShards[0].isOwnedChampionOrSkin, true);
  assert.equal(mappedShards[1].disenchantCurrency, 'ORANGE_ESSENCE');
  assert.equal(mappedShards[1].isOwnedChampionOrSkin, false);

  // 3. Map raw Riot /lol-match-history/v1/products/lol/{puuid}/matches JSON to MatchParticipantStats[] + Context-Aware RPI
  const rawGames = [
    {
      gameId: 99887766,
      gameDuration: 1800,
      gameCreation: Date.now() - 3600_000,
      participantIdentities: [
        { participantId: 1, player: { puuid: 'puuid-test-carry', gameName: 'TestCarry' } },
        { participantId: 2, player: { puuid: 'puuid-ally-2', gameName: 'Ally2' } },
      ],
      participants: [
        {
          participantId: 1,
          teamId: 100,
          championId: 203,
          timeline: { lane: 'JUNGLE', role: 'NONE' },
          stats: {
            win: true,
            kills: 12,
            deaths: 2,
            assists: 10,
            goldEarned: 15500,
            totalDamageDealtToChampions: 38000,
            totalDamageTaken: 24000,
            damageSelfMitigated: 18000,
            visionScore: 42,
            wardsPlaced: 14,
            wardsKilled: 8,
            visionWardsBoughtInGame: 5,
            totalMinionsKilled: 45,
            neutralMinionsKilled: 165,
            turretKills: 3,
            inhibitorKills: 1,
            timeCCingOthers: 28,
            firstBloodKill: true,
            perk0: 8005,
            perk0Var1: 3120,
            perk0Var2: 1840,
            perk0Var3: 0,
            perkPrimaryStyle: 8000,
            perkSubStyle: 8100,
          },
        },
        {
          participantId: 2,
          teamId: 100,
          championId: 516,
          timeline: { lane: 'TOP', role: 'SOLO' },
          stats: {
            win: true,
            kills: 3,
            deaths: 4,
            assists: 15,
            goldEarned: 11500,
            totalDamageDealtToChampions: 19000,
            totalDamageTaken: 41000,
            damageSelfMitigated: 52000,
            visionScore: 28,
            wardsPlaced: 10,
            wardsKilled: 3,
            visionWardsBoughtInGame: 3,
            totalMinionsKilled: 180,
            neutralMinionsKilled: 12,
            turretKills: 2,
            inhibitorKills: 0,
            timeCCingOthers: 55,
            firstBloodKill: false,
          },
        },
      ],
    },
  ];

  const mappedMatches = mapRawLcuGamesToMatchStats(
    rawGames,
    'puuid-test-carry',
    RoleType.JGL
  );
  assert.equal(mappedMatches.length, 1);
  assert.equal(mappedMatches[0].championName, '千珏');
  assert.equal(mappedMatches[0].role, RoleType.JGL);
  assert.equal(mappedMatches[0].kills, 12);
  assert.ok(
    mappedMatches[0].runeTelemetry && mappedMatches[0].runeTelemetry.length >= 1,
    'Expected live perk0..5 telemetry to be extracted from raw stats'
  );
  assert.equal(mappedMatches[0].runeTelemetry![0].perkId, 8005);
  assert.equal(mappedMatches[0].runeTelemetry![0].var1, 3120);

  const rpi = calculateContextAwareRpi(mappedMatches[0]);
  assert.ok(rpi.rpiScore >= 80, `Expected mapped live match RPI >= 80, got ${rpi.rpiScore}`);

  // 4. Map raw Riot /lol-match-history/v1/games/{gameId}/timeline frames to TimelineMinutePoint[]
  const { mapRawTimelineToMinutePoints } = await import('./liveLcuAdapter');
  const rawTimeline = {
    frames: [
      {
        timestamp: 0,
        participantFrames: {
          '1': { participantId: 1, totalGold: 500, xp: 0 },
          '6': { participantId: 6, totalGold: 500, xp: 0 },
        },
        events: [],
      },
      {
        timestamp: 600_000,
        participantFrames: {
          '1': { participantId: 1, totalGold: 4200, xp: 3500 },
          '6': { participantId: 6, totalGold: 3100, xp: 2900 },
        },
        events: [
          { type: 'ELITE_MONSTER_KILL', monsterType: 'DRAGON', killerId: 1 },
          { type: 'BUILDING_KILL', buildingType: 'TOWER_BUILDING', killerId: 1 },
          { type: 'CHAMPION_KILL', killerId: 1, victimId: 6, assistingParticipantIds: [2] },
        ],
      },
    ],
  };
  const timelinePoints = mapRawTimelineToMinutePoints(rawTimeline, rawGames[0]);
  assert.equal(timelinePoints.length, 2);
  assert.equal(timelinePoints[1].minute, 10);
  assert.equal(timelinePoints[1].blueGold - timelinePoints[1].redGold, 1100);
  assert.equal(timelinePoints[1].blueDragons, 1);
  assert.equal(timelinePoints[1].blueTowers, 1);
});

test('Slice-1.7: Complete 169-Champion Catalog, 65-Rune Perk Dictionary, Adaptive 9-Perk Rune Builder & SGP Spectator Session', async () => {
  const {
    ALL_CHAMPIONS_SORTED,
    FULL_CHAMPION_CATALOG,
    buildAdaptiveRunePresetForChampion,
    buildAramBalanceForChampion,
  } = await import('./championCatalog');
  const {
    CHAMPION_METADATA_MAP,
    PERK_METADATA_MAP,
    getChampionMeta,
    fetchLiveSpectatorSession,
  } = await import('./liveLcuAdapter');

  // 1. All 169 League of Legends champions are registered with zero '英雄 #ID' fallback
  assert.ok(
    ALL_CHAMPIONS_SORTED.length >= 169,
    `Expected >= 169 champions in catalog, got ${ALL_CHAMPIONS_SORTED.length}`
  );
  assert.equal(Object.keys(CHAMPION_METADATA_MAP).length, ALL_CHAMPIONS_SORTED.length);

  for (const champ of ALL_CHAMPIONS_SORTED) {
    const meta = getChampionMeta(champ.id);
    assert.ok(
      !meta.name.startsWith('英雄 #'),
      `Champion ID ${champ.id} should not fall back to generic name`
    );
    const adaptiveRune = buildAdaptiveRunePresetForChampion(champ.id);
    assert.equal(adaptiveRune.selectedPerkIds.length, 9);
    assert.ok(adaptiveRune.primaryStyleId >= 8000);
    assert.ok(adaptiveRune.subStyleId >= 8000);
    assert.ok(adaptiveRune.winRate >= 50 && adaptiveRune.winRate <= 65);

    const aramBalance = buildAramBalanceForChampion(champ.id);
    assert.equal(aramBalance.championId, champ.id);
    assert.ok(aramBalance.recommendedMythicCore.length >= 3);
  }

  // Verify newest champions (Ambessa 799, Mel 800, Aurora 893, Smolder 901, Hwei 910, Naafiri 950)
  assert.equal(FULL_CHAMPION_CATALOG[799].name, '安蓓萨');
  assert.equal(FULL_CHAMPION_CATALOG[800].name, '梅尔');
  assert.equal(FULL_CHAMPION_CATALOG[893].name, '阿萝拉');
  assert.equal(FULL_CHAMPION_CATALOG[901].name, '斯莫德');
  assert.equal(FULL_CHAMPION_CATALOG[910].name, '彗');
  assert.equal(FULL_CHAMPION_CATALOG[950].name, '纳亚菲利');

  // 2. Verify expanded Rune Perk dictionary covers all 5 rune trees (>= 60 perks)
  assert.ok(
    Object.keys(PERK_METADATA_MAP).length >= 60,
    `Expected >= 60 rune perks in PERK_METADATA_MAP, got ${Object.keys(PERK_METADATA_MAP).length}`
  );

  // 3. Verify SGP Spectator Session query synthesis fallback when offline
  const specRes = await fetchLiveSpectatorSession(null, '北枫千珏绝活#HN1', 'KR');
  assert.equal(specRes.found, true);
  assert.equal(specRes.regionCode, 'KR');
  assert.ok(specRes.encryptionKey.length >= 16);
  assert.ok(specRes.gameId.length >= 6);
});



