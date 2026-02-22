---
phase: 10
plan: 02
subsystem: api-routes
tags: [contacts, notes, supabase, next-js-15, api]
requires: ["10-01"]
provides: ["contact-profile-api", "conversation-notes-api"]
affects: ["10-03"]
tech-stack:
  added: []
  patterns: ["upsert-then-read", "join-flatten", "async-params-next15"]
key-files:
  created:
    - src/app/api/contacts/[phone]/route.ts
    - src/app/api/conversations/[id]/notes/route.ts
  modified: []
decisions:
  - "Contacts GET uses upsert-then-read so rows are created lazily on first visit, never overwriting existing data"
  - "Notes join user_profiles for author name, defaulting to 'Agente' if profile absent"
  - "Notes route has zero WhatsApp imports -- physically separate from message-sending path"
  - "user_profiles join cast through unknown due to Supabase inferred array type vs object type"
metrics:
  duration: "4 min"
  completed: "2026-02-22"
---

# Phase 10 Plan 02: Customer Intelligence Backend API Summary

**One-liner:** Contact profile REST API (GET upsert-then-read + PATCH) and conversation notes API (GET with author join + POST) using Next.js 15 async params pattern.

## What Was Built

Two new API route files providing the backend for the customer intelligence UI (Phase 10-03):

### `src/app/api/contacts/[phone]/route.ts`

- **GET**: Lazily creates a contact row (upsert with `ignoreDuplicates: true`), then reads and returns the full contact record. Accepts optional `?name=` query param to store the WhatsApp profile name on first creation.
- **PATCH**: Updates `display_name`, `email`, and/or `notes` fields (camelCase from client mapped to snake_case in DB). Always sets `updated_at`.

### `src/app/api/conversations/[id]/notes/route.ts`

- **GET**: Fetches all notes for a conversation, joining `user_profiles` for the author's display name. Flattens the result to `{ id, content, createdAt, authorName }`. Notes ordered newest-first.
- **POST**: Validates that `content` is non-empty, inserts a note with `author_id` set to the authenticated user's UUID. Returns `{ success: true }`.

## Decisions Made

| Decision | Rationale |
|---|---|
| Upsert with `ignoreDuplicates: true` | Creates row on first visit without ever clobbering manually entered data |
| `authorName` defaults to `'Agente'` | Graceful fallback when user_profiles row is missing |
| Cast `user_profiles` through `unknown` | Supabase infers array type for the join; double-cast is required by TypeScript strict mode |
| Notes route has zero WhatsApp imports | Safety rule: notes must never accidentally trigger message sends |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript error on user_profiles join cast**

- **Found during:** Task 2 TypeScript verification
- **Issue:** Supabase's generated type for the `.select('... user_profiles ( display_name )')` join is inferred as `{ display_name: any }[]` (array), but the plan cast it directly as `{ display_name: string } | null` -- TypeScript 5 strict mode flags this as insufficient overlap.
- **Fix:** Changed cast to `n.user_profiles as unknown as { display_name: string } | null` (double-cast through `unknown`).
- **Files modified:** `src/app/api/conversations/[id]/notes/route.ts`
- **Commit:** 689e1d8

## Next Phase Readiness

Phase 10-03 (customer intelligence UI) can now consume:
- `GET /api/contacts/[phone]` -- contact panel data
- `PATCH /api/contacts/[phone]` -- inline contact edits
- `GET /api/conversations/[id]/notes` -- notes list
- `POST /api/conversations/[id]/notes` -- add note

No blockers for 10-03.
