---
phase: 03-admin-settings
plan: 01
subsystem: api
tags: [supabase, nextjs, typescript, credentials, settings, app-router]

# Dependency graph
requires:
  - phase: 02-authentication
    provides: "createClient() from src/lib/supabase/server — async server-side Supabase client used by both new files"
  - phase: 02-authentication
    provides: "app_settings table with key/value schema and RLS policies for authenticated role (created in 02-01)"
provides:
  - "getConfig() async function: DB-first credential resolver with process.env fallback for all 4 config keys"
  - "ConfigKey type union exported for use by Phase 4 callers"
  - "GET /api/settings: authenticated HTTP endpoint to read all app_settings rows"
  - "POST /api/settings: authenticated HTTP endpoint to upsert settings array"
affects:
  - 03-admin-settings (plan 02 — settings page Server Component will use getConfig() and createClient() patterns)
  - 04-credential-migration (Phase 4 will await getConfig() in whatsapp-client.ts and templates/route.ts)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DB-first credential resolution: query app_settings, fall back to process.env, throw only if truly absent"
    - "Route-level 401 JSON auth check alongside middleware 302 redirect (both serve different consumers)"
    - "Supabase upsert with onConflict on non-PK column: .upsert(data, { onConflict: 'key' })"
    - "getUser() (not getSession()) in route handlers for real token validation"

key-files:
  created:
    - src/lib/get-config.ts
    - src/app/api/settings/route.ts
  modified: []

key-decisions:
  - "getConfig() queries DB on every call — no module-level cache (Vercel serverless functions don't reliably share module state)"
  - "PHONE_NUMBER_ID fallback is empty string (not undefined) — empty string is a valid non-throwing default"
  - "Route handler returns 401 JSON intentionally, not relying solely on middleware 302 redirect"
  - "getConfig() is NOT yet called by Kapso routes — Phase 4 scope, not Phase 3"

patterns-established:
  - "Pattern: ConfigKey type union as single source of truth for valid credential names"
  - "Pattern: ENV_FALLBACKS record maps each ConfigKey to its process.env value, enabling consistent fallback behavior"

# Metrics
duration: 8min
completed: 2026-02-18
---

# Phase 3 Plan 01: Backend Foundation (getConfig + /api/settings) Summary

**Async DB-first credential resolver (getConfig) and authenticated REST route (/api/settings) for app_settings table using Supabase maybeSingle and upsert onConflict patterns**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-02-18T00:00:00Z
- **Completed:** 2026-02-18
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments

- Created `getConfig()` async utility that queries `app_settings` table first, falls back to `process.env`, and throws only when a key is truly unconfigured
- Created `/api/settings` route with authenticated GET (read all rows) and POST (upsert with onConflict) handlers
- Both files compile with zero TypeScript errors (`npx tsc --noEmit` clean)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create getConfig() utility** - `4ba992a` (feat)
2. **Task 2: Create /api/settings route handler** - `50550ab` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/lib/get-config.ts` - Async credential resolver: DB-first query via maybeSingle(), ENV_FALLBACKS record, ConfigKey type export, descriptive error for unconfigured keys
- `src/app/api/settings/route.ts` - GET + POST route handlers with getUser() auth check, 401 JSON response, and upsert with onConflict: 'key'

## Decisions Made

- **No cache in getConfig():** Vercel serverless functions do not reliably share module-level state. Each call does a fresh DB query. Phase 4 may add `unstable_cache` if latency becomes an issue.
- **PHONE_NUMBER_ID empty string default:** `process.env.PHONE_NUMBER_ID || ''` makes the fallback an empty string. Since `'' !== undefined`, it is returned (not thrown). This matches the existing behavior in `whatsapp-client.ts`.
- **Route-level auth check kept:** Middleware returns 302 redirects which are inappropriate for API consumers using `fetch()`. The 401 JSON route-level check is intentional and must not be removed even though middleware also protects the route.
- **getConfig() NOT wired to Kapso routes:** Phase 3 scope is creating the utility only. Phase 4 will replace `process.env` reads in `whatsapp-client.ts` and `templates/route.ts` with `await getConfig()`.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required for this plan.

## Next Phase Readiness

- `getConfig()` utility ready for Phase 4 to use in `whatsapp-client.ts` and `templates/route.ts`
- `/api/settings` route ready for Phase 3 Plan 02 (settings page) to use as reference (page will query DB directly, not via this route)
- TypeScript compiles cleanly — no blockers for next plan
- Phase 4 note: when `getConfig()` is called from `whatsapp-client.ts`, the Kapso routes run in a browser-initiated context (user session cookie present), so anon-key client RLS will pass. If server-initiated calls without session are ever needed, a `createServiceClient()` with service role key will be required.

---
*Phase: 03-admin-settings*
*Completed: 2026-02-18*
