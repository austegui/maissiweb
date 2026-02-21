# Feature Landscape: Commercial-Grade WhatsApp Inbox

**Domain:** WhatsApp Business Shared Inbox / Beauty Shop CRM -- Milestone 2 (Commercial Features)
**Researched:** 2026-02-21
**Overall Confidence:** MEDIUM-HIGH (competitive research verified against multiple sources; implementation details verified against codebase)

---

## Scope Framing

This document covers the SECOND milestone: adding commercial-grade features to an already-working WhatsApp inbox. The v1 is operational with messaging, auth, settings, handoff detection, security hardening, and performance optimizations.

The product serves a beauty shop team of 2-3 agents using a single WhatsApp Business number. Feature decisions should optimize for "makes the team measurably more productive" rather than feature parity with enterprise tools like Respond.io ($79/user/mo) or WATI ($49/user/mo).

**Key constraint:** Data lives in two places: (1) Kapso API (conversations, messages -- read-only via API, we do not own this data store) and (2) Supabase (auth, settings -- we own this fully). Any new feature that stores data needs to go into Supabase. Any feature that reads WhatsApp data goes through Kapso.

---

## Already Built (Not In Scope)

These exist and must be preserved. New features build on top of them.

| Feature | Implementation | Notes |
|---------|---------------|-------|
| WhatsApp messaging (text, media, templates, interactive) | Kapso API + Next.js routes | Fully working |
| 24-hour window enforcement | Client-side check in MessageView | Shows template-only UI when expired |
| Handoff-to-human detection | Pattern match on last message content | Amber UI, audio beep, browser notification |
| Supabase Auth (email/password) | `auth.users` + middleware | Route protection on all pages |
| Admin settings UI | `app_settings` table in Supabase | API credentials stored in DB |
| Security (CORS, headers, input validation, auth on media) | Middleware + API route guards | Hardened |
| Performance (polling backoff, smart re-renders, debounced search) | Custom hooks | Optimized |
| Error boundary | React error boundary component | Catches render crashes |
| Conversation search | Client-side filter on name/phone | In conversation list header |

---

## Table Stakes (Must Build)

Features every commercial WhatsApp inbox tool offers. Without these, the product feels like a prototype to the team. Ordered by impact for a 2-3 person beauty shop.

### 1. Canned Responses / Quick Replies

**Why Expected:** Every competitor (WATI, Respond.io, Trengo, Tidio) has this. Beauty shops send the same 10-15 messages constantly: pricing, hours, aftercare instructions, "your appointment is confirmed," "we're closed right now." WATI specifically calls out quick replies as a core team productivity feature. Without this, agents type the same paragraphs hundreds of times per week.

**Expected Behavior (from competitor analysis):**
- Library of saved text responses with a title/shortcut
- Triggered via a shortcut prefix (e.g., typing `/` in the input field shows a filterable dropdown)
- Responses are team-shared (not per-user) -- appropriate for 2-3 person team
- Support for basic variable substitution (customer name, current date)
- CRUD management in a simple admin interface (or inline creation)
- Maximum ~50 responses is standard (WhatsApp Business App limits to 50; sufficient for a beauty shop)

**Implementation approach:**
- Supabase table: `canned_responses` (id, title, shortcut, body, category, created_by, created_at, updated_at)
- UI: Slash-command dropdown in message input area + management page
- No Kapso dependency -- purely local feature

| Complexity | Dependencies | Supabase Tables | Priority |
|-----------|-------------|-----------------|----------|
| Medium | Auth (created_by) | `canned_responses` | P0 -- highest ROI |

**Confidence:** HIGH -- verified across WATI, Respond.io, Trengo, WhatsApp Business App docs.

---

### 2. Conversation Status (Open / Resolved)

**Why Expected:** Every shared inbox treats conversations as tickets with statuses. Trengo, Respond.io, WATI all use at minimum Open/Pending/Resolved. Without status management, the team cannot tell which conversations need attention vs which are done. This is the most basic workflow feature.

**Expected Behavior:**
- Three statuses: **Open** (needs attention), **Pending** (waiting on customer), **Resolved** (done)
- Default: conversations are "Open" when they have a new inbound message
- Manual status change via a button/dropdown in the conversation header
- Conversation list filterable by status (tabs or dropdown)
- Auto-reopen: when a customer sends a new message to a "Resolved" conversation, it goes back to "Open"
- Visual indicators in the conversation list (color-coded or icon-based)

**Implementation approach:**
- Supabase table: `conversation_status` (conversation_id [Kapso ID], status, resolved_by, resolved_at, updated_at)
- NOTE: Cannot modify Kapso's data. Status is an overlay we maintain in Supabase, keyed by Kapso conversation ID.
- Auto-reopen logic: on each poll, if a conversation's `lastActiveAt` changed and last message is inbound, reset to "Open"
- UI: status tabs in sidebar, status toggle button in message view header

| Complexity | Dependencies | Supabase Tables | Priority |
|-----------|-------------|-----------------|----------|
| Medium | Auth, Conversations API | `conversation_status` | P0 |

**Confidence:** HIGH -- universal across all competitors.

---

### 3. Internal Notes on Conversations

**Why Expected:** WATI, Trengo, and Respond.io all support internal notes. For a beauty shop team, notes like "prefers balayage," "sensitive scalp," "always late -- confirm day before" are operationally critical. Without notes, agents ask customers to repeat information or rely on memory.

**Expected Behavior:**
- Notes are visible only to the team, never sent to the customer
- Displayed in the message thread (inline, visually distinct from actual messages) OR in a separate panel
- Recommendation: **Separate side panel** -- inline notes in the message thread risk visual confusion and require complex interleaving logic with Kapso message data. A side panel is simpler to build and equally usable for a small team.
- Each note shows author + timestamp
- Simple text-only (no rich text needed for v1)

**Implementation approach:**
- Supabase table: `conversation_notes` (id, conversation_id, author_id, content, created_at)
- UI: collapsible side panel on the right of the message view, or a tab in the conversation header area
- No Kapso dependency -- purely local storage

| Complexity | Dependencies | Supabase Tables | Priority |
|-----------|-------------|-----------------|----------|
| Medium | Auth (author_id) | `conversation_notes` | P1 |

**Confidence:** HIGH -- verified across WATI, Trengo, Respond.io.

---

### 4. Contact Profiles (Name, Notes, Tags)

**Why Expected:** Every CRM-adjacent WhatsApp tool offers contact profiles. SleekFlow, WATI, Trengo all let you store custom data per contact. For a beauty shop: service history preferences, allergies/sensitivities, birthday, referral source, VIP status.

**Expected Behavior:**
- Each WhatsApp phone number gets a profile in the system
- Fields: display name (editable, overrides Kapso contact_name), phone number, email (optional), custom notes, tags/labels, created date, last contact date
- Profile visible in a panel alongside the conversation
- Tags/labels attached to the contact (not the conversation) -- e.g., "VIP," "New client," "Balayage"

**Implementation approach:**
- Supabase table: `contacts` (id, phone_number [unique], display_name, email, notes, created_at, updated_at)
- Supabase table: `tags` (id, name, color, created_at)
- Supabase table: `contact_tags` (contact_id, tag_id) -- junction table
- Auto-create contact on first message (upsert on phone_number)
- UI: right panel in message view showing contact details, editable inline

| Complexity | Dependencies | Supabase Tables | Priority |
|-----------|-------------|-----------------|----------|
| Medium-High | Auth | `contacts`, `tags`, `contact_tags` | P1 |

**Confidence:** HIGH -- universal CRM feature, verified across SleekFlow, WATI, Trengo, Respond.io.

---

### 5. Sound Notifications for All New Messages

**Why Expected:** Currently, the app only alerts on handoff events. In a real beauty shop, agents need to hear when ANY new message arrives, not just handoffs. Respond.io, WATI, Trengo all play sounds on new incoming messages. Agents often have multiple browser tabs open; sound is how they know to switch back.

**Expected Behavior:**
- Short notification sound when a new inbound message arrives in any conversation
- Different/louder sound for handoff events (already exists, keep it)
- User preference to enable/disable sounds (respect user choice, no annoyance)
- Do NOT play sound for messages the agent themselves just sent
- Desktop notification (browser Notification API) for new messages when tab is not focused

**Implementation approach:**
- Extend existing `use-handoff-alerts.ts` pattern to cover all new inbound messages
- Track last-seen message ID per conversation; detect new ones on each poll
- Web Audio API (already used for handoff beep) for the sound
- Settings stored in `localStorage` (per-browser preference, no Supabase needed)

| Complexity | Dependencies | Supabase Tables | Priority |
|-----------|-------------|-----------------|----------|
| Low-Medium | Existing polling + handoff hook | None (localStorage) | P0 |

**Confidence:** HIGH -- basic feature, straightforward extension of existing handoff notification code.

---

### 6. Customer Labels/Tags

**Why Expected:** WhatsApp Business App itself has labels (up to 20). WATI, Trengo, Respond.io all support unlimited labels. For a beauty shop: "VIP," "New client," "Payment pending," "Botox," "Nails," "Hair" are all operationally useful for filtering and prioritization.

**Expected Behavior:**
- Predefined set of tags with colors (admin can add/edit/delete)
- Tags attached to contacts (survive across conversations)
- Filter conversation list by tag
- Multiple tags per contact
- Visible in conversation list sidebar (small colored dots or chips)

**Implementation approach:**
- Bundled with Contact Profiles feature (same `tags` and `contact_tags` tables)
- Tag management: simple admin page or inline creation in contact profile
- Conversation list filter: join contacts by phone_number, filter by tag

| Complexity | Dependencies | Supabase Tables | Priority |
|-----------|-------------|-----------------|----------|
| Medium | Contact Profiles | `tags`, `contact_tags` (shared) | P1 |

**Confidence:** HIGH -- verified across WhatsApp Business App docs, WATI, Trengo.

---

## Differentiators (Valuable but Not Universal)

Features that would meaningfully improve the team's workflow but are not present in all competitors or are higher effort. These are strong candidates for a follow-up milestone.

### 7. Conversation Assignment to Agents

**Value:** When 3 agents are online, knowing who "owns" a conversation prevents duplicate replies and dropped conversations. WATI and Respond.io both highlight auto-assignment as a key feature.

**Expected Behavior:**
- Assign a conversation to a specific agent (dropdown in conversation header)
- "Unassigned" conversations visible to all
- Filter conversation list by "My conversations" vs "All" vs "Unassigned"
- Optional: auto-assign on first reply (the agent who replies first "claims" it)

**Assessment for this team:** At 2-3 agents, this is on the border of necessary. With 2 people, verbal coordination ("I'll take that one") works. With 3, it starts breaking down. **Recommend building a lightweight version** -- manual assignment only, no auto-assignment rules.

| Complexity | Dependencies | Supabase Tables | Priority |
|-----------|-------------|-----------------|----------|
| Medium | Auth (user IDs), Conversation Status | `conversation_assignments` (conversation_id, agent_id, assigned_at, assigned_by) | P2 |

**Confidence:** HIGH -- verified behavior across WATI, Respond.io, Trengo.

---

### 8. User Management (Add/Remove Team Members)

**Value:** Currently, adding a team member requires Supabase dashboard access. An admin UI for user management makes the product self-contained.

**Expected Behavior:**
- Admin can invite new team members (by email)
- Admin can deactivate/remove team members
- View list of all team members with last-active date
- Cannot delete yourself or the last admin

**Assessment:** Important for product completeness. Without it, the owner has to use Supabase's raw interface to manage users. For a 2-3 person team, this happens rarely (only on hire/departure), but when it does happen, it should be easy.

| Complexity | Dependencies | Supabase Tables | Priority |
|-----------|-------------|-----------------|----------|
| Medium | Supabase Auth admin API | `profiles` (user_id, display_name, role, created_at) | P2 |

**Confidence:** MEDIUM -- standard pattern, but Supabase admin API usage from server side needs verification.

---

### 9. RBAC (Admin vs Agent Roles)

**Value:** Restrict settings access to admins only. Agents should not be able to change API credentials or delete team members. WATI implements Admin/Supervisor/Agent tiers; Respond.io has Owner/Manager/Agent.

**Expected Behavior for this product (simplified):**
- Two roles: **Admin** and **Agent**
- Admin: full access (settings, user management, tag management, canned response management)
- Agent: inbox access (read/write messages, update conversation status, add notes, view contacts)
- Role stored per user, displayed in user management UI

**Assessment:** The previous FEATURES.md marked this as an anti-feature for v1. For the commercial milestone, it becomes relevant because user management and settings become more powerful. A simple `role` column on a `profiles` table is minimal effort and prevents accidental misconfiguration.

**Implementation approach:**
- Supabase: `profiles` table with `role` column (enum: 'admin', 'agent')
- RLS policies on `app_settings` (admin only), `profiles` (admin only for write)
- Next.js middleware or layout check for admin routes
- Supabase custom claims approach (JWT contains role, checked in RLS)

| Complexity | Dependencies | Supabase Tables | Priority |
|-----------|-------------|-----------------|----------|
| Medium | User Management, Supabase Auth | `profiles` (role column) | P2 (bundle with user management) |

**Confidence:** MEDIUM-HIGH -- Supabase RBAC pattern verified against official Supabase docs (Custom Claims & RBAC documentation).

---

### 10. Message Search (Across Conversations)

**Value:** "Did we send them the aftercare instructions?" or "What did that customer ask about last week?" Useful once there is message history. Respond.io and Trengo both offer cross-conversation search.

**Expected Behavior:**
- Search bar that searches across all conversations
- Results show matching messages with conversation context
- Click result navigates to that message in the conversation

**Assessment:** This depends on whether Kapso API supports message search. If it does, it is medium complexity. If not, we would need to index messages in Supabase (high complexity, because we would need to sync all messages into our own store).

**Implementation approach (if Kapso supports it):**
- API route that queries Kapso message search endpoint
- UI: global search bar in the top nav
- Results component showing message snippets with conversation links

**Implementation approach (if Kapso does NOT support it):**
- Would require message sync/caching in Supabase -- significantly more complex
- Defer until message sync infrastructure exists

| Complexity | Dependencies | Supabase Tables | Priority |
|-----------|-------------|-----------------|----------|
| Medium (if Kapso has search) / High (if not) | Kapso API capabilities | Possibly `message_cache` if no Kapso search | P3 -- needs feasibility check |

**Confidence:** LOW -- Kapso API search capabilities not verified. Needs investigation.

---

### 11. Basic Analytics Dashboard

**Value:** Track response times, message volume, conversations per day. TimelinesAI and Trengo both emphasize analytics as a driver of 45% improvement in customer satisfaction. For a beauty shop, key question: "are we responding fast enough?"

**Expected Behavior:**
- Dashboard page showing key metrics:
  - Messages sent/received per day (chart)
  - Average first response time
  - Conversations opened/resolved per day
  - Active conversations count
  - Agent activity (messages per agent, if assignment exists)
- Date range filter (today, this week, this month)

**Assessment:** Most metrics require data we either already poll (conversations list) or would store locally (conversation status, assignment). First response time requires correlating inbound message timestamp with first outbound response -- doable if we track this in Supabase.

**Implementation approach:**
- Supabase tables: use existing `conversation_status` + `conversation_assignments` data
- New table: `analytics_events` (event_type, conversation_id, agent_id, timestamp, metadata) -- lightweight event log
- Simple charts using a lightweight library (Recharts or similar)
- Computed on the client from Supabase queries (no backend aggregation pipeline needed for 2-3 agents)

| Complexity | Dependencies | Supabase Tables | Priority |
|-----------|-------------|-----------------|----------|
| High | Conversation Status, Assignment | `analytics_events` or computed from existing tables | P3 |

**Confidence:** MEDIUM -- analytics patterns well-understood, but data availability depends on what we track.

---

### 12. Conversation Export

**Value:** Export conversation history for records, dispute resolution, or training. Some beauty shops need records for complaint handling.

**Expected Behavior:**
- Export a single conversation as CSV or PDF
- Include: timestamp, sender (phone/name), message content, media file names
- Download button in conversation view

**Assessment:** Low ROI for daily use but occasionally critical. Simple to implement since we already fetch all messages for display.

| Complexity | Dependencies | Supabase Tables | Priority |
|-----------|-------------|-----------------|----------|
| Low | Messages API | None | P3 |

**Confidence:** HIGH -- straightforward data transformation, no external dependencies.

---

### 13. Real-Time via SSE (Replace Polling)

**Value:** Current system polls every 5-10 seconds. SSE would deliver instant updates with less server load. This is an infrastructure improvement, not a user-facing feature.

**Expected Behavior:**
- Server-Sent Events connection for conversation/message updates
- Instant message delivery (sub-second instead of up to 10 seconds)
- Graceful fallback to polling if SSE connection drops

**Assessment -- CRITICAL WARNING:** SSE on Vercel has severe limitations. Vercel serverless functions have a 10-second timeout on Hobby plan, 60 seconds on Pro. Edge runtime allows longer connections but resets state between calls -- you cannot maintain persistent connections. Multiple community reports (GitHub Discussion #48427, Vercel Community forums) confirm SSE is problematic on Vercel serverless.

**Options:**
1. **Stay with polling** (current) -- works, simple, no infrastructure change. 5-10 second delay is acceptable for a beauty shop.
2. **Supabase Realtime** -- Supabase has built-in Realtime subscriptions (websockets). Could listen for changes to our Supabase tables (status changes, notes, etc.) but NOT for new WhatsApp messages (those come from Kapso).
3. **Move to a non-Vercel host** -- eliminates timeout limitations but adds infrastructure complexity.

**Recommendation:** Stay with polling for WhatsApp messages. Use Supabase Realtime only for local features (status updates, notes) if latency matters. The 5-10 second polling delay is not a problem for a beauty shop that gets maybe 50-100 messages per day.

| Complexity | Dependencies | Supabase Tables | Priority |
|-----------|-------------|-----------------|----------|
| High (and risky on Vercel) | Vercel platform constraints | None | P4 -- defer, polling works fine |

**Confidence:** HIGH that it is problematic -- verified against Vercel community reports, GitHub issues, and multiple blog posts about SSE limitations on Vercel serverless.

---

### 14. Error Tracking

**Value:** Currently errors go to console.log. A real error tracking service (Sentry, LogRocket) would catch issues in production.

**Expected Behavior:**
- Client-side error capture (React error boundary integration)
- Server-side error capture (API route errors)
- Alerting on new/frequent errors
- Source maps for readable stack traces

**Assessment:** This is a developer operations feature, not user-facing. Sentry free tier covers this easily. Low effort, high value for diagnosing production issues.

| Complexity | Dependencies | Supabase Tables | Priority |
|-----------|-------------|-----------------|----------|
| Low | None (third-party service) | None | P1 |

**Confidence:** HIGH -- Sentry/Next.js integration is well-documented and straightforward.

---

## Anti-Features (Do NOT Build)

Features to explicitly avoid. These are common in enterprise inbox tools but wrong for a 2-3 person beauty shop.

### Auto-Assignment Rules Engine

**Why Avoid:** WATI and Respond.io offer complex auto-assignment with round-robin, skill-based routing, load balancing. For 2-3 people who sit in the same room, this is pure overhead. A manual "assign to" dropdown is sufficient.
**What to Do Instead:** Simple manual assignment dropdown. If needed later, add "auto-assign on first reply" as a single toggle, not a rules engine.

### Workflow Automation Builder

**Why Avoid:** Respond.io's workflow builder is a visual programming tool for routing, tagging, and auto-responding. Building this is months of work and the team does not need it. The existing Claude chatbot + handoff-to-human already handles automated responses.
**What to Do Instead:** The chatbot IS the automation layer. Focus on making handoff smoother, not on building a second automation system.

### Multi-Channel Support (Instagram, Facebook, Telegram)

**Why Avoid:** Every enterprise tool (Trengo, Respond.io) adds channels. But Maissi uses WhatsApp exclusively. Adding channels means abstracting the conversation model, building channel-specific adapters, and handling cross-channel contact merging. Massive scope for zero benefit.
**What to Do Instead:** Stay WhatsApp-only. If Instagram becomes relevant, evaluate as a separate future decision.

### Full CRM / Sales Pipeline

**Why Avoid:** SleekFlow, Kommo, and others offer lead scoring, sales stages, deal tracking. A beauty shop's "pipeline" is: message -> book appointment -> show up -> pay. This is too simple for CRM tooling and too complex to build correctly.
**What to Do Instead:** Contact profiles with tags cover 90% of the need. "VIP" tag + "Notes" field replaces a pipeline for a small beauty shop.

### Customer-Facing Booking Widget

**Why Avoid:** n8n templates and SimplyBook.me show sophisticated WhatsApp-to-calendar integrations. Building a booking widget is a product in itself (calendar UI, availability management, reminders, rescheduling). Use an existing booking tool (Calendly, SimplyBook.me) and link to it from canned responses.
**What to Do Instead:** Canned response with booking link: "/booking" -> "Book your appointment here: [link]"

### Chat Ratings / CSAT Surveys

**Why Avoid:** Enterprise tools send post-conversation surveys. For a beauty shop with 2-3 agents and a personal relationship with clients, this feels robotic and annoying. Customer feedback comes through conversation naturally.
**What to Do Instead:** Nothing. If satisfaction tracking is needed, add a simple NPS question to the WhatsApp chatbot flow.

### AI Response Suggestions

**Why Avoid:** The Claude chatbot already handles initial responses. Adding AI suggestions to the human agent's inbox means building a separate AI pipeline (prompt engineering, context injection, suggestion UI). High complexity for marginal value since the human agent already knows what to say.
**What to Do Instead:** Good canned responses cover 80% of repetitive typing. The existing chatbot handles automated responses before handoff.

---

## Feature Dependencies

```
Sound Notifications (P0)
  +-- Existing polling infrastructure
  +-- Existing handoff alert hook
  (No new tables needed)

Canned Responses (P0)
  +-- Auth (created_by)
  +-- New table: canned_responses
  (Independent of other new features)

Conversation Status (P0)
  +-- Auth (resolved_by)
  +-- New table: conversation_status
  +-- Existing conversations polling (for auto-reopen detection)

Error Tracking (P1)
  +-- Sentry SDK
  +-- Existing error boundary
  (Independent of other features)

Internal Notes (P1)
  +-- Auth (author_id)
  +-- New table: conversation_notes
  (Independent -- but pairs well with Contact Profiles in UI)

Contact Profiles + Tags (P1)
  +-- Auth
  +-- New tables: contacts, tags, contact_tags
  +-- Existing conversation list (join by phone_number)

Customer Labels filtering (P1)
  +-- Contact Profiles (depends on contacts + tags tables)
  +-- Conversation list UI changes

User Management (P2)
  +-- Supabase Auth admin API
  +-- New table: profiles (with role column)
  +-- RBAC depends on this

RBAC (P2)
  +-- User Management (needs profiles table)
  +-- Middleware changes for admin-only routes
  +-- Supabase RLS policies

Conversation Assignment (P2)
  +-- User Management (need user list)
  +-- Conversation Status (complementary)
  +-- New table: conversation_assignments

Message Search (P3)
  +-- Kapso API search capability (needs investigation)
  +-- OR message caching infrastructure

Analytics Dashboard (P3)
  +-- Conversation Status (for resolution metrics)
  +-- Conversation Assignment (for agent metrics)
  +-- Lightweight chart library

Conversation Export (P3)
  +-- Messages API (existing)
  +-- Client-side CSV/PDF generation

Real-Time SSE (P4)
  +-- Vercel platform constraints (BLOCKER on current hosting)
  +-- Would benefit from Supabase Realtime for local features only
```

---

## Phased Build Recommendation

### Phase 1: Agent Productivity (P0 -- Highest Impact, Lowest Risk)

Build the features that save agents the most time per day.

1. **Canned Responses** -- eliminates repetitive typing (highest ROI for daily workflow)
2. **Conversation Status** -- provides basic workflow management (open/resolved)
3. **Sound Notifications for All Messages** -- agents stop missing messages

**Rationale:** These three features are independent of each other (can be built in parallel), require minimal new Supabase schema (2 tables), and deliver immediate daily productivity gains. No architectural changes needed.

**Estimated new Supabase tables:** `canned_responses`, `conversation_status`

### Phase 2: Customer Intelligence (P1)

Build the features that help agents know their customers.

1. **Contact Profiles + Tags** -- store customer preferences and segment them
2. **Internal Notes** -- team knowledge sharing per conversation
3. **Error Tracking** -- production reliability (Sentry setup)

**Rationale:** These features build on Phase 1's workflow by adding context. Contact profiles enhance the conversation list (tags visible). Notes complement conversation status (resolved with context). Error tracking is independent but should ship early to catch bugs from Phase 1.

**Estimated new Supabase tables:** `contacts`, `tags`, `contact_tags`, `conversation_notes`

### Phase 3: Team Management (P2)

Build features for managing the team.

1. **User Management** -- admin UI for adding/removing agents
2. **RBAC** -- protect admin features from agents
3. **Conversation Assignment** -- ownership of conversations

**Rationale:** These features are interconnected (RBAC depends on user management, assignment depends on user list). They also only become valuable after Phase 1-2 features exist (assigning a conversation matters more when there are statuses, notes, and contact profiles to go with it).

**Estimated new Supabase tables:** `profiles`, `conversation_assignments`

### Phase 4: Intelligence and Export (P3)

Nice-to-have features that improve over time.

1. **Message Search** -- (if feasible via Kapso API)
2. **Analytics Dashboard** -- operational metrics
3. **Conversation Export** -- record keeping

**Rationale:** These features require data that accumulates over time. Analytics is more meaningful after weeks of status + assignment data. Search is more useful after months of message history. Export is rarely needed but good to have.

### Phase 5: Infrastructure (P4 -- Only If Needed)

1. **Real-Time SSE** -- only if polling becomes a measurable problem

**Rationale:** Polling works. Do not fix what is not broken. If the team grows to 5+ agents or message volume exceeds 500/day, revisit.

---

## Supabase Schema Summary (All New Tables)

| Table | Phase | Purpose | Key Columns |
|-------|-------|---------|-------------|
| `canned_responses` | 1 | Quick reply templates | id, title, shortcut, body, category, created_by, created_at |
| `conversation_status` | 1 | Open/Pending/Resolved tracking | conversation_id (Kapso), status, resolved_by, updated_at |
| `contacts` | 2 | Customer profiles | id, phone_number (unique), display_name, email, notes, created_at |
| `tags` | 2 | Label definitions | id, name, color, created_at |
| `contact_tags` | 2 | Contact-to-tag junction | contact_id, tag_id |
| `conversation_notes` | 2 | Internal team notes | id, conversation_id, author_id, content, created_at |
| `profiles` | 3 | User profiles with roles | user_id (FK to auth.users), display_name, role, created_at |
| `conversation_assignments` | 3 | Who owns which conversation | conversation_id, agent_id, assigned_at, assigned_by |
| `analytics_events` | 4 | Lightweight event log | id, event_type, conversation_id, agent_id, timestamp, metadata |

**Total: 9 new tables across 4 phases.** All use Supabase RLS for access control.

---

## Beauty Shop-Specific Considerations

Based on salon CRM research (SleekFlow, SimplyBook.me, Zenoti), beauty shops have specific patterns:

1. **Service-based tags matter most:** "Hair," "Nails," "Botox," "Facial" -- these help route messages to the right person (the nail tech vs the hairdresser)
2. **Aftercare is a recurring message type:** Canned responses should include aftercare templates per service (e.g., "after your keratin treatment, avoid washing for 72 hours...")
3. **Appointment confirmation is the #1 sent message:** The first canned response created should be appointment confirmation
4. **Payment reminders are common:** "Payment pending" tag + canned response for payment follow-up
5. **Customer allergies/sensitivities are safety-critical:** Contact profile notes should prominently surface allergy info
6. **Media (photos) are sent constantly:** Before/after photos, price lists, service menus. The existing media support is adequate; no changes needed.

---

## Confidence Assessment

| Feature | Confidence | Reason |
|---------|-----------|--------|
| Canned Responses | HIGH | Universal across all competitors, simple implementation |
| Conversation Status | HIGH | Universal, straightforward overlay on Kapso data |
| Sound Notifications | HIGH | Extension of existing code, proven pattern |
| Internal Notes | HIGH | Universal, simple CRUD |
| Contact Profiles + Tags | HIGH | Universal CRM feature, standard schema |
| Error Tracking (Sentry) | HIGH | Well-documented integration |
| User Management | MEDIUM | Supabase admin API usage needs verification |
| RBAC | MEDIUM-HIGH | Supabase custom claims docs verified, but implementation detail needs testing |
| Conversation Assignment | HIGH | Simple feature, clear schema |
| Message Search | LOW | Depends on unverified Kapso API capabilities |
| Analytics Dashboard | MEDIUM | Data availability depends on Phase 1-2 schema |
| Conversation Export | HIGH | Pure client-side data transformation |
| Real-Time SSE | HIGH (that it is problematic) | Vercel limitations well-documented |

---

## Open Questions

1. **Does Kapso API support message search/filtering by content?** -- Determines Message Search feasibility and complexity
2. **Does Supabase Auth expose admin APIs usable from Next.js server routes?** -- Needed for User Management (likely yes via `supabase.auth.admin.*` with service role key)
3. **Does Kapso API expose webhook/callback capabilities?** -- If yes, could enable push-based updates instead of polling (alternative to SSE)
4. **What is the actual daily message volume?** -- Informs whether polling optimization matters

---

## Sources

### Competitor Feature Research
- [WATI Review 2026 (Chatimize)](https://chatimize.com/reviews/wati/) -- team inbox, quick replies, labels, auto-assignment
- [WATI Team Inbox Breakdown (Heltar)](https://www.heltar.com/blogs/how-to-use-watis-team-inbox-comprehensive-breakdown-in-2025) -- comprehensive feature breakdown
- [Respond.io Team Inbox](https://respond.io/team-inbox) -- workflow builder, contact management, assignment
- [Respond.io Review (Chatimize)](https://chatimize.com/reviews/respond-io/) -- feature overview, pricing
- [Trengo WhatsApp Team Inbox Guide](https://trengo.com/blog/whatsapp-team-inbox) -- internal notes, analytics, status management
- [Trengo Review 2026 (Research.com)](https://research.com/software/reviews/trengo) -- analytics, team features
- [Trengo WhatsApp Analytics](https://trengo.com/blog/whatsapp-analytics) -- dashboard metrics, reporting

### Quick Replies / Canned Responses
- [Gallabox WhatsApp Quick Reply Templates](https://gallabox.com/blog/whatsapp-business-quick-reply-templates) -- best practices, 50 reply limit
- [Aunoa Quick Reply Guide](https://aunoa.ai/en/blog/whatsapp-business-quick-reply-guide/) -- implementation patterns
- [WhatsApp Help Center: Quick Replies](https://faq.whatsapp.com/1791149784551042/?cms_platform=android) -- official limits and behavior

### Labels and Tags
- [Zixflow WhatsApp Labels Guide](https://zixflow.com/blog/whatsapp-labels/) -- label management best practices
- [Trengo WhatsApp Labels](https://trengo.com/blog/whatsapp-business-labels) -- unlimited labels via API
- [WhatsApp Help Center: Labels](https://faq.whatsapp.com/3398508707096369/?cms_platform=android) -- official 20-label limit

### Analytics
- [TimelinesAI WhatsApp Analytics](https://timelines.ai/whatsapp-analytics-dashboards-key-metrics/) -- key dashboard metrics
- [Respond.io WhatsApp Metrics](https://respond.io/blog/whatsapp-business-metrics) -- response time, resolution rate
- [Aurora Inbox Key Metrics](https://www.aurorainbox.com/en/2025/07/18/10-key-metrics-for-success-whatsapp-business-strategy/) -- 10 key business metrics

### RBAC / Supabase
- [Supabase Custom Claims & RBAC Docs](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) -- official implementation guide
- [Supabase RLS Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) -- row-level security
- [Makerkit RBAC in Next.js Supabase](https://makerkit.dev/docs/next-supabase-turbo/development/permissions-and-roles) -- practical pattern

### SSE / Real-Time Limitations
- [Next.js SSE Discussion #48427](https://github.com/vercel/next.js/discussions/48427) -- SSE limitations in API routes
- [Vercel SSE Time Limits Discussion](https://community.vercel.com/t/sse-time-limits/5954) -- timeout constraints
- [Fixing SSE Streaming on Vercel (Medium)](https://medium.com/@oyetoketoby80/fixing-slow-sse-server-sent-events-streaming-in-next-js-and-vercel-99f42fbdb996) -- workarounds and limitations

### Beauty Salon CRM
- [SleekFlow Beauty & Wellness CRM](https://sleekflow.io/solutions/beauty-and-wellness-services) -- salon-specific WhatsApp CRM
- [n8n Salon Appointment Automation](https://n8n.io/workflows/4926-automate-salon-appointment-management-with-whatsapp-gpt-and-google-calendar/) -- WhatsApp + calendar integration
