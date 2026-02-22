# Phase 12: Analytics + Export - Research

**Researched:** 2026-02-22
**Domain:** Analytics dashboard with charts + CSV export, Next.js 15 App Router, Recharts 3.x, Supabase RPC
**Confidence:** HIGH

## Summary

This phase adds an admin-only analytics dashboard and CSV export to the existing WhatsApp inbox. The codebase already has the admin guard pattern (`/admin/layout.tsx` server component checking `user_profiles.role === 'admin'`), so the new `/admin/analytics` route inherits that guard for free.

Data for analytics comes from two sources: **Supabase** (stores `conversation_metadata` with `status`, `assigned_agent_id`, `updated_at`) and the **Kapso SDK** (`conversations.list()` with `lastActiveSince`/`lastActiveUntil` date filters confirmed in the SDK types). The Kapso SDK does NOT expose message-level timestamps or per-agent metrics directly — aggregate analytics must be computed in the analytics Route Handler by fetching conversations from Kapso filtered by date, then joining with Supabase metadata.

The standard chart library for this stack is **Recharts 3.7.0**, which officially lists React 19 as a supported peer dependency. All chart components must be Client Components (`'use client'`) because Recharts uses browser-only DOM APIs. The established pattern is: Server Component page fetches data → passes as props to a Client Component wrapper that renders Recharts charts. CSV export uses a Next.js Route Handler returning `text/csv` with `Content-Disposition: attachment` headers.

**Primary recommendation:** Use Recharts 3.7.0 for charts, Supabase RPC functions for GROUP BY aggregations, and a dedicated `/api/admin/analytics/export` Route Handler for CSV generation.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | 3.7.0 | Line/bar charts for message volume and per-agent metrics | React-native SVG charting, React 19 peer dep confirmed, actively maintained |
| date-fns | 4.1.0 (already installed) | Date formatting and arithmetic for chart labels and range calculation | Already in package.json, used throughout codebase |
| @supabase/supabase-js | 2.97.0 (already installed) | RPC calls for aggregate queries (GROUP BY), conversation_metadata queries | Already in stack |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-day-picker | included via shadcn | Calendar date range picker | The shadcn date picker pattern uses this; no separate install needed if building with Radix primitives |
| lucide-react | 0.545.0 (already installed) | Icons for KPI cards, export button | Already installed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts | Chart.js (via react-chartjs-2) | Chart.js is canvas-based, more configuration overhead, less React-idiomatic; Recharts is SVG and composable |
| Recharts | Victory | Victory is less commonly used in 2025-2026 Next.js stacks, smaller community |
| Supabase RPC | Raw SQL via pg client | RPC keeps security model intact (RLS + service role), consistent with existing codebase patterns |
| Custom date range picker | react-datepicker | Project uses Radix UI + Tailwind; building with Radix Popover + react-day-picker is consistent with existing component style |

### Installation

```bash
npm install recharts
```

Note: `date-fns`, `@supabase/supabase-js`, `lucide-react` are already installed. `recharts` is the only new dependency.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── admin/
│   │   └── analytics/
│   │       ├── page.tsx               # Server Component — fetches data, passes to client
│   │       └── AnalyticsDashboard.tsx # Client Component ("use client") — charts + state
│   └── api/
│       └── admin/
│           └── analytics/
│               ├── route.ts           # GET /api/admin/analytics — metrics data
│               └── export/
│                   └── route.ts       # GET /api/admin/analytics/export — CSV download
```

### Pattern 1: Server Component Page + Client Component Charts

**What:** The page.tsx server component runs the admin guard (free via admin layout), then fetches initial analytics data server-side. It passes data as props to `AnalyticsDashboard.tsx` which handles chart rendering and date range state.

**When to use:** Whenever you need Recharts (requires `'use client'`) but want server-side data fetching.

**Example:**
```typescript
// src/app/admin/analytics/page.tsx — Server Component
// Admin guard is inherited from /admin/layout.tsx — no additional guard needed here
import { AnalyticsDashboard } from './AnalyticsDashboard'
import { createClient } from '@/lib/supabase/server'

export default async function AnalyticsPage() {
  const supabase = await createClient()

  // Fetch agents list server-side (used for per-agent breakdown)
  const { data: agents } = await supabase
    .from('user_profiles')
    .select('id, display_name')

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-lg font-semibold mb-6">Analytics</h1>
      <AnalyticsDashboard agents={agents ?? []} />
    </div>
  )
}
```

```typescript
// src/app/admin/analytics/AnalyticsDashboard.tsx — Client Component
'use client'
import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

// Source: Recharts docs https://recharts.github.io/en-US/api/BarChart/
// ResponsiveContainer handles dynamic parent width — always wrap charts in it
```

### Pattern 2: Analytics Data via Dedicated Route Handler

**What:** Client component calls `/api/admin/analytics?from=2026-01-01&to=2026-01-31` which fetches Kapso conversations filtered by date and joins with Supabase metadata to compute KPIs.

**When to use:** When the data requires both Kapso API and Supabase in a single aggregated response.

**Why Route Handler, not Server Action:** The analytics data is parameterized (date range changes client-side) and needs re-fetching on date change — a GET Route Handler fits better than a Server Action.

**Example:**
```typescript
// src/app/api/admin/analytics/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWhatsAppClientWithPhone } from '@/lib/whatsapp-client'
import { buildKapsoFields } from '@kapso/whatsapp-cloud-api'

export async function GET(request: Request) {
  const supabase = await createClient()

  // Admin check — analytics endpoint is admin-only
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')  // ISO date string
  const to = searchParams.get('to')      // ISO date string

  // Kapso SDK supports lastActiveSince and lastActiveUntil filters (confirmed in SDK types)
  const { client, phoneNumberId } = await getWhatsAppClientWithPhone()
  const response = await client.conversations.list({
    phoneNumberId,
    lastActiveSince: from ?? undefined,
    lastActiveUntil: to ?? undefined,
    limit: 100,
    fields: buildKapsoFields(['contact_name', 'messages_count', 'last_inbound_at', 'last_outbound_at'])
  })

  // ... aggregate + join with Supabase conversation_metadata
  return NextResponse.json({ kpis, volumeByDay, agentBreakdown })
}
```

### Pattern 3: CSV Export Route Handler

**What:** A GET route handler generates CSV from the filtered conversation list and returns it with download headers.

**Example:**
```typescript
// src/app/api/admin/analytics/export/route.ts
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  // ... auth check + data fetch (same as analytics route)

  // Build CSV string — no library needed for flat tabular data
  const headers = ['Contact Name', 'Phone Number', 'Status', 'Assigned Agent', 'Message Count', 'Last Active']
  const rows = conversations.map(c => [
    `"${c.contactName ?? ''}"`,
    c.phoneNumber,
    c.status,
    `"${c.agentName ?? ''}"`,
    c.messagesCount ?? 0,
    c.lastActiveAt ?? ''
  ].join(','))

  const csv = [headers.join(','), ...rows].join('\n')
  const filename = `conversations-${from}-${to}.csv`

  // Source: Next.js Route Handlers docs https://nextjs.org/docs/app/getting-started/route-handlers
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  })
}
```

**Client-side trigger** (in AnalyticsDashboard.tsx):
```typescript
const handleExport = async () => {
  const params = new URLSearchParams({ from, to, status: filterStatus })
  const response = await fetch(`/api/admin/analytics/export?${params}`)
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `conversations-${from}-${to}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
```

### Pattern 4: Supabase RPC for GROUP BY Aggregations

**What:** Supabase JS client cannot do GROUP BY natively. Use `supabase.rpc()` to call a Postgres function.

**When to use:** Computing "conversations resolved per day" (GROUP BY date), "per-agent counts" from `conversation_metadata`.

**Example SQL function to create in Supabase:**
```sql
-- Conversations resolved per day, per agent (from conversation_metadata)
create or replace function get_agent_stats(
  from_date timestamptz,
  to_date timestamptz
) returns table (
  agent_id uuid,
  resolved_count bigint,
  total_count bigint
) as $$
  select
    assigned_agent_id as agent_id,
    count(*) filter (where status = 'resuelto') as resolved_count,
    count(*) as total_count
  from conversation_metadata
  where updated_at >= from_date and updated_at <= to_date
    and assigned_agent_id is not null
  group by assigned_agent_id
$$ language sql stable security definer;
```

```typescript
// Source: Supabase RPC docs https://supabase.com/docs/reference/javascript/rpc
const { data, error } = await supabase.rpc('get_agent_stats', {
  from_date: fromDate,
  to_date: toDate
})
```

### Pattern 5: Recharts BarChart for Horizontal Agent Comparison

**What:** The per-agent breakdown uses `layout="vertical"` on BarChart for horizontal bars.

**Example:**
```typescript
// Source: Recharts BarChart docs https://recharts.github.io/en-US/api/BarChart/
'use client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

// Horizontal bar chart (layout="vertical" flips axes)
<ResponsiveContainer width="100%" height={agentData.length * 50}>
  <BarChart data={agentData} layout="vertical" margin={{ left: 80 }}>
    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
    <XAxis type="number" />
    <YAxis type="category" dataKey="agentName" width={80} />
    <Tooltip />
    <Bar dataKey="resolvedCount" fill="#22c55e" name="Resueltas" />
    <Bar dataKey="totalCount" fill="#94a3b8" name="Total" />
  </BarChart>
</ResponsiveContainer>
```

### Anti-Patterns to Avoid

- **Fetching Recharts data in the same file as `'use client'` declaration**: Fetch data in a Server Component, pass as props. Don't use `useEffect` + fetch for initial render — it causes loading flicker.
- **Using `supabase.from().select()` with complex GROUP BY**: Supabase JS does not support GROUP BY. Use RPC functions.
- **Pagination loop for all conversations in a single request**: The Kapso SDK returns max 100 per page with a `paging.cursors.after` cursor. For analytics covering a large date range, implement pagination with the `after` cursor until no more pages remain.
- **Generating CSV client-side in JavaScript**: For any non-trivial dataset, this blocks the UI thread. Use the Route Handler approach.
- **Not quoting CSV fields**: Contact names and agent names may contain commas. Always wrap string fields in quotes.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Responsive chart container | Custom resize observer | `<ResponsiveContainer>` from recharts | Handles ResizeObserver lifecycle correctly |
| CSV field quoting/escaping | Manual string replace | Standard CSV quoting (wrap in `"`, escape `"` as `""`) | CSV has edge cases with newlines in fields, commas in names |
| Date formatting for chart X-axis | Custom date format function | `date-fns` `format()` (already installed) | Handles locale, edge cases |
| GROUP BY analytics queries | JavaScript aggregation of all records | Supabase RPC Postgres function | Database aggregation is O(n) in DB vs. fetching all rows to JS |
| Admin access control | Re-implementing role check | Inheriting from `/admin/layout.tsx` | Layout guard already runs on every `/admin/*` route |

**Key insight:** CSV generation is simple enough to hand-roll (no library needed for flat tabular data), but grouping/aggregation must stay in the database — fetching 1000+ conversation records to Node.js just to count them is slow and fragile.

---

## Common Pitfalls

### Pitfall 1: Recharts "ResizeObserver loop limit exceeded" Error

**What goes wrong:** `ResponsiveContainer` with `height="100%"` in a flex container without an explicit parent height causes infinite resize loops.
**Why it happens:** ResizeObserver triggers re-render which triggers resize.
**How to avoid:** Always give `ResponsiveContainer` a fixed pixel height or set the parent container to a fixed height. Use `height={300}` not `height="100%"`.
**Warning signs:** Chart appears briefly then disappears, console shows ResizeObserver errors.

### Pitfall 2: Kapso SDK Pagination — Only First 100 Conversations

**What goes wrong:** `conversations.list()` returns max 100 records. Analytics covering "last 30 days" for an active team could span 500+ conversations, causing silently incomplete metrics.
**Why it happens:** The SDK uses cursor-based pagination (`after`, `before`); the default `limit` is 50 and maximum is 100.
**How to avoid:** In the analytics Route Handler, loop while `response.paging?.cursors?.after` exists:
```typescript
let all = []
let after: string | undefined
do {
  const page = await client.conversations.list({ phoneNumberId, lastActiveSince, after, limit: 100, ... })
  all.push(...page.data)
  after = page.paging?.cursors?.after
} while (after)
```
**Warning signs:** Metrics seem low compared to what agents know is the volume.

### Pitfall 3: Response Time Calculation — No Native Data

**What goes wrong:** `conversation_metadata` has `updated_at` (last status change) but does NOT have first-response timestamps. The Kapso SDK's `ConversationKapsoExtensions` has `lastInboundAt` and `lastOutboundAt`, but these are the LAST timestamps, not the FIRST.
**Why it happens:** The Kapso data model is oriented around "last activity" not "first response."
**How to avoid:** Calculate "average response time" as `lastOutboundAt - lastInboundAt` (approximate: time between last customer message and last agent reply). This is an approximation, not true first-response time. Document this clearly in the UI as "Avg. reply time (approx)".
**Warning signs:** Response time metric shows 0 for all conversations (probably means lastInboundAt is null in the fields request).

### Pitfall 4: CSV Encoding — Special Characters

**What goes wrong:** Contact names with accented characters (common in Spanish: "José", "María") corrupt when opened in Excel on Windows.
**Why it happens:** Excel expects UTF-8 BOM for CSV files to detect encoding.
**How to avoid:** Prepend `\uFEFF` (BOM character) to the CSV string before returning it.
```typescript
const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n')
```
**Warning signs:** Accented characters show as `Ã©` in Excel.

### Pitfall 5: Client Component Fetching Causing Layout Shift

**What goes wrong:** `AnalyticsDashboard` mounts with empty state then fetches analytics data on mount, causing charts to render empty then pop in with data.
**Why it happens:** Initial data isn't passed from server.
**How to avoid:** Pass a default date range (e.g., "last 7 days") from the Server Component, pre-fetch that range's data server-side, pass as `initialData` prop. Client only re-fetches on date range change.

### Pitfall 6: Admin Route Protection — Don't Skip the API Check

**What goes wrong:** The `/admin/layout.tsx` guard only protects the page route, not the API routes. `/api/admin/analytics` and `/api/admin/analytics/export` must perform their own auth + role checks.
**Why it happens:** API routes don't go through layout.tsx.
**How to avoid:** Both analytics API routes must explicitly check `user.role === 'admin'` via Supabase (as shown in Pattern 2 above).
**Warning signs:** Any logged-in agent can fetch analytics data by hitting the API URL directly.

---

## Code Examples

### Recharts LineChart for Message Volume Over Time

```typescript
// Source: Recharts docs https://recharts.github.io/en-US/api/BarChart/
'use client'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'

// volumeData shape: [{ date: '2026-01-15', count: 23 }, ...]
export function VolumeChart({ data }: { data: { date: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Line type="monotone" dataKey="count" stroke="#22c55e" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
```

### Date Range Preset Buttons (No External Calendar Library Needed)

```typescript
// Simple preset buttons using date-fns (already installed)
import { subDays, format, startOfDay, endOfDay } from 'date-fns'

const PRESETS = [
  { label: '7 days', from: () => subDays(new Date(), 7) },
  { label: '30 days', from: () => subDays(new Date(), 30) },
  { label: '90 days', from: () => subDays(new Date(), 90) },
]

// In AnalyticsDashboard:
const [dateRange, setDateRange] = useState({
  from: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
  to: format(new Date(), 'yyyy-MM-dd')
})
```

### Supabase RPC for Volume By Day

```sql
-- Create in Supabase SQL Editor
create or replace function get_conversation_volume_by_day(
  from_date timestamptz,
  to_date timestamptz
) returns table (
  day date,
  conversation_count bigint
) as $$
  -- conversation_metadata.updated_at captures when status/assignment changed
  -- Use as proxy for "active on this day"
  select
    updated_at::date as day,
    count(distinct conversation_id) as conversation_count
  from conversation_metadata
  where updated_at >= from_date and updated_at <= to_date
  group by updated_at::date
  order by day asc
$$ language sql stable security definer;
```

```typescript
// Source: Supabase JS docs https://supabase.com/docs/reference/javascript/rpc
const { data: volumeData } = await supabase.rpc('get_conversation_volume_by_day', {
  from_date: `${fromDate}T00:00:00Z`,
  to_date: `${toDate}T23:59:59Z`
})
```

### CSV Route Handler Complete Pattern

```typescript
// src/app/api/admin/analytics/export/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWhatsAppClientWithPhone } from '@/lib/whatsapp-client'
import { buildKapsoFields } from '@kapso/whatsapp-cloud-api'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''
  const statusFilter = searchParams.get('status') ?? undefined

  // Fetch all conversations in date range (paginated)
  const { client, phoneNumberId } = await getWhatsAppClientWithPhone()
  const allConversations = []
  let after: string | undefined
  do {
    const page = await client.conversations.list({
      phoneNumberId,
      lastActiveSince: from || undefined,
      lastActiveUntil: to || undefined,
      ...(statusFilter && { status: statusFilter }),
      limit: 100,
      after,
      fields: buildKapsoFields(['contact_name', 'messages_count', 'last_inbound_at', 'last_outbound_at'])
    })
    allConversations.push(...page.data)
    after = page.paging?.cursors?.after
  } while (after)

  // Enrich with Supabase metadata
  const ids = allConversations.map(c => c.id)
  const [metaResult, agentsResult] = await Promise.all([
    supabase.from('conversation_metadata')
      .select('conversation_id, status, assigned_agent_id').in('conversation_id', ids),
    supabase.from('user_profiles').select('id, display_name')
  ])
  const metaMap = new Map((metaResult.data ?? []).map(m => [m.conversation_id, m]))
  const agentMap = new Map((agentsResult.data ?? []).map(a => [a.id, a.display_name]))

  // Build CSV — UTF-8 BOM for Excel compatibility
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`
  const headerRow = ['Contact Name', 'Phone Number', 'Status', 'Assigned Agent', 'Message Count', 'Last Active']
  const dataRows = allConversations.map(c => {
    const meta = metaMap.get(c.id)
    const agentName = meta?.assigned_agent_id ? (agentMap.get(meta.assigned_agent_id) ?? '') : ''
    return [
      escape(c.kapso?.contactName ?? ''),
      c.phoneNumber ?? '',
      meta?.status ?? 'abierto',
      escape(agentName),
      String(c.kapso?.messagesCount ?? 0),
      c.lastActiveAt ?? ''
    ].join(',')
  })

  const csv = '\uFEFF' + [headerRow.join(','), ...dataRows].join('\n')
  const filename = `conversaciones-${from}-${to}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  })
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Chart.js with react-chartjs-2 | Recharts (React-native SVG) | ~2022 onwards | Recharts composes as JSX, easier to customize, better TypeScript support |
| Recharts 2.x (React 19 peer dep issues) | Recharts 3.7.0 (React 19 officially supported) | Late 2024 / 2025 | No `--legacy-peer-deps` flag needed |
| Client-side CSV generation | Route Handler streaming | Next.js App Router | No UI thread blocking, works with large datasets |
| Direct GROUP BY in supabase-js | Supabase RPC functions | Always the case | supabase-js never supported GROUP BY natively |
| `CategoricalChartState` internal state | `useActiveTooltipLabel` hook | Recharts 3.0 | Breaking change in v3 — internal state no longer directly accessible |

**Deprecated/outdated:**
- `TooltipProps` type: Renamed to `TooltipContentProps` in Recharts 3.0 when using custom `content` prop
- `<Customized>` wrapper component: No longer required in Recharts 3.0 — custom components render directly

---

## Open Questions

1. **Available columns on `conversation_metadata`**
   - What we know: The code uses `conversation_id`, `status`, `assigned_agent_id`, `updated_at` (via upserts in status/assign routes)
   - What's unclear: Whether there is a `created_at` column — if yes, it could be used for "conversations opened per day" (more accurate than `updated_at`)
   - Recommendation: In the analytics Route Handler, select `*` once and log the shape, or check the Supabase dashboard before finalizing the SQL functions

2. **Kapso pagination cursor behavior at date range boundary**
   - What we know: `lastActiveSince` and `lastActiveUntil` are confirmed in SDK TypeScript types
   - What's unclear: Whether the `after` cursor is global or within-filter — if cursor resets filter context, pagination loop could loop forever
   - Recommendation: Implement pagination with a safety cap (max 20 pages = 2000 conversations) and log when cap is hit

3. **Response time metric accuracy**
   - What we know: `lastInboundAt` and `lastOutboundAt` are available in `ConversationKapsoExtensions`; no "first" inbound/outbound timestamps available
   - What's unclear: Whether this gives a useful metric or just always shows ~0 (both are recent)
   - Recommendation: Display as "Avg. time between last message and last reply" with a tooltip explaining the approximation; if data quality is poor, consider removing the KPI card from this phase

---

## Sources

### Primary (HIGH confidence)
- Recharts npm registry — version 3.7.0, peer dependencies confirmed via `npm registry` API call
- `/c/Users/Gustavo/Desktop/kapsoweb/node_modules/@kapso/whatsapp-cloud-api/dist/index.d.ts` — TypeScript types confirming `lastActiveSince`, `lastActiveUntil` on `conversations.list()` and `since`/`until` on message query
- `/c/Users/Gustavo/Desktop/kapsoweb/node_modules/@kapso/whatsapp-cloud-api/dist/types-C54JCLUQ.d.ts` — `ConversationRecord` and `ConversationKapsoExtensions` shape confirmed
- `https://nextjs.org/docs/app/getting-started/route-handlers` — Route Handler CSV response pattern (docs dated 2026-02-20)
- `https://supabase.com/docs/reference/javascript/rpc` — RPC call syntax confirmed

### Secondary (MEDIUM confidence)
- Recharts 3.0 migration guide (`https://github.com/recharts/recharts/wiki/3.0-migration-guide`) — breaking changes confirmed, `CategoricalChartState` removed
- WebSearch + GitHub issue #4558 confirming Recharts React 19 support in v2.13+ (now v3.7.0)
- Supabase GROUP BY discussion (#19517) confirming RPC is the correct approach for aggregations

### Tertiary (LOW confidence)
- Response time calculation formula from multiple blog posts — industry standard FRT formula; no authoritative Kapso-specific documentation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — recharts 3.7.0 peer deps verified via npm registry; date-fns and Supabase already in package.json
- Architecture: HIGH — patterns match existing codebase conventions; admin guard inheritance confirmed by reading admin/layout.tsx
- Kapso date filtering: HIGH — `lastActiveSince`/`lastActiveUntil` confirmed in SDK TypeScript types (not just docs)
- Supabase GROUP BY via RPC: HIGH — official Supabase docs confirm RPC is the supported path; JS client does not support GROUP BY
- CSV Route Handler: HIGH — official Next.js docs (dated 2026-02-20) confirm Response object pattern
- Response time metric: LOW — no authoritative data on field accuracy; approximation noted
- Conversation_metadata schema: MEDIUM — confirmed columns from code reading, but full schema unknown without DB access

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable libraries; recharts unlikely to release breaking change in 30 days)
