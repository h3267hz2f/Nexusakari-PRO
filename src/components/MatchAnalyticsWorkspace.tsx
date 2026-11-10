/**
 * NexusAkari Pro (v4) — Slice-4: Deep Match Penetration, Win-Probability P(Win|t)
 * Throw-Point Forensics, 2D Summoner's Rift Coordinate Heatmap, Encounter Blacklist
 * Ledger Manager & Gemini 3.8 Flash AI Post-Game Court
 */

import React, { useMemo, useState } from 'react';
import { analyzeWinProbabilityAndThrows } from '../core/mathEngine';
import {
  MATCH_TIMELINE_FIXTURE,
  SGP_REGION_REGISTRY,
} from '../core/telemetryFixtures';
import {
  AiJudgePersona,
  AiJudgeReport,
  BlacklistEntry,
  RoleType,
  SummonerScoutProfile,
  TimelineMinutePoint,
} from '../core/types';

interface MatchAnalyticsWorkspaceProps {
  scoutProfiles: SummonerScoutProfile[];
  blacklist: BlacklistEntry[];
  activeRegion: string;
  selectedPlayerPuuid: string | null;
  onSelectPlayerPuuid: (puuid: string) => void;
  onAddBlacklistEntry: (entry: Omit<BlacklistEntry, 'createdAt'>) => Promise<void>;
  onRemoveBlacklistEntry: (puuid: string) => Promise<void>;
  onRequestAiJudge: (
    persona: AiJudgePersona,
    throwPoints: ReturnType<typeof analyzeWinProbabilityAndThrows>['throwPoints']
  ) => Promise<AiJudgeReport>;
}

const RADAR_AXES: Array<{
  key: keyof SummonerScoutProfile['latestRpiBreakdown']['sixDimRadar'];
  label: string;
}> = [
  { key: 'combatOutput', label: '团战输出' },
  { key: 'goldConversion', label: '经济转化' },
  { key: 'frontlineSurvival', label: '前排抗压' },
  { key: 'macroVision', label: '视野布控' },
  { key: 'laningDominance', label: '对线压制' },
  { key: 'objectiveTempo', label: '资源节奏' },
];

export const MatchAnalyticsWorkspace: React.FC<MatchAnalyticsWorkspaceProps> = ({
  scoutProfiles,
  blacklist,
  activeRegion,
  selectedPlayerPuuid,
  onSelectPlayerPuuid,
  onAddBlacklistEntry,
  onRemoveBlacklistEntry,
  onRequestAiJudge,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [selectedMinute, setSelectedMinute] = useState<number>(22);

  // Blacklist form state
  const [newLedgerName, setNewLedgerName] = useState<string>('');
  const [newLedgerTagLine, setNewLedgerTagLine] = useState<string>(activeRegion);
  const [newLedgerType, setNewLedgerType] =
    useState<BlacklistEntry['listType']>('BLACKLIST_DODGE');
  const [newLedgerReason, setNewLedgerReason] = useState<string>('团战脱节单带送大龙');
  const [newLedgerNote, setNewLedgerNote] = useState<string>(
    '22分钟无视野带下路二塔被抓，直接导致丢大龙翻盘'
  );
  const [ledgerFormError, setLedgerFormError] = useState<string | null>(null);

  // Gemini 3.8 Flash AI Judge state
  const [aiPersona, setAiPersona] = useState<AiJudgePersona>(AiJudgePersona.SHARP_JUDGE);
  const [aiReport, setAiReport] = useState<AiJudgeReport | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);

  const { winProbCurve, throwPoints } = useMemo(
    () => analyzeWinProbabilityAndThrows(MATCH_TIMELINE_FIXTURE, 0.08),
    []
  );

  const selectedPlayer = useMemo(() => {
    return (
      scoutProfiles.find((p) => p.puuid === selectedPlayerPuuid) ??
      scoutProfiles.find((p) => p.gameName === '北枫千珏绝活') ??
      scoutProfiles[0]
    );
  }, [scoutProfiles, selectedPlayerPuuid]);

  const filteredTablePlayers = useMemo(() => {
    return scoutProfiles.filter((p) => {
      if (roleFilter !== 'ALL' && p.assignedRole !== roleFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          p.gameName.toLowerCase().includes(q) ||
          p.currentChampionName.toLowerCase().includes(q) ||
          p.tagLine.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [scoutProfiles, roleFilter, searchQuery]);

  const activeTimelineEvents = useMemo(
    () => MATCH_TIMELINE_FIXTURE.filter((pt) => Boolean(pt.eventSummary)),
    []
  );

  const selectedTimelinePoint: TimelineMinutePoint = useMemo(() => {
    return (
      MATCH_TIMELINE_FIXTURE.find((pt) => pt.minute === selectedMinute) ??
      activeTimelineEvents[0]
    );
  }, [selectedMinute, activeTimelineEvents]);

  const handleQuickAddPlayerToBlacklist = async (
    player: SummonerScoutProfile,
    listType: BlacklistEntry['listType']
  ) => {
    await onAddBlacklistEntry({
      puuid: player.puuid,
      gameName: player.gameName,
      tagLine: player.tagLine,
      region: activeRegion,
      listType,
      reasonTag:
        listType === 'BLACKLIST_DODGE' ? '高危突破口·对局拉黑' : '高分通天代·重点关注',
      customNote:
        listType === 'BLACKLIST_DODGE'
          ? `${player.currentChampionName} 场均 RPI ${player.averageRpi}，死亡占比偏高`
          : `${player.currentChampionName} 场均 RPI ${player.averageRpi}，稳定凯瑞核心`,
      recordedMatchId: player.recentMatches[0]?.matchId ?? 'HN1-811',
    });
  };

  const handleCreateCustomLedgerEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLedgerName.trim() || !newLedgerReason.trim()) {
      setLedgerFormError('请填写完整的召唤师名称与标记原因');
      return;
    }
    setLedgerFormError(null);
    await onAddBlacklistEntry({
      puuid: `puuid-custom-${Date.now()}`,
      gameName: newLedgerName.trim(),
      tagLine: newLedgerTagLine.trim() || activeRegion,
      region: activeRegion,
      listType: newLedgerType,
      reasonTag: newLedgerReason.trim(),
      customNote: newLedgerNote.trim() || '手动录入恩怨账本记录',
      recordedMatchId: 'HN1-811',
    });
    setNewLedgerName('');
  };

  const handleRunAiCourt = async () => {
    setAiLoading(true);
    try {
      const report = await onRequestAiJudge(aiPersona, throwPoints);
      setAiReport(report);
    } finally {
      setAiLoading(false);
    }
  };

  // Compute SVG Polygon points for 6-Axis Radar Chart (center 110,110, radius 78)
  const radarCenter = 110;
  const radarRadius = 78;
  const radarPointsString = useMemo(() => {
    const radar = selectedPlayer?.latestRpiBreakdown?.sixDimRadar;
    if (!radar) return '';
    return RADAR_AXES.map((axis, idx) => {
      const angle = (Math.PI * 2 * idx) / RADAR_AXES.length - Math.PI / 2;
      const val = (radar[axis.key] ?? 50) / 100;
      const r = radarRadius * val;
      const x = radarCenter + r * Math.cos(angle);
      const y = radarCenter + r * Math.sin(angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }, [selectedPlayer]);

  const baselinePolygonString = useMemo(() => {
    return RADAR_AXES.map((_, idx) => {
      const angle = (Math.PI * 2 * idx) / RADAR_AXES.length - Math.PI / 2;
      const r = radarRadius * 0.55;
      const x = radarCenter + r * Math.cos(angle);
      const y = radarCenter + r * Math.sin(angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }, []);

  // Compute SVG Polyline for Win-Probability Curve (width 560, height 180)
  const chartW = 560;
  const chartH = 170;
  const winProbPolyline = useMemo(() => {
    return winProbCurve
      .map((pt, idx) => {
        const x = 32 + (idx / Math.max(1, winProbCurve.length - 1)) * (chartW - 56);
        const y = chartH - 22 - pt.blueWinProbability * (chartH - 44);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [winProbCurve]);

  return (
    <div className="space-y-6">
      {/* Row 1: Win-Probability Logistic Regression P(Win|t) & 2D Summoner's Rift Coordinate Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 7 Cols: P(Win|t) Curve & Top 3 Throw-Point Forensics */}
        <section className="lg:col-span-7 p-5 rounded-xl bg-gray-900/90 border border-slate-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-base font-bold text-slate-100">
                  01. 实时胜率逻辑回归曲线 P(Win|t) 与葬送好局转折点取证
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  融合分钟级经济差、龙魂、大龙与防御塔权重的逻辑回归模型，自动锁定单波胜率雪崩超 16% 的战犯时刻
                </p>
              </div>
              <span className="font-mono tabular-nums text-xs text-sky-400 shrink-0">
                对局 ID: HN1-811 (30:00)
              </span>
            </div>

            {/* SVG Win-Prob Curve */}
            <div className="mt-4 p-3 rounded-lg bg-slate-950 border border-slate-800/90">
              <svg
                viewBox={`0 0 ${chartW} ${chartH}`}
                className="w-full h-44 overflow-visible"
                role="img"
                aria-label="实时胜率逻辑回归曲线图"
              >
                {/* 50% Equilibrium Horizontal Reference Line */}
                <line
                  x1="32"
                  y1={chartH / 2}
                  x2={chartW - 24}
                  y2={chartH / 2}
                  stroke="#334155"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x="4"
                  y={chartH / 2 + 4}
                  fill="#64748b"
                  fontSize="10"
                  fontFamily="JetBrains Mono"
                >
                  50%
                </text>
                <text
                  x="4"
                  y="24"
                  fill="#38bdf8"
                  fontSize="10"
                  fontFamily="JetBrains Mono"
                >
                  95%
                </text>
                <text
                  x="4"
                  y={chartH - 16}
                  fill="#fb7185"
                  fontSize="10"
                  fontFamily="JetBrains Mono"
                >
                  5%
                </text>

                {/* Win Probability Polyline */}
                <polyline
                  fill="none"
                  stroke="#0ea5e9"
                  strokeWidth="2.5"
                  points={winProbPolyline}
                />

                {/* Data Nodes */}
                {winProbCurve.map((pt, idx) => {
                  const x =
                    32 + (idx / Math.max(1, winProbCurve.length - 1)) * (chartW - 56);
                  const y = chartH - 22 - pt.blueWinProbability * (chartH - 44);
                  const isSelected = pt.minute === selectedMinute;
                  const isThrow = pt.probDelta2Min <= -0.18;

                  return (
                    <g
                      key={pt.minute}
                      className="cursor-pointer"
                      onClick={() => setSelectedMinute(pt.minute)}
                    >
                      <circle
                        cx={x}
                        cy={y}
                        r={isSelected ? 6 : pt.isTurningPoint ? 5 : 3.5}
                        fill={
                          isThrow
                            ? '#f43f5e'
                            : pt.isTurningPoint
                            ? '#f59e0b'
                            : '#0ea5e9'
                        }
                        stroke="#090d16"
                        strokeWidth="1.5"
                      />
                      <text
                        x={x}
                        y={chartH - 4}
                        textAnchor="middle"
                        fill={isSelected ? '#f8fafc' : '#94a3b8'}
                        fontSize="10"
                        fontFamily="JetBrains Mono"
                      >
                        {pt.minute}m
                      </text>
                      {pt.isTurningPoint && (
                        <text
                          x={x}
                          y={y - 9}
                          textAnchor="middle"
                          fill={isThrow ? '#fda4af' : '#fde68a'}
                          fontSize="9.5"
                          fontFamily="JetBrains Mono"
                        >
                          {pt.probDelta2Min > 0
                            ? `+${Math.round(pt.probDelta2Min * 100)}%`
                            : `${Math.round(pt.probDelta2Min * 100)}%`}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Top 3 Throw / Turning Points List */}
            <div className="mt-3.5 space-y-2">
              {throwPoints.map((tp) => (
                <button
                  key={tp.minute}
                  type="button"
                  onClick={() => setSelectedMinute(tp.minute)}
                  className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors flex items-center justify-between gap-3 ${
                    selectedMinute === tp.minute
                      ? 'bg-slate-950 border-sky-500/70'
                      : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="min-w-0">
                    <span
                      className={`font-mono tabular-nums font-bold ${
                        tp.probSwing < 0 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      [{tp.minute}:00 · {tp.severityLabel}]
                    </span>{' '}
                    <span className="text-slate-200">{tp.eventDescription}</span>
                  </div>
                  <span
                    className={`font-mono tabular-nums font-bold shrink-0 ${
                      tp.probSwing < 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    胜率 {Math.round(tp.probBefore * 100)}% →{' '}
                    {Math.round(tp.probAfter * 100)}%
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Right 5 Cols: Interactive 2D Summoner's Rift Coordinate Heatmap */}
        <section className="lg:col-span-5 p-5 rounded-xl bg-gray-900/90 border border-slate-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-bold text-slate-100">
                  02. 召唤师峡谷 2D 坐标事件热区图
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  还原 LCU 时间轴 0~15000 真实峡谷网格坐标与资源团战点位
                </p>
              </div>
              <span className="font-mono tabular-nums text-xs text-amber-400">
                {selectedTimelinePoint.minute}:00 节点
              </span>
            </div>

            <div className="mt-4 flex items-center gap-4">
              {/* 2D Rift Tactical Map SVG */}
              <div className="w-48 h-48 shrink-0 rounded-lg bg-slate-950 border border-slate-800 p-2 relative">
                <svg
                  viewBox="0 0 150 150"
                  className="w-full h-full"
                  role="img"
                  aria-label="召唤师峡谷2D战术坐标热区"
                >
                  {/* Map Outer Boundary & Lanes */}
                  <rect
                    x="6"
                    y="6"
                    width="138"
                    height="138"
                    rx="8"
                    fill="#090d16"
                    stroke="#1e293b"
                    strokeWidth="2"
                  />
                  {/* River Diagonal */}
                  <path
                    d="M 22 22 Q 75 75 128 128"
                    stroke="#0c4a6e"
                    strokeWidth="9"
                    fill="none"
                    strokeLinecap="round"
                  />
                  {/* Mid Lane Diagonal */}
                  <line
                    x1="14"
                    y1="136"
                    x2="136"
                    y2="14"
                    stroke="#1e293b"
                    strokeWidth="3"
                  />
                  {/* Baron & Dragon Pit Markers */}
                  <circle cx="48" cy="46" r="5" fill="#581c87" opacity="0.6" />
                  <circle cx="100" cy="104" r="5" fill="#7c2d12" opacity="0.6" />

                  {/* Event Coordinate Pins */}
                  {activeTimelineEvents.map((ev) => {
                    const cx = ((ev.mapX ?? 7500) / 15000) * 136 + 7;
                    // Invert Y since LoL 0,0 is bottom-left
                    const cy = 143 - ((ev.mapY ?? 7500) / 15000) * 136;
                    const active = ev.minute === selectedTimelinePoint.minute;

                    return (
                      <g
                        key={ev.minute}
                        className="cursor-pointer"
                        onClick={() => setSelectedMinute(ev.minute)}
                      >
                        <circle
                          cx={cx}
                          cy={cy}
                          r={active ? 6.5 : 4.2}
                          fill={
                            ev.eventType === 'BARON'
                              ? '#f43f5e'
                              : ev.eventType === 'TEAMFIGHT_ACE'
                              ? '#10b981'
                              : '#f59e0b'
                          }
                          stroke="#f8fafc"
                          strokeWidth={active ? '2' : '1'}
                        />
                        <text
                          x={cx}
                          y={cy - 8}
                          textAnchor="middle"
                          fill="#f8fafc"
                          fontSize="8"
                          fontFamily="JetBrains Mono"
                        >
                          {ev.minute}m
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Event Coordinate Detail Box */}
              <div className="flex-1 min-w-0 space-y-2 text-xs">
                <div className="font-mono tabular-nums text-sky-400 font-semibold">
                  时间点: {selectedTimelinePoint.minute}:00 · 坐标 (
                  {selectedTimelinePoint.mapX ?? 7500},{' '}
                  {selectedTimelinePoint.mapY ?? 7500})
                </div>
                <p className="text-slate-200 leading-relaxed">
                  {selectedTimelinePoint.eventSummary ?? '常规对线发育阶段'}
                </p>
                <div className="pt-2 border-t border-slate-800/80 space-y-1 font-mono tabular-nums text-[11px] text-slate-400">
                  <div>
                    涉事核心: {selectedTimelinePoint.involvedPlayerName ?? '全队'} (
                    {selectedTimelinePoint.involvedChampionName ?? '多英雄'})
                  </div>
                  <div>
                    蓝色方经济: {selectedTimelinePoint.blueGold}G vs 红色方:{' '}
                    {selectedTimelinePoint.redGold}G
                  </div>
                  <div>
                    人头比: {selectedTimelinePoint.blueKills} :{' '}
                    {selectedTimelinePoint.redKills} · 小龙:{' '}
                    {selectedTimelinePoint.blueDragons} :{' '}
                    {selectedTimelinePoint.redDragons}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline Minute Selector Strip */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto">
            {activeTimelineEvents.map((ev) => (
              <button
                key={ev.minute}
                type="button"
                onClick={() => setSelectedMinute(ev.minute)}
                className={`px-2.5 py-1 rounded text-xs font-mono tabular-nums transition-colors whitespace-nowrap shrink-0 ${
                  selectedMinute === ev.minute
                    ? 'bg-sky-500 text-slate-950 font-bold'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {ev.minute}:00 {ev.involvedChampionName}
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* Row 2: Gemini 3.8 Flash AI Post-Game Court & 6-Axis Radar Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 8 Cols: Gemini 3.8 Flash AI Post-Game Court */}
        <section className="lg:col-span-8 p-5 rounded-xl bg-gray-900/90 border border-slate-800/80 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-slate-800/80">
              <div>
                <h2 className="font-display text-base font-bold text-slate-100">
                  03. Gemini 3.8 Flash 赛后审判庭 (AI Match-Review Pipeline)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  将 10 人双经济转化率与 P(Win|t) 胜率葬送点证据链投喂服务端大模型，执行客观分锅定责
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setAiPersona(AiJudgePersona.SHARP_JUDGE)}
                    className={`px-2.5 py-1 text-xs rounded transition-colors whitespace-nowrap ${
                      aiPersona === AiJudgePersona.SHARP_JUDGE
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    犀利毒舌审判官
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiPersona(AiJudgePersona.PRO_COACH)}
                    className={`px-2.5 py-1 text-xs rounded transition-colors whitespace-nowrap ${
                      aiPersona === AiJudgePersona.PRO_COACH
                        ? 'bg-sky-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    职业赛训教练
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleRunAiCourt}
                  disabled={aiLoading}
                  className="px-4 py-2 rounded-lg bg-sky-500 text-slate-950 text-xs font-bold hover:bg-sky-400 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                >
                  {aiLoading ? 'AI 审判官合议庭生成中...' : '启动 AI 赛后审判'}
                </button>
              </div>
            </div>

            {aiReport ? (
              <div className="mt-4 space-y-4">
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums">
                    <span className="text-rose-400 font-bold">
                      头号战犯: {aiReport.topCulpritName}
                    </span>
                    <span aria-hidden="true" className="text-slate-600">
                      ·
                    </span>
                    <span className="text-amber-400 font-bold">
                      本局真神: {aiReport.trueCarryName}
                    </span>
                    <span aria-hidden="true" className="text-slate-600">
                      ·
                    </span>
                    <span className="text-slate-400">
                      裁定时间: {aiReport.generatedAt}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {aiReport.headlineSummary}
                  </p>
                  <p className="text-[11px] text-sky-400 font-mono">
                    关键转折点取证: {aiReport.turningPointAnalysis}
                  </p>
                </div>

                {/* Per-Player Blame Share & Verdict Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {aiReport.playerVerdicts.map((v) => (
                    <div
                      key={v.summonerName}
                      className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between font-mono tabular-nums">
                        <span className="font-bold text-slate-100">
                          [{v.role}] {v.summonerName} ({v.championName})
                        </span>
                        <span
                          className={`font-bold ${
                            v.blameSharePercent >= 35
                              ? 'text-rose-400'
                              : v.blameSharePercent <= 10
                              ? 'text-emerald-400'
                              : 'text-amber-400'
                          }`}
                        >
                          背锅占比 {v.blameSharePercent}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${Math.min(100, v.blameSharePercent)}%` }}
                          className={`h-full ${
                            v.blameSharePercent >= 35
                              ? 'bg-rose-500'
                              : v.blameSharePercent <= 10
                              ? 'bg-emerald-500'
                              : 'bg-amber-500'
                          }`}
                        />
                      </div>
                      <div className="text-sky-400 font-medium">{v.verdictTitle}</div>
                      <p className="text-slate-300 leading-relaxed">{v.sharpCommentary}</p>
                      <p className="text-[11px] text-slate-400">
                        改进建议: {v.tacticalFix}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-6 py-8 text-center rounded-lg bg-slate-950/60 border border-slate-800/60">
                <p className="text-sm text-slate-300 font-medium">
                  已就绪：检测到本局存在 3 处胜率剧烈波动转折点（含 22:00 致命葬送点）
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  点击右上角「启动 AI 赛后审判」，由服务端 Gemini 3.8 Flash 结合客观 RPI 与时间轴证据生成分锅裁定书
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Right 4 Cols: 6-Dimension SVG Capability Radar & Rune Breakdown */}
        <section className="lg:col-span-4 p-5 rounded-xl bg-gray-900/90 border border-slate-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-slate-100">
                04. 六维能力雷达与转化拆解
              </h2>
              <span className="font-mono tabular-nums text-xs text-amber-400 font-bold">
                RPI {selectedPlayer?.averageRpi}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              当前检视: {selectedPlayer?.gameName} ({selectedPlayer?.currentChampionName} ·{' '}
              {selectedPlayer?.assignedRole})
            </p>

            {/* 6-Axis SVG Radar */}
            <div className="mt-3 flex justify-center">
              <svg
                viewBox="0 0 220 220"
                className="w-52 h-52"
                role="img"
                aria-label="选手六维能力雷达图"
              >
                {/* Outer & Mid Hexagons */}
                {[1, 0.75, 0.5, 0.25].map((scale) => {
                  const pts = RADAR_AXES.map((_, idx) => {
                    const angle =
                      (Math.PI * 2 * idx) / RADAR_AXES.length - Math.PI / 2;
                    const r = radarRadius * scale;
                    return `${(radarCenter + r * Math.cos(angle)).toFixed(1)},${(
                      radarCenter +
                      r * Math.sin(angle)
                    ).toFixed(1)}`;
                  }).join(' ');
                  return (
                    <polygon
                      key={scale}
                      points={pts}
                      fill="none"
                      stroke="#1e293b"
                      strokeWidth="1"
                    />
                  );
                })}

                {/* Role Baseline Polygon */}
                <polygon
                  points={baselinePolygonString}
                  fill="rgba(148, 163, 184, 0.08)"
                  stroke="#64748b"
                  strokeDasharray="3 3"
                  strokeWidth="1.2"
                />

                {/* Active Player Polygon */}
                <polygon
                  points={radarPointsString}
                  fill="rgba(14, 165, 233, 0.28)"
                  stroke="#0ea5e9"
                  strokeWidth="2"
                />

                {/* Axis Labels */}
                {RADAR_AXES.map((axis, idx) => {
                  const angle = (Math.PI * 2 * idx) / RADAR_AXES.length - Math.PI / 2;
                  const labelR = radarRadius + 21;
                  const x = radarCenter + labelR * Math.cos(angle);
                  const y = radarCenter + labelR * Math.sin(angle);
                  return (
                    <text
                      key={axis.key}
                      x={x}
                      y={y + 3}
                      textAnchor="middle"
                      fill="#cbd5e1"
                      fontSize="10"
                    >
                      {axis.label}
                    </text>
                  );
                })}
              </svg>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80 space-y-1.5 text-xs font-mono tabular-nums">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">输出经济转化率 (η_dmg)</span>
              <span className="text-slate-100 font-bold">
                {Math.round(
                  (selectedPlayer?.latestRpiBreakdown?.damageEfficiencyEta ?? 1) * 100
                )}
                %
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">承伤经济转化率 (η_tank)</span>
              <span className="text-slate-100 font-bold">
                {Math.round(
                  (selectedPlayer?.latestRpiBreakdown?.tankEfficiencyEta ?? 1) * 100
                )}
                %
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">逆风抗压补偿因子 (γ_deficit)</span>
              <span className="text-emerald-400 font-bold">
                ×{selectedPlayer?.latestRpiBreakdown?.deficitCompensationGamma ?? 1.0}
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* Row 3: 10-Player High-Density Tabular Comparison & Encounter Blacklist Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 8 Cols: 10-Player Tabular Numerals Telemetry Table */}
        <section className="lg:col-span-8 p-5 rounded-xl bg-gray-900/90 border border-slate-800/80">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-slate-800/80">
            <div>
              <h2 className="font-display text-base font-bold text-slate-100">
                05. 全场 10 人双经济转化率与上下文 RPI 高密对比表
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                点击任意选手行切换右侧六维能力雷达图，或一键加入恩怨黑名单 / 大腿关注榜
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索召唤师或英雄..."
                aria-label="搜索召唤师或英雄"
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100"
              />
              <select
                aria-label="按位置筛选选手"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100"
              >
                <option value="ALL">全部位置</option>
                <option value={RoleType.TOP}>上单 TOP</option>
                <option value={RoleType.JGL}>打野 JGL</option>
                <option value={RoleType.MID}>中单 MID</option>
                <option value={RoleType.BOT}>下路 BOT</option>
                <option value={RoleType.SUP}>辅助 SUP</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto mt-3">
            <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-2">阵营/位置</th>
                  <th className="py-2.5 px-2 font-sans">召唤师 & 英雄</th>
                  <th className="py-2.5 px-2 text-right">近期KDA</th>
                  <th className="py-2.5 px-2 text-right">输出转化</th>
                  <th className="py-2.5 px-2 text-right">承伤转化</th>
                  <th className="py-2.5 px-2 text-right">逆风补偿</th>
                  <th className="py-2.5 px-2 text-right">RPI评分</th>
                  <th className="py-2.5 px-2 text-right font-sans">恩怨操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredTablePlayers.map((p) => {
                  const b = p.latestRpiBreakdown;
                  const isSelected = p.puuid === selectedPlayer?.puuid;
                  return (
                    <tr
                      key={p.puuid}
                      onClick={() => onSelectPlayerPuuid(p.puuid)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-sky-500/15' : 'hover:bg-slate-900/80'
                      }`}
                    >
                      <td className="py-2.5 px-2">
                        <span
                          className={
                            p.teamSide === 'ALLY' ? 'text-sky-400' : 'text-rose-400'
                          }
                        >
                          {p.teamSide === 'ALLY' ? '蓝方' : '红方'}·{p.assignedRole}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 font-sans">
                        <div className="font-semibold text-slate-100">
                          {p.currentChampionName} · {p.gameName}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {p.tags.map((t) => t.label).join(' / ')}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-right text-slate-200">
                        {b?.kdaRatio.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-2 text-right text-slate-200">
                        {Math.round((b?.damageEfficiencyEta ?? 1) * 100)}%
                      </td>
                      <td className="py-2.5 px-2 text-right text-slate-200">
                        {Math.round((b?.tankEfficiencyEta ?? 1) * 100)}%
                      </td>
                      <td className="py-2.5 px-2 text-right text-emerald-400">
                        ×{b?.deficitCompensationGamma.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-bold text-amber-400">
                        {p.averageRpi.toFixed(1)}
                      </td>
                      <td
                        className="py-2.5 px-2 text-right font-sans"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              handleQuickAddPlayerToBlacklist(p, 'BLACKLIST_DODGE')
                            }
                            className="px-2 py-1 rounded bg-rose-950/60 border border-rose-500/40 text-rose-300 hover:bg-rose-900/60 text-[11px] whitespace-nowrap"
                          >
                            拉黑避雷
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleQuickAddPlayerToBlacklist(p, 'FOLLOW_CARRY')
                            }
                            className="px-2 py-1 rounded bg-amber-950/60 border border-amber-500/40 text-amber-300 hover:bg-amber-900/60 text-[11px] whitespace-nowrap"
                          >
                            关注大腿
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Right 4 Cols: Summoner Encounter & Blacklist Ledger Manager */}
        <section className="lg:col-span-4 p-5 rounded-xl bg-gray-900/90 border border-slate-800/80 flex flex-col justify-between">
          <div>
            <h2 className="font-display text-base font-bold text-slate-100">
              06. 召唤师恩怨黑名单账本 (Dodge Ledger)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              排位匹配到我方黑名单立即触发秒退警报，排到敌方触发复仇提款提示
            </p>

            {/* Existing Ledger Entries */}
            <div className="mt-3.5 space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {blacklist.map((item) => (
                <div
                  key={item.puuid}
                  className={`p-3 rounded-lg border text-xs ${
                    item.listType === 'BLACKLIST_DODGE'
                      ? 'bg-rose-950/20 border-rose-500/40'
                      : 'bg-amber-950/20 border-amber-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-100">
                      {item.gameName}#{item.tagLine} ·{' '}
                      <span
                        className={
                          item.listType === 'BLACKLIST_DODGE'
                            ? 'text-rose-400'
                            : 'text-amber-400'
                        }
                      >
                        {item.reasonTag}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveBlacklistEntry(item.puuid)}
                      className="text-slate-400 hover:text-rose-400 text-[11px] whitespace-nowrap"
                    >
                      移除
                    </button>
                  </div>
                  <p className="text-slate-300 mt-1 leading-relaxed">{item.customNote}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Add New Entry Form */}
          <form
            onSubmit={handleCreateCustomLedgerEntry}
            className="mt-4 pt-3.5 border-t border-slate-800/80 space-y-2.5 text-xs"
          >
            <div className="font-semibold text-slate-200">手动登记恩怨召唤师：</div>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                value={newLedgerName}
                onChange={(e) => setNewLedgerName(e.target.value)}
                placeholder="召唤师昵称"
                aria-label="召唤师昵称"
                className="col-span-2 px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-slate-100"
              />
              <select
                aria-label="登记所属大区"
                value={newLedgerTagLine}
                onChange={(e) => setNewLedgerTagLine(e.target.value)}
                className="px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-slate-100 font-mono"
              >
                {SGP_REGION_REGISTRY.map((r) => (
                  <option key={r.regionCode} value={r.regionCode}>
                    #{r.regionCode}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                aria-label="名单类型"
                value={newLedgerType}
                onChange={(e) =>
                  setNewLedgerType(e.target.value as BlacklistEntry['listType'])
                }
                className="px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-slate-100"
              >
                <option value="BLACKLIST_DODGE">避雷黑名单 (秒退)</option>
                <option value="FOLLOW_CARRY">大腿关注榜 (抱腿)</option>
              </select>
              <input
                type="text"
                value={newLedgerReason}
                onChange={(e) => setNewLedgerReason(e.target.value)}
                placeholder="罪状/高光简述"
                aria-label="罪状或高光简述"
                className="px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-slate-100"
              />
            </div>
            {ledgerFormError && (
              <p className="text-rose-400 text-[11px]">{ledgerFormError}</p>
            )}
            <button
              type="submit"
              className="w-full py-2 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold transition-colors whitespace-nowrap"
            >
              写入本地持久化恩怨账本
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};
