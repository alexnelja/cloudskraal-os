# Spec 5m — Measure save-as chooser (FIELD / FEATURE / MEASUREMENT / NOTE)

- **Status:** Approved for planning (2026-04-16).
- **Parent:** builds on Spec 5k (new `MeasureToolbar` in TR). Must ship after 5k.
- **Reference:** Alex's image 10 — a Measure Tool dialog with `+ SAVE AS ▾` expanding into FIELD / FEATURE / NOTE. This spec adds `MEASUREMENT` as a fourth destination (from the benched `benched-spec-5.save-chooser.md`).

## Problem

Today when terradraw finishes a geometry in measure/draw mode, the `SaveAnnotationModal` opens directly — every draw becomes an annotation. There's no path to:
- Save a drawn polygon as a **field** (reuses the field-create form).
- Save a length/area as a named **measurement** that can be recalled later with click-to-copy.
- Discard the geometry without triggering a modal.

Plus: clicking a saved pin/polygon re-triggers the save flow because `onFinish` fires regardless of terradraw mode.

## Goal

After any finished geometry, the `MeasureToolbar` (from Spec 5k) grows a compact panel with a live measurement chip + `+ SAVE AS ▾` dropdown + `DISCARD`. Dropdown routes to four destinations. Also fix the saved-pin re-trigger bug.

## In scope

- `SaveAsChooserPopover.tsx` — dropdown under the `+ SAVE AS` button with four destinations.
- `SaveMeasurementModal.tsx` — minimal modal (name + notes) for the MEASUREMENT branch.
- `measurements` table + migration + CRUD endpoints.
- New "Measurements" tab in `AnnotationsSidebar` with copy-to-clipboard per row.
- Fold-in fix: gate `onFinish` in `AnnotateTool` to only fire during an active draw mode (`td.getMode()` ∉ `['static', 'select']`).
- Measure-toolbar layout: save-as panel renders below the toolbar when `drawMode === 'static'` AND a finished geometry exists.

## Out of scope (deferred)

| Ref | What | Why deferred |
|---|---|---|
| — | Custom feature types with icon picker (FEATURE branch upgrade) | Benched in `benched-spec-5.save-chooser.md`. Reuses the existing `SaveAnnotationModal` (fixed category set) for v1. |
| — | `feature_types` table + CRUD | Same — defer until the category set proves too rigid. |
| — | Measurement edit (PATCH) | CRUD for v1 is list / create / delete. |
| — | Measurement geometry on the map | Measurements render in the sidebar only; geometry reappears only on click-to-zoom. |
| — | Photo attachments on measurements | Follow standard annotation-attachment path if ever needed. |
| — | Measurement units selection (force km vs. m) | Unit auto-picked by value magnitude (`m` < 1000; `km` ≥ 1000; `m²` < 10 000; `ha` ≥ 10 000). |

## Destination behaviour

| Destination | Accepted geometry | Target | UX |
|---|---|---|---|
| FIELD | polygon only | `fields` table | Opens the existing field-create form pre-filled with the drawn polygon + computed `area_ha`. Operator adds name, enterprise, crop_type. Skipped entirely if the geometry lies inside an existing field — use `@turf/turf`'s `booleanContains(existingPolygon, drawnPolygon)` (already a dependency); show "Already inside <field name>" toast + cancel. |
| FEATURE | any (pin / line / polygon) | existing `annotations` table | Reuses the existing `SaveAnnotationModal` unchanged. This is today's flow — the chooser just makes it an explicit option. |
| MEASUREMENT | line or polygon (not pin) | new `measurements` table | Opens `SaveMeasurementModal` — name + optional notes. Persists geometry + value + unit. Surfaces in a new "Measurements" tab in `AnnotationsSidebar`. |
| NOTE | any geometry (point usually) | existing `annotations` table with category `map_note` | Reuses the existing "Drop map note" pathway — same as the FAB arm-drop shortcut. |

Dropdown hides destinations the current geometry can't satisfy (e.g. FIELD option is grey for a line or pin).

## Backend delta

**New table** `measurements`:

```sql
CREATE TABLE IF NOT EXISTS measurements (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL,           -- 'length' | 'area'
  value       REAL NOT NULL,           -- metres or square metres
  unit        TEXT NOT NULL,           -- 'm' | 'km' | 'm²' | 'ha'
  formatted   TEXT NOT NULL,           -- precomputed display, e.g. "3.24 km", "29.58 ha"
  geometry    TEXT NOT NULL,           -- GeoJSON string
  field_id    TEXT NULL REFERENCES fields(id) ON DELETE SET NULL,
  notes       TEXT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_measurements_created ON measurements(created_at DESC);
```

**Migration:** `backend/src/db/migrate-measurements.js`. Registered in `backend/src/db/schema.js` at two insertion points (matching the existing pattern): (1) `const { migrateMeasurements } = require('./migrate-measurements')` at the top of the file alongside the other migrate requires, and (2) `migrateMeasurements(db);` inside `getDb()` after the existing migration calls. Idempotent (`CREATE TABLE IF NOT EXISTS`).

**Endpoints:**
- `GET /api/measurements` — list, newest first.
- `POST /api/measurements` — create. Body: `{name, kind, value, unit, formatted, geometry, field_id?, notes?}`.
- `DELETE /api/measurements/:id` — remove.

No PATCH for v1.

## Components

### `SaveAsChooserPopover.tsx` (new)

```tsx
interface SaveAsChooserPopoverProps {
  geometry: GeoJSON.Geometry;
  onPick: (dest: 'field' | 'feature' | 'measurement' | 'note') => void;
  onDiscard: () => void;
}
```

Rendered as a `motion.div` popover anchored under the `+ SAVE AS ▾` button. Reads the geometry type and greys out invalid destinations with a subtle tooltip. Same glass tokens as the rest of TR.

### `SaveMeasurementModal.tsx` (new)

Minimal modal — uses the existing `FluidDialog` primitive. Fields: `name` (required, defaults to kind+value e.g. "Area 80.72 ha"), `notes` (optional multiline). Cancel / Save buttons. On Save: `POST /api/measurements`, close, toast.

### `MeasureToolbar.tsx` (extend from 5k)

Grows a `SaveAsPanel` below the four mode buttons when `drawMode === 'static'` AND the TerraDraw store has a finished geometry. Contains:
- Live measurement chip (e.g. "Area: 80.72 ha", red × clears).
- `+ SAVE AS ▾` primary button (opens `SaveAsChooserPopover`).
- `DISCARD` outline button (clears geometry, closes panel).

### `AnnotationsSidebar.tsx`

Add a "Measurements" tab alongside the existing Lines / Polygons / Pins tabs. Each row:
- Name + formatted value.
- Copy-to-clipboard button (uses `navigator.clipboard.writeText(formatted)`, toast on success).
- Click-to-zoom (reuses the existing annotation-zoom pattern).
- Delete button (calls `DELETE /api/measurements/:id`).

### `AnnotateTool.tsx` (extend from 5k)

Fold-in fix for the saved-pin bug:

```tsx
// Before: onFinish fires even for click events on static/select-mode features
control.on('finish', () => {
  // ...
});

// After: gate by active mode
control.on('finish', () => {
  const mode = td.getMode();
  if (mode === 'static' || mode === 'select') return;
  // ...
});
```

This is a ~3-line change; bundle with 5m so the chooser doesn't inherit the same bug.

## Tests (TDD, tests first)

1. **Backend** (`backend/src/routes/measurements.test.js` new)
   - `POST /api/measurements` — validation (required fields) + round-trip.
   - `GET /api/measurements` — order newest first.
   - `DELETE /api/measurements/:id` — not-found returns 404.
   - Migration idempotence — run twice, no error, no duplicate columns.

2. **Frontend**
   - `SaveAsChooserPopover.test.tsx` — all four destinations render; invalid destinations for a given geometry are disabled; clicking each fires the right callback.
   - `SaveMeasurementModal.test.tsx` — required-field validation; on save posts to `/api/measurements` with the expected payload.
   - `MeasureToolbar.test.tsx` (extend from 5k) — after a finished draw (simulated via prop), save-as panel renders with the chip + SAVE AS / DISCARD buttons; DISCARD clears without persisting.
   - `AnnotationsSidebar.test.tsx` (extend) — Measurements tab lists rows; clipboard copy mock is called with `formatted`; delete removes the row.

3. **Smoke (required):**
   - Draw a line → finish (Enter) → toolbar grows the save-as panel → SAVE AS → MEASUREMENT → name it → persisted, appears in sidebar with correct formatted value.
   - Draw a polygon → SAVE AS → FIELD → opens field-create form pre-filled → save → appears in `/fields` (or sidebar tree per 5l).
   - Click a saved pin on the map → opens its detail sheet, does NOT re-trigger save flow (bug fix verified).
   - Copy-to-clipboard on a measurement row copies the formatted value.

## Risks

- **Clipboard API.** `navigator.clipboard.writeText` requires HTTPS or `localhost`. Works in Electron; document the dev constraint.
- **Geometry validation.** Frontend should reject a FIELD save if the polygon has fewer than 3 vertices; the existing field form already validates this but surfacing the error requires geometry pre-check.
- **`field_id` FK on measurements.** If the associated field is deleted, FK `ON DELETE SET NULL` keeps the measurement but nulls the link. Sidebar must handle null gracefully.
- **Modal stacking on mobile.** `SaveMeasurementModal` + possible `FieldsSidebar` sheet (5l) + `SaveAnnotationModal` could conflict. Same rule as 5l: one modal at a time, opening one dismisses others.

## Files changed

| File | Change |
|---|---|
| `backend/src/db/migrate-measurements.js` (new) | `CREATE TABLE measurements` migration. |
| `backend/src/db/schema.js` | Register new migration in `getDb()`. |
| `backend/src/routes/measurements.js` (new) | CRUD handlers. |
| `backend/src/index.js` | Mount the new router. |
| `backend/src/routes/measurements.test.js` (new) | Route tests. |
| `frontend/src/components/map/SaveAsChooserPopover.tsx` (new) | The dropdown. |
| `frontend/src/components/map/SaveAsChooserPopover.test.tsx` (new) | Unit tests. |
| `frontend/src/components/map/SaveMeasurementModal.tsx` (new) | The modal. |
| `frontend/src/components/map/SaveMeasurementModal.test.tsx` (new) | Unit tests. |
| `frontend/src/components/map/MeasureToolbar.tsx` | Extend with save-as panel. |
| `frontend/src/components/map/MeasureToolbar.test.tsx` | Extend with save-as tests. |
| `frontend/src/components/map/AnnotationsSidebar.tsx` | Add Measurements tab. |
| `frontend/src/components/map/AnnotationsSidebar.test.tsx` | Extend for new tab. |
| `frontend/src/components/map/tools/AnnotateTool.tsx` | Gate `onFinish` by mode (bug fix). |
| `frontend/src/api/measurements.ts` (new) | Client for the new endpoints. |
| `frontend/src/types/measurement.ts` (new) | `Measurement` TS type. |
| `docs/handoffs/2026-04-17-spec-5m-save-as.md` (new on ship) | Smoke results. |

## Success criteria

- Backend: 3 CRUD endpoints + migration green, 4+ route tests passing.
- Frontend: save-as panel + measurement tab + modal all tested.
- Click-on-saved-pin bug fixed (verified manually).
- All automated tests green.
- `git log` for 5m work is ≤ 5 focused commits.
- Manual smoke: all four destinations produce the expected behaviour.
