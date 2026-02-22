---
phase: 11-notifications-real-time
plan: 02
subsystem: ui
tags: [web-audio-api, browser-notifications, react-hooks, lucide-react, supabase, next-js]

# Dependency graph
requires:
  - phase: 11-01
    provides: notifications_enabled column on user_profiles, Realtime publication enabled

provides:
  - useMessageAlerts hook: Web Audio chime + browser notifications for inbound messages with scope filtering, cooldown, own-sent suppression
  - NotificationToggle component: Bell/BellOff header button with green/gray visual states
  - GET/PATCH /api/user/preferences: persistent per-user notification preference
  - Cleaned useHandoffAlerts: visual-only handoff detection (amber border + badge), no audio

affects:
  - 11-03 (Supabase Realtime subscription — will hook into same conversation update pipeline)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Web Audio API synthesis (lazily created AudioContext, oscillator + gainNode exponential decay)
    - Two-stage alert architecture: useHandoffAlerts (visual) + useMessageAlerts (audio/notifications)
    - lastActiveAt-based new message detection (Map ref tracking prev vs current)
    - Own-sent suppression via markSentMessage + 5s timestamp window

key-files:
  created:
    - src/hooks/use-message-alerts.ts
    - src/components/notification-toggle.tsx
    - src/app/api/user/preferences/route.ts
  modified:
    - src/app/page.tsx
    - src/hooks/use-handoff-alerts.ts
    - src/components/message-view.tsx

key-decisions:
  - "useMessageAlerts handles ALL audio + browser notifications (subsumes handoff alerts too); useHandoffAlerts is visual-only"
  - "AudioContext created lazily at module level (singleton) to survive React re-renders without re-creating"
  - "lastActiveAt change detection for new message (not just message count) — more reliable across polling cycles"
  - "isBrandNew branch handles first-seen conversations so initial load does not spam alerts"
  - "NotificationToggle uses optimistic toggle with revert on PATCH error"
  - "Notification permission requested via one-time click/keydown listeners (same pattern as old useHandoffAlerts)"

patterns-established:
  - "Two-hook alert architecture: one for visual state (handoff), one for audio/browser (all inbound)"
  - "markSentMessage pattern: call after successful send, suppress alerts for 5s window"
  - "Preference API: GET defaults to true if no DB row exists"

# Metrics
duration: 7min
completed: 2026-02-22
---

# Phase 11 Plan 02: Inbound Message Alert System Summary

**Web Audio chime (C6+E6) + browser notifications for all inbound messages, with bell toggle persisted to user_profiles.notifications_enabled, own-sent suppression via markSentMessage, and useHandoffAlerts reduced to visual-only**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-22T06:09:37Z
- **Completed:** 2026-02-22T06:17:30Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created `useMessageAlerts` hook: synthesizes two-note ascending chime via Web Audio API, shows browser notifications with contact name + 60-char preview, filters to unassigned and assigned-to-me conversations only, 3-second chime cooldown, 5-second own-sent suppression
- Created `NotificationToggle` component with Bell/BellOff lucide icons and green/gray states; integrated into header between admin links and Sign out
- Created `GET`/`PATCH /api/user/preferences` endpoint reading/writing `notifications_enabled` on `user_profiles`; loaded on mount, toggle persists immediately
- Stripped `useHandoffAlerts` of all audio/notification code (was duplicating alert concerns); now purely tracks handoff IDs for amber visual treatment

## Task Commits

Each task was committed atomically:

1. **Task 1: Create message alerts hook, notification toggle, and preferences API** - `f3f927d` (feat)
2. **Task 2: Integrate alerts and toggle into page.tsx** - `067bfb3` (feat)

**Plan metadata:** `[pending]` (docs: complete plan)

## Files Created/Modified
- `src/hooks/use-message-alerts.ts` - Alert hook: Web Audio chime, browser notifications, scope filter, cooldown, own-sent suppression
- `src/components/notification-toggle.tsx` - Bell/BellOff header toggle with green/gray states
- `src/app/api/user/preferences/route.ts` - GET and PATCH endpoints for notifications_enabled preference
- `src/app/page.tsx` - Imports both hooks, fetches preference on mount, calls both hooks in handleConversationsLoaded, passes markSentMessage, renders NotificationToggle
- `src/hooks/use-handoff-alerts.ts` - Stripped to visual-only (removed AudioContext, createBeepSound, audioBufferToWav, writeString, requestNotificationPermission, showBrowserNotification, audioRef)
- `src/components/message-view.tsx` - Added onMessageSent prop, calls it after successful send

## Decisions Made
- useMessageAlerts handles ALL audio + browser notifications for inbound messages, which naturally subsumes handoff notifications too — no need for separate handoff sound
- AudioContext created lazily as module-level singleton (not inside React component) to survive re-renders and avoid multiple AudioContext instances
- Detection uses `lastActiveAt` change rather than message count — avoids false triggers when conversations are filtered in/out of the list
- `isBrandNew` branch (first time a conversation is seen) excluded from alerting to avoid spray of alerts on initial page load
- NotificationToggle calls PATCH optimistically, reverts state on network error
- Preference API defaults to `notifications_enabled: true` when no user_profiles row exists yet (new users should hear alerts)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Next Phase Readiness
- Alert infrastructure complete — chime + browser notifications working for polling-based updates
- 11-03 (Supabase Realtime) will provide push-based conversation updates; it can call `onMessageAlert(convs)` the same way polling does
- `notifications_enabled` column exists in user_profiles (created in 11-01); PATCH endpoint now reads/writes it correctly

---
*Phase: 11-notifications-real-time*
*Completed: 2026-02-22*
