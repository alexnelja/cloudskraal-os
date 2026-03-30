# CBAM Verification Guide for South African Exporters

**Date:** March 2026
**Status:** CBAM definitive period is LIVE since 1 January 2026. Clock is running.

---

## Critical Deadlines — Right Now

| Deadline | What | Who |
|----------|------|-----|
| **31 March 2026** | Apply for authorized CBAM declarant status | EU importer |
| **1 Jan 2026 (already passed)** | Start monitoring installation-level emissions | SA producer |
| **Throughout 2026** | Collect and verify emissions data | SA producer + EU-accredited verifier |
| **1 Sep 2026** | Verifiers must register in CBAM Registry | Verification bodies |
| **1 Feb 2027** | CBAM certificate sales begin | EU importer |
| **30 Sep 2027** | First annual CBAM declaration due (covering 2026) | EU importer |

---

## 1. The Full Process — Step by Step

### Legal Basis
- **Regulation (EU) 2023/956** — the CBAM Regulation
- **Regulation (EU) 2025/2083** — Simplification amendments (entered into force 20 Oct 2025)
- **Implementing Regulation (EU) 2023/1773** — transitional period rules
- **Implementing Regulation (EU) 2025/2621** — default values and benchmarks

### Step 1 — EU Importer Registers as Authorized CBAM Declarant

- EU importers bringing in >50 tonnes of CBAM goods (cumulative across all CBAM sectors per calendar year) must apply
- Apply via competent authority of the Member State where the importer is established
- Must demonstrate no serious infringements of customs/tax legislation
- Importer receives a **CBAM account number** and access to the **CBAM Registry**
- **Deadline: 31 March 2026** — applications by this date allow continued importing while approval is pending

### Step 2 — SA Producer Establishes Monitoring Plan

The non-EU installation operator must:

1. **Establish a monitoring plan** following Annex III methodology, identifying:
   - All emission sources within the installation boundary
   - Measurement and calculation methodologies for each source
   - Quality assurance/control procedures
   - Data management and record-keeping procedures
   - Process flow diagrams for each production route

2. **Monitor and record** throughout the calendar year:
   - Fuel consumption by type (coal, coke, natural gas, diesel)
   - Process material inputs (chromite ore, reductants, fluxes)
   - Production output by product (tonnes of ferrochrome)
   - Emission factors used and their sources

3. **Calculate specific embedded emissions per product**

### Step 3 — SA Producer Registers on O3CI Portal

The **O3CI Portal** (Operators of Third Countries Installations) is the EU's official centralized data-sharing system, live since 31 December 2024.

**How to register:**
1. Create **EU Login** credentials at https://ecas.ec.europa.eu
2. Access the CBAM Registry and navigate to the O3CI section
3. Register your installation with full identification details
4. Upload installation, production route, and emissions data
5. **Designate specific EU importers** (by EORI number) who may access your data
6. EU importers can then pull your data directly into their declarations as read-only entries

**No API available** — data uploaded manually or via XML file.

**Alternative:** Send data bilaterally using the EU Communication Template (see Section 8).

### Step 4 — Third-Party Verification

From 1 January 2026, **all emissions data used in CBAM declarations must be verified by an EU-accredited third-party verifier.**

**Verification must include:**
- **Mandatory physical site visit** (at least in the first reporting period — 2026)
- Risk assessment of the installation's monitoring systems
- Review of monitoring methodology and process flow diagrams
- Verification of activity data, emission factors, and calculations
- Comparison with EU benchmark values
- Assessment of data management and internal controls

**Materiality threshold:** 5% deviation per CN code for total specific embedded emissions. Below 5% does not trigger failure.

**Subsequent years (2027+):** Physical visits required at least every other reporting period. Virtual/remote permitted between mandatory visits for low-risk installations.

**Verification report must include:**
- Operator and verifier identification
- Site visit documentation
- Emissions monitoring system summaries
- Direct and indirect emissions calculations
- Product specifications with CN codes and production volumes
- Supply chain origin data
- Comparison with EU benchmarks

### Step 5 — EU Importer Files Annual CBAM Declaration

**By 30 September 2027** (covering 2026 imports), the authorized CBAM declarant submits:
- Total quantity of each CBAM good imported (tonnes)
- Total embedded emissions (tCO2e)
- Number of CBAM certificates to surrender (adjusted for free allocation and third-country carbon price)

### Step 6 — Certificate Purchase and Surrender

- **Sales begin 1 February 2027** for 2026 emissions
- 2027 certificates priced at average 2026 EU ETS quarterly allowance values
- **Quarterly minimum holding:** 50% of embedded emissions imported since start of year (reduced from 80% by Simplification Regulation)
- **Surrender deadline:** 30 September of the following year
- **Re-purchase/buyback:** up to 1/3 of certificates purchased in previous year

### Penalties

| Violation | Penalty |
|-----------|---------|
| Non-surrender of certificates | **EUR 100/tCO2** (excess tonnes) |
| Anti-avoidance (artificial splitting to stay under 50t) | **3-5x** the standard penalty |
| Importing without authorized declarant status | Import restrictions |

---

## 2. The Calculation — How to Calculate Embedded Emissions

### Core Formula

```
SEE = (Em_direct + Em_precursors) / Production_output

Where:
  SEE       = Specific Embedded Emissions (tCO2e per tonne of product)
  Em_direct = Attributed direct emissions for the production process (tCO2e)
  Em_precursors = Sum of (mass_i × SEE_i) for each relevant precursor
  Production_output = Total product output (tonnes)
```

### Direct Emissions Breakdown

```
Em_direct = Em_combustion + Em_process

Em_combustion = Σ (Fuel_consumed_i × NCV_i × EF_i × OF_i)
  Where:
    Fuel_consumed = tonnes of fuel consumed
    NCV           = Net Calorific Value (GJ/t)
    EF            = Emission Factor (tCO2/GJ)
    OF            = Oxidation Factor (typically 0.99-1.0)

Em_process = Σ (Material_input_j × EF_process_j × CF_j)
  Where:
    Material_input = tonnes of carbon-containing material input
    EF_process     = Process emission factor
    CF             = Conversion factor
```

### System Boundaries — What's In and What's Out

**Included:**
- Fuel combustion in submerged arc furnaces and auxiliary equipment
- Process emissions from carbothermic reduction (e.g., CO2 from reducing Cr2O3 with carbon)
- Emissions from raw material preparation (sintering, pelletizing)
- Precursor emissions (if applicable — e.g., on-site coke production)
- Fugitive emissions

**Excluded:**
- Transport of raw materials to the installation
- Downstream emissions after product leaves the gate
- **Scope 2 (electricity) emissions — excluded for metals in the definitive phase** (but under review for 2027)

### What Scope Is Required by Product

| Product | Scope 1 (Direct) | Scope 2 (Indirect/Electricity) |
|---------|:-:|:-:|
| Iron and steel (incl. ferrochrome, ferromanganese) | YES | NO (for now) |
| Aluminium | YES | NO (for most CN codes) |
| Cement | YES | YES |
| Fertilizers | YES | Partial |
| Hydrogen | YES | Conditional |

### Emission Factors — Where to Get Them

Priority order:
1. **Country-specific factors** — SA Department of Forestry, Fisheries and the Environment
2. **IPCC default factors** — as fallback
3. **For Eskom grid** (if indirect emissions ever required): ~0.95-1.02 tCO2/MWh

### Typical SA Emissions Intensities

| Product | Range (tCO2/t) | Key Driver |
|---------|----------------|-----------|
| **High-carbon ferrochrome** (coal SAF) | 4.7 – 6.1 | Coal reductant + Eskom electricity |
| **Ferrochrome** (range across technologies) | 1.8 – 5.5 | Production route, electricity source |
| **Steel** (BF/BOF) | ~1.4 (benchmark) | Blast furnace process |
| **Steel** (DRI/EAF) | ~0.5 (benchmark) | Direct reduction |
| **Steel** (Scrap EAF) | ~0.07 (benchmark) | Electric arc, scrap input |
| **Aluminium** | Very electricity-dependent | 13-16 MWh/t, Eskom grid factor |

**For comparison:** Finnish ferrochrome (Outokumpu, hydroelectric) achieves ~1.8 tCO2/t vs SA at 4.7-6.1 tCO2/t. The difference is overwhelmingly electricity source.

### Monitoring Tiers

Operators use Tier 1-4 classification (per EU MRR standards):
- **Tier 1:** Basic default emission factors
- **Tier 2:** Country-specific factors
- **Tier 3:** Installation-specific factors from analysis
- **Tier 4:** Continuous emission monitoring

Higher tiers = more accurate data = lower chance of overestimation. SA producers should aim for at least Tier 2.

---

## 3. Who Can Verify — Accreditation Requirements

### Required Standards

Verifiers must comply with:
- **ISO 14065:2020** — Requirements for bodies validating/verifying environmental information
- **ISO 14064-3:2019** — Requirements for GHG validation and verification
- **ISO 17029** — Requirements for validation and verification bodies

### Accreditation Pathways

Two routes to qualify:

1. **CBAM-specific accreditation** — Under CBAM verification implementing regulation, accredited for specific activity groups (iron/steel, cement, aluminium, fertilizers, electricity, hydrogen)
2. **EU ETS crossover** — Any verifier already accredited under Implementing Regulation (EU) 2018/2067 can serve as CBAM verifier

### Can SA-Based Verifiers Do It?

**Yes, but with an important constraint:**

- CBAM accreditation **must come from an EU/EEA National Accreditation Body (NAB)**
- **SANAS cannot independently accredit CBAM verifiers**
- Existing SANAS ISO 14065 accreditation is NOT sufficient for CBAM purposes

**Process for SA-based verifiers:**
1. Identify an EU NAB willing to accredit verifiers outside the EU
2. If no NAB available, **European Accreditation (EA)** will help match with appropriate NAB
3. EU NAB conducts assessment (may include on-site assessment of verifier's operations)
4. Once accredited, verifier registers in CBAM Registry (deadline: **1 September 2026**)

**Practical route for SA producers:** Engage the SA offices of international verification bodies that already have or are pursuing EU CBAM accreditation:

| Verification Body | SA Presence | CBAM Status |
|-------------------|------------|-------------|
| **SGS South Africa** | Yes | SGS globally offers CBAM verification |
| **Bureau Veritas South Africa** | Yes | Global CBAM compliance services |
| **TÜV** | Yes (via partners) | EU-accredited |
| **DNV** | Yes | EU-accredited |
| **RINA** | Limited SA presence | Global CBAM verification |

### SA Advisory Firms for CBAM Compliance

| Firm | Service |
|------|---------|
| **Yellow Tree** (SA-based) | CBAM advisory for SA exporters |
| **Anthesis Group SA** | Sustainability consulting, CBAM guidance |
| **ENS Africa** | Legal advisory on carbon tax + CBAM |

---

## 4. Default Values vs Actual Data — The Cost of Doing Nothing

### Default Value Source

Set using (per IR 2025/2621):
1. EU Joint Research Centre data on global production emissions
2. Data from CBAM transitional period (2023-2025 quarterly reports)
3. Fallback: average emission intensity of the **10 highest-emitting exporting countries**

### Default Value Mark-Up Schedule

| Year | Mark-Up Above Default |
|------|----------------------|
| 2026 | +10% |
| 2027 | +20% |
| 2028+ | +30% |

### Financial Impact — Ferrochrome Example

**Assumptions:**
- Actual verified emissions: ~5.0 tCO2/t FeCr (well-run SA smelter)
- Default value: ~6.0 tCO2/t FeCr (before mark-up)
- EU ETS price: EUR 65/tCO2

**CBAM phase-in schedule** (free allocation reduction):

| Year | Phase-In % | Actual Data Cost (EUR/t FeCr) | Default Cost (EUR/t FeCr) | Penalty for Not Providing Data |
|------|-----------|------------------------------|--------------------------|-------------------------------|
| 2026 | 2.5% | 8.13 | 10.73 | +EUR 2.60/t |
| 2027 | 5.0% | 16.25 | 23.40 | +EUR 7.15/t |
| 2028 | 10.0% | 32.50 | 50.70 | +EUR 18.20/t |
| 2029 | 22.5% | 73.13 | 114.08 | +EUR 40.95/t |
| 2030 | 48.5% | 157.63 | 245.90 | +EUR 88.27/t |
| 2034 | 100% | 325.00 | 507.00 | +EUR 182.00/t |

**By 2034, the annual penalty for using defaults instead of actual data on 100,000 tonnes of ferrochrome exports: ~EUR 18.2 million.**

The economic case for providing actual verified data is overwhelming and grows every year.

---

## 5. SA Carbon Tax Deduction — How Much Relief?

### What Qualifies

Per CBAM Article 9, eligible carbon prices include:
- Carbon tax (SA Carbon Tax Act qualifies)
- Levies/fees linked to GHG emissions
- Emission allowances under trading systems

**Voluntary carbon credits do NOT qualify.**

### SA Carbon Tax — Effective Rate Calculation

**2026 headline rate:** R308/tCO2e

**Allowances for a ferrochrome smelter (Phase 2):**

| Allowance | Reduction |
|-----------|----------|
| Basic tax-free allowance | 60% (retained until 2030) |
| Trade exposure allowance | Up to 10% |
| Process emissions allowance | 10% |
| Performance allowance | Up to 5% |
| Carbon offset allowance | 10-15% |
| **Combined cap** | ~95% maximum |

**Effective rate calculation:**
- After 60% basic allowance: 40% × R308 = R123.20/tCO2e
- After additional sector allowances (~25%): ~15% × R308 = **R46.20/tCO2e**
- In EUR (at ~R20/EUR): **~EUR 2.31/tCO2e**

### The Gap

| | Rate |
|--|------|
| SA effective carbon tax | ~EUR 2-3/tCO2e |
| EU ETS price | EUR 60-80/tCO2e |
| **SA offset as % of CBAM cost** | **~3-4%** |

**Bottom line:** The SA carbon tax deduction provides almost no meaningful relief. The gap between SA and EU carbon pricing is enormous.

### Documentation Required for Deduction
- Proof carbon price was paid in country of origin
- Amount paid per tonne CO2
- Evidence it applies to the specific goods imported
- Independent certification of emissions and payment
- Must account for rebates, free allowances, or compensation received

---

## 6. Data Communication — Templates and Systems

### Option A: O3CI Portal (Recommended)

**Centralized, shared with multiple EU importers:**

```
SA Producer
  ↓
  Register on O3CI Portal (EU Login credentials)
  ↓
  Upload: installation data, production routes, emissions, verification
  ↓
  Designate EU importers (by EORI number)
  ↓
EU Importer
  ↓
  Pull data directly into CBAM declaration (read-only)
```

**Advantages:** Single upload serves all EU customers. Reduces bilateral communication. Data format guaranteed compatible with CBAM Registry.

### Option B: EU Communication Template (Bilateral)

The Commission provides a standardized template following Annex IV requirements:

**Template sections:**
1. Installation identification and location
2. Product-level emissions data
3. Production routes and process descriptions
4. Emission factors and activity data
5. Monitoring methodology used
6. Verification status

Commission has published video training modules on completing the template.

### Data Format

XML file format supported for software-to-system integration. No public API currently available.

### Practical Data Flow

```
SA Producer
  → Monitoring Plan
  → Annual Data Collection (Jan-Dec)
  → Third-Party Verification (EU-accredited verifier, physical site visit)
  → Upload to O3CI Portal OR send via EU Communication Template
  → EU Importer receives data
  → EU Importer files CBAM declaration (by 30 September following year)
  → EU Importer purchases and surrenders certificates
```

---

## 7. What a SA Ferrochrome Exporter Must Do RIGHT NOW

### Immediate Actions (March 2026)

| Priority | Action | Who |
|----------|--------|-----|
| **URGENT** | Establish monitoring plan if not done. You should have been collecting data since 1 Jan 2026 | SA producer |
| **URGENT** | Register on O3CI Portal (EU Login → CBAM Registry → O3CI) | SA producer |
| **URGENT** | Engage EU-accredited verifier. Contact SGS SA, Bureau Veritas SA, TÜV, DNV | SA producer |
| **URGENT** | Apply for authorized CBAM declarant status (deadline 31 March 2026) | EU importer |
| **This quarter** | Begin collecting fuel consumption, material inputs, production output data | SA producer |
| **By Q3 2026** | Complete first data collection cycle | SA producer |
| **By end 2026** | Obtain verification report (physical site visit mandatory for first period) | SA producer + verifier |
| **Ongoing** | Communicate proactively with EU importers — don't wait for them to ask | SA producer |

### What Happens If You Do Nothing

**If SA producer provides no data:**
- EU importer must use default values with 10% mark-up (2026), escalating to 30% (2028+)
- Default values based on 10 worst-performing countries — almost certainly higher than your actual emissions
- **Commercial consequence:** EU importers will switch to suppliers who provide actual data (lower cost)
- Loss of EU market access over time

**If EU importer does nothing:**
- Cannot legally import >50 tonnes without authorized declarant status
- EUR 100/tCO2 penalty for unsurrendered certificates
- 3-5x enhanced penalties for deliberate avoidance
- Potential loss of authorized status
- Goods held at customs

---

## 8. Quick Reference Summary

| Item | Value/Status |
|------|-------------|
| CBAM definitive period | **Active since 1 Jan 2026** |
| Declarant application deadline | **31 Mar 2026** |
| First certificate sales | **1 Feb 2027** |
| First declaration due | **30 Sep 2027** |
| 2026 phase-in | **2.5%** of full CBAM cost |
| 2030 phase-in | **48.5%** |
| 2034 full implementation | **100%** |
| Default value mark-up 2026 | **+10%** |
| Default value mark-up 2028+ | **+30%** |
| SA effective carbon tax | **~EUR 2-3/tCO2e** |
| EU ETS price | **~EUR 60-80/tCO2e** |
| SA FeCr emissions intensity | **4.7-6.1 tCO2/t** |
| EU FeCr benchmark (hydro) | **~1.8 tCO2/t** |
| Verification | **Mandatory, EU-accredited, physical site visit in 2026** |
| SA verifier route | **Apply via EU NAB (not SANAS)** |
| O3CI Portal | **Live — register now** |
| Penalty non-surrender | **EUR 100/tCO2** |
| Penalty avoidance | **3-5x standard rate** |

---

## 9. The Blockchain Opportunity (Tying It All Together)

### Where blockchain fits in the CBAM verification chain:

| CBAM Step | Current Method | Blockchain Enhancement |
|-----------|---------------|----------------------|
| Emissions monitoring | Spreadsheets, manual logs | IoT sensors → on-chain recording (tamper-proof, real-time) |
| Data communication | XML upload to O3CI / bilateral templates | Verifiable Credentials with on-chain hash (instant verification) |
| Third-party verification | Annual audit, paper reports | Continuous dMRV with blockchain audit trail |
| Certificate management | CBAM Registry (centralized) | Smart contract automation for purchase/surrender |
| Carbon price deduction | Manual documentation | On-chain proof of SA carbon tax payment |
| Provenance (not required by CBAM but valuable) | None | Mine-to-port chain of custody linked to emissions data |

### Why it matters commercially:

1. **Verified data avoids default penalties** — EUR 88/t FeCr by 2030, EUR 182/t by 2034
2. **Blockchain makes verification faster and cheaper** — continuous vs annual audits
3. **Same infrastructure serves CBAM + Battery Passport + CRMA** — one investment, multiple compliance
4. **Provenance + emissions = premium pricing** — EU buyers will pay more for verified, low-carbon, legally sourced material
5. **First-mover advantage** — SA producers who build this infrastructure now lock in EU market access while competitors scramble
