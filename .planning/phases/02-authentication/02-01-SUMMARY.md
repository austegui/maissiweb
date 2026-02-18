---
phase: 02-authentication
plan: 01
subsystem: auth
tags: [supabase, supabase-js, supabase-ssr, nextjs15, cookies, jwt, row-level-security]

# Dependency graph
requires:
  - phase: 01-fork-setup
    provides: Next.js App Router project with src/ structure confirmed
provides:
  - "@supabase/supabase-js and @supabase/ssr installed as project dependencies"
  - "src/lib/supabase/client.ts — browser-side Supabase client factory (createBrowserClient)"
  - "src/lib/supabase/server.ts — server-side Supabase client factory (async cookies, Next.js 15)"
  - "src/lib/supabase/middleware.ts — updateSession with getUser() route protection"
  - "Supabase project created with app_settings table and RLS policies"
  - "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY set in Vercel"
affects:
  - 02-authentication (plans 02-03 — all import from these utility files)
  - 03-settings-ui (reads app_settings table via server client)
  - 04-env-migration (Supabase client available for runtime config reads)

# Tech tracking
tech-stack:
  added:
    - "@supabase/supabase-js ^2.97.0"
    - "@supabase/ssr ^0.8.0"
  patterns:
    - "Browser client: createBrowserClient from @supabase/ssr (for Client Components)"
    - "Server client: createServerClient with async cookies() (Next.js 15 required pattern)"
    - "Middleware: getUser() not getSession() for server-side token validation"
    - "Route protection in lib utility, thin middleware.ts wrapper imports it"

key-files:
  created:
    - src/lib/supabase/client.ts
    - src/lib/supabase/server.ts
    - src/lib/supabase/middleware.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Use @supabase/ssr (not @supabase/auth-helpers) — official current library for Next.js App Router"
  - "getUser() over getSession() in middleware — contacts Auth servers, not just local cookie"
  - "Route protection logic lives in src/lib/supabase/middleware.ts, not in root middleware.ts"
  - "async cookies() required for Next.js 15 — synchronous form removed"

patterns-established:
  - "Supabase client pattern: separate client.ts/server.ts/middleware.ts — one file per context"
  - "Error swallowed in server.ts setAll — expected when called from Server Components"
  - "Middleware always returns supabaseResponse (not NextResponse.next()) to preserve session cookies"

# Metrics
duration: 8min
completed: 2026-02-18
---

# Phase 2 Plan 01: Supabase Client Setup Summary

**@supabase/supabase-js + @supabase/ssr installed with three utility files: browser client (createBrowserClient), async server client (Next.js 15 cookies), and middleware updateSession using getUser() route protection**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-02-18T14:19:13Z
- **Completed:** 2026-02-18T14:27:00Z
- **Tasks:** 1 auto (+ 1 checkpoint pending user action)
- **Files modified:** 5

## Accomplishments

- Installed @supabase/supabase-js (^2.97.0) and @supabase/ssr (^0.8.0)
- Created browser client factory using createBrowserClient (for Client Components)
- Created server client factory using async cookies() — Next.js 15 compatible pattern
- Created middleware updateSession with getUser() for secure token validation and route protection logic

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Supabase packages and create client utility files** - `5b3dcb0` (feat)

**Plan metadata:** (pending — checkpoint in progress)

## Files Created/Modified

- `src/lib/supabase/client.ts` — Browser-side Supabase client factory (createBrowserClient, reads NEXT_PUBLIC_ env vars)
- `src/lib/supabase/server.ts` — Server-side Supabase client factory (async cookies(), Next.js 15 required pattern)
- `src/lib/supabase/middleware.ts` — updateSession function with getUser() validation and unauthenticated redirect logic
- `package.json` — Added @supabase/supabase-js and @supabase/ssr dependencies
- `package-lock.json` — Updated lock file

## Decisions Made

- **@supabase/ssr over @supabase/auth-helpers:** The auth-helpers package is deprecated; @supabase/ssr is the official current library for Next.js App Router
- **getUser() not getSession() in middleware:** getUser() makes a network call to Supabase Auth servers to validate the JWT — getSession() only reads the local cookie and cannot detect revoked tokens
- **Route protection in lib utility file:** The updateSession function in src/lib/supabase/middleware.ts contains full protection logic; the root middleware.ts (plan 02-02) will be a thin wrapper. This keeps the protection logic testable and co-located with the Supabase utilities.
- **async cookies() pattern:** Next.js 15 removed synchronous cookies() access — all server-side cookie reads must use await

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**External services require manual configuration.** The checkpoint in this plan requires:

1. Create Supabase project at https://supabase.com
2. Run app_settings table SQL in Supabase SQL Editor
3. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to Vercel environment variables
4. Create first user account in Supabase Authentication -> Users

The app_settings SQL:
```sql
CREATE TABLE app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read settings"
  ON app_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update settings"
  ON app_settings FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert settings"
  ON app_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);
```

## Next Phase Readiness

- Three Supabase utility files are ready — plans 02-02 (middleware wrapper) and 02-03 (login page + server actions) can import from them immediately
- Supabase project must be created and env vars set before any auth flow can be tested end-to-end
- No blockers once user completes the checkpoint steps

---
*Phase: 02-authentication*
*Completed: 2026-02-18*
