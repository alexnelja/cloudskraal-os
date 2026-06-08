# Spec 2f.2 — Livestock COP compute (`computeFlockCop`)

- **Status:** Designed, awaiting build. Decomposes into 3 TDD sub-slices (A→B→C).
- **Depends on:** 2f.1 (`flock_cop_inputs`, shipped), `computeFieldCop` (crop COP, shipped).
- **Research:** `docs/research/livestock-cop-inputs-2026-06.md`.

## Decisions (locked with Alex, 2026-06-08)

1. **Joint wool/meat allocation = hybrid income-share.** Shearing 100% → wool; all
   other shared cost split by each output's share of gross income, recomputed per period.
2. **Grazing allocation = explicit fraction.** Each `grazing_event` carries
   `allocation_fraction` (0–1) the user sets; fractions across concurrent grazers on
   one field should sum to ~1 (not enforced, surfaced).
3. **Internal transfer price = at cost.** Transferred grazing/feed valued at the source
   field's own COP. Net zero across the farm.
4. **Reconciliation = two-leg.** Source field COP gets an `internal_transfer` credit line;
   flock COP gets the matching cost line. Farm total nets to zero.

## Architecture

```
services/livestock_cop.js   computeFlockCop(db, groupId, year, opts) → FlockCopReport
services/internal_transfers.js   shared helper:
    transfersForFlock(db, groupId, year)  → [{source_field_id, kind, amount, ...}]  (costs IN)
    transfersForField(db, fieldId, year)  → [{flock_id, kind, amount, ...}]         (credits OUT)
routes/livestock.js  + grazing-events & feeding-events CRUD, GET /flocks/:id/cost-of-production
services/cop.js  computeFieldCop gains an additive `internal_transfers` credit line
```

Both COP services read the same two transfer tables through `internal_transfers.js`, so
the two legs are computed from one source of truth and always reconcile.

### No recursion (critical)

The transfer amount is **at cost** = the source field's *gross* COP × fraction. The
field's credit line is built from that same amount — a naive design recurses
(`computeFieldCop → transfersForField → computeFieldCop …`). Broken by an opt flag:

- `computeFieldCop(db, fieldId, year, opts)` — default **does NOT** compute transfers
  (current behaviour, regression-safe). Returns *gross* COP.
- It computes the `internal_transfers` line **only** when `opts.withTransfers === true`.
- `transfersForField` / `transfersForFlock` always call `computeFieldCop` with
  `withTransfers:false` (gross) to value transfers — so the helper never re-enters the
  transfers path. One-level deep, no cycle.
- Both legs (field credit, flock cost) are valued by the **same helper**, so they are
  always equal and net to zero — including failure cases (both legs see 0).

## Sub-slice A — basic `computeFlockCop`

`computeFlockCop(db, groupId, year)`:
- Reads the `flock_cop_inputs` row for (groupId, year) + `livestock_groups.head_count`.
  No row → `null`.
- **Costs:** `feed_cost + labour_cost + animal_health_cost + shearing_cost + other_direct_cost`
  = `total_direct_cost`.
- **Income split (computed once per year** from annual `wool_income`/`meat_income`; the
  single `wool_share` ratio is applied to all costs and all in-year transfers — there is no
  per-event re-allocation in 2f.2): `wool_share = wool_income / (wool_income + meat_income)`.
  Both zero/null → `wool_share = null`, warning `no_income_cannot_split`, allocation skipped.
- **Hybrid allocation** (shared pool = `total_direct_cost − shearing_cost`):
  - `wool_allocated  = shearing_cost + wool_share × shared_pool`
  - `meat_allocated  = (1 − wool_share) × shared_pool`
- **Denominators:**
  - `clean_wool_kg = greasy_fleece_kg_per_head × head_count × clean_yield_pct/100`
    (any factor missing → null + `wool_denominator_incomplete`)
  - `liveweight_sold_kg_total` (null/0 → meat COP null + `no_liveweight_sold`)
- **Outputs:**
  - `cost_per_kg_wool = wool_allocated / clean_wool_kg`
  - `cost_per_kg_liveweight = meat_allocated / liveweight_sold_kg_total`
  - `gross_margin = (wool_income + meat_income) − total_cost_incl_transfers`
  - `gross_margin_per_ewe = gross_margin / ewes_mated` (null if no `ewes_mated`)
- All rand values `round2`; percentages as percentages.

Returns `FlockCopReport { group_id, year, head_count, source, costs{…},
income{wool, meat, wool_share}, allocation{wool, meat}, denominators{clean_wool_kg,
liveweight_sold_kg}, cost_per_kg_wool, cost_per_kg_liveweight, transfers_in[],
gross_margin, gross_margin_per_ewe, warnings[] }`.

## Sub-slice B — `grazing_events` + grazing-share

**Table `grazing_events`:**
```
id, group_id → livestock_groups(id) ON DELETE CASCADE,
field_id → fields(id),
start_date, end_date,
allocation_fraction REAL,          -- 0..1, user-set
notes, created_at, updated_at
```
**Logic (in `internal_transfers.js`):** for each grazing event of the flock whose
[start,end] overlaps `year`:
```
fieldCop = computeFieldCop(db, field_id, year, { withTransfers: false })  // gross
if (!fieldCop || fieldCop.error) → grazing_share = 0, warning naming field (see table)
else → grazing_share = fieldCop.totals.total_cost × allocation_fraction × year_overlap_factor
```
This is the **at-cost** transfer amount. `year_overlap_factor` pro-rates events that
straddle a year boundary: `days_of_event_within_year / total_event_days` (1.0 for events
fully inside the year). Pro-rating keeps both legs symmetric across years.
- **Flock leg (IN):** grazing-share enters the flock's **shared pool** (it feeds both
  wool & meat animals) → split by income share. Surfaced in `transfers_in[]` with
  `kind='grazing'`.
- **Field leg (OUT):** `computeFieldCop` gains an additive line
  `internal_transfers: { credit_total, items:[{flock_id, kind, amount}] }` — a credit
  that reduces the field's net cost. Existing line/total fields unchanged; new field only.
- Missing field COP / zero allocation_fraction → contributes 0 + warning.

**API:** `GET/POST /api/livestock/grazing-events` (+ `?group_id=`, `?field_id=`),
`PATCH/DELETE /api/livestock/grazing-events/:id`.

## Sub-slice C — `feeding_events` + transfer pricing (harvested feed)

**Table `feeding_events`:**
```
id, group_id → livestock_groups(id) ON DELETE CASCADE,
date,
source_type TEXT,                  -- 'purchased' | 'internal'
source_field_id → fields(id),      -- internal only
source_usage TEXT,                 -- internal only: which field COP line (e.g. 'lupines')
product TEXT, quantity_kg REAL,
unit_cost_zar REAL,                -- purchased: R/kg paid
notes, created_at, updated_at
```
**Logic:**
- **Purchased:** `cost = quantity_kg × unit_cost_zar`. Flock shared-pool cost. No field leg.
- **Internal (at cost):** `cost = quantity_kg × sourceFieldCostPerKg`. Resolve
  `sourceFieldCostPerKg` from `computeFieldCop(db, source_field_id, year, {withTransfers:false})`:
  - pick the `lines[]` entry whose `usage === source_usage` → its `cost_per_kg`;
  - if no matching line (or `source_usage` null) → fall back to field-level
    `totals.total_cost / totals.total_yield_kg`, warning `feed_product_line_ambiguous`;
  - if that field line's `cost_per_kg` is null (no yield) → cost 0, warning `internal_feed_uncosted`.
  Two-leg: flock cost IN (`kind='feed_internal'`), field credit OUT (same amount).
- Field COP `null`/`error` → cost 0 + warning (`source_field_not_found` / `source_field_cop_error`).
- Internal feed enters the flock shared pool (split by income share), same as grazing.

**API:** `GET/POST /api/livestock/feeding-events` (+ filters), `PATCH/DELETE …/:id`.

## `computeFieldCop` change (additive, opt-in, non-breaking)

Only when called with `opts.withTransfers === true` (default false → current behaviour,
all existing callers and numbers unchanged). When on, after computing `lines`/`totals`:
```js
const transfers = transfersForField(db, fieldId, year);  // calls gross computeFieldCop internally
return {
  field_id, year, field,
  lines: [...],                       // unchanged
  totals: {
    total_cost, total_yield_kg, uncategorized_cost,   // unchanged
    net_cost_after_transfers,         // NEW, inside totals = total_cost − credit_total
  },
  internal_transfers: {               // NEW, top-level sibling of totals
    credit_total,                     // Σ amounts transferred OUT of this field this year
    items: [{ flock_id, kind, amount }],
  },
  rotation, coverage,
};
```
With no transfers: `credit_total: 0`, `items: []`, `net_cost_after_transfers === total_cost`.

## Allocation ordering (precise)

**Feed source rule (avoids double-count):** itemised `feeding_events` are authoritative;
the annual bucket is a fallback.
```
purchased_feed_total = Σ feeding_events(source_type='purchased') for flock/year
effective_supplementary_feed =
    (any purchased feeding_events exist for flock/year)
      ? purchased_feed_total              // itemised wins
      : flock_cop_inputs.feed_cost        // fallback to annual bucket
  → when the bucket is overridden, emit warning `feed_bucket_overridden_by_events`
```
Internal feed + grazing transfers are always additive (they are not in the bucket).
```
shared_pool = effective_supplementary_feed
            + labour_cost + animal_health_cost + other_direct_cost   [flock_cop_inputs]
            + grazing_share_total + internal_feed_total
            (shearing handled separately, 100% → wool)
wool_allocated = shearing_cost + wool_share × shared_pool
meat_allocated = (1 − wool_share) × shared_pool
total_cost_incl_transfers = shearing_cost + shared_pool
```

## Graceful degradation (per honest-proxy preference)

| Condition | Behaviour |
|---|---|
| No `flock_cop_inputs` row | `computeFlockCop` → null |
| `wool_income + meat_income = 0` | no split; `wool_share=null`; warning `no_income_cannot_split` |
| missing greasy/head, yield, or head_count | `cost_per_kg_wool=null`; warning `wool_denominator_incomplete` |
| `liveweight_sold_kg_total` null/0 | `cost_per_kg_liveweight=null`; warning `no_liveweight_sold` |
| source field row missing (`computeFieldCop` → null) | transfer = 0; warning `source_field_not_found` (with field_id) |
| source field COP error (factor chain unreachable → `{error}`) | transfer = 0; warning `source_field_cop_error` (with field_id) |
| internal feed: `source_usage` has no matching line | fall back to field total cost/yield; warning `feed_product_line_ambiguous` |
| internal feed: matched line `cost_per_kg` null (no yield) | transfer = 0; warning `internal_feed_uncosted` |
| no `ewes_mated` | `gross_margin_per_ewe=null` |

Warning **codes** are the stable contract (tests + API key on them); human-readable
message text lives in the UI layer, not the service.

## Files

New: `services/livestock_cop.js`, `services/internal_transfers.js`,
`db/schema-grazing-events.js`, `db/schema-feeding-events.js` (+ wired in `schema.js`).
Modified: `routes/livestock.js` (+2 CRUD sets + COP endpoint), `services/cop.js`
(additive transfers line).

## Tests (TDD, in-memory unit + API integration)

- A: allocation math (hybrid split), denominators, every degradation row, round2.
- B: grazing-share = field COP × fraction; two-leg reconciliation nets zero; multi-event.
- C: purchased vs internal-at-cost; internal two-leg credit; uncosted-source warning.
- `computeFieldCop`: transfers credit line appears only when transfers exist; existing
  numbers unchanged (regression guard).
- API: CRUD + validation for grazing-events, feeding-events; `GET /flocks/:id/cost-of-production`.

## Deferred (not in 2f.2)

Mortality streams / weaned-kg denominator; stocking-density auto allocation; at-market
transfer pricing; cross-enterprise (sheep in vineyards); concurrent-fraction-sums-to-1
enforcement.
