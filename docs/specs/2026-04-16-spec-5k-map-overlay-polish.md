# Spec 5k — Map overlay polish (measure in TR + emerald-glass FAB)

- **Status:** Approved for planning (2026-04-16, Spec A of the current cycle).
- **Parent:** extends `MapOverlayRail` + `QuickAddFAB` shipped 2026-04-16 (commits `895ebbd`, `a9d52e9`, `54c87bd`, `db2ba62`).
- **Part of:** Spec A of the map UX polish cycle.
- **Related:** Spec 5l (fields tree sidebar) deletes `MapControls` — the old TR filter panel — and takes over farm/search/enterprise filtering. Spec 5m (measure save-as chooser) adds the FIELD/FEATURE/MEASUREMENT/NOTE destinations for finished measurements.

## Problem

Two friction points in today's `/map` overlay:

1. **Measure toolbar lives at TL** (via `map.addControl(MaplibreMeasureControl, 'top-left')`), visually disconnected from the rest of the right-side controls and with its own library-provided styling that doesn't match the glass-token language adopted in commit `54c87bd`.
2. **FAB** ships with a heavy emerald gradient + dual radial highlight + big drop shadow. Stylistically foreign next to the neutral glass rail.

The operator's eye has to re-parse two visual languages to use one page.

## Goal

Unify the overlay rail under a single glass-token visual language: measure moves into TR, FAB adopts the rail's surface with an emerald accent. No filter-UI work (that's 5l), no save-as UX (that's 5m).

## In scope

- Move measurement controls into the TR rail as a **custom React toolbar** that drives the TerraDraw instance directly. Remove the built-in `MaplibreMeasureControl` toolbar at TL.
- `QuickAddFAB`: swap green gradient for **glass + emerald accent** (emerald border, emerald icon, emerald-tinted shadow, same glass-bg as the rail).
- TR stack order (top → bottom): **measure toolbar → basemap pill → layers button → annotations pill**.
- Mobile responsiveness preserved (≤ 768px): measure toolbar fits 4 × 34px = 144px.

## Out of scope (deferred)

| Ref | What | Why deferred |
|---|---|---|
| Spec 5l | Fields tree sidebar — replaces TR filter panel; farm/search/enterprise filter lives there | Separate spec, locked 2026-04-16. |
| Spec 5m | Save-as chooser on finished measurements (FIELD / FEATURE / MEASUREMENT / NOTE) + `measurements` table + CRUD | Separate spec, locked 2026-04-16. |
| Spec 8 | Weather modal | Benched. |
| — | Keyboard shortcuts for measure modes | Already handled via TerraDraw's built-in undo/redo shortcuts. |
| — | Annotations sidebar redesign | Out of scope; only the launcher pill lives in TR. |
| — | Legend (BL) restyle | Already glass-token'd; no polish needed this round. |
| — | Basemap switcher popover redesign | Recently shipped + A1 WC basemap work still smoke-pending. |

## Design decisions (locked in brainstorm)

**FAB variant:** `F2 — Glass with emerald accent`.
- Background: `var(--glass-bg)` (same as rail).
- Border: `1px solid rgba(4,120,87,0.4)` (emerald-700 @ 40%).
- Icon color: `#047857` (emerald-700).
- Shadow: `0 8px 20px rgba(4,120,87,0.18)`.
- Open state: X icon in same emerald; no gradient swap (since there's no dark-open variant needed — glass recedes on its own).

**Measure integration:** custom React toolbar that calls `td.setMode('linestring' | 'polygon' | 'point')` on the existing TerraDraw instance. The `MaplibreMeasureControl.addControl()` registration is removed from `AnnotateTool.tsx`; the component still owns the TerraDraw instance via `getTerraDrawInstance()` so callers (CreateTaskModal, SaveAnnotationModal, etc.) are unaffected.

## Component changes

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

Rendered at the top of the TR `MapOverlayRail`, above the basemap pill. Spec 5m later adds the save-as chooser panel below the toolbar when a draw finishes — 5k only builds the mode buttons.

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

Add `MeasureToolbar` at the top of the TR rail stack. With 5l also landing (removes `MapControls`), the TR rail becomes:

```tsx
<MapOverlayRail position="tr">
  <MeasureToolbar terraDraw={terraDraw} currentMode={drawMode} />
  <BasemapSwitcher ... />
  <LayerControl ... />
  {/* Annotations pill */}
</MapOverlayRail>
```

If 5k ships before 5l, the `<MapControls />` JSX stays in place and `MeasureToolbar` inserts below it. 5l later removes the `<MapControls />` line. Either shipping order works.

## Tests (TDD, tests first)

1. **`MeasureToolbar.test.tsx` (new)**
   - Renders 4 buttons (distance, area, pin, polygon).
   - Clicking a button calls `terraDraw.setMode(expectedMode)` once.
   - `currentMode` prop highlights the matching button (aria-pressed + class assertion).
   - Renders nothing / graceful no-op when `terraDraw === null` (early mount).

2. **`QuickAddFAB.test.tsx` (extend existing)**
   - Closed state: inspect the element's inline `style.background` string directly (not `getComputedStyle`, which jsdom doesn't resolve gradients for). Expect: `expect(button.style.background).not.toMatch(/linear-gradient/)` AND `expect(button.style.background).toMatch(/var\(--glass-bg\)|rgba\(255,\s*255,\s*255/)` — one positive match for the glass surface.
   - Open state: same inline-style check — no gradient, same glass background. (Today's code swaps to a dark gradient on open; the spec removes that conditional.)
   - Icon: `expect(iconElement).toHaveClass('text-emerald-700')` or equivalent — verifies the colour rule directly.
   - Existing click-to-expand + Esc-to-close tests still pass.

3. **Smoke (required):**
   - Measure toolbar renders in TR (not TL).
   - Tapping each measure button enters the matching TerraDraw mode (tooltip + cursor change confirms).
   - FAB open/close animation still works; no green gradient visible.
   - Mobile (390px): TR stack doesn't horizontally clip.

## Risks

- **TerraDraw lifecycle coupling.** Measure toolbar needs the TerraDraw instance, which today is ref-owned inside `AnnotateTool`. Lifting state may surface mount-order bugs (toolbar mounts before TerraDraw is ready). Mitigation: toolbar renders nothing when `terraDraw === null`.
- **Built-in TL toolbar removal.** Any keyboard shortcut or gesture provided by `MaplibreMeasureControl`'s UI (not by the underlying `TerraDraw` instance) is lost. Spot-check: undo/redo come from `TerraDrawUndoRedoKeyboardShortcuts`, which is already wired independently. Mode-switching shortcuts aren't currently in use. Safe to remove.
- **FAB visibility contrast.** Glass FAB may be harder to spot against a bright Esri satellite tile than the current solid gradient. Mitigation: the emerald border + shadow keeps it readable; smoke check confirms across all 11 basemaps.
- **Orphaned CSS from `MaplibreMeasureControl`.** The library's stylesheet is still imported (`'@watergis/maplibre-gl-terradraw/dist/maplibre-gl-terradraw.css'`) because it also scopes terradraw's in-progress draw-geometry paint. Don't remove the CSS import.

## Files changed

| File | Change |
|---|---|
| `frontend/src/components/map/MeasureToolbar.tsx` (new) | Custom React toolbar driving TerraDraw. |
| `frontend/src/components/map/MeasureToolbar.test.tsx` (new) | Unit tests for the toolbar. |
| `frontend/src/components/map/tools/AnnotateTool.tsx` | Remove `MaplibreMeasureControl` registration; add `onReady` prop. |
| `frontend/src/components/QuickAddFAB.tsx` | Swap green-gradient style for glass + emerald accent. |
| `frontend/src/components/QuickAddFAB.test.tsx` | Extend with glass-surface assertions. |
| `frontend/src/pages/FarmMapPage.tsx` | Wire `MeasureToolbar` into TR rail; hold `terraDraw` + `drawMode` state. |
| `docs/handoffs/2026-04-17-spec-5k-map-overlay.md` (new on ship) | Smoke results + visual diff notes. |

No backend changes. No new dependencies. No DB migration.

## Success criteria

- TR rail contains (at least) 4 items in order: **measure → basemap → layers → annotations**. If 5l hasn't shipped yet, `MapControls` is still above this stack — that's fine.
- TL rail is empty (terradraw's built-in toolbar gone).
- FAB closed + open states show no `linear-gradient` in inline `style.background`; icon is emerald-700 in both states.
- All automated tests green: new `MeasureToolbar` tests + extended `QuickAddFAB` tests + existing suite.
- `npx tsc -b --noEmit` clean.
- `git log` for 5k work is ≤ 3 focused commits.
- Manual smoke passes across 3 viewport widths (390 / 1280 / 1920).
