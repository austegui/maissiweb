---
phase: 07-foundation
plan: 01
subsystem: api
tags: [supabase, getconfig, batch-query, whatsapp-client, performance]

# Dependency graph
requires:
  - phase: 03-admin-settings
    provides: getConfig() and app_settings table that this refactors
provides:
  - getConfigs() batch function with single .in() DB query for multiple config keys
  - getConfig() backward-compatible wrapper delegating to getConfigs()
  - getWhatsAppClientWithPhone() factory returning client + phoneNumberId in one round-trip
  - All 7 API routes migrated to batch config pattern (1 DB query per request instead of 3-4)
affects: [08-realtime, 09-rbac, 10-assignment, 11-notes, 12-analytics, 13-search]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Batch config fetch: getConfigs(...keys) uses .in() filter for single DB round-trip"
    - "WhatsApp factory pattern: getWhatsAppClientWithPhone() encapsulates 3-key batch"
    - "Backward compat wrapper: getConfig() delegates to getConfigs() internally"

key-files:
  created: []
  modified:
    - src/lib/get-config.ts
    - src/lib/whatsapp-client.ts
    - src/app/api/conversations/route.ts
    - src/app/api/messages/[conversationId]/route.ts
    - src/app/api/messages/send/route.ts
    - src/app/api/messages/interactive/route.ts
    - src/app/api/media/[mediaId]/route.ts
    - src/app/api/templates/route.ts
    - src/app/api/templates/send/route.ts

key-decisions:
  - "getConfig() backward compatibility preserved by delegating to getConfigs() internally"
  - "templates/route.ts uses getConfigs() directly (needs WABA_ID not PHONE_NUMBER_ID)"
  - "settings/route.ts intentionally left unchanged (reads all settings, different pattern)"

patterns-established:
  - "Batch pattern: getWhatsAppClientWithPhone() for routes needing client + PHONE_NUMBER_ID"
  - "Direct batch pattern: getConfigs(...keys) for routes needing non-standard key combinations"

# Metrics
duration: 3min
completed: 2026-02-22
---

# Phase 7 Plan 1: getConfig Batch Refactor Summary

**Single Supabase .in() query replaces 3-4 sequential getConfig() calls per API request, using getConfigs() batch function and getWhatsAppClientWithPhone() factory across all 7 WhatsApp API routes**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-22T00:42:04Z
- **Completed:** 2026-02-22T00:45:19Z
- **Tasks:** 2/2
- **Files modified:** 9

## Accomplishments
- Added `getConfigs()` batch function to `get-config.ts` using `.in('key', keys)` — one DB round-trip for any number of config keys
- Added `getWhatsAppClientWithPhone()` factory to `whatsapp-client.ts` — fetches KAPSO_API_KEY, WHATSAPP_API_URL, and PHONE_NUMBER_ID in a single query
- Migrated all 7 consumer API routes from 3-4 sequential `getConfig()` calls to 1 batch query each

## Task Commits

Each task was committed atomically:

1. **Task 1: Add getConfigs() batch function and getWhatsAppClientWithPhone() factory** - `015873a` (feat)
2. **Task 2: Migrate all API routes to batch config pattern** - `02d82f6` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/lib/get-config.ts` - Added `getConfigs()` batch function; `getConfig()` now delegates to it
- `src/lib/whatsapp-client.ts` - Added `getWhatsAppClientWithPhone()`; `getWhatsAppClient()` uses `getConfigs()`
- `src/app/api/conversations/route.ts` - Now uses `getWhatsAppClientWithPhone()` (1 query)
- `src/app/api/messages/[conversationId]/route.ts` - Now uses `getWhatsAppClientWithPhone()` (1 query)
- `src/app/api/messages/send/route.ts` - Now uses `getWhatsAppClientWithPhone()` (1 query)
- `src/app/api/messages/interactive/route.ts` - Now uses `getWhatsAppClientWithPhone()` (1 query)
- `src/app/api/media/[mediaId]/route.ts` - Now uses `getWhatsAppClientWithPhone()` (1 query)
- `src/app/api/templates/route.ts` - Now uses `getConfigs('KAPSO_API_KEY', 'WHATSAPP_API_URL', 'WABA_ID')` (1 query)
- `src/app/api/templates/send/route.ts` - Now uses `getWhatsAppClientWithPhone()` (1 query)

## Decisions Made

- `getConfig()` backward compatibility preserved by delegating to `getConfigs()` internally — any code that still calls the single-key API continues to work without changes
- `templates/route.ts` uses `getConfigs()` directly (not `getWhatsAppClientWithPhone()`) because it needs WABA_ID instead of PHONE_NUMBER_ID — constructed `WhatsAppClient` inline from the batch result
- `settings/route.ts` intentionally left unchanged — it reads all settings rows (not specific named keys), so the `.in()` pattern doesn't apply

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. This is a pure TypeScript refactor with no DB schema changes.

## Next Phase Readiness

- Batch config foundation is in place for all new routes added in phases 8-14
- `getConfigs()` is available for any future code needing multi-key config reads
- All existing WhatsApp functionality unchanged (conversations, messages, media, templates)
- Ready for Phase 7 Plan 2 (RBAC infrastructure: user_profiles table + trigger + RLS policies)

---
*Phase: 07-foundation*
*Completed: 2026-02-22*
