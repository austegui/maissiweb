# Phase 14: Audit Cleanup - Research

**Researched:** 2026-02-22
**Domain:** React state management (PATCH response handling), Next.js client component conditional rendering (role-based nav), WhatsApp send flow (response.ok guard)
**Confidence:** HIGH

---

## Summary

Phase 14 resolves 5 tech-debt items from the v2.0 milestone audit. All fixes are surgical: no new packages, no schema changes, no new files beyond what already exists. The bugs and UX gaps are fully understood from codebase inspection.

**Item 1 (BUG):** `ContactPanel.handleSaveField` calls `setContact(data.data ?? null)` after PATCH, but PATCH returns `{ success: true }` with no `data` field — so `data.data` is `undefined`, and `setContact(null)` blanks the form. There is also a secondary field-name mismatch: the client sends `display_name` as the key but the API destructures `displayName` (camelCase), meaning display-name saves silently silently fail. The two-part fix: (a) change the PATCH response in `route.ts` to return `{ data: updatedContact }` by re-reading the row after update, OR update `handleSaveField` to optimistically set contact from the existing state; (b) fix the field key sent for display_name.

**Item 2 (WARNING):** `message-view.tsx` calls `onMessageSent?.()` unconditionally after `fetch('/api/messages/send', ...)` regardless of whether `response.ok` is true. The `onMessageSent` prop is wired to `markSentMessage` in `use-message-alerts.ts`, which sets `lastSentAtRef.current = Date.now()`. This starts a 5-second suppression window even on a failed send, so incoming messages during that window are silently dropped. Fix: capture the response, check `response.ok`, only call `onMessageSent?.()` when the send succeeded.

**Items 3 & 4 (UX):** `src/app/page.tsx` is `'use client'` and hard-codes nav links to `/admin/analytics`, `/admin/labels`, `/admin/canned-responses`, `/admin/settings` visible to all authenticated users. Agents who click them get redirected by `admin/layout.tsx`, but the links create confusion. Fix: fetch the current user's role via the existing `/api/user/preferences` call pattern (extend it to include `role`), or add a dedicated `/api/user/me` route, then conditionally render admin nav links only when `role === 'admin'`.

**Item 5 (UX):** `/admin/users` is only reachable via a link inside `/admin/settings`. Fix: add a "Usuarios" nav link to the top nav in `page.tsx`, rendered conditionally for admins (same role-check as Items 3 & 4).

**Primary recommendation:** Fix all 5 items in a single plan task (or 2 tasks: bug fixes + nav). No external dependencies. No schema changes. No new npm packages. All changes touch at most 3 files: `src/app/api/contacts/[phone]/route.ts`, `src/components/message-view.tsx`, `src/app/page.tsx` (plus optionally `src/app/api/user/preferences/route.ts`).

---

## Standard Stack

No new npm packages required. All work uses already-installed packages.

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 15.x | App Router, client components, fetch | Project framework |
| `react` | 18.x | useState, useEffect, conditional rendering | Project UI library |
| `@supabase/ssr` | ^0.8.0 | Server client for role lookup | Already used in all API routes |

### No New Dependencies
This phase adds zero npm packages and zero Vercel environment variables.

---

## Architecture Patterns

### Recommended Project Structure

No new files are needed. The 5 items touch:

```
src/
├── app/
│   ├── page.tsx                            # MODIFY: role-aware nav (items 3, 4, 5)
│   └── api/
│       ├── contacts/[phone]/route.ts       # MODIFY: PATCH response shape (item 1)
│       └── user/preferences/route.ts       # MODIFY: add role to GET response (items 3,4,5)
└── components/
    └── message-view.tsx                    # MODIFY: check response.ok before onMessageSent (item 2)
```

### Pattern 1: Fix PATCH Response Shape (Item 1a)

**What:** Change `PATCH /api/contacts/[phone]` to return the updated contact row instead of `{ success: true }`.

**Two options for the fix:**

**Option A (API-side fix) — RECOMMENDED:** After the UPDATE, SELECT the updated row and return it as `{ data: contact }`. This matches the GET response shape, making the API consistent.

```typescript
// src/app/api/contacts/[phone]/route.ts
// After: await supabase.from('contacts').update(updates).eq('phone_number', phone)
// Add:
const { data: updatedContact, error: fetchError } = await supabase
  .from('contacts')
  .select('phone_number, display_name, email, notes, whatsapp_name, created_at')
  .eq('phone_number', phone)
  .single();

if (fetchError) {
  return NextResponse.json({ error: fetchError.message }, { status: 500 });
}

return NextResponse.json({ data: updatedContact });
// (removes the old: return NextResponse.json({ success: true }))
```

**Option B (client-side fix):** Instead of trusting the response, optimistically update the local `contact` state with the known field + value, without waiting for a server re-read. This is simpler but doesn't catch server-side transformations (e.g., if the DB normalizes data).

Option A is preferred — it also fixes any potential future consumer of this endpoint.

### Pattern 2: Fix Field Name Mismatch (Item 1b)

**What:** `contact-panel.tsx` sends `display_name` as the JSON key for the name field, but the PATCH route reads `displayName` (camelCase). This means name updates are silently ignored by the API.

**Current broken code (contact-panel.tsx line 191):**
```typescript
onSave={(v) => handleSaveField('display_name', v)}
```

**API destructuring (route.ts line 60):**
```typescript
const { displayName, email, notes } = body as { displayName?: string; email?: string; notes?: string; }
```

**Fix:** Change the `onSave` call to use `displayName`:
```typescript
onSave={(v) => handleSaveField('displayName', v)}
```

`email` and `notes` are already lowercase in both sides — only `displayName` vs `display_name` is mismatched.

### Pattern 3: Guard onMessageSent with response.ok (Item 2)

**What:** Capture the fetch response, check `response.ok`, only call `onMessageSent?.()` on success.

**Current broken code (message-view.tsx ~line 558-563):**
```typescript
await fetch('/api/messages/send', {
  method: 'POST',
  body: formData
});

onMessageSent?.();  // ← called unconditionally
```

**Fixed code:**
```typescript
const response = await fetch('/api/messages/send', {
  method: 'POST',
  body: formData
});

if (response.ok) {
  onMessageSent?.();  // ← only on success
}
```

The rest of the `handleSendMessage` function (clearing input, removing file, fetching messages) can remain unconditional or also be gated — the audit only flags the suppression window issue, so gating just `onMessageSent` is the minimal correct fix.

### Pattern 4: Role-Aware Nav in Client Component (Items 3, 4, 5)

**What:** `src/app/page.tsx` is `'use client'`. Role data must be fetched from an API route since this component cannot use Supabase server-side directly.

**Current state:** `page.tsx` already fetches from `/api/user/preferences` on mount (line 51-60). The GET handler returns `{ notifications_enabled: boolean }`. Adding `role` to this response is a single-line change to the query.

**Approach:**
1. Extend `GET /api/user/preferences` to also return `role` from `user_profiles`.
2. In `page.tsx`, store `userRole` in state alongside `notificationsEnabled`.
3. Conditionally render admin nav links only when `userRole === 'admin'`.

**Step 1: Extend preferences GET route:**
```typescript
// src/app/api/user/preferences/route.ts
// Change the select to include role:
const { data } = await supabase
  .from('user_profiles')
  .select('notifications_enabled, role')  // add role
  .eq('id', user.id)
  .single();

return NextResponse.json({
  notifications_enabled: data?.notifications_enabled ?? true,
  role: data?.role ?? 'agent',             // add role to response
});
```

**Step 2: Consume role in page.tsx:**
```typescript
// page.tsx
const [userRole, setUserRole] = useState<'admin' | 'agent'>('agent');  // default to agent (least privilege)

useEffect(() => {
  fetch('/api/user/preferences')
    .then((r) => r.json())
    .then((data) => {
      if (typeof data.notifications_enabled === 'boolean') {
        setNotificationsEnabled(data.notifications_enabled);
      }
      if (data.role === 'admin' || data.role === 'agent') {
        setUserRole(data.role);
      }
    })
    .catch(console.error);
}, []);
```

**Step 3: Conditional nav rendering:**
```tsx
{/* Replace the unconditional admin links with: */}
{userRole === 'admin' && (
  <>
    <a href="/admin/analytics" className="text-xs text-gray-500 hover:text-gray-700">
      Analiticas
    </a>
    <a href="/admin/labels" className="text-xs text-gray-500 hover:text-gray-700">
      Etiquetas
    </a>
    <a href="/admin/canned-responses" className="text-xs text-gray-500 hover:text-gray-700">
      Canned Responses
    </a>
    <a href="/admin/settings" className="text-xs text-gray-500 hover:text-gray-700">
      Settings
    </a>
    <a href="/admin/users" className="text-xs text-gray-500 hover:text-gray-700">
      Usuarios
    </a>
  </>
)}
```

This resolves items 3 (analytics visible to agents), 4 (all admin links visible to agents), and 5 (Usuarios link missing from nav) in a single block.

**Default to 'agent':** Defaulting `userRole` to `'agent'` means links are hidden during the initial fetch. This is correct behavior (least privilege while loading). Links appear when fetch resolves if user is admin.

### Anti-Patterns to Avoid

- **Using a separate API route for role:** Adding `/api/user/me` is unnecessary overhead. The existing preferences route already fetches from `user_profiles` — just extend the SELECT and response.
- **Making page.tsx a Server Component to read role server-side:** `page.tsx` uses extensive client-state (`useState`, `useCallback`, `useRef`). Converting it would require significant restructuring. Client-side role fetch is the correct approach here.
- **Checking role via admin layout redirect behavior:** Don't rely on redirect as a signal for role — read the actual role value.
- **Optimistic contact update without also fixing the API response:** If only doing the client-side optimistic fix (Option B) for Item 1, the PATCH endpoint still returns a shape that no future consumer could trust. Fix the API response shape.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Role-based nav visibility | Custom middleware or separate layout per role | Conditional render in existing client component, role from existing API | Over-engineering for 5 links in a single component |
| Contact data after PATCH | Polling or WebSocket after save | SELECT after UPDATE in the same route handler | One extra DB read is negligible; keeps the response contract clean |
| Send failure detection | Error logging service or retry queue | Simple `response.ok` check | The fix is a one-liner; the problem is already caught by the try/catch |

**Key insight:** All 5 audit items are one-line or few-line fixes in existing files. The complexity here is identification, not implementation.

---

## Common Pitfalls

### Pitfall 1: Forgetting the field-name mismatch (Item 1b)
**What goes wrong:** Developer fixes the PATCH response shape (Item 1a) and assumes the form works. Name saves still fail silently because `display_name` key doesn't match `displayName` in the API.
**Why it happens:** Two separate bugs share the same symptom (form blanks after save).
**How to avoid:** Fix both: (a) API response shape AND (b) field key mismatch in the same commit.
**Warning signs:** After fixing Item 1a, email and notes save correctly but display_name still doesn't persist.

### Pitfall 2: Role defaulting to admin during fetch
**What goes wrong:** `useState<'admin' | 'agent'>('admin')` — admin links flash visible for all users during the brief fetch window before role is known.
**Why it happens:** Developer wants to avoid role check failing for the actual admin.
**How to avoid:** Default to `'agent'` (least privilege). The fetch is fast (same domain API); the flash window is imperceptible. Admins will see links appear within 100-200ms.
**Warning signs:** Agents see admin links briefly on page load before they disappear.

### Pitfall 3: Gating too much on response.ok in handleSendMessage (Item 2)
**What goes wrong:** Developer also gates `fetchMessages()` on `response.ok`, preventing the message list from refreshing even on a real send failure. This hides whether an optimistic message was sent.
**Why it happens:** Overeager fix.
**How to avoid:** Only gate `onMessageSent?.()` on `response.ok`. `fetchMessages()` should still run regardless (to show current state of messages, including any failure).
**Warning signs:** On send failure, message list becomes stale.

### Pitfall 4: PATCH route re-fetch error is ignored
**What goes wrong:** After the UPDATE, if the SELECT fails (rare but possible), the route returns 500 but the client already succeeded at updating the DB — user sees an error even though data was saved.
**Why it happens:** Two sequential DB operations can have different outcomes.
**How to avoid:** The error on re-fetch should be rare (row was just confirmed to exist). Return 500 for the re-fetch error with appropriate logging. This is correct behavior — if we can't read the row, we can't confirm the state to the client.

### Pitfall 5: Using plain `<a>` vs Next.js `<Link>` for new Usuarios link
**What goes wrong:** Developer uses `<Link>` inconsistently with the existing nav links (which all use `<a>`).
**Why it happens:** Next.js best practice push vs existing pattern.
**How to avoid:** The existing nav links all use `<a href>` (established in Phase 3 SUMMARY: "Used plain <a href> anchor tag rather than Next.js Link"). Follow the existing pattern — use `<a href="/admin/users">`.

---

## Code Examples

Verified patterns from codebase inspection:

### ContactPanel handleSaveField — current state
```typescript
// src/components/contact-panel.tsx line 127-137
const handleSaveField = async (field: string, value: string) => {
  const res = await fetch(`/api/contacts/${encodeURIComponent(phoneNumber)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ [field]: value }),
  });
  if (res.ok) {
    const data = await res.json();
    setContact(data.data ?? null);  // ← data.data is undefined → setContact(null)
  }
};

// Field call site (line 191) — wrong key:
onSave={(v) => handleSaveField('display_name', v)}  // ← should be 'displayName'
```

### PATCH route — current state
```typescript
// src/app/api/contacts/[phone]/route.ts line 74-84
const { error } = await supabase
  .from('contacts')
  .update(updates)
  .eq('phone_number', phone);

if (error) {
  return NextResponse.json({ error: error.message }, { status: 500 });
}

return NextResponse.json({ success: true });  // ← no data field
```

### PATCH route — fixed state
```typescript
// After the update, re-read and return:
const { error } = await supabase
  .from('contacts')
  .update(updates)
  .eq('phone_number', phone);

if (error) {
  return NextResponse.json({ error: error.message }, { status: 500 });
}

const { data: updatedContact, error: fetchError } = await supabase
  .from('contacts')
  .select('phone_number, display_name, email, notes, whatsapp_name, created_at')
  .eq('phone_number', phone)
  .single();

if (fetchError) {
  return NextResponse.json({ error: fetchError.message }, { status: 500 });
}

return NextResponse.json({ data: updatedContact });
```

### message-view.tsx handleSendMessage — current state (lines 558-566)
```typescript
await fetch('/api/messages/send', {
  method: 'POST',
  body: formData
});

onMessageSent?.();  // ← called unconditionally; starts 5-sec suppression on failure
setMessageInput('');
handleRemoveFile();
await fetchMessages();
```

### message-view.tsx handleSendMessage — fixed state
```typescript
const response = await fetch('/api/messages/send', {
  method: 'POST',
  body: formData
});

if (response.ok) {
  onMessageSent?.();  // ← only activates suppression window on successful send
}
setMessageInput('');
handleRemoveFile();
await fetchMessages();
```

### page.tsx nav — current state (lines 138-150)
```tsx
<a href="/admin/analytics" className="text-xs text-gray-500 hover:text-gray-700">
  Analiticas
</a>
<a href="/admin/labels" className="text-xs text-gray-500 hover:text-gray-700">
  Etiquetas
</a>
<a href="/admin/canned-responses" className="text-xs text-gray-500 hover:text-gray-700">
  Canned Responses
</a>
<a href="/admin/settings" className="text-xs text-gray-500 hover:text-gray-700">
  Settings
</a>
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| PATCH returns `{ success: true }` | PATCH returns `{ data: updatedContact }` — SELECT after UPDATE | UI can update state from server response; consistent with GET shape |
| `onMessageSent()` called unconditionally | `onMessageSent()` called only when `response.ok` | Suppression window no longer activates on failed sends |
| All nav links visible to all users | Admin nav links hidden for agents | Agents no longer see links that redirect them; cleaner UX |
| `/admin/users` only from settings page link | `/admin/users` in top nav (admin-only) | Directly discoverable without navigating to settings first |

---

## Open Questions

1. **Should `setMessageInput('')` and `handleRemoveFile()` also be gated on `response.ok`?**
   - What we know: The audit only flags the suppression window. The `setMessageInput('')` clearing on failure could be seen as losing the user's draft.
   - What's unclear: Product intent — should the input be cleared if send fails?
   - Recommendation: Only gate `onMessageSent?.()` per the minimal audit fix. Leave input clearing and message fetch unconditional unless product decides otherwise.

2. **Is there a flash of admin links for admins on page load while role is being fetched?**
   - What we know: Default is `'agent'`, so links are hidden during fetch. Admins won't see them for ~100-200ms.
   - What's unclear: Whether this is acceptable UX or if a loading state is needed.
   - Recommendation: Acceptable. The fetch is fast (same-origin API call). No loader needed. This is consistent with how `notificationsEnabled` is handled (loads defaults then updates).

3. **Should Settings link remain visible to agents?**
   - What we know: `/admin/settings` is protected by `admin/layout.tsx`. Agents who click it get redirected. The audit item specifically calls out analytics, labels, canned-responses, and the missing users link. Settings is listed in the phase description but not separately audited.
   - Recommendation: Include Settings in the admin-only block — it's listed in the phase success criteria item 2: "Non-admin users do not see admin-only nav links (analytics, labels, canned responses, settings, users)".

---

## Sources

### Primary (HIGH confidence — codebase inspection)
- `src/components/contact-panel.tsx` — `handleSaveField` (line 127-137), field call sites (lines 191, 198, 204), `EditableField` component
- `src/app/api/contacts/[phone]/route.ts` — PATCH handler returns `{ success: true }` (line 84); GET returns `{ data: contact }` (line 38); UPDATE updates object field names `display_name`, `email`, `notes`
- `src/components/message-view.tsx` — `handleSendMessage` (lines 540-572); `onMessageSent?.()` called unconditionally after fetch (line 563)
- `src/hooks/use-message-alerts.ts` — `markSentMessage` sets `lastSentAtRef.current = Date.now()` (lines 129-131); suppression check `now - lastSentAtRef.current < 5000` (line 155)
- `src/app/page.tsx` — nav links lines 138-150; preferences fetch lines 51-60; `'use client'` directive; `onMessageSent={markSentMessage}` wiring (line 205)
- `src/app/api/user/preferences/route.ts` — GET returns `{ notifications_enabled }` (lines 12-19); SELECT from `user_profiles` (line 14)
- `src/app/admin/layout.tsx` — role check pattern (lines 19-27) confirms `user_profiles.role` column exists with values `'admin'` / `'agent'`
- `.planning/phases/03-admin-settings/03-03-SUMMARY.md` — established pattern of using `<a href>` not `<Link>` in `page.tsx`
- `.planning/v2.0-MILESTONE-AUDIT.md` — all 5 audit items with precise file/line locations

### No External Sources Required
All research for this phase is purely codebase-based. No library APIs, no npm packages, no configuration patterns need verification. The fixes are React state management and Next.js API route patterns already established in the project.

---

## Metadata

**Confidence breakdown:**
- Bug analysis (items 1, 2): HIGH — bugs identified by direct code inspection, root causes confirmed
- UX fix approach (items 3, 4, 5): HIGH — role field exists in DB, preferences API already fetches from same table
- Implementation patterns: HIGH — all patterns are established in this codebase
- Field name mismatch (item 1b): HIGH — verified by reading both sides of the PATCH call

**Research date:** 2026-02-22
**Valid until:** Stable indefinitely (these are bug fixes in stable code — no moving external targets)
