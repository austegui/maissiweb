# Requirements -- Maissi Beauty Shop WhatsApp Inbox

**Version:** v2.0 Commercial-Grade Features
**Created:** 2026-02-21
**Status:** Active
**Core Value:** The team can send and receive WhatsApp messages through a shared web inbox without anyone needing to touch code or config files.

---

## v2.0 Requirements

### Foundation & RBAC

- [x] **RBAC-01**: User profiles table auto-created on first login with default "agent" role
- [x] **RBAC-02**: Two roles exist -- admin and agent -- enforced by RLS policies in Supabase
- [x] **RBAC-03**: Only admin users can access the settings page and user management
- [x] **RBAC-04**: Agent users can view conversations, send messages, manage notes, but cannot change settings or manage users
- [x] **RBAC-05**: getConfig() refactored to batch query (getConfigs()) to prevent query multiplication

### Canned Responses

- [x] **CANNED-01**: Team can create, edit, and delete saved text responses with a title and shortcut
- [x] **CANNED-02**: Typing `/` in the message input shows a filterable dropdown of canned responses
- [x] **CANNED-03**: Selecting a canned response inserts its text into the message input
- [x] **CANNED-04**: Canned responses are team-shared (visible to all agents)
- [x] **CANNED-05**: Admin page or section for managing the canned responses library

### Conversation Status

- [x] **STATUS-01**: Each conversation has a status: Open, Pending, or Resolved
- [x] **STATUS-02**: Agent can change conversation status via a control in the message view header
- [x] **STATUS-03**: Conversation list is filterable by status (tabs or dropdown in sidebar)
- [x] **STATUS-04**: When a customer sends a new message to a Resolved conversation, it auto-reopens to Open
- [x] **STATUS-05**: Status indicators are visually distinct in the conversation list

### Internal Notes

- [x] **NOTES-01**: Agent can add text notes to any conversation, visible only to the team
- [x] **NOTES-02**: Notes are displayed in a collapsible side panel alongside the message view
- [x] **NOTES-03**: Each note shows author name and timestamp
- [x] **NOTES-04**: Notes are never sent to the customer (physically separate from message-sending code)

### Conversation Assignment

- [x] **ASSIGN-01**: Admin or agent can assign a conversation to a specific team member
- [x] **ASSIGN-02**: Conversation list can be filtered by "Mine", "Unassigned", or "All"
- [x] **ASSIGN-03**: Assigned agent name or avatar is visible in the conversation list item
- [x] **ASSIGN-04**: Unassigned conversations are visible to all agents by default

### Contact Profiles

- [x] **CONTACT-01**: A contact profile is auto-created in Supabase when a new phone number first appears
- [x] **CONTACT-02**: Agent can view and edit contact details (display name, email, notes) in a side panel
- [x] **CONTACT-03**: Contact profile panel is accessible from the message view
- [x] **CONTACT-04**: Contact's conversation history is visible from their profile

### Customer Labels/Tags

- [x] **LABEL-01**: Admin can create, edit, and delete colored labels/tags (e.g., VIP, New Client, Balayage)
- [x] **LABEL-02**: Agent can attach one or more labels to a contact
- [x] **LABEL-03**: Conversation list can be filtered by contact label
- [x] **LABEL-04**: Labels are displayed on conversation list items and contact profiles

### Message Search

- [ ] **SEARCH-01**: Global search accessible via Cmd+K (or a search icon in the header)
- [ ] **SEARCH-02**: Search finds contacts by name and phone number
- [ ] **SEARCH-03**: Search finds conversations by contact name, phone number, or label
- [ ] **SEARCH-04**: Message content search if Kapso API supports it (degrade gracefully if not)

### Analytics Dashboard

- [x] **ANALYTICS-01**: Admin can view a dashboard showing message volume over time (daily/weekly chart)
- [x] **ANALYTICS-02**: Dashboard shows average response time
- [x] **ANALYTICS-03**: Dashboard shows conversations resolved per day and per agent
- [x] **ANALYTICS-04**: Dashboard is admin-only (agents cannot access)

### Sound Notifications

- [x] **NOTIF-01**: Audio alert plays when any new inbound message arrives (not just handoffs)
- [x] **NOTIF-02**: User can toggle sound notifications on/off via a preference setting
- [x] **NOTIF-03**: Browser notification shown for new messages when tab is not focused
- [x] **NOTIF-04**: Sound does not play for messages the agent themselves just sent

### Conversation Export

- [x] **EXPORT-01**: Admin can export conversation data as CSV
- [x] **EXPORT-02**: Export supports filtering by date range and conversation status
- [x] **EXPORT-03**: Export includes contact name, phone number, status, assigned agent, message count, last active date

### Error Tracking

- [ ] **SENTRY-01**: Sentry integrated for client-side, server-side, and edge runtime error tracking _(descoped from v2.0 -- revisit in future milestone)_
- [ ] **SENTRY-02**: Unhandled errors in production are captured and reported to Sentry dashboard _(descoped from v2.0 -- revisit in future milestone)_
- [x] **SENTRY-03**: global-error.tsx provides user-friendly error page for unrecoverable errors

### Real-Time Updates

- [x] **REALTIME-01**: Status changes, assignment updates, and new notes appear instantly for all connected agents via Supabase Realtime
- [x] **REALTIME-02**: Polling continues for Kapso message data (unchanged)
- [x] **REALTIME-03**: Automatic reconnection on connection drop

### User Management

- [x] **USRMGMT-01**: Admin can invite new team members via email from a user management page
- [x] **USRMGMT-02**: Admin can deactivate a team member's account
- [x] **USRMGMT-03**: Admin can change a team member's role (admin/agent)
- [x] **USRMGMT-04**: User management page shows all team members with their role and status

---

## Validated (v1.0 -- shipped and confirmed)

- [x] **FORK-01**: Clone gokapso/whatsapp-cloud-inbox as the project base
- [x] **FORK-02**: Audit upstream code
- [x] **FORK-03**: Set upstream git remote
- [x] **AUTH-01**: User can log in with email and password via Supabase Auth
- [x] **AUTH-02**: All app routes protected by auth middleware
- [x] **AUTH-03**: WhatsApp webhook remains publicly accessible
- [x] **SETTINGS-01**: Admin can view and update Kapso credentials
- [x] **SETTINGS-02**: Credentials stored in Supabase Postgres
- [x] **SETTINGS-03**: All Kapso API routes use getConfig()
- [x] **PRESERVE-01**: All WhatsApp inbox features preserved
- [x] **BRAND-01**: Maissi Beauty Shop name and logo in UI
- [x] **DEPLOY-01**: App deployed to Vercel with Supabase backend
- [x] **DEPLOY-02**: Team member accounts created and working

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
| RBAC-01 | Phase 7 | Complete |
| RBAC-02 | Phase 7 | Complete |
| RBAC-03 | Phase 7 | Complete |
| RBAC-04 | Phase 7 | Complete |
| RBAC-05 | Phase 7 | Complete |
| CANNED-01 | Phase 8 | Complete |
| CANNED-02 | Phase 8 | Complete |
| CANNED-03 | Phase 8 | Complete |
| CANNED-04 | Phase 8 | Complete |
| CANNED-05 | Phase 8 | Complete |
| STATUS-01 | Phase 9 | Complete |
| STATUS-02 | Phase 9 | Complete |
| STATUS-03 | Phase 9 | Complete |
| STATUS-04 | Phase 9 | Complete |
| STATUS-05 | Phase 9 | Complete |
| ASSIGN-01 | Phase 9 | Complete |
| ASSIGN-02 | Phase 9 | Complete |
| ASSIGN-03 | Phase 9 | Complete |
| ASSIGN-04 | Phase 9 | Complete |
| LABEL-01 | Phase 9 | Complete |
| LABEL-02 | Phase 9 | Complete |
| LABEL-03 | Phase 9 | Complete |
| LABEL-04 | Phase 9 | Complete |
| CONTACT-01 | Phase 10 | Complete |
| CONTACT-02 | Phase 10 | Complete |
| CONTACT-03 | Phase 10 | Complete |
| CONTACT-04 | Phase 10 | Complete |
| NOTES-01 | Phase 10 | Complete |
| NOTES-02 | Phase 10 | Complete |
| NOTES-03 | Phase 10 | Complete |
| NOTES-04 | Phase 10 | Complete |
| NOTIF-01 | Phase 11 | Complete |
| NOTIF-02 | Phase 11 | Complete |
| NOTIF-03 | Phase 11 | Complete |
| NOTIF-04 | Phase 11 | Complete |
| REALTIME-01 | Phase 11 | Complete |
| REALTIME-02 | Phase 11 | Complete |
| REALTIME-03 | Phase 11 | Complete |
| ANALYTICS-01 | Phase 12 | Complete |
| ANALYTICS-02 | Phase 12 | Complete |
| ANALYTICS-03 | Phase 12 | Complete |
| ANALYTICS-04 | Phase 12 | Complete |
| EXPORT-01 | Phase 12 | Complete |
| EXPORT-02 | Phase 12 | Complete |
| EXPORT-03 | Phase 12 | Complete |
| SEARCH-01 | Backlog | Deferred |
| SEARCH-02 | Backlog | Deferred |
| SEARCH-03 | Backlog | Deferred |
| SEARCH-04 | Backlog | Deferred |
| SENTRY-01 | Backlog | Descoped |
| SENTRY-02 | Backlog | Descoped |
| SENTRY-03 | Phase 13 | Complete |
| USRMGMT-01 | Phase 13 | Complete |
| USRMGMT-02 | Phase 13 | Complete |
| USRMGMT-03 | Phase 13 | Complete |
| USRMGMT-04 | Phase 13 | Complete |

**Coverage:**
- v2.0 requirements: 56 total
- Mapped to phases: 56
- Unmapped: 0

---
*Requirements defined: 2026-02-21*
*Last updated: 2026-02-22 after Phase 13 completion*
