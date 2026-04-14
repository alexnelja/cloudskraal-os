# Spec 2g (benched) — Wine COP

- **Status:** Scope documented, full brainstorming + plan deferred.
- **Depends on:** Specs 2a, 2b. Independent of 2e, 2f.
- **Context:** Cloudskraal has vineyards (wine grapes). Future Meulsteenvlei acquisition may add cellar ops. Spec 2g covers both the vineyard side (field-COP-like) and the cellar side (processing-like).

## Problem

Vineyard = a field, so spec 2a handles variable cost per hectare. But wine has:
- A cellar cost centre (press, ferment, age, bottle) completely separate from the field.
- Two conversion hops: `grape_kg → wine_litres → bottle_750ml` with operator-configurable factors.
- **Time as a cost:** maturation in barrels for 12-36 months. That's capital tied up plus barrel-slot occupancy plus energy.
- Vintages. A 2024 vintage bottled in 2027 has costs from 2024 (harvest) + 2025-27 (aging).

## Scope

### Tables

- `cellar_batches(id, vintage_year, varietal, source_field_ids_json, grape_kg_pressed, juice_litres, wine_litres_racked, bottle_count, maturation_start, maturation_end, cellar_costs_zar, notes, status)`
- `barrel_occupancy(id, batch_id, barrel_id, start_date, end_date, cost_zar)` — barrel rent + time-based carrying cost
- `cellar_cost_categories`: extend the existing `cost_category` enum? Or use a cellar-scoped `subcategory`? Decide in brainstorming.

### Service

`services/wine_cop.js`:
- `computeWineCop(db, vintageYear, opts)` → full vintage lifecycle COP:
  - Vineyard variable cost (from spec 2a, scoped to wine fields)
  - Vineyard capital amortization (from spec 2c+2d when available)
  - Cellar processing cost
  - Barrel maturation cost (time-weighted)
  - Total cost per bottle
- Uses `conversion_factors` seeded with wine defaults (`grape_kg → wine_litres = 0.72`, `wine_litres → bottle_750ml = 1.333`).

### API

`GET /api/wine/vintages` — list, with bottle counts and cost rollups.
`GET /api/wine/vintages/:year/cop` — full COP report.
`GET/POST /api/cellar-batches`
`GET/POST /api/barrel-occupancy`

### CopReport extension

Wine's CopReport is different enough that it gets its own shape `WineVintageReport`:
```
{
  vintage_year, varietal, bottles,
  vineyard: { fields: [...], variable_cost, capital_cost },
  cellar: { grape_kg, wine_l, cellar_cost, barrel_cost, maturation_months },
  totals: { cost_per_bottle, cost_per_litre },
  coverage: {...}
}
```

## Known hard parts

- **Vintage attribution.** Grapes picked in 2024, fermented in 2024-Q4, aged through 2026, bottled in 2027. Is the "vintage" cost report booked in 2024 (harvest year) or 2027 (sale year)? Convention decision, not technical.
- **Blending.** Some wines blend multiple vintages or multiple field sources. `source_field_ids_json` handles many fields per batch, but blending across vintages needs a parent/child batch model.
- **Bottle breakage and loss during aging.** Small % but not zero; add explicit shrinkage.
- **Reserve stock vs. sale stock.** Not every bottle sells; dead stock distorts cost-per-sold-bottle.

## Files touched (anticipated)

New: 2 tables, 1 service, 4 route sets, 4+ tests.
Modified: Seed `conversion_factors` with wine rows. Reporting UI (spec 2h) renders the distinct report shape.

## Tests

Full-vintage simulation test: seed a 2024 grape harvest → fermentation → 24-month aging → 2027 bottle. Verify total cost per bottle matches hand calculation.
