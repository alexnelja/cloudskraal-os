# Spec 5.save-chooser — unified save flow + custom feature types + measurement log

Benched 2026-04-16 after smoke-testing the map UI. Alex's feedback:

> I need this to save as a feature, then I can add details to features.
> I want to have the option to save as a field, save a measurement or save a feature.
> I want to be able to add new feature types and pick icons.
> For measurements I want a saved measurement log, that can be named and I want to easily click to copy the number.

## Scope

### A — Save-as chooser (post-draw triage)

When a polygon, line, or point is finished, open a small chooser before the detail modal:

```
 What is this?
 ┌──────────┬──────────────┬──────────┐
 │  Field   │ Measurement  │ Feature  │
 │ (polygon)│ (line/poly)  │ (any)    │
 └──────────┴──────────────┴──────────┘
```

Valid combinations:
- **Field** — polygon only. Opens a form that mirrors the field CRUD UI (name, enterprise, crop, expected yield, etc.) and persists to `fields` table. Skipped if the annotation is inside an existing field.
- **Measurement** — line or polygon. Captures length/area + name, persists to new `measurements` table.
- **Feature** — any geometry. Persists to existing `annotations` table with a `feature_type_id` FK to the new `feature_types` table.

Previous single-modal (SaveAnnotationModal) still exists as the detail form for the Feature branch, but loses the category tiles — categories become DB-backed feature types.

### B — Custom feature types with icon picker

New table `feature_types`:
```
id             uuid pk
name           text not null      -- "Dam", "Kraal", user-defined
icon_name      text not null      -- Phosphor icon pascal name
color          text not null      -- hex, used for marker/outline
geometry_kinds text not null      -- CSV of 'pin','line','polygon'
is_system      integer default 0  -- 1 = shipped defaults, 0 = user-added
created_at     datetime
```

Seed with the current `CATEGORIES` from `annotationCategories.tsx` (pump, motor, borehole, tank, dam, kraal, paddock, yard, orchard, crop_block, alien_veg, shed_area, map_note, task_location, generic) as `is_system=1`. Migrate existing `annotations.category` to `annotations.feature_type_id`.

Feature-type manager UI: a "Manage feature types" entry in the Annotations sidebar header → sheet with list + "New type" form. Form fields: name, icon picker (grid of Phosphor icons filtered by tags — use `@phosphor-icons/core` metadata), color swatch, which geometry kinds apply.

Backend endpoints:
- `GET /api/feature-types`
- `POST /api/feature-types` (user-defined only)
- `PATCH /api/feature-types/:id` (non-system only)
- `DELETE /api/feature-types/:id` (non-system only; cascades to annotation cleanup or reassigns to 'generic')

### C — Measurement log

New table `measurements`:
```
id           uuid pk
name         text not null
kind         text not null  -- 'length' | 'area'
value        real not null  -- meters or square meters
unit         text not null  -- display unit: 'm','km','ha','m²'
formatted    text not null  -- "3.24 km", "29.58 ha" — precomputed
geometry     text not null  -- GeoJSON
field_id     text null fk fields
created_at   datetime
notes        text null
```

Annotations sidebar gets a new **Measurements** tab alongside Lines/Polygons/Pins. Rows show: name, formatted value, copy-to-clipboard button, click-to-zoom. Copy uses `navigator.clipboard.writeText(formatted)` with a toast confirmation.

### D — Saved-pin click opens detail, not save

Related bug Alex flagged: clicking a saved pin/polygon appears to trigger the save dialog. Investigate — likely `editable: true` on terradraw lets click re-trigger `finish`. Fix by either:
- Removing `editable: true` from the `commonModeOptions` in AnnotateTool, OR
- Gating `onFinish` to only fire during an active-mode draw (check `td.getMode()` on fire — skip if `static` / `select`)

Clicking saved geometry should instead open its detail sheet — reuse the existing annotation select → sidebar scroll pattern, plus a new detail panel for full editing (rename, change type, delete).

### E — Terradraw UX polish

- Remove `editable: true` from line/polygon draw modes → vertex editing becomes a separate post-save mode (or deferred)
- Confirm Enter-to-finish and Esc-to-cancel are the only finishers
- No click on the last vertex to finish — always Enter

## Dependencies + migration order

1. DB migrations: `feature_types` table, `measurements` table, `annotations.feature_type_id` column
2. Backend: `/api/feature-types` CRUD, `/api/measurements` CRUD (list/create/delete — no update for v1)
3. Frontend API clients + types
4. Save-as chooser modal (new `SaveAsChooserModal.tsx`)
5. Refactor SaveAnnotationModal → `SaveFeatureModal` using DB-backed feature types
6. New `SaveMeasurementModal`
7. New `SaveFieldModal` (mostly wraps existing field CRUD form)
8. Feature-type manager sheet + icon picker
9. Measurement tab in annotations sidebar with copy-to-clipboard
10. Fix terradraw click-to-finish + editable behaviour (D + E)

## Tests

- Backend: CRUD for feature_types / measurements, constraint checks (system types not deletable, geometry_kinds validation)
- Frontend: chooser branching, icon picker filter, copy-to-clipboard success toast, save-flow per branch
- Integration: draw polygon → chooser → field branch → new field row; draw line → chooser → measurement branch → sidebar entry

## Risks

- `annotations.category` migration: existing rows must map cleanly to seeded feature_types. Write migration as: `UPDATE annotations SET feature_type_id = (SELECT id FROM feature_types WHERE name = LOWER(annotations.category))`.
- Icon picker performance: ~1200 Phosphor icons. Lazy-render + search by name, don't mount the full grid.
- Clipboard API requires HTTPS or localhost. Document as a known dev constraint.
