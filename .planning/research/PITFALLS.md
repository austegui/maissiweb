# Domain Pitfalls

**Domain:** Adding commercial-grade features to an existing WhatsApp Cloud Inbox
**Project:** Maissi Beauty Shop WhatsApp Inbox (v2.0)
**Researched:** 2026-02-21
**Context:** Existing Next.js 15.5 App Router on Vercel Hobby plan, Supabase free tier, polling-based data fetching, 2-3 agent team

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or broken production systems.

---

### Pitfall 1: SSE on Vercel Hobby Plan -- The 300-Second Ceiling

**What goes wrong:** You implement Server-Sent Events (SSE) for real-time updates using a standard Next.js API route. It works in development, but in production on Vercel, the connection dies after 300 seconds (5 minutes) with Fluid Compute enabled (the current default). Without Fluid Compute, it dies after just 10 seconds.

**Why it happens:** Vercel Functions have hard duration limits. With Fluid Compute (enabled by default since late 2025), the Hobby plan allows a maximum of 300 seconds per function invocation. This is a hard wall -- you cannot configure it higher. The function is terminated regardless of whether data is still being streamed. Many SSE tutorials assume a long-lived server process, not a serverless function with a time bomb.

**Consequences:**
- Every SSE client disconnects every 5 minutes maximum
- If you rely on SSE for critical features (handoff alerts, new message notifications), those features have gaps
- Reconnection storms when all clients reconnect simultaneously at the 5-minute mark
- You pay for idle function time while SSE connections sit open doing nothing (4 CPU-hours/month Hobby limit)

**Prevention:**
- Design SSE as "short-lived polling upgrade," not "persistent connection." Set `maxDuration` to 55 seconds in the route, have the client reconnect with `EventSource` retry (which is built-in behavior). This is the correct pattern for serverless SSE:
  ```typescript
  // app/api/events/route.ts
  export const maxDuration = 55; // 55s, reconnect before 60s
  ```
- Implement `Last-Event-ID` header support so reconnecting clients don't miss events
- Seriously consider whether SSE provides enough benefit over your existing 5-second polling. For 2-3 agents, polling is simpler and avoids all these issues. SSE saves bandwidth but adds complexity
- If you do SSE: use Supabase Realtime (200 concurrent connections on free tier, 100 messages/second) as the event source. The SSE route subscribes to Supabase Realtime and forwards to the browser. This avoids polling Kapso API from the SSE function

**Detection (warning signs):**
- SSE route has no `maxDuration` export
- Client-side `EventSource` has no reconnection logic or `Last-Event-ID` support
- Function duration metrics show functions running for 300s then dying

**Confidence:** HIGH -- Verified from [Vercel Functions Duration Docs](https://vercel.com/docs/functions/configuring-functions/duration). Hobby plan: 300s max with Fluid Compute (default), 60s max without.

**Phase:** Real-time/SSE implementation phase. Must decide SSE vs enhanced polling BEFORE implementing.

---

### Pitfall 2: RBAC on Supabase -- Modifying auth.users or Using Public Role Column

**What goes wrong:** You add a `role` column to a public `profiles` table (or worse, try to modify `auth.users` directly) and use RLS policies that check this column. Users can update their own profile rows, which means they can escalate their own role to `admin`.

**Why it happens:** Three common RBAC anti-patterns in Supabase:

1. **Modifying `auth.users` role from `authenticated` to `admin`**: This breaks all default RLS policies, which expect the role to be `authenticated` or `anon`. Supabase's built-in system uses PostgreSQL roles, not application-level roles.

2. **Adding role to a user-editable table**: If your `profiles` table has `UPDATE` RLS allowing users to edit their own row, and you add a `role` column to that table, users can set themselves to admin.

3. **Storing role only in JWT without database backing**: After login, the JWT has the role. If you revoke someone's admin access by updating the database, their existing JWT still has admin privileges until it expires (up to 1 hour).

**Consequences:**
- Privilege escalation: any authenticated user becomes admin
- Or: revoked admin still has access for up to an hour
- Settings page (API keys, WABA config) exposed to non-admin agents

**Prevention:**
- Use Supabase's recommended Custom Access Token Auth Hook pattern:
  1. Create a `user_roles` table with RLS that only admins can modify (users cannot update their own role)
  2. Create a `role_permissions` table mapping roles to permissions
  3. Create a Custom Access Token Hook (Postgres function) that adds role claims to the JWT at token generation time
  4. Create an `authorize()` function that checks JWT claims against `role_permissions`
  5. Use this function in all RLS policies
- For the existing system (which already has Supabase Auth working), the migration path is:
  1. Create the new tables (`user_roles`, `role_permissions`)
  2. Insert existing users as `agent` role
  3. Promote one user to `admin` via direct SQL
  4. Deploy the auth hook
  5. Force all users to re-login (to get new JWT with role claim)
- Never put the role column in a table where users have `UPDATE` access to their own row

**Detection (warning signs):**
- RLS policy on settings table checks `auth.uid()` but not role
- `profiles` table has both a `role` column and an `UPDATE` policy for `auth.uid() = id`
- No separate `user_roles` table exists
- Admin features work without re-login after role assignment

**Confidence:** HIGH -- Verified from [Supabase RBAC Docs](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) and [community discussion](https://github.com/orgs/supabase/discussions/346).

**Phase:** User management / RBAC phase. Must be implemented before any admin-only features are deployed.

---

### Pitfall 3: Supabase Free Tier Connection and Table Overload

**What goes wrong:** You add 8-10 new tables for v2.0 features (canned_responses, internal_notes, conversation_status, user_roles, role_permissions, contact_profiles, labels, analytics_events, etc.). Each API route creates a new Supabase client that opens a connection. With 2-3 agents polling every 5 seconds, plus the new feature queries, you start hitting connection limits. The app throws intermittent 500 errors during busy periods.

**Why it happens:** Supabase free tier has real constraints that compound:
- Direct connections: ~20 concurrent
- Pooled connections (via Supavisor): ~200 concurrent
- Database size: 500 MB
- No read replicas
- Projects paused after 1 week of inactivity

The existing app already makes 2 Supabase calls per polling cycle (getUser + getConfig). Adding internal notes, canned responses, conversation status, etc. could easily double or triple the query load per request.

**Consequences:**
- `PGERROR: remaining connection slots are reserved` errors
- App becomes unreliable during business hours when all agents are active
- If analytics writes are synchronous, every message view becomes slow
- Database pausing after a quiet weekend (Supabase free tier pauses after 1 week inactivity)

**Prevention:**
- Use Supabase JS client (which uses the REST API / PostgREST, not direct Postgres connections) for all queries. The current codebase already does this correctly -- DO NOT switch to a direct Postgres driver (Drizzle, Prisma) without upgrading the Supabase plan
- Batch related queries: when loading a conversation view, fetch conversation status + internal notes + contact profile in a single RPC function instead of 3 separate queries
- Create a Supabase RPC function for complex reads:
  ```sql
  CREATE FUNCTION get_conversation_context(conv_id text)
  RETURNS json AS $$
    SELECT json_build_object(
      'notes', (SELECT json_agg(n) FROM internal_notes n WHERE n.conversation_id = conv_id),
      'status', (SELECT status FROM conversation_status WHERE conversation_id = conv_id),
      'labels', (SELECT json_agg(l.name) FROM labels l JOIN conversation_labels cl ON l.id = cl.label_id WHERE cl.conversation_id = conv_id)
    );
  $$ LANGUAGE sql SECURITY DEFINER;
  ```
- Keep analytics writes fire-and-forget (don't await the insert before responding)
- Set up a Vercel Cron job to ping the app daily to prevent free tier pausing

**Detection (warning signs):**
- More than 3 Supabase queries per API route handler
- Analytics events inserted synchronously in the request path
- Using `pg` or `postgres` npm packages instead of `@supabase/supabase-js`
- Supabase dashboard showing connection count near limits

**Confidence:** HIGH -- Connection limits verified from [Supabase connection management docs](https://supabase.com/docs/guides/database/connection-management) and [pricing page](https://supabase.com/pricing). Free tier: 500MB database, 200 realtime connections.

**Phase:** Every phase that adds new tables. Must plan schema holistically before creating tables incrementally.

---

### Pitfall 4: getConfig() Called on Every Request -- Multiplied by New Features

**What goes wrong:** The existing `getConfig()` function queries Supabase on every call with no caching. Currently it is called 1-2 times per API request. When you add canned responses, internal notes, conversation status, and other features, each new API route also calls `getConfig()` for credentials. Now every single API request makes 3-5 database queries just for configuration, before doing any actual work.

**Why it happens:** The v1.0 design decision (documented in STATE.md: "getConfig() queries DB on every call -- no module-level cache (Vercel serverless)") was correct for serverless but creates a multiplication problem as features grow. Each new API route that needs the Kapso client calls `getWhatsAppClient()` which calls `getConfig()` for each credential key.

**Consequences:**
- 3-5 extra Supabase queries per API request just for config
- Increased latency on every request (each query adds ~50-100ms)
- Faster approach toward connection pool exhaustion
- Higher Supabase usage on free tier

**Prevention:**
- Create a `getConfigs()` (plural) function that fetches ALL config keys in a single query:
  ```typescript
  export async function getConfigs(...keys: ConfigKey[]): Promise<Record<ConfigKey, string>> {
    const supabase = await createClient();
    const { data } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', keys);
    // ... map to record, fall back to env vars for missing keys
  }
  ```
- Refactor `getWhatsAppClient()` to call `getConfigs('KAPSO_API_KEY', 'WHATSAPP_API_URL', 'PHONE_NUMBER_ID', 'WABA_ID')` once instead of 4 individual calls
- For new features that don't need Kapso credentials (canned responses, internal notes), don't call `getConfig()` at all -- they only need the Supabase client which is already created

**Detection (warning signs):**
- Multiple `await getConfig('...')` calls in the same function
- New API routes copying the `getWhatsAppClient()` + `getConfig()` pattern when they don't need Kapso credentials
- Supabase dashboard showing high read volume on `app_settings` table

**Confidence:** HIGH -- Verified by reading the existing codebase (`src/lib/get-config.ts` and `src/app/api/conversations/route.ts`).

**Phase:** Should be refactored BEFORE adding new features. Quick win in early infrastructure phase.

---

## Moderate Pitfalls

Mistakes that cause delays, poor UX, or technical debt.

---

### Pitfall 5: Sentry + Next.js 15 App Router -- Three Config Files, Not One

**What goes wrong:** You install `@sentry/nextjs`, add a `sentry.client.config.ts`, and assume error tracking works everywhere. Server components silently swallow errors. Server Actions are not instrumented. Edge middleware errors are lost.

**Why it happens:** Next.js App Router has THREE separate runtime environments, and Sentry needs separate configuration for each:
1. **Client** (`instrumentation-client.ts`) -- browser errors
2. **Server** (`sentry.server.config.ts`) -- Node.js serverless function errors
3. **Edge** (`sentry.edge.config.ts`) -- middleware and Edge Runtime errors

Additionally:
- Server Actions need explicit wrapping with `Sentry.withServerActionInstrumentation()`
- `app/global-error.tsx` must be created for React rendering errors
- `setUser()` on the server does NOT propagate to the client (and vice versa)
- Turbopack compatibility requires `@sentry/nextjs` and Next.js 15.4.1+ (the project uses 15.5.9, which is fine)
- The `experimental.clientTraceMetadata` config is needed for App Router pageload tracing

**Consequences:**
- Server-side errors (API routes, server components) not captured -- you think the app is error-free when it isn't
- Sentry free tier has only 5,000 events/month. If you instrument everything without sample rates, you burn through this in a day of normal usage
- Source maps not uploaded if `SENTRY_AUTH_TOKEN` is missing from Vercel env vars

**Prevention:**
- Use `npx @sentry/wizard@latest -i nextjs` to scaffold all config files -- don't set up manually
- Set `tracesSampleRate: 0.1` (10%) for the free tier. You don't need 100% of traces for a 2-3 person team
- Add `SENTRY_AUTH_TOKEN` to Vercel environment variables for source map uploads
- Wrap all Server Actions:
  ```typescript
  export async function saveSettings(formData: FormData) {
    return Sentry.withServerActionInstrumentation('saveSettings', async () => {
      // existing logic
    });
  }
  ```
- Create `app/global-error.tsx` for unhandled React errors
- Test: intentionally throw an error in a server component and verify it appears in Sentry dashboard

**Detection (warning signs):**
- Only `sentry.client.config.ts` exists (missing server and edge configs)
- No `global-error.tsx` in the app directory
- Server Actions not wrapped with Sentry instrumentation
- Sentry dashboard shows only client-side errors (suspiciously no server errors)

**Confidence:** HIGH -- Verified from [Sentry Next.js Manual Setup Docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/) and [Sentry Pricing](https://sentry.io/pricing/). Free tier: 5K errors/month, 1 user.

**Phase:** Error tracking / Sentry integration phase. Set up all three configs from the start.

---

### Pitfall 6: Search Implementation Without Indexes -- Full Table Scans

**What goes wrong:** You implement message search by using Supabase's `.ilike()` or `.textSearch()` without creating proper indexes. For a small dataset it works fine, but as conversations accumulate (a beauty shop might have 1,000+ conversations within months), searches become slow and cause database CPU spikes that affect all other queries.

**Why it happens:** PostgreSQL full-text search requires explicit index creation. Unlike application-level search (Algolia, Meilisearch), Postgres won't automatically index text columns for search. Developers test with 50 conversations and it feels fast; at 5,000 conversations it crawls.

**Consequences:**
- Search queries take 2-5 seconds instead of <100ms
- Other queries slow down during searches (shared CPU on free tier)
- Agents stop using search and resort to scrolling through conversations manually
- On Supabase free tier, there's no read replica to isolate search load

**Prevention:**
- For basic search (conversation search by phone number or contact name): use a B-tree index on the columns you filter:
  ```sql
  CREATE INDEX idx_contacts_phone ON contact_profiles(phone_number);
  CREATE INDEX idx_contacts_name ON contact_profiles(name);
  ```
- For full-text search on message content: use PostgreSQL's `tsvector` with a GIN index:
  ```sql
  ALTER TABLE messages ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (to_tsvector('spanish', coalesce(content, ''))) STORED;
  CREATE INDEX idx_messages_search ON messages USING gin(search_vector);
  ```
- Use `websearch_to_tsquery('spanish', $query)` for user-friendly search syntax (handles spaces, quotes)
- Note: Postgres FTS does NOT do fuzzy matching by default. "conectar" will not find "conectando". If fuzzy search is needed, install `pg_trgm` extension and use trigram indexes:
  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX idx_contacts_name_trgm ON contact_profiles USING gin(name gin_trgm_ops);
  ```
- Since messages live in Kapso (not local DB), you may not be able to search message content at all without first storing messages locally. Clarify this before building search.

**Detection (warning signs):**
- Search queries use `.ilike('%term%')` without indexes
- No `tsvector` columns or GIN indexes in the schema
- Search works in testing (small data) but no load testing done
- Attempting to search Kapso API data that isn't stored locally

**Confidence:** MEDIUM -- PostgreSQL FTS behavior is well-documented. Specific search needs for this app depend on what data is stored locally vs. in Kapso.

**Phase:** Message search implementation phase. Create indexes at table creation time, not after the fact.

---

### Pitfall 7: Analytics Data Collection Blocking the Request Path

**What goes wrong:** You add analytics tracking (response times, messages per agent, conversation resolution time) by inserting rows into an `analytics_events` table on every message send, conversation open, and status change. These synchronous inserts add 50-100ms to every request and compete with the main application queries for database connections.

**Why it happens:** The simplest implementation is `await supabase.from('analytics_events').insert(event)` in the API route handler. Developers forget that this INSERT must complete before the response is sent to the client.

**Consequences:**
- Every API route becomes 50-100ms slower
- Analytics writes compete for Supabase free tier resources
- Under load, analytics writes can cause primary operations (sending messages) to timeout
- Analytics table grows unbounded, eventually consuming the 500MB database limit

**Prevention:**
- Fire-and-forget pattern for analytics writes -- don't await the insert:
  ```typescript
  // Don't do: await supabase.from('analytics_events').insert(event)
  // Do:
  supabase.from('analytics_events').insert(event).then(
    () => {},
    (err) => console.error('Analytics write failed:', err)
  );
  ```
- Better: use Vercel's `waitUntil` API to defer analytics writes until after the response is sent:
  ```typescript
  import { waitUntil } from '@vercel/functions';

  export async function POST(request: Request) {
    // ... handle the request, send response
    waitUntil(supabase.from('analytics_events').insert(event));
    return NextResponse.json({ success: true });
  }
  ```
- For aggregations (daily message counts, average response times), use materialized views refreshed by a Vercel Cron job, not real-time aggregation queries:
  ```sql
  CREATE MATERIALIZED VIEW daily_stats AS
  SELECT date_trunc('day', created_at) as day, agent_id, count(*) as message_count
  FROM analytics_events
  GROUP BY 1, 2;
  ```
  Refresh nightly via cron: `SELECT refresh_concurrently('daily_stats');`
- Add a data retention policy: delete analytics_events older than 90 days via cron to prevent unbounded growth

**Detection (warning signs):**
- `await` before analytics insert calls in API routes
- No data retention / cleanup job for analytics tables
- Analytics dashboard queries run real-time aggregations (`COUNT`, `AVG`, `GROUP BY`) on the events table
- `analytics_events` table approaching 100MB

**Confidence:** HIGH -- Verified from [Supabase Performance Tuning Docs](https://supabase.com/docs/guides/platform/performance) and general PostgreSQL best practices.

**Phase:** Analytics implementation phase. Must design write pattern before building the analytics UI.

---

### Pitfall 8: Canned Responses -- User-Specific vs Team-Shared Confusion

**What goes wrong:** You build canned responses as user-specific (each agent has their own). Then the team lead wants to create shared responses for all agents. Or you build them as team-shared only, and agents want personal shortcuts. Changing the data model after deployment means migrating existing data.

**Why it happens:** The requirements seem simple ("save text snippets for quick replies") but the ownership model has implications for the schema, UI, and permissions. Most teams want BOTH personal and shared responses.

**Consequences:**
- Schema redesign and data migration mid-project
- RLS policies need rethinking (who can edit shared vs personal responses)
- UI needs to distinguish "my responses" from "team responses"

**Prevention:**
- Design the schema for both from day one:
  ```sql
  CREATE TABLE canned_responses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    content text NOT NULL,
    shortcut text, -- e.g., "/greeting"
    category text,
    owner_id uuid REFERENCES auth.users(id), -- NULL = shared/team
    created_at timestamptz DEFAULT now()
  );
  ```
  - `owner_id IS NULL` = team-shared response (only admins can edit)
  - `owner_id = auth.uid()` = personal response (owner can edit)
- RLS policy:
  ```sql
  -- Everyone can read all responses
  CREATE POLICY "read_all" ON canned_responses FOR SELECT USING (true);
  -- Users can manage their own; admins can manage shared
  CREATE POLICY "manage_own" ON canned_responses FOR ALL USING (
    owner_id = auth.uid() OR (owner_id IS NULL AND authorize('canned_responses.manage'))
  );
  ```
- Build the UI with a toggle: "My Responses" / "Team Responses"

**Detection (warning signs):**
- Canned responses table has no `owner_id` or `is_shared` column
- No UI distinction between personal and team responses
- Requirements doc doesn't specify the ownership model

**Confidence:** MEDIUM -- Based on common patterns in customer support tools. Specific needs may differ.

**Phase:** Canned responses implementation phase. Decide the ownership model during schema design.

---

### Pitfall 9: Conversation Assignment Without Handling the "Unassigned" State

**What goes wrong:** You add agent assignment to conversations but don't handle the initial state. When a new conversation arrives, it is unassigned. If the UI filters by "my conversations," new conversations disappear from everyone's view. Customers wait with no response because no agent sees the conversation.

**Why it happens:** Assignment features focus on the "assigned" state but forget about the pipeline before assignment. In a 2-3 person team, the overhead of manual assignment might not be worth it -- but if you build it, you must handle the full lifecycle.

**Consequences:**
- New conversations invisible to agents (filtered out by "my conversations" view)
- Customers get no response
- Team lead has to manually monitor and assign every new conversation

**Prevention:**
- Default view should be "Unassigned + Mine," not just "Mine"
- The conversation list needs three filters: "All", "Unassigned", "Assigned to me"
- Consider auto-assignment for a small team: round-robin or "first to respond claims it"
- Add a visual indicator (different color/badge) for unassigned conversations
- For 2-3 agents: consider whether assignment is even needed. A simple "I'm handling this" claim button might be more practical than a full assignment system

**Detection (warning signs):**
- No "unassigned" state in the conversation status enum
- Default conversation list view has an `assigned_to = current_user` filter
- No notification or visibility for new unassigned conversations

**Confidence:** HIGH -- This is a well-known pattern in helpdesk/support tools.

**Phase:** Conversation assignment phase. Design the full lifecycle (unassigned -> assigned -> resolved) before building.

---

### Pitfall 10: Internal Notes Leaking Into Customer-Visible Messages

**What goes wrong:** Internal notes are stored alongside or confused with actual messages. A bug in the UI or API causes an internal note to be sent to the customer via WhatsApp, or displayed in a context where the customer might see it.

**Why it happens:** If internal notes share a data model with messages (same table, different `type` column), a query that forgets the `WHERE type != 'internal_note'` filter will include notes in the message list. If that list is then used to render or send messages, notes leak.

**Consequences:**
- Customer sees internal team comments (potentially embarrassing or confidential)
- Trust violation with customers
- Difficult to undo -- once sent via WhatsApp, cannot be recalled

**Prevention:**
- Store internal notes in a SEPARATE TABLE from messages. Never in the same table:
  ```sql
  CREATE TABLE internal_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id text NOT NULL,
    author_id uuid REFERENCES auth.users(id) NOT NULL,
    content text NOT NULL,
    created_at timestamptz DEFAULT now()
  );
  ```
- The message send API route should have NO access to internal notes data. Physical separation prevents leaks
- In the UI, render notes in a visually distinct way (different background color, "Internal" badge) and in a separate section from the message timeline, or clearly interleaved but visually marked
- Add a confirmation dialog if any message starts with content that matches a recent internal note (defense in depth)

**Detection (warning signs):**
- Notes stored in the same table as messages (even with a `type` column)
- Message send API has any query that touches the notes table
- No visual distinction between notes and messages in the UI

**Confidence:** HIGH -- Common anti-pattern in support tools. Multiple production incidents documented across the industry.

**Phase:** Internal notes implementation phase. Separate table from the start.

---

### Pitfall 11: Labels/Tags Schema -- String-Based vs Normalized

**What goes wrong:** You implement labels as a text array column on the conversation: `labels text[]`. This seems simple, but you can't query "all conversations with label X" efficiently, can't rename a label across all conversations atomically, and can't enforce consistent label names (typos create duplicate labels).

**Why it happens:** Arrays are the quickest implementation but lack referential integrity. In a beauty shop context, you might have labels like "VIP," "Consultation booked," "Follow-up needed." If one agent types "followup" and another types "follow-up," you have two labels for the same concept.

**Consequences:**
- Inconsistent label names (duplicates from typos)
- Expensive queries to find conversations with a specific label (requires array operations)
- Cannot rename a label globally without updating every row
- Cannot track label metadata (color, creator, creation date)

**Prevention:**
- Use a normalized junction table pattern:
  ```sql
  CREATE TABLE labels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    color text DEFAULT '#6b7280',
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
  );

  CREATE TABLE conversation_labels (
    conversation_id text NOT NULL,
    label_id uuid REFERENCES labels(id) ON DELETE CASCADE,
    applied_by uuid REFERENCES auth.users(id),
    applied_at timestamptz DEFAULT now(),
    PRIMARY KEY (conversation_id, label_id)
  );
  ```
- Create a label management UI (admin only) where labels are pre-defined
- Agents select from existing labels, not free-text entry
- Index the junction table for efficient lookups:
  ```sql
  CREATE INDEX idx_conv_labels_label ON conversation_labels(label_id);
  CREATE INDEX idx_conv_labels_conv ON conversation_labels(conversation_id);
  ```

**Detection (warning signs):**
- Labels stored as `text[]` column on conversations table
- Free-text label input instead of dropdown/autocomplete
- No separate labels table

**Confidence:** HIGH -- Standard database normalization principle.

**Phase:** Labels/tags implementation phase. Normalize from the start.

---

### Pitfall 12: Conversation Export Without Size Limits

**What goes wrong:** You build a "Download conversation as PDF/CSV" feature. An agent exports a conversation with 2,000+ messages including media references. The export function runs on Vercel, hits the 300-second timeout, or runs out of the 500MB `/tmp` storage, or produces a 50MB file that fails to download over a slow connection.

**Why it happens:** Conversation length is unbounded. A long-running customer relationship might have thousands of messages over months. The export function doesn't paginate or limit the data it processes.

**Consequences:**
- Export function times out (Vercel 300s limit)
- Memory exhaustion in the serverless function
- Large file download fails or takes forever
- If generating PDFs server-side, CPU usage spikes

**Prevention:**
- Set a maximum export range (e.g., last 30 days or last 500 messages)
- For CSV: stream the response instead of building the entire file in memory
- For PDF: generate client-side using a library like `jspdf` (no server timeout issues)
- Show a progress indicator and allow cancellation
- If server-side generation is needed, generate in chunks and upload to Vercel Blob or Supabase Storage, then provide a download link

**Detection (warning signs):**
- Export function loads all messages into memory at once
- No date range or message count limit on export
- PDF generation happening server-side with no timeout handling
- No loading/progress indicator in the export UI

**Confidence:** MEDIUM -- Depends on actual conversation volumes for this beauty shop.

**Phase:** Conversation export phase. Set limits in the initial implementation.

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable.

---

### Pitfall 13: Sound Notifications Blocked by Browser Autoplay Policy

**What goes wrong:** The existing handoff notification uses Web Audio API with a beep sound. When adding sound notifications for new messages, the same approach fails for some agents because they haven't interacted with the page since loading it. Modern browsers block audio playback until the user has made a gesture (click, tap, keypress) on the page.

**Why it happens:** The v1.0 handoff notification already handles this by requesting permission on first user interaction. But if new notification sounds are added in different code paths that don't go through the same initialization, they will be silently blocked.

**Prevention:**
- Reuse the existing `use-handoff-alerts.ts` pattern for all notification sounds
- Call `AudioContext.resume()` on the first user interaction (the existing code does this)
- Don't create multiple `AudioContext` instances -- share one across all notification types
- Test in a fresh browser tab where the user hasn't clicked anything yet

**Confidence:** HIGH -- Verified from existing codebase (v1.0 already handles this for handoffs).

**Phase:** Sound notification phase. Reuse existing audio infrastructure.

---

### Pitfall 14: Contact Profiles Stored Locally Becoming Stale

**What goes wrong:** You create a `contact_profiles` table to store customer names, labels, and notes. But the canonical contact name comes from Kapso (via the WhatsApp API). If the customer changes their WhatsApp profile name, your local copy becomes stale. Agents see the old name and can't identify the customer.

**Why it happens:** Local storage of contact data creates a cache invalidation problem. There's no webhook from WhatsApp when a contact changes their profile name.

**Prevention:**
- Always show the Kapso-provided contact name as the primary identifier (it's already available in the conversation list data)
- Local profile data should be supplementary (agent-assigned nickname, notes, labels), not a replacement for the API data
- On conversation load, merge: display Kapso contact name first, then local profile enrichments
- Don't duplicate data that Kapso already provides -- only store what you're adding

**Detection (warning signs):**
- Contact name stored locally and used as the display name instead of Kapso's `contactName`
- No mechanism to refresh local contact data from Kapso

**Confidence:** HIGH -- The existing conversations API already provides `contactName` from Kapso.

**Phase:** Contact profiles implementation phase. Design as enrichment, not replacement.

---

### Pitfall 15: Deploying RLS Policies Without Testing -- Locked Out of Your Own Data

**What goes wrong:** You enable RLS on a new table and deploy. The policy has a bug (wrong column name, missing case, circular reference to another table with RLS). All queries to that table return empty results or errors. Since you can't test locally, you discover this only after deploying to Vercel.

**Why it happens:** No local testing environment. RLS policies are SQL that runs inside Postgres -- you can't test them from JavaScript without actually executing queries against the database. The Supabase SQL Editor bypasses RLS (it uses the `service_role`), so policies that work in the editor may fail from the application.

**Prevention:**
- Test RLS policies from the Supabase dashboard's "Table Editor" (which uses the `anon` role), not the SQL Editor
- Deploy RLS changes incrementally: enable RLS, add a permissive SELECT policy first, verify data is accessible, then add restrictive policies
- Keep a "break glass" escape route: a Supabase RPC function using `SECURITY DEFINER` that bypasses RLS for admin operations (only callable by admin role)
- Write the policy, deploy, immediately test the affected feature on the Vercel deployment before moving on

**Detection (warning signs):**
- RLS enabled on table but no policies created yet (blocks ALL access)
- Policies tested only via Supabase SQL Editor
- Complex policies with JOINs to other RLS-enabled tables (RLS recursion)

**Confidence:** HIGH -- Well-documented Supabase behavior. "Enable RLS with no policies = deny all."

**Phase:** Every phase that creates a new table. Test RLS immediately after deployment.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Infrastructure / Config refactor | getConfig() multiplication (Pitfall 4) | Batch config reads into single query before adding new features |
| RBAC / User Management | Privilege escalation via public role column (Pitfall 2) | Use Custom Access Token Auth Hook, separate user_roles table |
| RBAC / User Management | RLS lockout after deployment (Pitfall 15) | Test from Table Editor, deploy incrementally |
| Real-time / SSE | SSE function timeout on Vercel (Pitfall 1) | Design for reconnection; consider enhanced polling instead |
| Canned Responses | Personal vs team ownership confusion (Pitfall 8) | Nullable owner_id schema from day one |
| Internal Notes | Notes leaking to customers (Pitfall 10) | Separate table, separate API, visual distinction |
| Conversation Status/Assignment | Invisible unassigned conversations (Pitfall 9) | Default to "Unassigned + Mine" view |
| Contact Profiles | Stale local data (Pitfall 14) | Local data supplements Kapso, not replaces |
| Labels/Tags | Inconsistent labels from free-text (Pitfall 11) | Normalized junction table, pre-defined labels |
| Message Search | Full table scans without indexes (Pitfall 6) | GIN index on tsvector column at creation time |
| Analytics | Blocking request path (Pitfall 7) | Fire-and-forget writes, materialized views for aggregation |
| Sentry Integration | Missing server/edge configs (Pitfall 5) | Use wizard setup, all three config files |
| Conversation Export | Timeout on large exports (Pitfall 12) | Date range limits, client-side PDF generation |
| Sound Notifications | Browser autoplay block (Pitfall 13) | Reuse existing AudioContext from v1.0 |
| All new tables | Supabase free tier overload (Pitfall 3) | Batch queries via RPC, monitor connection usage |

---

## Confidence Assessment

| Pitfall Area | Confidence | Basis |
|--------------|------------|-------|
| Vercel SSE limits (Pitfall 1) | HIGH | [Vercel Duration Docs](https://vercel.com/docs/functions/configuring-functions/duration) -- verified exact numbers |
| Supabase RBAC (Pitfall 2) | HIGH | [Supabase RBAC Docs](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) |
| Supabase free tier limits (Pitfall 3) | HIGH | [Supabase Pricing](https://supabase.com/pricing), [Realtime Limits](https://supabase.com/docs/guides/realtime/limits) |
| getConfig multiplication (Pitfall 4) | HIGH | Verified from existing source code |
| Sentry setup (Pitfall 5) | HIGH | [Sentry Next.js Docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/) |
| Search without indexes (Pitfall 6) | MEDIUM | PostgreSQL FTS docs; depends on local vs Kapso data storage |
| Analytics blocking (Pitfall 7) | HIGH | [Supabase Performance Docs](https://supabase.com/docs/guides/platform/performance) |
| Canned response ownership (Pitfall 8) | MEDIUM | Common pattern in support tools |
| Conversation assignment (Pitfall 9) | HIGH | Well-known helpdesk pattern |
| Internal notes leakage (Pitfall 10) | HIGH | Industry-common anti-pattern |
| Labels schema (Pitfall 11) | HIGH | Standard normalization principle |
| Export size limits (Pitfall 12) | MEDIUM | Depends on actual conversation volumes |
| Sound notifications (Pitfall 13) | HIGH | Verified from existing v1.0 implementation |
| Contact profile staleness (Pitfall 14) | HIGH | Verified from existing API data flow |
| RLS lockout (Pitfall 15) | HIGH | Well-documented Supabase behavior |

---

## Sources

- [Vercel Functions Duration Configuration](https://vercel.com/docs/functions/configuring-functions/duration) -- Hobby: 300s max with Fluid Compute, 60s without
- [Vercel Functions Runtimes](https://vercel.com/docs/functions/runtimes) -- streaming support, file system, archiving behavior
- [Vercel Limits](https://vercel.com/docs/limits) -- 4 CPU-hrs, 1M invocations, 100 deployments/day on Hobby
- [Supabase Custom Claims & RBAC](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) -- auth hook pattern
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) -- policy behavior
- [Supabase Realtime Limits](https://supabase.com/docs/guides/realtime/limits) -- 200 connections, 100 msg/sec on free tier
- [Supabase Connection Management](https://supabase.com/docs/guides/database/connection-management) -- Supavisor pooling
- [Supabase Performance Tuning](https://supabase.com/docs/guides/platform/performance) -- query optimization, pg_stat_statements
- [Supabase Full Text Search](https://supabase.com/docs/guides/database/full-text-search) -- tsvector, GIN indexes
- [Sentry Next.js Manual Setup](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/) -- three config files, instrumentation
- [Sentry Pricing](https://sentry.io/pricing/) -- Developer plan: 5K errors/month
- Existing codebase analysis: `src/lib/get-config.ts`, `src/middleware.ts`, `src/hooks/use-handoff-alerts.ts`, `src/app/api/conversations/route.ts`
