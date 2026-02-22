# Phase 9: Conversation Management - Research

**Researched:** 2026-02-22
**Domain:** Supabase CRUD (new tables), Radix UI Select + Tabs primitives, Next.js App Router route handlers (PATCH/POST/DELETE), React state management for filtered conversation lists
**Confidence:** HIGH

---

## Summary

Phase 9 adds three orthogonal systems — status lifecycle, agent assignment, and contact labels — all stored in Supabase and layered on top of the existing conversation list and message view. The work is entirely additive: new Supabase tables, new API routes, and augmented UI components. No Kapso core files are touched.

The key architectural insight is that **conversation status, assignment, and labels are all stored in Supabase (not in Kapso)**. Kapso owns the WhatsApp messaging data; this project owns the ticket-management metadata overlaid on top of it. The `conversations.id` from Kapso (a string UUID) is the foreign key that ties everything together. Three new Supabase tables are needed: `conversation_metadata` (status + assigned_agent_id), `contact_labels` (admin-defined label catalog), and `conversation_contact_labels` (join table attaching labels to phone numbers).

The UI work requires two Radix UI primitives not currently installed: `@radix-ui/react-select` (for the status dropdown in the message header) and `@radix-ui/react-tabs` (for the Abierto/Pendiente/Resuelto/Todos tab strip). The status filtering tabs live in the conversation list header; the status-change dropdown lives in the message view header. Assignment control belongs in the message view header alongside the status dropdown — this keeps both conversation management controls co-located and avoids a separate side panel.

**Primary recommendation:** Store all conversation management metadata in Supabase with `conversation_id` (text, matching Kapso's UUID string) as the foreign key. Use `@radix-ui/react-tabs` for filter tabs in conversation list, `@radix-ui/react-select` for status/assignment dropdowns in the message header. Implement auto-reopen (Resuelto → Abierto) in the webhook/inbound message handler at the API level.

---

## Standard Stack

### Core (already installed — no version change)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.97.0 | Database CRUD for new tables | Already in use for canned_responses, app_settings |
| `@supabase/ssr` | ^0.8.0 | Server-side Supabase client in route handlers | Already in use |
| `next` | 15.5.9 | App Router, route handlers, Server Actions | Already in use |
| `react` | 19.1.0 | useActionState, client components | Already in use |
| `lucide-react` | ^0.545.0 | Status dot icons, assignment icons | Already in use |

### New — Must Install
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@radix-ui/react-select` | 2.2.6 | Status dropdown in message header | Accessible, keyboard-navigable, portal-rendered. No focus-theft issue for this use case (not inside a text input). |
| `@radix-ui/react-tabs` | 1.1.13 | Status filter tabs in conversation list | Keyboard-navigable tab strip, correct ARIA roles, matches pattern used by Radix-backed shadcn components |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tailwind-merge` + `clsx` | ^3.3.1 / ^2.1.1 | Conditional class merging for status colors | Status-colored dots, label pill colors |
| `class-variance-authority` | ^0.7.1 | Variant styles for status badges | Color variants for Abierto/Pendiente/Resuelto |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@radix-ui/react-tabs` | Custom `<button>` row with `useState` | Custom tabs lack ARIA `role="tablist"`, keyboard arrow-key navigation. Phase 8 proved simple custom solutions work for non-interactive lists, but tabs have specific a11y requirements. |
| `@radix-ui/react-select` | Native `<select>` | Native select is unstyled, inconsistent cross-browser, cannot be customized to match WhatsApp-like UI. Radix Select matches the existing design language. |
| Separate assignment side panel | Assignment in message header (recommended) | Header keeps both controls visible without a separate panel toggle. The conversation list has compact width (96 = 384px) leaving enough space. |

**Installation:**
```bash
npm install @radix-ui/react-select @radix-ui/react-tabs
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── admin/
│   │   ├── labels/                    # NEW: admin label management page
│   │   │   ├── page.tsx               # Server Component — reads labels from Supabase
│   │   │   ├── LabelsManager.tsx      # Client Component — create/edit/delete UI
│   │   │   └── actions.ts             # Server Actions — createLabel, updateLabel, deleteLabel
│   │   └── layout.tsx                 # EXISTING: admin role guard (already redirects non-admin)
│   └── api/
│       ├── conversations/
│       │   ├── route.ts               # EXISTING: GET list — extend to accept ?status= filter
│       │   └── [id]/
│       │       ├── status/route.ts    # NEW: PATCH to update status
│       │       └── assign/route.ts   # NEW: PATCH to update assigned_agent_id
│       └── labels/
│           ├── route.ts               # NEW: GET all labels (for agent label picker)
│           └── contacts/
│               └── [phone]/route.ts  # NEW: GET/POST/DELETE contact labels
├── components/
│   ├── conversation-list.tsx          # MODIFIED: add tabs, status dots, initials badge, label pills
│   ├── message-view.tsx               # MODIFIED: add status dropdown + assignment dropdown to header
│   └── ui/
│       ├── select.tsx                 # NEW: shadcn-style Select wrapper over @radix-ui/react-select
│       └── tabs.tsx                   # NEW: shadcn-style Tabs wrapper over @radix-ui/react-tabs
└── hooks/
    └── use-conversation-metadata.ts   # NEW: fetches status+assignment for current conversation
```

### Database Schema (Supabase SQL)

```sql
-- conversation_metadata: stores status and assignment per Kapso conversation
CREATE TABLE public.conversation_metadata (
  conversation_id  TEXT PRIMARY KEY,         -- Kapso conversation UUID (string)
  status           TEXT NOT NULL DEFAULT 'abierto'
                     CHECK (status IN ('abierto', 'pendiente', 'resuelto')),
  assigned_agent_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.conversation_metadata ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read and write conversation metadata
CREATE POLICY "Agents can read conversation metadata"
  ON public.conversation_metadata FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Agents can insert conversation metadata"
  ON public.conversation_metadata FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Agents can update conversation metadata"
  ON public.conversation_metadata FOR UPDATE
  TO authenticated
  USING (true);

-- contact_labels: admin-defined label catalog
CREATE TABLE public.contact_labels (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  color      TEXT NOT NULL DEFAULT '#6B7280', -- hex color chosen by admin
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.contact_labels ENABLE ROW LEVEL SECURITY;

-- All agents can read labels; only admins can create/edit/delete
CREATE POLICY "All agents can read labels"
  ON public.contact_labels FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can insert labels"
  ON public.contact_labels FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');

CREATE POLICY "Only admins can update labels"
  ON public.contact_labels FOR UPDATE
  TO authenticated
  USING ((SELECT public.get_my_role()) = 'admin');

CREATE POLICY "Only admins can delete labels"
  ON public.contact_labels FOR DELETE
  TO authenticated
  USING ((SELECT public.get_my_role()) = 'admin');

-- conversation_contact_labels: join table — labels on contacts (keyed by phone number)
-- Using phone number as the contact identifier since Kapso uses phone numbers, not contact UUIDs
CREATE TABLE public.conversation_contact_labels (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  label_id   UUID NOT NULL REFERENCES public.contact_labels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (phone_number, label_id)
);

ALTER TABLE public.conversation_contact_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All agents can read contact labels"
  ON public.conversation_contact_labels FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "All agents can manage contact labels"
  ON public.conversation_contact_labels FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "All agents can remove contact labels"
  ON public.conversation_contact_labels FOR DELETE
  TO authenticated
  USING (true);
```

### Pattern 1: Status Tab Filtering — Client-Side After Fetch

**What:** Fetch all conversations from Kapso, then fetch `conversation_metadata` rows in a single `.in()` query, join them client-side (or in the API route), and filter by the selected tab.

**Why client-side:** Kapso's conversation list is the source of truth for which conversations exist. We cannot push a `WHERE status = 'abierto'` into Kapso's API. The practical approach is: fetch conversations from Kapso, fetch all metadata for those conversation IDs in one Supabase `.in()` query, merge the two arrays, and filter by the active tab in React state.

**When to use:** On every poll cycle. The merge adds ~5ms for the Supabase `.in()` query — acceptable for this use case.

**Example:**
```typescript
// In /api/conversations/route.ts — augmented version
// Source: existing pattern + Supabase .in() from getConfigs()

export async function GET(request: Request) {
  // ... existing Kapso fetch ...
  const conversationIds = transformedData.map(c => c.id)

  // Single query to fetch all metadata
  const supabase = await createClient()
  const { data: metadata } = await supabase
    .from('conversation_metadata')
    .select('conversation_id, status, assigned_agent_id')
    .in('conversation_id', conversationIds)

  // Merge metadata into conversations
  const metaMap = new Map(metadata?.map(m => [m.conversation_id, m]) ?? [])
  const enriched = transformedData.map(c => ({
    ...c,
    convStatus: metaMap.get(c.id)?.status ?? 'abierto',
    assignedAgentId: metaMap.get(c.id)?.assigned_agent_id ?? null,
  }))

  return NextResponse.json({ data: enriched, paging: response.paging })
}
```

### Pattern 2: Status Change via PATCH Route Handler

**What:** A `PATCH /api/conversations/[id]/status` route that upserts a row in `conversation_metadata`.

**When to use:** When agent clicks a new status in the message view header dropdown.

**Example:**
```typescript
// Source: Next.js App Router route handler pattern (existing in codebase)
// src/app/api/conversations/[id]/status/route.ts

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params  // params must be awaited in Next.js 15
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { status } = await request.json()
  if (!['abierto', 'pendiente', 'resuelto'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { error } = await supabase
    .from('conversation_metadata')
    .upsert(
      { conversation_id: id, status, updated_at: new Date().toISOString() },
      { onConflict: 'conversation_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

**CRITICAL — Next.js 15 dynamic params:** `params` in route handlers is now a Promise that must be awaited. `{ params }: { params: Promise<{ id: string }> }` is the correct type.

### Pattern 3: Auto-Reopen on Inbound Message (STATUS-04)

**What:** When a customer sends a message to a Resuelto conversation, it auto-reopens to Abierto. This is detected in the webhook/inbound message handler (not client-side).

**Where to implement:** The existing `/api/messages/[conversationId]/route.ts` fetches messages. The auto-reopen must happen in whichever webhook endpoint receives inbound WhatsApp messages. Based on the codebase, Kapso handles inbound routing. The safest approach is to check-and-reopen when the message-view component loads messages for a Resuelto conversation that now has a new inbound message.

**Practical implementation:** On each `fetchMessages()` call in `message-view.tsx`, if the conversation's `convStatus` is 'resuelto' and the last message is inbound, call `PATCH /api/conversations/[id]/status` with `{ status: 'abierto' }`. This is client-side detection but fires on every poll, which is sufficient.

**Example:**
```typescript
// In message-view.tsx, inside fetchMessages callback
// After sorting messages:
const lastMessage = sortedMessages[sortedMessages.length - 1]
if (conversationStatus === 'resuelto' && lastMessage?.direction === 'inbound') {
  // Auto-reopen
  await fetch(`/api/conversations/${conversationId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'abierto' })
  })
  onStatusChanged?.('abierto')  // callback to refresh parent state
}
```

### Pattern 4: Radix UI Select for Status Dropdown

**What:** A controlled `@radix-ui/react-select` in the message view header that shows current status and triggers a PATCH call on change.

**When to use:** Status change control in message header.

**Example:**
```typescript
// Source: https://www.radix-ui.com/primitives/docs/components/select

import * as Select from '@radix-ui/react-select'

function StatusSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger className="flex items-center gap-1.5 px-2 py-1 rounded text-sm ...">
        <Select.Value />
        <Select.Icon />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="bg-white border rounded shadow-lg z-50">
          <Select.Viewport>
            <Select.Item value="abierto">
              <Select.ItemText>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  Abierto
                </span>
              </Select.ItemText>
              <Select.ItemIndicator />
            </Select.Item>
            <Select.Item value="pendiente">
              <Select.ItemText>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Pendiente
                </span>
              </Select.ItemText>
              <Select.ItemIndicator />
            </Select.Item>
            <Select.Item value="resuelto">
              <Select.ItemText>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-gray-400" />
                  Resuelto
                </span>
              </Select.ItemText>
              <Select.ItemIndicator />
            </Select.Item>
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}
```

### Pattern 5: Radix UI Tabs for Status Filter Strip

**What:** Horizontal tabs above the conversation list rendering Abierto/Pendiente/Resuelto/Todos.

**When to use:** Conversation list status filtering.

**Example:**
```typescript
// Source: https://www.radix-ui.com/primitives/docs/components/tabs

import * as Tabs from '@radix-ui/react-tabs'

function ConversationStatusTabs({ value, onValueChange }) {
  return (
    <Tabs.Root value={value} onValueChange={onValueChange}>
      <Tabs.List className="flex border-b border-[#d1d7db]">
        <Tabs.Trigger value="abierto" className="px-3 py-2 text-sm ... data-[state=active]:border-b-2 data-[state=active]:border-[#00a884]">
          Abierto
        </Tabs.Trigger>
        <Tabs.Trigger value="pendiente" className="...">Pendiente</Tabs.Trigger>
        <Tabs.Trigger value="resuelto" className="...">Resuelto</Tabs.Trigger>
        <Tabs.Trigger value="todos" className="...">Todos</Tabs.Trigger>
      </Tabs.List>
      {/* No Tabs.Content needed — tab value drives filter state only */}
    </Tabs.Root>
  )
}
```

**Note:** `Tabs.Content` is not required here. The tab selection drives a filter state; the actual conversation list is a single component that filters its data. This is a common pattern — using Tabs purely for the tab strip UI/navigation without content panels.

### Pattern 6: Assignment — Dropdown of Users from user_profiles

**What:** A `@radix-ui/react-select` populated with all agents from `user_profiles`, placed alongside the status dropdown in the message header.

**Data fetch:** Query `user_profiles` via Supabase to get all agents (role = 'agent' or 'admin') for the assignment dropdown options.

**Assignment filter in conversation list:** Use a simple filter state variable (`'todos' | 'mios' | 'sin_asignar'`) with a `<select>` or button-group below the tabs. This is separate from the status tabs to keep the UI model clear — status tabs are primary navigation, assignment filter is secondary.

### Pattern 7: Admin Label Management — CannedResponsesManager Pattern

**What:** Same pattern as Phase 8's `CannedResponsesManager.tsx` — a list + create/edit forms with Server Actions.

**Additional complexity:** Color picker for label hex color. Use a simple `<input type="color">` — it renders a native OS color picker, requires no library, and returns a hex value directly.

**Label attachment by agents:** An inline multi-select in the message view header (alongside status/assignment) or as a section in the contact info area. Recommended: a compact popover-style panel triggered by a "Labels" button in the header, showing all available labels as checkboxes. Use absolute positioning (same pattern as canned-responses-picker) to avoid Radix Popover focus-theft.

### Anti-Patterns to Avoid

- **Storing status in Kapso metadata:** Kapso's `conversation.status` is Kapso's own concept (active/ended). Do NOT conflate Kapso's status with the app's Abierto/Pendiente/Resuelto status. Use a separate Supabase table.
- **Using PostgreSQL ENUM for status:** ENUMs cannot be safely removed once created; adding values requires `ALTER TYPE`. Use a `TEXT CHECK` constraint — it is easier to modify and the three statuses are stable.
- **Using Radix Popover for label attachment inside message view:** Phase 08-03 proved Radix Popover steals focus from the message input. Use absolute CSS positioning for any overlay inside the message view.
- **Fetching user_profiles for assignment dropdown on every message view mount:** Cache the agent list in React state in the parent component and pass it down as a prop. The list changes rarely.
- **Tab content panels for conversation status tabs:** Radix Tabs expects `Tabs.Content` per trigger but it is not required if you only need the tab strip for navigation (the list is not rendered inside Tabs.Content).
- **Filtering conversations server-side via Kapso API status param:** The `status` query param in `/api/conversations` maps to Kapso's active/ended, not the app's Abierto/Pendiente/Resuelto. Do not use it for status tab filtering. Filter client-side after enriching with Supabase metadata.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Status dropdown | Custom `<div>` with `useState` for open/close + keyboard nav | `@radix-ui/react-select` | Keyboard nav (arrow keys, typeahead), portal z-index, WAI-ARIA `role="listbox"`, click-outside close — all built in |
| Status filter tab strip | `<button>` row with `useState` + border-bottom CSS | `@radix-ui/react-tabs` | Correct ARIA `role="tablist"` + `role="tab"`, keyboard arrow navigation, `data-[state=active]` for Tailwind styling |
| Admin color picker for labels | Custom color palette grid | `<input type="color">` | Native OS color picker, zero JS, returns hex value directly, universally supported |
| Upsert conversation status | Custom SELECT then INSERT/UPDATE | `supabase.upsert({ onConflict: 'conversation_id' })` | Single round-trip, race-condition safe |
| Multi-label attachment UI | Custom multi-select implementation | Checkbox list in an absolutely-positioned panel | Phase 08-03 pattern: absolute positioning avoids Radix Popover focus-theft |

**Key insight:** The Radix UI Select and Tabs primitives handle the hardest parts (accessibility, keyboard nav, portal z-index management). The custom label attachment UI is the one place where a hand-rolled approach (absolutely-positioned checkbox list) is correct — because Radix Popover would steal focus from the message input.

---

## Common Pitfalls

### Pitfall 1: Next.js 15 Dynamic Route Params Must Be Awaited

**What goes wrong:** `params.id` throws "cannot read property 'id' of undefined" or TypeScript error in route handlers.

**Why it happens:** In Next.js 15, `params` in route handlers is a Promise. The type is `{ params: Promise<{ id: string }> }`, not `{ params: { id: string } }`.

**How to avoid:** Always `const { id } = await params` before using any param value.

**Warning signs:** TypeScript error "Property 'id' does not exist on type 'Promise'". Runtime undefined errors in production.

```typescript
// CORRECT (Next.js 15):
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  // ...
}
```

### Pitfall 2: Conversation List Performance — Don't Re-Fetch Metadata on Every Poll

**What goes wrong:** Every 10-second conversation list poll triggers a new Supabase metadata query, adding latency and Supabase read operations.

**Why it happens:** Naively placing the metadata fetch inside `fetchConversations()` means it runs every poll cycle.

**How to avoid:** The metadata query is cheap (`.in()` with conversation IDs), but should be combined into the `/api/conversations` route handler's GET response — one HTTP call returns both Kapso data and Supabase metadata merged. Agents always see current metadata without a second client-side fetch.

**Warning signs:** Network tab shows two sequential fetches every 10 seconds.

### Pitfall 3: `conversation_metadata` Row May Not Exist

**What goes wrong:** A conversation that has never had its status changed has no row in `conversation_metadata`. Queries assuming a row exists return null, causing `undefined` status values to propagate into the UI.

**Why it happens:** The table starts empty. Existing conversations have no row until their status is first set.

**How to avoid:** In the merge step, default missing metadata to `{ status: 'abierto', assigned_agent_id: null }`. The business logic is "new conversations are implicitly Abierto." Do NOT insert a row for every conversation on first load — that would create thousands of rows unnecessarily.

**Warning signs:** Status shows as `undefined` or blank dot in conversation list.

### Pitfall 4: Radix Select Portal z-index in the Message View Header

**What goes wrong:** The Status dropdown renders behind the conversation list sidebar or behind the sticky header.

**Why it happens:** Radix Select uses a Portal to render in `<body>`, but the z-index stack in the existing layout may interfere.

**How to avoid:** Add `z-50` (or higher) to `Select.Content`. The existing layout uses `overflow-hidden` on the main flex container — portal-rendered elements escape this, so this should not be an issue. Verify on Vercel after first deployment.

**Warning signs:** Dropdown opens but is invisible or partially clipped.

### Pitfall 5: Label Color Contrast with Admin-Chosen Colors

**What goes wrong:** Admin picks a very light color (e.g., #FFFFFF or #FFFF00), rendering the label text unreadable.

**Why it happens:** `<input type="color">` returns any hex value with no contrast validation.

**How to avoid:** Render label pills with white text and use the admin-chosen color as background. For very light backgrounds, this will have poor contrast. Options: (a) always use white text and darken colors by 20% before saving, or (b) compute luminance and flip between black/white text. Option (b) is a known formula: if `(0.299*R + 0.587*G + 0.114*B) > 128` use black text, else white text. Implement this as a utility function.

**Warning signs:** Labels are unreadable in the conversation list.

### Pitfall 6: Assignment Filter Competes with Status Tabs for Screen Space

**What goes wrong:** Adding both status tabs (4 tabs) and assignment filter (3 options: Mios/Sin asignar/Todos) makes the conversation list header too tall.

**Why it happens:** Each control wants its own row in the header area.

**How to avoid:** Make the assignment filter a compact dropdown (native `<select>` or a minimal button-group) placed to the right of the search bar, not a separate row. Status tabs are the primary navigation — assignment and label filters are secondary and can share a single filter row below the tabs.

### Pitfall 7: `get_my_role()` Function Must Exist Before Phase 9 Tables

**What goes wrong:** Creating the RLS policies for `contact_labels` that call `public.get_my_role()` fails if Phase 7 hasn't been deployed yet.

**Why it happens:** `get_my_role()` was created in Phase 7. Phase 9 depends on it.

**How to avoid:** Confirm Phase 7 is deployed and `user_profiles` + `get_my_role()` exist before running Phase 9 SQL. Phase 9 is listed as depending on Phase 7 in the roadmap.

---

## Code Examples

### Merging Kapso Conversations with Supabase Metadata

```typescript
// Source: existing /api/conversations/route.ts pattern + Supabase .in() from getConfigs()

// After building transformedData from Kapso:
const conversationIds = transformedData.map(c => c.id)

const supabase = await createClient()

// Parallel fetch: metadata + agent profiles
const [metaResult, agentsResult] = await Promise.all([
  supabase
    .from('conversation_metadata')
    .select('conversation_id, status, assigned_agent_id')
    .in('conversation_id', conversationIds),
  supabase
    .from('user_profiles')
    .select('id, display_name')
])

const metaMap = new Map(
  (metaResult.data ?? []).map(m => [m.conversation_id, m])
)
const agentMap = new Map(
  (agentsResult.data ?? []).map(a => [a.id, a.display_name])
)

const enriched = transformedData.map(c => {
  const meta = metaMap.get(c.id)
  return {
    ...c,
    convStatus: meta?.status ?? 'abierto',
    assignedAgentId: meta?.assigned_agent_id ?? null,
    assignedAgentName: meta?.assigned_agent_id
      ? (agentMap.get(meta.assigned_agent_id) ?? null)
      : null,
  }
})
```

### Status Dot in Conversation List Item

```typescript
// Tailwind color mapping for status
const STATUS_DOT_CLASS = {
  abierto:   'bg-green-500',
  pendiente: 'bg-amber-500',
  resuelto:  'bg-gray-400',
} as const

function StatusDot({ status }: { status: string }) {
  const cls = STATUS_DOT_CLASS[status as keyof typeof STATUS_DOT_CLASS] ?? 'bg-gray-400'
  return <span className={`h-2 w-2 rounded-full flex-shrink-0 ${cls}`} />
}
```

### Initials Badge for Assigned Agent

```typescript
// Compact initials from display_name — same pattern as existing getAvatarInitials()
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function AssignedBadge({ agentName }: { agentName: string | null }) {
  if (!agentName) return null
  return (
    <span className="h-5 w-5 rounded-full bg-[#d1d7db] text-[#111b21] text-[9px] font-medium flex items-center justify-center flex-shrink-0">
      {getInitials(agentName)}
    </span>
  )
}
```

### Label Pill in Conversation List

```typescript
function LabelPill({ name, color }: { name: string; color: string }) {
  // Compute text color for contrast
  const hex = color.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b
  const textColor = luminance > 128 ? '#111827' : '#ffffff'

  return (
    <span
      style={{ backgroundColor: color, color: textColor }}
      className="text-[9px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 max-w-[60px] truncate"
    >
      {name}
    </span>
  )
}
```

### Server Action Pattern for Label Create (admin)

```typescript
// src/app/admin/labels/actions.ts — mirrors canned-responses/actions.ts pattern
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ActionResult = { success: boolean; message: string }

export async function createLabel(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const name = formData.get('name')
  const color = formData.get('color')

  if (typeof name !== 'string' || !name.trim() ||
      typeof color !== 'string' || !color.trim()) {
    return { success: false, message: 'Name and color are required' }
  }

  const supabase = await createClient()

  // Admin check (belt-and-suspenders; RLS also enforces)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, message: 'Admin only' }
  }

  const { error } = await supabase
    .from('contact_labels')
    .insert({ name: name.trim(), color: color.trim() })

  if (error) {
    if (error.message.includes('unique') || error.message.includes('duplicate')) {
      return { success: false, message: 'A label with this name already exists' }
    }
    return { success: false, message: `Create failed: ${error.message}` }
  }

  revalidatePath('/admin/labels')
  return { success: true, message: 'Label created' }
}
```

### Contact Label Attachment API Route

```typescript
// src/app/api/labels/contacts/[phone]/route.ts

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ phone: string }> }
) {
  const { phone } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('conversation_contact_labels')
    .select('label_id, contact_labels(id, name, color)')
    .eq('phone_number', phone)

  return NextResponse.json({ data })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ phone: string }> }
) {
  const { phone } = await params
  const { labelId } = await request.json()
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('conversation_contact_labels')
    .insert({ phone_number: phone, label_id: labelId })

  if (error && error.message.includes('unique')) {
    return NextResponse.json({ success: true })  // idempotent
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ phone: string }> }
) {
  const { phone } = await params
  const { labelId } = await request.json()
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase
    .from('conversation_contact_labels')
    .delete()
    .eq('phone_number', phone)
    .eq('label_id', labelId)

  return NextResponse.json({ success: true })
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| No conversation lifecycle state | Supabase-stored status per conversation_id | Agents can track work as Abierto/Pendiente/Resuelto |
| All conversations visible in one flat list | Tab-filtered by status (Abierto tab default) | Inbox functions as a ticket queue, not a raw message list |
| No agent assignment | `assigned_agent_id` in conversation_metadata | Agents can own conversations; filterable by "Mios" |
| No contact categorization | Labels stored in Supabase, displayed as colored pills | Agents can identify VIP clients, service types at a glance |

**No deprecated patterns.** This phase is purely additive. Existing components are modified, not replaced.

---

## Open Questions

1. **Where to store and fetch contact labels in the conversation list**
   - What we know: Labels are keyed by phone number. The conversation list fetches conversations from Kapso (which includes phone numbers). To show labels in the list, we need all label assignments for all currently-visible phone numbers.
   - What's unclear: Whether to join contact labels into the `/api/conversations` enrichment step (one additional Supabase `.in(phone_number, phones)` query) or fetch them lazily per conversation row.
   - Recommendation: Include label join in the `/api/conversations` route handler enrichment alongside metadata — single round-trip. Add a `SELECT conversation_contact_labels.*, contact_labels.name, contact_labels.color FROM conversation_contact_labels JOIN contact_labels ON ... WHERE phone_number IN (...)` query in the API route. Return labels as an array on each conversation object.

2. **Assignment filter UI placement**
   - What we know: The status tabs take the full width of the 384px sidebar. A second full-width filter row for assignment would push conversations down ~80px.
   - What's unclear: How many filter controls the user expects simultaneously.
   - Recommendation: Place assignment filter as a compact native `<select>` with options "Todos / Mis conversaciones / Sin asignar" to the right of the search bar (same row). Label filter as a separate compact selector or combined with assignment filter. This keeps the list header to two rows: (1) title + actions row, (2) search + assignment/label filter row, (3) status tabs.

3. **Auto-reopen trigger location**
   - What we know: There is no dedicated inbound webhook handler in this codebase — Kapso handles the WhatsApp webhook. The message view polls `/api/messages/[conversationId]` every 5 seconds.
   - What's unclear: Whether Kapso exposes any webhook event for new inbound messages that could trigger a server-side reopen.
   - Recommendation: Client-side detection in `message-view.tsx` is the only reliable option given the current architecture. When `fetchMessages()` finds a new inbound message AND the conversation's convStatus is 'resuelto', PATCH the status to 'abierto'. Add a `onStatusChanged` callback prop to `MessageView` so the parent can update its local state and re-render the conversation list item.

4. **`display_name` in `user_profiles` — populated for all users?**
   - What we know: Phase 7 research documented that `display_name` defaults to `COALESCE(raw_user_meta_data ->> 'full_name', email, '')` during backfill. Email fallback is always present.
   - What's unclear: Whether all current users have meaningful display names or just email addresses.
   - Recommendation: The assignment dropdown and initials badge can fall back to email if `display_name` is just an email. The initials logic handles emails correctly (takes first two chars). No action required, but note that agents may see email-based initials until display names are set.

---

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/components/conversation-list.tsx`, `src/components/message-view.tsx`, `src/app/admin/canned-responses/`, `src/app/api/conversations/route.ts` — verified directly
- `src/lib/supabase/server.ts` — confirmed `createClient()` pattern for route handlers
- Phase 07 RESEARCH.md — confirmed `user_profiles` table schema, `get_my_role()` function, RLS pattern
- Phase 08-03 SUMMARY.md — confirmed absolute CSS positioning pattern (avoid Radix Popover inside message view)
- [Radix UI Select docs](https://www.radix-ui.com/primitives/docs/components/select) — API structure verified via WebFetch
- [Supabase Enums docs](https://supabase.com/docs/guides/database/postgres/enums) — TEXT CHECK preferred over ENUM for mutable status lists

### Secondary (MEDIUM confidence)
- [Radix UI Tabs](https://www.radix-ui.com/primitives/docs/components/tabs) — Tabs pattern from official Radix docs; version 1.1.13 confirmed available via npm
- [Chatwoot Core Data Models](https://deepwiki.com/chatwoot/chatwoot/3-core-data-models) — confirmed industry-standard pattern: assignee_id as FK, status as integer/text, labels as join table
- `npm info @radix-ui/react-select version` → 2.2.6; `npm info @radix-ui/react-tabs version` → 1.1.13

### Tertiary (LOW confidence — pattern inference)
- Auto-reopen client-side detection pattern: inferred from codebase polling architecture; no official source. Reasonable given Kapso does not expose webhook for inbound messages in this codebase.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — packages verified via npm, existing patterns verified in codebase
- Database schema: HIGH — mirrors existing patterns (canned_responses table, user_profiles), Supabase SQL verified
- Architecture/API patterns: HIGH — Next.js 15 PATCH route handler pattern well-established; params Promise type documented
- Pitfalls: HIGH (Next.js 15 params) / MEDIUM (Radix Select z-index, color contrast) — structural issues verified; UI pitfalls are reasoned but not tested on Vercel yet
- Auto-reopen implementation: MEDIUM — client-side detection is pragmatic given the architecture, not a documented pattern

**Research date:** 2026-02-22
**Valid until:** 2026-04-22 (60 days — Supabase JS 2.97, Next.js 15.5, Radix UI 2.x are all stable)
