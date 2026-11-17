/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { Sparkles, Volume2, WifiOff } from 'lucide-react';
import { ChatComposer } from './components/ChatComposer';
import { ChatMessageCard } from './components/ChatMessageCard';
import { AccountModal, InstallModal, SettingsModal } from './components/Modals';
import { NutcrackerStage } from './components/NutcrackerStage';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { usePWAInstall } from './hooks/usePWAInstall';
import {
  auth,
  deleteConversationFromCloud,
  generateSafeId,
  saveMessageToCloud,
  signInWithGoogle,
  signOutUser,
  subscribeConversations,
  subscribeMessages,
  syncUserProfile,
  updateUserSettingsInCloud,
} from './lib/firebase';
import type {
  AvatarState,
  ChatMessage,
  Conversation,
  UserSettings,
} from './types/chat';

const DEFAULT_SETTINGS: UserSettings = {
  theme: 'dark',
  voiceName: 'Charon',
  autoSpeak: true,
  model: 'gemini-4-hydrogen',
  searchGrounding: true,
};

const GUEST_STORAGE_KEY = 'qarsildoq_guest_state_v1';
const SETTINGS_STORAGE_KEY = 'qarsildoq_settings_v1';

const SAMPLE_PROMPTS = [
  "O'zbekistonning poytaxti va tarixi haqida gapirib ber",
  "ChatGPT va Gemini qanday ishlaydi?",
  "Bugun qanday foydali maslahat bera olasan?",
];

interface GuestStorage {
  conversations: Conversation[];
  messagesByConv: Record<string, ChatMessage[]>;
}

function loadSettingsFromLocal(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function loadGuestStorage(): GuestStorage {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return { conversations: [], messagesByConv: {} };
    return JSON.parse(raw);
  } catch {
    return { conversations: [], messagesByConv: {} };
  }
}

export default function App() {
  const [settings, setSettings] = useState<UserSettings>(loadSettingsFromLocal);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [guestStore, setGuestStore] = useState<GuestStorage>(loadGuestStorage);

  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState<{
    previewUrl: string;
    base64: string;
    mimeType: string;
  } | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [avatarState, setAvatarState] = useState<AvatarState>('idle');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [micLevels, setMicLevels] = useState<number[]>(Array(26).fill(0.2));

  const mouthLevelRef = useRef<number>(0);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Audio playback refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const speechRafRef = useRef<number>(0);

  // Mic recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micRafRef = useRef<number>(0);
  const audioChunksRef = useRef<Blob[]>([]);

  const { canNativeInstall, isInstalled, isIOS, install } = usePWAInstall();

  // Apply dark/light mode to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', settings.theme === 'dark' ? '#09090d' : '#f8fafc');
    }
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage quota errors
    }
  }, [settings]);

  // Online/offline status
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Firebase Auth listener & profile sync
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (currentUser) {
        try {
          const syncedSettings = await syncUserProfile(currentUser, settings);
          setSettings(syncedSettings);
        } catch (err) {
          console.error('Profile sync error:', err);
        }
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe to conversations (Cloud if signed in, localStorage if guest)
  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setConversations(guestStore.conversations);
      if (activeConversationId) {
        setMessages(guestStore.messagesByConv[activeConversationId] || []);
      } else {
        setMessages([]);
      }
      return;
    }

    const unsub = subscribeConversations(
      user.uid,
      (list) => {
        setConversations(list);
      },
      (err) => {
        setErrorBanner(err.message);
      }
    );
    return () => unsub();
  }, [authReady, user, guestStore, activeConversationId]);

  // Subscribe to messages for active conversation
  useEffect(() => {
    if (!authReady || !user || !activeConversationId) {
      if (!user) {
        setMessages(
          activeConversationId ? guestStore.messagesByConv[activeConversationId] || [] : []
        );
      } else if (!activeConversationId) {
        setMessages([]);
      }
      return;
    }

    const unsub = subscribeMessages(
      user.uid,
      activeConversationId,
      (list) => {
        setMessages(list);
      },
      (err) => {
        setErrorBanner(err.message);
      }
    );
    return () => unsub();
  }, [authReady, user, activeConversationId, guestStore]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isSending]);

  const stopSpeaking = useCallback(() => {
    cancelAnimationFrame(speechRafRef.current);
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.stop();
        activeSourceRef.current.disconnect();
      } catch {
        // Ignore already stopped
      }
      activeSourceRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    mouthLevelRef.current = 0;
    setSpeakingMessageId(null);
    setAvatarState((prev) => (prev === 'speaking' ? 'idle' : prev));
  }, []);

  const speakText = useCallback(
    async (textToSpeak: string, messageId: string) => {
      stopSpeaking();
      if (!textToSpeak.trim()) return;

      setSpeakingMessageId(messageId);
      setAvatarState('speaking');

      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: textToSpeak,
            voiceName: settings.voiceName,
          }),
        });

        if (!res.ok) {
          throw new Error('TTS javobi olinmadi');
        }

        const data = (await res.json()) as { audioBase64?: string };
        if (!data.audioBase64) {
          throw new Error('Bo‘sh audio javob');
        }

        const binary = atob(data.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
          audioCtxRef.current = new AudioCtx();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.65;
        const freqData = new Uint8Array(analyser.frequencyBinCount);

        source.connect(analyser);
        analyser.connect(ctx.destination);
        activeSourceRef.current = source;

        const updateLipSync = () => {
          if (!activeSourceRef.current) return;
          analyser.getByteFrequencyData(freqData);
          let sum = 0;
          const bins = Math.min(28, freqData.length);
          for (let i = 1; i < bins; i++) {
            sum += freqData[i];
          }
          const avg = sum / Math.max(1, bins - 1);
          mouthLevelRef.current = Math.min(1, (avg / 145) * 1.15);
          speechRafRef.current = requestAnimationFrame(updateLipSync);
        };

        source.onended = () => {
          cancelAnimationFrame(speechRafRef.current);
          mouthLevelRef.current = 0;
          activeSourceRef.current = null;
          setSpeakingMessageId(null);
          setAvatarState('idle');
        };

        source.start(0);
        updateLipSync();
      } catch (err) {
        console.warn('Gemini TTS fallback to browser speechSynthesis:', err);
        if ('speechSynthesis' in window) {
          const utter = new SpeechSynthesisUtterance(textToSpeak);
          utter.lang = 'uz-UZ';
          utter.rate = 1.0;
          let active = true;
          const pulseMouth = () => {
            if (!active) return;
            mouthLevelRef.current = 0.25 + Math.random() * 0.55;
            speechRafRef.current = requestAnimationFrame(pulseMouth);
          };
          utter.onend = () => {
            active = false;
            cancelAnimationFrame(speechRafRef.current);
            mouthLevelRef.current = 0;
            setSpeakingMessageId(null);
            setAvatarState('idle');
          };
          utter.onerror = () => {
            active = false;
            cancelAnimationFrame(speechRafRef.current);
            mouthLevelRef.current = 0;
            setSpeakingMessageId(null);
            setAvatarState('idle');
          };
          pulseMouth();
          window.speechSynthesis.speak(utter);
        } else {
          mouthLevelRef.current = 0;
          setSpeakingMessageId(null);
          setAvatarState('idle');
        }
      }
    },
    [settings.voiceName, stopSpeaking]
  );

  const handleUpdateSettings = useCallback(
    async (partial: Partial<UserSettings>) => {
      setSettings((prev) => ({ ...prev, ...partial }));
      if (user) {
        try {
          await updateUserSettingsInCloud(user.uid, partial);
        } catch (err) {
          console.error('Failed to sync settings:', err);
        }
      }
    },
    [user]
  );

  const persistGuestMessage = useCallback(
    (
      convId: string,
      title: string,
      msg: ChatMessage,
      isNewConv: boolean
    ) => {
      setGuestStore((prev) => {
        const existingMsgs = prev.messagesByConv[convId] || [];
        const updatedMsgs = [...existingMsgs, msg];
        const preview = msg.text.replace(/\s+/g, ' ').slice(0, 200);
        const now = Date.now();
        let nextConvs = [...prev.conversations];
        if (isNewConv) {
          nextConvs = [
            {
              id: convId,
              title,
              lastMessagePreview: preview,
              messageCount: updatedMsgs.length,
              createdAt: now,
              updatedAt: now,
            },
            ...nextConvs,
          ];
        } else {
          nextConvs = nextConvs.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  title,
                  lastMessagePreview: preview,
                  messageCount: updatedMsgs.length,
                  updatedAt: now,
                }
              : c
          );
        }
        const nextStore: GuestStorage = {
          conversations: nextConvs,
          messagesByConv: {
            ...prev.messagesByConv,
            [convId]: updatedMsgs,
          },
        };
        try {
          localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(nextStore));
        } catch {
          // Ignore quota issues
        }
        return nextStore;
      });
    },
    []
  );

  const sendMessage = useCallback(
    async (overrideText?: string, forceSpeak?: boolean) => {
      const text = (overrideText ?? input).trim();
      if (!text && !attachedImage) return;
      if (isSending) return;

      stopSpeaking();
      setErrorBanner(null);

      const promptText = text || 'Ushbu rasmni tahlil qilib tushuntirib bering.';
      const isNewConversation = !activeConversationId;
      const convId = activeConversationId || generateSafeId('conv');
      if (isNewConversation) {
        setActiveConversationId(convId);
      }

      const existingConv = conversations.find((c) => c.id === convId);
      const convTitle =
        existingConv?.title ||
        promptText.replace(/\s+/g, ' ').slice(0, 60) ||
        'Yangi suhbat';

      const userMsgId = generateSafeId('msg');
      const userMessage: ChatMessage = {
        id: userMsgId,
        conversationId: convId,
        role: 'user',
        text: promptText,
        createdAt: Date.now(),
      };

      const optimisticHistory = [...messages, userMessage];
      setMessages(optimisticHistory);
      if (!overrideText) setInput('');

      const imagePayload = attachedImage
        ? { base64: attachedImage.base64, mimeType: attachedImage.mimeType }
        : null;
      setAttachedImage(null);

      setIsSending(true);
      setAvatarState('thinking');

      try {
        if (user) {
          await saveMessageToCloud({
            userId: user.uid,
            conversationId: convId,
            conversationTitle: convTitle,
            isNewConversation,
            newMessageCount: optimisticHistory.length,
            message: {
              id: userMsgId,
              role: 'user',
              text: promptText,
            },
          });
        } else {
          persistGuestMessage(convId, convTitle, userMessage, isNewConversation);
        }

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: optimisticHistory.map((m) => ({
              role: m.role,
              text: m.text,
            })),
            model: settings.model,
            searchGrounding: settings.searchGrounding,
            imageBase64: imagePayload?.base64,
            imageMimeType: imagePayload?.mimeType,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'AI javobini olishda xatolik');
        }

        const assistantMsgId = generateSafeId('msg');
        const assistantMessage: ChatMessage = {
          id: assistantMsgId,
          conversationId: convId,
          role: 'assistant',
          text: data.text,
          funFact: data.funFact || null,
          sources: data.sources || [],
          model: data.model,
          speechText: data.speechText || data.text,
          createdAt: Date.now(),
        };

        const updatedHistory = [...optimisticHistory, assistantMessage];
        setMessages(updatedHistory);

        if (user) {
          await saveMessageToCloud({
            userId: user.uid,
            conversationId: convId,
            conversationTitle: convTitle,
            isNewConversation: false,
            newMessageCount: updatedHistory.length,
            message: {
              id: assistantMsgId,
              role: 'assistant',
              text: assistantMessage.text,
              funFact: assistantMessage.funFact,
              sources: assistantMessage.sources,
              model: assistantMessage.model,
            },
          });
        } else {
          persistGuestMessage(convId, convTitle, assistantMessage, false);
        }

        setIsSending(false);

        if (forceSpeak || settings.autoSpeak) {
          void speakText(assistantMessage.speechText || assistantMessage.text, assistantMsgId);
        } else {
          setAvatarState('idle');
        }
      } catch (err) {
        console.error('Send message error:', err);
        setIsSending(false);
        setAvatarState('idle');
        setErrorBanner(
          err instanceof Error ? err.message : "Xabar yuborishda xatolik yuz berdi."
        );
      }
    },
    [
      input,
      attachedImage,
      isSending,
      stopSpeaking,
      activeConversationId,
      conversations,
      messages,
      user,
      settings.model,
      settings.searchGrounding,
      settings.autoSpeak,
      persistGuestMessage,
      speakText,
    ]
  );

  // Voice recording & transcription
  const stopRecordingAndTranscribe = useCallback(() => {
    cancelAnimationFrame(micRafRef.current);
    setIsRecording(false);
    setMicLevels(Array(26).fill(0.2));

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
  }, []);

  const handleToggleRecord = useCallback(async () => {
    if (isRecording) {
      stopRecordingAndTranscribe();
      return;
    }

    stopSpeaking();
    setErrorBanner(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      // Live audio waveform analyzer
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateWaveform = () => {
        if (!micStreamRef.current) {
          void ctx.close();
          return;
        }
        analyser.getByteFrequencyData(dataArray);
        const bars: number[] = [];
        for (let i = 0; i < 26; i++) {
          const val = dataArray[i % dataArray.length] / 255;
          bars.push(Math.max(0.18, Math.min(1, val * 1.45)));
        }
        setMicLevels(bars);
        micRafRef.current = requestAnimationFrame(updateWaveform);
      };

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        void ctx.close();
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        if (blob.size < 400) {
          setAvatarState('idle');
          return;
        }

        setIsTranscribing(true);
        setAvatarState('thinking');

        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = String(reader.result || '');
              const comma = result.indexOf(',');
              resolve(comma >= 0 ? result.slice(comma + 1) : result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          const res = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64,
              mimeType: mimeType.split(';')[0],
            }),
          });

          const data = (await res.json()) as { text?: string; error?: string };
          if (!res.ok) {
            throw new Error(data.error || 'Ovozni tushunib bo‘lmadi');
          }

          const transcribed = (data.text || '').trim();
          setIsTranscribing(false);
          if (transcribed) {
            await sendMessage(transcribed, true);
          } else {
            setAvatarState('idle');
            setErrorBanner("Ovoz eshitilmadi, iltimos qayta urinib ko'ring.");
          }
        } catch (err) {
          setIsTranscribing(false);
          setAvatarState('idle');
          setErrorBanner(
            err instanceof Error ? err.message : 'Ovozni qayta ishlashda xatolik.'
          );
        }
      };

      recorder.start();
      setIsRecording(true);
      setAvatarState('listening');
      updateWaveform();
    } catch (err) {
      console.error('Mic error:', err);
      setAvatarState('idle');
      setErrorBanner(
        "Mikrofonga ruxsat berilmadi. Brauzer sozlamalaridan mikrofonni yoqing."
      );
    }
  }, [isRecording, sendMessage, stopRecordingAndTranscribe, stopSpeaking]);

  const handleAttachImage = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = String(reader.result || '');
      const comma = dataUrl.indexOf(',');
      if (comma > 0) {
        setAttachedImage({
          previewUrl: dataUrl,
          base64: dataUrl.slice(comma + 1),
          mimeType: file.type || 'image/jpeg',
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleNewChat = () => {
    stopSpeaking();
    setActiveConversationId(null);
    setMessages([]);
    setErrorBanner(null);
  };

  const handleDeleteConversation = async (id: string) => {
    if (activeConversationId === id) {
      handleNewChat();
    }
    if (user) {
      try {
        await deleteConversationFromCloud(user.uid, id);
      } catch (err) {
        setErrorBanner(err instanceof Error ? err.message : "O'chirishda xatolik");
      }
    } else {
      setGuestStore((prev) => {
        const nextConvs = prev.conversations.filter((c) => c.id !== id);
        const nextMsgs = { ...prev.messagesByConv };
        delete nextMsgs[id];
        const next = { conversations: nextConvs, messagesByConv: nextMsgs };
        try {
          localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Ignore
        }
        return next;
      });
    }
  };

  const handleSignIn = async () => {
    setAuthLoading(true);
    try {
      await signInWithGoogle();
      setAccountOpen(false);
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Google orqali kirishda xatolik.'
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    setAuthLoading(true);
    try {
      await signOutUser();
      setActiveConversationId(null);
      setMessages([]);
      setAccountOpen(false);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Chiqishda xatolik.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleOpenInstall = async () => {
    if (canNativeInstall) {
      const outcome = await install();
      if (outcome === 'accepted') return;
    }
    setInstallOpen(true);
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-slate-50 dark:bg-[#09090d] text-slate-900 dark:text-slate-100">
      <TopBar
        theme={settings.theme}
        user={user}
        isInstalled={isInstalled}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onNewChat={handleNewChat}
        onToggleTheme={() =>
          void handleUpdateSettings({
            theme: settings.theme === 'dark' ? 'light' : 'dark',
          })
        }
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenAccount={() => setAccountOpen(true)}
        onOpenInstall={handleOpenInstall}
      />

      <div className="flex-1 min-h-0 flex relative">
        <Sidebar
          isOpen={sidebarOpen}
          conversations={conversations}
          activeConversationId={activeConversationId}
          user={user}
          onClose={() => setSidebarOpen(false)}
          onNewChat={handleNewChat}
          onSelectConversation={(id) => {
            stopSpeaking();
            setActiveConversationId(id);
          }}
          onDeleteConversation={handleDeleteConversation}
          onOpenAccount={() => setAccountOpen(true)}
        />

        {/* Main Split Workspace: Left 3D Nutcracker Stage + Right ChatGPT/Gemini Chat Stream */}
        <main className="flex-1 min-w-0 min-h-0 grid grid-cols-1 lg:grid-cols-[44%_56%]">
          {/* 3D Interactive Qarsildoq AI Studio Stage */}
          <section className="p-2.5 sm:p-4 pb-0 lg:pb-4 lg:pr-0 h-56 sm:h-64 lg:h-full min-h-0">
            <NutcrackerStage
              avatarState={avatarState}
              mouthLevelRef={mouthLevelRef}
              theme={settings.theme}
            />
          </section>

          {/* Chat Thread & Bottom Composer */}
          <section className="flex flex-col min-h-0 h-full">
            {!isOnline && (
              <div className="mx-3 sm:mx-5 mt-2 rounded-xl border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
                <WifiOff className="w-4 h-4 shrink-0" />
                <span>Internet aloqasi uzildi — saqlangan suhbatlar ko&apos;rsatilmoqda.</span>
              </div>
            )}

            {errorBanner && (
              <div className="mx-3 sm:mx-5 mt-2 rounded-xl border border-red-300 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-2">
                <span className="break-words">{errorBanner}</span>
                <button
                  type="button"
                  onClick={() => setErrorBanner(null)}
                  className="font-semibold underline shrink-0"
                >
                  Yopish
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar px-3 sm:px-5 py-4">
              <div className="max-w-3xl mx-auto space-y-4">
                {messages.length === 0 ? (
                  <div className="pt-2 sm:pt-6 space-y-5">
                    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#14141d] p-5 shadow-sm">
                      <div className="flex items-center gap-3 mb-3">
                        <img
                          src="/icon.svg"
                          alt="Qarsildoq AI"
                          className="w-10 h-10 rounded-xl"
                        />
                        <div>
                          <h1 className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                            Salom! Men Qarsildoq AI
                          </h1>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Ovozli va matnli aqlli yordamchingiz
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        Savolingizni pastdagi maydonga yozing yoki{' '}
                        <strong className="text-red-600 dark:text-red-400">
                          Ovozli xabar
                        </strong>{' '}
                        tugmasini bosib jonli gaplashing — men sizga ovoz bilan javob qaytaraman!
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void speakText(
                              "Salom! Men Qarsildoq AI, sizning aqlli yordamchingizman! Istagan mavzuda savol bering.",
                              'welcome-demo'
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/10 hover:bg-red-600 text-red-600 dark:text-red-400 hover:text-white text-xs font-semibold transition-colors"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>Ovozni sinab ko&apos;rish</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2.5 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-red-500" />
                        Namuna savollar
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {SAMPLE_PROMPTS.map((prompt) => (
                          <button
                            key={prompt}
                            type="button"
                            onClick={() => void sendMessage(prompt)}
                            className="text-left rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#14141d] hover:border-red-500/50 p-3 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors leading-relaxed"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <ChatMessageCard
                      key={msg.id}
                      message={msg}
                      isSpeakingThis={speakingMessageId === msg.id}
                      onSpeak={(m) => void speakText(m.speechText || m.text, m.id)}
                      onStopSpeaking={stopSpeaking}
                    />
                  ))
                )}

                {isSending && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-[#1b1b26] border border-slate-200 dark:border-white/10 flex items-center justify-center shrink-0">
                      <img src="/icon.svg" alt="Qarsildoq AI" className="w-6 h-6" />
                    </div>
                    <div className="rounded-2xl rounded-tl-sm border border-slate-200 dark:border-white/10 bg-white dark:bg-[#14141d] px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                      Qarsildoq AI javob yozmoqda...
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            <ChatComposer
              input={input}
              isSending={isSending}
              isRecording={isRecording}
              isTranscribing={isTranscribing}
              micLevels={micLevels}
              attachedImage={attachedImage}
              onChangeInput={setInput}
              onSend={() => void sendMessage()}
              onToggleRecord={() => void handleToggleRecord()}
              onAttachImage={handleAttachImage}
              onRemoveImage={() => setAttachedImage(null)}
            />
          </section>
        </main>
      </div>

      <SettingsModal
        isOpen={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onUpdate={(partial) => void handleUpdateSettings(partial)}
      />

      <AccountModal
        isOpen={accountOpen}
        user={user}
        authLoading={authLoading}
        conversationCount={conversations.length}
        onClose={() => setAccountOpen(false)}
        onSignIn={() => void handleSignIn()}
        onSignOut={() => void handleSignOut()}
      />

      <InstallModal
        isOpen={installOpen}
        canNativeInstall={canNativeInstall}
        isIOS={isIOS}
        onClose={() => setInstallOpen(false)}
        onNativeInstall={() => {
          void install().then((res) => {
            if (res === 'accepted') setInstallOpen(false);
          });
        }}
      />
    </div>
  );
}
