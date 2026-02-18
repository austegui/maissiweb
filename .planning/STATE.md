# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** The team can send and receive WhatsApp messages through a shared web inbox without anyone needing to touch code or config files.
**Current focus:** Phase 3 in progress — backend foundation complete, settings UI next

## Current Position

Phase: 3 of 6 (Admin Settings) — In progress
Plan: 1 of 3 in phase (03-01 complete)
Status: In progress — 03-01 executed (getConfig + /api/settings backend foundation)
Last activity: 2026-02-18 — Completed 03-01-PLAN.md (getConfig utility + /api/settings route)

Progress: [████░░░░░░] 44% (8/18 plans estimated)

## Performance Metrics

**Velocity:**
- Total plans completed: 3 (Phase 1) + 3 (02-01, 02-02, 02-03) + 1 (03-01)
- Average duration: ~6 min (all plans)
- Total execution time: ~47 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-fork-setup | 3/3 | ~21 min | ~7 min |
| 02-authentication | 3/3 | ~18 min | ~6 min |
| 03-admin-settings | 1/3 | ~8 min | ~8 min |

**Recent Trend:**
- Last 5 plans: 02-01 (~8 min), 02-02 (~5 min), 02-03 (~5 min), 03-01 (~8 min)
- Trend: Stable, ~5-8 min per plan

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
- [02-02]: logout() Server Action wired to "Sign out" button in inbox header (gap closure)
- [02-03]: Auth flow confirmed working on Vercel production deployment
- [02-03]: Initial deployment had space in NEXT_PUBLIC_SUPABASE_ANON_KEY causing "invalid header value" — fixed by user re-pasting env var in Vercel dashboard
- [03-01]: getConfig() queries DB on every call — no module-level cache (Vercel serverless functions don't share module state reliably)
- [03-01]: getConfig() is NOT yet called by Kapso routes — Phase 4 scope; Phase 3 creates utility only
- [03-01]: Route handler returns 401 JSON intentionally alongside middleware 302 redirect (serves API consumers)
- [03-01]: PHONE_NUMBER_ID fallback is empty string not undefined — empty string is valid, matches whatsapp-client.ts behavior

### Pending Todos

None.

### Blockers/Concerns

None — 03-01 backend foundation complete. TypeScript compiles cleanly. Ready for 03-02 (settings UI page).

## Session Continuity

Last session: 2026-02-18
Stopped at: Completed 03-01-PLAN.md — getConfig utility and /api/settings route created and committed
Resume file: None
