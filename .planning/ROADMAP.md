# Roadmap: Maissi Beauty Shop -- WhatsApp Inbox

## Milestones

- v1.0 MVP -- Phases 1-6 (shipped 2026-02-21)
- v2.0 Commercial-Grade Features -- Phases 7-14 (in progress)

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

### v2.0 Commercial-Grade Features (In Progress)

**Milestone Goal:** Transform the MVP inbox into a production commercial-level tool with team coordination, efficiency features, and operational visibility.

**Phase Numbering:**
- Integer phases (7, 8, 9...): Planned milestone work
- Decimal phases (7.1, 7.2): Urgent insertions if needed (marked with INSERTED)

- [ ] **Phase 7: Foundation** - RBAC, user profiles, and config batch refactor to unblock all subsequent features
- [ ] **Phase 8: Canned Responses** - Quick reply library with slash-command picker for agent productivity
- [ ] **Phase 9: Conversation Management** - Status tracking, team assignment, and customer labels for workflow control
- [ ] **Phase 10: Customer Intelligence** - Contact profiles and internal notes for customer context and team knowledge
- [ ] **Phase 11: Notifications + Real-Time** - Sound alerts for all messages and Supabase Realtime for instant metadata sync
- [ ] **Phase 12: Analytics + Export** - Operational dashboard and CSV export for business visibility
- [ ] **Phase 13: Message Search** - Global search dialog for finding contacts, conversations, and messages
- [ ] **Phase 14: Error Tracking + User Management** - Sentry integration and admin UI for team member management

## Phase Details

### Phase 7: Foundation
**Goal**: The system enforces role-based access so admins and agents see different capabilities, and the database layer is optimized to handle the increased query load of v2 features
**Depends on**: Phase 6 (v1.0 complete)
**Requirements**: RBAC-01, RBAC-02, RBAC-03, RBAC-04, RBAC-05
**Success Criteria** (what must be TRUE):
  1. When a new user logs in for the first time, a user profile row is automatically created with the "agent" role
  2. An admin user can access the settings page; an agent user is blocked from accessing settings
  3. An agent user can view conversations and send messages but cannot see admin-only pages
  4. A user cannot change their own role (RLS prevents self-promotion)
  5. API routes that previously made 4 individual config queries now make a single batch query
**Plans**: TBD

### Phase 8: Canned Responses
**Goal**: Agents can instantly insert pre-written replies into conversations, eliminating repetitive typing of common responses like pricing, hours, and aftercare instructions
**Depends on**: Phase 7
**Requirements**: CANNED-01, CANNED-02, CANNED-03, CANNED-04, CANNED-05
**Success Criteria** (what must be TRUE):
  1. An admin can create a new canned response with a title, shortcut, and body text from a management page
  2. An agent typing `/` in the message input sees a filterable dropdown of available canned responses
  3. Selecting a canned response from the dropdown inserts its full text into the message input ready to send
  4. All agents see the same shared library of canned responses
  5. An admin can edit or delete any existing canned response
**Plans**: TBD

### Phase 9: Conversation Management
**Goal**: The inbox functions as a ticket system where conversations have a lifecycle status, can be assigned to specific agents, and can be categorized with labels for organized workflow
**Depends on**: Phase 7
**Requirements**: STATUS-01, STATUS-02, STATUS-03, STATUS-04, STATUS-05, ASSIGN-01, ASSIGN-02, ASSIGN-03, ASSIGN-04, LABEL-01, LABEL-02, LABEL-03, LABEL-04
**Success Criteria** (what must be TRUE):
  1. Each conversation displays a status (Open, Pending, or Resolved) and an agent can change it from the message view header
  2. The conversation list can be filtered by status via tabs or a dropdown, and status indicators are visually distinct
  3. When a customer sends a new message to a Resolved conversation, it automatically reopens to Open
  4. An agent can assign a conversation to a team member, and the assigned name is visible in the conversation list
  5. The conversation list can be filtered by "Mine", "Unassigned", or "All" assignments, and by customer label
**Plans**: TBD

### Phase 10: Customer Intelligence
**Goal**: Agents have persistent customer context and can share team knowledge about any conversation, so no information is lost between sessions or team members
**Depends on**: Phase 9
**Requirements**: CONTACT-01, CONTACT-02, CONTACT-03, CONTACT-04, NOTES-01, NOTES-02, NOTES-03, NOTES-04
**Success Criteria** (what must be TRUE):
  1. A contact profile is automatically created when a new phone number first appears, and the agent can edit the display name, email, and notes from a side panel
  2. A contact's full conversation history is accessible from their profile
  3. An agent can add a text note to any conversation, and it appears in a collapsible side panel with the author name and timestamp
  4. Internal notes are never sent to the customer -- they are physically separate from the message-sending code path
**Plans**: TBD

### Phase 11: Notifications + Real-Time
**Goal**: Agents never miss a new message thanks to sound and browser alerts, and all connected agents see status changes, assignments, and notes appear instantly without refreshing
**Depends on**: Phase 10
**Requirements**: NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, REALTIME-01, REALTIME-02, REALTIME-03
**Success Criteria** (what must be TRUE):
  1. An audio alert plays when any new inbound WhatsApp message arrives (not just handoffs), and the sound does not play for messages the agent themselves just sent
  2. A user can toggle sound notifications on or off via a preference setting
  3. A browser notification appears for new messages when the inbox tab is not focused
  4. When one agent changes a conversation's status or assignment, all other connected agents see the update appear without refreshing
  5. If the real-time connection drops, it automatically reconnects
**Plans**: TBD

### Phase 12: Analytics + Export
**Goal**: The admin has operational visibility into team performance through charts and metrics, and can export conversation data for record-keeping
**Depends on**: Phase 9
**Requirements**: ANALYTICS-01, ANALYTICS-02, ANALYTICS-03, ANALYTICS-04, EXPORT-01, EXPORT-02, EXPORT-03
**Success Criteria** (what must be TRUE):
  1. An admin can view a dashboard showing message volume over time as a daily/weekly chart
  2. The dashboard displays average response time and conversations resolved per day and per agent
  3. The analytics dashboard is admin-only -- agents cannot access it
  4. An admin can export conversation data as a CSV file, filtered by date range and conversation status
  5. The CSV export includes contact name, phone number, status, assigned agent, message count, and last active date
**Plans**: TBD

### Phase 13: Message Search
**Goal**: Any team member can quickly find a contact, conversation, or message from anywhere in the app using a keyboard-driven search dialog
**Depends on**: Phase 10
**Requirements**: SEARCH-01, SEARCH-02, SEARCH-03, SEARCH-04
**Success Criteria** (what must be TRUE):
  1. Pressing Cmd+K (or clicking a search icon) opens a global search dialog from any page
  2. Searching finds contacts by name and phone number
  3. Searching finds conversations by contact name, phone number, or label
  4. If Kapso API supports message content search, results include matching messages; if not, the UI gracefully shows only contact/conversation results
**Plans**: TBD

### Phase 14: Error Tracking + User Management
**Goal**: Production errors are automatically captured and reported for debugging, and the admin can manage team members directly from the app without touching the Supabase dashboard
**Depends on**: Phase 7
**Requirements**: SENTRY-01, SENTRY-02, SENTRY-03, USRMGMT-01, USRMGMT-02, USRMGMT-03, USRMGMT-04
**Success Criteria** (what must be TRUE):
  1. Unhandled errors in production (client-side, server-side, and edge runtime) are captured and visible in the Sentry dashboard
  2. When an unrecoverable error occurs, the user sees a friendly error page instead of a blank screen
  3. An admin can invite a new team member by email from a user management page
  4. An admin can deactivate a team member's account and change a team member's role (admin/agent)
  5. The user management page shows all team members with their current role and status
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 7 -> 8 -> 9 -> 10 -> 11 -> 12 -> 13 -> 14

Note: Phases 8, 9, 12, and 14 all depend on Phase 7 but not necessarily on each other. The linear order above is the recommended sequence based on research (dependency chains and productivity ROI). Phase 12 depends on Phase 9 data accumulation. Phase 13 depends on Phase 10 contact data.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Fork Setup | v1.0 | 3/3 | Complete | 2026-02-18 |
| 2. Authentication | v1.0 | 3/3 | Complete | 2026-02-18 |
| 3. Admin Settings | v1.0 | 3/3 | Complete | 2026-02-18 |
| 4. Config Migration | v1.0 | 2/2 | Complete | 2026-02-18 |
| 5. Branding | v1.0 | 1/1 | Complete | 2026-02-18 |
| 6. Deploy + Verify | v1.0 | 2/2 | Complete | 2026-02-21 |
| 7. Foundation | v2.0 | 0/TBD | Not started | - |
| 8. Canned Responses | v2.0 | 0/TBD | Not started | - |
| 9. Conversation Management | v2.0 | 0/TBD | Not started | - |
| 10. Customer Intelligence | v2.0 | 0/TBD | Not started | - |
| 11. Notifications + Real-Time | v2.0 | 0/TBD | Not started | - |
| 12. Analytics + Export | v2.0 | 0/TBD | Not started | - |
| 13. Message Search | v2.0 | 0/TBD | Not started | - |
| 14. Error Tracking + User Management | v2.0 | 0/TBD | Not started | - |
