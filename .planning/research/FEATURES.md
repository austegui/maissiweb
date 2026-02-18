# Feature Landscape

**Domain:** WhatsApp Business Shared Inbox / Beauty Shop CRM
**Researched:** 2026-02-18
**Confidence note:** WebSearch and WebFetch were unavailable during this research session. Findings draw from: (a) explicit feature list in PROJECT.md for the Kapso base — HIGH confidence; (b) training knowledge of WhatsApp Business inbox product patterns and beauty-shop workflows — MEDIUM confidence; flagged accordingly.

---

## Scope Framing

This is a **features-dimension** research for the Maissi customization layer. The Kapso base already provides a working WhatsApp inbox. The question is: what does the customization layer need, and what are the right boundaries for v1?

The team is 2-3 people at a single beauty shop. The product is an operational tool, not a SaaS product. Feature decisions should optimize for **"works reliably for the team"**, not for feature breadth.

---

## Already Provided (Kapso Base)

These features exist in the forked base. They are not in scope to build, but must be preserved.

| Feature | Source | Status |
|---------|--------|--------|
| Real-time messaging with auto-polling | Kapso base | Preserved |
| Template messages with dynamic parameters | Kapso base | Preserved |
| Interactive button messages | Kapso base | Preserved |
| Media transmission (images, videos, documents, audio) | Kapso base | Preserved |
| 24-hour messaging window enforcement | Kapso base | Preserved |
| Failed message indicators | Kapso base | Preserved |
| Read receipts | Kapso base | Preserved |

**Source:** PROJECT.md (HIGH confidence — owner-confirmed feature list)

---

## Table Stakes (Customization Layer)

Features users expect from the customization layer. Missing = team cannot use the product at all, or it feels broken.

| Feature | Why Expected | Complexity | Status | Notes |
|---------|--------------|------------|--------|-------|
| Individual user logins | Team accountability; staff need separate sessions; shared password is a security and UX risk for 2-3 people | Low | In scope (v1) | Supabase Auth email+password. Magic links optional but not required. |
| Admin settings UI for API credentials | Non-technical owner needs to update PHONE_NUMBER_ID, KAPSO_API_KEY, WABA_ID without touching code or Vercel env vars | Medium | In scope (v1) | Credentials stored in Supabase, loaded at runtime. Single admin can edit. |
| Settings persistence across redeployments | Vercel wipes env vars on redeploy if not pinned; database-backed config solves this | Low | In scope (v1) | Direct consequence of moving creds to Supabase. |
| Light Maissi branding | Team needs to feel the tool is "theirs", not a generic demo | Low | In scope (v1) | Name and logo only. No redesign. |
| Protected routes (auth-gated inbox) | Inbox must not be accessible without login | Low | In scope (v1) | Next.js middleware or layout-level auth check. |

**Source:** PROJECT.md (HIGH confidence) + training knowledge of auth/settings patterns (MEDIUM confidence)

---

## Table Stakes (WhatsApp Inbox General — Already Covered)

These are table stakes for any WhatsApp business inbox product. They are covered by Kapso but worth naming so the customization doesn't accidentally break them.

| Feature | Why Expected | Complexity | Risk of Breaking | Notes |
|---------|--------------|------------|-----------------|-------|
| Conversation list / contact list | Users need to see all open conversations at a glance | Low | Low | Core Kapso UI |
| Message thread view | Chronological message history per contact | Low | Low | Core Kapso UI |
| Send text messages | Baseline messaging capability | Low | Low | Core Kapso |
| Send templates outside 24-hour window | Business can initiate conversations | Medium | Medium | Kapso template feature — must not be broken by settings rework |
| Send media | Images for treatments, PDFs for price lists, voice notes | Medium | Low | Core Kapso |
| Delivery/read status | Staff needs to know if message was received | Low | Low | Kapso read receipts |
| 24-hour window awareness | WhatsApp policy — staff needs to know when they can only use templates | Medium | Medium | Kapso enforces this; must preserve |

**Confidence:** MEDIUM — based on training knowledge of shared inbox products; verified indirectly by Kapso feature list in PROJECT.md.

---

## Differentiators (For This Specific Product)

Features that would set this product apart from a generic Kapso fork. Not expected out of the box, but would meaningfully improve the beauty shop team's workflow. These are **not in scope for v1** but should inform the roadmap as post-v1 candidates.

| Feature | Value Proposition | Complexity | Beauty Shop Relevance | Notes |
|---------|-------------------|------------|----------------------|-------|
| Quick replies / canned responses | Staff sends the same messages constantly: pricing, hours, "appointment confirmed", aftercare instructions — stored replies save 80% of typing time | Medium | Very High | Owner explicitly deferred to post-v1. When built, should be team-shared, not per-user. |
| Appointment reminder templates | Send a WhatsApp template 24h before an appointment: "Hi [Name], your appointment at Maissi is tomorrow at [time]" | Medium | Very High | Requires template management UI. Beauty shops run on appointments — this is high-ROI. |
| Customer notes / internal annotations | Staff can leave notes on a contact ("prefers balayage", "sensitive scalp") visible only to the team, not the customer | Medium | High | Differentiates from vanilla inbox. Requires a notes table in Supabase per phone number. |
| Customer labels / tags | Tag contacts as "VIP", "New client", "Awaiting payment" — filter conversation list by tag | Medium | High | Owner deferred to post-v1. Standard in inbox products (e.g. Respond.io, WATI). |
| Conversation assignment | Assign a conversation to a specific staff member; track who is handling what | Medium | Medium | Useful when >2 staff. For 2-3 people it may be overkill, but grows naturally. |
| Message search | Find past messages or contacts by keyword or phone number | Medium | Medium | Useful for "did we send them the aftercare info?" |
| Conversation status (open/closed/pending) | Mark a conversation as resolved; filter by status | Low-Medium | Medium | Common in helpdesk-style inboxes; less critical for proactive sales/appointment use case |
| Business hours auto-reply | Auto-respond to messages received outside business hours | Medium | Medium | Requires template setup; reduces missed inquiries overnight |
| Price list / services media library | Quickly attach a saved image of the price list without hunting through a phone camera roll | Medium | High | Beauty shop specific: price lists and treatment photos are sent constantly |
| Contact history / visit log | See all past conversations with a customer in a timeline | Low | High | WhatsApp Cloud API does not provide historical messages — this would only show messages sent through the inbox since setup |

**Confidence:** MEDIUM — based on training knowledge of WhatsApp CRM products (WATI, Respond.io, Twilio Flex, Zoko) and beauty shop operations patterns. Not verified against live competitor products due to WebSearch/WebFetch unavailability.

---

## Anti-Features

Features to deliberately NOT build. Common mistakes in this domain for a small team.

| Anti-Feature | Why Avoid | What to Do Instead | Confidence |
|--------------|-----------|-------------------|------------|
| Role-based permissions (RBAC) | 2-3 people at one shop — adding roles creates configuration overhead with zero real benefit. Every staff member needs full access to do their job. | Keep all authenticated users equal. Add a simple `is_admin` flag if settings-edit-only restriction is needed later. | HIGH (owner decision confirmed in PROJECT.md) |
| Multi-account / multi-shop support | Scope creep; requires significant architecture changes (tenant isolation, separate credential sets). Maissi is one shop. | Single business only; revisit if Maissi expands to a second location | HIGH (owner decision confirmed in PROJECT.md) |
| Custom WhatsApp API layer | Direct Meta API integration adds auth complexity, webhook management, and quota handling. Kapso already handles this. | Stay on Kapso API layer; only switch if Kapso becomes a blocker | HIGH (explicit constraint in PROJECT.md) |
| Full UI redesign | Risk of breaking Kapso's carefully tuned UI behaviors (auto-polling, window enforcement display, etc.) without proportional benefit | Name + logo only. Let Kapso's UI do the work. | HIGH (owner decision confirmed in PROJECT.md) |
| Complex onboarding flows | 2-3 known users. Onboarding is a conversation, not a UI problem. | Admin creates accounts manually or via Supabase dashboard | MEDIUM |
| Customer-facing features (portals, booking widgets) | This is a staff tool, not a customer-facing product | Keep scope firmly on staff-side inbox operations | MEDIUM |
| Audit logs / activity history | Overkill for a 2-3 person team at MVP | If accountability needed later, add `sent_by` field to message records | LOW — note this as a future consideration, not a hard no |
| Notifications / push alerts | Complex to implement reliably (service workers, push API, browser permissions). Web polling already gives near-real-time. | Auto-polling covers the use case; staff keeps the inbox open | MEDIUM |

---

## Feature Dependencies

```
Auth (Supabase Auth)
  └─> Protected routes (Next.js middleware)
        └─> All inbox features (inbox is auth-gated)

Admin settings UI
  └─> Credentials stored in Supabase
        └─> Settings loaded at runtime (replaces .env vars)
              └─> All Kapso API calls (messaging, templates, media)

Branding (name + logo)
  └─> No dependencies — purely additive UI change

--- Post-v1 dependencies ---

Canned responses
  └─> Auth (to associate responses with team, not per-user)
  └─> Supabase table (responses stored in DB)

Customer notes
  └─> Auth (notes tied to authenticated user who wrote them)
  └─> Supabase table (notes keyed by phone number)

Appointment reminders
  └─> Template messages (Kapso base feature — must be working)
  └─> Template management UI (new)
  └─> Scheduling mechanism (cron or Supabase Edge Function)
```

---

## MVP Recommendation

The v1 scope is already well-defined in PROJECT.md. This section confirms that definition is correct from a feature-landscape perspective.

**Build for v1 (in priority order):**
1. Individual user authentication (Supabase Auth) — gates everything else
2. Admin settings UI (credential management) — enables non-technical operation
3. Settings persistence in Supabase — makes deployment reliable
4. Light Maissi branding — makes the tool feel official to the team
5. Protected routes — ties auth to the inbox

**Defer post-v1 (recommended order when revisiting):**
- Quick replies / canned responses — highest ROI for daily staff workflow; first thing to add after v1
- Customer notes / annotations — second highest ROI; requires minimal schema
- Appointment reminder templates — high business value but requires scheduling infrastructure
- Customer labels / tags — useful once conversation volume grows
- Message search — nice-to-have once there's history to search through

**Never build (for this product):**
- Multi-account / multi-shop
- Direct Meta API layer (replace Kapso)
- Full UI redesign

---

## Notes on Confidence

| Claim | Confidence | Reason |
|-------|------------|--------|
| Kapso base features | HIGH | Directly from PROJECT.md, owner-confirmed |
| v1 scope decisions | HIGH | Directly from PROJECT.md, owner-confirmed |
| Differentiators list | MEDIUM | Training knowledge of WATI, Respond.io, Zoko, Twilio Flex — no live verification possible |
| Beauty shop workflow patterns | MEDIUM | Training knowledge of service business CRM — no live verification |
| Anti-features rationale | HIGH (owner decisions) / MEDIUM (operational judgment) | Mix of explicit owner decisions and general SaaS patterns |

---

## Sources

- PROJECT.md — owner-defined feature set, scope, and constraints (HIGH confidence, primary source)
- Training knowledge: WhatsApp Business API shared inbox products (WATI, Respond.io, Zoko, Twilio Flex) — MEDIUM confidence, not verified via WebSearch/WebFetch (unavailable during this session)
- Training knowledge: Beauty salon / service business CRM patterns — MEDIUM confidence
- WhatsApp Cloud API capabilities: training knowledge — MEDIUM confidence; recommend verifying against https://developers.facebook.com/docs/whatsapp/cloud-api when WebFetch access is available
