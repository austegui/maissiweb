---
phase: 11-notifications-real-time
plan: 03
subsystem: realtime
tags: [supabase-realtime, websocket, multi-agent, polling, react-hooks]

# Dependency graph
requires:
  - phase: 11-01
    provides: Supabase Realtime publication enabled for 4 tables via ALTER PUBLICATION SQL
  - phase: 11-02
    provides: Polling infrastructure (useAutoPolling) and ConversationList with auto-refresh
provides:
  - Supabase Realtime multi-table subscription for instant cross-agent metadata sync
  - Automatic reconnection with exponential backoff (3s to 30s cap)
  - Tab visibility reconnect with immediate stale data refresh
  - Visual disconnection indicator (amber pulsing dot in header)
  - Polling fallback: 5s when Realtime disconnected, 10s when connected
affects: [12-template-management, 13-search, 14-final-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Lazy useRef Supabase client initialization (SSR-safe: createClient() inside useEffect, never during render)
    - Single Realtime channel with multiple .on() postgres_changes handlers (one channel, four tables)
    - Debounced re-fetch callback (500ms) batches rapid Realtime events into single refresh
    - Exponential backoff reconnection using setTimeout recursion, ref-tracked delay

key-files:
  created:
    - src/hooks/use-realtime-sync.ts
  modified:
    - src/app/page.tsx
    - src/components/conversation-list.tsx
    - src/hooks/use-auto-polling.ts

key-decisions:
  - "Supabase client created lazily inside useEffect (not useMemo) to avoid SSR prerender crash when NEXT_PUBLIC env vars missing locally"
  - "Single channel 'realtime:metadata-sync' with 4 .on() handlers — avoids connection overhead of multiple channels"
  - "realtimeConnected === false (strict) so undefined (pre-init) keeps 10s polling, only explicit false triggers 5s fallback"
  - "useEffect([interval]) in useAutoPolling syncs baseIntervalRef and currentIntervalRef so polling picks up new interval on next cycle"
  - "Visibility change handler calls both subscribe() and onDataChange() immediately — fresh token + refresh stale data"

patterns-established:
  - "SSR-safe browser-only hook pattern: refs initialized in useEffect, never in useMemo or module scope"
  - "Stable callback via useRef pattern: onDataChangeRef.current = onDataChange updates ref each render without causing re-subscription"

# Metrics
duration: 4min
completed: 2026-02-22
---

# Phase 11 Plan 03: Realtime Metadata Sync Summary

**Supabase Realtime multi-table subscription (conversation_metadata, contacts, labels, notes) with exponential backoff reconnection, visibility-change re-subscribe, amber disconnect indicator, and 5s polling fallback — enabling instant cross-agent updates without page refresh.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-02-22T06:21:52Z
- **Completed:** 2026-02-22T06:26:05Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- Created `useRealtimeSync` hook that subscribes to 4 Postgres tables on a single Supabase Realtime channel with debounced re-fetch, exponential backoff reconnection (3s–30s), and visibility change handling
- Integrated Realtime sync into `page.tsx` — metadata changes from any agent trigger automatic conversation list refresh across all connected sessions
- Added visual disconnect indicator (amber `animate-pulse` dot) in the header and 5s polling fallback when Realtime connection is lost

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Realtime sync hook** - `3ab7dc6` (feat)
2. **Task 2: Integrate Realtime sync into page and conversation-list** - `eb4063a` (feat)

**Plan metadata:** (committed with SUMMARY.md)

## Files Created/Modified
- `src/hooks/use-realtime-sync.ts` - New hook: single-channel Realtime subscription for 4 tables, exponential backoff, visibility change handling, debounced callback
- `src/app/page.tsx` - Added useRealtimeSync import, handleRealtimeChange callback, realtimeConnected state, amber dot indicator, realtimeConnected prop on ConversationList
- `src/components/conversation-list.tsx` - Added realtimeConnected prop, dynamic pollingInterval (5s/10s)
- `src/hooks/use-auto-polling.ts` - Added useEffect([interval]) to sync interval refs when prop changes

## Decisions Made
- **Lazy Supabase client init:** Used `useRef` + `useEffect` initialization instead of `useMemo` to prevent `createBrowserClient()` from throwing during Next.js SSR prerendering when `NEXT_PUBLIC_SUPABASE_*` env vars are absent locally. The `useMemo` approach caused a build-breaking prerender error.
- **Single channel, multiple handlers:** One `supabase.channel('realtime:metadata-sync')` with four `.on('postgres_changes', ...)` chains instead of four separate channels — reduces WebSocket connection overhead.
- **Strict `=== false` check:** `realtimeConnected === false` (not `!realtimeConnected`) ensures `undefined` (the initial state before `useEffect` fires) keeps the default 10s polling interval rather than triggering the 5s fallback.
- **Interval ref sync effect:** Added `useEffect(() => { baseIntervalRef.current = interval; currentIntervalRef.current = interval; }, [interval])` to `useAutoPolling` so that when `pollingInterval` toggles between 5000 and 10000, the next timer reschedule uses the updated value.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Lazy Supabase client initialization to fix SSR prerender crash**
- **Found during:** Task 2 verification (`npm run build`)
- **Issue:** `useMemo(() => createClient(), [])` in `useRealtimeSync` ran during Next.js static prerendering, where `NEXT_PUBLIC_SUPABASE_URL` is empty, causing `@supabase/ssr` to throw: "Your project's URL and API key are required"
- **Fix:** Moved `createClient()` into a `useRef` + `useEffect` pattern — client is created only in the browser, never during SSR
- **Files modified:** `src/hooks/use-realtime-sync.ts`
- **Verification:** `npm run build` succeeds after fix; no TypeScript errors
- **Committed in:** `eb4063a` (part of Task 2 commit, hook file updated in place)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug: SSR-unsafe client instantiation)
**Impact on plan:** Essential correctness fix. Build would fail in any environment without `NEXT_PUBLIC_*` env vars at build time. No scope creep.

## Issues Encountered
- `useMemo` runs during SSR prerendering for `'use client'` components in Next.js 15, contrary to common assumption. Switching to `useRef` lazy init inside `useEffect` is the correct SSR-safe pattern for browser-only client instances.

## User Setup Required
None — no external service configuration required. Supabase Realtime publication was already enabled in plan 11-01 (SQL migration).

## Next Phase Readiness
- Phase 11 (Notifications & Real-time) is now **complete** — all 3 plans executed
- Phase 12 (Template Management) can proceed without any dependencies on this phase
- The `realtimeConnected` boolean is available as a prop pattern that future phases can reuse if they need connection state awareness

---
*Phase: 11-notifications-real-time*
*Completed: 2026-02-22*
