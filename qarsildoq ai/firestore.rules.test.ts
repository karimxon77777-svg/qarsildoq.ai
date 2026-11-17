/**
 * Adversarial "Dirty Dozen" Security Rules Test Suite for qarsildoq.ai
 * Verifies identity isolation, payload bounds, immutability, and Master Gate invariants.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const dirtyDozenCases: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Profile Read',
    operation: 'get',
    path: '/users/userA',
    auth: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Cross-User Profile Read (PII Leak)',
    operation: 'get',
    path: '/users/userA',
    auth: { uid: 'userB', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Unverified Email Write',
    operation: 'create',
    path: '/users/userA',
    auth: { uid: 'userA', email_verified: false },
    payload: { uid: 'userA', theme: 'dark', voiceName: 'Kore', autoSpeak: true, model: 'gemini-4-hydrogen', searchGrounding: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow Field Injection on Profile Create',
    operation: 'create',
    path: '/users/userA',
    auth: { uid: 'userA', email_verified: true },
    payload: { uid: 'userA', isAdmin: true, theme: 'dark', voiceName: 'Kore', autoSpeak: true, model: 'gemini-4-hydrogen', searchGrounding: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'UID Spoofing on Profile Create',
    operation: 'create',
    path: '/users/userA',
    auth: { uid: 'userA', email_verified: true },
    payload: { uid: 'userB', theme: 'dark', voiceName: 'Kore', autoSpeak: true, model: 'gemini-4-hydrogen', searchGrounding: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Client Timestamp Forgery',
    operation: 'create',
    path: '/users/userA/conversations/conv1',
    auth: { uid: 'userA', email_verified: true },
    payload: { id: 'conv1', ownerId: 'userA', title: 'Test', lastMessagePreview: '', messageCount: 0, createdAt: '2020-01-01T00:00:00Z', updatedAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Oversized ID Poisoning',
    operation: 'create',
    path: `/users/userA/conversations/${'a'.repeat(200)}`,
    auth: { uid: 'userA', email_verified: true },
    payload: { id: 'a'.repeat(200), ownerId: 'userA', title: 'Test', lastMessagePreview: '', messageCount: 0 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Invalid Enum Injection',
    operation: 'update',
    path: '/users/userA',
    auth: { uid: 'userA', email_verified: true },
    payload: { theme: 'neon-pink', voiceName: 'FakeVoice' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Immutable Owner Mutation',
    operation: 'update',
    path: '/users/userA/conversations/conv1',
    auth: { uid: 'userA', email_verified: true },
    payload: { ownerId: 'userB', title: 'Hijacked' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Orphaned Message Write',
    operation: 'create',
    path: '/users/userA/conversations/nonexistent/messages/msg1',
    auth: { uid: 'userA', email_verified: true },
    payload: { id: 'msg1', ownerId: 'userA', conversationId: 'nonexistent', role: 'user', text: 'Hi' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Unbounded Array Poisoning',
    operation: 'create',
    path: '/users/userA/conversations/conv1/messages/msg1',
    auth: { uid: 'userA', email_verified: true },
    payload: {
      id: 'msg1',
      ownerId: 'userA',
      conversationId: 'conv1',
      role: 'assistant',
      text: 'Reply',
      sources: Array.from({ length: 15 }, (_, i) => ({ title: `S${i}`, uri: 'https://example.com' })),
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Blanket List Scraping',
    operation: 'list',
    path: '/users/userA/conversations',
    auth: { uid: 'userB', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
];
