import React, { useEffect, useRef } from 'react';
import { ImagePlus, Mic, Send, Square, X } from 'lucide-react';

interface ChatComposerProps {
  input: string;
  isSending: boolean;
  isRecording: boolean;
  isTranscribing: boolean;
  micLevels: number[];
  attachedImage: { previewUrl: string; base64: string; mimeType: string } | null;
  onChangeInput: (val: string) => void;
  onSend: () => void;
  onToggleRecord: () => void;
  onAttachImage: (file: File) => void;
  onRemoveImage: () => void;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  input,
  isSending,
  isRecording,
  isTranscribing,
  micLevels,
  attachedImage,
  onChangeInput,
  onSend,
  onToggleRecord,
  onAttachImage,
  onRemoveImage,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 136)}px`;
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() || attachedImage) {
        onSend();
      }
    }
  };

  return (
    <div className="shrink-0 pt-2 pb-3 sm:pb-4 px-3 sm:px-5 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent dark:from-[#09090d] dark:via-[#09090d]/95 dark:to-transparent">
      <div className="max-w-3xl mx-auto">
        {attachedImage && (
          <div className="mb-2 inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#15151f] p-1.5 pr-2.5 shadow-sm">
            <img
              src={attachedImage.previewUrl}
              alt="Biriktirilgan rasm"
              className="w-10 h-10 rounded-lg object-cover"
            />
            <span className="text-xs text-slate-600 dark:text-slate-300">Rasm biriktirildi</span>
            <button
              type="button"
              onClick={onRemoveImage}
              aria-label="Rasmni olib tashlash"
              className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div
          className={`relative rounded-2xl border transition-all duration-200 bg-white dark:bg-[#14141d] shadow-sm ${
            isRecording
              ? 'border-red-500 ring-2 ring-red-500/25'
              : 'border-slate-200 dark:border-white/15 focus-within:border-red-500/70'
          }`}
        >
          {isRecording ? (
            <div className="flex items-center gap-3 px-4 py-3 min-h-[56px]">
              <button
                type="button"
                onClick={onToggleRecord}
                aria-label="Ovoz yozishni to'xtatish"
                className="h-10 w-10 rounded-xl bg-red-600 hover:bg-red-700 text-white inline-flex items-center justify-center shrink-0 transition-transform active:scale-95"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>

              <div className="flex-1 flex items-center gap-1 h-9 overflow-hidden" aria-label="Ovoz to'lqini">
                {micLevels.map((lvl, idx) => (
                  <span
                    key={idx}
                    style={{
                      transform: `scaleY(${Math.max(0.16, Math.min(1, lvl))})`,
                    }}
                    className="flex-1 max-w-[6px] h-8 rounded-full bg-gradient-to-t from-red-600 to-rose-400 transition-transform duration-75 origin-center"
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={onToggleRecord}
                className="h-10 px-3.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Yuborish</span>
              </button>
            </div>
          ) : (
            <div className="flex items-end gap-2 p-2 sm:p-2.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onAttachImage(file);
                  e.target.value = '';
                }}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSending || isTranscribing}
                title="Rasm biriktirish"
                aria-label="Rasm biriktirish"
                className="h-10 w-10 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white inline-flex items-center justify-center shrink-0 transition-colors disabled:opacity-50"
              >
                <ImagePlus className="w-5 h-5" />
              </button>

              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => onChangeInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isTranscribing}
                placeholder={
                  isTranscribing
                    ? 'Ovoz matnga aylantirilmoqda...'
                    : 'Qarsildoq AI ga savolingizni yozing...'
                }
                className="flex-1 resize-none bg-transparent py-2 px-1 text-sm sm:text-[15px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none max-h-36 leading-relaxed"
              />

              <button
                type="button"
                onClick={onToggleRecord}
                disabled={isSending || isTranscribing}
                title="Ovozli xabar yuborish"
                aria-label="Ovozli xabar yuborish"
                className="h-10 px-3 rounded-xl border border-red-500/30 bg-red-600/10 hover:bg-red-600 text-red-600 dark:text-red-400 hover:text-white inline-flex items-center gap-1.5 shrink-0 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <Mic className="w-4 h-4" />
                <span className="hidden sm:inline">Ovozli xabar</span>
              </button>

              <button
                type="button"
                onClick={onSend}
                disabled={isSending || isTranscribing || (!input.trim() && !attachedImage)}
                aria-label="Xabar yuborish"
                className="h-10 w-10 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-slate-200 dark:disabled:bg-white/10 text-white disabled:text-slate-400 inline-flex items-center justify-center shrink-0 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <p className="mt-1.5 text-center text-[11px] text-slate-500 dark:text-slate-400">
          qarsildoq.ai · Ovozli va matnli aqlli yordamchi
        </p>
      </div>
    </div>
  );
};
