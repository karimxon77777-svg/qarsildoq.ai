import React, { useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Info,
  Link2,
  Square,
  Volume2,
} from 'lucide-react';
import type { ChatMessage } from '../types/chat';

interface ChatMessageCardProps {
  message: ChatMessage;
  isSpeakingThis: boolean;
  onSpeak: (message: ChatMessage) => void;
  onStopSpeaking: () => void;
}

function renderFormattedText(text: string) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return <div key={i} className="h-2" />;
    }

    // Inline bold rendering **text**
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    const renderedParts = parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={idx} className="font-semibold text-slate-900 dark:text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={idx}
            className="font-mono text-xs px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-red-600 dark:text-red-400"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      return (
        <div key={i} className="flex items-start gap-2 pl-1">
          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
          <p className="leading-relaxed">{renderedParts.map((p, k) => (typeof p === 'string' && k === 0 ? p.replace(/^\s*[-*]\s+/, '') : p))}</p>
        </div>
      );
    }

    if (trimmed.startsWith('### ')) {
      return (
        <h4 key={i} className="font-display font-semibold text-base text-slate-900 dark:text-white pt-1">
          {trimmed.slice(4)}
        </h4>
      );
    }

    if (trimmed.startsWith('## ')) {
      return (
        <h3 key={i} className="font-display font-bold text-lg text-slate-900 dark:text-white pt-1">
          {trimmed.slice(3)}
        </h3>
      );
    }

    return (
      <p key={i} className="leading-relaxed">
        {renderedParts}
      </p>
    );
  });
}

export const ChatMessageCard: React.FC<ChatMessageCardProps> = ({
  message,
  isSpeakingThis,
  onSpeak,
  onStopSpeaking,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard denied silently
    }
  };

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] sm:max-w-[78%] rounded-2xl rounded-tr-sm bg-red-600 text-white px-4 py-3 text-sm sm:text-[15px] leading-relaxed shadow-sm">
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-[#1b1b26] border border-slate-200 dark:border-white/10 flex items-center justify-center shrink-0 mt-0.5 overflow-hidden">
        <img src="/icon.svg" alt="Qarsildoq AI" className="w-7 h-7 object-contain" />
      </div>

      <div className="flex-1 min-w-0 rounded-2xl rounded-tl-sm border border-slate-200 dark:border-white/10 bg-white dark:bg-[#14141d] px-4 py-3.5 shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="font-display text-xs font-semibold text-red-600 dark:text-red-400">
            Qarsildoq AI
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => (isSpeakingThis ? onStopSpeaking() : onSpeak(message))}
              className={`h-7 px-2 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                isSpeakingThis
                  ? 'bg-red-600 text-white'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={isSpeakingThis ? "Ovozni to'xtatish" : 'Ovozda tinglash'}
            >
              {isSpeakingThis ? (
                <>
                  <Square className="w-3 h-3 fill-current" />
                  <span>To&apos;xtatish</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Tinglash</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors"
              title="Nusxalash"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div className="text-sm sm:text-[15px] text-slate-700 dark:text-slate-200 space-y-1.5 break-words">
          {renderFormattedText(message.text)}
        </div>

        {/* Grounding Sources (Manba) */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/10 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
            <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 font-medium">
              <Link2 className="w-3.5 h-3.5" />
              Manba:
            </span>
            {message.sources.map((src, idx) => (
              <a
                key={idx}
                href={src.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:underline max-w-[220px] truncate"
              >
                <span className="truncate">{src.title}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            ))}
          </div>
        )}

        {/* Fun Fact Callout (Qiziqarli ma'lumot) */}
        {message.funFact && (
          <div className="mt-3 rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50/60 dark:bg-red-500/5 px-3.5 py-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400 mb-1">
              <Info className="w-3.5 h-3.5" />
              <span>Qiziqarli ma&apos;lumot:</span>
            </div>
            <p className="text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">
              {message.funFact}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
