# Phase 7: Foundation - Research

**Researched:** 2026-02-21
**Domain:** Supabase RBAC (query-based), PostgreSQL triggers, RLS policies, Next.js App Router route protection, config batch refactor
**Confidence:** HIGH

---

## Summary

Phase 7 establishes the RBAC and config infrastructure that every subsequent v2.0 phase depends on. It has two distinct sub-domains: (1) Supabase database changes — a `user_profiles` table, a signup trigger, and RLS policies; and (2) a TypeScript refactor in `src/lib/get-config.ts` to batch config queries.

The standard pattern for auto-creating a profile on signup is a PostgreSQL trigger function with `SECURITY DEFINER SET search_path = ''` that inserts a row into `public.user_profiles` after insert on `auth.users`. This is official Supabase documentation and well-proven. The locked decision to use **query-based RBAC** (not JWT custom claims) means role checks happen at query time against `user_profiles.role`, not from the JWT. This approach requires wrapping role-check expressions in `SELECT` subqueries in RLS policies for performance (avoids per-row re-evaluation).

For Next.js route protection, middleware is the wrong place to query the database for roles — it should remain lightweight. The correct pattern is: middleware handles auth-only redirect (already in place), and `layout.tsx` in the `src/app/admin/` route group performs the role check via a server-side Supabase query, then redirects unauthorized users.

The `getConfigs()` batch refactor replaces 3–4 sequential `getConfig()` calls per API request with a single `.in()` filter query. This is low-risk, high-confidence work — the Supabase JS client `.in()` filter is well-documented and directly applicable to the `app_settings` table.

**Primary recommendation:** Write all Supabase schema SQL in the Supabase Dashboard SQL Editor. Test RLS policies using the Table Editor (which respects RLS) — not the SQL Editor (which bypasses RLS using the service role). Deploy incrementally: create table → add permissive SELECT → verify → add restrictive policies.

---

## Standard Stack

No new npm packages are required for Phase 7. All work is:
- SQL executed in the Supabase Dashboard
- TypeScript changes to existing files in `src/lib/`
- A new `src/app/admin/layout.tsx` Server Component

### Existing Packages Used
| Package | Version | Purpose |
|---------|---------|---------|
| `@supabase/supabase-js` | ^2.97.0 | Database queries, auth, RLS |
| `@supabase/ssr` | ^0.8.0 | Server-side Supabase client |
| `next` | 15.5.9 | App Router, Server Components, redirect |

### No New Dependencies
This phase adds zero npm packages.

---

## Architecture Patterns

### Recommended File Changes

```
src/
├── lib/
│   └── get-config.ts          # MODIFIED: add getConfigs() batch function
│       whatsapp-client.ts     # MODIFIED: call getConfigs() instead of 4x getConfig()
├── app/
│   ├── admin/
│   │   ├── layout.tsx         # NEW: role guard — redirects non-admin to /
│   │   └── settings/          # UNCHANGED (already exists)
│   └── (other routes)         # UNCHANGED

Supabase Dashboard (SQL, not files):
  - CREATE TABLE public.user_profiles
  - CREATE FUNCTION public.handle_new_user()
  - CREATE TRIGGER on_auth_user_created
  - RLS policies on user_profiles
  - RLS policies on app_settings (admin-write only)
```

### Pattern 1: Auto-Create Profile Trigger

**What:** A PostgreSQL trigger that inserts a `user_profiles` row when a new user signs up via `auth.users`.

**When to use:** Runs automatically on every new signup — no application code needed.

**Critical requirement:** Must use `SECURITY DEFINER SET search_path = ''` so the trigger can write to `public.user_profiles` from within the `auth` schema context. Without this, the trigger fails and blocks all signups.

```sql
-- Source: https://supabase.com/docs/guides/auth/managing-user-data

CREATE TABLE public.user_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'agent')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Trigger function: runs as postgres superuser (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email, ''),
    'agent'  -- default role for all new signups
  );
  RETURN NEW;
END;
$$;

-- Trigger: fires after every new row inserted into auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();
```

**Warning:** If the trigger body throws an error, the entire signup is rolled back and the user sees a 500 error. Test this before deploying by verifying in Supabase Dashboard that existing users already have `user_profiles` rows (they don't — existing users need a one-time backfill INSERT).

### Pattern 2: Query-Based RLS Policies (Locked Decision)

**What:** RLS policies check the user's role by querying `user_profiles` at policy evaluation time, not from the JWT.

**When to use:** All tables where admin-only write access is required.

**Performance technique:** Wrap the role lookup in a `SELECT` subquery so Postgres caches the result once per query instead of re-evaluating for every row. The documented improvement is from 178,000ms to 12ms in Supabase's own benchmarks.

```sql
-- Source: https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv

-- Helper function: returns the current user's role, bypasses RLS (SECURITY DEFINER)
-- Wrapping in SELECT in policies causes Postgres to cache the result (initPlan optimization)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = ''
AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$;

-- user_profiles: anyone can read their own row
CREATE POLICY "Users can read own profile"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING ( (SELECT auth.uid()) = id );

-- user_profiles: only admins can read ALL profiles (needed for user management later)
CREATE POLICY "Admins can read all profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING ( (SELECT public.get_my_role()) = 'admin' );

-- user_profiles: users can update their own display_name only (NOT role)
CREATE POLICY "Users can update own display_name"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING ( (SELECT auth.uid()) = id )
  WITH CHECK (
    (SELECT auth.uid()) = id
    AND role = (SELECT role FROM public.user_profiles WHERE id = auth.uid())
  );

-- user_profiles: only admins can update role
CREATE POLICY "Only admins can change roles"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING ( (SELECT public.get_my_role()) = 'admin' );

-- app_settings: restrict writes to admin only
-- (READ is already authenticated-only via existing behavior)
CREATE POLICY "Only admins can write settings"
  ON public.app_settings
  FOR INSERT
  TO authenticated
  WITH CHECK ( (SELECT public.get_my_role()) = 'admin' );

CREATE POLICY "Only admins can update settings"
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING ( (SELECT public.get_my_role()) = 'admin' );
```

### Pattern 3: Admin Route Protection via layout.tsx

**What:** The `src/app/admin/layout.tsx` Server Component checks the user's role and redirects non-admins before rendering any admin page.

**Why not middleware:** Next.js middleware cannot reliably execute Supabase database queries — the Supabase client in middleware can return empty data even with valid auth. Middleware should remain lightweight (auth session refresh only). Role checks belong in Server Components where database access works correctly.

```typescript
// src/app/admin/layout.tsx
// Source: Pattern from https://github.com/orgs/supabase/discussions/29482

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Belt-and-suspenders: middleware handles unauthenticated redirect,
  // but check here too in case middleware is bypassed
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/')  // redirect agents back to the inbox
  }

  return <>{children}</>
}
```

### Pattern 4: getConfigs() Batch Refactor

**What:** Replace N individual `getConfig(key)` calls with one `getConfigs(...keys)` call that fetches all keys in a single Supabase query using `.in()`.

**When to use:** All API routes that call `getWhatsAppClient()` — which today makes 2 DB queries for KAPSO_API_KEY + WHATSAPP_API_URL, plus an additional query per extra `getConfig()` call in the same route handler. The most common pattern in existing routes is 3 DB queries (2 in `getWhatsAppClient()` + 1 for PHONE_NUMBER_ID).

```typescript
// src/lib/get-config.ts — modified version

import { createClient } from '@/lib/supabase/server'

export type ConfigKey = 'KAPSO_API_KEY' | 'WHATSAPP_API_URL' | 'PHONE_NUMBER_ID' | 'WABA_ID'

const ENV_FALLBACKS: Record<ConfigKey, string | undefined> = {
  KAPSO_API_KEY: process.env.KAPSO_API_KEY,
  WHATSAPP_API_URL: process.env.WHATSAPP_API_URL || 'https://api.kapso.ai/meta/whatsapp',
  PHONE_NUMBER_ID: process.env.PHONE_NUMBER_ID || '',
  WABA_ID: process.env.WABA_ID,
}

// EXISTING: keep for backward compatibility during migration
export async function getConfig(key: ConfigKey): Promise<string> {
  const configs = await getConfigs(key)
  return configs[key]
}

// NEW: batch fetch — single DB query for any number of keys
export async function getConfigs<K extends ConfigKey>(
  ...keys: K[]
): Promise<Record<K, string>> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', keys)   // single query for all requested keys

  // Build result map from DB rows
  const dbValues: Partial<Record<K, string>> = {}
  for (const row of data ?? []) {
    if (keys.includes(row.key as K)) {
      dbValues[row.key as K] = row.value
    }
  }

  // Apply env fallbacks for any missing keys
  const result = {} as Record<K, string>
  for (const key of keys) {
    const value = dbValues[key] ?? ENV_FALLBACKS[key]
    if (value === undefined) {
      throw new Error(`Config key "${key}" is not set in DB or environment`)
    }
    result[key] = value
  }

  return result
}
```

```typescript
// src/lib/whatsapp-client.ts — modified version

import { WhatsAppClient } from '@kapso/whatsapp-cloud-api'
import { getConfigs } from '@/lib/get-config'

export async function getWhatsAppClient(): Promise<WhatsAppClient> {
  const { KAPSO_API_KEY, WHATSAPP_API_URL } = await getConfigs(
    'KAPSO_API_KEY',
    'WHATSAPP_API_URL'
  )
  return new WhatsAppClient({
    baseUrl: WHATSAPP_API_URL,
    kapsoApiKey: KAPSO_API_KEY,
    graphVersion: 'v24.0'
  })
}

// NEW: factory that returns both client + phoneNumberId in one round-trip
export async function getWhatsAppClientWithPhone(): Promise<{
  client: WhatsAppClient
  phoneNumberId: string
}> {
  const { KAPSO_API_KEY, WHATSAPP_API_URL, PHONE_NUMBER_ID } = await getConfigs(
    'KAPSO_API_KEY',
    'WHATSAPP_API_URL',
    'PHONE_NUMBER_ID'
  )
  return {
    client: new WhatsAppClient({
      baseUrl: WHATSAPP_API_URL,
      kapsoApiKey: KAPSO_API_KEY,
      graphVersion: 'v24.0'
    }),
    phoneNumberId: PHONE_NUMBER_ID
  }
}
```

### Anti-Patterns to Avoid

- **Querying database in middleware for role checks:** Returns empty results. Use `layout.tsx` Server Component instead.
- **Role column in user-editable table with a plain UPDATE policy:** Users can self-promote. The `WITH CHECK` clause that enforces `role` cannot change is essential.
- **RLS enabled with zero policies:** Blocks ALL access. Always add a permissive SELECT policy first, verify access, then add restrictive policies.
- **Single getConfig() calls in parallel routes:** Now that getConfigs() exists, all routes calling getWhatsAppClient() + getConfig('PHONE_NUMBER_ID') should be updated to call getWhatsAppClientWithPhone() instead.
- **Testing RLS via SQL Editor:** The SQL Editor bypasses RLS (uses service_role). Always test via Table Editor or from the actual app.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Profile auto-creation on signup | Application code that runs on first login | PostgreSQL trigger on `auth.users` | Trigger is atomic with the INSERT — no race conditions, no gaps if user never loads a page after signup |
| Role checking in application code | `if/else` role checks scattered across routes | RLS policies on Supabase tables | RLS enforces at the DB level — application bugs cannot bypass it |
| Custom SQL query optimizer for RLS | Indexing auth.uid() lookups manually | `(SELECT auth.uid())` and `(SELECT get_my_role())` wrapped in SELECT | This is the Supabase-documented initPlan optimization; performance difference is 1000x+ |
| JWT role embedding | Custom token manipulation | Query-based via `user_profiles.role` | Locked decision — JWT claims are NOT used in this project |

---

## Common Pitfalls

### Pitfall 1: Trigger Fails, Blocks All Signups
**What goes wrong:** The trigger function is missing `SECURITY DEFINER SET search_path = ''`. The trigger cannot write to `public.user_profiles` from the auth schema context and throws a permission error. Every new user signup returns a 500 error.

**Why it happens:** The trigger runs in the context of the `auth` schema. Without SECURITY DEFINER, it cannot write to `public.*` tables.

**How to avoid:** Always include `SECURITY DEFINER SET search_path = ''` on trigger functions that write to `public.*`.

**Warning signs:** New user signup returns "Database error saving new user" or 500 status.

### Pitfall 2: Existing Users Have No user_profiles Row
**What goes wrong:** The trigger only fires for NEW users. The two existing team members have no `user_profiles` row. The admin layout check queries for their profile, gets `null`, and redirects them away from admin pages — including the settings page the admin needs to manage.

**How to avoid:** Before or immediately after creating the trigger, backfill existing users with a one-time INSERT:
```sql
INSERT INTO public.user_profiles (id, display_name, role)
SELECT
  id,
  COALESCE(raw_user_meta_data ->> 'full_name', email, ''),
  'agent'  -- default; manually UPDATE to 'admin' for the admin user afterward
FROM auth.users
ON CONFLICT (id) DO NOTHING;
```
Then promote the admin user:
```sql
UPDATE public.user_profiles
SET role = 'admin'
WHERE id = '<admin-user-uuid>';
```

### Pitfall 3: RLS Policy With CHECK Allows Role Change
**What goes wrong:** A permissive UPDATE policy (`USING auth.uid() = id`) without a `WITH CHECK` clause allows users to update their own `role` column to 'admin'. The app gains a privilege escalation vulnerability.

**How to avoid:** The UPDATE policy for self-edits must include a `WITH CHECK` that verifies `role` has not changed. Test this: log in as an agent, directly call `supabase.from('user_profiles').update({ role: 'admin' }).eq('id', user.id)` — it must return an RLS error.

### Pitfall 4: Admin Layout Has No admin/ Route Group Folder
**What goes wrong:** `src/app/admin/layout.tsx` is a Next.js layout, which means it wraps ALL pages under `src/app/admin/**`. If this file is missing, every `/admin/*` page is accessible to any authenticated user.

**How to avoid:** Create `src/app/admin/layout.tsx` in the same directory as the existing `src/app/admin/settings/`. Verify it wraps the settings page by testing on Vercel with an agent account.

### Pitfall 5: Forgetting to Backfill Before the Admin Can Self-Test
**What goes wrong:** The admin deploys the layout guard, navigates to `/admin/settings`, and gets redirected to `/` because their own profile row doesn't exist yet (or has role='agent').

**How to avoid:** Run the backfill INSERT and the admin role UPDATE in Supabase before pushing the layout guard code to GitHub. Order of operations matters.

### Pitfall 6: getConfig() Callers Not Updated
**What goes wrong:** `getConfigs()` is added to `get-config.ts` and `whatsapp-client.ts` is updated, but the individual API routes that call `getWhatsAppClient()` + `getConfig('PHONE_NUMBER_ID')` separately are not updated. They continue making 3 round-trips instead of the now-possible 1.

**How to avoid:** All 6 routes that call both `getWhatsAppClient()` and `getConfig('PHONE_NUMBER_ID')` or `getConfig('WABA_ID')` must be updated to use `getWhatsAppClientWithPhone()` or the equivalent batch pattern. Check: `conversations/route.ts`, `messages/[conversationId]/route.ts`, `messages/send/route.ts`, `messages/interactive/route.ts`, `media/[mediaId]/route.ts`, `templates/route.ts`, `templates/send/route.ts`.

---

## Code Examples

### Backfill Existing Users (Run Once in Supabase SQL Editor)
```sql
-- Step 1: Backfill existing users as agents
INSERT INTO public.user_profiles (id, display_name, role)
SELECT
  id,
  COALESCE(raw_user_meta_data ->> 'full_name', email, ''),
  'agent'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Step 2: Find admin user UUID
SELECT id, email FROM auth.users;

-- Step 3: Promote admin user (replace with actual UUID)
UPDATE public.user_profiles
SET role = 'admin'
WHERE id = '<paste-admin-uuid-here>';

-- Step 4: Verify
SELECT u.email, p.role FROM auth.users u
JOIN public.user_profiles p ON u.id = p.id;
```

### Test RLS Self-Promotion Prevention (Run in Table Editor with Agent Session)
```sql
-- This must FAIL with RLS error when run as an agent user
UPDATE public.user_profiles
SET role = 'admin'
WHERE id = auth.uid();
```

### Verify getConfigs() Produces One Query (Conceptual)
The existing pattern in `conversations/route.ts`:
```typescript
// BEFORE: 3 DB queries (2 in getWhatsAppClient + 1 explicit)
const whatsappClient = await getWhatsAppClient()   // queries: KAPSO_API_KEY, WHATSAPP_API_URL
const phoneNumberId = await getConfig('PHONE_NUMBER_ID')  // query: PHONE_NUMBER_ID
```

```typescript
// AFTER: 1 DB query
const { client, phoneNumberId } = await getWhatsAppClientWithPhone()
```

### Vercel Deployment Verification Sequence
Since all testing is on Vercel (no local testing), the verification order matters:
1. SQL changes in Supabase (trigger, table, backfill, role promotion)
2. Push TypeScript changes to GitHub → Vercel deploys
3. Test with admin account: `/admin/settings` loads correctly
4. Test with agent account: `/admin/settings` redirects to `/`
5. Test new user signup: profile row auto-creates with role='agent'

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `getConfig()` called N times per route | `getConfigs(...keys)` batch in one query | Reduces DB queries from 3-4 to 1 per API request |
| No role differentiation (all authenticated users equal) | `user_profiles.role` enforced by RLS | Agent users blocked from admin pages at DB and route level |
| No user_profiles table | `user_profiles` with trigger auto-create | Foundation for assignment, notes, analytics in later phases |

**No deprecated patterns** to remove in this phase — this is purely additive.

---

## Open Questions

1. **Which user is the admin?**
   - What we know: There are 2-3 existing team member accounts. We need to know which UUID belongs to the admin to run the UPDATE after backfill.
   - What's unclear: The specific UUID is not in any planning doc.
   - Recommendation: Plan task must include a step where the person running the SQL queries `SELECT id, email FROM auth.users` and identifies the admin email, then runs the UPDATE.

2. **Should `app_settings` have an explicit SELECT RLS policy?**
   - What we know: `app_settings` currently has no RLS enabled. The route handlers check `supabase.auth.getUser()` before reading settings.
   - What's unclear: Whether enabling RLS on `app_settings` could break the settings page or the getConfig() queries.
   - Recommendation: Enable RLS on `app_settings` with a permissive SELECT for all authenticated users (current behavior) + admin-only INSERT/UPDATE. This enforces the principle of least privilege without changing existing read behavior.

3. **Display name source for existing users?**
   - What we know: `raw_user_meta_data ->> 'full_name'` may be null for users who signed up with email/password only.
   - What's unclear: What metadata exists in the existing Supabase auth.users rows.
   - Recommendation: Use `COALESCE(raw_user_meta_data ->> 'full_name', email, '')` in the backfill — falls back to email which is always present.

---

## Sources

### Primary (HIGH confidence)
- [Supabase Managing User Data](https://supabase.com/docs/guides/auth/managing-user-data) — trigger and function SQL pattern
- [Supabase RLS Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — policy syntax, USING/WITH CHECK
- [Supabase RLS Performance Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — SELECT wrapping for initPlan optimization, security definer functions
- [Supabase Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks) — Custom Access Token Hook available on free tier (confirmed; NOT used — locked decision is query-based)
- [Supabase JavaScript .in() filter](https://supabase.com/docs/reference/javascript/in) — batch key lookup pattern
- Existing codebase: `src/lib/get-config.ts`, `src/lib/whatsapp-client.ts`, `src/middleware.ts`, `src/app/admin/settings/page.tsx` — verified directly

### Secondary (MEDIUM confidence)
- [Supabase Discussion #29482](https://github.com/orgs/supabase/discussions/29482) — confirmed middleware cannot reliably query Supabase tables for role checks; use layout.tsx Server Component instead
- [Supabase Discussion #6518](https://github.com/orgs/supabase/discussions/6518) — trigger failure blocks signups; SECURITY DEFINER fix confirmed
- [Supabase RBAC Custom Claims Docs](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) — security_definer function pattern for role lookups in RLS

### Tertiary (LOW confidence — not used, only referenced for comparison)
- Prior v2.0 STACK.md research — recommended JWT Custom Claims approach (overridden by locked decision in STATE.md)

---

## Metadata

**Confidence breakdown:**
- Trigger pattern: HIGH — exact SQL from official Supabase docs
- RLS policies: HIGH — official docs + performance optimization from official troubleshooting guide
- route guard via layout.tsx: HIGH — confirmed by community discussion that middleware fails, Server Component works
- getConfigs() batch refactor: HIGH — .in() filter verified, codebase fully analyzed
- Backfill and admin promotion sequence: HIGH — standard SQL, verified against actual table structure

**Research date:** 2026-02-21
**Valid until:** 2026-09-21 (Supabase SQL API is stable; unlikely to change in 6 months)
