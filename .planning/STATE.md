# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** The team can send and receive WhatsApp messages through a shared web inbox without anyone needing to touch code or config files.
**Current focus:** Phase 2 — Authentication (plans 01 and 02 complete)

## Current Position

Phase: 2 of 6 (Authentication)
Plan: 2 of ~3 in current phase (02-02 complete)
Status: In progress — 02-01 and 02-02 complete, auth layer fully operational
Last activity: 2026-02-18 — Completed 02-02-PLAN.md (login page, server actions, middleware)

Progress: [████░░░░░░] 33% (6/18 plans estimated)

## Performance Metrics

**Velocity:**
- Total plans completed: 3 (Phase 1) + 2 (02-01, 02-02)
- Average duration: ~6 min (all plans)
- Total execution time: ~34 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-fork-setup | 3/3 | ~21 min | ~7 min |
| 02-authentication | 2/~3 | ~13 min | ~6.5 min |

**Recent Trend:**
- Last 5 plans: 01-01 (5 min), 01-02 (8 min), 01-03 (~7 min), 02-01 (~8 min), 02-02 (~5 min)
- Trend: Stable, slightly accelerating

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Architecture is additive — new files alongside Kapso, no rewrites of Kapso core (exception: Phase 4 targeted process.env replacements)
- [Phase 1 Audit]: Router type is **App Router** — all Phase 2+ work uses App Router conventions (server components, route.ts, layout.tsx nesting)
- [Phase 1 Audit]: No webhook endpoint exists — app uses polling via use-auto-polling.ts — AUTH-03 webhook exclusion is N/A (no path to whitelist)
- [Phase 1 Audit]: process.env reads concentrated in 2 files — src/lib/whatsapp-client.ts (3 reads: KAPSO_API_KEY line 7, WHATSAPP_API_URL line 12, PHONE_NUMBER_ID line 27) and src/app/api/templates/route.ts (1 read: WABA_ID line 6)
- [Phase 1 Audit]: WABA_ID read inline in templates/route.ts instead of via whatsapp-client.ts — Phase 4 should centralize it
- [Phase 1]: All testing done via Vercel deployment, not local dev server
- [02-01]: Use @supabase/ssr (not @supabase/auth-helpers) — official current library for Next.js App Router
- [02-01]: getUser() not getSession() in middleware — contacts Auth servers for real token validation
- [02-01]: Route protection logic lives in src/lib/supabase/middleware.ts, root middleware.ts is thin wrapper
- [02-01]: async cookies() required for Next.js 15 — synchronous form removed
- [02-01]: Supabase project URL is https://mwtxxyupqqfgsbapvjbb.supabase.co
- [02-02]: Error passing via ?error= search param (not returned object) — keeps LoginPage as Server Component
- [02-02]: Middleware matcher excludes static assets (_next/static, _next/image, favicon, images) — prevents Supabase getUser() on every asset
- [02-02]: logout() Server Action ready to wire to button in Phase 3 or 5

### Pending Todos

None.

### Blockers/Concerns

None — Auth layer complete. Login page live at /login, all routes protected by middleware.

## Session Continuity

Last session: 2026-02-18
Stopped at: Completed 02-02-PLAN.md — login page, server actions, and middleware done
Resume file: None
