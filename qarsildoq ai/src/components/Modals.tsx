import React from 'react';
import {
  Check,
  Cloud,
  Download,
  Globe,
  LogIn,
  LogOut,
  Monitor,
  Smartphone,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { ModelId, UserSettings, VoiceName } from '../types/chat';

interface SettingsModalProps {
  isOpen: boolean;
  settings: UserSettings;
  onClose: () => void;
  onUpdate: (partial: Partial<UserSettings>) => void;
}

const VOICES: Array<{ id: VoiceName; label: string; desc: string }> = [
  { id: 'Charon', label: 'Charon', desc: 'Chuqur va ishonchli studiya ovozi' },
  { id: 'Puck', label: 'Puck', desc: 'Jonli va quvnoq suhbatdosh' },
  { id: 'Kore', label: 'Kore', desc: 'Ravon va mayin ovoz' },
  { id: 'Fenrir', label: 'Fenrir', desc: "Qat'iy va aniq diktor ovozi" },
  { id: 'Zephyr', label: 'Zephyr', desc: 'Yengil va samimiy ohang' },
];

const MODELS: Array<{ id: ModelId; label: string; desc: string }> = [
  {
    id: 'gemini-4-hydrogen',
    label: 'Gemini 4 Hydrogen',
    desc: 'Mukammal mantiq va internet manbalari bilan qidiruv',
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash Lite',
    desc: 'Eng tezkor javoblar uchun yengil rejim',
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  onClose,
  onUpdate,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#13131c] text-slate-900 dark:text-slate-100 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Sozlamalar</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="h-9 w-9 inline-flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {/* Theme */}
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
              Ko&apos;rinish rejimi
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(['dark', 'light'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onUpdate({ theme: mode })}
                  className={`h-10 rounded-xl border text-sm font-medium transition-colors ${
                    settings.theme === mode
                      ? 'border-red-600 bg-red-600/10 text-red-600 dark:text-red-400'
                      : 'border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
                  }`}
                >
                  {mode === 'dark' ? "Qorong'u rejim" : "Yorug' rejim"}
                </button>
              ))}
            </div>
          </div>

          {/* Model selection */}
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              AI Model
            </p>
            <div className="space-y-2">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onUpdate({ model: m.id })}
                  className={`w-full text-left rounded-xl border p-3 transition-colors flex items-center justify-between gap-3 ${
                    settings.model === m.id
                      ? 'border-red-600 bg-red-600/10'
                      : 'border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold">{m.label}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{m.desc}</p>
                  </div>
                  {settings.model === m.id && <Check className="w-4 h-4 text-red-600 shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Voice selection */}
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5" />
              Qarsildoq ovozi
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {VOICES.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onUpdate({ voiceName: v.id })}
                  className={`text-left rounded-xl border p-2.5 transition-colors ${
                    settings.voiceName === v.id
                      ? 'border-red-600 bg-red-600/10'
                      : 'border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
                  }`}
                >
                  <p className="text-xs font-semibold">{v.label}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{v.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3 pt-1">
            <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-white/10 p-3 cursor-pointer">
              <div>
                <p className="text-sm font-medium">Avtomatik ovozli javob</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Har bir javobni Qarsildoq ovoz bilan o&apos;qib beradi
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.autoSpeak}
                onChange={(e) => onUpdate({ autoSpeak: e.target.checked })}
                className="w-5 h-5 accent-red-600 rounded"
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-white/10 p-3 cursor-pointer">
              <div className="flex items-start gap-2.5">
                <Globe className="w-4 h-4 text-sky-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Internetdan qidiruv (Google Search)</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Yangi ma&apos;lumotlar va manbalarni avtomatik topadi
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.searchGrounding}
                onChange={(e) => onUpdate({ searchGrounding: e.target.checked })}
                className="w-5 h-5 accent-red-600 rounded"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

interface AccountModalProps {
  isOpen: boolean;
  user: User | null;
  authLoading: boolean;
  conversationCount: number;
  onClose: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  user,
  authLoading,
  conversationCount,
  onClose,
  onSignIn,
  onSignOut,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#13131c] text-slate-900 dark:text-slate-100 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Hisob qaydnomasi</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="h-9 w-9 inline-flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {user ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3.5">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Profil'}
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 rounded-2xl object-cover border border-slate-200 dark:border-white/10"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-red-600/15 text-red-600 flex items-center justify-center font-display font-bold text-xl">
                    {(user.displayName || 'Q')[0]}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-display font-semibold text-base truncate">
                    {user.displayName || 'Foydalanuvchi'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {user.email}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/70 dark:bg-emerald-500/10 p-3.5 flex items-start gap-3">
                <Cloud className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                    Bulutli sinxronizatsiya yoqilgan
                  </p>
                  <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80 mt-0.5">
                    Barcha {conversationCount} ta suhbatingiz va sozlamalaringiz kompyuter hamda telefoningizda avtomatik saqlanadi.
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={authLoading}
                onClick={onSignOut}
                className="w-full h-11 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Hisobdan chiqish</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4 text-center py-2">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-red-600/10 text-red-600 dark:text-red-400 flex items-center justify-center">
                <Cloud className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-display text-base font-semibold">
                  Bulutli saqlash tizimiga ulaning
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  Google hisobingiz bilan kiring — barcha suhbatlaringiz, tarix va ovoz sozlamalari barcha qurilmalaringizda avtomatik sinxronlanadi.
                </p>
              </div>
              <button
                type="button"
                disabled={authLoading}
                onClick={onSignIn}
                className="w-full h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-60"
              >
                <LogIn className="w-4 h-4" />
                <span>{authLoading ? 'Kirilmoqda...' : 'Google orqali kirish'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface InstallModalProps {
  isOpen: boolean;
  canNativeInstall: boolean;
  isIOS: boolean;
  onClose: () => void;
  onNativeInstall: () => void;
}

export const InstallModal: React.FC<InstallModalProps> = ({
  isOpen,
  canNativeInstall,
  isIOS,
  onClose,
  onNativeInstall,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#13131c] text-slate-900 dark:text-slate-100 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">qarsildoq.ai ni ilova sifatida o&apos;rnatish</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="h-9 w-9 inline-flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Hech qanday og&apos;ir dastur yuklamasdan, saytni kompyuter yoki telefoningizga yengil PWA ilova shaklida bir zumda o&apos;rnatishingiz mumkin.
          </p>

          {canNativeInstall && (
            <button
              type="button"
              onClick={onNativeInstall}
              className="w-full h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>Hozir o&apos;rnatish</span>
            </button>
          )}

          <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
            <div className="rounded-xl border border-slate-200 dark:border-white/10 p-3 flex items-start gap-3">
              <Monitor className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Kompyuterda (Chrome / Edge)</p>
                <p className="mt-0.5">
                  Brauzer manzil satrining o&apos;ng tomonidagi <strong>O&apos;rnatish (Install)</strong> belgisini yoki menyudan <strong>&ldquo;Save and share → Install page as app&rdquo;</strong> tugmasini bosing.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-white/10 p-3 flex items-start gap-3">
              <Smartphone className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {isIOS ? 'iPhone / iPad (Safari)' : 'Telefon (Android / iPhone)'}
                </p>
                <p className="mt-0.5">
                  <strong>Android Chrome:</strong> Menyu (⋮) → <strong>Ilovani o&apos;rnatish</strong>.<br />
                  <strong>iPhone Safari:</strong> Pastki <strong>Ulashish (Share)</strong> tugmasi → <strong>Bosh ekranga qo&apos;shish</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
