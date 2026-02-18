# Phase 1 Audit: Kapso WhatsApp Cloud Inbox

**Audited:** 2026-02-18
**Source:** gokapso/whatsapp-cloud-inbox (merged into kapsoweb)
**Confidence:** HIGH (verified from local source)

## Router Type

**App Router** (Next.js 15)

Evidence:
- `src/app/layout.tsx` exists — App Router root layout (exports `default function RootLayout({ children })` with `<html>/<body>` wrapper, lines 9–21)
- `src/pages/` does NOT exist — no Pages Router
- API routes use `src/app/api/*/route.ts` pattern

Implication: All new routes in Phase 2+ use App Router conventions.

## API Route Structure

| Route | Method | Purpose | Imports from whatsapp-client |
|-------|--------|---------|------------------------------|
| `src/app/api/conversations/route.ts` | GET | List conversations with Kapso extensions (contact name, last message, direction) | whatsappClient + PHONE_NUMBER_ID |
| `src/app/api/media/[mediaId]/route.ts` | GET | Fetch media metadata and download binary by mediaId | whatsappClient + PHONE_NUMBER_ID |
| `src/app/api/messages/[conversationId]/route.ts` | GET | List messages for a conversation with media/direction/kapso fields | whatsappClient + PHONE_NUMBER_ID |
| `src/app/api/messages/interactive/route.ts` | POST | Send interactive button message (max 3 buttons) to a phone number | whatsappClient + PHONE_NUMBER_ID |
| `src/app/api/messages/send/route.ts` | POST | Send text or media message (image/video/audio/document) via multipart form | whatsappClient + PHONE_NUMBER_ID |
| `src/app/api/templates/route.ts` | GET | List WhatsApp templates for a WABA account | whatsappClient only (PHONE_NUMBER_ID NOT imported — uses WABA_ID directly) |
| `src/app/api/templates/send/route.ts` | POST | Send a template message with header/body/button parameter substitution | whatsappClient + PHONE_NUMBER_ID |

**Total routes:** 7

## process.env Reads (Direct)

| File | Line | Variable | Usage |
|------|------|----------|-------|
| `src/lib/whatsapp-client.ts` | 7 | `KAPSO_API_KEY` | Read into local `const kapsoApiKey`, required check (throws if missing) |
| `src/lib/whatsapp-client.ts` | 12 | `WHATSAPP_API_URL` | Used as `baseUrl` with fallback `\|\| 'https://api.kapso.ai/meta/whatsapp'` |
| `src/lib/whatsapp-client.ts` | 27 | `PHONE_NUMBER_ID` | Exported as `export const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID \|\| ''` |
| `src/app/api/templates/route.ts` | 6 | `WABA_ID` | Read into local `const wabaId`, required check (returns 500 if missing) |

**Total direct reads:** 4, across 2 files

## process.env Reads (Via Import)

| File | Imports | From |
|------|---------|------|
| `src/app/api/conversations/route.ts` | `whatsappClient`, `PHONE_NUMBER_ID` | `@/lib/whatsapp-client` |
| `src/app/api/media/[mediaId]/route.ts` | `whatsappClient`, `PHONE_NUMBER_ID` | `@/lib/whatsapp-client` |
| `src/app/api/messages/[conversationId]/route.ts` | `whatsappClient`, `PHONE_NUMBER_ID` | `@/lib/whatsapp-client` |
| `src/app/api/messages/interactive/route.ts` | `whatsappClient`, `PHONE_NUMBER_ID` | `@/lib/whatsapp-client` |
| `src/app/api/messages/send/route.ts` | `whatsappClient`, `PHONE_NUMBER_ID` | `@/lib/whatsapp-client` |
| `src/app/api/templates/route.ts` | `whatsappClient` (only — NOT PHONE_NUMBER_ID) | `@/lib/whatsapp-client` |
| `src/app/api/templates/send/route.ts` | `whatsappClient`, `PHONE_NUMBER_ID` | `@/lib/whatsapp-client` |

**PHONE_NUMBER_ID import chain:**

```
src/lib/whatsapp-client.ts (line 27)
  └─ exported as: export const PHONE_NUMBER_ID
       ├─ src/app/api/conversations/route.ts (line 7 — import, lines 34, 59 — usage)
       ├─ src/app/api/media/[mediaId]/route.ts (line 2 — import, lines 13, 18 — usage)
       ├─ src/app/api/messages/[conversationId]/route.ts (line 8 — import, line 88 — usage)
       ├─ src/app/api/messages/interactive/route.ts (line 2 — import, line 32 — usage)
       ├─ src/app/api/messages/send/route.ts (line 2 — import, lines 27, 36, 42, 48, 54, 62 — usage)
       └─ src/app/api/templates/send/route.ts (line 3 — import, line 113 — usage)
```

`src/app/api/templates/route.ts` does NOT import `PHONE_NUMBER_ID`.

**whatsappClient import chain:**

`whatsappClient` is a lazy Proxy in `src/lib/whatsapp-client.ts` (lines 21–25) that delegates all property access to `getWhatsAppClient()`. Imported by all 7 route files:

```
src/lib/whatsapp-client.ts (lines 21–25)
  └─ exported as: export const whatsappClient (lazy Proxy)
       ├─ src/app/api/conversations/route.ts (line 7)
       ├─ src/app/api/media/[mediaId]/route.ts (line 2)
       ├─ src/app/api/messages/[conversationId]/route.ts (line 8)
       ├─ src/app/api/messages/interactive/route.ts (line 2)
       ├─ src/app/api/messages/send/route.ts (line 2)
       ├─ src/app/api/templates/route.ts (line 2)
       └─ src/app/api/templates/send/route.ts (line 3)
```

All 7 routes import `whatsappClient`. No route instantiates `WhatsAppClient` directly.

## Webhook / Real-time Architecture

**No webhook endpoint.** The app uses client-side polling.

Evidence:
- `grep -ri "webhook" src/` — zero matches
- No route file handles `POST` requests from Meta's webhook delivery
- No `src/app/api/webhook/` directory exists

**Polling mechanism confirmed in `src/hooks/use-auto-polling.ts`:**

- `useAutoPolling` hook accepts `{ interval, enabled, onPoll }` options
- Default interval: `5000ms` (5 seconds)
- Polls immediately on mount, then on interval
- Pauses automatically when browser tab is hidden (`visibilitychange` event)
- Resumes when tab becomes visible again
- Returns `{ isPolling, isPaused }` state

Implication for Phase 2: AUTH-03 says "WhatsApp webhook endpoint remains publicly accessible." Since there IS no webhook endpoint, this requirement is automatically satisfied. No middleware whitelist is needed.

## Phase 2+ Impact Summary

### Files to modify in Phase 4 (Config Migration)
- `src/lib/whatsapp-client.ts` — primary target (3 process.env reads: KAPSO_API_KEY line 7, WHATSAPP_API_URL line 12, PHONE_NUMBER_ID line 27)
- `src/app/api/templates/route.ts` — secondary target (1 process.env read: WABA_ID line 6)

Note: `WABA_ID` is read inline in `templates/route.ts` rather than via `whatsapp-client.ts` — Phase 4 should centralize it alongside the other vars.

Note: `WHATSAPP_API_URL` has a fallback default (`|| 'https://api.kapso.ai/meta/whatsapp'`) — it is optional. `KAPSO_API_KEY` is required (throws if missing). `PHONE_NUMBER_ID` silently defaults to `''`. These behavioral differences are relevant for Phase 3 admin settings validation.

### Middleware placement for Phase 2 (Authentication)
- Middleware goes in `src/middleware.ts` (App Router convention)
- Must protect: `/` and all `/api/*` routes
- Must exclude: `/login` (new page in Phase 2)
- No webhook to exclude (polling architecture)

### New files for Phase 3 (Admin Settings)
- `src/app/admin/settings/page.tsx` — new admin page
- `src/app/api/settings/route.ts` — new API route
- `src/lib/get-config.ts` — new utility
