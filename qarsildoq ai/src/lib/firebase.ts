import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { ChatMessage, Conversation, SourceLink, UserSettings } from '../types/chat';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Firebase connection error: the client is offline.');
    }
  }
}

void testConnection();

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function signOutUser() {
  return signOut(auth);
}

function toMillis(ts: unknown): number {
  if (ts instanceof Timestamp) {
    return ts.toMillis();
  }
  if (typeof ts === 'number') return ts;
  return Date.now();
}

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
}

export function generateSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return sanitizeId(`${prefix}_${Date.now()}_${rand}`);
}

export async function syncUserProfile(
  user: User,
  fallbackSettings: UserSettings
): Promise<UserSettings> {
  const uid = sanitizeId(user.uid);
  const userRef = doc(db, 'users', uid);
  const path = `users/${uid}`;

  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      const merged: UserSettings = {
        theme: data.theme === 'light' ? 'light' : 'dark',
        voiceName: ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'].includes(data.voiceName)
          ? data.voiceName
          : fallbackSettings.voiceName,
        autoSpeak: typeof data.autoSpeak === 'boolean' ? data.autoSpeak : fallbackSettings.autoSpeak,
        model: ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'].includes(data.model)
          ? data.model
          : fallbackSettings.model,
        searchGrounding:
          typeof data.searchGrounding === 'boolean'
            ? data.searchGrounding
            : fallbackSettings.searchGrounding,
      };

      await updateDoc(userRef, {
        displayName: (user.displayName || 'Foydalanuvchi').slice(0, 120),
        email: (user.email || '').slice(0, 200),
        photoURL: (user.photoURL || '').slice(0, 500),
        updatedAt: serverTimestamp(),
      });

      return merged;
    }

    await setDoc(userRef, {
      uid,
      displayName: (user.displayName || 'Foydalanuvchi').slice(0, 120),
      email: (user.email || '').slice(0, 200),
      photoURL: (user.photoURL || '').slice(0, 500),
      theme: fallbackSettings.theme,
      voiceName: fallbackSettings.voiceName,
      autoSpeak: fallbackSettings.autoSpeak,
      model: fallbackSettings.model,
      searchGrounding: fallbackSettings.searchGrounding,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return fallbackSettings;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateUserSettingsInCloud(
  userId: string,
  settings: Partial<UserSettings>
): Promise<void> {
  const uid = sanitizeId(userId);
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      ...settings,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeConversations(
  userId: string,
  onData: (conversations: Conversation[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const uid = sanitizeId(userId);
  const path = `users/${uid}/conversations`;
  const q = query(
    collection(db, path),
    where('ownerId', '==', uid),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: Conversation[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ownerId: data.ownerId,
          title: String(data.title || 'Yangi suhbat'),
          lastMessagePreview: String(data.lastMessagePreview || ''),
          messageCount: Number(data.messageCount || 0),
          createdAt: toMillis(data.createdAt),
          updatedAt: toMillis(data.updatedAt),
        };
      });
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeMessages(
  userId: string,
  conversationId: string,
  onData: (messages: ChatMessage[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const uid = sanitizeId(userId);
  const convId = sanitizeId(conversationId);
  const path = `users/${uid}/conversations/${convId}/messages`;
  const q = query(
    collection(db, path),
    where('ownerId', '==', uid),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: ChatMessage[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ownerId: data.ownerId,
          conversationId: data.conversationId,
          role: data.role === 'assistant' ? 'assistant' : 'user',
          text: String(data.text || ''),
          funFact: data.funFact ? String(data.funFact) : undefined,
          sources: Array.isArray(data.sources) ? (data.sources as SourceLink[]) : undefined,
          model: data.model ? String(data.model) : undefined,
          createdAt: toMillis(data.createdAt),
        };
      });
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function saveMessageToCloud(params: {
  userId: string;
  conversationId: string;
  conversationTitle: string;
  isNewConversation: boolean;
  newMessageCount: number;
  message: {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    funFact?: string | null;
    sources?: SourceLink[];
    model?: string;
  };
}): Promise<void> {
  const uid = sanitizeId(params.userId);
  const convId = sanitizeId(params.conversationId);
  const msgId = sanitizeId(params.message.id);
  const convRef = doc(db, `users/${uid}/conversations`, convId);
  const msgRef = doc(db, `users/${uid}/conversations/${convId}/messages`, msgId);

  const boundedText = params.message.text.slice(0, 20000);
  const boundedTitle = (params.conversationTitle || 'Yangi suhbat').slice(0, 160);
  const boundedPreview = boundedText.replace(/\s+/g, ' ').slice(0, 300);

  const batch = writeBatch(db);

  if (params.isNewConversation) {
    batch.set(convRef, {
      id: convId,
      ownerId: uid,
      title: boundedTitle,
      lastMessagePreview: boundedPreview,
      messageCount: Math.min(10000, Math.max(1, params.newMessageCount)),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.update(convRef, {
      title: boundedTitle,
      lastMessagePreview: boundedPreview,
      messageCount: Math.min(10000, Math.max(1, params.newMessageCount)),
      updatedAt: serverTimestamp(),
    });
  }

  const msgPayload: Record<string, unknown> = {
    id: msgId,
    ownerId: uid,
    conversationId: convId,
    role: params.message.role,
    text: boundedText,
    createdAt: serverTimestamp(),
  };

  if (params.message.funFact) {
    msgPayload.funFact = params.message.funFact.slice(0, 1000);
  }
  if (params.message.sources && params.message.sources.length > 0) {
    msgPayload.sources = params.message.sources.slice(0, 10).map((s) => ({
      title: String(s.title || s.uri).slice(0, 200),
      uri: String(s.uri).slice(0, 1000),
    }));
  }
  if (params.message.model) {
    msgPayload.model = params.message.model.slice(0, 40);
  }

  batch.set(msgRef, msgPayload);

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}/conversations/${convId}/messages/${msgId}`);
  }
}

export async function deleteConversationFromCloud(
  userId: string,
  conversationId: string
): Promise<void> {
  const uid = sanitizeId(userId);
  const convId = sanitizeId(conversationId);
  const msgsPath = `users/${uid}/conversations/${convId}/messages`;

  try {
    const msgsQuery = query(collection(db, msgsPath), where('ownerId', '==', uid));
    const snap = await getDocs(msgsQuery);
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, `users/${uid}/conversations`, convId));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${uid}/conversations/${convId}`);
  }
}
