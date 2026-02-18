---
phase: 01-fork-setup
plan: 02
subsystem: api
tags: [next.js, app-router, whatsapp, process-env, polling, kapso]

requires:
  - phase: 01-fork-setup/01-01
    provides: "Kapso source code in working directory"
provides:
  - "Confirmed App Router architecture with evidence"
  - "Complete API route catalog (7 routes) with methods and purposes"
  - "Exact process.env audit — 4 direct reads across 2 files with line numbers"
  - "PHONE_NUMBER_ID and whatsappClient import chain fully mapped"
  - "Webhook architecture confirmed as absent — polling-only via useAutoPolling hook"
affects: [02-authentication, 03-admin-settings, 04-config-migration, 05-inbox-ui]

tech-stack:
  added: []
  patterns:
    - "App Router with route.ts handler files under src/app/api/"
    - "Singleton WhatsAppClient via lazy proxy in src/lib/whatsapp-client.ts"
    - "All API routes import whatsappClient and PHONE_NUMBER_ID from @/lib/whatsapp-client"
    - "Polling-based message refresh via useAutoPolling hook (5s default interval)"

key-files:
  created: []
  modified: []

key-decisions:
  - "Router type is App Router — confirmed by src/app/layout.tsx with RootLayout export and no src/pages/ directory"
  - "No webhook endpoint exists — architecture is polling-only via client-side useAutoPolling hook"
  - "All process.env reads are centralized in 2 files: src/lib/whatsapp-client.ts (3 reads) and src/app/api/templates/route.ts (1 read)"
  - "WABA_ID is the only env var read outside whatsapp-client.ts — read inline in templates route, not exported as constant"

patterns-established:
  - "All routes except templates/route.ts import both whatsappClient and PHONE_NUMBER_ID from @/lib/whatsapp-client"
  - "templates/route.ts reads WABA_ID inline (not via whatsapp-client) — inconsistency to be aware of for Phase 4"

duration: 8min
completed: 2026-02-18
---

# Phase 1 Plan 02: Codebase Audit Summary

**App Router confirmed, 7 API routes cataloged, 4 process.env direct reads mapped across 2 files, zero webhooks — polling-only architecture via useAutoPolling hook**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-02-18
- **Completed:** 2026-02-18
- **Tasks:** 2/2 read-only audit tasks
- **Files modified:** 0 (read-only audit)

## Accomplishments

- Confirmed App Router architecture with `src/app/layout.tsx` evidence, no `src/pages/` directory
- Cataloged all 7 API route files under `src/app/api/` with methods, purposes, and import dependencies
- Produced complete process.env audit with exact file paths and line numbers for all 4 direct reads
- Mapped full import chain for `PHONE_NUMBER_ID` and `whatsappClient` (all 7 route files import from same source)
- Confirmed polling architecture — zero webhook references anywhere in `src/`

## Task Commits

This was a read-only audit. No task commits were made (no code changes).

**Plan metadata:** committed as docs(01-02)

## Router Type

**Confirmed: App Router**

Evidence:
- `src/app/layout.tsx` exists and exports `default function RootLayout({ children })` with `<html>/<body>` wrapper (lines 9–21)
- No `src/pages/` directory exists
- All route handlers follow App Router convention: `route.ts` files under `src/app/api/`

## API Route Catalog

| Route File | HTTP Method | Purpose | Imports whatsappClient | Imports PHONE_NUMBER_ID | Direct process.env |
|---|---|---|---|---|---|
| `src/app/api/conversations/route.ts` | GET | List conversations with Kapso extensions (contact name, last message, direction) | Yes | Yes | No |
| `src/app/api/media/[mediaId]/route.ts` | GET | Fetch media metadata and download binary by mediaId | Yes | Yes | No |
| `src/app/api/messages/[conversationId]/route.ts` | GET | List messages for a conversation with media/direction/kapso fields | Yes | Yes | No |
| `src/app/api/messages/interactive/route.ts` | POST | Send interactive button message (max 3 buttons) to a phone number | Yes | Yes | No |
| `src/app/api/messages/send/route.ts` | POST | Send text or media message (image/video/audio/document) via multipart form | Yes | Yes | No |
| `src/app/api/templates/route.ts` | GET | List WhatsApp templates for a WABA account | Yes | No | Yes — `WABA_ID` line 6 |
| `src/app/api/templates/send/route.ts` | POST | Send a template message with header/body/button parameter substitution | Yes | Yes | No |

**Total routes:** 7

## process.env Audit Table

All direct `process.env` reads in the codebase — exact file, line number, variable, and usage:

| # | File | Line | Variable | Usage Pattern | Category |
|---|---|---|---|---|---|
| 1 | `src/lib/whatsapp-client.ts` | 7 | `KAPSO_API_KEY` | Read into local `const kapsoApiKey`, required check (throws if missing) | Critical credential |
| 2 | `src/lib/whatsapp-client.ts` | 12 | `WHATSAPP_API_URL` | Used as `baseUrl` with fallback `\|\| 'https://api.kapso.ai/meta/whatsapp'` | Infrastructure config |
| 3 | `src/lib/whatsapp-client.ts` | 27 | `PHONE_NUMBER_ID` | Exported as `export const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID \|\| ''` | Critical credential |
| 4 | `src/app/api/templates/route.ts` | 6 | `WABA_ID` | Read into local `const wabaId`, required check (returns 500 if missing) | Critical credential |

**Total direct reads:** 4, across 2 files

**Cross-reference with research expectations:**

| Expected File | Expected Variable | Found | Match |
|---|---|---|---|
| `src/lib/whatsapp-client.ts` | `PHONE_NUMBER_ID` | Line 27 | Exact match |
| `src/lib/whatsapp-client.ts` | `KAPSO_API_KEY` | Line 7 | Exact match |
| `src/lib/whatsapp-client.ts` | `WHATSAPP_API_URL` | Line 12 | Exact match |
| `src/app/api/templates/route.ts` | `WABA_ID` | Line 6 | Exact match |

**New findings beyond research expectations:** None. All 4 reads are exactly where expected.

## Import Chain Map

### PHONE_NUMBER_ID import chain

`process.env.PHONE_NUMBER_ID` is read once, exported as a named constant, and consumed by 6 of 7 route files:

```
src/lib/whatsapp-client.ts (line 27)
  └─ exported as: export const PHONE_NUMBER_ID
       ├─ src/app/api/conversations/route.ts (line 7 — import, line 34, 59 — usage)
       ├─ src/app/api/media/[mediaId]/route.ts (line 2 — import, lines 13, 18 — usage)
       ├─ src/app/api/messages/[conversationId]/route.ts (line 8 — import, line 88 — usage)
       ├─ src/app/api/messages/interactive/route.ts (line 2 — import, line 32 — usage)
       ├─ src/app/api/messages/send/route.ts (line 2 — import, lines 27, 36, 42, 48, 54, 62 — usage)
       └─ src/app/api/templates/send/route.ts (line 3 — import, line 113 — usage)
```

`src/app/api/templates/route.ts` does NOT import `PHONE_NUMBER_ID` (it only uses WABA_ID).

### whatsappClient import chain

`whatsappClient` is a lazy Proxy in `src/lib/whatsapp-client.ts` (lines 21–25) that delegates all property access to `getWhatsAppClient()`. Imported by all 7 route files:

```
src/lib/whatsapp-client.ts (lines 21–25)
  └─ exported as: export const whatsappClient (lazy Proxy)
       ├─ src/app/api/conversations/route.ts (line 7)
       ├─ src/app/api/media/[mediaId]/route.ts (line 2)
       ├─ src/app/api/messages/[conversationId]/route.ts (line 8)
       ├─ src/app/api/messages/interactive/route.ts (line 2)
       ├─ src/app/api/messages/send/route.ts (line 2)
       ├─ src/app/api/templates/route.ts (line 2)
       └─ src/app/api/templates/send/route.ts (line 3)
```

All 7 routes import `whatsappClient`. No route instantiates `WhatsAppClient` directly.

## Webhook/Polling Architecture

**Status: No webhook endpoint. Polling-only architecture.**

Evidence:
- `grep -ri "webhook" src/` — **zero matches**
- No route file handles `POST` requests from Meta's webhook delivery
- No `src/app/api/webhook/` directory exists

**Polling mechanism confirmed in `src/hooks/use-auto-polling.ts`:**

- `useAutoPolling` hook accepts `{ interval, enabled, onPoll }` options
- Default interval: `5000ms` (5 seconds)
- Polls immediately on mount, then on interval
- Pauses automatically when browser tab is hidden (`visibilitychange` event)
- Resumes when tab becomes visible again
- Returns `{ isPolling, isPaused }` state

**Implication for Phase 2+ planning:**

No middleware webhook whitelist is needed. The middleware whitelist blocker noted in STATE.md is now **resolved** — there is no webhook path to whitelist.

## Unexpected Findings

**1. WABA_ID read inline rather than via whatsapp-client.ts**

`src/app/api/templates/route.ts` reads `process.env.WABA_ID` directly on line 6 rather than importing it from `@/lib/whatsapp-client`. All other env vars (`PHONE_NUMBER_ID`, `KAPSO_API_KEY`, `WHATSAPP_API_URL`) are centralized in `whatsapp-client.ts`. This is a minor inconsistency. Phase 4 config-migration should include `WABA_ID` in the centralized client module.

**2. WHATSAPP_API_URL has a fallback default**

`process.env.WHATSAPP_API_URL || 'https://api.kapso.ai/meta/whatsapp'` — this variable is optional (has a default), while `KAPSO_API_KEY` is required (throws if missing) and `PHONE_NUMBER_ID` silently defaults to `''`. This behavior difference is worth noting for Phase 3 admin settings validation.

## Files Created/Modified

None — read-only audit.

## Decisions Made

- Router type is App Router — all Phase 2+ code must follow App Router conventions (server components, route.ts, layout.tsx nesting)
- No webhook endpoint — middleware whitelist blocker is resolved (no path to whitelist)
- process.env is centralized in whatsapp-client.ts with one exception (WABA_ID in templates/route.ts) — Phase 4 should centralize WABA_ID as well

## Deviations from Plan

None — plan executed exactly as written. This was a read-only audit with no code modifications.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required for this audit.

## Next Phase Readiness

- All architectural unknowns blocking Phase 2+ planning are now resolved:
  - Router type: **App Router** (confirmed)
  - Webhook path: **No webhook** — polling only (confirmed)
  - process.env map: **Complete** — 4 reads in 2 files with exact line numbers
  - API route catalog: **Complete** — 7 routes documented
- Phase 2 (authentication) can proceed without conditional logic
- Phase 4 (config-migration) has a clear target: migrate PHONE_NUMBER_ID, KAPSO_API_KEY, WHATSAPP_API_URL from whatsapp-client.ts + WABA_ID from templates/route.ts

---
*Phase: 01-fork-setup*
*Completed: 2026-02-18*
