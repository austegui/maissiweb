# Technology Stack

**Project:** Maissi Beauty Shop — WhatsApp Cloud Inbox
**Researched:** 2026-02-18
**Scope:** What to add ON TOP of the Kapso base (Next.js/TypeScript) for auth, settings, and database integration.

---

## Context

The Kapso whatsapp-cloud-inbox base already provides:
- Next.js (version to verify at fork time — see note below)
- TypeScript
- CSS (plain)
- Kapso WhatsApp Cloud API integration

This STACK.md covers only the **additions required** for Maissi's fork. Do not replace or duplicate what the base already provides.

**Critical pre-work:** When forking, check the base repo's `package.json` for the exact Next.js version. If it uses the Pages Router, the Supabase middleware setup differs from App Router. Plan accordingly.

---

## Recommended Stack

### Authentication

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `@supabase/supabase-js` | ^2.x (verify current at install) | Supabase JS client — database queries, auth methods | Official client, required for everything Supabase | HIGH |
| `@supabase/ssr` | ^0.x (verify current at install) | Server-side rendering support for Supabase Auth in Next.js | Replaces the deprecated `@supabase/auth-helpers-nextjs`. Official Supabase recommendation for Next.js App Router. Handles cookie-based sessions, middleware, server components. | HIGH |

**Why `@supabase/ssr` and not `@supabase/auth-helpers-nextjs`:**
The `@supabase/auth-helpers-nextjs` package is deprecated. Supabase officially migrated to `@supabase/ssr` for all Next.js (App Router) and similar SSR frameworks. Using the old package means no future updates and broken cookie handling. `@supabase/ssr` provides `createServerClient`, `createBrowserClient`, and middleware helpers.

**Auth approach:** Email + password via Supabase Auth. No OAuth needed for a 2-3 person team. Magic links are an option (easier for staff) — decide at implementation time.

---

### Database

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Supabase Postgres (hosted) | N/A (managed) | Store Kapso API credentials, user records | Free tier includes 500MB Postgres. Row-level security for protecting settings. Already decided in project constraints. | HIGH |

**Schema needed (minimal):**

```sql
-- Table: app_config
-- Stores Kapso API credentials (one row for this single-tenant app)
-- phone_number_id, kapso_api_key, waba_id, whatsapp_api_url (optional)
-- Access restricted to authenticated users via RLS
```

Row-Level Security (RLS) must be enabled. Without it, any authenticated user can read any row. With a 2-3 person team sharing equal access, a simple policy `(auth.role() = 'authenticated')` suffices.

---

### Admin Settings UI

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| shadcn/ui | N/A (copies components, not versioned) | UI components for settings form | Copies components into your repo — no dependency lock-in, fully customizable. Works with Tailwind. Best fit for a small settings UI without building from scratch. | MEDIUM |
| Tailwind CSS | ^3.x | Utility CSS for settings UI components | shadcn/ui requires Tailwind. Kapso base uses plain CSS — Tailwind is additive (scoped to settings UI pages), won't conflict if configured correctly. | MEDIUM |

**Alternative:** Build the settings form with plain HTML/CSS + native form elements to stay consistent with the Kapso base's plain CSS approach. This avoids adding Tailwind. However, shadcn/ui produces a more polished settings UI with much less custom work.

**Recommendation:** Use shadcn/ui + Tailwind **scoped to the admin/settings route only.** The main inbox UI from Kapso stays untouched. This is the pragmatic call — building a styled settings form from scratch in plain CSS is higher effort for lower quality.

**Caveat:** If the Kapso base includes global CSS resets that conflict with Tailwind's preflight, you'll need to disable Tailwind's preflight. Flag this for implementation research.

---

### Form Handling (Settings UI)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| React Hook Form | ^7.x | Settings form state, validation | Industry standard for React forms. Low re-render overhead. Native integration with shadcn/ui form components via `FormProvider`. For a small settings form, this is more reliable than uncontrolled forms. | HIGH |
| Zod | ^3.x | Schema validation for settings form inputs | Pairs with React Hook Form via `@hookform/resolvers`. Validates API key format, required fields. TypeScript-first. Standard in the Next.js ecosystem. | HIGH |

**Alternative for simplicity:** Server Actions with native form validation. For a settings form with 3-4 fields, a Server Action + minimal validation is sufficient without React Hook Form. This is a valid "less is more" choice. Decide at implementation time based on team familiarity.

---

### Server Actions vs API Routes (for settings persistence)

**Recommendation:** Use Next.js Server Actions for the settings save/load operations (not a separate API route).

**Why:** Server Actions eliminate the need for a separate `/api/settings` route handler. The settings form can submit directly to a server action that calls the Supabase client and returns a result. Simpler, fewer files, native to Next.js App Router. The Kapso base likely already uses API routes for WhatsApp operations — don't add more API routes if Server Actions serve the need.

**Confidence:** HIGH for App Router projects. MEDIUM if Kapso base turns out to use Pages Router (Server Actions are App Router only).

---

### Middleware (Auth Protection)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Next.js Middleware (`middleware.ts`) | Built-in | Protect routes — redirect unauthenticated users to login | Standard Next.js pattern. `@supabase/ssr` provides the `createServerClient` helper for use in middleware. No additional library needed. | HIGH |

**Pattern:** A single `middleware.ts` at the project root intercepts requests, refreshes the Supabase session cookie, and redirects to `/login` if no session exists. The Kapso WhatsApp inbox routes are protected; the `/login` route is public.

---

### Infrastructure

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Vercel | N/A (platform) | Hosting and deployment | Already decided in project constraints. Free tier supports the team size. Next.js has first-class Vercel support (no config needed). | HIGH |
| Supabase | N/A (platform) | Auth + Postgres | Already decided. Free tier (500MB DB, 50,000 MAU auth). More than sufficient for 2-3 users. | HIGH |

**Environment variables for Vercel:**
- `NEXT_PUBLIC_SUPABASE_URL` — public, safe to expose
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public anon key, safe to expose
- Kapso credentials (`PHONE_NUMBER_ID`, `KAPSO_API_KEY`, `WABA_ID`) — only needed as fallback; primary storage moves to Supabase DB

---

## What NOT to Use

| Category | Rejected Option | Why Not |
|----------|----------------|---------|
| Auth | NextAuth.js / Auth.js | Adds another dependency when Supabase Auth already ships with the project's database. More config for no gain with a small team. |
| Auth | Clerk | Paid at scale, external vendor, overkill for 2-3 users. Supabase Auth is sufficient and already on-stack. |
| Auth | `@supabase/auth-helpers-nextjs` | Deprecated. Use `@supabase/ssr` instead. |
| UI | Material UI, Ant Design, Chakra | Heavy libraries for a small settings form. shadcn/ui (copy-paste) is lighter. |
| UI | Custom design system | Overengineered for a 2-3 page settings UI. |
| Database | PlanetScale, Neon, Railway | Unnecessary — Supabase Postgres is already the platform choice. |
| ORM | Prisma, Drizzle | Overkill for 1-2 tables. Direct Supabase client (`supabase.from('app_config')`) is simpler and sufficient. |
| Forms | Formik | React Hook Form has better performance and TypeScript support. Formik is largely superseded. |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Recommended Wins |
|----------|-------------|-------------|----------------------|
| Auth library | `@supabase/ssr` | `@supabase/auth-helpers-nextjs` | `auth-helpers-nextjs` is deprecated; `@supabase/ssr` is the current official approach |
| UI components | shadcn/ui + Tailwind | Plain CSS form | shadcn/ui produces better UI quality with less work; Tailwind can be scoped |
| Settings persistence | Server Actions | API Route handlers | Server Actions are simpler (no separate endpoint, no fetch call, colocated logic) |
| Form validation | React Hook Form + Zod | Native HTML5 validation | RHF + Zod gives TypeScript types and better error UX with minimal boilerplate |

---

## Installation

```bash
# Core Supabase packages
npm install @supabase/supabase-js @supabase/ssr

# Form handling
npm install react-hook-form zod @hookform/resolvers

# UI (shadcn/ui is initialized via CLI, then components are added individually)
npx shadcn@latest init
npx shadcn@latest add button input label card form

# Tailwind (if not already present in Kapso base)
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

**Note on shadcn/ui versions:** `shadcn@latest` always installs the current version. Verify the exact version at install time with `npm view shadcn version`. As of early 2026, shadcn/ui uses Radix UI primitives and Tailwind CSS 3.x.

**Note on Kapso base compatibility:** After forking, run `npm install` with the existing `package.json` first, then add the above. Check for Tailwind or PostCSS conflicts with the base before proceeding.

---

## Confidence Assessment

| Decision | Confidence | Basis |
|----------|------------|-------|
| `@supabase/ssr` for Next.js auth | HIGH | Official Supabase migration path, documented deprecation of auth-helpers |
| `@supabase/supabase-js` v2 | HIGH | Stable major version for 2+ years, well documented |
| React Hook Form + Zod | HIGH | Ecosystem standard, TypeScript-first, widely used with Next.js |
| shadcn/ui + Tailwind for settings UI | MEDIUM | Assumes Tailwind doesn't conflict with Kapso's CSS — verify at fork time |
| Server Actions for settings persistence | MEDIUM | Correct if Kapso base is App Router; needs verification post-fork |
| Supabase free tier capacity | HIGH | 2-3 users is far below the 50,000 MAU limit |
| Tailwind not conflicting with base CSS | LOW | Needs verification at fork time; global CSS resets may conflict |

---

## Sources

- Supabase Next.js SSR documentation: https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase `@supabase/ssr` package: https://github.com/supabase/supabase-js (see packages/ssr)
- shadcn/ui official docs: https://ui.shadcn.com/docs
- React Hook Form official docs: https://react-hook-form.com/
- Zod official docs: https://zod.dev/
- Next.js middleware docs: https://nextjs.org/docs/app/building-your-application/routing/middleware
- Kapso base repo: https://github.com/gokapso/whatsapp-cloud-inbox

**Note:** WebSearch and WebFetch were not available during this research session. Context7 MCP tools were also unavailable. Findings above are based on well-established library knowledge as of January 2025, applied conservatively. Confidence levels reflect this. Verify current versions at install time using `npm view [package] version`.
