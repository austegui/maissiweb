# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** The team can send and receive WhatsApp messages through a shared web inbox without anyone needing to touch code or config files.
**Current focus:** Milestone v2.0 -- Phase 9 in progress (Conversation Management)

## Current Position

Phase: 9 of 14 (Conversation Management)
Plan: 4 of 5
Status: In progress
Last activity: 2026-02-22 -- Completed 09-04-PLAN.md (conversation status lifecycle UI)

Progress: [####################░░░░░░░░░░] 59% (v1.0 complete, Phase 7 complete, Phase 8 complete, Phase 9 in progress)

## Performance Metrics

**v1.0 Velocity:**
- Total plans completed: 14 (across 6 phases)
- Average duration: ~5 min per plan
- Total execution time: ~65 min

**v2.0:**
- 07-01: 3 min (getConfig batch refactor, 2 tasks, 9 files)
- 07-02: User-executed SQL (Supabase RBAC setup)
- 07-03: 3 min (admin route guard via layout.tsx)
- 08-01: User-executed SQL (canned_responses table + RLS)
- 08-02: 2 min (admin CRUD page, 2 tasks, 4 files)
- 08-03: 15 min (slash-command picker: cmdk, API route, message-view integration)
- 09-01: User-executed SQL (conversation_metadata + contact_labels + conversation_contact_labels tables)
- 09-02: 6 min (backend API routes: enriched conversations GET, PATCH status/assign, labels CRUD, 5 files)
- 09-03: 4 min (admin label management page, 2 tasks, 3 files)
- 09-04: 4 min (conversation status lifecycle UI: tabs, dots, dropdown, auto-reopen, 3 files)

## Accumulated Context

### Decisions

- [v1.0]: Architecture is additive -- new files alongside Kapso, no rewrites of Kapso core
- [v1.0]: App Router confirmed -- all work uses App Router conventions
- [v1.0]: getConfig() queries DB on every call -- no module-level cache (Vercel serverless)
- [v1.0]: All testing done via Vercel deployment, not local dev server
- [v2.0]: Supabase Realtime replaces custom SSE (Vercel 300s ceiling makes SSE unviable)
- [v2.0]: Query-based RBAC via user_profiles.role, not JWT custom claims
- [v2.0]: getConfig() batch refactor (getConfigs()) ships in Phase 7 before new routes
- [07-01]: getConfig() backward compatibility preserved by delegating to getConfigs() internally
- [07-01]: templates/route.ts uses getConfigs() directly (needs WABA_ID, not PHONE_NUMBER_ID)
- [07-01]: settings/route.ts intentionally left unchanged (reads all settings, not specific keys)
- [07-02]: app_settings RLS already existed from v1.0; user_profiles table + trigger + RLS created via Supabase Dashboard SQL
- [07-03]: Admin guard implemented as /admin/layout.tsx server component that checks user_profiles.role
- [08-02]: Inline form view (mode state machine) instead of Radix Dialog for admin CRUD -- simpler and sufficient
- [08-02]: updateCannedResponse bound via .bind(null, id) -- standard pattern for row-specific Server Actions
- [08-03]: cmdk used without its own Input; shouldFilter=false + client-side filtering since message textarea is the search box
- [08-03]: Slash-command picker uses absolute CSS positioning (not Radix Popover) to avoid focus theft from message input
- [08-03]: Picker triggers only when '/' is value[0] (first char only), not mid-sentence slashes
- [09-02]: convStatus defaults to 'abierto' for conversations with no conversation_metadata row -- business rule, no proactive row creation
- [09-02]: Supabase enrichment in conversations GET wrapped in try/catch -- degrades gracefully if Supabase unavailable
- [09-02]: Labels joined in conversations GET via .in(phone_number, phones) -- single round-trip returns all UI data
- [09-02]: POST /api/labels/contacts/[phone] is idempotent -- unique constraint violation returns success
- [09-03]: Native <input type="color"> for admin color picker -- returns hex directly, no library needed
- [09-03]: Luminance formula (0.299R + 0.587G + 0.114B > 128) for dark vs white text on label pills -- readable across all colors
- [09-03]: Color preview uses onChange state; form submit value carried by name="color" attribute (not controlled)
- [09-04]: Radix Tabs with no Tabs.Content -- tab value drives JS filter only, no server round-trip on tab switch
- [09-04]: autoReopenedRef stores conversationId (not boolean) -- guard correctly scoped per conversation, resets on conversation switch
- [09-04]: Auto-reopen resets guard when user manually sets status to 'resuelto' -- future inbound messages can re-trigger
- [09-04]: Status dot colors: green-500 (abierto), amber-500 (pendiente), gray-400 (resuelto) -- consistent across list and dropdown

### Pending Todos

None.

### Blockers/Concerns

- Kapso API search capability is UNVERIFIED -- affects Phase 13 scope (message content search)

## Session Continuity

Last session: 2026-02-22
Stopped at: Completed 09-04-PLAN.md (conversation status lifecycle UI)
Resume file: None
