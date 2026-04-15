# Session continuation — 2026-04-15

Prepared for a fresh Claude session with cleared context. Paste the "Session prompt" into the new session verbatim, then run the state check before doing anything else.

---

## Session prompt (paste this into the new session)

> Working on Cloudskraal CapEx at `/Users/alexnelja/projects/cloudskraal-capex`. Read `docs/handoffs/2026-04-15-session-continuation.md` for the full handoff.
>
> **This is a browser app (Vite + Express, SQLite).** It is NOT Electron — the "always run full Electron" memory entry applies to the Dhando project, not this one.
>
> **Yesterday's session (2026-04-15) shipped specs 5a, 5b, 5c, 3 (tight), 4 (tight), plus a fluid-glass design system, live GIS layers, and field soil enrichment.** 18 commits. All tests green: backend 154, frontend 40. Everything below documents what landed + what's deferred so you can pick up cleanly.
>
> Standing preferences:
> - **TDD: tests first, failing, then implement — no exceptions.**
> - Work on `main`. No worktrees.
> - Backend is Node/Express (CJS, `require`) + better-sqlite3 + vitest. Integration tests need the server running on `:3001`.
> - Frontend is React 19 + Vite + TypeScript + Tailwind 4. Tests use vitest + jsdom + @testing-library/react. Run: `npm test`.
> - All new dates/years in display code must be relative (derived from `new Date().getUTCFullYear()`, not hardcoded).
> - Use brainstorming → spec → implement workflow for new features. Bench specs can be upgraded to full specs when time to build.
> - **Alex explicitly said "implement direct, follow your recommended route" when asked to proceed. If you pause on every micro-decision you will frustrate them.** Brainstorm the key fork, present a design, ship.

---

## State check (run first)

```bash
cd /Users/alexnelja/projects/cloudskraal-capex

# 1. Clean working tree
git status --short
git log --oneline -10

# 2. Backend tests
cd backend
lsof -ti:3001 | xargs kill 2>/dev/null; sleep 1
PORT=3001 node src/index.js > /tmp/ck.log 2>&1 &
sleep 5
npx vitest run
lsof -ti:3001 | xargs kill 2>/dev/null

# 3. Frontend tests + build
cd ../frontend
npx tsc -b --noEmit
npm test
npm run build
```

Expected:
- Clean working tree
- Last commit starts with `docs: bench deferred work from this session`
- Backend: **14 test files, 154 tests passing**
- Frontend: **5 test files, 40 tests passing**
- Typecheck + build clean (pre-existing chunk-size warning OK)

---

## What shipped this session

### Map tooling — spec 5 family

| Shipped | Files |
|---|---|
| **5a** Distance + area measurement | `MaplibreMeasureControl` wired into FarmMap, metric units, 2dp precision, visible vertex markers, drag-to-edit, undo/redo keyboard |
| **5b** Annotations — save + label | `annotations` table (id, type, title, notes, geometry, length/area, field_id/farm_id, category, metadata, wiki_page_id, timestamps). `SaveAnnotationModal` + `AnnotationsSidebar` + `/annotations` table page |
| **5c** Categorized annotations | Phosphor icons per category; per-type whitelist (pin/line/polygon). `AnnotationMarkers` component renders MapLibre DOM markers with category icons |
| **Auto field resolution** | Backend: when creating an annotation, centroid-in-polygon against `fields` auto-fills `field_id` + `farm_id` |

### Spec 3 (tight)

| Shipped | Files |
|---|---|
| `tasks.annotation_id` + `tasks.wiki_page_id` migrations | `migrate-tasks-annotation-link.js`, `migrate-wiki-page-links.js` |
| Right-click map → context menu (glass popover with Phosphor icons, spring entrance, viewport edge-flip) | `MapContextMenu.tsx` |
| Right-click field → "Create task for \<field\>" | handler in `FarmMapPage.tsx` |
| Right-click empty map → "Create task at this location" (drops `task_location` pin first, then opens modal) | handler in `FarmMapPage.tsx` |
| Right-click empty map → "Drop map note" (`map_note` pin) | handler in `FarmMapPage.tsx` |
| Right-click annotation marker → "Create task linked to this" + "Zoom to" | `AnnotationMarkers.tsx` contextmenu handler |
| CreateTaskModal (title + priority + due + notes) | `CreateTaskModal.tsx` + `.test.tsx` (7 tests) |
| Task count badge on annotation sidebar rows | `AnnotationsSidebar.tsx` |

### Spec 4 (tight) — wiki ↔ task/annotation links

| Shipped | Files |
|---|---|
| `wiki_page_id` FKs on tasks + annotations | `migrate-wiki-page-links.js` |
| `::task:UUID::` and `::annotation:UUID::` inline embed tokens in wiki body | `WikiRenderer.tsx` `processEmbeds()` + React portal mount via `createRoot` |
| Interactive task block in wiki (checkable, PATCHes status) | `WikiTaskBlock.tsx` |
| Interactive annotation block in wiki (category icon, "View on map" button) | `WikiAnnotationBlock.tsx` |
| Map-note drop auto-syncs to `/wiki/map-notes` | `POST /api/wiki/map-notes/append` helper |
| "Linked items" panel below every wiki page | `LinkedItemsPanel.tsx` + `GET /api/wiki/:slug/linked` |

### Fluid glass design system

- `.glass-panel`, `.glass-button`, `.glass-input` utility classes in `index.css`
- Override MapLibre native controls to match
- `FluidDialog.tsx`, `FluidSheet.tsx` primitives with spring physics + backdrop-blur
- `motion/react` installed; used for spring entrances, hover/tap micro-interactions, rebuilt QuickAddFAB
- Unified floating map overlays: top-left draw toolbar, top-right nav + layer control + annotations pill, bottom-right FAB, bottom-left legend — no overlap
- Phosphor Icons (`@phosphor-icons/react` + `@phosphor-icons/core`) as the icon system

### Live data

- Replaced 6 dead `gis.elsenburg.com` URLs with 7 live sources via `migrate-map-layers-live.js`:
  - ISRIC SoilGrids WMS — pH / clay / organic carbon at 0–5cm
  - NASA GIBS IMERG precipitation + MODIS NDVI (XYZ tiles, pinned date)
  - Esri World Topographic
  - NDA Northern Cape ArcGIS
- `FarmMap` now handles `source_type='xyz'` with `{z}/{y}/{x}` URLs
- **Field enrichment**: `/api/fields/:id/enrichment` hits the ISRIC SoilGrids REST API for the field centroid; `FieldEnrichmentTab.tsx` shows live pH / clay% / SOC tiles

---

## Deferred (benched) — what to pick up next

### From spec 5

- **5d** import/export GeoJSON / KML / Shapefile
- **5e** polygon editing (vertex move/insert/delete on existing fields)
- **5f** basemap switcher UI (raster styles already seeded, no picker yet)
- **5g** spatial queries ("fields within 500 m of this point")
- **5h** field orientation (longest-axis bearing for wind rows)
- **5i** layer catalog with grouped tree (base/imagery/agronomic/infra/tasks/historical)
- **5j** satellite imagery layers (Sentinel-2, Landsat; ESRI already in as basemap)
- **5a.2** snap-to-field-boundary during draw (deferred from 5a)
- **5b.2** photo attachments on annotations (deferred from 5b)
- **5b.3** post-save geometry editing (deferred from 5b)
- **5c.2** free-draw mode (uncategorized shapes, the original benched 5c)
- **5i.1** per-category map visibility toggles (complement to sidebar filter)

### From spec 3

- **3.2** task templates library + cost pre-fill (usage-filtered op suggestions, auto-scale inputs to area, snapshot cost) — see `benched-spec-3.2-task-templates.md`

### From spec 4

- **4.1** full task lifecycle state-machine (`scheduled → in_progress → completed → verified`) with actuals posting to COP (`inventory_transactions` + `time_entries`) — remainder of the original benched 4
- **4.2** slash-command inserters (`/task`, `/annotation`) + BroadcastChannel cross-tab sync + task-side wiki-link UI — see `benched-spec-4.2-wiki-ux.md`

### Other benched

See `docs/specs/benched-*.md`:
- **Spec 1b** wind rows (depends on 5h)
- **Specs 2c + 2d** long-horizon costs
- **2e** rooibos processing, **2f** livestock COP, **2g** wine COP, **2h** reporting UI
- **Spec 6** technical calculators
- **Spec 7 family** live position tracking (POPIA-gated)
- **Spec 8 family** weather & climate

---

## Known pitfalls / gotchas

- **Backend is CJS** (`require` + `module.exports`). Tests are ESM (`import`). Services import turf via discrete packages (`@turf/length`, `@turf/area`, `@turf/boolean-point-in-polygon`, `@turf/centroid`, `@turf/helpers`) to keep CJS compatibility. Don't try `require('@turf/turf')` — v7 is ESM-only.
- **Annotation tests need a minimal wiki_pages + tasks table** in in-memory DB setup to satisfy the wiki_page_id / annotation_id FKs. See `annotations-service.test.js` setup() for the pattern.
- **Integration tests share the live DB**. Use sentinel prefixes (`__ANN_TEST__`, `__TASK_LINK_TEST__`) in titles + `afterAll` teardown to keep idempotent.
- **ListAnnotations must order by `created_at DESC, rowid DESC`** — not `id DESC`. UUIDs sort arbitrarily; rowid is SQLite's stable insertion order.
- **GIBS XYZ tiles pin a specific date** (`2026-04-01`). Tiles stop rendering if date is rolled back or server maintenance. Re-check the URLs periodically; we may want a date-picker.
- **ISRIC REST API returns integers that need scaling**: `phh2o / 10` = pH, `clay / 10` = %, `soc / 10` = g/kg. See `fieldEnrichment.js`.
- **Phosphor icon names** — not all lucide-react names exist. Always verify with `node -e "console.log(require('@phosphor-icons/core').icons.filter(i=>i.name.includes('foo')).map(i=>i.pascal_name))"` before importing.
- **Test DB has ~99 fields + ~89 usage periods + ~6 farms + ~41 tasks** seeded. Don't blow it away without a commit.

---

## Suggested next action

Alex asked for the shipped work to be smoke-tested in a browser before continuing. Priority:

1. **Verify end-to-end: drop a map note → navigate to `/wiki/map-notes` → see the pin rendered as an annotation block both inline in body AND in the "Linked items" panel below.** This is the showcase round-trip that ties 5b + 5c + 3 + 4 together. If that breaks, everything downstream is suspect.

2. If the loop works, likeliest next pick:
   - **Spec 3.2** (task templates) — highest business value: operator goes from blank task to usage-specific pre-filled task with cost
   - **Spec 4.2** (slash-commands + cross-tab sync) — highest UX value: Notion-style `/task` becomes first-class
   - **Spec 5h** (field orientation) — tiny, unblocks spec 1b (wind rows)

Ask Alex which before diving in.

---

## Commit chain (this session)

```
be4975d docs: bench deferred work (5a.2, 5b.2/3, 5c.2, 5i.1, 3.2, 4.1, 4.2)
eb3c060 feat(wiki): LinkedItemsPanel under wiki pages
233b3c4 feat(wiki): spec 4 — wiki ↔ task + annotation bidirectional links
a569434 docs: spec 4
2733064 feat(tasks): spec 3 frontend — right-click map → task workflow
823ee50 feat(tasks): spec 3 backend — annotation_id + task pin categories
67cf111 docs: spec 3 (tight)
ec4fe13 feat(ui): unified glass aesthetic across map overlays
eb374cf feat(map): live GIS layers + field enrichment + UI destacking
62cfbbf feat(ui): fluid motion, frosted glass, tactile markers
7902383 feat(annotations): spec 5c — categorized with Phosphor icons
8ff68eb docs: spec 5c
4e36cc7 feat(annotations): spec 5b — save, pin, label
9b87d5d docs: spec 5b
9fa3835 feat(map): spec 5a polish — visible vertices, editable, undo/redo
a11024f feat(map): spec 5a — distance & area measurement
b6f87fc docs: spec 5a
```

---

## Completion gate for next session

Before claiming any new spec "done":
- [ ] All new + existing backend tests pass (`npx vitest run`)
- [ ] All new + existing frontend tests pass (`npm test`)
- [ ] Typecheck + build clean on the frontend
- [ ] **The relevant user workflow has been exercised in the running browser.** Code-passing-tests ≠ feature working. This session shipped six specs without Alex confirming any of them in the browser; that's technical debt.
- [ ] Bench specs updated, ROADMAP updated, handoff updated if non-trivial
