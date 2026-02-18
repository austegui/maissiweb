# Phase 1: Fork Setup - Research

**Researched:** 2026-02-18
**Domain:** Git forking, Next.js 15 App Router auditing, environment variable mapping
**Confidence:** HIGH

## Summary

Phase 1 is a repository setup and audit phase, not a feature-building phase. The goal is to clone gokapso/whatsapp-cloud-inbox, get it running locally, map every file that reads the three critical environment variables, confirm the router type, identify the webhook endpoint (or absence of one), and configure the upstream git remote.

Research directly inspected the live gokapso/whatsapp-cloud-inbox repository on GitHub. All key architectural questions are now answered with HIGH confidence from primary sources: the repo uses Next.js 15.5.9 with the App Router, runs on port 4000 via Turbopack, uses auto-polling (not webhooks) for real-time updates, and concentrates all environment variable reads in one lib file plus one API route.

**Primary recommendation:** The audit in plan 01-02 is straightforward — only six route files and one lib file exist. All three env variables are accounted for. The "webhook path" success criterion must be interpreted as "confirm the app does NOT have a webhook endpoint" and document the polling architecture instead.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.5.9 | Full-stack React framework | Project's own framework — no choice |
| React | 19.1.0 | UI rendering | Bundled with the project |
| TypeScript | 5.9.3 | Type safety | Project already configured |
| @kapso/whatsapp-cloud-api | ^0.1.0 (latest: 0.1.1) | WhatsApp Cloud API TypeScript client | Project's own SDK dependency |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tailwindcss | ^4 | Utility CSS | Styling — already installed |
| @radix-ui/* | various | Accessible UI primitives | Component building — already installed |
| date-fns | ^4.1.0 | Date formatting | Message timestamps |
| zod | (via @kapso package) | Runtime validation | SDK uses it internally |

### Dev tooling

| Tool | Purpose |
|------|---------|
| Turbopack | Dev bundler (`next dev --turbopack`) |
| ESLint 9 | Linting |
| `npm run dev` on port 4000 | Local dev server |

### Alternatives Considered

Not applicable — this phase uses the existing project stack exactly as-is. No new libraries are added in Phase 1.

**Installation:**

```bash
git clone https://github.com/gokapso/whatsapp-cloud-inbox.git .
npm install
cp .env.example .env.local
# fill in PHONE_NUMBER_ID, KAPSO_API_KEY, WABA_ID
npm run dev
# app runs at http://localhost:4000
```

## Architecture Patterns

### Confirmed Project Structure

```
src/
├── app/                     # Next.js App Router root
│   ├── layout.tsx           # Root layout (minimal, no providers)
│   ├── page.tsx             # Main inbox UI page
│   ├── globals.css          # Global styles
│   └── api/                 # API route handlers
│       ├── conversations/
│       │   └── route.ts     # GET conversations list
│       ├── messages/
│       │   ├── [conversationId]/
│       │   │   └── route.ts # GET messages for a conversation
│       │   ├── send/
│       │   │   └── route.ts # POST send text/media message
│       │   └── interactive/
│       │       └── route.ts # POST send interactive button message
│       ├── templates/
│       │   ├── route.ts     # GET list templates
│       │   └── send/
│       │       └── route.ts # POST send template message
│       └── media/
│           └── [mediaId]/
│               └── route.ts # GET fetch/proxy media file
├── components/              # React UI components
├── hooks/
│   └── use-auto-polling.ts  # Auto-polling hook for real-time updates
├── lib/
│   ├── whatsapp-client.ts   # WhatsApp client init + env var reads
│   ├── template-parser.ts   # Template parameter parsing
│   └── utils.ts             # Utility helpers
└── types/                   # TypeScript type definitions
```

### Router Type: App Router (CONFIRMED)

The project uses Next.js App Router (introduced in Next.js 13, the standard as of Next.js 15). Evidence:
- `/src/app/` directory exists (not `/src/pages/`)
- `layout.tsx` at `src/app/layout.tsx` follows App Router conventions
- API routes use `src/app/api/*/route.ts` file naming (App Router pattern, not `pages/api/*.ts`)

**This resolves the Phase 1 unresolved question.** All subsequent phases can use App Router patterns: Server Components, `route.ts` for API routes, and `use client` directives as needed.

### Pattern: Environment Variables Centralized in whatsapp-client.ts

All three critical env vars are read in `src/lib/whatsapp-client.ts`. Route files import the already-initialized `whatsappClient` and the exported `PHONE_NUMBER_ID` constant — they do not call `process.env` themselves (except `src/app/api/templates/route.ts` for `WABA_ID`).

### Pattern: Auto-Polling, Not Webhooks

The project uses `src/hooks/use-auto-polling.ts` to periodically fetch new data from the API routes. There is no webhook endpoint in the codebase. The app does not receive push notifications from Meta/WhatsApp — it polls its own API routes, which in turn call the Kapso proxy API.

**Implication for Phase 1 success criterion:** "The webhook endpoint path is confirmed and documented" — the answer is "there is no webhook endpoint." The app is fully outbound/polling-based. Document this explicitly.

### Anti-Patterns to Avoid

- **Do not look for a `/api/webhook` route** — it does not exist. The app has no inbound webhook receiver.
- **Do not expect `pages/api/` directory** — project is App Router only.
- **Do not read env vars in multiple route files** — the project correctly centralizes this in `lib/whatsapp-client.ts`. Phase 4 env var replacements should target that file first.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Env var reading | Custom config loader | `process.env` in `lib/whatsapp-client.ts` | Already implemented; touching this risks breaking the SDK init |
| Git upstream tracking | Manual tracking | `git remote add upstream` + `git fetch upstream` | Standard git workflow, no tooling needed |
| Dependency audit | Manual grep | IDE search / grep for `process.env` | The codebase is small; direct inspection is sufficient |

**Key insight:** Phase 1 is a zero-new-code phase. Nothing should be built. The only actions are git operations, npm install, and file reading/documenting.

## Common Pitfalls

### Pitfall 1: Assuming a Webhook Endpoint Exists

**What goes wrong:** Planner creates audit task expecting to find `/api/webhook` or similar. Developer searches and can't find it, creates confusion about whether the audit is complete.

**Why it happens:** WhatsApp integrations typically use webhooks. The project description mentions "webhook endpoint path" as something to discover.

**How to avoid:** Research confirms the app is polling-based. The success criterion "webhook endpoint path is confirmed and documented" should be interpreted as: document that there is NO webhook, and explain the polling architecture used instead.

**Warning signs:** If someone claims to find a webhook endpoint in this repo, they are wrong.

---

### Pitfall 2: Missing the Port Configuration

**What goes wrong:** Developer runs `npm run dev` without checking the port and assumes `localhost:3000`, then can't open the app.

**Why it happens:** Next.js defaults to port 3000, but this project overrides to 4000.

**How to avoid:** The `package.json` dev script is `next dev --turbopack -p 4000`. App runs at `http://localhost:4000`.

**Warning signs:** "Connection refused" at localhost:3000.

---

### Pitfall 3: Committing .env.local Credentials

**What goes wrong:** Developer creates `.env.local` with real Kapso credentials, accidentally stages and commits it.

**Why it happens:** `.env.local` may not be in `.gitignore` if the repo was cloned without checking.

**How to avoid:** Verify `.gitignore` includes `.env.local` before adding credentials. Next.js convention is to gitignore `.env*.local` files by default — but verify for this specific repo.

---

### Pitfall 4: Forking vs Cloning (Upstream Remote Setup)

**What goes wrong:** Developer clones directly from gokapso/whatsapp-cloud-inbox instead of forking first, making it impossible to push to their own remote or configure upstream correctly.

**Why it happens:** "Clone the repo" is ambiguous — it could mean clone or fork.

**How to avoid:**
1. Fork `gokapso/whatsapp-cloud-inbox` to the project's own GitHub account/org first
2. Clone the fork (not the original)
3. Add original as `upstream`: `git remote add upstream https://github.com/gokapso/whatsapp-cloud-inbox.git`
4. Verify with `git remote -v`

If the project already has a local copy that was cloned from a personal repo (as suggested by the existing git history), then only step 3 and 4 are needed.

---

### Pitfall 5: WABA_ID Not in whatsapp-client.ts

**What goes wrong:** Auditor assumes all env vars are centralized in `lib/whatsapp-client.ts` and misses `WABA_ID` in `src/app/api/templates/route.ts`.

**Why it happens:** `PHONE_NUMBER_ID` and `KAPSO_API_KEY` are indeed in `whatsapp-client.ts`, but `WABA_ID` is read directly in the templates route.

**How to avoid:** Audit must grep for each env var independently, not assume the `whatsapp-client.ts` pattern covers all three.

## Code Examples

Verified patterns from direct repo inspection:

### Environment Variable Reads (src/lib/whatsapp-client.ts)

```typescript
// Source: https://raw.githubusercontent.com/gokapso/whatsapp-cloud-inbox/main/src/lib/whatsapp-client.ts
// (inspected 2026-02-18)

export const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || '';

function getWhatsAppClient() {
  const kapsoApiKey = process.env.KAPSO_API_KEY;
  // throws if KAPSO_API_KEY missing
  const baseUrl = process.env.WHATSAPP_API_URL || 'https://api.kapso.ai/meta/whatsapp';
  // ... returns new WhatsAppClient({ kapsoApiKey, baseUrl })
}
```

### WABA_ID Read (src/app/api/templates/route.ts)

```typescript
// Source: https://raw.githubusercontent.com/gokapso/whatsapp-cloud-inbox/main/src/app/api/templates/route.ts
// (inspected 2026-02-18)

const wabaId = process.env.WABA_ID;
if (!wabaId) {
  return Response.json({ error: 'WABA_ID not configured' }, { status: 500 });
}
```

### Git Upstream Remote Setup

```bash
# After cloning your fork
git remote add upstream https://github.com/gokapso/whatsapp-cloud-inbox.git
git fetch upstream

# Verify
git remote -v
# origin    https://github.com/YOUR_ORG/your-fork.git (fetch)
# origin    https://github.com/YOUR_ORG/your-fork.git (push)
# upstream  https://github.com/gokapso/whatsapp-cloud-inbox.git (fetch)
# upstream  https://github.com/gokapso/whatsapp-cloud-inbox.git (push)
```

### Local .env.local Setup

```bash
cp .env.example .env.local
# Edit .env.local with real values:
# PHONE_NUMBER_ID=<from app.kapso.ai>
# KAPSO_API_KEY=<from app.kapso.ai>
# WABA_ID=<from app.kapso.ai>
# WHATSAPP_API_URL= (leave blank to use default https://api.kapso.ai/meta/whatsapp)
```

## Complete process.env Audit Map

Based on direct inspection of all source files (HIGH confidence):

| File | Variable | Line context | How used |
|------|----------|-------------|----------|
| `src/lib/whatsapp-client.ts` | `PHONE_NUMBER_ID` | `export const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID \|\| ''` | Exported constant, used as phoneNumberId param |
| `src/lib/whatsapp-client.ts` | `KAPSO_API_KEY` | `const kapsoApiKey = process.env.KAPSO_API_KEY` | Required; throws if missing; passed to SDK constructor |
| `src/lib/whatsapp-client.ts` | `WHATSAPP_API_URL` | `process.env.WHATSAPP_API_URL \|\| 'https://api.kapso.ai/meta/whatsapp'` | Optional; SDK base URL override |
| `src/app/api/templates/route.ts` | `WABA_ID` | `const wabaId = process.env.WABA_ID` | Required; returns 500 if missing |

Route files that use `PHONE_NUMBER_ID` do so via import from `@/lib/whatsapp-client` — they do not call `process.env` directly:
- `src/app/api/conversations/route.ts` — imports `{ PHONE_NUMBER_ID, whatsappClient }`
- `src/app/api/messages/[conversationId]/route.ts` — imports `{ PHONE_NUMBER_ID, whatsappClient }`
- `src/app/api/messages/send/route.ts` — imports `{ PHONE_NUMBER_ID, whatsappClient }`
- `src/app/api/messages/interactive/route.ts` — imports `{ PHONE_NUMBER_ID, whatsappClient }`
- `src/app/api/templates/send/route.ts` — imports `{ PHONE_NUMBER_ID, whatsappClient }`
- `src/app/api/media/[mediaId]/route.ts` — imports `{ PHONE_NUMBER_ID, whatsappClient }`

**Note:** Exact line numbers require local clone — this audit gives file-level accuracy. Plan 01-02 should confirm line numbers after cloning.

## State of the Art

| Area | Status |
|------|--------|
| Next.js Router | App Router (Next.js 13+) — project uses 15.5.9, the current stable version |
| React | React 19.1.0 — current stable |
| TypeScript | 5.9.3 — current stable |
| Bundler | Turbopack (replaces Webpack for dev) — enabled via `--turbopack` flag |
| Styling | Tailwind v4 — current (v4 changed config format from v3) |

**Deprecated/outdated:**
- Pages Router: Not used. Do not look for `pages/` directory.
- Webpack dev bundler: Replaced by Turbopack in this project's dev script.

## Open Questions

1. **Exact line numbers for process.env reads**
   - What we know: File-level location confirmed (see audit map above)
   - What's unclear: Exact line numbers — requires local clone to verify
   - Recommendation: Plan 01-02 includes a grep step after clone to confirm line numbers

2. **Whether .gitignore in the repo covers .env.local**
   - What we know: Next.js generates `.gitignore` that covers `.env*.local` by default
   - What's unclear: Whether gokapso customized this
   - Recommendation: Plan 01-01 should verify `.gitignore` contents before adding credentials

3. **Whether the project is cloned fresh or already exists locally**
   - What we know: The kapsoweb working directory has a git history (e86d8cf etc.) suggesting it's already initialized as a separate project
   - What's unclear: Whether Phase 1 involves cloning into this directory or a separate one
   - Recommendation: Phase 1 plans should clarify the target directory for the clone. If kapsoweb IS the fork, then FORK-01 is already partially done (init exists) and the git remote setup in FORK-03 is the primary remaining action.

## Sources

### Primary (HIGH confidence)

- `https://github.com/gokapso/whatsapp-cloud-inbox` — repo structure, tech stack, file listing
- `https://raw.githubusercontent.com/gokapso/whatsapp-cloud-inbox/main/package.json` — exact versions, scripts, dependencies
- `https://raw.githubusercontent.com/gokapso/whatsapp-cloud-inbox/main/.env.example` — environment variable names
- `https://raw.githubusercontent.com/gokapso/whatsapp-cloud-inbox/main/src/lib/whatsapp-client.ts` — env var read patterns
- `https://raw.githubusercontent.com/gokapso/whatsapp-cloud-inbox/main/src/app/api/templates/route.ts` — WABA_ID usage
- `https://raw.githubusercontent.com/gokapso/whatsapp-cloud-inbox/main/src/app/layout.tsx` — App Router confirmation
- `https://raw.githubusercontent.com/gokapso/whatsapp-cloud-inbox/main/next.config.ts` — no middleware/rewrites
- All six API route files inspected directly (confirmed env var import pattern)

### Secondary (MEDIUM confidence)

- `https://registry.npmjs.org/@kapso/whatsapp-cloud-api` — package version 0.1.1, Node.js >=20.19 requirement
- Next.js official docs (via WebSearch) — `.env.local` convention, App Router env var behavior

### Tertiary (LOW confidence)

- None — all key findings verified with primary sources

## Metadata

**Confidence breakdown:**
- Router type (App Router): HIGH — directly confirmed from repo file structure and layout.tsx
- Env variable map: HIGH — directly read from source files; line numbers need local clone to finalize
- Webhook absence: HIGH — code search returned 0 results; hooks folder contains only use-auto-polling.ts
- Port (4000): HIGH — directly from package.json dev script
- Git upstream pattern: HIGH — standard git workflow, well-documented
- @kapso/whatsapp-cloud-api package: HIGH — npm registry confirmed version 0.1.1

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (stable project; upstream repo unlikely to change significantly in 30 days)
