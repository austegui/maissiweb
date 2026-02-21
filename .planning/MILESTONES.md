# Milestones

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
