# Handoff — Spec 5k: Map Overlay Polish

**Date:** 2026-04-16 (session), smoke pending 2026-04-17
**Branch:** main
**Commits:**
- `03f7829` feat(map): spec 5k — measure toolbar in TR + glass FAB

## What shipped

- **MeasureToolbar** (`frontend/src/components/map/MeasureToolbar.tsx`) — new glass-surfaced 4-button toolbar in TR rail (Measure distance / Measure area / Drop pin / Draw polygon). Renders nothing until TerraDraw is ready.
- **AnnotateTool** — removed `map.addControl` / `map.removeControl` (control no longer registered in MapLibre's control tree). Added `onReady(td)` callback, fires once when TerraDraw instance is available.
- **FarmMapPage** — added `terraDraw` state, threads `onReady={setTerraDraw}` into `AnnotateTool`, renders `<MeasureToolbar terraDraw={terraDraw} currentMode={drawMode} />` as first child of TR rail above `MapControls`.
- **QuickAddFAB** — swapped green gradient for `var(--glass-bg)` + emerald border/shadow. Removed radial-highlight span. Icon colour changed from `text-white` to `text-emerald-700`.

## Tests

11 test files, 77 tests — all green.
Typecheck clean.

## Smoke checklist (pending — Alex to run in Electron)

- [ ] `/map` TL area is empty (no terradraw toolbar visible).
- [ ] TR rail's top item is the new 4-button `MeasureToolbar`.
- [ ] Clicking each button enters the corresponding draw mode (cursor changes, terradraw UI shows the mode).
- [ ] FAB closed: glass surface, emerald `+`, emerald border + shadow. No green gradient.
- [ ] FAB open: glass surface, emerald `×`, action pills still expand.
- [ ] At 390 / 1280 / 1920 widths: TR stack doesn't clip.

## Notes

- The four-buttons-three-modes quirk is intentional: "Measure area" and "Draw polygon" both drive `polygon` mode. Operator UX labels differ but TerraDraw interaction is identical.
- `glass-panel` / `var(--glass-bg)` / `var(--glass-blur)` CSS variables must be defined in `index.css` for visual correctness; tests pass regardless (functionality only).
