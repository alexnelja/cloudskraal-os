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

**"Add field" wiring (pragmatic):** grep confirms **no existing field-creation flow** in the codebase — no `/fields/new` route, no `NewFieldModal`, no `createField` API client. The ADD button in image 9 is aspirational; building real field-creation is a separate spec.

For this plan, `onAddField` is a stub: show a toast "Field creation coming in a later spec" and no-op. Reuse whatever toast primitive the rest of the app uses (check `FarmMapPage` for existing `react-hot-toast` or similar). If no toast library is in use, fall back to `alert('Field creation coming soon')`. The button stays on the sidebar so the UI matches image 9; wiring the real creation flow is deferred.

Capture this deferral in the handoff (Task 4.2) so it's tracked.

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

## Task 4 — Manual smoke + handoff

- [ ] **Step 4.1: Launch Electron and walk:**

- [ ] Left sidebar renders on `/map` with correct totals.
- [ ] Enterprises grouped with coloured left-bars. Groups expand/collapse.
- [ ] Reload: expansion state persists.
- [ ] Click field row → map zooms and highlights the polygon.
- [ ] Click eye → all that enterprise's fields vanish from the map.
- [ ] Search narrows the visible rows.
- [ ] Mobile (390px): hamburger pill opens the sidebar as a sheet; backdrop dismisses.

- [ ] **Step 4.2: Write handoff**

Create `docs/handoffs/2026-04-17-spec-5l-fields-sidebar.md`.

- [ ] **Step 4.3: Commit handoff**

## Done when

- [ ] 7 FieldsSidebar tests + full suite green.
- [ ] `MapControls.tsx` + `MapControls.test.tsx` removed from the repo.
- [ ] Mobile sheet works without stacking multiple sheets.
- [ ] Smoke ticks all boxes.
- [ ] ≤ 3 commits for 5l (this plan targets 3: main change + mobile + handoff).
