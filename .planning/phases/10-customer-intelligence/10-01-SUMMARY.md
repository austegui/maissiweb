# Summary: 10-01 — Create contacts and conversation_notes tables

## What was built
- `contacts` table with phone_number TEXT PK, display_name, email, notes, whatsapp_name, created_at, updated_at
- `conversation_notes` table with UUID PK, conversation_id TEXT, author_id UUID (FK to user_profiles, ON DELETE SET NULL), content TEXT, created_at
- RLS policies: SELECT+INSERT+UPDATE on contacts, SELECT+INSERT only on conversation_notes (append-only)
- Backfill of existing phone numbers from conversation_contact_labels into contacts (0 rows — no labels assigned yet)

## Tasks completed

| # | Task | Method |
|---|------|--------|
| 1 | Create contacts and conversation_notes tables in Supabase | User-executed SQL in Supabase Dashboard |

## Decisions
- [10-01]: Backfill returns 0 rows when no labels exist — contacts created lazily via upsert on panel open
- [10-01]: conversation_notes has no UPDATE/DELETE policies — append-only by design

## Deviations
None.

## Issues
None.
