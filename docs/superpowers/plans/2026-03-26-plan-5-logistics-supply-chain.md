# Plan 5: Logistics & Supply Chain Integration

> **Status:** Feature backlog — not yet in active development. This spec captures the full vision for MineMarket's logistics layer.

**Goal:** Transform MineMarket from a deal workspace into a full mine-to-end-user supply chain platform by integrating logistics booking, port operations, customs, trade finance, and warehousing.

**Core insight:** A commodity deal involves 8-12 parties beyond buyer and seller. Currently they all coordinate via email/WhatsApp. MineMarket becomes the single pane of glass where every party sees their piece of the puzzle.

---

## The Full Supply Chain — Who's Involved

```
MINE → INLAND TRANSPORT → PORT (LOAD) → OCEAN FREIGHT → PORT (DISCHARGE) → CUSTOMS → WAREHOUSE → END USER

Parties at each stage:
┌─────────────────────────────────────────────────────────────────────────┐
│ MINE          Mining company, trading desk, geologist, lab             │
│ INLAND        Road hauler, rail operator (Transnet), weighbridge       │
│ PORT (LOAD)   Terminal operator (TPT), stevedore, port agent, surveyor │
│ OCEAN         Shipowner, charterer, shipbroker, P&I club, insurer      │
│ PORT (DISCH)  Receiving terminal, port agent, surveyor, stevedore      │
│ CUSTOMS       Customs broker, SARS (SA) or equivalent, clearing agent  │
│ WAREHOUSE     Stockpile manager, quality controller, silo operator     │
│ END USER      Steel mill, smelter, power station, refinery             │
│                                                                         │
│ CROSS-CUTTING:                                                          │
│ Bank (LC/escrow), insurer (cargo/credit), lab (SGS/BV), lawyer        │
└─────────────────────────────────────────────────────────────────────────┘
```

## What MineMarket Currently Covers vs Gaps

| Stage | Current State | Gap |
|-------|--------------|-----|
| Mine → Deal | ✅ Listing, Express Interest, Negotiation | — |
| Deal Management | ✅ 12-state pipeline, documents, milestones, messaging | — |
| Spec Verification | ✅ Lab request (SGS/BV), spec comparison, platform verification | Need lab direct upload API |
| Inland Transport | ⚠️ Rail network data (AfTS-Db), route display | No booking, no truck/rail scheduling |
| Port (Loading) | ⚠️ Port congestion from AIS, weather | No berth booking, no terminal coordination |
| Ocean Freight | ⚠️ Route calculation, freight estimate, AIS tracking | No vessel booking, no fixture note |
| Port (Discharge) | ⚠️ AIS arrival detection | No discharge coordination |
| Customs | ❌ Nothing | No SAD500 generation, no broker integration |
| Trade Finance | ⚠️ Escrow tracking (manual) | No LC, no bank API |
| Warehousing | ❌ Nothing | No stockpile management |
| Insurance | ⚠️ Hedging panel (placeholder) | No cargo insurance, no credit insurance |

---

## Feature Set — Organized by Integration Priority

### Tier 1: Freight Booking (Highest Value, Medium Complexity)

**The "Request Vessel" flow:**

```
Deal reaches ESCROW_HELD
  ↓ Trader clicks "Book Freight" in the Shipping tab
  ↓
FREIGHT TENDER created with:
  - Commodity: Chrome 42% Cr₂O₃
  - Volume: 15,000 tonnes
  - Loading port: Richards Bay (berth 7)
  - Discharge port: Qingdao
  - Laycan: 15-25 April 2026
  - Cargo rate: estimated $18.60/t (from our calculator)
  ↓
OPTION A: Broker Portal
  - Tender visible to registered shipbrokers
  - Brokers respond with vessel + rate + terms
  - Trader selects best offer → fixture note generated

OPTION B: Direct Integration
  - SHIPNEXT API: AI-powered cargo-vessel matching for dry bulk
  - Freightos API: Container and FCL rates (for smaller parcels)
  - SeaRates API: Route + rate calculator (if subscribed)

OPTION C: Manual
  - Trader books externally, uploads fixture note to deal documents
  - Vessel MMSI entered → AIS tracking auto-activates
```

**APIs to integrate:**
| API | What It Does | Pricing |
|-----|-------------|---------|
| [SHIPNEXT](https://shipnext.com/) | Dry bulk cargo-vessel matching, fixture management | Contact for API pricing |
| [Flexport API](https://developers.flexport.com/) | Full logistics: booking, tracking, docs | Enterprise pricing |
| [Freightos/WebCargo](https://www.freightos.com/) | Container rate comparison, booking | Free trial, then subscription |
| [DCSA Port Call 2.0](https://dcsa.org/) | Standard API for port calls, berth allocation | Open standard (free) |

**New UI: "Freight" tab in deal workspace**
```
[Overview] [Documents] [Shipping] [Freight] [Messages]

Freight tab:
┌──────────────────────────────────────────┐
│ FREIGHT STATUS: Vessel Assigned           │
│                                           │
│ Vessel: MV STAR FORTUNE (Supramax)        │
│ MMSI: 636025655 · IMO: 9930598            │
│ DWT: 58,000t · Built: 2019 · Flag: LBR   │
│                                           │
│ Charter Terms:                             │
│ Rate: $17.50/t · Laycan: 15-20 Apr 2026   │
│ Demurrage: $12,000/day · Despatch: $6,000  │
│ Loading: 8,000t/day · Discharge: 6,000t/d  │
│                                           │
│ Documents:                                 │
│ ☑ Fixture Note (uploaded 3 days ago)       │
│ ☐ Charter Party (pending)                  │
│ ☐ Vessel Nomination (pending)              │
│                                           │
│ [Track Vessel] [Upload Charter Party]      │
└──────────────────────────────────────────┘
```

### Tier 2: Inland Transport (Medium Value, Low Complexity)

**Mine-to-port leg coordination:**

```
DEAL → INLAND TRANSPORT
  ↓
Transport Mode: Rail (Transnet) or Road (hauler)
  - Rail: Transnet slot booking (currently phone/email → digitize)
  - Road: Hauler assignment, truck tracking, weighbridge integration

Data we already have:
  - African rail network (6,205 stations, 51,452 segments)
  - Mine locations (4,932 ICMM mines with coordinates)
  - Port locations (11,724 UN/LOCODE)
  - Road routes (Mapbox Directions API)

What to add:
  - "Book Transport" button on deal (rail vs road selector)
  - Estimated inland freight cost ($/t by mode and distance)
  - Hauler/rail slot reference number field
  - GPS tracking integration for trucks (future)
```

**Inland freight cost formula:**
```
Rail: base_rate + (distance_km × $/km/t) + loading_fee + offloading_fee
  Transnet typical: R45-80/t for 300-600km haul

Road: base_rate + (distance_km × $/km/t) + fuel_surcharge
  Typical: R2.50-4.00/t/km for 30t side-tippers
```

### Tier 3: Customs & Clearing (Medium Value, High Complexity)

**SAD500 automation:**

```
DEAL at LOADING status
  ↓
Platform generates draft SAD500 from deal data:
  - Exporter: seller company (from KYC docs)
  - Consignee: buyer company
  - HS Code: auto-assigned from commodity type
  - Value: deal price × volume
  - Origin: South Africa
  - Loading port: from deal

HS Code Mapping:
  Chrome ore: 2610.00
  Manganese ore: 2602.00
  Iron ore: 2601.11 (fines) / 2601.12 (agglomerated)
  Coal: 2701.12 (bituminous) / 2701.19 (other)
  Platinum: 7110.11 (unwrought)
  Gold: 7108.12 (non-monetary)
  Copper cathode: 7403.11

Draft SAD500 → sent to clearing agent via API or PDF
  → Agent files with SARS electronically
  → Status updates fed back to deal milestones
```

**No direct SARS API exists** (they use EDI via licensed clearing agents). Integration approach: partner with a digital clearing agent or build a SAD500 PDF generator from deal data.

### Tier 4: Trade Finance (High Value, High Complexity)

**Letter of Credit flow:**

```
DEAL at SECOND_ACCEPT
  ↓
Buyer's bank issues LC → platform receives confirmation
  ↓
OPTION A: komgo integration
  - Digital LC via blockchain (99.58% faster than traditional)
  - komgo API for LC issuance, amendment, presentation
  - Connected to VAKT for post-trade settlement

OPTION B: Contour Network
  - Blockchain-based LC platform
  - API integration for document presentation
  - Banks: Standard Chartered, HSBC, Citi, ING

OPTION C: Manual
  - Bank issues LC via SWIFT
  - LC reference entered on platform
  - Documents presented digitally through MineMarket
  - Bank releases payment when docs are conforming
```

**Platform value:** MineMarket becomes the document presentation layer. Instead of couriering paper documents to the bank, the trader clicks "Present Documents" and the platform sends the BOL, invoice, COO, and lab report digitally to the bank's system.

### Tier 5: Warehousing & Stockpile (Medium Value, Medium Complexity)

**For commodities stored at port before shipping:**

```
Material arrives at port terminal
  ↓
Stockpile created:
  - Commodity: Chrome 42%
  - Volume: 15,000t
  - Location: Richards Bay, berth 7, stockpile 3A
  - Quality: per lab report
  - Date in: 10 April 2026

Stockpile tracked on platform:
  - Daily depletion as vessel loads
  - Quality degradation monitoring (moisture gain)
  - Storage cost accrual ($2/t/week)
  - Blending opportunities (mix grades to meet spec)
```

**APIs:**
| API | What It Does |
|-----|-------------|
| [DHL WMS API](https://developer.dhl.com/api-reference/warehouse-management) | Warehouse management |
| [Principal Logistics WMS](https://www.principallogisticstechnologies.com/) | Commodity-specific warehousing |
| Terminal Operating Systems (TOS) | Port-specific, varies by operator |

### Tier 6: Insurance (Low Complexity, High Value)

```
DEAL at ESCROW_HELD
  ↓
Insurance options:
  1. Marine Cargo Insurance — covers loss/damage during transit
     - Institute Cargo Clauses A (all risks) / B / C
     - Rate: 0.1-0.3% of cargo value
     - Auto-calculate from route distance + commodity + vessel age

  2. Credit Insurance — covers buyer default
     - Rate: 0.5-2% of deal value
     - Based on buyer's country risk + trust score

  3. P&I Insurance — Protection & Indemnity (vessel owner's responsibility)
     - Not MineMarket's concern, but display vessel's P&I club for transparency
```

---

## Integration Priority Matrix

| Feature | Value to Trader | Complexity | Dependencies | Priority |
|---------|----------------|------------|--------------|----------|
| Freight booking (broker portal) | Very High | Medium | Broker network | **P1** |
| Inland transport estimation | Medium | Low | Already have data | **P1** |
| Vessel nomination + auto AIS tracking | High | Low | AIS already built | **P1** |
| SAD500 PDF generator from deal data | Medium | Medium | HS code mapping | **P2** |
| Insurance cost calculator | Medium | Low | Formula only | **P2** |
| Stockpile tracking | Medium | Medium | Terminal integration | **P3** |
| SHIPNEXT API integration | High | Medium | API partnership | **P3** |
| komgo/Contour LC integration | Very High | Very High | Bank partnerships | **P4** |
| DCSA Port Call 2.0 | Medium | Medium | Port adoption | **P4** |
| Blockchain escrow (L3) | High | Very High | Smart contract audit | **P5** |

---

## How This Fits in the Current UI

```
Deal Workspace Tabs (current + new):

[Overview] [Documents] [Freight] [Shipping] [Finance] [Messages]
                         ↑ NEW    existing    ↑ NEW

Freight tab:
  - Book vessel (broker portal or manual)
  - Inland transport (mine to port)
  - Vessel details + charter terms
  - Demurrage calculator

Finance tab:
  - Escrow status (existing)
  - LC status (new)
  - Insurance (new)
  - Hedging tools (existing placeholder)
  - Payment instructions
```

---

## Revenue Opportunities from Logistics

| Feature | Revenue Model | Potential |
|---------|--------------|-----------|
| Freight booking | Commission on fixture (0.5-1.25% of freight) | $500-2,000 per deal |
| Insurance facilitation | Commission from insurer (10-15% of premium) | $100-500 per deal |
| Trade finance | Referral fee from bank | $200-1,000 per LC |
| Document verification | Per-verification fee from platform | $50-200 per deal |
| Stockpile management | Monthly SaaS fee to terminals | $500-2,000/month |
| Premium data (vessel/port) | Subscription for intelligence | $200-500/month |

**At 100 deals/month with average freight commission:** $50K-200K/month revenue from logistics alone.

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────┐
│                    MineMarket                         │
│                                                       │
│  Deal Workspace ← → Logistics Engine ← → APIs         │
│                                                       │
│  ┌─── Internal ───┐  ┌─── External ───────────────┐  │
│  │ Sea routes      │  │ SHIPNEXT (vessel matching)  │  │
│  │ Freight calc    │  │ Flexport (logistics)        │  │
│  │ Distance engine │  │ Freightos (container rates) │  │
│  │ Port congestion │  │ komgo (trade finance)       │  │
│  │ AIS tracking    │  │ Contour (LC)                │  │
│  │ Weather         │  │ DCSA (port calls)           │  │
│  │ Rail network    │  │ SGS/BV (inspection)         │  │
│  │ Commodity prices│  │ DocuSeal (e-signature)      │  │
│  └─────────────────┘  │ Resend (notifications)      │  │
│                        │ aisstream.io (AIS)          │  │
│                        │ Open-Meteo (weather)        │  │
│                        │ Base L2 (blockchain)        │  │
│                        └────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## Sources & References

- [SHIPNEXT - Dry Bulk Shipping Marketplace](https://shipnext.com/)
- [Flexport Developer API](https://developers.flexport.com/)
- [Freightos - Freight Marketplace](https://www.freightos.com/)
- [DCSA Port Call Standard 2.0](https://dcsa.org/)
- [komgo - Commodity Trade Finance](https://consensys.io/blockchain-use-cases/finance/komgo)
- [Contour Network - Digital Trade](https://www.contour.network/)
- [VAKT - Post-Trade Processing](https://www.vakt.com/)
- [SGS Manganese & Chrome Services](https://www.sgs.com/en-za/services/manganese-and-chrome-ores)
- [SARS SAD500 Declaration](https://www.sars.gov.za/customs-and-excise/goods-declaration/)
- [DHL Warehouse Management API](https://developer.dhl.com/api-reference/warehouse-management)
- [Maersk Mining Logistics](https://www.maersk.com/mining-logistics)
- [Transnet Rail Liberalization](https://www.alg-global.com/blog/logistics/rail-liberalization-south-africa-supply-chains-logistics-strategies)
