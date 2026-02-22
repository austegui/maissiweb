---
phase: 09-conversation-management
plan: "02"
subsystem: api
tags: [supabase, next-js-15, route-handlers, radix-ui, conversation-management, labels]

# Dependency graph
requires:
  - phase: 09-01
    provides: conversation_metadata, contact_labels, conversation_contact_labels tables in Supabase
  - phase: 07-rbac
    provides: user_profiles table with display_name, createClient pattern
provides:
  - GET /api/conversations enriched with convStatus, assignedAgentId, assignedAgentName, labels
  - PATCH /api/conversations/[id]/status — upserts conversation status
  - PATCH /api/conversations/[id]/assign — upserts assigned_agent_id
  - GET /api/labels — all contact_labels rows
  - GET/POST/DELETE /api/labels/contacts/[phone] — contact label CRUD
  - "@radix-ui/react-select@2.2.6 and @radix-ui/react-tabs@1.1.13 installed"
affects:
  - 09-04 (frontend conversation list UI — consumes convStatus, assignedAgentName, labels)
  - 09-05 (message view UI — calls PATCH status/assign endpoints)

# Tech tracking
tech-stack:
  added:
    - "@radix-ui/react-select@2.2.6"
    - "@radix-ui/react-tabs@1.1.13"
  patterns:
    - "Parallel Supabase enrichment: Promise.all for metadata + agents + labels in one API response"
    - "Supabase enrichment try/catch: conversations still return if Supabase is unavailable"
    - "convStatus default 'abierto' for conversations with no metadata row"
    - "Upsert with onConflict: 'conversation_id' for idempotent status/assign writes"
    - "Next.js 15 async params: const { id } = await params in all dynamic route handlers"
    - "Idempotent POST for label attachment: unique constraint violation returns success"

key-files:
  created:
    - src/app/api/conversations/[id]/status/route.ts
    - src/app/api/conversations/[id]/assign/route.ts
    - src/app/api/labels/route.ts
    - src/app/api/labels/contacts/[phone]/route.ts
  modified:
    - src/app/api/conversations/route.ts

key-decisions:
  - "convStatus defaults to 'abierto' for conversations with no conversation_metadata row — business rule: new conversations are implicitly open"
  - "Supabase enrichment wrapped in try/catch in conversations GET — API degrades gracefully if Supabase is unavailable"
  - "Labels joined into conversations GET (not lazy per-row) — single round-trip returns all data frontend needs"
  - "POST /api/labels/contacts/[phone] is idempotent — unique constraint violation treated as success"

patterns-established:
  - "Pattern: Enrich Kapso conversation list via parallel Supabase .in() queries inside route handler"
  - "Pattern: Upsert with onConflict for conversation_metadata — race-condition safe"

# Metrics
duration: 6min
completed: "2026-02-22"
---

# Phase 9 Plan 02: Backend API Routes for Conversation Management Summary

**5 route files delivering enriched conversation list + status/assign PATCH + label CRUD, all backed by Supabase with Next.js 15 async params pattern**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-02-22T00:00:44Z
- **Completed:** 2026-02-22T00:06:24Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Installed @radix-ui/react-select@2.2.6 and @radix-ui/react-tabs@1.1.13 for Phase 9 UI plans
- Enriched GET /api/conversations with parallel Supabase queries returning convStatus, assignedAgentId, assignedAgentName, and labels per conversation
- Created PATCH endpoints for status and assignment using upsert with onConflict for race-safe writes
- Created full label CRUD: GET all labels, GET/POST/DELETE contact label attachments keyed by phone number

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Radix UI packages** - `3b67809` (chore)
2. **Task 2: Create API routes and enrich conversations endpoint** - `5803f2c` (feat)

## Files Created/Modified

- `src/app/api/conversations/route.ts` - Modified: added Supabase enrichment (convStatus, assignedAgentId, assignedAgentName, labels) via parallel queries
- `src/app/api/conversations/[id]/status/route.ts` - Created: PATCH endpoint validating status in ['abierto','pendiente','resuelto'] and upsertng conversation_metadata
- `src/app/api/conversations/[id]/assign/route.ts` - Created: PATCH endpoint accepting agentId (UUID or null) and upserting assigned_agent_id
- `src/app/api/labels/route.ts` - Created: GET all contact_labels rows ordered by name
- `src/app/api/labels/contacts/[phone]/route.ts` - Created: GET/POST/DELETE contact label attachments keyed by phone number

## Decisions Made

- **convStatus default 'abierto':** Conversations with no conversation_metadata row default to status 'abierto' — business rule that new conversations are implicitly open. No row created proactively (would bloat the table).
- **Supabase enrichment try/catch:** If Supabase is unavailable, conversations GET still returns Kapso data (no enrichment fields). Graceful degradation preferred over hard failure since Kapso is the primary data source.
- **Labels joined in conversations GET:** Rather than lazy per-row fetches in the frontend, labels are joined in the route handler via a single `.in(phone_number, phones)` query alongside metadata and agents — one HTTP call returns everything the UI needs.
- **Idempotent label POST:** Unique constraint violation (phone_number, label_id already attached) returns `{ success: true }` — safe to call multiple times without error handling on the frontend.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. TypeScript compilation (`npx tsc --noEmit`) passed cleanly on first attempt.

## User Setup Required

None - no external service configuration required. Supabase tables were created in plan 09-01.

## Next Phase Readiness

- All backend API routes deployed. Frontend plans (09-04 conversation list UI, 09-05 message view UI) can now call:
  - `GET /api/conversations` returns enriched data with convStatus, assignedAgentId, assignedAgentName, labels
  - `PATCH /api/conversations/[id]/status` for status changes
  - `PATCH /api/conversations/[id]/assign` for assignment
  - `GET /api/labels` for label picker
  - `GET/POST/DELETE /api/labels/contacts/[phone]` for contact label management
- @radix-ui/react-select and @radix-ui/react-tabs are installed and ready for UI plans
- No blockers for 09-03 (admin labels management) or 09-04/09-05

---
*Phase: 09-conversation-management*
*Completed: 2026-02-22*
