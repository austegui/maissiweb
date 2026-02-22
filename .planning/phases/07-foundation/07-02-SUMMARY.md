# Plan 07-02 Summary: Supabase RBAC Setup

**Status:** Complete
**Completed:** 2026-02-21

## What Shipped

All SQL executed in Supabase Dashboard SQL Editor:

1. **user_profiles table** — `id` (UUID FK to auth.users), `display_name`, `role` (CHECK admin/agent), `created_at`, `updated_at`. RLS enabled.
2. **handle_new_user() trigger** — SECURITY DEFINER function auto-creates profile row with role='agent' on every new signup via auth.users INSERT trigger.
3. **get_my_role() helper** — STABLE SECURITY DEFINER function for cached role lookup in RLS policies.
4. **RLS policies on user_profiles** — own-read, admin-read-all, own-update (no role change), admin-update.
5. **RLS policies on app_settings** — authenticated read (already existed), admin-only INSERT and UPDATE.
6. **Backfill** — 4 existing users backfilled into user_profiles.
7. **Admin promotion** — gvillarreal@inferenciadigital.com promoted to admin role.

## Verified State

| Email | Role |
|-------|------|
| gvillarreal@inferenciadigital.com | admin |
| natasha@maissibeauty.shop | agent |
| ecommerce@maissibeauty.shop | agent |
| richard@maissi.beauty.shop | agent |

## Deviations

- Block 5 partial: "Authenticated users can read settings" SELECT policy already existed on app_settings. Skipped that statement, ran the two admin-only write policies separately. No impact — the pre-existing policy provides the same behavior.

## Requirements Covered

- RBAC-01: user_profiles auto-created on signup ✓
- RBAC-02: Two roles enforced by RLS ✓
