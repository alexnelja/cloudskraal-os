# Spec 5l — Fields Tree Sidebar Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to execute task-by-task.

**Goal:** Replace the TR `MapControls` filter panel with a new left-side `FieldsSidebar` that groups fields by enterprise, shows per-group + total hectarage, click-to-zoom, per-enterprise visibility toggle, farm selector, field search.

**Architecture:** New `FieldsSidebar` component rendered as a flex sibling of the map in `FarmMapPage`. Reads the existing `fields`, `farms`, `enterprises`, and `visibleEnterprises` state (already held in `FarmMapPage`) — pure consumer-side refactor. `MapControls` and `MapControls.test.tsx` deleted. Expansion + visibility state persists to `localStorage['capex.fields-sidebar']`. Mobile uses `FluidSheet side="left"`.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Tailwind, `@phosphor-icons/react`, existing `FluidSheet` primitive.

**Spec:** `docs/specs/2026-04-16-spec-5l-fields-tree-sidebar.md`

---

## Pre-flight

- [ ] **Step 0.1: Green baseline + clean tree**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex
git status --short
cd frontend && npm test && npx tsc -b --noEmit
```

---

## File structure

| Path | Responsibility | Action |
|---|---|---|
| `frontend/src/components/map/FieldsSidebar.tsx` | The sidebar component | Create |
| `frontend/src/components/map/FieldsSidebar.test.tsx` | Unit tests | Create |
| `frontend/src/components/map/MapControls.tsx` | Deleted (superseded) | Delete |
| `frontend/src/components/map/MapControls.test.tsx` | Deleted | Delete (if exists) |
| `frontend/src/pages/FarmMapPage.tsx` | Flex-wrap map + sidebar, remove MapControls | Modify |
| `frontend/src/index.css` | Optional `.fields-sidebar` spacing tokens | Modify only if needed |

---

## Task 1 — FieldsSidebar with TDD

**Files:** `FieldsSidebar.tsx` + `.test.tsx`

- [ ] **Step 1.1: Write failing tests**

Create `frontend/src/components/map/FieldsSidebar.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import FieldsSidebar from './FieldsSidebar';
import type { Farm, Field } from '../../types/farm';

const FARMS: Farm[] = [
  { id: 'f1', name: 'Cloudskraal', code: 'CS', type: 'owned', total_ha: 1000, lat: -33, lng: 20, region: 'WC', notes: null },
];
const FIELDS: Field[] = [
  { id: 'a', farm_id: 'f1', farm_name: 'Cloudskraal', name: 'Blok 1', code: null, enterprise: 'rooibos', crop_type: null, area_ha: 42, planted_year: '2022', status: 'active', soil_type: null, irrigation_type: null, notes: null },
  { id: 'b', farm_id: 'f1', farm_name: 'Cloudskraal', name: 'Blok 2', code: null, enterprise: 'rooibos', crop_type: null, area_ha: 38, planted_year: '2023', status: 'active', soil_type: null, irrigation_type: null, notes: null },
  { id: 'c', farm_id: 'f1', farm_name: 'Cloudskraal', name: 'Vineyard N', code: null, enterprise: 'wine', crop_type: null, area_ha: 22, planted_year: '2019', status: 'active', soil_type: null, irrigation_type: null, notes: null },
];

const baseProps = {
  farms: FARMS,
  fields: FIELDS,
  enterprises: ['rooibos', 'wine'],
  visibleEnterprises: ['rooibos', 'wine'],
  selectedFieldId: null as string | null,
  onEnterpriseToggle: vi.fn(),
  onFarmSelect: vi.fn(),
  onFieldSelect: vi.fn(),
  onAddField: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe('FieldsSidebar', () => {
  it('renders aggregate total hectarage and field count', () => {
    render(<FieldsSidebar {...baseProps} />);
    // 42 + 38 + 22 = 102
    expect(screen.getByText(/102/)).toBeInTheDocument();
    expect(screen.getByText(/3 fields/i)).toBeInTheDocument();
  });

  it('groups fields by enterprise with per-group totals', () => {
    render(<FieldsSidebar {...baseProps} />);
    // rooibos group: 42 + 38 = 80 ha, 2 fields
    expect(screen.getByText(/rooibos/i)).toBeInTheDocument();
    // wine group: 22 ha, 1 field
    expect(screen.getByText(/wine/i)).toBeInTheDocument();
  });

  it('clicking a field row calls onFieldSelect with the field id', () => {
    render(<FieldsSidebar {...baseProps} />);
    fireEvent.click(screen.getByText('Blok 1'));
    expect(baseProps.onFieldSelect).toHaveBeenCalledWith('a');
  });

  it('clicking an enterprise eye icon calls onEnterpriseToggle', () => {
    render(<FieldsSidebar {...baseProps} />);
    const eyes = screen.getAllByRole('button', { name: /toggle (rooibos|wine) visibility/i });
    fireEvent.click(eyes[0]);
    expect(baseProps.onEnterpriseToggle).toHaveBeenCalledTimes(1);
  });

  it('typing in search filters visible rows', () => {
    render(<FieldsSidebar {...baseProps} />);
    const search = screen.getByPlaceholderText(/search/i);
    fireEvent.change(search, { target: { value: 'Vineyard' } });
    expect(screen.getByText('Vineyard N')).toBeInTheDocument();
    expect(screen.queryByText('Blok 1')).toBeNull();
  });

  it('clicking + Add calls onAddField', () => {
    render(<FieldsSidebar {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /add field/i }));
    expect(baseProps.onAddField).toHaveBeenCalled();
  });

  it('persists expanded-group state to localStorage', () => {
    const { unmount } = render(<FieldsSidebar {...baseProps} />);
    // collapse rooibos
    const toggle = screen.getAllByRole('button', { name: /toggle (rooibos) group/i })[0];
    fireEvent.click(toggle);
    unmount();
    // re-mount — rooibos should stay collapsed
    render(<FieldsSidebar {...baseProps} />);
    expect(screen.queryByText('Blok 1')).toBeNull();
  });
});
```

- [ ] **Step 1.2: Run — expect FAIL (component missing)**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex/frontend
npm test -- src/components/map/FieldsSidebar.test.tsx
```

- [ ] **Step 1.3: Write FieldsSidebar**

Create `frontend/src/components/map/FieldsSidebar.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { Plus, MagnifyingGlass as Search, Eye, EyeSlash, CaretDown, CaretRight } from '@phosphor-icons/react';
import { ENTERPRISE_COLORS, ENTERPRISE_LABELS } from '../../types/farm';
import type { Farm, Field } from '../../types/farm';

interface FieldsSidebarProps {
  farms: Farm[];
  fields: Field[];
  enterprises: string[];
  visibleEnterprises: string[];
  selectedFieldId: string | null;
  onEnterpriseToggle: (enterprise: string) => void;
  onFarmSelect: (farmCode: string | null) => void;
  onFieldSelect: (fieldId: string) => void;
  onAddField: () => void;
}

const LS_KEY = 'capex.fields-sidebar';

interface PersistedState {
  collapsed: string[]; // enterprise keys currently collapsed
}

function loadPersisted(): PersistedState {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return { collapsed: [] };
    const parsed = JSON.parse(raw);
    return { collapsed: Array.isArray(parsed.collapsed) ? parsed.collapsed : [] };
  } catch {
    return { collapsed: [] };
  }
}

function savePersisted(state: PersistedState) {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    // SSR / private mode — no-op
  }
}

export default function FieldsSidebar({
  farms,
  fields,
  enterprises: _enterprises,
  visibleEnterprises,
  selectedFieldId,
  onEnterpriseToggle,
  onFarmSelect,
  onFieldSelect,
  onAddField,
}: FieldsSidebarProps) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<string[]>(() => loadPersisted().collapsed);

  useEffect(() => {
    savePersisted({ collapsed });
  }, [collapsed]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return fields;
    return fields.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.code ?? '').toLowerCase().includes(q) ||
        (f.farm_name ?? '').toLowerCase().includes(q),
    );
  }, [fields, search]);

  const groups = useMemo(() => {
    const byEnt = new Map<string, Field[]>();
    for (const f of filtered) {
      const list = byEnt.get(f.enterprise) ?? [];
      list.push(f);
      byEnt.set(f.enterprise, list);
    }
    // hide groups with no fields, sort by total area descending
    return Array.from(byEnt.entries())
      .map(([ent, list]) => ({
        ent,
        list,
        totalHa: list.reduce((s, f) => s + (f.area_ha ?? 0), 0),
      }))
      .sort((a, b) => b.totalHa - a.totalHa);
  }, [filtered]);

  const totalHa = filtered.reduce((s, f) => s + (f.area_ha ?? 0), 0);

  function toggleGroup(ent: string) {
    setCollapsed((prev) =>
      prev.includes(ent) ? prev.filter((e) => e !== ent) : [...prev, ent],
    );
  }

  return (
    <aside className="h-full w-72 flex-shrink-0 glass-panel rounded-r-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-3 flex items-center gap-2 border-b border-[#f3f4f3]">
        <span className="flex-1 font-semibold text-stone-800 text-[13px]">Fields</span>
        <button
          type="button"
          onClick={onAddField}
          aria-label="Add field"
          className="bg-emerald-700 text-white rounded-lg px-2.5 py-1.5 text-[11px] font-medium flex items-center gap-1 hover:bg-emerald-800"
        >
          <Plus size={12} weight="bold" /> ADD
        </button>
      </div>

      {/* Aggregate strip */}
      <div className="px-3 py-2 bg-stone-50 border-b border-[#f3f4f3] flex items-baseline gap-2">
        <span className="text-lg font-bold text-stone-800">{Math.round(totalHa).toLocaleString()}</span>
        <span className="text-[10px] text-stone-500 font-medium">ha</span>
        <span className="text-[11px] text-stone-500 ml-auto">{filtered.length} fields</span>
      </div>

      {/* Farm + search */}
      <div className="px-3 py-2 border-b border-[#f3f4f3] space-y-2">
        <select
          className="w-full glass-input rounded-lg px-2 py-1.5 text-[12px] text-stone-800"
          defaultValue=""
          onChange={(e) => onFarmSelect(e.target.value || null)}
        >
          <option value="">All Farms</option>
          {farms.map((f) => (
            <option key={f.code} value={f.code}>{f.name}</option>
          ))}
        </select>
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search fields..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full glass-input rounded-lg pl-7 pr-2 py-1.5 text-[12px]"
          />
        </div>
      </div>

      {/* Groups */}
      <div className="flex-1 overflow-y-auto text-[11px]">
        {groups.length === 0 && (
          <p className="px-3 py-3 text-stone-400 italic">No fields.</p>
        )}
        {groups.map((g) => {
          const color = ENTERPRISE_COLORS[g.ent] ?? '#6b7280';
          const label = ENTERPRISE_LABELS[g.ent] ?? g.ent;
          const isCollapsed = collapsed.includes(g.ent);
          const isVisible = visibleEnterprises.includes(g.ent);
          return (
            <div key={g.ent}>
              <div
                className="pl-3 pr-2 py-2 flex items-center gap-2 border-l-[3px]"
                style={{ borderLeftColor: color, background: `${color}10`, color }}
              >
                <button
                  type="button"
                  onClick={() => toggleGroup(g.ent)}
                  aria-label={`Toggle ${label} group`}
                  className="flex items-center gap-1 flex-1 font-semibold"
                >
                  {isCollapsed ? <CaretRight size={10} weight="bold" /> : <CaretDown size={10} weight="bold" />}
                  <span>{label}</span>
                </button>
                <span className="text-[10px] font-medium text-stone-600">
                  {Math.round(g.totalHa)} ha · {g.list.length}
                </span>
                <button
                  type="button"
                  onClick={() => onEnterpriseToggle(g.ent)}
                  aria-label={`Toggle ${label} visibility`}
                  className="text-stone-500 hover:text-stone-800"
                >
                  {isVisible ? <Eye size={12} /> : <EyeSlash size={12} />}
                </button>
              </div>
              {!isCollapsed && g.list.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onFieldSelect(f.id)}
                  className={`w-full pl-8 pr-3 py-1.5 flex items-center justify-between text-left border-b border-[#f7f6f5] hover:bg-stone-50 ${
                    selectedFieldId === f.id ? 'bg-amber-50' : ''
                  }`}
                >
                  <span className="text-stone-800 truncate">{f.name}</span>
                  <span className="text-stone-500 text-[10px] flex-shrink-0 ml-2">{Math.round(f.area_ha)} ha</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
```

- [ ] **Step 1.4: Run — expect PASS**

```bash
npm test -- src/components/map/FieldsSidebar.test.tsx
```

All 7 tests green.

---

## Task 2 — Wire into FarmMapPage + delete MapControls

**Files:** `FarmMapPage.tsx`, delete `MapControls.tsx` + tests.

- [ ] **Step 2.1: Confirm current state**

```bash
ls /Users/alexnelja/projects/cloudskraal-capex/frontend/src/components/map/MapControls* 2>&1
grep -n "MapControls" /Users/alexnelja/projects/cloudskraal-capex/frontend/src/pages/FarmMapPage.tsx
```

- [ ] **Step 2.2: Update FarmMapPage**

In `FarmMapPage.tsx`:

1. Replace `import MapControls from '../components/map/MapControls';` with `import FieldsSidebar from '../components/map/FieldsSidebar';`.
2. Remove the `<MapControls ... />` JSX from the `<MapOverlayRail position="tr">` block.
3. Wrap the existing map container + overlays in a flex container so the sidebar sits to the left:

```tsx
<div className="flex h-full min-h-0">
  <FieldsSidebar
    farms={farms}
    fields={fields}
    enterprises={enterprises}
    visibleEnterprises={visibleEnterprises}
    selectedFieldId={selectedFieldId}
    onEnterpriseToggle={handleEnterpriseToggle}
    onFarmSelect={handleFarmZoom}
    onFieldSelect={(id) => setSelectedFieldId(id)}
    onAddField={() => navigate('/fields/new')}
  />
  <div className="flex-1 relative min-w-0">
    {/* existing map + overlay rails live here unchanged */}
  </div>
</div>
```

If `navigate` isn't imported, add `import { useNavigate } from 'react-router-dom'` and `const navigate = useNavigate()`.

**"Add field" wiring:** grep confirms no existing field-creation flow. This plan adds one — Tasks 5 + 6 below cover the backend `POST /api/fields` endpoint and the new `NewFieldModal` component. `onAddField` opens the modal with no pre-filled geometry.

- [ ] **Step 2.3: Delete MapControls**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex/frontend
rm src/components/map/MapControls.tsx src/components/map/MapControls.test.tsx 2>/dev/null || true
```

- [ ] **Step 2.4: Typecheck + full test suite**

```bash
npx tsc -b --noEmit
npm test
```

Expected: green. If typecheck surfaces references to `MapControls` anywhere else, clean them.

- [ ] **Step 2.5: Commit**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex
git add frontend/src/components/map/FieldsSidebar.tsx frontend/src/components/map/FieldsSidebar.test.tsx frontend/src/pages/FarmMapPage.tsx
git rm frontend/src/components/map/MapControls.tsx frontend/src/components/map/MapControls.test.tsx 2>/dev/null || true
git commit -m "$(cat <<'EOF'
feat(map): spec 5l — left-side FieldsSidebar replaces MapControls

New left sidebar groups fields by enterprise with per-group totals,
overall hectarage, click-to-zoom, per-enterprise visibility toggle,
farm selector, and field search. Deletes MapControls — the filter panel
is superseded. State remains in FarmMapPage; sidebar is a pure consumer.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 — Mobile sheet wrapping

- [ ] **Step 3.1: Conditionally render as FluidSheet below md**

Grep confirmed: **no `useMediaQuery` hook exists** in `frontend/src/hooks/`. Don't write one — use Tailwind responsive classes, which handle render + hide without JS state.

In `FarmMapPage.tsx`, render the sidebar twice with mutually-exclusive visibility:

```tsx
const [sidebarOpen, setSidebarOpen] = useState(false);

const sidebar = (
  <FieldsSidebar
    farms={farms}
    fields={fields}
    enterprises={enterprises}
    visibleEnterprises={visibleEnterprises}
    selectedFieldId={selectedFieldId}
    onEnterpriseToggle={handleEnterpriseToggle}
    onFarmSelect={handleFarmZoom}
    onFieldSelect={(id) => setSelectedFieldId(id)}
    onAddField={handleAddField}
  />
);

return (
  <div className="flex h-full min-h-0">
    {/* Desktop: inline flex child */}
    <div className="hidden md:block h-full">{sidebar}</div>
    {/* Mobile: FluidSheet overlay */}
    <div className="md:hidden">
      <FluidSheet side="left" open={sidebarOpen} onClose={() => setSidebarOpen(false)}>
        {sidebar}
      </FluidSheet>
    </div>
    <div className="flex-1 relative min-w-0">
      {/* Hamburger pill (mobile only) */}
      <button
        type="button"
        className="md:hidden absolute top-3 left-3 z-10 glass-button rounded-full w-10 h-10 flex items-center justify-center"
        aria-label="Open fields sidebar"
        onClick={() => setSidebarOpen(true)}
      >
        <List size={18} />
      </button>
      {/* existing FarmMap + other overlays */}
    </div>
  </div>
);
```

Import the Phosphor `List` icon at the top. Verify `FluidSheet` accepts a `side` prop (`grep -n "side" frontend/src/components/map/FluidSheet.tsx`) — if not, use the default behaviour and apply any needed CSS override via className.

If the project already has a shared `activeSheet` pattern for mutual exclusion, use it. Otherwise add a basic state in `FarmMapPage`:

```tsx
type ActiveSheet = 'none' | 'fields' | 'fieldPanel' | 'annotations';
const [activeSheet, setActiveSheet] = useState<ActiveSheet>('none');
```

And ensure opening one dismisses the others (only on mobile).

- [ ] **Step 3.2: Commit mobile handling**

```bash
git add frontend/src/pages/FarmMapPage.tsx
git commit -m "feat(map): mobile FluidSheet wrapping for FieldsSidebar (spec 5l)"
```

---

---

## Task 5 — Backend: POST /api/fields endpoint (TDD)

**Files:** `backend/src/routes/farms.js`, `backend/src/routes/farms.test.js` (new).

**Context:** the `fields` table already exists (`backend/src/db/schema-farms.js:18`). Existing route file has GET list, GET detail, PATCH — but no POST. This task adds the creation handler.

- [ ] **Step 5.1: Test-harness bootstrap (once, applies to all backend route tests)**

`supertest` isn't a dev dep yet and `app` isn't exported from `index.js`. If 5m hasn't shipped first, do the one-time setup now (5m Task 1.4 documents the same change):

```bash
cd /Users/alexnelja/projects/cloudskraal-capex/backend
npm install --save-dev supertest
```

In `backend/src/index.js`, wrap the `app.listen(...)` in `if (require.main === module) { ... }` and export the `app`.

In `backend/src/db/schema.js`, change the `DB_PATH` const to read `process.env.CAPEX_DB_PATH` with the existing path as the fallback (verbatim pattern from 5m plan Step 1.4).

If 5m already landed, these are already in place — skip.

- [ ] **Step 5.2: Write failing test**

Create `backend/src/routes/farms.test.js` (first backend route test file — small, scoped to POST /api/fields):

```js
const { describe, it, expect, beforeEach, afterAll } = require('vitest');
const request = require('supertest');
const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, '..', '..', 'data', 'test-fields.db');
process.env.CAPEX_DB_PATH = TEST_DB_PATH;

beforeEach(() => {
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});
afterAll(() => {
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

const { app } = require('../index');

describe('POST /api/fields', () => {
  // seed a farm first so foreign-key checks pass
  async function seedFarm() {
    // If the app has no POST /api/farms either, insert directly via getDb().
    const { getDb } = require('../db/schema');
    const db = getDb();
    db.prepare(
      "INSERT INTO farms (id, name, code, type, total_ha, lat, lng, region, notes) VALUES ('farm-1', 'Cloudskraal', 'CS', 'owned', 1000, -33, 20, 'WC', NULL)",
    ).run();
  }

  it('creates a field with valid payload', async () => {
    await seedFarm();
    const res = await request(app).post('/api/fields').send({
      farm_id: 'farm-1',
      name: 'Blok 1',
      enterprise: 'rooibos',
      area_ha: 42,
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Blok 1', enterprise: 'rooibos' });
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('created_at');
  });

  it('rejects missing required fields with 400', async () => {
    await seedFarm();
    const res = await request(app).post('/api/fields').send({ name: 'x' });
    expect(res.status).toBe(400);
  });

  it('rejects unknown farm_id with 400', async () => {
    const res = await request(app).post('/api/fields').send({
      farm_id: 'nonexistent',
      name: 'Blok 1',
      enterprise: 'rooibos',
      area_ha: 42,
    });
    expect(res.status).toBe(400);
  });

  it('accepts optional geometry + crop_type + planted_year + status + notes', async () => {
    await seedFarm();
    const res = await request(app).post('/api/fields').send({
      farm_id: 'farm-1',
      name: 'Blok 2',
      enterprise: 'wine',
      area_ha: 22,
      crop_type: 'Chenin Blanc',
      planted_year: '2019',
      status: 'active',
      geometry: JSON.stringify({ type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,0]]] }),
      notes: 'Sandy loam',
    });
    expect(res.status).toBe(201);
    expect(res.body.geometry).toBeTruthy();
  });
});
```

- [ ] **Step 5.3: Implement POST /api/fields**

In `backend/src/routes/farms.js`, add above the existing `PATCH /fields/:id` handler:

```js
// POST /api/fields — create a new field
router.post('/fields', (req, res) => {
  const db = getDb();
  const required = ['farm_id', 'name', 'enterprise', 'area_ha'];
  for (const k of required) {
    if (req.body[k] === undefined || req.body[k] === null || req.body[k] === '') {
      return res.status(400).json({ error: `Missing required field: ${k}` });
    }
  }
  const farm = db.prepare('SELECT id FROM farms WHERE id = ?').get(req.body.farm_id);
  if (!farm) return res.status(400).json({ error: 'Unknown farm_id' });

  const { v4: uuidv4 } = require('uuid');
  const now = new Date().toISOString();
  const row = {
    id: uuidv4(),
    farm_id: req.body.farm_id,
    name: req.body.name,
    code: req.body.code ?? null,
    enterprise: req.body.enterprise,
    crop_type: req.body.crop_type ?? null,
    area_ha: Number(req.body.area_ha),
    planted_year: req.body.planted_year ?? null,
    status: req.body.status ?? 'active',
    geometry:
      typeof req.body.geometry === 'string'
        ? req.body.geometry
        : req.body.geometry
        ? JSON.stringify(req.body.geometry)
        : null,
    notes: req.body.notes ?? null,
    created_at: now,
    updated_at: now,
  };
  db.prepare(
    `INSERT INTO fields (id, farm_id, name, code, enterprise, crop_type, area_ha, planted_year, status, geometry, notes, created_at, updated_at)
     VALUES (@id, @farm_id, @name, @code, @enterprise, @crop_type, @area_ha, @planted_year, @status, @geometry, @notes, @created_at, @updated_at)`,
  ).run(row);
  res.status(201).json(row);
});
```

Verify the `fields` table columns line up with this list via `grep -A 15 "CREATE TABLE IF NOT EXISTS fields" backend/src/db/schema-farms.js`. Adjust if the schema uses different column names.

- [ ] **Step 5.4: Run — expect PASS**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex/backend
npx vitest run src/routes/farms.test.js
npm test
```

- [ ] **Step 5.5: Commit backend piece**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex
git add backend/package.json backend/package-lock.json backend/src/index.js backend/src/db/schema.js backend/src/routes/farms.js backend/src/routes/farms.test.js
git commit -m "$(cat <<'EOF'
feat(backend): POST /api/fields endpoint for creating fields

First backend route test harness (supertest + CAPEX_DB_PATH env) plus
a POST /api/fields handler validating required fields + farm_id FK.

Enables the new FieldsSidebar ADD button (5l) and the measure save-as
FIELD branch (5m) to create fields, not just stub them.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6 — Frontend: createField API + NewFieldModal (TDD)

**Files:** `frontend/src/api/farms.ts` (extend), `frontend/src/components/map/NewFieldModal.tsx` + `.test.tsx` (new).

- [ ] **Step 6.1: Extend the API client**

In `frontend/src/api/farms.ts`, add:

```ts
export interface CreateFieldInput {
  farm_id: string;
  name: string;
  enterprise: string;
  area_ha: number;
  crop_type?: string | null;
  planted_year?: string | null;
  status?: string | null;
  geometry?: string | null;
  notes?: string | null;
}

export async function createField(input: CreateFieldInput): Promise<Field> {
  const res = await fetch('/api/fields', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.error ?? `Create failed: ${res.status}`);
  }
  return res.json();
}
```

- [ ] **Step 6.2: Write failing modal tests**

Create `frontend/src/components/map/NewFieldModal.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import NewFieldModal from './NewFieldModal';
import * as api from '../../api/farms';
import type { Farm } from '../../types/farm';

const FARMS: Farm[] = [
  { id: 'f1', name: 'Cloudskraal', code: 'CS', type: 'owned', total_ha: 1000, lat: -33, lng: 20, region: 'WC', notes: null },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NewFieldModal', () => {
  it('renders when open, hidden when closed', () => {
    const { rerender } = render(
      <NewFieldModal open={false} onClose={vi.fn()} onCreated={vi.fn()} farms={FARMS} enterprises={['rooibos', 'wine']} />
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(
      <NewFieldModal open={true} onClose={vi.fn()} onCreated={vi.fn()} farms={FARMS} enterprises={['rooibos', 'wine']} />
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('submits a valid field and calls onCreated', async () => {
    const spy = vi.spyOn(api, 'createField').mockResolvedValue({
      id: 'new', farm_id: 'f1', name: 'Blok', enterprise: 'rooibos', area_ha: 10,
      code: null, crop_type: null, planted_year: null, status: 'active', soil_type: null, irrigation_type: null, notes: null,
    } as never);
    const onCreated = vi.fn();
    render(
      <NewFieldModal open={true} onClose={vi.fn()} onCreated={onCreated} farms={FARMS} enterprises={['rooibos', 'wine']} />
    );
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Blok' } });
    fireEvent.change(screen.getByLabelText(/enterprise/i), { target: { value: 'rooibos' } });
    fireEvent.change(screen.getByLabelText(/area/i), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /create/i }));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(onCreated).toHaveBeenCalled();
  });

  it('shows error when name is missing', () => {
    render(
      <NewFieldModal open={true} onClose={vi.fn()} onCreated={vi.fn()} farms={FARMS} enterprises={['rooibos', 'wine']} />
    );
    fireEvent.click(screen.getByRole('button', { name: /create/i }));
    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
  });

  it('accepts optional pre-filled geometry + area (from 5m FIELD branch)', async () => {
    const spy = vi.spyOn(api, 'createField').mockResolvedValue({ id: 'n' } as never);
    const geom = { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,0]]] } as const;
    render(
      <NewFieldModal
        open={true}
        onClose={vi.fn()}
        onCreated={vi.fn()}
        farms={FARMS}
        enterprises={['rooibos']}
        geometry={geom}
        areaHa={80.72}
      />
    );
    // Area field is pre-filled and read-only when provided
    const area = screen.getByLabelText(/area/i) as HTMLInputElement;
    expect(area.value).toBe('80.72');
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'New block' } });
    fireEvent.change(screen.getByLabelText(/enterprise/i), { target: { value: 'rooibos' } });
    fireEvent.click(screen.getByRole('button', { name: /create/i }));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    const call = spy.mock.calls[0][0];
    expect(call.area_ha).toBe(80.72);
    expect(call.geometry).toBeTruthy();
  });
});
```

- [ ] **Step 6.3: Implement NewFieldModal**

Create `frontend/src/components/map/NewFieldModal.tsx`. Wraps `FluidDialog` with a focused form:

```tsx
import { useEffect, useState } from 'react';
import FluidDialog from './FluidDialog';
import { createField } from '../../api/farms';
import { ENTERPRISE_LABELS } from '../../types/farm';
import type { Farm, Field } from '../../types/farm';

interface NewFieldModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (field: Field) => void;
  farms: Farm[];
  enterprises: string[];
  /** Optional — pre-filled from the measure save-as FIELD branch (5m). */
  geometry?: GeoJSON.Geometry;
  /** Optional — computed area_ha from the drawn polygon. */
  areaHa?: number;
}

export default function NewFieldModal({
  open, onClose, onCreated, farms, enterprises, geometry, areaHa,
}: NewFieldModalProps) {
  const [farmId, setFarmId] = useState('');
  const [name, setName] = useState('');
  const [enterprise, setEnterprise] = useState('');
  const [cropType, setCropType] = useState('');
  const [area, setArea] = useState('');
  const [plantedYear, setPlantedYear] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFarmId(farms[0]?.id ?? '');
    setName('');
    setEnterprise(enterprises[0] ?? '');
    setCropType('');
    setArea(areaHa != null ? String(areaHa) : '');
    setPlantedYear('');
    setNotes('');
    setError(null);
  }, [open, farms, enterprises, areaHa]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    if (!farmId) { setError('Select a farm'); return; }
    if (!enterprise) { setError('Select an enterprise'); return; }
    const areaNum = Number(area);
    if (!Number.isFinite(areaNum) || areaNum <= 0) { setError('Area must be a positive number'); return; }
    setSaving(true);
    setError(null);
    try {
      const field = await createField({
        farm_id: farmId,
        name: name.trim(),
        enterprise,
        area_ha: areaNum,
        crop_type: cropType || null,
        planted_year: plantedYear || null,
        geometry: geometry ? JSON.stringify(geometry) : null,
        notes: notes || null,
      });
      onCreated(field);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <FluidDialog role="dialog" aria-labelledby="new-field-title" onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-5 space-y-3 w-[320px]">
        <h2 id="new-field-title" className="text-[15px] font-semibold text-stone-800">New field</h2>
        {geometry && (
          <p className="text-[11px] text-stone-500">
            Drawn polygon pre-filled — area locked to {areaHa?.toFixed(2)} ha.
          </p>
        )}
        <label className="block text-[11px] font-medium text-stone-600">
          Farm
          <select
            value={farmId} onChange={(e) => setFarmId(e.target.value)}
            className="mt-1 w-full glass-input rounded-lg px-2 py-1.5 text-[12px]"
          >
            {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
        <label className="block text-[11px] font-medium text-stone-600">
          Name
          <input
            type="text" value={name} onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full glass-input rounded-lg px-2 py-1.5 text-[12px]" autoFocus
          />
        </label>
        <label className="block text-[11px] font-medium text-stone-600">
          Enterprise
          <select
            value={enterprise} onChange={(e) => setEnterprise(e.target.value)}
            className="mt-1 w-full glass-input rounded-lg px-2 py-1.5 text-[12px]"
          >
            <option value="">—</option>
            {enterprises.map((e) => <option key={e} value={e}>{ENTERPRISE_LABELS[e] ?? e}</option>)}
          </select>
        </label>
        <label className="block text-[11px] font-medium text-stone-600">
          Crop type (optional)
          <input
            type="text" value={cropType} onChange={(e) => setCropType(e.target.value)}
            className="mt-1 w-full glass-input rounded-lg px-2 py-1.5 text-[12px]"
          />
        </label>
        <div className="flex gap-2">
          <label className="flex-1 block text-[11px] font-medium text-stone-600">
            Area (ha)
            <input
              type="number" step="0.01" value={area} onChange={(e) => setArea(e.target.value)}
              readOnly={areaHa != null}
              className={`mt-1 w-full glass-input rounded-lg px-2 py-1.5 text-[12px] ${areaHa != null ? 'bg-stone-100' : ''}`}
            />
          </label>
          <label className="flex-1 block text-[11px] font-medium text-stone-600">
            Planted year
            <input
              type="text" value={plantedYear} onChange={(e) => setPlantedYear(e.target.value)}
              placeholder="2024"
              className="mt-1 w-full glass-input rounded-lg px-2 py-1.5 text-[12px]"
            />
          </label>
        </div>
        <label className="block text-[11px] font-medium text-stone-600">
          Notes (optional)
          <textarea
            value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            className="mt-1 w-full glass-input rounded-lg px-2 py-1.5 text-[12px]"
          />
        </label>
        {error && <p className="text-[11px] text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="glass-button rounded-lg px-3 py-1.5 text-[12px]">Cancel</button>
          <button type="submit" disabled={saving} className="bg-emerald-700 text-white rounded-lg px-3 py-1.5 text-[12px] font-medium disabled:opacity-50">
            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </FluidDialog>
  );
}
```

Adapt the `FluidDialog` prop interface to whatever that primitive actually expects — if it needs `open` or `trigger` etc., wire those.

- [ ] **Step 6.4: Wire onAddField in FarmMapPage**

Replace the toast placeholder in Task 2.2 with real state + modal:

```tsx
const [newFieldOpen, setNewFieldOpen] = useState(false);
const [newFieldSeed, setNewFieldSeed] = useState<{ geometry?: GeoJSON.Geometry; areaHa?: number }>({});

const handleAddField = () => {
  setNewFieldSeed({});  // no pre-fill for the sidebar ADD button
  setNewFieldOpen(true);
};

// ...render alongside the map:
<NewFieldModal
  open={newFieldOpen}
  onClose={() => setNewFieldOpen(false)}
  onCreated={(field) => {
    // Optimistic append to local fields; refetch geojson for the polygon
    refetchFields();
    refetchFieldsGeoJson();
  }}
  farms={farms}
  enterprises={enterprises}
  geometry={newFieldSeed.geometry}
  areaHa={newFieldSeed.areaHa}
/>
```

`refetchFields` / `refetchFieldsGeoJson` are whatever hooks/functions `FarmMapPage` already uses to load them. If React Query or SWR isn't in play, trigger a manual re-fetch.

- [ ] **Step 6.5: Run — expect PASS**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex/frontend
npm test
npx tsc -b --noEmit
```

- [ ] **Step 6.6: Commit**

```bash
git add frontend/src/api/farms.ts frontend/src/components/map/NewFieldModal.tsx frontend/src/components/map/NewFieldModal.test.tsx frontend/src/pages/FarmMapPage.tsx
git commit -m "feat(map): NewFieldModal + createField client — wires FieldsSidebar ADD button"
```

---

## Task 7 — Manual smoke + handoff

- [ ] **Step 7.1: Launch Electron and walk:**

- [ ] Left sidebar renders on `/map` with correct totals.
- [ ] Enterprises grouped with coloured left-bars. Groups expand/collapse.
- [ ] Reload: expansion state persists.
- [ ] Click field row → map zooms and highlights the polygon.
- [ ] Click eye → all that enterprise's fields vanish from the map.
- [ ] Search narrows the visible rows.
- [ ] Mobile (390px): hamburger pill opens the sidebar as a sheet; backdrop dismisses.
- [ ] Click ADD in the sidebar → NewFieldModal opens, submit a new field → appears in the sidebar list.

- [ ] **Step 7.2: Write handoff**

Create `docs/handoffs/2026-04-17-spec-5l-fields-sidebar.md`.

- [ ] **Step 7.3: Commit handoff**

## Done when

- [ ] 7 FieldsSidebar tests + 4 NewFieldModal tests + 4 farms-route tests + full suite green.
- [ ] `MapControls.tsx` + `MapControls.test.tsx` removed from the repo.
- [ ] Mobile sheet works without stacking multiple sheets.
- [ ] Sidebar ADD creates a real field via `POST /api/fields`.
- [ ] Smoke ticks all boxes.
- [ ] ≤ 5 commits for 5l (main sidebar + mobile + POST endpoint + modal + handoff).
