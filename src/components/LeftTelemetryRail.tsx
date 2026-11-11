/**
 * NexusAkari Pro (v4) — Left Telemetry Rail Component
 * Displays Tri-Channel (LCU / RCU-SGP / :2999) status, Gameflow lifecycle switcher,
 * SGP regional endpoint selector, Summoner MMR progress ring, and LCU/RCU 4-Tuple config.
 */

import React, { useState } from 'react';
import { SGP_REGION_REGISTRY } from '../core/telemetryFixtures';
import { GameflowPhase, LcuRcuCredentials, TriChannelStatus } from '../core/types';

interface LeftTelemetryRailProps {
  status: TriChannelStatus;
  blacklistCount: number;
  onPhaseChange: (phase: GameflowPhase) => void;
  onRegionChange: (regionCode: string) => void;
  onUpdateCredentials: (creds: Partial<LcuRcuCredentials>) => void;
  onProbeLiveClient?: () => Promise<{ connected: boolean; message: string }>;
}

const PHASE_OPTIONS: Array<{ phase: GameflowPhase; label: string; sub: string }> = [
  { phase: GameflowPhase.LOBBY, label: 'Lobby 大厅待机', sub: '房间创建 / 组排侦测' },
  { phase: GameflowPhase.READY_CHECK, label: 'ReadyCheck 匹配确认', sub: '防误触延迟自动接受' },
  { phase: GameflowPhase.CHAMP_SELECT, label: 'ChampSelect 排位BP', sub: '我方明牌 / 敌方匿名' },
  { phase: GameflowPhase.IN_PROGRESS, label: 'InProgress 局内对抗', sub: '解锁敌方5人 / :2999计时' },
  { phase: GameflowPhase.END_OF_GAME, label: 'EndOfGame 赛后结算', sub: 'P(Win|t)取证 / AI审判' },
];

export const LeftTelemetryRail: React.FC<LeftTelemetryRailProps> = ({
  status,
  blacklistCount,
  onPhaseChange,
  onRegionChange,
  onUpdateCredentials,
  onProbeLiveClient,
}) => {
  const [editingCreds, setEditingCreds] = useState(false);
  const [lcuPortInput, setLcuPortInput] = useState(String(status.credentials.lcuPort));
  const [lcuTokenInput, setLcuTokenInput] = useState(status.credentials.lcuAuthToken);
  const [rcuPortInput, setRcuPortInput] = useState(String(status.credentials.rcuPort));
  const [isProbing, setIsProbing] = useState(false);
  const [probeMessage, setProbeMessage] = useState<string | null>(null);

  const handleSaveCreds = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLcu = Number(lcuPortInput);
    const parsedRcu = Number(rcuPortInput);
    if (!Number.isFinite(parsedLcu) || parsedLcu <= 0) return;

    onUpdateCredentials({
      lcuPort: parsedLcu,
      lcuAuthToken: lcuTokenInput.trim() || status.credentials.lcuAuthToken,
      rcuPort: Number.isFinite(parsedRcu) && parsedRcu > 0 ? parsedRcu : status.credentials.rcuPort,
    });
    setEditingCreds(false);
  };

  const handleProbeClick = async () => {
    if (!onProbeLiveClient) return;
    setIsProbing(true);
    try {
      const res = await onProbeLiveClient();
      setProbeMessage(res.message);
    } finally {
      setIsProbing(false);
    }
  };

  // SVG Ring calculation for Master 215 LP -> Grandmaster 500 LP threshold (43%)
  const lpProgressPct = 68;
  const ringRadius = 26;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringDashoffset = ringCircumference * (1 - lpProgressPct / 100);

  return (
    <aside
      aria-label="三通道遥测与状态机控制栏"
      className="w-72 shrink-0 border-r border-slate-800/80 bg-slate-950/90 p-5 flex flex-col gap-6 select-none"
    >
      {/* Section 1: Active Summoner Card & Redesigned MMR Progress Ring */}
      <section className="p-4 rounded-xl bg-gray-900/90 border border-slate-800/80">
        <div className="flex items-center gap-3.5">
          <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
              <circle
                cx="32"
                cy="32"
                r={ringRadius}
                fill="none"
                stroke="#1e293b"
                strokeWidth="4.5"
              />
              <circle
                cx="32"
                cy="32"
                r={ringRadius}
                fill="none"
                stroke="#0ea5e9"
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringDashoffset}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono tabular-nums text-xs font-bold text-sky-400">215</span>
              <span className="font-mono text-[10px] text-slate-400">LP</span>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="font-display text-sm font-bold text-slate-100 truncate">
              北枫千珏绝活
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 font-mono tabular-nums">
              超凡大师 I · 62.8% 胜率
            </p>
            <p className="text-xs text-amber-400 mt-1 font-mono tabular-nums">
              预估 MMR 2640 (+65)
            </p>
          </div>
        </div>

        <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono tabular-nums">
          <span>单双排 88胜 52负</span>
          <span aria-hidden="true">·</span>
          <span>恩怨账本 {blacklistCount}人</span>
        </div>
      </section>

      {/* Section 2: Two-Stage Gameflow Lifecycle Switcher */}
      <section>
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="font-display text-xs font-semibold text-slate-300 tracking-wide">
            01. 客户端生命周期状态机
          </h3>
          <span className="font-mono tabular-nums text-[11px] text-sky-400">
            {status.gameflowPhase}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          {PHASE_OPTIONS.map((item) => {
            const active = status.gameflowPhase === item.phase;
            return (
              <button
                key={item.phase}
                type="button"
                onClick={() => onPhaseChange(item.phase)}
                className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                  active
                    ? 'bg-sky-500/15 border-sky-500/60 text-slate-100'
                    : 'bg-gray-900/60 border-slate-800/70 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold whitespace-nowrap">{item.label}</span>
                  <span className="font-mono text-[10px] text-slate-400">
                    {active ? '当前激活' : '切换'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 truncate">{item.sub}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Section 3: SGP Cross-Region Mesh Selector */}
      <section>
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="font-display text-xs font-semibold text-slate-300 tracking-wide">
            02. SGP 跨区战绩网关节点
          </h3>
          <span className="font-mono tabular-nums text-[11px] text-emerald-400">
            JWT 有效
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          {SGP_REGION_REGISTRY.map((reg) => {
            const isSelected = status.activeRegion === reg.regionCode;
            return (
              <button
                key={reg.regionCode}
                type="button"
                onClick={() => onRegionChange(reg.regionCode)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-colors ${
                  isSelected
                    ? 'bg-gray-900 border-sky-500/60 text-slate-100 font-semibold'
                    : 'bg-gray-900/40 border-slate-800/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="truncate">{reg.regionName}</span>
                <span className="font-mono tabular-nums text-[11px] text-slate-400 shrink-0 ml-2">
                  {reg.regionCode} · {reg.latencyMs}ms
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Section 4: Tri-Channel LCU + RCU + :2999 Telemetry & 4-Tuple Editor */}
      <section className="p-3.5 rounded-xl bg-gray-900/90 border border-slate-800/80 space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xs font-semibold text-slate-200">
            03. 三通道四元组进程桥接
          </h3>
          <button
            type="button"
            onClick={() => setEditingCreds(!editingCreds)}
            className="text-xs text-sky-400 hover:text-sky-300 font-medium whitespace-nowrap"
          >
            {editingCreds ? '取消编辑' : '配置端口'}
          </button>
        </div>

        {editingCreds ? (
          <form onSubmit={handleSaveCreds} className="space-y-2.5 text-xs">
            <div>
              <label htmlFor="lcu-port-input" className="block text-slate-400 mb-1">
                LCU 本地端口 (--app-port)
              </label>
              <input
                id="lcu-port-input"
                type="number"
                value={lcuPortInput}
                onChange={(e) => setLcuPortInput(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-slate-100 font-mono tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="rcu-port-input" className="block text-slate-400 mb-1">
                RCU 拳头客户端端口 (--riotclient-app-port)
              </label>
              <input
                id="rcu-port-input"
                type="number"
                value={rcuPortInput}
                onChange={(e) => setRcuPortInput(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-slate-100 font-mono tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="lcu-token-input" className="block text-slate-400 mb-1">
                Remoting Auth Token
              </label>
              <input
                id="lcu-token-input"
                type="text"
                value={lcuTokenInput}
                onChange={(e) => setLcuTokenInput(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-slate-100 font-mono"
              />
            </div>
            <button
              type="submit"
              className="w-full py-1.5 px-3 rounded bg-sky-500 text-slate-950 font-semibold hover:bg-sky-400 transition-colors"
            >
              保存并重连四元组隧道
            </button>
          </form>
        ) : (
          <dl className="space-y-1.5 text-xs font-mono tabular-nums">
            <div className="flex items-center justify-between">
              <dt className="text-slate-400">数据源模式</dt>
              <dd
                className={
                  status.mode === 'tauri-native'
                    ? 'text-emerald-400 font-semibold'
                    : 'text-amber-400'
                }
              >
                {status.mode === 'tauri-native' ? '真机 LCU 直连' : '全真复盘沙箱'}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-400">LCU 进程端口</dt>
              <dd className="text-emerald-400">
                127.0.0.1:{status.credentials.lcuPort} (PID {status.credentials.lcuPid})
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-400">RCU 会话端口</dt>
              <dd className="text-sky-400">
                127.0.0.1:{status.credentials.rcuPort} (PID {status.credentials.rcuPid})
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-400">局内实时通道</dt>
              <dd className="text-slate-200">127.0.0.1:2999 (就绪)</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-400">令牌桶限流器</dt>
              <dd className="text-slate-200">
                {status.tokenBucketAvailable}/{status.tokenBucketCapacity} req/s
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-400">DashMap 缓存</dt>
              <dd className="text-slate-200">{status.dashMapCachedPlayers} PUUIDs</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-400">IPC 环形缓冲</dt>
              <dd className="text-slate-200">{status.ringBufferCount} / 256 帧</dd>
            </div>
          </dl>
        )}

        {onProbeLiveClient && (
          <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
            <button
              type="button"
              disabled={isProbing}
              onClick={handleProbeClick}
              className="w-full py-1.5 px-3 rounded-lg bg-slate-950 border border-sky-500/40 text-xs font-semibold text-sky-300 hover:bg-sky-500/15 transition-colors disabled:opacity-50"
            >
              {isProbing ? '正在扫描 LeagueClientUx.exe...' : '探测本地 LOL 进程并同步'}
            </button>
            {probeMessage && (
              <p className="text-[11px] text-slate-400 leading-relaxed font-mono">
                {probeMessage}
              </p>
            )}
          </div>
        )}
      </section>
    </aside>
  );
};

