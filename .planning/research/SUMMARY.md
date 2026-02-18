# Project Research Summary

**Project:** Maissi Beauty Shop — WhatsApp Cloud Inbox
**Domain:** WhatsApp Business Shared Inbox — Single-Tenant Internal Tool
**Researched:** 2026-02-18
**Confidence:** MEDIUM (high confidence on owner-defined scope; medium on Kapso internals until fork is inspected)

## Executive Summary

Maissi is a customization layer on top of the Kapso `whatsapp-cloud-inbox` open-source Next.js application. The Kapso base already ships a working WhatsApp inbox with real-time messaging, template support, media transmission, and 24-hour window enforcement. The task is to add three things on top — user authentication (Supabase Auth), an admin UI for managing Kapso API credentials, and database-backed settings that survive redeployments — then deploy to Vercel. The architecture is additive: nothing in the Kapso core should be rewritten. The customization layer lives alongside Kapso's files, not inside them.

The recommended stack for the additions is small and well-understood: `@supabase/ssr` + `@supabase/supabase-js` for auth and the database client, React Hook Form + Zod for the settings form, shadcn/ui + Tailwind for settings UI components (scoped to the admin route only), and Next.js middleware for route protection. The entire platform runs on Supabase free tier (more than sufficient for 2-3 users) and Vercel. The critical stack unknown is whether the Kapso base uses App Router or Pages Router — this affects middleware setup, server component patterns, and Server Actions availability. Resolving this is the first task when forking.

The biggest risks are security (API credentials must never reach the browser — server-only reads only), completeness (the middleware auth guard must explicitly exclude the WhatsApp webhook endpoint or incoming messages will silently stop), and scope creep (the v1 feature set is deliberately narrow; the post-v1 differentiators are high-value but should not dilute the first working release). If the fork is kept thin — new files alongside Kapso, no edits to Kapso's core — the project is low-risk and can be shipped quickly.

---

## Key Findings

### Recommended Stack

The Kapso base provides Next.js, TypeScript, and plain CSS. The additions required are: Supabase (`@supabase/supabase-js` v2 and `@supabase/ssr`) for auth and Postgres, React Hook Form + Zod for the settings form, shadcn/ui + Tailwind CSS for the settings UI, and Next.js Middleware for auth-gating routes. No ORM is needed — the Supabase JS client querying one or two tables is sufficient. No complex state management is needed — the Kapso base already manages inbox state.

The key architectural constraint is that the Kapso base's Next.js router version is unverified. App Router enables Server Components, Server Actions, and `@supabase/ssr`'s cookie helpers as documented. Pages Router requires different patterns for each. The build cannot begin until the router version is confirmed.

**Core technologies:**
- `@supabase/supabase-js` v2: Supabase JS client — required for all DB queries and auth operations
- `@supabase/ssr`: Server-side Supabase auth for Next.js — official replacement for deprecated `auth-helpers-nextjs`; handles cookie-based sessions in middleware and server components
- React Hook Form + Zod: Settings form validation — industry standard, TypeScript-first, pairs with shadcn/ui
- shadcn/ui + Tailwind CSS: Admin settings UI components — copy-paste components, no dependency lock-in, scoped to admin route only
- Next.js Middleware (`middleware.ts`): Route protection — single file, intercepts all requests, redirects unauthenticated users to `/login`
- Supabase Postgres (hosted, free tier): Persistent storage for Kapso credentials and user records

**What NOT to add:** NextAuth, Clerk, any ORM (Prisma/Drizzle), full UI library (MUI/Chakra), multi-tenant infrastructure.

See `.planning/research/STACK.md` for full rationale and installation commands.

---

### Expected Features

The v1 scope is owner-confirmed and narrow. The Kapso base covers all messaging features. The customization layer adds only what the team needs to operate the tool independently.

**Must have (table stakes — v1):**
- Individual user logins (Supabase Auth, email + password) — team accountability, separate sessions
- Admin settings UI for API credentials — non-technical owner must update credentials without touching code
- Settings persistence in Supabase Postgres — credentials survive redeployments
- Protected routes (auth-gated inbox) — inbox must not be accessible without login
- Light Maissi branding (name + logo only) — team needs the tool to feel like theirs

**Should have (highest-ROI post-v1 additions):**
- Quick replies / canned responses — staff sends the same messages constantly; team-shared, stored in Supabase
- Customer notes / internal annotations — "sensitive scalp", "prefers balayage" — keyed by phone number
- Appointment reminder templates — high business value; requires scheduling infrastructure

**Defer to v2+:**
- Customer labels / tags
- Conversation assignment to staff member
- Message search
- Business hours auto-reply
- Price list / services media library

**Never build (for this product):**
- Multi-account / multi-shop support
- Direct Meta API layer (replacing Kapso)
- Full UI redesign
- RBAC / complex role system

See `.planning/research/FEATURES.md` for full feature dependency tree and anti-features rationale.

---

### Architecture Approach

The architecture is three layers added on top of an untouched Kapso base: an auth layer (Supabase Auth + Next.js Middleware), a settings layer (admin UI + Supabase Postgres table), and a config resolution layer (a server-side `getConfig()` utility that replaces direct `process.env` reads in Kapso's API routes). The central design principle is that credentials are server-only — they flow from Supabase Postgres into API route handlers and never reach the browser. The settings table uses a singleton row pattern (one row, fixed ID `'singleton'`) with Row-Level Security enabled.

**Major components:**
1. `middleware.ts` — session validation on every request; redirects unauthenticated users to `/login`; must explicitly whitelist `/api/webhook`
2. Login Page (`/login`) — email + password form; creates Supabase session via browser client
3. Admin Settings Page (`/admin/settings`) — Server Component fetches current settings; passes to Client Component form; writes via `/api/settings` route
4. Settings API Route (`/api/settings`) — server-side read/write of `app_settings` table; validates session before accepting writes
5. Config Resolver (`lib/config.ts` — `getConfig()`) — fetches singleton settings row from Supabase Postgres; called inside every Kapso API route handler; falls back to `process.env` during migration
6. Supabase Postgres (`app_settings` table) — single row storing `phone_number_id`, `kapso_api_key`, `waba_id`, `whatsapp_api_url`; RLS-protected

The build order is a hard dependency chain: Fork + Inspect → Supabase Setup → Auth Layer (middleware + login) → Settings Storage (DB schema + API route) → Admin Settings UI → Config Migration (replace process.env reads) → Branding → Vercel Deploy.

See `.planning/research/ARCHITECTURE.md` for full patterns, code samples, and open questions requiring fork inspection.

---

### Critical Pitfalls

1. **API credentials readable in browser** — The settings API route must never return the raw `KAPSO_API_KEY` to the browser. Store in Supabase, read server-side only, display only last 4 characters in the UI. Violation: WhatsApp Business Account suspension.

2. **Webhook accidentally auth-guarded** — The Next.js middleware matcher must explicitly exclude `/api/webhook`. If the webhook is redirected to `/login`, all incoming WhatsApp messages silently stop arriving. Meta's webhook system enters a backoff state.

3. **Building on Kapso internals before reading the code** — The router type (App Router vs Pages Router), exact `process.env` usage, and API route structure are unknown until the fork is inspected. All architecture patterns have conditional variants depending on this. Phase 0 (Fork + Audit) is mandatory before any code is written.

4. **Dual credential sources (.env + Supabase) creating split truth** — If Vercel env vars are not removed after migrating to Supabase, old credentials may silently override new ones. Use a single `getConfig()` resolver with DB-first, env-fallback-for-local-dev only.

5. **WhatsApp 24-hour window not enforced** — Kapso may or may not enforce this in the UI. If staff can send free-form messages to out-of-window contacts, messages fail silently. Requires `last_customer_message_at` tracking and a UI warning + template-only send for expired windows.

See `.planning/research/PITFALLS.md` for 12 pitfalls with detection signs, prevention strategies, and phase assignments.

---

## Implications for Roadmap

Based on the dependency chain in ARCHITECTURE.md, the phase structure must follow the hard dependencies: you cannot add auth before you understand the upstream codebase, and you cannot migrate credentials before auth exists to protect the settings route. The research strongly suggests 6-7 phases.

### Phase 0: Fork Setup and Upstream Audit

**Rationale:** Every architecture decision in this project has a conditional branch that depends on whether Kapso uses App Router or Pages Router. The middleware pattern, server component patterns, Server Actions availability, and Supabase cookie helpers all differ. Starting to build without this knowledge means building twice. This phase is mandatory.

**Delivers:** A forked repo, a map of all `process.env` reads in Kapso, confirmation of router type, API route list, understanding of existing real-time/polling mechanism, and upstream remote configured for future merges.

**Addresses:** FEATURES.md: "preserve all Kapso base features without breaking them"

**Avoids:** PITFALLS.md Pitfall 3 (fork divergence locked in early), Pitfall 8 (real-time polling conflict), Pitfall 5 (dual credential sources)

**Research flag:** Standard git + code reading — no additional research phase needed.

---

### Phase 1: Supabase Project Setup and Infrastructure

**Rationale:** Auth and settings storage both depend on Supabase. The database schema (`app_settings` table with RLS), auth configuration (email/password enabled, magic links optionally enabled), and environment variables must exist before any app code can reference them.

**Delivers:** A live Supabase project with `app_settings` table, RLS policies, initial user accounts created via dashboard, and environment variables set for local development.

**Uses:** STACK.md: `@supabase/supabase-js`, Supabase Postgres free tier, connection pooler URL (not direct connection string)

**Implements:** ARCHITECTURE.md: Pattern 2 (Singleton Settings Row), including the SQL migration

**Avoids:** PITFALLS.md Pitfall 7 (connection pool exhaustion) — configure pooler URL from day one; Pitfall 3 (skipping RLS)

**Research flag:** Standard pattern — skip research phase. Supabase project setup and SQL migrations are well-documented.

---

### Phase 2: Authentication Layer

**Rationale:** Auth is the gate to everything else. The inbox must be protected before it is deployed anywhere with real credentials. The middleware must be written correctly — with the webhook exclusion — before any WhatsApp functionality is tested.

**Delivers:** Working login page, Supabase session management, Next.js middleware protecting all routes except `/login` and `/api/webhook`, session refresh handled correctly, users can log in and stay logged in.

**Uses:** STACK.md: `@supabase/ssr`, Next.js Middleware

**Implements:** ARCHITECTURE.md: Pattern 1 (Supabase Server Client), Pattern 4 (Middleware Auth Guard)

**Avoids:** PITFALLS.md Pitfall 2 (missing auth guard on all routes), Pitfall 6 (webhook accidentally auth-guarded), Pitfall 10 (session not refreshed)

**Research flag:** Standard pattern — skip research phase. `@supabase/ssr` middleware pattern is documented and stable.

---

### Phase 3: Admin Settings UI and Credential Storage

**Rationale:** Once auth exists, the settings route can be protected. The admin settings UI is a hard dependency for the credential migration phase — there needs to be a way to put values into the database before the app can read them from there.

**Delivers:** `/admin/settings` page with form for `phone_number_id`, `kapso_api_key`, `waba_id`; server-side API route for read/write; credentials stored in Supabase with RLS; key displayed as last-4 only (never full value in browser).

**Uses:** STACK.md: shadcn/ui + Tailwind (scoped to admin route), React Hook Form + Zod, Server Actions or `/api/settings` route

**Implements:** ARCHITECTURE.md: Pattern 5 (Server Component + Client Form), Pattern 2 (singleton row upsert)

**Avoids:** PITFALLS.md Pitfall 1 (API key readable in browser), Pitfall 5 (dual credential sources)

**Research flag:** May need a brief research pass on Tailwind + Kapso CSS conflict if base uses global resets. Otherwise standard pattern.

---

### Phase 4: Config Migration (DB Credentials Replace .env)

**Rationale:** This is the integration that makes the whole system work. Existing Kapso API routes read credentials from `process.env` — they need to call `getConfig()` instead. This phase is a targeted edit of existing Kapso files (the one exception to the "don't touch Kapso files" rule) and must be done carefully.

**Delivers:** All Kapso API routes using `getConfig()` for credentials; `process.env` reads removed from hot paths; env-var fallback preserved for local dev only; Vercel env vars for `PHONE_NUMBER_ID`/`KAPSO_API_KEY`/`WABA_ID` removed or marked as deprecated.

**Implements:** ARCHITECTURE.md: Pattern 3 (Config Resolver Utility), Anti-Pattern 1 avoidance (no module-level constants)

**Avoids:** PITFALLS.md Pitfall 5 (dual credential sources), Pitfall 1 (credentials exposed)

**Research flag:** No research needed. Pattern is simple and well-defined.

---

### Phase 5: Branding and Polish

**Rationale:** Branding is independent of all other phases and can be done any time after Phase 0 establishes the file conventions. Placing it here (after the core system works) ensures the team can test the product before investing in polish.

**Delivers:** Maissi logo in `/public/`, app name in page title, wrapper components for branded header — all in new files, no edits to Kapso originals.

**Avoids:** PITFALLS.md Pitfall 11 (branding applied to Kapso core files causing merge conflicts)

**Research flag:** No research needed. Purely additive UI work.

---

### Phase 6: Vercel Deployment and End-to-End Verification

**Rationale:** Production deployment has its own failure modes (webhook cold starts, environment variable setup, Supabase connection pooler URLs) that only surface in the Vercel environment. This phase is not just "push to Vercel" — it is a structured verification that every integration point works in production.

**Delivers:** Live app on Vercel with correct environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`), webhook verified with Meta (GET challenge + POST test message), end-to-end send/receive tested with a real WhatsApp number, team accounts created and login verified.

**Avoids:** PITFALLS.md Pitfall 9 (Vercel cold start causing webhook timeout), Pitfall 6 (webhook not reachable), Pitfall 7 (connection pool exhaustion in production)

**Research flag:** No research needed. Vercel deployment and Supabase connection pooler setup are standard.

---

### Phase Ordering Rationale

- Phase 0 must come first because the router type determines everything else. No shortcuts.
- Phase 1 (Supabase setup) comes before Phase 2 (Auth) because auth requires a live Supabase project with configured users.
- Phase 2 (Auth) must precede Phase 3 (Settings UI) because the settings route needs auth protection before it can safely store credentials.
- Phase 3 (Settings UI) must precede Phase 4 (Config Migration) because there must be a way to populate the DB before the app reads from it.
- Phase 5 (Branding) is independent. Placing it after Phase 4 keeps earlier phases focused on infrastructure.
- Phase 6 (Deploy) comes last by definition, but webhook exclusion from middleware (Phase 2) must be verified here.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 0:** Depends entirely on reading the Kapso source code. No planning research can be done in advance — the audit output is the research.
- **Phase 3:** If Kapso base uses global CSS resets that conflict with Tailwind preflight, a brief implementation research session is needed to scope the fix before building the settings UI.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Supabase project setup and SQL migrations are fully documented.
- **Phase 2:** `@supabase/ssr` middleware pattern is the current official Supabase recommendation.
- **Phase 4:** Config Resolver is a straightforward utility module.
- **Phase 5:** Purely additive UI work with no external dependencies.
- **Phase 6:** Vercel + Supabase deployment is well-documented.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | `@supabase/ssr`, React Hook Form, Zod are HIGH confidence. Tailwind + Kapso CSS compatibility is LOW until fork is inspected. Server Actions availability is MEDIUM — depends on router type. |
| Features | HIGH | v1 scope is owner-confirmed from PROJECT.md. Post-v1 differentiators are MEDIUM — based on training knowledge of WATI/Respond.io patterns without live verification. |
| Architecture | MEDIUM | Core patterns (middleware, singleton row, Config Resolver) are HIGH confidence. All Kapso-specific integration points are LOW confidence until the upstream is read. |
| Pitfalls | HIGH | Security pitfalls (API key exposure, RLS, service role key) are HIGH confidence. Webhook behavior and WhatsApp 24-hour window are HIGH confidence. Kapso-specific pitfalls (rate limits, real-time polling) are LOW confidence — verified only after fork inspection. |

**Overall confidence:** MEDIUM

### Gaps to Address

- **Kapso router type (App Router vs Pages Router):** Determine in Phase 0. Affects middleware, server component, and Server Actions patterns. Until resolved, architecture patterns should be treated as conditional.

- **Kapso `process.env` usage scope:** Identify all files reading `PHONE_NUMBER_ID`, `KAPSO_API_KEY`, `WABA_ID` in Phase 0. Determines exact scope of Phase 4 (Config Migration).

- **Kapso real-time/polling mechanism:** Determine in Phase 0 before adding any Supabase Realtime. Risk of duplicate messages if two polling systems run simultaneously.

- **Tailwind vs Kapso CSS conflict:** Verify in Phase 0 or early Phase 3. May require disabling Tailwind preflight or using a CSS layers approach.

- **WhatsApp webhook route path in Kapso:** Identify in Phase 0 to ensure middleware matcher correctly excludes it. If path differs from `/api/webhook`, the default middleware config will break incoming messages.

- **Kapso API error codes and rate limits:** Read Kapso documentation before Phase 4. Affects error handling in the Config Resolver and API proxy layer.

---

## Sources

### Primary (HIGH confidence)
- `PROJECT.md` — owner-confirmed feature scope, stack constraints, team size, and anti-features
- Supabase Next.js SSR documentation (supabase.com/docs/guides/auth/server-side/nextjs) — `@supabase/ssr` patterns, middleware setup, `getUser()` vs `getSession()` security guidance
- Next.js Middleware documentation (nextjs.org/docs/app/building-your-application/routing/middleware) — matcher config, Edge Runtime behavior
- WhatsApp Business Platform — Messaging Windows policy (developers.facebook.com/docs/whatsapp/conversation-types) — 24-hour window rules

### Secondary (MEDIUM confidence)
- Training knowledge: shadcn/ui + Tailwind CSS integration patterns
- Training knowledge: React Hook Form + Zod with `@hookform/resolvers` in Next.js
- Training knowledge: Vercel serverless function cold start behavior and webhook timeout patterns
- Training knowledge: WhatsApp shared inbox products (WATI, Respond.io, Zoko, Twilio Flex) — for post-v1 feature benchmarking

### Tertiary (LOW confidence — verify at fork time)
- Training knowledge: `gokapso/whatsapp-cloud-inbox` repo structure, router type, API route patterns — NOT directly inspected; requires Phase 0 audit
- Training knowledge: Kapso API rate limit specifics — not publicly documented; verify against Kapso docs
- Training knowledge: Supabase free tier connection limits — subject to change; verify current limits at project creation

---
*Research completed: 2026-02-18*
*Ready for roadmap: yes*
