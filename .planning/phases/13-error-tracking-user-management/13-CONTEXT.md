# Phase 13: Error Tracking + User Management - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can manage team members (create accounts, change roles, deactivate) directly from the app without touching the Supabase dashboard. A branded error page handles all unrecoverable errors. Sentry integration is deferred to the backlog — this phase delivers User Management + error page only.

</domain>

<decisions>
## Implementation Decisions

### Error page experience
- Single page for all errors (404, crashes, any other) — no separate variants
- Branded with Maissi colors and logo (no illustration, just the logo)
- Spanish only — warm message: "Algo salió mal, estamos trabajando en ello"
- Actions: "Intentar de nuevo" (retry/reload) + "Volver al inicio" (link to inbox)
- No technical details shown to users

### Invite/create flow
- Admin enters email + password + display name — three fields
- Password validation: minimum 6 characters only
- Admin chooses role (Admin or Agente) at creation time
- No confirmation step — clicking "Crear" immediately creates the account
- After creation: success dialog shows email + password with a "Copy credentials" button (clipboard copy)
- Credentials shown once — dialog closes, admin shares manually (WhatsApp, in person, etc.)
- One member at a time — form resets after dialog closes
- No email integration — all credential sharing happens manually

### User list & actions
- Page lives at /admin/users
- Navigation: link to user management from the existing settings page
- Columns: display name, email, role badge (Admin/Agente), active/inactive status, last login timestamp
- Role changes via inline dropdown in each row — applies immediately, no confirmation
- Deactivation requires confirmation dialog ("¿Desactivar a maria@example.com?")
- Soft disable only — account marked inactive, can't log in, admin can reactivate later
- Reactivation restores original role — no role picker on reactivate
- No permanent deletion option
- Admin cannot modify themselves (no self-role-change, no self-deactivation) — prevents lockout

### Claude's Discretion
- Table vs card layout for user list
- User list styling and spacing details
- Error page layout and spacing
- How the "Crear miembro" form is presented (inline or modal)
- Sentry capture scope when eventually implemented

</decisions>

<specifics>
## Specific Ideas

- No email integration — all credential sharing happens manually (admin tells team member in person, via WhatsApp, etc.)
- Keep the create-member flow fast — no unnecessary steps or confirmation screens
- Last login column gives admin visibility into who's actually using the tool
- Copy-to-clipboard for credentials so admin can paste directly into WhatsApp to share

</specifics>

<deferred>
## Deferred Ideas

- **Sentry error tracking** — Full Sentry integration (client-side, server-side, edge runtime capture). User cannot set up Sentry right now — defer to backlog.
- **Email invitations** — Send invite emails with login link instead of manual credential sharing
- **Password reset by admin** — Admin-triggered password reset for existing members

</deferred>

---

*Phase: 13-error-tracking-user-management*
*Context gathered: 2026-02-22*
