# Phase 10: Customer Intelligence - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Persistent customer profiles and internal team notes so agents always have context about who they're talking to and what the team knows. Contact profiles are auto-created and editable. Internal notes are per-conversation, append-only, and never sent to the customer. Contact management UI (merging, bulk actions) and search are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Contact Profile Panel
- Right side panel that slides in from the right of the message view, alongside the conversation
- Toggled open/closed via a button in the message view header — agent controls visibility
- Panel shows contact info at the top, notes section below

### Contact Fields
- Claude's discretion on exact editable fields (success criteria specifies: display name, email, notes)
- Fields shown with placeholder text (e.g., "Add name...") encouraging agents to fill them in

### Internal Notes
- Notes section lives inside the same right panel, below contact info — one panel for everything
- Flat chronological list, newest-first, with author name and timestamp
- Append-only — notes cannot be edited or deleted once posted
- Note input: Claude's discretion on exact input UX (simple textarea vs inline expand)

### Auto-Creation & Data Flow
- Contact profile created automatically on first inbound message — no manual step
- Default display name: WhatsApp profile name from the message payload if available, fallback to phone number
- One phone number = one contact — no merge support
- Existing conversations get backfilled on deploy (one-time migration creates profiles for all existing phone numbers)
- Every conversation has a contact profile panel, regardless of who initiated (inbound or outbound)

### Empty & Edge States
- New contacts show editable fields with placeholders — encourages filling in details
- Notes section with no notes: just show the input field, no "empty state" message needed

### Claude's Discretion
- Exact editable fields beyond name/email/notes (e.g., whether to include custom key-value fields)
- Conversation history display in the profile panel (list of past conversations vs summary stats)
- Note input UX (textarea + button vs inline quick-add)
- WhatsApp profile name update policy (whether to auto-update if not manually edited)
- Loading skeleton and error state design
- Exact panel width and responsive behavior

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-customer-intelligence*
*Context gathered: 2026-02-22*
