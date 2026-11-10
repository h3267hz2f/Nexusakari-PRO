/**
 * NexusAkari Pro (v4) — Top Bar Component
 * Strictly follows the Top Bar Contract:
 * [Zone 1: Single text wordmark] — [Zone 2: 5 concise single-line nav links] — [Zone 3: 1 primary action]
 */

import React from 'react';
import { GameflowPhase } from '../core/types';

export type WorkspaceTabId =
  | 'smart-bp'
  | 'match-analytics'
  | 'aram-arena'
  | 'client-toolkit'
  | 'tauri-kernel';

interface TopBarProps {
  activeTab: WorkspaceTabId;
  onSelectTab: (tab: WorkspaceTabId) => void;
  gameflowPhase: GameflowPhase;
  onToggleInGameUnlock: () => void;
}

const NAV_ITEMS: Array<{ id: WorkspaceTabId; label: string }> = [
  { id: 'smart-bp', label: 'BP 查房与自动化' },
  { id: 'match-analytics', label: '战绩穿透与 AI 审判' },
  { id: 'aram-arena', label: '大乱斗 & 斗魂竞技场' },
  { id: 'client-toolkit', label: '客户端工具箱' },
  { id: 'tauri-kernel', label: 'Tauri 2 内核台' },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  gameflowPhase,
  onToggleInGameUnlock,
}) => {
  const isEnemiesUnlocked =
    gameflowPhase === GameflowPhase.IN_PROGRESS ||
    gameflowPhase === GameflowPhase.END_OF_GAME;

  return (
    <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-slate-950/95 border-b border-slate-800/80 sticky top-0 z-30 backdrop-blur-md">
      {/* Zone 1: Single text element wordmark */}
      <a
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          onSelectTab('smart-bp');
        }}
        className="font-display text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0 hover:text-sky-400 transition-colors"
      >
        NexusAkari Pro
      </a>

      {/* Zone 2: 5 concise single-line text navigation links */}
      <nav
        aria-label="主工作区导航"
        className="flex items-center gap-6 text-sm font-medium text-slate-400 overflow-x-auto"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                isActive
                  ? 'text-sky-400 border-sky-400 font-semibold'
                  : 'text-slate-400 border-transparent hover:text-slate-100 hover:border-slate-700'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onToggleInGameUnlock}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
            isEnemiesUnlocked
              ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
              : 'bg-sky-500 text-slate-950 hover:bg-sky-400'
          }`}
        >
          {isEnemiesUnlocked ? '返回排位BP阶段 (敌方匿名)' : '跃迁局内对抗 (解锁敌方5人)'}
        </button>
      </div>
    </header>
  );
};
