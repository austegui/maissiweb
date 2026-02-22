# Phase 8: Canned Responses - Research

**Researched:** 2026-02-21
**Domain:** Supabase CRUD table + RLS, Next.js Server Actions, cmdk slash-command inline dropdown, message-view integration
**Confidence:** HIGH

---

## Summary

Phase 8 has three distinct sub-domains that must work together: (1) a Supabase `canned_responses` table with RLS — all agents read, admin-only write; (2) a Next.js App Router admin page under `/admin/canned-responses/` for CRUD management using the established Server Actions pattern; and (3) an inline slash-command dropdown in the existing `message-view.tsx` message input.

The standard approach for the slash-command picker is **cmdk 1.1.1** with `CommandList` positioned absolutely below the input — NOT using Radix Popover. Radix Popover steals focus from inputs, breaking the typing UX. The cmdk library renders an unstyled filterable list that stays in sync with keyboard navigation. The whole UI lives inside `message-view.tsx` using a controlled `messageInput` state already in place.

For the admin CRUD page, the established pattern from `/admin/settings/` applies directly: Server Component page fetches data from Supabase, a Client Component form handles mutations via Server Actions (`'use server'`), and `revalidatePath()` refreshes the page after each mutation. The existing `get_my_role()` function in Supabase can be reused for RLS without any new SQL functions.

**Primary recommendation:** Install cmdk 1.1.1, use a `position: relative` wrapper around the message input area with an absolutely-positioned `Command + CommandList` overlay that appears when `messageInput.startsWith('/')`, and implement CRUD via Server Actions following the exact pattern from `/admin/settings/actions.ts`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `cmdk` | 1.1.1 | Filterable slash-command dropdown | Unstyled, composable, built-in keyboard navigation, React 19 compatible, avoids Popover focus issues |
| `@supabase/supabase-js` | ^2.97.0 | CRUD operations on canned_responses table | Already in project, same pattern as app_settings |
| `next` | 15.5.9 | Server Actions for admin CRUD | Already in project, `'use server'` + `revalidatePath` pattern established |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | ^0.545.0 | Icons for admin UI (Edit, Trash2, Plus) | Already in project |
| `@radix-ui/react-dialog` | ^1.1.15 | Modal for create/edit canned response form | Already in project, used for TemplateSelectorDialog |

### No New UI Libraries Needed

The existing `Button`, `Input`, `Textarea`, `Dialog`, `ScrollArea`, `Badge` from `/src/components/ui/` cover all UI needs for the admin page.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| cmdk | Custom onChange filter + absolute div | cmdk provides keyboard navigation (ArrowUp/ArrowDown/Enter/Escape) out of the box — hand-rolling this for accessibility takes 2-3x more code |
| cmdk | Radix Popover + Command | Popover steals input focus on open (confirmed by GitHub discussion #2705) — use absolute positioning instead |
| cmdk | react-input-trigger | Package is at beta (2.0.0-beta-7), older API, less popular — cmdk is more widely used and actively maintained |

**Installation:**
```bash
npm install cmdk
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── admin/
│   │   ├── layout.tsx               # EXISTING: role guard (Phase 7)
│   │   ├── settings/                # EXISTING: settings page
│   │   └── canned-responses/        # NEW: admin CRUD page
│   │       ├── page.tsx             # Server Component: loads canned_responses list
│   │       ├── CannedResponsesForm.tsx  # Client Component: create/edit form
│   │       └── actions.ts           # Server Actions: create, update, delete
│   └── api/
│       └── canned-responses/
│           └── route.ts             # GET: all canned responses (agent fetch in message-view)
├── components/
│   ├── message-view.tsx             # MODIFIED: add slash-command picker
│   └── canned-responses-picker.tsx  # NEW: extracted slash-command UI component
```

### Pattern 1: Supabase Table + RLS for Team-Shared Read / Admin-Write

**What:** A `canned_responses` table where all authenticated users can SELECT (read), but only admins can INSERT/UPDATE/DELETE.

**When to use:** Any team-shared resource managed by admin, readable by agents.

**SQL — run in Supabase Dashboard SQL Editor:**

```sql
-- Source: established pattern from Phase 7 research + Supabase RLS docs

CREATE TABLE public.canned_responses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  shortcut    TEXT NOT NULL,           -- e.g. "hours", "pricing"
  body        TEXT NOT NULL,           -- the full response text
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.canned_responses ENABLE ROW LEVEL SECURITY;

-- All authenticated agents and admins can read
CREATE POLICY "All agents can read canned responses"
  ON public.canned_responses
  FOR SELECT
  TO authenticated
  USING ( true );

-- Only admins can create
CREATE POLICY "Only admins can create canned responses"
  ON public.canned_responses
  FOR INSERT
  TO authenticated
  WITH CHECK ( (SELECT public.get_my_role()) = 'admin' );

-- Only admins can update
CREATE POLICY "Only admins can update canned responses"
  ON public.canned_responses
  FOR UPDATE
  TO authenticated
  USING ( (SELECT public.get_my_role()) = 'admin' )
  WITH CHECK ( (SELECT public.get_my_role()) = 'admin' );

-- Only admins can delete
CREATE POLICY "Only admins can delete canned responses"
  ON public.canned_responses
  FOR DELETE
  TO authenticated
  USING ( (SELECT public.get_my_role()) = 'admin' );
```

**Critical:** The `(SELECT public.get_my_role())` wrapping in SELECT is the established performance pattern from Phase 7 — it caches the role lookup once per query instead of re-evaluating per row.

### Pattern 2: Server Actions for Admin CRUD

**What:** Server Actions with `'use server'` directive handle create, update, and delete. The admin page is a Server Component that fetches initial data.

**When to use:** All admin CRUD pages — this is the established pattern from `/admin/settings/`.

```typescript
// src/app/admin/canned-responses/actions.ts
// Source: established pattern from src/app/admin/settings/actions.ts

'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ActionResult = { success: boolean; message: string }

export async function createCannedResponse(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const title = formData.get('title')
  const shortcut = formData.get('shortcut')
  const body = formData.get('body')

  if (typeof title !== 'string' || !title.trim() ||
      typeof shortcut !== 'string' || !shortcut.trim() ||
      typeof body !== 'string' || !body.trim()) {
    return { success: false, message: 'All fields are required' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Unauthorized' }

  const { error } = await supabase
    .from('canned_responses')
    .insert({ title: title.trim(), shortcut: shortcut.trim(), body: body.trim() })

  if (error) return { success: false, message: `Save failed: ${error.message}` }

  revalidatePath('/admin/canned-responses')
  return { success: true, message: 'Canned response created' }
}

export async function updateCannedResponse(
  id: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const title = formData.get('title')
  const shortcut = formData.get('shortcut')
  const body = formData.get('body')

  if (typeof title !== 'string' || !title.trim() ||
      typeof shortcut !== 'string' || !shortcut.trim() ||
      typeof body !== 'string' || !body.trim()) {
    return { success: false, message: 'All fields are required' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Unauthorized' }

  const { error } = await supabase
    .from('canned_responses')
    .update({ title: title.trim(), shortcut: shortcut.trim(), body: body.trim(), updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { success: false, message: `Update failed: ${error.message}` }

  revalidatePath('/admin/canned-responses')
  return { success: true, message: 'Canned response updated' }
}

export async function deleteCannedResponse(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Unauthorized' }

  const { error } = await supabase
    .from('canned_responses')
    .delete()
    .eq('id', id)

  if (error) return { success: false, message: `Delete failed: ${error.message}` }

  revalidatePath('/admin/canned-responses')
  return { success: true, message: 'Canned response deleted' }
}
```

**Note on `useActionState` for update/delete:** `useActionState` expects `(prevState, formData) => Promise`. For update actions that need `id`, use `.bind(null, id)` to pre-fill the `id` argument:

```typescript
// In the Client Component:
const boundUpdate = updateCannedResponse.bind(null, item.id)
const [state, formAction] = useActionState(boundUpdate, initialState)
```

### Pattern 3: Slash-Command Picker with cmdk

**What:** When the user types `/` as the first character in the message input, an absolutely-positioned cmdk dropdown appears filtered by what they type after `/`. Selecting inserts the canned response body and closes the dropdown.

**When to use:** Always active on the message input — triggered by `/` as first character.

**Key cmdk requirement:** `Command.List` must be a child of `Command`. Do not separate them.

**Focus management:** The message input keeps focus. The cmdk list only receives keyboard events bubbled from the input via `onKeyDown`. This avoids all Popover focus-stealing issues.

```typescript
// src/components/canned-responses-picker.tsx
// Source: cmdk docs + github.com/dip/cmdk/discussions/251 (absolute positioning pattern)

'use client'

import { useEffect, useState } from 'react'
import { Command } from 'cmdk'

type CannedResponse = {
  id: string
  title: string
  shortcut: string
  body: string
}

type Props = {
  query: string           // text typed after the "/" — e.g. "ho" for "/ho"
  onSelect: (body: string) => void
  onClose: () => void
}

export function CannedResponsesPicker({ query, onSelect, onClose }: Props) {
  const [responses, setResponses] = useState<CannedResponse[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch('/api/canned-responses')
      .then(r => r.json())
      .then(data => setResponses(data.data ?? []))
      .catch(() => setResponses([]))
      .finally(() => setLoading(false))
  }, [])  // load once, filter client-side

  const filtered = responses.filter(r =>
    r.shortcut.toLowerCase().includes(query.toLowerCase()) ||
    r.title.toLowerCase().includes(query.toLowerCase())
  )

  if (filtered.length === 0 && !loading) return null

  return (
    // Position: absolute, bottom: 100% — appears ABOVE the input
    // Container in message-view.tsx must have position: relative
    <div className="absolute bottom-full left-0 right-0 mb-1 z-50 bg-white border border-[#d1d7db] rounded-lg shadow-lg overflow-hidden max-h-64">
      <Command>
        <Command.List>
          {loading && (
            <Command.Loading>
              <div className="px-3 py-2 text-sm text-[#667781]">Loading...</div>
            </Command.Loading>
          )}
          {filtered.map(r => (
            <Command.Item
              key={r.id}
              value={r.shortcut}
              onSelect={() => {
                onSelect(r.body)
                onClose()
              }}
              className="px-3 py-2 cursor-pointer hover:bg-[#f0f2f5] flex items-center gap-2 [&[aria-selected=true]]:bg-[#f0f2f5]"
            >
              <span className="text-xs font-mono text-[#00a884]">/{r.shortcut}</span>
              <span className="text-sm text-[#111b21] truncate">{r.title}</span>
            </Command.Item>
          ))}
        </Command.List>
      </Command>
    </div>
  )
}
```

**Integration in message-view.tsx — minimal changes:**

```typescript
// Changes inside message-view.tsx (existing 'use client' component)
// Source: existing codebase patterns

// 1. Add state to track slash-command mode:
const [showCannedPicker, setShowCannedPicker] = useState(false)
const [cannedQuery, setCannedQuery] = useState('')

// 2. Modify the Input onChange handler:
const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const value = e.target.value
  setMessageInput(value)

  if (value.startsWith('/')) {
    setShowCannedPicker(true)
    setCannedQuery(value.slice(1))  // text after "/"
  } else {
    setShowCannedPicker(false)
    setCannedQuery('')
  }
}

// 3. Handle canned response selection:
const handleCannedSelect = (body: string) => {
  setMessageInput(body)
  setShowCannedPicker(false)
  setCannedQuery('')
}

// 4. Wrap the form in position: relative, add CannedResponsesPicker:
// <div className="relative ...">
//   {showCannedPicker && (
//     <CannedResponsesPicker
//       query={cannedQuery}
//       onSelect={handleCannedSelect}
//       onClose={() => setShowCannedPicker(false)}
//     />
//   )}
//   <form onSubmit={handleSendMessage} ...>
//     <Input onChange={handleMessageInputChange} ... />
//   </form>
// </div>
```

### Pattern 4: API Route for Agent Fetch

**What:** A GET `/api/canned-responses` route that returns all canned responses for the slash-command picker in `message-view.tsx`. Agents cannot use Server Actions (those are server-only); they need a client-side fetch.

**When to use:** The picker component runs client-side in `message-view.tsx` — it cannot use Server Actions. Route handler with auth check is the correct pattern, matching `/api/settings/route.ts`.

```typescript
// src/app/api/canned-responses/route.ts
// Source: established pattern from src/app/api/settings/route.ts

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('canned_responses')
    .select('id, title, shortcut, body')
    .order('shortcut', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}
```

### Pattern 5: Admin Page Server Component

**What:** The admin page for managing canned responses follows the exact structure of `/admin/settings/page.tsx` — Server Component that fetches data and passes it to a Client Component.

```typescript
// src/app/admin/canned-responses/page.tsx
// Source: established pattern from src/app/admin/settings/page.tsx

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CannedResponsesManager } from './CannedResponsesManager'

export default async function CannedResponsesPage() {
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('canned_responses')
    .select('id, title, shortcut, body')
    .order('shortcut', { ascending: true })

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold">Canned Responses</h1>
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
          &larr; Back to inbox
        </Link>
      </div>
      <CannedResponsesManager initialResponses={rows ?? []} />
    </div>
  )
}
```

### Anti-Patterns to Avoid

- **Using Radix Popover for the slash picker:** Popover steals focus from the input on open, breaking typing. Use absolute CSS positioning instead.
- **Reloading canned responses on every `/` keypress:** Fetch once on mount in the picker, filter client-side. The dataset is small (< 50 items), so client-side filter is instant.
- **Server Actions for the agent picker fetch:** Server Actions are invoked by forms, not `fetch()`. Agents need a GET route handler.
- **No `shortcut` field, relying only on full title search:** Without shortcut, the filtering UX doesn't match user expectation (type `/hours` to get hours response). Shortcut is an indexed text field.
- **Blocking the Send button when picker is visible:** The picker is dismissed by Escape or by clicking an item. Don't disable form submit — it's confusing. Instead, dismiss picker on Enter if no item is selected, send message if picker is closed.
- **Using `useActionState` for delete without bind:** `deleteCannedResponse(id)` takes just `id` — it's called directly via `startTransition`, not as a form action. Don't force it into `useActionState`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Filterable dropdown with keyboard navigation | Custom div with onKeyDown arrow handling | `cmdk` Command + CommandList | cmdk handles ArrowUp/ArrowDown/Enter/Escape, aria-selected, screen reader announcements, and focus trap automatically |
| Role-checking in canned responses API route | Custom `if` check querying user_profiles | RLS policies on canned_responses table with `get_my_role()` | RLS enforces at DB level — even direct Supabase calls from the client respect it |
| Shortcut uniqueness enforcement | Application-level duplicate check | PostgreSQL UNIQUE constraint on `shortcut` column | DB enforces uniqueness atomically, prevents race conditions |

**Key insight:** The cmdk library's built-in keyboard navigation covers accessibility patterns (roving tabindex, aria-selected, live region announcements) that take significant effort to replicate correctly. The team is already using Radix UI for this reason — use the same philosophy for the command palette.

---

## Common Pitfalls

### Pitfall 1: Popover Focus Theft Breaks Typing

**What goes wrong:** Wrapping the slash picker in `<Popover.Content>` causes Radix to auto-focus the content when it opens. The message input immediately loses focus. Users cannot type their filter query.

**Why it happens:** Radix Popover's default `onOpenAutoFocus` behavior moves focus to the first focusable element in the content.

**How to avoid:** Do not use Radix Popover for the slash picker. Use cmdk's `Command.List` with `position: absolute` CSS. The input retains focus at all times.

**Warning signs:** After typing `/`, the cursor vanishes from the input.

### Pitfall 2: cmdk Without Command.List Wrapper

**What goes wrong:** Rendering `Command.Item` elements without `Command.List` as a parent causes cmdk 1.1.1 to throw an error: "Command.List is now required".

**Why it happens:** cmdk 1.x changed the API — List is required to provide the scroll container and ARIA list role.

**How to avoid:** Always wrap items: `<Command><Command.List>...</Command.List></Command>`.

**Warning signs:** Console error about Command.List being required on mount.

### Pitfall 3: Admin Page Not Protected

**What goes wrong:** Creating `/admin/canned-responses/page.tsx` is NOT enough to protect it. The `admin/layout.tsx` role guard wraps all routes under `/admin/` — this protection is already in place from Phase 7.

**Why it happens:** This is actually fine — it's how Next.js nested layouts work. But a developer might think they need to add auth checks again.

**How to avoid:** Do NOT add redundant auth checks in the new admin page. The `admin/layout.tsx` guard handles it.

**Warning signs:** None — the guard works automatically. Just verify with an agent account that `/admin/canned-responses` redirects to `/`.

### Pitfall 4: Slash Picker Appears When Editing Mid-Sentence

**What goes wrong:** The slash picker appears whenever the message contains a `/` anywhere (e.g., "call us at 9am/5pm"), disrupting mid-message typing.

**Why it happens:** `value.includes('/')` check triggers on any `/` in the string.

**How to avoid:** Only trigger when `/` is the FIRST character: `value === '/' || value.startsWith('/')`. Even better: check `value[0] === '/'`.

**Warning signs:** Picker appears unexpectedly when agents type URLs or times.

### Pitfall 5: Canned Response Body Sent Without Replacing Slash Input

**What goes wrong:** Agent types `/hours`, selects the response, but `messageInput` still contains `/hours` and gets sent along with (or instead of) the canned response body.

**Why it happens:** `handleCannedSelect` sets `messageInput` to the body, but the `handleSendMessage` form handler reads a stale closure value.

**How to avoid:** `handleCannedSelect` must call `setMessageInput(body)` — not append to it. Since `messageInput` is React state, the next render will have the correct value before the user hits Send. Test explicitly: select a canned response, verify the input shows only the body, then send.

**Warning signs:** Messages sent with `/shortcut` prepended to the canned response body.

### Pitfall 6: No Navigation Link to the New Admin Page

**What goes wrong:** The admin page exists at `/admin/canned-responses` but the only link to admin areas is "Settings" in the header of `page.tsx`. Admins have no way to discover the new page.

**Why it happens:** The header link is hardcoded to `/admin/settings`.

**How to avoid:** Either add a "Canned Responses" link alongside "Settings" in `page.tsx`, or update the header to a small admin nav. The page.tsx approach is simpler and sufficient for the current team size.

---

## Code Examples

Verified patterns from official sources and established codebase patterns:

### Supabase Table with RLS (SQL)

```sql
-- Source: https://supabase.com/docs/guides/database/postgres/row-level-security
-- Pattern established in Phase 7 RESEARCH.md

CREATE TABLE public.canned_responses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  shortcut    TEXT NOT NULL UNIQUE,   -- enforces no duplicate shortcuts
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.canned_responses ENABLE ROW LEVEL SECURITY;

-- Read: all authenticated users (agents + admins)
CREATE POLICY "All agents can read canned responses"
  ON public.canned_responses
  FOR SELECT
  TO authenticated
  USING ( true );

-- Write: admin only — reuses get_my_role() from Phase 7
CREATE POLICY "Only admins can insert canned responses"
  ON public.canned_responses
  FOR INSERT
  TO authenticated
  WITH CHECK ( (SELECT public.get_my_role()) = 'admin' );

CREATE POLICY "Only admins can update canned responses"
  ON public.canned_responses
  FOR UPDATE
  TO authenticated
  USING ( (SELECT public.get_my_role()) = 'admin' )
  WITH CHECK ( (SELECT public.get_my_role()) = 'admin' );

CREATE POLICY "Only admins can delete canned responses"
  ON public.canned_responses
  FOR DELETE
  TO authenticated
  USING ( (SELECT public.get_my_role()) = 'admin' );
```

### cmdk Slash Picker Integration (message-view.tsx diff)

```typescript
// Source: cmdk docs (https://github.com/dip/cmdk) + discussion #251 pattern

// BEFORE — existing Input onChange:
onChange={(e) => setMessageInput(e.target.value)}

// AFTER — modified onChange with slash detection:
onChange={(e) => {
  const value = e.target.value
  setMessageInput(value)
  if (value[0] === '/') {
    setShowCannedPicker(true)
    setCannedQuery(value.slice(1))
  } else {
    setShowCannedPicker(false)
    setCannedQuery('')
  }
}}

// Add onKeyDown to dismiss picker on Escape:
onKeyDown={(e) => {
  if (e.key === 'Escape' && showCannedPicker) {
    e.preventDefault()
    setShowCannedPicker(false)
    setCannedQuery('')
  }
}}
```

### Server Action with .bind() for Update/Delete

```typescript
// Source: Next.js docs — Server Actions with additional arguments
// https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations

// In the Client Component that renders each canned response row:
import { updateCannedResponse, deleteCannedResponse } from './actions'
import { useActionState, useTransition } from 'react'

// For update (needs id as first argument):
const boundUpdate = updateCannedResponse.bind(null, item.id)
const [updateState, updateAction, updatePending] = useActionState(boundUpdate, initialState)

// For delete (called directly, not as form action):
const [isPending, startTransition] = useTransition()
const handleDelete = () => {
  startTransition(async () => {
    await deleteCannedResponse(item.id)
  })
}
```

### Admin Page Navigation Link

```typescript
// src/app/page.tsx — add link to canned responses admin
// (alongside existing /admin/settings link)

// Add in the admin nav section:
<a href="/admin/canned-responses" className="text-xs text-gray-500 hover:text-gray-700">
  Canned Responses
</a>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom dropdown div with manual keyboard handling | cmdk Command + CommandList | cmdk stable at 1.1.1 (Nov 2024) | Built-in a11y, keyboard nav, filtering — no custom code needed |
| Radix Popover for input-adjacent dropdowns | Absolute positioning (CSS) | GitHub discussion #2705 (ongoing) | Input keeps focus — Popover steals focus on open by default |
| Server-side form posts for admin CRUD | Next.js Server Actions with `useActionState` | Next.js 14+ (stable in 15) | Progressive enhancement, typed responses, no custom API routes for admin mutations |

**No deprecated patterns** detected in the existing codebase that Phase 8 would need to clean up.

---

## Open Questions

1. **Should shortcut have a UNIQUE constraint?**
   - What we know: The requirements say "title and shortcut" per canned response. Duplicate shortcuts would cause ambiguous matching.
   - What's unclear: Whether the user wants to allow duplicate shortcuts (e.g., two responses both reached by `/greet`).
   - Recommendation: Add `UNIQUE` constraint on `shortcut`. The admin UI should surface the Postgres unique violation as a user-friendly error. This is the safer default.

2. **Picker position: above or below the input?**
   - What we know: The message input is at the bottom of the screen. A dropdown appearing below would be clipped by the viewport.
   - Recommendation: Position the picker `bottom: 100%` (above the input), matching how WhatsApp Web and Intercom handle this. The code example above uses this pattern.

3. **Should shortcut include the `/` or not?**
   - What we know: The requirements show shortcut examples like `/hours` but the stored value in the DB should probably be without the `/` (e.g., just `hours`) — the `/` is the trigger character.
   - Recommendation: Store without `/`. Display with `/` prefix in the picker UI. Filter by `value.slice(1)` (text after `/`). This way the shortcut `hours` matches when user types `/hours`.

4. **What happens when there are zero canned responses?**
   - What we know: If the table is empty, the picker should not appear (or show an empty state).
   - Recommendation: The `CannedResponsesPicker` returns `null` when `filtered.length === 0 && !loading`. When the table is empty, typing `/` shows nothing — the input behaves normally. This is the correct UX: don't show an empty dropdown.

---

## Sources

### Primary (HIGH confidence)

- Existing codebase: `src/app/admin/settings/actions.ts`, `src/app/admin/settings/page.tsx`, `src/components/message-view.tsx` — verified directly, patterns extracted for Phase 8
- Existing codebase: `src/app/api/settings/route.ts` — GET route pattern for agent-facing endpoints
- Phase 7 RESEARCH.md + Phase 7 SUMMARY 07-02 — `get_my_role()` confirmed deployed and working in Supabase
- [Supabase RLS Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — SELECT/INSERT/UPDATE/DELETE policy syntax verified
- [cmdk GitHub README](https://github.com/dip/cmdk) — Command, Command.List, Command.Item API verified; React 18/19 peer dep confirmed
- `npm info cmdk` — version 1.1.1 confirmed, peer deps `react: '^18 || ^19'` confirmed
- `npm info @radix-ui/react-popover version` — 1.1.15 confirmed (not used for picker but available)

### Secondary (MEDIUM confidence)

- [Radix UI Popover Docs](https://www.radix-ui.com/primitives/docs/components/popover) — `onOpenAutoFocus={(e) => e.preventDefault()}` pattern verified; `open`/`onOpenChange` controlled API confirmed
- [Radix UI GitHub Discussion #2705](https://github.com/radix-ui/primitives/discussions/2705) — Confirmed: Popover steals input focus; recommendation is to use combobox pattern instead
- [cmdk Discussion #251](https://github.com/dip/cmdk/discussions/251) — Confirmed: absolute CSS positioning works for inline combobox without Popover

### Tertiary (LOW confidence)

- WebSearch results for slash command patterns — used for discovery only; patterns verified against official sources above

---

## Metadata

**Confidence breakdown:**
- Standard stack (cmdk 1.1.1, no new Radix packages): HIGH — npm registry confirmed, peer deps confirmed
- Supabase table + RLS: HIGH — SQL pattern directly from Phase 7 established SQL + official Supabase RLS docs
- Server Actions CRUD: HIGH — directly mirrors existing `actions.ts` pattern in codebase
- cmdk slash picker integration: HIGH — API verified from GitHub README, focus behavior verified from GitHub discussion
- Pitfalls: HIGH — most from direct code analysis and confirmed community discussions

**Research date:** 2026-02-21
**Valid until:** 2026-08-21 (cmdk 1.1.1 is stable; Supabase RLS syntax is stable; Next.js Server Actions stable in 15.x)
