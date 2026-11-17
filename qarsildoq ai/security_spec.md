# Security Specification — qarsildoq.ai Firestore Rules

## 1. Data Invariants

1. **Strict Ownership Isolation**: A user can only read, create, update, or delete their own `/users/{userId}` profile, `/users/{userId}/conversations/{conversationId}`, and `/users/{userId}/conversations/{conversationId}/messages/{messageId}`.
2. **Email Verification Mandate**: All authenticated reads and writes require `request.auth != null && request.auth.token.email_verified == true`.
3. **Master Gate Relational Integrity**: Every `ChatMessage` must reference an existing parent `Conversation` (verified via `existsAfter` / `getAfter`) whose `ownerId` equals `request.auth.uid`.
4. **Temporal Integrity**: `createdAt` and `updatedAt` timestamps must equal `request.time` (server timestamp). `createdAt` is immutable on updates.
5. **Immutable Identity Fields**: `uid`, `ownerId`, `id`, and `conversationId` cannot change after creation.
6. **Bounded Payloads**: Every string enforces `maxLength` matching `firebase-blueprint.json`, `sources` is bounded to `<= 10` entries, and `hasOnly` / `affectedKeys().hasOnly` blocks shadow fields.

## 2. The "Dirty Dozen" Payloads (All Must Yield PERMISSION_DENIED)

1. **Unauthenticated Profile Read**: Unauthenticated `get(/users/userA)`.
2. **Cross-User Profile Read (PII Leak)**: Authenticated `userB` reads `get(/users/userA)`.
3. **Unverified Email Write**: User with `email_verified: false` attempts `set(/users/userA, ...)`.
4. **Shadow Field Injection on Profile Create**: `userA` creates profile with extra field `isAdmin: true`.
5. **UID Spoofing on Profile Create**: `userA` creates `/users/userA` with `uid: "userB"`.
6. **Client Timestamp Forgery**: `userA` creates conversation with client `Date` instead of `request.time`.
7. **Oversized ID Poisoning**: `userA` writes to `/users/userA/conversations/${'a'.repeat(200)}`.
8. **Invalid Enum Injection**: `userA` sets `theme: "neon-pink"` or `voiceName: "FakeVoice"`.
9. **Immutable Owner Mutation**: `userA` updates conversation `ownerId` to `"userB"`.
10. **Orphaned Message Write**: `userA` creates message under nonexistent `conversationId`.
11. **Unbounded Array / Type Poisoning**: `userA` creates message with `sources` containing 15 items or non-map first element.
12. **Blanket List Scraping**: `userB` runs `list` query on `/users/userA/conversations` or `/users`.
