# Session continuation — 2026-04-14

Prepared for a fresh Claude session with cleared context. Paste the "Session prompt" below into the new session verbatim, then confirm the state check before proceeding.

---

## Session prompt (paste this into the new session)

> Working on the Cloudskraal CapEx farm management app at `/Users/alexnelja/projects/cloudskraal-capex`. Previous session shipped spec #1 (field_usage_period), specs 2a/2b (field-variable COP + denominators), FieldPanel refactor, and the rooibos price forecast with relative-year display.
>
> Read `docs/handoffs/2026-04-14-session-continuation.md` in this repo for the full plan. Execute tasks 1–4 in that order. Confirm the state check passes before starting.
>
> Standing preferences from prior sessions:
> - Tests first, failing, then implement — no exceptions.
> - Work on `main` branch (no worktrees).
> - Backend is Node/Express + better-sqlite3 + vitest. Integration tests need the server running on `:3001`.
> - Frontend is React + Vite + TypeScript; tests ESM, src CJS.
> - All new dates/years in display code must be relative (derived from `new Date().getUTCFullYear()`, not hardcoded).
> - Use brainstorming → spec → plan → implement workflow for new features. Bench specs can be upgraded to full specs+plans when it's time to build them.

---

## State check (run first)

```bash
cd /Users/alexnelja/projects/cloudskraal-capex

# 1. Git state — should be clean
git status --short

# 2. Verify all tests still pass
cd backend
lsof -ti:3001 | xargs kill 2>/dev/null; sleep 1
PORT=3001 node src/index.js > /tmp/ck.log 2>&1 &
sleep 4
npx vitest run
lsof -ti:3001 | xargs kill 2>/dev/null; wait 2>/dev/null

# 3. Frontend typechecks + builds
cd ../frontend
npx tsc -b --noEmit && npm run build
```

**Expected:**
- `git status`: clean working tree (may have untracked `.DS_Store`, ignore)
- Backend: 7 test files, 107+ tests passing
- Frontend: clean typecheck, build succeeds with pre-existing chunk-size advisory only

If any of these fail, STOP and investigate before continuing.

---

## Task 1 — Write bench specs for named spec families 3, 4, 5, 6

**Goal:** every planned spec has a `docs/specs/benched-*.md` file so the directory is the canonical source of truth. Pattern: follow the shape of existing `docs/specs/benched-*.md` files (short — problem, scope, schema sketch, API, known hard parts, files touched, build order).

**Files to create:**

1. `docs/specs/benched-spec-3-map-task-trigger.md`
   - **Scope:** right-click a field on the map → context menu → create task with usage-aware ops, cost estimate, assignee, due date. Pulls from `field_usage_period` (active usage), prior tasks for the same field, and `input_products` catalogue.
   - **Key tables:** `tasks` (exists), `task_inputs` (exists). Possibly new `task_templates(usage, op_type, default_inputs_json, default_duration_hrs)` for suggested ops per usage.
   - **Hard part:** usage-specific op library (what you do on a rooibos field vs a lupines field vs a fallow field).

2. `docs/specs/benched-spec-4-task-lifecycle.md`
   - **Scope:** task state machine (scheduled → in_progress → completed → verified), completion posts actuals to COP (creates inventory_transactions + time_entries tagged to the task), calendar renders historical tasks as a coverage view.
   - **Key tables:** existing `tasks`, add columns if needed (actual_start, actual_end, actual_inputs_json). Possibly `task_events(id, task_id, event_type, at, by, notes)` for audit trail.
   - **Hard part:** partial completions; inputs applied differ from planned; time entries split across multiple fields in one task.

3. `docs/specs/benched-spec-5-family-gis-tools.md` (ONE file covering all 5a-5j sub-specs concisely — already discussed in this session's conversation)
   - **Sub-specs 5a–5j:** measurement, annotations, drawing, import/export, polygon editing, basemap switcher, spatial queries, orientation, layer catalog, satellite imagery. Build order: 5a+5h → 5d+5f+5j (layers & imagery) → 5i → 5e → 5c → 5b → 5g.
   - **Stack decision (locked):** stay on MapLibre. Use `maplibre-gl-terradraw` + `@turf/turf`. Optionally `maplibre-gl-geo-editor` for 5e editing.
   - **Open-source satellite imagery:** Sentinel-2 (10m, 5-day refresh, free via AWS/Azure), Landsat 8/9 (30m, 16-day, multi-decade archive), ESRI World Imagery (0.3-1m static), NASA GIBS (daily weather-sat overlays), OpenAerialMap (drone user-submitted). AVOID Google satellite tiles (ToS forbids embedding).

4. `docs/specs/benched-spec-6-technical-calculators.md`
   - **Scope:** on-demand calculators: electrical load (pump sizing), fluid flow (pipe sizing), sprayer calibration (nozzle rate + travel speed), pest dose (label rate × area), fertilizer rate, lime requirement (soil pH correction).
   - **Key tables:** none required initially — pure calculation. Optional `calculator_presets(id, type, name, inputs_json)` for reusable farm-specific presets.
   - **Hard part:** calculator inputs need validation (units, sane ranges); results need to link to `input_products` for automatic dose-to-cost conversions.

**Commit message:** `docs: bench-specs for named families (3 map-task-trigger, 4 task-lifecycle, 5 GIS tools, 6 calculators)`

---

## Task 2 — Ingest the Oct-2025 master workbook

**File:** `/Users/alexnelja/projects/cloudskraal-capex/data/Cloudskraal_October 2025.xlsx`

**Current state:** Already partially imported via `backend/src/db/seed-excel-import.js` — reads sheets: Suppliers, Customer, Outputs, Inputs, Equipment, Equipment 2, Sheep Flock, rooibos sheets. Check what's currently done by reading the seed file and running:

```bash
cd backend
sqlite3 data/capex.db "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

**What might be missing** (audit needed):
- `Forecasted January 2021` sheet — historical forecast data?
- `Fields` sheet — does the seed use it? (Spec 2a audit showed the seed file appears template-ish with fictional rows like "Rooibos-1" / Alice / Bob, but real field data lives in `seed-farms.js` + `seed-land-use-2026.js`.)
- `Workers` sheet — aligns with `employees` table?
- `Rooibos - Johan Brand - Oeskatt` / `Copy of Oeskatting` — Rooibos yield estimation sheets. May have 2022-2025 actuals we don't have elsewhere.

**Approach:**

1. Read every sheet in the workbook (use the pattern in `seed-excel-import.js`).
2. Diff each sheet's columns against the corresponding DB table:
   - If columns match and data is new, write an idempotent extend-seed.
   - If columns differ, document the gap in `docs/specs/benched-workbook-ingest-gaps.md` for a future spec to reconcile.
3. Priority: Rooibos yield sheets → populate `field_production` historical actuals → spec 2a COP reports immediately become richer.
4. Commit as `feat(cloudskraal): ingest Oct-2025 workbook — <sheets imported>`.

**Guard rail:** do NOT overwrite existing seeded data. All new seeds check row counts before insert (pattern in `seed-conversion-factors.js`). If a sheet has conflicting data with existing DB rows, write to a sidecar table `workbook_import_conflicts` for manual review.

**Test:** after ingest, `npx vitest run` must stay at 107+ passing. No regression.

---

## Task 3 — Update ROADMAP.md

**File:** `/Users/alexnelja/projects/cloudskraal-capex/ROADMAP.md`

Current ROADMAP.md has stale content — it hasn't been updated as specs shipped. Rewrite to reflect the new canonical structure.

**Target structure:**

```markdown
# Roadmap

## Shipped
- [Spec #1] field_usage_period — interval-based usage history (fd360d5 → 61aaf97)
- [Spec 2a] Field-variable COP + cost tagging (cf5878c → 5213f30)
- [Spec 2b] Denominators & shrinkage (425604c → 1ae6339)
- [Wiki] Obsidian tier 1 — CodeMirror 6 editor, 40+ features
- [Misc] Rooibos price forecast, FieldPanel refactor, relative-year display (225eddf, 98401d9, c0c7f27)

## Queued — benched specs (docs/specs/benched-*.md)
- Spec 1b — Wind rows & field orientation (unblocked by spec 5a+5h)
- Specs 2c+2d — Long-horizon costs (amortization + overhead)
- Spec 2e — Rooibos processing centre
- Spec 2f — Livestock COP
- Spec 2g — Wine COP
- Spec 2h — Reporting UI
- Spec 3 — Map → task trigger
- Spec 4 — Task lifecycle
- Spec 5 family — GIS tools (5a–5j)
- Spec 6 — Technical calculators
- Spec 7 family — Live position tracking (employees + vehicles) — POPIA-gated
- Spec 8 family — Weather & climate

## Backlog (ideas, not yet spec'd)
- Reverse-waterfall simulator
- Breeding calendar + task triggers
- Meulsteenvlei acquisition model
- Section 42 / tax-restructure scenarios
- Per-enterprise P&L rollups
- Monte Carlo on price+yield
- Multi-farm portfolio view
- Mobile offline-first wiki
- Climate/rainfall scenario overlays on CapEx IRR

## Drop from roadmap (either done or absorbed)
- ~~Render GeoJSON/KML field boundaries on MapLibre~~ — already done
- ~~Rooibos price forecast curve in UI~~ — done (225eddf)
- ~~Integrate feed calculator v2~~ — track in bench spec 6
- ~~Wire sheep assessment into enterprise module~~ — track in bench spec 2f
- ~~Ingest Oct-2025 master workbook~~ — completed in Task 2 of this session (or note as in-progress)
- ~~Sync `data/Wiki/` markdown into vault + wiki DB~~ — keep if still wanted
```

Commit as `docs: update ROADMAP — reflect shipped specs, bench queue, cleaned backlog`.

---

## Task 4 — Pick and build ONE benched spec

Recommended: **spec 8a — weather ingestion**.

**Why 8a specifically:**
- Smallest new-schema addition (one `weather_observations` table)
- Foundation for spec 8d (yield correlation) which is the biggest analytical payoff of the weather family
- Zero external dependencies (Open-Meteo + NASA POWER + CHIRPS are keyless)
- Unblocks rainfall annotations on COP reports (spec 2a lines get context)

**If Alex prefers a different spec (he can choose when he reads this):**
- Spec 1b (wind rows) — smallest, most visible
- Spec 2e (processing) — directly enhances COP numbers
- Spec 8a (weather) — best long-term infrastructure ROI

**Workflow for Task 4 (regardless of which spec):**
1. Read the `benched-*.md` file for scope anchor
2. Invoke `brainstorming` skill — present approaches, ask clarifying questions one at a time
3. Get user approval section-by-section
4. Write full spec doc `docs/specs/YYYY-MM-DD-<topic>.md`
5. Dispatch spec-review subagent (architect-reviewer)
6. Apply fixes
7. Invoke `writing-plans` skill for implementation plan
8. Review plan, then offer subagent-driven vs inline execution
9. Execute with TDD

---

## Reference — key files and commits

### Shipped commit chain (baseline)
- Pre-session: `fd360d5`
- Spec 1: `fd360d5 → 61aaf97`
- Spec 2a: `cf5878c → 5213f30`
- Spec 2b: `425604c → 1ae6339`
- QoL: `7fb3546, 98401d9, 225eddf, c0c7f27`
- Bench specs: `5e3a2d6, 45da13f`

### Key source files
- `backend/src/services/cop.js` — COP aggregation (spec 2a/2b)
- `backend/src/services/usage.js` — usage periods (spec #1)
- `backend/src/utils/dates.js` — UTC date helpers
- `backend/src/routes/farms.js` — field CRUD + cost-of-production endpoint
- `backend/src/db/schema*.js` — schema modules; wire new ones through `schema.js`
- `backend/src/index.js` — seed chain order matters: calendar → farms → usage-periods → field-costs → conversion-factors → enterprise-prices
- `frontend/src/components/map/FieldPanel.tsx` — panel shell
- `frontend/src/components/map/FieldPanelTabs.tsx` — Overview/Inputs/Labour/Costs tabs
- `frontend/src/components/map/FieldPanelPrimitives.tsx` — shared components
- `frontend/src/components/map/FarmMap.tsx` — MapLibre setup
- `frontend/src/components/EnterprisePriceCurve.tsx` — price forecast component (reused on dashboard + field panel)

### Memory (persistent across sessions)
- `~/.claude/projects/-Users-alexnelja-projects/memory/MEMORY.md` — index
- `project_cloudskraal_roadmap.md` — spec roadmap (update after Task 3)
- `domain_cloudskraal_terms.md` — glossary: stand_pct, bruto/netto, stokke/stof, UOM chains per enterprise
- `feedback_tdd_tests_first.md` — TDD preference

### Standing pitfalls
- Backend seed data uses 2026 as a planning year — correct, don't "fix" hardcoded years in seed data
- `field_production` has UNIQUE(field_id, year) — two production rows in the same year cause a FK constraint failure in tests (known gotcha hit in spec 2b T4)
- `db.prepare(...).run(...)` is synchronous with better-sqlite3; no await
- Test DB is SHARED across runs; integration tests must clean up sentinel-year rows in `afterAll`
- Frontend typecheck errors in `FieldPanel.tsx` after a type change are EXPECTED until the panel is updated; don't panic

---

## Completion criteria

Session is done when:
- [ ] 4 new bench spec files exist (3, 4, 5, 6)
- [ ] Oct-2025 workbook ingestion is either complete or documented as "no further import needed" with evidence
- [ ] ROADMAP.md reflects the shipped → queued → backlog structure
- [ ] One benched spec (default 8a) is fully built — spec written, plan written, implementation shipped, tests green
- [ ] All tests still pass; frontend still builds
- [ ] Roadmap memory updated

Then stop. Do not start a second benched spec. The user will pick the next target in the session after that.
