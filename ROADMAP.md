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
- **[COP] Margin (price × COP)** — `enterprise_prices.price_basis` column + per-line `margin` block in `computeFieldCop`: basis-aligned (`factorChain` converts harvest-wet cost onto the price's sale basis), exact price-year match, graceful null+warnings (`no_price_for_year`, `price_basis_missing`, `margin_basis_unconvertible`, `no_yield`). Rooibos seeded on `sifted_netto_dry_kg`. Other enterprises add their own priced rows + basis (no code change)
- **[Spec 2i.1] Shared inputs** — `shared_inputs` + `shared_input_fields`: a bulk input applied to a chosen set of fields, split `per_ha_rate` (rate × ha) or `total_split_ha` (by ha-share). `services/shared_inputs.js` → `fieldSharedInputCost`; `computeFieldCop` opt-in `include=shared` attaches `line.shared_input_cost` (enterprise line → single productive line → `shared_input_line_not_found`), excludes `is_establishment` (→ capital), flags `coverage.excluded_layers` when off. Provenance columns (`entry_basis`/`external_source`/`external_id`, idempotent unique index) ready Xero/QuickBooks import. CRUD API. Spec: `docs/specs/spec-2i-activity-based-field-costing.md`
- **[Spec 2i.2] Equipment operating rates** — `equipment` gains `fuel_l_per_hour`/`annual_use_hours`/`maintenance_zar_per_year`/`kind`; `services/equipment_rates.js` → `equipmentRate` (cost/hr = depreciation/hr + maintenance/hr + fuel/hr; diesel price from `farm_config.diesel_price_zar_per_l` default R22; attachments no fuel; guards annual_use_hours≤0 + non-straight-line) + `comboRate` (machine+attachment). `GET /equipment/:id/rate`
- **[Spec 2i.3] Field activities** — `field_activities` + `field_activity_fields`: an operation tying machine+attachment (`comboRate`, 2i.2) + operator (`employees.hourly_rate`) × hours to a chosen set of fields, split by link-ha (fallback field `area_ha`). `services/activities.js` → `activityCost` + `fieldActivityCost` (excludes `is_establishment` → capital; warns `multi_field_split_zero_area`, `annual_use_hours_missing`, `activity_labour_overlaps_time_entry` one-place rule); `computeFieldCop` opt-in `include=activities` attaches `line.activity_cost` (enterprise line → single productive line → `activity_line_not_found`), flags `coverage.excluded_layers` when off. No activity-linked inputs in v1 (inputs live in inventory/shared_inputs). Provenance columns ready for Xero. CRUD API + `/fields/:id/activity-cost` + `/field-activities/:id/cost`
- **[Spec 2i.4] Establishment accrual** — `is_establishment`-flagged shared inputs + activities (valid only at year == cohort `planted_year`) accumulate into `field_establishment.total_cost_zar` via `services/establishment.js` → `establishmentAccrual` (read-only) + `applyEstablishmentAccrual` (writes the row; warns `establishment_rows_outside_planted_year`), then amortise over `expected_productive_years` via the existing `include=capital` (2c) — closing the 2i loop: establishment costs never expense in-year. `fieldSharedInputCost`/`fieldActivityCost` gain `{establishment:true}` option. `POST /field-establishment/:id/accrue`
- **[Spec 2h.1] Cost node map backend** — `services/cost_node_map.js` → `buildCostNodeMap` (transforms `computeFieldCop` into the layered DAG from the 2i spec §Visualization: leaves → 7 layer groups → total → ÷yield → cost/kg; price node → margin vs LOADED cost). Layer nodes mirror the `include` flags (status ok/off/no_data + `data_exists` + enable-X-tracking hints) so UI toggles ARE the flags. `enterpriseCostSummary` → weighted Cloudskraal-average R/kg (Σ loaded cost ÷ Σ kg over the enterprise's fields, per-field rows, price/margin via factorChain). `GET /fields/:id/cost-node-map`, `GET /reporting/enterprise-summary`
- **[Spec 2h.2] Cost Map page** — `/cost-map` (sidebar › Business): left→right SVG cost build-up DAG (`components/costmap/CostNodeMapView`, deterministic layered layout, per-layer colours, off/no-data layers dashed with enable hints, click-to-toggle = `include` flags refetch). KPI strip (total, cost/kg, price, margin, Cloudskraal avg), denominator pills (harvest/dried/netto via 2b tiers), scope toggle Field ↔ Cloudskraal (farm view: per-field R/kg table vs weighted avg, click-through to field). **What-if editing**: click any leaf/layer/yield/price node → override → client-side recompute (`lib/costMapWhatIf.applyWhatIf`, amber deltas, reset); backend summary gained `yield_at_price_basis_kg` so margin re-derives under yield overrides. Remaining 2h ideas: enterprise comparison page, data-quality widget (benched spec)
- **[Spec 2h.3] Enterprise comparison + data quality** — `services/reporting.js`: `allEnterprisesSummary` (one row per productive field enterprise: variable vs fully-loaded cost/kg, price, margin; + flock COP rows via `computeFlockCop`) and `dataQuality` (farm-wide counters: uncategorized spend, costed-no-yield lines, off-but-data-exists layers, line-warning tallies). `GET /reporting/enterprises` + `/reporting/data-quality`. Frontend: `/enterprises` page (sidebar › Business; margin red/green, rooibos row → Cost Map; flock table) + `DataQualityCard` on the Dashboard (graceful: hides on error, all-clear state). Enterprise-detail waterfall absorbed by the Cost Map page. **Spec 2h closed.**
- **[Spec 3.2] Task templates + cost pre-fill** — `task_op_templates` (renamed from spec's `task_templates`: an empty same-named scaffold from the task-manager design already existed) + seed library (rooibos/lupines/oats/fallow/grazing/wine, Afrikaans op names, rates are estimates to refine). `services/task_suggestions.js`: `suggestionsForField` (active usage → templates, inputs scaled to `area_ha`, last-assignee per template) + `estimateCost` (catalogue prices + per-ha rate; `product_price_missing` warns not fails). `tasks` gains `template_id` + `estimated_cost_zar` — **frozen server-side at create** so estimates don't drift with prices. API: `/fields/:id/task-suggestions`, `/task-templates[?usage]`, `/task-templates/:id/estimate`. UI: field right-click menu grows usage-matched suggestion tiles (async, top 4, with ~R estimate); `CreateTaskModal` pre-fills title/assignee + cost-preview tile
- **[Spec 4.1] Task lifecycle backend** — state machine `scheduled → in_progress → completed → verified` (+`cancelled` off-ramp w/ required reason); `task_events` append-only audit trail; lifecycle columns on `tasks` (`state` mirrors legacy `status`; legacy completed rows verify directly). **Verify posts actuals to COP exactly once**: `inventory_transactions` per actual input (captured `actual_inputs_json`, else template defaults × `actual_area_ha` pro-rate) + `time_entries` per worker, all tagged `task_id`, `cost_category=direct_variable` → flow straight into `computeFieldCop`; idempotency keyed on the `verified` event (double-fire → 409 `already_verified`); missing catalogue product warns + skips. `POST /tasks/:id/transition`, `GET /tasks/:id/events`. **4.1b shipped:** `TaskLifecycleCard` in `TaskDetailSheet` — state stepper, Start / Complete (hours + area) / Verify & post actuals (per-worker hours via employees picker) / Cancel (reason required), event-trail line, errors surfaced (e.g. 409 already_verified); `transitionTask`/`getTaskEvents` in `api/calendar.ts`; Task type gains lifecycle fields. **4.1c benched:** calendar coverage view (completed/verified tasks by actual_end heatmap)
- **[Spec 6a] Calculator engines + API** — `services/calculators/{sprayer,pest,fertilizer,lime,electrical,fluid}.js`: pure `compute(inputs[, db])` modules returning `{result, breakdown, warnings}` with sanity envelopes (50–600 L/ha spray; lime >8 t/ha split warning + always-on "confirm with agronomist"; >2 m/s pipe velocity; motor ladder cap) and catalogue cost lookups (exact→fuzzy `input_products` match, `product_price_missing` warns not fails; totals from unrounded intermediates). `GET /calculators` + `POST /calculators/:type` (400 invalid inputs, 404 + allowed list). **[Spec 2i.5] Financing costs** — `financing_costs` (working_capital | establishment_loan | land_loan | other; interest explicit or principal × rate × months/12; optional enterprise/field routing, NULL = farm-wide; 2i provenance cols). `services/financing.js` → `addFinancingCost` + `financingSummary` (by-kind rollup; enterprise filter keeps unrouted rows visible as `farm_wide_total`). Deliberately a SEPARATE stream — never an overhead per-ha spread. CRUD `/financing-costs` + `GET /reporting/financing`. UI surfacing rides with the COP UI slice
- **6b shipped:** `/calculators` page (sidebar › Operations) — tile per calc, schema-driven forms from `config/calculators.ts`, product dropdown fed by `inventory/products` for cost-linked calcs, result card with breakdown + amber sanity warnings, inputs persisted to the query string for shareable URLs. Create-task-from-dose deferred (pairs with 3.2 templates later)
- **[Spec 2f.1] Livestock COP inputs** — `flock_cop_inputs` table (one row/flock/year) capturing the high-signal buckets (feed/labour/health/shearing ≈ 80% of cost) + production drivers (weaning %, greasy fleece/head, clean yield %, liveweight sold) + wool/meat income; full CRUD API on `/livestock/[groups/:id/]cop-inputs`; 4 flocks seeded with Land Bank 2024/25 benchmark placeholders (`source='benchmark_landbank_2024_25'`, overwrite with actuals). Research: `docs/research/livestock-cop-inputs-2026-06.md`
- **[Spec 2f.2] Livestock COP compute** — `computeFlockCop` (`services/livestock_cop.js`): hybrid income-share allocation (shearing 100%→wool, rest by gross-income share) → `cost_per_kg_wool`, `cost_per_kg_liveweight`, `gross_margin_per_ewe`, graceful null+warnings. Cross-enterprise transfers (`services/internal_transfers.js`): `grazing_events` (grazing-share = field gross COP × fraction × year-overlap) + `feeding_events` (purchased, or internal-at-cost via source-field line `cost_per_kg`), valued at cost, two-leg net-zero (`computeFieldCop` gains opt-in `internal_transfers` credit line, default off → zero regression). Feed rule: itemised events override the annual bucket. CRUD API + `GET /livestock/groups/:id/cost-of-production`. Spec: `docs/specs/spec-2f.2-livestock-cop-compute.md` (reviewer-approved)

## Priority order (Alex, 2026-06-11)

1. ~~Spec 2h remainders~~ — **shipped** (2h.3 above; 2h closed)
2. ~~Spec 3.2~~ → ~~4.1 backend~~ → ~~4.1b lifecycle UI~~ **all shipped** (4.1c calendar coverage view benched)
3. ~~Spec 6a engines~~ + ~~6b `/calculators` UI~~ **Spec 6 shipped in full**
4. ~~Spec 2i.5 financing costs~~ **shipped** (separate interest stream + /reporting/financing)
5. **COP UI** — flock COP report view, FieldPanel margin block, transfer-pricing toggles

## Queued — benched specs (`docs/specs/benched-*.md`)

- **Spec 1b** — Wind rows & field orientation (unblocked once spec 5a + 5h ship)
- ~~**Specs 2c + 2d** — Long-horizon costs~~ **shipped**: capital amortization (`field_establishment` → `line.capital_amortized_cost`, within productive window) + overhead allocation (`overhead_entries` + `overhead_allocation_rules`; methods per_ha/per_enterprise/revenue_share — revenue-share by cost-independent gross revenue, no iteration). Surfaced via `computeFieldCop` opt-in `include=capital,overhead` (default off → no regression); CRUD API + `/fields/:id/overhead` rollup
- ~~**Spec 2e** — Rooibos processing centre~~ **shipped**: 2e.1 (`processing_batches` + sources, batchYield/fieldProcessingShare, `computeFieldCop include=processing` → batch-actual `cost_per_netto_kg_actual`) + 2e.2 (stokke recirculation: `processing_batch_recirculations`, fresh-wet share denominator so recirculated wet isn't double-counted, mass-balance check; stof byproduct revenue credits net processing cost; `/processing-batches/:id/recirculate` API). + 2e.3 (graded fine fractions: `processing_batch_fractions` table — stokke/netto/superfine/ultrafine with kg/sold_kg/price; byproduct revenue = Σ sold×price over non-netto grades, nets processing cost; recirculated = kg−sold for colour; legacy stof fallback kept) + trace-back attribution (one-hop, toggle-gated): `farm_config.attribution_mode = fresh|traceback` (default fresh); traceback splits each batch's netto into fresh portion (to its fresh fields) + recirc portion traced back to the fields that fed the source batch — conserves total netto; `/processing/attribution-mode` API
- ~~**Spec 2f** — Livestock COP~~ shipped: 2f.1 (inputs + benchmark seed) + 2f.2 (`computeFlockCop`, grazing/feed transfers, two-leg reconciliation) + 2f.3a (breeding/weaned metrics) + 2f.3b (per-kg-weaned via `avg_weaning_weight_kg`) + 2f.3c (at-market transfer pricing: `farm_config.transfer_pricing_mode` + per-event `market_value_zar`/`market_price_zar`, fallback to at-cost + warning) + 2f.3d (stocking-density auto-allocation: `grazing_events.head_count` + `fields.ssu_per_ha`, used when `allocation_fraction` is null) + 2f.3e (source `enterprise` tag on transfers). Remaining nice-to-haves (**future**): `flock_events` mortality stream (death/birth), concurrent-fraction-sum enforcement
- **Spec 2g** — Wine COP: **2g.1 shipped** (vineyard COP + grape margin reusing `computeFieldCop`: wine `conversion_factors` chain `harvest_wet_kg→grape_kg→wine_litres→bottle_750ml`, `TIER_MAPS.wine`, wine grape price on `grape_kg` basis — benchmark placeholder). **2g.2 queued**: cellar/vintage lifecycle (`cellar_batches`, barrel maturation, `computeWineCop` → cost-per-bottle); see `docs/specs/benched-2g-wine-cop.md`
- **[COP UI] Frontend wiring for COP outputs** — surface the backend COP work that currently has no UI: (1) per-line **margin** block in the field COP / FieldPanel view (gross revenue, margin/kg, margin/ha, margin %); (2) **flock COP** report view (`GET /livestock/groups/:id/cost-of-production`) — cost buckets, wool/meat allocation, cost_per_kg_wool/liveweight, breeding/weaned metrics, transfers_in; (3) **transfer-pricing-mode** toggle (at_cost/at_market) + entry for grazing/feeding events, `ssu_per_ha`, `avg_weaning_weight_kg`. Largely overlaps **Spec 2h** (Reporting UI) — fold in there.
- **Spec 2h** — Reporting UI
- ~~**Spec 3** — Map → task trigger~~ shipped (tight); ~~3.2 task templates + cost estimates~~ **shipped**
- ~~**Spec 4 (tight)** — Wiki ↔ task/annotation links~~ shipped; ~~4.1 task lifecycle state-machine + actuals posting~~ **backend shipped** (4.1b frontend queued); **4.2 slash-command inserters + real-time sync** queued
- **Spec 5 family (5a–5j)** — GIS tools: ~~5a measurement~~, ~~5b annotations~~, ~~5c categorized~~ shipped; 5d–5j pending. Deferrals: 5a.2 snap-to-boundary, 5b.2 photos, 5b.3 post-save geometry editing, 5c.2 free-draw, 5i.1 per-category map toggles
- ~~**Spec 6** — Technical calculators~~ **shipped** (6a engines + 6b UI)
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
