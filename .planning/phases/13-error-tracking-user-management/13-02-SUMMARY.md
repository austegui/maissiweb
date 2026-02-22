---
phase: 13-error-tracking-user-management
plan: 02
subsystem: ui
tags: [supabase, auth-admin, server-actions, nextjs, tailwind, user-management]

# Dependency graph
requires:
  - phase: 13-01
    provides: createAdminClient() factory with service role key support
  - phase: 07-03
    provides: /admin/layout.tsx guard that restricts /admin/* to admins only

provides:
  - Server Actions for create, update role, deactivate, reactivate team members
  - /admin/users page with full CRUD UI (table + create form + credentials dialog)
  - Navigation link from /admin/settings to /admin/users

affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - requireAdmin() helper centralizes auth + role check for user management actions
    - page.tsx (Server Component) + UsersManager.tsx (Client Component) split for data fetch vs interactivity
    - Promise.all for parallel auth.admin.listUsers + user_profiles.select + auth.getUser
    - Map-based join of auth users with profiles (O(1) per lookup)
    - ban_duration='876000h' for deactivation, 'none' for reactivation (Supabase pattern)
    - Profile upsert after createUser to handle trigger race condition

key-files:
  created:
    - src/app/admin/users/actions.ts
    - src/app/admin/users/page.tsx
    - src/app/admin/users/UsersManager.tsx
  modified:
    - src/app/admin/settings/page.tsx

key-decisions:
  - "ban_duration='876000h' (~100 years) used for deactivation -- Supabase auth.admin.updateUserById pattern, reversible via ban_duration='none'"
  - "upsert user_profiles after createUser to handle DB trigger race condition -- profile may not exist yet when action runs"
  - "window.confirm() for deactivation confirmation -- simpler than inline confirm state, sufficient for admin-only UX"
  - "Role shown as static badge for current user's row, no dropdown -- prevents self-role-modification at UI layer too"
  - "Credentials shown in modal dialog with clipboard copy -- allows sharing initial password securely without email flow"

patterns-established:
  - "requireAdmin() pattern: get user via anon client, check user_profiles.role, return { user, supabase } or throw"
  - "rowLoading[userId] state pattern for per-row loading state in tables without full re-render"
  - "MemberUser interface exported from page.tsx and imported in UsersManager.tsx for type sharing"

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 13 Plan 02: User Management Summary

**Admin-only /admin/users page with Supabase auth.admin CRUD: create members with credential dialog, inline role dropdown, deactivate/reactivate with self-modification guards**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-22T19:26:43Z
- **Completed:** 2026-02-22T19:28:42Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Four server actions (createMember, updateMemberRole, deactivateMember, reactivateMember) using Supabase auth.admin API
- /admin/users page with parallel data fetch (auth users + profiles) joined in memory
- UsersManager Client Component: create form, credentials dialog with clipboard copy, role dropdown, deactivate/reactivate buttons
- Self-modification prevention at both server action level (throw) and UI level (disabled/hidden controls for current user row)
- Navigation link added to /admin/settings pointing to /admin/users

## Task Commits

Each task was committed atomically:

1. **Task 1: Server actions for user management** - `20c739f` (feat)
2. **Task 2: User management page, client component, settings nav link** - `cac7edf` (feat)

**Plan metadata:** (see below - docs commit)

## Files Created/Modified
- `src/app/admin/users/actions.ts` - Server Actions: createMember, updateMemberRole, deactivateMember, reactivateMember with requireAdmin() guard
- `src/app/admin/users/page.tsx` - Server Component: parallel fetch of auth users + profiles, joined into MemberUser array
- `src/app/admin/users/UsersManager.tsx` - Client Component: full CRUD UI with create form, credentials modal, role dropdown, deactivate/reactivate
- `src/app/admin/settings/page.tsx` - Added "Gestion de miembros" link to /admin/users

## Decisions Made
- `ban_duration='876000h'` (~100 years) used for deactivation via `auth.admin.updateUserById` -- reversible via `ban_duration='none'`, no data deletion
- Profile upsert (not insert) after `createUser` to handle trigger race condition -- the DB trigger may or may not have run before the action reaches the upsert
- `window.confirm()` for deactivation confirmation -- admin-only page, simpler than inline confirm state
- Role column renders static badge for current user's own row (no dropdown) -- prevents self-role-change at UI layer in addition to server guard
- Credentials shown in overlay dialog with clipboard copy button -- initial password sharing without email flow

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

**SUPABASE_SERVICE_ROLE_KEY environment variable must be set on Vercel** for the admin client to function.

- Source: Supabase Dashboard -> Project Settings -> API -> "service_role" key under "Project API keys"
- Add as: `SUPABASE_SERVICE_ROLE_KEY` (no NEXT_PUBLIC_ prefix -- server-only)
- This was noted in plan 01 user_setup; if already added during 13-01, no action needed here.

## Next Phase Readiness
- Phase 13 is now complete (both plans done): global error boundary + admin client (13-01) + user management (13-02)
- All v2.0 milestone features are shipped
- No blockers or concerns

---
*Phase: 13-error-tracking-user-management*
*Completed: 2026-02-22*
