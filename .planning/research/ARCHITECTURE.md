# Architecture Patterns

**Domain:** WhatsApp Inbox Dashboard — Next.js fork + Supabase auth + database-backed config
**Researched:** 2026-02-18
**Confidence:** MEDIUM — based on PROJECT.md requirements, Kapso upstream repo knowledge (training data, flagged where unverified), and Supabase/Next.js integration patterns (training data)

---

## Context: What We're Integrating

The upstream Kapso whatsapp-cloud-inbox is a Next.js application that:
- Reads WhatsApp credentials from `.env` at build time (`PHONE_NUMBER_ID`, `KAPSO_API_KEY`, `WABA_ID`)
- Exposes API routes that proxy requests to the Kapso WhatsApp Cloud API
- Serves a React inbox UI that polls or uses websockets for conversation updates

The goal is to add three layers without breaking existing API call patterns:
1. **Auth layer** — Supabase Auth, protecting all routes
2. **Settings layer** — Admin UI to manage Kapso credentials stored in Supabase Postgres
3. **Config resolution layer** — API routes read credentials from DB instead of `.env`

**Confidence on Kapso internals:** LOW — the upstream repo structure was not inspected directly. The actual Next.js router version (App Router vs Pages Router), exact API route structure, and internal state management are unverified. Fork inspection is the first build-order task.

---

## Recommended Architecture

```
Browser
  |
  | (HTTPS)
  v
Vercel Edge (Next.js Middleware)
  |
  |-- [No session] --> /login (public)
  |
  |-- [Has session] --> App routes (protected)
       |
       |-- /inbox         (main WhatsApp inbox UI)
       |-- /admin/settings (settings management page)
       |
       |-- /api/messages   (existing Kapso proxy routes)
       |-- /api/webhook    (existing WhatsApp webhook)
       |-- /api/settings   (NEW — read/write settings from DB)
       |
       v
  Supabase
    |-- Auth (session management, JWT)
    |-- Postgres
         |-- table: app_settings (Kapso credentials, config)
         |-- table: profiles (user metadata, if needed)
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| Next.js Middleware (`middleware.ts`) | Session validation on every request; redirects unauthenticated users to `/login` | Supabase Auth (reads session cookie), all route handlers |
| Login Page (`/login`) | Email + password login form; creates Supabase session | Supabase Auth client |
| Inbox UI (existing Kapso pages) | WhatsApp conversation list, message thread, send UI | Existing API routes (`/api/messages`, `/api/webhook`) |
| Admin Settings Page (`/admin/settings`) | Form to view and update Kapso credentials (API key, Phone Number ID, WABA ID) | `/api/settings` route |
| Settings API Route (`/api/settings`) | Server-side read/write of credentials in Supabase Postgres; validates session | Supabase Postgres, Supabase Auth (server client) |
| Config Resolver (utility module) | Fetches Kapso credentials from DB for use in API routes; replaces `process.env` reads | Supabase Postgres (server client) |
| Existing Kapso API Routes (`/api/messages`, etc.) | Proxy WhatsApp API calls; use Config Resolver to get credentials at request time | Config Resolver, Kapso Cloud API |
| Supabase Auth | Session issuance, JWT validation, user management | Next.js Middleware, Login Page, Settings API |
| Supabase Postgres | Persistent storage for settings and user data | Settings API Route, Config Resolver |

### Data Flow: Config from DB to API Calls

This is the central architectural challenge — how credentials move from Supabase Postgres into the API routes that make WhatsApp calls.

```
Admin User
  |
  | fills Settings form
  v
/admin/settings page
  |
  | POST /api/settings { phone_number_id, kapso_api_key, waba_id }
  v
/api/settings route (server)
  |
  | validates session (Supabase server client)
  | upserts row in app_settings table
  v
Supabase Postgres: app_settings
  |
  | (later, on any WhatsApp API call)
  v
Kapso API routes (/api/messages, etc.)
  |
  | calls getConfig() utility
  v
Config Resolver
  |
  | SELECT * FROM app_settings WHERE id = 'singleton'
  v
Supabase Postgres
  |
  | returns { phone_number_id, kapso_api_key, waba_id }
  v
Kapso API route uses credentials to call Kapso Cloud API
  |
  v
Kapso Cloud API -> WhatsApp
```

**Key design decision:** Config Resolver is a server-side utility module (not a React hook), called inside API route handlers. This keeps credentials server-side only, never exposed to the browser.

---

## Patterns to Follow

### Pattern 1: Supabase Server Client in API Routes

**What:** Use `@supabase/ssr` to create a server-side Supabase client inside API route handlers. This client reads the session from request cookies and can query Postgres.

**When:** Any API route that reads settings from DB or needs to verify session server-side.

**Confidence:** HIGH — this is the documented Supabase SSR pattern for Next.js.

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

**Note:** If the Kapso base uses Pages Router (not App Router), the cookie API differs. `cookies()` from `next/headers` is App Router only. Pages Router uses `req.cookies`. Verify router type when forking.

### Pattern 2: Singleton Settings Row

**What:** Store all Kapso credentials in a single row in `app_settings` table with a fixed ID. There is no multi-tenant requirement.

**When:** Reading or writing config.

**Confidence:** HIGH — this is a standard pattern for single-tenant apps.

```sql
-- Supabase migration
CREATE TABLE app_settings (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  phone_number_id TEXT,
  kapso_api_key TEXT,
  waba_id TEXT,
  whatsapp_api_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Row Level Security: only authenticated users can read
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read settings"
  ON app_settings FOR SELECT
  TO authenticated
  USING (true);

-- Only allow update (no insert by users; use upsert from service role for init)
CREATE POLICY "Authenticated users can update settings"
  ON app_settings FOR UPDATE
  TO authenticated
  USING (true);
```

### Pattern 3: Config Resolver Utility

**What:** A thin server-side module that fetches the singleton settings row and returns typed config. Existing API routes import this instead of reading `process.env`.

**When:** Any existing API route that previously used `process.env.KAPSO_API_KEY` etc.

**Confidence:** HIGH — straightforward module extraction pattern.

```typescript
// lib/config.ts
import { createClient } from './supabase/server'

type AppConfig = {
  phoneNumberId: string
  kapsoApiKey: string
  wabaId: string
  whatsappApiUrl: string
}

export async function getConfig(): Promise<AppConfig> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .eq('id', 'singleton')
    .single()

  if (error || !data) {
    // Fallback to env vars during migration / local dev
    return {
      phoneNumberId: process.env.PHONE_NUMBER_ID ?? '',
      kapsoApiKey: process.env.KAPSO_API_KEY ?? '',
      wabaId: process.env.WABA_ID ?? '',
      whatsappApiUrl: process.env.WHATSAPP_API_URL ?? 'https://api.kapso.com',
    }
  }

  return {
    phoneNumberId: data.phone_number_id,
    kapsoApiKey: data.kapso_api_key,
    wabaId: data.waba_id,
    whatsappApiUrl: data.whatsapp_api_url ?? 'https://api.kapso.com',
  }
}
```

**Important:** The env-var fallback in `getConfig()` is the migration bridge. When first deploying, settings won't exist in DB yet. The fallback prevents a hard crash. This gets cleaned up after initial settings are configured via admin UI.

### Pattern 4: Next.js Middleware for Auth Guard

**What:** A single `middleware.ts` at the project root checks session validity and redirects unauthenticated requests to `/login`.

**When:** All routes except `/login` and public assets.

**Confidence:** HIGH — documented Supabase + Next.js middleware pattern.

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

**Critical note:** Use `supabase.auth.getUser()` NOT `supabase.auth.getSession()` in middleware. `getSession()` reads from cookie and is insecure (can be spoofed). `getUser()` validates the JWT with the Supabase server. This is a documented security requirement.

### Pattern 5: Admin Settings Page as Server Component + Client Form

**What:** The `/admin/settings` page uses a Server Component to fetch current settings and passes them as initial values to a Client Component form. Form submission goes to `/api/settings` via fetch.

**When:** Admin settings page.

**Confidence:** HIGH — standard Next.js App Router pattern for forms with initial data.

```typescript
// app/admin/settings/page.tsx (Server Component)
import { createClient } from '@/lib/supabase/server'
import SettingsForm from './SettingsForm'

export default async function SettingsPage() {
  const supabase = createClient()
  const { data } = await supabase
    .from('app_settings')
    .select('*')
    .eq('id', 'singleton')
    .maybeSingle()

  return <SettingsForm initialValues={data} />
}
```

**Note:** If Kapso base uses Pages Router, this becomes `getServerSideProps` instead of a Server Component. Adapt accordingly after fork inspection.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Reading Config at Module Load Time

**What:** Importing `process.env` values at the top of an API route module and storing them in constants.

**Why bad:** With database-backed config, credentials can change after deploy. Module-level constants are evaluated once at cold start. Reading from DB must happen per-request.

**Example of what NOT to do:**
```typescript
// BAD — module-level constant
const API_KEY = process.env.KAPSO_API_KEY  // stale after settings update

export default function handler(req, res) {
  callKapso({ apiKey: API_KEY })  // uses stale value
}
```

**Instead:** Call `getConfig()` inside the handler function on every request.
```typescript
// GOOD — per-request
export default async function handler(req, res) {
  const config = await getConfig()
  callKapso({ apiKey: config.kapsoApiKey })
}
```

### Anti-Pattern 2: Storing Credentials in Browser State

**What:** Fetching API credentials from the DB and exposing them to the client side (React state, localStorage, etc.).

**Why bad:** Exposes `KAPSO_API_KEY` to the browser. Anyone inspecting network responses or state can steal the key.

**Instead:** Keep `getConfig()` server-side only. API routes fetch credentials and use them to proxy calls — they never return raw credentials to the browser. The Settings page displays credentials for admin review, which is acceptable, but transmission should be over HTTPS and the display should mask sensitive fields by default.

### Anti-Pattern 3: Skipping Row Level Security on app_settings

**What:** Disabling RLS or leaving the table public because "it's just one row."

**Why bad:** Without RLS, any authenticated user can bypass the app and query settings directly via Supabase client. Worse, if `anon` key is ever used improperly, settings become public.

**Instead:** Always enable RLS. For single-row singleton tables, the policy can be simple — but it must exist.

### Anti-Pattern 4: Using Supabase Service Role Key Client-Side

**What:** Importing `SUPABASE_SERVICE_ROLE_KEY` into a client component or exposing it in `NEXT_PUBLIC_*` env vars.

**Why bad:** Service role key bypasses all RLS. It must never reach the browser.

**Instead:** Service role key only in server-side API routes when needed for admin operations. Never prefix it `NEXT_PUBLIC_`.

### Anti-Pattern 5: Forking Without Reading the Upstream Codebase First

**What:** Starting to add auth and settings before understanding how the Kapso base app is structured.

**Why bad:** The integration points (where config is read, how API routes are structured, whether it's App Router or Pages Router) determine every architecture decision. Building on incorrect assumptions requires rework.

**Instead:** First task after fork: read the existing API routes, identify all `process.env` reads, and determine the router type. This is the discovery phase that validates these architecture patterns.

---

## Build Order (Dependency Chain)

The dependency chain drives phase ordering:

```
1. Fork & Inspect
   Understand upstream structure BEFORE touching anything.
   Output: Map of all process.env reads, router type, API route list.

   Unlocks: All subsequent phases.

2. Supabase Project Setup
   Create Supabase project, configure auth, run migrations.
   Output: Working Supabase project with app_settings table, env vars for local dev.

   Unlocks: Auth layer, Settings layer.

3. Auth Layer (Middleware + Login Page)
   Add middleware.ts, create /login page.
   Output: App requires login. All routes protected.

   Unlocks: Settings layer (needs auth to protect admin route).

4. Settings Storage (DB Schema + API Route)
   Create /api/settings route for read/write.
   Output: Settings can be written to and read from DB via API.

   Unlocks: Config Resolver (needs DB to be populated).

5. Admin Settings UI
   Build /admin/settings page with form.
   Output: Admin can update credentials through the UI.

   Unlocks: Config migration (now there's a way to put values in DB).

6. Config Migration
   Modify existing Kapso API routes to use getConfig() instead of process.env.
   Output: App reads credentials from DB. .env is fallback only.

   Unlocks: Vercel deployment (credentials no longer baked into build).

7. Branding + Polish
   Light Maissi branding (logo, app name).
   Can be done any time after phase 1.

8. Vercel Deployment
   Deploy with NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel env.
   Output: Live app. Settings managed through UI, not .env.
```

**Critical dependency:** Phases 3-6 must be done in order. Phase 7 is independent. Phase 8 depends on everything.

---

## Supabase Integration with Next.js: How It Works

**Package:** `@supabase/ssr` — the current official package for Next.js (App Router and Pages Router). Replaces the deprecated `@supabase/auth-helpers-nextjs`.

**Confidence on package:** MEDIUM — as of training data (Jan 2025), `@supabase/ssr` is the recommended package. Verify current version/name when forking.

**Three client types needed:**

| Client Type | File | Used By | Key Difference |
|-------------|------|---------|----------------|
| Browser client | `lib/supabase/client.ts` | Client components, login form | Uses `createBrowserClient` |
| Server client | `lib/supabase/server.ts` | Server components, API routes | Uses `createServerClient` with cookie helpers |
| Middleware client | `middleware.ts` | Request interception | Uses `createServerClient` with request/response cookies |

**Session flow:**
1. User logs in via Login page (browser client calls `supabase.auth.signInWithPassword()`)
2. Supabase sets auth cookies on the response
3. Every subsequent request carries those cookies
4. Middleware reads cookies, calls `supabase.auth.getUser()` to validate session
5. Valid session: request proceeds. Invalid: redirect to `/login`
6. Server components and API routes read session from cookies via server client

---

## Scalability Considerations

This project is explicitly scoped to 2-3 users and a single business. Scalability is not a meaningful concern. Document limitations in case the project scope changes:

| Concern | At 2-3 users (current) | If expanded |
|---------|------------------------|-------------|
| Auth | Supabase Auth free tier (50K MAU) — vastly sufficient | Paid plan when >50K MAU |
| Settings | Singleton row — works for one business | Multi-tenant requires per-org settings table |
| API calls | Kapso API rate limits apply, not DB limits | Would need caching layer if high volume |
| DB connections | Free tier (60 connections) — no concern at 2-3 users | Supavisor connection pooler if scaling |

**Vercel + Supabase free tier is sufficient for this project's entire intended lifespan.**

---

## Open Questions Requiring Fork Inspection

These architecture decisions cannot be finalized without reading the upstream Kapso codebase:

1. **Router type:** Is Kapso using Next.js App Router or Pages Router? This affects:
   - How `cookies()` is accessed in server components
   - Whether Server Components are available for settings page
   - Whether middleware uses the App Router or Pages Router pattern

2. **Exact process.env usage:** Which files read `PHONE_NUMBER_ID`, `KAPSO_API_KEY`, `WABA_ID`? This determines the exact scope of the Config Resolver migration.

3. **API route structure:** Are routes in `app/api/` (App Router) or `pages/api/` (Pages Router)? Affects how `getConfig()` is called.

4. **State management:** Does the inbox UI use polling, websockets, or server-sent events for real-time updates? This affects whether auth headers need to be passed to the WhatsApp API polling mechanism.

5. **Webhook verification:** The WhatsApp webhook may have its own auth/verification that bypasses user session auth. The middleware matcher must exclude the webhook route from session checks.

**Recommendation:** Create a "Phase 0: Fork and Audit" task that reads the Kapso codebase and documents answers to all 5 questions before any code is written.

---

## Sources

- PROJECT.md requirements (authoritative — defines scope)
- Supabase Next.js SSR auth documentation pattern (training knowledge, MEDIUM confidence — verify `@supabase/ssr` is still current package name)
- Supabase security guidance: use `getUser()` not `getSession()` in middleware (training knowledge, MEDIUM confidence — verify against current Supabase docs)
- Kapso whatsapp-cloud-inbox upstream repo structure (training knowledge, LOW confidence — not directly inspected; verify after fork)
- Next.js App Router patterns for server components and middleware (training knowledge, MEDIUM confidence)
