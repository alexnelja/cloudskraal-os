# Cloudskraal CapEx — Full Codebase Audit

**Date:** 2026-04-20
**Auditors:** 5 parallel review agents (Architecture, Database, UI, UX, Security)
**Test status at time of audit:** 331 frontend + 198 backend = 529 tests, all green

---

## CRITICAL / P0 — Fix Immediately

| ID | Domain | Finding | Status |
|----|--------|---------|--------|
| S-C1 | Security | Live secrets in `backend/data/.env` — Google API key, Turso token, Supabase service key, DB password | |
| S-H1 | Security | Zero authentication on any endpoint — backend publicly reachable on Render | |
| S-H3 | Security | Mermaid `securityLevel: 'loose'` — SVG injection via wiki bypasses DOMPurify | |
| A-1 | Architecture | FarmMapPage 800+ lines — aggregates everything in one component | |
| A-4 | Architecture | TaskManagerPage 622 lines — 10+ useCallbacks, all logic inline | |
| DB-1 | Database | No migration version table — 20+ PRAGMA probes on every cold start | |
| DB-3 | Database | N+1 `refreshFieldCurrent` loop — 102 sequential DB writes per GET /fields | |
| UX-1 | UX | Tasks missing from mobile bottom nav — blocks primary mobile use case | |
| UX-4 | UX | TaskDetailSheet doesn't save tag changes — silent data loss | |
| UI-1 | UI | Dual icon libraries (Lucide sidebar vs Phosphor everywhere) — jarring | |
| UI-2 | UI | Global CSS input override fights component-level styles | |

## HIGH / P1 — Fix Before Release

| ID | Domain | Finding | Status |
|----|--------|---------|--------|
| S-H2 | Security | `xlsx` dep unfixed prototype pollution + ReDoS — migrate to exceljs | |
| S-H4 | Security | Vite path traversal CVEs in dev server | |
| S-M1 | Security | WikiLinkPreview renders unsanitized markdown HTML | |
| S-M2 | Security | cm-widgets.ts sets innerHTML from raw API data | |
| S-M3 | Security | No rate limiting on any endpoint | |
| S-M4 | Security | No input validation/schema enforcement on POST bodies | |
| A-2 | Architecture | Inconsistent error handling — no centralized middleware | |
| A-3 | Architecture | No API type safety at boundaries — query params not validated | |
| A-7 | Architecture | Frontend API layer has no caching/invalidation | |
| DB-2 | Database | Missing indexes on `fields(farm_id, enterprise)` | |
| DB-4 | Database | Missing indexes on inventory_transactions, time_entries, financial_transactions | |
| DB-10 | Database | DELETE /task-statuses will FK-violation if tasks reference it | |
| UX-2 | UX | "More" bottom nav mislabeled — navigates to CapEx, not module list | |
| UX-3 | UX | Tag filter click silently discarded — no filter applied | |
| UX-5 | UX | FAB quick-create strips all metadata | |
| UX-F1 | UX | No undo on non-COP task completion | |
| UX-F2 | UX | TaskDetailSheet field ordering wrong for mobile | |
| UI-3 | UI | 4 different accent colors (amber, emerald, blue, black) | |
| UI-4 | UI | ListView mismatched design language | |
| UI-5 | UI | Popovers have no click-outside dismiss | |
| UI-6 | UI | Smart list card counts in gray instead of accent color | |
| UI-7 | UI | InlineTaskAdd toolbar icons undiscoverable — no labels/tooltips | |
| UI-8 | UI | 9px text on notification badges — below WCAG minimum | |

## MEDIUM / P2 — Fix Soon

| ID | Domain | Finding | Status |
|----|--------|---------|--------|
| A-5 | Architecture | calendar.js handles events AND tasks — semantic mixing | |
| A-6 | Architecture | Schema initialization has no rollback mechanism | |
| A-8 | Architecture | Weather/notification logic in page component, not service layer | |
| DB-8 | Database | production_batches.source_field_ids is TEXT array — unnormalized | |
| DB-11 | Database | Wiki migration probes run before table creation | |
| DB-12 | Database | Missing busy_timeout and synchronous pragmas | |
| UX-F3 | UX | Weather popover doesn't show which tasks are blocked | |
| UX-F4 | UX | GPS field detection has no onboarding hint | |
| UX-F5 | UX | Sidebar collapsed width doesn't sync with main content margin | |
| UX-O1 | UX | No "Add Task" button in Map FieldPanel | |
| UX-O4 | UX | Task rows don't show enterprise color dot | |
| UX-O5 | UX | Estimated minutes — farm workers think in hours/days | |
| UI-P2 | UI | Dark mode needs substantial work — all colors hardcoded | |
| UI-P3 | UI | Missing: skeleton loaders, unified toast, empty-state illustrations | |
| UI-P4 | UI | Spacing inconsistency (px-3 vs px-5) | |

## LOW / P3 — Nice to Have

| ID | Domain | Finding | Status |
|----|--------|---------|--------|
| A-9 | Architecture | Unused @supabase/supabase-js dependency | |
| A-10 | Architecture | Magic numbers (86400000ms) and hardcoded strings | |
| A-11 | Architecture | Inconsistent naming (camelCase vs snake_case) | |
| DB-13 | Database | No cache_size pragma for geometry-heavy reads | |
| DB-7 | Database | wiki_audit_log uses AUTOINCREMENT (only table) | |
| UX-O2 | UX | Calendar and Tasks parallel systems with no cross-link | |
| UX-O3 | UX | Empty state in TodayView passive — could suggest seasonal tasks | |
