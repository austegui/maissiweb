# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** The team can send and receive WhatsApp messages through a shared web inbox without anyone needing to touch code or config files.
**Current focus:** Phase 4 in progress — 04-01 complete (credential wiring), more plans may follow

## Current Position

Phase: 4 of 6 (Config Migration) — In progress
Plan: 1 of ? in phase — complete
Status: 04-01 complete (2/2 tasks, 8 files modified, zero TS errors)
Last activity: 2026-02-18 — Completed 04-01-PLAN.md

Progress: [███████░░░] 67% (3.33/6 phases — 10/15 estimated plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 3 (Phase 1) + 3 (Phase 2) + 3 (Phase 3) + 1 (Phase 4)
- Average duration: ~6 min (all plans)
- Total execution time: ~65 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-fork-setup | 3/3 | ~21 min | ~7 min |
| 02-authentication | 3/3 | ~18 min | ~6 min |
| 03-admin-settings | 3/3 | ~21 min | ~7 min |
| 04-config-migration | 1/? | ~5 min | ~5 min |

**Recent Trend:**
- Last 5 plans: 03-01 (~8 min), 03-02 (~8 min), 03-03 (~5 min), 04-01 (~5 min)
- Trend: Stable, ~5-8 min per plan

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Architecture is additive — new files alongside Kapso, no rewrites of Kapso core (exception: Phase 4 targeted process.env replacements)
- [Phase 1 Audit]: Router type is **App Router** — all Phase 2+ work uses App Router conventions (server components, route.ts, layout.tsx nesting)
- [Phase 1 Audit]: No webhook endpoint exists — app uses polling via use-auto-polling.ts — AUTH-03 webhook exclusion is N/A (no path to whitelist)
- [Phase 1 Audit]: process.env reads concentrated in 2 files — src/lib/whatsapp-client.ts (3 reads: KAPSO_API_KEY line 7, WHATSAPP_API_URL line 12, PHONE_NUMBER_ID line 27) and src/app/api/templates/route.ts (1 read: WABA_ID line 6) — ALL RESOLVED IN 04-01
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
- [03-01]: Route handler returns 401 JSON intentionally alongside middleware 302 redirect (serves API consumers)
- [03-01]: PHONE_NUMBER_ID fallback is empty string not undefined — empty string is valid, matches whatsapp-client.ts behavior
- [03-02]: API key input uses placeholder not defaultValue — prevents masked string corrupting DB on save
- [03-02]: WHATSAPP_API_URL is optional — blank submission skips upsert (preserves env fallback)
- [03-02]: KAPSO_API_KEY conditionally upserted — blank = keep current, non-blank = update
- [03-02]: SaveResult type exported from actions.ts for type-safe import in SettingsForm
- [03-03]: Used plain <a href> anchor tag (not Next.js Link) in 'use client' component — avoids extra import, identical navigation behavior
- [04-01]: getWhatsAppClient() is async factory, no singleton — Vercel serverless doesn't share module state; per-request instantiation is correct
- [04-01]: Proxy pattern removed entirely — synchronous Proxy get traps cannot await async factory
- [04-01]: getConfig() throws on missing key — replaces manual if(!wabaId) return 500 in templates/route.ts
- [04-01]: npm run build fails locally (pre-existing) — lightningcss-linux-x64-gnu absent in WSL2 (Windows node_modules); Vercel builds succeed with native Linux binaries
- [04-01]: TemplateMessageInput type alias updated to InstanceType<typeof WhatsAppClient>['messages']['sendTemplate'] — replaces removed Proxy export reference

### Pending Todos

None.

### Blockers/Concerns

None. 04-01 complete. All credential migration done in one plan. Phase 5 (Inbox UI) can begin.

## Session Continuity

Last session: 2026-02-18
Stopped at: Completed 04-01-PLAN.md
Resume file: None
