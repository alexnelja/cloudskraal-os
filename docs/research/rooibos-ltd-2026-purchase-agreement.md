# Rooibos Ltd 2026 purchase agreement + season actuals (CLO010)

Source docs (Alex, 2026-06-10, in `~/Downloads`):
`CLO010 - AANKOOPSOOREENKOMS 2026.pdf` · `CLO010 - Dekbrief - 5 Junie 2026.pdf` ·
`CLO010~ DRY Payment Grading Report 1 JAN 26 TOT 10 JUN 26.PDF`
Producer: Cloudskraal Brd (Edms) Bpk, account **CLO010**, area NIEUW. Contract dated 5 May 2026.

## Hoofpoel price 2026 (grade D06R1P2 = basis grade)

Fraction prices × assumed mass split → **average R31.65/kg gross dry**:

| Fraction | Sieve | Assumed % | R/kg |
|---|---|---|---|
| Stok | >10 | 8% | 3.50 |
| Grof | >12 | 12% | 5.60 |
| **Tee** | >16–>40 | 75% | **39.60** |
| Stof | <40 | 5% | 20.00 |

→ App mapping: `enterprise_prices` rooibos 2026 on `sifted_netto_dry_kg` basis = the
**Tee fraction = R39.60/kg actual** (was R40 forecast — forecast was accurate).
The blended R31.65 is a *gross-dry* number; do NOT put it on the netto basis.
Stof fetches **R20/kg from Rooibos Ltd** (vs R24/kg instant-tea demand signal —
the in-house reprocessing play still clears the buyer's price by R4/kg).

## Quality adjustments (R/kg on top of basis)

- **PA levels**: P1 (≤0.05) +1.00 · P2 (0.05–0.2) basis · P3 −1.00 · P4 −2.00 · P5 −3.00
- **Residue (MRL)**: R1 basis · R2 −1.00 · R3 −3.00 · R4 (4× MRL, EU-banned) −5.00
- **Sensory points**: 6 basis · 7→12 = +1→+6 · 5→3 = −1→−3 · 2/1 unacceptable
- Registered actives list (Annexure A) valid 2026 season only; unlisted actives → strictest SA/EU half-MRL classification.

## Verwerkingskoste 2026 (charged back to producer, R/kg on gross dry)

| % stokke (>10) | Fee |
|---|---|
| 0–11.9% | R4.00 |
| 12–15.9% | R4.40 |
| 16%+ | R5.80 |

→ COP note: this is a **revenue deduction / external processing fee** distinct from our
on-farm processing cost centre (2e). All six 2026 loads sat at 8% stokke → R4.00/kg fee.
Candidate for a dedicated deduction line next to the 1.5% San/Khoi levy (cost taxonomy in
`spec-2i-activity-based-field-costing.md`).

## Payment terms

- Advance **R18.00/kg** ~15th of month following delivery (deliveries to the 25th).
- Final settlement (cut/residue/PA/sensory adjustments) **23 Sep 2026**.
- Delivery period closes **31 Jul 2026**.

## Pools + volumes (Dekbrief, 5 Jun 2026)

- VVS (supply scheme) allocation: **92,432 kg** · intake offer 120,000 kg
- Estimated 2026 harvest: **178,000 kg** · delivered to 10 Jun (incl. 2025 B-pool): **148,819 kg**
- Surplus pools in storage: **78,648 kg (2024, to 2034)** + **117,265 kg (2025, to 2035)** —
  bought out at the prevailing Hoofpoel price *if/when* Rooibos Ltd has market access;
  decline → 8c/kg/month storage (CPI-adjusted), max 10 years. B-pool counts as next year's Hoofpoel.
- ~196k kg of producer-owned tea sits unsold in surplus — a price-recovery option, but uninsured
  unless the producer insures it (contract 3.5).

## 2026 deliveries (DRY Payment Grading Report, 1 Jan–10 Jun)

| Load | Date | Camp | Gross kg | Tea% | PA | Sens | Res |
|---|---|---|---|---|---|---|---|
| D260324 | 17/03 | Kamp 1 | 29,212.0 | 78.1 | P2 | 6.0 | R1 |
| D260349 | 20/03 | Agter Beefwoods | 29,112.0 | 78.7 | P2 | 6.0 | R1 |
| D260479 | 16/04 | Elandsvoetpad | 20,208.0 | 67.3 | **P1** | **7.0** | R1 |
| D260480 | 16/04 | Kromvlei | 9,749.6 | 77.0 | P2 | 6.0 | R1 |
| D260531 | 28/04 | Pleisterbosrug | 30,154.4 | 78.5 | P2 | 6.0 | R1 |
| D260545 | 20/05 | Leeukamp | 30,383.2 | 77.9 | P2 | 6.0 | R1 |
| **Total** | | | **148,819.2** | | | | |

- Five of six loads grade exactly the D06R1P2 basis → R31.65 average; Elandsvoetpad earns
  +R2/kg (P1 +1, sens 7 +1) but carries 12.7% stof and only 67.3% tea.
- Tea% runs ~78% vs the 75% pricing assumption → realised average slightly above R31.65.
- **Camp names do not match the app's field names** (e.g. "Kamp 1", "Agter Beefwoods",
  "Leeukamp" have no field rows) — per-camp yield ingestion needs a camp↔field mapping
  from Alex before these can land in `field_production`. Gross kg here is DRY delivered,
  NOT harvest-wet — converting needs the dry→wet factor chain in reverse.

## Data applied to the app (2026-06-10)

- `enterprise_prices` rooibos 2026: 40 → **39.60** (`sifted_netto_dry_kg`), notes cite this doc.
  2027–2030 forecast rows untouched.
