# Spec 5a — Distance & area measurement on the farm map

- **Status:** Ready to build.
- **Depends on:** existing `FarmMap` with MapLibre + `onMapReady` hook.
- **Unblocks:** spec 5h (field orientation uses same math primitives), spec 5b (persisted annotations build on the same draw layer).
- **Stack (inherited from benched-5 lock):** `maplibre-gl-terradraw` for interactive drawing, `@turf/turf` for geodesic math.

## Problem

Operator on the map has no way to answer "how long is this fence run?" or "how big is this alien-veg patch?". Today they switch to Google Earth Pro. Friction, context-switch, and measurements never make it back into Cloudskraal.

## Scope (in)

- One MeasureTool component mounted as a child of `FarmMap`, activated by two buttons bottom-left of the map: 📏 Distance, ⬡ Area.
- Click map to add vertices. Double-click or Enter finishes distance; clicking first vertex or Enter closes polygon.
- Esc cancels an in-progress measurement.
- Live readout in a floating panel (top-left, below existing navigation control) updates on every vertex and on mouse-move (preview segment/edge).
- After finish, readout persists until user starts a new measurement or clicks **Clear**.
- Only one active measurement at a time (new start clears previous).
- Units auto-switch: distance `m` → `km` at 1,000 m; area `m²` → `ha` at 10,000 m². 2 decimals.

## Scope (out)

- Persistence / saving to DB (that's spec 5b annotations).
- Export to GeoJSON / KML (spec 5d).
- Snapping to field vertices or edges.
- Multi-unit toggles (imperial). Metric only — SA operator audience.
- Custom coordinate-system conversion. Turf is geodesic on WGS84, which matches tile sources.

## Architecture

```
frontend/src/components/map/
  FarmMap.tsx                          # existing; expose map via onMapReady (already does)
  tools/
    MeasureTool.tsx                    # new — toolbar + live readout + draw-mode state
    MeasureTool.test.tsx               # new
    measureFormat.ts                   # new — pure helpers: formatDistance, formatArea
    measureFormat.test.ts              # new
```

- `MeasureTool` receives the `maplibregl.Map` instance via prop (parent obtains it through `onMapReady`).
- Instantiates a `MaplibreTerradrawControl` once, adds it to the map, hides its built-in UI, drives its modes programmatically from our two buttons.
- Subscribes to terradraw `finish` + `change` events → recomputes length/area via turf, updates local state → re-renders readout.

## Data flow

```
user clicks ruler button
  → MeasureTool sets terradraw mode = linestring
  → each map click → terradraw emits 'change' → component reads features
  → turf.length(feature, {units: 'meters'}) → formatDistance → readout
double-click / Enter
  → terradraw emits 'finish' → mode = static → readout stays
user clicks Clear (or starts new measurement)
  → terradraw clear() → readout null
```

Area flow mirrors distance with `turf.area(feature)` returning m².

## Helpers (pure, unit-tested)

```ts
// measureFormat.ts
export function formatDistance(meters: number): string {
  // < 1000 → "500 m" (integer for m)
  // ≥ 1000 → "2.50 km" (2 decimals)
}

export function formatArea(squareMeters: number): string {
  // < 10000 → "5000 m²" (integer)
  // ≥ 10000 → "1.20 ha" (2 decimals, 1 ha = 10_000 m²)
}
```

## Tests (TDD, failing-first)

**Unit — `measureFormat.test.ts`:**
- `formatDistance(0)` → `"0 m"`
- `formatDistance(500)` → `"500 m"`
- `formatDistance(999)` → `"999 m"`
- `formatDistance(1000)` → `"1.00 km"`
- `formatDistance(2500)` → `"2.50 km"`
- `formatDistance(12345.6)` → `"12.35 km"`
- `formatArea(0)` → `"0 m²"`
- `formatArea(9999)` → `"9999 m²"`
- `formatArea(10000)` → `"1.00 ha"`
- `formatArea(12000)` → `"1.20 ha"`
- `formatArea(1_234_567)` → `"123.46 ha"`

**Component — `MeasureTool.test.tsx`:**
- Renders two buttons with aria-labels `Measure distance`, `Measure area`.
- Clicking the distance button toggles `aria-pressed="true"`; clicking again toggles off.
- When a measurement is active, a `Clear` button appears; clicking it removes the active state.
- Clicking area after distance was active switches modes (only one aria-pressed at a time).
- Given a mocked terradraw instance emitting a `change` event with a 3-point linestring [[0,0],[0,0.001],[0,0.002]] (~222 m total), the readout contains `"222 m"` (±1 m tolerance).

Terradraw itself is mocked; we don't test the library, only our wiring.

No Playwright / E2E in this spec — deferred per benched-5 guidance ("until a sub-spec ships UI worth recording"). Smoke-test manually in the Electron app.

## Known hard parts

- **Terradraw React integration.** Library is framework-agnostic; instantiate once in `useEffect`, clean up on unmount. Re-renders must not re-create the control.
- **Mouse-move preview.** Terradraw emits change only on vertex commit, not pointer-move. For live readout between clicks we listen to `mousemove` on the map and compute a speculative length using the last committed vertex → current pointer coord. Same pattern for area (speculative polygon close).
- **Default MapLibre cursor fights crosshair.** While a measure mode is active, set `map.getCanvas().style.cursor = 'crosshair'`. Restore on finish/cancel. Must not clobber existing `fields-fill` hover cursor — gate by mode.
- **Field-click collision.** When measurement is active, suppress the existing `fields-fill` click handler (otherwise clicking on a field while measuring both adds a vertex AND opens the field panel). Approach: MeasureTool sets a module-level "measuring" flag the FarmMap click handler checks, or we disable interactivity on `fields-fill` while measuring (`map.setLayoutProperty`... no, use `setFilter` to `false`, or just early-return in the field click handler when measuring).

## Files touched

- **New:** `frontend/src/components/map/tools/MeasureTool.tsx`, `tools/MeasureTool.test.tsx`, `tools/measureFormat.ts`, `tools/measureFormat.test.ts`.
- **Modified:** `frontend/src/components/map/FarmMap.tsx` — mount `<MeasureTool map={mapRef.current} />` once the map is ready; add a shared "is measuring" ref so the existing field-click handler can early-return.
- **Deps added:** `maplibre-gl-terradraw`, `@turf/turf`.

## Build order (TDD)

1. Install deps.
2. Write `measureFormat.test.ts` (failing). Implement `measureFormat.ts`. Green.
3. Write `MeasureTool.test.tsx` (failing) with mocked terradraw. Implement component. Green.
4. Wire `MeasureTool` into `FarmMap`. Add measuring-state guard to field-click handler.
5. `npx tsc -b --noEmit && npm run build` — clean typecheck and build.
6. Manual smoke test in Electron: start distance, click 3 points, double-click, verify readout. Repeat for area. Clear. Verify field-click still works when not measuring.

## Completion criteria

- [ ] All new unit + component tests green.
- [ ] Frontend typecheck + build clean (pre-existing chunk-size advisory OK).
- [ ] Existing backend tests unchanged (107+ passing).
- [ ] Manual smoke test in Electron passes distance + area + clear + field-click-while-not-measuring.
- [ ] Bench spec 5 family file updated to mark 5a as shipped.
- [ ] ROADMAP.md updated.
