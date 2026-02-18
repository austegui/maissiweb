---
phase: 02-authentication
plan: 02
subsystem: auth
tags: [supabase, next.js, middleware, server-actions, tailwind]

# Dependency graph
requires:
  - phase: 02-01
    provides: src/lib/supabase/server.ts and src/lib/supabase/middleware.ts (Supabase SSR clients)
provides:
  - Login page at /login with email/password form (Server Component)
  - login() and logout() Server Actions in src/app/login/actions.ts
  - src/middleware.ts entry point protecting all non-static routes
affects: [03-inbox-ui, 04-env-config, 05-branding, 06-deploy]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Server Action for form submission (no API route needed)
    - Error passing via URL search params (keeps page as Server Component)
    - Thin middleware.ts delegating auth logic to lib/supabase/middleware.ts
    - Next.js 15 async searchParams pattern

key-files:
  created:
    - src/app/login/page.tsx
    - src/app/login/actions.ts
    - src/middleware.ts
  modified: []

key-decisions:
  - "Error via search params (?error=) not returned object — keeps LoginPage as Server Component, no client state needed"
  - "Middleware matcher excludes _next/static, _next/image, favicon, and image extensions to prevent Supabase auth check on every asset"
  - "No webhook path exclusion in matcher — app uses polling (confirmed Phase 1 audit), no webhook routes exist"

patterns-established:
  - "Server Action pattern: 'use server' file with async functions bound to form action={fn}"
  - "Error propagation: redirect('/login?error=encodeURIComponent(message)') instead of returning {error}"
  - "Middleware thin wrapper: src/middleware.ts calls updateSession(), all logic in src/lib/supabase/middleware.ts"

# Metrics
duration: 5min
completed: 2026-02-18
---

# Phase 2 Plan 02: Login Page and Middleware Summary

**Supabase email/password login via Server Actions with Next.js middleware protecting all routes; unauthenticated users redirected to /login, authenticated users on /login redirected to /**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-18T00:00:00Z
- **Completed:** 2026-02-18T00:05:00Z
- **Tasks:** 2
- **Files modified:** 3 created

## Accomplishments
- Login page at /login as a Server Component with Tailwind-styled email/password form
- Server Actions `login` and `logout` consuming the Supabase SSR client from 02-01
- Next.js middleware entry point with static asset exclusion matcher, delegating to updateSession

## Task Commits

Each task was committed atomically:

1. **Task 1: Create login page and auth Server Actions** - `7811a41` (feat)
2. **Task 2: Create Next.js middleware entry point** - `be2307c` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `src/app/login/actions.ts` - Server Actions: login() with signInWithPassword, logout() with signOut
- `src/app/login/page.tsx` - Login form as Server Component; reads ?error= from async searchParams
- `src/middleware.ts` - Next.js middleware entry point; delegates to updateSession with static asset matcher

## Decisions Made
- Error passing via URL search params (`?error=encodeURIComponent(msg)`) instead of returning an object — keeps LoginPage as a Server Component (no `useState` or `use client` required)
- Middleware matcher regex excludes `_next/static`, `_next/image`, `favicon.ico`, and common image extensions to prevent Supabase getUser() from running on every static asset
- No webhook path exclusion needed in the matcher — confirmed in Phase 1 audit that the app polls (use-auto-polling.ts) and has no webhook endpoints

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. Supabase project and env vars were configured in 02-01.

## Next Phase Readiness
- Auth layer is complete: unauthenticated users are redirected to /login, authenticated users can reach the inbox
- The `logout()` Server Action is ready to wire to a button in any phase (Phase 5 branding or Phase 3 inbox UI)
- Ready for Phase 3 (inbox UI) or Phase 4 (env config) — no blockers

---
*Phase: 02-authentication*
*Completed: 2026-02-18*
