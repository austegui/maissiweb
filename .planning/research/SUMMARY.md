# Project Research Summary

**Project:** Maissi Beauty Shop -- WhatsApp Cloud Inbox v2.0 (Commercial-Grade Features)
**Domain:** WhatsApp Business Shared Inbox / Beauty Shop CRM
**Researched:** 2026-02-21
**Confidence:** HIGH

## Executive Summary

Maissi v2.0 upgrades a working WhatsApp inbox from a functional prototype to a commercial-grade team tool. The existing stack (Next.js 15 App Router, Supabase, Kapso WhatsApp API, Radix UI + Tailwind, Vercel Hobby) is solid and stays unchanged. The v2 approach is additive: 6 new Supabase tables, 12 new npm packages (mostly Radix primitives), ~18 new API routes, and 5 new pages -- all layered on top of the existing Kapso proxy architecture. No rewrites, no data model changes, no infrastructure migrations. The data split remains: WhatsApp messages live in Kapso (read-only via API), operational metadata lives in Supabase (fully owned). Every new feature writes to Supabase; none modify how Kapso data flows.

The recommended build order is driven by two forces: **agent productivity first** (canned responses, conversation status, and sound notifications are highest daily ROI) and **dependency chains** (user profiles with RBAC must exist before any feature that references `created_by` or `assigned_to`). This means the foundation phase -- user profiles table, auth helpers, and RBAC policies -- ships before any visible feature. After that, canned responses and conversation status deliver immediate team value. Contact profiles, notes, and labels follow as "customer intelligence." Assignment, analytics, search, and export round out the milestone. Real-time SSE is explicitly replaced by Supabase Realtime for local data changes; polling stays for Kapso data.

The top risks are: (1) RBAC privilege escalation if the role column is placed in a user-editable table -- mitigated by RLS policies that prevent self-role-update; (2) Supabase free tier connection pressure as features multiply -- mitigated by batching queries via RPC functions and using fire-and-forget for analytics writes; (3) the existing `getConfig()` per-request overhead multiplying with new routes -- mitigated by refactoring to a single batch query early. SSE on Vercel is a known dead end (300s max function duration); Supabase Realtime covers the actual need at zero cost.

## Key Findings

### Recommended Stack

The existing stack handles v2 without replacement. Only additions are needed: 5 functional libraries, 8 Radix UI primitives, and Supabase Realtime (already bundled in the installed SDK). See [STACK.md](./STACK.md) for full rationale per dependency.

**New dependencies (runtime):**
- `@sentry/nextjs` (v10.39.0): Production error tracking across client, server, and edge runtimes
- `recharts` (v3.7.0): SVG-based React charts for the analytics dashboard -- native JSX API, SSR compatible
- `sonner` (v2.0.7): Toast notifications for action feedback -- 5KB, used by Vercel themselves
- `papaparse` (v5.5.3): CSV export via `unparse()` -- lightweight, handles edge cases (commas, unicode)
- `cmdk` (v1.1.1): Command palette for Cmd+K search -- built on Radix, accessible, 8KB
- 8 Radix UI primitives: select, dropdown-menu, tabs, tooltip, popover, switch, checkbox, context-menu

**Explicitly rejected:** Redux/Zustand (overkill for this scale), Prisma/Drizzle (Supabase client suffices), Chart.js (canvas-based, poor SSR), Socket.io/Pusher (Supabase Realtime already included), react-hook-form (existing FormData pattern is consistent).

**Key stack decision -- Supabase Realtime over custom SSE:** Custom SSE on Vercel Hobby has a 300-second ceiling and requires reconnection logic. Supabase Realtime uses WebSockets via Supabase's own infrastructure, bypasses Vercel's limits entirely, handles reconnection automatically, and is already installed. It covers status changes, assignment updates, new notes, and label changes. WhatsApp messages still come via polling (Kapso is the source of truth, and push from Kapso is not available).

### Expected Features

Feature research validated 14 features against WATI, Respond.io, Trengo, SleekFlow, and WhatsApp Business App. See [FEATURES.md](./FEATURES.md) for competitor analysis per feature.

**Table stakes (must build -- team will feel the product is a prototype without these):**
- Canned responses / quick replies -- highest daily ROI; eliminates repetitive typing of pricing, hours, aftercare
- Conversation status (open/pending/resolved) -- basic workflow management, universal in shared inboxes
- Sound notifications for all messages -- agents miss messages without audio cues
- Internal notes -- team knowledge sharing per conversation ("prefers balayage," "sensitive scalp")
- Contact profiles + labels/tags -- customer intelligence, service-based segmentation
- Error tracking (Sentry) -- production visibility; errors are currently invisible

**Differentiators (valuable, build after table stakes):**
- Conversation assignment -- manual assignment with "unassigned" default view; auto-assignment deferred
- User management UI -- admin page for invite/deactivate; currently requires Supabase dashboard
- RBAC (admin/agent) -- two roles, enforced at DB level via RLS
- Message search -- depends on Kapso API capabilities (unverified)
- Analytics dashboard -- operational metrics (volume, response time, resolution rate)
- Conversation export -- CSV download for records

**Anti-features (explicitly do NOT build):**
- Auto-assignment rules engine, workflow automation builder, multi-channel support, full CRM/sales pipeline, booking widget, chat ratings/CSAT, AI response suggestions

### Architecture Approach

v2 follows the same additive-layer principle as v1. New features integrate through new Supabase tables, new API routes, modified existing components, and enhanced middleware. The existing Kapso proxy pattern (API routes -> getConfig() -> WhatsAppClient -> Kapso API) remains completely unchanged. See [ARCHITECTURE.md](./ARCHITECTURE.md) for complete schema SQL, API route inventory, and component diagrams.

**Major architectural components:**

1. **6 new Supabase tables** -- `user_profiles`, `canned_responses`, `conversation_notes`, `conversation_metadata`, `contact_profiles`, `analytics_events`. All with RLS policies. All keyed by Kapso conversation IDs or phone numbers to bridge the two data stores.

2. **Server-side data merge** -- The `/api/conversations` route will fetch from Kapso, then enrich with local metadata (status, assignment, tags) from `conversation_metadata` before returning to the client. Single response, single loading state. Client stays simple.

3. **Hybrid real-time** -- Polling stays for Kapso data (5-10s intervals, unchanged). Supabase Realtime added for local data changes (status, assignment, notes). Two data channels, unified in the UI.

4. **Query-based RBAC** -- Simple `user_profiles.role` check via a `requireAdmin()` helper, NOT JWT custom claims. For 2-3 users, one extra DB query per request is negligible. Avoids auth hook complexity and re-login requirements on role change.

5. **Server-side analytics logging** -- Events logged in API routes (not client-side), fire-and-forget pattern using `waitUntil()`. Dashboard reads from aggregate queries or materialized views.

### Critical Pitfalls

See [PITFALLS.md](./PITFALLS.md) for all 15 identified pitfalls with detailed prevention strategies.

1. **RBAC privilege escalation** (Critical) -- If `user_profiles` has an UPDATE policy allowing users to edit their own row AND contains a `role` column, users can self-promote to admin. Prevention: RLS policies must exclude the `role` column from user self-updates, or use a separate `user_roles` table.

2. **SSE on Vercel = 300-second ceiling** (Critical) -- SSE connections die every 5 minutes on Hobby plan. Prevention: Use Supabase Realtime instead of custom SSE. Keep polling for Kapso data.

3. **`getConfig()` query multiplication** (Critical) -- Currently makes 4 individual DB queries per Kapso-related request. Adding features multiplies this. Prevention: Refactor to `getConfigs()` (batch query) before adding new routes.

4. **Supabase free tier connection pressure** (Critical) -- 6 new tables + more queries per request + 2-3 concurrent agents. Prevention: Use Supabase JS client (REST, not direct Postgres), batch reads via RPC functions, fire-and-forget analytics writes.

5. **Internal notes leaking to customers** (Moderate) -- If notes share a table or query path with messages, a bug could send a note to the customer via WhatsApp. Prevention: Separate table, separate API routes, physical isolation from message-sending code.

## Implications for Roadmap

Based on combined research, the following 8-phase structure respects dependency chains, front-loads productivity gains, and isolates risk.

### Phase 1: Foundation (RBAC + User Profiles + Config Refactor)
**Rationale:** Every subsequent feature needs `user_profiles` (for `created_by`, `assigned_to`, role checks). The `getConfig()` batch refactor prevents query multiplication as new routes are added. This is invisible to end users but unblocks everything.
**Delivers:** `user_profiles` table with auto-create trigger, `requireAuth()`/`requireAdmin()` helpers, `getConfigs()` batch function, RLS policies.
**Addresses:** RBAC (from FEATURES), getConfig multiplication (from PITFALLS)
**Avoids:** Pitfall 2 (privilege escalation), Pitfall 4 (config query overhead)
**Stack:** No new npm packages. Supabase schema + TypeScript only.

### Phase 2: Canned Responses
**Rationale:** Highest daily ROI for the beauty shop team. Eliminates repetitive typing (pricing, hours, aftercare). Independent of conversation features -- can ship and deliver value immediately.
**Delivers:** `canned_responses` table, CRUD API routes, slash-command picker in message input, management page.
**Addresses:** Canned responses (P0 from FEATURES)
**Avoids:** Pitfall 8 (ownership confusion -- schema designed for both personal and shared from day one)
**Stack:** `@radix-ui/react-popover` for the picker dropdown, `sonner` for action feedback toasts.

### Phase 3: Conversation Management (Status + Assignment + Tags)
**Rationale:** This is the core workflow upgrade -- transforms the inbox from a message viewer into a ticket system. Status, assignment, and tags share the `conversation_metadata` table and modify the same components (ConversationList, MessageView header).
**Delivers:** `conversation_metadata` table with status/assignment/tags, server-side merge in `/api/conversations`, filter controls, status tabs, assignment dropdown, tag picker.
**Addresses:** Conversation status (P0), conversation assignment (P2), customer labels (P1) from FEATURES
**Avoids:** Pitfall 9 (unassigned conversations invisible -- default view is "Unassigned + Mine"), Pitfall 11 (labels schema -- using `text[]` with GIN index on `conversation_metadata`, plus a `labels` master list for consistency)
**Stack:** `@radix-ui/react-select`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-checkbox`, `@radix-ui/react-tooltip`.

### Phase 4: Customer Intelligence (Contact Profiles + Internal Notes)
**Rationale:** Builds on Phase 3's conversation metadata. Contact profiles enrich the conversation list with customer context. Notes add team knowledge to individual conversations. Both appear in panels alongside the message view.
**Delivers:** `contact_profiles` table, `conversation_notes` table, contact detail panel, notes panel, contacts browse page.
**Addresses:** Contact profiles (P1), internal notes (P1), customer labels (shared tag system) from FEATURES
**Avoids:** Pitfall 10 (notes leaking -- separate table, separate API, no shared query path with message sending), Pitfall 14 (stale contact data -- Kapso name is primary, local profile is supplementary)
**Stack:** `@radix-ui/react-tabs` for contact profile sections.

### Phase 5: Sound Notifications + Real-Time Updates
**Rationale:** With conversation metadata and notes in Supabase, Realtime subscriptions make multi-agent collaboration instant. Sound notifications extend the existing handoff audio pattern to all new messages. These are infrastructure improvements that make all prior features feel more responsive.
**Delivers:** Supabase Realtime subscriptions for `conversation_metadata` and `conversation_notes`, generalized message alert hook, notification preference settings.
**Addresses:** Sound notifications (P0), real-time via SSE (reframed as Supabase Realtime) from FEATURES
**Avoids:** Pitfall 1 (SSE on Vercel -- using Supabase Realtime instead), Pitfall 13 (browser autoplay -- reusing existing AudioContext)
**Stack:** `@radix-ui/react-switch` for notification toggles. No new real-time dependencies (Supabase Realtime already in SDK).

### Phase 6: Analytics + Export
**Rationale:** Analytics becomes meaningful only after status/assignment data has accumulated from Phases 3-5. Export is low complexity and bundles naturally. Both are admin-only features.
**Delivers:** `analytics_events` table, server-side event logging in existing send/resolve routes, analytics dashboard page with charts, CSV conversation export.
**Addresses:** Analytics dashboard (P3), conversation export (P3) from FEATURES
**Avoids:** Pitfall 7 (analytics blocking requests -- `waitUntil()` for fire-and-forget writes), Pitfall 12 (export timeout -- date range limits, client-side generation)
**Stack:** `recharts` for charts, `papaparse` for CSV export.

### Phase 7: Message Search
**Rationale:** Placed late because feasibility depends on an unresolved question: does Kapso's API support message search? If yes, this is medium complexity. If no, it requires a local message cache -- a significant architectural change that may warrant deferral to v3.
**Delivers:** Global search dialog (Cmd+K), conversation/contact search (from local data), message content search (if Kapso supports it).
**Addresses:** Message search (P3) from FEATURES
**Avoids:** Pitfall 6 (full table scans -- proper indexes at table creation time)
**Stack:** `cmdk` for the command palette.

### Phase 8: Error Tracking (Sentry) + User Management UI
**Rationale:** Sentry is independent and can ship anytime, but is placed here because the team currently operates without error visibility and has survived. User management UI is low urgency (2-3 person team, rare user changes). Both are "product completeness" features.
**Delivers:** Sentry integration (client + server + edge), `global-error.tsx`, user management admin page (invite, deactivate, role change).
**Addresses:** Error tracking (P1), user management (P2) from FEATURES
**Avoids:** Pitfall 5 (Sentry config -- use wizard, all three config files from the start), Pitfall 3 (Supabase overload -- Sentry is external, no DB impact; user management uses existing `user_profiles` table)
**Stack:** `@sentry/nextjs`.

### Phase Ordering Rationale

- **Foundation first** because every feature references `user_profiles` and the config refactor prevents compounding DB overhead.
- **Canned responses before conversation management** because it delivers standalone value with zero dependency on other new features -- the team benefits immediately.
- **Status/assignment/tags grouped** because they share the `conversation_metadata` table and modify the same UI surfaces (conversation list, message view header).
- **Contact profiles + notes after conversation management** because the contact panel makes more sense when conversations already have status and tags.
- **Real-time after metadata tables exist** because Supabase Realtime subscribes to table changes -- the tables must exist first.
- **Analytics late** because it aggregates data from earlier phases -- needs status/assignment/event data to be meaningful.
- **Search near the end** because its feasibility is uncertain (Kapso API question).
- **Sentry + user management last** because they are operationally useful but not team-productivity features.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Foundation):** RBAC RLS policy design needs careful testing -- deploy incrementally, test from Supabase Table Editor (not SQL Editor which bypasses RLS). See Pitfall 15.
- **Phase 3 (Conversation Management):** Server-side merge pattern (Kapso + Supabase) is the most architecturally novel piece. Verify the Kapso conversation response shape to design the merge correctly.
- **Phase 7 (Message Search):** Kapso API search capability is UNVERIFIED. Must investigate before planning this phase. If unavailable, descope to contact/conversation search only.

Phases with standard patterns (skip deep research):
- **Phase 2 (Canned Responses):** Standard CRUD feature, well-documented patterns, no external dependencies.
- **Phase 4 (Contact Profiles + Notes):** Standard CRUD + panel UI. No novel architecture.
- **Phase 5 (Notifications + Realtime):** Supabase Realtime is well-documented. Sound notifications extend existing proven code.
- **Phase 6 (Analytics + Export):** recharts and papaparse are well-documented. Event logging is a standard append-only pattern.
- **Phase 8 (Sentry + User Management):** Sentry wizard auto-generates configs. User management is standard Supabase Auth admin API usage.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All package versions verified on npm (2026-02-21). Recharts v3.7.0, Sentry v10.39.0, sonner v2.0.7 confirmed active. Rejections well-reasoned. |
| Features | HIGH | Validated against 7+ competitors (WATI, Respond.io, Trengo, SleekFlow, WhatsApp Business App). Priority ordering grounded in beauty shop workflow analysis. |
| Architecture | HIGH | Based on direct codebase inspection (every file inventoried). Schema designs include complete SQL with RLS policies. Data flow diagrams verified against existing code. |
| Pitfalls | HIGH | 15 pitfalls identified. Critical ones verified against official docs (Vercel function limits, Supabase RBAC, connection management). Code-level pitfalls (getConfig) verified from source. |

**Overall confidence:** HIGH

The research is thorough and internally consistent across all four dimensions. The one significant gap is Kapso API search capability, which affects only Phase 7 (message search).

### Gaps to Address

- **Kapso API search capability:** Does the Kapso SDK or API support filtering/searching message content? This determines whether Phase 7 is medium complexity (API proxy) or high complexity (local message cache). Must investigate before planning Phase 7.
- **Supabase Auth admin API from server routes:** User management (Phase 8) requires `supabase.auth.admin.createUser()` and similar calls. These need the service role key. Verify this works from Next.js API routes on Vercel (likely yes, but needs confirmation).
- **Kapso webhook/callback support:** If Kapso supports webhooks for new messages, polling could eventually be replaced entirely. Not needed for v2 but worth investigating for future optimization.
- **Actual daily message volume:** Analytics design assumptions are based on ~50-100 messages/day. If volume is significantly higher, materialized views and data retention become more urgent.

## Sources

### Primary (HIGH confidence)
- [Sentry Next.js Setup Guide](https://docs.sentry.io/platforms/javascript/guides/nextjs/) -- config requirements, App Router instrumentation
- [Supabase RBAC Docs](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) -- custom claims, auth hooks
- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime/postgres-changes) -- postgres changes, limits
- [Supabase RLS Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) -- policy syntax, enable behavior
- [Vercel Functions Duration](https://vercel.com/docs/functions/configuring-functions/duration) -- 300s max Hobby with Fluid Compute
- [Supabase Connection Management](https://supabase.com/docs/guides/database/connection-management) -- pooling limits, free tier
- Existing codebase inspection -- every file inventoried and analyzed

### Secondary (MEDIUM confidence)
- [WATI Review (Chatimize)](https://chatimize.com/reviews/wati/) -- competitor feature set
- [Respond.io Team Inbox](https://respond.io/team-inbox) -- competitor feature set
- [Trengo WhatsApp Guide](https://trengo.com/blog/whatsapp-team-inbox) -- competitor feature set
- [recharts npm](https://www.npmjs.com/package/recharts) -- v3.7.0 verified
- [sonner npm](https://www.npmjs.com/package/sonner) -- v2.0.7 verified
- [cmdk npm](https://www.npmjs.com/package/cmdk) -- v1.1.1 verified
- [papaparse npm](https://www.npmjs.com/package/papaparse) -- v5.5.3 verified

### Tertiary (LOW confidence)
- Kapso API search capabilities -- UNVERIFIED, assumed unavailable until confirmed
- Actual message volume data -- estimated at 50-100/day based on beauty shop norms

---
*Research completed: 2026-02-21*
*Ready for roadmap: yes*
