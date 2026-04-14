# Spec 2f (benched) — Livestock COP (sheep)

- **Status:** Scope documented, full brainstorming + plan deferred.
- **Depends on:** Specs 2a, 2b. Independent of 2e (rooibos processing).
- **Existing assets:** `livestock_groups`, `livestock_records`, `breeding_seasons`, `shearing_records` tables (schema-phase2).

## Problem

Sheep don't live on one field. A flock moves across grazing camps, eats a mix of purchased feed + own-grown (lupines/oats). Cost-per-kg of liveweight or kg of wool can't use the field-COP model — it's flock-level. Plus internal transfer pricing: when lupines hay from our own field feeds our sheep, what's the cost basis?

## Scope

### Tables

- `flock_periods(id, flock_id, start_date, end_date, animal_count, avg_weight_kg, notes)` — snapshot series.
- `feeding_events(id, date, flock_id, product_id, quantity_kg, source_type, source_field_id, internal_transfer_price_zar, notes)` — `source_type` ∈ {purchased, internal}. For internal, records the cost basis.
- `grazing_events(id, start_date, end_date, flock_id, field_id, field_usage_period_id, allocation_fraction)` — multi-camp rotation. `allocation_fraction` sums to 1 across concurrent events.
- `wool_harvests(id, shearing_record_id, flock_id, greasy_kg, scoured_kg_estimated, clean_kg_estimated, date)` — wool is a second output, different denominator.

### Internal transfer pricing rule

When lupines hay leaves a field and enters a sheep feeding event, BOTH sides must reconcile:
- The field's COP gets a **revenue line** = internal_transfer_price × kg transferred (cost_category='internal_transfer').
- The sheep COP gets a **cost line** = same amount.

Net across the farm is zero (it's an internal transfer). Reporting layer is where the user sees "lupines field profit" vs "sheep field profit with feed cost".

### Service

`services/livestock_cop.js`:
- `computeFlockCop(db, flockId, year, opts)` → FlockCopReport:
  - `feeding_cost` (purchased + internal-valued)
  - `grazing_share_cost` (allocated field-variable-COP slice per grazing event)
  - `vet_cost`, `medicine_cost`, `shearing_cost`
  - `kg_liveweight_produced`, `kg_carcass_produced`, `kg_wool_greasy_produced`
  - `cost_per_kg_liveweight`, `cost_per_kg_wool_greasy`
- Uses existing `conversion_factors` for wool scour/clean estimates.

### API

`GET /api/flocks/:id/cost-of-production?year=Y[&denominator=carcass|clean_wool]`
`GET/POST /api/feeding-events`
`GET/POST /api/grazing-events`
`GET/POST /api/wool-harvests`

Internal-transfer reconciliation: a background helper runs after feeding-event writes to ensure both legs exist (source field gets a revenue line, flock gets a cost line).

## Known hard parts

- **Mortality adjustment.** 5% lamb loss between birth and weaning. COP denominator should be weaned-kg, not born-kg. Requires a `flock_events(id, type='death'|'sale'|'birth', ...)` stream.
- **Grazing allocation.** 500 sheep on a 50 ha lupines field for 30 days — what fraction of the lupines field's COP attaches? Proportional by grazing-days × stocking density, with a floor for minimum impact.
- **Feed transfer pricing policy.** At-cost? At-market? Operator-configurable? Defer to a `farm_config` setting.
- **Multi-enterprise integration with wine/crops.** Sheep eating cover crops in vineyards is a legitimate cross-enterprise event.

## Files touched (anticipated)

New: 4 tables, 1 service, 4 route sets, 5+ tests.
Modified: Reporting UI (spec 2h) consumes the new report shape.

## Tests

Flock-level integration tests with multi-source feed, multi-field grazing, wool + meat denominator paths.
