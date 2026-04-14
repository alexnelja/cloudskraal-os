# Spec 5b — Annotations (save measurements + standalone pins)

- **Status:** Ready to build.
- **Depends on:** Spec 5a (measurement tool shipped — same terradraw control extended).
- **Unblocks:** Future photo attachments (5b.2), bulk import/export (5d), spatial queries over saved items (5g).
- **Stack (unchanged):** `@watergis/maplibre-gl-terradraw` + `terra-draw` on frontend, `@turf/turf` on backend, better-sqlite3 for storage.

## Problem

Today the measure tool (5a) is ephemeral — nothing persists. Operator can't mark "broken pump near gate 3" or save a 1.2 km fence run for later reference. Every measurement is a one-shot and recreating it tomorrow means re-clicking the same points.

## Scope (in)

- Save three types of annotations:
  - **line** (from terradraw linestring) — with computed `length_m`
  - **polygon** (from terradraw polygon) — with computed `area_m2`
  - **pin** (from terradraw point) — standalone marker, no metrics
- Each annotation has `title` (required) + `notes` (optional).
- Auto-resolve `field_id` and `farm_id` from geometry (centroid-in-polygon against `fields`).
- Render all saved annotations as persistent map layers (distinct styling from fields).
- **AnnotationsSidebar** on the map page: togglable right-side panel listing all items, click row → fly to geometry + highlight; filter by type.
- **AnnotationsPage** at `/annotations`: table view with sort/filter; row click → navigate back to map and auto-open sidebar on that item.
- Edit title + notes (geometry immutable in v1 — to change shape, delete + redraw).
- Delete with browser `confirm()`.

## Scope (out)

- Photo attachments (deferred — 5b.2).
- Geometry editing after save (v2).
- Multi-user / attribution (single-user app).
- Multi-select, bulk delete, tagging, categories.
- CSV export (covered by 5d import/export spec).
- Offline / sync.
- Sharing / permissions.

## Data model

New table: `annotations`

| column          | type | notes                                           |
|-----------------|------|-------------------------------------------------|
| id              | text | UUID, primary key                               |
| type            | text | `'line'` / `'polygon'` / `'pin'`                |
| title           | text | NOT NULL                                        |
| notes           | text | nullable                                        |
| geometry_json   | text | GeoJSON geometry string                         |
| length_m        | real | nullable; only for type='line'                  |
| area_m2         | real | nullable; only for type='polygon'               |
| field_id        | text | nullable FK → `fields.id`                       |
| farm_id         | text | nullable FK → `farms.id`                        |
| created_at      | text | ISO UTC                                         |
| updated_at      | text | ISO UTC                                         |

Indexes: `idx_annotations_type`, `idx_annotations_field_id`, `idx_annotations_created_at`.

## API

- `GET    /api/annotations` → array; optional `?type=line|polygon|pin`, `?field_id=<id>`
- `GET    /api/annotations/:id`
- `POST   /api/annotations` → body `{ type, title, notes?, geometry }`; server computes `length_m` / `area_m2`, resolves `field_id` + `farm_id`
- `PATCH  /api/annotations/:id` → body `{ title?, notes? }`; geometry + metrics immutable
- `DELETE /api/annotations/:id` → 204

Validation: `type` must match geometry type (`line` ↔ LineString, `polygon` ↔ Polygon, `pin` ↔ Point). Invalid → 400.

## Frontend

### Renamed component

`MeasureTool.tsx` → **`AnnotateTool.tsx`**:
- Same `MaplibreMeasureControl` with modes extended: adds `'point'` to the mode list.
- Subscribes to terradraw `finish` event → opens `SaveAnnotationModal` with the drawn feature payload.
- Modal has **Save** (POST → refresh list) and **Discard** (clears the in-progress feature from terradraw).
- Existing 5a ergonomics (editable vertices, undo/redo, keyboard shortcuts) preserved for all three draw modes.

### New components

- **`SaveAnnotationModal.tsx`** — form with title (required) + notes (optional) + Save/Discard. Shows the computed metric live ("This line is 230 m" / "This polygon covers 1.20 ha"). Uses the same turf helpers on the client for immediate feedback.
- **`AnnotationsSidebar.tsx`** — collapsible right-side panel on the map route:
  - Header: toggle button, count badge, type filter chips (All / Lines / Polygons / Pins)
  - List: each row shows icon, title, metric (or — for pins), field name (or "Outside fields"), created date
  - Click row → `onSelect(annotation.id)` → map pans to geometry bounds, item highlights
  - Hover row → map feature highlights
  - Delete button per row (with confirm)
- **`AnnotationsPage.tsx`** at `/annotations`:
  - Table: title, type, metric, field, created_at
  - Column sort, free-text title filter, type filter
  - Row click → `navigate('/?annotation=<id>')`
  - Map page reads `?annotation=<id>` on mount → auto-opens sidebar, flies to item

### Map rendering

New MapLibre sources + layers, loaded when annotations list arrives:

- `annotations-lines`: type=line. Stroke `#f59e0b`, width 2, with labels showing metric at z≥14.
- `annotations-polygons`: type=polygon. Fill `rgba(245, 158, 11, 0.15)`, stroke `#f59e0b`, width 2.
- `annotations-pins`: type=pin. Symbol layer with a lucide `map-pin` icon, label = title at z≥13.

All three layers above field layers (rendered after `fields-labels`), so pins/lines sit on top. Selected annotation gets an extra highlight layer (thicker stroke / bigger icon).

### State

Map page component owns:
- `annotations: Annotation[]` (fetched on mount, refreshed after save/delete)
- `selectedAnnotationId: string | null`
- `sidebarOpen: boolean`
- `typeFilter: 'all' | 'line' | 'polygon' | 'pin'`

Passed down to `FarmMap` (for layer rendering + selection highlight), `AnnotationsSidebar`, `AnnotateTool` (for refresh callback).

## Backend services

### `services/annotationMetrics.js`

```js
import * as turf from '@turf/turf';
export function computeMetrics(geometry) {
  if (geometry.type === 'LineString') {
    return { length_m: turf.length(turf.lineString(geometry.coordinates), { units: 'meters' }) };
  }
  if (geometry.type === 'Polygon') {
    return { area_m2: turf.area(turf.polygon(geometry.coordinates)) };
  }
  return {}; // pin / point
}
```

### `services/annotationFieldResolver.js`

```js
export function resolveFieldId(geometry, fields) {
  const probe = centroidOf(geometry); // point for pin, centroid for polygon, midpoint for line
  for (const f of fields) {
    if (turf.booleanPointInPolygon(probe, f.geometry)) return { field_id: f.id, farm_id: f.farm_id };
  }
  return { field_id: null, farm_id: null };
}
```

### `services/annotations.js`

Standard CRUD against the table, uses better-sqlite3 synchronous API. On create, calls `computeMetrics` + `resolveFieldId` before insert.

## Tests (TDD, failing-first)

### Backend

**`annotationMetrics.test.js`:**
- LineString 500 m → `length_m` ≈ 500 (±0.5)
- 1 ha square polygon (100 × 100 m) → `area_m2` ≈ 10_000 (±5)
- Point → `{}` (no metrics)

**`annotationFieldResolver.test.js`:**
- Point inside a known field polygon → returns that field + its farm
- Point outside all fields → `{ field_id: null, farm_id: null }`
- LineString whose midpoint is inside field A → returns A

**`annotations.test.js` (integration against real `:3001` server):**
- POST line → 201 with computed `length_m` and resolved `field_id`
- POST polygon → 201 with `area_m2`
- POST pin → 201 with no metrics
- POST with type mismatching geometry (type=line, Polygon body) → 400
- GET list → includes just-posted items
- GET list `?type=pin` → filters
- PATCH title → returns updated, preserves geometry + metrics
- PATCH with geometry in body → 400 (geometry immutable)
- DELETE → 204, subsequent GET returns 404

### Frontend

**`SaveAnnotationModal.test.tsx`:**
- Renders title input and notes textarea
- Save button is disabled when title is empty
- Computes + displays "230 m" for a 230 m line geometry
- Computes + displays "1.20 ha" for a 10000 m² polygon
- Clicking Save calls `onSave({title, notes, type, geometry})`
- Clicking Discard calls `onDiscard`

**`AnnotationsSidebar.test.tsx`:**
- Renders count badge equal to items length
- Clicking a row fires `onSelect(id)`
- Filter chip "Pins" hides line and polygon rows
- Empty state renders when no annotations exist

**`AnnotateTool.test.tsx`:** update the existing MeasureTool test
- Adds `point` to the mode list passed to `MaplibreMeasureControl`
- On simulated terradraw `finish` with a feature, calls `props.onFinish(feature)` (the parent then opens the save modal)

## Known hard parts

- **Event bubbling:** clicking a pin on the map vs. clicking a field polygon — annotation layers must be queried before field layers. Use `map.queryRenderedFeatures` in the click handler with ordered layer list.
- **URL query param coordination:** `/annotations` page → `/?annotation=xyz` deep-link → map must fetch annotations (if not already loaded), find by id, compute bounds, call `fitBounds`. Handle the "annotation not found" case with a toast.
- **Stale centroid on pin move (future):** when geometry editing ships, field_id must be recomputed. For v1, geometry is immutable so it's a non-issue.
- **Fields collection memoized server-side:** reading all fields on every POST is fine at <100 fields but wasteful. Acceptable for now; revisit if we exceed 1k fields.
- **Terradraw id vs. our id:** terradraw generates its own feature ids when drawing. Our DB ids are generated on POST. Post-save we clear terradraw features (since they'll be rendered by our dedicated sources), avoiding duplicate-display confusion.

## Build order (TDD)

1. Backend schema + register in `index.js` seed chain (no seed data needed, table just exists)
2. `annotationMetrics.js` (test → impl)
3. `annotationFieldResolver.js` (test → impl)
4. `annotations.js` service CRUD (test → impl) — in-process unit tests that use an in-memory DB
5. `routes/annotations.js` + integration test against running server
6. Frontend API client `api/annotations.ts`
7. Frontend types
8. `SaveAnnotationModal` (test → impl)
9. `AnnotationsSidebar` (test → impl)
10. Rename `MeasureTool` → `AnnotateTool`, add `point` mode + `onFinish` prop, update test
11. Wire `AnnotateTool` + `SaveAnnotationModal` into the map page
12. Add map sources/layers for saved annotations
13. `/annotations` page + route + deep-link handler
14. Manual browser smoke test
15. Update benched-5 spec + ROADMAP; commit

## Files touched

**New backend:**
- `backend/src/db/schema-annotations.js`
- `backend/src/services/annotationMetrics.js` + `.test.js`
- `backend/src/services/annotationFieldResolver.js` + `.test.js`
- `backend/src/services/annotations.js` + `.test.js`
- `backend/src/routes/annotations.js` + integration test

**New frontend:**
- `frontend/src/api/annotations.ts`
- `frontend/src/types/annotation.ts`
- `frontend/src/components/map/tools/AnnotateTool.tsx` (renamed from MeasureTool) + updated test
- `frontend/src/components/map/SaveAnnotationModal.tsx` + test
- `frontend/src/components/map/AnnotationsSidebar.tsx` + test
- `frontend/src/pages/AnnotationsPage.tsx`

**Modified:**
- `backend/src/index.js` — register schema + route
- `backend/src/db/schema.js` — wire new schema module
- `frontend/src/components/map/FarmMap.tsx` — annotation sources/layers + highlight, selectedAnnotationId prop
- Frontend routing (wherever routes are defined) — add `/annotations`
- Map page component — fetch annotations, own sidebar state, handle deep-link

**Docs:**
- `ROADMAP.md` — 5b → shipped
- `docs/specs/benched-spec-5-family-gis-tools.md` — 5b → shipped

## Completion criteria

- [ ] All new backend unit + integration tests green; backend total still 107 + new ones
- [ ] All new frontend tests green
- [ ] Frontend typecheck + build clean
- [ ] Manual browser smoke test:
  - Draw line → save dialog → save → item appears on map + sidebar list
  - Draw polygon → save → same
  - Draw pin → save → marker appears
  - Click map feature → sidebar highlights row
  - Click sidebar row → map flies to feature
  - Delete from sidebar → feature removed
  - Edit title from sidebar → persists on refresh
  - Navigate to `/annotations` → table shows all → row click returns to map zoomed to item
- [ ] Benched-5 + ROADMAP updated
