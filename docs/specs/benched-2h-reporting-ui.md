# Spec 2h (benched) — Reporting UI

- **Status:** Scope documented, full brainstorming + plan deferred.
- **Depends on:** 2a, 2b, and whichever of 2c+2d/2e/2f/2g are in scope when we build. The UI assembles what the backend can produce.
- **Position:** Last spec in the COP chain. Everything before ships data; this ships the operator's lens on it.

## Problem

Backend COP reports exist but are raw JSON. Operator needs a page that makes the story obvious: per-enterprise kg-cost, forecast vs actual, drill-down from "total cost" down to "which bag of fertilizer contributed R450 of this R60/kg." Spec 2h is the one place where the model stops being abstract and becomes a decision tool.

## Scope

### Pages

1. **Enterprise comparison** — `/reporting/enterprises`: one row per enterprise (rooibos, lupines, oats, sheep, wine). Columns: kg produced, cost/kg (variable), cost/kg (fully-loaded), market price, margin. Sortable. Click-through to enterprise detail.

2. **Enterprise detail** — `/reporting/enterprises/:id`: cost waterfall (variable → +overhead → +capital → +processing → final kg-cost). Forecast vs actual overlay. Year selector. Denominator toggle.

3. **Field cost drill-down** — enhancement to existing `/field/:id` panel: already has CopReport lines (spec 2a). Add filterable breakdown by cost_category.

4. **Data-quality dashboard widget** — surface spec 2a's `uncategorized_cost` and spec 2b's `factor_missing` errors across the whole farm so the operator can triage.

### Component library

- `<CostWaterfall />` — horizontal bar sequence, each segment = a layer
- `<ComparisonTable />` — enterprise rows with sparkline margin column
- `<DenominatorToggle />` — tier buttons (Harvest / Dried / Netto dry / Sellable)
- `<CoverageBadge />` — chip showing what's excluded (reuse spec 2a's `coverage` block)

### API additions

Most needed data exists. New summary endpoints to avoid chatty queries:
- `GET /api/reporting/enterprise-summary?year=Y` — one row per enterprise, all rollups in one call.
- `GET /api/reporting/data-quality?year=Y` — farm-wide health counters.

## Known hard parts

- **Waterfall needs ALL layers to exist.** If spec 2e isn't built yet, the waterfall shows "processing: unknown" — must gracefully degrade with a link to "enable processing-batch tracking to see this".
- **Forecast vs actual** requires forecast data (market prices in `enterprise_prices`, yield forecasts somewhere). Yield forecasts not yet modelled — separate spec.
- **Multi-field enterprise rollup** with periods that span year boundaries — reuse `periodsOverlappingYear` + proportional weighting.
- **Performance.** Enterprise-summary may scan every field × every year. Cache, paginate, or accept the cost (farm is <200 fields).

## Files touched (anticipated)

New: 2 reporting routes, 3-4 page components, 4-6 chart/table components, integration tests.
Modified: Dashboard gets a "data quality" section consuming the new endpoint.

## Tests

End-to-end: seed a 3-enterprise farm with partial data coverage (rooibos has processing batches, sheep doesn't yet, wine fields exist but no cellar data) and verify the reporting pages render the graceful-degradation states correctly.
