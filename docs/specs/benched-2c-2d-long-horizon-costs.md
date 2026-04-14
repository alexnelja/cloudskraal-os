# Spec 2c+2d (benched) — Long-horizon costs: capital amortization + overhead allocation

- **Status:** Scope documented, full brainstorming + plan deferred. Build after 2e.
- **Depends on:** Spec 2a (cost_category tagging), Spec 2b (denominators).
- **Replaces:** Original specs 2c and 2d (merged — same "negative depreciation" pattern).

## Problem

Spec 2a's CopReport excludes `overhead` and `establishment` rows. Operator sees raw variable cost, not the real cost per kg that includes mgmt salaries, farm rates, insurance, vehicle fleet (overhead) and establishment cost amortized over productive crop life (capital).

## Scope

Two orthogonal mechanisms, one spec:

### Capital amortization

Table: `field_establishment(id, field_id, usage, planted_date, total_cost_zar, expected_productive_years, notes)`.

Example: rooibos planted 2022 at B12: R22k/ha × 21 ha = R462k establishment, expected 5 productive years → R92.4k/yr amortized.

CopReport gets a new `CopLine` slice `capital_amortized_cost` per usage. Sum into `totals.total_cost_with_capital`.

### Overhead allocation

Table: `overhead_entries(id, year, category, amount_zar, notes)` — management salaries, insurance, farm rates, fleet deprec, office, IT.

Table: `overhead_allocation_rules(id, category, method, key_params)` — method ∈ {per_ha, per_enterprise, per_revenue_share, activity_based}. `key_params` JSON for method-specific config.

Each field-year picks up its allocated slice of each overhead entry. New `CopLine.allocated_overhead_cost`.

## API

`GET /api/fields/:id/cost-of-production?year=Y&include=capital,overhead` — additive. Without `include`, behaviour is spec 2a (no regression).

`GET/POST /api/field-establishment` — CRUD.
`GET/POST /api/overhead-entries` — CRUD.
`GET/POST /api/overhead-allocation-rules` — CRUD.

## Coverage block changes

`coverage.excludes` removes `capital_amortization` and `overhead` when those are included. `coverage.allocation_methods` lists which rules were applied.

## Known hard parts (to address in full brainstorming)

- Overhead allocation by revenue share is a chicken-and-egg problem (revenue depends on cost-per-kg which depends on overhead which depends on revenue share). Solved iteratively or with a fixed-year prior-actual anchor.
- Establishment amortization for perennials that outlive their planned productive years (e.g. rooibos still producing in year 7 when we amortized over 5).
- Rip-and-replant events: prior establishment is fully written off; new cohort starts amortization anew.

## Files touched (anticipated)

New: 3 schemas, 3 seeds, 3 routes, 1 service extension (`services/cop.js` accepts `opts.include`).
Modified: CopReport type, FieldPanel Costs tab.

## Tests

TDD, same pattern as 2a/2b. Unit tests for allocation math, integration tests for the `?include=` flag.
