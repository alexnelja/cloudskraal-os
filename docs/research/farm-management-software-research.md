# Farm Management Software Platform Research

**Date:** 2026-03-26
**Purpose:** Research farm management platforms to inform the design of a Cloudskraal Boerderye farm operating system
**Context:** 4 farms, 3 enterprises (rooibos 62%, wine/grapes 21%, sheep/wool 16%), 10 departments, ~10 permanent + seasonal workers

---

## Table of Contents

1. [Platform-by-Platform Analysis](#1-platform-by-platform-analysis)
2. [Cross-Platform Feature Matrix](#2-cross-platform-feature-matrix)
3. [Deep-Dive: How Platforms Handle Key Domains](#3-deep-dive-how-platforms-handle-key-domains)
4. [South African / Developing World Platforms](#4-south-african--developing-world-platforms)
5. [Compliance & Certification Systems](#5-compliance--certification-systems)
6. [Dashboard & KPI Patterns](#6-dashboard--kpi-patterns)
7. [Proposed Database Entity-Relationship Model](#7-proposed-database-entity-relationship-model)
8. [Cloudskraal-Specific Requirements](#8-cloudskraal-specific-requirements)
9. [Gap Analysis: What No Single Platform Covers](#9-gap-analysis-what-no-single-platform-covers)

---

## 1. Platform-by-Platform Analysis

### 1.1 FarmTrace (farmtrace.com)

**Type:** Livestock data aggregation platform (B2B, not direct farm management)
**Value Proposition:** "Connect. Unify. Accelerate." — connects farms and provides unified animal farming data to accelerate business decisions.

**Industry Verticals:**
- Animal Nutrition — product impact insights
- Animal Health — preventive healthcare via historical + real-time data
- Genetics — breeding data aggregation
- Food and Milk Processors — supply chain data

**Species Covered:** Beef cattle, dairy cows, goats, poultry, swine

**Key Capabilities:**
- Automated farm connection at scale
- Independent platform collaborating with farmers and tech providers
- Industry expertise team with broad farming experience
- Data unification across multiple farm systems

**Pricing:** Not publicly disclosed (B2B/enterprise model)

**Assessment for Cloudskraal:** FarmTrace is a data aggregation layer, not a farm management OS. It sits above farm systems to unify data for industry partners (nutrition companies, vets, processors). Not directly applicable as an operational tool, but its data model concept — unifying disparate farm data sources — is relevant to Cloudskraal's multi-farm challenge.

---

### 1.2 Farmbrite (farmbrite.com)

**Type:** Full-spectrum farm management suite (the most comprehensive all-in-one platform researched)
**Value Proposition:** All-in-one software for the modern farmer to manage livestock, crops, equipment, customers, orders, and finances in one place.

**Core Modules:**
1. **Livestock Management** — breeding, genealogy, herd health, grazing, tracking (cattle, goats, sheep, pigs, poultry, horses, bees, multi-species)
2. **Crop Management** — harvest reporting, nutrient tracking, soil health logs, seed order estimation, crop health monitoring, custom treatment plans, automated reminders
3. **Equipment Management** — maintenance logs, fuel consumption, preventative service scheduling, depreciation tracking, usage logs, automated reminders
4. **Inventory/Resource Management** — real-time tracking integrated with harvests, treatments, feedings, inputs; low inventory notifications; expiration date alerts; capacity forecasting
5. **Employee/Labor Tracking** — clock-in/out via mobile app, hours tracked by field/task/crop/project, payroll simplification, wage compliance, automatic timesheet-to-project linking
6. **Farm Accounting & Financials** — bookkeeping, financial reporting
7. **Orders, Sales & E-commerce** — integrated online store, direct-to-consumer sales
8. **Customer/CRM** — customer record keeping
9. **Task & Team Management** — built-in calendar, to-do lists, estimating, activity tracking
10. **Mapping** — custom farm mapping
11. **Climate & Weather** — weather monitoring integration
12. **Reporting & Analytics** — comprehensive reporting across all modules

**Pricing:**
| Tier | Monthly | Key Limits |
|------|---------|------------|
| Lite | $19/mo | Basic features |
| Standard | $45/mo | Core modules |
| Plus | $75/mo | Advanced features |
| Complete | $95/mo | Everything |

- Annual billing discounts available
- 14-day free trial, no credit card
- 50% off for 3 years for new farmers
- 65% off for qualifying nonprofits

**Assessment for Cloudskraal:** Farmbrite is the closest to a "farm OS" among the platforms researched. Its module breadth (livestock + crops + equipment + employees + inventory + finance + e-commerce) maps well to Cloudskraal's multi-enterprise needs. However, it lacks: (a) processing/manufacturing workflow tracking (critical for rooibos), (b) wine-specific vineyard management, (c) South African compliance frameworks (IPW, GlobalGAP for rooibos), (d) Afrikaans language support.

---

### 1.3 Figured (figured.com)

**Type:** Farm financial management specialist
**Value Proposition:** Complete online production tracking, farm budgeting, forecasting, and reporting — built by farmers and accountants. Operates in 4 countries, powers 12,000+ farms.

**Core Modules:**
1. **Planning & Budgeting** — create farm budgets in minutes; scenario modeling up to 10 years; reforecasting with version history
2. **Livestock Tracking** — births, deaths, sales, purchases, aging; milk production tracking; monthly management valuations that flow to P&L and balance sheet
3. **Crop/Production Tracking** — multiple product trackers at herd/field/crop level; production quantities auto-sync to financial plan
4. **Enterprise Profitability** — allocation tool pulls indirect income/expenses and allocates to crop seasons or production centres; automated allocator rules; break-even calculations; field profitability
5. **Financial Reporting** — dollars per bushel, per cwt milk solids, per pound livestock; forecast cash flow, profitability, equity
6. **Scenarios** — multi-year plans modeling farm expansion, weather events, commodity fluctuations, machinery purchases

**Integrations:** Xero, QuickBooks, MYOB (accounting packages)

**Pricing (NZD):**
| Plan | Monthly | Notes |
|------|---------|-------|
| Farm Reporter | NZD 14/mo | Basic reporting |
| Farm Manager | NZD 90/mo | Full planning |
| Multi Farm | NZD 90/mo | Multiple farms |
| Commercial Manager | NZD 35/mo | Commercial focus |

- Includes up to 25 fields per farm
- Field add-ons: $70 or $30/mo per 50 fields (depending on plan)

**Key Data Entities:**
- Farms → Fields/Blocks
- Enterprises (business units)
- Production Centres (cost allocation targets)
- Livestock Classes → Individual movements (births, deaths, sales, purchases)
- Crop Seasons → Yields → Revenue
- Financial Plans → Versions → Actuals vs Budget
- Allocations (indirect costs → enterprises)

**Assessment for Cloudskraal:** Figured is the gold standard for farm financial management. Its enterprise profitability analysis (allocating costs to rooibos vs wine vs sheep) is exactly what Cloudskraal needs. The Xero integration is valuable (Xero is widely used in SA). However, Figured is purely financial — no operational management (no equipment tracking, no employee scheduling, no inventory, no processing workflows). Best used as a financial layer on top of an operational system.

---

### 1.4 AgriWebb (agriwebb.com)

**Type:** Livestock and farm management (strongest in grazing/livestock)
**Value Proposition:** Livestock management software for smarter farming — track animals, paddocks, and records in one place.

**Core Modules:**
1. **Farm Records** — dozens of record types: inventory, treatments, feed, movements, weights, pregnancy scanning, marking, weaning, tagging, wool harvest
2. **Farm Mapping** — interactive map, paddock colour coding (Cropping, Hay, Grazing, Withholding), satellite imagery
3. **Animal Management** — real-time performance metrics, cost of production, livestock gross margins, average daily gains
4. **Grazing Planning** — drag-and-drop mob movements, auto-calculated grazing days based on feed-on-offer and animal load, Cibo Labs PastureKey integration (grass estimates every 5 days)
5. **Team Management** — photo and GPS-enabled tasks/notes, unlimited users, customizable access permissions
6. **Compliance & Audits** — audit report generation, regulatory compliance documentation
7. **Foragecaster** — AI/ML-powered forage growth forecasting

**Data Hierarchy (Critical Insight):**
```
Farm
  → Enterprise (business unit: e.g., "Breeding", "Trading")
    → Management Group (similar animals managed the same way)
      → Mob (group of animals) OR Individual Animals
        → Records (weights, treatments, movements, pregnancies...)
  → Paddock (spatial unit with colour coding)
    → Grazing Plans (mob rotation schedules)
```

**Two Subscription Models:**
1. **Mob Management** — group-level records (average weight, total treatments per group)
2. **Individual Animal Management (IAM)** — individual-level via EID/VID ear tags (specific weights, specific treatments per animal)

**Record Types Available:**
- Pregnancy scanning, marking, weaning, movement, weight, treatments, feed, tagging, wool harvest, and more

**Pricing:** Tiered by animal unit capacity (400 to 392,000+ units)
- Essentials / Compliance / Performance tiers
- ~$34–$137+ AUD/month depending on herd size and tier
- Monthly and annual billing
- Region-specific pricing (Australia, NZ, UK, US, **South Africa**)

**Assessment for Cloudskraal:** AgriWebb is the best-in-class livestock platform and has South African pricing. Its Enterprise → Management Group → Mob/Individual hierarchy is excellent for sheep management. The wool harvest record type is directly relevant. However, it is livestock-focused — no crop management, no processing workflows, no equipment maintenance tracking, no financial integration beyond livestock gross margins.

---

### 1.5 Conservis / Traction Ag (conservis.ag → tractionag.com)

**Type:** Row crop farm management (acquired by Traction Ag family)
**Value Proposition:** Advanced farm management with crop planning, budgeting, grain contracts, work orders, and FSA reporting.

**Core Modules:**
1. **Crop Planning** — plan by field, crop, input, scenario; adjust as markets move
2. **Financial Planning** — crop/field plans, input management, debt service, land management
3. **Work Orders** — convert plans to work orders, communicate to field, track execution
4. **Field Tracking** — planting, spraying, fertilizing, harvest tracking; map-based mobile app
5. **Grain Contracts** — marketing and contract management
6. **FSA Reporting** — compliance reporting

**Key Features:**
- Know who's doing what, when, and where from mobile devices
- Plans → Work Orders → Field Execution → Tracking (full workflow)
- Integration with FS accounting systems

**Assessment for Cloudskraal:** Conservis/Traction is US row crop focused — not directly applicable to South African rooibos/wine/sheep. However, their Plans → Work Orders → Execution workflow pattern is excellent and should be adopted. The concept of converting a seasonal plan into dispatchable work orders that track completion is highly relevant.

---

### 1.6 Bushel Farm / FarmLogs (bushelfarm.com)

**Type:** Crop management and grain marketing
**Value Proposition:** Helps farmers make informed marketing decisions and manage resources efficiently.

**Core Modules:**
1. **Field Mapping** — aerial/satellite view, crop-per-field visualization, driving directions
2. **Record Keeping** — field maps, rainfall, satellite imagery, scouting notes, equipment, activities, inputs, grain sales, inventories, land agreements, work orders
3. **Grain Marketing** — cost of production, marketing position, profitability of grain sales, P&L at farm/crop/field level
4. **Weather & Satellite** — rainfall notifications per field, historical data comparison
5. **Work Orders** — plan and track daily work

**Integrations:** John Deere Operations Center, Climate FieldView, Bushel Network

**Assessment for Cloudskraal:** US grain-focused. The field-level P&L concept (profitability at farm, crop, and field level) is valuable. Satellite imagery integration for monitoring crop health could be relevant for rooibos field monitoring.

---

### 1.7 StockBook (Outcross Systems, Australia)

**Type:** Livestock-specific management (stud and commercial)
**Value Proposition:** Cloud-based platform for detailed individual animal tracking from birth through sales.

**Core Modules:**
1. **Individual Animal Database** — lineage, genetic performance of ancestors, unique identification
2. **Health & Treatment Records** — vaccinations, breeding, weaning, health treatments
3. **Breeding Management** — inbuilt DNA reporting, generational data for breeding decisions
4. **Performance Analytics** — fertility (joining results, scanning, weaning percentages), weight gain, physical characteristics, genetic backgrounds
5. **Wool/Fibre Traits** — wool scores, fibre characteristics (relevant for sheep)
6. **Compliance Reporting** — generate compliance reports

**Key Features:**
- RFID scanning integration for efficient on-farm data entry
- Live Entry yards module for real-time data collection
- Stockhand mobile app
- Integration with: Breedplan, ABRI, NLIS, CattleCare, Sheep Genetics, Zoetis, Neogen, plus breed associations

**Data Model:**
```
Animal
  → Identification (EID, VID, tattoo, brand)
  → Lineage (sire, dam, grandparents)
  → Weight Records (series over time)
  → Health Records (treatments, vaccinations)
  → Breeding Records (joining, scanning, lambing/calving)
  → Wool/Fibre Records (scores, measurements)
  → Movement Records (property transfers)
  → Sales Records
```

**Assessment for Cloudskraal:** StockBook's individual animal data model is the most detailed for sheep/wool operations. Its fertility tracking (joining results, scanning percentages, weaning percentages) and wool trait recording are directly relevant to Cloudskraal's sheep enterprise. The integration with Sheep Genetics and breed associations would be valuable for stud operations.

---

## 2. Cross-Platform Feature Matrix

| Feature | Farmbrite | Figured | AgriWebb | Conservis | Bushel Farm | StockBook | AgriERP |
|---------|:---------:|:-------:|:--------:|:---------:|:-----------:|:---------:|:-------:|
| Crop Management | Yes | Partial | No | Yes | Yes | No | Yes |
| Livestock Management | Yes | Partial | Yes | No | No | Yes | Yes |
| Individual Animal Tracking | Yes | No | Yes (IAM) | No | No | Yes | Yes |
| Mob/Herd Tracking | Yes | Yes | Yes | No | No | Yes | Yes |
| Paddock/Field Mapping | Yes | Via fields | Yes | Yes | Yes | No | Yes |
| Grazing Planning | Yes | No | Yes | No | No | No | No |
| Equipment Management | Yes | No | No | Partial | Partial | No | Yes |
| Maintenance Scheduling | Yes | No | No | No | No | No | Yes |
| Employee/Labor Tracking | Yes | No | No | Yes | No | No | Yes |
| Inventory Management | Yes | No | No | Partial | Partial | No | Yes |
| Financial Management | Basic | Expert | Basic | Yes | Yes | No | Yes |
| Enterprise Profitability | No | Yes | Partial | Yes | Yes | No | Yes |
| Budgeting/Forecasting | No | Yes | No | Yes | No | No | Yes |
| Processing/Manufacturing | No | No | No | No | No | No | Partial |
| Compliance/Audit | No | No | Yes | Yes | No | Yes | Yes |
| E-commerce/Sales | Yes | No | No | No | No | No | No |
| Weather Integration | Yes | No | Yes | No | Yes | No | No |
| Mobile App | Yes | No | Yes | Yes | Yes | Yes | Partial |
| SA Market Focus | No | No | Yes | No | No | No | No |

---

## 3. Deep-Dive: How Platforms Handle Key Domains

### 3.1 Fields/Paddocks as Spatial Units

**AgriWebb (best-in-class for paddocks):**
- Interactive map with paddock boundaries drawn on satellite imagery
- Colour coding by type: Cropping, Hay, Grazing, Withholding
- Paddock-level cost of production and gross margin reports
- Grazing days calculated per paddock based on feed-on-offer
- Integration with Cibo Labs PastureKey for satellite-based grass estimates every 5 days

**Farmbrite:**
- Custom farm mapping
- Fields linked to crop activities, treatments, harvest records
- Employee hours trackable by field

**Bushel Farm:**
- Satellite/aerial field views
- Per-field rainfall data and historical comparison
- P&L at field level

**Donkerhoek Data (SA-specific):**
- Block-level management (standard SA wine/crop terminology)
- All activities (spray, fertilizer, cost, income) tracked per block

**Common Data Model for Fields:**
```
Field/Paddock
  - id, name, code
  - farm_id (FK)
  - type (cropping, grazing, vineyard, rooibos, fallow)
  - area_hectares
  - geometry/coordinates (GeoJSON or similar)
  - soil_type
  - irrigation_type
  - current_crop / current_use
  - status (active, resting, withholding)
```

### 3.2 Livestock: Individual vs Flock/Herd

**AgriWebb's dual model is the industry standard:**

**Mob-level tracking (for commercial flocks):**
- Count-based: "300 Merino ewes in Paddock 4"
- Average weight per mob
- Treatments recorded against the mob (e.g., "dosed 300 head")
- Lower data entry burden
- Suitable for commercial sheep operations

**Individual Animal Management (for studs or high-value animals):**
- Each animal has EID (electronic) and VID (visual) identification
- Individual weight records, treatment history
- Individual breeding records (sire, dam, progeny)
- Individual movement history
- Required for stud operations, breed society compliance

**StockBook adds:**
- Genetic performance of ancestors (EBVs)
- DNA integration
- Wool/fibre scores per animal
- Breed association data exchange

**Common Data Model for Livestock:**
```
Livestock_Group (Mob/Flock/Herd)
  - id, name
  - enterprise_id (FK)
  - species, breed
  - count
  - management_group
  - current_paddock_id (FK)
  - average_weight

Animal (Individual — optional for commercial)
  - id
  - group_id (FK)
  - eid_tag, vid_tag
  - species, breed
  - sex, birth_date
  - sire_id, dam_id (self-referencing FK)
  - status (active, sold, deceased)
  - current_weight, condition_score

Animal_Record
  - id, animal_id or group_id
  - record_type (weight, treatment, pregnancy_scan, shearing, movement, sale, death)
  - date
  - details (JSON or typed columns)
  - recorded_by
```

### 3.3 Production Workflows (Harvest → Processing → Storage → Sale)

**This is the weakest area across all platforms researched.** No platform handles the full rooibos workflow (field → cutting → oxidation → drying → sifting → grading → storage → export). Only AgriERP and Croptracker come close.

**Croptracker (best for post-harvest workflow):**
- Harvest → Receiving → Storage → Processing/Packing → Shipping modules
- Lot-level tracking at each stage
- Key Data Elements (KDE) at Critical Tracking Events (CTE)
- End-to-end traceability plan
- Can trace product back to exact originating block and responsible person

**AgriERP:**
- Production module with batch-level control
- Recipes and processing yields
- Quality grading
- Inventory to Delivery pipeline

**Folio3 Harvest Management:**
- Harvest-specific: yield tracking, crew coordination, truck dispatch, grain quality logging
- Post-harvest: cleaning, milling, grading with output quality data
- Batch tracking mapped to plot, crew, storage location
- Audit-ready traceability records

**What Cloudskraal needs (rooibos-specific):**
```
Production_Batch
  - id, batch_code
  - enterprise (rooibos/wine/wool)
  - source_field_id(s)
  - harvest_date
  - quantity_raw_kg
  - status (harvested, oxidizing, drying, sifting, graded, stored, sold)

Processing_Step
  - id, batch_id (FK)
  - step_type (cutting, oxidation, drying, sifting, grading)
  - start_datetime, end_datetime
  - operator_id (FK)
  - equipment_id (FK)
  - input_quantity, output_quantity
  - loss_percentage
  - quality_notes
  - temperature, humidity (for oxidation/drying)

Grading_Record
  - id, batch_id (FK)
  - grade (per Rooibos Aroma Wheel / Sensory Lexicon)
  - colour_score, aroma_score, flavour_score, density_score
  - length_category
  - moisture_percentage
  - graded_by, graded_date

Storage_Location
  - id, name, type (warehouse, silo, tank)
  - farm_id (FK)
  - capacity, current_fill

Storage_Entry
  - id, batch_id (FK), location_id (FK)
  - date_in, date_out
  - quantity_kg

Sale_Order
  - id, batch_id(s)
  - customer_id (FK)
  - quantity, unit_price, total
  - export_destination
  - ppecb_certificate (for export)
  - shipped_date
```

### 3.4 Equipment & Maintenance Schedules

**Farmbrite (best-in-class for equipment):**
- Equipment register: tractors, implements, wash stations, storage locations, tools
- Maintenance logs with service records
- Fuel consumption tracking
- Preventative service scheduling with automated reminders
- Depreciation tracking
- Equipment usage logs
- Cleaning records (important for food safety compliance)
- Compliance audit support

**AgriERP:**
- Asset management: machinery, land, irrigation systems
- Depreciation calculations
- Total asset value tracking

**Common Data Model:**
```
Equipment
  - id, name, code
  - type (tractor, implement, vehicle, processing_equipment)
  - farm_id (FK)
  - make, model, year
  - purchase_date, purchase_price
  - depreciation_method, useful_life, salvage_value
  - current_value
  - status (active, maintenance, retired)
  - next_service_date
  - hours_meter / odometer

Maintenance_Log
  - id, equipment_id (FK)
  - type (scheduled, breakdown, cleaning)
  - date, description
  - cost
  - performed_by
  - next_due_date or next_due_hours
  - parts_used (JSON or related table)

Equipment_Usage
  - id, equipment_id (FK)
  - date, hours_used
  - activity_id (FK) — links to what work was done
  - field_id (FK) — where
  - operator_id (FK) — who
  - fuel_consumed_litres
```

### 3.5 Inputs (Fertilizer, Chemicals, Feed) & Inventory

**Farmbrite:**
- Real-time inventory tracking integrated across operations
- Linked to harvests, treatments, feedings, inputs
- Low inventory notifications
- Expiration date alerts
- Capacity forecasting

**Donkerhoek Data (SA-specific):**
- Chemical products setup in Spray Module
- Fertilizer products in Fertilizer Module
- Fertigation tracking (fertilizer through irrigation)
- Usage tracked per block

**AgriERP:**
- Never run out tracking: crop inputs, equipment, fuel
- Usage, storage, restocking with real-time tracking

**Common Data Model:**
```
Input_Product
  - id, name, code
  - category (fertilizer, herbicide, pesticide, fungicide, feed, seed, fuel, other)
  - unit_of_measure
  - active_ingredients
  - withholding_period_days
  - re_entry_interval_hours
  - supplier_id (FK)
  - cost_per_unit
  - storage_requirements

Inventory_Stock
  - id, product_id (FK)
  - location_id (FK)
  - quantity_on_hand
  - batch_number
  - expiry_date
  - last_updated

Inventory_Transaction
  - id, product_id (FK)
  - type (purchase, usage, adjustment, transfer, disposal)
  - date, quantity
  - unit_cost
  - related_activity_id (FK) — what it was used for
  - field_id (FK) — where applied
  - recorded_by
```

### 3.6 Employees & Labor Allocation

**Farmbrite (best-in-class):**
- Mobile clock-in/out
- Hours tracked by field, task, crop, or project
- Automatic timesheet-to-project linking
- Payroll simplification
- Wage compliance reporting
- Labor cost visibility and efficiency metrics

**AgriERP:**
- HR module with accounting integration
- Payroll generation, tax calculation
- Timecard tracking with no manual entry

**Conservis/Traction:**
- Know who's doing what, when, where from mobile devices
- Work order assignment and tracking

**Common Data Model:**
```
Employee
  - id, name, id_number
  - type (permanent, seasonal, contractor)
  - department_id (FK)
  - role, hourly_rate or monthly_salary
  - start_date, end_date
  - status (active, inactive)
  - farm_id (FK) — primary assignment

Time_Entry
  - id, employee_id (FK)
  - date, clock_in, clock_out
  - hours_worked
  - activity_type (field_work, processing, maintenance, admin)
  - field_id (FK) — optional
  - enterprise_id (FK) — for cost allocation
  - task_id (FK) — optional
  - notes

Department
  - id, name
  - farm_id (FK)
  - manager_id (FK)
```

### 3.7 Financial Integration (Revenue by Enterprise, Cost Allocation)

**Figured (gold standard):**
- Enterprise-level profitability: allocate indirect income/expenses to crop seasons or production centres
- Automated allocator rules
- Break-even calculations per enterprise
- Field-level profitability
- Metrics: $/bushel, $/cwt milk solids, $/lb livestock
- Livestock valuations flowing to P&L and balance sheet
- Scenario modeling (10 years)
- Integrations: Xero, QuickBooks, MYOB

**Bushel Farm:**
- P&L at farm, crop, and field level
- Cost of production per crop

**AgriWebb:**
- Livestock cost of production
- Gross margin per mob/enterprise
- Paddock cost of production reports

**Key Financial Concept — Enterprise Accounting:**
A farm is divided into enterprises (business units). All revenue and costs are allocated to enterprises. Shared costs (admin, vehicles, management salaries) are allocated via rules (by hectare, by revenue, by headcount, etc.).

**Common Data Model:**
```
Enterprise
  - id, name (e.g., "Rooibos", "Wine/Grapes", "Sheep/Wool")
  - farm_id (FK)
  - type (crop, livestock, processing, other)
  - budget_year

Financial_Transaction
  - id, date, description
  - type (revenue, expense)
  - amount
  - category (input_costs, labor, equipment, admin, sales, etc.)
  - enterprise_id (FK) — direct allocation
  - field_id (FK) — optional
  - source_reference (invoice number, Xero ID)

Cost_Allocation_Rule
  - id, name
  - source_category (e.g., "Admin salaries")
  - allocation_method (by_hectare, by_revenue, by_headcount, manual_percentage)
  - allocations: [{ enterprise_id, percentage }]

Budget
  - id, enterprise_id (FK), year
  - line_items: [{ category, monthly_amounts[12] }]

Budget_vs_Actual
  - budget_id, period
  - budgeted_amount, actual_amount, variance
```

### 3.8 Compliance & Certifications

**Croptracker (best for audit compliance):**
- 20+ auto-generated GlobalGAP reports for self-auditing
- Spray diary with PHI/REI calculations
- Lot-to-spray-application traceability chain
- FSMA compliance
- MRL (Maximum Residue Limit) compliance verification before product leaves farm

**GlobalGAP IFA Standard Structure:**
1. All Farm Base Module (general requirements)
2. Scope Module (sector-specific: crops, livestock)
3. Sub-scope Module (product-specific guidelines)

**FSSC 22000 Requirements (relevant for rooibos processing):**
- ISO 22000 base + sector-specific prerequisites
- Supply chain mapping (source → final product)
- Batch and lot traceability with unique identifiers
- External audits by accredited certification bodies
- HACCP systems at critical control points

**Rooibos-Specific Compliance:**
- PPECB (Perishable Products Export Control Board) testing before export
- Every bulk batch independently tested
- Food safety, food export, phytosanitary standards
- FSSC 22000 protocols for all processing orders
- Samples of every production batch retained

**SA Wine Industry:**
- IPW (Integrated Production of Wine) — scoring via Donkerhoek Data
- Wine of Origin certification
- WIETA (Wine and Agricultural Ethical Trade Association)

**Common Data Model:**
```
Certification
  - id, name (GlobalGAP, FSSC 22000, IPW, Organic, WIETA)
  - scope (farm, processing_facility, product)
  - certifying_body
  - certificate_number
  - valid_from, valid_to
  - status (active, expired, pending_renewal)

Audit
  - id, certification_id (FK)
  - audit_date, auditor
  - result (pass, conditional, fail)
  - findings, corrective_actions
  - next_audit_date

Compliance_Record
  - id, type (spray_record, chemical_application, withholding_check, temperature_log, cleaning_record)
  - date, details
  - field_id or facility_id (FK)
  - batch_id (FK) — optional
  - recorded_by
  - attachments (photos, documents)
```

---

## 4. South African / Developing World Platforms

### 4.1 Donkerhoek Data (Stellenbosch, SA — 40+ years)

**Modules:**
- **Spray Module** (most used) — chemical product setup, all spray-related functions
- **Fertilizer Module** — hand/spreader and fertigation applications
- **IPW Module** — IPW rating scorecard for wine farms, herbicide/pest/disease reports
- **Pest Monitoring** — per-block pest observation tracking
- **Costing** — per-block cost tracking
- **Income** — per-block revenue tracking

**Compliance:** GlobalGAP, Nature's Choice compliant; continuously updated for regulatory changes

**Assessment:** Strong for wine/grape farms. Block-level management. IPW compliance built in. However, no livestock module, no processing workflow, no equipment/employee management. Desktop-era software.

### 4.2 BenguFarm (BenguelaSoft, SA — since 2005)

**Modules:** Beef Cattle, Sheep & Goats, Game, Pigs, Genetics (breeding)

**Sheep & Goat Features:**
- Automatic reproduction calculations: age at first lambing, inter-lambing periods, days since last lambing
- Expected lambing dates using species-specific parameters and flock-specific settings
- Key metrics: pregnancy %, lambing %, weaning %, average lambs per lambing, % singles/twins/triplets
- Wool traits: adjusted weights, growth per day, growth indexes
- Conformation and wool scores
- EID integration
- Mobile app (Android + iOS)
- Optional Genetics module for best-mating calculations

**Assessment:** Best South African livestock software for sheep specifically. Wool trait tracking is directly relevant. Breeding and reproduction calculations match Cloudskraal's sheep enterprise. However, no crop management, no financial integration, no processing workflows.

### 4.3 HerdMASTER (LRF, SA)

- 30 years of development
- Stud cattle, commercial cattle, sheep/small stock, or combinations
- Breed association integration

### 4.4 Plan-A-Head (SA — 30+ years)

- Agricultural market focus
- Decision support based on actual farm data
- Long-standing SA presence

---

## 5. Compliance & Certification Systems

### Requirements by Cloudskraal Enterprise

| Enterprise | Certifications | Key Requirements |
|-----------|---------------|-----------------|
| Rooibos | FSSC 22000, GlobalGAP, PPECB export | Batch traceability, HACCP, chemical records, processing logs, grading records, export testing |
| Wine/Grapes | IPW, Wine of Origin, GlobalGAP, WIETA | Spray diary, block records, IPW scorecard, ethical trade compliance |
| Sheep/Wool | NWGA standards, possible organic | Flock health records, shearing records, wool classification, animal welfare |

### Data Required for Compliance

**Chemical Application Records (all enterprises):**
- Product name, active ingredient, registration number
- Application date, rate, volume, method
- Target pest/disease
- Operator name
- Weather conditions at application
- Pre-harvest interval (PHI) remaining
- Re-entry interval (REI) remaining

**Batch Traceability (rooibos + wine):**
- Unique batch/lot identifier
- Source field(s) and harvest date(s)
- All processing steps with timestamps
- All inputs used at each step
- Storage locations and durations
- Quality test results
- Final destination (customer, export country)

---

## 6. Dashboard & KPI Patterns

### What Top-Level Dashboards Show

Based on research across platforms, the ideal farm dashboard shows:

**Financial Overview:**
- Total revenue (MTD, YTD, forecast)
- Total expenses (MTD, YTD, vs budget)
- Net profit/loss by enterprise
- Cash flow forecast (30/60/90 days)
- Budget variance alerts

**Production Overview:**
- Current season progress (e.g., harvest completion %)
- Yield vs forecast by field/enterprise
- Inventory levels (rooibos in storage, wine in tanks, wool bales)
- Processing throughput (batches in progress)

**Livestock Overview:**
- Total head count by species/class
- Upcoming events (lambing, shearing, dosing due)
- Mortality rates
- Weight gain trends

**Operational Overview:**
- Tasks due today / overdue
- Equipment status (maintenance alerts)
- Weather forecast
- Employee attendance / hours logged
- Low inventory alerts

**Compliance Overview:**
- Certification expiry dates
- Audit schedule
- Withholding periods in effect
- Overdue compliance records

### Cloudskraal-Specific KPIs

| Enterprise | Key KPIs |
|-----------|----------|
| Rooibos | kg harvested, kg processed, grading distribution, R/kg achieved, export % vs domestic %, FSSC compliance score |
| Wine/Grapes | tons/ha by cultivar, Balling at harvest, R/ton achieved, IPW score |
| Sheep/Wool | lambing %, weaning %, kg wool/head, micron average, R/kg wool, gross margin/SSU |
| Farm-wide | Net profit by enterprise, R/ha by enterprise, labor cost %, equipment utilization %, capex pipeline status |

---

## 7. Proposed Database Entity-Relationship Model

Based on analysis of all platforms, here is a comprehensive entity-relationship model for a Cloudskraal farm management OS.

### Core Entity Groups

#### A. Organization Layer
```
Organization (Cloudskraal Boerderye)
  ├── Farm (Brakfontein, Meulsteenvlei, etc.)
  │     ├── Field/Paddock/Block (spatial units)
  │     ├── Facility (processing shed, warehouse, shearing shed)
  │     └── Storage_Location (warehouse, silo, tank)
  ├── Enterprise (Rooibos, Wine/Grapes, Sheep/Wool)
  ├── Department (10 departments)
  └── Season/Financial_Year
```

#### B. Land & Spatial Layer
```
Farm
  - id, name, code
  - location (lat, lng)
  - total_hectares
  - region (Northern Cape, Karoo)

Field (Block/Paddock)
  - id, name, code
  - farm_id (FK)
  - enterprise_id (FK)
  - type (rooibos, vineyard, grazing, fallow, natural_veld)
  - area_hectares
  - geometry (GeoJSON polygon)
  - soil_type, slope, aspect
  - irrigation_type (dryland, drip, sprinkler, none)
  - planting_date, cultivar/variety
  - current_status (active, resting, withholding, replanting)

Facility
  - id, name, farm_id (FK)
  - type (tea_court, cellar, shearing_shed, workshop, office, pack_house)
  - capacity
```

#### C. Crop & Production Layer
```
Crop_Season
  - id, field_id (FK), enterprise_id (FK)
  - year, crop_type, cultivar
  - planned_yield, actual_yield
  - status (planning, growing, harvesting, complete)

Crop_Activity
  - id, crop_season_id (FK), field_id (FK)
  - type (planting, spraying, fertilizing, irrigating, pruning, harvesting)
  - date, details
  - input_product_id (FK), quantity_applied
  - equipment_id (FK), operator_id (FK)
  - weather_conditions
  - cost

Harvest_Record
  - id, crop_season_id (FK), field_id (FK)
  - date, quantity_kg
  - quality_notes (Balling for grapes, moisture for rooibos)
  - batch_id (FK) — links to production batch
  - crew_id or employees
```

#### D. Livestock Layer
```
Livestock_Enterprise
  - id, name (e.g., "Merino Breeding Flock", "Trading Lambs")
  - enterprise_id (FK)
  - species (sheep, cattle, goats)
  - breed

Management_Group
  - id, name
  - livestock_enterprise_id (FK)
  - description (e.g., "2025 Ewes", "Replacement Rams")

Mob
  - id, name
  - management_group_id (FK)
  - count
  - current_paddock_id (FK)
  - average_weight

Animal (optional — for stud or individual tracking)
  - id, eid_tag, vid_tag
  - mob_id (FK)
  - species, breed, sex
  - birth_date, birth_type (single, twin, triplet)
  - sire_id, dam_id (self-FK)
  - status (active, sold, deceased, culled)
  - current_weight, condition_score

Livestock_Record
  - id
  - mob_id (FK) and/or animal_id (FK)
  - record_type: ENUM(
      weight, treatment, vaccination, dosing,
      pregnancy_scan, joining, lambing, weaning,
      shearing, movement, sale, purchase, death, cull,
      condition_score, foot_trim
    )
  - date, details (JSON for type-specific data)
  - product_id (FK) — for treatments/vaccinations
  - recorded_by (FK)
  - cost

Shearing_Record (specialized)
  - id, livestock_record_id (FK)
  - mob_id / animal_id
  - date
  - fleece_weight_kg
  - micron
  - yield_percentage
  - vegetable_matter
  - staple_length, staple_strength
  - grade
  - wool_batch_id (FK)

Breeding_Season
  - id, livestock_enterprise_id (FK)
  - year, start_date, end_date
  - rams_used: [animal_ids]
  - ewes_joined_count
  - scanning_results (pregnant %, dry %, singles %, twins %, triplets %)
  - lambing_results (born, survived, weaned)
  - weaning_percentage
```

#### E. Processing & Production Layer (Rooibos-Specific)
```
Production_Batch
  - id, batch_code (e.g., "BF-2026-042")
  - enterprise_id (FK)
  - product_type (rooibos_green, rooibos_oxidized, wine_bulk, wool_clip)
  - source_field_ids (array of FK)
  - harvest_date_range
  - initial_quantity_kg
  - current_quantity_kg
  - status: ENUM(received, processing, graded, stored, sold, shipped)
  - quality_grade
  - created_at, updated_at

Processing_Step
  - id, batch_id (FK)
  - step_number (sequence)
  - step_type: ENUM(
      -- Rooibos: cutting, bruising, oxidation, drying, sifting, grading, packing
      -- Wine: crushing, pressing, fermentation, racking, fining, bottling
      -- Wool: shearing, classing, pressing, baling
    )
  - start_datetime, end_datetime
  - facility_id (FK)
  - equipment_id (FK)
  - operator_id (FK)
  - input_quantity, output_quantity
  - loss_kg, loss_reason
  - parameters (JSON: temperature, humidity, duration, etc.)
  - quality_check_passed (boolean)
  - notes

Quality_Test
  - id, batch_id (FK)
  - test_type (sensory, chemical, physical, microbiological)
  - test_date, tested_by
  - results (JSON: moisture %, colour_score, aroma_score, flavour_score, etc.)
  - pass_fail
  - certificate_number (for PPECB export testing)
  - lab_reference

Grade_Assignment
  - id, batch_id (FK)
  - grade_code (e.g., "Super Fine", "Choice", "Standard" for rooibos)
  - graded_by, graded_date
  - criteria_scores (JSON)
```

#### F. Equipment & Asset Layer
```
Equipment
  - id, name, code
  - type: ENUM(tractor, bakkie, truck, implement, pump, processing_machine, tool)
  - farm_id (FK)
  - make, model, year, serial_number
  - purchase_date, purchase_price
  - depreciation_method, useful_life_years, salvage_value
  - current_book_value
  - status (active, in_maintenance, retired)
  - hour_meter, odometer
  - next_service_due_date, next_service_due_hours
  - insurance_policy, insurance_expiry

Maintenance_Record
  - id, equipment_id (FK)
  - type (scheduled_service, breakdown_repair, cleaning, inspection)
  - date, description
  - cost, parts_used
  - performed_by (internal_employee_id or external_provider)
  - downtime_hours
  - next_due_date, next_due_hours

Equipment_Usage_Log
  - id, equipment_id (FK)
  - date, hours_used
  - operator_id (FK)
  - activity_type
  - field_id (FK)
  - fuel_litres
  - notes
```

#### G. Inventory & Inputs Layer
```
Product_Catalog
  - id, name, code
  - category: ENUM(
      fertilizer, herbicide, pesticide, fungicide, adjuvant,
      animal_feed, animal_remedy, vaccine, supplement,
      fuel, lubricant, seed, packaging, spare_part, other
    )
  - unit_of_measure (kg, L, each)
  - active_ingredients
  - registration_number (L-number for SA chemicals)
  - withholding_period_days
  - re_entry_interval_hours
  - default_supplier_id (FK)
  - reorder_level
  - shelf_life_days

Inventory_Batch
  - id, product_id (FK)
  - location_id (FK)
  - quantity_on_hand
  - batch_number
  - purchase_date, expiry_date
  - unit_cost
  - supplier_id (FK)

Inventory_Transaction
  - id, inventory_batch_id (FK)
  - type: ENUM(purchase, issue, return, adjustment, transfer, disposal, expired)
  - date, quantity, unit_cost
  - issued_to_activity_id (FK)
  - issued_to_field_id (FK)
  - issued_to_enterprise_id (FK)
  - recorded_by (FK)
  - notes
```

#### H. People & Labor Layer
```
Employee
  - id, name, id_number
  - type: ENUM(permanent, fixed_term, seasonal, contractor)
  - department_id (FK)
  - primary_farm_id (FK)
  - role, job_title
  - pay_type: ENUM(monthly_salary, hourly, daily, piece_rate)
  - pay_rate
  - start_date, end_date
  - skills (JSON array)
  - status (active, on_leave, terminated)

Time_Entry
  - id, employee_id (FK)
  - date, start_time, end_time
  - hours_worked, overtime_hours
  - activity_type
  - enterprise_id (FK) — for cost allocation
  - field_id (FK)
  - task_id (FK)
  - piece_count (for piece-rate workers)
  - notes

Leave_Record
  - id, employee_id (FK)
  - type (annual, sick, family_responsibility, maternity)
  - start_date, end_date, days
  - status (requested, approved, rejected)

Seasonal_Crew
  - id, name, leader_id (FK to Employee)
  - season, enterprise_id (FK)
  - member_count
  - start_date, end_date
  - pay_arrangement
```

#### I. Financial Layer
```
Enterprise
  - id, name
  - type: ENUM(rooibos, wine_grapes, sheep_wool, other)
  - farms (many-to-many — an enterprise can span multiple farms)

Financial_Account
  - id, code, name
  - type: ENUM(revenue, cost_of_sales, overhead, capital)
  - enterprise_id (FK) — null for shared costs
  - parent_account_id (self-FK for hierarchy)

Transaction
  - id, date, reference
  - account_id (FK)
  - enterprise_id (FK)
  - field_id (FK) — optional for field-level P&L
  - amount, vat_amount
  - description
  - source (manual, xero_sync, auto_calculated)
  - xero_invoice_id — for integration

Budget
  - id, enterprise_id (FK), financial_year
  - account_id (FK)
  - monthly_amounts: [12 values]
  - notes

Cost_Allocation_Rule
  - id, name
  - source_account_id (FK) — shared cost to allocate
  - method: ENUM(by_hectare, by_revenue, by_headcount, by_percentage, manual)
  - allocations: JSON [{ enterprise_id, percentage }]

Enterprise_Report (materialized/calculated)
  - enterprise_id, period
  - gross_revenue, cost_of_production
  - gross_margin, gross_margin_percentage
  - allocated_overheads
  - net_profit
  - key_metric (R/kg for rooibos, R/ton for grapes, R/SSU for sheep)
```

#### J. Sales & Customer Layer
```
Customer
  - id, name, type (exporter, processor, abattoir, private, auction)
  - contact_details
  - payment_terms
  - certifications_required (e.g., must be FSSC 22000)

Sale
  - id, customer_id (FK)
  - enterprise_id (FK)
  - date, delivery_date
  - items: [{ batch_id, quantity, unit_price, total }]
  - total_amount, vat
  - payment_status
  - export_docs (PPECB cert, phytosanitary cert)
  - invoice_number, xero_invoice_id

Contract
  - id, customer_id (FK)
  - enterprise_id (FK)
  - type (forward_sale, season_contract, standing_order)
  - start_date, end_date
  - agreed_quantity, agreed_price
  - delivery_schedule
  - quality_requirements
```

#### K. Compliance & Certification Layer
```
Certification
  - id, name, standard (GlobalGAP, FSSC_22000, IPW, WIETA, Organic)
  - scope (farm, facility, product, enterprise)
  - farm_id or facility_id (FK)
  - certifying_body
  - certificate_number
  - issue_date, expiry_date
  - status (active, expired, suspended, pending)

Audit
  - id, certification_id (FK)
  - audit_date, auditor_name, auditor_organization
  - type (initial, surveillance, recertification)
  - result (pass, conditional_pass, fail)
  - findings (JSON array of non-conformances)
  - corrective_actions_due_date
  - corrective_actions_status

Compliance_Log
  - id
  - type: ENUM(
      chemical_application, withholding_check,
      temperature_log, cleaning_record, calibration,
      pest_scout, water_test, soil_test
    )
  - date, recorded_by (FK)
  - field_id or facility_id (FK)
  - batch_id (FK) — optional
  - details (JSON)
  - attachments (file references)
  - verified_by, verified_date
```

#### L. Task & Workflow Layer
```
Task
  - id, title, description
  - type: ENUM(field_work, processing, maintenance, admin, compliance)
  - status: ENUM(planned, assigned, in_progress, completed, cancelled)
  - priority (high, medium, low)
  - assigned_to (FK to Employee)
  - farm_id, field_id, equipment_id (optional FKs)
  - enterprise_id (FK)
  - due_date, completed_date
  - created_from (work_order_id, recurring_schedule_id)

Work_Order
  - id, title
  - season_plan_id (FK) — derived from seasonal plan
  - enterprise_id (FK)
  - tasks: [task_ids]
  - status, priority
  - scheduled_date
  - estimated_hours, actual_hours

Recurring_Schedule
  - id, name
  - type (maintenance, compliance_check, dosing, irrigation)
  - frequency (daily, weekly, monthly, quarterly, custom_days)
  - next_due_date
  - auto_create_task (boolean)
  - template_details (JSON)
```

### Entity-Relationship Summary

```
Organization (1) ──── (N) Farm
Farm (1) ──── (N) Field/Paddock
Farm (1) ──── (N) Facility
Farm (1) ──── (N) Storage_Location
Farm (1) ──── (N) Equipment
Farm (N) ──── (N) Enterprise (via Farm_Enterprise junction)

Enterprise (1) ──── (N) Crop_Season
Enterprise (1) ──── (N) Livestock_Enterprise
Enterprise (1) ──── (N) Production_Batch
Enterprise (1) ──── (N) Budget
Enterprise (1) ──── (N) Sale

Field (1) ──── (N) Crop_Activity
Field (1) ──── (N) Harvest_Record

Livestock_Enterprise (1) ──── (N) Management_Group
Management_Group (1) ──── (N) Mob
Mob (1) ──── (N) Animal
Mob/Animal (1) ──── (N) Livestock_Record
Livestock_Record ──── Shearing_Record (1:1 for shearing type)

Production_Batch (1) ──── (N) Processing_Step
Production_Batch (1) ──── (N) Quality_Test
Production_Batch (1) ──── (N) Grade_Assignment
Production_Batch (N) ──── (N) Sale (via Sale_Line_Item)

Equipment (1) ──── (N) Maintenance_Record
Equipment (1) ──── (N) Equipment_Usage_Log

Product_Catalog (1) ──── (N) Inventory_Batch
Inventory_Batch (1) ──── (N) Inventory_Transaction

Employee (1) ──── (N) Time_Entry
Employee (1) ──── (N) Leave_Record
Employee (1) ──── (N) Task (assigned)

Task (N) ──── (1) Work_Order
Work_Order (N) ──── (1) Season_Plan

Certification (1) ──── (N) Audit
Compliance_Log ──── Field/Facility/Batch (polymorphic)
```

---

## 8. Cloudskraal-Specific Requirements

### Enterprise-Specific Workflows

#### Rooibos (62% revenue)
```
Season Plan → Field Preparation → Planting/Replanting
  → Growing Season (fertilizing, pest control, irrigation)
  → Harvest (machine cutting, transport to tea court)
  → Processing:
    1. Bruising/Cutting
    2. Oxidation (fermentation) — temperature + humidity controlled
    3. Drying (sun or mechanical) — target 5-7% moisture
    4. Sifting (separating grades by length/density)
    5. Grading (Rooibos Aroma Wheel: colour, aroma, flavour, density)
    6. Packing & Labeling
  → Storage (tracked by batch, grade, location)
  → Quality Testing (PPECB for export)
  → Sales (export or domestic)
```

#### Wine/Grapes (21% revenue)
```
Vineyard Calendar → Pruning → Growing Season (spray, fertilize)
  → Harvest (measure Balling/sugar)
  → Bulk Wine Production or Grape Sale
  → IPW Compliance Scoring
```

#### Sheep/Wool (16% revenue)
```
Breeding Season → Joining → Pregnancy Scanning
  → Lambing → Marking/Tagging → Weaning
  → Growing (dosing, vaccination, supplementary feeding)
  → Shearing (clip data: weight, micron, yield, VM)
  → Wool Classing & Baling
  → Wool Sale (auction or private)
  → Livestock Sale (auction, private, abattoir)
```

### Multi-Farm Coordination

Cloudskraal operates 4 farms across Northern Cape and Karoo. Key multi-farm requirements:
- **Consolidated dashboard** showing all 4 farms with drill-down
- **Equipment sharing** across farms (tractors, implements moving between farms)
- **Employee allocation** (workers may move between farms seasonally)
- **Inventory transfers** between farm stores
- **Consolidated financial reporting** by enterprise across all farms
- **Per-farm and per-enterprise P&L**

### Integration Requirements

| System | Integration Type | Purpose |
|--------|-----------------|---------|
| Xero | Bi-directional sync | Accounting, invoicing, bank feeds |
| PPECB | Export data | Export compliance certificates |
| Wool Brokers | Data exchange | Clip data, auction results |
| Weather Service | API pull | Forecast, rainfall, temperature |
| Satellite/NDVI | API pull | Crop health monitoring |
| BenguFarm/StockBook | Import/sync | If using existing livestock system |
| Banking | Bank feeds | Transaction matching |
| SARS | Export | Tax submissions |

---

## 9. Gap Analysis: What No Single Platform Covers

### The Fundamental Problem

No single platform on the market handles Cloudskraal's full operation:

| Requirement | Best Platform | Gap |
|-------------|--------------|-----|
| Rooibos field management | Donkerhoek Data | No processing workflow |
| Rooibos processing + traceability | Croptracker / AgriERP | Not rooibos-specific |
| Vineyard management + IPW | Donkerhoek Data | No livestock, no processing |
| Sheep/wool management | BenguFarm or AgriWebb | No crop management |
| Enterprise financial management | Figured | No operational management |
| Equipment + employee management | Farmbrite | Shallow financial depth |
| Compliance/audit management | Croptracker | Crop-only, no livestock |
| Multi-enterprise P&L | Figured | No operational layer |
| Processing batch tracking | AgriERP | Enterprise pricing, overkill |

### Build vs. Buy Assessment

**Option A: Best-of-breed stack**
- BenguFarm (sheep) + Donkerhoek Data (vineyard/spray) + Figured (finance) + custom (rooibos processing)
- Pro: Each tool is strong in its domain
- Con: No unified view, triple data entry, no integration between systems

**Option B: Farmbrite as base + custom extensions**
- Farmbrite covers 70% of needs (livestock, crops, equipment, employees, inventory)
- Need custom: processing workflows, SA compliance, enterprise financial depth
- Pro: Single platform, good foundation
- Con: US-based, no SA compliance, weak financials

**Option C: Custom farm OS**
- Build on the database model proposed in Section 7
- Use the Cloudskraal CapEx app architecture (React/Vite + Express/SQLite or Supabase/Postgres)
- Pro: Perfect fit, SA-specific, rooibos processing built in, Xero integration, grows with business
- Con: Development effort, maintenance burden

**Option D: Hybrid — Xero (finance) + Custom OS (operations) + BenguFarm (livestock genetics)**
- Xero handles accounting/invoicing/bank feeds
- Custom OS handles fields, processing, equipment, employees, inventory, compliance, dashboards
- BenguFarm handles sheep genetics/breeding (if stud operation needed)
- Pro: Leverages Xero ecosystem, custom where needed, specialist livestock genetics
- Con: Still significant custom development

### Recommendation

For Cloudskraal's unique combination of rooibos processing + wine + sheep across 4 farms, **Option D (Hybrid)** is most practical:

1. **Xero** remains the financial backbone (already likely in use or easily adopted in SA)
2. **Custom Farm OS** built progressively, covering:
   - Phase 1: Farm/field/paddock registry, enterprise structure, dashboard
   - Phase 2: Rooibos production batch tracking (the highest-value gap)
   - Phase 3: Livestock records (mob-level initially)
   - Phase 4: Equipment, inventory, employee tracking
   - Phase 5: Compliance/audit management
   - Phase 6: Financial integration (Xero sync, enterprise P&L)
3. **BenguFarm** (optional) for deep sheep genetics if stud breeding is a priority

---

## Sources

### Platforms Researched
- [FarmTrace](https://www.farmtrace.com)
- [Farmbrite](https://www.farmbrite.com) | [Features](https://www.farmbrite.com/farm-management-software) | [Pricing](https://www.farmbrite.com/pricing) | [Equipment](https://www.farmbrite.com/features/equipment-management) | [Employee Time](https://www.farmbrite.com/features/employee-time-tracking) | [Resources](https://www.farmbrite.com/resource-management)
- [Figured](https://www.figured.com) | [Farmers](https://www.figured.com/farmers) | [Pricing](https://www.figured.com/en-us/pricing) | [Planning](https://www.figured.com/en-us/planning-budgeting) | [Valuations](https://help.figured.com/en/articles/779373-monthly-management-valuations)
- [AgriWebb](https://www.agriwebb.com) | [SA Homepage](https://www.agriwebb.com/za/) | [Pricing](https://www.agriwebb.com/pricing/) | [Animal Management](https://www.agriwebb.com/solutions/animal-management/) | [Grazing](https://www.agriwebb.com/solutions/grazing-management/) | [Farm Mapping](https://www.agriwebb.com/solutions/farm-mapping/) | [Enterprises & Groups](https://help.agriwebb.com/en/articles/11409266-enterprises-and-management-groups-mob) | [Mob vs IAM](https://help.agriwebb.com/en/articles/12307944-mob-vs-iam-subscriptions)
- [Conservis / Traction Ag](https://www.tractionag.com/role/advanced-farm-management)
- [Bushel Farm (FarmLogs)](https://bushelfarm.com) | [Farm Management](https://www.bushelpowered.com/agribusiness/solutions/farm-management)
- [StockBook (Outcross Systems)](https://outcrosssystems.com.au/stockbook/)
- [AgriERP](https://agrierp.com/)
- [Croptracker](https://www.croptracker.com) | [GlobalGAP](https://www.croptracker.com/resources/farm-management-software-resources/audits-global-food-safety-initiative-gfsi/global-gap.html) | [Audits](https://www.croptracker.com/product/farm-management-software/audits.html) | [Traceability](https://www.croptracker.com/blog/croptracker-feature-use-case-traceability-and-recall-reports.html)

### South African Platforms
- [Donkerhoek Data](https://donkerhoekdata.com/product/farm-management-software/)
- [BenguFarm](https://www.bengufarm.co.za/) | [Sheep & Goats](https://www.bengufarm.co.za/index.php/sheep)
- [HerdMASTER (LRF)](https://www.lrf.co.za/herdmaster/why-herdmaster/)
- [Plan-A-Head](https://planahead.co.za/)

### Compliance & Industry
- [GlobalGAP Standard](https://www.intertek.com/assurance/globalgap/)
- [FSSC 22000](https://www.fssc.com/fssc-22000/documents/fssc-22000-version-6/)
- [Rooibos Production Process (Klipopmekaar)](https://www.klipopmekaar.co.za/rooibos-farming-production-process/)
- [Rooibos Processing (Klipopmekaar)](https://www.klipopmekaar.co.za/rooibos-tea-processing/)
- [Rooibos Production (Carmien Tea)](https://carmientea.com/rooibos-production-and-processing/)
- [SA Farm Software Tools](https://farmingportal.co.za/index.php/agri-index/74-tegnology/12410-7-farm-management-software-tools-built-in-south-africa-to-help-farmers-work-smarter)

### Database & Architecture
- [Farm Management System ER Diagram](https://www.freeprojectz.com/entity-relationship/farm-management-system-er-diagram)
- [Agriculture System ERD (ResearchGate)](https://www.researchgate.net/figure/Agriculture-System-Entity-Relationship-Diagram_fig1_256817487)
- [Farm KPIs (PerformYard)](https://www.performyard.com/articles/agriculture-performance-indicators)
