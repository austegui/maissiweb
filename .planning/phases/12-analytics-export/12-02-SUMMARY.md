---
phase: 12-analytics-export
plan: 02
status: complete
started: 2026-02-22
completed: 2026-02-22
duration: ~2 min
subsystem: api
tags: [analytics, csv-export, admin, kapso, supabase-rpc]
---

# Phase 12 Plan 02: Analytics & Export API Routes Summary

**One-liner:** Admin-only analytics JSON API + CSV export with paginated Kapso ingestion and Supabase RPC aggregation.

## What Was Built

Two Next.js App Router API route handlers for the analytics feature:

1. **GET /api/admin/analytics** — Returns JSON metrics for a date range:
   - KPIs: totalMessages, totalConversations, avgReplyTimeMinutes (approximate), resolvedCount
   - volumeByDay: daily conversation counts from Supabase RPC
   - agentBreakdown: per-agent resolved/total counts with display names

2. **GET /api/admin/analytics/export** — Returns a downloadable CSV file:
   - Rows: contactName, phoneNumber, status, assignedAgent, messageCount, lastActive
   - Optional `?status=` filter applied after Supabase enrichment
   - UTF-8 BOM prefix for Excel compatibility with Spanish characters

## Deliverables

| Artifact | Path |
|----------|------|
| Analytics metrics API route | `src/app/api/admin/analytics/route.ts` |
| CSV export API route | `src/app/api/admin/analytics/export/route.ts` |

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Analytics metrics API route | 4ea2b10 | src/app/api/admin/analytics/route.ts |
| 2 | CSV export API route | b6f3dea | src/app/api/admin/analytics/export/route.ts |

## Architecture

**Auth guard pattern (both routes):**
1. `supabase.auth.getUser()` → 401 if no session
2. `user_profiles.role` query → 403 if not 'admin'

**Kapso pagination loop (both routes):**
- `conversations.list()` with `lastActiveSince`/`lastActiveUntil` date filters
- Loop with `after` cursor, safety cap of 20 pages (max 2,000 conversations)
- Fields: `contact_name`, `messages_count`, `last_inbound_at`, `last_outbound_at`

**Supabase calls (parallel via Promise.all):**
- `get_conversation_volume_by_day(from_date, to_date)` RPC
- `get_agent_stats(from_date, to_date)` RPC
- `user_profiles` select for agent display names

**avgReplyTime computation:**
- For each conversation with both lastInboundAt and lastOutboundAt where outbound > inbound
- Delta in ms averaged across all valid conversations, converted to minutes
- Returns null if no valid pairs found
- Documented as "approximate" (last message times, not per-message tracking)

**CSV format:**
- UTF-8 BOM (`\uFEFF`) prefix for Excel compatibility
- All string fields wrapped in double-quotes via `esc()` helper
- Internal double-quotes escaped by doubling (`"` → `""`)
- CRLF line endings
- `Content-Disposition: attachment` triggers browser download

## Decisions Made

- [12-02]: avgReplyTime uses lastInboundAt/lastOutboundAt difference — approximate but zero extra API calls
- [12-02]: Export route uses `new Response()` (not NextResponse.json) for raw CSV body
- [12-02]: Auth error responses in export route use `new Response(JSON.stringify(...))` for consistency (not NextResponse)
- [12-02]: ISO timestamps passed to RPC as `${date}T00:00:00Z` / `${date}T23:59:59Z` — full day coverage

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

- Analytics API is ready for plan 12-03 (frontend dashboard page)
- Export API is ready for the download button in the dashboard
- Both endpoints tested via TypeScript compilation only (no local test environment available)
