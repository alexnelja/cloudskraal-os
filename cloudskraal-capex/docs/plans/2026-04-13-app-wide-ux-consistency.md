# App-Wide UX Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize the page shell across all 12 non-wiki pages, redesign Dashboard as a farm command center, and upgrade Livestock to master-detail with per-animal drill-down.

**Architecture:** Shared `PageShell` + `PageHeader` components replace ad-hoc page wrappers. Dashboard splits from 606 lines into 7 focused components. Livestock gains a tabbed detail panel matching Equipment/Inventory pattern. Global nav gets weather + cash balance.

**Tech Stack:** React 19, Tailwind CSS, Lucide icons, Recharts (existing). No new dependencies.

---

## File Map

### New Files (frontend/src/)

| File | Responsibility |
|------|---------------|
| `components/layout/PageShell.tsx` | Full-height flex wrapper with fade-in animation |
| `components/layout/PageHeader.tsx` | Standardized page header bar (icon + title + actions slot) |
| `components/layout/NavWeatherCash.tsx` | Weather + cash balance widget for sidebar + mobile header |
| `components/shared/FillLevelBar.tsx` | Reusable fill-level bar visualization |
| `components/shared/ActionAlert.tsx` | Actionable alert item (verb + target + action link) |
| `components/dashboard/DashboardKPIs.tsx` | Metric cards with enterprise filtering |
| `components/dashboard/DashboardWeather.tsx` | Weather card (mock data) |
| `components/dashboard/DashboardAlerts.tsx` | Actionable alerts card |
| `components/dashboard/DashboardFillLevels.tsx` | Fill-level bars section |
| `components/dashboard/DashboardTasks.tsx` | Upcoming tasks list |
| `components/dashboard/DashboardActivity.tsx` | Recent activity feed |
| `components/livestock/LivestockDetail.tsx` | Right detail panel with tab switcher |
| `components/livestock/LivestockOverview.tsx` | Overview tab content |
| `components/livestock/LivestockAnimals.tsx` | Per-animal searchable table |
| `components/livestock/LivestockShearing.tsx` | Shearing records tab |
| `components/livestock/LivestockHealth.tsx` | Health/vaccination tab |

### Modified Files

| File | Change |
|------|--------|
| `index.css` | Add `page-fade-in`, `page-scale-in`, `page-slide-in` keyframes |
| `wiki.css` | Replace `wiki-fade-in` references with `page-fade-in` (or keep both) |
| `components/Sidebar.tsx` | Add NavWeatherCash between logo and nav |
| `components/layout/AppShell.tsx` | Add NavWeatherCash to mobile header |
| `App.tsx` | Remove PageWrapper, unwrap 4 routes |
| `pages/Dashboard.tsx` | Rewrite as thin layout (~100 lines) |
| `pages/LivestockPage.tsx` | Rewrite as master-detail with tabs |
| `pages/ProjectsList.tsx` | Wrap content in PageShell |
| `pages/ProjectDetail.tsx` | Wrap content in PageShell |
| `pages/CompareProjects.tsx` | Wrap content in PageShell |
| `pages/EquipmentPage.tsx` | Replace header with PageHeader |
| `pages/InventoryPage.tsx` | Replace header with PageHeader |
| `pages/ProductionPage.tsx` | Replace header with PageHeader |
| `pages/FinancialsPage.tsx` | Replace header with PageHeader |
| `pages/EmployeesPage.tsx` | Replace header with PageHeader |
| `pages/CalendarPage.tsx` | Replace header with PageHeader |
| `pages/FarmMapPage.tsx` | Replace header with PageHeader |

---

## Task 1: Global Animation Keyframes

**Files:**
- Modify: `frontend/src/index.css` (append after line 106)
- Modify: `frontend/src/wiki.css` (lines 80-85)

- [ ] **Step 1: Add page-level animation keyframes to index.css**

Append to end of `index.css`:

```css
/* Page transitions */
@keyframes page-fade-in { from { opacity: 0; transform: translateY(2px); } to { opacity: 1; transform: translateY(0); } }
@keyframes page-scale-in { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
@keyframes page-slide-in { from { opacity: 0; transform: translateX(4px); } to { opacity: 1; transform: translateX(0); } }
.page-fade-in { animation: page-fade-in 0.1s ease-out; }
.page-scale-in { animation: page-scale-in 0.1s ease-out; }
.page-slide-in { animation: page-slide-in 0.12s ease-out; }
```

- [ ] **Step 2: Update wiki.css to use page-level animations**

In `wiki.css` lines 80-85, replace `wiki-fade-in` with `page-fade-in`, `wiki-scale-in` with `page-scale-in`, `wiki-slide-in` with `page-slide-in`. Keep the wiki class names as aliases pointing to the page keyframes so existing wiki code doesn't break:

```css
.wiki-fade-in { animation: page-fade-in 0.1s ease-out; }
.wiki-scale-in { animation: page-scale-in 0.1s ease-out; }
.wiki-slide-in { animation: page-slide-in 0.12s ease-out; }
```

Remove the `@keyframes wiki-*` lines (they're now in index.css as `page-*`).

- [ ] **Step 3: Verify wiki still works**

Run: `cd frontend && npx vite build 2>&1 | tail -5`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css frontend/src/wiki.css
git commit -m "refactor: move animation keyframes to global index.css as page-fade-in"
```

---

## Task 2: PageShell + PageHeader Components

**Files:**
- Create: `frontend/src/components/layout/PageShell.tsx`
- Create: `frontend/src/components/layout/PageHeader.tsx`

- [ ] **Step 1: Create PageShell.tsx**

```tsx
import type { ReactNode } from 'react';

interface PageShellProps {
  children: ReactNode;
}

export default function PageShell({ children }: PageShellProps) {
  return (
    <div className="h-[calc(100vh-5rem)] md:h-screen flex flex-col overflow-hidden">
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create PageHeader.tsx**

```tsx
import type { ReactNode, ElementType } from 'react';

interface PageHeaderProps {
  icon: ElementType;
  title: string;
  children?: ReactNode; // right-side actions slot
}

export default function PageHeader({ icon: Icon, title, children }: PageHeaderProps) {
  return (
    <div className="flex-shrink-0 flex items-center justify-between border-b border-[#f3f4f3] px-4 py-3 bg-white">
      <div className="flex items-center gap-2">
        <Icon size={20} className="text-[#6e7a73]" />
        <h1 className="text-lg font-semibold text-[#1a2e1a]">{title}</h1>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && npx vite build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/layout/PageShell.tsx frontend/src/components/layout/PageHeader.tsx
git commit -m "feat: add PageShell and PageHeader shared layout components"
```

---

## Task 3: NavWeatherCash Widget

**Files:**
- Create: `frontend/src/components/layout/NavWeatherCash.tsx`
- Modify: `frontend/src/components/Sidebar.tsx` (insert after line 68, before nav)
- Modify: `frontend/src/components/layout/AppShell.tsx` (insert in mobile header, line 27 area)

- [ ] **Step 1: Create NavWeatherCash.tsx**

```tsx
import { Cloud, Sun, CloudRain, TrendingUp, TrendingDown } from 'lucide-react';

// Mock data — replace with real API later
const weather = { temp: 22, condition: 'sunny' as const, icon: Sun };
const cash = { balance: 1_245_000, delta: 3.2 };

const WEATHER_ICONS = { sunny: Sun, cloudy: Cloud, rainy: CloudRain };

interface NavWeatherCashProps {
  variant: 'sidebar' | 'mobile';
}

export default function NavWeatherCash({ variant }: NavWeatherCashProps) {
  const WeatherIcon = WEATHER_ICONS[weather.condition];
  const DeltaIcon = cash.delta >= 0 ? TrendingUp : TrendingDown;
  const deltaColor = cash.delta >= 0 ? 'text-emerald-400' : 'text-red-400';

  if (variant === 'mobile') {
    return (
      <div className="flex items-center gap-3 text-xs text-[#6e7a73]">
        <span className="flex items-center gap-1">
          <WeatherIcon size={14} />
          {weather.temp}°C
        </span>
        <span className="flex items-center gap-1">
          R{(cash.balance / 1000).toFixed(0)}K
          <DeltaIcon size={12} className={deltaColor} />
        </span>
      </div>
    );
  }

  return (
    <div className="px-5 py-3 border-b border-emerald-700 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-emerald-200">
          <WeatherIcon size={14} />
          {weather.temp}°C
        </span>
        <span className="text-emerald-400 text-[10px]">{weather.condition}</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-white font-medium">
          R{cash.balance.toLocaleString('en-ZA')}
        </span>
        <span className={`flex items-center gap-0.5 text-[10px] ${deltaColor}`}>
          <DeltaIcon size={10} />
          {Math.abs(cash.delta)}%
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add to Sidebar.tsx**

In `components/Sidebar.tsx`, after the logo `</div>` (line 68), before `{/* Navigation */}` (line 70), insert:

```tsx
<NavWeatherCash variant="sidebar" />
```

Add import at top: `import NavWeatherCash from './layout/NavWeatherCash';`

When sidebar is collapsed, hide it: wrap in `{!collapsed && <NavWeatherCash variant="sidebar" />}`

- [ ] **Step 3: Add to AppShell.tsx mobile header**

In `components/layout/AppShell.tsx`, inside the mobile header (line 25-33 area), add NavWeatherCash between the logo and avatar. Insert after the logo div and before the avatar link:

```tsx
<NavWeatherCash variant="mobile" />
```

Add import: `import NavWeatherCash from '../layout/NavWeatherCash';`

- [ ] **Step 4: Verify both desktop and mobile render**

Run: `cd frontend && npx vite build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/NavWeatherCash.tsx frontend/src/components/Sidebar.tsx frontend/src/components/layout/AppShell.tsx
git commit -m "feat: add weather + cash balance to sidebar and mobile header"
```

---

## Task 4: Remove PageWrapper + Apply PageShell to Projects Pages

**Files:**
- Modify: `frontend/src/App.tsx` (remove PageWrapper, unwrap routes)
- Modify: `frontend/src/pages/ProjectsList.tsx` (wrap in PageShell + PageHeader)
- Modify: `frontend/src/pages/ProjectDetail.tsx` (wrap in PageShell + PageHeader)
- Modify: `frontend/src/pages/CompareProjects.tsx` (wrap in PageShell + PageHeader)

- [ ] **Step 1: Update App.tsx**

Remove the `PageWrapper` function (lines 17-19). Unwrap the 4 routes that use it:

```tsx
// Before:
<Route path="/" element={<PageWrapper><Dashboard /></PageWrapper>} />
<Route path="/projects" element={<PageWrapper><ProjectsList /></PageWrapper>} />
<Route path="/projects/:id" element={<PageWrapper><ProjectDetail /></PageWrapper>} />
<Route path="/compare" element={<PageWrapper><CompareProjects /></PageWrapper>} />

// After:
<Route path="/" element={<Dashboard />} />
<Route path="/projects" element={<ProjectsList />} />
<Route path="/projects/:id" element={<ProjectDetail />} />
<Route path="/compare" element={<CompareProjects />} />
```

- [ ] **Step 2: Wrap ProjectsList.tsx in PageShell + PageHeader**

At the top of ProjectsList component's return, wrap existing content:

```tsx
import PageShell from '../components/layout/PageShell';
import PageHeader from '../components/layout/PageHeader';
import { FolderOpen } from 'lucide-react'; // already imported

// In return:
<PageShell>
  <PageHeader icon={FolderOpen} title="CapEx Projects">
    {/* existing action buttons */}
  </PageHeader>
  <div className="flex-1 overflow-y-auto p-4 md:p-8 page-fade-in">
    <div className="max-w-7xl mx-auto">
      {/* existing content minus the old header */}
    </div>
  </div>
</PageShell>
```

- [ ] **Step 3: Wrap ProjectDetail.tsx in PageShell + PageHeader**

Same pattern as ProjectsList. Use the project name as dynamic title.

- [ ] **Step 4: Wrap CompareProjects.tsx in PageShell + PageHeader**

Same pattern. Use `GitCompare` icon and "Compare Projects" title.

- [ ] **Step 5: Verify build and check no broken routes**

Run: `cd frontend && npx vite build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.tsx frontend/src/pages/ProjectsList.tsx frontend/src/pages/ProjectDetail.tsx frontend/src/pages/CompareProjects.tsx
git commit -m "feat: replace PageWrapper with PageShell on projects pages"
```

---

## Task 5: Standardize Headers on Existing Full-Height Pages

**Files:**
- Modify: `frontend/src/pages/EquipmentPage.tsx`
- Modify: `frontend/src/pages/InventoryPage.tsx`
- Modify: `frontend/src/pages/ProductionPage.tsx`
- Modify: `frontend/src/pages/FinancialsPage.tsx`
- Modify: `frontend/src/pages/EmployeesPage.tsx`
- Modify: `frontend/src/pages/CalendarPage.tsx`
- Modify: `frontend/src/pages/FarmMapPage.tsx`

- [ ] **Step 1: Replace headers on Equipment, Inventory, Production**

Each of these pages has a custom header section. Replace with `PageHeader`:

For EquipmentPage: `<PageHeader icon={Wrench} title="Equipment">` + move filter pills and action buttons into PageHeader's children slot.

For InventoryPage: `<PageHeader icon={Package} title="Inventory">` + same pattern.

For ProductionPage: `<PageHeader icon={Factory} title="Production">` + same pattern.

Keep existing KPI stats in the header's children slot if they're currently in the header bar.

- [ ] **Step 2: Replace headers on Financials, Employees, Calendar, FarmMap**

Same pattern:
- FinancialsPage: `<PageHeader icon={BarChart3} title="Financials">`
- EmployeesPage: `<PageHeader icon={Users} title="Employees">`
- CalendarPage: `<PageHeader icon={CalendarDays} title="Calendar">`
- FarmMapPage: `<PageHeader icon={MapIcon} title="Farm Map">`

- [ ] **Step 3: Add page-fade-in to content areas**

On each page, add `className="... page-fade-in"` to the main scrollable content div.

- [ ] **Step 4: Verify build**

Run: `cd frontend && npx vite build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/EquipmentPage.tsx frontend/src/pages/InventoryPage.tsx frontend/src/pages/ProductionPage.tsx frontend/src/pages/FinancialsPage.tsx frontend/src/pages/EmployeesPage.tsx frontend/src/pages/CalendarPage.tsx frontend/src/pages/FarmMapPage.tsx
git commit -m "feat: standardize page headers across all pages with PageHeader component"
```

---

## Task 6: Shared Components — FillLevelBar + ActionAlert

**Files:**
- Create: `frontend/src/components/shared/FillLevelBar.tsx`
- Create: `frontend/src/components/shared/ActionAlert.tsx`

- [ ] **Step 1: Create FillLevelBar.tsx**

```tsx
interface FillLevelBarProps {
  label: string;
  current: number;  // 0-100
  unit?: string;
  thresholds?: { low: number; warning: number }; // defaults: low=20, warning=40
}

export default function FillLevelBar({ label, current, unit = '%', thresholds = { low: 20, warning: 40 } }: FillLevelBarProps) {
  const color = current <= thresholds.low
    ? 'bg-red-500'
    : current <= thresholds.warning
    ? 'bg-amber-500'
    : 'bg-emerald-500';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-[#6e7a73]">{label}</span>
        <span className="font-medium text-[#1a2e1a]">{current}{unit}</span>
      </div>
      <div className="h-2 bg-[#f3f4f3] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(current, 100)}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create ActionAlert.tsx**

```tsx
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { Link } from 'react-router-dom';

type Severity = 'critical' | 'warning' | 'info';

interface ActionAlertProps {
  severity: Severity;
  message: string;
  actionLabel: string;
  actionTo: string;
}

const SEVERITY_CONFIG: Record<Severity, { icon: typeof AlertTriangle; bg: string; border: string; text: string }> = {
  critical: { icon: AlertTriangle, bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
  warning: { icon: AlertCircle, bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  info: { icon: Info, bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
};

export default function ActionAlert({ severity, message, actionLabel, actionTo }: ActionAlertProps) {
  const config = SEVERITY_CONFIG[severity];
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${config.bg} ${config.border}`}>
      <Icon size={14} className={config.text} />
      <span className={`flex-1 text-xs ${config.text}`}>{message}</span>
      <Link to={actionTo} className={`text-xs font-medium underline ${config.text}`}>
        {actionLabel}
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && npx vite build 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/shared/FillLevelBar.tsx frontend/src/components/shared/ActionAlert.tsx
git commit -m "feat: add FillLevelBar and ActionAlert shared components"
```

---

## Task 7: Dashboard Redesign

**Files:**
- Create: `frontend/src/components/dashboard/DashboardKPIs.tsx`
- Create: `frontend/src/components/dashboard/DashboardWeather.tsx`
- Create: `frontend/src/components/dashboard/DashboardAlerts.tsx`
- Create: `frontend/src/components/dashboard/DashboardFillLevels.tsx`
- Create: `frontend/src/components/dashboard/DashboardTasks.tsx`
- Create: `frontend/src/components/dashboard/DashboardActivity.tsx`
- Rewrite: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Create DashboardKPIs.tsx**

4-6 metric cards in a responsive grid. Each card shows: label, value, delta arrow, delta percentage. Accept `enterprise` filter prop to filter data. Use existing API data from `getProjects` + `getSummary` where available, mock where not.

Card pattern (match existing): `bg-white rounded-2xl p-5` with `text-[11px] font-bold uppercase tracking-[0.05em] text-[#6e7a73]` for labels.

KPIs: Total Hectares (2,429), Livestock Head Count, Active Projects, Cash Position (from existing Dashboard data), Season Indicator (Autumn 2026).

- [ ] **Step 2: Create DashboardWeather.tsx**

Mock weather card. Current conditions icon + temp, 3-day forecast strip (3 small day columns: icon + high/low), rainfall bar (this month vs average as a simple comparison).

All data hardcoded as mock constants at top of file with `// TODO: Replace with weather API` comment.

- [ ] **Step 3: Create DashboardAlerts.tsx**

Uses `ActionAlert` component. Pulls alerts from existing APIs where available:
- Equipment alerts: `getEquipmentAlerts()` → overdue service items
- Inventory alerts: low stock items from `getInventory()`
- Task alerts: overdue tasks from `getTasks()`

Falls back to mock data if APIs aren't available. Each alert rendered as an `ActionAlert` with appropriate severity, message, and link.

- [ ] **Step 4: Create DashboardFillLevels.tsx**

Uses `FillLevelBar` component. Mock data for: Feed Troughs (Ewes 72%, Rams 45%, Lambs 88%), Water Tanks (Main 60%, Portable 25%), Silos (Lupine Seed 90%, Rooibos Tea 55%).

Rendered as a grid of FillLevelBar components, 2-3 columns.

- [ ] **Step 5: Create DashboardTasks.tsx**

Pull from existing calendar/tasks API if available. Show this week's tasks grouped by day. Each task: checkbox (visual only) + name + assignee badge + linked page icon. Fallback to mock data.

- [ ] **Step 6: Create DashboardActivity.tsx**

Recent activity feed. Mock data: array of `{ module: 'wiki' | 'equipment' | ..., description: string, timestamp: string, link: string }`. Render as a compact list with module-colored icon, description, relative time.

- [ ] **Step 7: Rewrite Dashboard.tsx as thin layout**

```tsx
import { useState } from 'react';
import { LayoutDashboard } from 'lucide-react';
import PageShell from '../components/layout/PageShell';
import PageHeader from '../components/layout/PageHeader';
import DashboardKPIs from '../components/dashboard/DashboardKPIs';
import DashboardWeather from '../components/dashboard/DashboardWeather';
import DashboardAlerts from '../components/dashboard/DashboardAlerts';
import DashboardFillLevels from '../components/dashboard/DashboardFillLevels';
import DashboardTasks from '../components/dashboard/DashboardTasks';
import DashboardActivity from '../components/dashboard/DashboardActivity';

const ENTERPRISES = ['All', 'Livestock', 'Rooibos', 'Wine', 'Crops/Rotation'] as const;

export default function Dashboard() {
  const [enterprise, setEnterprise] = useState<string>('All');

  return (
    <PageShell>
      <PageHeader icon={LayoutDashboard} title="Dashboard" />
      <div className="flex-1 overflow-y-auto page-fade-in">
        {/* Enterprise filter pills - sticky */}
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-[#f3f4f3] px-4 py-2 flex gap-2">
          {ENTERPRISES.map((e) => (
            <button
              key={e}
              onClick={() => setEnterprise(e)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                enterprise === e
                  ? 'bg-emerald-700 text-white'
                  : 'bg-[#f3f4f3] text-[#6e7a73] hover:bg-emerald-50'
              }`}
            >
              {e}
            </button>
          ))}
        </div>

        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
          <DashboardKPIs enterprise={enterprise} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DashboardWeather />
            <DashboardAlerts />
          </div>
          <DashboardFillLevels />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DashboardTasks />
            <DashboardActivity />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
```

- [ ] **Step 8: Verify build and visual check**

Run: `cd frontend && npx vite build 2>&1 | tail -5`
Open http://localhost:5173/ and verify dashboard renders all sections.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/dashboard/ frontend/src/pages/Dashboard.tsx
git commit -m "feat: redesign Dashboard as farm command center with KPIs, weather, alerts, fill levels"
```

---

## Task 8: Livestock Master-Detail Rewrite

**Files:**
- Create: `frontend/src/components/livestock/LivestockDetail.tsx`
- Create: `frontend/src/components/livestock/LivestockOverview.tsx`
- Create: `frontend/src/components/livestock/LivestockAnimals.tsx`
- Create: `frontend/src/components/livestock/LivestockShearing.tsx`
- Create: `frontend/src/components/livestock/LivestockHealth.tsx`
- Rewrite: `frontend/src/pages/LivestockPage.tsx`

- [ ] **Step 1: Create LivestockOverview.tsx**

Group stats summary: count, avg weight, avg condition, status. Condition summary as a compact visual (green/amber/red distribution bar).

- [ ] **Step 2: Create LivestockAnimals.tsx**

Searchable table of individual sheep. Columns: Tag, Breed, Age, Weight, Condition Score, Status. Search input at top filters by tag/breed. Mock data: 15-20 animals per group with realistic Dohne Merino data.

Data structure: `{ tag: string, breed: string, age: number, weight: number, conditionScore: number, status: string }[]`

Interface designed for future KLK DSS API: data comes in via props, not fetched internally.

- [ ] **Step 3: Create LivestockShearing.tsx**

Extract existing shearing records table from LivestockPage.tsx (lines 329-447). Receives `shearingRecords` as props. Same responsive table with `hidden sm:table-cell` pattern.

- [ ] **Step 4: Create LivestockHealth.tsx**

Vaccination records, treatments, mortality log. Mock data. Simple table with date, type, description, administered_by columns.

- [ ] **Step 5: Create LivestockDetail.tsx**

Tab switcher + content area. Tabs: Overview, Animals, Shearing, Health. Receives `selectedGroup` as prop. Matches Equipment/Inventory detail panel pattern:

```tsx
<div className="md:w-[420px] md:flex-shrink-0 border-t md:border-t-0 md:border-l border-[#f3f4f3] overflow-y-auto bg-white page-slide-in">
  {/* Close button + group name header */}
  {/* Tab bar */}
  {/* Tab content */}
</div>
```

- [ ] **Step 6: Rewrite LivestockPage.tsx as master-detail**

Left panel: PageHeader + KPI cards + fill-level bars (feed per group) + group cards grid. Breeding pipeline stays in left panel (global view, not per-group).

Right panel: LivestockDetail slides in when a group is clicked. State: `selectedGroup`.

Pattern matches EquipmentPage: `flex-1 flex flex-col md:flex-row overflow-hidden` for the main content area.

- [ ] **Step 7: Verify build and visual check**

Run: `cd frontend && npx vite build 2>&1 | tail -5`
Open http://localhost:5173/livestock and verify master-detail works.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/livestock/ frontend/src/pages/LivestockPage.tsx
git commit -m "feat: Livestock master-detail with tabs — overview, animals, shearing, health"
```

---

## Task 9: Final Verification + Cleanup

- [ ] **Step 1: Full build check**

Run: `cd frontend && npx vite build 2>&1`
Expected: Clean build, no warnings.

- [ ] **Step 2: Run backend tests**

Run: `cd backend && npx vitest run tests/wiki-api.test.js`
Expected: 13 tests passing (no backend changes, just verifying nothing broke).

- [ ] **Step 3: Visual spot-check all pages**

Navigate to each page and verify:
- Consistent header bar (icon + title + actions)
- Page-fade-in animation on content load
- No broken layouts or missing content
- Weather + cash visible in sidebar (desktop) and header (mobile)

Pages to check: `/`, `/map`, `/calendar`, `/wiki`, `/projects`, `/equipment`, `/livestock`, `/production`, `/employees`, `/inventory`, `/financials`, `/compare`

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: final UX consistency cleanup"
```
