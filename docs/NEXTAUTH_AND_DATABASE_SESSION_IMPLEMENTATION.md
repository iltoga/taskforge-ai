---

# NextAuth v5 Database‑Session Flow — Project Overview

> This document consolidates implementation notes from multiple internal memos into a single, structured reference that GitHub Copilot can ingest for richer completions.
> **Scope:** auth layer, session storage, and related helpers.

---

## 1 ▪ Why We Moved to Database Sessions

| Limitation (v4 cookies)           | Improvement (v5 DB sessions)                            |
| --------------------------------- | ------------------------------------------------------- |
| 4 KB size cap per cookie          | Practically unlimited JSON payload (PostgreSQL `jsonb`) |
| Client‑side only                  | Server‑side accessible (no `getToken()` gymnastics)     |
| Ephemeral across browser restarts | Persistent, auto‑cleaned on sign‑out                    |
| Manual token refresh wiring       | Built‑in refresh via PrismaAdapter                      |

---

## 2 ▪ Key Domain Models (Prisma)

```prisma
// prisma/schema.prisma
model Session {
  id                String   @id @default(cuid())
  expires           DateTime
  userId            String   @map("user_id")
  user              User     @relation(fields: [userId], references: [id])
  chatHistory       Json?    // ChatMessage[]
  processedFiles    Json?    // ProcessedFile[]
  fileSearchSignature String? // Cache‑key
  @@index([userId])
}
```

> The other tables—`Account`, `User`, and `VerificationToken`—remain the stock v5 shapes.

---

## 3 ▪ Auth Configuration (`auth.ts`)

```
- Strategy        : database (not JWT)
- Adapter         : PrismaAdapter(prisma)
- Providers       : GoogleOAuth + Credentials (dev bypass)
- Callbacks       :
    • session()   → inject structured JSON fields
    • signIn()    → service‑account fallback
- Events          : linked to token refresh helpers
```

### Sequence on Sign‑In

1. **OAuth** → NextAuth creates/updates `User`, then `Session`.
2. **Callback session()** runs, merging `Session` row into the client payload.
3. **Client** stores session cookie containing the DB row ID (not entire blob).

---

## 4 ▪ Session‑Manager Helper (`src/lib/session‑manager.ts`)

| Function                     | Purpose                                                          |
| ---------------------------- | ---------------------------------------------------------------- |
| `getSessionData()`           | Server utility, returns *typed* extended fields.                 |
| `updateSessionData(partial)` | Server utility, shallow‑merges JSON columns.                     |
| `useSessionData()`           | React hook, wraps `useSession()` + SWR‑style optimistic updates. |

*All cookie‑era helpers (`setFileSearchSignature`, etc.) are now thin wrappers that delegate to these functions for backward compatibility.*

---

## 5 ▪ Data Stored Per Session

```ts
type ExtendedSession = {
  chatHistory?: ChatMessage[]      // Running conversation buffer
  processedFiles?: ProcessedFile[] // Metadata for uploads
  fileSearchSignature?: string     // Cache‑busting hash
}
```

*Tip for Copilot:* When you see `getSessionData()` or `updateSessionData()` in any module, assume the shape above.

---

## 6 ▪ Token Refresh Workflow

1. The Google provider issues a short‑lived access token + long‑lived refresh token.
2. On API calls, expired access tokens trigger the **`events.token`** handler.
3. Handler swaps the refresh token for a new access token and **updates the same `Account` row**—no session churn required.
4. `Session` row stays intact; UI remains logged‑in.

---

## 7 ▪ Backward Compatibility Layer

`src/lib/auth‑compat.ts` re‑exports v4 symbols (`getServerSession`, etc.) but internally calls v5 APIs, so legacy endpoints compile without edits.

---

## 8 ▪ Typical Usage Patterns

### Server Route

```ts
import { getSessionData, updateSessionData } from "@/lib/session-manager";

export async function POST(req: NextRequest) {
  const { chatHistory = [] } = (await getSessionData()) ?? {};
  // …work with history…
  await updateSessionData({ chatHistory: [...chatHistory, newMsg] });
  return NextResponse.json({ ok: true });
}
```

### React Component

```tsx
import { useSessionData } from "@/lib/session-manager";

export default function ChatPane() {
  const { chatHistory = [], updateData, isLoading } = useSessionData();
  // …
}
```

---

## 9 ▪ Testing & Inspection

| Endpoint                         | Description                                        |
| -------------------------------- | -------------------------------------------------- |
| `GET /api/test/session-manager`  | Dumps current extended session JSON.               |
| `POST /api/test/session-manager` | Accepts partial object, calls `updateSessionData`. |

---

## 10 ▪ Migration Checklist (Done)

1. **DB schema applied** via `prisma migrate deploy`.
2. **All API routes** switched from cookie utils → `session-manager`.
3. **TypeScript**: 27 errors → 0 after type re‑generation.
4. **Dev cookies purged** to avoid v4 residue.

---

## 11 ▪ Performance & Housekeeping

* **Indexing**: `sessions(user_id)` keeps look‑ups constant‑time.
* **Cleanup**: NextAuth auto‑prunes expired rows on startup; consider a nightly cron for large datasets.
* **Caching**: If session reads become hot, wrap `getSessionData()` in a 30 s server cache.

---

**End of document – ready for Copilot ingestion.**
