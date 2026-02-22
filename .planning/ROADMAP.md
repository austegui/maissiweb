# Roadmap: Maissi Beauty Shop -- WhatsApp Inbox

## Milestones

- v1.0 MVP -- Phases 1-6 (shipped 2026-02-21)
- v2.0 Commercial-Grade Features -- Phases 7-14 (shipped 2026-02-22)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-6) - SHIPPED 2026-02-21</summary>

### Phase 1: Fork Setup
**Goal**: The team has a runnable local copy of Kapso with the upstream remote configured and a full map of all code that must be touched in later phases
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md -- Pull Kapso source, install deps, configure env, verify app runs
- [x] 01-02-PLAN.md -- Audit router type, process.env reads, webhook path, API routes
- [x] 01-03-PLAN.md -- Verify upstream remote, create AUDIT.md, update STATE.md

### Phase 2: Authentication
**Goal**: Every team member can log in to the inbox with their own account, and nobody can access the inbox without authenticating
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md -- Install Supabase packages, create client utilities
- [x] 02-02-PLAN.md -- Create login page with email/password form, auth Server Actions, Next.js middleware
- [x] 02-03-PLAN.md -- Push to GitHub, verify auth flow on Vercel deployment

### Phase 3: Admin Settings
**Goal**: The admin can view and update WhatsApp API credentials through an in-app page without touching code or env files
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md -- Create getConfig() utility and /api/settings route handler
- [x] 03-02-PLAN.md -- Build /admin/settings page with Server Component, Server Action, and useActionState form
- [x] 03-03-PLAN.md -- Add Settings link to inbox header, push to GitHub, verify on Vercel

### Phase 4: Config Migration
**Goal**: All Kapso messaging features continue to work end-to-end after credentials are moved from env vars to the database
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md -- Refactor whatsapp-client.ts and all consumer routes to use async getConfig()
- [x] 04-02-PLAN.md -- Deploy to Vercel, remove env vars, verify full messaging flow

### Phase 5: Branding
**Goal**: The UI displays Maissi Beauty Shop's name and logo so the team recognizes the tool as theirs
**Plans**: 1 plan

Plans:
- [x] 05-01-PLAN.md -- Add Maissi logo, update header component and page title

### Phase 6: Deploy + Verify
**Goal**: The app is live on Vercel, team accounts work, and real WhatsApp send/receive is confirmed in production
**Plans**: 2 plans

Plans:
- [x] 06-01-PLAN.md -- Deploy to Vercel with correct Supabase environment variables
- [x] 06-02-PLAN.md -- Verify webhook with Meta, test end-to-end send/receive, confirm all team logins

</details>

<details>
<summary>v2.0 Commercial-Grade Features (Phases 7-14) - SHIPPED 2026-02-22</summary>

- [x] **Phase 7: Foundation** - RBAC, user profiles, and config batch refactor
- [x] **Phase 8: Canned Responses** - Quick reply library with slash-command picker
- [x] **Phase 9: Conversation Management** - Status tracking, team assignment, and customer labels
- [x] **Phase 10: Customer Intelligence** - Contact profiles and internal notes
- [x] **Phase 11: Notifications + Real-Time** - Sound alerts and Supabase Realtime sync
- [x] **Phase 12: Analytics + Export** - Dashboard and CSV export
- [x] **Phase 13: Error Tracking + User Management** - Error boundary and admin user management
- [x] **Phase 14: Audit Cleanup** - Bug fixes from milestone audit

Full details: `.planning/milestones/v2.0-ROADMAP.md`

</details>

## Backlog

- **Message Search** - Global search dialog for finding contacts, conversations, and messages (deferred from v2.0)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Fork Setup | v1.0 | 3/3 | Complete | 2026-02-18 |
| 2. Authentication | v1.0 | 3/3 | Complete | 2026-02-18 |
| 3. Admin Settings | v1.0 | 3/3 | Complete | 2026-02-18 |
| 4. Config Migration | v1.0 | 2/2 | Complete | 2026-02-18 |
| 5. Branding | v1.0 | 1/1 | Complete | 2026-02-18 |
| 6. Deploy + Verify | v1.0 | 2/2 | Complete | 2026-02-21 |
| 7. Foundation | v2.0 | 3/3 | Complete | 2026-02-22 |
| 8. Canned Responses | v2.0 | 3/3 | Complete | 2026-02-22 |
| 9. Conversation Management | v2.0 | 5/5 | Complete | 2026-02-22 |
| 10. Customer Intelligence | v2.0 | 3/3 | Complete | 2026-02-22 |
| 11. Notifications + Real-Time | v2.0 | 3/3 | Complete | 2026-02-22 |
| 12. Analytics + Export | v2.0 | 3/3 | Complete | 2026-02-22 |
| 13. Error Tracking + User Management | v2.0 | 2/2 | Complete | 2026-02-22 |
| 14. Audit Cleanup | v2.0 | 1/1 | Complete | 2026-02-22 |
