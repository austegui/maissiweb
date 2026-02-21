# Maissi Beauty Shop — WhatsApp Inbox

## What This Is

A commercial-grade WhatsApp Cloud Inbox for Maissi Beauty Shop, built on top of the open-source Kapso WhatsApp Cloud Inbox. It gives the Maissi team a web-based dashboard to manage customer WhatsApp conversations with team coordination features, canned responses, contact management, and analytics. Deployed on Vercel with Supabase backend.

## Core Value

The team can send and receive WhatsApp messages through a shared web inbox without anyone needing to touch code or config files.

## Current Milestone: v2.0 Commercial-Grade Features

**Goal:** Transform the MVP inbox into a production commercial-level tool with team coordination, efficiency features, and operational visibility.

**Target features:**
- Canned responses for common replies
- Internal notes on conversations
- Conversation status tracking (open/resolved)
- User management from the UI
- Role-based access control (admin vs agent)
- Conversation assignment to team members
- Contact profiles with history
- Message search
- Basic analytics dashboard
- Sound notifications for all new messages
- Customer labels/tags
- Conversation export
- Error tracking (Sentry)
- Real-time updates via SSE

## Requirements

### Validated

- ✓ Clone and run Kapso WhatsApp Cloud Inbox — v1.0
- ✓ Admin settings UI to manage Kapso credentials — v1.0
- ✓ Individual user authentication via Supabase Auth — v1.0
- ✓ Maissi branding (name + logo in the UI) — v1.0
- ✓ Deploy to Vercel with Supabase backend — v1.0
- ✓ Settings persist across redeployments (database-backed) — v1.0
- ✓ All WhatsApp inbox features preserved — v1.0
- ✓ Handoff-to-human detection with alerts — v1.0
- ✓ Security hardening (input validation, CORS, headers) — v1.0
- ✓ Performance optimizations (polling backoff, smart re-renders) — v1.0

### Active

- [ ] Canned responses / quick replies library
- [ ] Internal notes on conversations
- [ ] Conversation status (open/resolved)
- [ ] User management from the UI (add/remove team members)
- [ ] RBAC (admin vs agent roles)
- [ ] Conversation assignment to team members
- [ ] Contact profiles (name, notes, tags, history)
- [ ] Message search
- [ ] Basic analytics dashboard
- [ ] Sound notifications for all new messages
- [ ] Customer labels/tags
- [ ] Conversation export
- [ ] Error tracking (Sentry)
- [ ] Real-time updates via SSE

### Out of Scope

- Multi-shop / multi-account support — single business only
- Direct Meta WhatsApp API integration — using Kapso as the API layer
- Mobile app — responsive web is sufficient
- Appointment reminders — not required
- Multi-tenancy / billing — internal tool
- WebSocket — SSE is simpler and sufficient

## Context

- **Base project:** [gokapso/whatsapp-cloud-inbox](https://github.com/gokapso/whatsapp-cloud-inbox) — Next.js App Router, TypeScript
- **Current state:** v1.0 complete — fully functional inbox with auth, settings, branding, handoff detection, security hardening
- **Database:** Supabase Postgres — currently `app_settings` table + auth.users. v2.0 will add several tables.
- **Team:** Owner (Gustavo) + 1-2 staff members at Maissi Beauty Shop
- **Target environment:** Vercel (frontend) + Supabase (database + auth)
- **Testing:** All testing via Vercel deployment, no local testing

## Constraints

- **Tech stack**: Next.js App Router / TypeScript — maintain compatibility with Kapso base
- **Database**: Supabase Postgres — free tier, adding new tables for v2.0 features
- **Deployment**: Vercel — free tier compatible
- **Team size**: 2-3 users initially, growing
- **API layer**: Kapso WhatsApp Cloud API — not direct Meta API
- **No local testing**: All verification via Vercel deployment

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fork Kapso inbox as base | Proven WhatsApp inbox UI, saves building from scratch | ✓ Good |
| Supabase for storage + auth | Free tier, Postgres, built-in auth, pairs well with Next.js/Vercel | ✓ Good |
| Admin settings UI over .env | Non-technical team needs to manage credentials without code access | ✓ Good |
| Individual logins over shared password | Team accountability, can revoke access per person | ✓ Good |
| Vercel deployment | Simple Next.js deployment, free tier sufficient for small team | ✓ Good |
| Polling with backoff over WebSockets | Simpler, works on Vercel serverless, sufficient for small team | ✓ Good |
| SSE for v2.0 real-time | Simpler than WebSocket, unidirectional server-to-client is sufficient | — Pending |
| Sentry for error tracking | Industry standard, free tier, Next.js integration | — Pending |

---
*Last updated: 2026-02-21 after v2.0 milestone start*
