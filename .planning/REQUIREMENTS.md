# Requirements — Maissi Beauty Shop WhatsApp Inbox

**Version:** v1
**Created:** 2026-02-18
**Status:** Active

---

## v1 Requirements

### Fork Setup

- [ ] **FORK-01**: Clone gokapso/whatsapp-cloud-inbox as the project base
- [ ] **FORK-02**: Audit upstream code — map all process.env reads, determine router type (App Router vs Pages Router), identify webhook path and API route structure
- [ ] **FORK-03**: Set gokapso/whatsapp-cloud-inbox as upstream git remote for future merge capability

### Authentication

- [ ] **AUTH-01**: User can create account and log in with email and password via Supabase Auth
- [ ] **AUTH-02**: All app routes are protected by auth middleware — unauthenticated users redirected to /login
- [ ] **AUTH-03**: WhatsApp webhook endpoint remains publicly accessible (excluded from auth middleware)

### Admin Settings

- [ ] **SETTINGS-01**: Admin can view and update Kapso credentials (API key, Phone Number ID, WABA ID) through an in-app settings page
- [ ] **SETTINGS-02**: Credentials stored in Supabase Postgres with Row Level Security, persisting across redeployments
- [ ] **SETTINGS-03**: All existing Kapso API routes use a getConfig() utility that reads credentials from DB instead of process.env

### Branding

- [ ] **BRAND-01**: App displays Maissi Beauty Shop name and logo in the UI header

### Deployment

- [ ] **DEPLOY-01**: App deployed to Vercel with Supabase backend (auth + database)
- [ ] **DEPLOY-02**: 2-3 team member accounts created and verified working

### Preserved

- [ ] **PRESERVE-01**: All existing WhatsApp inbox features preserved (messaging, templates, media, read receipts, 24-hour window enforcement)

---

## v2 Requirements (Deferred)

- Quick replies / canned responses — highest ROI for daily staff workflow
- Customer notes / internal annotations — per-contact notes visible to team only
- Appointment reminder templates — scheduled WhatsApp template messages
- Customer labels / tags — tag contacts for filtering (VIP, new client, etc.)
- Message search — find past messages by keyword or phone number

---

## Out of Scope

- Multi-shop / multi-account support — single business only
- Direct Meta WhatsApp API integration — using Kapso as the API layer
- Role-based permissions (RBAC) — all team members have equal access
- Full UI redesign — minimal branding only (name + logo)
- Customer-facing features (booking widgets, portals) — staff tool only
- Push notifications — auto-polling covers the use case

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FORK-01 | Phase 1 | Complete |
| FORK-02 | Phase 1 | Complete |
| FORK-03 | Phase 1 | Complete |
| AUTH-01 | Phase 2 | Complete |
| AUTH-02 | Phase 2 | Complete |
| AUTH-03 | Phase 2 | Complete |
| SETTINGS-01 | Phase 3 | Pending |
| SETTINGS-02 | Phase 3 | Pending |
| SETTINGS-03 | Phase 3 | Pending |
| PRESERVE-01 | Phase 4 | Pending |
| BRAND-01 | Phase 5 | Pending |
| DEPLOY-01 | Phase 6 | Pending |
| DEPLOY-02 | Phase 6 | Pending |

---
*Last updated: 2026-02-18 after roadmap creation*
