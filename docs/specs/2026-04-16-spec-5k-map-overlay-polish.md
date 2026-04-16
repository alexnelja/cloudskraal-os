# Spec 5k — Map overlay polish (pill filters + measure in TR + emerald-glass FAB)

- **Status:** Approved for planning (2026-04-16, Spec A of the current cycle).
- **Parent:** extends `MapOverlayRail` + `MapControls` + `QuickAddFAB` shipped 2026-04-16 (commits `895ebbd`, `a9d52e9`, `54c87bd`, `db2ba62`).
- **Part of:** Spec A of the map UX polish cycle. Spec B (field info interface) is a separate brainstorm.

## Problem

Three friction points in today's `/map` overlay:

1. **Measure toolbar lives at TL** (via `map.addControl(MaplibreMeasureControl, 'top-left')`), visually disconnected from the rest of the right-side controls and with its own library-provided styling that doesn't match the glass-token language adopted in commit `54c87bd`.
2. **Filter UI in `MapControls`** uses custom checkboxes + dots + labels. Functional but dated — doesn't lean on the distinctive enterprise brand palette (rooibos green, wine purple, sheep amber, buchu teal) that already codes the map.
3. **FAB** ships with a heavy emerald gradient + dual radial highlight + big drop shadow. Stylistically foreign next to the neutral glass rail.

The operator's eye has to re-parse three visual languages to use one page. Alex wants one.

## Goal

Unify the overlay rail under a single glass-token visual language while modernising the filter affordance, without growing scope into data-view territory (that's Spec B).

## In scope

- Move measurement controls into the TR rail as a **custom React toolbar** that drives the TerraDraw instance directly. Remove the built-in `MaplibreMeasureControl` toolbar at TL.
- Enterprise filter: replace the checkbox + dot + label grid with **coloured pill chips** (filled = visible, outlined = hidden).
- Field search: keep, restyle with consistent rounded-10 glass-input surface.
- Farm dropdown: keep as native `<select>` with glass-input styling (no combobox rewrite — YAGNI).
- `QuickAddFAB`: swap green gradient for **glass + emerald accent** (emerald border, emerald icon, emerald-tinted shadow, same glass-bg as the rail).
- TR stack order (top → bottom): filter panel → measure toolbar → basemap pill → layers button → annotations pill.
- Mobile responsiveness preserved (≤ 768px): filter panel already constrained to `min(100vw-7rem, 18rem)`; measure toolbar fits 4 × 34px = 144px.

## Out of scope (deferred)

| Ref | What | Why deferred |
|---|---|---|
| Spec B | Field info interface + total hectarage | Separate spec, brainstormed after A locks. |
| — | Farm dropdown → custom combobox with search | Native select is fine; change only adds code. |
| — | Keyboard shortcuts for measure modes | Already handled via TerraDraw's built-in undo/redo shortcuts. |
| — | Annotations sidebar redesign | Out of scope; only the launcher pill lives in TR. |
| — | Legend (BL) restyle | Already glass-token'd; no polish needed this round. |
| — | Basemap switcher popover redesign | Recently shipped + A1 WC basemap work still smoke-pending. |

## Design decisions (locked in brainstorm)

**Filter direction:** pill chips — `data-choice="pills"`.
Filled pill = enterprise visible; outlined pill = hidden. Tap to toggle. Colour comes from `ENTERPRISE_COLORS`.

**FAB variant:** `F2 — Glass with emerald accent` — `data-choice="fab-accent-glass"`.
- Background: `var(--glass-bg)` (same as rail).
- Border: `1px solid rgba(4,120,87,0.4)` (emerald-700 @ 40%).
- Icon color: `#047857` (emerald-700).
- Shadow: `0 8px 20px rgba(4,120,87,0.18)`.
- Open state: X icon in same emerald; no gradient swap (since there's no dark-open variant needed any more — glass recedes on its own).

**Measure integration:** custom React toolbar that calls `td.setMode('linestring' | 'polygon' | 'point')` on the existing TerraDraw instance. The `MaplibreMeasureControl.addControl()` registration is removed from `AnnotateTool.tsx`; the component still owns the TerraDraw instance via `getTerraDrawInstance()` so callers (CreateTaskModal, SaveAnnotationModal, etc.) are unaffected.

## Component changes

### `frontend/src/components/map/MapControls.tsx`

**Enterprise filter — replace the checkbox/dot/label grid:**

```tsx
// Before: Custom checkbox with inline SVG + dot + label
// After: Pill chips
<div className="flex flex-wrap gap-1.5">
  {filterableEnterprises.map((ent) => {
    const isVisible = visibleEnterprises.includes(ent);
    const color = ENTERPRISE_COLORS[ent] ?? '#6b7280';
    return (
      <button
        key={ent}
        onClick={() => onEnterpriseToggle(ent)}
        aria-pressed={isVisible}
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
        style={isVisible
          ? { background: color, color: 'white', borderWidth: 0 }
          : { background: 'transparent', color: '#a8a29e', border: '1px solid #d6d3d1' }
        }
      >
        {ENTERPRISE_LABELS[ent] ?? ent}
      </button>
    );
  })}
</div>
```

Label omits the leading dot since the pill colour is the affordance.
Label text uses `ENTERPRISE_LABELS[ent] ?? ent`.
`aria-pressed` communicates toggle state for assistive tech.

**Farm dropdown — polish only:**

- Swap `glass-input` class for a slightly rounded-10 variant — reuse `var(--glass-bg-soft)` so it matches the surrounding panel.
- Keep native `<select>`. Keep chevron indicator.

**Field search:** unchanged except apply the same rounded-10 + `--glass-bg-soft` surface as the farm dropdown so both inputs feel related.

### `frontend/src/components/map/tools/AnnotateTool.tsx`

- Remove `map.addControl(control, 'top-left')` and the surrounding `MaplibreMeasureControl` registration. The library class is still imported and instantiated so it wires the TerraDraw modes + keyboard shortcuts + event loop — just not added as a MapLibre control.
- Add an `onReady?: (td: TerraDraw) => void` prop. After `getTerraDrawInstance()` resolves, call `onReady(td)` once. This is how `FarmMapPage` gets the instance for `MeasureToolbar` — no ref-forwarding, no hook extraction, matches the existing `onMapReady` pattern in `FarmMap`.
- Keep the existing `onModeChange(mode)` callback (polling-based). It already fires on mode transitions; no additional plumbing needed.

### `frontend/src/components/map/MeasureToolbar.tsx` (new)

A glass-surfaced toolbar with four buttons: measure distance, measure area, drop pin, draw polygon. Each button calls `td.setMode(...)`. Active mode gets `bg-amber-50 text-amber-700` highlight; inactive is `bg-stone-50 text-stone-600`.

```tsx
interface MeasureToolbarProps {
  terraDraw: TerraDraw | null;
  currentMode: string;
}
```

Button specs (avoid per-implementer drift): each button is `w-[34px] h-[34px] rounded-[10px]`; Phosphor icons `size={18} weight="regular"`; toolbar container `rounded-[16px] p-1.5 gap-1 flex` with the same `--glass-bg` / `--glass-border` / `--glass-blur` / `--glass-shadow` tokens as the rest of the rail.

Rendered inside the TR `MapOverlayRail` between the filter panel and basemap pill.

### `frontend/src/components/QuickAddFAB.tsx`

- Replace the closed-state inline styles (lines 110-118):
  ```tsx
  style={{
    background: 'var(--glass-bg)',
    border: '1px solid rgba(4,120,87,0.4)',
    boxShadow:
      '0 8px 20px rgba(4,120,87,0.18), inset 0 1px 0 rgba(255,255,255,0.25)',
    backdropFilter: 'var(--glass-blur)',
  }}
  ```
- Remove the `open ? emerald-gradient : darker-gradient` conditional — glass surface is constant; icon colour is the state indicator (`text-emerald-700` closed, `text-stone-500` open).
- Remove the radial highlight span (lines 119-126) — it only made sense on the solid gradient.
- Change icon colour to `#047857` (emerald-700) in both states, keep weight/size.

### `frontend/src/pages/FarmMapPage.tsx`

Owns two new pieces of state — `const [terraDraw, setTerraDraw] = useState<TerraDraw | null>(null)` and `const [drawMode, setDrawMode] = useState<string>('static')`. Both are wired through existing props on `AnnotateTool`: the new `onReady={setTerraDraw}` callback for the instance, and the existing `onModeChange={setDrawMode}` callback for the active mode. `AnnotateTool` itself doesn't hold either in React state today (mode is polled via `setInterval`; instance lives in a ref), so this is pure consumer-side capture, no ref-lift or prop-drill refactor.

Add `MeasureToolbar` to the TR rail stack between `MapControls` and `BasemapSwitcher`:

```tsx
<MapOverlayRail position="tr">
  <MapControls ... />
  <MeasureToolbar terraDraw={terraDraw} currentMode={drawMode} />
  <BasemapSwitcher ... />
  <LayerControl ... />
  {/* Annotations pill */}
</MapOverlayRail>
```

## Tests (TDD, tests first)

1. **`MeasureToolbar.test.tsx` (new)**
   - Renders 4 buttons (distance, area, pin, polygon).
   - Clicking a button calls `terraDraw.setMode(expectedMode)` once.
   - `currentMode` prop highlights the matching button (aria-pressed + class assertion).
   - Renders nothing / graceful no-op when `terraDraw === null` (early mount).

2. **`MapControls.test.tsx` (extend existing)**
   - Pill chip renders as a `<button>` with `aria-pressed` reflecting `visibleEnterprises`.
   - Clicking a pill calls `onEnterpriseToggle` with the enterprise key.
   - Visible pills have inline background = `ENTERPRISE_COLORS[ent]`; hidden pills have no background.
   - Removal of old custom checkbox markup verified by absence of `role="switch"` or `input[type=checkbox].sr-only`.

3. **`QuickAddFAB.test.tsx` (extend existing)**
   - Closed state: inspect the element's inline `style.background` string directly (not `getComputedStyle`, which jsdom doesn't resolve gradients for). Expect: `expect(button.style.background).not.toMatch(/linear-gradient/)` AND `expect(button.style.background).toMatch(/var\(--glass-bg\)|rgba\(255,\s*255,\s*255/)` — one positive match for the glass surface.
   - Open state: same inline-style check — no gradient, same glass background. (Today's code swaps to a dark gradient on open; the spec removes that conditional.)
   - Icon: `expect(iconElement).toHaveClass('text-emerald-700')` or equivalent — verifies the colour rule directly.
   - Existing click-to-expand + Esc-to-close tests still pass.

4. **Smoke (required):**
   - Measure toolbar renders in TR (not TL).
   - Tapping each measure button enters the matching TerraDraw mode (tooltip + cursor change confirms).
   - Enterprise pills toggle field visibility as before.
   - FAB open/close animation still works.
   - Mobile (390px): TR stack doesn't horizontally clip; pills wrap cleanly.

## Risks

- **TerraDraw lifecycle coupling.** Measure toolbar needs the TerraDraw instance, which today is ref-owned inside `AnnotateTool`. Lifting state may surface mount-order bugs (toolbar mounts before TerraDraw is ready). Mitigation: toolbar renders nothing when `terraDraw === null`, matching `MapControls`' farm-dropdown pattern.
- **Built-in TL toolbar removal.** Any keyboard shortcut or gesture provided by `MaplibreMeasureControl`'s UI (not by the underlying `TerraDraw` instance) is lost. Spot-check: undo/redo come from `TerraDrawUndoRedoKeyboardShortcuts`, which is already wired independently. Mode-switching shortcuts aren't currently in use. Safe to remove.
- **Pill chip a11y.** Replacing `input[type=checkbox]` with `button[aria-pressed]` loses native checkbox keyboard semantics. Still accessible, but worth confirming with VoiceOver.
- **FAB visibility contrast.** Glass FAB may be harder to spot against a bright Esri satellite tile than the current solid gradient. Mitigation: the emerald border + shadow keeps it readable; smoke check confirms across all 11 basemaps in the current BasemapSwitcher registry.
- **Orphaned CSS from `MaplibreMeasureControl`.** The library injects styles under `.maplibregl-ctrl-group` for its toolbar. After we stop adding the control, the CSS remains imported (`'@watergis/maplibre-gl-terradraw/dist/maplibre-gl-terradraw.css'`) but the rules don't attach to anything. No visual effect — but if the import is kept solely for that stylesheet, the import comment should note that it also scopes terradraw's draw-geometry paint (fill/line for in-progress geometries) which IS still needed. Don't remove the CSS import.

## Files changed

| File | Change |
|---|---|
| `frontend/src/components/map/MapControls.tsx` | Swap enterprise checkbox grid for pill chips; polish farm dropdown + search surfaces. |
| `frontend/src/components/map/MapControls.test.tsx` | Extend with pill-chip assertions. |
| `frontend/src/components/map/MeasureToolbar.tsx` (new) | Custom React toolbar driving TerraDraw. |
| `frontend/src/components/map/MeasureToolbar.test.tsx` (new) | Unit tests for the toolbar. |
| `frontend/src/components/map/tools/AnnotateTool.tsx` | Remove `MaplibreMeasureControl` registration; expose TerraDraw instance. |
| `frontend/src/components/QuickAddFAB.tsx` | Swap green-gradient style for glass + emerald accent. |
| `frontend/src/components/QuickAddFAB.test.tsx` | Extend with glass-surface assertions. |
| `frontend/src/pages/FarmMapPage.tsx` | Wire `MeasureToolbar` into TR rail; hoist `drawMode` state. |
| `docs/handoffs/2026-04-17-spec-5k-map-overlay.md` (new on ship) | Smoke results + visual diff notes. |

No backend changes. No new dependencies. No DB migration.

## Success criteria

- TR rail contains 5 items in order: filter → measure → basemap → layers → annotations.
- TL rail is empty (terradraw's built-in toolbar gone).
- Filter panel uses pill chips; no `<input type="checkbox">` remains.
- FAB closed state shows no `linear-gradient` in computed style; `aria-pressed`-equivalent visual cues work.
- Full frontend test suite green (existing + 4 new tests across 2 new test files + extensions).
- `npx tsc -b --noEmit` clean.
- `git log` for 5k work is ≤ 4 focused commits.
- Manual smoke passes across 3 viewport widths (390 / 1280 / 1920).
