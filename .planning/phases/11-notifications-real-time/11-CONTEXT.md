# Phase 11: Notifications + Real-Time - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Sound and browser alerts for new inbound messages so agents never miss a conversation, plus Supabase Realtime for instant metadata and message sync across all connected agents. Covers: audio alerts, browser notifications, notification preferences, Realtime subscriptions for metadata (status, assignment, labels, notes, contact edits) and messages (inbound + outbound), connection resilience with polling fallback.

</domain>

<decisions>
## Implementation Decisions

### Alert experience
- Chat-app chime sound (WhatsApp Web / Slack style) — not a raw beep
- Play once then cooldown on rapid messages — suppress repeated chimes within a few seconds
- Alert scope: only unassigned conversations + conversations assigned to me — skip other agents' conversations
- Browser notification (tab unfocused): show contact name + message preview (e.g., "Maria Lopez: Hola, quiero preguntar sobre...")
- Sound does not play for messages the agent themselves just sent

### Real-time sync scope
- Full real-time sync: status, assignment, labels, notes, contact edits — everything
- New messages (both inbound customer messages and outbound agent replies) arrive via Supabase Realtime — truly instant
- Last write wins for concurrent metadata edits — simple, other agent sees the update instantly via Realtime

### Notification preferences
- Single toggle: notifications ON/OFF (controls both sound and browser notifications together)
- Stored per-user in database (user_profiles) — follows the user across devices/sessions
- Default: notifications ON for new users (opt-out model)
- Toggle placement: Claude's discretion

### Connection state visibility
- Disconnect indicator: Claude's discretion (banner vs subtle indicator)
- On reconnect: auto-refresh stale data silently — no user action needed
- Fall back to polling if Realtime stays disconnected for too long — app stays usable
- Existing Kapso polling mechanism kept as background safety net at slower interval — guarantees data freshness even if Realtime misses something

### Claude's Discretion
- Notification toggle placement in UI (header icon vs user menu)
- Disconnect indicator style (banner vs dot/icon)
- Chime sound file selection
- Cooldown duration for rapid message suppression
- Polling interval when in fallback mode vs normal safety-net mode
- Reconnection retry strategy timing

</decisions>

<specifics>
## Specific Ideas

- Existing `use-handoff-alerts.ts` hook already uses Web Audio API + browser Notification API — extend or replace for general message alerts
- Supabase Realtime decided in v2.0 architecture (replaces custom SSE due to Vercel 300s ceiling)
- The chime should feel like a real chat app, not a system beep

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-notifications-real-time*
*Context gathered: 2026-02-22*
