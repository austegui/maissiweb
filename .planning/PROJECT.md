# Maissi Beauty Shop — WhatsApp Inbox

## What This Is

A customized WhatsApp Cloud Inbox for Maissi Beauty Shop, built on top of the open-source Kapso WhatsApp Cloud Inbox. It gives the Maissi team a web-based dashboard to manage customer WhatsApp conversations, with an admin settings UI for managing API credentials and individual logins for each team member. Deployed on Vercel.

## Core Value

The team can send and receive WhatsApp messages through a shared web inbox without anyone needing to touch code or config files.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Clone and run Kapso WhatsApp Cloud Inbox locally
- [ ] Admin settings UI to manage Kapso credentials (API key, Phone Number ID, WABA ID) stored in Supabase
- [ ] Individual user authentication (2-3 team members) via Supabase Auth
- [ ] Light Maissi branding (name + logo in the UI)
- [ ] Deploy to Vercel with Supabase backend
- [ ] Settings persist across redeployments (database-backed)
- [ ] All WhatsApp inbox features from Kapso preserved (messaging, templates, media, read receipts)

### Out of Scope

- Quick replies / canned responses — not needed for v1
- Customer labels/tags — not needed for v1
- Multi-shop / multi-account support — single business only
- Direct Meta WhatsApp API integration — using Kapso as the API layer
- Role-based permissions — all team members have equal access for now
- Custom UI redesign — minimal branding only

## Context

- **Base project:** [gokapso/whatsapp-cloud-inbox](https://github.com/gokapso/whatsapp-cloud-inbox) — Next.js/TypeScript WhatsApp inbox using Kapso's API
- **Current config approach:** `.env` file with `PHONE_NUMBER_ID`, `KAPSO_API_KEY`, `WABA_ID`, optional `WHATSAPP_API_URL`
- **Problem:** Credentials are managed via env vars / hardcoded — non-technical team members can't update them
- **Team:** Owner (Gustavo) + 1-2 staff members at Maissi Beauty Shop
- **Kapso credentials:** Already obtained and ready to use
- **Target environment:** Vercel (frontend) + Supabase (database + auth)

## Constraints

- **Tech stack**: Next.js/TypeScript (inherited from Kapso base) — maintain compatibility with upstream
- **Database**: Supabase — free tier, Postgres + built-in auth
- **Deployment**: Vercel — free tier compatible
- **Team size**: 2-3 users — no need for complex RBAC
- **API layer**: Kapso WhatsApp Cloud API — not direct Meta API

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fork Kapso inbox as base | Proven WhatsApp inbox UI, saves building from scratch | — Pending |
| Supabase for storage + auth | Free tier, Postgres, built-in auth, pairs well with Next.js/Vercel | — Pending |
| Admin settings UI over .env | Non-technical team needs to manage credentials without code access | — Pending |
| Individual logins over shared password | Team accountability, can revoke access per person | — Pending |
| Vercel deployment | Simple Next.js deployment, free tier sufficient for small team | — Pending |

---
*Last updated: 2026-02-17 after initialization*
