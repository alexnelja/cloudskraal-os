# Roadmap

## Shipped

- **[Spec #1] field_usage_period** — interval-based usage history (`fd360d5 → 61aaf97`)
- **[Spec 2a] Field-variable COP + cost tagging** (`cf5878c → 5213f30`)
- **[Spec 2b] Denominators & shrinkage** (`425604c → 1ae6339`)
- **[Wiki] Obsidian tier 1** — CodeMirror 6 editor, 40+ features
- **[QoL] Rooibos price forecast curve, FieldPanel refactor, relative-year display** (`225eddf, 98401d9, c0c7f27`)
- **[Workbook] Oct-2025 master workbook ingest** — every non-empty sheet covered (`9a995e9` audit)
- **[Spec 5a] Map distance + area measurement** — `MaplibreMeasureControl` wired into FarmMap; frontend vitest+jsdom+RTL infra set up
- **[Spec 5b] Annotations** — save measurements + pins with title/notes; sidebar + `/annotations` page; `annotations` table, CRUD API, auto field resolution (photos deferred to 5b.2)
- **[Spec 5c] Categorized annotations** — per-type whitelists, Phosphor icons, `category` + `metadata_json` columns; category picker in modal; icon markers overlay on map (QGIS-style)
- **[Spec 3] Map → task trigger (tight)** — right-click field/marker/empty-map → context menu → CreateTaskModal; `tasks.annotation_id` FK, task count badge on annotation rows, `task_location` + `map_note` pin categories; wiki-sync for map notes deferred to spec 4
- **[Spec 4] Wiki ↔ task + annotation bidirectional links (tight)** — `wiki_page_id` FKs on tasks + annotations; `::task:UUID::` and `::annotation:UUID::` inline embed tokens in wiki body rendered as interactive `WikiTaskBlock` and `WikiAnnotationBlock` via React portals; map-note drop auto-appends to `/wiki/map-notes` page; `/api/wiki/:slug/linked` endpoint for "linked items" queries
- **[UX] Fluid glass design system** — `.glass-panel/.glass-button/.glass-input` tokens, motion/react springs, MapLibre control styling, Phosphor icon markers, unified floating overlays
- **[Data] Live GIS layers + field enrichment** — replaced 6 dead elsenburg.com URLs with 7 live sources (ISRIC SoilGrids, NASA GIBS IMERG/MODIS, Esri World Topographic, NDA Northern Cape); new `/api/fields/:id/enrichment` endpoint + "Enrichment" FieldPanel tab showing live ISRIC pH/clay/SOC at field centroid
- **[Wiki] LinkedItemsPanel** — "Linked items" section below every wiki page listing tasks + annotations that reference the page via `wiki_page_id`

## Queued — benched specs (`docs/specs/benched-*.md`)

- **Spec 1b** — Wind rows & field orientation (unblocked once spec 5a + 5h ship)
- **Specs 2c + 2d** — Long-horizon costs (amortization + overhead)
- **Spec 2e** — Rooibos processing centre
- **Spec 2f** — Livestock COP
- **Spec 2g** — Wine COP
- **Spec 2h** — Reporting UI
- ~~**Spec 3** — Map → task trigger~~ shipped (tight); **3.2 task templates + cost estimates** queued
- ~~**Spec 4 (tight)** — Wiki ↔ task/annotation links~~ shipped; **4.1 full task lifecycle state-machine + actuals posting** still queued; **4.2 slash-command inserters + real-time sync** queued
- **Spec 5 family (5a–5j)** — GIS tools: ~~5a measurement~~, ~~5b annotations~~, ~~5c categorized~~ shipped; 5d–5j pending. Deferrals: 5a.2 snap-to-boundary, 5b.2 photos, 5b.3 post-save geometry editing, 5c.2 free-draw, 5i.1 per-category map toggles
- **Spec 6** — Technical calculators (sprayer, pest dose, lime, electrical, fluid, fertilizer)
- **Spec 7 family** — Live position tracking (employees + vehicles) — POPIA-gated
- **Spec 8 family (8a–8g)** — Weather & climate (ingest, overlays, correlation, forecasts, alerts, station)

## v1.0.0 — Release Targets

- [ ] Secret rotation (see `docs/security/SECRET-ROTATION-CHECKLIST.md`)
- [ ] Authentication middleware (Bearer token / Supabase JWT)
- [ ] Migrate xlsx dependency to exceljs
- [ ] Split calendar.js routes (events vs tasks)
- [ ] Normalize production_batches.source_field_ids

## v2.0.0 — Material Design 3 Migration

Full frontend redesign from Tailwind + glass-panel to Google Material Design 3.
Branch: `feature/material-3` (fork from main after v1.0.0).
See `CHANGELOG.md` for detailed scope and migration strategy.

Key deliverables:
- MD3 color system with dynamic color from Cloudskraal brand
- MD3 components (FAB, nav rail, cards, chips, dialogs, sheets)
- MD3 canonical layouts (list-detail, feed, supporting panel)
- Automatic dark mode via MD3 color scheme
- Module-by-module migration with feature flag

## Backlog (ideas, not yet spec'd)

- Reverse-waterfall simulator: target NPV/IRR in → required CapEx/yield/price out
- Breeding calendar integration with task triggers (Dohne Merino lifecycle)
- Meulsteenvlei acquisition financing model linked to CapEx scenarios
- Section 42 / tax-restructure scenarios surfaced in financial engine
- Per-enterprise P&L rollups (sheep, rooibos, wine, lupines/oats)
- Monte Carlo on price + yield distributions per enterprise
- Multi-farm portfolio view (Cloudskraal + Meulsteenvlei)
- Mobile offline-first wiki (field data capture)
- Climate / rainfall scenario overlays on CapEx IRR
- Sync new `data/Wiki/` markdown into vault + wiki DB

## Dropped from roadmap (done or absorbed)

- ~~Render GeoJSON/KML field boundaries on MapLibre~~ — already done in seed-farms
- ~~Rooibos price forecast curve in UI~~ — done (`225eddf`)
- ~~Integrate feed calculator v2~~ — absorbed into bench spec 6 (technical calculators)
- ~~Wire sheep assessment into enterprise module~~ — absorbed into bench spec 2f (livestock COP)
- ~~Ingest Oct-2025 master workbook~~ — audit complete (`9a995e9`); no further import needed

## Specs index

- All shipped specs and benched specs live under `docs/specs/` (`2026-MM-DD-*.md` for shipped, `benched-*.md` for queued)
- Plans live under `docs/plans/`
- Session handoffs live under `docs/handoffs/`
