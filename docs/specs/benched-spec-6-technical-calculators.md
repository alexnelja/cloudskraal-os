# Spec 6 (benched) — Technical calculators

- **Status:** Scope documented, full brainstorming + plan deferred.
- **Depends on:** `input_products` catalogue for dose-to-cost conversions; spec 2a for tagging calc results into COP if user chooses to "post" a calc.
- **Blocks:** Field-side practical workflows (sprayer setup, pump sizing, lime applications) — operator currently uses paper notes / Excel.

## Problem

Daily decisions on the farm need quick math: nozzle flow rate × travel speed → spray rate; pH delta × CEC → lime t/ha; pump head loss in 110 mm PVC over 800 m; pesticide dose for a 6.4 ha block at label rate. Operator does this on a phone calculator with formula sheets in a dusty binder. Errors compound; no record kept.

## Scope

### Calculators (each one a small focused component)

| Calculator | Key inputs | Output | Cost link |
|---|---|---|---|
| **Electrical load (pump sizing)** | flow rate, head, efficiency, pump type | kW required, recommended motor size | links to electricity-cost service |
| **Fluid flow (pipe sizing)** | flow, length, diameter, fluid, target headloss | head loss, recommended pipe class | — |
| **Sprayer calibration** | nozzle output (L/min), boom width, travel speed | L/ha, total tank fills for a block | links to chemical cost via input_products |
| **Pest dose** | label rate (mL/100 L or g/ha), area | total chemical, total water, total cost | yes |
| **Fertilizer rate** | target rate (kg/ha), product analysis (N-P-K), area | kg of product, cost | yes |
| **Lime requirement** | current pH, target pH, CEC, area, soil texture | t lime / ha, total tonnes, cost | yes |

### Tables

- None required initially — pure stateless calculation.
- Optional `calculator_presets(id, type, name, inputs_json, created_by, created_at)` for reusable farm-specific configs (e.g. "Block 7 standard spray setup").

### Service

`services/calculators/` directory with one module per calculator. Each module exports `compute(inputs)` returning `{result, warnings, breakdown}`. Pure functions; testable in isolation.

### API

Optional: `POST /api/calculators/:type` for server-side calc when the inputs reference DB data (input_products, electricity tariffs). Most calcs run client-side; only tariff/price-aware ones need the server.

### UX

A `/calculators` route with a tile per calc. Each calc has shareable URL with inputs in the query string for quick "send to colleague" workflows. Result cards offer "save as preset" and "create task using this dose."

## Known hard parts

- **Unit validation.** Mixing L/min with m³/h, kg/ha with g/m². Need a unit-aware input library or strict per-field validators with locked units displayed prominently.
- **Sane-range warnings.** A pH-correction calc returning 18 t/ha lime should warn; an electrical calc demanding 250 kW from a 22 kW pump should warn. Each calc declares its own sanity envelope.
- **Dose-to-cost lookup.** Pesticide name on the label rarely matches the `input_products.name` exactly — needs fuzzy match or explicit linkage on the input product.
- **Persistence vs ephemerality.** Most calcs are throwaway. Presets cover the recurring cases. Don't over-engineer history.

## Files touched (anticipated)

- New: `backend/src/services/calculators/{electrical,fluid,sprayer,pest,fertilizer,lime}.js`, `backend/src/routes/calculators.js`, integration tests per calc.
- New: `frontend/src/routes/calculators/`, one component per calc, shared input primitives.

## Tests

TDD. Unit tests for each calc against textbook examples + sanity-envelope edge cases. Snapshot tests for result cards. Optional E2E for "save preset → reload → result identical."

## Build order

Sprayer calibration (highest daily value) → pest dose (hooks into chemicals catalogue) → fertilizer rate → lime requirement (most domain-research) → electrical load → fluid flow.
