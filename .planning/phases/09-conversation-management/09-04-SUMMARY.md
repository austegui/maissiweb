---
phase: 09-conversation-management
plan: "04"
subsystem: ui
tags: [radix-ui, react-tabs, react-select, conversation-status, ticket-lifecycle, spanish-ui]

# Dependency graph
requires:
  - phase: 09-conversation-management
    provides: PATCH /api/conversations/[id]/status endpoint, convStatus field in enriched GET /api/conversations

provides:
  - Radix Tabs status filter bar (Abierto | Pendiente | Resuelto | Todos) in ConversationList
  - Colored status dots (green/amber/gray) on each conversation row
  - Radix Select status dropdown in MessageView header
  - Optimistic status change with PATCH /api/conversations/[id]/status
  - Auto-reopen logic when inbound message arrives on a Resuelto conversation
  - statusFilter state in page.tsx (default 'abierto')
  - Etiquetas navigation link in inbox header
  - Conversation type extended with convStatus, assignedAgentId, assignedAgentName, labels

affects:
  - 09-05 (agent assignment UI - will use same convStatus state and assignedAgentId fields)
  - Future phases using conversation status business logic

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Radix Tabs for tab-strip filtering (no Tabs.Content, tab value drives filter state only)"
    - "Radix Select with Portal for status dropdown in message header"
    - "autoReopenedRef pattern to prevent repeated PATCH calls per conversation on polling"
    - "Optimistic UI update with revert-on-error for status changes"
    - "useRef-guarded side effects to prevent repeated async calls in polling callbacks"

key-files:
  created: []
  modified:
    - src/components/conversation-list.tsx
    - src/components/message-view.tsx
    - src/app/page.tsx

key-decisions:
  - "No Tabs.Content elements -- tab value drives filteredConversations computation only (filter happens in JS, no server round-trip)"
  - "autoReopenedRef stores conversationId (not boolean) to correctly scope the guard per conversation"
  - "localStatus initialized from convStatus prop, synced via useEffect on convStatus change (correct for conversation switching)"
  - "Auto-reopen resets autoReopenedRef when user manually sets status to 'resuelto' (so future inbound messages can re-trigger)"
  - "fetchMessages has localStatus in dependency array -- correct since auto-reopen reads it; memoization cost is acceptable"

patterns-established:
  - "Status dot colors: green-500 (abierto), amber-500 (pendiente), gray-400 (resuelto) -- consistent across list and dropdown"
  - "All status names in Spanish: Abierto, Pendiente, Resuelto, Todos"
  - "convStatus defaults to 'abierto' for conversations without metadata row (consistent with 09-02 backend rule)"

# Metrics
duration: 4min
completed: 2026-02-22
---

# Phase 9 Plan 04: Conversation Status Lifecycle UI Summary

**Radix Tabs status filter bar and Radix Select status dropdown enabling full ticket lifecycle (abierto/pendiente/resuelto) with auto-reopen on inbound message**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-22T03:34:58Z
- **Completed:** 2026-02-22T03:38:23Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Conversation list now shows status tabs (Abierto | Pendiente | Resuelto | Todos) with default 'abierto' tab
- Each conversation row has a colored status dot (green=abierto, amber=pendiente, gray=resuelto)
- Message view header has a Radix Select dropdown to change conversation status with optimistic UI
- Auto-reopen logic: when an inbound message arrives on a 'resuelto' conversation, it automatically PATCHes status back to 'abierto'
- Etiquetas nav link added to inbox header pointing to /admin/labels

## Task Commits

Each task was committed atomically:

1. **Task 1: Add status tabs and status dots to conversation list** - `23a72b5` (feat)
2. **Task 2: Add status dropdown and auto-reopen to message view** - `a0241c8` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/components/conversation-list.tsx` - Added Radix Tabs filter bar, status dot on each row, extended Conversation type, Spanish empty states
- `src/components/message-view.tsx` - Added Radix Select StatusSelect component, handleStatusChange with optimistic update, auto-reopen logic with autoReopenedRef guard
- `src/app/page.tsx` - Added statusFilter state (default 'abierto'), handleStatusChange callback, extended Conversation type, Etiquetas nav link, wired new props

## Decisions Made
- **No Tabs.Content elements** -- Tabs.Root value just drives the `filteredConversations` filter computation. No server round-trip on tab switch.
- **autoReopenedRef stores conversationId** (not a boolean), so the guard is correctly scoped: switching conversations resets the ref and a new inbound message on a different resolved conversation will auto-reopen correctly.
- **localStatus in fetchMessages dependency array** -- auto-reopen reads `localStatus`, so it must be in deps. The memoization re-runs when status changes, which is correct.
- **Auto-reopen resets when user sets status to 'resuelto' manually** -- so future inbound messages can re-trigger the auto-reopen. Without this reset, a conversation manually resolved and messaged again would not auto-reopen.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- STATUS-01 through STATUS-05 fully implemented
- `convStatus`, `assignedAgentId`, `assignedAgentName`, `labels` fields available in Conversation type throughout the app
- Ready for 09-05: agent assignment UI (will use `assignedAgentId` and `assignedAgentName` already in the type)

---
*Phase: 09-conversation-management*
*Completed: 2026-02-22*
