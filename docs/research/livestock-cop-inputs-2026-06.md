# Livestock COP — highest-signal inputs (research, June 2026)

Research feeding the Spec 2f (Livestock COP) data-model design. SA dual-purpose
Merino/Dohne Merino sheep enterprise (wool + meat). Anchor source: **Land Bank
"Extensive Dual Sheep — Merino" 2024/25 Enterprise Budget** (625-ewe wool+meat
flock, near-identical to Cloudskraal). Triangulated with Elsenburg WC Dohne
budget, Cape Wools SA, UFS, AWI methodology, Absa/RPO prices. Figures 2023–2026.

## 1. Cost categories by share of total variable cost (extensive SA sheep)

| Rank | Category | Land Bank R/ewe/yr | % of variable cost | SA range |
|---|---|---|---|---|
| 1 | **Supplementary feed / licks** | ~R250 | **35–45%** (>50% dry years) | 30–55% |
| 2 | **Labour** | ~R174 | **25–30%** | 15–30% |
| 3 | **Animal health** (vaccine/dose/dip/vet) | ~R170 | **22–26%** | 10–20% |
| 4 | Fuel / transport | ~R84 | ~12% | 5–12% |
| 5 | Vermin / predator control | ~R45 | ~6% | 3–10% (high in WC) |
| 6 | Repairs & maintenance | ~R19 | ~3% | 3–8% |
| 7 | Flock replacement (rams + ewes) | ~R23 | ~3% | 3–8% |
| 8 | Shearing + wool packaging | ~R7+ | 1–4% | 3–6% if contracted separately |
| 9 | Marketing / consumables | ~R2 | <1% | 1–4% |

**80% rule: Feed + Labour + Animal Health ≈ 80–90% of variable cost.** Capture
those three accurately + Shearing as a fourth → bulk of COP signal.
Caveat: Land Bank health line is high (Pasteurella vaccine R112/ewe alone) and
shearing is bundled into labour; at Cloudskraal shearing is likely contracted
(~R12–20/sheep) and should be its own field.

## 2. Production drivers (denominators) — Dohne/Merino benchmarks

| Parameter | Unit | Land Bank | Dohne benchmark | Notes |
|---|---|---|---|---|
| Weaning % | % | 80% (conservative) | **120–140%** | ⚑ HIGH leverage — make required, no default |
| Ewe/flock mortality | % | 1–2% | 2–6% (lamb 10–20%) | |
| Greasy fleece / head | kg greasy | (clean 5.6) | **5–6 kg greasy** | ⚑ store greasy, not clean |
| Clean yield % | % | — | **62–72%** Merino/Dohne | ⚑ derive clean = greasy × yield |
| Micron | µm | 18 | **18–21** Dohne | |
| Ewe liveweight | kg | 55–60 | **55–65** mature Dohne | |
| Stocking rate | ha/SSU | — | WC veld **4–8 ha/SSU** | SSU = 1 ewe+lamb |
| Replacement rate | % | 20% | 15–25% | |
| Dressing % | % | 46% | 44–50% | liveweight→carcass |

Two highest-leverage + most-volatile inputs: **weaning %** and **wool price** —
require/live-fetch, never silently default. Most common modeling error: conflating
greasy and clean wool — store **both** greasy kg + clean yield %, derive clean.

## 3. Joint-cost allocation (wool vs meat)

Consensus method (AWI, SA practice): **split shared costs by each output's share
of gross income**, recomputed each period (price-sensitive).
- Land Bank Dual Merino: wool income R1,590/ewe, meat R1,435/ewe → **≈53% wool /
  47% meat**.
- Hybrid (recommended): shearing/packaging 100% → wool; creep/weaner feed 100% →
  meat; everything else (ewe feed, labour, health, overhead) split by income share.
- `cost_per_kg_wool = (wool_direct + wool_share×shared) / clean_wool_kg`
- `cost_per_kg_liveweight = (meat_direct + (1−wool_share)×shared) / liveweight_sold_kg`

## 4. Benchmark unit economics (state year)

- Total variable cost ~**R660/ewe/yr** (Land Bank 2024/25); feed ~R250/ewe.
- Gross income ~R3,025/ewe (wool R1,590 + meat R1,435); GM ~R2,361/ewe (variable-cost basis).
- **Wool price (Cape Wools Sale 33, 2025/26):** SA Merino ~**R270/kg clean**; by micron
  18µm ~R301, 19µm ~R281, 20µm ~R267, 21µm ~R261 (R/kg clean). Volatile (was ~R194
  Oct-2025) — pull live, don't hard-code. Greasy ≈ clean × yield.
- **Meat (Absa/RPO, May 2026):** mutton A2/3 **R108.67/kg carcass**; weaner ~R70.50/kg
  live (Land Bank 2024/25); cull ewe ~R54.68/kg live.

## 5. Minimal input field set (one record per flock per period)

**Identity:** period_start, period_end, flock_id, flock_class, ewes_mated, hectares_grazed
**Production drivers (required):** weaning_pct ⚑, ewe_mortality_pct, lamb_mortality_pct,
greasy_fleece_kg_per_head ⚑, clean_yield_pct ⚑, micron, liveweight_sold_kg_total,
avg_ewe_liveweight_kg, dressing_pct
**Costs (R/period; 3 big buckets mandatory):** feed_cost ⚑, labour_cost ⚑,
animal_health_cost ⚑, shearing_cost (→wool), replacement_cost, other_direct_cost
(fuel/vermin/repairs/marketing catch-all), overhead_cost (optional)
**Income (drives allocation):** wool_income, meat_income, wool_price_R_per_kg_clean,
meat_price_R_per_kg (+ meat_price_basis enum live|carcass)

**Bone-minimum (~10 fields):** ewes_mated, weaning_pct, greasy_fleece_kg_per_head,
clean_yield_pct, liveweight_sold_kg_total, feed_cost, labour_cost,
animal_health_cost, wool_income, meat_income.

**Derived:** clean_wool_kg = greasy×head×yield; income_split_wool =
wool_income/(wool+meat); cost_per_kg_wool; cost_per_kg_liveweight;
gross_margin_per_ewe / per_ha / per_LSU.

## Cautions
1. Greasy vs clean wool — store both, derive, never conflate.
2. Weaning % & wool price — highest leverage + most volatile → required/live.
3. Shearing — keep separate from labour for clean wool-COP allocation.
4. Elsenburg WC Dohne PDF is the most breed+region-exact source; not text-extracted
   this pass — OCR later to validate defaults.

## Sources
- Land Bank Livestock Enterprise Budget V2 (2024/25)
- Elsenburg/WC Dept Agric — Dohne Merino budget (2024)
- Cape Wools SA market report (Sale 33, 2025/26)
- UFS — Economic analysis of intensive sheep production systems (central SA)
- AWI/MLA "Making More From Sheep" COP calculator guide
- Absa AgriTrends / RPO carcass prices (May 2026)
