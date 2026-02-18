# Phase 4: Config Migration - Research

**Researched:** 2026-02-18
**Domain:** Next.js 15 App Router API routes, module-level vs per-request async credential resolution, TypeScript async refactoring
**Confidence:** HIGH

---

## Summary

Phase 4 migrates all Kapso API routes from reading credentials via `process.env` (synchronous,
evaluated at module load time) to reading credentials via `getConfig()` (async, DB-first with env
fallback). The Phase 3 research and Audit already established the precise scope: 4 direct
`process.env` reads across 2 files, with all 6 consumer API routes importing from those 2 files
via named exports.

The core challenge is not complexity — it is the shift from synchronous module-level constants to
async per-call resolution. Specifically:

1. `whatsapp-client.ts` exports `PHONE_NUMBER_ID` as a **synchronous module-level constant**
   (`export const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || ''`). All 6 consumer routes
   destructure this import at module load time. That export must become an async function or be
   removed, with consumers calling `getConfig('PHONE_NUMBER_ID')` directly inside their route
   handlers.

2. `getWhatsAppClient()` in `whatsapp-client.ts` is a **synchronous function with an
   if-not-initialized guard** (singleton pattern). Because `WhatsAppClient` construction reads
   `KAPSO_API_KEY` and `WHATSAPP_API_URL` synchronously, the singleton must become async, breaking
   the current `export const whatsappClient = new Proxy(...)` lazy pattern.

3. `templates/route.ts` reads `WABA_ID` inline via `process.env.WABA_ID`. This is the simplest
   replacement: one `await getConfig('WABA_ID')` inside the route handler.

All Kapso routes are called from the browser after the user authenticates. The Supabase anon-key
client (used inside `getConfig()`) reads the session from cookies — which ARE present in browser-
originated requests because the middleware already validated them. The RLS concern flagged in
Phase 3 research does NOT apply here: all Kapso routes are browser-initiated POST/GET requests
with valid session cookies.

**Primary recommendation:** Remove the `PHONE_NUMBER_ID` constant export from `whatsapp-client.ts`.
Make `getWhatsAppClient()` async. Have all 6 consumer routes call `await getConfig('PHONE_NUMBER_ID')`
directly and `await getWhatsAppClient()` (or `await whatsappClient[method]`). Update `templates/route.ts`
to call `await getConfig('WABA_ID')`. After changes, remove all three env vars from Vercel and verify
all messaging features work end-to-end.

---

## Standard Stack

### Core (already installed — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `src/lib/get-config.ts` | Phase 3 output | DB-first credential resolver with env fallback | Already built; `getConfig(key)` is the exact function Phase 4 calls |
| `@supabase/ssr` | ^0.8.0 | Powers `createClient()` inside `getConfig()` | Already installed; reads session from cookies |
| `next` | 15.5.9 | App Router route handlers | Already installed |

### No New Packages Required

Phase 4 is purely a refactoring phase. All tools exist. No `npm install` commands needed.

---

## Architecture Patterns

### Recommended Project Structure (files to modify)

```
src/
├── lib/
│   └── whatsapp-client.ts     MODIFY: make getWhatsAppClient() async, remove PHONE_NUMBER_ID export
└── app/
    └── api/
        ├── conversations/route.ts      MODIFY: import getConfig, await PHONE_NUMBER_ID
        ├── media/[mediaId]/route.ts    MODIFY: import getConfig, await PHONE_NUMBER_ID
        ├── messages/
        │   ├── [conversationId]/route.ts  MODIFY: import getConfig, await PHONE_NUMBER_ID
        │   ├── interactive/route.ts       MODIFY: import getConfig, await PHONE_NUMBER_ID
        │   └── send/route.ts              MODIFY: import getConfig, await PHONE_NUMBER_ID
        └── templates/
            ├── route.ts       MODIFY: replace process.env.WABA_ID with await getConfig('WABA_ID')
            └── send/route.ts  MODIFY: import getConfig, await PHONE_NUMBER_ID
```

### Pattern 1: Async getWhatsAppClient() — The Core Refactor

**What:** `whatsapp-client.ts` currently uses a synchronous singleton guard. Because
`WhatsAppClient` construction needs `KAPSO_API_KEY` and `WHATSAPP_API_URL` from `getConfig()`,
`getWhatsAppClient()` must become async.

**Critical design decision:** The existing `whatsappClient` Proxy export delegates to
`getWhatsAppClient()`. Once `getWhatsAppClient()` is async, the Proxy approach is no longer viable
(you cannot `await` a Proxy trap return from `get`). The Proxy must be removed, and callers must
use `await getWhatsAppClient()` directly.

**Before (current):**
```typescript
// src/lib/whatsapp-client.ts
let _whatsappClient: WhatsAppClient | null = null;

export function getWhatsAppClient(): WhatsAppClient {
  if (!_whatsappClient) {
    const kapsoApiKey = process.env.KAPSO_API_KEY;
    if (!kapsoApiKey) {
      throw new Error('KAPSO_API_KEY environment variable is not set');
    }
    _whatsappClient = new WhatsAppClient({
      baseUrl: process.env.WHATSAPP_API_URL || 'https://api.kapso.ai/meta/whatsapp',
      kapsoApiKey,
      graphVersion: 'v24.0'
    });
  }
  return _whatsappClient;
}

export const whatsappClient = new Proxy({} as WhatsAppClient, {
  get(_, prop) {
    return getWhatsAppClient()[prop as keyof WhatsAppClient];
  }
});

export const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || '';
```

**After (Phase 4):**
```typescript
// src/lib/whatsapp-client.ts
import { getConfig } from '@/lib/get-config';
import { WhatsAppClient } from '@kapso/whatsapp-cloud-api';

export async function getWhatsAppClient(): Promise<WhatsAppClient> {
  const kapsoApiKey = await getConfig('KAPSO_API_KEY');
  const baseUrl = await getConfig('WHATSAPP_API_URL');

  return new WhatsAppClient({
    baseUrl,
    kapsoApiKey,
    graphVersion: 'v24.0'
  });
}
```

**Key observations:**
- The module-level singleton (`_whatsappClient`) is removed. Each call creates a new instance.
  This is correct for Vercel serverless — functions don't reliably share module state across
  invocations, so the singleton was already illusory in production.
- `getConfig()` already has the `WHATSAPP_API_URL` fallback built in (returns
  `'https://api.kapso.ai/meta/whatsapp'` if not in DB or env). No change needed there.
- `PHONE_NUMBER_ID` export is removed entirely from this file.
- `whatsappClient` Proxy export is removed entirely from this file.

### Pattern 2: Consumer Routes — getWhatsAppClient() + getConfig()

**What:** Each route handler that previously imported `whatsappClient` and `PHONE_NUMBER_ID` now
calls `await getWhatsAppClient()` and `await getConfig('PHONE_NUMBER_ID')` inside the handler
function body.

**Before (example — conversations/route.ts):**
```typescript
import { whatsappClient, PHONE_NUMBER_ID } from '@/lib/whatsapp-client';

export async function GET(request: Request) {
  const response = await whatsappClient.conversations.list({
    phoneNumberId: PHONE_NUMBER_ID,
    ...
  });
}
```

**After:**
```typescript
import { getWhatsAppClient } from '@/lib/whatsapp-client';
import { getConfig } from '@/lib/get-config';

export async function GET(request: Request) {
  const whatsappClient = await getWhatsAppClient();
  const phoneNumberId = await getConfig('PHONE_NUMBER_ID');

  const response = await whatsappClient.conversations.list({
    phoneNumberId,
    ...
  });
}
```

**Apply this pattern to all 6 consumer routes:**
- `src/app/api/conversations/route.ts`
- `src/app/api/media/[mediaId]/route.ts`
- `src/app/api/messages/[conversationId]/route.ts`
- `src/app/api/messages/interactive/route.ts`
- `src/app/api/messages/send/route.ts`
- `src/app/api/templates/send/route.ts`

### Pattern 3: templates/route.ts — Single WABA_ID Replacement

**What:** `templates/route.ts` reads `WABA_ID` via `process.env.WABA_ID` inline (not from
`whatsapp-client.ts`). This is the simplest migration.

**Before:**
```typescript
// src/app/api/templates/route.ts
import { whatsappClient } from '@/lib/whatsapp-client';

export async function GET() {
  const wabaId = process.env.WABA_ID;

  if (!wabaId) {
    return NextResponse.json({ error: 'WABA_ID not configured' }, { status: 500 });
  }

  const response = await whatsappClient.templates.list({
    businessAccountId: wabaId,
    ...
  });
}
```

**After:**
```typescript
// src/app/api/templates/route.ts
import { getWhatsAppClient } from '@/lib/whatsapp-client';
import { getConfig } from '@/lib/get-config';

export async function GET() {
  try {
    const whatsappClient = await getWhatsAppClient();
    const wabaId = await getConfig('WABA_ID');

    const response = await whatsappClient.templates.list({
      businessAccountId: wabaId,
      ...
    });
    ...
  } catch (error) {
    // getConfig() throws if WABA_ID is not in DB or env — catch handles this
    ...
  }
}
```

**Note:** The explicit `if (!wabaId) return 500` check is removed. `getConfig()` throws if
`WABA_ID` is absent from both DB and env, and the existing `catch` block returns a 500 response.
The behavior is equivalent.

### Pattern 4: getConfig() Error Semantics — What Throws vs What Returns Empty String

Understanding when `getConfig()` throws vs returns is essential for Phase 4:

| Key | DB absent + env absent | DB absent + env set | DB set |
|-----|----------------------|--------------------|----|
| `KAPSO_API_KEY` | Throws `Error` | Returns env value | Returns DB value |
| `WHATSAPP_API_URL` | Returns `'https://api.kapso.ai/meta/whatsapp'` (fallback in ENV_FALLBACKS) | Returns env value | Returns DB value |
| `PHONE_NUMBER_ID` | Returns `''` (fallback in ENV_FALLBACKS) | Returns env value | Returns DB value |
| `WABA_ID` | Throws `Error` | Returns env value | Returns DB value |

This matches the existing behavior:
- `KAPSO_API_KEY`: old code threw `Error('KAPSO_API_KEY environment variable is not set')`
- `WHATSAPP_API_URL`: old code used `|| 'https://api.kapso.ai/meta/whatsapp'`
- `PHONE_NUMBER_ID`: old code used `|| ''`
- `WABA_ID`: old code returned 500 if missing

The `getConfig()` implementation already has these fallbacks baked in via `ENV_FALLBACKS`. No
behavior changes in error handling are needed.

### Anti-Patterns to Avoid

- **Keeping the module-level singleton:** `_whatsappClient` was already useless in Vercel
  serverless (each invocation is a fresh module). Remove it entirely rather than trying to make it
  work with async.
- **Keeping the whatsappClient Proxy export:** The Proxy can only return synchronous values from
  its `get` trap. Once `getWhatsAppClient()` is async, a synchronous Proxy that wraps it is
  broken. Remove the Proxy.
- **Awaiting getConfig() at module level:** `await` cannot be used at top level in a CJS/ESM
  module in Next.js route handlers without special handling. All `getConfig()` calls must be
  inside the handler function body.
- **Parallel getConfig() calls when possible:** If a route needs both `PHONE_NUMBER_ID` and
  `getWhatsAppClient()`, both can be initiated in parallel with `Promise.all` to reduce latency:
  ```typescript
  const [client, phoneNumberId] = await Promise.all([
    getWhatsAppClient(),
    getConfig('PHONE_NUMBER_ID')
  ]);
  ```
  However, `getWhatsAppClient()` itself calls `getConfig()` twice internally, so serial calling
  is simpler and the latency difference is small (each DB query is ~5–20ms).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Credential resolution from DB | Custom fetch to `/api/settings` | `getConfig()` from `src/lib/get-config.ts` | Already built in Phase 3; handles DB-first, env fallback, and error semantics |
| Per-request caching | Manual Map in module scope | None needed for Phase 4 | Vercel cold-start latency is the bottleneck, not DB queries; add caching only if measured as a problem |
| WhatsApp client re-initialization guard | Module-level singleton | None — just create a new instance per request | Serverless functions don't reliably share module state; singleton was already unreliable |
| Error handling for missing credentials | Custom error types | Let `getConfig()` throw; existing `catch` blocks return 500 | `getConfig()` already throws `Error` with a descriptive message |

**Key insight:** The entire Phase 4 implementation is mechanical substitution. There are no new
patterns to invent — `getConfig()` was purpose-built in Phase 3 for exactly this migration.

---

## Common Pitfalls

### Pitfall 1: The whatsappClient Proxy Must Be Removed, Not Just Modified

**What goes wrong:** Developer tries to keep `export const whatsappClient = new Proxy(...)` and
modify it to call `await getWhatsAppClient()` inside the Proxy `get` trap. This fails because Proxy
`get` traps are synchronous — you cannot `await` inside them and return the awaited value to the
caller. The attempt compiles but produces Promises where callers expect WhatsAppClient method calls.

**Why it happens:** The Proxy pattern was designed to hide the `if (!initialized) init()` guard
behind a synchronous facade. That facade is fundamentally incompatible with async initialization.

**How to avoid:** Remove the Proxy export entirely. All 7 route files import `whatsappClient` —
change each import to `getWhatsAppClient` and call it with `await` inside the handler body.

**Warning signs:** TypeScript type errors like `Property 'conversations' does not exist on type
'Promise<WhatsAppClient>'` — this means the caller is not awaiting `getWhatsAppClient()`.

### Pitfall 2: PHONE_NUMBER_ID Import at Module Level Will Still Read the Old Empty String

**What goes wrong:** A route file is partially updated — `whatsappClient` import is replaced with
`getWhatsAppClient`, but `PHONE_NUMBER_ID` is still imported from `whatsapp-client.ts` and still
resolves to `''` (because the module export is evaluated at load time).

**Why it happens:** The import is destructured at module parse time, not inside the handler
function. Even after Phase 4 DB migration, the imported constant is frozen at `''`.

**How to avoid:** For each of the 6 consumer routes, ensure BOTH changes are made:
1. Replace `import { whatsappClient, PHONE_NUMBER_ID } from '@/lib/whatsapp-client'`
   with `import { getWhatsAppClient } from '@/lib/whatsapp-client'` AND
   `import { getConfig } from '@/lib/get-config'`
2. Replace each usage of `PHONE_NUMBER_ID` (the constant) with `await getConfig('PHONE_NUMBER_ID')`
   (the async call) inside the handler body.

**Warning signs:** After removing env vars from Vercel, conversations fail to load but no error is
thrown — the API is called with an empty string `phoneNumberId`, which is silently rejected by
Kapso's API.

### Pitfall 3: messages/send/route.ts Has 6 Uses of PHONE_NUMBER_ID — All Must Be Updated

**What goes wrong:** `send/route.ts` uses `PHONE_NUMBER_ID` 6 times (lines 27, 36, 42, 48, 54, 62
per the Phase 1 audit). A developer replaces only the first occurrence.

**Why it happens:** The pattern is repeated for each media type branch (upload, sendImage,
sendVideo, sendAudio, sendDocument, sendText).

**How to avoid:** Call `const phoneNumberId = await getConfig('PHONE_NUMBER_ID')` once at the top
of the handler, then use the local variable `phoneNumberId` everywhere. TypeScript will catch any
remaining references to the old import if the import is removed.

**Exact locations (from source code, verified):**
```
Line 27: whatsappClient.media.upload({ phoneNumberId: PHONE_NUMBER_ID, ... })
Line 36: whatsappClient.messages.sendImage({ phoneNumberId: PHONE_NUMBER_ID, ... })
Line 42: whatsappClient.messages.sendVideo({ phoneNumberId: PHONE_NUMBER_ID, ... })
Line 48: whatsappClient.messages.sendAudio({ phoneNumberId: PHONE_NUMBER_ID, ... })
Line 54: whatsappClient.messages.sendDocument({ phoneNumberId: PHONE_NUMBER_ID, ... })
Line 62: whatsappClient.messages.sendText({ phoneNumberId: PHONE_NUMBER_ID, ... })
```

### Pitfall 4: conversations/route.ts Uses PHONE_NUMBER_ID in Two Places

**What goes wrong:** `conversations/route.ts` uses `PHONE_NUMBER_ID` in two distinct places (lines
34 and 59 per the Phase 1 audit) — once as a filter for the API call and once as a fallback value
in the transformed response. Only the first is replaced.

**Why it happens:** The second use is in the `.map()` transform, not the API call:
```typescript
phoneNumberId: conversation.phoneNumberId ?? PHONE_NUMBER_ID
```
This fallback sets `phoneNumberId` in the transformed response when the conversation record doesn't
have one. It also needs to use the DB value.

**How to avoid:** Resolve `phoneNumberId` once at the top of the handler:
```typescript
const phoneNumberId = await getConfig('PHONE_NUMBER_ID');
```
Then use it in both places.

### Pitfall 5: The RLS / Session Context Is Safe for Phase 4 — No Service Role Key Needed

**What goes wrong:** Developer reads the Phase 3 research pitfall about RLS and panics, thinking
`getConfig()` will fail in Kapso routes because there's no user session.

**Why it's not a problem for Phase 4:** The Kapso routes are called from the browser after the
user logs in. The middleware (confirmed in `src/middleware.ts`) runs on all routes and validates
the session from cookies. By the time a request reaches `/api/conversations`, `/api/messages/send`,
etc., the user IS authenticated. `createClient()` inside `getConfig()` reads the session cookie
and passes the RLS check.

**The RLS concern only applies to:** Server-to-server calls made without a browser session (e.g.,
cron jobs, webhook handlers). Phase 4 has no such calls — all Kapso routes are browser-initiated.

**How to avoid:** No action needed. Proceed with the anon-key client pattern. If a future phase
adds server-initiated calls, revisit the service role key pattern.

### Pitfall 6: Testing Via Vercel Deployment, Not Local Dev

**What the prior decisions say:** "All testing done via Vercel deployment, not local dev server."

**Implication:** After completing the code changes:
1. Deploy to Vercel.
2. Verify credentials ARE in the DB (confirm via admin settings page).
3. Remove `PHONE_NUMBER_ID`, `KAPSO_API_KEY`, and `WABA_ID` from Vercel env vars.
4. Redeploy (Vercel requires a new deployment to pick up env var changes).
5. Test the full messaging flow: send message, receive message, template, media, read receipts.

Do not rely on local dev for the "env vars removed" verification — local dev uses `.env.local`
which may still have the vars set.

**Warning signs:** Tests appear to pass locally but fail on Vercel — this means credentials are
being read from env vars that still exist in the Vercel project settings.

---

## Code Examples

### Complete whatsapp-client.ts After Phase 4

```typescript
// src/lib/whatsapp-client.ts
// Source: Pattern derived from Phase 3 getConfig() and existing file structure
import { WhatsAppClient } from '@kapso/whatsapp-cloud-api';
import { getConfig } from '@/lib/get-config';

export async function getWhatsAppClient(): Promise<WhatsAppClient> {
  const kapsoApiKey = await getConfig('KAPSO_API_KEY');
  const baseUrl = await getConfig('WHATSAPP_API_URL');

  return new WhatsAppClient({
    baseUrl,
    kapsoApiKey,
    graphVersion: 'v24.0'
  });
}
```

### Complete templates/route.ts After Phase 4

```typescript
// src/app/api/templates/route.ts
import { NextResponse } from 'next/server';
import { getWhatsAppClient } from '@/lib/whatsapp-client';
import { getConfig } from '@/lib/get-config';

export async function GET() {
  try {
    const whatsappClient = await getWhatsAppClient();
    const wabaId = await getConfig('WABA_ID');

    const response = await whatsappClient.templates.list({
      businessAccountId: wabaId,
      limit: 100
    });

    return NextResponse.json({
      data: response.data,
      paging: response.paging
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}
```

### Example Consumer Route: conversations/route.ts After Phase 4

```typescript
// src/app/api/conversations/route.ts (partial — showing import and handler changes)
import { getWhatsAppClient } from '@/lib/whatsapp-client';
import { getConfig } from '@/lib/get-config';

export async function GET(request: Request) {
  try {
    const whatsappClient = await getWhatsAppClient();
    const phoneNumberId = await getConfig('PHONE_NUMBER_ID');

    const { searchParams } = new URL(request.url);
    // ... query params ...

    const response = await whatsappClient.conversations.list({
      phoneNumberId,          // was: PHONE_NUMBER_ID (module-level constant)
      ...
    });

    const transformedData = response.data.map((conversation) => ({
      ...
      phoneNumberId: conversation.phoneNumberId ?? phoneNumberId,  // was: ?? PHONE_NUMBER_ID
      ...
    }));

    return NextResponse.json({ data: transformedData, paging: response.paging });
  } catch (error) {
    ...
  }
}
```

### Parallel getConfig() + getWhatsAppClient() (Optional Optimization)

```typescript
// If latency is a concern, initiate both in parallel:
const [whatsappClient, phoneNumberId] = await Promise.all([
  getWhatsAppClient(),
  getConfig('PHONE_NUMBER_ID')
]);
// Note: getWhatsAppClient() internally calls getConfig() twice, so the actual
// parallel benefit is small. Use this only if measured as a bottleneck.
```

---

## Full Change Inventory

Every file that must change, and what changes:

### File 1: src/lib/whatsapp-client.ts

**Remove:**
- Module-level `let _whatsappClient: WhatsAppClient | null = null`
- The singleton guard (`if (!_whatsappClient) { ... }`)
- `export const whatsappClient = new Proxy(...)` (the entire lazy Proxy)
- `export const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || ''`
- All direct `process.env.KAPSO_API_KEY`, `process.env.WHATSAPP_API_URL` reads

**Add:**
- `import { getConfig } from '@/lib/get-config'`
- `async` keyword to `getWhatsAppClient()`
- Return type `Promise<WhatsAppClient>`
- `await getConfig('KAPSO_API_KEY')` and `await getConfig('WHATSAPP_API_URL')` inside the function

### File 2: src/app/api/templates/route.ts

**Remove:**
- `const wabaId = process.env.WABA_ID`
- `if (!wabaId) { return NextResponse.json(...) }` guard

**Add:**
- `import { getConfig } from '@/lib/get-config'`
- Update `whatsappClient` import: `import { getWhatsAppClient } from '@/lib/whatsapp-client'`
- `const whatsappClient = await getWhatsAppClient()` inside handler
- `const wabaId = await getConfig('WABA_ID')` inside handler (getConfig throws if absent)

### Files 3–8: All 6 Consumer Routes

For each of: `conversations/route.ts`, `media/[mediaId]/route.ts`,
`messages/[conversationId]/route.ts`, `messages/interactive/route.ts`,
`messages/send/route.ts`, `templates/send/route.ts`:

**Remove from imports:**
- `whatsappClient` from `@/lib/whatsapp-client` (replace with `getWhatsAppClient`)
- `PHONE_NUMBER_ID` from `@/lib/whatsapp-client`

**Add to imports:**
- `getWhatsAppClient` from `@/lib/whatsapp-client`
- `getConfig` from `@/lib/get-config`

**Add to handler body (top of try block):**
- `const whatsappClient = await getWhatsAppClient()`
- `const phoneNumberId = await getConfig('PHONE_NUMBER_ID')`

**Replace in handler body:**
- Every usage of the old `PHONE_NUMBER_ID` constant with `phoneNumberId`

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Module-level `process.env` reads (synchronous, evaluated once) | `getConfig()` calls inside handler (async, DB-first per request) | Phase 4 | Credentials changeable without redeployment |
| Singleton `WhatsAppClient` instance (module-level) | New instance per request via `async getWhatsAppClient()` | Phase 4 | No behavioral difference in serverless (singletons are per-cold-start anyway) |
| Exported `PHONE_NUMBER_ID` constant | `await getConfig('PHONE_NUMBER_ID')` inside handler | Phase 4 | Resolves from DB, not env |
| `whatsappClient` Proxy (synchronous delegation) | `await getWhatsAppClient()` called directly | Phase 4 | Proxy removed; callers use `await` explicitly |

**Deprecated/outdated after Phase 4:**
- `export const PHONE_NUMBER_ID` from `whatsapp-client.ts`: Removed entirely
- `export const whatsappClient` (Proxy): Removed entirely
- `process.env.WABA_ID` in `templates/route.ts`: Removed entirely

---

## Open Questions

1. **Should getWhatsAppClient() create a new instance every call, or cache within a request?**
   - What we know: Vercel serverless functions don't share module state reliably. A module-level
     singleton is unreliable. Within a single request, a route handler typically calls only one or
     two client methods. There is no use case within Phase 4 that requires the same WhatsAppClient
     instance to be shared across multiple function calls within one request.
   - What's unclear: Whether `WhatsAppClient` construction has meaningful overhead (e.g., creates
     an HTTP pool, runs initialization code).
   - Recommendation: Create a new instance per call. If construction overhead is measured as a
     problem, add per-request caching via a closure or `AsyncLocalStorage` — but only after
     measuring. Do not optimize prematurely.

2. **Should WHATSAPP_API_URL be removed from Vercel env vars in the Phase 4 test?**
   - What we know: The success criteria say "Removing PHONE_NUMBER_ID, KAPSO_API_KEY, and WABA_ID
     from Vercel env vars does not break messaging." WHATSAPP_API_URL is NOT listed.
   - Recommendation: Leave WHATSAPP_API_URL in env vars if it is set there. The `getConfig()`
     fallback handles the case where it is absent. Phase 4 does not need to test removing it.

3. **Do TypeScript types need updating for consumers that typed PHONE_NUMBER_ID as string?**
   - What we know: `PHONE_NUMBER_ID` was exported as `export const PHONE_NUMBER_ID: string`.
     All consumer routes use it directly as a `phoneNumberId: string` argument. After Phase 4,
     `await getConfig('PHONE_NUMBER_ID')` also returns `string`. Types are compatible.
   - Recommendation: No type changes needed. TypeScript will continue to be satisfied.

---

## Sources

### Primary (HIGH confidence)

- `src/lib/whatsapp-client.ts` — full file read, all 3 process.env reads confirmed at lines 7, 12, 27
- `src/app/api/templates/route.ts` — full file read, WABA_ID read confirmed at line 6
- `src/app/api/conversations/route.ts` — full file read, PHONE_NUMBER_ID usage at lines 34, 59
- `src/app/api/messages/send/route.ts` — full file read, PHONE_NUMBER_ID usage at 6 locations
- `src/app/api/messages/interactive/route.ts` — full file read, PHONE_NUMBER_ID usage confirmed
- `src/app/api/messages/[conversationId]/route.ts` — full file read, PHONE_NUMBER_ID usage confirmed
- `src/app/api/media/[mediaId]/route.ts` — full file read, PHONE_NUMBER_ID usage confirmed
- `src/app/api/templates/send/route.ts` — full file read, PHONE_NUMBER_ID usage confirmed
- `src/lib/get-config.ts` — full file read; getConfig() implementation confirmed
- `src/lib/supabase/server.ts` — confirmed anon-key client using cookies (session-aware)
- `src/middleware.ts` + `src/lib/supabase/middleware.ts` — confirmed all routes require
  authentication; session cookies are present for all Kapso route calls
- `.planning/phases/01-fork-setup/AUDIT.md` — process.env read inventory confirmed (HIGH)
- `.planning/phases/03-admin-settings/03-RESEARCH.md` — getConfig() design confirmed,
  RLS/session analysis for Phase 4 confirmed (HIGH)

### Secondary (MEDIUM confidence)

- Vercel serverless module isolation behavior: WebSearch findings verified by Vercel's own
  documentation on serverless function execution model (each invocation is isolated)

---

## Metadata

**Confidence breakdown:**
- Change inventory (what files, what lines): HIGH — verified by reading all 8 source files directly
- getConfig() behavior and error semantics: HIGH — verified by reading get-config.ts source
- RLS / session safety for Kapso routes: HIGH — verified by reading middleware.ts; all Kapso
  routes are browser-initiated with valid auth cookies
- Async Proxy incompatibility: HIGH — fundamental JavaScript/TypeScript behavior
- Vercel serverless singleton behavior: MEDIUM — confirmed from multiple community sources,
  consistent with observed behavior; no official "never use module singletons" statement from Vercel

**Research date:** 2026-02-18
**Valid until:** 2026-04-18 (60 days — stable Next.js 15 / Supabase stack)
