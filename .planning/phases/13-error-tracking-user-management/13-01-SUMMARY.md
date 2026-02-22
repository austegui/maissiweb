---
phase: 13-error-tracking-user-management
plan: 01
subsystem: infra
tags: [error-boundary, supabase, admin-client, service-role, next.js]

# Dependency graph
requires:
  - phase: 12-analytics-export
    provides: Completed v2.0 feature set; error tracking is final phase
provides:
  - Branded global error boundary (src/app/global-error.tsx) for unrecoverable crashes
  - Supabase admin client factory (src/lib/supabase/admin.ts) for service role operations
affects:
  - 13-02 (user management plan depends directly on createAdminClient from admin.ts)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Global error boundary uses inline styles (not Tailwind) because globals.css is unavailable when root layout is bypassed"
    - "Admin Supabase client uses @supabase/supabase-js (not @supabase/ssr) -- static service role key, no cookie sessions"
    - "createAdminClient() validates env vars at call time and throws descriptive errors"

key-files:
  created:
    - src/app/global-error.tsx
    - src/lib/supabase/admin.ts
  modified: []

key-decisions:
  - "Inline styles only in global-error.tsx -- Tailwind CSS variables unavailable when root layout is replaced"
  - "ASCII-safe Spanish text (no accent characters) to avoid encoding issues in the error page"
  - "SUPABASE_SERVICE_ROLE_KEY has no NEXT_PUBLIC_ prefix -- server-only, never exposed to browser"
  - "admin.ts imports from @supabase/supabase-js not @supabase/ssr -- service role uses static key, not cookie-based sessions"
  - "auth options persistSession/autoRefreshToken/detectSessionInUrl all false -- stateless server-side client"

patterns-established:
  - "Server-only files: absence of 'use client' + server env vars = safe server boundary"
  - "Error boundaries in Next.js App Router require html/body tags since they replace the root layout"

# Metrics
duration: 1min
completed: 2026-02-22
---

# Phase 13 Plan 01: Error Tracking + User Management -- Foundation Summary

**Branded crash recovery page with retry/home buttons and a service role Supabase client factory for admin operations**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-22T19:22:20Z
- **Completed:** 2026-02-22T19:23:24Z
- **Tasks:** 2 of 2
- **Files modified:** 2

## Accomplishments

- Created `global-error.tsx` as a proper Next.js App Router error boundary with `<html>` and `<body>` tags, branded Maissi styling, and retry/home actions
- Created `createAdminClient()` factory in `src/lib/supabase/admin.ts` using service role key for server-side auth.admin operations
- No new npm packages required -- both files use existing dependencies (`@supabase/supabase-js` already installed)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create branded global error page** - `4ac6455` (feat)
2. **Task 2: Create Supabase admin client utility** - `0678200` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified

- `src/app/global-error.tsx` - Client Component error boundary with html/body, Maissi branding, inline styles, retry + home buttons
- `src/lib/supabase/admin.ts` - createAdminClient() factory using service role key, server-only, all auth caching disabled

## Decisions Made

- **Inline styles only** in `global-error.tsx` because Tailwind CSS and CSS variables from `globals.css` are unavailable when the root layout is replaced by the error boundary
- **ASCII-safe text** (no accent characters) in the error page to avoid any encoding issues in a crash scenario
- **`@supabase/supabase-js` (not `@supabase/ssr`)** for admin client -- service role uses a static key, not cookie-based sessions that `@supabase/ssr` is designed for
- **No `NEXT_PUBLIC_` prefix** on `SUPABASE_SERVICE_ROLE_KEY` -- keeps it server-only, never sent to browser

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

The `SUPABASE_SERVICE_ROLE_KEY` environment variable must be set in Vercel for the admin client to work. It is the service role key from the Supabase project settings > API > Project API keys.

This will be needed before Plan 02 user management routes are deployed. No dashboard SQL steps required for this plan.

## Next Phase Readiness

- `src/app/global-error.tsx` is live -- any unrecoverable crash will show branded Maissi page instead of blank screen
- `createAdminClient()` is ready for Plan 02 to import for user invitation, listing, role update, and deletion operations
- No blockers -- Plan 02 can proceed immediately

---
*Phase: 13-error-tracking-user-management*
*Completed: 2026-02-22*
