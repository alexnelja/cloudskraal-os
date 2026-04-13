# App-Wide UX Consistency — Design Spec

> **Status:** Approved design, pending implementation
> **Created:** 2026-04-13
> **Branch:** feature/app-wide-ux-upgrade

---

## 1. Goal

Bring all 12 non-wiki pages up to the wiki's polish level by standardizing the page shell, redesigning the Dashboard as a farm command center, upgrading Livestock to master-detail with per-animal drill-down, and applying consistent transitions across the app. Desktop-first; tablet UI deferred to a future phase.

---

## 2. Consistent Page Shell

Every page gets the same structural wrapper, replacing the current `PageWrapper` component.

### PageShell Component

```
┌──────────────────────────────────────────────────┐
│  App Nav Bar (existing) + weather + cash balance  │  ← global
├──────────────────────────────────────────────────┤
│  Page Header: icon + title + actions (right)      │  ← flex-shrink-0
├──────────────────────────────────────────────────┤
│                                                  │
│  Scrollable Content Area                         │  ← flex-1 overflow-hidden
│  (each page controls its own scroll/layout)      │
│                                                  │
└──────────────────────────────────────────────────┘
```

**CSS pattern:**
- Container: `h-[calc(100vh-5rem)] flex flex-col overflow-hidden`
- Header: `flex-shrink-0 border-b border-[#f3f4f3] px-4 py-3 bg-white`
- Content: `flex-1 overflow-hidden`
- Entry animation: `wiki-fade-in` (0.1s translateY ease-out) on content mount

### Global Nav Bar Addition

Pin to the existing top nav bar:
- Weather icon + current temperature (right side, before user menu)
- Cash balance with delta arrow (right side)
- Data: mock/placeholder, structured for real API later

### Pages Affected

| Page | Current Pattern | Change |
|------|----------------|--------|
| Dashboard | PageWrapper (padding + max-width) | Full redesign (see Section 3) |
| Livestock | Full-height single-column | Master-detail redesign (see Section 4) |
| Equipment | Full-height master-detail | Standardize header only |
| Inventory | Full-height master-detail | Standardize header only |
| Production | Full-height master-detail (Kanban) | Standardize header only |
| Financials | PageWrapper | Switch to PageShell |
| Employees | PageWrapper | Switch to PageShell |
| ProjectsList | PageWrapper | Switch to PageShell |
| ProjectDetail | PageWrapper | Switch to PageShell |
| CompareProjects | PageWrapper | Switch to PageShell |
| Calendar | PageWrapper | Switch to PageShell |
| FarmMap | Full-height (map) | Standardize header only |

---

## 3. Dashboard Redesign

Transform from a generic card grid into a farm command center.

### Layout

Full-height shell, no sidebar. Scrollable single-column with dense, scannable sections.

### Sections (top to bottom)

**3.1 Enterprise Filter Row**
- Pill toggles: All | Livestock | Rooibos | Wine | Crops/Rotation
- Filters all sections below
- Sticky below page header

**3.2 KPI Cards (4-6)**
- Total hectares, livestock head count, active projects, cash position, season indicator
- Delta arrows showing change from last month
- Filtered by enterprise selection

**3.3 Weather + Alerts Row (two cards side by side)**

Weather card (left):
- Current conditions icon + temperature
- 3-day forecast strip
- Rainfall this month vs average

Alerts card (right):
- Actionable alerts with severity color coding (red/amber/green)
- Each alert has a verb + target + action link
- Example: "Overdue service: Bovic Cutter — Log now?"
- Click-through navigates to the relevant page/item

**3.4 Fill-Level Bars**
- Feed trough status, water tank levels, silo/storage capacity
- Visual fill bars (Farming Simulator pattern) for instant "what needs topping up?" scanning
- Data: mock/placeholder, API-ready

**3.5 Upcoming Tasks**
- This week's tasks, grouped by day
- Compact list: checkbox + task name + assignee + linked page
- Click-through to Calendar

**3.6 Recent Activity Feed**
- Last 10-15 actions across all modules
- Each entry: module icon + description + relative timestamp + link
- Covers: wiki edits, equipment logs, production updates, livestock records

### File Structure

Split Dashboard.tsx (606 lines) into:
- `Dashboard.tsx` — thin layout shell (~100 lines)
- `DashboardKPIs.tsx` — metric cards with enterprise filtering
- `DashboardWeather.tsx` — weather card (mock data)
- `DashboardAlerts.tsx` — actionable alerts with severity
- `DashboardFillLevels.tsx` — fill-level bar visualizations
- `DashboardTasks.tsx` — upcoming task list
- `DashboardActivity.tsx` — recent activity feed

---

## 4. Livestock Page Redesign

Transform from single-column stacked layout to master-detail pattern matching Equipment/Inventory.

### Layout

```
┌────────────────────────────────┬──────────────┐
│  Left Panel (flex-1)           │ Detail Panel  │
│                                │ (420px)       │
│  Header + KPIs + Fill Bars     │               │
│  + Group Cards Grid            │ Tabs:         │
│                                │ Overview      │
│                                │ Animals       │
│                                │ Shearing      │
│                                │ Health        │
└────────────────────────────────┴──────────────┘
```

### Left Panel (flex-1, scrollable)

- **Header bar**: Livestock icon + title + enterprise filter + action buttons
- **KPI cards row** (4): Total head count, breeding rate, avg condition score, next shearing date. Delta arrows.
- **Fill-level bars**: Feed trough status per group — visual scan of "who needs feeding?"
- **Group cards grid** (2-3 columns): group name, count, avg weight, status indicator (green/amber/red). Click to open detail panel.

### Right Detail Panel (420px, slides in)

Matches Equipment/Inventory detail panel pattern: `md:w-[420px] md:flex-shrink-0 border-l`.

**Tabs:**

| Tab | Content |
|-----|---------|
| Overview | Group stats, breeding pipeline visualization (existing), condition summary |
| Animals | Searchable/filterable table of individual sheep: tag, breed, age, weight, condition score, status |
| Shearing | Shearing records table (existing), next scheduled date |
| Health | Vaccination records, treatments, mortality log |

### Data Strategy

- Animal-level data is aggregated/mock for now
- Interface designed so a KLK DSS API call replaces the data source without UI changes
- Data fetching abstracted behind a service layer (e.g., `livestock-api.ts`)

---

## 5. Design Patterns from Agricultural Software

Patterns incorporated from Farming Simulator, Farmbrite, Agrivi, and Bushel Farm:

| Pattern | Source | Where Applied |
|---------|--------|---------------|
| Weather + cash always visible | Farming Simulator HUD | Global nav bar |
| Fill-level bars for capacity | Farming Simulator | Dashboard, Livestock |
| Actionable alerts ("Do X now?") | Agrivi, Gapsy Studio | Dashboard alerts |
| Enterprise filter toggles | Farmbrite | Dashboard |
| Delta arrows on KPIs | Bushel Farm | Dashboard, Livestock KPIs |
| Simple finance (current + 4 months) | Farming Simulator | Future: Financials page |
| Map with filter toggles | Farming Simulator | Future: FarmMap enhancement |

### Deferred to Future Phases

- Tablet UI optimization (48x48dp touch targets, lower-third actions, 7:1 contrast)
- Map-first dashboard with field profitability overlay
- Knowledge-driven alerts (condition-based recommendations)
- Field-level P&L drill-down (farm → enterprise → field → per-hectare)
- Real weather API integration
- KLK DSS API integration for per-animal data

---

## 6. Components Created

| Component | Purpose | Lines (est.) |
|-----------|---------|-------------|
| `PageShell.tsx` | Shared full-height page wrapper | ~40 |
| `PageHeader.tsx` | Standardized page header bar | ~30 |
| `NavWeatherCash.tsx` | Weather + cash in global nav | ~50 |
| `FillLevelBar.tsx` | Reusable fill-level bar | ~30 |
| `ActionAlert.tsx` | Actionable alert card item | ~25 |
| `DashboardKPIs.tsx` | Dashboard metric cards | ~80 |
| `DashboardWeather.tsx` | Weather card | ~60 |
| `DashboardAlerts.tsx` | Alerts card | ~60 |
| `DashboardFillLevels.tsx` | Fill-level bars section | ~50 |
| `DashboardTasks.tsx` | Task list section | ~60 |
| `DashboardActivity.tsx` | Activity feed section | ~60 |
| `LivestockDetail.tsx` | Right panel with tabs | ~120 |
| `LivestockAnimals.tsx` | Per-animal table tab | ~80 |
| `LivestockHealth.tsx` | Health/vaccination tab | ~60 |

---

## 7. Files Modified

- `App.tsx` — Add NavWeatherCash to nav bar
- `Dashboard.tsx` — Rewrite as thin layout importing sub-components
- `LivestockPage.tsx` — Rewrite as master-detail with tabs
- `FinancialsPage.tsx` — Replace PageWrapper with PageShell
- `EmployeesPage.tsx` — Replace PageWrapper with PageShell
- `ProjectsList.tsx` — Replace PageWrapper with PageShell
- `ProjectDetail.tsx` — Replace PageWrapper with PageShell
- `CompareProjects.tsx` — Replace PageWrapper with PageShell
- `CalendarPage.tsx` — Replace PageWrapper with PageShell
- `EquipmentPage.tsx` — Standardize header to PageHeader
- `InventoryPage.tsx` — Standardize header to PageHeader
- `ProductionPage.tsx` — Standardize header to PageHeader
- `FarmMapPage.tsx` — Standardize header to PageHeader
- `index.css` — Add wiki-fade-in if not already global
