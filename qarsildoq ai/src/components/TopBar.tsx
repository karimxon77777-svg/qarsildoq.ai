import React from 'react';
import {
  Download,
  Menu,
  Moon,
  Plus,
  Settings,
  Sun,
  User as UserIcon,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { ThemeMode } from '../types/chat';

interface TopBarProps {
  theme: ThemeMode;
  user: User | null;
  isInstalled: boolean;
  onToggleSidebar: () => void;
  onNewChat: () => void;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onOpenAccount: () => void;
  onOpenInstall: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  theme,
  user,
  isInstalled,
  onToggleSidebar,
  onNewChat,
  onToggleTheme,
  onOpenSettings,
  onOpenAccount,
  onOpenInstall,
}) => {
  return (
    <header className="h-14 shrink-0 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-[#0e0e14] px-3 sm:px-5 flex items-center justify-between gap-4 z-30">
      {/* Zone 1: Brand & Sidebar toggle */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Yon menyuni ochish"
          className="h-10 w-10 inline-flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onNewChat();
          }}
          className="flex items-center gap-2.5 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-lg"
        >
          <img
            src="/icon.svg"
            alt="qarsildoq.ai"
            className="w-7 h-7 rounded-lg shrink-0"
          />
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            qarsildoq<span className="text-red-600 dark:text-red-500">.ai</span>
          </span>
        </a>
      </div>

      {/* Zone 2 & 3: Action Menu (Yuklash, Theme, Sozlamalar, Hisob qaydnomasi) */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <button
          type="button"
          onClick={onNewChat}
          className="hidden md:inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Yangi suhbat</span>
        </button>

        {!isInstalled && (
          <button
            type="button"
            onClick={onOpenInstall}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors whitespace-nowrap shrink-0 shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>Yuklash</span>
          </button>
        )}

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Yorug rejimga otish' : 'Qorongu rejimga otish'}
          title={theme === 'dark' ? 'Yorug rejim' : 'Qorongu rejim'}
          className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors shrink-0"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          className="inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
        >
          <Settings className="w-4 h-4" />
          <span className="hidden sm:inline">Sozlamalar</span>
        </button>

        <button
          type="button"
          onClick={onOpenAccount}
          className="inline-flex items-center gap-2 h-9 pl-1.5 pr-2.5 sm:pr-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-medium text-slate-800 dark:text-slate-100 transition-colors whitespace-nowrap shrink-0"
        >
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'Hisob'}
              referrerPolicy="no-referrer"
              className="w-6 h-6 rounded-lg object-cover shrink-0"
            />
          ) : (
            <span className="w-6 h-6 rounded-lg bg-red-600/15 text-red-600 dark:text-red-400 inline-flex items-center justify-center shrink-0">
              <UserIcon className="w-3.5 h-3.5" />
            </span>
          )}
          <span className="hidden sm:inline max-w-[120px] truncate">
            {user ? user.displayName?.split(' ')[0] || 'Hisob' : 'Hisob'}
          </span>
        </button>
      </div>
    </header>
  );
};
