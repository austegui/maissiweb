# Phase 10: Customer Intelligence - Research

**Researched:** 2026-02-22
**Domain:** Supabase contact profiles (new table), inline editable form pattern, right side panel UI, internal conversation notes, Next.js App Router PATCH/POST route handlers
**Confidence:** HIGH

---

## Summary

Phase 10 adds two tightly-coupled features: contact profiles (persistent data about a phone number) and internal notes (append-only per-conversation memos). Both live in Supabase. Both are surfaced through a single right-side panel that slides in alongside the message view. No Kapso core files are touched; this is purely additive.

The contact profile is keyed by `phone_number` (TEXT PRIMARY KEY) — the same key already used by `conversation_contact_labels`. A new `contacts` table stores `display_name`, `email`, `notes`, and a `whatsapp_name` field (the WhatsApp profile name observed from message payloads). Contact profiles are auto-created via `upsert` with `ignoreDuplicates: true` logic — the trigger point is when `/api/conversations GET` enriches conversations, or lazily when the panel is first opened. The backfill for existing phone numbers is a one-time SQL migration run by the user.

Internal notes live in a `conversation_notes` table (already present in the original STACK.md schema plan). Each note has `conversation_id` (TEXT, the Kapso conversation UUID), `author_id` (UUID FK to user_profiles), `content` (TEXT), and `created_at`. Notes are read-only after insertion — no edit or delete. The author name is joined from `user_profiles.display_name` at query time.

The panel itself is a controlled right-side pane rendered as a sibling of the message view inside the same flex container. It does NOT use Radix Dialog or Sheet — those create overlays; the design requires a persistent sidebar that pushes or overlays the message view. The simplest correct approach is a `w-80` `div` that conditionally renders inside the existing `flex` layout in `page.tsx`.

**Primary recommendation:** Use a new `contacts` table (phone_number PK) for contact profiles and the existing `conversation_notes` table schema from STACK.md for notes. Render the panel as a plain flex sibling div with a toggle button in the message view header. No new Radix primitives required for the panel itself.

---

## Standard Stack

### Core (already installed — no version change needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.97.0 | CRUD for contacts + notes tables | Already in use for all Supabase operations in this codebase |
| `@supabase/ssr` | ^0.8.0 | Server-side client in route handlers | Already in use |
| `next` | 15.5.9 | App Router route handlers (GET/POST/PATCH) | Already in use |
| `react` | 19.1.0 | useState, useEffect, controlled forms | Already in use |
| `lucide-react` | ^0.545.0 | Panel toggle icon, note icons | Already in use; `StickyNote`, `UserRound`, `ChevronDown`, `X`, `Send` available |
| `date-fns` | ^4.1.0 | Note timestamp formatting | Already in use for message timestamps |

### New — Must Install
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@radix-ui/react-collapsible` | 1.1.12 | Collapsible notes section within panel | Built-in animation via CSS vars, keyboard accessible, React 19 compatible. Already has shared deps installed (`@radix-ui/react-presence`, `@radix-ui/react-primitive`, etc.) |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@radix-ui/react-separator` | 1.1.7 | Visual divider between contact info and notes | Already installed as dep of other Radix primitives |
| `@radix-ui/react-scroll-area` | ^1.2.10 | Scrollable notes list | Already installed and used in message-view.tsx |
| `tailwind-merge` + `clsx` | present | Conditional class merging | cn() utility already used throughout |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Flex sibling div for panel | Radix Dialog Sheet | Dialog creates overlay; Sheet (from shadcn) is not installed. A plain div is simpler and correct for a persistent side panel that co-exists with the message view. |
| `@radix-ui/react-collapsible` for notes | `useState` toggle on a `div` | Custom toggle lacks animation and accessibility. Collapsible provides `--radix-collapsible-content-height` CSS var enabling smooth height animation + WAI-ARIA disclosure pattern. Cost is one small new package (shared deps already installed). |
| Separate `contacts_edit` API route | Combined GET/PATCH on `/api/contacts/[phone]` | Single route file handles both read and update. Consistent with existing route patterns. |
| Eager contact creation in conversations GET | Lazy upsert when panel opens | Context decision: auto-create on conversations list load (backfill all visible phone numbers). But upsert is idempotent — safer to upsert whenever the panel is opened, as a belt-and-suspenders measure. |

**Installation:**
```bash
npm install @radix-ui/react-collapsible
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   └── api/
│       ├── contacts/
│       │   └── [phone]/
│       │       └── route.ts         # NEW: GET + PATCH contact profile
│       └── conversations/
│           └── [id]/
│               └── notes/
│                   └── route.ts     # NEW: GET + POST conversation notes
├── components/
│   ├── contact-panel.tsx            # NEW: Right side panel (contact info + notes)
│   └── message-view.tsx             # MODIFIED: add panel toggle button in header
└── app/
    └── page.tsx                     # MODIFIED: add panel state, render ContactPanel as flex sibling
```

### Database Schema (Supabase SQL — user runs this)

```sql
-- contacts: one row per phone number, auto-created on first appearance
CREATE TABLE public.contacts (
  phone_number      TEXT PRIMARY KEY,
  display_name      TEXT,                    -- agent-editable name
  email             TEXT,                    -- agent-editable email
  notes             TEXT,                    -- agent-editable freeform notes field (on the contact, not per-conversation)
  whatsapp_name     TEXT,                    -- from WhatsApp profile, auto-set on creation
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can read contacts"
  ON public.contacts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Agents can insert contacts"
  ON public.contacts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Agents can update contacts"
  ON public.contacts FOR UPDATE
  TO authenticated
  USING (true);

-- conversation_notes: internal notes per Kapso conversation
CREATE TABLE public.conversation_notes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  TEXT NOT NULL,            -- Kapso conversation UUID (string)
  author_id        UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  content          TEXT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT now()
  -- No updated_at: append-only, notes are never edited
);

ALTER TABLE public.conversation_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can read notes"
  ON public.conversation_notes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Agents can insert notes"
  ON public.conversation_notes FOR INSERT
  TO authenticated
  WITH CHECK (true);
-- No UPDATE or DELETE policies: append-only design
```

**Backfill migration (one-time, run after table creation):**
```sql
-- Create a contacts row for every phone number that has appeared
-- Uses contactName from Kapso if available (stored in conversation_metadata or inferred from known conversations)
-- Since Kapso data isn't in Supabase, the backfill creates minimal rows with just the phone number
-- display_name and whatsapp_name will be filled in lazily when panels are opened

-- Insert all phone numbers from conversation_contact_labels (already in Supabase)
INSERT INTO public.contacts (phone_number)
SELECT DISTINCT phone_number
FROM public.conversation_contact_labels
ON CONFLICT (phone_number) DO NOTHING;
```

**Note:** This backfill only covers phone numbers that have labels assigned. Full backfill of ALL phone numbers from Kapso is not possible via SQL alone — Kapso data lives outside Supabase. The auto-upsert on panel open covers all remaining phone numbers lazily.

### Pattern 1: Contact Auto-Creation via Upsert (Idempotent)

**What:** When the contact panel is opened for a conversation, `GET /api/contacts/[phone]` checks for an existing contact and creates one if absent — all in a single upsert.

**Why upsert, not insert-or-select:** Avoids a race condition where two tabs open the same conversation simultaneously. Single round-trip. Matches the existing `conversation_metadata` upsert pattern already in this codebase.

**Example:**
```typescript
// src/app/api/contacts/[phone]/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ phone: string }> }
) {
  const { phone } = await params;   // Next.js 15: params is a Promise
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  // Upsert: create if not exists, return current row either way
  // onConflict: 'phone_number' means "if phone_number already exists, do nothing (ignoreDuplicates)"
  // We read after upsert to get the current data
  await supabase
    .from('contacts')
    .upsert(
      { phone_number: phone },
      { onConflict: 'phone_number', ignoreDuplicates: true }
    );

  const { data, error } = await supabase
    .from('contacts')
    .select('phone_number, display_name, email, notes, whatsapp_name, created_at')
    .eq('phone_number', phone)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
```

**Note on `ignoreDuplicates`:** When `ignoreDuplicates: true`, upsert does NOT update existing rows — it only inserts if the row is absent. This is the correct behavior for auto-creation: we never want the GET request to overwrite an agent's edits.

### Pattern 2: Contact Update via PATCH

**What:** Agent edits `display_name`, `email`, or `notes` in the panel. Change is saved on blur (or a Save button). PATCH route updates the contacts row.

**Example:**
```typescript
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ phone: string }> }
) {
  const { phone } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 }); }

  const { displayName, email, notes } = body as {
    displayName?: string;
    email?: string;
    notes?: string;
  };

  const updates: Record<string, string | null> = { updated_at: new Date().toISOString() };
  if (displayName !== undefined) updates.display_name = displayName || null;
  if (email !== undefined) updates.email = email || null;
  if (notes !== undefined) updates.notes = notes || null;

  const { error } = await supabase
    .from('contacts')
    .update(updates)
    .eq('phone_number', phone);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
```

### Pattern 3: Notes GET + POST

**What:** `GET /api/conversations/[id]/notes` returns all notes newest-first with author name. `POST` inserts a new note.

**Example:**
```typescript
// GET: join author name from user_profiles
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data, error } = await supabase
    .from('conversation_notes')
    .select(`
      id,
      content,
      created_at,
      user_profiles ( display_name )
    `)
    .eq('conversation_id', id)
    .order('created_at', { ascending: false });  // newest first

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Flatten author name
  const notes = (data ?? []).map(n => ({
    id: n.id,
    content: n.content,
    createdAt: n.created_at,
    authorName: (n.user_profiles as { display_name: string } | null)?.display_name ?? 'Agente'
  }));

  return NextResponse.json({ data: notes });
}

// POST: insert note, author_id from authenticated user
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { content } = await request.json() as { content?: string };
  if (!content?.trim()) {
    return NextResponse.json({ error: 'El contenido es requerido' }, { status: 400 });
  }

  const { error } = await supabase
    .from('conversation_notes')
    .insert({
      conversation_id: id,
      author_id: user.id,
      content: content.trim()
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
```

### Pattern 4: Right Panel as Flex Sibling

**What:** The contact panel renders as a `div` sibling of `<MessageView>` inside the existing `flex` container in `page.tsx`. It is conditionally shown via `showPanel` state. No Radix Dialog/Sheet needed.

**Layout model:**
```
<div className="flex flex-1 overflow-hidden">          ← existing flex container
  <ConversationList ... />                             ← left column (w-96, hidden on mobile)
  <MessageView ... />                                  ← center column (flex-1)
  {showPanel && <ContactPanel ... />}                  ← right column (w-80, new)
</div>
```

The `<MessageView>` already uses `flex-1` for its outer div. Adding a sibling `w-80` panel will shrink the message view naturally (flex layout). The panel should use `flex-shrink-0` to prevent it from being squished.

**Toggle button:** Add a `<button>` to the message view header (alongside the existing Refresh, Status, Assignment, Labels buttons) that calls an `onTogglePanel` prop callback back to `page.tsx`.

**Example (in page.tsx):**
```typescript
const [showContactPanel, setShowContactPanel] = useState(false);

// ...
<div className="flex flex-1 overflow-hidden">
  <ConversationList ... />
  <MessageView
    ...
    onTogglePanel={() => setShowContactPanel(p => !p)}
    isPanelOpen={showContactPanel}
  />
  {showContactPanel && selectedConversation && (
    <ContactPanel
      conversationId={selectedConversation.id}
      phoneNumber={selectedConversation.phoneNumber}
      contactName={selectedConversation.contactName}
      onClose={() => setShowContactPanel(false)}
    />
  )}
</div>
```

**Reset on conversation switch:** When `selectedConversation` changes, optionally reset panel open state. Per context decisions, the panel is a persistent toggle — but closing it when switching conversations avoids showing stale data while the new contact loads.

### Pattern 5: Radix Collapsible for Notes Section

**What:** The notes section within the ContactPanel uses `@radix-ui/react-collapsible` to allow collapsing the list of notes (while the contact info section above always stays visible).

**Example:**
```typescript
import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronDown } from 'lucide-react';

function NotesSection({ conversationId }: { conversationId: string }) {
  const [open, setOpen] = useState(true);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteInput, setNoteInput] = useState('');

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <div className="flex items-center justify-between px-4 py-2 border-t border-[#d1d7db]">
        <span className="text-xs font-semibold text-[#667781] uppercase tracking-wide">
          Notas internas
        </span>
        <Collapsible.Trigger asChild>
          <button className="text-[#667781] hover:text-[#111b21]">
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </button>
        </Collapsible.Trigger>
      </div>

      <Collapsible.Content>
        {/* Note input */}
        <div className="px-4 pb-2">
          <textarea
            value={noteInput}
            onChange={e => setNoteInput(e.target.value)}
            placeholder="Añadir nota interna..."
            className="w-full text-sm border border-[#d1d7db] rounded-lg px-3 py-2 resize-none bg-[#fffde7] focus:outline-none focus:ring-1 focus:ring-[#00a884]"
            rows={3}
          />
          <button
            onClick={handleAddNote}
            disabled={!noteInput.trim()}
            className="mt-1 text-xs px-3 py-1 bg-[#00a884] text-white rounded-md disabled:opacity-50"
          >
            Guardar nota
          </button>
        </div>

        {/* Notes list */}
        <div className="space-y-2 px-4 pb-4">
          {notes.map(note => (
            <div key={note.id} className="bg-[#fffde7] border border-[#f59e0b]/20 rounded-lg p-3 text-sm">
              <p className="text-[#111b21] whitespace-pre-wrap">{note.content}</p>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-[#667781]">
                <span>{note.authorName}</span>
                <span>·</span>
                <span>{format(new Date(note.createdAt), 'dd MMM, HH:mm')}</span>
              </div>
            </div>
          ))}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
```

**Note on textarea vs Input:** Use `<textarea>` (not Input from ui/input) for note entry. Agents write multi-line notes; Input is single-line. Textarea with `rows={3}` and `resize-none` matches the design intent without a library.

### Pattern 6: Inline Edit Fields for Contact Profile

**What:** Contact `display_name`, `email`, and `notes` fields are shown as editable inputs. Use a "save on blur" pattern — no Save button required for individual fields. This is simpler than a form submit and feels more immediate.

**Example:**
```typescript
function EditableField({
  label,
  value,
  placeholder,
  onSave,
  type = 'text'
}: {
  label: string;
  value: string | null;
  placeholder: string;
  onSave: (value: string) => Promise<void>;
  type?: 'text' | 'email';
}) {
  const [localValue, setLocalValue] = useState(value ?? '');
  const [saving, setSaving] = useState(false);

  // Sync when prop changes (conversation switch)
  useEffect(() => setLocalValue(value ?? ''), [value]);

  const handleBlur = async () => {
    const trimmed = localValue.trim();
    if (trimmed === (value ?? '')) return; // no change
    setSaving(true);
    try { await onSave(trimmed); }
    finally { setSaving(false); }
  };

  return (
    <div className="px-4 py-2">
      <label className="text-[10px] font-semibold text-[#667781] uppercase tracking-wide block mb-1">
        {label}
      </label>
      <input
        type={type}
        value={localValue}
        onChange={e => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="w-full text-sm text-[#111b21] placeholder-[#aab8c2] border-b border-transparent hover:border-[#d1d7db] focus:border-[#00a884] focus:outline-none py-0.5 bg-transparent transition-colors"
      />
    </div>
  );
}
```

**Save-on-blur rationale:** This project uses optimistic updates throughout (status, assignment, labels). Save-on-blur is consistent with that pattern. No submit button = no accidental double-saves, no "unsaved changes" state to manage.

### Pattern 7: Conversation History in Contact Panel

**What:** A list of past conversations for the same phone number, shown at the bottom of the contact panel (or in a separate collapsible section). Data comes from `/api/conversations GET` filtered by phone number, or better — from the already-fetched `conversations` list in the parent component filtered by `phoneNumber`.

**Implementation decision (Claude's discretion):** Show a simple list of past conversations keyed by `lastActiveAt` date and `convStatus`. Do NOT make a new API call — the parent `page.tsx` already has the full conversations list in state. Pass it as a prop to `ContactPanel` filtered by `phoneNumber`.

**Example:**
```typescript
// In page.tsx — pass filtered history
<ContactPanel
  ...
  conversationHistory={conversations.filter(c => c.phoneNumber === selectedConversation.phoneNumber)}
/>

// In ContactPanel — render history
function ConversationHistorySection({ history }: { history: Conversation[] }) {
  return (
    <div className="px-4 py-3 border-t border-[#d1d7db]">
      <p className="text-[10px] font-semibold text-[#667781] uppercase tracking-wide mb-2">
        Historial ({history.length})
      </p>
      {history.map(conv => (
        <div key={conv.id} className="flex items-center justify-between py-1 text-xs text-[#667781]">
          <span>{formatConversationDate(conv.lastActiveAt)}</span>
          <span className={STATUS_DOT_CLASS[conv.convStatus ?? 'abierto']} />
        </div>
      ))}
    </div>
  );
}
```

**Limitation:** This only shows conversations currently loaded in the list (default 50). Full history across all-time conversations requires a separate API call that is out of scope for this phase. The current approach is correct and fast.

### Pattern 8: WhatsApp Name Auto-Set on Contact Creation

**What:** When a contact row is first created, set `whatsapp_name` from the `contactName` field that Kapso already returns in the conversations list (it comes from the WhatsApp profile).

**Where to set it:** In `/api/contacts/[phone] GET`, when the upsert creates a new row, a second PATCH sets `whatsapp_name`. OR better: include it in the initial upsert.

**Implementation:**
```typescript
// The conversations list already includes contactName from Kapso (kapso.contactName)
// When opening the panel, pass contactName from the selected conversation
// In the GET route, pass it as a query param or include in a POST body

// Simpler: pass contactName as a query param to the GET call
// GET /api/contacts/[phone]?name=ContactNameFromWhatsApp

export async function GET(req: Request, { params }: { params: Promise<{ phone: string }> }) {
  const { phone } = await params;
  const { searchParams } = new URL(req.url);
  const whatsappName = searchParams.get('name') ?? null;

  // ...

  await supabase
    .from('contacts')
    .upsert(
      {
        phone_number: phone,
        whatsapp_name: whatsappName,           // set on first creation
        // display_name deliberately NOT set here — agent sets it explicitly
      },
      { onConflict: 'phone_number', ignoreDuplicates: true }
    );

  // ...
}
```

**Update policy:** `ignoreDuplicates: true` means the upsert only fires on new rows. If the agent has already edited `display_name`, it is safe — the upsert will not overwrite it. `whatsapp_name` is only set once on creation. If the WhatsApp name changes later, agents can update `display_name` manually. This is the correct behavior.

### Anti-Patterns to Avoid

- **Triggering contact auto-creation from the conversations list GET route (server-side):** The `/api/conversations GET` already calls Kapso + Supabase. Adding another Supabase upsert for every phone number on every poll (every 10 seconds) would create significant write load on Supabase. Auto-create lazily when the panel is opened — one upsert per session per phone number.
- **Using Radix Dialog or Sheet for the right panel:** Dialog creates an overlay that blocks the message view. Sheet (from shadcn) is not installed. A plain flex div is simpler, has no focus-trap issues, and is correct for a persistent side panel.
- **Fetching notes inside message-view.tsx polling loop:** The message view polls every 5 seconds. Notes should NOT be included in this poll. Fetch notes once when the panel opens and after each new note POST. Notes do not require real-time updates in this phase.
- **Storing note author name in `conversation_notes` table:** Store only `author_id` (UUID FK). Join `user_profiles.display_name` at query time via Supabase select syntax `user_profiles ( display_name )`. This stays consistent if a user's display name changes.
- **Making notes editable:** The context decision is append-only. Never add edit or delete buttons. If a "Delete" button appears in the plan, reject it.
- **Using `Textarea` from shadcn/ui for the note input:** The project uses raw Radix primitives + custom Tailwind styling, not shadcn wrappers. Use a plain `<textarea>` element directly.
- **Routing note visibility through the message thread:** Notes must NEVER appear in the WhatsApp message list. Notes are stored in Supabase only and rendered only in the contact panel. The `handleSendMessage` function in `message-view.tsx` must never be called for notes. Notes have their own `POST /api/conversations/[id]/notes` route.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Collapsible notes section | `useState` + `max-height: 0` CSS toggle | `@radix-ui/react-collapsible` | Custom max-height collapses without animation bugs; Collapsible provides `--radix-collapsible-content-height` CSS var for smooth animation, keyboard toggle, WAI-ARIA disclosure |
| Upsert "insert if not exists" | SELECT then INSERT | `supabase.upsert({ onConflict, ignoreDuplicates: true })` | Single round-trip, race-condition safe, identical to existing `conversation_metadata` upsert pattern |
| Note author name | Store author name string in DB | `user_profiles ( display_name )` join at query time | Stays current if display name changes; FK integrity maintained |
| Conversation history | Separate API call to Kapso | Filter parent's `conversations` state by `phoneNumber` | Zero additional network calls; the parent already has 50 conversations in memory |
| Note input widget | Rich text editor | Plain `<textarea>` | Notes are plain text; rich text adds complexity without value. Resize-none + min-h styling is sufficient. |

**Key insight:** This phase is fundamentally a "form + list" feature. The complexity is in the database schema and the panel layout, not in the UI widgets themselves. Resist the temptation to add rich editing, drag-reorder, or real-time collaboration — those are out of scope.

---

## Common Pitfalls

### Pitfall 1: Notes Leaking into the Message Send Path

**What goes wrong:** A note textarea + Send button in the panel looks identical to the message composer. If wired incorrectly, a note could be sent as a WhatsApp message.

**Why it happens:** Copy-paste of the message sending pattern without isolating the API endpoint.

**How to avoid:** Note submission calls `POST /api/conversations/[id]/notes` exclusively. It never touches `/api/messages/send`. The note submit handler must be written fresh, not adapted from the message send handler.

**Warning signs:** The note POST response body contains a `wamid` field (WhatsApp message ID) — that means it accidentally called the message endpoint.

### Pitfall 2: Next.js 15 Route Handler Dynamic Params

**What goes wrong:** `params.phone` or `params.id` is undefined.

**Why it happens:** In Next.js 15, `params` in route handlers is a `Promise`. Must be awaited.

**How to avoid:** Always `const { phone } = await params` before using any param. Type as `{ params: Promise<{ phone: string }> }`.

**Warning signs:** TypeScript error "Property 'phone' does not exist on type 'Promise'", or runtime undefined.

### Pitfall 3: Panel Stays Open with Stale Data When Switching Conversations

**What goes wrong:** Agent opens panel for conversation A, sees contact A. Clicks conversation B. Panel still shows contact A's data because the `ContactPanel` was not re-fetched.

**Why it happens:** `ContactPanel` fetches data on mount. If it stays mounted (because `showContactPanel` stays true), `useEffect([conversationId])` must trigger a new fetch.

**How to avoid:** Keying the `ContactPanel` component on `conversationId` forces a full remount on conversation switch: `<ContactPanel key={selectedConversation.id} ... />`. Alternatively, add `conversationId` to the `useEffect` deps in ContactPanel and re-fetch when it changes.

**Warning signs:** Agent sees wrong contact name or wrong notes after switching conversations.

### Pitfall 4: `ignoreDuplicates: true` on Upsert Does Not Return the Existing Row

**What goes wrong:** `await supabase.from('contacts').upsert(..., { ignoreDuplicates: true }).select()` returns an empty array when the row already exists (because no insert happened).

**Why it happens:** `ignoreDuplicates: true` skips the upsert entirely when a conflict occurs, so `.select()` chained to upsert returns nothing for existing rows.

**How to avoid:** Do the upsert first (to ensure the row exists), then do a separate `.select().eq()` query to read the current data. Two queries, but both are fast and the result is always correct.

```typescript
// CORRECT pattern:
await supabase.from('contacts').upsert(
  { phone_number: phone },
  { onConflict: 'phone_number', ignoreDuplicates: true }
);
const { data } = await supabase
  .from('contacts')
  .select('*')
  .eq('phone_number', phone)
  .single();
```

**Warning signs:** Panel shows blank fields for contacts that already exist.

### Pitfall 5: author_id FK References Deleted User

**What goes wrong:** If a user account is deleted from `auth.users` and `user_profiles`, existing notes with `author_id = that_user_id` will fail FK constraint checks or return null on join.

**Why it happens:** `author_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL` — but the column is `NOT NULL`, so `SET NULL` conflicts with it.

**How to avoid:** Either allow `author_id` to be nullable (`author_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL`) and handle null author display as "Agente eliminado", OR use `ON DELETE RESTRICT` to prevent deleting users who have notes. The former is more user-friendly.

**Recommendation:** Make `author_id` nullable with `ON DELETE SET NULL`. Display `note.authorName ?? 'Agente'` in the UI.

### Pitfall 6: Panel Layout Breaks on Mobile

**What goes wrong:** On mobile (width < 768px), the flex layout stacks `ConversationList`, `MessageView`, and `ContactPanel` vertically, causing the panel to push the message view off-screen.

**Why it happens:** The existing layout uses `hidden md:flex` / `hidden md:block` breakpoints to show/hide the conversation list on mobile. Adding a third panel sibling breaks this assumption.

**How to avoid:** On mobile, render the `ContactPanel` as an overlay (fixed positioning) rather than a flex sibling, or simply hide it below the md breakpoint (`hidden md:flex`). The panel is a "nice to have" on desktop; mobile agents get the full message view.

**Implementation:** Add `hidden md:flex flex-col` to the ContactPanel wrapper div, so it only appears on desktop.

### Pitfall 7: Supabase FK Reference — `user_profiles` Must Have `author_id` FK

**What goes wrong:** `REFERENCES public.user_profiles(id)` fails if the `user_profiles` table does not exist yet.

**Why it happens:** Phase 7 creates `user_profiles`. Phase 10 depends on it.

**How to avoid:** Confirm Phase 7 and Phase 9 SQL has been applied (user_profiles, conversation_metadata, contact_labels all exist) before running Phase 10 SQL. Phase 10 schema depends on Phase 9 being deployed.

---

## Code Examples

Verified patterns from codebase and official sources:

### Supabase Upsert Then Read (Two Queries)

```typescript
// Source: Supabase JS upsert docs + existing upsert pattern in src/app/api/conversations/[id]/status/route.ts

// Step 1: Ensure row exists (upsert with ignoreDuplicates)
await supabase
  .from('contacts')
  .upsert(
    { phone_number: phone, whatsapp_name: whatsappName },
    { onConflict: 'phone_number', ignoreDuplicates: true }
  );

// Step 2: Read current data (always returns the row)
const { data, error } = await supabase
  .from('contacts')
  .select('phone_number, display_name, email, notes, whatsapp_name')
  .eq('phone_number', phone)
  .single();
```

### Notes Query with Author Join

```typescript
// Source: Supabase JS select with FK join (verified pattern from conversation_contact_labels join in /api/conversations/route.ts)

const { data } = await supabase
  .from('conversation_notes')
  .select(`
    id,
    content,
    created_at,
    user_profiles ( display_name )
  `)
  .eq('conversation_id', conversationId)
  .order('created_at', { ascending: false });

// Flatten the join result
const notes = (data ?? []).map(n => ({
  id: n.id,
  content: n.content,
  createdAt: n.created_at,
  authorName: (n.user_profiles as { display_name: string } | null)?.display_name ?? 'Agente'
}));
```

### Radix Collapsible with Animation

```typescript
// Source: https://www.radix-ui.com/primitives/docs/components/collapsible
// Import style (matches existing Radix usage in this codebase):
import * as Collapsible from '@radix-ui/react-collapsible';

<Collapsible.Root open={open} onOpenChange={setOpen}>
  <Collapsible.Trigger asChild>
    <button>
      <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")} />
    </button>
  </Collapsible.Trigger>
  <Collapsible.Content
    className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden"
  >
    {/* content */}
  </Collapsible.Content>
</Collapsible.Root>

// For the animation to work, add to global CSS or Tailwind config:
// @keyframes collapsible-down { from { height: 0 } to { height: var(--radix-collapsible-content-height) } }
// @keyframes collapsible-up { from { height: var(--radix-collapsible-content-height) } to { height: 0 } }
// OR simply use overflow-hidden without animation (simpler, correct for v1)
```

**Simplification recommendation:** Skip the keyframe animation for v1. Use `overflow-hidden` on `Collapsible.Content` only. The Collapsible still handles open/close state and accessibility — just without a height transition. Animation can be added later.

### Panel Toggle Button in Message View Header

```typescript
// Add to the existing button row in message-view.tsx header
// Pattern matches existing RefreshCw button:

import { PanelRightOpen } from 'lucide-react'; // lucide-react ^0.545.0 has this icon

<Button
  onClick={() => onTogglePanel?.()}
  variant="ghost"
  size="icon"
  className={cn(
    "text-[#667781] hover:bg-[#f0f2f5]",
    isPanelOpen && "bg-[#e9f5f2] text-[#00a884]"   // active state
  )}
  title="Panel de contacto"
>
  <PanelRightOpen className="h-4 w-4" />
</Button>
```

**Note:** Check that `PanelRightOpen` exists in lucide-react 0.545.0. If not, use `SidebarOpen`, `Layout`, or `UserRound`. The `UserRound` icon already used in the handoff banner is a reasonable fallback.

### Contact Panel Component Skeleton

```typescript
// src/components/contact-panel.tsx
'use client';

type ContactPanelProps = {
  conversationId: string;
  phoneNumber: string;
  contactName?: string;             // from Kapso (WhatsApp profile name)
  onClose: () => void;
  conversationHistory?: Conversation[];   // pre-filtered from parent state
};

export function ContactPanel({
  conversationId,
  phoneNumber,
  contactName,
  onClose,
  conversationHistory = []
}: ContactPanelProps) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch contact on mount / conversationId change
  useEffect(() => {
    if (!phoneNumber) return;
    setLoading(true);
    const nameParam = contactName ? `?name=${encodeURIComponent(contactName)}` : '';
    fetch(`/api/contacts/${encodeURIComponent(phoneNumber)}${nameParam}`)
      .then(r => r.json())
      .then(data => setContact(data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [phoneNumber, contactName]);

  // Fetch notes on mount / conversationId change
  useEffect(() => {
    if (!conversationId) return;
    fetch(`/api/conversations/${conversationId}/notes`)
      .then(r => r.json())
      .then(data => setNotes(data.data ?? []))
      .catch(console.error);
  }, [conversationId]);

  return (
    <div className="hidden md:flex flex-col w-80 flex-shrink-0 border-l border-[#d1d7db] bg-white overflow-y-auto">
      {/* header */}
      {/* contact info section */}
      {/* conversation history section */}
      {/* notes section (Collapsible) */}
    </div>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| No persistent contact data | `contacts` table in Supabase keyed by phone number | Agents see who they're talking to across sessions |
| No internal notes | `conversation_notes` table, append-only | Team knowledge is shared and persisted; notes never risk reaching customers |
| WhatsApp profile name lost on page refresh | Stored in `contacts.whatsapp_name` on first creation | Contact name persists even when Kapso doesn't return it |
| All three columns (list, message, panel) on desktop | Flex layout extends to three panes | Natural extension of existing flex-based layout |

**Deprecated/outdated:**
- The STACK.md research (2026-02-21) proposed `conversation_notes` as part of `conversation_metadata` as a `contact_notes TEXT` column. This is now superseded: notes are per-conversation (not per-contact), stored in a separate `conversation_notes` table with `author_id` and `created_at`. This is the correct design.
- STACK.md also proposed `contact_name` and `contact_email` columns on `conversation_metadata`. Phase 10 supersedes this with a dedicated `contacts` table (keyed by phone number, not by conversation_id) which is architecturally correct — contact data belongs to a person (phone number), not a conversation.

---

## Open Questions

1. **`PanelRightOpen` icon availability in lucide-react 0.545.0**
   - What we know: lucide-react 0.545.0 is installed. The icon set evolves across versions.
   - What's unclear: Whether `PanelRightOpen` exists at this version.
   - Recommendation: Use `UserRound` (already imported in message-view.tsx for the handoff banner) as a fallback for the panel toggle. Alternatively, use `SidebarClose`/`SidebarOpen` — common in this version range.

2. **Collapsible animation: add now or skip for v1?**
   - What we know: The Collapsible component works without animation. CSS keyframe animation requires either globals.css additions or Tailwind plugin config.
   - Recommendation: Skip animation in v1. Use `overflow-hidden` on `Collapsible.Content`. The interaction is correct without animation; the visual polish can be added in a later phase.

3. **Contact panel auto-close on mobile**
   - What we know: The existing layout hides the conversation list on mobile. The panel should behave similarly.
   - Recommendation: Add `hidden md:flex` to the `ContactPanel` div. This matches the existing mobile pattern perfectly. No separate mobile panel behavior is needed.

4. **How to handle the `author_id NOT NULL` constraint if the user is deleted**
   - What we know: Existing tables use `ON DELETE SET NULL` or `ON DELETE CASCADE`.
   - Recommendation: Make `author_id` nullable (`UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL`). Display null author as "Agente eliminado" in the UI.

5. **WhatsApp profile name update policy**
   - What we know: The context says this is Claude's discretion.
   - Recommendation: Set `whatsapp_name` only once (on row creation via `ignoreDuplicates: true`). Never auto-update it after the agent has had a chance to set `display_name`. If the WhatsApp name changes, agents can manually update `display_name`. This avoids overwriting agent edits.

---

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/components/message-view.tsx`, `src/app/page.tsx`, `src/app/api/conversations/[id]/status/route.ts`, `src/app/api/labels/contacts/[phone]/route.ts` — verified directly
- `src/lib/supabase/server.ts` — confirmed `createClient()` server pattern
- `src/lib/supabase/client.ts` — confirmed browser client pattern
- `package.json` — confirmed installed packages and versions
- `node_modules/@radix-ui/` listing — confirmed installed Radix primitives
- `@radix-ui/react-collapsible` npm: version 1.1.12, React 19 compatible peer deps confirmed
- [Radix Collapsible docs](https://www.radix-ui.com/primitives/docs/components/collapsible) — API verified via WebFetch
- [Supabase upsert docs](https://supabase.com/docs/reference/javascript/upsert) — `onConflict` option verified

### Secondary (MEDIUM confidence)
- Phase 09-RESEARCH.md — established patterns for route handler structure, params-as-Promise, upsert-with-onConflict; directly applicable
- STACK.md research — `conversation_notes` table schema proposed there; adapted for correct design (per-conversation, not per-contact)
- Phase 09-02-PLAN.md patterns — Supabase join syntax `contact_labels(id, name, color)` confirmed as working for FK joins in `.select()`

### Tertiary (LOW confidence)
- `PanelRightOpen` icon: assumed available in lucide-react 0.545.0 based on naming conventions; not verified. Fallback: `UserRound`.
- Mobile panel overlay approach: inferred from existing mobile layout pattern; not explicitly tested.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing packages verified in node_modules; new package (collapsible) verified on npm with React 19 compatible peer deps
- Database schema: HIGH — mirrors existing Phase 9 patterns; upsert + FK join patterns already proven in this codebase
- Architecture (flex panel layout): HIGH — based on existing flex layout in page.tsx and message-view.tsx; straightforward extension
- Collapsible pattern: HIGH — official Radix docs verified; deps already installed
- Pitfalls: HIGH — most are extrapolations of already-confirmed Phase 9 pitfalls (params-as-Promise, upsert behavior)
- Icon name: LOW — not verified against installed version

**Research date:** 2026-02-22
**Valid until:** 2026-04-22 (60 days — all packages are stable; Supabase JS 2.97, Next.js 15.5, Radix 1.x are not in rapid-change cycles)
