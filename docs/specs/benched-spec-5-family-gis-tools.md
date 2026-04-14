# Spec 5 family (benched) — GIS tools

- **Status:** Scope documented, full brainstorming + plan deferred. Build before specs that need geometry-aware features (1b wind rows, 8b rainfall overlays).
- **Stack decision (locked):** stay on MapLibre. Use `maplibre-gl-terradraw` (drawing & editing) + `@turf/turf` (spatial math). Optionally `maplibre-gl-geo-editor` for sub-spec 5e.
- **Out of scope:** server-side raster pipeline. Tile sources stay public/open.

## Problem

Today the map only renders existing field polygons from the seed. No way to measure distance, drop annotations, draw a new field, switch basemaps, edit a vertex, or query "which fields are within 500 m of this point." Operator works around with Google Earth Pro side-by-side. Friction.

## Sub-specs (one row per file the family grows into when promoted)

| Sub-spec | Scope | Library |
|---|---|---|
| ~~**5a**~~ | ~~Distance + area measurement~~ — **shipped** (see `2026-04-15-spec-5a-measurement.md`) | terradraw |
| **5b** | Annotations (pinned text, photos, persisted to DB) | terradraw + new `annotations` table |
| **5c** | Free drawing (points, lines, polygons that aren't fields) | terradraw |
| **5d** | Import/export GeoJSON, KML, Shapefile zip | `@tmcw/togeojson`, `shp-write` |
| **5e** | Polygon editing (move/insert/delete vertices on existing fields) | maplibre-gl-geo-editor or terradraw edit mode |
| **5f** | Basemap switcher (OSM, MapTiler streets, satellite tiles, hybrid) | MapLibre style swap |
| **5g** | Spatial queries ("fields within radius", "intersects line") | @turf/turf |
| **5h** | Field orientation calculation (longest-axis bearing → wind row default) | @turf/turf |
| **5i** | Layer catalog (toggle visibility per source: fields, tasks, weather, livestock) | MapLibre layer manager |
| **5j** | Satellite imagery layer (Sentinel-2 / Landsat / ESRI World Imagery / NASA GIBS) | XYZ tile sources |

## Open-source satellite imagery options (sub-spec 5j)

| Source | Resolution | Refresh | Cost | Notes |
|---|---|---|---|---|
| Sentinel-2 | 10 m | 5 days | Free (AWS/Azure public datasets) | Best for vegetation NDVI later |
| Landsat 8/9 | 30 m | 16 days | Free (USGS) | Multi-decade archive, useful for change detection |
| ESRI World Imagery | 0.3–1 m | static | Free for non-comm via tile XYZ | Highest base-layer detail |
| NASA GIBS | varies | daily | Free | Cloud, rainfall, MODIS overlays |
| OpenAerialMap | 0.05–0.5 m | user-submitted | Free | Drone uploads, spotty SA coverage |

**AVOID Google satellite tiles** — Google Maps ToS forbids embedding outside their SDKs.

## Build order

5a + 5h (foundation: measurement + math primitives)
→ 5d + 5f + 5j (data layers + basemaps)
→ 5i (layer toggling once there's something to toggle)
→ 5e (edit existing field geometries)
→ 5c (free drawing for ad-hoc shapes)
→ 5b (annotations on top of drawing)
→ 5g (spatial queries — last because it stresses every other piece)

## Known hard parts

- **terradraw / MapLibre version drift.** Pin versions; smoke test on every MapLibre upgrade.
- **Shapefile import** is multi-file zip; needs unzip in the browser before `shp-write` reads.
- **Coordinate-system gotchas.** Source data may be EPSG:32734 (UTM 34S) — convert to WGS84 on import via proj4.
- **Vertex editing on a field changes its area.** All downstream ha-based math (COP, usage rates) needs to refresh; consider a `field_geometry_versions` audit table for sub-spec 5e.
- **Tile attribution is mandatory** for ESRI / OSM / Sentinel — render attribution per-layer.

## Files touched (anticipated, per sub-spec)

Each sub-spec adds a new component under `frontend/src/components/map/tools/` and a small service. 5b, 5c, 5e require schema additions. 5d is purely client-side. 5g may add a backend route for performance.

## Tests

Per sub-spec. Unit tests for math (5a area/distance, 5h orientation bearing, 5g radius queries). Visual/snapshot tests for tool UIs. End-to-end via Playwright deferred until a sub-spec ships UI worth recording.
