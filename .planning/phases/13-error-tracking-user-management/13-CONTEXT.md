# Phase 13: Error Tracking + User Management - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can manage team members (create accounts, change roles, deactivate) directly from the app without touching the Supabase dashboard. Error tracking (Sentry) is deferred to the backlog — this phase delivers User Management only.

</domain>

<decisions>
## Implementation Decisions

### Error page experience
- Friendly & branded: Maissi logo, warm Spanish message ("Algo salió mal, estamos trabajando en ello")
- Spanish only — consistent with the rest of the app
- Actions: "Intentar de nuevo" (retry/reload) + "Volver al inicio" (link to inbox)
- No technical details shown to users

### Invite flow (local — no email integration)
- Admin enters email + password directly — no invitation emails
- Admin chooses role (Admin or Agente) at creation time
- No confirmation step — clicking "Crear" immediately creates the account
- After creation: credentials shown once on screen in a dialog — admin copies/screenshots to share manually

### User list & actions
- Columns: email, role badge (Admin/Agente), active/inactive status, last login timestamp
- Role changes apply immediately via dropdown — no confirmation needed
- Deactivation requires confirmation dialog ("¿Desactivar a maria@example.com?")
- Soft disable only — account marked inactive, can't log in, admin can reactivate later
- No permanent deletion option
- Admin cannot modify themselves (no self-role-change, no self-deactivation) — prevents lockout

### Claude's Discretion
- Error page variations (whether to have separate 404 vs generic, or one page for all)
- Sentry capture scope when eventually implemented (crashes + API errors vs crashes only)
- User list layout and styling details
- Password validation rules for new accounts
- Table vs card layout for user list

</decisions>

<specifics>
## Specific Ideas

- No email integration — all credential sharing happens manually (admin tells team member in person, via WhatsApp, etc.)
- Keep the create-member flow fast — no unnecessary steps or confirmation screens
- Last login column gives admin visibility into who's actually using the tool

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
