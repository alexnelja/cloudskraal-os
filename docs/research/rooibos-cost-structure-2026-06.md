# Rooibos cost-of-production structure — completeness study (June 2026)

Feeds Spec 2i (activity-based field costing) + the cost build-up node map (2h).
Anchor: **Elsenburg/WCDoA Rooibos Cederberg enterprise budget, Yr1–6, updated
27 May 2024** (1 ha, conventional dryland). Triangulated with WCDoA Overberg study
(2020), SA Rooibos Council, Farmer's Weekly. Builds on existing
`elsenburg-enterprise-research.md` (which had yields/prices, not the cost stack).

## Headlines
- **Labour is ~70%+ of cost of production** (harvest + drying + weeding). Everything
  else is small. The manual-vs-chemical weed-control choice is the biggest annual lever
  after harvest labour.
- **Cost/kg is dominated by where you are in the cycle** (yield curve 0→150→600→500→300→150
  kg/ha over Yr1–6). Year 6 looks dreadful (~R70/kg) only because yield collapsed pre-replant.
- **Margins are price-regime dependent.** Farm-gate swung R67(2018)→R14–25(2024-25). At
  R45/kg rooibos is healthy; at ~R21/kg it loses money on full cost. Cloudskraal's forecast
  (R39–55, 2026-30) straddles break-even → **price is the master sensitivity, model it.**
- The official budgets are strong on direct field + harvest cost but **deliberately omit**
  land, insurance, certification, management, fixed-improvement depreciation — the same gaps
  we suspected.

## Benchmark spine (Elsenburg Cederberg, R/ha, 2024)
| | Yr1 estab | Yr2 | Yr3 | Yr4 | Yr5 | Yr6 |
|---|---|---|---|---|---|---|
| Yield kg/ha | 0 | 150 | 600 | 500 | 300 | 150 |
| Total variable cost | 31,650 | 8,141 | 19,294 | 16,931 | 14,003 | 10,528 |
| CoP R/kg | – | 54 | 32 | 34 | 47 | 70 |
- Establishment **R31,650/ha** (fertiliser/soil 58% — chicken manure R12,900 dominates;
  prep+planting labour 26%; interest 12%; oats cover crop R1,350; fuel; seedlings R920).
- Mature year (Yr4): labour 72%, interest 11%, fuel 8%, pesticide 4%, R&M 4%, herbicide 1%,
  **fertiliser ~R0** (established dryland rooibos barely fertilised).
- Lifetime yield ~1,500–1,800 kg/ha → establishment amortises to **~R18–21/kg**.

## Cost taxonomy — every category, materiality, and which model mechanism carries it

✅ = already modelled · ➕ = add (material) · ◦ = minor → fold into overhead · ✗ = not needed

| Category | Materiality | Mechanism in our model |
|---|---|---|
| Harvest/drying/weeding **labour** | **dominant (~70%)** | ✅ time_entries / activities (2i.3) |
| **Fertiliser/soil correction** (estab. big; mature ~0) | **material (estab.)** | ✅ per-field input + ➕ shared input (2i.1) |
| Herbicide / pesticide | minor–material | ✅ per-field / shared input |
| **Equipment** (depreciation + fuel + R&M) | material | ✅ equipment + ➕ rates (2i.2) |
| **Fuel** | material (8%) | ✅ activities (2i.3) |
| **Interest — working capital** | material (~11%) | ➕ add (financing) |
| **Interest — establishment/land loan** | material | ➕ add (separate from WC interest) |
| **Establishment** (amortised over cycle) | material | ✅ field_establishment (2c) + ➕ accrue activities (2i.4) |
| Cover crop (lupines/oats) | material (estab.) | ✅ input / activity |
| **End-of-cycle rip-out / replant** | material (one-off) | ➕ discrete node, closes amortisation loop |
| **Land cost / rental / opportunity** (~R90k/ha land) | **material, biggest omission** | ➕ overhead (2d) — toggle owned vs rented/imputed |
| **Fixed-improvement depreciation** (drying court, sheds, fences, roads) | material | ➕ extend depreciation beyond equipment |
| **Management / owner salary / admin** | material (5–10% turnover) | ➕ overhead (2d) |
| **Insurance** (fire/asset/liability) | material (undisclosed in sources) | ➕ overhead (2d), placeholder; fire = key peril |
| **Firebreaks + FPA membership** | material-ish (Cederberg, mandatory) | ➕ field activity (recurring) + small fee |
| Transport to processor | minor in Cederberg (~40km), material if cartage paid | ➕ explicit activity node (split from fuel) |
| **San/Khoi traditional-knowledge levy = 1.5% of farm-gate** | minor but rooibos-specific | ➕ a %-of-revenue deduction |
| Certification (organic/Fairtrade/UEBT) + audit | material IF certified (mostly via labour multiplier) | ➕ overhead (fixed/farm) + organic weed-labour swing |
| Quality testing / lab | minor | ✅ processing cost centre |
| Marketing / offtaker commission | minor at farm gate (R0 unless deducted) | ◦ %-deduction if applies |
| Packaging | minor (downstream) | ✅ processing cost centre |
| Vehicle/bakkie, professional fees, security, telecoms, road maint. | minor | ◦ overhead (2d) |
| **Water / irrigation** | **negligible — dryland, R0 every year** | ✗ |
| Electricity | minor (no irrigation) | ✗ / overhead |
| Contingency / drought / fire / price risk | **conceptually dominant** | ➕ **scenario/sensitivity, NOT a cost line** |

## Cross-double-count warnings
- **On-farm drying/cutting labour** sits in the field budget's casual-labour line, but
  Cloudskraal also has a **separate processing cost centre** (2e) — assign tea-court drying
  to one place only or cost/kg is overstated. (Same family as the 2f feed-bucket rule.)
- Activity labour/inputs vs `time_entries`/`inventory_transactions` — one-place rule (2i).

## MISSING-FROM-MODEL, ranked (to add)
1. Land cost / opportunity (toggle owned vs imputed) — biggest omission.
2. Fixed-improvement depreciation (structures, not just equipment).
3. Management / owner salary / admin.
4. Insurance (fire/asset).
5. Establishment/land-loan interest (have working-capital interest only).
6. End-of-cycle rip-out / replant node.
7. Firebreak labour + FPA fee (Cederberg-mandatory).
8. San/Khoi 1.5%-of-farm-gate levy.
9. Certification + the organic manual-weeding labour multiplier (~R5k vs R0.7k/ha).
10. Explicit transport-to-processor node.
Scenario (not a line): price + yield/drought sensitivity grid (Elsenburg yield×price matrix).

## Usability balance
Most additions (land, management, insurance, fixed-improvement deprec., professional fees,
levy) are **farm-wide → handled by ONE mechanism: overhead allocation (2d)** with a method
per category. So the *model* gains ~6 overhead categories + 2–3 field-level nodes (firebreak,
transport, rip-out) — not 20 new tables. The node map should show the big nodes
(labour, fertiliser/estab, equipment+fuel, overhead, capital, processing) and let minor ones
roll up, with drill-down — keep the default view to ~6–8 nodes for usability.

## Sources
Elsenburg Rooibos Cederberg Yr1–6 (2024); WCDoA "Rooibos Tea: story of the Overberg" (2020);
SA Rooibos Council 2020 info sheet; Farmer's Weekly (price collapse); The Conversation (1.5%
levy, 2025); Greater Cederberg FPA; EU Reg 2021/865 (GI/PDO). Figures dated inline.
