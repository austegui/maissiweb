# Phase 9: Conversation Management - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Transform the inbox into a ticket system where conversations have a lifecycle status (Abierto/Pendiente/Resuelto), can be assigned to specific team members, and can be categorized with colored labels. All UI text is in Spanish.

</domain>

<decisions>
## Implementation Decisions

### Language
- All UI labels, buttons, placeholders, status names, tab labels, and empty states must be in Spanish
- This applies to all new UI added in this phase (existing Kapso UI is English and untouched)

### Status workflow
- Three statuses: **Abierto** (green), **Pendiente** (amber/yellow), **Resuelto** (gray)
- Status changed via a dropdown in the message view header (not buttons)
- When a customer messages a Resuelto conversation, it auto-reopens to Abierto with a visual highlight (bold, dot, or similar indicator) so agents notice reopened conversations
- Default landing view is the "Abierto" tab — shows only open conversations
- Conversation list filtered via horizontal tabs above the list: Abierto | Pendiente | Resuelto | Todos

### Assignment UX
- Any agent can assign any conversation to themselves or another team member (no admin restriction)
- Conversation list shows assignment as compact display (initials badge or similar — compact, not text-heavy)

### Claude's Discretion (Assignment)
- Assignment control placement (header dropdown vs side panel)
- Assignment filter approach (separate tabs, dropdown, or combined with status)
- Exact visual treatment of assigned agent in the list

### Labels & filtering
- Admin-only label management (create, edit, delete) from an admin page
- Agents can attach existing labels to contacts but cannot create new ones
- Multiple labels per contact (e.g., "VIP" + "Balayage" + "Frecuente")
- Labels displayed as colored pills/badges — admin picks the color when creating a label
- Conversation list can be filtered by label

### Claude's Discretion (Labels)
- Where agents attach labels to contacts (message view header, side panel, or context menu)
- How label filtering integrates with status/assignment filters
- Color palette choices for admin label creation

### Conversation list layout
- Compact density: status as colored dot, assignment as initials badge, labels as small pills or abbreviated
- Resolved conversations accessible via Resuelto tab (Claude decides if auto-archive after time or always visible)
- Status colors: Abierto = green, Pendiente = yellow/amber, Resuelto = gray

</decisions>

<specifics>
## Specific Ideas

- Status names: Abierto / Pendiente / Resuelto (not Nuevo/Cerrado)
- Tab labels: Abierto | Pendiente | Resuelto | Todos
- Default tab on inbox load: Abierto (focus on active work)
- Reopened conversations (Resuelto → Abierto) should have a brief visual highlight so agents notice them
- Label visual: colored rounded badges with admin-chosen colors (like "VIP" in purple)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-conversation-management*
*Context gathered: 2026-02-22*
