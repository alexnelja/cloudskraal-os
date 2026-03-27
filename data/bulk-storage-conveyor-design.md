# Cloudskraal Boerderye — Bulk Rooibos Tea Storage & Conveyor System Design

**Project:** CapEx Register Item #1 — Bulk Storage & Conveyor System
**Location:** Cloudskraal processing facility, near Nieuwoudtville, Northern Cape / Western Cape border
**Date:** March 2026
**Prepared for:** Alex Nel, Cloudskraal Boerderye

---

## 1. System Overview

### Purpose

Move 15 tonnes/day of dry rooibos tea from the existing sifting/grading line into 3 storage hoppers, with a conveying system to elevate and distribute the material. The system must handle rooibos tea's unique properties: lightweight, fibrous, low bulk density (150-200 kg/m3), and dusty during handling.

### Process Flow (words — no image)

```
EXISTING SIFT/GRADING LINE
        |
        v
[Discharge chute from sift] --- product falls by gravity into ---
        |
        v
[COLLECTION HOPPER / SURGE BIN] (small, ~0.5 m3, under sift discharge)
        |
        v
[CONVEYING SYSTEM] --- either bucket elevator (Option A) or pneumatic blower (Option B)
        |
        v
[ELEVATED DISTRIBUTION CONVEYOR or DIVERTER VALVE] (at ~6-8m height)
        |           |           |
        v           v           v
   [BIN 1]     [BIN 2]     [BIN 3]
   (Grade A)   (Grade B)   (Grade C / Bulk)
        |           |           |
        v           v           v
[SLIDE GATE / BUTTERFLY VALVE DISCHARGE]
        |           |           |
        v           v           v
[BAGGING STATION or BULK BAG FILLING]
```

**Operating cycle:** The sifting line grades tea into 2-3 quality categories. Each grade is directed to its designated bin via a diverter valve or manually switched chute. Bins hold 5+ tonnes each (1-2 days of production per grade). Discharge from bins feeds bagging stations below.

### Key Design Parameters

| Parameter | Value |
|-----------|-------|
| Daily throughput | 15 tonnes/day (dry rooibos tea) |
| Operating hours | 4-6 hours/day during season |
| Peak conveying rate | 3-5 t/hr |
| Bulk density (loose) | 150-200 kg/m3 |
| Bulk density (settled/compacted) | 200-250 kg/m3 |
| Particle description | Fibrous, cut tea — 2-15mm pieces, very light, high air resistance |
| Moisture content | 8-12% (dry tea, post-court) |
| Angle of repose | ~35-45 degrees (fibrous, tends to bridge) |
| Elevation required | ~6-8 metres (ground to top of bins) |
| Horizontal distance | ~3-8 metres (sift to bins) |
| Ambient conditions | Hot, dry summers (35-40C); cold winters. Dusty farm environment. |
| Power supply | 3-phase 380V, 50Hz (Eskom) |

### Material Handling Challenges — Rooibos Tea

Rooibos tea is NOT a free-flowing granular material. It is:
- **Fibrous and interlocking** — tends to bridge in hoppers and block narrow openings
- **Very low density** — 150 kg/m3 means large volumes for modest tonnage
- **Dusty** — fine particles separate during handling, creating dust and product loss
- **Abrasion-sensitive** — excessive mechanical handling degrades quality (breaks fibres, creates dust)
- **Hygroscopic** — absorbs moisture readily; must stay dry
- **Food product** — all contact surfaces must be food-grade (stainless steel 304 or food-grade coated mild steel minimum)

These properties strongly influence the choice between mechanical and pneumatic conveying.

---

## 2. Option A: Mechanical System (Bucket Elevator + Conveyors)

### Components

| Item | Description | Specification |
|------|-------------|---------------|
| A1 | Collection hopper under sift | 0.5 m3, SS304, with agitator/vibrator to prevent bridging |
| A2 | Inclined belt conveyor (sift to elevator) | 400mm wide, 3-4m long, food-grade PVC belt, 0.75 kW |
| A3 | Bucket elevator | 200mm x 150mm buckets, centrifugal discharge, 8m lift height, 1.5-2.2 kW |
| A4 | Overhead distribution screw conveyor | 200mm diameter, 6m long, with 3 discharge gates, 1.5 kW |
| A5 | 3x Diverter/slide gates | Manual or pneumatic actuated, SS304 |
| A6 | 3x Storage bins | 30 m3 each (see Section 4) |
| A7 | Dust collection point at elevator head | Ducted to main dust collector |
| A8 | Steel support structure | Hot-dip galvanised, 8m to platform |

### Sizing Calculations

**Conveying rate required:**
- 15 t/day over 5 hours = 3 t/hr average
- Design for 5 t/hr peak (safety factor)
- At 175 kg/m3 bulk density: 5,000 / 175 = 28.6 m3/hr volumetric flow

**Bucket elevator sizing:**
- Belt speed: 1.5-2.0 m/s (centrifugal discharge suitable for light fibrous material)
- Bucket size: 200mm x 150mm x 120mm deep (typical agricultural)
- Bucket spacing: 300mm
- Buckets per metre: 3.3
- Volume per bucket: ~3 litres (fill factor 0.7 for fibrous material = 2.1 L effective)
- At 1.75 m/s belt speed: 3.3 x 2.1 x 1.75 x 3600 / 1000 = 43.6 m3/hr capacity
- Well above 28.6 m3/hr required — provides generous margin
- Motor: 1.5 kW sufficient for 8m lift at this capacity with lightweight material

**Distribution screw conveyor:**
- 200mm (8") diameter screw at 45% fill = 0.45 x pi x 0.1^2 = 0.014 m2 cross-section
- At 60 RPM, pitch = 200mm: linear speed = 0.2 m/s
- Volumetric: 0.014 x 0.2 x 3600 = 10.1 m3/hr — adequate
- Motor: 1.5 kW for 6m length with light material

### Pros — Option A

- **Lower capital cost** (~20-30% cheaper than pneumatic)
- **Lower operating cost** — less power consumption (total ~5 kW vs 15-22 kW for pneumatic)
- **Simpler maintenance** — belt replacement, bearing greasing, basic mechanical skills
- **Gentler on product** — bucket elevator and screw conveyor cause less fibre degradation than pneumatic
- **Visible product flow** — easy to monitor, troubleshoot blockages
- **Available skills** — local farm workshop and agricultural mechanics can maintain
- **Lower dust generation** during conveying (enclosed but not pressurised)

### Cons — Option A

- **Bridging risk** — fibrous tea can bridge in bucket elevator boot and screw conveyor; requires vibrators or agitators
- **More moving parts** — bearings, belts, chains need regular maintenance
- **Height clearance** — bucket elevator is a tall fixed structure requiring steel support
- **Cleaning** — more difficult to clean between grades; screw conveyor retains material in flights
- **Footprint** — physically larger installation than pneumatic ducting

### Estimated Cost — Option A

| Component | Qty | LOW | MID | HIGH | Notes |
|-----------|-----|-----|-----|------|-------|
| Collection hopper (SS304, 0.5 m3, vibrator) | 1 | R25,000 | R40,000 | R60,000 | Local SS fabrication |
| Inclined belt conveyor (400mm x 4m, food-grade) | 1 | R45,000 | R70,000 | R100,000 | Roff or local fabrication |
| Bucket elevator (8m, complete with motor, casing) | 1 | R120,000 | R180,000 | R260,000 | Key item — Roff, Buhler, or import |
| Distribution screw conveyor (200mm x 6m, 3 outlets) | 1 | R60,000 | R95,000 | R140,000 | SS flights, mild steel trough |
| Diverter gates (manual slide) | 3 | R15,000 | R25,000 | R40,000 | SS304, food-grade |
| 3x Storage bins (30 m3 each, see Section 4) | 3 | R270,000 | R420,000 | R600,000 | Major cost item |
| Steel support structure (HDG, 8m, platforms, ladders) | 1 | R120,000 | R200,000 | R300,000 | Structural steel + hot-dip galvanising |
| Dust extraction ducting (from elevator head to collector) | 1 | R15,000 | R25,000 | R40,000 | Mild steel ducting |
| Electrical (motors, VFDs, cabling, DB board) | 1 | R40,000 | R65,000 | R95,000 | See Section 8 |
| Installation labour | 1 | R60,000 | R100,000 | R150,000 | Millwright + rigger, 2-3 weeks |
| Civils (foundations, anchor bolts) | 1 | R40,000 | R65,000 | R100,000 | See Section 9 |
| Commissioning and contingency (10%) | 1 | R81,000 | R129,000 | R189,000 | |
| **TOTAL OPTION A** | | **R891,000** | **R1,414,000** | **R2,074,000** |  |

---

## 3. Option B: Pneumatic System (Cyclone/Blower)

### Components

| Item | Description | Specification |
|------|-------------|---------------|
| B1 | Collection hopper under sift | 0.5 m3, SS304, with rotary airlock valve |
| B2 | Rotary airlock valve (feed) | 250mm, 8-vane, SS rotor, 0.75 kW geared motor |
| B3 | Centrifugal blower | 7.5-11 kW, positive pressure system, ~2,500-3,500 m3/hr at 3-5 kPa |
| B4 | Conveying pipeline | 150mm (6") diameter, mild steel or aluminium, ~15-20m total (including 8m vertical rise) |
| B5 | Diverter valves (in pipeline) | 2x two-way pneumatic diverters to select bin 1, 2, or 3 |
| B6 | 3x Cyclone separators (one per bin) | 600mm diameter, SS304, mounted on top of each bin |
| B7 | 3x Storage bins | 30 m3 each (see Section 4) |
| B8 | Return air filter | Bag filter unit at cyclone exhaust, 0.75 kW fan |
| B9 | Steel support structure | Hot-dip galvanised, for cyclones and pipework |

### System Type Selection

For rooibos tea, a **dilute-phase positive pressure** pneumatic system is appropriate:
- Air velocity: 18-22 m/s (sufficient for fibrous material, not so fast it damages product)
- Solids loading ratio: 3-6 (low, because rooibos is very light and bulky)
- Pressure drop: 3-5 kPa for this short distance (low pressure system)

**Blower sizing:**
- Pipe diameter: 150mm (6")
- Air velocity: 20 m/s
- Air volume: pi x 0.075^2 x 20 = 0.354 m3/s = 1,273 m3/hr
- At 5 kPa, with losses: specify 2,500 m3/hr blower at 5 kPa
- Motor: 7.5-11 kW centrifugal blower (Howden, Mapner, or Reitz SA)

**Rotary airlock sizing:**
- 5 t/hr at 175 kg/m3 = 28.6 m3/hr = 0.48 m3/min
- 250mm airlock at 15 RPM: adequate capacity
- Must have adjustable speed to control feed rate

### Pros — Option B

- **Enclosed, dust-free transfer** — all material contained in pipe; very clean operation
- **Flexible routing** — pipes can go around corners, over obstacles; easier layout in cramped spaces
- **Easy to clean** — blow air through empty system to purge between grades
- **Small footprint** — pipes instead of conveyors; less structural steel
- **Self-cleaning** — air velocity prevents build-up in pipes
- **Good for food safety/FSSC 22000** — fully enclosed, minimal contamination risk

### Cons — Option B

- **Higher power consumption** — 7.5-11 kW blower vs ~5 kW total for mechanical system; running 4-6 hrs/day
- **Product degradation** — air velocity breaks fibrous rooibos tea, creating more dust and fines; reduces premium grade yield
- **Noise** — centrifugal blower is loud (85-95 dBA); needs silencer or separate housing
- **Higher capital cost** — rotary airlock, blower, cyclones, and diverter valves are expensive
- **Specialist maintenance** — rotary airlock valve clearances, blower bearings, pipeline wear at bends
- **Blockage risk** — fibrous material can plug at bends and airlock; pipeline design is critical
- **Airlock leakage** — rooibos fibres catch in airlock vanes, causing air leakage and reduced efficiency

### Estimated Cost — Option B

| Component | Qty | LOW | MID | HIGH | Notes |
|-----------|-----|-----|-----|------|-------|
| Collection hopper (SS304, 0.5 m3) | 1 | R25,000 | R40,000 | R60,000 | Same as Option A |
| Rotary airlock valve (250mm, SS rotor) | 1 | R35,000 | R55,000 | R80,000 | Imported component typically |
| Centrifugal blower (7.5-11 kW, complete) | 1 | R60,000 | R100,000 | R150,000 | Howden, Mapner, Reitz, or import |
| Conveying pipeline (150mm, 20m total, bends, supports) | 1 | R30,000 | R50,000 | R75,000 | Mild steel schedule 40 or aluminium |
| Diverter valves (2-way pneumatic, 150mm) | 2 | R30,000 | R50,000 | R80,000 | Imported or Roff |
| Cyclone separators (600mm SS304) | 3 | R60,000 | R105,000 | R150,000 | R20-50K each, local SS fabrication |
| Return air filter (bag filter unit) | 1 | R25,000 | R45,000 | R70,000 | Polyester bags, mild steel housing |
| 3x Storage bins (30 m3 each) | 3 | R270,000 | R420,000 | R600,000 | Same as Option A |
| Steel support structure (HDG, lighter than Option A) | 1 | R80,000 | R130,000 | R200,000 | Less structural steel needed |
| Electrical (blower motor, VFD, airlock, controls) | 1 | R55,000 | R90,000 | R130,000 | Higher due to larger motor + VFD |
| Silencer for blower | 1 | R8,000 | R15,000 | R25,000 | Inlet/outlet silencers |
| Installation labour | 1 | R70,000 | R120,000 | R180,000 | Specialist pneumatic installer, 3-4 weeks |
| Civils (foundations, anchor bolts) | 1 | R35,000 | R55,000 | R85,000 | Lighter structure, smaller foundations |
| Commissioning and contingency (10%) | 1 | R78,000 | R128,000 | R189,000 | |
| **TOTAL OPTION B** | | **R861,000** | **R1,403,000** | **R2,074,000** |  |

---

## 4. Hopper/Bin Design — 3 x Storage Bins

### Sizing

| Parameter | Value |
|-----------|-------|
| Required capacity per bin | 5 tonnes minimum |
| Bulk density (design) | 175 kg/m3 (conservative mid-point) |
| Volume required per bin | 5,000 / 175 = 28.6 m3 minimum |
| **Design volume per bin** | **30 m3** (provides 10% headroom + ullage for filling) |
| Number of bins | 3 |
| Total storage volume | 90 m3 |
| Total storage capacity | ~15.75 tonnes (at 175 kg/m3) — one full day's production |

### Bin Geometry

**Recommended: Rectangular/square bins with mass-flow hopper bottoms.**

Round silos are standard for grain but poorly suited to fibrous rooibos tea because:
- Rooibos bridges across circular openings
- Funnel-flow in round silos causes "ratholing" (centre empties, sides stick)
- Square/rectangular bins with steep, smooth walls and large rectangular outlets are better for fibrous materials

**Dimensions per bin:**

| Dimension | Value |
|-----------|-------|
| Cross-section | 2.5m x 2.5m (square) |
| Straight side height | 4.0m |
| Volume (straight section) | 2.5 x 2.5 x 4.0 = 25 m3 |
| Hopper section (pyramid, 60-degree walls) | ~0.72m height, ~5.2 m3 volume |
| **Total volume per bin** | **~30 m3** |
| Overall height (bin only) | ~4.7m |
| Outlet size | 500mm x 500mm minimum (critical for fibrous material — do NOT go smaller) |
| Hopper half-angle | 30 degrees from vertical (60 degrees steep — required for mass flow with fibrous tea) |

### Construction

| Component | Specification |
|-----------|---------------|
| Bin walls | 3mm mild steel plate, hot-dip galvanised internally OR 2mm SS304 (preferred for food grade) |
| Internal finish | Smooth — no ledges, welds ground flush, 2B finish SS or food-grade epoxy paint on mild steel |
| Hopper section | 3mm SS304 plate, polished internally (Ra < 0.8 um) to prevent sticking |
| Stiffeners | External angle iron or channel stiffeners (not internal — would trap product) |
| Outlet | 500mm x 500mm with flanged connection |
| Discharge valve | Slide gate (manual) or pneumatic butterfly valve for automated control |
| Bin vents | Mesh-covered vent on top to allow air displacement during filling/emptying |
| Access | Hinged inspection hatch on side (500mm x 500mm) for cleaning |
| Level indication | Rotary paddle level switch (full) + vibrating fork (low) — simple, robust for fibrous material |

### Anti-Bridging Measures (Critical for Rooibos)

Rooibos tea WILL bridge in bins if not addressed. Required measures:
1. **Steep hopper walls** — 30 degrees from vertical minimum (mass-flow design)
2. **Large outlet** — 500mm x 500mm minimum; 600mm preferred
3. **Smooth internal surfaces** — polished SS or food-grade PTFE lining in hopper zone
4. **Bin vibrators** — one pneumatic or electric vibrator per bin, mounted on hopper section. Martin Engineering or Oli Vibrators (SA distributor: Vibramech). Budget R5,000-R10,000 per vibrator.
5. **Air pads/fluidisation** — optional: compressed air injection pads in hopper cone to fluidise bridged material. Adds R8,000-R15,000 per bin but very effective.

### Cost per Bin

| Component | LOW | MID | HIGH |
|-----------|-----|-----|------|
| Bin fabrication (2.5m x 2.5m x 4.7m, mild steel HDG, SS hopper) | R65,000 | R110,000 | R160,000 |
| Discharge gate (slide gate, manual) | R5,000 | R10,000 | R15,000 |
| Bin vibrator (electric) | R5,000 | R8,000 | R12,000 |
| Level switches (2 per bin) | R5,000 | R8,000 | R12,000 |
| Access hatch, vent, fittings | R3,000 | R5,000 | R8,000 |
| Erection (per bin) | R7,000 | R12,000 | R15,000 |
| **Per bin** | **R90,000** | **R153,000** | **R222,000** |
| **3 bins total** | **R270,000** | **R459,000** | **R666,000** |

**Note:** If budget is very tight, bins can be fabricated from mild steel with food-grade epoxy internal coating instead of SS304 hopper lining. This saves ~R15-25K per bin but requires recoating every 3-5 years.

---

## 5. Conveyor Specifications

### Option A Conveyors

#### 5.1 Inclined Belt Conveyor (Sift to Elevator)

| Parameter | Value |
|-----------|-------|
| Type | Troughed belt conveyor, food-grade PVC/PU belt |
| Width | 400mm |
| Length | 3-4m (depending on layout) |
| Inclination | 15-20 degrees maximum (rooibos slides on steep inclines) |
| Belt speed | 0.5-1.0 m/s |
| Capacity at 0.75 m/s | ~12 m3/hr (sufficient for 5 t/hr) |
| Motor | 0.75 kW, 3-phase, flange-mounted gearmotor |
| Drive | Head-drive with lagged pulley |
| Belt type | 2-ply PVC white food-grade, 2mm top cover |
| Skirting | Rubber skirting at feed point, 600mm long |
| Cleaning | Return-side belt scraper |

#### 5.2 Bucket Elevator

| Parameter | Value |
|-----------|-------|
| Type | Centrifugal discharge, continuous bucket belt elevator |
| Casing | Mild steel powder-coated (food-grade) or SS304 |
| Belt | 200mm wide, rubber/PVC, bolt-on buckets |
| Buckets | 200mm x 150mm x 120mm, plastic (HDPE) — gentle on product |
| Bucket spacing | 300mm |
| Lift height | 8m (ground level to distribution conveyor inlet) |
| Belt speed | 1.5-2.0 m/s |
| Capacity | ~40 m3/hr (well above 29 m3/hr requirement) |
| Motor | 1.5-2.2 kW, 3-phase |
| Boot section | Extended boot with large opening (400mm x 300mm) to prevent bridging |
| Head section | Enclosed, with dust extraction port |
| Access | Inspection doors at boot and head |
| Safety | Belt alignment sensor, speed sensor (zero-speed switch), boot blockage sensor |

#### 5.3 Distribution Screw Conveyor (Overhead)

| Parameter | Value |
|-----------|-------|
| Type | U-trough screw conveyor (not tubular — easier to clean) |
| Diameter | 200mm (8 inch) |
| Length | 6m (spanning over 3 bins, ~2m centres) |
| Trough | Mild steel with SS304 contact surfaces, or full SS304 |
| Screw flights | SS304, standard pitch (200mm) |
| Hanger bearings | UHMWPE (food-grade, self-lubricating) — NOT grease-lubricated |
| Speed | 40-80 RPM (variable via VFD) |
| Motor | 1.5 kW, 3-phase, with VFD |
| Fill factor | 30-45% (low fill for fibrous material) |
| Discharge | 3x slide gates in trough bottom, one above each bin |
| Capacity | ~10-15 m3/hr at 60 RPM — adequate |

### Option B — No Conveyors

Pneumatic system replaces all mechanical conveyors with pipeline. The only "conveyor" component is the rotary airlock valve at the feed point. Pipeline specification:

| Parameter | Value |
|-----------|-------|
| Pipe diameter | 150mm (6") |
| Material | Mild steel schedule 40, or aluminium alloy (lighter, no rust) |
| Total length | ~20m (including 8m vertical rise, 2 x 90-degree bends, horizontal runs) |
| Bend radius | 8-10 x pipe diameter (1.2-1.5m radius) — long-radius bends critical to prevent blockage and fibre damage |
| Couplings | Flanged or cam-lock for easy disassembly and cleaning |
| Air velocity | 18-22 m/s (dilute phase) |

---

## 6. Integration with Existing Sifting/Grading Line

### Current State (Based on Farm Data)

The existing sift is a ~15 kW vibrating screen/rotary sifter that grades dry rooibos into 2-3 fractions:
- **Grade A** — fine, premium cut (majority of product)
- **Grade B** — coarser cut, secondary grade
- **Dust/fines** — very fine particles, sold separately or blended

Currently, sifted tea likely falls into bags or bins manually handled by workers. The conveyor system must connect to the sift discharge(s).

### Integration Approach

1. **Identify sift discharge point(s):** The sifter will have 1-3 discharge chutes depending on how many screen decks are installed. Each grade exits at a different point.

2. **Option 1 — Single-stream handling (simpler, recommended for Phase 1):**
   - All graded tea from the sift is combined into one collection hopper
   - Conveyed as a single stream to bins
   - Bins are filled one at a time (switch diverter gate when grade changes)
   - The sift operator signals grade change; the diverter is manually switched
   - Pros: simpler system, one elevator, one conveyor
   - Cons: requires manual coordination; risk of cross-contamination between grades if not purged

3. **Option 2 — Multi-stream (if sift has multiple simultaneous discharges):**
   - Separate collection hopper under each sift discharge
   - Separate conveyor to each bin
   - Only viable if the sift produces multiple grades simultaneously from one pass
   - Much more expensive (3x everything) — unlikely justified at 15 t/day

**Recommended: Option 1 (single-stream).** The sift processes one grade at a time or can be batch-sequenced. One conveying line with a 3-way diverter to bins is sufficient.

### Physical Connection

- A **transition chute** (SS304, flanged) connects the sift discharge spout to the collection hopper
- The collection hopper sits directly below the sift discharge — requires 600-800mm clearance below the sift
- If the sift is too low to the ground, a **pit** may be needed for the collection hopper and elevator boot, OR the sift must be raised on a platform (R20-40K additional)
- Flexible connection (canvas or silicone sleeve) between sift and chute to isolate vibration
- Dust seal at the connection point — slight negative pressure from dust extraction prevents fugitive dust

### Electrical Integration

- The conveyor system should be **interlocked** with the sift:
  - Sift running = conveyor system enabled
  - Sift stopped = conveyor continues for 60 seconds (purge), then stops
  - Bin full (high level) = alarm + automatic stop of conveyor feeding that bin
- This requires a small PLC or relay logic panel (R15-25K)

---

## 7. Dust Collection System

### Context

Dust is generated at several points:
1. **Sift operation** — primary dust source (existing problem — R100K budget allocated separately for sift dust collection upgrade)
2. **Conveyor transfer points** — elevator boot, elevator head, screw conveyor loading
3. **Bin filling** — displaced air carries dust as bin fills
4. **Bin discharge** — minor

### Recommended System: Cyclone Pre-Separator + Bag Filter

This is the standard approach for tea/agricultural dust in South Africa.

#### Layout

```
Dust pickup points (hoods/enclosures at transfer points)
        |
   [Ducting network] --- 150-200mm diameter galvanised steel
        |
        v
   [CYCLONE PRE-SEPARATOR] --- removes 80-90% of coarse dust (>10 micron)
   (Collected dust returned to product stream or bagged separately)
        |
        v
   [BAG FILTER UNIT] --- removes fine dust (<10 micron) to <5 mg/m3 exhaust
   (Collected dust bagged for disposal or sale as low-grade product)
        |
        v
   [EXHAUST FAN] --- 3-5 kW centrifugal fan
        |
        v
   [ATMOSPHERE] --- clean air discharge
```

#### Specification

| Component | Specification | Estimated Cost |
|-----------|---------------|----------------|
| Cyclone pre-separator (800mm dia, mild steel) | 2,000-3,000 m3/hr, 4-6 kPa drop | R15,000-R30,000 |
| Bag filter unit (12-16 bags, polyester) | 2,000-3,000 m3/hr, pulse-jet cleaning | R35,000-R65,000 |
| Exhaust fan (centrifugal, 3-5 kW) | Backward-curved, spark-resistant | R15,000-R30,000 |
| Ducting (150-200mm, galvanised, 20-30m total) | Including bends, branches, blast gates | R20,000-R40,000 |
| Hoods and enclosures at pickup points | 4-6 locations | R10,000-R20,000 |
| Rotary airlock under cyclone (dust return) | 200mm | R15,000-R25,000 |
| Installation | Ductwork fitting, commissioning | R15,000-R30,000 |
| **Conveyor dust collection total** | | **R125,000-R240,000** |

#### Important Note on the R100K Sift Dust Budget

The R100K budgeted separately for the sift dust collection upgrade should be treated as a **combined project** with the conveyor dust collection. Reasons:
- The dust extraction fan and bag filter can serve both the sift and the conveyor system
- One larger system is more efficient and cheaper than two separate small systems
- Recommend combining the R100K sift dust budget with the conveyor dust extraction into one integrated system

**Combined dust collection budget: R100K (sift) + R125-240K (conveyor) = R225-340K total**
Or, if designed as one integrated system from scratch: **R150-250K total** (shared fan, filter, cyclone).

---

## 8. Electrical Requirements

### Total Connected Load

#### Option A (Mechanical)

| Equipment | Motor (kW) | VFD? | Notes |
|-----------|-----------|------|-------|
| Inclined belt conveyor | 0.75 | No (DOL start) | Small motor, no VFD needed |
| Bucket elevator | 2.2 | Yes | Soft-start and speed control |
| Distribution screw conveyor | 1.5 | Yes | Variable speed for different feed rates |
| Bin vibrators (3x) | 0.5 each = 1.5 | No | Intermittent, timer-controlled |
| Dust extraction fan | 4.0 | No (DOL or star-delta) | Constant speed |
| Lighting (work platforms) | 0.5 | No | LED flood |
| Controls (PLC/relays) | 0.2 | — | Control panel |
| **Total connected** | **~10.7 kW** | | |
| **Maximum demand** | **~8 kW** | | Not all running simultaneously at full load |

#### Option B (Pneumatic)

| Equipment | Motor (kW) | VFD? | Notes |
|-----------|-----------|------|-------|
| Centrifugal blower | 11.0 | Yes | Major power consumer — VFD essential for control |
| Rotary airlock valve | 0.75 | Yes | Variable speed for feed rate control |
| Dust extraction fan | 4.0 | No | Constant speed |
| Bin vibrators (3x) | 1.5 | No | Intermittent |
| Return air fan | 0.75 | No | At bag filter |
| Lighting | 0.5 | No | |
| Controls | 0.2 | — | |
| **Total connected** | **~18.7 kW** | | |
| **Maximum demand** | **~15 kW** | | Blower dominates |

### Electrical Distribution

| Item | Specification | Cost |
|------|---------------|------|
| Distribution board (new, for conveyor system) | 12-way, 3-phase, 63A main breaker, earth leakage | R8,000-R15,000 |
| VFDs (Option A: 2x small / Option B: 1x 11kW + 1x 0.75kW) | IP55 enclosed, EMC filter | R20,000-R45,000 |
| Motor protection (MCCBs, overloads) | Per motor | R8,000-R15,000 |
| Cabling (SWA armoured, 3-phase to each motor) | 4mm2 to 16mm2, 50-80m total | R15,000-R25,000 |
| Control panel (PLC or relay logic, interlocks, E-stops) | IP55, with local start/stop at each drive | R15,000-R30,000 |
| Emergency stops (pull-wire on conveyor, mushroom at stations) | 4-6 units | R5,000-R8,000 |
| Earthing and lightning protection | Earth rods, bonding | R5,000-R10,000 |
| Electrician installation labour | Qualified 3-phase electrician, CoC | R15,000-R25,000 |
| **Electrical total (Option A)** | | **R91,000-R173,000** |
| **Electrical total (Option B)** | | **R106,000-R198,000** |

### Power Supply Confirmation

- Existing 3-phase Eskom supply must have sufficient spare capacity for additional 10-19 kW
- If existing supply is 40-63A 3-phase (typical farm), there should be ample spare capacity
- Check with Eskom/electrician that the farm's notified maximum demand is not exceeded
- No Eskom upgrade expected to be needed for this load

---

## 9. Civil Works

### Foundations

| Item | Specification | LOW | MID | HIGH |
|------|---------------|-----|-----|------|
| Elevator foundation (reinforced concrete pad) | 1.5m x 1.5m x 600mm deep, with anchor bolts | R12,000 | R18,000 | R25,000 |
| Bin foundations (3x reinforced concrete pads) | 3.0m x 3.0m x 400mm each, on compacted G5 | R30,000 | R48,000 | R72,000 |
| Conveyor/structure foundations (strip footings) | Per layout | R8,000 | R15,000 | R22,000 |
| Ground slab (under bins, for bagging area) | 30 m2, 150mm reinforced concrete | R15,000 | R25,000 | R40,000 |
| **Foundations total** | | **R65,000** | **R106,000** | **R159,000** |

### Steel Structure

| Item | Specification | LOW | MID | HIGH |
|------|---------------|-----|-----|------|
| Main support structure (bins + elevator/cyclone) | Hot-dip galvanised mild steel, portal frame or lattice columns, ~8m to top of bins | R80,000 | R140,000 | R220,000 |
| Access platforms (at bin top for inspection, at screw conveyor) | Galvanised grating, 2 levels, ~15 m2 total | R25,000 | R45,000 | R65,000 |
| Ladders with safety cages | 2x vertical ladders, ~8m each | R15,000 | R25,000 | R40,000 |
| Handrails and kickplates | Around all platforms, per SANS 10400 | R10,000 | R18,000 | R28,000 |
| **Steel structure total** | | **R130,000** | **R228,000** | **R353,000** |

### Site Works

| Item | LOW | MID | HIGH |
|------|-----|-----|------|
| Site clearing and levelling (small area, ~100 m2) | R5,000 | R10,000 | R15,000 |
| Stormwater drainage (away from bins) | R5,000 | R10,000 | R15,000 |
| Electrical trench/conduit to new DB | R5,000 | R8,000 | R12,000 |
| **Site works total** | **R15,000** | **R28,000** | **R42,000** |

### Total Civil Works

| | LOW | MID | HIGH |
|--|-----|-----|------|
| **Civil works total** | **R210,000** | **R362,000** | **R554,000** |

---

## 10. Consolidated Cost Estimate (ZAR)

### Option A — Mechanical (Bucket Elevator + Conveyors) — RECOMMENDED

| Category | LOW | MID | HIGH |
|----------|-----|-----|------|
| Collection hopper | R25,000 | R40,000 | R60,000 |
| Inclined belt conveyor | R45,000 | R70,000 | R100,000 |
| Bucket elevator (8m) | R120,000 | R180,000 | R260,000 |
| Distribution screw conveyor (6m, 3 outlets) | R60,000 | R95,000 | R140,000 |
| Diverter gates (3x) | R15,000 | R25,000 | R40,000 |
| **3x Storage bins (30 m3 each, complete)** | **R270,000** | **R459,000** | **R666,000** |
| Dust collection (conveyor points only) | R125,000 | R185,000 | R240,000 |
| Electrical (DB, VFDs, cabling, controls) | R91,000 | R130,000 | R173,000 |
| Steel structure (support, platforms, ladders) | R130,000 | R228,000 | R353,000 |
| Civil works (foundations, slab, site) | R80,000 | R134,000 | R201,000 |
| Installation labour (mechanical + rigging) | R60,000 | R100,000 | R150,000 |
| Transport to Nieuwoudtville (remote premium) | R20,000 | R35,000 | R55,000 |
| Design, project management, commissioning | R40,000 | R70,000 | R110,000 |
| **Subtotal** | **R1,081,000** | **R1,751,000** | **R2,548,000** |
| Contingency (10%) | R108,000 | R175,000 | R255,000 |
| **TOTAL OPTION A** | **R1,189,000** | **R1,926,000** | **R2,803,000** |

### Option B — Pneumatic (Cyclone/Blower)

| Category | LOW | MID | HIGH |
|----------|-----|-----|------|
| Collection hopper | R25,000 | R40,000 | R60,000 |
| Rotary airlock valve | R35,000 | R55,000 | R80,000 |
| Centrifugal blower (11 kW) | R60,000 | R100,000 | R150,000 |
| Conveying pipeline (20m, bends, supports) | R30,000 | R50,000 | R75,000 |
| Diverter valves (2x pneumatic) | R30,000 | R50,000 | R80,000 |
| Cyclone separators (3x SS304) | R60,000 | R105,000 | R150,000 |
| Return air bag filter | R25,000 | R45,000 | R70,000 |
| **3x Storage bins (30 m3 each, complete)** | **R270,000** | **R459,000** | **R666,000** |
| Additional dust collection (conveyor points) | R50,000 | R80,000 | R120,000 |
| Electrical (DB, VFDs, cabling, controls) | R106,000 | R152,000 | R198,000 |
| Steel structure (lighter than Option A) | R100,000 | R175,000 | R275,000 |
| Civil works (foundations, slab, site) | R70,000 | R115,000 | R175,000 |
| Installation labour (specialist pneumatic) | R70,000 | R120,000 | R180,000 |
| Blower silencer | R8,000 | R15,000 | R25,000 |
| Transport to Nieuwoudtville | R20,000 | R35,000 | R55,000 |
| Design, project management, commissioning | R50,000 | R85,000 | R130,000 |
| **Subtotal** | **R1,009,000** | **R1,681,000** | **R2,489,000** |
| Contingency (10%) | R101,000 | R168,000 | R249,000 |
| **TOTAL OPTION B** | **R1,110,000** | **R1,849,000** | **R2,738,000** |

### Cost Comparison Summary

| | LOW | MID | HIGH |
|--|-----|-----|------|
| **Option A (Mechanical)** | **R1,189,000** | **R1,926,000** | **R2,803,000** |
| **Option B (Pneumatic)** | **R1,110,000** | **R1,849,000** | **R2,738,000** |

Capital costs are surprisingly similar. The difference is in operating cost and product quality impact.

### 10-Year Operating Cost Comparison

| Factor | Option A (Mechanical) | Option B (Pneumatic) |
|--------|----------------------|---------------------|
| Power consumption (per season) | ~8 kW x 5 hrs x 80 days = 3,200 kWh | ~15 kW x 5 hrs x 80 days = 6,000 kWh |
| Annual electricity cost (at R3.50/kWh) | R11,200 | R21,000 |
| Annual maintenance (parts + labour) | R25,000-R40,000 | R35,000-R60,000 |
| Product degradation (fines loss) | Minimal (<0.5%) | 1-3% fines increase — at R40/kg this is R6,000-R18,000/yr on 15t/day x 80 days |
| **Annual operating cost** | **R36,000-R51,000** | **R62,000-R99,000** |
| **10-year operating cost** | **R360,000-R510,000** | **R620,000-R990,000** |

---

## 11. Recommendation

### RECOMMENDED: Option A — Mechanical (Bucket Elevator + Conveyors)

**Justification:**

1. **Product quality preservation:** This is the single most important factor. Rooibos tea value depends heavily on grade and appearance. Pneumatic conveying at 18-22 m/s air velocity will break fibrous tea particles, increasing dust/fines by 1-3%. At 245 tonnes/year and R40/kg, even a 1% downgrade costs ~R98,000/year. The bucket elevator and screw conveyor operate at low speeds (1.5 m/s belt, <1 m/s screw tip speed) and handle the tea gently.

2. **Suitability for fibrous material:** Rooibos tea is notoriously difficult in pneumatic systems. The fibres interlock, plug at bends, jam rotary airlock vanes, and the high air-to-solids ratio makes pneumatic conveying energy-inefficient for this material. Mechanical handling is the proven approach in rooibos, tea, and tobacco processing.

3. **Lower operating cost:** ~R30-50K/year cheaper to run. Over 10 years, this saves R300-500K — meaningful on a working farm.

4. **Maintainability in rural location:** Bucket elevators and screw conveyors can be maintained by a farm mechanic or local millwright. Bearing replacement, belt adjustment, and flight repair are basic skills. Pneumatic systems require specialist knowledge of airlock clearances, pipeline velocities, and blower curves — skills not readily available near Nieuwoudtville.

5. **Eskom load:** Lower power demand (8 kW vs 15 kW) leaves more headroom on the existing Eskom supply and reduces diesel generator load during loadshedding.

6. **Industry precedent:** Large SA rooibos processors (Rooibos Ltd in Clanwilliam, Cape Natural Tea Products) use mechanical conveying (bucket elevators, belt conveyors, screw conveyors) in their facilities. Pneumatic is used only for very fine tea dust recovery.

### Recommended Budget Allocation

| Item | Budget (MID estimate) |
|------|----------------------|
| Option A mechanical system (complete) | R1,926,000 |
| Sift dust collection upgrade (separate budget) | R100,000 |
| **Total project** | **R2,026,000** |

### Phasing (if budget is constrained)

If R1.9M is too much in one go, the project can be phased:

| Phase | Scope | Estimated Cost | Timeline |
|-------|-------|---------------|----------|
| Phase 1 | 3x Storage bins + steel structure + civils + dust collection | R950,000-R1,100,000 | Q2 2026 (before next season) |
| Phase 2 | Bucket elevator + screw conveyor + electrical + integration | R750,000-R900,000 | Q4 2026 or Q1 2027 |
| **Total** | Complete system | **R1,700,000-R2,000,000** | |

In Phase 1, bins can be filled manually (forklift + tipper) while the conveying system is installed later. This gets storage capacity online first.

---

## 12. SA Suppliers

### Conveying Equipment (Bucket Elevators, Screw Conveyors, Belt Conveyors)

| Supplier | Location | Products | Contact Notes |
|----------|----------|----------|---------------|
| **Roff Industries** | Johannesburg | Bucket elevators, screw conveyors, belt conveyors, vibratory feeders. Strong in agricultural processing. | One of the go-to suppliers for agricultural conveying in SA. Request quote for "rooibos tea handling system." |
| **Buhler SA** | Johannesburg (Isando) | Premium bucket elevators, chain conveyors, grain handling. Swiss quality. | Expensive but excellent for food-grade systems. Have tea processing expertise globally. |
| **Smiley Monroe SA** | Johannesburg | Conveyor belts, food-grade belting. Not full systems but supply components. | Good for replacement belts. |
| **Brelko Conveyor Products** | Johannesburg | Belt conveyor components — cleaners, skirting, impact beds. Not full systems. | Components supplier. |
| **Martin Engineering SA** | Johannesburg | Vibrators, bin activators, conveyor components. | Bin vibrators and flow aids — important for rooibos. |
| **Vibramech** | Johannesburg | Vibrating screens, feeders, bin activators. | Local manufacturer. Good for vibratory feeders under bins. |

### Pneumatic Conveying (if Option B chosen)

| Supplier | Location | Products |
|----------|----------|----------|
| **Mapner (Pty) Ltd** | Johannesburg | Centrifugal blowers, fans, pneumatic conveying systems |
| **Howden Africa** | Johannesburg | Industrial fans and blowers — premium |
| **Aerovent SA** | Cape Town | Fans and blowers |
| **Dynamic Aerotech** | Durban / Johannesburg | Pneumatic conveying systems, rotary valves, cyclones |
| **Gericke SA** | Johannesburg | Pneumatic conveying and bulk handling — high-end |

### Bins and Steel Fabrication

| Supplier | Location | Products |
|----------|----------|----------|
| **GVA Engineering** | Cape Town / Paarl | Stainless steel and mild steel fabrication. Agricultural tanks, bins, hoppers. |
| **Farmquip** | Malmesbury | Agricultural equipment fabrication, Western Cape based — close to Nieuwoudtville. |
| **Valmac Engineering** | Atlantis (Cape Town) | Stainless steel fabrication — food industry specialists. |
| **Local fabrication shops (Citrusdal, Clanwilliam, Malmesbury)** | Western Cape | Many small steel fabricators in the Cederberg/West Coast area familiar with rooibos processing equipment. Ask Rooibos Ltd or Cape Natural for referrals. |
| **MiTek Industries SA** | National | Steel portal frames and structural steel — for the support structure. |

### Dust Collection

| Supplier | Location | Products |
|----------|----------|----------|
| **Nederman SA** | Johannesburg | Dust extraction systems, bag filters, cyclones. Swedish brand, SA subsidiary. |
| **Schenck Process SA** | Johannesburg | Screening, feeding, dust collection — integrated solutions. |
| **Dustech** | Johannesburg | Bag filter units, cyclones, ducting — smaller local supplier. |
| **AAF International (SA)** | Johannesburg | Dust collection and air filtration — industrial grade. |
| **Cape Pneumatics / Air & Vacuum Technologies** | Cape Town | Local dust extraction and pneumatic systems — Western Cape based. |

### Electrical (VFDs, Control Panels, Motors)

| Supplier | Location | Products |
|----------|----------|----------|
| **Zest WEG** | National (offices in Cape Town, JHB, Durban) | WEG motors and VFDs — excellent value, Brazilian brand manufactured partly in SA. Recommended for this project. |
| **Varispeed (Pty) Ltd** | Johannesburg | VFDs — multi-brand distributor (ABB, Danfoss, Yaskawa). |
| **Schneider Electric SA** | National | Altivar VFDs, control panels, MCCBs. |
| **SEW-Eurodrive SA** | National | Gearmotors — excellent for conveyors and elevators. |
| **Nord Drivesystems SA** | Johannesburg / Cape Town | Gearmotors, VFDs — competitive alternative to SEW. |

### Recommended Procurement Approach

1. **Get 3 quotes minimum** for the bucket elevator (this is the highest-value single item). Contact Roff Industries, Buhler SA, and one other.
2. **Bins — fabricate locally in Western Cape.** Cheaper than JHB fabrication + transport. Get quotes from GVA Engineering, Farmquip, and a Clanwilliam/Citrusdal fabricator.
3. **Motors and VFDs — Zest WEG.** Best value in SA for this size range. Their Cape Town branch can supply and support.
4. **Steel structure — local structural steel fabricator** in the Cederberg/West Coast region. Hot-dip galvanise at Cape Galvanising or similar.
5. **Dust collection — Nederman or Dustech.** Get a combined quote for sift + conveyor dust extraction as one integrated system.
6. **Installation — local millwright firm** from the West Coast or Clanwilliam area. Check with the Rooibos industry — Rooibos Ltd in Clanwilliam will know who does this work locally.

### Key Contact for Industry Know-How

The **South African Rooibos Council (SARC)** in Clanwilliam can provide referrals to processing equipment suppliers and installers who have specific rooibos handling experience. This is a small, tight-knit industry — word-of-mouth referrals from other rooibos processors (Rooibos Ltd, Cape Natural Tea Products, Carmien Tea) will be the fastest way to find proven suppliers.

---

## Appendix: Quick Reference Summary

| Parameter | Option A (Recommended) | Option B |
|-----------|----------------------|----------|
| System type | Bucket elevator + screw conveyor | Pneumatic (blower + pipeline + cyclones) |
| Total installed power | ~10.7 kW | ~18.7 kW |
| Capital cost (MID) | **R1,926,000** | R1,849,000 |
| Annual operating cost | ~R40,000 | ~R80,000 |
| Product degradation | Minimal | 1-3% fines increase |
| Maintenance complexity | Low — farm mechanic capable | Medium — specialist knowledge |
| Food safety | Good (enclosed) | Excellent (fully enclosed) |
| Noise | Low | High (blower) |
| Footprint | Larger | Smaller |
| Rural suitability | Excellent | Fair |
| **Recommendation** | **YES** | No |

---

*This design document should be used as a basis for requesting formal quotations from suppliers. All costs are estimates based on 2025-2026 South African market pricing and should be validated with supplier quotations before committing to expenditure.*

*Prepared March 2026 for Cloudskraal Boerderye CapEx planning.*
