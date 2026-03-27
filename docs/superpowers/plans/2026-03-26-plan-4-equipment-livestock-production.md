# Phase 2: Equipment + Livestock + Production

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Equipment Register (tractors, cutters, vehicles with maintenance schedules), Livestock Tracker (sheep flocks, breeding seasons, shearing records), and Production & Batches (rooibos processing pipeline with batch traceability from field to sale).

**Architecture:** Add 10 new tables to existing SQLite schema. Follow established patterns (schema-X.js, seed-X.js, routes/X.js). Frontend pages follow CalendarPage/WikiPage patterns with list + detail views.

**Tech Stack:** Same as Phase 1 — Express, SQLite, React 19, TypeScript, Tailwind CSS 4, Recharts, Lucide React

---

## File Structure

### Backend — New Files
| File | Responsibility |
|------|---------------|
| `backend/src/db/schema-phase2.js` | equipment, maintenance_logs, livestock_groups, livestock_records, breeding_seasons, shearing_records, production_batches, processing_steps, quality_tests, sales |
| `backend/src/db/seed-phase2.js` | Seed equipment from Notion data, livestock groups, example batches |
| `backend/src/routes/equipment.js` | Equipment CRUD + maintenance logs |
| `backend/src/routes/livestock.js` | Livestock groups, records, breeding, shearing |
| `backend/src/routes/production.js` | Batches, processing steps, quality, sales |

### Frontend — New Files
| File | Responsibility |
|------|---------------|
| `frontend/src/pages/EquipmentPage.tsx` | Equipment list + detail |
| `frontend/src/pages/LivestockPage.tsx` | Livestock groups + breeding + shearing |
| `frontend/src/pages/ProductionPage.tsx` | Batch pipeline + processing steps |
| `frontend/src/types/phase2.ts` | All Phase 2 types |
| `frontend/src/api/equipment.ts` | Equipment API client |
| `frontend/src/api/livestock.ts` | Livestock API client |
| `frontend/src/api/production.ts` | Production API client |

---

## Task 1: Backend — Phase 2 Schema (all 10 tables)

Create `backend/src/db/schema-phase2.js` with all tables from the spec (Section 3.5-3.7).

Tables:
- equipment, maintenance_logs
- livestock_groups, livestock_records, breeding_seasons, shearing_records
- production_batches, processing_steps, quality_tests, sales

Wire into schema.js.

## Task 2: Backend — Phase 2 Seed Data

Create `backend/src/db/seed-phase2.js`:

**Equipment (from Notion Rooibos/Mechanical dept data):**
- 3x Bovic Cutter (Garsland) — type: processing, make: Bovic
- 2x Bovic Cutter (Cloudskraal) — type: processing, make: Bovic
- 2x Victor Cutter — type: processing, make: Victor
- Massey Ferguson Tractor — type: tractor
- Toyota Hilux — type: vehicle
- Forklift (Garsland) — type: equipment
- Sifting Machine — type: processing
- Platform Scale (Masatec) — type: equipment
- Each with purchase dates, estimated values, next service dates

**Livestock groups:**
- Breeding Ewes 2025 — species: sheep, breed: merino, head_count: 450
- Replacement Rams — species: sheep, breed: merino, head_count: 15
- Trading Lambs — species: sheep, breed: merino, head_count: 120
- Young Ewes — species: sheep, breed: merino, head_count: 80

**Breeding season 2025:**
- joining_start: 2025-12-03, ewes_joined: 450, rams_used: 15
- scanning results, lambing dates, weaning (reasonable estimates)

**Shearing record 2025:**
- date: 2025-09-15, head_shorn: 580, total_fleece_kg: 2610
- avg 4.5kg/head, 19.5 micron, 65% yield

**Production batches:**
- BF-2026-001: rooibos batch from Cloudskraal fields, 8,000kg, status: stored, grade: Choice
- BF-2026-002: rooibos batch from Glenridge, 12,000kg, status: processing
- WC-2026-001: wool clip, 2,610kg, status: sold
- Each with processing steps showing the rooibos workflow

**Sales:**
- CNAS purchase of BF-2026-001, R40/kg, R320,000
- BKB wool sale, R249/kg clean, R650,000

## Task 3: Backend — Equipment Routes

```
GET/POST/PATCH/DELETE  /api/equipment[/:id]
GET/POST               /api/equipment/:id/maintenance
GET                    /api/equipment/alerts  → equipment with overdue maintenance
```

## Task 4: Backend — Livestock Routes

```
GET/POST/PATCH/DELETE  /api/livestock/groups[/:id]  (include record counts)
GET/POST               /api/livestock/groups/:id/records
GET/POST/PATCH         /api/livestock/breeding-seasons[/:id]
GET/POST               /api/livestock/shearing[/:id]
GET                    /api/livestock/dashboard  → summary stats (total head, upcoming events)
```

## Task 5: Backend — Production Routes

```
GET/POST/PATCH/DELETE  /api/production/batches[/:id]  (include steps, quality, sales)
GET/POST               /api/production/batches/:id/steps
GET/POST               /api/production/batches/:id/quality
GET/POST/PATCH         /api/sales[/:id]
GET                    /api/production/dashboard  → pipeline summary (batches by status)
```

## Task 6: Frontend — Types + API Clients

Create `types/phase2.ts` and three API client files with all types and functions.

## Task 7: Frontend — Equipment Page

List view: table of equipment with type icon, name, status badge, next service date (red if overdue), current value.
Detail: info card + maintenance log timeline + "Log Maintenance" button.
Dashboard cards: total equipment count, total value, overdue maintenance count.

## Task 8: Frontend — Livestock Page

Overview: cards per group (Breeding Ewes, Rams, Lambs, Young Ewes) with head count and current field.
Breeding tracker: timeline showing joining → scanning → lambing → weaning with metrics.
Shearing records: table with date, head shorn, total kg, micron, price.
KPIs: total head, lambing %, weaning %, avg wool/head.

## Task 9: Frontend — Production Page

**Batch pipeline** — Kanban-style columns: Received → Processing → Graded → Stored → Sold.
Each batch card: batch code, product type, quantity, source fields, quality grade.
Click batch → detail with processing steps timeline, quality test results, sale info.
Processing step detail: timestamps, input/output quantities, loss %, parameters.
Dashboard: total kg in pipeline by status, revenue from sales.

## Task 10: App.tsx + Sidebar + Dashboard Updates

- Add routes: /equipment, /livestock, /production
- Add to Sidebar: Equipment (Wrench), Livestock (Sheep icon or Bug), Production (Factory)
- Update BottomNav "More" to show all modules
- Add Phase 2 summary cards to Dashboard
