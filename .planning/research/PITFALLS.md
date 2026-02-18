# Domain Pitfalls

**Domain:** WhatsApp Cloud Inbox — forked Next.js app with Supabase Auth + admin settings
**Project:** Maissi Beauty Shop WhatsApp Inbox
**Researched:** 2026-02-18

---

## Critical Pitfalls

Mistakes that cause rewrites, policy violations, or loss of access.

---

### Pitfall 1: Storing API Keys in Supabase Without Row-Level Encryption

**What goes wrong:** The admin settings UI stores `KAPSO_API_KEY`, `PHONE_NUMBER_ID`, and `WABA_ID` in a Supabase table. If that table is readable by authenticated users (or worse, the public) without server-side encryption, any team member (or anyone who intercepts a Supabase JWT) can extract the production API key.

**Why it happens:** The easiest Supabase pattern is to insert a row and read it back. Developers do exactly that — store plaintext credentials in a `settings` table with RLS set to "authenticated users can read." But RLS only restricts who can query the table through the Supabase client; the key value itself is still plaintext in Postgres.

**Consequences:**
- Exposed Kapso API key lets anyone send WhatsApp messages on behalf of the business
- WhatsApp Business Account suspension if the key is abused
- Meta's policies treat credential leakage as an account violation
- No audit trail of who read the key

**Prevention:**
- Never return the raw API key to the browser. Store it in Supabase, read it only in a Next.js API route (server-side), inject it into the Kapso request there
- The admin settings UI should write the key (POST to an API route), but never display it back in full — show only the last 4 characters as confirmation
- Use Supabase's `service_role` key (kept in Vercel env vars) for the API route that reads credentials; never expose `service_role` to the browser
- Optionally: encrypt at the application layer before storing (e.g., AES-256 using a `SETTINGS_ENCRYPTION_KEY` Vercel env var as the key), decrypt only in the API route

**Detection (warning signs):**
- Any browser network tab showing the full `KAPSO_API_KEY` value in a JSON response
- Supabase RLS policy on the settings table set to `SELECT` for `authenticated` role without server-side fetch
- `SUPABASE_SERVICE_ROLE_KEY` referenced in any client-side component or page prop

**Phase:** Must address in Phase — Supabase Integration / Admin Settings UI. Do not ship the settings form until the read path is server-only.

---

### Pitfall 2: Missing Middleware Auth Guard on All Routes

**What goes wrong:** Next.js App Router and Pages Router have different auth guard mechanisms. A Supabase auth session guards the login page, but individual API routes and page routes are left unprotected. A team member bookmarks `/conversations/123` directly and it loads without being logged in.

**Why it happens:** With Supabase Auth + Next.js, developers typically add a session check in a layout or per-page `useEffect`, but forget to protect the API routes (`/api/*`) and the webhook ingest route. Also, Next.js middleware runs on the Edge Runtime — if the Supabase client is not initialized correctly for Edge, the auth check silently fails.

**Consequences:**
- Unauthenticated access to conversation history (customer data leak)
- API routes that proxy Kapso calls are exposed without auth (anyone can send messages)
- GDPR/data privacy implications for a customer inbox — conversation content is PII

**Prevention:**
- Use Next.js `middleware.ts` at the project root to intercept ALL routes. Check Supabase session there. Redirect to `/login` if no valid session
- Whitelist only: `/login`, `/api/webhook` (WhatsApp webhook must be public), and static assets
- Test auth guard by opening an incognito tab and navigating directly to `/` — should redirect to `/login`
- Use `@supabase/ssr` package (not the legacy `@supabase/auth-helpers-nextjs`) — it handles cookies correctly in middleware and server components

**Detection (warning signs):**
- `middleware.ts` file does not exist at project root
- API routes (`/api/messages`, `/api/send`) do not call `supabase.auth.getUser()` before executing
- Kapso API routes read credentials from Supabase without verifying the caller's session

**Phase:** Must address in Phase — Supabase Auth Setup (before any conversation UI is deployed to production).

---

### Pitfall 3: Upstream Fork Divergence Locked In Too Early

**What goes wrong:** The team forks `gokapso/whatsapp-cloud-inbox`, immediately starts adding Supabase auth and settings UI across many files, then discovers the upstream has fixed a bug or added a critical feature (e.g., template message support, media handling). Merging upstream changes now conflicts with every modified file.

**Why it happens:** It's tempting to start building everywhere at once. Without a disciplined separation of "Maissi additions" from "Kapso core," every file becomes a conflict zone.

**Consequences:**
- Upstream bug fixes require manual cherry-picking — high error risk
- Security patches in the base inbox are missed
- Team spends days resolving merge conflicts instead of building features

**Prevention:**
- Maintain a thin wrapper strategy: do not edit Kapso's core messaging components at all. Add Supabase + auth + settings as new files alongside Kapso's existing structure
- Create a clear directory convention: `src/maissi/` for all custom additions, `src/kapso/` (or the original path) untouched
- Keep a `UPSTREAM_VERSION.md` file noting which commit of gokapso/whatsapp-cloud-inbox was forked
- Run `git remote add upstream https://github.com/gokapso/whatsapp-cloud-inbox` so upstream changes can be fetched
- Accept: if Kapso is actively maintained, plan a monthly upstream-merge check

**Detection (warning signs):**
- Modified files deep inside the original Kapso component tree (not just new files added)
- No record of the upstream fork commit SHA
- Supabase initialization code mixed into Kapso's original API route files

**Phase:** Must address before any code is written — establish file conventions in Phase 1 (Fork Setup).

---

### Pitfall 4: WhatsApp 24-Hour Messaging Window Violation

**What goes wrong:** The inbox allows staff to type and send a free-form message to a customer who last messaged more than 24 hours ago. The message is sent through Kapso, which may pass it to the WhatsApp Cloud API. The API silently rejects it (or returns an error code), and the UI shows it as "sent" with no delivery confirmation.

**Why it happens:** The 24-hour Customer Service Window is a core WhatsApp policy rule. Outside this window, you can only send pre-approved Template Messages. A naive inbox UI doesn't distinguish between "in-window" and "out-of-window" contacts, so staff write messages that never deliver.

**Consequences:**
- Messages not delivered, no notification to staff → customers think they are being ignored
- Staff frustration and loss of trust in the tool
- Repeated violations (if Kapso re-attempts) can contribute to phone number quality score degradation

**Prevention:**
- Track the `last_customer_message_at` timestamp for each conversation (store in Supabase or read from Kapso's conversation metadata)
- In the message composer UI, display a visible warning banner when the window has expired: "This contact messaged more than 24 hours ago. You can only send a template message."
- Disable the free-text send button and show only a "Send Template" option for out-of-window conversations
- Verify whether Kapso's API already handles this distinction or surfaces the error code — if it does, catch and translate the error into a user-readable message

**Detection (warning signs):**
- No `last_message_at` or `window_expires_at` field in conversation state
- Send button is always enabled regardless of conversation recency
- Staff reporting "messages not delivered" to old contacts

**Phase:** Must address during Phase — Inbox UI / Conversation View. Flag as requiring testing with a real WhatsApp number.

---

## Moderate Pitfalls

Mistakes that cause delays or technical debt.

---

### Pitfall 5: Credentials Pulled from Both Supabase and .env — Silent Fallback

**What goes wrong:** The original Kapso app reads `PHONE_NUMBER_ID`, `KAPSO_API_KEY`, and `WABA_ID` from `.env` (process.env). After adding the admin settings UI, the new code reads these from Supabase. But the old `.env` values are still present in Vercel environment variables. Now there are two sources of truth — and bugs appear when Supabase is updated but the old `.env` value takes precedence (or vice versa).

**Why it happens:** Incremental migration: new code reads from Supabase, old Kapso code still reads from `process.env`, nobody removes the old env vars from Vercel.

**Consequences:**
- Admin updates credentials in the UI, but messages still go out using the old env var value
- Debugging is confusing — the settings UI shows the new value, but behavior reflects the old value
- If both sources exist, unclear which has priority

**Prevention:**
- Define a single credential resolver: one server-side utility `getKapsoCredentials()` that reads from Supabase first, falls back to env var only if Supabase returns null (for local dev without a DB connection)
- Remove `PHONE_NUMBER_ID`, `KAPSO_API_KEY`, and `WABA_ID` from Vercel environment variables once Supabase is the source of truth
- Document this in a `CREDENTIALS.md` or code comment so future developers know where credentials come from

**Detection (warning signs):**
- Both Supabase `settings` table and Vercel env vars contain the same key names
- API routes reference `process.env.KAPSO_API_KEY` directly (instead of via the resolver utility)

**Phase:** Address in Phase — Admin Settings UI + Credential Migration.

---

### Pitfall 6: Webhook Endpoint Not Verified or Accidentally Auth-Guarded

**What goes wrong:** WhatsApp delivers incoming messages to a webhook endpoint (e.g., `/api/webhook`). This endpoint must:
1. Be publicly accessible (no auth)
2. Respond to the Meta webhook verification GET request (with a hub.challenge token)
3. Process POST payloads fast enough to return 200 within Meta's timeout

If the Next.js middleware auth guard is applied too broadly, it catches `/api/webhook` and redirects it to `/login` — breaking all incoming message delivery.

**Why it happens:** Middleware configured with `matcher: ['/(.*)']` matches everything. Developers forget to whitelist the webhook path. Or the webhook was working during local dev (where middleware was not deployed) but breaks in production on Vercel.

**Consequences:**
- All incoming WhatsApp messages stop being received
- Meta's webhook delivery system marks the endpoint as failing and may temporarily stop sending events
- Real-time inbox stops working; staff see no new messages

**Prevention:**
- In `middleware.ts`, explicitly exclude `/api/webhook` from auth checks:
  ```typescript
  export const config = {
    matcher: ['/((?!api/webhook|_next/static|_next/image|favicon.ico|login).*)'],
  };
  ```
- Test webhook locally using `ngrok` before deploying — verify the verification handshake and a test incoming message
- Verify the webhook responds with 200 within 20 seconds (Meta's documented timeout); for Vercel, this means no heavy processing in the route handler — enqueue heavy work, return 200 immediately

**Detection (warning signs):**
- Middleware `matcher` config uses `['/(.*)'`] without exclusions
- No explicit test of the webhook GET verification flow
- Incoming messages not appearing after deploying auth middleware

**Phase:** Address in Phase — Auth Setup (when adding middleware). Test in Phase — Deployment.

---

### Pitfall 7: Supabase Free Tier Connection Pool Exhaustion

**What goes wrong:** Next.js on Vercel uses serverless functions. Each function invocation opens a Postgres connection. With Supabase's free tier, the connection limit is low (typically ~60 direct connections). Under moderate load (multiple staff with the inbox open, polling for updates), the app hits connection limits and starts throwing 500 errors.

**Why it happens:** Supabase's JavaScript client uses a connection per request in serverless environments. Unlike a long-running server, serverless functions don't share connection pools.

**Consequences:**
- Intermittent 500 errors during busy periods
- Settings reads fail, staff cannot send messages

**Prevention:**
- Use Supabase's connection pooler (Transaction mode via PgBouncer) — the connection string looks like `postgresql://...pooler.supabase.com:6543/postgres?pgbouncer=true`. Use this URL for all API routes, not the direct connection string
- The Supabase JS client abstracts this — use it instead of raw `pg` or `drizzle` for most operations
- For a 2-3 person team, connection exhaustion is unlikely but configure pooling from day one to avoid hitting it later

**Detection (warning signs):**
- Using direct Postgres connection strings (`db.supabase.co:5432`) in API routes instead of the pooler (`db.supabase.co:6543`)
- `PGERROR: remaining connection slots are reserved for non-replication superuser connections`

**Phase:** Address in Phase — Supabase Setup / Infrastructure.

---

### Pitfall 8: Real-Time Message Updates Without a Strategy

**What goes wrong:** The inbox needs to show new incoming messages without the staff manually refreshing. The Kapso base project may use polling, WebSockets, or nothing. Adding Supabase Realtime or client-side polling on top of an existing mechanism creates duplicate events or conflicts.

**Why it happens:** The forked app's existing mechanism (if any) is not immediately obvious. Developers add Supabase Realtime subscriptions, which conflict with the existing Kapso polling loop, causing messages to appear twice or in wrong order.

**Consequences:**
- Duplicate messages in the inbox
- UI state inconsistencies
- Race conditions when multiple staff have the inbox open

**Prevention:**
- Before adding any real-time layer, read the Kapso base code to understand how it currently fetches messages (polling interval, WebSocket, or manual refresh)
- Choose one strategy and stick to it: either Kapso's polling mechanism OR Supabase Realtime for a local store — not both
- For a 2-3 person team, simple client-side polling every 3-5 seconds is reliable and simpler than Supabase Realtime

**Detection (warning signs):**
- Messages appearing twice in the conversation thread
- Multiple simultaneous API calls to the same Kapso endpoint visible in browser network tab

**Phase:** Investigate in Phase 1 (Fork Setup) — read source code to understand existing polling before adding anything.

---

### Pitfall 9: Vercel Cold Start Delays Affecting Webhook Processing

**What goes wrong:** Vercel serverless functions have cold start latency (typically 300ms–1.5s on the free tier). If the webhook handler is slow to respond (beyond Meta's timeout), Meta marks it as failed and stops delivering events.

**Why it happens:** Webhook handlers that do heavy work synchronously (reading from Supabase, processing media, writing to DB) before returning 200 can exceed the timeout.

**Consequences:**
- Missed incoming messages
- Meta's webhook system enters a backoff state

**Prevention:**
- The webhook handler must return 200 immediately. Pattern:
  ```typescript
  export async function POST(req: Request) {
    const body = await req.json();
    // Enqueue background processing — do NOT await it
    processWebhookEventAsync(body); // fire and forget
    return new Response('OK', { status: 200 });
  }
  ```
- For this small scale (2-3 users), fire-and-forget to a Supabase insert is acceptable; avoid complex async chains in the hot path
- Consider Vercel's Edge Functions for the webhook route (no cold start) if latency becomes an issue — but test that `@supabase/ssr` works in the Edge Runtime first

**Detection (warning signs):**
- Webhook handler awaits a Supabase write before returning
- Meta webhook delivery logs show timeouts or 503 responses
- Vercel function logs show execution time >5 seconds

**Phase:** Address in Phase — Webhook Integration.

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable.

---

### Pitfall 10: Supabase Session Not Refreshed — Users Randomly Logged Out

**What goes wrong:** Supabase Auth tokens expire (default: 1 hour access token, 1 week refresh token). If the Next.js app does not refresh the session on the server side, staff get silently logged out mid-shift and see a blank screen or 401 error.

**Why it happens:** The old `@supabase/auth-helpers-nextjs` handled session refresh in a specific way. The newer `@supabase/ssr` package requires explicit setup of cookie-based session handling in middleware. If not done correctly, the server-rendered pages see an expired token while the client-side session is still valid (or vice versa).

**Prevention:**
- Follow the `@supabase/ssr` middleware pattern exactly: create a Supabase client in middleware, call `supabase.auth.getUser()` (which also refreshes the token), and update the cookies in the response
- Test by waiting 1 hour with the app open and verifying no logout occurs

**Phase:** Address in Phase — Auth Setup.

---

### Pitfall 11: Branding Applied to Kapso Base That Breaks Upstream Updates

**What goes wrong:** To add Maissi branding (name, logo), developers edit the `Layout` or `Header` component inside the Kapso core directory. When upstream changes the same file, a merge conflict occurs.

**Prevention:**
- Create a `MaissiHeader.tsx` that wraps Kapso's header. Import and use the wrapper at the top level. Do not modify Kapso's original header file
- Store the Maissi logo in `/public/maissi-logo.png` — new file, no conflict

**Phase:** Address in Phase 1 (Fork Setup) — establish the wrapping convention before writing any branded component.

---

### Pitfall 12: Kapso API Rate Limits Not Surfaced to Staff

**What goes wrong:** If the Kapso API enforces rate limits (requests per minute, messages per day), staff hitting the limit see generic error messages or no feedback at all. They assume the app is broken and stop using it.

**Prevention:**
- Intercept Kapso API error responses (HTTP 429 or error codes) in the API route proxy layer
- Map Kapso error codes to human-readable UI messages: "Slow down — too many messages sent recently. Try again in 30 seconds."
- Log all Kapso API errors to the console (and optionally a Supabase `error_logs` table) for debugging

**Detection:** Confirm Kapso's error response format by reading their API documentation before building the error handler.

**Phase:** Address in Phase — Messaging / Send Flow.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Fork Setup | Upstream divergence locked in early (Pitfall 3) | Establish file conventions and upstream remote before writing any code |
| Fork Setup | Real-time conflict with existing Kapso mechanism (Pitfall 8) | Read source code first; document existing polling strategy |
| Supabase Setup | Connection pool exhaustion on free tier (Pitfall 7) | Use connection pooler URL from day one |
| Auth Implementation | Missing auth guard on API routes (Pitfall 2) | Middleware whitelist reviewed before deploying |
| Auth Implementation | Session not refreshed, random logouts (Pitfall 10) | Use `@supabase/ssr` middleware pattern |
| Webhook Integration | Auth middleware blocking webhook (Pitfall 6) | Whitelist `/api/webhook` in middleware matcher |
| Webhook Integration | Cold start causing Meta timeout (Pitfall 9) | Fire-and-forget pattern, 200 returned immediately |
| Admin Settings UI | API key readable in browser (Pitfall 1) | Server-only credential reads; no full key in API response |
| Admin Settings UI | Dual credential sources (.env + Supabase) (Pitfall 5) | Single `getKapsoCredentials()` resolver utility |
| Inbox / Conversation UI | 24-hour window not enforced (Pitfall 4) | Window state in UI, template-only for expired contacts |
| Inbox / Conversation UI | Kapso errors not surfaced to staff (Pitfall 12) | Map API error codes to user-readable messages |
| Branding | Branding edits in Kapso core files (Pitfall 11) | Use wrapping components; never edit upstream files |

---

## Confidence Assessment

| Pitfall Area | Confidence | Basis |
|--------------|------------|-------|
| Supabase Auth session handling | HIGH | Well-documented in Supabase official docs; `@supabase/ssr` middleware pattern is the current standard |
| Next.js middleware auth guard | HIGH | Standard Next.js pattern; middleware config is documented |
| API key storage security | HIGH | General security principle; Supabase RLS behavior is well understood |
| WhatsApp 24-hour window | HIGH | Core WhatsApp Business Platform policy — has been stable for years |
| Webhook auth guard conflict | HIGH | Next.js middleware matcher behavior is deterministic |
| Vercel cold start / webhook timeout | MEDIUM | Meta's exact timeout is documented as 20s; cold start behavior is Vercel-specific and varies |
| Supabase connection pool limits | MEDIUM | Free tier limits change; pool behavior with serverless is well understood but exact numbers shift |
| Upstream fork divergence | MEDIUM | gokapso/whatsapp-cloud-inbox is open source; update frequency and maintenance status not verified |
| Kapso API rate limits | LOW | Kapso's rate limit specifics are not publicly documented in training data — verify against their docs |
| Real-time polling conflict | LOW | Depends on Kapso base code which has not been read — investigate in Phase 1 |

---

## Sources

- Supabase Auth / SSR documentation (supabase.com/docs/guides/auth/server-side) — HIGH confidence for Pitfalls 1, 2, 5, 7, 10
- Next.js Middleware documentation (nextjs.org/docs/app/building-your-application/routing/middleware) — HIGH confidence for Pitfalls 2, 6
- WhatsApp Business Platform — Messaging Windows policy (developers.facebook.com/docs/whatsapp/conversation-types) — HIGH confidence for Pitfall 4
- Meta Webhooks documentation — timeout and verification behavior — MEDIUM confidence for Pitfalls 6, 9
- gokapso/whatsapp-cloud-inbox GitHub README — not fetched (network unavailable during research); LOW confidence for Pitfalls 3, 8, 12
- Training data knowledge for general Vercel + Next.js serverless patterns — MEDIUM confidence for Pitfall 9

**Note:** WebSearch and WebFetch were unavailable during this research session. Pitfalls rated LOW confidence (particularly Kapso-specific behavior) should be verified by reading the forked source code directly in Phase 1.
