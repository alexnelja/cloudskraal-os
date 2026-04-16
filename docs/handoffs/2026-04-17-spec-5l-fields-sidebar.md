# Spec 5l Handoff — Fields Tree Sidebar + Field Creation

**Date:** 2026-04-17
**Branch:** main
**Last commit:** 098f5e7

## What shipped

| Task | Status | Commit |
|---|---|---|
| T1: FieldsSidebar (7 tests) | DONE | a81d402 |
| T2: Wire into FarmMapPage, delete MapControls | DONE | a81d402 |
| T3: Mobile FluidSheet wrapping | DONE | a81d402 |
| T5: POST /api/fields endpoint (4 tests) | DONE | 26c386a |
| T6: NewFieldModal + createField client (4 tests) | DONE | 098f5e7 |

## New files

- `frontend/src/components/map/FieldsSidebar.tsx` — left sidebar, enterprise groups, localStorage
- `frontend/src/components/map/FieldsSidebar.test.tsx` — 7 tests (localStorage mock included)
- `frontend/src/components/map/NewFieldModal.tsx` — FluidDialog-wrapped field creation form
- `frontend/src/components/map/NewFieldModal.test.tsx` — 4 tests
- `backend/src/routes/farms.test.mjs` — 4 supertest route tests (first backend route test file)
- `backend/vitest.config.js` — vitest config for backend

## Deleted files

- `frontend/src/components/map/MapControls.tsx` — superseded by FieldsSidebar

## Key implementation notes

1. **localStorage mock in tests:** The test environment's `window.localStorage` object exists but has no methods (empty stub). FieldsSidebar.test.tsx provides its own `localStorageMock` and reassigns `window.localStorage` via `Object.defineProperty`.

2. **FluidDialog prop contract:** `onDismiss` (not `onClose`) — NewFieldModal adapts correctly.

3. **FluidSheet prop contract:** `onDismiss` (not `onClose`) — FarmMapPage uses `onDismiss={...}` correctly.

4. **`geometry TEXT NOT NULL`:** The fields table schema requires a non-null geometry. The POST handler defaults to `'{}'` when no geometry is provided (field can be drawn later).

5. **Backend test harness:** Uses ESM `.mjs` test file with `createRequire` to load CJS app code. `_resetForTest()` exported from schema.js closes the sqlite singleton between tests. `CAPEX_DB_PATH` env var is set at module-top to point to a temp DB.

6. **Mobile sidebar:** Uses Tailwind `md:hidden` / `hidden md:block` pattern (render twice) — no `useMediaQuery` hook. FluidSheet on left side.

## Test counts

| Suite | Tests |
|---|---|
| Frontend (vitest run) | 88 passing |
| Backend (vitest run) | 158 passing |

## Typecheck

`npx tsc -b --noEmit` in `frontend/` — clean.

## Smoke checklist (pending manual verification)

- [ ] Left sidebar renders on `/map` with correct totals (sum of all field area_ha)
- [ ] Enterprises grouped with coloured left-borders; correct enterprise colours
- [ ] Per-group totals (ha + count) are accurate
- [ ] Groups expand/collapse on header click
- [ ] Reload: expansion state persists (localStorage)
- [ ] Click field row → map zooms to field polygon and highlights it
- [ ] Click eye icon → enterprise disappears from the map; click again → reappears
- [ ] Farm selector narrows the field list to that farm's fields
- [ ] Search narrows visible rows (case-insensitive, name / code / farm_name)
- [ ] Mobile (390px viewport): hamburger pill (top-left) is visible; click opens FieldsSidebar as a left sheet
- [ ] Sheet dismisses on Esc and backdrop-click
- [ ] Click ADD (sidebar) → NewFieldModal opens with empty form
- [ ] NewFieldModal: submit with name missing → "Name is required" error
- [ ] NewFieldModal: fill valid form, submit → new field appears in sidebar list after refetch
- [ ] NewFieldModal: POST /api/fields returns 201 with the new field JSON
- [ ] Desktop: FieldsSidebar occupies left edge; map fills remaining width; TR rail still has Measure + Basemap + Layers + Annotations
- [ ] MeasureToolbar still functional after MapControls removal

## Known concerns / follow-up

1. The legend in the bottom-left rail is now redundant with the FieldsSidebar enterprise groups — consider removing it in a later cleanup pass.
2. The `geometry TEXT NOT NULL` schema constraint means fields created without a drawn polygon get `geometry = '{}'`. This is a valid sentinel — but if any GIS consumers expect a real GeoJSON string, they'll need to guard for `{}`.
3. The `onCreated` callback in FarmMapPage triggers a full `loadNonce` bump (all 5 endpoints refetch). For large datasets this is fine; could be optimised to a partial refetch later.
