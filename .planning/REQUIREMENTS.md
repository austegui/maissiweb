# Requirements — Maissi Beauty Shop WhatsApp Inbox

**Version:** v2.0 Commercial-Grade Features
**Created:** 2026-02-21
**Status:** Active
**Core Value:** The team can send and receive WhatsApp messages through a shared web inbox without anyone needing to touch code or config files.

---

## v2.0 Requirements

### Foundation & RBAC

- [ ] **RBAC-01**: User profiles table auto-created on first login with default "agent" role
- [ ] **RBAC-02**: Two roles exist — admin and agent — enforced by RLS policies in Supabase
- [ ] **RBAC-03**: Only admin users can access the settings page and user management
- [ ] **RBAC-04**: Agent users can view conversations, send messages, manage notes, but cannot change settings or manage users
- [ ] **RBAC-05**: getConfig() refactored to batch query (getConfigs()) to prevent query multiplication

### Canned Responses

- [ ] **CANNED-01**: Team can create, edit, and delete saved text responses with a title and shortcut
- [ ] **CANNED-02**: Typing `/` in the message input shows a filterable dropdown of canned responses
- [ ] **CANNED-03**: Selecting a canned response inserts its text into the message input
- [ ] **CANNED-04**: Canned responses are team-shared (visible to all agents)
- [ ] **CANNED-05**: Admin page or section for managing the canned responses library

### Conversation Status

- [ ] **STATUS-01**: Each conversation has a status: Open, Pending, or Resolved
- [ ] **STATUS-02**: Agent can change conversation status via a control in the message view header
- [ ] **STATUS-03**: Conversation list is filterable by status (tabs or dropdown in sidebar)
- [ ] **STATUS-04**: When a customer sends a new message to a Resolved conversation, it auto-reopens to Open
- [ ] **STATUS-05**: Status indicators are visually distinct in the conversation list

### Internal Notes

- [ ] **NOTES-01**: Agent can add text notes to any conversation, visible only to the team
- [ ] **NOTES-02**: Notes are displayed in a collapsible side panel alongside the message view
- [ ] **NOTES-03**: Each note shows author name and timestamp
- [ ] **NOTES-04**: Notes are never sent to the customer (physically separate from message-sending code)

### Conversation Assignment

- [ ] **ASSIGN-01**: Admin or agent can assign a conversation to a specific team member
- [ ] **ASSIGN-02**: Conversation list can be filtered by "Mine", "Unassigned", or "All"
- [ ] **ASSIGN-03**: Assigned agent name or avatar is visible in the conversation list item
- [ ] **ASSIGN-04**: Unassigned conversations are visible to all agents by default

### Contact Profiles

- [ ] **CONTACT-01**: A contact profile is auto-created in Supabase when a new phone number first appears
- [ ] **CONTACT-02**: Agent can view and edit contact details (display name, email, notes) in a side panel
- [ ] **CONTACT-03**: Contact profile panel is accessible from the message view
- [ ] **CONTACT-04**: Contact's conversation history is visible from their profile

### Customer Labels/Tags

- [ ] **LABEL-01**: Admin can create, edit, and delete colored labels/tags (e.g., VIP, New Client, Balayage)
- [ ] **LABEL-02**: Agent can attach one or more labels to a contact
- [ ] **LABEL-03**: Conversation list can be filtered by contact label
- [ ] **LABEL-04**: Labels are displayed on conversation list items and contact profiles

### Message Search

- [ ] **SEARCH-01**: Global search accessible via Cmd+K (or a search icon in the header)
- [ ] **SEARCH-02**: Search finds contacts by name and phone number
- [ ] **SEARCH-03**: Search finds conversations by contact name, phone number, or label
- [ ] **SEARCH-04**: Message content search if Kapso API supports it (degrade gracefully if not)

### Analytics Dashboard

- [ ] **ANALYTICS-01**: Admin can view a dashboard showing message volume over time (daily/weekly chart)
- [ ] **ANALYTICS-02**: Dashboard shows average response time
- [ ] **ANALYTICS-03**: Dashboard shows conversations resolved per day and per agent
- [ ] **ANALYTICS-04**: Dashboard is admin-only (agents cannot access)

### Sound Notifications

- [ ] **NOTIF-01**: Audio alert plays when any new inbound message arrives (not just handoffs)
- [ ] **NOTIF-02**: User can toggle sound notifications on/off via a preference setting
- [ ] **NOTIF-03**: Browser notification shown for new messages when tab is not focused
- [ ] **NOTIF-04**: Sound does not play for messages the agent themselves just sent

### Conversation Export

- [ ] **EXPORT-01**: Admin can export conversation data as CSV
- [ ] **EXPORT-02**: Export supports filtering by date range and conversation status
- [ ] **EXPORT-03**: Export includes contact name, phone number, status, assigned agent, message count, last active date

### Error Tracking

- [ ] **SENTRY-01**: Sentry integrated for client-side, server-side, and edge runtime error tracking
- [ ] **SENTRY-02**: Unhandled errors in production are captured and reported to Sentry dashboard
- [ ] **SENTRY-03**: global-error.tsx provides user-friendly error page for unrecoverable errors

### Real-Time Updates

- [ ] **REALTIME-01**: Status changes, assignment updates, and new notes appear instantly for all connected agents via Supabase Realtime
- [ ] **REALTIME-02**: Polling continues for Kapso message data (unchanged)
- [ ] **REALTIME-03**: Automatic reconnection on connection drop

### User Management

- [ ] **USRMGMT-01**: Admin can invite new team members via email from a user management page
- [ ] **USRMGMT-02**: Admin can deactivate a team member's account
- [ ] **USRMGMT-03**: Admin can change a team member's role (admin/agent)
- [ ] **USRMGMT-04**: User management page shows all team members with their role and status

---

## Validated (v1.0 — shipped and confirmed)

- ✓ **FORK-01**: Clone gokapso/whatsapp-cloud-inbox as the project base
- ✓ **FORK-02**: Audit upstream code
- ✓ **FORK-03**: Set upstream git remote
- ✓ **AUTH-01**: User can log in with email and password via Supabase Auth
- ✓ **AUTH-02**: All app routes protected by auth middleware
- ✓ **AUTH-03**: WhatsApp webhook remains publicly accessible
- ✓ **SETTINGS-01**: Admin can view and update Kapso credentials
- ✓ **SETTINGS-02**: Credentials stored in Supabase Postgres
- ✓ **SETTINGS-03**: All Kapso API routes use getConfig()
- ✓ **PRESERVE-01**: All WhatsApp inbox features preserved
- ✓ **BRAND-01**: Maissi Beauty Shop name and logo in UI
- ✓ **DEPLOY-01**: App deployed to Vercel with Supabase backend
- ✓ **DEPLOY-02**: Team member accounts created and working

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Appointment reminders | Not required per user |
| Multi-shop / multi-account | Single business only |
| Direct Meta WhatsApp API | Using Kapso as API layer |
| Mobile app | Responsive web is sufficient |
| Auto-assignment rules | Manual assignment is sufficient for 2-3 agents |
| Workflow automation builder | Over-engineered for team size |
| AI response suggestions | Not requested |
| Chat ratings / CSAT | Not needed for internal tool |
| Booking widget | Not a customer-facing tool |
| Multi-channel (Instagram, email) | WhatsApp only |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| RBAC-01 to RBAC-05 | Phase 7 | Pending |
| CANNED-01 to CANNED-05 | Phase 8 | Pending |
| STATUS-01 to STATUS-05 | Phase 9 | Pending |
| ASSIGN-01 to ASSIGN-04 | Phase 9 | Pending |
| LABEL-01 to LABEL-04 | Phase 9 | Pending |
| NOTES-01 to NOTES-04 | Phase 10 | Pending |
| CONTACT-01 to CONTACT-04 | Phase 10 | Pending |
| NOTIF-01 to NOTIF-04 | Phase 11 | Pending |
| REALTIME-01 to REALTIME-03 | Phase 11 | Pending |
| ANALYTICS-01 to ANALYTICS-04 | Phase 12 | Pending |
| EXPORT-01 to EXPORT-03 | Phase 12 | Pending |
| SEARCH-01 to SEARCH-04 | Phase 13 | Pending |
| SENTRY-01 to SENTRY-03 | Phase 14 | Pending |
| USRMGMT-01 to USRMGMT-04 | Phase 14 | Pending |

**Coverage:**
- v2.0 requirements: 53 total
- Mapped to phases: 53
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-21*
*Last updated: 2026-02-21 after milestone v2.0 definition*
