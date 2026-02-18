# Phase 2: Authentication - Research

**Researched:** 2026-02-18
**Domain:** Supabase Auth + Next.js 15 App Router SSR middleware
**Confidence:** HIGH

---

## Summary

Phase 2 adds Supabase email/password authentication to the Kapso inbox. The standard approach for Next.js 15 App Router is Supabase's `@supabase/ssr` package, which handles cookie-based session management across Server Components, Server Actions, and middleware. The package was purpose-built to replace the now-deprecated `@supabase/auth-helpers-nextjs` and is the only officially supported path for SSR session handling.

The pattern requires three files beyond the login page itself: a browser client utility (`src/lib/supabase/client.ts`), a server client utility (`src/lib/supabase/server.ts`), and middleware (`src/middleware.ts`) that refreshes the auth token on every request. Session persistence across browser refreshes is automatic when the middleware pattern is implemented correctly — Supabase stores JWTs in HTTP-only cookies.

Key constraint: Next.js 15.5.9 is already installed (verified from package.json). This is well above the patched version for CVE-2025-29927 (15.2.3), so the middleware bypass vulnerability is not a concern for this project.

**Primary recommendation:** Use `@supabase/ssr` with `createServerClient` in middleware and server utilities, `createBrowserClient` in client components, and a Server Action for the sign-in form. Protect all routes by default in middleware using a matcher that covers everything except static assets and `/login`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | latest | Supabase JS client | Required base client |
| `@supabase/ssr` | latest | SSR-safe cookie session handling | Only official SSR solution; replaces deprecated auth-helpers |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `next/headers` (built-in) | — | `cookies()` for server-side cookie access | In server.ts utility |
| `next/server` (built-in) | — | `NextRequest`/`NextResponse` in middleware | In middleware.ts |
| `next/navigation` (built-in) | — | `redirect()` in Server Actions and server components | After sign-in, sign-out, auth check failure |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@supabase/ssr` | `@supabase/auth-helpers-nextjs` | auth-helpers is deprecated; all bug fixes and new features are SSR-only |
| Supabase Auth | NextAuth.js / Auth.js | NextAuth requires additional configuration; Supabase is already chosen as the backend |
| Server Action for login | Client-side fetch | Server Actions are simpler, avoid CORS, run on server — recommended by Next.js docs |

**Installation:**
```bash
npm install @supabase/supabase-js @supabase/ssr
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── middleware.ts              # NEW: runs on all requests, refreshes session
├── lib/
│   ├── supabase/
│   │   ├── client.ts          # NEW: browser client (Client Components only)
│   │   └── server.ts          # NEW: server client (Server Components, Actions, Route Handlers)
│   ├── whatsapp-client.ts     # EXISTING: unchanged
│   └── utils.ts               # EXISTING: unchanged
└── app/
    ├── login/
    │   ├── page.tsx           # NEW: login form (Client Component with 'use client')
    │   └── actions.ts         # NEW: signIn/signOut Server Actions
    ├── auth/
    │   └── callback/
    │       └── route.ts       # NEW: only needed if using OAuth/magic links (skip for email-only)
    ├── layout.tsx             # EXISTING: no change needed
    ├── page.tsx               # EXISTING: no change needed (protected by middleware)
    └── api/                   # EXISTING: all protected by middleware automatically
```

### Pattern 1: Middleware Session Refresh

**What:** The `src/middleware.ts` file runs on every matched request. It creates a Supabase client with cookie handlers that read from `request.cookies` and write to both the request and the response. It then calls `supabase.auth.getUser()` to refresh the JWT if it's expired, and writes the updated session cookie to the response.

**When to use:** Always — this is the mandatory foundation for SSR auth. Without it, sessions expire and aren't refreshed, causing users to be logged out.

**Why `getUser()` not `getSession()`:** `getUser()` makes a network call to validate the token with Supabase Auth servers. `getSession()` only reads the local cookie without revalidating — it can return a stale/invalid session. Use `getUser()` for any server-side security check.

**Example (verified pattern from official sources):**

```typescript
// src/lib/supabase/middleware.ts
// Source: Supabase SSR docs + ryankatayi.com cross-verified
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: always getUser() not getSession() in server code
  const { data: { user } } = await supabase.auth.getUser()

  // Route protection: redirect unauthenticated users
  const isLoginPage = request.nextUrl.pathname === '/login'

  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return response
}
```

```typescript
// src/middleware.ts
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**Design decision for this project:** The `updateSession` function is placed in `src/lib/supabase/middleware.ts` and imported into `src/middleware.ts`. This keeps middleware.ts thin and the cookie logic testable.

### Pattern 2: Server Client Utility

**What:** A server-side Supabase client using `cookies()` from `next/headers`. Used in Server Components, Server Actions, and Route Handlers. Note `await cookies()` — this is the Next.js 15 async cookies API.

```typescript
// src/lib/supabase/server.ts
// Source: Supabase SSR docs (verified)
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — middleware handles refresh
            // This error is expected and safe to ignore
          }
        },
      },
    }
  )
}
```

### Pattern 3: Browser Client Utility

**What:** A browser-side Supabase client for Client Components. Uses `createBrowserClient` which handles localStorage/cookies automatically in the browser.

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### Pattern 4: Login Page with Server Action

**What:** The login page is a Server Component that renders a form. The form uses a Server Action for submission — no client-side JavaScript or fetch needed for the auth logic. An error state can be surfaced via `useActionState` if needed.

```typescript
// src/app/login/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email')),
    password: String(formData.get('password')),
  })

  if (error) {
    // Return error to client — do not throw (would show unhandled error page)
    return { error: error.message }
  }

  redirect('/')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

```typescript
// src/app/login/page.tsx
// Server Component — no 'use client' needed unless showing inline errors
import { login } from './actions'

export default function LoginPage() {
  return (
    <div>
      <h1>Sign in to Maissi Inbox</h1>
      <form action={login}>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required />
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required />
        <button type="submit">Sign in</button>
      </form>
    </div>
  )
}
```

**If inline error display is needed:** Convert to `'use client'` and use `useActionState` hook to capture the returned error message from the action.

### Pattern 5: Sign Out Button

**What:** A client component that calls the logout Server Action. The `logout` action calls `supabase.auth.signOut()` and then `redirect('/login')`.

```typescript
// Inline in any component
'use client'
import { logout } from '@/app/login/actions'

export function LogoutButton() {
  return <form action={logout}><button type="submit">Sign out</button></form>
}
```

### Anti-Patterns to Avoid

- **Using `getSession()` in server code:** Does not validate the token against Supabase servers. Always use `getUser()` for security checks.
- **Protecting routes only in layout.tsx:** Layouts don't re-render on every navigation due to partial rendering. Use middleware for consistent protection.
- **Forgetting to update both request AND response cookies in middleware:** If only the response cookies are updated, the middleware's subsequent reads within the same request will see the old session.
- **Using `@supabase/auth-helpers-nextjs`:** This package is deprecated. All bug fixes are SSR-only.
- **Using `cookies()` synchronously in Next.js 15:** `cookies()` is now async in Next.js 15. Always `await cookies()`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session management | Custom JWT decode/encrypt | `@supabase/ssr` | Token refresh, expiry, rotation — all handled automatically |
| Password hashing | `bcrypt` in a Route Handler | Supabase Auth service | Supabase handles hashing, salting, PBKDF2/bcrypt in their auth service |
| Cookie-based session storage | Manual `Set-Cookie` headers | `@supabase/ssr` cookie adapter | Handles `httpOnly`, `SameSite`, `Secure` flags correctly |
| Token refresh on expiry | Polling or refresh logic | Middleware calling `getUser()` | The middleware triggers refresh automatically on each request |
| CSRF protection | Custom token | Server Actions built-in | Next.js Server Actions include CSRF protection by default |

**Key insight:** Supabase Auth is a managed service — the complex parts (password hashing, JWT signing, refresh token rotation, email verification) are all handled server-side at Supabase. The client library only needs to call the service and store the resulting session cookie.

---

## Common Pitfalls

### Pitfall 1: cookies() Synchronous Call in Next.js 15

**What goes wrong:** `cookies()` becomes an async function in Next.js 15. Calling it synchronously (`cookies().get(...)`) fails silently or throws a build error.

**Why it happens:** Next.js 15 made several async APIs (`headers()`, `cookies()`, `params`, `searchParams`) async to prepare for future partial prerendering. Code from Next.js 14 tutorials uses the old synchronous form.

**How to avoid:** Always `await cookies()` before using the result. The server.ts pattern above handles this correctly.

**Warning signs:** TypeScript error "Property 'getAll' does not exist on type 'Promise<ReadonlyRequestCookies>'" or runtime errors in server components.

### Pitfall 2: getSession() vs getUser() Security Gap

**What goes wrong:** Using `supabase.auth.getSession()` in middleware or server components to check auth. An attacker can send a crafted cookie that passes `getSession()` but would fail `getUser()`.

**Why it happens:** `getSession()` reads and decodes the cookie locally without revalidating with Supabase. `getUser()` sends the token to Supabase Auth servers for validation.

**How to avoid:** In all server-side code (middleware, Server Components, Server Actions, Route Handlers), always use `supabase.auth.getUser()`. `getSession()` is only appropriate for client-side code where you want a non-blocking read.

**Warning signs:** Routes appear protected but can be bypassed by replaying expired or crafted session cookies.

### Pitfall 3: CVE-2025-29927 Middleware Bypass — Already Patched

**What goes wrong:** In Next.js versions before 15.2.3, an attacker could bypass all middleware auth checks by sending the `x-middleware-subrequest` header set to a specific value.

**Why it matters for planning:** This vulnerability was widely publicized in March 2025 and many tutorials mention adding data access layer (DAL) checks as defense-in-depth.

**Status for this project:** Next.js 15.5.9 is already installed. This version is well above the patched 15.2.3. The vulnerability does not apply.

**How to avoid in future:** Always run `npm audit` after installing dependencies. Keep Next.js updated.

### Pitfall 4: Missing Middleware Matcher — Running on All Static Assets

**What goes wrong:** Without a `matcher` config in middleware, Next.js runs middleware on every single request including `_next/static` (JS bundles), `_next/image`, and all static files. This creates network calls to Supabase for every font, image, and JS file — severely impacting performance.

**Why it happens:** Default middleware matcher is `'/'` — matches everything.

**How to avoid:** Always include the standard Supabase-recommended matcher that excludes static assets.

**Warning signs:** Vercel logs show thousands of Supabase auth API calls. Page load times increase dramatically.

### Pitfall 5: Protecting /login Creates Infinite Redirect Loop

**What goes wrong:** Middleware redirects unauthenticated users to `/login`. If `/login` is also protected (or the matcher isn't excluding it from redirect logic), the redirect hits `/login` again → infinite redirect loop.

**Why it happens:** The middleware redirect logic doesn't check if the current path is already `/login` before redirecting.

**How to avoid:** The `updateSession` function must check `request.nextUrl.pathname === '/login'` and skip the redirect if already on the login page. See Pattern 1 above — this is already handled in the provided example.

**Warning signs:** Browser shows "too many redirects" error. Vercel logs show `/login` → `/login` → `/login` chains.

### Pitfall 6: API Routes Need Protection Too

**What goes wrong:** Middleware protects page routes (returning HTML) but the API routes under `/api/*` can still be called directly without authentication from a REST client or browser fetch.

**Why it happens:** The matcher includes `/api/*` but the middleware only redirects (returns HTML redirect). An API caller ignoring 302 redirects gets `<html>` redirect response, not 401.

**Status for this project:** For this app, the middleware redirect is acceptable because:
1. All API callers are the same-origin browser that will follow the redirect
2. The main risk (unauthenticated inbox reading) is blocked

**Better practice (optional):** In middleware, detect if request is API route and return 401 JSON instead of redirect. This is a quality-of-life improvement, not a security gap for this use case.

### Pitfall 7: Supabase API Key Naming Transition

**What goes wrong:** Supabase is transitioning from `NEXT_PUBLIC_SUPABASE_ANON_KEY` (old JWT format) to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (new `sb_publishable_...` format). Current Supabase docs show the new env var name but many tutorials still use the old one.

**Status:** Both old anon keys and new publishable keys work interchangeably through at least late 2026. New Supabase projects created after November 2025 may not have the legacy anon key available.

**How to avoid:** When creating the Supabase project, check which key format is available. If the project shows `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the dashboard, use that. If it shows an anon key (starting with `eyJ...`), use `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Both work with `@supabase/ssr`.

**Recommendation:** Use whatever the Supabase dashboard shows for the new project. Document the env var name chosen in the plan.

---

## Code Examples

Verified patterns from official and cross-verified sources:

### Complete middleware.ts (thin wrapper)

```typescript
// src/middleware.ts
// Source: Supabase SSR docs
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### updateSession with redirect logic

```typescript
// src/lib/supabase/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() revalidates with Supabase servers — never use getSession() here
  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // Redirect unauthenticated users to /login (except when already on /login)
  if (!user && path !== '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from /login back to inbox
  if (user && path === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

### Server client (server.ts)

```typescript
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()  // await required in Next.js 15

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Safe to ignore in Server Components — middleware handles refresh
          }
        },
      },
    }
  )
}
```

### Browser client (client.ts)

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### Login Server Action

```typescript
// src/app/login/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email')),
    password: String(formData.get('password')),
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

### Login Page

```typescript
// src/app/login/page.tsx
// This can be a Server Component — the form uses a Server Action
import { login } from './actions'

export default function LoginPage() {
  return (
    <main>
      <h1>Sign in</h1>
      <form action={login}>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required />
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required />
        <button type="submit">Sign in</button>
      </form>
    </main>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2023 (SSR package), deprecated 2024 | All new code must use `@supabase/ssr` |
| `get/set/remove` cookie methods | `getAll/setAll` cookie methods | `@supabase/ssr` v0.4+ | Old single-cookie methods removed; batch operations only |
| `cookies()` synchronous | `await cookies()` | Next.js 15 | Server client must use `async` factory function |
| `supabase.auth.getSession()` for server security | `supabase.auth.getUser()` | Always the correct practice, now explicitly documented | Security gap if using getSession() on server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` (JWT format) | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_...`) | November 2025 | Old keys still work through late 2026; use whichever the dashboard shows |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: Deprecated, no new features, no bug fixes. Do not use.
- `createMiddlewareClient` from auth-helpers: Replaced by `createServerClient` from `@supabase/ssr` in middleware context.
- `cookies().get(name)` / `cookies().set(name, value)` in `@supabase/ssr` v0.4+: Single-cookie methods removed. Use `getAll()` / `setAll()` batch pattern only.

---

## Supabase Project Setup (Plan 02-01 concerns)

### What needs to be created in Supabase dashboard

1. **New Supabase project** — free tier works for this use case
2. **Email/Password auth enabled** — enabled by default, no configuration needed
3. **app_settings table** — needed by Phase 3 (Admin Settings), not Phase 2. Creating it in 02-01 is correct per the roadmap plan to front-load the Supabase setup.
4. **RLS on app_settings** — needed by Phase 3
5. **User accounts** — created after auth is working (Phase 6)

### Required environment variables

```bash
# Vercel + local .env.local
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...  # OR NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Note: No service role key needed for Phase 2. The anon key + RLS covers all Phase 2 auth operations.

### app_settings table schema (for 02-01, used in Phase 3)

```sql
CREATE TABLE app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can read settings
CREATE POLICY "Authenticated users can read settings"
  ON app_settings FOR SELECT
  TO authenticated
  USING (true);

-- Only authenticated users can update settings
CREATE POLICY "Authenticated users can update settings"
  ON app_settings FOR UPDATE
  TO authenticated
  USING (true);

-- Only authenticated users can insert settings
CREATE POLICY "Authenticated users can insert settings"
  ON app_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);
```

---

## Open Questions

1. **Exact Supabase env var name for new projects**
   - What we know: Supabase projects created after November 2025 use `sb_publishable_...` format keys. Projects before that use JWT `eyJ...` format anon keys.
   - What's unclear: The exact env var name shown in the Supabase dashboard for a new project created in February 2026.
   - Recommendation: Check the dashboard when creating the Supabase project. The client code uses `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY` OR `process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — pick one and be consistent. Both are interchangeable with `@supabase/ssr`.

2. **Login page error display approach**
   - What we know: Server Actions can return error objects. The form can be a Server or Client Component.
   - What's unclear: Whether user wants inline error display (requires `'use client'` + `useActionState`) or redirect-with-error-param (simpler but less polished).
   - Recommendation: Start with Server Component + search param for error (`/login?error=invalid_credentials`). Can be upgraded to `useActionState` in Phase 5 Branding if UX polish is needed.

3. **Supabase free tier limits relevant to this project**
   - What we know: Supabase free tier has 500MB DB, 50MB file storage, 2GB bandwidth, unlimited auth users.
   - What's unclear: Whether 2-3 team members with WhatsApp polling will hit any rate limits.
   - Recommendation: Free tier is sufficient for this use case. Polling is client-to-Kapso, not client-to-Supabase.

---

## Sources

### Primary (HIGH confidence)

- Supabase SSR official docs: https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase creating SSR client: https://supabase.com/docs/guides/auth/server-side/creating-a-client
- Supabase API keys guide: https://supabase.com/docs/guides/api/api-keys
- Supabase key migration discussion: https://github.com/orgs/supabase/discussions/29260
- Next.js official auth guide: https://nextjs.org/docs/app/guides/authentication
- Next.js version in project: package.json (15.5.9)

### Secondary (MEDIUM confidence)

- ryankatayi.com server-side auth setup — code cross-verified with official Supabase patterns
- Supabase migration guide from auth-helpers: https://supabase.com/docs/guides/auth/server-side/migrating-to-ssr-from-auth-helpers

### Tertiary (LOW confidence)

- CVE-2025-29927 details from WebSearch — confirmed fixed in 15.2.3, project uses 15.5.9 (no action needed)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `@supabase/ssr` is the only officially supported path, confirmed from official docs
- Architecture: HIGH — patterns verified against official Supabase SSR docs and cross-checked with working examples
- Pitfalls: HIGH — `await cookies()` requirement verified from Next.js 15 docs; `getUser() vs getSession()` verified from official Supabase security guidance; CVE-2025-29927 confirmed patched in installed version
- API key naming: MEDIUM — transition in progress, exact dashboard behavior for new projects created Feb 2026 not verifiable without creating one

**Research date:** 2026-02-18
**Valid until:** 2026-04-18 (60 days — `@supabase/ssr` is stable; Next.js 15 cookies API unlikely to change)
