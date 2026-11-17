import React, { useMemo, useState } from 'react';
import { Cloud, CloudOff, MessageSquare, Plus, Search, Trash2, X } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { Conversation } from '../types/chat';

interface SidebarProps {
  isOpen: boolean;
  conversations: Conversation[];
  activeConversationId: string | null;
  user: User | null;
  onClose: () => void;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onOpenAccount: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  conversations,
  activeConversationId,
  user,
  onClose,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onOpenAccount,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.lastMessagePreview.toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        aria-hidden="true"
      />

      <aside className="fixed lg:static inset-y-0 left-0 z-50 w-72 shrink-0 bg-white dark:bg-[#0e0e14] border-r border-slate-200 dark:border-white/10 flex flex-col h-full">
        <div className="p-3.5 flex items-center justify-between gap-2 border-b border-slate-200 dark:border-white/10">
          <button
            type="button"
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="flex-1 h-10 px-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Yangi suhbat</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yon menyuni yopish"
            className="lg:hidden h-10 w-10 inline-flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search input */}
        <div className="p-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Suhbatlardan qidirish..."
              className="w-full h-9 pl-9 pr-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-transparent focus:border-red-500/50 focus:outline-none text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-2.5 pb-3 space-y-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {searchQuery
                  ? "Mos suhbat topilmadi."
                  : "Hali suhbatlar yo'q. Yangi savol bering."}
              </p>
            </div>
          ) : (
            filtered.map((conv) => {
              const active = conv.id === activeConversationId;
              return (
                <div
                  key={conv.id}
                  className={`group flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors cursor-pointer ${
                    active
                      ? 'bg-red-600/10 text-red-700 dark:text-red-400 font-medium'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                  onClick={() => {
                    onSelectConversation(conv.id);
                    onClose();
                  }}
                >
                  <MessageSquare className="w-4 h-4 shrink-0 opacity-70" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs font-medium">{conv.title}</p>
                    {conv.lastMessagePreview && (
                      <p className="truncate text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {conv.lastMessagePreview}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label="Suhbatni o'chirish"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteConversation(conv.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-all shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Cloud sync footer */}
        <div className="p-3 border-t border-slate-200 dark:border-white/10">
          <button
            type="button"
            onClick={onOpenAccount}
            className="w-full flex items-center gap-2.5 rounded-xl p-2.5 text-left hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            {user ? (
              <>
                <span className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 inline-flex items-center justify-center shrink-0">
                  <Cloud className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                    Bulutli sinxronizatsiya faol
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {user.email}
                  </p>
                </div>
              </>
            ) : (
              <>
                <span className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300 inline-flex items-center justify-center shrink-0">
                  <CloudOff className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                    Mehmon rejimi
                  </p>
                  <p className="text-[11px] text-red-600 dark:text-red-400">
                    Bulutda saqlash uchun kiring
                  </p>
                </div>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
};
