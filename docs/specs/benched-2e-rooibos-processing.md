# Spec 2e (benched) — Rooibos processing centre

- **Status:** Scope documented, full brainstorming + plan deferred. Build after 2b.
- **Depends on:** Specs 2a, 2b (conversion_factors).
- **Blocks:** Real cost-per-netto-dry-kg numbers (today spec 2b uses DEFAULT shrinkage; 2e gives per-batch actual).

## Problem

Spec 2b multiplies wet harvest by default 0.45 × 0.87 to estimate netto dry. Reality: every batch through the processing centre has its own wet-in and dry-out weights. Plus processing has labour + equipment + energy costs that need capture. Plus stokke (sticks) get recirculated into the next day's batch — can't be double-counted as both waste and input.

## Scope

### Tables

- `processing_batches(id, enterprise, start_date, end_date, wet_in_kg, dried_bruto_kg, sifted_netto_kg, stokke_kg, stof_kg, processing_cost_zar, notes, status, created_at, updated_at)`
- `processing_batch_sources(id, batch_id, field_id, period_id, wet_contributed_kg)` — many-to-one: which fields fed which batch
- `processing_batch_recirculations(id, batch_id, source_batch_id, stokke_reintroduced_kg)` — tracks the stokke feedback loop

Processing cost is `cost_category='processing'` `inventory_transactions` + `time_entries` associated with the batch (new nullable `batch_id` column on both).

### Service

`services/processing.js`:
- `batchYield(db, batchId)` → `{wet_in, dried_bruto, sifted_netto, stokke, stof, shrinkage_actual}` — computed from the batch row. Cross-validates wet_in ≈ dried + stokke + stof + evaporation (≤ tolerance).
- `fieldProcessingShare(db, fieldId, year)` → for each batch this field's periods contributed to, compute this field's share of the batch's processing cost AND its share of the actual sifted_netto output.

`services/cop.js` extended: when `opts.denominator='netto_dry'` and processing batches exist for the queried field-year, override the default factor with batch-actual shrinkage per period.

### API

`GET/POST /api/processing-batches` — CRUD.
`GET /api/processing-batches/:id/sources` — list source fields.
`POST /api/processing-batches/:id/sources` — attach a field contribution.
`POST /api/processing-batches/:id/recirculate` — add a stokke feedback from a prior batch.

### CopReport changes

- Direct-variable cost per line unchanged.
- NEW line type `processing_cost` when batch data exists.
- `yield_in_denominator_kg` comes from batch-actual `sifted_netto_kg` weighted by field's contribution share (NOT from default factor).
- `coverage.factors_used` replaced with `coverage.batch_actuals_used: [{batch_id, wet_in, sifted_netto, shrinkage}]`.
- `coverage.excludes` removes `processing` and `wet_to_dry_shrinkage`.

## Known hard parts

- **Stokke recirculation accounting.** A batch's wet_in includes recirculated stokke from batch N-1. That stokke's "original wet-field weight" is already accounted for in batch N-1's `wet_in`. Don't double-count the wet input, but DO let the final sifted_netto reflect the real extra yield from recirculation.
- **Attribution when batches span calendar years.** Harvest Feb, process Apr, another batch Jun. Year attribution follows the batch end_date.
- **Partial batches.** A batch running across a report boundary — use proportional allocation.
- **Byproduct revenue.** Stof is stored and may be sold later. Stokke recirculation makes it "not a byproduct" for that batch. Revenue/valuation of byproducts deferred to a sub-spec.

## Files touched (anticipated)

New: 1 schema (3 tables), 1 service, 1 route set, 4 tests.
Modified: `services/cop.js` (batch-actual fallback), `inventory_transactions` + `time_entries` (add nullable `batch_id`).

## Tests

TDD. Unit tests for shrinkage math + recirculation non-double-counting. Integration tests for the API + end-to-end `cost-per-netto-kg with batch actuals` computation.
