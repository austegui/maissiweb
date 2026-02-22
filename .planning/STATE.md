# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** The team can send and receive WhatsApp messages through a shared web inbox without anyone needing to touch code or config files.
**Current focus:** Milestone v2.0 -- COMPLETE. All 13 phases done.

## Current Position

Phase: 13 of 13 (Error Tracking + User Management) -- COMPLETE
Plan: 2 of 2 -- COMPLETE (13-02 done)
Status: ALL PLANS COMPLETE -- v2.0 milestone fully shipped
Last activity: 2026-02-22 -- Completed 13-02 (user management CRUD at /admin/users)

Progress: [████████████████████████████████] 100% (v1.0 complete, Phases 7-13 complete, all plans done)

## Performance Metrics

**v1.0 Velocity:**
- Total plans completed: 14 (across 6 phases)
- Average duration: ~5 min per plan
- Total execution time: ~65 min

**v2.0:**
- 11-02: 7 min (message alerts hook + notification toggle + preferences API + integration, 2 tasks, 6 files)
- 11-03: 4 min (Realtime sync hook + inbox integration, 2 tasks, 4 files)
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
- 09-05: 5 min (assignment dropdown, label picker, initials badge, label pills, filters, 5 files)
- 10-01: User-executed SQL (contacts + conversation_notes tables)
- 10-02: 4 min (contact profile API GET+PATCH, conversation notes API GET+POST, 2 files)
- 10-03: 2 min (ContactPanel UI: editable contact fields, conversation history, collapsible notes, 3 files)
- 11-01: User-executed SQL (Realtime publication for 4 tables + notifications_enabled column on user_profiles)
- 12-01: User-executed SQL (get_agent_stats + get_conversation_volume_by_day RPC functions)
- 12-02: 2 min (analytics JSON API + CSV export API, 2 tasks, 2 files)
- 12-03: 4 min (analytics dashboard UI: Recharts charts, KPI cards, agent table, CSV export, 2 tasks, 4 files)
- 13-01: 1 min (global error page + Supabase admin client factory, 2 tasks, 2 files)
- 13-02: 2 min (user management CRUD: server actions + page + client component + settings link, 2 tasks, 4 files)

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
- [09-05]: agents and currentUserId piggybacked on /api/conversations GET response -- no extra API endpoints needed
- [09-05]: onConversationsLoaded callback extended with optional meta param -- backwards compatible
- [09-05]: Native <select> for assignment and label secondary filters -- compact, no custom styling needed
- [09-05]: LabelPicker uses absolute positioning (not Radix Popover) -- consistent with canned-responses-picker, no focus theft
- [10-02]: Contacts GET uses upsert-then-read (ignoreDuplicates: true) -- rows created lazily, existing data never overwritten
- [10-02]: Notes user_profiles join cast through unknown -- Supabase infers array type, double-cast required by TypeScript strict mode
- [10-02]: Notes route has zero WhatsApp imports -- safety rule, notes physically separate from message-sending path
- [10-03]: key={conversationId} on ContactPanel forces React remount on conversation switch, clearing all local state cleanly
- [10-03]: conversations array stored in page.tsx state for ContactPanel history filtering by phoneNumber
- [10-03]: Yellow tint (#fffde7) for internal notes distinguishes team notes from customer messages visually
- [10-03]: EditableField uses onBlur-to-save pattern -- no save button per field, consistent with CRM UX conventions
- [11-01]: Realtime publication enabled via ALTER PUBLICATION SQL (not Dashboard UI toggle) -- atomic, covers all 4 tables in one block
- [11-01]: notifications_enabled uses ADD COLUMN IF NOT EXISTS -- idempotent SQL, safe to re-run without error
- [11-02]: useMessageAlerts handles ALL audio + browser notifications (subsumes handoff sound too); useHandoffAlerts is visual-only
- [11-02]: AudioContext created lazily as module-level singleton -- survives React re-renders, avoids duplicate instances
- [11-02]: Alert detection uses lastActiveAt change (not message count) -- avoids false triggers on filter changes
- [11-02]: isBrandNew branch excluded from alerting on first load -- prevents spray of alerts when page first opens
- [11-02]: Preference API defaults notifications_enabled to true when no user_profiles row exists (new users)
- [11-03]: Supabase client created lazily (useRef + useEffect) not useMemo -- useMemo runs during SSR prerendering in Next.js 15, causing build crash when NEXT_PUBLIC env vars absent
- [11-03]: Single Realtime channel with 4 .on() handlers (not 4 separate channels) -- reduces WebSocket connection overhead
- [11-03]: realtimeConnected === false (strict) so undefined (pre-init) keeps 10s polling, only explicit false triggers 5s fallback
- [11-03]: useEffect([interval]) added to useAutoPolling to sync interval refs when prop changes externally
- [11-fix]: fetchMessages deps stabilized via refs (onStatusChange, localStatus) -- parent re-renders no longer re-trigger setLoading(true) skeleton flash
- [11-fix]: onConversationsLoaded gated by change detection -- only fires when data differs, prevents unnecessary page.tsx re-renders every poll
- [11-fix]: refresh() unified to use fetchConversations() -- single fetch path with change detection, no spinner blink from Realtime events
- [12-02]: avgReplyTime uses lastInboundAt/lastOutboundAt difference -- approximate but zero extra API calls
- [12-02]: Export route uses new Response() (not NextResponse.json) for raw CSV body
- [12-02]: ISO timestamps passed to RPC as ${date}T00:00:00Z / ${date}T23:59:59Z -- full day coverage
- [12-03]: ResponsiveContainer uses fixed pixel height={300} to prevent ResizeObserver infinite loop
- [12-03]: Cancelled fetch pattern in useEffect prevents stale state updates on rapid preset switching
- [12-03]: Recharts 3.7.0 installed -- React 19 peer dep officially supported
- [13-01]: Inline styles only in global-error.tsx -- Tailwind/CSS vars unavailable when root layout is bypassed by error boundary
- [13-01]: ASCII-safe Spanish text in error page (no accent chars) -- avoids encoding issues in crash scenario
- [13-01]: admin.ts uses @supabase/supabase-js (not @supabase/ssr) -- service role key is static, no cookie sessions needed
- [13-01]: SUPABASE_SERVICE_ROLE_KEY has no NEXT_PUBLIC_ prefix -- server-only, never exposed to browser
- [13-01]: createAdminClient() auth options: persistSession/autoRefreshToken/detectSessionInUrl all false -- stateless server-side client
- [13-02]: ban_duration='876000h' for deactivation, 'none' for reactivation -- Supabase auth.admin pattern, no data deletion
- [13-02]: upsert user_profiles after createUser to handle DB trigger race condition -- profile may not exist yet
- [13-02]: window.confirm() for deactivation confirmation -- admin-only page, simpler than inline confirm state
- [13-02]: rowLoading[userId] state pattern for per-row loading in tables without full re-render

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-22T19:28:42Z
Stopped at: Completed 13-02-PLAN.md (user management CRUD) -- ALL PLANS COMPLETE
Resume file: None
