# Spec 5c — Categorized annotations with icons (infrastructure)

- **Status:** Ready to build.
- **Depends on:** Spec 5b shipped (`annotations` table + CRUD + map rendering).
- **Unblocks:** Spec 3 (task-trigger can attach tasks to typed pins), linked wiki pages per annotation (future).

## Problem

5b lets the operator save a named annotation, but everything looks the same — a fence, a pump, and a borehole all render as identical amber dots. Operator can't scan the map and identify "where are all the pumps" or "where are the electrical boxes". We need QGIS-style categorization so the map reads at a glance.

## Scope (in)

- Extend `annotations` with `category TEXT` (nullable).
- Whitelist categories per type:
  - **pin:** pump, motor, borehole, tank, valve, electrical_box, solar_panel, trough, feed_station, gate, shed, silo, tractor, implement, beacon, generic
  - **line:** pipe, cable, powerline, fence, road, path, irrigation_line, generic
  - **polygon:** dam, kraal, paddock, yard, orchard_block, crop_block, alien_veg_patch, shed_area, generic
- Icon pack: **Phosphor Icons** (`@phosphor-icons/react` for UI, `@phosphor-icons/core` for raw SVG).
- `SaveAnnotationModal` gains a category picker grid filtered by draw type. Default `generic`.
- FarmMap adds symbol layers for pins/lines/polygons rendering the category icon at a sensible anchor (point for pins, centroid for lines/polygons). QGIS-style: the polygon fills stay, and the icon sits on top of the centroid.
- `AnnotationsSidebar` and `AnnotationsPage` show the category icon next to each row and add a category filter dropdown.
- Backend validates `category` against the per-type whitelist on POST + PATCH; unknown → 400.

## Scope (out)

- Custom icon upload.
- Per-user/per-farm category overrides.
- Bulk re-categorization UI.
- Icon color customization (all glyphs render white with halo for readability against satellite imagery).
- Category-aware map-level filtering (just the sidebar filter in v1).

## Data model

```sql
ALTER TABLE annotations ADD COLUMN category TEXT;
CREATE INDEX idx_annotations_category ON annotations(category);
```

No backfill — existing rows remain `NULL`; the map treats `NULL` as `generic`.

## Backend

`services/annotations.js`:

- New `CATEGORY_WHITELIST: Record<AnnotationType, Set<string>>` exported from a shared module `services/annotationCategories.js`.
- `createAnnotation` accepts optional `category`. If provided, must belong to `CATEGORY_WHITELIST[type]`; else 400.
- `updateAnnotation` accepts optional `category`; same validation. Pass `null` to clear.
- SELECT hydrates the new column alongside existing fields.

`routes/annotations.js`:

- POST body gains `category?: string`.
- PATCH body gains `category?: string | null`.

Shape of returned annotation adds `category: string | null`.

## Frontend

### Shared category catalog

`src/components/map/annotationCategories.ts`:

```ts
import { Drop, Gauge, Lightning, ... } from '@phosphor-icons/react';

export type AnnotationType = 'pin' | 'line' | 'polygon';
export interface CategoryDef {
  id: string;            // matches backend
  label: string;         // human
  iconName: string;      // Phosphor name, for map-layer sprite resolution
  Icon: React.ComponentType<{ size?: number; weight?: string }>;
}
export const CATEGORIES: Record<AnnotationType, CategoryDef[]> = { pin: [...], line: [...], polygon: [...] };
```

### SaveAnnotationModal

New prop-less extension. Shows a scroll-free grid (4 cols × N rows) of icon buttons, each 48×48px with the Phosphor glyph + category label below. Selected category highlights with amber border. Default = `generic`.

### Map rendering (QGIS-like)

On map load, for every category across all three types:
1. Read `@phosphor-icons/core` raw SVG string (regular weight, 48px)
2. Rasterize via canvas at 48×48 (with padding), 2× pixel ratio for retina
3. `map.loadImage(dataUrl)` → `map.addImage('ann-icon-' + id, image, { pixelRatio: 2 })`

Then:
- New symbol layer `ann-pin-symbol` for pins: anchor = center of the point, `icon-image: ['concat', 'ann-icon-', ['get', 'category']]`, `icon-size: 0.35`, `icon-allow-overlap: false`.
- New symbol layer `ann-line-symbol` for lines: rendered via GeoJSON transform (compute centroid server-side or client-side when data loads).
- New symbol layer `ann-poly-symbol` for polygons: same centroid approach.

For lines and polygons, we need a helper GeoJSON source of centroids (one Point per annotation). Build from the same annotations list on every update.

### Sidebar & page

- Add category filter dropdown alongside the existing type filter. Options derived from the intersection of categories across all displayed annotations, or always show the full union grouped by type.
- Each row gets a small category icon (16px) in the left gutter.
- Show category label as a subtle tag next to the metric.

## Tests (TDD)

**Backend:**
- `annotation-categories.test.js`: whitelist contains expected categories per type; validation function accepts known, rejects unknown.
- Extend `annotations-service.test.js`: create with valid category persists; create with invalid category throws `invalid_category`; PATCH updates category; PATCH clears category with null; get hydrates category.
- Extend `annotations-api.test.js`: POST with invalid category → 400; PATCH rejects invalid category.

**Frontend:**
- `SaveAnnotationModal.test.tsx`: for pin type, renders picker with pin categories (smoke-check presence of `pump`, `generic`); clicking a category highlights it; POST payload includes the selected category.
- `annotationCategories.test.ts`: catalog has expected cardinality per type; each entry exports a Phosphor icon component.
- `AnnotationsSidebar.test.tsx`: rows render a category icon when category present; renders fallback icon when category is null.

Map symbol rendering itself (canvas rasterization, `loadImage`) isn't unit-testable under jsdom and is verified by smoke test in the browser.

## Known hard parts

- **SVG → MapLibre sprite.** Phosphor core SVG strings contain `<svg>` with `fill="currentColor"`. We render inside a `<canvas>` with a white fill context, which gives solid white glyphs. Halo around labels carries over.
- **Line + polygon icon anchoring.** Centroid can fall outside weird polygons (U-shape). Acceptable tradeoff for v1; spec 5g brings smarter placement.
- **Category-icon zoom behavior.** Icons stay the same size in pixels regardless of zoom, so at very low zoom a cluster of pins will overlap. `icon-allow-overlap: false` drops duplicates. Good enough for v1.
- **Bundle size.** Phosphor React is tree-shakable per-icon. Only categories we reference will ship. Expect ~15 KB gzip for the set listed here.

## Files touched

**New backend:**
- `backend/src/services/annotationCategories.js`
- `backend/src/db/migrate-annotations-category.js` (runs ALTER TABLE if column missing)
- `backend/tests/annotation-categories.test.js`

**Modified backend:**
- `backend/src/db/schema-annotations.js` — idempotent addition of the column for fresh DBs
- `backend/src/services/annotations.js` — accept + validate + persist category
- `backend/src/routes/annotations.js` — body validation
- `backend/src/db/schema.js` — run migration
- `backend/tests/annotations-service.test.js` + `annotations-api.test.js` — extend

**New frontend:**
- `frontend/src/components/map/annotationCategories.ts` (+ test)
- `frontend/src/components/map/iconSprites.ts` — helpers to rasterize Phosphor SVGs to MapLibre images

**Modified frontend:**
- `SaveAnnotationModal.tsx` + test — category picker
- `AnnotationsSidebar.tsx` + test — row icon + category filter
- `AnnotationsPage.tsx` — row icon + category filter
- `FarmMap.tsx` — register sprites on load; add 3 symbol layers with `icon-image` expression
- `api/annotations.ts` — add `category` to types + payloads
- `types/annotation.ts` — add `category: string | null`

## Build order (TDD)

1. Spec committed.
2. Backend: add category column migration + whitelist module + tests.
3. Service + route updates + tests.
4. Frontend deps installed.
5. Frontend category catalog + unit tests.
6. SaveAnnotationModal picker (test first, then impl).
7. Sidebar/page row icon + category filter.
8. iconSprites + FarmMap symbol layers (no unit tests — smoke test in browser).
9. Typecheck, build, run all tests.
10. Update benched-5 + ROADMAP; commit.

## Completion criteria

- [ ] Backend migration runs idempotently on existing + fresh DBs
- [ ] All new + existing backend tests pass (141 + new)
- [ ] Frontend typecheck + build clean
- [ ] All new + existing frontend tests pass (31 + new)
- [ ] Manual browser smoke test: create a pump pin → see pump icon on map + icon in sidebar row; create a pipe line → see icon at midpoint; create a dam polygon → see icon at centroid
- [ ] Filter by category in sidebar hides non-matching rows
- [ ] Benched-5 + ROADMAP updated
