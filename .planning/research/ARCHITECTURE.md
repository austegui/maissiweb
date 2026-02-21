# Architecture Patterns: v2.0 Commercial-Grade Features

**Domain:** WhatsApp Inbox Dashboard -- integrating commercial features into existing Next.js + Supabase + Kapso architecture
**Researched:** 2026-02-21
**Overall confidence:** HIGH -- based on direct codebase inspection and verified documentation

---

## Current Architecture Snapshot

Before designing v2, here is exactly what exists today (verified by reading every file in the codebase):

### Existing Stack

| Component | Version | Details |
|-----------|---------|---------|
| Next.js | 15.5.9 | App Router, Turbopack dev |
| React | 19.1.0 | |
| TypeScript | 5.9.3 | |
| Tailwind CSS | 4.x | Via `@tailwindcss/postcss` |
| Supabase JS | 2.97.0 | `@supabase/supabase-js` |
| Supabase SSR | 0.8.0 | `@supabase/ssr` |
| Kapso SDK | 0.1.0 | `@kapso/whatsapp-cloud-api` |
| Radix UI | Various | Avatar, Dialog, Label, ScrollArea, Separator, Slot |
| Lucide React | 0.545.0 | Icons |
| date-fns | 4.1.0 | Date formatting |

### Existing Files (Complete Inventory)

**API Routes (8 routes):**
- `src/app/api/conversations/route.ts` -- GET conversations from Kapso
- `src/app/api/messages/[conversationId]/route.ts` -- GET messages for conversation from Kapso
- `src/app/api/messages/send/route.ts` -- POST send text/media message via Kapso
- `src/app/api/messages/interactive/route.ts` -- POST send interactive buttons via Kapso
- `src/app/api/templates/route.ts` -- GET templates from Kapso
- `src/app/api/templates/send/route.ts` -- POST send template via Kapso
- `src/app/api/media/[mediaId]/route.ts` -- GET media file via Kapso
- `src/app/api/settings/route.ts` -- GET/POST app_settings in Supabase

**Pages (3 pages):**
- `src/app/page.tsx` -- Main inbox (client component, composes ConversationList + MessageView)
- `src/app/login/page.tsx` -- Login form
- `src/app/admin/settings/page.tsx` -- Admin settings (server component + client form)

**Components (10 components + 10 UI primitives):**
- `conversation-list.tsx` -- Sidebar with polling, search, handoff badges
- `message-view.tsx` -- Thread view with polling, send form, templates, interactive msgs
- `media-message.tsx` -- Renders media attachments
- `template-selector-dialog.tsx` -- Template picker dialog
- `template-parameters-dialog.tsx` -- Template parameter form
- `interactive-message-dialog.tsx` -- Interactive button composer
- `error-boundary.tsx` -- Error boundary wrapper
- UI primitives: avatar, badge, button, card, dialog, input, label, scroll-area, separator, skeleton, textarea

**Hooks (2 hooks):**
- `use-auto-polling.ts` -- Generic polling with exponential backoff + visibility pause
- `use-handoff-alerts.ts` -- Detects handoff conversations, plays audio, sends notifications

**Libraries (5 modules):**
- `lib/whatsapp-client.ts` -- Creates WhatsAppClient from getConfig()
- `lib/get-config.ts` -- Reads config from DB with env fallback (per-request, no cache)
- `lib/supabase/server.ts` -- Server-side Supabase client
- `lib/supabase/client.ts` -- Browser-side Supabase client
- `lib/supabase/middleware.ts` -- Session validation middleware
- `lib/template-parser.ts` -- Template parameter extraction
- `lib/utils.ts` -- cn() utility

**Middleware:**
- `src/middleware.ts` -- CORS check for API routes + delegates to Supabase session middleware

### Existing Database Schema

**Single table:** `app_settings`
- Columns: `id` (auto), `key` (text, unique), `value` (text)
- Key-value store for: KAPSO_API_KEY, WHATSAPP_API_URL, PHONE_NUMBER_ID, WABA_ID
- RLS: enabled, authenticated users can read/write

**Auth:** Supabase Auth `auth.users` table (managed by Supabase, not custom)

### Existing Data Flow

```
Browser (polling)
  |
  | fetch('/api/conversations') every 10s
  | fetch('/api/messages/{id}') every 5s
  v
Next.js API Routes (serverless)
  |
  | getConfig() -> Supabase DB (per request)
  | getWhatsAppClient() -> WhatsAppClient
  v
Kapso Cloud API
  |
  v
WhatsApp Cloud API
```

**Key constraint:** No local message storage. All conversation/message data lives in Kapso. The app is a stateless proxy UI.

---

## v2 Architecture: What Changes

### Architecture Principle: Additive Layers

v2 follows the same principle as v1: **add layers, don't rewrite existing code.** New features integrate through:

1. **New Supabase tables** -- for data that doesn't exist in Kapso (notes, canned responses, tags, assignments, user profiles)
2. **New API routes** -- for CRUD on new tables
3. **Modified existing components** -- ConversationList and MessageView gain new capabilities
4. **New components** -- for entirely new UI (analytics, user management, search)
5. **Enhanced middleware** -- RBAC layer on top of existing auth

The existing Kapso proxy pattern (API routes -> getConfig() -> WhatsAppClient -> Kapso) remains **unchanged**. New features wrap around it.

---

## New Supabase Tables: Complete Schema Design

### Table 1: `user_profiles` -- Team member metadata

```sql
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'agent')),
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read profiles
CREATE POLICY "Authenticated users can read profiles"
  ON public.user_profiles FOR SELECT TO authenticated USING (true);

-- Users can update their own profile (name, avatar)
CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admins can update any profile (role changes, deactivation)
CREATE POLICY "Admins can update any profile"
  ON public.user_profiles FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger: auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    CASE
      WHEN (SELECT count(*) FROM public.user_profiles) = 0 THEN 'admin'
      ELSE 'agent'
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

**Rationale:** First user gets admin role automatically. Subsequent users are agents. Simple two-role model (admin can manage settings + users, agent can use inbox).

### Table 2: `canned_responses` -- Quick reply library

```sql
CREATE TABLE public.canned_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  shortcut TEXT,  -- e.g., "/hours" or "/pricing"
  category TEXT,  -- e.g., "greetings", "pricing", "aftercare"
  is_shared BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.canned_responses ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read shared responses and their own
CREATE POLICY "Read shared or own responses"
  ON public.canned_responses FOR SELECT TO authenticated
  USING (is_shared = true OR created_by = auth.uid());

-- Authenticated users can create responses
CREATE POLICY "Create responses"
  ON public.canned_responses FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Creator or admin can update
CREATE POLICY "Update own or admin"
  ON public.canned_responses FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Creator or admin can delete
CREATE POLICY "Delete own or admin"
  ON public.canned_responses FOR DELETE TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

**Rationale:** Shared responses are visible to all. Personal responses only to creator. `/shortcut` triggers enable fast access during typing.

### Table 3: `conversation_notes` -- Internal annotations

```sql
CREATE TABLE public.conversation_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT NOT NULL,  -- Kapso conversation ID
  content TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversation_notes_conv_id ON public.conversation_notes(conversation_id);

ALTER TABLE public.conversation_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read notes"
  ON public.conversation_notes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create notes"
  ON public.conversation_notes FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creator can update own notes"
  ON public.conversation_notes FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Creator or admin can delete notes"
  ON public.conversation_notes FOR DELETE TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

**Rationale:** Notes keyed by Kapso conversation_id. All team members can read all notes (team visibility). Only creator can edit their own notes.

### Table 4: `conversation_metadata` -- Status, assignment, tags

```sql
CREATE TABLE public.conversation_metadata (
  conversation_id TEXT PRIMARY KEY,  -- Kapso conversation ID
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'pending')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  phone_number TEXT,  -- Denormalized for search
  contact_name TEXT,  -- Denormalized for search
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conv_meta_status ON public.conversation_metadata(status);
CREATE INDEX idx_conv_meta_assigned ON public.conversation_metadata(assigned_to);
CREATE INDEX idx_conv_meta_tags ON public.conversation_metadata USING GIN(tags);

ALTER TABLE public.conversation_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read metadata"
  ON public.conversation_metadata FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can upsert metadata"
  ON public.conversation_metadata FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update metadata"
  ON public.conversation_metadata FOR UPDATE TO authenticated USING (true);
```

**Rationale:** This table acts as a local overlay on top of Kapso conversations. Kapso gives us conversation IDs and basic data; this table adds our operational metadata (status, assignment, tags). The `phone_number` and `contact_name` columns are denormalized from Kapso data for search purposes -- they get upserted whenever conversations are fetched.

### Table 5: `contact_profiles` -- Customer information

```sql
CREATE TABLE public.contact_profiles (
  phone_number TEXT PRIMARY KEY,  -- WhatsApp phone number as unique key
  display_name TEXT,
  notes TEXT,  -- General customer notes
  tags TEXT[] DEFAULT '{}',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_tags ON public.contact_profiles USING GIN(tags);

ALTER TABLE public.contact_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read contacts"
  ON public.contact_profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can upsert contacts"
  ON public.contact_profiles FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update contacts"
  ON public.contact_profiles FOR UPDATE TO authenticated USING (true);
```

**Rationale:** Keyed by phone number (the permanent customer identifier across WhatsApp conversations). Separate from conversation_metadata because a customer may have multiple conversations over time.

### Table 6: `analytics_events` -- Activity tracking

```sql
CREATE TABLE public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,  -- 'message_sent', 'message_received', 'conversation_resolved', etc.
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  conversation_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_analytics_type ON public.analytics_events(event_type);
CREATE INDEX idx_analytics_created ON public.analytics_events(created_at);
CREATE INDEX idx_analytics_user ON public.analytics_events(user_id);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Only admins can read analytics
CREATE POLICY "Admins can read analytics"
  ON public.analytics_events FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- All authenticated users can insert (events logged server-side)
CREATE POLICY "Server can insert analytics"
  ON public.analytics_events FOR INSERT TO authenticated WITH CHECK (true);
```

**Rationale:** Append-only event log. Server-side API routes insert events on actions (send message, resolve conversation). Admin-only reads for the analytics dashboard. JSONB metadata field allows flexible event data without schema migrations.

---

## RBAC: Admin vs Agent

### Why Not Full Custom Claims / JWT Hooks

The Supabase custom claims + auth hooks pattern (documented at supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) injects roles into JWT tokens. This is powerful but adds complexity:

1. Requires setting up a Custom Access Token Auth Hook
2. Role changes require the user to re-authenticate to get a new JWT
3. More moving parts to debug on the free tier

**For a 2-3 person team, a simpler approach is better:**

### Recommended: Query-Based Role Check

```typescript
// lib/auth.ts
import { createClient } from '@/lib/supabase/server'

export type UserRole = 'admin' | 'agent'

export type AuthenticatedUser = {
  id: string
  email: string
  role: UserRole
  displayName: string
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, display_name')
    .eq('id', user.id)
    .single()

  return {
    id: user.id,
    email: user.email ?? '',
    role: (profile?.role as UserRole) ?? 'agent',
    displayName: profile?.display_name ?? user.email ?? ''
  }
}

export async function requireAdmin(): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser()
  if (!user) throw new Error('Unauthorized')
  if (user.role !== 'admin') throw new Error('Forbidden: admin required')
  return user
}

export async function requireAuth(): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser()
  if (!user) throw new Error('Unauthorized')
  return user
}
```

**Where RBAC is enforced:**

| Feature | Admin | Agent |
|---------|-------|-------|
| View/send messages | Yes | Yes |
| Canned responses (CRUD) | Yes (all) | Yes (own + shared read) |
| Conversation notes | Yes (all CRUD) | Yes (own CRUD, read all) |
| Status/assignment changes | Yes | Yes |
| Tags management | Yes | Yes |
| User management (invite/deactivate) | Yes | No |
| Settings (Kapso credentials) | Yes | No |
| Analytics dashboard | Yes | No (or read-only) |
| Export conversations | Yes | No |

**Implementation approach:** RBAC is enforced at two levels:
1. **RLS policies** in Supabase (database-level, as shown in table schemas above)
2. **API route guards** using `requireAdmin()` or `requireAuth()` (application-level)

This is simpler than JWT claims, and for 2-3 users, the extra DB query per request is negligible.

---

## New API Routes

### Routes to Add

| Route | Method | Purpose | Auth Level |
|-------|--------|---------|------------|
| `/api/users` | GET | List team members | admin |
| `/api/users` | POST | Invite new user | admin |
| `/api/users/[id]` | PATCH | Update user role/status | admin |
| `/api/canned-responses` | GET | List canned responses | auth |
| `/api/canned-responses` | POST | Create canned response | auth |
| `/api/canned-responses/[id]` | PATCH | Update canned response | auth (own or admin) |
| `/api/canned-responses/[id]` | DELETE | Delete canned response | auth (own or admin) |
| `/api/conversations/[id]/notes` | GET | List notes for conversation | auth |
| `/api/conversations/[id]/notes` | POST | Add note to conversation | auth |
| `/api/conversations/[id]/notes/[noteId]` | PATCH | Update note | auth (own) |
| `/api/conversations/[id]/notes/[noteId]` | DELETE | Delete note | auth (own or admin) |
| `/api/conversations/[id]/metadata` | GET | Get status/assignment/tags | auth |
| `/api/conversations/[id]/metadata` | PATCH | Update status/assignment/tags | auth |
| `/api/contacts/[phoneNumber]` | GET | Get contact profile | auth |
| `/api/contacts/[phoneNumber]` | PATCH | Update contact profile | auth |
| `/api/search` | GET | Search messages/contacts | auth |
| `/api/analytics` | GET | Analytics data (time range) | admin |
| `/api/analytics/events` | POST | Log analytics event | auth (server-side) |
| `/api/export/conversations` | GET | Export conversation data | admin |

**Routes to Modify:**

| Existing Route | Modification |
|----------------|-------------|
| `/api/conversations` | After fetching from Kapso, merge with local `conversation_metadata` (status, assignment, tags). Also upsert denormalized data to `conversation_metadata` for search. |
| `/api/messages/send` | After sending, log analytics event. |

### Route Pattern

All new API routes follow the same pattern as existing ones:

```typescript
// Example: src/app/api/canned-responses/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'

export async function GET() {
  try {
    const user = await requireAuth()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('canned_responses')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

---

## Component Architecture: What Changes

### Modified Existing Components

**1. `page.tsx` (Main Inbox)**

Currently: Composes ConversationList + MessageView in a flex layout with minimal header.

Changes:
- Add a proper app shell with sidebar navigation (inbox, contacts, analytics, settings)
- Add conversation status filter tabs above ConversationList (All / Open / Resolved / Pending / Assigned to me)
- Pass user context (from new `useCurrentUser` hook) to child components
- Add global notification sound for ALL new messages (not just handoffs)

**2. `conversation-list.tsx`**

Currently: Fetches from `/api/conversations`, displays list with search filter and handoff badges.

Changes:
- Merge Kapso conversation data with local metadata (status badge, assignment avatar, tags)
- Add filter controls: status dropdown, assigned-to filter, tag filter
- Enhance search to filter by tags and status (client-side since we have all data)
- Add "unread" indicator (compare last_activity_at with user's last-viewed timestamp)

**3. `message-view.tsx`**

Currently: Fetches messages, displays thread, has send form with file upload, template picker, interactive message composer.

Changes:
- Add notes panel (collapsible side panel or tab below header) showing conversation_notes
- Add canned response picker (triggered by typing "/" in the message input)
- Add status/assignment controls in header area (dropdown to change status, assign to agent)
- Add contact info panel (expand to show contact_profiles details + tags)
- Add "resolve" button in header

### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `AppShell` | `src/components/app-shell.tsx` | Layout wrapper with sidebar nav, replaces bare flex layout |
| `ConversationFilters` | `src/components/conversation-filters.tsx` | Status/assignment/tag filter bar above conversation list |
| `NotesPanel` | `src/components/notes-panel.tsx` | Conversation notes CRUD panel |
| `CannedResponsePicker` | `src/components/canned-response-picker.tsx` | "/" command picker for quick replies |
| `CannedResponseManager` | `src/components/canned-response-manager.tsx` | Full CRUD page for managing canned responses |
| `ContactProfile` | `src/components/contact-profile.tsx` | Customer info panel (name, notes, tags, history) |
| `TagManager` | `src/components/tag-manager.tsx` | Tag input component (used in contacts and conversations) |
| `UserManager` | `src/components/user-manager.tsx` | Admin page: invite/deactivate team members |
| `AnalyticsDashboard` | `src/components/analytics-dashboard.tsx` | Admin analytics: message volume, response time, agent activity |
| `SearchDialog` | `src/components/search-dialog.tsx` | Global search (Cmd+K style) |
| `ConversationExport` | `src/components/conversation-export.tsx` | Export conversations to CSV |
| `StatusBadge` | `src/components/ui/status-badge.tsx` | Colored badge for open/resolved/pending |
| `AssignmentAvatar` | `src/components/ui/assignment-avatar.tsx` | Small avatar showing assigned agent |

### New Hooks

| Hook | Purpose |
|------|---------|
| `useCurrentUser` | Fetches and caches current user profile (id, role, displayName) |
| `useCannedResponses` | Fetches canned responses, provides insert method |
| `useConversationMetadata` | Fetches/updates local metadata for a conversation |
| `useConversationNotes` | CRUD for notes on a conversation |
| `useAllNewMessageAlerts` | Like useHandoffAlerts but for ALL new inbound messages |

### New Pages

| Page | Route | Purpose |
|------|-------|---------|
| Canned Responses | `/canned-responses` | Manage quick reply library |
| User Management | `/admin/users` | Invite/manage team members (admin only) |
| Analytics | `/admin/analytics` | Dashboard with charts (admin only) |
| Contacts | `/contacts` | Browse customer profiles |
| Contact Detail | `/contacts/[phoneNumber]` | Single contact with history |

---

## Real-Time Updates: Polling vs SSE vs Supabase Realtime

### Constraint Analysis

| Approach | Vercel Hobby Limits | Complexity | Fit |
|----------|-------------------|------------|-----|
| **Current polling** | No limits (standard requests) | Already works | Good baseline |
| **SSE from Next.js API route** | 300s max function duration; reconnects needed | Medium | Marginal improvement over polling |
| **Supabase Realtime (client-side)** | 200 concurrent connections, 100 msg/s on free tier | Low (Supabase handles it) | Best for DB-driven notifications |

### Recommendation: Hybrid Approach

**Keep existing polling for Kapso data** (conversations, messages). This works and Kapso data is external -- there is no way to get push notifications from Kapso's API. Polling is the only option.

**Add Supabase Realtime for local data changes.** When Agent A resolves a conversation or adds a note, Agent B should see it immediately without waiting for the next poll cycle. Supabase Realtime Postgres Changes listens to INSERT/UPDATE on local tables.

```typescript
// Example: Real-time conversation metadata changes
const supabase = createBrowserClient(...)

supabase
  .channel('conversation-updates')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'conversation_metadata'
    },
    (payload) => {
      // Update local state with new status/assignment
      handleMetadataChange(payload)
    }
  )
  .subscribe()
```

**Why NOT SSE from Next.js API routes:**
- Vercel Hobby plan allows 300s max function duration with Fluid Compute. SSE connections would need to reconnect every 5 minutes.
- This adds complexity (reconnection logic, state sync) for marginal benefit over polling.
- Supabase Realtime is free, handles reconnection automatically, and works client-side.
- SSE would only help if we had a long-running server process with access to Kapso webhooks -- we don't.

**Confidence:** HIGH -- Verified Vercel function limits (vercel.com/docs/functions/limitations) and Supabase Realtime free tier limits (supabase.com/docs/guides/realtime/limits).

### Supabase Realtime Free Tier Limits (verified)

| Limit | Value | Our Usage |
|-------|-------|-----------|
| Concurrent connections | 200 | 2-3 users = 2-3 connections |
| Messages per second | 100 | Will never approach this |
| Channel joins per second | 100 | 2-3 joins at page load |
| Channels per connection | 100 | ~5 channels per user |
| Postgres change payload | 1,024 KB | Our rows are tiny |

We are well within all limits.

---

## Search Architecture

### Problem

Users want to search for:
1. Conversations by contact name, phone number, tags, status
2. Message content within conversations

### Constraint

Messages are NOT stored locally. They live in Kapso. We cannot do server-side full-text search on message content unless we store messages locally (which we should not do in v2 -- that is a significant architectural change).

### Recommendation: Tiered Search

**Tier 1 -- Client-side filter (conversations list):**
Already exists for name/phone. Extend to filter by:
- Status (from `conversation_metadata`)
- Tags (from `conversation_metadata`)
- Assigned agent (from `conversation_metadata`)
This is purely client-side since we load all conversations into memory (~50-100 conversations).

**Tier 2 -- Server-side search (contacts):**
Use Postgres `ILIKE` on `contact_profiles` and `conversation_metadata` tables. For the expected data volume (hundreds of contacts, not millions), `ILIKE` with proper indexes is sufficient. No need for tsvector/full-text-search.

```sql
-- Example: search contacts
SELECT * FROM contact_profiles
WHERE display_name ILIKE '%query%'
   OR phone_number ILIKE '%query%'
ORDER BY updated_at DESC
LIMIT 20;
```

**Tier 3 -- Message search (defer):**
Searching within message content would require either:
- Storing messages locally (significant arch change, storage costs)
- Using Kapso's API search if available (unverified -- check Kapso docs)

Recommendation: Defer message content search. If Kapso offers a search API, use it. Otherwise, this is a v3 feature requiring local message caching.

---

## Analytics Data Collection Strategy

### How Events Are Captured

Analytics events are logged server-side in API routes. No client-side tracking needed.

| Event | Trigger Point | Data Captured |
|-------|---------------|---------------|
| `message_sent` | `/api/messages/send` after success | user_id, conversation_id, message_type |
| `template_sent` | `/api/templates/send` after success | user_id, conversation_id, template_name |
| `conversation_resolved` | `/api/conversations/[id]/metadata` PATCH status=resolved | user_id, conversation_id |
| `conversation_assigned` | `/api/conversations/[id]/metadata` PATCH assigned_to | user_id, conversation_id, assigned_to |
| `note_added` | `/api/conversations/[id]/notes` POST | user_id, conversation_id |
| `canned_response_used` | `/api/messages/send` when flagged as canned | user_id, response_id |

### Analytics Dashboard Queries

The dashboard runs aggregate queries on `analytics_events`:

```sql
-- Messages sent per day (last 30 days)
SELECT DATE(created_at) as day, COUNT(*) as count
FROM analytics_events
WHERE event_type = 'message_sent'
  AND created_at > now() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY day;

-- Messages per agent
SELECT user_id, COUNT(*) as count
FROM analytics_events
WHERE event_type = 'message_sent'
  AND created_at > now() - INTERVAL '30 days'
GROUP BY user_id;

-- Average resolution time
-- (requires pairing conversation_resolved with first message timestamp)
```

### Data Retention

On Supabase free tier (500 MB), analytics_events will grow over time. At ~100 messages/day, each row ~200 bytes, that is ~7 KB/day or ~2.5 MB/year. Not a concern for years.

---

## Modified Data Flow (v2)

```
Browser
  |
  |-- Polling (unchanged) -----------------------> Next.js API Routes
  |     fetch('/api/conversations') every 10s        |
  |     fetch('/api/messages/{id}') every 5s         |-> Kapso Cloud API
  |                                                  |
  |-- Supabase Realtime (NEW) ------------------> Supabase
  |     postgres_changes on local tables             |
  |     conversation_metadata, notes, etc.           |
  |                                                  |
  |-- New API calls (NEW) -----------------------> Next.js API Routes
  |     /api/canned-responses                        |
  |     /api/conversations/{id}/notes                |-> Supabase Postgres
  |     /api/conversations/{id}/metadata             |
  |     /api/contacts/{phoneNumber}                  |
  |     /api/search                                  |
  |     /api/analytics                               |
  |     /api/users                                   |
  v
  Browser State
    |
    |-- Kapso data (conversations, messages) -- from polling (unchanged)
    |-- Local metadata (status, assignment, tags) -- merged at display time
    |-- Notes, canned responses -- from new API routes
    |-- Real-time updates to local data -- from Supabase Realtime
```

### Merge Strategy: Kapso Data + Local Metadata

When `conversation-list.tsx` renders, it needs data from two sources:

1. **Kapso conversations** (from `/api/conversations` polling) -- id, phoneNumber, contactName, lastMessage, lastActiveAt
2. **Local metadata** (from `conversation_metadata` table) -- status, assigned_to, tags

**Two approaches:**

**Option A: Server-side merge in `/api/conversations`** (RECOMMENDED)
The conversations API route fetches from Kapso, then queries `conversation_metadata` for all returned conversation IDs, and merges the results before returning to the client. One request, one response, complete data.

```typescript
// In /api/conversations route handler
const kapsoResponse = await whatsappClient.conversations.list({...})
const conversationIds = kapsoResponse.data.map(c => c.id)

const { data: metadata } = await supabase
  .from('conversation_metadata')
  .select('*')
  .in('conversation_id', conversationIds)

const metadataMap = new Map(metadata?.map(m => [m.conversation_id, m]) ?? [])

const merged = kapsoResponse.data.map(conv => ({
  ...transformKapsoConversation(conv),
  status: metadataMap.get(conv.id)?.status ?? 'open',
  assignedTo: metadataMap.get(conv.id)?.assigned_to ?? null,
  tags: metadataMap.get(conv.id)?.tags ?? [],
}))
```

**Option B: Client-side merge** (not recommended)
Fetch Kapso conversations and local metadata separately, merge in React state. This adds complexity to the client and requires coordinating two data sources.

**Decision: Option A.** Server-side merge keeps the client simple. The existing ConversationList already expects a single data source from `/api/conversations` -- we just enrich the response.

---

## Conversation Status Lifecycle

```
New conversation arrives from Kapso
  |
  v
[open] -- default status when first seen
  |
  |-- Agent opens and reads messages
  |-- Agent clicks "Resolve"
  v
[resolved] -- conversation is done
  |
  |-- Customer sends new message
  v
[open] -- auto-reopens on new inbound message
  |
  |-- Agent clicks "Pending" (waiting for customer/internal)
  v
[pending] -- paused, not actively being handled
  |
  |-- Agent clicks "Resolve" or customer replies
  v
[resolved] or [open]
```

**Auto-reopen logic:** When the `/api/conversations` route detects a conversation whose Kapso `lastActiveAt` is newer than the local metadata `last_activity_at` and status is `resolved`, it auto-updates status back to `open`. This happens server-side during the merge.

---

## Sound Notifications Enhancement

Currently: Only handoff conversations trigger audio + browser notifications.

v2 Enhancement: All new inbound messages trigger a notification sound.

**Implementation:** Modify the existing polling comparison in `conversation-list.tsx`. When a new message is detected (lastActiveAt changed + direction is inbound), play a subtle notification sound. The existing `use-handoff-alerts.ts` pattern provides the template -- generalize it to a `use-message-alerts.ts` hook.

Differentiate sounds:
- **Handoff alert:** Current urgent beep (880Hz + 1108Hz) -- keep as-is
- **New message alert:** Softer, shorter chime (440Hz, 0.15s duration)

---

## Error Tracking (Sentry)

### Integration Points

Sentry for Next.js provides:
- Server-side error capture (API routes)
- Client-side error capture (React error boundary)
- Performance monitoring (optional)

### Architecture

```
src/
  instrumentation.ts        -- Sentry.init() for server-side (Next.js instrumentation hook)
  app/
    global-error.tsx        -- Sentry error boundary for app-level errors
  components/
    error-boundary.tsx      -- Existing, wrap with Sentry.captureException
  lib/
    sentry.ts               -- Shared Sentry config
```

**New dependency:** `@sentry/nextjs` -- provides automatic instrumentation for Next.js App Router.

**Configuration:** Sentry DSN stored as `NEXT_PUBLIC_SENTRY_DSN` env var in Vercel (public, safe to expose). Sentry auth token for source maps stored as `SENTRY_AUTH_TOKEN` (server-only).

---

## Build Order: Dependency Chain for v2 Features

Features have dependencies on each other. The build order must respect these:

```
Phase 1: Foundation (RBAC + User Profiles)
  |
  | Creates: user_profiles table, requireAuth/requireAdmin helpers
  | Enables: Everything else (all features need user context)
  |
  v
Phase 2: Canned Responses
  |
  | Creates: canned_responses table, CRUD routes, picker component
  | Depends on: Phase 1 (user context for created_by)
  | Independent of: conversation features
  |
  v (parallel track A)
Phase 3A: Conversation Management
  |
  | Creates: conversation_metadata table, status/assignment/tags
  | Modifies: /api/conversations (server-side merge), conversation-list (filters)
  | Depends on: Phase 1 (user context for assignment)
  |
  v (parallel track B)
Phase 3B: Internal Notes
  |
  | Creates: conversation_notes table, notes panel
  | Modifies: message-view (add notes panel)
  | Depends on: Phase 1 (user context for created_by)
  |
  v
Phase 4: Contact Profiles + Search
  |
  | Creates: contact_profiles table, search dialog, contacts page
  | Depends on: Phase 3A (conversation_metadata for search)
  |
  v
Phase 5: Real-Time + Notifications
  |
  | Creates: Supabase Realtime subscriptions, global message alerts
  | Modifies: conversation-list (realtime metadata updates), message-view
  | Depends on: Phases 3A/3B (tables to listen to)
  |
  v
Phase 6: Analytics + Export
  |
  | Creates: analytics_events table, dashboard page, export endpoint
  | Modifies: All message-sending routes (event logging)
  | Depends on: Phase 1 (admin-only access), Phase 3A (resolution events)
  |
  v
Phase 7: Error Tracking (Sentry)
  |
  | Creates: Sentry integration, instrumentation, error boundary enhancement
  | Independent: Can be done at any point, placed last for lower priority
  |
  v
Phase 8: User Management UI
  |
  | Creates: Admin user management page (invite, deactivate, change roles)
  | Depends on: Phase 1 (user_profiles, admin role)
  | Placed late because currently Gustavo manages users via Supabase dashboard
```

**Parallelization note:** Phases 3A and 3B can be built in parallel -- they are independent. Phase 2 can also be built in parallel with Phase 3A/3B since canned responses have no conversation metadata dependency.

**Recommended execution order (serial):**
1. Foundation (RBAC)
2. Canned Responses (highest daily ROI for the team)
3. Conversation Management (status + assignment + tags)
4. Internal Notes
5. Contact Profiles + Search
6. Real-Time + Notifications
7. Analytics + Export
8. Error Tracking (Sentry)
9. User Management UI

---

## Anti-Patterns to Avoid in v2

### Anti-Pattern 1: Storing WhatsApp Messages Locally

**What:** Creating a local `messages` table mirroring Kapso message data.

**Why bad:** Creates data sync nightmare. Kapso is the source of truth. Syncing means: tracking what's been synced, handling updates, managing deletions, dealing with eventual consistency. Massive complexity for a 2-3 person team.

**Instead:** Continue using Kapso as the message source. Only store LOCAL data that doesn't exist in Kapso (notes, metadata, analytics events). If message search is needed, explore Kapso's search API first.

### Anti-Pattern 2: Over-Engineering RBAC

**What:** Using Supabase Custom Access Token Auth Hooks, JWT claims, multiple role levels, granular permissions.

**Why bad:** Overkill for 2 roles (admin/agent) and 2-3 users. Adds debugging complexity, requires users to re-login when roles change, and JWT hooks can be fragile on the free tier.

**Instead:** Simple query-based role check from `user_profiles.role`. One DB query per request, negligible at this scale.

### Anti-Pattern 3: SSE on Vercel for Real-Time

**What:** Building a custom SSE endpoint on Vercel serverless for push notifications.

**Why bad:** Vercel functions have timeout limits (300s Hobby). SSE connections would disconnect and reconnect constantly. Complex reconnection logic, state sync issues, for marginal benefit over polling + Supabase Realtime.

**Instead:** Use Supabase Realtime (free, managed, auto-reconnect) for local data changes. Keep polling for Kapso data.

### Anti-Pattern 4: Client-Side Analytics Tracking

**What:** Using client-side JavaScript to track analytics events.

**Why bad:** Can be blocked by ad blockers. Events can be forged. Missing events when network is flaky.

**Instead:** Server-side event logging in API routes. Every action goes through an API route anyway -- log the event there.

### Anti-Pattern 5: Fetching Metadata Separately from Conversations

**What:** Having the client fetch Kapso conversations from one endpoint and local metadata from another, then merging in React.

**Why bad:** Two loading states, two error states, race conditions, complex merge logic in the client.

**Instead:** Server-side merge in `/api/conversations`. Single response with all data. ConversationList stays simple.

---

## Migration Strategy: v1 to v2

All v2 changes are additive. No existing tables or routes are deleted.

**Database migrations:** Run as SQL in Supabase dashboard or via migration files.

**New tables:** 6 new tables (user_profiles, canned_responses, conversation_notes, conversation_metadata, contact_profiles, analytics_events)

**Existing user migration:** After creating `user_profiles` table with the auto-create trigger, existing users in `auth.users` won't have profiles. Run a one-time migration:

```sql
INSERT INTO public.user_profiles (id, display_name, role)
SELECT id, COALESCE(raw_user_meta_data->>'display_name', email), 'admin'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.user_profiles);
```

This makes all existing users admins (since they are the founding team).

**Backward compatibility:** All existing API routes continue working unchanged. New features are opt-in through new UI elements. The app works identically to v1 until v2 UI changes are deployed.

---

## Sources

- **Codebase inspection** -- All existing files read and analyzed directly (HIGH confidence)
- **Vercel Function Limits** -- https://vercel.com/docs/functions/limitations (HIGH confidence, verified 2026-02-21)
- **Supabase Realtime Limits** -- https://supabase.com/docs/guides/realtime/limits (HIGH confidence, verified 2026-02-21)
- **Supabase Realtime Postgres Changes** -- https://supabase.com/docs/guides/realtime/postgres-changes (HIGH confidence)
- **Supabase RBAC/Custom Claims** -- https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac (HIGH confidence, verified 2026-02-21)
- **Supabase RLS** -- https://supabase.com/docs/guides/database/postgres/row-level-security (HIGH confidence)
- **Supabase Full Text Search** -- https://supabase.com/docs/guides/database/full-text-search (MEDIUM confidence, referenced but not needed for our scale)
- **Next.js SSE Streaming** -- https://github.com/vercel/next.js/discussions/48427, https://medium.com/@oyetoketoby80/fixing-slow-sse-server-sent-events-streaming-in-next-js-and-vercel-99f42fbdb996 (MEDIUM confidence, researched but NOT recommended for this project)
- **WhatsApp Business multi-agent patterns** -- https://respond.io/whatsapp-business-multiple-users, https://www.aurorainbox.com/en/2025/04/10/whatsapp-business-multiple-users-2025/ (MEDIUM confidence, competitor research)
