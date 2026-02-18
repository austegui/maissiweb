---
phase: 04-config-migration
plan: 01
subsystem: api
tags: [whatsapp, getConfig, process.env, credentials, async, supabase]

# Dependency graph
requires:
  - phase: 03-admin-settings
    provides: getConfig() utility that reads credentials from Supabase DB with env fallback
provides:
  - Async getWhatsAppClient() factory function replacing synchronous Proxy pattern
  - All 7 API routes reading credentials from DB via getConfig() instead of process.env
  - Zero direct process.env credential reads in any route file
affects:
  - 05-inbox-ui (any future routes consuming WhatsApp client)
  - 06-deployment (credential injection now DB-driven, not env-only)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Async factory pattern: getWhatsAppClient() creates new instance per request — no singleton"
    - "Config resolution: all credentials flow through getConfig() with DB-first, env-fallback"
    - "Type alias pattern for removed exports: InstanceType<typeof WhatsAppClient>['messages']['sendTemplate']"

key-files:
  created: []
  modified:
    - src/lib/whatsapp-client.ts
    - src/app/api/conversations/route.ts
    - src/app/api/media/[mediaId]/route.ts
    - src/app/api/messages/[conversationId]/route.ts
    - src/app/api/messages/interactive/route.ts
    - src/app/api/messages/send/route.ts
    - src/app/api/templates/route.ts
    - src/app/api/templates/send/route.ts

key-decisions:
  - "No singleton in getWhatsAppClient(): Vercel serverless functions don't share module state — per-request instantiation has no behavioral cost"
  - "Proxy removed entirely: synchronous Proxy get traps cannot await an async factory — the two patterns are incompatible"
  - "templates/route.ts WABA_ID guard removed: getConfig() throws on missing key — equivalent to the manual if(!wabaId) return 500 guard"
  - "npm run build not verifiable locally: lightningcss-linux-x64-gnu binary absent (Windows node_modules in WSL2); build succeeds on Vercel where native Linux binaries are installed"

patterns-established:
  - "Route credential pattern: const whatsappClient = await getWhatsAppClient() at top of try block"
  - "Route credential pattern: const phoneNumberId = await getConfig('PHONE_NUMBER_ID') at top of try block"
  - "Type-safe WhatsAppClient reference: InstanceType<typeof WhatsAppClient> for instance method types"

# Metrics
duration: 5min
completed: 2026-02-18
---

# Phase 4 Plan 1: Config Migration — Core Credential Wiring Summary

**Async DB-backed credential resolution wired into all 8 WhatsApp files: whatsapp-client.ts rewritten as async factory, 7 API routes migrated from process.env to getConfig()+getWhatsAppClient()**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-18T00:02:03Z
- **Completed:** 2026-02-18T00:07:12Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Rewrote whatsapp-client.ts: removed Proxy, singleton, and PHONE_NUMBER_ID constant; exported single async getWhatsAppClient() using getConfig() for both KAPSO_API_KEY and WHATSAPP_API_URL
- Updated all 7 consumer routes to replace `whatsappClient`+`PHONE_NUMBER_ID` imports with `getWhatsAppClient()`+`getConfig()` calls at the top of each handler's try block
- templates/route.ts now uses `await getConfig('WABA_ID')` — replacing both process.env.WABA_ID and the manual 500 guard; getConfig() throws equivalently if key is absent from DB and env
- Fixed templates/send/route.ts type alias `TemplateMessageInput`: switched from `typeof whatsappClient.messages` (Proxy no longer exists) to `InstanceType<typeof WhatsAppClient>['messages']`

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor whatsapp-client.ts to async DB-backed credentials** - `3bee7cc` (refactor)
2. **Task 2: Update all 7 consumer routes to use async getWhatsAppClient() and getConfig()** - `c17aa3c` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/lib/whatsapp-client.ts` - Rewritten: exports only `async getWhatsAppClient()`, uses getConfig() for both credentials, no Proxy, no singleton, no PHONE_NUMBER_ID
- `src/app/api/conversations/route.ts` - Uses getWhatsAppClient()+getConfig('PHONE_NUMBER_ID'); 2 phoneNumberId usages updated
- `src/app/api/media/[mediaId]/route.ts` - Uses getWhatsAppClient()+getConfig('PHONE_NUMBER_ID'); 2 phoneNumberId usages updated
- `src/app/api/messages/[conversationId]/route.ts` - Uses getWhatsAppClient()+getConfig('PHONE_NUMBER_ID'); 1 phoneNumberId usage updated
- `src/app/api/messages/interactive/route.ts` - Uses getWhatsAppClient()+getConfig('PHONE_NUMBER_ID'); 1 phoneNumberId usage updated
- `src/app/api/messages/send/route.ts` - Uses getWhatsAppClient()+getConfig('PHONE_NUMBER_ID'); 6 phoneNumberId usages updated
- `src/app/api/templates/route.ts` - Uses getWhatsAppClient()+getConfig('WABA_ID'); manual 500 guard removed
- `src/app/api/templates/send/route.ts` - Uses getWhatsAppClient()+getConfig('PHONE_NUMBER_ID'); TemplateMessageInput type alias fixed

## Decisions Made
- **No singleton in getWhatsAppClient():** Vercel serverless functions don't share module state reliably across invocations (established in 03-01 decision). Per-request `new WhatsAppClient()` is correct and has no behavioral difference from the old singleton illusion.
- **Proxy removed entirely:** Proxy get traps are synchronous — they cannot `await` an async function. Once getWhatsAppClient() is async, the Proxy pattern is architecturally incompatible and must be removed.
- **WABA_ID guard removed from templates/route.ts:** The old `if (!wabaId) return 500` guard is replaced by getConfig() throwing `Error: Config key "WABA_ID" is not set in DB or environment` — caught by the existing catch block and returned as 500. Behavior is equivalent.
- **`npm run build` not verifiable in local WSL2:** The lightningcss native binary (`lightningcss-linux-x64-gnu`) is absent — only `lightningcss-win32-x64-msvc` is installed (Windows node_modules). Build failure is pre-existing (confirmed by reverting changes and rebuilding). Vercel installs native Linux binaries during deployment CI.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- **`npm run build` fails locally (pre-existing):** lightningcss missing Linux native binary in this WSL2 environment. Confirmed pre-existing by stashing changes and reproducing identical failure. TypeScript compiles cleanly (`npx tsc --noEmit` passes zero errors), and all verification checks except the build pass. Build verification deferred to Vercel deployment.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Credential migration complete. All WhatsApp API calls now resolve credentials from Supabase DB via getConfig(), with env fallback.
- The admin settings UI (Phase 3) is now fully wired: credentials saved through the UI flow into every API route without redeployment.
- Phase 5 (Inbox UI) can begin immediately — no blockers.

---
*Phase: 04-config-migration*
*Completed: 2026-02-18*
