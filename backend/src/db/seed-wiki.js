const { v4: uuidv4 } = require('uuid');
const { titleToSlug, updatePageLinks } = require('../services/wiki-links');

function seedWiki(db) {
  const count = db.prepare('SELECT COUNT(*) AS cnt FROM wiki_pages').get().cnt;
  if (count > 0) return;

  const now = new Date().toISOString();

  const pages = [
    // ── Enterprise Guides (5) ──────────────────────────────────────────────
    {
      title: 'Rooibos Cultivation',
      category: 'enterprise',
      enterprise: 'rooibos',
      tags: ['cultivation', 'soil', 'harvest'],
      body: `# Rooibos Cultivation

## Soil Requirements
Rooibos (Aspalathus linearis) thrives in acidic, sandy soils with **pH 4.2–4.7**. The plant is adapted to nutrient-poor fynbos soils and should not be over-fertilised. See [[Soil Management]] for detailed nutrient guidelines.

## Planting
- **Sowing:** Feb–Mar in nursery seed beds
- **Transplanting:** May–Jul when seedlings reach 15–20 cm
- **Spacing:** 30 cm in-row, 75 cm between rows (~44,000 plants/ha)

## Rotation & Rest
Rooibos fields follow a **4–5 year production cycle**, after which the land must rest for 2–3 years to allow natural fynbos regeneration. This is critical for soil health and nitrogen fixation by indigenous legumes.

## Harvest
Harvest runs **Dec–Apr**. Cuttings are made 30–40 cm above ground using Bovic cutters. See [[Rooibos Processing]] for post-harvest workflow.

## Yield Benchmarks
- Year 1: 150–200 kg/ha
- Year 2–3: 300–450 kg/ha (peak)
- Year 4–5: declining yields

## Climate
Winter rainfall region, 180–500 mm annually. Frost tolerance is moderate. Hot, dry summers drive the oxidation process.

## Pests & Diseases
Key threats include [[Clear-wing Moth]], [[Phytophthora Root Rot]], [[Leafhopper]], and [[Rooibos Looper]].`
    },
    {
      title: 'Sheep Management',
      category: 'enterprise',
      enterprise: 'sheep',
      tags: ['livestock', 'wool', 'breeding'],
      body: `# Sheep Management

## Stocking Rates
Nama Karoo veld: **2.6 ha/SSU** (Small Stock Unit). Hantam region carrying capacity varies by rainfall year. See [[Veld Management]] for grazing rotation.

## Breeds
- **Merino** — fine wool, adapted to Karoo conditions
- **Dohne Merino** — dual purpose (wool + meat), good mothering

## Breeding Cycle
- **Joining:** Dec (rams in, 1 ram per 30–35 ewes)
- **Scanning:** ~60 days post-joining
- **Lambing:** May–Jul
- **Weaning:** Aug–Sep
See [[Breeding Calendar]] for full annual schedule.

## Shearing
Sep–Oct annually. Target: clean, dry conditions. Wool classed on-shed by registered classer. Key metrics: micron (18–22μ), yield% (>65%), vegetable matter (<2%).

See [[Wool Processing]] for post-shearing workflow.

## Health
Regular drenching program. Internal parasites (roundworm, tapeworm), external (blowfly, lice). Vaccination: Pulpy kidney, Pasteurella, Blue tongue.`
    },
    {
      title: 'Wine Grapes — Olifants River',
      category: 'enterprise',
      enterprise: 'wine',
      tags: ['viticulture', 'irrigation'],
      body: `# Wine Grapes — Olifants River

## Cultivars
- **Chenin Blanc** — workhorse white, bulk wine
- **Sauvignon Blanc** — higher value, requires careful canopy management

## Yields
Target **25 t/ha** for bulk wine production. Quality-focused blocks may target 12–15 t/ha.

## Irrigation
Drip irrigation from Olifants River allocation. Deficit irrigation strategy during veraison to concentrate sugars. Critical: maintain drippers and monitor soil moisture.

## Costs
Estimated **R35,000/ha** annual production cost including labour, chemicals, water, and harvesting.

## Cellar Relationship
Grapes delivered to **Klawer Wynkelders** (co-op cellar). Price depends on sugar (Balling), acid, and varietal.

## Replanting
Vineyards replanted every **25 years**. Capital intensive — see tax benefits under Section 12C.

## Compliance
Must comply with [[IPW Compliance]] for Wine of Origin certification. See [[Vineyard Pruning]] for winter management.`
    },
    {
      title: 'Buchu Cultivation',
      category: 'enterprise',
      enterprise: 'buchu',
      tags: ['buchu', 'essential-oils'],
      body: `# Buchu Cultivation

## Species
- **Agathosma betulina** (round-leaf buchu) — higher oil value
- **Agathosma crenulata** (oval-leaf buchu) — more robust

## Soil Requirements
Acidic sandy soils, **pH 4.0–4.99**. Well-drained slopes preferred. See [[Soil Management]].

## Propagation
From cuttings (semi-hardwood), **9–11 weeks** rooting period. Mist propagation recommended. Seedlings transplanted at 6–8 months.

## Oil Yield
- Fresh herb: **1–2% essential oil** by steam distillation
- Price: **USD 850/kg** (2024 market)
- Key compounds: diosphenol, pulegone

## Market
Pharmaceutical, cosmetic, and flavouring industries. Export primarily to EU and USA. Growing demand for natural ingredients.`
    },
    {
      title: 'Sceletium Pilot',
      category: 'enterprise',
      enterprise: 'sceletium',
      tags: ['sceletium', 'compliance', 'pilot'],
      body: `# Sceletium Pilot

## Overview
Sceletium tortuosum (Kanna) is a succulent plant indigenous to the Western Cape. It contains mesembrine alkaloids with anxiolytic and mood-enhancing properties.

## Cultivation
- Propagation from cuttings (stem sections)
- Dormant in summer (Dec–Feb), active growth in winter
- Plant lifespan: **3–5 years**
- Sandy, well-drained soil

## Regulatory Requirements
**CRITICAL:** Commercialisation requires a [[NEMBA Bioprospecting Permit]] under Chapter 6 of the National Environmental Management: Biodiversity Act.

## Benefit-Sharing
A Benefit-Sharing Agreement with **Khoi-San communities** is legally required before any commercial activities. This is non-negotiable and must be in place before cultivation begins.

## Market
- Nutraceutical supplements (Zembrin® is the patented extract)
- Functional foods and beverages
- Growing international interest`
    },

    // ── Processing Workflows (3) ───────────────────────────────────────────
    {
      title: 'Rooibos Processing',
      category: 'process',
      enterprise: 'rooibos',
      tags: ['processing', 'workflow'],
      body: `# Rooibos Processing

## Workflow

1. **Field Harvest** — Bovic cutters (11–15kW) cut stems 30–40 cm above ground
2. **Transport** — bundled and trucked to processing yard
3. **Bruising** — mechanical bruising to rupture cell walls (Victor machines)
4. **Oxidation** — heaps formed on tea courts, covered overnight. **8–12 hours** for full oxidation (colour change green → red)
5. **Sun Drying** — spread on tea courts (concrete surfaces) for **1–3 days** depending on weather
6. **Sifting** — mechanical sifting to remove stems, dust, stones
7. **Grading** — colour, cut size, taste. Grades: Super, Choice, Standard
8. **Bagging** — 40kg bags, labelled with batch/block/date
9. **Storage** — cool, dry warehouse. FIFO rotation.

## Equipment
- 5× Bovic cutters (3 at Garsland, 2 at Cloudskraal) — see [[Bovic Cutter Maintenance]]
- 2× Victor bruising machines
- Forklifts for heap management

## Quality & Compliance
Tea courts must meet [[FSSC 22000]] food-grade surface requirements. See [[Tea Court Expansion]] for capacity upgrade plans.`
    },
    {
      title: 'Wool Processing',
      category: 'process',
      enterprise: 'sheep',
      tags: ['wool', 'shearing'],
      body: `# Wool Processing

## Workflow

1. **Shearing** — professional shearing team, Sep–Oct
2. **Classing** — on-shed by registered wool classer:
   - Skirting (remove belly, crutch, stain wool)
   - Grading by **micron** (18–22μ), **staple length** (75–100mm), **VM** (<2%)
3. **Pressing** — hydraulic press into standard bales (~180kg)
4. **Collection** — **BKB Ltd** collects bales from farm
5. **Sale** — auction (Cape Wools SA) or direct sale to top-makers

## Key Metrics
- Fleece weight: 4–6 kg/head (Merino)
- Micron: 18–22μ
- Yield%: >65%
- Vegetable matter: <2%

## Traceability
Each bale linked to farm code, block, shearing date. Required for export certification.

See [[Sheep Management]] for flock management details.`
    },
    {
      title: 'Wine Processing',
      category: 'process',
      enterprise: 'wine',
      tags: ['wine', 'cellar'],
      body: `# Wine Processing

## Workflow

1. **Grape Harvest** — Mar, machine or hand-pick depending on block
2. **Crushing/Pressing** — destemming, crushing, juice extraction
3. **Fermentation** — controlled temperature fermentation
4. **Racking** — separation from lees
5. **Bulk Storage** — stainless steel tanks
6. **Collection** — Klawer Wynkelders collects bulk wine

## Quality Factors
- Sugar at harvest (22–24° Balling)
- Acid balance (6–8 g/L total acid)
- Clean, healthy grapes (no rot or contamination)

See [[Wine Grapes — Olifants River]] for vineyard management.`
    },

    // ── Pests & Diseases (4) ───────────────────────────────────────────────
    {
      title: 'Clear-wing Moth',
      category: 'pest',
      enterprise: 'rooibos',
      tags: ['pest', 'rooibos'],
      body: `# Clear-wing Moth

**Felderiola candescens**

## Identification
Small moth with transparent wings. Larvae bore into rooibos stems, creating tunnels that weaken the plant structure.

## Symptoms
- Wilting of individual branches
- Die-back from stem tips
- Small bore holes visible on stems
- Frass (sawdust-like material) at entry points

## Management
- **Remove and destroy** affected plants immediately
- Maintain plant vigour through proper nutrition
- **Crop rotation** — rest fields between cycles
- Monitor during harvest (larvae visible when stems are cut)

See [[Rooibos Cultivation]] for general crop management.`
    },
    {
      title: 'Leafhopper',
      category: 'pest',
      enterprise: 'rooibos',
      tags: ['pest', 'rooibos'],
      body: `# Leafhopper

**Molopopterus theae**

## Identification
Small sap-sucking insect (3–4mm), pale green. Found on underside of rooibos leaves.

## Symptoms
- Leaf curl and distortion
- Yellowing (chlorosis)
- Reduced plant vigour
- Honeydew secretion attracting sooty mould

## Management
- Encourage **natural enemies** (parasitic wasps, ladybirds)
- Maintain **buffer zones** of natural veld around fields
- Avoid broad-spectrum insecticides that kill beneficial insects
- Monitor populations — threshold-based decisions

See [[Rooibos Cultivation]] for integrated pest management approach.`
    },
    {
      title: 'Phytophthora Root Rot',
      category: 'pest',
      enterprise: 'rooibos',
      tags: ['disease', 'soil'],
      body: `# Phytophthora Root Rot

## Causal Agent
Soil-borne oomycete (*Phytophthora* spp.). Thrives in waterlogged conditions.

## Symptoms
- Sudden wilting despite adequate moisture
- Root decay — brown/black discolouration
- Plants collapse rapidly
- Patches of dead plants in low-lying areas

## Management
- **Improve drainage** — avoid waterlogging at all costs
- Adequate plant **spacing** for air circulation
- **Crop rotation** — do not replant rooibos in infected soil
- Avoid moving soil from infected to clean areas
- No effective chemical treatment once established

See [[Rooibos Cultivation]] and [[Soil Management]] for prevention strategies.`
    },
    {
      title: 'Rooibos Looper',
      category: 'pest',
      enterprise: 'rooibos',
      tags: ['pest', 'rooibos'],
      body: `# Rooibos Looper

**Isturgia exerraria** ("Landmeter wurmpies")

## Identification
Defoliating caterpillar (looper/inchworm movement). Green-brown, well-camouflaged on rooibos stems.

## Damage
- Severe defoliation during outbreaks
- Reduced photosynthesis and yield
- Can strip entire fields if unchecked

## Management
- **Regular monitoring** — walk fields weekly during growing season
- **Biological control** — Bt (Bacillus thuringiensis) sprays effective on young larvae
- **Crop rotation** breaks pest cycles
- Natural predators: birds, parasitic wasps

See [[Rooibos Cultivation]] for field management practices.`
    },

    // ── Compliance (5) ─────────────────────────────────────────────────────
    {
      title: 'FSSC 22000',
      category: 'compliance',
      enterprise: 'rooibos',
      tags: ['compliance', 'export', 'food-safety'],
      body: `# FSSC 22000

## Overview
Food Safety System Certification 22000 — required for rooibos export to EU/UK/USA markets.

## Foundation
- Based on **ISO 22000** (food safety management)
- Plus **sector-specific prerequisites** (ISO/TS 22002-1 for manufacturing)

## Key Requirements
- **HACCP** at all critical control points (oxidation, drying, packing)
- **Batch traceability** — field to final bag
- Allergen management (cross-contamination prevention)
- Pest control program (rodents, insects in warehouse)
- Water quality testing
- Staff hygiene and training

## Audits
External audits annually by accredited certification body. Non-conformances must be closed within 30 days.

See [[Rooibos Processing]] for workflow compliance points. Related: [[GlobalGAP]] for farm-level certification.`
    },
    {
      title: 'GlobalGAP',
      category: 'compliance',
      enterprise: 'all',
      tags: ['compliance', 'certification'],
      body: `# GlobalGAP

## Overview
Global Good Agricultural Practices — internationally recognised farm certification.

## Scope
- **All Farm Base Module** (AFB) — covers all crop and livestock operations
- **Crop Base Module** (CB) — rooibos, buchu, grapes
- **Fruit & Vegetables** scope where applicable

## Key Requirements
- [[Chemical Application Records]] — full spray diary with withholding periods
- **Traceability** — product origin to farm/field level
- **Worker welfare** — health & safety, training, facilities
- **Environmental management** — biodiversity, water, waste

## Integration
Works alongside [[FSSC 22000]] for food safety. Many requirements overlap — integrated audit possible.`
    },
    {
      title: 'IPW Compliance',
      category: 'compliance',
      enterprise: 'wine',
      tags: ['compliance', 'wine'],
      body: `# IPW Compliance

## Overview
Integrated Production of Wine — South African wine industry sustainability scheme.

## Requirements
- Spray records and chemical application tracking
- Block-level management records
- Water usage monitoring
- Waste management

## Scoring
Points-based system. Minimum score required for certification. Higher scores = better sustainability rating.

## Wine of Origin
IPW compliance is a prerequisite for **Wine of Origin** certification. Without it, grapes cannot carry WO designation.

## Data System
Records managed through **Donkerhoek Data** vineyard management system.

See [[Wine Grapes — Olifants River]] for vineyard operations.`
    },
    {
      title: 'NEMBA Bioprospecting Permit',
      category: 'compliance',
      enterprise: 'sceletium',
      tags: ['compliance', 'legal', 'sceletium'],
      body: `# NEMBA Bioprospecting Permit

## Legal Basis
Chapter 6 of the **National Environmental Management: Biodiversity Act** (NEMBA, Act 10 of 2004).

## When Required
Any commercialisation of indigenous biological resources requires a bioprospecting permit. This includes:
- Cultivation for commercial sale
- Extraction of active compounds
- Export of plant material

## Application Process
1. **Material Transfer Agreement** (MTA) — defines what biological material is accessed
2. **Benefit-Sharing Agreement** (BSA) — legally binding agreement with Khoi-San communities
3. Submit to **DFFE** (Department of Forestry, Fisheries and the Environment)
4. Permit valid for 5 years, renewable

## Critical Notes
- No commercial activity may commence without the permit
- Penalties for non-compliance are severe (criminal offence)
- The benefit-sharing agreement is non-negotiable

See [[Sceletium Pilot]] for cultivation plans.`
    },
    {
      title: 'Chemical Application Records',
      category: 'compliance',
      enterprise: 'all',
      tags: ['compliance', 'records'],
      body: `# Chemical Application Records

## Purpose
Required for [[GlobalGAP]] and [[FSSC 22000]] certification. Legal requirement under Fertilizers, Farm Feeds, Agricultural Remedies and Stock Remedies Act (Act 36 of 1947).

## Record Fields
For every chemical application, record:
- **Product name** and **active ingredient**
- **Date** and **time** of application
- **Application rate** (L/ha or kg/ha)
- **Target pest/disease/weed**
- **Operator** name and PPE used
- **Weather conditions** (wind, temperature, humidity)
- **PHI remaining** (Pre-Harvest Interval)
- **Block/field** identifier

## Storage
Records retained for minimum 3 years. Digital backup recommended. Auditable at any time.`
    },

    // ── Soil & Land (3) ────────────────────────────────────────────────────
    {
      title: 'Soil Management',
      category: 'general',
      enterprise: 'all',
      tags: ['soil', 'nutrients'],
      body: `# Soil Management

## Nieuwoudtville Soils
Typical Bokkeveld soils: **stony-sand**, pH ~6.0 (neutral to slightly acidic). Well-drained but low in organic matter.

## Rooibos Soil Requirements
Rooibos needs **pH 4.2–4.7** — significantly more acidic than natural Nieuwoudtville soils. May require acidifying amendments (elemental sulphur, acid-forming fertilisers).

**Important:** Avoid chemical fertilisers on rooibos — damages root symbiosis with nitrogen-fixing bacteria and affects tea quality.

## Key Nutrients
- **Phosphorus (P):** critical for root development
- **Potassium (K):** target 20.8 mg/kg — see [[Potassium Fertilizer]]
- **Calcium (Ca):** adequate in most Bokkeveld soils
- **Magnesium (Mg):** monitor, supplement if deficient

## Soil Health
- Build organic matter through **compost** and **cover crops**
- Minimise tillage to preserve soil structure
- Rest periods between rooibos cycles allow soil biology recovery

See [[Rooibos Cultivation]] and [[Buchu Cultivation]] for crop-specific soil needs.`
    },
    {
      title: 'Veld Management',
      category: 'general',
      enterprise: 'sheep',
      tags: ['grazing', 'karoo', 'veld'],
      body: `# Veld Management

## Hantam Karoo Veld
The Hantam Karoo is characterised by dwarf shrubland (Karoo bush) with grasses in wetter years. Stocking norm: **2.6 ha/SSU**.

## Rotational Grazing
- Minimum **3 camps per herd** for rotation
- Rest periods of **3–6 months** depending on season
- Never graze below 50% of standing biomass

## Veld Condition Scoring
Annual assessment using standardised methodology:
- Species composition (desirable vs increaser species)
- Basal cover
- Litter and soil surface condition

## Drought Management
- Reduce stocking rate **early** (don't wait)
- Supplementary feeding is a last resort (expensive)
- Destock via auction if drought persists >6 months

See [[Sheep Management]] for livestock practices.`
    },
    {
      title: 'Water Resources',
      category: 'general',
      enterprise: 'all',
      tags: ['water', 'irrigation'],
      body: `# Water Resources

## Rainfall
Nieuwoudtville/Bokkeveld: **250–400mm** annually, predominantly winter rainfall (May–Aug).

## Sources
- **Boreholes** — primary water source for livestock and domestic
- **Farm dams** — capture runoff for supplementary irrigation
- **Olifants River** — irrigation allocation for Klawer vineyard operations

## Enterprise Water Needs
- **Rooibos** — dryland crop, no irrigation (adapted to winter rainfall)
- **Wine grapes** — drip irrigation essential (Olifants River allocation)
- **Buchu** — supplementary irrigation during establishment
- **Sheep** — drinking water from boreholes + windmill pumps

## Water Rights
Water use licensed under National Water Act. Allocation based on historic use and catchment availability.

See [[Wine Grapes — Olifants River]] for vineyard irrigation details.`
    },

    // ── Equipment (4) ──────────────────────────────────────────────────────
    {
      title: 'Bovic Cutter Maintenance',
      category: 'equipment',
      enterprise: 'rooibos',
      tags: ['equipment', 'maintenance'],
      body: `# Bovic Cutter Maintenance

## Fleet
5 Bovic cutters:
- 3 stationed at **Garsland**
- 2 stationed at **Cloudskraal**

## Specifications
- Motor: **11–15kW** electric motors
- VFD upgrades for variable speed control — see [[VFD Upgrades]]

## Maintenance Schedule
### Before Each Season (Nov)
- Blade sharpening and replacement
- Belt tension check and adjustment
- Bearing lubrication (all moving parts)
- VFD parameter check and calibration
- Electrical connections inspection

### During Season (Dec–Apr)
- Daily: visual inspection, blade condition
- Weekly: belt tension, bearing temperature
- Monthly: full service

### Off-Season (May–Oct)
- Deep clean and rust prevention
- Store in dry shed
- Annual motor service

See [[Rooibos Processing]] for harvest workflow.`
    },
    {
      title: 'Tea Court Expansion',
      category: 'equipment',
      enterprise: 'rooibos',
      tags: ['infrastructure', 'capex'],
      body: `# Tea Court Expansion

## Current Situation
Drying capacity is the **primary bottleneck** in rooibos processing. Current tea courts limit throughput during peak harvest.

## Proposed Expansion
- Area: **1,000 m²** additional concrete tea court
- Cost: **R875,000** (at R660–R1,090/m² for food-grade concrete)
- Location: adjacent to existing courts at Meulsteenvlei

## Capacity Impact
Expansion enables processing **300+ tonnes/season** (up from ~200t current capacity).

## Compliance
Surface must meet [[FSSC 22000]] food-grade requirements:
- Smooth, non-porous concrete
- Adequate drainage slope (1–2%)
- Easy to clean and sanitise

See [[Rooibos Processing]] for how tea courts fit into the workflow.`
    },
    {
      title: 'Solar PV System',
      category: 'equipment',
      enterprise: 'all',
      tags: ['solar', 'energy', 'capex'],
      body: `# Solar PV System

## Specification
- **70 kWp** solar array (rooftop + ground mount)
- **350 kWh** battery storage (lithium-ion)
- Hybrid inverter with grid-tie capability

## Financial
- Capital cost: **R2.1M** (mid estimate)
- Annual generation: **120 MWh/year**
- Eskom tariff: **R2.50/kWh** (and rising)
- Annual savings: ~R300,000
- Payback: **4–5 years** after tax benefit

## Tax Benefit
**Section 12B** of the Income Tax Act: **100% first-year write-off** for renewable energy assets. This means the full R2.1M is deductible in year 1.

See [[Tax Deductions]] for other farming tax benefits.`
    },
    {
      title: 'VFD Upgrades',
      category: 'equipment',
      enterprise: 'rooibos',
      tags: ['equipment', 'capex', 'electrical'],
      body: `# VFD Upgrades

## Overview
Variable Frequency Drives (VFDs) for all 5 Bovic cutters. Allows precise motor speed control.

## Cost
- **R200,000** total (R40,000 per unit)
- Installation by qualified electrician

## Benefits
- **Energy savings** — motors only draw power needed at current speed
- **Smoother operation** — soft start reduces mechanical shock
- **Reduced wear** — less stress on belts, bearings, blades
- **Speed control** — adjust cutting speed for different field conditions

## Technical
- Useful life: **10 years**
- Compatible with existing 11–15kW motors
- Requires minor electrical panel modification

See [[Bovic Cutter Maintenance]] for maintenance integration.`
    },

    // ── Farm Knowledge (8) ─────────────────────────────────────────────────
    {
      title: 'Cloudskraal History',
      category: 'general',
      enterprise: 'all',
      tags: ['history', 'family'],
      body: `# Cloudskraal History

## The Nel Family
The Nel family farming operation spans multiple generations in the Nieuwoudtville/Bokkeveld region of the Northern Cape.

## Farms
4 farms across the Northern Cape:
- **Cloudskraal** — home farm, rooibos and sheep
- **Garsland** — rooibos processing, main tea courts
- **Agterseland** — rooibos expansion
- **Klawer** — wine grapes (Olifants River)

## Enterprises
- **Rooibos** — primary enterprise, processing and export
- **Wine grapes** — Olifants River, delivered to Klawer Wynkelders
- **Sheep** — Merino wool, Karoo lamb

## Vision
Building a **100-year family business** through diversification, technology adoption, and sustainable land management. See [[Nel Family Constitution]] for governance framework and [[Meulsteenvlei Acquisition]] for growth strategy.`
    },
    {
      title: 'Nel Family Constitution',
      category: 'general',
      enterprise: 'all',
      tags: ['governance', 'family', 'constitution'],
      body: `# Nel Family Constitution

## Governance Structure
- **Family Assembly** — all adult family members, annual meeting
- **Family Council** — elected representatives, quarterly
- **Board** — independent + family directors, strategic decisions

## Succession
- **Co-leadership model:** Alex + Enya
- Alex: operations, finance, strategy
- Enya: community, sustainability, brand

## Special Provisions
- **Angelique:** Special Trust (Type A) for lifetime care and support
- Trust funded from farming operations, ring-fenced assets

## Retirement
- **Japie & Frances:** retirement provisions from farming income
- Phased transition of responsibilities over 5 years

## Conflict Resolution
1. Direct discussion between parties
2. Family Council mediation
3. External mediator (agricultural arbitration)
4. Binding arbitration as last resort

See [[Cloudskraal History]] for family background and [[Entity Structure]] for legal entities.`
    },
    {
      title: 'Entity Structure',
      category: 'general',
      enterprise: 'all',
      tags: ['entities', 'restructure', 'tax'],
      body: `# Entity Structure

## Current Entities
- **Cloudskraal Boerdery BK** — main farming CC
- **Alexenya Produksie BK** — production/processing CC
- **Cloudskraal Winery Pty Ltd** — wine operations
- **Nel Familie Trust** — family trust

## Planned Restructure
Separate entities for:
- **Farming** (land + crops)
- **Processing** (rooibos factory, equipment)
- **Tourism** (future eco-tourism venture)
- **Property** (Boland BRRRR investments)

## Tax Savings
Restructure estimated to save **R400,000–R540,000/year** through:
- Optimal use of small business tax rates
- Section 42 asset-for-share transfers (no CGT, no transfer duty)
- Separate financial years for cash flow management

See [[Nel Family Constitution]] for governance and [[Tax Deductions]] for specific tax benefits.`
    },
    {
      title: 'Tax Deductions',
      category: 'general',
      enterprise: 'all',
      tags: ['tax', 'finance'],
      body: `# Tax Deductions

## Key SA Farming Tax Benefits

### Paragraph 12 (First Schedule)
**100% deduction** on farm development expenditure:
- Fencing, dams, boreholes
- Soil conservation works
- Clearing of land for farming

### Section 12B
**100% first-year write-off** for renewable energy assets:
- Solar PV systems — see [[Solar PV System]]
- Wind turbines
- Battery storage

### Section 12C
**40/20/20/20** depreciation for manufacturing assets:
- Rooibos processing equipment
- Bovic cutters, Victor machines

### Section 42
**Asset-for-share** transactions:
- Transfer assets to a company in exchange for shares
- **No Capital Gains Tax** triggered
- **No Transfer Duty** on property transfers

## Application
See [[Entity Structure]] for how restructuring maximises these benefits.`
    },
    {
      title: 'Meulsteenvlei Acquisition',
      category: 'general',
      enterprise: 'all',
      tags: ['acquisition', 'finance', 'meulsteenvlei'],
      body: `# Meulsteenvlei Acquisition

## Deal Summary
- Purchase price: **R12,000,000**
- Agreement signed, settlement due **end 2028**
- All rooibos tea processing currently happens at this facility

## Assets
- **200 ha** established rooibos tea
- **6,000 m²** warehousing and processing facilities
- Tea courts, equipment, water rights

## Financing Structure
- **R4.4M** — farm free cash flow (accumulated over 3 years)
- **R1.5M** — director loan
- **R7.0M** — bank finance (Land Bank or commercial)

## Post-Purchase Impact
- Additional cash flow: **R2.1M/year** from existing tea production
- Eliminate current lease payments
- Full control of processing operations

See [[Cloudskraal History]] for context and [[Rooibos Processing]] for processing operations.`
    },
    {
      title: 'Boland BRRRR Strategy',
      category: 'general',
      enterprise: 'all',
      tags: ['property', 'investment', 'strategy'],
      body: `# Boland BRRRR Strategy

## Overview
**Buy-Rehab-Rent-Revalue-Refinance** property investment strategy targeting the Western Cape Boland region.

## Target Markets
- **Paarl**
- **Malmesbury**
- **Wellington**
- 13 target towns in total

## Investment Criteria
- Purchase price: **sub-R1M** units
- Target yield: **10%+** gross rental
- Focus on capital appreciation + cash flow

## Purpose
Rental income and equity build-up to fund [[Meulsteenvlei Acquisition]] down payment.

## Scoring Engine
A property scoring engine has been built to evaluate opportunities across the 13 target towns, incorporating:
- Capital appreciation potential
- Rental yield
- Proximity to growth catalysts (universities, hospitals, transport)
- Renovation potential`
    },
    {
      title: 'Breeding Calendar',
      category: 'general',
      enterprise: 'sheep',
      tags: ['breeding', 'sheep', 'calendar'],
      body: `# Breeding Calendar

## Annual Sheep Breeding Cycle

### December
- **Joining** — rams in with ewes (1 Dec)
- **Ram removal** — 20 Dec (17-day joining period)
- Ram:ewe ratio 1:30–35

### February
- **Pregnancy scanning** — ultrasound at ~60 days
- Identify singles, twins, dry ewes

### May–July
- **Lambing** — main lambing season
- Monitor for dystocia, mothering ability
- Lamb marking (tails, earmarks)

### August–September
- **Weaning** — lambs separated at 3–4 months
- Weaning weight target: 25–30 kg

### September–October
- **Shearing** — see [[Sheep Management]]
- Wool classed and baled — see [[Wool Processing]]

## Key Metrics
- **Lambing %:** target 120%+ (lambs weaned per ewes joined)
- **Weaning %:** >95% of lambs born
- **Wool per head:** 4–6 kg/head (Merino)`
    },
    {
      title: 'Vineyard Pruning',
      category: 'general',
      enterprise: 'wine',
      tags: ['pruning', 'vineyard'],
      body: `# Vineyard Pruning

## Timing
Annual pruning during **July** (winter dormancy). Vines must be fully dormant — no sap flow.

## Pruning Methods
### Spur Pruning
- For bush vines and cordon-trained vines
- Retain 2-bud spurs on permanent cordons
- Suited to Chenin Blanc

### Cane Pruning
- For trellised systems
- Select 1–2 canes per vine, tie to wire
- Suited to Sauvignon Blanc

## Canopy Management
Critical in the hot Olifants River climate:
- Leaf removal in fruit zone (improve air circulation)
- Shoot positioning
- Tip during active growth season

## Disease Prevention
- **Sterilise tools** between vines (to prevent Eutypa, Botryosphaeria)
- Prune in dry weather to reduce infection risk
- Apply wound sealant on large cuts

See [[Wine Grapes — Olifants River]] for full vineyard management.`
    },

    // ── Input Products (5) ─────────────────────────────────────────────────
    {
      title: 'Agricultural Lime',
      category: 'input',
      enterprise: 'all',
      tags: ['input', 'fertilizer', 'soil'],
      body: `# Agricultural Lime

## Purpose
Soil pH adjustment — raises pH in acidic soils.

## Application
- Rate: **2 tonnes/ha**
- Cost: **~R850/tonne**
- Raises pH by **0.5–1.0 units** depending on soil type and buffer capacity

## Important Warning
**NOT recommended for rooibos** — rooibos requires acidic soil (pH 4.2–4.7). Liming rooibos fields will damage the crop.

## Recommended Uses
- **Wine grapes** — maintain pH 5.5–6.5
- **Fodder crops** — lucerne, oats
- **Pasture improvement**

## Application Method
Broadcast with lime spreader, incorporate by discing. Apply 3–6 months before planting for best results.`
    },
    {
      title: 'Potassium Fertilizer',
      category: 'input',
      enterprise: 'rooibos',
      tags: ['input', 'fertilizer'],
      body: `# Potassium Fertilizer

## Importance for Rooibos
Potassium is a **key nutrient** for rooibos tea quality and yield. Target soil K: **20.8 mg/kg**.

## Sources
- **Potassium chloride (KCl)** — most common, cheapest
- **Potassium sulphate (K₂SO₄)** — preferred for sensitive crops, also provides sulphur

## Application
- Apply during soil preparation **before planting**
- Incorporate into top 15 cm of soil
- Rate based on soil analysis results

## Caution
Excessive K can interfere with Ca and Mg uptake. Always base application on recent soil analysis.

See [[Soil Management]] for broader nutrient management and [[Rooibos Cultivation]] for crop requirements.`
    },
    {
      title: 'Glyphosate',
      category: 'input',
      enterprise: 'all',
      tags: ['input', 'herbicide', 'chemical'],
      body: `# Glyphosate

## Type
Non-selective systemic herbicide.

## Withholding Period
Varies by formulation — check product label. Typically 7–14 days for re-entry.

## REI (Restricted Entry Interval)
**12 hours** after application.

## Approved Uses
- Weed control in **firebreaks**
- Non-crop areas (roads, yards, fences)
- Pre-plant weed control (minimum 7 days before planting)

## Restrictions
**NOT for use near rooibos fields** — risk of drift damage. Rooibos is highly sensitive to herbicide residues.

## Record Keeping
All applications must be recorded for [[GlobalGAP]] compliance:
- Date, rate, target weed, operator, weather, block`
    },
    {
      title: 'Ivermectin',
      category: 'input',
      enterprise: 'sheep',
      tags: ['input', 'livestock', 'treatment'],
      body: `# Ivermectin

## Type
Broad-spectrum antiparasitic (endectocide).

## Dosage
Per body weight — follow product label precisely. Typically **0.2 mg/kg** subcutaneous injection.

## Withholding Periods
- **Meat:** 35 days
- **Wool:** check product-specific — some formulations stain wool

## Target Parasites
### Internal
- Roundworms (Haemonchus, Ostertagia, Trichostrongylus)
- Lungworms

### External
- Blowfly larvae
- Lice
- Mange mites

## Resistance Management
- Rotate anthelmintic classes annually
- Do FAMACHA scoring to identify animals that need treatment
- Do not under-dose (weigh animals, don't estimate)

See [[Sheep Management]] for flock health program.`
    },
    {
      title: 'Diesel Fuel',
      category: 'input',
      enterprise: 'all',
      tags: ['input', 'fuel'],
      body: `# Diesel Fuel

## Current Price
~**R24/L** (fluctuates monthly with international oil prices and ZAR exchange rate).

## Farm Usage
- Tractors (ploughing, planting, harvesting)
- Bakkies and transport vehicles
- Generators (backup power)
- Water pumps

## Bulk Storage
- Current: decanted from drums (inefficient)
- **Proposed:** 10,000L bulk tank — R275,000 capex
- Benefits: bulk discount (~R1/L saving), less handling, metered dispensing

## Cost Allocation
Track consumption **per vehicle/operation** for accurate cost allocation to enterprises:
- Rooibos: harvesting, processing, transport
- Sheep: feeding runs, shearing
- Wine: vineyard operations
- General: farm maintenance, admin travel

See [[Fuel Storage Tank]] for the bulk storage capex project.`
    },
  ];

  const insertPage = db.prepare(`
    INSERT INTO wiki_pages (id, slug, title, body, category, enterprise, tags, pinned, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `);

  const insertedPages = [];

  for (const page of pages) {
    const id = uuidv4();
    const slug = titleToSlug(page.title);
    const tagsJson = JSON.stringify(page.tags);
    insertPage.run(id, slug, page.title, page.body, page.category, page.enterprise, tagsJson, now, now);
    insertedPages.push({ id, body: page.body });
  }

  // Build link graph after all pages are inserted
  for (const { id, body } of insertedPages) {
    updatePageLinks(db, id, body);
  }

  console.log(`  Seeded ${pages.length} wiki pages with knowledge graph links`);
}

module.exports = { seedWiki };
