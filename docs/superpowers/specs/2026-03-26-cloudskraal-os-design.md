# Cloudskraal OS — Design Specification

**Date:** 2026-03-26
**Author:** Alex Nel + Claude
**Status:** Draft for review
**Stack:** React 19 + Vite 8 + Tailwind 4 + MapLibre GL JS | Express + SQLite (better-sqlite3) | Zero running cost

## 1. Executive Summary

Cloudskraal OS is a full farm management operating system for Cloudskraal Boerderye — a multi-enterprise rooibos, wine, and sheep operation across 4 farms (8,184 ha) in the Nieuwoudtville/Bokkeveld region of South Africa.

The system extends the existing CapEx evaluation app (Express/SQLite backend + React frontend) into a comprehensive farm OS with 10 modules, built mobile-first with zero running costs.

**Core principle:** Build for Alex (single power user), design for the whole team (multi-user ready).

### What exists today
- 22 CapEx projects with NPV/IRR/WACC financial engine
- 128 field boundaries from fieldmargin (GeoJSON)
- 53 rooibos fields with 20 years production history (Johan Brand Oeskatting)
- 56 Notion extract files (departments, employees, farms, calendars, tasks)
- 6 years audited financial statements
- Strategic documents: tax restructure, family constitution, 10-year growth plan
- Research: farm management platforms, Elsenburg enterprise data, Cape Farm Mapper GIS services

### 10 Modules (phased rollout)

| Phase | Module | Priority |
|-------|--------|----------|
| 1 | Farm Map (fieldmargin-style + GIS overlays) | P0 |
| 1 | Seasonal Calendar & Task Engine | P0 |
| 1 | Farm Wiki & Knowledge Graph | P0 |
| 2 | Equipment Register | P1 |
| 2 | Livestock Tracker | P1 |
| 2 | Production & Batches | P1 |
| 3 | Employee & Labor | P2 |
| 3 | Asset & Property Register | P2 |
| 3 | Inputs & Inventory | P2 |
| 3 | Financial Overview (Xero/QB integration) | P2 |
| Existing | CapEx Evaluation | Done |

## 2. Architecture

### 2.1 Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | React 19 + TypeScript + Vite 8 + Tailwind CSS 4 | Already in place, fast, responsive |
| Map | MapLibre GL JS (open-source) | Free (no Mapbox token needed), supports ArcGIS tile layers |
| Charts | Recharts 3.8 | Already in place |
| Tables | TanStack Table 8 | Already in place |
| Backend | Express.js + Node.js | Already in place |
| Database | SQLite via better-sqlite3 | Zero cost, single file, fast for single-user |
| Routing | React Router 7 | Already in place |
| Icons | Lucide React | Already in place |
| Wiki rendering | markdown-it + custom [[wiki-link]] parser | Lightweight, extensible |
| Graph visualization | d3-force or vis-network | For wiki knowledge graph view |

### 2.2 Project Structure

```
cloudskraal-capex/
├── backend/
│   ├── src/
│   │   ├── index.js                    # Express server (port 3001)
│   │   ├── db/
│   │   │   ├── schema.js              # All table definitions
│   │   │   ├── seed.js                # CapEx seed (existing)
│   │   │   ├── seed-farms.js          # Farm/field/production seed
│   │   │   ├── seed-calendar.js       # Seasonal calendar seed
│   │   │   └── seed-wiki.js           # Wiki content seed
│   │   ├── routes/
│   │   │   ├── dashboard.js           # Existing
│   │   │   ├── projects.js            # Existing (CapEx)
│   │   │   ├── farms.js               # Farms & fields
│   │   │   ├── calendar.js            # Calendar & tasks
│   │   │   ├── equipment.js           # Equipment register
│   │   │   ├── livestock.js           # Livestock tracker
│   │   │   ├── production.js          # Production & batches
│   │   │   ├── employees.js           # Employee & labor
│   │   │   ├── inventory.js           # Inputs & inventory
│   │   │   └── wiki.js               # Farm wiki
│   │   └── services/
│   │       ├── financial.js           # Existing NPV/IRR engine
│   │       └── wiki-links.js          # Wiki link parser
│   └── data/
│       └── capex.db                   # SQLite database (all modules)
├── frontend/
│   ├── src/
│   │   ├── App.tsx                    # Router with all module routes
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx        # Desktop sidebar navigation
│   │   │   │   ├── BottomNav.tsx      # Mobile bottom tab navigation
│   │   │   │   └── AppShell.tsx       # Responsive shell (sidebar vs bottom nav)
│   │   │   ├── map/
│   │   │   │   ├── FarmMap.tsx        # MapLibre map component
│   │   │   │   ├── FieldPolygon.tsx   # Field polygon layer
│   │   │   │   ├── FieldPanel.tsx     # Slide-out field detail panel
│   │   │   │   ├── LayerControl.tsx   # GIS layer toggles
│   │   │   │   └── FieldNote.tsx      # GPS-pinned note marker
│   │   │   ├── calendar/
│   │   │   │   ├── CalendarView.tsx   # Month/quarter/year views
│   │   │   │   ├── TaskCard.tsx       # Task with status, deps, inputs
│   │   │   │   ├── TaskEditor.tsx     # Create/edit task
│   │   │   │   └── GanttView.tsx      # Timeline/dependency view
│   │   │   ├── wiki/
│   │   │   │   ├── WikiPage.tsx       # Markdown render with [[links]]
│   │   │   │   ├── WikiEditor.tsx     # Markdown editor
│   │   │   │   ├── WikiGraph.tsx      # Force-directed graph view
│   │   │   │   └── WikiSearch.tsx     # Full-text search
│   │   │   └── shared/               # Existing components (MetricCard, etc.)
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx          # Operational command center (existing, enhanced)
│   │   │   ├── FarmMapPage.tsx        # Full-screen map
│   │   │   ├── CalendarPage.tsx       # Calendar & tasks
│   │   │   ├── WikiPage.tsx           # Farm wiki
│   │   │   ├── CapExPage.tsx          # Existing modules (Projects, Compare, etc.)
│   │   │   ├── EquipmentPage.tsx      # Phase 2
│   │   │   ├── LivestockPage.tsx      # Phase 2
│   │   │   ├── ProductionPage.tsx     # Phase 2
│   │   │   ├── EmployeesPage.tsx      # Phase 3
│   │   │   ├── AssetsPage.tsx         # Phase 3
│   │   │   ├── InventoryPage.tsx      # Phase 3
│   │   │   └── FinancialsPage.tsx     # Phase 3
│   │   ├── api/
│   │   │   ├── client.ts             # Existing API client
│   │   │   ├── farms.ts              # Farm/field API
│   │   │   ├── calendar.ts           # Calendar/task API
│   │   │   └── wiki.ts              # Wiki API
│   │   ├── types/
│   │   │   ├── index.ts             # Existing CapEx types
│   │   │   ├── farm.ts              # Farm/field types
│   │   │   ├── calendar.ts          # Calendar/task types
│   │   │   └── wiki.ts             # Wiki types
│   │   └── utils/
│   │       ├── format.ts            # Existing formatters
│   │       └── geo.ts              # GeoJSON utilities
```

### 2.3 Responsive Design Strategy

```
Mobile (< 768px):
┌─────────────────────────┐
│  [Content area]         │
│  Full-screen map or     │
│  scrollable list views  │
│                         │
│  Slide-up panels for    │
│  field details, task    │
│  editing, etc.          │
│                         │
├─────────────────────────┤
│  Map  Cal  Home Wiki More│
└─────────────────────────┘

Desktop (≥ 768px):
┌────────┬────────────────────────┐
│  Home  │  [Content area]       │
│  Map   │  Map with side panel  │
│  Cal   │  or full-width tables │
│  Wiki  │  and charts           │
│  CapEx │                       │
│  Equip │                       │
│  Stock │                       │
│  More  │                       │
└────────┴────────────────────────┘
```

Key responsive patterns:
- Map: full-screen on mobile, sidebar+map on desktop
- Field detail: slide-up bottom sheet on mobile, side panel on desktop
- Tables: horizontal scroll on mobile, full-width on desktop
- Navigation: bottom tabs on mobile (5 primary), sidebar on desktop (all modules)
- Touch targets: minimum 44px on mobile
- Wiki: single-column read on mobile, content+graph split on desktop

### 2.4 Navigation & Routing

```
/                          → Dashboard (operational command center)
/map                       → Farm Map
/map/:fieldId             → Farm Map focused on specific field
/calendar                  → Calendar view (month)
/calendar/tasks           → Task list view
/calendar/tasks/:id       → Task detail
/wiki                     → Wiki home / search
/wiki/:slug              → Wiki page
/wiki/graph              → Knowledge graph view
/capex                    → CapEx dashboard (existing)
/capex/projects           → Projects list (existing)
/capex/projects/:id       → Project detail (existing)
/capex/compare            → Compare projects (existing)
/equipment                → Equipment register (Phase 2)
/livestock                → Livestock tracker (Phase 2)
/production               → Production & batches (Phase 2)
/employees                → Employee & labor (Phase 3)
/assets                   → Asset register (Phase 3)
/inventory                → Inputs & inventory (Phase 3)
/financials               → Financial overview (Phase 3)
```

## 3. Database Schema

### 3.1 Existing Tables (unchanged)
```sql
projects, cash_flows, scenarios  -- CapEx module
```

### 3.2 Phase 1: Farm Map

```sql
CREATE TABLE farms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE,              -- 'cloudskraal', 'glenridge', 'biekoes', 'garsland', 'meulsteenvlei', 'kromvlei'
  type TEXT NOT NULL DEFAULT 'owned',  -- owned, leased, prospect
  total_ha REAL,
  lat REAL,
  lng REAL,
  region TEXT,                   -- 'Northern Cape', 'Western Cape'
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE fields (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farms(id),
  name TEXT NOT NULL,
  code TEXT,                     -- 'C9', 'G3', 'B2', 'GA5', 'KV 1'
  enterprise TEXT NOT NULL DEFAULT 'unclassified',  -- rooibos, wine, sheep, buchu, sceletium, grazing, fallow, other
  crop_type TEXT,                -- 'rooibos', 'chenin_blanc', 'sauvignon_blanc', 'merino', 'buchu', 'alfalfa'
  area_ha REAL,
  planted_year TEXT,             -- '2022', '2026', 'Braak' (fallow)
  status TEXT DEFAULT 'active',  -- active, fallow, replanting, withholding, retired
  geometry TEXT NOT NULL,        -- GeoJSON geometry as JSON string
  soil_type TEXT,
  irrigation_type TEXT,          -- dryland, drip, pivot, none
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE field_production (
  id TEXT PRIMARY KEY,
  field_id TEXT NOT NULL REFERENCES fields(id),
  year INTEGER NOT NULL,
  estimated_yield_kg REAL,       -- OESSKAT column
  actual_yield_kg REAL,          -- WERKLIK column
  notes TEXT,
  UNIQUE(field_id, year)
);

CREATE TABLE field_notes (
  id TEXT PRIMARY KEY,
  field_id TEXT REFERENCES fields(id),  -- nullable for free-standing notes
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  title TEXT,
  body TEXT,
  photo_path TEXT,               -- local file path or base64
  tags TEXT,                     -- JSON array
  created_by TEXT,
  created_at TEXT NOT NULL
);

-- GIS layer preferences (which layers are toggled on)
CREATE TABLE map_layers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_type TEXT NOT NULL,     -- arcgis_tiles, wms, geojson
  category TEXT,                 -- soils, climate, vegetation, geology, water, boundaries
  visible INTEGER DEFAULT 0,
  opacity REAL DEFAULT 0.7,
  z_index INTEGER DEFAULT 0
);
```

### 3.3 Phase 1: Seasonal Calendar & Tasks

```sql
CREATE TABLE calendar_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  enterprise TEXT,               -- rooibos, wine, sheep, all
  start_date TEXT NOT NULL,
  end_date TEXT,
  all_day INTEGER DEFAULT 1,
  recurrence_rule TEXT,          -- 'YEARLY', 'MONTHLY', or null for one-off
  color TEXT,                    -- hex color for calendar display
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  enterprise TEXT,               -- rooibos, wine, sheep, farm, all
  field_id TEXT REFERENCES fields(id),
  type TEXT NOT NULL DEFAULT 'manual',  -- scheduled, triggered, dependent, manual
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, in_progress, completed, skipped, overdue
  priority TEXT DEFAULT 'medium',  -- low, medium, high, urgent
  due_date TEXT,
  completed_date TEXT,
  completed_by TEXT,
  assigned_to TEXT,
  depends_on_task_id TEXT REFERENCES tasks(id),  -- blocked until this task completes
  recurrence_rule TEXT,          -- 'YEARLY:month:day', 'AFTER_COMPLETION:days', etc.
  auto_schedule_trigger TEXT,    -- JSON: conditions that auto-create this task
  calendar_event_id TEXT REFERENCES calendar_events(id),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE task_inputs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  category TEXT,                 -- fertilizer, herbicide, pesticide, fungicide, seed, feed, other
  rate REAL,
  rate_unit TEXT,                -- kg/ha, L/ha, mL/L, etc.
  total_applied REAL,
  total_unit TEXT,               -- kg, L, units
  cost_per_unit REAL,
  total_cost REAL,
  notes TEXT
);

CREATE TABLE task_checklists (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  checked INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);
```

### 3.4 Phase 1: Farm Wiki

```sql
CREATE TABLE wiki_pages (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,     -- URL-friendly: 'rooibos-cultivation', 'phytophthora-root-rot'
  title TEXT NOT NULL,
  body TEXT NOT NULL,            -- Markdown content with [[wiki-links]]
  category TEXT,                 -- enterprise, input, pest, equipment, process, compliance, general
  enterprise TEXT,               -- rooibos, wine, sheep, buchu, sceletium, farm, all
  tags TEXT,                     -- JSON array: ['cultivation', 'soil', 'ph']
  pinned INTEGER DEFAULT 0,     -- pinned to top of wiki home
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE wiki_links (
  id TEXT PRIMARY KEY,
  source_page_id TEXT NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
  target_page_id TEXT NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
  UNIQUE(source_page_id, target_page_id)
);

-- Tracks references from wiki pages to other entities
CREATE TABLE wiki_references (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
  ref_type TEXT NOT NULL,        -- field, equipment, input_product, task, employee
  ref_id TEXT NOT NULL           -- ID of the referenced entity
);
```

### 3.5 Phase 2: Equipment Register

```sql
CREATE TABLE equipment (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,                     -- asset tag / fleet number
  type TEXT NOT NULL,            -- tractor, implement, vehicle, processing, irrigation, tool, other
  make TEXT,
  model TEXT,
  year INTEGER,
  farm_id TEXT REFERENCES farms(id),
  department TEXT,
  purchase_date TEXT,
  purchase_price REAL,
  current_value REAL,
  depreciation_method TEXT DEFAULT 'straight_line',
  useful_life_years INTEGER,
  salvage_value REAL,
  status TEXT DEFAULT 'active',  -- active, maintenance, retired, sold
  hours_meter REAL,
  odometer_km REAL,
  next_service_date TEXT,
  next_service_hours REAL,
  notes TEXT,
  photo_path TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE maintenance_logs (
  id TEXT PRIMARY KEY,
  equipment_id TEXT NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  type TEXT NOT NULL,            -- scheduled, breakdown, cleaning, inspection
  date TEXT NOT NULL,
  description TEXT,
  cost REAL,
  performed_by TEXT,
  hours_at_service REAL,
  parts_used TEXT,               -- JSON array: [{name, quantity, cost}]
  next_due_date TEXT,
  next_due_hours REAL,
  notes TEXT,
  created_at TEXT NOT NULL
);
```

### 3.6 Phase 2: Livestock Tracker

```sql
CREATE TABLE livestock_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,            -- 'Breeding Ewes 2025', 'Replacement Rams', 'Trading Lambs'
  enterprise TEXT DEFAULT 'sheep',
  species TEXT NOT NULL,         -- sheep, cattle, goats
  breed TEXT,                    -- merino, dohne_merino, dorper
  management_type TEXT,          -- breeding, trading, stud
  head_count INTEGER NOT NULL DEFAULT 0,
  current_field_id TEXT REFERENCES fields(id),
  average_weight_kg REAL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE livestock_records (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES livestock_groups(id),
  record_type TEXT NOT NULL,     -- weight, treatment, vaccination, dosing, pregnancy_scan,
                                 -- joining, lambing, weaning, shearing, movement, sale,
                                 -- purchase, death, cull, condition_score
  date TEXT NOT NULL,
  details TEXT,                  -- JSON: type-specific data
  head_count INTEGER,            -- how many animals affected
  field_id TEXT REFERENCES fields(id),
  product_used TEXT,             -- for treatments/vaccinations
  cost REAL,
  recorded_by TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE breeding_seasons (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES livestock_groups(id),
  year INTEGER NOT NULL,
  joining_start TEXT,
  joining_end TEXT,
  rams_used INTEGER,
  ewes_joined INTEGER,
  scanning_date TEXT,
  pregnant_count INTEGER,
  dry_count INTEGER,
  singles_count INTEGER,
  twins_count INTEGER,
  triplets_count INTEGER,
  lambing_start TEXT,
  lambing_end TEXT,
  born_count INTEGER,
  survived_count INTEGER,
  weaned_count INTEGER,
  weaning_date TEXT,
  weaning_percentage REAL,       -- computed: weaned / ewes_joined * 100
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE shearing_records (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES livestock_groups(id),
  date TEXT NOT NULL,
  head_shorn INTEGER,
  total_fleece_kg REAL,
  avg_fleece_kg REAL,            -- computed
  micron_avg REAL,
  yield_pct REAL,
  vegetable_matter REAL,
  staple_length_mm REAL,
  grade TEXT,
  buyer TEXT,
  price_per_kg REAL,
  total_revenue REAL,
  notes TEXT,
  created_at TEXT NOT NULL
);
```

### 3.7 Phase 2: Production & Batches

```sql
CREATE TABLE production_batches (
  id TEXT PRIMARY KEY,
  batch_code TEXT UNIQUE NOT NULL,  -- 'BF-2026-042', 'WC-2026-001'
  enterprise TEXT NOT NULL,          -- rooibos, wine, wool
  product_type TEXT,                 -- rooibos_green, rooibos_oxidized, wine_bulk, wool_clip
  source_field_ids TEXT,             -- JSON array of field IDs
  harvest_date_start TEXT,
  harvest_date_end TEXT,
  initial_quantity_kg REAL,
  current_quantity_kg REAL,
  status TEXT DEFAULT 'received',    -- received, processing, graded, stored, sold, shipped
  quality_grade TEXT,
  storage_location TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE processing_steps (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  step_type TEXT NOT NULL,           -- cutting, bruising, oxidation, drying, sifting, grading, packing
                                     -- crushing, pressing, fermentation, racking, fining, bottling
                                     -- shearing, classing, pressing_wool, baling
  start_datetime TEXT,
  end_datetime TEXT,
  facility TEXT,
  equipment_id TEXT REFERENCES equipment(id),
  operator TEXT,
  input_quantity_kg REAL,
  output_quantity_kg REAL,
  loss_kg REAL,
  loss_reason TEXT,
  parameters TEXT,                   -- JSON: temperature, humidity, duration, etc.
  quality_check_passed INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE quality_tests (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES production_batches(id),
  test_type TEXT,                    -- sensory, chemical, physical, microbiological
  test_date TEXT NOT NULL,
  tested_by TEXT,
  results TEXT,                      -- JSON: moisture_pct, colour_score, aroma_score, etc.
  pass_fail TEXT,
  certificate_number TEXT,
  lab_reference TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE sales (
  id TEXT PRIMARY KEY,
  batch_id TEXT REFERENCES production_batches(id),
  customer TEXT NOT NULL,
  quantity_kg REAL,
  unit_price REAL,
  total_amount REAL,
  currency TEXT DEFAULT 'ZAR',
  export_destination TEXT,
  invoice_number TEXT,
  shipped_date TEXT,
  paid_date TEXT,
  status TEXT DEFAULT 'pending',     -- pending, invoiced, shipped, paid
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 3.8 Phase 3: Employees & Labor

```sql
CREATE TABLE employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  id_number TEXT,
  type TEXT NOT NULL,                -- permanent, seasonal, contractor
  department TEXT,
  role TEXT,
  farm_id TEXT REFERENCES farms(id),
  hourly_rate REAL,
  monthly_salary REAL,
  start_date TEXT,
  end_date TEXT,
  status TEXT DEFAULT 'active',      -- active, inactive, terminated
  phone TEXT,
  emergency_contact TEXT,
  notes TEXT,
  photo_path TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE time_entries (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  date TEXT NOT NULL,
  clock_in TEXT,
  clock_out TEXT,
  hours_worked REAL,
  activity_type TEXT,                -- field_work, processing, maintenance, admin, livestock
  enterprise TEXT,
  field_id TEXT REFERENCES fields(id),
  task_id TEXT REFERENCES tasks(id),
  notes TEXT,
  created_at TEXT NOT NULL
);
```

### 3.9 Phase 3: Inputs & Inventory

```sql
CREATE TABLE input_products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,            -- fertilizer, herbicide, pesticide, fungicide, feed, seed, fuel, other
  unit_of_measure TEXT,              -- kg, L, units
  active_ingredients TEXT,
  withholding_period_days INTEGER,
  re_entry_interval_hours INTEGER,
  supplier TEXT,
  cost_per_unit REAL,
  storage_requirements TEXT,
  notes TEXT,
  wiki_page_id TEXT REFERENCES wiki_pages(id),  -- link to wiki article
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE inventory_stock (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES input_products(id),
  location TEXT,                     -- farm or storage name
  quantity_on_hand REAL,
  batch_number TEXT,
  expiry_date TEXT,
  last_updated TEXT NOT NULL
);

CREATE TABLE inventory_transactions (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES input_products(id),
  type TEXT NOT NULL,                -- purchase, usage, adjustment, transfer, disposal
  date TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_cost REAL,
  total_cost REAL,
  field_id TEXT REFERENCES fields(id),
  task_id TEXT REFERENCES tasks(id),
  recorded_by TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);
```

### 3.10 Phase 3: Financial Overview

```sql
CREATE TABLE enterprises (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                -- 'Rooibos', 'Wine/Grapes', 'Sheep/Wool', 'Tourism', 'Buchu'
  type TEXT,                         -- crop, livestock, processing, tourism, other
  entity TEXT,                       -- 'Cloudskraal Boerdery', 'Alexenya Produksie', etc.
  budget_year INTEGER,
  notes TEXT
);

CREATE TABLE financial_transactions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,                -- revenue, expense
  amount REAL NOT NULL,
  category TEXT,                     -- input_costs, labor, equipment, admin, sales, etc.
  enterprise_id TEXT REFERENCES enterprises(id),
  field_id TEXT REFERENCES fields(id),
  source_reference TEXT,             -- Xero invoice ID, bank statement ref
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE budgets (
  id TEXT PRIMARY KEY,
  enterprise_id TEXT NOT NULL REFERENCES enterprises(id),
  year INTEGER NOT NULL,
  category TEXT NOT NULL,
  jan REAL DEFAULT 0, feb REAL DEFAULT 0, mar REAL DEFAULT 0,
  apr REAL DEFAULT 0, may REAL DEFAULT 0, jun REAL DEFAULT 0,
  jul REAL DEFAULT 0, aug REAL DEFAULT 0, sep REAL DEFAULT 0,
  oct REAL DEFAULT 0, nov REAL DEFAULT 0, dec REAL DEFAULT 0,
  UNIQUE(enterprise_id, year, category)
);
```

## 4. API Routes

### 4.1 Existing (unchanged)
```
GET/POST/PATCH/DELETE  /api/projects[/:id]
GET/PUT                /api/projects/:id/cashflows
GET/POST/PATCH/DELETE  /api/projects/:id/scenarios[/:scenarioId]
GET                    /api/dashboard/stats
```

### 4.2 Phase 1: Farm Map
```
GET     /api/farms                      → Farm[]
GET     /api/farms/:id                  → Farm with fields
POST    /api/farms                      → Create farm
PATCH   /api/farms/:id                  → Update farm

GET     /api/fields                     → Field[] (with ?farm_id=, ?enterprise= filters)
GET     /api/fields/:id                 → Field with production history
POST    /api/fields                     → Create field
PATCH   /api/fields/:id                 → Update field
DELETE  /api/fields/:id                 → Delete field

GET     /api/fields/:id/production      → FieldProduction[] (20yr history)
PUT     /api/fields/:id/production      → Bulk update production data

GET     /api/fields/:id/notes           → FieldNote[]
POST    /api/fields/:id/notes           → Create note
DELETE  /api/field-notes/:id            → Delete note

GET     /api/map-layers                 → MapLayer[]
PATCH   /api/map-layers/:id             → Toggle visibility/opacity

GET     /api/map/geojson                → Full GeoJSON FeatureCollection (all fields with properties)
GET     /api/map/geojson?farm=cloudskraal  → Filtered by farm
GET     /api/map/geojson?enterprise=rooibos → Filtered by enterprise
```

### 4.3 Phase 1: Calendar & Tasks
```
GET     /api/calendar/events            → CalendarEvent[] (with ?month=, ?enterprise= filters)
POST    /api/calendar/events            → Create event
PATCH   /api/calendar/events/:id        → Update event
DELETE  /api/calendar/events/:id        → Delete event

GET     /api/tasks                      → Task[] (with ?status=, ?enterprise=, ?field_id= filters)
GET     /api/tasks/:id                  → Task with inputs and checklist
POST    /api/tasks                      → Create task
PATCH   /api/tasks/:id                  → Update task (including status changes)
DELETE  /api/tasks/:id                  → Delete task

POST    /api/tasks/:id/complete         → Mark task complete (auto-timestamp)
POST    /api/tasks/:id/inputs           → Add input to task
GET     /api/tasks/overdue              → Tasks past due date
GET     /api/tasks/upcoming?days=7      → Tasks due in next N days
```

### 4.4 Phase 1: Wiki
```
GET     /api/wiki                       → WikiPage[] summaries (with ?category=, ?enterprise=, ?search= filters)
GET     /api/wiki/:slug                 → Full wiki page with body and links
POST    /api/wiki                       → Create page
PATCH   /api/wiki/:slug                 → Update page (auto-parses [[links]])
DELETE  /api/wiki/:slug                 → Delete page

GET     /api/wiki/graph                 → {nodes: WikiPageSummary[], edges: WikiLink[]}
GET     /api/wiki/:slug/backlinks       → Pages that link TO this page
GET     /api/wiki/search?q=term         → Full-text search results
GET     /api/wiki/tags                  → All unique tags with counts
```

### 4.5 Phase 2 & 3 routes (brief)
```
-- Equipment
GET/POST/PATCH/DELETE  /api/equipment[/:id]
GET/POST               /api/equipment/:id/maintenance

-- Livestock
GET/POST/PATCH/DELETE  /api/livestock/groups[/:id]
GET/POST               /api/livestock/groups/:id/records
GET/POST/PATCH         /api/livestock/breeding-seasons[/:id]
GET/POST               /api/livestock/shearing[/:id]

-- Production
GET/POST/PATCH/DELETE  /api/production/batches[/:id]
GET/POST               /api/production/batches/:id/steps
GET/POST               /api/production/batches/:id/quality
GET/POST/PATCH         /api/sales[/:id]

-- Employees
GET/POST/PATCH/DELETE  /api/employees[/:id]
GET/POST               /api/employees/:id/time-entries

-- Inventory
GET/POST/PATCH/DELETE  /api/inventory/products[/:id]
GET                    /api/inventory/stock
POST                   /api/inventory/transactions

-- Financials
GET                    /api/financials/dashboard
GET                    /api/financials/enterprise/:id/pnl
GET/POST               /api/budgets[/:id]
GET                    /api/financials/budget-vs-actual
```

## 5. Module Designs

### 5.1 Farm Map (Phase 1)

**Layout:** Full-screen MapLibre map with collapsible sidebar (desktop) or bottom sheet (mobile).

**Map Features:**
- Satellite basemap from free tiles (OpenFreeMap, Esri World Imagery via ArcGIS REST)
- Field polygons from GeoJSON, color-coded by enterprise:
  - Rooibos: emerald green
  - Wine/Grapes: purple
  - Sheep/Grazing: amber/tan
  - Buchu: teal
  - Fallow: gray dashed outline
  - Meulsteenvlei: blue (acquired)
  - Kromvlei: orange dashed (prospect)
- Farm boundary outlines (dashed, toggle-able)
- Field labels (name + area)
- Click/tap field → detail panel slides in

**Field Detail Panel:**
- Field name, code, farm, enterprise
- Area (ha), planted year, status
- Production chart (20yr bar chart: estimated vs actual yield)
- Current season status
- Recent notes (with photos)
- Quick actions: Add Note, Create Task, View History
- Link to wiki page if one exists

**GIS Layer Control (toggle panel):**
- Soils (Elsenburg `Soils/MapServer`)
- Rainfall (Elsenburg `Climate/MapServer`)
- Vegetation (Elsenburg `Vegetation/MapServer`)
- Geology (Elsenburg `Geology/CGS_1M_Geology/MapServer`)
- Elevation/DEM (Elsenburg `Topography/SUDEM80/MapServer`)
- Soil Properties (ISRIC SoilGrids WMS — pH, clay, organic carbon)
- Cadastral Boundaries (Elsenburg `SG/MapServer`)
- Each layer: toggle on/off + opacity slider

**Map Controls:**
- Zoom to farm (dropdown: Cloudskraal, Glenridge, Biekoes, Garsland, Meulsteenvlei, Kromvlei)
- Filter by enterprise (checkboxes)
- Search field by name
- Current location (GPS on mobile)

### 5.2 Seasonal Calendar & Task Engine (Phase 1)

**Calendar View:**
- Month view (default): colored dots/blocks per enterprise
- Quarter view: Gantt-style bars for multi-day activities
- Year view: heatmap of activity density
- Filter by enterprise, farm, task type

**Task Types:**
1. **Scheduled** — auto-creates on a recurring schedule
   - Example: "Annual shearing" creates every September
   - Example: "Replant B2" auto-schedules in 2026 based on rotation year
2. **Triggered** — created when a condition is met
   - Example: When a field's production year count reaches 5, trigger "Evaluate replanting"
   - Example: When equipment hours exceed service interval, trigger "Service due"
3. **Dependent** — blocked until another task completes
   - Example: "Sifting" depends on "Drying complete"
   - Example: "Replanting" depends on "Soil amendment applied"
4. **Manual** — ad-hoc tasks created by the user

**Pre-loaded Calendar Events (seeded from Notion extracts):**

Rooibos:
- Garsland Factory Occupation (Nov 1)
- Start Rooibos Harvest (Jan 6)
- Harvest at Agterseland (Jan 16)
- Rooibos nursery setup (Feb)
- Seed sowing (Feb-Mar)
- Transplanting (May-Jul)

Sheep:
- Ramme by die Ooie / Joining (Dec 3)
- Ram removal (Dec 20)
- Lambing Season (May 17)
- Shearing (Sep-Oct)
- Dosing schedule (quarterly)

Wine:
- Check Grapes for Harvest (Mar 4)
- Grape Harvest (Mar 10)
- Pruning (Jul)

General:
- Khulani team begins (Jan 16)
- Soil preparation (Nov-Dec)
- Grain sowing (Apr)

**Task Detail:**
- Title, description, enterprise, field (linked)
- Due date, status, priority, assigned to
- Dependencies (visual: blocked by → this task → blocks)
- Input tracking: what products applied, at what rate, to which field
- Checklist (sub-tasks)
- Notes and photos
- Completion record (who, when, auto-timestamped)

### 5.3 Farm Wiki & Knowledge Graph (Phase 1)

**Wiki Page Structure:**
- Markdown body with `[[wiki-link]]` syntax → auto-creates links
- Category (enterprise, input, pest, equipment, process, compliance, general)
- Tags for cross-cutting topics
- References to other entities (fields, equipment, products)

**Wiki Graph View:**
- Force-directed graph (d3-force) showing pages as nodes, links as edges
- Node size = number of links (more connected = larger)
- Node color = category/enterprise
- Click node → navigate to page
- Filter by category, enterprise, tag
- Zoom/pan, responsive

**Pre-seeded Wiki Content (from research gathered):**

Enterprise guides:
- "Rooibos Cultivation" — soil pH, planting, rotation, harvest, yields
- "Sheep Management" — stocking rates, breeding cycle, wool, dosing
- "Wine Grapes — Olifants River" — cultivars, irrigation, yields
- "Buchu Cultivation" — pH requirements, propagation, oil extraction
- "Sceletium Pilot" — NEMBA requirements, cultivation guide

Processing:
- "Rooibos Processing" — cutting → oxidation → drying → sifting → grading
- "Wool Processing" — shearing → classing → baling
- "Wine Processing" — crushing → fermentation → racking

Pests & Diseases:
- "Clear-wing Moth" → links to Rooibos, treatment protocols
- "Leafhopper (Molopopterus theae)" → links to Rooibos
- "Phytophthora Root Rot" → links to Rooibos, drainage, soil

Compliance:
- "FSSC 22000" → links to Processing, Export, Quality
- "GlobalGAP" → links to Chemical Records, Traceability
- "IPW (Integrated Production of Wine)" → links to Wine, Spray Records
- "NEMBA Bioprospecting Permit" → links to Sceletium

Inputs:
- Each fertilizer, chemical, seed type gets a wiki page
- Links to fields where used, tasks where applied, withholding periods

Equipment:
- Major equipment gets a wiki page with operating procedures
- Links to maintenance schedules, fields where used

Farm Knowledge:
- "Nel Family Constitution" summary → links to governance
- "Tax Structure" → links to entities
- "Meulsteenvlei Acquisition" → links to financing, fields
- "Boland BRRRR Strategy" → links to property investment

**Search:** Full-text search across all wiki pages (SQLite FTS5 if available, or LIKE queries).

### 5.4–5.10 Phase 2 & 3 Modules (brief descriptions)

**Equipment Register (Phase 2):**
- List view: all equipment with status, location, next service
- Detail view: specs, purchase info, depreciation schedule, maintenance log
- Service alerts on dashboard
- Links to wiki pages for operating procedures

**Livestock Tracker (Phase 2):**
- Group overview: head count, current field, average weight
- Breeding season tracker: joining → scanning → lambing → weaning pipeline
- Shearing records with wool quality metrics
- Movement log (which field/camp)
- Health records (treatments, vaccinations, dosing)
- KPIs: lambing %, weaning %, wool/head, mortality

**Production & Batches (Phase 2):**
- Batch pipeline: visual kanban (received → processing → graded → stored → sold)
- Processing step log per batch
- Quality testing records
- Sales tracking per batch
- Traceability: batch → source fields → processing steps → quality tests → customer
- FSSC 22000 / PPECB compliance records attached to batches

**Employee & Labor (Phase 3):**
- Employee register with department, role, status
- Simple time entry (date, hours, activity, field/enterprise)
- Seasonal worker tracking
- Labor cost allocation by enterprise

**Asset & Property Register (Phase 3):**
- Farm properties with legal descriptions, valuations
- Facility register (processing sheds, warehouses, housing)
- Entity ownership mapping
- Valuation history

**Inputs & Inventory (Phase 3):**
- Product register with withholding periods, active ingredients
- Stock levels by location
- Purchase/usage transaction log
- Low stock alerts
- Links to wiki pages per product
- Links to tasks where products are applied

**Financial Overview (Phase 3):**
- Enterprise-level P&L dashboard
- Budget vs actual by month
- Revenue by enterprise chart
- Cash flow forecast
- Xero/QuickBooks API integration (pull transactions)
- Cost allocation rules (shared costs → enterprises)
- Existing CapEx module integrated as a tab

## 6. Seed Data Plan

### Phase 1 Seed Data

**Farms (6):**

| Farm | Code | Type | Ha |
|------|------|------|-----|
| Cloudskraal | cloudskraal | owned | 5,864 |
| Glenridge | glenridge | owned | 324 |
| Biekoes | biekoes | owned | 517 |
| Garsland | garsland | owned | 61 |
| Meulsteenvlei | meulsteenvlei | owned | 207 |
| Kromvlei | kromvlei | prospect | 507 |

**Fields (128):** From GeoJSON file, auto-tagged:
- 57 rooibos fields (matched via Oeskatting code prefix)
- 25 Meulsteenvlei fields (Pierre prefix → enterprise from name)
- 18 Kromvlei fields (KV prefix)
- 10 farm boundaries (CL prefix, area > 200ha → type: boundary)
- 18 other (wine, buchu, grazing, facilities)

**Production History:** 53 rooibos fields x 25 years (2004-2028) from Johan Brand Oeskatting.

**Calendar Events:** 13 seasonal events from Notion extract + standard rooibos/sheep/wine calendars from Elsenburg research.

**Wiki Pages:** ~30-40 pre-seeded pages from research:
- 5 enterprise guides
- 3 processing workflows
- 5 pest/disease pages
- 4 compliance pages
- 10+ input product pages
- 5+ farm knowledge pages

**Map Layers:** Pre-configured with Elsenburg/NDA/ISRIC endpoints (all toggled off by default, user enables as needed).

## 7. Non-Functional Requirements

### Performance
- Initial page load < 2s on 3G connection
- Map renders 128 polygons < 500ms
- SQLite queries < 50ms for standard operations
- GeoJSON served pre-computed (not computed per request)

### Responsive Breakpoints
- Mobile: < 768px (bottom nav, slide-up panels, full-screen map)
- Tablet: 768-1024px (collapsible sidebar, side panels)
- Desktop: > 1024px (persistent sidebar, split views)

### Data Safety
- SQLite WAL mode (crash-safe)
- Database file easily backed up (single file copy)
- No external dependencies for core functionality
- GIS layers are optional overlays (app works without internet for local data)

### Future Migration Path
- Schema designed to lift directly to Supabase (Postgres)
- API structure compatible with Supabase client
- Auth can be added via Supabase Auth when team access needed

## 8. Implementation Phases

### Phase 1 (build first): Farm Map + Calendar + Wiki
- Estimated: 6 implementation plans
  1. Database schema + seed data (farms, fields, production history)
  2. Farm Map page (MapLibre + field polygons + detail panel)
  3. GIS layer integration (Elsenburg/NDA/ISRIC overlays)
  4. Calendar & Task Engine (calendar view + task CRUD + dependencies)
  5. Farm Wiki (markdown pages + [[links]] + graph view)
  6. Dashboard enhancement (operational command center pulling from all modules)

### Phase 2: Equipment + Livestock + Production
- Estimated: 3 implementation plans
  7. Equipment register + maintenance tracking
  8. Livestock tracker + breeding + shearing
  9. Production batches + processing pipeline + quality + sales

### Phase 3: Employees + Assets + Inventory + Financials
- Estimated: 3 implementation plans
  10. Employee register + time tracking
  11. Inputs & inventory + asset register
  12. Financial overview + Xero/QB integration
