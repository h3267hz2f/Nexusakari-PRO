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
