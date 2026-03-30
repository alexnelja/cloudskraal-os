# CBAM and Blockchain for Carbon Compliance in Commodity Trading

**Research Date:** March 2026

---

## 1. What is CBAM

**Carbon Border Adjustment Mechanism** (EU Regulation 2023/956) — puts a carbon price on imported goods equivalent to what EU producers pay under the EU Emissions Trading System (ETS).

### Commodities Covered
- Iron and steel (including downstream: screws, bolts, pipes, rail)
- Aluminium
- Cement
- Fertilizers
- Hydrogen
- Electricity

**Dec 2025 proposal:** extend scope to additional 180 aluminium- and steel-intensive downstream products from 1 January 2028. Future: organic chemicals and polymers.

### Timeline

| Date | Event |
|------|-------|
| 1 Oct 2023 | Transitional phase began (reporting only, no financial obligations) |
| 1 Jan 2026 | **Definitive phase starts.** Financial obligations kick in. Importers must be "authorized CBAM declarants" |
| 31 Mar 2026 | Deadline for registration applications |
| 1 Feb 2027 | Sales of CBAM certificates begin (for 2026 imports) |
| Sep 2027 | First annual CBAM declarations due (covering 2026) |
| 2027 | Commission report evaluating extension to indirect emissions |
| 1 Jan 2028 | Proposed extended downstream scope takes effect |

### Certificate Pricing
- 2026: quarterly average of EU ETS Allowance (EUA) auction prices
- 2027+: weekly average of EUA auction prices
- **Current EU ETS prices: EUR 60-80+ per tonne CO2e** — this is the CBAM certificate cost

### Default Value Penalty
If actual verified emissions data not provided, default values apply with escalating surcharges:
- 2026: +10% above benchmark
- 2027: +20%
- 2028+: +30%

Non-compliance fines: EUR 10-50 per tonne of unreported emissions.

---

## 2. Embedded Emissions Reporting — What's Actually Required

### Scope Coverage for Metals

| Scope | Included? | Details |
|-------|-----------|---------|
| **Scope 1 (direct)** | YES | Core of CBAM — emissions from manufacturing, fuel combustion, process emissions |
| **Scope 2 (indirect/electricity)** | NO for metals | EU Commission explicitly confirmed: "indirect emissions are not in scope for the immediate future." Exception: included for cement and some hydrogen |
| **Scope 3 (supply chain)** | NO | Not included |

**This is critical for SA:** SA's biggest disadvantage — coal electricity — is NOT currently captured in CBAM for steel and aluminium. But the 2027 review could change this. If Scope 2 is added, the impact on SA metals would be severe.

### What Data Must Flow Through the Supply Chain
- Total production output and emissions per installation
- Fuel consumption and fuel types
- Process emissions from chemical reactions
- Emissions factors used
- Production methodology
- Product composition, material origins, processing history

**The non-EU manufacturer must supply installation-specific emissions data, verified by accredited third-party verifier including an on-site audit.**

### Precursor Emissions
Emissions from precursors (e.g., iron ore → pig iron → steel) are counted by default. Emissions from finishing processes are NOT counted, aligning with EU ETS rules.

---

## 3. How Blockchain Solves CBAM Compliance

### The Problem Blockchain Addresses

CBAM requires trusted, verifiable, tamper-proof emissions data flowing from non-EU producers through intermediaries to EU importers. Spreadsheets, PDFs, and emails are fraud-prone, hard to verify, and don't scale across multi-tier supply chains.

### Four Capabilities

1. **Tamper-proof emissions records** — once on a distributed ledger, data can't be altered. Audit trail regulators and verifiers can trust.
2. **Supply chain traceability** — tracks carbon footprints from extraction through processing to delivery, with emissions data attached at each stage.
3. **Smart contract automation** — automates issuance, trading, and surrender of CBAM certificates, reducing admin and fraud.
4. **Interoperability across carbon pricing systems** — common platform for integrating national carbon pricing (important because CBAM allows deduction of carbon prices already paid in origin country).

### Platforms Addressing CBAM via Blockchain

| Platform | Focus | Tech | Status |
|----------|-------|------|--------|
| **Circulor** | Critical minerals + carbon tracking across 30+ supply chains, 125+ facilities | Hyperledger Fabric | Production (Volvo, Trafigura, BHP) |
| **CarbonChain** | Commodity trader emissions — 150,000+ supply chains modelled | IoT + blockchain | Production |
| **Veridium Labs** (w/ IBM) | Corporate carbon footprints, tokenized environmental assets | Blockchain + IoT + AI | Operational |
| **Energy Blockchain Labs** (w/ IBM) | Carbon asset management, digital carbon credits, smart contract compliance | Blockchain | Operational |
| **Hyphen Global** | Atmospheric dMRV + blockchain "Zero-Trust Data Fabric" | Blockchain + atmospheric sensors | Pilot (Mexico, PNG, Hawaii) |
| **Carbonmark** | dMRV + smart contracts for carbon market trust | Blockchain | Emerging |

**Note:** The EU CBAM Registry itself uses a centralized system, not blockchain. No specific EU-funded "blockchain for CBAM" project found. The blockchain layer is a market opportunity, not a regulatory requirement.

---

## 4. CBAM and South Africa

### Scale of Exposure
- **10% of SA exports to EU** impacted by CBAM (~0.8% of GDP)
- ~16% of SA iron and steel exports go to EU
- ~25% of SA aluminium exports go to EU
- African Climate Foundation estimate: CBAM could reduce Africa-wide exports by 5.7%, aluminium -14%, iron/steel -8.2%

### The Coal-Electricity Problem

| Metric | South Africa | EU Average | Multiple |
|--------|-------------|-----------|----------|
| Iron/steel carbon intensity | 0.91 kgCO2e/$ output | 0.16 kgCO2e/$ | **5.7x higher** |
| Aluminium carbon intensity | 0.32 kgCO2e/$ | 0.07 kgCO2e/$ | **4.6x higher** |

**Warning:** If SA does not rapidly decarbonize energy, CBAM levies may exceed 50% of the value of SA aluminium exports by 2034.

### Ferrochrome Specifically
- SA ferrochrome faces reduced EU competitiveness due to higher compliance costs
- Electricity prices risen 900%+ since 2008 (from ~62 c/kWh to R1.96/kWh average)
- Ferrochrome sector in crisis — widespread smelter closures
- Industry exploring renewable energy for "green ferrochrome" at premium prices
- Chrome producers resisting proposed export tax, arguing it compounds CBAM pressures

### The Scope 2 Reprieve (For Now)
Because CBAM currently **excludes** Scope 2 (electricity) emissions for metals, the immediate financial impact is somewhat reduced. SA's coal electricity disadvantage is NOT in the current CBAM calculation. But this could change at the 2027 review. If Scope 2 is added → existential cost pressure for SA metals.

### SA Carbon Tax Offset
- SA domestic carbon tax: sub-USD 20/tonne CO2
- EU ETS price: EUR 60-80+/tonne
- The offset is minimal — the gap is the real cost per tonne

### Government Position
DTIC formally opposes CBAM as "a unilateral measure that undermines global trade rules and developing country sovereignty."

### Readiness
SA broadly characterized as **"not ready financially and administratively"** for CBAM compliance. Most businesses lack adequate installation-level emissions measurement and reporting systems.

### Which SA Products Are Covered
- Raw manganese ore and chrome ore: **NOT directly listed** as CBAM commodities
- Processed products (ferromanganese, ferrochrome, manganese steel, chrome steel) that fall under iron and steel: **YES, covered**
- SA's significant ferroalloy exports to EU are directly affected

---

## 5. CBAM + Digital Product Passports + Commodity Traceability

### The Interconnected Regulatory Ecosystem

| Regulation | What It Does | Timeline |
|-----------|-------------|----------|
| **CBAM** (2023/956) | Carbon cost equalization at border | Definitive phase Jan 2026 |
| **ESPR** (Ecodesign for Sustainable Products) | Mandates Digital Product Passports (DPPs) with composition, environmental footprint, compliance data | Rolling implementation |
| **EU Battery Regulation** (2023/1542) | Digital battery passports with carbon footprint, due diligence on raw materials | Carbon footprint mandatory since 18 Feb 2025; QR passports by Feb 2027; due diligence by Aug 2027 |
| **Critical Raw Materials Act (CRMA)** | 25% of EU strategic raw materials from recycling by 2030; supply chain due diligence | Active |

### How They Connect
- DPPs under ESPR will contain carbon footprint data that directly feeds into CBAM compliance
- Same verified emissions data for CBAM can populate a product's digital passport
- Battery Regulation's carbon footprint declaration is a sector-specific implementation of the CBAM principle
- CRMA creates due diligence requirements for strategic raw materials overlapping with CBAM transparency needs
- **All four regulatory streams benefit from the same blockchain traceability infrastructure**

### Single Investment, Multiple Compliance
A blockchain-based traceability and emissions tracking system can address CBAM, Battery Regulation DPP, CRMA due diligence, and ESPR product passports simultaneously. Build once, comply many times.

---

## 6. dMRV (Digital Measurement, Reporting, Verification)

### What It Is
Automates the traditionally manual process of measuring, reporting, and verifying GHG emissions using satellites, IoT sensors, AI/ML, and blockchain.

### Technology Layers
1. **Measurement:** IoT sensors, satellite imagery, atmospheric monitoring for real-time emissions capture
2. **Reporting:** Automated aggregation against regulatory standards (CBAM Annex III, EU ETS benchmarks)
3. **Verification:** Blockchain provides immutable audit trail; AI/ML validates consistency; smart contracts automate compliance checks

### Key Platforms

| Platform | Approach | Application |
|----------|----------|-------------|
| **Hyphen Global** | Atmospheric-based dMRV (A-dMRV) — continuous GHG monitoring + blockchain "Zero-Trust Data Fabric" | Carbon credit issuance (nature-based projects) |
| **Circulor** | Tracks embedded carbon at each production stage using blockchain + ML | CBAM commodity compliance (cobalt, nickel, lithium supply chains) |
| **CarbonChain** | 150,000+ supply chains modelled, IoT + blockchain for real-time tracking | Commodity traders specifically |
| **SustainCERT** (South Pole) | dMRV certification methodologies | Gold Standard and Verra approved dMRV in 2025 |

### Application to Metals/Minerals
- IoT sensors at smelters/furnaces measure energy consumption and process emissions in real-time
- Blockchain records each batch with verified carbon intensity
- Data flows through supply chain to EU importer for CBAM declaration
- For bulk minerals that get blended: dMRV + blockchain chain-of-custody tracking maintains batch-level emissions profiles through blending and transhipment

---

## Practical Implications for SA Bulk Minerals

1. **Immediate opportunity:** SA producers need help measuring and reporting Scope 1 emissions at installation level to avoid punitive CBAM default values (+10-30% above benchmarks). Any platform simplifying this has a market.

2. **Blockchain value:** Verified emissions data on-chain provides the tamper-proof audit trail CBAM verifiers and EU importers need. Also builds infrastructure for future DPP compliance.

3. **SA carbon tax gap:** Sub-USD 20/tonne domestic vs EUR 60-80+ EU ETS. The gap is the real cost per tonne of CO2 in exported products.

4. **Scope 2 threat:** Current exclusion of indirect emissions is a reprieve. 2027 review could change everything. Proactive decarbonization (renewable energy for smelters) is both defensive and a "green premium" opportunity.

5. **Multi-regulation leverage:** One traceability system → CBAM + Battery Regulation DPP + CRMA + ESPR compliance.

6. **Ferroalloys are the pressure point:** Raw chrome/manganese ore isn't covered, but ferrochrome/ferromanganese IS. The processing step is where CBAM bites.
