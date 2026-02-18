# Phase 3: Admin Settings - Research

**Researched:** 2026-02-18
**Domain:** Supabase Postgres key-value settings, Next.js 15 App Router Server Components + Server Actions, credential masking UI
**Confidence:** HIGH

---

## Summary

Phase 3 adds a settings page that lets the admin view and update WhatsApp API credentials
(KAPSO_API_KEY, PHONE_NUMBER_ID, WABA_ID) stored in Supabase Postgres, plus a `getConfig()`
utility that serves as the DB-backed credential resolver for Phase 4.

The standard approach for this phase splits into three deliverables:

1. **`getConfig()` utility** (`src/lib/get-config.ts`): An async function that reads from the
   `app_settings` Supabase table and falls back to `process.env` if a key is missing in the DB.
   Because Vercel serverless functions do not share module-level singletons between invocations
   reliably, `getConfig()` should query the DB on every call during Phase 3. Phase 4 may add
   in-request caching via a per-request Map if latency becomes an issue.

2. **`/api/settings` route handler** (`src/app/api/settings/route.ts`): A GET + POST route that
   reads/writes the `app_settings` table. Uses the server-side Supabase client (already in
   `src/lib/supabase/server.ts`) and requires an authenticated user via `getUser()`. Route-level
   auth is needed because the middleware only returns 302 redirects (HTML), not 401 JSON, which
   would confuse the client-side form's fetch.

3. **`/admin/settings` page** (`src/app/admin/settings/page.tsx`): A Server Component that reads
   settings directly from Supabase (no internal fetch — Next.js best practice for 2025 is to
   query the DB directly in Server Components rather than calling an internal API). A Client
   Component form island handles the save interaction via `useActionState` + a Server Action.
   React Hook Form is NOT needed for 3 simple text fields — `useActionState` is the right tool.

The `app_settings` table already exists (created in Phase 2, 02-01) with the correct schema and
RLS policies. No new Supabase table creation is needed in Phase 3.

**Primary recommendation:** Server Component reads directly from Supabase. `useActionState` + Server
Action for form submission. `getConfig()` is a plain async function with DB-first, env fallback.
No React Hook Form. No additional packages needed.

---

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/ssr` | ^0.8.0 | DB access in server-side contexts | Already installed; `createClient()` from `src/lib/supabase/server.ts` works in both Server Components and Route Handlers |
| `@supabase/supabase-js` | ^2.97.0 | Supabase JS client | Already installed |
| `react` (built-in) | 19.1.0 | `useActionState` hook | Built into React 19 — no extra package |
| `next` (built-in) | 15.5.9 | Server Actions, `revalidatePath` | Built into Next.js |

### No New Packages Required

The full Phase 3 can be implemented with what is already installed. The roadmap mentioned
React Hook Form + Zod, but for 3 text fields, `useActionState` is the right level of complexity.
Adding React Hook Form would add an unnecessary dependency for this use case.

**If Zod is desired for server-side validation:** It is a zero-dependency package. But for 3
text fields where empty string is the main validation concern, `if (!value.trim())` in the Server
Action is sufficient. Zod is optional here.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `useActionState` | `react-hook-form` + `@hookform/resolvers` + `zod` | RHF adds client-side instant validation but requires `'use client'` and 3 extra packages; overkill for 3 fields |
| Direct Supabase query in Server Component | `fetch('/api/settings')` from Server Component | Fetching an internal API from a Server Component adds a pointless network hop; Next.js docs explicitly recommend against this pattern |
| getConfig() querying DB each call | Module-level in-memory cache | Vercel serverless functions don't reliably share module-level state across concurrent invocations; per-call DB queries are safer and still fast (<5ms RTT to Supabase) |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   ├── get-config.ts              # NEW: DB-first credential resolver with env fallback
│   └── supabase/                  # EXISTING: unchanged
│       ├── client.ts
│       ├── server.ts
│       └── middleware.ts
└── app/
    ├── admin/
    │   └── settings/
    │       ├── page.tsx           # NEW: Server Component (reads DB, renders form with current values)
    │       └── actions.ts         # NEW: saveSettings() Server Action
    └── api/
        └── settings/
            └── route.ts           # NEW: GET + POST for external/client fetch access
```

Note: The `/api/settings` route is needed for the client-side form's fetch when the form is a
Client Component. However, since the save is done via Server Action, the route handler is primarily
needed for Phase 3's `getConfig()` to have a testable HTTP interface — and as a clean API for
potential future use. If the admin page uses a Server Action exclusively for saves, the route handler
is still useful for reading settings from outside the browser (e.g., a health check or Phase 4
testing).

### Pattern 1: getConfig() Utility

**What:** An async function that reads one or all credential values from the `app_settings` table.
Falls back to `process.env` if the DB row doesn't exist. Throws only for truly required credentials
(KAPSO_API_KEY) to preserve the existing behavior.

**Source:** Verified pattern from Supabase JS docs (upsert + select) and Next.js Server Component
patterns. Serverless caching behavior confirmed from Next.js GitHub discussions.

```typescript
// src/lib/get-config.ts
// Source: Supabase JS docs (select by key), Next.js serverless patterns
import { createClient } from '@/lib/supabase/server'

type ConfigKey = 'KAPSO_API_KEY' | 'WHATSAPP_API_URL' | 'PHONE_NUMBER_ID' | 'WABA_ID'

const ENV_FALLBACKS: Record<ConfigKey, string | undefined> = {
  KAPSO_API_KEY: process.env.KAPSO_API_KEY,
  WHATSAPP_API_URL: process.env.WHATSAPP_API_URL || 'https://api.kapso.ai/meta/whatsapp',
  PHONE_NUMBER_ID: process.env.PHONE_NUMBER_ID || '',
  WABA_ID: process.env.WABA_ID,
}

export async function getConfig(key: ConfigKey): Promise<string> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()

  if (data?.value) {
    return data.value
  }

  // Fall back to process.env
  const fallback = ENV_FALLBACKS[key]

  if (fallback !== undefined) {
    return fallback
  }

  throw new Error(`Config key "${key}" is not set in DB or environment`)
}
```

**Critical design note:** `getConfig()` is async and returns a Promise. All callers must `await` it.
This is a change from the synchronous `process.env.KAPSO_API_KEY` pattern — Phase 4 callers
(`whatsapp-client.ts`, `templates/route.ts`) will need to become async as a result.

**Phase 3 scope:** `getConfig()` is created but NOT yet called by the Kapso routes. That migration
is Phase 4. Phase 3 only wires it up in the new `/admin/settings` display logic (to show current
values) and establishes the utility.

### Pattern 2: Server Component Reads Directly from Supabase

**What:** The settings page Server Component calls `createClient()` directly and queries the DB.
No internal fetch. This is the 2025 Next.js best practice.

**Source:** Next.js official docs (nextjs.org/docs/app/getting-started/fetching-data), Next.js
blog post "Building APIs with Next.js", Next.js GitHub Discussion #72919.

```typescript
// src/app/admin/settings/page.tsx
import { createClient } from '@/lib/supabase/server'

export default async function SettingsPage() {
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('app_settings')
    .select('key, value')

  // Build a lookup map from rows
  const settings: Record<string, string> = {}
  for (const row of rows ?? []) {
    settings[row.key] = row.value
  }

  return (
    <SettingsForm
      kapsoApiKey={settings['KAPSO_API_KEY'] ?? ''}
      phoneNumberId={settings['PHONE_NUMBER_ID'] ?? ''}
      wabaId={settings['WABA_ID'] ?? ''}
    />
  )
}
```

### Pattern 3: useActionState + Server Action for Save

**What:** A Client Component form that uses `useActionState` from React 19 to call a Server Action.
The Server Action validates input, upserts each credential in the `app_settings` table, and returns
success/error state. No `fetch()` call required.

**Source:** Next.js official forms guide (nextjs.org/docs/app/guides/forms), verified 2026-02-16.

```typescript
// src/app/admin/settings/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type SaveResult = { success: boolean; message: string }

export async function saveSettings(
  _prevState: SaveResult,
  formData: FormData
): Promise<SaveResult> {
  const kapsoApiKey = formData.get('kapsoApiKey') as string
  const phoneNumberId = formData.get('phoneNumberId') as string
  const wabaId = formData.get('wabaId') as string

  // Server-side validation (KAPSO_API_KEY is required)
  if (!kapsoApiKey?.trim()) {
    return { success: false, message: 'API Key is required' }
  }

  const supabase = await createClient()

  // Verify the user is authenticated
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, message: 'Unauthorized' }
  }

  const updates = [
    { key: 'KAPSO_API_KEY', value: kapsoApiKey.trim() },
    { key: 'PHONE_NUMBER_ID', value: phoneNumberId.trim() },
    { key: 'WABA_ID', value: wabaId.trim() },
  ]

  const { error } = await supabase
    .from('app_settings')
    .upsert(updates, { onConflict: 'key' })

  if (error) {
    return { success: false, message: `Save failed: ${error.message}` }
  }

  revalidatePath('/admin/settings')
  return { success: true, message: 'Settings saved successfully' }
}
```

```typescript
// src/app/admin/settings/SettingsForm.tsx  (or page.tsx if kept together)
'use client'

import { useActionState } from 'react'
import { saveSettings } from './actions'

const initialState = { success: false, message: '' }

export function SettingsForm({ kapsoApiKey, phoneNumberId, wabaId }: {
  kapsoApiKey: string
  phoneNumberId: string
  wabaId: string
}) {
  const [state, formAction, pending] = useActionState(saveSettings, initialState)

  // Mask the API key: show only last 4 characters
  const maskedApiKey = kapsoApiKey.length > 4
    ? '•'.repeat(kapsoApiKey.length - 4) + kapsoApiKey.slice(-4)
    : kapsoApiKey

  return (
    <form action={formAction}>
      <label>API Key (current: {maskedApiKey})</label>
      <input name="kapsoApiKey" type="password" placeholder="Enter new value to update" />
      <label>Phone Number ID</label>
      <input name="phoneNumberId" defaultValue={phoneNumberId} />
      <label>WABA ID</label>
      <input name="wabaId" defaultValue={wabaId} />
      <button type="submit" disabled={pending}>
        {pending ? 'Saving...' : 'Save Settings'}
      </button>
      {state.message && <p>{state.message}</p>}
    </form>
  )
}
```

### Pattern 4: /api/settings Route Handler with Auth Check

**What:** A GET + POST route handler that provides an HTTP interface for reading and writing settings.
Uses the server Supabase client and checks auth via `getUser()`. Returns 401 JSON (not 302 redirect)
for unauthenticated calls — the middleware redirect is not appropriate for API consumers.

**Source:** Next.js route handler docs (verified 2026-02-16), Supabase SSR docs for route handler
client pattern.

```typescript
// src/app/api/settings/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const updates = body.settings as Array<{ key: string; value: string }>

  const { error } = await supabase
    .from('app_settings')
    .upsert(updates, { onConflict: 'key' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
```

### Anti-Patterns to Avoid

- **Fetching `/api/settings` from the Server Component:** Server Components should query the DB
  directly. Calling an internal route handler from a Server Component adds a network hop for no
  benefit and can complicate cookie/auth forwarding.
- **Using `getSession()` instead of `getUser()`:** `getSession()` doesn't revalidate the token.
  Always use `getUser()` in any server-side auth check (route handlers, server actions).
- **Module-level singleton for getConfig() cache:** Vercel serverless functions may or may not
  share module-level state. A module-level `Map` is not a reliable cache in serverless. If
  caching is needed, use Next.js `'use cache'` directive or `unstable_cache`.
- **Showing the full API key in the UI:** The success criterion explicitly requires "API key shown
  as last-4 only." Use `type="password"` for input, display masked value (`••••••xxxx`) for read.
- **Committing credentials to git:** `WHATSAPP_API_URL` fallback is fine to have in code since
  it is a public endpoint. `KAPSO_API_KEY` must never appear in source code.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form pending state | `useState(false)` + manual loading flag | `useActionState` third return value `pending` | Built into React 19 `useActionState` — no extra state needed |
| DB insert-or-update | Custom SELECT then INSERT/UPDATE logic | `supabase.upsert({ onConflict: 'key' })` | Single round-trip; handles race conditions |
| API key masking | Custom regex | `'•'.repeat(n - 4) + key.slice(-4)` | Simple string operation, no library needed |
| Cache invalidation after save | Manual state refresh or page reload | `revalidatePath('/admin/settings')` in Server Action | Next.js cache invalidation is the right tool |
| Server Action CSRF protection | Manual token | None — Server Actions have built-in CSRF protection | Next.js Server Actions include CSRF protection by default |

**Key insight:** For a 3-field settings form, every "feature" can be served by built-in React 19 /
Next.js 15 primitives. No new libraries are required.

---

## Common Pitfalls

### Pitfall 1: getConfig() Must Be Async — Phase 4 Callers Need Refactoring

**What goes wrong:** `whatsapp-client.ts` currently calls `process.env.KAPSO_API_KEY` synchronously.
`getConfig()` is async. Replacing the synchronous read with `await getConfig('KAPSO_API_KEY')`
requires `getWhatsAppClient()` to become async.

**Why it happens:** `process.env` is synchronous. Any DB read is inherently async.

**How to avoid:** Phase 3 creates `getConfig()` but does NOT retrofit existing routes — that is
Phase 4's job. Phase 3 only creates the utility. This prevents scope creep.

**Warning signs:** TypeScript error "await is only allowed in async function" in `whatsapp-client.ts`
if someone tries to use `getConfig()` inside the non-async `getWhatsAppClient()`.

### Pitfall 2: PHONE_NUMBER_ID Exported as Module-Level Constant

**What goes wrong:** `src/lib/whatsapp-client.ts` exports `PHONE_NUMBER_ID` as:
`export const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || ''`

This constant is evaluated once at module load time. Even after Phase 3 saves a new value to the DB,
the running process still has the old (possibly empty) `PHONE_NUMBER_ID` constant.

**Why it matters:** Phase 3 success criterion #5 says "All Kapso API routes call getConfig()."
This is actually a Phase 4 migration step. Phase 3 should NOT try to migrate `PHONE_NUMBER_ID`
exports — that is explicitly scoped to Phase 4.

**How to avoid:** Phase 3 scope is: (a) create getConfig(), (b) build the settings API and page.
Phase 4 scope is: replace `process.env` reads with `await getConfig()` in Kapso routes. Keep the
phases clean.

### Pitfall 3: The /api/settings Route and /admin/settings Page Are at the Same URL Segment Level

**What goes wrong:** If someone creates `src/app/admin/settings/page.tsx` AND
`src/app/admin/settings/route.ts` at the same location, Next.js will conflict.

**Why it happens:** Next.js does not allow a `page.tsx` and `route.ts` in the same directory.

**How to avoid:** The API route lives at `src/app/api/settings/route.ts` (under `/api/`).
The page lives at `src/app/admin/settings/page.tsx` (under `/admin/`). They are different paths:
`/api/settings` vs `/admin/settings`. This is the correct structure — confirmed from the roadmap.

### Pitfall 4: Reading Masked Value From DB and Displaying It as Input Default

**What goes wrong:** If the form pre-populates the API key input with the masked value
(`••••xxxx`), and the user saves without editing it, the masked string gets written to the DB.

**Why it happens:** The form's `defaultValue` of a password input shows a masked display, but
the actual submitted value is whatever is in the input.

**How to avoid:** For the API key field, use `placeholder` not `defaultValue`. The input should
be empty by default with a placeholder like "Enter new value (leave blank to keep current)". In the
Server Action, if the submitted value is empty, skip updating KAPSO_API_KEY.

**Warning signs:** KAPSO_API_KEY in the DB becomes `••••1234` — all subsequent API calls fail
with auth errors.

### Pitfall 5: app_settings Table Already Has RLS Enabled — Don't Forget the Service Role Key Pattern

**What goes wrong:** The `app_settings` table has RLS with policies requiring `authenticated`
role. The `getConfig()` utility uses the anon key client from `src/lib/supabase/server.ts`. When
called from a Route Handler where there IS a valid user cookie, this works. But if `getConfig()`
is called in a context with no session (e.g., from `whatsapp-client.ts` during Phase 4 — called
without a user session), the anon-key client will fail the RLS check and return no data.

**Why it happens:** The server client (`createClient()` from `src/lib/supabase/server.ts`) uses
the anon key and reads auth from cookies. When no user session cookie is present (server-to-server
context), `getUser()` returns null, and the `authenticated` RLS policy blocks the query.

**Status for Phase 3:** Phase 3 only calls `getConfig()` from the settings page and settings
Server Action — both have a user session. This pitfall is latent but does NOT block Phase 3.

**Phase 4 implication:** When Phase 4 retrofits `whatsapp-client.ts` to use `getConfig()`, the
Kapso routes are called from the browser (which does have a session), so the anon-key client will
work. But if any server-initiated call ever uses `getConfig()` without a session, it will fail.

**Resolution path:** If needed in Phase 4, create a separate `createServiceClient()` that uses
`SUPABASE_SERVICE_ROLE_KEY` and bypasses RLS. For now, Phase 3 is safe.

### Pitfall 6: WHATSAPP_API_URL Has a Fallback — Don't Require It in the Settings Form

**What goes wrong:** The admin saves blank WHATSAPP_API_URL, expecting the fallback URL to be used.
If the form treats blank as "remove this from DB", that's fine. But if it upserts an empty string,
`getConfig()` will return `''` instead of the fallback URL.

**Why it happens:** `upsert` writes whatever value is given. An empty string is not the same as
"row not present."

**How to avoid:** In the Server Action, treat WHATSAPP_API_URL as optional. If the submitted value
is blank, skip upserting it (do not write an empty string). Optionally, allow the admin to provide
a custom URL to override the default.

**Design decision:** Include WHATSAPP_API_URL in the form as an optional field with a placeholder
showing the default. If left blank, don't upsert. If filled, upsert. This preserves the existing
"optional" behavior from whatsapp-client.ts.

---

## Code Examples

Verified patterns from official sources:

### Supabase Upsert with onConflict

```typescript
// Source: supabase.com/docs/reference/javascript/upsert
const { error } = await supabase
  .from('app_settings')
  .upsert(
    [
      { key: 'KAPSO_API_KEY', value: 'sk_...' },
      { key: 'PHONE_NUMBER_ID', value: '12345' },
    ],
    { onConflict: 'key' }
  )
```

The `app_settings` table has `key text UNIQUE NOT NULL` — so `onConflict: 'key'` is the correct
conflict target. The `key` column is unique, not the primary key (`id uuid`).

### Supabase Select by Key

```typescript
// Source: supabase.com/docs/reference/javascript/select
const { data, error } = await supabase
  .from('app_settings')
  .select('value')
  .eq('key', 'KAPSO_API_KEY')
  .maybeSingle()
// data is { value: 'sk_...' } or null if not found
```

Use `.maybeSingle()` (not `.single()`) — `.single()` throws an error if no row is found.

### useActionState Pattern (React 19)

```typescript
// Source: nextjs.org/docs/app/guides/forms (verified 2026-02-16)
'use client'
import { useActionState } from 'react'
import { saveSettings } from './actions'

const initialState = { success: false, message: '' }

export function SettingsForm() {
  const [state, formAction, pending] = useActionState(saveSettings, initialState)

  return (
    <form action={formAction}>
      <button type="submit" disabled={pending}>
        {pending ? 'Saving...' : 'Save'}
      </button>
      {state.message && <p>{state.message}</p>}
    </form>
  )
}
```

### Server Action Signature for useActionState

```typescript
// Source: nextjs.org/docs/app/guides/forms (verified 2026-02-16)
// When used with useActionState, the first parameter is prevState
'use server'

export async function saveSettings(
  _prevState: { success: boolean; message: string },
  formData: FormData
): Promise<{ success: boolean; message: string }> {
  // ...
}
```

### API Key Masking (display only)

```typescript
// No external library needed — simple string operation
const maskedApiKey = (key: string) =>
  key.length > 4 ? '•'.repeat(Math.min(key.length - 4, 12)) + key.slice(-4) : key

// Usage in JSX:
// Current: ••••••••1234
// Shows enough context without revealing the full key
```

### revalidatePath After Successful Save

```typescript
// Source: Next.js docs on Server Actions + caching
// Must be called outside try/catch to work correctly
import { revalidatePath } from 'next/cache'

// After successful upsert:
revalidatePath('/admin/settings')
```

---

## app_settings Table — Confirmed Schema

The table was created in Phase 2 (02-01) and confirmed working. No changes needed in Phase 3.

```sql
-- Already exists in Supabase project at https://mwtxxyupqqfgsbapvjbb.supabase.co
CREATE TABLE app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Existing policies (SELECT, INSERT, UPDATE for `authenticated` role)
-- All policies use USING (true) / WITH CHECK (true) — no user_id scoping
-- This is correct for a shared settings table where any authenticated user can read/write
```

**Key facts for implementation:**
- Primary key: `id` (uuid)
- Unique constraint: `key` (text) — this is the `onConflict` target for upsert
- All 3 operations (SELECT, INSERT, UPDATE) are permitted for `authenticated` role
- The `updated_at` column is set at INSERT time but not auto-updated on UPDATE — if tracking
  last-modified time is desired, add a trigger or update it manually in the upsert

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `react-hook-form` for all forms | `useActionState` for simple server-action forms | React 19 / Next.js 15 (2024) | 3-field settings form needs no RHF |
| Fetch internal API route from Server Component | Direct DB query in Server Component | Next.js App Router guidance (2024+) | No internal fetch needed for settings read |
| `supabase.upsert(data)` with primary key | `supabase.upsert(data, { onConflict: 'key' })` | Always required for non-PK conflict targets | Must specify `onConflict` for the `key` column |
| `cookies()` synchronous | `await cookies()` | Next.js 15 | Already handled by `src/lib/supabase/server.ts` |
| `getSession()` for auth check | `getUser()` for auth check | Supabase SSR docs | Already handled in all Phase 2 code |

**Deprecated/outdated:**
- `react-hook-form` for this use case: Not deprecated, but `useActionState` is the right level.
- `createRouteHandlerClient` from `@supabase/auth-helpers-nextjs`: Deprecated. Use
  `createClient()` from `src/lib/supabase/server.ts` in route handlers.

---

## Open Questions

1. **Should WHATSAPP_API_URL be shown in the settings form?**
   - What we know: It is optional (has a hardcoded fallback), not required for basic operation.
   - What's unclear: Whether the admin needs to customize the Kapso API endpoint.
   - Recommendation: Include it as an optional field. If blank, don't upsert. If filled, upsert.
     This gives the admin control without requiring it.

2. **Does the settings page need a layout.tsx for the `/admin/` route segment?**
   - What we know: The existing `src/app/layout.tsx` is the root layout. `/admin/settings` will
     inherit it. A dedicated admin layout is not required.
   - What's unclear: Whether the admin page needs different chrome (sidebar, back button, etc.).
   - Recommendation: No separate layout for Phase 3. Use the root layout. The page can have
     its own header/nav inline if needed.

3. **getConfig() caching in serverless — is per-request caching needed?**
   - What we know: Supabase RTT from Vercel US-East to Supabase default region is typically
     5–30ms. Each `getConfig()` call is one round-trip. A single WhatsApp message send touches
     multiple API routes, each calling `whatsapp-client.ts` which may call `getConfig()`.
   - What's unclear: Actual latency impact in production.
   - Recommendation: Ship without caching in Phase 3. If Phase 4 shows latency issues, add
     `unstable_cache` or Next.js `'use cache'` per the Next.js 15.5 patterns.

4. **Should the admin page be at /admin/settings or /settings?**
   - What we know: The roadmap specifies `/admin/settings`.
   - Recommendation: Use `/admin/settings` as specified. Keeps admin routes namespaced.

---

## Sources

### Primary (HIGH confidence)

- Next.js forms guide: https://nextjs.org/docs/app/guides/forms — verified 2026-02-16
- Next.js route handlers: https://nextjs.org/docs/app/getting-started/route-handlers — verified 2026-02-16
- Supabase upsert docs: https://supabase.com/docs/reference/javascript/upsert
- Phase 2 02-01-PLAN.md — app_settings schema confirmed (created, RLS policies confirmed)
- Phase 2 02-01-SUMMARY.md — confirmed table exists in Supabase
- src/lib/supabase/server.ts — confirmed createClient() pattern for server-side contexts
- package.json — confirmed @supabase/ssr ^0.8.0 and next 15.5.9 installed

### Secondary (MEDIUM confidence)

- markus.oberlehner.net/blog/using-react-hook-form-with-react-19-use-action-state — RHF vs
  useActionState tradeoffs; confirmed by Next.js official forms guide
- wisp.blog/blog/should-i-use-react-useactionstate-or-react-hook-form — useActionState for
  simple forms recommendation
- Supabase RLS docs: https://supabase.com/docs/guides/database/postgres/row-level-security —
  RLS policy patterns for authenticated role
- Next.js GitHub Discussion #72919 — Server Component direct DB query vs route handler fetch

### Tertiary (LOW confidence)

- WebSearch: Vercel serverless singleton behavior — confirmed from GitHub issues, not official docs
- WebSearch: API key masking UI pattern — no authoritative source found; using standard string
  slice pattern (low complexity, no library needed)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed; patterns verified from official docs
- Architecture patterns: HIGH — direct DB query in Server Component confirmed from Next.js docs;
  useActionState confirmed from Next.js forms guide; upsert pattern confirmed from Supabase docs
- app_settings table schema: HIGH — confirmed from Phase 2 plan and summary; table already exists
- getConfig() async implications: HIGH — inherent to any async DB call; TypeScript will enforce
- Pitfalls: HIGH (structural) / MEDIUM (RLS service role concern) — structural issues verified;
  RLS pitfall is theoretical for Phase 3 scope but documented for Phase 4 awareness

**Research date:** 2026-02-18
**Valid until:** 2026-04-18 (60 days — @supabase/ssr 0.8 and Next.js 15.5 are stable)
