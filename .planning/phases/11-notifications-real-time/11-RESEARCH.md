# Phase 11: Notifications + Real-Time - Research

**Researched:** 2026-02-22
**Domain:** Supabase Realtime (Postgres Changes), Web Audio API, Browser Notification API, connection resilience
**Confidence:** HIGH (primary stack verified via official docs + live codebase inspection)

---

## Summary

Phase 11 has two distinct concerns: (1) audio + browser alerts when new inbound WhatsApp messages arrive, and (2) Supabase Realtime subscriptions so metadata changes (status, assignment, labels, notes, contact edits) appear instantly for all connected agents.

The existing `use-handoff-alerts.ts` hook already implements Web Audio API synthesis and the Browser Notification API for handoff events. Phase 11 replaces (or significantly extends) this hook to cover all inbound messages, scoped by alert scope (unassigned + assigned-to-me), with a per-user opt-out preference stored in `user_profiles`. No new npm dependencies are needed for alerts — the Web Audio API is already proven in the codebase.

For Realtime, Supabase's `postgres_changes` subscription is the correct approach and was already decided in v2.0. The tables that need Realtime enabled are: `conversation_metadata`, `conversation_notes`, `conversation_contact_labels`, and `contacts`. WhatsApp messages themselves live in Kapso (not Supabase), so message polling via `use-auto-polling` continues unchanged — Realtime only covers the Supabase metadata layer. A critical operational prerequisite is enabling the `supabase_realtime` publication for these tables in the Supabase Dashboard.

The main engineering challenges are: (a) the React `useEffect` cleanup pattern for Supabase channels to avoid React 19 strict-mode double-subscribe issues, (b) reconnection on `CHANNEL_ERROR` / `TIMED_OUT` / `CLOSED` status (Supabase does NOT auto-reconnect reliably — the app must detect and re-subscribe), (c) token-refresh staleness after the tab is backgrounded, and (d) distinguishing "messages the agent themselves just sent" to suppress the alert sound for own-sent messages.

**Primary recommendation:** Replace `use-handoff-alerts.ts` with a new `use-message-alerts.ts` hook covering all inbound alerts; add a `use-realtime-sync.ts` hook for Supabase channel subscriptions with a built-in reconnect loop; add `notifications_enabled` column to `user_profiles` for persistence; and enable `supabase_realtime` publication for four tables via a SQL migration.

---

## Standard Stack

### Core (already installed, no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.97.0 | Supabase Realtime client | Already installed; Realtime is built into the SDK |
| Web Audio API | Browser built-in | Synthesize chime notification sound | Already used in `use-handoff-alerts.ts` |
| Browser Notification API | Browser built-in | Show desktop notifications when tab not focused | Already used in `use-handoff-alerts.ts` |

### New Dependencies Required

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@radix-ui/react-switch` | ^1.2.6 | Toggle UI for notifications ON/OFF | Not yet installed; consistent with existing Radix pattern |

**Installation:**
```bash
npm install @radix-ui/react-switch
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Web Audio API synthesis | `howler.js` (7KB) or audio file | howler adds a dependency; current synthesis already works and is zero-dep |
| Web Audio API synthesis | `use-sound` npm package | Wrapper over Howler, still adds dependency |
| Radix Switch | Native `<input type="checkbox">` | Switch is the right semantic for on/off toggle; Radix ensures accessibility |
| `user_profiles` DB storage | `localStorage` | DB storage follows the user across devices; STACK.md decision was to store in DB |

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── hooks/
│   ├── use-handoff-alerts.ts        # REPLACE — rename/supersede with use-message-alerts.ts
│   ├── use-message-alerts.ts        # NEW — general inbound alert hook (sound + browser notif)
│   └── use-realtime-sync.ts         # NEW — Supabase Realtime subscription + reconnect logic
├── components/
│   └── notification-toggle.tsx      # NEW — Switch component for header or user menu
└── app/
    └── api/
        └── user/
            └── preferences/
                └── route.ts         # NEW — PATCH endpoint for notifications_enabled toggle
```

### Pattern 1: Supabase Realtime Channel Subscription with Reconnect

**What:** Subscribe to `postgres_changes` on a channel, detect non-`SUBSCRIBED` statuses, and re-subscribe with `removeChannel` + fresh channel.

**When to use:** All Realtime subscriptions in this codebase.

**Key lifecycle statuses (verified via official docs):**
- `SUBSCRIBED` — connected and receiving
- `CHANNEL_ERROR` — subscription error; must reconnect
- `TIMED_OUT` — server did not respond in time; must reconnect
- `CLOSED` — unexpectedly closed; must reconnect

**Cleanup pattern (verified via `realtime-js` monorepo docs):**
```typescript
// Source: https://github.com/supabase/supabase-js/tree/master/packages/core/realtime-js
channel.unsubscribe();
supabase.removeChannel(channel);
```

**Reconnect pattern (community-proven, GitHub discussions #1088, #27513):**
```typescript
// Source: https://github.com/supabase/realtime/issues/1088
useEffect(() => {
  let channel: ReturnType<typeof supabase.channel> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let isMounted = true;

  function subscribe() {
    if (!isMounted) return;
    channel = supabase
      .channel('conversation-metadata-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversation_metadata'
      }, (payload) => {
        // update local state
      })
      .subscribe((status) => {
        if (!isMounted) return;
        if (status === 'SUBSCRIBED') {
          setRealtimeConnected(true);
        } else if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          setRealtimeConnected(false);
          // Remove stale channel then retry after backoff
          if (channel) {
            supabase.removeChannel(channel);
            channel = null;
          }
          reconnectTimer = setTimeout(subscribe, 3000); // 3s initial backoff
        }
      });
  }

  subscribe();

  return () => {
    isMounted = false;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (channel) {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    }
  };
}, [supabase]);
```

**React 19 / Strict Mode note:** React Strict Mode double-mounts in development, which can cause the first `subscribe()` call to fire twice. The `isMounted` flag + `useEffect` cleanup handles this correctly — the cleanup on first unmount removes the channel, and the second mount creates a fresh one. This matches the community-proven approach (GitHub issue #169).

**CRITICAL:** Do NOT call `subscribe()` multiple times without first calling `removeChannel()` on the previous channel instance. This creates orphaned channel references in the RealtimeClient's internal `channels` array and causes duplicate event handling.

### Pattern 2: Table-Wide vs. Filtered Subscriptions

**What:** Supabase supports filtering by column value using `filter: 'column=eq.value'`.

**Decision for Phase 11:**
- `conversation_metadata` — subscribe TABLE-WIDE (no filter). All agents need to see all status/assignment changes across all conversations. A per-conversation filter would require one channel per conversation open in the UI.
- `conversation_notes` — subscribe with `filter: 'conversation_id=eq.${conversationId}'` so the ContactPanel only receives notes for the current conversation.
- `conversation_contact_labels` — subscribe TABLE-WIDE (labels affect the sidebar list for all conversations).
- `contacts` — subscribe TABLE-WIDE (contact edits affect the ContactPanel header).

**Filter syntax (verified via official Postgres Changes docs):**
```typescript
// Source: https://supabase.com/docs/guides/realtime/postgres-changes
filter: 'conversation_id=eq.abc123'
```

### Pattern 3: Alert Scope Filtering

**What:** Only alert for conversations that are either unassigned OR assigned to the current user. Suppress alerts for conversations assigned to other agents.

**Implementation:** The `onConversationsUpdated` callback already receives `currentUserId` (from `/api/conversations` response). Apply filter in the alert hook:

```typescript
function shouldAlert(conv: Conversation, currentUserId: string | undefined): boolean {
  if (!conv.lastMessage || conv.lastMessage.direction !== 'inbound') return false;
  // Only alert for unassigned or my conversations
  if (conv.assignedAgentId && conv.assignedAgentId !== currentUserId) return false;
  return true;
}
```

### Pattern 4: Suppressing Alerts for Own-Sent Messages

**What:** NOTIF-04 requires that sound does not play for messages the agent themselves just sent.

**Implementation:** Track the timestamp or ID of the last outbound message the current user sent. When polling detects a new `lastMessage` with `direction === 'outbound'`, check if it was created within the last ~5 seconds (debounce window). If so, suppress the alert.

A simpler approach: When an agent sends a message via `MessageView`, set a `lastSentAt` ref in the hook. The polling `onConversationsUpdated` callback skips the alert if `Date.now() - lastSentAt < 5000`.

**Alternative signal:** The conversations list's `lastMessage.direction === 'outbound'` already tells us the last message was outbound. Since agents only see inbound messages as alerts (by the `direction !== 'inbound'` guard in Pattern 3), the only edge case is: agent sends a message, the conversation's `lastMessage` flips to outbound, but at the exact same poll cycle the previous inbound message was already seen. Because of the `prevHandoffIdsRef`-style tracking (compare prev vs new), this edge case is naturally handled — there's no new inbound to alert on.

### Pattern 5: Web Audio API Chime Sound

**What:** The existing `createBeepSound()` in `use-handoff-alerts.ts` creates a two-tone 880Hz + 1108Hz exponential envelope. Per Phase 11 decisions, the sound should feel like a real chat app (WhatsApp / Slack style).

**AudioContext lifecycle (verified via MDN best practices):**
- `AudioContext` starts `suspended` if created outside a user gesture (browser autoplay policy)
- Must call `audioCtx.resume()` inside a click handler before playing
- The current implementation handles this correctly by creating the `AudioContext` inside the audio setup function called on first click

**Chime design for Phase 11:**

Replace the raw beep with a pleasant ascending two-note chime:

```typescript
// Source: MDN Web Audio API docs
function createChimeSound(audioContext: AudioContext): void {
  const now = audioContext.currentTime;
  const notes = [
    { freq: 1046.50, startAt: 0,    duration: 0.15 },  // C6
    { freq: 1318.51, startAt: 0.12, duration: 0.25 },  // E6
  ];

  for (const note of notes) {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(note.freq, now + note.startAt);
    gain.gain.setValueAtTime(0.4, now + note.startAt);
    gain.gain.exponentialRampToValueAtTime(0.001, now + note.startAt + note.duration);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start(now + note.startAt);
    osc.stop(now + note.startAt + note.duration);
  }
}
```

**Cooldown implementation:** Track `lastChimeAt` ref. If `Date.now() - lastChimeAt < cooldownMs`, skip playing. Recommended cooldown: 3000ms (3 seconds).

### Pattern 6: Notification Preference Toggle

**What:** Single toggle stored in `user_profiles.notifications_enabled BOOLEAN NOT NULL DEFAULT true`.

**SQL migration:**
```sql
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN NOT NULL DEFAULT true;
```

**API route (`PATCH /api/user/preferences`):**
```typescript
// Pattern: reads current user from session, updates their user_profiles row
const { data: { user } } = await supabase.auth.getUser();
await supabase
  .from('user_profiles')
  .update({ notifications_enabled: enabled })
  .eq('id', user.id);
```

**Client-side:** Read preference on mount, store in state. Toggle calls PATCH. While PATCH is in-flight, optimistic UI update (toggle visually immediately, revert on error).

### Pattern 7: Connection State Visibility

**What:** Show a subtle indicator when Realtime is disconnected; hide it when connected.

**Recommendation (Claude's discretion):** A small dot in the header (similar to the existing `isPolling` pulse dot in `conversation-list.tsx`) rather than a full banner. A banner would be too disruptive for a transient network hiccup. Use a `realtimeConnected` boolean from `use-realtime-sync.ts` to conditionally render a gray dot with tooltip "Conexión en tiempo real perdida. Reconectando...".

**Fallback mode:** When `realtimeConnected` is false for >30 seconds, `use-auto-polling` in `conversation-list.tsx` temporarily reduces its interval from 10s to 5s for more frequent data refresh. Reset to 10s once Realtime reconnects.

### Anti-Patterns to Avoid

- **Creating a new channel without `removeChannel`**: Leaks channels in the internal channels array, causes duplicate events.
- **Not handling `TIMED_OUT` as an error**: It behaves like `CHANNEL_ERROR` and requires re-subscription.
- **Storing audio context outside user gesture scope**: Browser autoplay policy will block it; always `resume()` in a click handler before playing.
- **Subscribing to all changes on `conversation_notes` without a filter**: Every note across all conversations gets sent to every connected client — unnecessary traffic. Filter by `conversation_id`.
- **Sharing a single Supabase client instance for SSR and Realtime**: Realtime only works with the browser client (`createBrowserClient`). The server client (`createServerClient`) does not support WebSocket connections. Always use `createClient()` from `@/lib/supabase/client` for Realtime hooks.
- **Requesting Notification permission without a user gesture**: Chrome and Firefox block `Notification.requestPermission()` calls that don't originate from a user interaction. Use the existing pattern in `use-handoff-alerts.ts` (attach to first click/keydown event).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket + reconnect logic | Custom WebSocket client with exponential backoff | Supabase Realtime channel API + manual retry in subscribe callback | Supabase handles WS framing, heartbeats, auth token injection — only reconnect at the channel level |
| Sound files delivery | Serve `.mp3` or `.wav` files as static assets | Web Audio API synthesis (already in codebase) | No file to manage, no CDN dependency, instant, works offline |
| Push notifications (background) | Service Worker + Push API + VAPID keys | Browser Notification API (tab must be open) | Phase 11 scope is "tab not focused but open" — full push notifications require a service worker and server-side push endpoint, which is out of scope |
| Polling replacement | Build a complete message queue system | Keep existing `use-auto-polling` as safety net | Kapso messages don't live in Supabase — polling is the only mechanism for new WhatsApp messages |

**Key insight:** Supabase Realtime is a complement to polling, not a replacement. Messages come from Kapso (external), so polling continues. Realtime only handles the Supabase metadata layer.

---

## Common Pitfalls

### Pitfall 1: Realtime Publication Not Enabled

**What goes wrong:** Subscription returns `SUBSCRIBED` status but no events are delivered. `postgres_changes` payloads never fire. Code looks correct but nothing happens.

**Why it happens:** Tables must be explicitly added to the `supabase_realtime` publication in the Supabase Dashboard before events are streamed. This is a dashboard-side configuration step, not a code step.

**How to avoid:** The plan must include a SQL step (or dashboard step) to run:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_metadata;
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_contact_labels;
ALTER PUBLICATION supabase_realtime ADD TABLE contacts;
```

**Warning signs:** Events fire in the Supabase Dashboard Realtime inspector but never reach the client code.

### Pitfall 2: Stale JWT After Tab Backgrounding

**What goes wrong:** After a tab is left in the background for extended periods (15+ minutes), the Supabase auth token expires. When the user returns to the tab, Realtime channels fail with `CHANNEL_ERROR` or `ErrorAuthorizingWebsocket`. The subscribe callback fires but re-subscribing still fails because the token in the Realtime connection is stale.

**Why it happens:** The Supabase JS client automatically refreshes auth tokens for API calls but does NOT refresh the token used by persistent WebSocket Realtime connections (verified via GitHub issue #274 in `realtime-js`).

**How to avoid:** On `CHANNEL_ERROR`, before re-subscribing, call `supabase.auth.refreshSession()` to ensure the token is fresh. If refresh fails (session expired), redirect to login. Alternatively, use `document.visibilitychange` to remove all channels when the tab hides and re-subscribe when it becomes visible again (the proven pattern from issue #1088).

**Implementation:**
```typescript
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Remove all channels to avoid stale token issues
    supabase.removeAllChannels();
  } else {
    // Re-subscribe with fresh token
    initializeRealtimeSubscriptions();
  }
});
```

### Pitfall 3: React Strict Mode Double-Mount

**What goes wrong:** In development, React Strict Mode mounts and immediately unmounts every component twice. The cleanup on the first unmount calls `removeChannel()`, but if `subscribe()` hasn't resolved yet, the channel may be in a liminal state. The second mount creates a new subscription while the first is still tearing down.

**Why it happens:** React 18+ and 19 Strict Mode double-invoke effects to detect impure effects.

**How to avoid:** The `isMounted` flag pattern (Pattern 1 above) handles this. When cleanup fires, `isMounted = false` prevents any reconnect timer from creating a new channel. The returned cleanup function calls `removeChannel()` synchronously. This matches the resolved pattern from GitHub issue #169.

### Pitfall 4: Notification Permission Blocked by Browser Policy

**What goes wrong:** `Notification.requestPermission()` is called programmatically (not in response to a user click). Chrome silently ignores it. Permission stays at `"default"` forever. Browser notifications never appear.

**Why it happens:** Chrome blocks permission prompts that are not triggered by user gestures (clicks, keypresses). The Permissions API requires a user-activation-gated call.

**How to avoid:** Request permission inside the click handler for the notification toggle. The existing pattern in `use-handoff-alerts.ts` already handles this correctly (attaches to the first `click` or `keydown` event). Replicate this in the new `use-message-alerts.ts` hook.

### Pitfall 5: Multiple Channels for Same Table (Channel Naming Collision)

**What goes wrong:** If the channel name is not unique, Supabase treats subscriptions with the same topic as the same channel. Two components subscribing with `.channel('metadata-changes')` end up sharing a channel, which can cause unexpected behavior or duplicate event handling.

**How to avoid:** Use unique, descriptive channel names. Convention: `'realtime:table-name'` or include a user ID for user-scoped subscriptions. Keep all channel management in a single `use-realtime-sync.ts` hook rather than creating channels in multiple components.

### Pitfall 6: Alert Fires for Own Outbound Messages

**What goes wrong:** After an agent sends a message, the `conversations` poll returns with `lastMessage.direction === 'outbound'`. If the detection logic only checks for NEW conversations (not already seen), and a conversation appears "new" in the list due to re-ordering, an alert could fire incorrectly.

**Why it happens:** The polling comparison in `use-handoff-alerts.ts` uses a `prevHandoffIdsRef` to detect brand-new conversations. For message alerts, the detection is subtler — we need to detect when a conversation's `lastMessage` changes to a NEW inbound message.

**How to avoid:** Track per-conversation the `lastMessage.id` or `lastActiveAt` seen during the previous poll. An alert fires only when the new value indicates an inbound message AND the `lastActiveAt` is newer than the previously recorded value. This prevents false alerts on own-sent messages.

### Pitfall 7: Audio Context Suspended Before First Click

**What goes wrong:** The `AudioContext` is created eagerly in `useEffect` (as the current `use-handoff-alerts.ts` does), but the browser autoplay policy puts it in `suspended` state. The first alert sound fails to play silently because `play()` resolves immediately but produces no sound.

**Why it happens:** Chrome autoplay policy requires a user gesture before audio can play.

**How to avoid:** Keep the existing pattern: create the `AudioContext` lazily (on first user interaction) or call `audioCtx.resume()` inside the notification toggle's click handler. The current `createBeepSound()` approach creates the context inside the function call which is triggered by user interaction — this is correct. Ensure the new chime creation follows the same pattern.

---

## Code Examples

Verified patterns from official sources and codebase:

### Supabase Realtime Subscription with Cleanup

```typescript
// Source: https://github.com/supabase/supabase-js/tree/master/packages/core/realtime-js
// + community patterns from https://github.com/supabase/realtime/issues/1088

import { createClient } from '@/lib/supabase/client';

export function useRealtimeSync(onMetadataChange: (payload: unknown) => void) {
  const supabase = useMemo(() => createClient(), []);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;
    let retryDelay = 3000;

    const subscribe = () => {
      if (!isMounted) return;
      channel = supabase
        .channel('realtime:conversation-metadata')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'conversation_metadata',
        }, onMetadataChange)
        .subscribe((status) => {
          if (!isMounted) return;
          if (status === 'SUBSCRIBED') {
            setRealtimeConnected(true);
            retryDelay = 3000; // reset backoff on success
          } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
            setRealtimeConnected(false);
            if (channel) {
              supabase.removeChannel(channel);
              channel = null;
            }
            reconnectTimer = setTimeout(subscribe, retryDelay);
            retryDelay = Math.min(retryDelay * 2, 30000); // exponential backoff, max 30s
          }
        });
    };

    subscribe();

    // Reconnect on tab visibility change (handles stale JWT)
    const handleVisibility = () => {
      if (!document.hidden && isMounted) {
        if (channel) {
          supabase.removeChannel(channel);
          channel = null;
        }
        if (reconnectTimer) clearTimeout(reconnectTimer);
        retryDelay = 3000;
        subscribe();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibility);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (channel) {
        channel.unsubscribe();
        supabase.removeChannel(channel);
      }
    };
  }, [supabase, onMetadataChange]);

  return { realtimeConnected };
}
```

### Chime Sound Synthesis

```typescript
// Source: MDN Web Audio API docs, extended from existing use-handoff-alerts.ts pattern

function createChimeSound(audioCtx: AudioContext): void {
  const now = audioCtx.currentTime;
  // Two ascending notes: D6 (1174Hz) then F#6 (1480Hz)
  const notes = [
    { freq: 1174.66, delay: 0,    duration: 0.18 },
    { freq: 1479.98, delay: 0.14, duration: 0.28 },
  ];
  for (const note of notes) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(note.freq, now + note.delay);
    gain.gain.setValueAtTime(0.35, now + note.delay);
    gain.gain.exponentialRampToValueAtTime(0.001, now + note.delay + note.duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now + note.delay);
    osc.stop(now + note.delay + note.duration + 0.05);
  }
}
```

### Notification Toggle with Radix Switch

```typescript
// Source: https://www.radix-ui.com/primitives/docs/components/switch
import * as Switch from '@radix-ui/react-switch';

export function NotificationToggle({ enabled, onToggle }: {
  enabled: boolean;
  onToggle: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="notif-toggle" className="text-xs text-[#667781]">
        Notificaciones
      </label>
      <Switch.Root
        id="notif-toggle"
        checked={enabled}
        onCheckedChange={onToggle}
        className="w-9 h-5 rounded-full bg-[#d1d7db] data-[state=checked]:bg-[#00a884] transition-colors relative outline-none"
      >
        <Switch.Thumb className="block w-4 h-4 bg-white rounded-full shadow transition-transform translate-x-0.5 data-[state=checked]:translate-x-4" />
      </Switch.Root>
    </div>
  );
}
```

### Enabling Realtime Publication (SQL)

```sql
-- Source: https://supabase.com/docs/guides/realtime/postgres-changes
-- Run in Supabase Dashboard > SQL Editor (or include in a migration)
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_metadata;
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_contact_labels;
ALTER PUBLICATION supabase_realtime ADD TABLE contacts;
```

### Adding notifications_enabled to user_profiles (SQL)

```sql
-- Run in Supabase Dashboard > SQL Editor
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN NOT NULL DEFAULT true;
```

### Browser Notification with Contact Name + Preview

```typescript
// Source: Browser Notification API (MDN) + existing use-handoff-alerts.ts pattern
async function showMessageNotification(conv: ConversationData) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const name = conv.contactName || conv.phoneNumber || 'Cliente';
  const preview = conv.lastMessage?.content?.slice(0, 60) ?? '';

  const notification = new Notification(`${name}: ${preview}`, {
    icon: '/favicon.ico',
    tag: `message-${conv.id}`,   // prevents duplicate notifs for same conversation
    body: `${name}: ${preview}`,
  });

  notification.onclick = () => {
    window.focus();
    notification.close();
  };
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom SSE for real-time | Supabase Realtime (WebSocket) | v2.0 decision | Bypasses Vercel 300s ceiling; built-in reconnect infrastructure |
| Handoff-only alerts | All inbound message alerts (scoped) | Phase 11 | Agents never miss any new message |
| Preferences in localStorage | Preferences in `user_profiles` DB column | Phase 11 | Follows user across devices/sessions |
| Single alert hook (`use-handoff-alerts`) | Split into alerts hook + realtime sync hook | Phase 11 | Separation of concerns; alerts vs. data sync are different problems |

**Deprecated/outdated:**
- `use-handoff-alerts.ts`: Will be superseded by `use-message-alerts.ts`. The handoff detection logic may be preserved inside the new hook or removed if the handoff visual treatment is kept separately.
- Raw beep oscillator (880Hz + 1108Hz): Replace with 2-note ascending chime.

---

## Open Questions

1. **Should handoff visual treatment (amber border + badge) be preserved in Phase 11?**
   - What we know: `use-handoff-alerts.ts` returns `alertingIds` used in `conversation-list.tsx` for the amber border + badge. This is a separate concern from the sound alert.
   - What's unclear: Phase 11 expands alerts to all inbound messages — does the special handoff visual still make sense as a distinct category?
   - Recommendation: Preserve the handoff visual indicator (amber border/badge) as a separate concept from the audio alert. The alert scope now covers all inbound (scoped to unassigned + mine), but the handoff badge distinguishes conversations that have been specifically flagged for human handoff. Keep `alertingIds` for the handoff badge even if the sound now covers a broader set.

2. **How to surface the notification toggle in the header without cluttering it?**
   - What we know: The current header has: logo, admin links (Etiquetas, Canned Responses, Settings), and Sign out. Claude's discretion on toggle placement.
   - Recommendation: Place a small Bell icon button in the header (between admin links and Sign out). When notifications are ON: filled bell, green-500. When OFF: outlined bell, gray-400. Click toggles and calls the PATCH API. No separate settings page needed for a single toggle.

3. **What happens to `conversation_contact_labels` Realtime events — which component reacts?**
   - What we know: Label changes affect the conversation list sidebar (pills under each conversation).
   - Recommendation: On a `conversation_contact_labels` Realtime event, trigger a re-fetch of `/api/conversations` (just call `fetchConversations()` in `ConversationList` via its `ref.current.refresh()` or a callback). This is simpler than trying to update the complex nested labels structure in-place.

4. **What is the fallback polling interval when Realtime is disconnected?**
   - Claude's discretion per CONTEXT.md.
   - Recommendation: Normal safety-net interval = 10s (existing). Fallback mode (Realtime disconnected) = 5s. The `realtimeConnected` boolean from `use-realtime-sync.ts` drives this. Pass it as a prop or via context to `ConversationList` to adjust its `useAutoPolling` interval.

---

## Sources

### Primary (HIGH confidence)
- [Supabase Realtime Postgres Changes Docs](https://supabase.com/docs/guides/realtime/postgres-changes) — subscription API, filter syntax, publication setup, replica identity
- [Supabase Realtime Error Codes](https://supabase.com/docs/guides/realtime/error_codes) — CHANNEL_ERROR, TIMED_OUT, CLOSED meanings
- [Supabase realtime-js monorepo](https://github.com/supabase/supabase-js/tree/master/packages/core/realtime-js) — channel status lifecycle, removeChannel/unsubscribe pattern
- [MDN Web Audio API Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices) — AudioContext lifecycle, autoplay policy, OscillatorNode patterns
- [MDN Notification.requestPermission()](https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission_static) — permission states, user gesture requirement
- [Radix UI Switch](https://www.radix-ui.com/primitives/docs/components/switch) — Switch component API, version ^1.2.6
- Codebase: `src/hooks/use-handoff-alerts.ts` — existing Web Audio + Notification API implementation
- Codebase: `src/hooks/use-auto-polling.ts` — existing polling infrastructure
- Codebase: `src/app/api/conversations/route.ts` — Supabase tables in use, data shape
- Codebase: `package.json` — confirmed @supabase/supabase-js ^2.97.0, @radix-ui/react-switch NOT yet installed

### Secondary (MEDIUM confidence)
- [Supabase Realtime Reconnection Discussion #1088](https://github.com/supabase/realtime/issues/1088) — removeChannel + re-subscribe pattern on TIMED_OUT/CLOSED; community-proven, no official Supabase team confirmation
- [Supabase Realtime Strict Mode Issue #169](https://github.com/supabase/realtime-js/issues/169) — `isMounted` flag for React Strict Mode double-mount; resolved by Next.js version upgrade
- [Supabase Token Refresh Issue #274](https://github.com/supabase/realtime-js/issues/274) — stale token after backgrounding; visibilitychange handler recommended
- [MakerKit Real-time Notifications Guide](https://makerkit.dev/blog/tutorials/real-time-notifications-supabase-nextjs) — deduplication pattern for merging real-time events with cached data

### Tertiary (LOW confidence)
- WebSearch results on notification preference storage patterns — confirmed general pattern (store in DB for cross-device), but no specific authoritative source for the exact implementation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies beyond `@radix-ui/react-switch` (npm verified ^1.2.6); all other tools already in codebase
- Architecture (Realtime patterns): HIGH — verified via official Supabase docs; reconnect pattern is MEDIUM (community-proven, not officially documented)
- Audio/notification patterns: HIGH — verified via MDN official docs; existing codebase implementation confirms viability
- Pitfalls: HIGH for publication setup (very common mistake, officially documented); MEDIUM for JWT staleness (GitHub issue, not official docs)

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (Supabase Realtime API is stable; Web Audio API is a browser standard)
