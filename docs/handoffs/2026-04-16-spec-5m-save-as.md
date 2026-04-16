# Spec 5m — Measure Save-As Chooser: Handoff

**Date:** 2026-04-16
**Status:** Code shipped, tests green. Pending manual browser smoke.

## Commits (in order)

| SHA | Description |
|-----|-------------|
| `deceb6d` | feat(backend): spec 5m — measurements table + CRUD |
| `a4b5dbe` | feat(map): spec 5m — measure save-as chooser + measurements sidebar |

## What shipped

### Backend (`deceb6d`)
- `backend/src/db/migrate-measurements.js` — idempotent `CREATE TABLE IF NOT EXISTS measurements`
- `backend/src/routes/measurements.js` — GET list, POST create, DELETE by id
- Registered in `schema.js` alongside other migrations
- 7 new backend tests (165 total, up from 158)

### Frontend (`a4b5dbe`)
- `frontend/src/types/measurement.ts` — `Measurement` TS type
- `frontend/src/api/measurements.ts` — `listMeasurements`, `createMeasurement`, `deleteMeasurement`
- `frontend/src/components/map/SaveAsChooserPopover.tsx` — 4-button chooser, greys out FIELD for non-polygon, MEASUREMENT for point
- `frontend/src/components/map/SaveMeasurementModal.tsx` — name + notes form, wraps `FluidDialog`
- `frontend/src/components/map/MeasureToolbar.tsx` — extended with `finishedGeometry` / `measurementText` / `onPick` / `onDiscard` props; save-as panel appears when `finishedGeometry != null && currentMode === 'static'`
- `frontend/src/components/map/AnnotationsSidebar.tsx` — new Measurements tab: shows name + formatted value + Copy + Delete for each saved measurement; loaded from API on open
- `frontend/src/components/map/tools/AnnotateTool.tsx` — pin-click bug fix: `onFinish` guard checks `td.getMode()` and skips when `static` or `select`
- `frontend/src/utils/fields.ts` — `findEnclosingField(geojson, drawn)` using `turf.booleanContains`
- `frontend/src/pages/FarmMapPage.tsx` — wired `finishedGeometry` state, `handleSaveAsPick` routing, `SaveMeasurementModal`, `clearFinished`, all new MeasureToolbar props
- 17 new frontend tests (106 total, up from 89)

## Test counts

| Suite | Before | After |
|-------|--------|-------|
| Backend | 158 | 165 |
| Frontend | 89 | 106 |

## Typecheck
`npx tsc -b --noEmit` — clean (no errors).

## Browser smoke (PENDING — manual)

- [ ] Draw line → Enter → chip + SAVE AS appear in MeasureToolbar.
- [ ] SAVE AS → MEASUREMENT → name → persists → shows in Measurements tab with correct value.
- [ ] SAVE AS → FIELD for a polygon inside an existing field → alert "Already inside X" + cancel.
- [ ] SAVE AS → FIELD for a new polygon → field-create form opens pre-filled with area.
- [ ] Click saved pin → does NOT re-open save flow.
- [ ] Measurements tab — copy-to-clipboard works; delete removes the row.

## Known limitations / follow-up

- `handleSaveAsPick` for `dest === 'feature'` and `dest === 'note'` relies on `pendingDraw` already being set from `handleDrawFinish`; the save-annotation modal will open. This is functional but the UX for FEATURE/NOTE via the new chooser panel is that the user sees both the SaveAnnotationModal (old flow) and the chooser at the same time — a future cleanup could unify them.
- `window.alert()` used for "already inside field" toast — could be replaced with a proper toast component in a follow-up.
- Click-to-zoom for measurements in AnnotationsSidebar is not implemented (spec says "reuses existing annotation-zoom pattern") — rows are read-only currently. The geometry string is stored and could drive `map.fitBounds()` in a follow-up.
