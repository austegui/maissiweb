---
phase: 14-audit-cleanup
plan: 01
subsystem: ui, api
tags: [supabase, rbac, contact-panel, message-view, preferences, role]

# Dependency graph
requires:
  - phase: 10-contact-profiles
    provides: contacts table, PATCH route, ContactPanel component with EditableField
  - phase: 11-realtime-alerts
    provides: useMessageAlerts hook and onMessageSent callback that activates notification suppression
  - phase: 13-error-tracking
    provides: user_profiles table with role column
provides:
  - Contact PATCH route returns { data: updatedContact } after re-SELECT (consistent with GET)
  - ContactPanel uses camelCase 'displayName' field key matching API destructuring
  - onMessageSent callback gated behind response.ok (no suppression on failed sends)
  - /api/user/preferences GET returns role field (defaults to 'agent')
  - page.tsx hides admin nav links from non-admin users, adds Usuarios link for admins
affects: [future UI work that reads contact data after PATCH, any new role-aware features]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Re-SELECT pattern after UPDATE for consistent response shapes across GET and PATCH
    - Least-privilege default: userRole state defaults to 'agent' so links stay hidden while loading
    - response.ok guard before invoking side-effect callbacks

key-files:
  created: []
  modified:
    - src/app/api/contacts/[phone]/route.ts
    - src/components/contact-panel.tsx
    - src/components/message-view.tsx
    - src/app/api/user/preferences/route.ts
    - src/app/page.tsx

key-decisions:
  - "Re-SELECT after UPDATE returns { data: updatedContact } - matches GET response shape so ContactPanel setContact(data.data) works correctly after save"
  - "userRole defaults to 'agent' (least privilege) so admin links are hidden during initial load until preference fetch resolves"
  - "Plain <a href> tags used for admin nav links - consistent with established pattern in page.tsx"
  - "NotificationToggle, realtime indicator, and sign out kept outside admin block - visible to all roles"

patterns-established:
  - "Re-SELECT-after-UPDATE: PATCH handlers fetch updated row and return { data: row } for UI consistency"
  - "response.ok guard: side-effect callbacks (notification suppression, etc.) gated on successful HTTP response"
  - "Least-privilege default: role state defaults to restrictive value while async fetch completes"

# Metrics
duration: 1min
completed: 2026-02-22
---

# Phase 14 Plan 01: Audit Cleanup Summary

**5 v2.0 audit bugs fixed: contact panel no longer blanks after save, field key mismatch resolved, notification suppression guarded by response.ok, admin nav links hidden from agents, Usuarios link added for admins**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-22T20:03:09Z
- **Completed:** 2026-02-22T20:04:26Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Contact panel now retains saved values after edit+blur (PATCH re-SELECTs and returns `{ data: updatedContact }`, field key 'displayName' matches API destructuring)
- Failed message sends no longer activate the 5-second notification suppression window (`onMessageSent?.()` gated by `response.ok`)
- Agent users see no admin nav links; admin users see Analiticas, Etiquetas, Canned Responses, Settings, and Usuarios links in the top bar

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix contact PATCH response, field key, and send guard** - `60e8de0` (fix)
2. **Task 2: Add role-aware nav links with Usuarios link** - `19a91eb` (fix)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/app/api/contacts/[phone]/route.ts` - PATCH handler now re-SELECTs after UPDATE and returns `{ data: updatedContact }` instead of `{ success: true }`
- `src/components/contact-panel.tsx` - Name field now sends `'displayName'` (camelCase) matching the API's destructuring, not `'display_name'`
- `src/components/message-view.tsx` - `onMessageSent?.()` is now inside `if (response.ok)` block; file/message input clearing and fetchMessages remain unconditional
- `src/app/api/user/preferences/route.ts` - GET now selects `notifications_enabled, role` and returns both fields; role defaults to `'agent'` if no user_profiles row
- `src/app/page.tsx` - Adds `userRole` state (default `'agent'`), parses role from preferences fetch, wraps all 4 admin links + new Usuarios link in `{userRole === 'admin' && ...}` block

## Decisions Made
- Re-SELECT after UPDATE pattern chosen to ensure ContactPanel receives the actual DB-persisted values, not just a success flag — this fixes the blank-after-save bug
- `userRole` defaults to `'agent'` (least privilege) so admin links are hidden during the brief loading window before the preferences fetch completes
- Plain `<a href>` tags used for admin nav (not Next.js `<Link>`) — consistent with existing pattern in page.tsx
- `onMessageSent?.()` is the only call gated by `response.ok`; `setMessageInput('')`, `handleRemoveFile()`, and `fetchMessages()` remain unconditional so the UI always resets and refreshes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 5 v2.0 audit items are closed; milestone is clean
- No blockers or concerns

---
*Phase: 14-audit-cleanup*
*Completed: 2026-02-22*
