# Technology Stack -- Commercial-Grade Features

**Project:** Maissi Beauty Shop -- WhatsApp Cloud Inbox
**Researched:** 2026-02-21
**Scope:** Stack ADDITIONS for commercial-grade inbox features. Does NOT re-research existing stack.

---

## Existing Stack (validated, not changed)

| Technology | Version | Status |
|------------|---------|--------|
| Next.js App Router | 15.5.9 | Stays |
| React | 19.1.0 | Stays |
| TypeScript | 5.9.3 | Stays |
| @supabase/supabase-js | ^2.97.0 | Stays |
| @supabase/ssr | ^0.8.0 | Stays |
| @kapso/whatsapp-cloud-api | ^0.1.0 | Stays |
| Radix UI primitives | Various | Stays -- expand with new primitives |
| Tailwind CSS | ^4 | Stays |
| date-fns | ^4.1.0 | Stays |
| lucide-react | ^0.545.0 | Stays |
| class-variance-authority | ^0.7.1 | Stays |
| Vercel (hosting) | N/A | Stays |
| Supabase (DB + Auth) | N/A | Stays |

---

## New Dependencies Required

### 1. Error Tracking: @sentry/nextjs

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| `@sentry/nextjs` | ^10.39.0 | Error tracking, performance monitoring, session replay | HIGH |

**Why:** This is the industry standard for production error tracking. Without it, errors in production are invisible -- you only know something broke when a user complains. Sentry provides automatic error capture in client components, server components, API routes, and middleware. The Next.js SDK auto-instruments all of these.

**Integration:** Sentry 10.x creates three config files:
- `instrumentation-client.ts` -- browser-side SDK initialization
- `sentry.server.config.ts` -- Node.js runtime initialization
- `sentry.edge.config.ts` -- Edge runtime initialization (used by middleware)
- `next.config.ts` wraps with `withSentryConfig()`
- `app/global-error.tsx` captures React rendering errors

**Setup:** Run `npx @sentry/wizard@latest -i nextjs` which auto-detects Next.js 15 App Router and generates all config files.

**Cost:** Sentry free tier includes 5K errors/month and 10K performance transactions/month. More than sufficient for a small team inbox app.

**Source:** [Sentry Next.js Guide](https://docs.sentry.io/platforms/javascript/guides/nextjs/), [npm @sentry/nextjs](https://www.npmjs.com/package/@sentry/nextjs)

---

### 2. Charts: recharts

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| `recharts` | ^3.7.0 | Analytics dashboard charts (bar, line, pie) | HIGH |

**Why recharts over alternatives:**
- **Built on React + D3** -- declarative JSX API that fits naturally into the component model
- **No wrapper gymnastics** -- unlike Chart.js (requires react-chartjs-2 wrapper and canvas refs), recharts components are native React
- **SSR compatible** -- renders SVG, works with Next.js server components without `"use client"` workarounds for the chart container
- **Responsive** -- built-in `ResponsiveContainer` component
- **Active maintenance** -- v3.7.0 published January 2026, regular releases

**What NOT to use:**
- `chart.js` + `react-chartjs-2` -- Canvas-based, requires refs and imperative API, poor SSR story
- `@nivo/core` -- Excellent but heavier dependency tree, overkill for 3-4 chart types
- `victory` -- Salesforce-maintained, solid but less community adoption than recharts
- `tremor` -- Beautiful but opinionated UI framework, adds design system conflicts with existing Radix + Tailwind setup

**Integration:** Pure React components. Wrap in `"use client"` components, feed data from API routes or server actions.

```tsx
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';
```

**Source:** [recharts npm](https://www.npmjs.com/package/recharts), [GitHub releases](https://github.com/recharts/recharts/releases)

---

### 3. Toast Notifications: sonner

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| `sonner` | ^2.0.7 | In-app toast notifications for actions (saved, assigned, error) | HIGH |

**Why sonner:**
- Zero-config defaults with smooth animations
- Works with Next.js App Router (single `<Toaster />` in layout)
- 8M+ weekly npm downloads, used by Vercel themselves
- Default toast component in shadcn/ui ecosystem (matches existing Radix + Tailwind patterns)
- Tiny bundle -- no heavy dependencies
- Supports success, error, loading, and custom toast types

**What NOT to use:**
- `react-hot-toast` -- Good but less actively maintained, sonner has surpassed it
- `@radix-ui/react-toast` -- Lower-level primitive, requires building your own toast UI
- `react-toastify` -- Heavier, jQuery-era styling approach, doesn't fit Tailwind ecosystem

**Integration:** Add `<Toaster />` to `app/layout.tsx`, then call `toast.success("Saved")` anywhere.

**Source:** [sonner npm](https://www.npmjs.com/package/sonner), [sonner.emilkowal.ski](https://sonner.emilkowal.ski/)

---

### 4. CSV Export: papaparse

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| `papaparse` | ^5.5.3 | Conversation export to CSV | HIGH |

**Why papaparse (not react-papaparse):**
- Use the base `papaparse` library, NOT `react-papaparse` (wrapper is 2 years stale, unnecessary abstraction)
- `papaparse.unparse()` converts JSON arrays to CSV strings -- that is the only function needed for export
- Lightweight, battle-tested, handles edge cases (commas in fields, unicode, newlines)
- Client-side only -- no server round-trip for export

**What NOT to use:**
- `react-papaparse` -- Stale wrapper (last publish 2+ years ago), adds React-specific overhead for a utility function
- `csv-stringify` -- Node.js-focused, not ideal for browser-side export
- Manual CSV generation -- Edge cases with escaping make this error-prone

**Integration:** Build a utility function:
```typescript
import Papa from 'papaparse';

export function exportToCsv(data: Record<string, unknown>[], filename: string) {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  // Trigger download via hidden anchor element
}
```

**Types:** Install `@types/papaparse` as devDependency.

**Source:** [papaparse npm](https://www.npmjs.com/package/papaparse)

---

### 5. Additional Radix UI Primitives

The project already uses several Radix primitives. These additional ones are needed for new features:

| Package | Version | Purpose | Needed For |
|---------|---------|---------|------------|
| `@radix-ui/react-select` | ^2.2.6 | Dropdown select (status, assignment) | Conversation status, agent assignment |
| `@radix-ui/react-dropdown-menu` | ^2.1.16 | Context menus, action menus | Conversation actions (assign, tag, export) |
| `@radix-ui/react-tabs` | ^1.1.13 | Tab panels | Analytics dashboard tabs, contact profile sections |
| `@radix-ui/react-tooltip` | ^1.2.8 | Hover tooltips | Icon buttons, status indicators |
| `@radix-ui/react-popover` | ^1.1.15 | Popover panels | Tag picker, quick reply picker |
| `@radix-ui/react-switch` | ^1.2.6 | Toggle switches | Settings toggles, notification preferences |
| `@radix-ui/react-checkbox` | ^1.3.3 | Checkboxes | Bulk conversation selection |
| `@radix-ui/react-context-menu` | ^2.2.15 | Right-click menus | Conversation list context actions |

**Why expand Radix rather than switch to a different component library:**
- Already using 7 Radix primitives -- consistency matters
- Radix primitives are unstyled -- they work with existing Tailwind patterns
- Each primitive is independently versioned and tree-shakeable
- No design system lock-in (unlike MUI, Ant Design, Mantine)

**Note on versions:** All Radix primitive versions listed were verified via npm as of 2026-02-21. All were published ~6 months ago, indicating a stable coordinated release.

**Source:** [Radix Primitives](https://www.radix-ui.com/primitives), npm package pages for each

---

### 6. Command Menu (Message Search): cmdk

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| `cmdk` | ^1.1.1 | Global search command palette (Cmd+K) | MEDIUM |

**Why cmdk:**
- Built on Radix UI primitives -- consistent with existing stack
- Composable API -- render custom search result items
- Accessible out of the box (keyboard navigation, screen readers)
- Used by Vercel, Linear, Raycast -- proven pattern for search UX
- 1.1.1 is stable (published ~1 year ago), no breaking changes expected

**Alternative considered:** Build search with a plain Radix Dialog + custom filtering. This is viable but cmdk handles keyboard navigation, fuzzy matching, and result grouping for free. The time savings justify the 8KB dependency.

**Integration:** Wrap in a Dialog, connect to a search API route that queries Supabase full-text search.

**Source:** [cmdk npm](https://www.npmjs.com/package/cmdk), [cmdk.paco.me](https://cmdk.paco.me/)

---

## Supabase Schema Additions (No New Dependencies)

These features require new Supabase tables and RLS policies but NO new npm packages. The existing `@supabase/supabase-js` client handles all of these.

### New Tables Required

```sql
-- User profiles with roles (RBAC)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'agent')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Canned responses / quick replies
CREATE TABLE canned_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shortcut TEXT NOT NULL UNIQUE,        -- e.g., "/greeting"
  title TEXT NOT NULL,                   -- display name
  content TEXT NOT NULL,                 -- message body
  category TEXT,                         -- optional grouping
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Internal notes on conversations
CREATE TABLE conversation_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT NOT NULL,         -- Kapso conversation ID
  author_id UUID REFERENCES user_profiles(id) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Conversation metadata (status, assignment, labels)
CREATE TABLE conversation_metadata (
  conversation_id TEXT PRIMARY KEY,      -- Kapso conversation ID
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'pending')),
  assigned_to UUID REFERENCES user_profiles(id),
  labels TEXT[] DEFAULT '{}',            -- PostgreSQL array for tags
  contact_name TEXT,                     -- editable display name override
  contact_email TEXT,
  contact_notes TEXT,                    -- free-form contact profile notes
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Labels/tags master list
CREATE TABLE labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#6b7280', -- hex color
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### RBAC via Supabase Custom Claims

**Approach:** Use Supabase's Custom Access Token Hook to inject the user's role into their JWT.

**How it works:**
1. Create a `user_profiles` table with a `role` column (`admin` | `agent`)
2. Create a PostgreSQL function that runs as a Custom Access Token Hook
3. The function reads `user_profiles.role` and sets it as `app_metadata.user_role` in the JWT
4. RLS policies check `(auth.jwt() -> 'app_metadata' ->> 'user_role')` for authorization

**Why this over app-level role checks:**
- Role enforcement happens at the DATABASE level -- even if app code has a bug, unauthorized access is blocked
- No additional npm packages needed
- Standard Supabase pattern, well-documented

**Admin-only operations protected by RLS:**
- User management (create/update/delete user_profiles)
- Canned response management (create/update/delete)
- Label management
- Settings changes

**Agent operations (all authenticated users):**
- Read canned responses
- Create/read conversation notes
- Update conversation status and assignment
- Read/update conversation metadata

**Source:** [Supabase RBAC Docs](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac), [Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)

### Full-Text Search for Messages

**Approach:** Use PostgreSQL's built-in `tsvector` full-text search via Supabase.

Messages are stored in Kapso's system (accessed via WhatsApp Cloud API), NOT in Supabase. Two strategies:

**Strategy A (Recommended): Search via Kapso API**
- If the Kapso SDK supports message search/filtering, use it directly
- No local message storage needed
- Simpler architecture

**Strategy B (Fallback): Local message cache**
- Create a `message_cache` table with a `tsvector` column
- Sync messages on view (when a conversation is opened, cache messages)
- Build a GIN index for fast full-text search
- Use `supabase.rpc('search_messages', { query: 'term' })` for search

```sql
-- Only if Strategy B is needed
CREATE TABLE message_cache (
  id TEXT PRIMARY KEY,                   -- Kapso message ID
  conversation_id TEXT NOT NULL,
  content TEXT,
  direction TEXT CHECK (direction IN ('inbound', 'outbound')),
  message_type TEXT,
  timestamp TIMESTAMPTZ,
  fts tsvector GENERATED ALWAYS AS (to_tsvector('spanish', coalesce(content, ''))) STORED
);

CREATE INDEX idx_message_cache_fts ON message_cache USING GIN (fts);
```

**Note:** Use `'spanish'` text search configuration since the app serves Spanish-speaking customers (Maissi Beauty Shop). This enables proper stemming for Spanish words.

**Source:** [Supabase Full Text Search](https://supabase.com/docs/guides/database/full-text-search)

---

## Real-Time Strategy: Supabase Realtime (NOT SSE)

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| Supabase Realtime (built into `@supabase/supabase-js`) | Already installed | Real-time updates for conversation status, assignments, notes | HIGH |

**Why Supabase Realtime instead of custom SSE:**

The project currently uses polling (10s conversations, 5s messages). The milestone calls for "Real-time via SSE." After research, Supabase Realtime is the better choice:

1. **Already installed** -- `@supabase/supabase-js` includes the Realtime client. Zero new dependencies.
2. **Postgres Changes** -- Subscribe to INSERT/UPDATE/DELETE on any table. When an agent changes conversation status or adds a note, all connected clients see it instantly.
3. **No Vercel timeout issues** -- Custom SSE on Vercel has severe limitations:
   - Serverless functions: 10s timeout (Hobby) / 60s (Pro)
   - Edge runtime: 300s max, must begin response in 25s
   - Supabase Realtime uses its own WebSocket infrastructure, bypassing Vercel's limitations entirely
4. **Built-in reconnection** -- Handles network drops, tab switching, etc.

**What Supabase Realtime covers:**
- Conversation status changes (open/resolved/pending)
- Conversation assignments
- New internal notes
- Label changes
- New canned responses

**What Supabase Realtime does NOT cover:**
- New WhatsApp messages (these come from Kapso, not Supabase)
- Keep polling for WhatsApp messages via Kapso API, but reduce frequency by using Realtime for "something changed" signals

**Implementation pattern:**
```typescript
// Client component
const supabase = createClient();

useEffect(() => {
  const channel = supabase
    .channel('conversation-changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'conversation_metadata'
    }, (payload) => {
      // Update local state
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, []);
```

**Prerequisite:** Enable Realtime on the target tables in Supabase Dashboard > Database > Publications > supabase_realtime.

**Source:** [Supabase Realtime with Next.js](https://supabase.com/docs/guides/realtime/realtime-with-nextjs), [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)

---

## Sound Notifications

**No new dependency needed.** The project already has a Web Audio beep implementation in `src/hooks/use-handoff-alerts.ts` for handoff notifications. Extend this pattern:

- Use the existing Web Audio API oscillator pattern for new-message sounds
- Add a `NotificationPreferences` component using Radix Switch for per-user sound toggles
- Store preferences in `localStorage` (user-specific, no server round-trip needed)

**What NOT to add:**
- `howler.js` or `use-sound` -- Overkill for simple notification beeps. Web Audio API is already proven in this codebase.

---

## What NOT to Add

| Category | Rejected Option | Why Not |
|----------|----------------|---------|
| State management | Redux, Zustand, Jotai | The app uses React state + polling. Supabase Realtime subscriptions in `useEffect` + local state is sufficient. No global state complexity needed for this scale. |
| ORM | Prisma, Drizzle | Still overkill. The Supabase client `.from('table').select()` API is sufficient for 5-6 tables. ORMs add migration complexity on Supabase. |
| Form library | React Hook Form + Zod | Already in the "not used" category for this project. The existing pattern uses Server Actions with native FormData -- keep it consistent. Adding RHF for a few forms is unnecessary churn. |
| CSS framework | Mantine, MUI, Chakra | Already on Radix + Tailwind. Switching or adding another component library creates inconsistency. |
| Search | Algolia, Meilisearch, Typesense | External search service is overkill. PostgreSQL full-text search handles the volume (hundreds to low thousands of messages). |
| Real-time | Socket.io, Pusher, Ably | Supabase Realtime is already included and sufficient. Adding another real-time provider creates infrastructure complexity. |
| Analytics backend | Mixpanel, Amplitude, PostHog | The analytics dashboard shows operational metrics (response times, volume). These come from querying the local DB, not event tracking. External analytics is for product analytics, which is out of scope. |
| CSV export | xlsx, exceljs | CSV is sufficient for conversation export. Excel format adds complexity without value -- CSV opens in Excel anyway. |
| Date library | moment.js, dayjs | Already using date-fns v4. Stick with it. |
| Toast | react-hot-toast, react-toastify | sonner is the modern standard, fits the Tailwind ecosystem better. |
| Command palette | kbar | cmdk is lighter, built on Radix, better maintained. |

---

## Installation Summary

```bash
# Error tracking
npm install @sentry/nextjs

# Charts for analytics dashboard
npm install recharts

# Toast notifications
npm install sonner

# CSV export
npm install papaparse
npm install -D @types/papaparse

# Command menu for search
npm install cmdk

# Additional Radix UI primitives
npm install @radix-ui/react-select @radix-ui/react-dropdown-menu @radix-ui/react-tabs @radix-ui/react-tooltip @radix-ui/react-popover @radix-ui/react-switch @radix-ui/react-checkbox @radix-ui/react-context-menu
```

**Total new runtime dependencies:** 12 packages (Sentry, recharts, sonner, papaparse, cmdk, 8 Radix primitives)
**Total new dev dependencies:** 1 package (@types/papaparse)

**Bundle impact estimate:**
- @sentry/nextjs: ~30KB gzipped (client), loaded async
- recharts: ~45KB gzipped (only loaded on analytics page)
- sonner: ~5KB gzipped
- papaparse: ~7KB gzipped (only loaded on export action)
- cmdk: ~8KB gzipped
- Radix primitives: ~2-4KB each, tree-shaken, loaded per-page

---

## Integration Map: New Dependencies to Features

| Feature | New Dependencies | Supabase Schema | Existing Stack Used |
|---------|-----------------|-----------------|---------------------|
| Canned responses | @radix-ui/react-popover | `canned_responses` table | Supabase client, Tailwind |
| Internal notes | (none) | `conversation_notes` table | Supabase client, date-fns |
| Conversation status | @radix-ui/react-select | `conversation_metadata` table | Supabase client, Supabase Realtime |
| User management | @radix-ui/react-dialog (existing) | `user_profiles` table + Custom Claims | Supabase Auth, RLS |
| RBAC | (none -- SQL only) | Custom Access Token Hook + RLS policies | Supabase Auth |
| Conversation assignment | @radix-ui/react-select | `conversation_metadata.assigned_to` | Supabase client, Supabase Realtime |
| Contact profiles | @radix-ui/react-tabs | `conversation_metadata` fields | Supabase client |
| Message search | cmdk | `message_cache` table (if Strategy B) | Supabase client, full-text search |
| Analytics dashboard | recharts | Aggregate queries on existing tables | Supabase client, date-fns |
| Sound notifications | (none) | (none) | Web Audio API (existing pattern) |
| Customer labels/tags | @radix-ui/react-popover, @radix-ui/react-checkbox | `labels` table, `conversation_metadata.labels` | Supabase client |
| Conversation export | papaparse | (none) | Existing conversation data |
| Error tracking | @sentry/nextjs | (none) | Next.js config |
| Toast feedback | sonner | (none) | Layout component |
| Real-time updates | (none -- already installed) | Enable Realtime on tables | Supabase Realtime |

---

## Confidence Assessment

| Decision | Confidence | Basis |
|----------|------------|-------|
| @sentry/nextjs for error tracking | HIGH | Industry standard, official Next.js 15 support verified via docs |
| recharts for analytics charts | HIGH | v3.7.0 verified on npm (Jan 2026), active maintenance, React-native API |
| sonner for toasts | HIGH | 8M+ weekly downloads, used by Vercel, fits Tailwind ecosystem |
| papaparse for CSV export | HIGH | v5.5.3 verified, battle-tested, lightweight |
| cmdk for search | MEDIUM | v1.1.1 is 1 year old -- stable but verify no breaking changes with React 19 |
| Supabase Realtime over custom SSE | HIGH | Already installed, avoids Vercel timeout issues, official Supabase pattern |
| Supabase Custom Claims for RBAC | HIGH | Official Supabase docs, standard pattern, no new dependencies |
| PostgreSQL full-text search | MEDIUM | Depends on whether messages are cached locally or searched via Kapso API |
| Radix primitive versions | HIGH | All verified on npm 2026-02-21 |
| No state management library | HIGH | App scale does not warrant global state -- React state + Supabase subscriptions suffice |

---

## Sources

- [@sentry/nextjs npm](https://www.npmjs.com/package/@sentry/nextjs) -- v10.39.0 verified
- [Sentry Next.js Setup Guide](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [recharts npm](https://www.npmjs.com/package/recharts) -- v3.7.0 verified
- [recharts GitHub](https://github.com/recharts/recharts/releases)
- [sonner npm](https://www.npmjs.com/package/sonner) -- v2.0.7 verified
- [papaparse npm](https://www.npmjs.com/package/papaparse) -- v5.5.3 verified
- [cmdk npm](https://www.npmjs.com/package/cmdk) -- v1.1.1 verified
- [Radix UI Primitives](https://www.radix-ui.com/primitives)
- [Supabase RBAC with Custom Claims](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac)
- [Supabase Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)
- [Supabase Full Text Search](https://supabase.com/docs/guides/database/full-text-search)
- [Supabase Realtime with Next.js](https://supabase.com/docs/guides/realtime/realtime-with-nextjs)
- [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Vercel SSE Timeout Limits](https://vercel.com/kb/guide/what-can-i-do-about-vercel-serverless-functions-timing-out)
- [Vercel Edge Runtime Execution Limits](https://vercel.com/changelog/new-execution-duration-limit-for-edge-functions)
- [Next.js SSE Discussion](https://github.com/vercel/next.js/discussions/48427)
