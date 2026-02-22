# Phase 13: Error Tracking + User Management - Research

**Researched:** 2026-02-22
**Domain:** Next.js global-error.tsx, Supabase Admin Auth API, user management CRUD
**Confidence:** HIGH

---

## Summary

Phase 13 delivers two independent features: a branded global error page (`global-error.tsx`) and a full user management UI at `/admin/users`. Sentry integration is deferred per the phase context.

The `global-error.tsx` file is a Next.js App Router convention — a Client Component placed at `src/app/global-error.tsx` that catches unrecoverable errors in the root layout. It requires `'use client'`, must include its own `<html>` and `<body>` tags, and receives `{ error, reset }` props. This is the only file convention that replaces the root layout entirely. No new npm packages are needed for this feature.

User management requires the Supabase Admin Auth API (`supabase.auth.admin.*`) which is accessible only via the **service role key**, never the anon key. This requires a new environment variable (`SUPABASE_SERVICE_ROLE_KEY`) added to Vercel. Three admin operations are needed: `createUser` (with `email_confirm: true` to skip email flow), `updateUserById` (to change role via `user_metadata` or directly on `user_profiles`, and to ban/unban), and listing users. The `last_sign_in_at` field comes from Supabase's `auth.users` table and is returned by `listUsers`. User deactivation uses `ban_duration: '876000h'` (soft disable, ~100 years), and reactivation uses `ban_duration: 'none'`. No new npm packages are required beyond what is installed.

**Primary recommendation:** Create a server-only admin client (`src/lib/supabase/admin.ts`) using the service role key. Use Server Actions in `src/app/admin/users/actions.ts` for create/update/deactivate operations, protected by an admin role check at the start of each action. Build the user list page as a Server Component that fetches from `user_profiles` joined with `last_sign_in_at` from `auth.users` via `listUsers`.

---

## Standard Stack

No new npm packages are required. All work uses packages already installed.

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.97.0 | Admin Auth API (`auth.admin.*`) | Service role client uses same package, different key |
| `@supabase/ssr` | ^0.8.0 | Server client for anon operations | Already in use across all admin pages |
| `next` | 15.5.9 | `global-error.tsx` convention, Server Actions | No changes needed |
| `@radix-ui/react-dialog` | ^1.1.15 | Confirmation dialog, credentials dialog | Already in UI kit |
| `@radix-ui/react-select` | ^2.2.6 | Role dropdown in user list | Already used in message-view.tsx |
| `lucide-react` | ^0.545.0 | Icons (User, Shield, etc.) | Already in use |
| `tailwindcss` | ^4 | Styling | Already in use |

### No New Dependencies
This phase adds zero npm packages.

**Required new environment variable (Vercel only, not in .env.local):**
```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```
Note: No `NEXT_PUBLIC_` prefix — this key must NEVER be exposed to the browser.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── global-error.tsx          # NEW: root-level error boundary (Client Component)
│   └── admin/
│       └── users/
│           ├── page.tsx          # NEW: Server Component — list + invite button
│           ├── UsersManager.tsx  # NEW: Client Component — interactive table
│           └── actions.ts        # NEW: Server Actions — create, update role, deactivate
├── lib/
│   └── supabase/
│       └── admin.ts              # NEW: service role client (server-only)
```

### Pattern 1: global-error.tsx

**What:** Catches all unrecoverable errors in the root layout. Replaces the root layout when active, so it must include its own `<html>` and `<body>` tags. Must be a Client Component.

**Location:** `src/app/global-error.tsx` (root app directory, not nested)

**When it triggers:** Errors that escape all `error.tsx` boundaries AND the root layout itself. Less common than route-level `error.tsx`, but catches total crashes.

**Critical requirements:**
- Must have `'use client'` directive
- Must include `<html>` and `<body>` tags (it replaces the root layout)
- Cannot use `metadata` or `generateMetadata` exports (use React `<title>` instead)
- The `reset` prop re-renders the error boundary's contents

**Verified pattern from Next.js 15 official docs:**
```typescript
// src/app/global-error.tsx
'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="es">
      <body className="...">
        {/* Logo + message + buttons here */}
        <button onClick={() => reset()}>Intentar de nuevo</button>
        <a href="/">Volver al inicio</a>
      </body>
    </html>
  )
}
```

**Styling constraint:** `global-error.tsx` cannot import the global CSS (which depends on the root layout's body classes). Apply Tailwind classes inline or inline styles. The Maissi primary color is `#00a884` (CSS var `--primary`). The logo is at `/public/maissi-logo.svg` (already used in `src/app/page.tsx` as `<img src="/maissi-logo.svg" alt="Maissi" />`).

**Note from Next.js 15.2.0 changelog:** `global-error` is also displayed in development (previously was production-only). This means it can be visually tested without deploying.

### Pattern 2: Supabase Admin Client (service role)

**What:** A server-side Supabase client using the service role key. Bypasses RLS entirely. Must only be used in Server Actions and Route Handlers (never in Client Components or browser code).

**Location:** `src/lib/supabase/admin.ts`

**Critical auth options:** `persistSession: false`, `autoRefreshToken: false`, `detectSessionInUrl: false`

```typescript
// src/lib/supabase/admin.ts
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase admin credentials')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
```

**Why not use `createServerClient` from `@supabase/ssr`?** The SSR client is designed for cookie-based user sessions. The admin client uses a static service role key — no cookies needed. Use `createClient` from `@supabase/supabase-js` directly.

### Pattern 3: Server Actions for User Management

**What:** All write operations (create, update role, deactivate, reactivate) go through Server Actions in `actions.ts`. Each action must:
1. Create the anon Supabase client and verify the caller is an admin
2. Create the admin client for the actual operation
3. Prevent self-modification

**Why Server Actions instead of Route Handlers:** Consistent with the existing pattern in this codebase (canned-responses, labels, settings all use Server Actions). Simpler than API routes for one-off admin operations.

```typescript
// src/app/admin/users/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type ActionResult = { success: boolean; message: string }

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autorizado')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') throw new Error('Solo administradores')
  return { user, supabase }
}

export async function createMember(
  email: string,
  password: string,
  displayName: string,
  role: 'admin' | 'agent'
): Promise<ActionResult & { credentials?: { email: string; password: string } }> {
  try {
    const { user: adminUser } = await requireAdmin()
    const adminClient = createAdminClient()

    // Create user — email_confirm: true skips confirmation email
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: displayName },
    })

    if (error) {
      if (error.message.includes('already been registered')) {
        return { success: false, message: 'Este email ya está registrado' }
      }
      return { success: false, message: `Error al crear: ${error.message}` }
    }

    // Set role on user_profiles (trigger creates the row with role='agent')
    // Override role if admin was selected
    if (role === 'admin' && data.user) {
      await adminClient
        .from('user_profiles')
        .update({ role: 'admin', display_name: displayName })
        .eq('id', data.user.id)
    } else if (data.user) {
      await adminClient
        .from('user_profiles')
        .update({ display_name: displayName })
        .eq('id', data.user.id)
    }

    revalidatePath('/admin/users')
    return {
      success: true,
      message: 'Miembro creado',
      credentials: { email, password },
    }
  } catch (err) {
    return { success: false, message: (err as Error).message }
  }
}

export async function updateMemberRole(
  targetUserId: string,
  newRole: 'admin' | 'agent'
): Promise<ActionResult> {
  try {
    const { user: adminUser } = await requireAdmin()

    // Prevent self-modification
    if (adminUser.id === targetUserId) {
      return { success: false, message: 'No puedes cambiar tu propio rol' }
    }

    const adminClient = createAdminClient()
    const { error } = await adminClient
      .from('user_profiles')
      .update({ role: newRole })
      .eq('id', targetUserId)

    if (error) return { success: false, message: error.message }

    revalidatePath('/admin/users')
    return { success: true, message: 'Rol actualizado' }
  } catch (err) {
    return { success: false, message: (err as Error).message }
  }
}

export async function deactivateMember(targetUserId: string): Promise<ActionResult> {
  try {
    const { user: adminUser } = await requireAdmin()

    if (adminUser.id === targetUserId) {
      return { success: false, message: 'No puedes desactivarte a ti mismo' }
    }

    const adminClient = createAdminClient()
    const { error } = await adminClient.auth.admin.updateUserById(targetUserId, {
      ban_duration: '876000h', // ~100 years = effectively permanent
    })

    if (error) return { success: false, message: error.message }

    revalidatePath('/admin/users')
    return { success: true, message: 'Miembro desactivado' }
  } catch (err) {
    return { success: false, message: (err as Error).message }
  }
}

export async function reactivateMember(targetUserId: string): Promise<ActionResult> {
  try {
    await requireAdmin()
    const adminClient = createAdminClient()
    const { error } = await adminClient.auth.admin.updateUserById(targetUserId, {
      ban_duration: 'none', // lifts the ban
    })

    if (error) return { success: false, message: error.message }

    revalidatePath('/admin/users')
    return { success: true, message: 'Miembro reactivado' }
  } catch (err) {
    return { success: false, message: (err as Error).message }
  }
}
```

### Pattern 4: Fetching User List (Combining auth.users + user_profiles)

**Problem:** `user_profiles` has `display_name` and `role`, but NOT `email` or `last_sign_in_at`. Those come from `auth.users`, which is not directly queryable via the anon client.

**Solution:** Use `adminClient.auth.admin.listUsers()` to get auth data (email, last_sign_in_at, banned_until), then join with `user_profiles` data in memory.

```typescript
// src/app/admin/users/page.tsx (Server Component)
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export default async function UsersPage() {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  // Fetch both in parallel
  const [authResult, profilesResult] = await Promise.all([
    adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabase.from('user_profiles').select('id, display_name, role'),
  ])

  // Join in memory: auth data + profile data
  const profileMap = new Map(
    (profilesResult.data ?? []).map((p) => [p.id, p])
  )

  const users = (authResult.data?.users ?? []).map((authUser) => {
    const profile = profileMap.get(authUser.id)
    return {
      id: authUser.id,
      email: authUser.email ?? '',
      displayName: profile?.display_name ?? authUser.email ?? '',
      role: (profile?.role ?? 'agent') as 'admin' | 'agent',
      isActive: !authUser.banned_until || new Date(authUser.banned_until) < new Date(),
      lastSignInAt: authUser.last_sign_in_at ?? null,
    }
  })

  return <UsersManager users={users} currentUserId={...} />
}
```

**Note:** `listUsers` returns up to 1000 users per page (default 50). For a small team, `perPage: 1000` is safe and avoids pagination complexity.

**`banned_until` field:** Returns an ISO timestamp string if banned, `null` or empty if not banned. The check `!authUser.banned_until || new Date(authUser.banned_until) < new Date()` handles both null (active) and expired bans (active again).

### Pattern 5: Navigation Link from Settings Page

The settings page at `/admin/settings/page.tsx` needs a link added:

```typescript
// Add to src/app/admin/settings/page.tsx
<Link href="/admin/users" className="text-sm text-[#00a884] hover:underline">
  Gestión de miembros →
</Link>
```

### Anti-Patterns to Avoid

- **Using the anon client for admin operations:** `supabase.auth.admin` doesn't exist on the anon client — it only exists on a client created with the service role key.
- **Exposing `SUPABASE_SERVICE_ROLE_KEY` with `NEXT_PUBLIC_` prefix:** This makes it accessible in browser JavaScript bundles. Never prefix the service role key.
- **Calling `createAdminClient()` in Client Components:** The service role key would be in the browser. All admin operations go through Server Actions.
- **Relying on the signup trigger for display_name:** The trigger creates the profile with `full_name` from `raw_user_meta_data`. When `createUser` is called with `user_metadata: { full_name: displayName }`, the trigger picks it up. But after creation, also call `.update({ display_name: displayName })` to ensure consistency if the trigger misses.
- **Deleting auth users:** The context explicitly forbids permanent deletion. Use ban only.
- **Not checking `currentUserId` in the Client Component:** The UI must disable role-change and deactivate buttons for the current admin's own row (prevents lockout). The server action also checks, but the UI guard prevents confusing errors.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| User deactivation | Custom `is_active` column + application checks | `auth.admin.updateUserById` with `ban_duration` | Supabase enforces the ban at the auth layer — a banned user cannot obtain a valid session even if application code has bugs |
| User creation by admin | `supabase.auth.signUp()` in a Server Action | `auth.admin.createUser` with `email_confirm: true` | `signUp` sends a confirmation email and creates the user in the caller's session context; `createUser` admin API creates without email flow and without affecting the caller's session |
| Root error boundary | Custom React class component wrapping `<App>` | `src/app/global-error.tsx` file convention | Next.js handles the error boundary setup; file convention is the only reliable way to catch root layout errors |
| Listing users with email | Querying `user_profiles` (which has no email column) | `auth.admin.listUsers()` + join with `user_profiles` | `auth.users` is not directly queryable via RLS; admin API is the documented way |

**Key insight:** The Supabase admin API is the correct boundary between "app-level role management" (user_profiles.role) and "auth-level account status" (banned_until in auth.users). Don't try to replicate ban logic in the database — let Supabase handle it.

---

## Common Pitfalls

### Pitfall 1: global-error.tsx Missing html/body Tags
**What goes wrong:** The component renders without `<html>` and `<body>` — either a hydration mismatch error or a completely unstyled page because the root layout's HTML shell is replaced.
**Why it happens:** Developers forget that `global-error.tsx` replaces the root layout, not just the page content.
**How to avoid:** Always include `<html lang="es"><body>...</body></html>` in the component. Apply Tailwind classes inline using the Maissi color values directly (`#00a884`, `#111b21`, etc.) since CSS variables from globals.css are not available.
**Warning signs:** Tailwind classes don't apply, or Next.js build warns about missing html/body tags.

### Pitfall 2: global-error.tsx Cannot Import globals.css Styles Properly
**What goes wrong:** The error page looks completely unstyled or uses default browser styles, despite importing globals.css.
**Why it happens:** `global-error.tsx` replaces the entire root layout including the CSS import. The CSS variables defined in `:root` (like `--primary: #00a884`) are not available.
**How to avoid:** Either (a) import `globals.css` directly in `global-error.tsx` (this works since it's its own document), or (b) use inline Tailwind utility classes with hardcoded values for the handful of brand colors needed (`bg-[#00a884]`, `text-[#111b21]`). Option (b) is simpler and avoids potential CSS ordering issues.

### Pitfall 3: Service Role Key Accidentally Committed to Git
**What goes wrong:** The service role key ends up in `.env.local` and gets committed, or is hardcoded in a file.
**Why it happens:** Developer follows the same pattern as other env vars.
**How to avoid:** Set `SUPABASE_SERVICE_ROLE_KEY` only in Vercel's environment variables dashboard. Never put it in `.env.local` (which is gitignored but still risky). The `.env.local` file in this project only has the Kapso/WhatsApp keys — follow the same approach.
**Warning signs:** GitHub secret scanning alert, or the key appearing in `git log` output.

### Pitfall 4: createUser Without email_confirm Blocks the User
**What goes wrong:** The created user's email is unconfirmed. They try to log in and Supabase rejects with "Email not confirmed." The admin shared the credentials but the user can't log in.
**Why it happens:** By default, `auth.admin.createUser` does NOT auto-confirm email.
**How to avoid:** Always include `email_confirm: true` in `createUser` calls. This skips the email confirmation requirement. Since this is an internal tool (admin creates accounts manually and shares credentials), email confirmation flow is unnecessary.
**Warning signs:** User reports "Email not confirmed" error when trying to log in with the provided credentials.

### Pitfall 5: Signup Trigger Creates user_profiles Row Before Admin Can Set Role
**What goes wrong:** After `createUser`, the trigger fires and inserts a `user_profiles` row with `role='agent'` (the trigger default). If the admin then tries to update the role to 'admin', a race condition could mean the UPDATE runs before the INSERT completes.
**Why it happens:** Triggers are asynchronous relative to the `createUser` API response. The API may return before the trigger has committed.
**How to avoid:** After `createUser` returns successfully, run the `user_profiles` UPDATE using the admin client (service role bypasses RLS). If the trigger hasn't fired yet, use `upsert` instead of `update`:
```typescript
await adminClient
  .from('user_profiles')
  .upsert({ id: data.user.id, display_name: displayName, role })
  .eq('id', data.user.id)
```
The `upsert` handles both "trigger already ran" (UPDATE) and "trigger hasn't run yet" (INSERT). However, the trigger uses `ON CONFLICT DO NOTHING`, so the upsert effectively overrides the trigger's default.

**Alternative (simpler):** Wait to see if the trigger race condition manifests in testing (it likely won't in practice since the trigger is synchronous on INSERT). If it does, switch to upsert.

### Pitfall 6: Admin Cannot Reactivate a User Because Ban Status Not Visible
**What goes wrong:** The user list shows all users as "active" because the `banned_until` field isn't being read from `listUsers`.
**Why it happens:** `user_profiles` has no `is_active` column — the ban status lives in `auth.users.banned_until`. If the page only reads `user_profiles`, it never knows who is banned.
**How to avoid:** Always fetch ban status from `listUsers` (auth admin API), not from `user_profiles`. The join pattern in Pattern 4 above handles this correctly.

### Pitfall 7: Role Change Bypasses RLS
**What goes wrong:** Updating `user_profiles.role` via the anon client is blocked by the RLS policy "Only admins can change roles" — or worse, the policy is misconfigured and agents can change their own role.
**Why it happens:** The role update in Server Actions should use the admin client (service role) which bypasses RLS entirely. If the anon client is used, the RLS policy must be verified to work correctly.
**How to avoid:** Use `createAdminClient()` for the `user_profiles` UPDATE in `updateMemberRole`. The service role key bypasses RLS — no policy conflict possible.
**Note:** This is intentional. The admin auth guard in `requireAdmin()` handles authorization at the application level; RLS is a secondary defense.

### Pitfall 8: ban_duration Known Issue with createUser
**What goes wrong:** Passing `ban_duration` to `createUser` (to create a pre-banned user) sets the field in the returned object but does NOT persist it in `auth.users`.
**Status:** This is a known Supabase issue (GitHub issue #1798 in supabase/auth). It is irrelevant to this phase since we never create pre-banned users. Just document it for awareness.
**How to avoid:** Always ban separately via `updateUserById`, never via `createUser`.

---

## Code Examples

Verified patterns from official Next.js docs and Supabase documentation:

### global-error.tsx (Maissi branded)
```typescript
// src/app/global-error.tsx
'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="es">
      <head>
        <title>Algo salió mal — Maissi</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f0f2f5' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '1.5rem', padding: '2rem', textAlign: 'center' }}>
          <img src="/maissi-logo.svg" alt="Maissi" style={{ height: '2.5rem' }} />
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111b21', marginBottom: '0.5rem' }}>
              Algo salió mal
            </h1>
            <p style={{ color: '#667781', fontSize: '0.875rem' }}>
              Estamos trabajando en ello. Por favor intenta de nuevo.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => reset()}
              style={{ background: '#00a884', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1.25rem', fontSize: '0.875rem', cursor: 'pointer', fontWeight: 500 }}
            >
              Intentar de nuevo
            </button>
            <a
              href="/"
              style={{ background: 'transparent', color: '#111b21', border: '1px solid #e9edef', borderRadius: '0.5rem', padding: '0.5rem 1.25rem', fontSize: '0.875rem', textDecoration: 'none', fontWeight: 500 }}
            >
              Volver al inicio
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
```

**Note:** Using inline styles avoids the CSS variable dependency issue. If Tailwind v4 is available in global-error.tsx (it may not be since the layout is bypassed), switch to Tailwind classes. Test visually after deployment.

### Admin Client Factory
```typescript
// src/lib/supabase/admin.ts
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )
}
```

### createUser with auto-confirm
```typescript
// Source: Supabase Admin Auth API docs
const { data, error } = await adminClient.auth.admin.createUser({
  email: 'user@example.com',
  password: 'password123',
  email_confirm: true,         // skips email confirmation flow
  user_metadata: { full_name: 'María López' },
})
```

### Ban and Unban
```typescript
// Source: Supabase updateUserById docs + community verification
// Deactivate (soft disable):
await adminClient.auth.admin.updateUserById(userId, {
  ban_duration: '876000h',  // ~100 years
})

// Reactivate:
await adminClient.auth.admin.updateUserById(userId, {
  ban_duration: 'none',     // lifts the ban
})
```

### Determine if user is banned
```typescript
// banned_until is an ISO string or null/empty
const isActive = (user: { banned_until?: string | null }) => {
  if (!user.banned_until) return true
  return new Date(user.banned_until) < new Date()
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Custom `is_active` column in DB | `ban_duration` via Supabase Admin Auth API | Auth enforcement at the auth layer — no app code can bypass it |
| Error boundaries as class components | `global-error.tsx` file convention | Declarative, Next.js manages the boundary setup |
| Manual email invitations with confirm flow | `createUser` with `email_confirm: true` + manual credential sharing | No email infra needed; simpler for internal tools |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: Do not use — deprecated in favor of `@supabase/ssr`
- `error.tsx` at root for global errors: Does NOT catch root layout errors. Only `global-error.tsx` does.

---

## Open Questions

1. **Does the signup trigger handle `user_metadata.full_name` from admin.createUser?**
   - What we know: The trigger uses `COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email, '')`. When `createUser` is called with `user_metadata: { full_name: 'Name' }`, this maps to `raw_user_meta_data`.
   - What's unclear: Whether `user_metadata` passed to `auth.admin.createUser` lands in `raw_user_meta_data` or `raw_app_meta_data`.
   - Recommendation: Use upsert after `createUser` to explicitly set `display_name`. Don't rely solely on the trigger for the display name in the admin creation flow.

2. **Can Tailwind v4 classes be used in global-error.tsx?**
   - What we know: `global-error.tsx` replaces the root layout. The root layout imports `globals.css` which includes `@import "tailwindcss"`. If `global-error.tsx` does NOT import `globals.css`, Tailwind classes won't work.
   - Recommendation: Add `import '@/app/globals.css'` to `global-error.tsx`. If it works, use Tailwind classes. If there are issues, fall back to inline styles (the code example above uses inline styles as the safe default).

3. **Is there a Radix Select component in the UI kit?**
   - What we know: No `select.tsx` exists in `src/components/ui/`. The project uses `@radix-ui/react-select` directly (as seen in `message-view.tsx` with `import * as Select from '@radix-ui/react-select'`).
   - Recommendation: Use the same raw Radix Select pattern from `message-view.tsx` for the role dropdown, OR implement a simple native `<select>` element styled with Tailwind. For a single dropdown (role: Admin/Agente), a native `<select>` is simpler and sufficient.

4. **Should user_profiles have a `display_name` column update on admin createUser?**
   - What we know: The trigger creates the row with `display_name = COALESCE(raw_user_meta_data ->> 'full_name', email, '')`. When display_name is entered by the admin in the form, it's passed as `user_metadata: { full_name: displayName }`.
   - What's unclear: Whether there's a timing race between trigger INSERT and our subsequent UPDATE.
   - Recommendation: Use upsert on `user_profiles` after `createUser` to guarantee display_name is set correctly regardless of trigger timing. The upsert with the service role key bypasses RLS cleanly.

---

## Sources

### Primary (HIGH confidence)
- [Next.js error.js file convention docs](https://nextjs.org/docs/app/api-reference/file-conventions/error) — `global-error.tsx` requirements: `'use client'`, html/body tags, `reset` prop — verified from official docs dated 2026-02-20
- [Next.js error handling guide](https://nextjs.org/docs/app/getting-started/error-handling) — global vs nested error boundaries — verified from official docs dated 2026-02-20
- [Supabase auth.admin.createUser reference](https://supabase.com/docs/reference/javascript/auth-admin-createuser) — parameters including `email_confirm`, `user_metadata` — verified directly
- [Supabase auth.admin.updateUserById reference](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid) — `ban_duration` parameter format — verified directly
- [Supabase API keys guide](https://supabase.com/docs/guides/api/api-keys) — service role key security requirements — verified directly
- Existing codebase: `src/lib/supabase/server.ts`, `src/app/admin/layout.tsx`, `src/app/admin/labels/actions.ts`, `src/components/ui/dialog.tsx`, `src/components/message-view.tsx`, `src/app/globals.css`, `public/maissi-logo.svg` — verified directly

### Secondary (MEDIUM confidence)
- [Supabase discussion #9239 — disabling users](https://github.com/orgs/supabase/discussions/9239) — `ban_duration: '876000h'` for indefinite ban, `ban_duration: 'none'` to unban — community-verified pattern
- [adrianmurage.com — Supabase service role key in Next.js](https://adrianmurage.com/posts/supabase-service-role-secret-key/) — admin client options `persistSession: false, autoRefreshToken: false, detectSessionInUrl: false` — cross-verified with official docs

### Tertiary (LOW confidence — flagged)
- [Supabase auth issue #1798](https://github.com/supabase/auth/issues/1798) — `ban_duration` not persisted when used in `createUser` (known bug). Irrelevant to this phase but documented.

---

## Metadata

**Confidence breakdown:**
- global-error.tsx pattern: HIGH — verified from Next.js 15 official docs (dated 2026-02-20)
- Admin client setup: HIGH — `createClient` with service role is documented pattern
- createUser with email_confirm: HIGH — verified from official Supabase reference
- ban_duration pattern: MEDIUM — official API + community confirmation; actual field format verified
- display_name trigger race: LOW — theoretical concern, not verified with actual Supabase timing behavior

**Research date:** 2026-02-22
**Valid until:** 2026-08-22 (Supabase Admin API is stable; Next.js file conventions unlikely to change)
