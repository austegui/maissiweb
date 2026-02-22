# Maissi Beauty Shop — WhatsApp Inbox

## What This Is

A commercial-grade WhatsApp Cloud Inbox for Maissi Beauty Shop, built on top of the open-source Kapso WhatsApp Cloud Inbox. It gives the Maissi team a web-based dashboard to manage customer WhatsApp conversations with role-based access control, canned responses, conversation lifecycle management, contact profiles, internal notes, real-time updates, analytics, and team management. Deployed on Vercel with Supabase backend.

## Core Value

The team can send and receive WhatsApp messages through a shared web inbox without anyone needing to touch code or config files.

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
- ✓ Role-based access control (admin vs agent) with RLS enforcement — v2.0
- ✓ Canned responses with slash-command picker — v2.0
- ✓ Conversation status lifecycle (open/pending/resolved + auto-reopen) — v2.0
- ✓ Conversation assignment to team members — v2.0
- ✓ Customer labels/tags with color coding — v2.0
- ✓ Contact profiles with editable fields and conversation history — v2.0
- ✓ Internal notes on conversations (team-only, never sent to customer) — v2.0
- ✓ Sound and browser notifications for all new messages — v2.0
- ✓ Supabase Realtime for instant metadata sync across agents — v2.0
- ✓ Analytics dashboard with charts, KPIs, and agent stats — v2.0
- ✓ Conversation export to CSV with date/status filters — v2.0
- ✓ Global error boundary with user-friendly error page — v2.0
- ✓ User management (invite, deactivate, role change) from admin UI — v2.0

### Active

(None -- planning next milestone)

### Out of Scope

- Multi-shop / multi-account support — single business only
- Direct Meta WhatsApp API integration — using Kapso as the API layer
- Mobile app — responsive web is sufficient
- Appointment reminders — not required
- Multi-tenancy / billing — internal tool
- Auto-assignment rules — manual assignment is sufficient for 2-3 agents
- Workflow automation builder — over-engineered for team size
- AI response suggestions — not requested
- Chat ratings / CSAT — not needed for internal tool
- Booking widget — not a customer-facing tool
- Multi-channel (Instagram, email) — WhatsApp only
- Full Sentry SDK integration — error boundary provides crash page coverage; full APM deferred

## Context

- **Base project:** [gokapso/whatsapp-cloud-inbox](https://github.com/gokapso/whatsapp-cloud-inbox) — Next.js App Router, TypeScript
- **Current state:** v2.0 complete — commercial-grade inbox with RBAC, canned responses, conversation management, contact profiles, notes, real-time sync, analytics, export, error boundary, and user management
- **Codebase:** ~8,474 LOC across 45 files, TypeScript/React
- **Database:** Supabase Postgres — tables: app_settings, user_profiles, canned_responses, conversation_metadata, contact_labels, conversation_contact_labels, contacts, conversation_notes + 2 RPC functions
- **Team:** Owner (Gustavo) + 1-2 staff members at Maissi Beauty Shop
- **Target environment:** Vercel (frontend) + Supabase (database + auth + Realtime)
- **Testing:** All testing via Vercel deployment, no local testing

## Constraints

- **Tech stack**: Next.js App Router / TypeScript — maintain compatibility with Kapso base
- **Database**: Supabase Postgres — free tier, 8 custom tables + RLS policies
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
| Supabase Realtime over custom SSE | Vercel 300s ceiling makes SSE unviable; Realtime is managed, reliable | ✓ Good |
| Query-based RBAC over JWT claims | Simpler, no token refresh needed, user_profiles.role column | ✓ Good |
| getConfigs() batch refactor | Prevents query multiplication as routes grow; backward-compatible | ✓ Good |
| cmdk for slash-command picker | Lightweight, accessible, no own Input needed (uses message textarea) | ✓ Good |
| Server Actions for label CRUD | Simpler than REST routes for admin-only operations | ✓ Good |
| Supabase Realtime single channel | 4 .on() handlers on 1 channel reduces WebSocket overhead | ✓ Good |
| Re-SELECT after UPDATE pattern | Consistent response shapes across GET/PATCH for UI state updates | ✓ Good |
| ban_duration for user deactivation | No data deletion, reversible via 'none' reactivation | ✓ Good |
| Recharts 3.7.0 for analytics | React 19 peer dep supported, responsive charts with minimal config | ✓ Good |

---
*Last updated: 2026-02-22 after v2.0 milestone*
