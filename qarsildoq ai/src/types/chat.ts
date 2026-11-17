export type ThemeMode = 'dark' | 'light';

export type VoiceName = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';

export type ModelId = 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';

export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface UserSettings {
  theme: ThemeMode;
  voiceName: VoiceName;
  autoSpeak: boolean;
  model: ModelId;
  searchGrounding: boolean;
}

export interface SourceLink {
  title: string;
  uri: string;
}

export interface ChatMessage {
  id: string;
  ownerId?: string;
  conversationId: string;
  role: 'user' | 'assistant';
  text: string;
  funFact?: string | null;
  sources?: SourceLink[];
  model?: string;
  speechText?: string;
  createdAt: number;
}

export interface Conversation {
  id: string;
  ownerId?: string;
  title: string;
  lastMessagePreview: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
}
