# Roadmap: Maissi Beauty Shop — WhatsApp Inbox

## Overview

Starting from the open-source Kapso WhatsApp Cloud Inbox, this roadmap adds three layers on top: individual user authentication via Supabase Auth, an admin UI for managing API credentials stored in Supabase Postgres, and a config resolver that replaces hardcoded process.env reads with database-backed credentials. The result is a working WhatsApp shared inbox that non-technical team members can operate and configure without touching code, deployed on Vercel.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Fork Setup** - Clone, audit, and configure the Kapso upstream base
- [ ] **Phase 2: Authentication** - Supabase project, login page, and route protection middleware
- [ ] **Phase 3: Admin Settings** - Credentials UI and Supabase Postgres storage
- [ ] **Phase 4: Config Migration** - Replace process.env reads with DB-backed getConfig()
- [ ] **Phase 5: Branding** - Maissi name and logo in the UI
- [ ] **Phase 6: Deploy + Verify** - Vercel deployment and end-to-end production verification

## Phase Details

### Phase 1: Fork Setup
**Goal**: The team has a runnable local copy of Kapso with the upstream remote configured and a full map of all code that must be touched in later phases
**Depends on**: Nothing (first phase)
**Requirements**: FORK-01, FORK-02, FORK-03
**Success Criteria** (what must be TRUE):
  1. The app runs locally and the WhatsApp inbox UI loads in the browser
  2. The router type (App Router vs Pages Router) is documented — no architecture decisions are conditional after this point
  3. Every file that reads PHONE_NUMBER_ID, KAPSO_API_KEY, or WABA_ID from process.env is listed with line numbers
  4. The webhook endpoint path is confirmed and documented
  5. The gokapso/whatsapp-cloud-inbox repo is set as the upstream git remote
**Plans**: TBD

Plans:
- [ ] 01-01: Clone repo, install dependencies, configure local env, verify app runs
- [ ] 01-02: Audit router type, process.env reads, webhook path, and API route structure
- [ ] 01-03: Add upstream remote and document audit findings

### Phase 2: Authentication
**Goal**: Every team member can log in to the inbox with their own account, and nobody can access the inbox without authenticating
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03
**Success Criteria** (what must be TRUE):
  1. A team member can create an account and log in with email and password
  2. Visiting any inbox page without being logged in redirects to /login
  3. After logging in, the user stays logged in across browser sessions (session persists on refresh)
  4. The WhatsApp webhook endpoint accepts POST requests without authentication (incoming messages are not blocked)
  5. A logged-in user can log out and is redirected to /login
**Plans**: TBD

Plans:
- [ ] 02-01: Create Supabase project, configure auth, create app_settings table with RLS, set env vars
- [ ] 02-02: Build login page with email/password form and Supabase session handling
- [ ] 02-03: Write Next.js middleware to protect all routes, whitelist /login and webhook endpoint

### Phase 3: Admin Settings
**Goal**: The admin can view and update WhatsApp API credentials through an in-app page without touching code or env files
**Depends on**: Phase 2
**Requirements**: SETTINGS-01, SETTINGS-02, SETTINGS-03
**Success Criteria** (what must be TRUE):
  1. The admin can navigate to a settings page and see the current credential values (API key shown as last-4 only)
  2. The admin can update any credential value through a form and the change saves successfully
  3. Credentials are visible in the Supabase Postgres table after saving (persistent storage confirmed)
  4. Redeploying the app to Vercel does not reset any credential values
  5. All Kapso API routes call getConfig() to resolve credentials — no route reads credentials directly from process.env
**Plans**: TBD

Plans:
- [ ] 03-01: Create getConfig() utility that reads from Supabase Postgres with process.env fallback
- [ ] 03-02: Build /api/settings server route for authenticated read/write of app_settings table
- [ ] 03-03: Build /admin/settings page with Server Component fetch and client-side form (React Hook Form + Zod)

### Phase 4: Config Migration
**Goal**: All Kapso messaging features continue to work end-to-end after credentials are moved from env vars to the database
**Depends on**: Phase 3
**Requirements**: PRESERVE-01
**Success Criteria** (what must be TRUE):
  1. A user can send a WhatsApp message from the inbox and the recipient receives it
  2. An incoming WhatsApp message appears in the inbox without manual refresh (or with polling, as the base app does it)
  3. Template messages, media attachments, and read receipts work the same as in the unmodified Kapso base
  4. Removing PHONE_NUMBER_ID, KAPSO_API_KEY, and WABA_ID from Vercel env vars does not break messaging (DB is the sole credential source)
**Plans**: TBD

Plans:
- [ ] 04-01: Replace all identified process.env reads in Kapso API routes with getConfig() calls
- [ ] 04-02: Test full messaging flow locally with credentials loaded from DB only (env vars unset)

### Phase 5: Branding
**Goal**: The UI displays Maissi Beauty Shop's name and logo so the team recognizes the tool as theirs
**Depends on**: Phase 4
**Requirements**: BRAND-01
**Success Criteria** (what must be TRUE):
  1. The Maissi Beauty Shop name appears in the app header on every page
  2. The Maissi logo appears in the app header on every page
  3. The browser tab title reflects Maissi Beauty Shop (not a generic Kapso label)
**Plans**: TBD

Plans:
- [ ] 05-01: Add Maissi logo to /public/, update header component and page title with Maissi name and logo

### Phase 6: Deploy + Verify
**Goal**: The app is live on Vercel, team accounts work, and real WhatsApp send/receive is confirmed in production
**Depends on**: Phase 5
**Requirements**: DEPLOY-01, DEPLOY-02
**Success Criteria** (what must be TRUE):
  1. The app is accessible at a Vercel URL and requires login
  2. The Meta webhook challenge handshake succeeds (Vercel URL verified in Meta dashboard)
  3. A real WhatsApp message sent to the business number appears in the production inbox
  4. A message sent from the production inbox is received by the target WhatsApp number
  5. All 2-3 team member accounts can log in to the production app
**Plans**: TBD

Plans:
- [ ] 06-01: Deploy to Vercel with correct Supabase environment variables, populate DB credentials via settings UI
- [ ] 06-02: Verify webhook with Meta, test end-to-end send/receive, confirm all team logins

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Fork Setup | 0/3 | Not started | - |
| 2. Authentication | 0/3 | Not started | - |
| 3. Admin Settings | 0/3 | Not started | - |
| 4. Config Migration | 0/2 | Not started | - |
| 5. Branding | 0/1 | Not started | - |
| 6. Deploy + Verify | 0/2 | Not started | - |
