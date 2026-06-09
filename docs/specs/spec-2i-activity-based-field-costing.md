# Spec 2i — Activity-based field costing

- **Status:** Designed, awaiting build. 4 TDD sub-slices (2i.1 → 2i.4).
- **Depends on:** 2a (per-field direct cost), 2c (`field_establishment` amortisation),
  2d (allocation patterns), `equipment` table (phase 2). Feeds `computeFieldCop`.
- **Why:** Today per-field COP only sees costs tied to a single `field_id`. Real
  Cloudskraal costs are (a) bulk inputs applied to a *set* of fields per-ha, (b)
  machine + attachment operating cost (amortisation + fuel + maintenance) per
  activity, (c) operator time per activity, (d) establishment costs amortised over
  the rooibos harvest years. The processing cost-centre is already separate (2e).

## Scope (the rooibos prep → harvest → factory-handoff cycle)

Activities to cost, in sequence: soil till → spray → clean → plant lupines (pre-season
cover) → till → spray → wind rows → plant tea → clean/prep → weed (manual or automated)
→ harvest → transport to factory. At the factory the tea enters the 2e processing
cost-centre (separate; out of scope here).

## Decisions (locked with Alex, 2026-06-09)

1. Shared-input default split = **per-ha application rate** (`rate_per_ha × field.ha`);
   also support **total ÷ ha-share** (`total × field.ha / Σ selected ha`).
2. Spec doc first, then build 2i.1 → 2i.4.

---

## 2i.1 — Shared inputs (applied to selected fields)

A bulk input (e.g. R220k fertiliser) applied to a *chosen subset* of fields, split per-ha.

**Tables**
```
shared_inputs(
  id, date, year, product, cost_category DEFAULT 'direct_variable',
  basis TEXT,            -- 'per_ha_rate' | 'total_split_ha'
  rate_per_ha REAL,      -- for per_ha_rate
  total_cost_zar REAL,   -- for total_split_ha
  usage TEXT,            -- optional: route to a specific usage line on mixed-usage fields
  is_establishment INTEGER DEFAULT 0,  -- 1 → accrue to field_establishment (2c), not in-year
  notes, created_at, updated_at )
shared_input_fields( id, shared_input_id → shared_inputs ON DELETE CASCADE, field_id → fields )
```
**Allocation** (`services/shared_inputs.js → fieldSharedInputCost(db, fieldId, year)`):
- per_ha_rate: `rate_per_ha × field.area_ha` for each shared_input the field is in (year match).
- total_split_ha: `total_cost × field.area_ha / Σ(area_ha of selected fields)`.
- Returns `{ total, items:[{shared_input_id, product, basis, allocated}] }`.

**COP integration:** shared inputs are **direct variable** → fold into the matching
usage line's cost. To stay regression-safe while it beds in, gate behind
`include=shared` for v1 (flip to always-on once trusted). New `line.shared_input_cost`,
added into a `total_cost_with_shared`. Attribute to the line whose usage = field.enterprise.

---

## 2i.2 — Equipment operating rates

Derive a machine cost/hour and /ha from the existing `equipment` row + new fields.

**Schema add** (migration on `equipment`): `fuel_l_per_hour`, `annual_use_hours`,
`maintenance_zar_per_year`, `kind` ('machine' | 'attachment'). Fuel price from
`farm_config` key `diesel_price_zar_per_l` (default sensible, overridable).

**Service** `services/equipment_rates.js → equipmentRate(db, equipmentId)`:
- `depreciation_per_year = (purchase_price − salvage_value) / useful_life_years`
  (respect `depreciation_method`; straight-line v1).
- `cost_per_hour = depreciation_per_year/annual_use_hours + maintenance/annual_use_hours
  + fuel_l_per_hour × diesel_price`.
- Attachments (`kind='attachment'`) have depreciation + maintenance but no fuel; a
  combo machine+attachment sums their per-hour costs.
- Returns `{ cost_per_hour, depreciation_per_hour, fuel_per_hour, maintenance_per_hour }`.

---

## 2i.3 — Activities (operations)

The entity that ties machine + attachment + operator + inputs to field(s) per activity.

**Tables**
```
field_activities(
  id, date, year, activity_type, enterprise,
  equipment_id → equipment, attachment_id → equipment, operator_employee_id → employees,
  hours, ha_covered, notes, is_establishment INTEGER DEFAULT 0, created_at, updated_at )
field_activity_fields( id, activity_id → field_activities ON DELETE CASCADE, field_id → fields, ha )
```
**Cost** (`services/activities.js → activityCost`): per activity =
`equipmentRate(machine).cost_per_hour × hours` + `equipmentRate(attachment).cost_per_hour × hours`
+ `operator.hourly_rate × hours`. **No activity-linked inputs in v1** (inputs live in
`inventory_transactions`/`shared_inputs`). Multi-field → split by each field's
`ha` (or ha_covered share). `fieldActivityCost(db, fieldId, year)` rolls up a field's share.

**COP integration:** `include=activities` → `line.activity_cost` (machine+fuel+operator),
into `total_cost_with_activities`. **Double-count caution:** if labour is also in
`time_entries` and inputs in `inventory_transactions`, record each in one place — surface a
doc note (like the 2f feed-bucket rule), not enforced in v1.

---

## 2i.4 — Establishment amortisation of cycle activities

Activities/inputs with `is_establishment=1` (year 0/1 of a rooibos cohort) accumulate into
the field's `field_establishment.total_cost_zar` (2c) instead of expensing in-year, then
amortise over `expected_productive_years`. v1: a helper sums establishment-flagged
activity + shared-input costs for a cohort into a `field_establishment` row (manual link or
auto by field+planted window). Surfaced via the existing `include=capital`.

---

## computeFieldCop integration summary

All additive, opt-in (default off → no regression), composing with the existing
`include` flag: `include=processing,capital,overhead,shared,activities`. Each adds a
per-line cost field + a `coverage` note; none mutate existing line/total fields.

## Known hard parts

- **Double-counting** across `time_entries`/`inventory_transactions` vs `field_activities`
  vs `shared_inputs` — one-place rule, surfaced not enforced (v1).
- **Establishment vs annual** classification per activity — `is_establishment` flag; the
  amortisation cohort link (which planting) needs a convention.
- **Attachment+machine combos** — sum per-hour rates; no combo table in v1.
- **Annual use hours** drives depreciation/hr — estimate first, refine with `hours_meter`.

## Files (anticipated)

New: `shared_inputs`/`shared_input_fields`, `field_activities`/`field_activity_fields`
schemas + migrations; `services/shared_inputs.js`, `equipment_rates.js`, `activities.js`;
equipment-rate columns migration; 3 route sets; ~8 test files.
Modified: `services/cop.js` (`include=shared,activities`), equipment routes.

## Tests

TDD per slice. 2i.1: per-ha + total-split allocation, multi-field, COP fold-in.
2i.2: rate maths incl. attachment combo, fuel-price from config. 2i.3: activity cost
incl. operator + multi-field split. 2i.4: establishment accrual → amortised via 2c.

---

## Reviewer resolutions (blockers — preconditions for 2i.1 TDD)

1. **Line attribution fallback.** Shared inputs / activities attach to the line whose
   `usage == field.enterprise`; if none, attach to the single productive line when exactly
   one exists, else emit warning `shared_input_line_not_found` (resp. `activity_line_not_found`)
   and skip (no silent loss). A line is **productive** if its usage ∉ {fallow, grazing,
   fallow_greening} (the existing `NON_PRODUCTIVE` set in cop.js) and ≠ uncategorized.
   `shared_inputs` has an optional `usage` column to route explicitly on mixed-usage fields.
2. **Establishment double-count.** Rows with `is_establishment=1` are EXCLUDED from in-year
   `shared_input_cost` / `activity_cost`; they accrue to `field_establishment` (2c) and surface
   only via `include=capital`. `is_establishment` is valid only when the row's year ==
   cohort `planted_year`. `shared_inputs` also gets `is_establishment`.
3. **Labour/input double-count.** v1: `field_activities` cost = machine + fuel + operator only
   (NO activity-linked inputs — inputs live in `inventory_transactions`/`shared_inputs`). Emit
   `activity_labour_overlaps_time_entry` warning if an activity's operator+date matches a
   `time_entries` row. One-place rule documented; not enforced beyond the warning.
4. **Equipment div-by-zero.** `annual_use_hours <= 0/null` → `cost_per_hour: null` +
   `annual_use_hours_missing`. `depreciation_method != 'straight_line'` → reject at write +
   `depreciation_method_unsupported`.
5. **Zero-area split.** Require ≥1 selected field with `area_ha > 0`; if Σ area = 0 → warn
   `multi_field_split_zero_area` and skip (no div-by-zero).
6. **Opt-in understatement.** When shared/activity rows exist for a field but the flag is off,
   computeFieldCop emits `shared_input_costs_excluded` / `activity_costs_excluded` so the gap is
   visible. Plan: flip to always-on after a trust period (these are direct-variable costs).

## Expanded cost taxonomy (research-backed)

Full study: `docs/research/rooibos-cost-structure-2026-06.md` (Elsenburg Cederberg Yr1–6 2024).
Key point for usability: **most missing categories are farm-wide → carried by ONE mechanism,
overhead allocation (2d), with a method per category** — so the model gains ~6 overhead
categories + a few field-level nodes, not 20 tables. Material additions, by priority:

- **Overhead (2d) categories:** land cost / opportunity (toggle owned vs imputed), management /
  owner salary, insurance (fire/asset), fixed-improvement depreciation (drying court, sheds,
  fences, roads), certification/audit, professional fees.
- **Financing (deferred to its own slice 2i.5 / 2j):** working-capital interest +
  establishment/land-loan interest. NOT overhead — it's time/borrowing-structure dependent
  (principal × rate × period), computed as a separate stream, not a per-ha/per-enterprise
  allocation. Out of scope for 2i.1–2i.4.
- **Field-level activities (2i.3):** firebreak cutting (Cederberg-mandatory) + FPA fee,
  explicit transport-to-processor node, end-of-cycle rip-out/replant (one-off, closes the
  amortisation loop).
- **Revenue deduction:** San/Khoi traditional-knowledge levy = 1.5% of farm-gate.
- **NOT needed:** water/irrigation (dryland R0), electricity (R0); packaging/quality-lab live
  in the processing cost centre (2e).
- **Scenario, not a cost line:** price + yield/drought sensitivity (the master lever — margins
  are price-regime dependent; Cloudskraal's R39–55/kg forecast straddles break-even).
- Caution: harvest labour ~70% of CoP; on-farm drying labour must not be double-counted with
  the processing cost centre.

## Visualization (2h) — cost build-up node map

The operator's lens: an interactive **node map** that shows how costs add up to a
**cost-per-kg**, scoped to a single field OR aggregated to Cloudskraal's average rooibos R/kg.
(The app already ships a D3 graph for the wiki — reuse that capability; distinctive design pass.)

- **Structure (left→right DAG / layered):** leaf nodes = cost sources (specific inputs,
  activities, shared inputs, overhead categories) → group nodes = layers (Direct variable ·
  Shared inputs · Equipment+fuel · Labour · Overhead · Capital amortisation · Processing) →
  converge to **Total cost** → divide by **kg (at chosen denominator)** → **Cost / kg**, with
  the **price line** drawn alongside so margin is visible.
- **Toggle:** each layer node toggles on/off (these ARE the `include` flags:
  processing/capital/overhead/shared/activities) — watch cost/kg move live from variable-only
  to fully-loaded. Denominator toggle (harvest/dried/netto) reuses 2b.
- **Add costs:** click a node to add/edit a cost (what-if) and see it propagate to cost/kg —
  the planning tool for the instant-tea play and new spend decisions.
- **Scope toggle:** **Field** (one field's build-up) ↔ **Cloudskraal rooibos total**
  (aggregate all rooibos fields → weighted average R/kg). Farm view needs a small
  `reporting/enterprise-summary` aggregation endpoint over `computeFieldCop` per field.
- **Usability:** default to ~6–8 group nodes (materiality-ranked: labour, fertiliser/estab,
  equipment+fuel, overhead, capital, processing); minor categories roll up with drill-down.
  Graceful degradation: a layer with no data shows "enable X tracking" rather than a gap.
