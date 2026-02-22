# Milestones

## v2.0 — Commercial-Grade Features

**Completed:** 2026-02-22
**Phases:** 7-14 (8 phases, 23 plans)

**What shipped:**
- Role-based access control with admin/agent roles enforced by Supabase RLS, admin layout guard, and per-route role checks
- Canned responses library with slash-command picker (cmdk) for instant reply insertion from the message input
- Full conversation lifecycle management: status tracking (open/pending/resolved), team assignment, customer labels, auto-reopen on new inbound messages
- Contact profiles with editable fields, conversation history, and internal team notes (physically separated from message-sending code)
- Sound and browser notifications for all new messages with Supabase Realtime for instant metadata sync across all connected agents
- Analytics dashboard with Recharts charts, KPI cards, agent stats table, and CSV export with date/status filters
- Global error boundary with user-friendly error page
- User management (invite, deactivate, role change) from admin UI

**Requirements delivered:**
- RBAC-01 through RBAC-05
- CANNED-01 through CANNED-05
- STATUS-01 through STATUS-05
- ASSIGN-01 through ASSIGN-04
- LABEL-01 through LABEL-04
- CONTACT-01 through CONTACT-04
- NOTES-01 through NOTES-04
- NOTIF-01 through NOTIF-04
- REALTIME-01 through REALTIME-03
- ANALYTICS-01 through ANALYTICS-04
- EXPORT-01 through EXPORT-03
- SENTRY-03
- USRMGMT-01 through USRMGMT-04

**Descoped:** SENTRY-01, SENTRY-02 (full Sentry integration — revisit in future milestone)
**Deferred:** SEARCH-01 through SEARCH-04 (message search — moved to backlog)

**Last phase number:** 14

---

## v1.0 — WhatsApp Inbox MVP

**Completed:** 2026-02-21
**Phases:** 1-6 (6 phases, 13 plans)

**What shipped:**
- Forked Kapso WhatsApp Cloud Inbox as base
- Supabase Auth (email/password, route protection middleware)
- Admin settings UI (API credentials stored in Supabase Postgres)
- Config migration (all routes use getConfig() from DB, not process.env)
- Maissi Beauty Shop branding (logo, favicon, title)
- Deployed to Vercel with full messaging: text, media, templates, interactive buttons, 24-hour window enforcement
- Handoff-to-human detection with audio + browser notification alerts
- Security hardening: input validation, CORS, security headers, auth on media endpoint
- Performance: polling backoff, smart re-renders, search debounce, error boundary, lazy loading

**Requirements delivered:**
- FORK-01, FORK-02, FORK-03
- AUTH-01, AUTH-02, AUTH-03
- SETTINGS-01, SETTINGS-02, SETTINGS-03
- PRESERVE-01
- BRAND-01
- DEPLOY-01, DEPLOY-02

**Last phase number:** 6
