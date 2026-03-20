# Mining Materials Aggregator Platform — Design Spec

## Overview

A two-sided marketplace for bulk minerals and construction aggregates, connecting South African mine sources with global buyers. The platform enables sellers to list available material and buyers to post requirements, with matching, negotiation, escrow-protected transactions, and shipment tracking.

**Strategic moat:** Over time, the platform accumulates supply flow intelligence (volume per mine, material specs, pricing data) and operates a verification lab that builds trust through certified spec badges.

## Scope

### In scope (v1)
- Two-sided marketplace: seller listings + buyer requirements
- Commodities: chrome, manganese, iron ore, coal, construction aggregates
- Airbnb-inspired map view with mine-to-harbour-to-destination route visualization
- Dashboard-first trading/market view with price charts and deal history
- Deal flow with escrow on second acceptance
- Deal tracker with shipment map (manual milestone updates)
- Optional verification badge from platform lab
- Bayesian weighted reputation scoring
- Proprietary intelligence dashboard (internal only)
- Spec tolerance bands with price adjustments
- Multi-currency support (USD, ZAR, EUR)
- Document management on deals
- Seller allocation controls

### Out of scope (future)
- Live AIS vessel tracking
- API for enterprise buyers
- Automated dispute resolution
- Credit scoring
- Advanced notification system (price alerts, complex rules)

### Minimal notifications (v1)
Basic email notifications for critical deal events only (no in-app notification center):
- Escrow deposit confirmed
- Deal status transitions (loading, departed, arrived, delivered)
- Escrow released
- Dispute filed
Sent via Supabase Edge Functions + a transactional email provider (Resend or Postmark).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| Core Database | Supabase (PostgreSQL with PostGIS) |
| Time-Series DB | TimescaleDB |
| Maps | Mapbox GL JS |
| Auth | Supabase Auth |
| File Storage | Supabase Storage |
| Hosting | Vercel |

Building on top of the existing Next.js 16 + Supabase + Tailwind dashboard in `/dashboard`.

## Data Model

### Supabase (PostgreSQL + PostGIS)

#### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID, PK | Supabase Auth user ID |
| role | ENUM: buyer, seller, both | |
| company_name | TEXT | |
| country | TEXT | |
| kyc_status | ENUM: pending, verified, rejected | |
| created_at | TIMESTAMPTZ | |

#### `mines`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID, PK | |
| name | TEXT | |
| location | GEOGRAPHY(POINT) | PostGIS |
| country | TEXT | Default 'ZA' for v1 |
| region | TEXT | Province (Limpopo, Northern Cape, etc.) |
| commodities | TEXT[] | Array of commodity types produced |
| nearest_harbour_id | UUID, FK → harbours | |
| owner_id | UUID, FK → users | |

#### `harbours`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID, PK | |
| name | TEXT | Richards Bay, Saldanha Bay, Durban, Maputo |
| location | GEOGRAPHY(POINT) | PostGIS |
| country | TEXT | |
| type | ENUM: loading, destination, both | |

#### `routes`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID, PK | |
| origin_mine_id | UUID, FK → mines | |
| harbour_id | UUID, FK → harbours | |
| route_geometry | GEOGRAPHY(LINESTRING) | PostGIS — road/rail path |
| distance_km | NUMERIC | |
| transport_mode | ENUM: road, rail, combined | |

#### `listings`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID, PK | |
| seller_id | UUID, FK → users | |
| source_mine_id | UUID, FK → mines | |
| commodity_type | ENUM: chrome, manganese, iron_ore, coal, aggregates | |
| spec_sheet | JSONB | { fe_pct, cr2o3_pct, moisture_pct, particle_size, ... } — varies by commodity |
| volume_tonnes | NUMERIC | |
| price_per_tonne | NUMERIC | |
| currency | ENUM: USD, ZAR, EUR | Default USD |
| incoterms | TEXT[] | Available incoterms: FOB, CIF, CFR, etc. |
| loading_port_id | UUID, FK → harbours | |
| is_verified | BOOLEAN | Default false |
| allocation_mode | ENUM: open, invite_only | Default open |
| max_buyers | INTEGER | NULL = unlimited |
| preferred_buyer_ids | UUID[] | For invite_only mode |
| status | ENUM: active, paused, sold, expired | |
| created_at | TIMESTAMPTZ | |

#### `requirements`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID, PK | |
| buyer_id | UUID, FK → users | |
| commodity_type | ENUM | Same as listings |
| target_spec_range | JSONB | { fe_pct: { min: 60, max: 62 }, moisture_pct: { max: 5 }, ... } |
| volume_needed | NUMERIC | Tonnes |
| target_price | NUMERIC | Buyer's target $/t |
| currency | ENUM: USD, ZAR, EUR | |
| delivery_port | TEXT | Free-text destination port name (global ports not in harbours table) |
| incoterm | TEXT | Preferred incoterm |
| status | ENUM: active, matched, fulfilled, expired | |
| created_at | TIMESTAMPTZ | |

#### `deals`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID, PK | |
| listing_id | UUID, FK → listings | |
| requirement_id | UUID, FK → requirements | NULL if deal initiated from listing directly |
| buyer_id | UUID, FK → users | |
| seller_id | UUID, FK → users | |
| commodity_type | ENUM | |
| volume_tonnes | NUMERIC | |
| agreed_price | NUMERIC | |
| currency | ENUM | |
| fx_rate_locked | NUMERIC | Exchange rate at second acceptance |
| fx_source_timestamp | TIMESTAMPTZ | When rate was captured |
| incoterm | TEXT | |
| spec_tolerances | JSONB | { cr2o3_pct: { accept: [40, 42], penalty: [39, 40], reject_below: 39 } } |
| price_adjustment_rules | JSONB | { cr2o3_pct: { penalty_per_unit: 0.50, bonus_per_unit: 0.25 } } |
| escrow_amount | NUMERIC | |
| escrow_status | ENUM: pending_deposit, held, releasing, released, frozen | Tracks escrow independently from deal status |
| status | ENUM | See deal state machine below |
| created_at | TIMESTAMPTZ | |
| second_accept_at | TIMESTAMPTZ | When escrow triggers |

**Deal status ENUM:** `interest → first_accept → negotiation → second_accept → escrow_held → loading → in_transit → delivered → escrow_released → completed | disputed | cancelled`

A deal row is created when a buyer expresses interest in a listing (or a seller invites a buyer). The `LISTED` state in the state machine diagram refers to the listing's status, not the deal's — deals begin at `interest`.

#### `deal_milestones`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID, PK | |
| deal_id | UUID, FK → deals | |
| milestone_type | ENUM: loaded, departed_port, in_transit, arrived_port, customs, delivered | |
| timestamp | TIMESTAMPTZ | |
| location | GEOGRAPHY(POINT) | Optional — for manual position updates |
| location_name | TEXT | Human-readable location description |
| notes | TEXT | |
| created_by | UUID, FK → users | |

#### `deal_documents`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID, PK | |
| deal_id | UUID, FK → deals | |
| doc_type | ENUM: bill_of_lading, certificate_of_origin, weighbridge_ticket, lab_report, customs_declaration, invoice | |
| file_url | TEXT | Supabase Storage path |
| uploaded_by | UUID, FK → users | |
| uploaded_at | TIMESTAMPTZ | |
| verified | BOOLEAN | Default false |

#### `verifications`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID, PK | |
| listing_id | UUID, FK → listings | |
| lab_report_url | TEXT | Supabase Storage |
| assay_results | JSONB | Actual lab-tested spec values |
| verified_at | TIMESTAMPTZ | |
| badge_level | ENUM: standard, premium | |

#### `ratings`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID, PK | |
| deal_id | UUID, FK → deals | |
| rater_id | UUID, FK → users | |
| rated_user_id | UUID, FK → users | |
| spec_accuracy | INTEGER | 1-5 |
| timeliness | INTEGER | 1-5 |
| communication | INTEGER | 1-5 |
| documentation | INTEGER | 1-5 |
| comment | TEXT | Optional |
| created_at | TIMESTAMPTZ | |

### TimescaleDB (separate managed instance)

TimescaleDB runs as a separate managed PostgreSQL instance (e.g., Timescale Cloud) — not as an extension on the Supabase instance. This keeps time-series query load isolated from the core marketplace database. The Next.js app connects to both databases: Supabase client for marketplace data, a direct PostgreSQL client (e.g., `pg` or Prisma) for TimescaleDB.

**Data population mechanism:** Supabase Database Webhooks (pg_net) fire on INSERT/UPDATE to `listings`, `requirements`, and `deals` tables. These webhooks call Next.js API routes (e.g., `/api/timescale/ingest`) that transform the event and write to TimescaleDB. This is an async, eventually-consistent pipeline — trading view data may lag marketplace state by a few seconds.

#### `price_ticks` (hypertable, partitioned by time)
| Column | Type | Notes |
|--------|------|-------|
| time | TIMESTAMPTZ | Partition key |
| commodity_type | TEXT | |
| grade_band | TEXT | e.g., "chrome_42", "fe_62" |
| bid_price | NUMERIC | Derived from buyer requirements |
| ask_price | NUMERIC | Derived from seller listings |
| volume | NUMERIC | Tonnes at this price level |
| source | ENUM: listing, deal, requirement | |

#### `volume_flows` (hypertable, partitioned by time)
| Column | Type | Notes |
|--------|------|-------|
| time | TIMESTAMPTZ | |
| source_mine_id | UUID | |
| commodity_type | TEXT | |
| volume_tonnes | NUMERIC | |
| destination_region | TEXT | |

## Scoring System — Bayesian Weighted Reputation

### Formula
```
weighted_score = (n / (n + m)) * actual_avg + (m / (n + m)) * platform_avg
```

Where:
- `n` = user's completed deals
- `m` = confidence threshold (10 deals)
- `actual_avg` = user's real weighted score
- `platform_avg` = global average score

### Dimensions

| Dimension | Weight | Source |
|-----------|--------|--------|
| Spec accuracy | 30% | Counterparty rating (1-5) |
| Timeliness | 25% | Counterparty rating (1-5) |
| Communication | 15% | Counterparty rating (1-5) |
| Documentation | 15% | Counterparty rating (1-5) |
| Dispute history | 15% | Auto-calculated: deals without disputes / total deals |

### Badge Tiers
- **Unrated** — < 5 completed deals
- **Bronze** — 5+ deals
- **Silver** — 15+ deals
- **Gold** — 30+ deals
- **Platinum** — 50+ deals

Verification badge (from platform lab) is displayed separately — it certifies material quality, not trader reliability.

## UI Architecture

### Navigation Structure

Main nav (sidebar, matching existing dashboard pattern):
1. **Map View** (default landing) — `/map`
2. **Trading** — `/trading`
3. **Marketplace** — `/marketplace`
4. **Deal Tracker** — `/deals`
5. **My Dashboard** — `/dashboard`
6. **Intelligence** — `/intelligence` (admin-only)

### Map View (`/map`)

**Layout:** Classic 40/60 Airbnb split — listings panel left, Mapbox map right.

**Left panel (40%):**
- Filter bar at top: commodity type chips, price range, incoterm, verified only toggle, volume range
- Scrollable list of listing cards showing:
  - Commodity name + grade
  - Source mine → loading port
  - Price/tonne + incoterm badges
  - Volume available
  - Verification badge (if verified)
  - Seller trust score (stars + tier badge)

**Right panel (60%) — Mapbox map:**
- Mine location pins (color-coded by commodity)
- Harbour nodes (green squares)
- Route lines (mine → harbour, dashed)
- Clicking a mine pin shows popover with available material
- Selecting a listing highlights the route: mine → SA harbour → buyer's destination port (animated shipping lane)
- Pin clustering when zoomed out
- Legend overlay (bottom-left)

**Interactions:**
- Hover listing card → highlight corresponding pin on map
- Click pin → scroll to listing in left panel
- Filter changes update both list and map simultaneously

### Trading View (`/trading`)

**Layout:** Dashboard-first, single column with sections.

**Top:** Commodity tab bar (Chrome, Manganese, Iron Ore, Coal, Aggregates)

**Stats row (4 cards):**
- Average price (with weekly % change)
- Volume listed (with weekly % change)
- Active deals (with total value)
- Bid/ask spread (with market tightness indicator)

**Center:** Large price history chart
- Line chart with area fill gradient
- Time range toggles: 1W, 1M, 3M, 6M, 1Y, ALL
- Data from TimescaleDB `price_ticks` hypertable
- Hover tooltip with price, volume, date

**Bottom:** Recent completed deals table
- Columns: Material, Price, Volume, Incoterm, When
- Color-coded price (green = above avg, red = below)

### Marketplace (`/marketplace`)

Standard browse view — list/grid toggle of all active listings and requirements.

**Filters:** Same as map view but in a horizontal filter bar.

**Two tabs:**
- **Listings** (seller offers) — card grid
- **Requirements** (buyer needs) — card grid

Each card links to detail page with full spec sheet, seller/buyer profile, and "Express Interest" action.

### Deal Tracker (`/deals`)

**Default tab: Shipments**

**Shipment view:**
- Left: World map (Mapbox) showing vessel positions as animated pulsing dots
- Route lines from SA ports to destination ports (dashed, color-coded per deal)
- Click a vessel → focus and show info popover
- Right sidebar (280px): Active shipment cards with:
  - Commodity, volume, price, incoterm
  - Route (origin → destination)
  - Progress bar (departed date → ETA)
  - Milestone tracker: Loaded → Departed → At Sea → Arrived → Delivered (checkmarks for completed steps)
  - Escrow summary at bottom (total held, pending release)

**Pipeline tab:**
- Kanban board with columns: Interest → Negotiation → Escrow → In Transit → Completed
- Deal cards show: commodity, counterparty, value, stage-relevant info
- Click any card → expand to full deal detail with:
  - Complete timeline
  - Document uploads/downloads
  - Spec comparison (agreed vs actual if delivered)
  - Price adjustment calculation
  - Rating form (if completed)

### My Dashboard (`/dashboard`)

- Your active listings (seller) / requirements (buyer)
- Active deals summary
- Verification status for your listings
- Trust score breakdown
- Recent activity feed

### Intelligence Dashboard (`/intelligence`) — Admin Only

Internal-only view behind admin RLS policy.

| Panel | Description | Data Source |
|-------|-------------|-------------|
| Volume Flow Map | Animated flow lines (mine → harbour → destination). Thickness = volume. Filter by commodity, time. | deals + deal_milestones |
| Supply Intelligence | Per-mine output over time, estimated capacity utilization | listings + deals |
| Demand Heatmap | Where buyer requirements cluster by commodity, spec, region | requirements |
| Price Discovery | Platform price curves vs published indices (Platts, Fastmarkets) | price_ticks |
| Market Concentration | HHI index by commodity, top sellers by volume share | deals |
| Verification Insights | Spec accuracy trends per mine — listed vs lab-tested values | verifications + listings |
| Deal Velocity | Avg time listing → second_accept → delivery by commodity/corridor | deals + deal_milestones |

## Deal Flow State Machine

```
Listing is ACTIVE on marketplace
  ↓ buyer expresses interest (or seller invites buyer) → deal row created
INTEREST
  ↓ both parties acknowledge
FIRST_ACCEPT
  ↓ negotiation opens (chat, term sheets)
NEGOTIATION
  ↓ both sign off on final terms
SECOND_ACCEPT → escrow triggered, FX rate locked
  ↓ buyer deposits funds
ESCROW_HELD
  ↓ material loaded at mine/port
LOADING
  ↓ vessel departs
IN_TRANSIT
  ↓ material arrives at destination
DELIVERED → spec comparison, price adjustments calculated
  ↓ buyer confirms receipt (or dispute filed)
ESCROW_RELEASED → funds released to seller (adjusted for spec deviations)
  ↓ both parties rate each other
COMPLETED

At any post-escrow stage: either party can file DISPUTED → escrow frozen, manual mediation (v1).

Dispute resolution paths:
  DISPUTED → ESCROW_RELEASED (resolved in seller's favor, funds released)
  DISPUTED → ESCROW_RELEASED (resolved with adjustment, partial release to each party)
  DISPUTED → CANCELLED (deal cancelled, funds returned to buyer)
All dispute resolutions are manual admin actions in v1.

Negotiation in v1 happens off-platform (email, WhatsApp, phone). The platform does not provide a chat system. Deal terms are captured when both parties enter SECOND_ACCEPT.
```

## Spec Tolerance & Price Adjustments

Each deal includes:

**`spec_tolerances`** — per-field acceptance ranges:
```json
{
  "cr2o3_pct": {
    "target": 42,
    "accept_range": [40, 44],
    "penalty_range": [39, 40],
    "reject_below": 39
  },
  "moisture_pct": {
    "target": 5,
    "accept_range": [0, 6],
    "penalty_range": [6, 8],
    "reject_above": 8
  }
}
```

**`price_adjustment_rules`** — penalty/bonus per unit deviation:
```json
{
  "cr2o3_pct": {
    "penalty_per_pct_below": 0.50,
    "bonus_per_pct_above": 0.25,
    "reference": "per_tonne"
  }
}
```

At delivery, actual spec (from weighbridge/lab) is compared against agreed spec. Price is automatically recalculated before escrow release.

## Escrow Mechanism (v1)

For v1, escrow is a **platform-tracked ledger** backed by manual bank transfers:

1. At `SECOND_ACCEPT`, the platform generates a payment instruction (bank details, reference number, amount in deal currency)
2. Buyer transfers funds to a platform-controlled holding account
3. Platform admin confirms receipt → deal status moves to `ESCROW_HELD`
4. At `DELIVERED` + buyer confirmation (or after spec adjustment calculation), platform admin releases funds to seller's registered bank account
5. Escrow state tracked in Supabase: `escrow_status` ENUM on deals (`pending_deposit → held → releasing → released → frozen`)

Future: integrate a payment provider (Stripe Connect, or SA-specific like Peach Payments) for automated escrow flow.

## FX Rate Source

Exchange rates are fetched from the **Open Exchange Rates API** (free tier supports USD base, sufficient for v1):

- Rate fetched at moment of `SECOND_ACCEPT` and stored as `fx_rate_locked`
- `fx_source_timestamp` records the exact API response time
- If API is unavailable at lock time, deal cannot proceed to `SECOND_ACCEPT` — user is prompted to retry
- Rates are USD-based; ZAR and EUR cross-rates derived from USD base

## Row Level Security

Critical for marketplace trust:

| Table | Policy |
|-------|--------|
| listings | Public read for active listings. Only owner can write/update. |
| requirements | Public read for active requirements. Only owner can write/update. |
| deals | Only buyer and seller on the deal can read/write. |
| deal_documents | Only deal participants can read/upload. |
| deal_milestones | Only deal participants can read. Seller creates loading/departure. Buyer creates arrival/delivery. |
| ratings | Public read. Only rater can create (once per deal). |
| verifications | Public read. Only admin/lab can create. |
| Intelligence tables | Admin-only read. No public access. |

## Multi-Currency

- Listings support USD, ZAR, EUR
- Trading view data normalized to USD
- At second acceptance, exchange rate locked:
  - `fx_rate_locked`: rate at time of lock
  - `fx_source_timestamp`: when rate was captured
- Escrow denominated in deal currency
- Price adjustment calculations use locked rate

## Seller Allocation Controls

- `allocation_mode: open` — any buyer can express interest
- `allocation_mode: invite_only` — seller whitelists specific buyer IDs
- Interest queue: sellers see all incoming interest, can accept/reject/prioritize
- `max_buyers`: cap on concurrent negotiations per listing
- Critical for chrome market dynamics where mines control allocation
