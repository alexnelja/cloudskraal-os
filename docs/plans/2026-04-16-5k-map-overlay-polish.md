# Spec 5k — Map Overlay Polish Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to execute task-by-task.

**Goal:** Move terradraw measure toolbar from TL to a new `MeasureToolbar` React component in TR. Restyle `QuickAddFAB` to glass + emerald accent.

**Architecture:** Zero backend. `AnnotateTool` gets an `onReady(td)` callback exposing its TerraDraw instance to `FarmMapPage`. `FarmMapPage` holds `terraDraw` + `drawMode` in `useState`, passes them to the new `MeasureToolbar`. `MaplibreMeasureControl` no longer registered as a MapLibre control. FAB inline styles change: glass surface + emerald border/icon/shadow, no gradient swap on open.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, `maplibre-gl-terradraw`, `@phosphor-icons/react`, `motion/react`.

**Spec:** `docs/specs/2026-04-16-spec-5k-map-overlay-polish.md`

---

## Pre-flight

- [ ] **Step 0.1: Green baseline**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex/frontend
npm test
npx tsc -b --noEmit
```

All green before starting.

- [ ] **Step 0.2: Clean tree on main**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex
git status --short
git log --oneline -3
```

Last commit should be `8f21850` (spec 5m polish). Tree clean. No ongoing worktree.

---

## File structure

| Path | Responsibility | Action |
|---|---|---|
| `frontend/src/components/map/MeasureToolbar.tsx` | Glass-surfaced toolbar with 4 draw-mode buttons | Create |
| `frontend/src/components/map/MeasureToolbar.test.tsx` | Unit tests for the toolbar | Create |
| `frontend/src/components/map/tools/AnnotateTool.tsx` | TerraDraw lifecycle owner | Modify (remove addControl, add onReady) |
| `frontend/src/components/QuickAddFAB.tsx` | The `+` FAB | Modify (glass+emerald style) |
| `frontend/src/components/QuickAddFAB.test.tsx` | FAB unit tests | Modify (new glass assertions) |
| `frontend/src/pages/FarmMapPage.tsx` | `/map` composition | Modify (wire state + render MeasureToolbar) |

---

## Task 1 — MeasureToolbar (TDD)

**Files:** `frontend/src/components/map/MeasureToolbar.tsx` + `.test.tsx`

- [ ] **Step 1.1: Write the failing test file**

Create `frontend/src/components/map/MeasureToolbar.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MeasureToolbar from './MeasureToolbar';

type MockTerraDraw = { setMode: ReturnType<typeof vi.fn> };

function makeTd(): MockTerraDraw {
  return { setMode: vi.fn() };
}

describe('MeasureToolbar', () => {
  it('renders nothing when terraDraw is null', () => {
    const { container } = render(<MeasureToolbar terraDraw={null} currentMode="static" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders 4 mode buttons when terraDraw is ready', () => {
    const td = makeTd();
    render(<MeasureToolbar terraDraw={td as never} currentMode="static" />);
    expect(screen.getByRole('button', { name: /measure distance/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /measure area/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /drop pin/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /draw polygon/i })).toBeInTheDocument();
  });

  it('calls setMode with linestring when distance is clicked', () => {
    const td = makeTd();
    render(<MeasureToolbar terraDraw={td as never} currentMode="static" />);
    fireEvent.click(screen.getByRole('button', { name: /measure distance/i }));
    expect(td.setMode).toHaveBeenCalledWith('linestring');
  });

  it('highlights the active mode with aria-pressed=true', () => {
    const td = makeTd();
    render(<MeasureToolbar terraDraw={td as never} currentMode="polygon" />);
    const poly = screen.getByRole('button', { name: /measure area/i });
    expect(poly).toHaveAttribute('aria-pressed', 'true');
    const line = screen.getByRole('button', { name: /measure distance/i });
    expect(line).toHaveAttribute('aria-pressed', 'false');
  });
});
```

- [ ] **Step 1.2: Run — expect FAIL (component missing)**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex/frontend
npm test -- src/components/map/MeasureToolbar.test.tsx
```

Expected: all fail with "Cannot find module './MeasureToolbar'".

- [ ] **Step 1.3: Write MeasureToolbar**

Create `frontend/src/components/map/MeasureToolbar.tsx`:

```tsx
import { Ruler, Polygon as PolyIcon, MapPin, ArrowsOut as Line } from '@phosphor-icons/react';

type TerraDraw = { setMode: (mode: string) => void };

interface MeasureToolbarProps {
  terraDraw: TerraDraw | null;
  currentMode: string;
}

interface ModeDef {
  id: string;
  label: string;
  mode: 'linestring' | 'polygon' | 'point';
  icon: typeof Ruler;
  shape: 'line' | 'poly';
}

// Map four UX buttons onto three TerraDraw modes.
// "Distance" and "Draw polygon" both use linestring/polygon draw modes,
// "Area" is also polygon with a different intent label, "Drop pin" is point.
const MODES: ModeDef[] = [
  { id: 'distance', label: 'Measure distance', mode: 'linestring', icon: Line, shape: 'line' },
  { id: 'area', label: 'Measure area', mode: 'polygon', icon: Ruler, shape: 'poly' },
  { id: 'pin', label: 'Drop pin', mode: 'point', icon: MapPin, shape: 'line' },
  { id: 'polygon', label: 'Draw polygon', mode: 'polygon', icon: PolyIcon, shape: 'poly' },
];

export default function MeasureToolbar({ terraDraw, currentMode }: MeasureToolbarProps) {
  if (!terraDraw) return null;

  return (
    <div
      className="glass-panel rounded-[16px] p-1.5 flex gap-1"
      role="toolbar"
      aria-label="Measure tools"
    >
      {MODES.map((m) => {
        const active = currentMode === m.mode;
        const Icon = m.icon;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => terraDraw.setMode(m.mode)}
            aria-label={m.label}
            aria-pressed={active}
            title={m.label}
            className={`w-[34px] h-[34px] rounded-[10px] flex items-center justify-center transition-colors ${
              active
                ? 'bg-amber-50 text-amber-700'
                : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
            }`}
          >
            <Icon size={18} weight="regular" />
          </button>
        );
      })}
    </div>
  );
}
```

**Note on the four-buttons-three-modes quirk:** terradraw only has `linestring` / `polygon` / `point`. The area button and polygon button both drive `polygon` mode — that's intentional. Operator mental model is "am I measuring an area or drawing a field?" but the underlying draw interaction is identical.

- [ ] **Step 1.4: Run — expect PASS**

```bash
npm test -- src/components/map/MeasureToolbar.test.tsx
```

If `glass-panel` class is missing from index.css, the test still passes (class doesn't affect functionality); the smoke will catch visual regressions.

---

## Task 2 — AnnotateTool expose onReady

**Files:** `frontend/src/components/map/tools/AnnotateTool.tsx`

- [ ] **Step 2.1: Read current AnnotateTool to confirm the ref holder pattern**

```bash
grep -n "addControl\|getTerraDrawInstance\|onModeChange" /Users/alexnelja/projects/cloudskraal-capex/frontend/src/components/map/tools/AnnotateTool.tsx
```

Confirm there's a `control.getTerraDrawInstance?.()` call that returns the TerraDraw instance.

- [ ] **Step 2.2: Modify AnnotateTool props + lifecycle**

Edit `AnnotateTool.tsx`. Current state (verified by grep):
- `onFinish` and `onModeChange` props already exist (props interface at line 22).
- `map.addControl(control, 'top-left')` at line 74.
- Cleanup returns include `map.removeControl(controlRef.current)` at line 103.
- `controlRef` holds the `MaplibreMeasureControl` instance for lifecycle + TerraDraw access via `control.getTerraDrawInstance?.()`.

Changes:

1. Add `onReady?: (td: TerraDraw) => void;` to the props interface.
2. Destructure `onReady` in the function signature.
3. **Remove BOTH `map.addControl(control, 'top-left')` (line 74) AND the matching `map.removeControl(controlRef.current)` in the cleanup return (line 103).** Removing only the add without the remove will throw on unmount because MapLibre rejects removing a control it never registered. `controlRef` still exists (used for `getTerraDrawInstance`).
4. After `const td = control.getTerraDrawInstance?.();`, if `td` is defined, call `onReady?.(td)`. Guard with a `useRef<boolean>(false)` flag so it only fires once even if React re-runs the effect.
5. Leave `onModeChange` polling unchanged.

Quick sanity grep after the edit:

```bash
grep -n "addControl\|removeControl" /Users/alexnelja/projects/cloudskraal-capex/frontend/src/components/map/tools/AnnotateTool.tsx
```

Should return **zero matches** (all `MaplibreMeasureControl` registrations gone). The map still mounts the `control` instance — it just doesn't live in MapLibre's control tree.

- [ ] **Step 2.3: Typecheck**

```bash
npx tsc -b --noEmit
```

Expect clean.

- [ ] **Step 2.4: Existing tests still pass**

```bash
npm test
```

No `AnnotateTool` unit tests exist per the spec — integration is covered by manual smoke. Skip unit tests for this task.

---

## Task 3 — QuickAddFAB glass restyle (TDD)

**Files:** `frontend/src/components/QuickAddFAB.tsx` + `.test.tsx`

- [ ] **Step 3.1: Extend the failing test**

Open `frontend/src/components/QuickAddFAB.test.tsx` and append:

```tsx
it('closed FAB renders with glass background and no linear-gradient', () => {
  render(
    <MemoryRouter>
      <QuickAddFAB />
    </MemoryRouter>,
  );
  const button = screen.getByRole('button', { name: /open quick add menu/i });
  expect(button.style.background).not.toMatch(/linear-gradient/);
  expect(button.style.background).toMatch(/var\(--glass-bg\)|rgba\(255,\s*255,\s*255/);
});

it('open FAB also uses glass surface (no dark gradient swap)', () => {
  render(
    <MemoryRouter>
      <QuickAddFAB />
    </MemoryRouter>,
  );
  const button = screen.getByRole('button', { name: /open quick add menu/i });
  fireEvent.click(button);
  const close = screen.getByRole('button', { name: /close quick add menu/i });
  expect(close.style.background).not.toMatch(/linear-gradient/);
});

it('plus icon has emerald-700 colour class', () => {
  render(
    <MemoryRouter>
      <QuickAddFAB />
    </MemoryRouter>,
  );
  const button = screen.getByRole('button', { name: /open quick add menu/i });
  const icon = button.querySelector('svg');
  expect(icon).not.toBeNull();
  // Icon uses className so we check the rendered class
  expect(icon!.getAttribute('class') || '').toMatch(/text-emerald-700/);
});
```

If the file doesn't already import `fireEvent` or `MemoryRouter`, add those imports.

- [ ] **Step 3.2: Run — expect FAIL on all three new tests**

```bash
npm test -- src/components/QuickAddFAB.test.tsx
```

Pre-existing tests stay green; new ones fail (gradient still present, icon still white).

- [ ] **Step 3.3: Rewrite the FAB inline styles**

In `QuickAddFAB.tsx`, replace the closed/open conditional on the outer `motion.button`:

```tsx
style={{
  background: 'var(--glass-bg)',
  border: '1px solid rgba(4,120,87,0.4)',
  boxShadow:
    '0 8px 20px rgba(4,120,87,0.18), inset 0 1px 0 rgba(255,255,255,0.25)',
  backdropFilter: 'var(--glass-blur)',
}}
```

- Remove the `open ? gradient : gradient` conditional entirely.
- Delete the radial-highlight span (currently lines 119-126).
- In the Plus/X icon JSX, change `className="text-white relative z-10"` → `className="text-emerald-700 relative z-10"`.

- [ ] **Step 3.4: Run — expect PASS**

```bash
npm test -- src/components/QuickAddFAB.test.tsx
```

All six tests green (3 pre-existing + 3 new).

---

## Task 4 — Wire into FarmMapPage

**Files:** `frontend/src/pages/FarmMapPage.tsx`

- [ ] **Step 4.1: Add state**

Near the top of `FarmMapPage`:

```tsx
const [terraDraw, setTerraDraw] = useState<TerraDraw | null>(null);
const [drawMode, setDrawMode] = useState<string>('static');
```

Import `TerraDraw` type from `'terra-draw'` if not already.

- [ ] **Step 4.2: Thread props through AnnotateTool**

Locate the `<AnnotateTool ... />` JSX. Add `onReady={setTerraDraw}` and `onModeChange={setDrawMode}` (the latter may already exist; verify).

- [ ] **Step 4.3: Render MeasureToolbar in TR rail**

Inside the existing `<MapOverlayRail position="tr">` children, add `<MeasureToolbar terraDraw={terraDraw} currentMode={drawMode} />` as the first child (above `<MapControls />` if it's still there, or above `<BasemapSwitcher />` if 5l has already removed `MapControls`). Both orderings are acceptable per the spec.

Import: `import MeasureToolbar from '../components/map/MeasureToolbar';`.

- [ ] **Step 4.4: Typecheck + full suite**

```bash
npx tsc -b --noEmit
npm test
```

Expected: all green.

---

## Task 5 — Commit

- [ ] **Step 5.1: Commit**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex
git add frontend/src/components/map/MeasureToolbar.tsx frontend/src/components/map/MeasureToolbar.test.tsx frontend/src/components/map/tools/AnnotateTool.tsx frontend/src/components/QuickAddFAB.tsx frontend/src/components/QuickAddFAB.test.tsx frontend/src/pages/FarmMapPage.tsx
git commit -m "$(cat <<'EOF'
feat(map): spec 5k — measure toolbar in TR + glass FAB

Move terradraw measurement UI from TL to a new MeasureToolbar React
component rendered in the TR rail. AnnotateTool gains an onReady
callback so FarmMapPage can capture the TerraDraw instance.

QuickAddFAB swaps the green gradient for a glass + emerald-accent
surface matching the rest of the rail.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6 — Manual browser smoke

- [ ] **Step 6.1: Launch Electron**

```bash
# Terminal 1
cd /Users/alexnelja/projects/cloudskraal-capex/backend
PORT=3001 node src/index.js
# Terminal 2
cd /Users/alexnelja/projects/cloudskraal-capex/frontend
npm run dev
# Then launch Electron shell
```

- [ ] **Step 6.2: Walk the checklist**

- [ ] `/map` TL area is empty (no terradraw toolbar).
- [ ] TR rail's top item is the new 4-button `MeasureToolbar`.
- [ ] Clicking each button enters the corresponding draw mode (cursor changes, terradraw UI shows the mode).
- [ ] FAB closed: glass surface, emerald `+`, emerald border + shadow. No green gradient.
- [ ] FAB open: glass surface, emerald `×`, action pills still expand.
- [ ] At 390 / 1280 / 1920 widths: TR stack doesn't clip.

- [ ] **Step 6.3: Write handoff**

Create `docs/handoffs/2026-04-17-spec-5k-map-overlay.md` with commit SHAs + smoke results.

- [ ] **Step 6.4: Commit handoff**

```bash
git add docs/handoffs/2026-04-17-spec-5k-map-overlay.md
git commit -m "docs: handoff for spec 5k — measure toolbar + glass FAB shipped"
```

## Done when

- [ ] Automated tests + typecheck green.
- [ ] Smoke passes.
- [ ] ≤ 3 commits for 5k work (this plan targets 2).
