# Plan 1: Foundation — Schema, Auth, Navigation & Seed Data

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the existing deployments dashboard into the mining aggregator platform foundation — database schema, Supabase Auth, updated sidebar navigation, and seed data for all core tables.

**Architecture:** Extend the existing Next.js 16 + Supabase + Tailwind v4 app in `/dashboard`. Replace the deployments demo with marketplace-ready schema and navigation. PostGIS extension enabled for geographic data. Supabase Auth for user management with role-based access.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase (PostgreSQL + PostGIS), Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-03-20-mining-aggregator-platform-design.md`

**Sequencing:** This is Plan 1 of 4. Plans 2–4 depend on this foundation:
- Plan 2: Marketplace & Map View
- Plan 3: Deals & Trading
- Plan 4: Trust & Intelligence

---

## File Structure

```
dashboard/
├── app/
│   ├── layout.tsx                    # MODIFY — update metadata, keep structure
│   ├── page.tsx                      # MODIFY — redirect to /map (placeholder for now)
│   ├── sidebar.tsx                   # MODIFY — replace nav items with new routes
│   ├── globals.css                   # KEEP — no changes
│   ├── (auth)/
│   │   ├── login/page.tsx            # CREATE — login form
│   │   ├── signup/page.tsx           # CREATE — signup form with role selection
│   │   └── layout.tsx                # CREATE — auth layout (no sidebar)
│   ├── map/page.tsx                  # CREATE — placeholder page
│   ├── trading/page.tsx              # CREATE — placeholder page
│   ├── marketplace/page.tsx          # CREATE — placeholder page
│   ├── deals/page.tsx                # CREATE — placeholder page
│   ├── dashboard/page.tsx            # CREATE — placeholder page
│   ├── deployments/                  # DELETE — remove old demo
│   │   └── page.tsx
│   └── api/
│       └── auth/
│           └── callback/route.ts     # CREATE — Supabase Auth callback handler
├── lib/
│   ├── supabase.ts                   # MODIFY — add server client, auth helpers
│   ├── supabase-server.ts            # CREATE — server-side Supabase client
│   ├── types.ts                      # MODIFY — replace Deployment with marketplace types
│   ├── format.ts                     # KEEP — timeAgo still useful
│   └── auth.ts                       # CREATE — auth helpers (getCurrentUser, requireAuth)
├── middleware.ts                      # CREATE — protect routes, redirect unauthenticated
├── supabase-setup.sql                # MODIFY — replace with full marketplace schema
├── seed-data.sql                     # CREATE — realistic seed data for all tables
├── .env.example                      # MODIFY — add new env vars
└── package.json                      # MODIFY — add @supabase/ssr
```

---

### Task 1: Install dependencies

**Files:**
- Modify: `dashboard/package.json`

- [ ] **Step 1: Install @supabase/ssr for auth**

```bash
cd /Users/alexnelja/projects/dashboard && npm install @supabase/ssr
```

- [ ] **Step 2: Verify installation**

Run: `cd /Users/alexnelja/projects/dashboard && cat package.json | grep supabase`
Expected: Both `@supabase/supabase-js` and `@supabase/ssr` listed

- [ ] **Step 3: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add package.json package-lock.json && git commit -m "feat: add @supabase/ssr for auth support"
```

---

### Task 2: Write the complete database schema SQL

**Files:**
- Modify: `dashboard/supabase-setup.sql` — replace entirely with marketplace schema

- [ ] **Step 1: Write the schema SQL**

Replace the entire contents of `supabase-setup.sql` with:

```sql
-- Mining Materials Aggregator Platform — Database Schema
-- Run this in your Supabase SQL Editor

-- 0. Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Create ENUM types
CREATE TYPE user_role AS ENUM ('buyer', 'seller', 'both');
CREATE TYPE kyc_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE commodity_type AS ENUM ('chrome', 'manganese', 'iron_ore', 'coal', 'aggregates');
CREATE TYPE harbour_type AS ENUM ('loading', 'destination', 'both');
CREATE TYPE transport_mode AS ENUM ('road', 'rail', 'combined');
CREATE TYPE listing_status AS ENUM ('active', 'paused', 'sold', 'expired');
CREATE TYPE allocation_mode AS ENUM ('open', 'invite_only');
CREATE TYPE requirement_status AS ENUM ('active', 'matched', 'fulfilled', 'expired');
CREATE TYPE deal_status AS ENUM (
  'interest', 'first_accept', 'negotiation', 'second_accept',
  'escrow_held', 'loading', 'in_transit', 'delivered',
  'escrow_released', 'completed', 'disputed', 'cancelled'
);
CREATE TYPE escrow_status AS ENUM ('pending_deposit', 'held', 'releasing', 'released', 'frozen');
CREATE TYPE currency_type AS ENUM ('USD', 'ZAR', 'EUR');
CREATE TYPE milestone_type AS ENUM ('loaded', 'departed_port', 'in_transit', 'arrived_port', 'customs', 'delivered');
CREATE TYPE doc_type AS ENUM ('bill_of_lading', 'certificate_of_origin', 'weighbridge_ticket', 'lab_report', 'customs_declaration', 'invoice');
CREATE TYPE badge_level AS ENUM ('standard', 'premium');

-- 2. Users table (extends Supabase Auth)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'buyer',
  company_name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'ZA',
  kyc_status kyc_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Harbours (created before mines since mines reference harbours)
CREATE TABLE harbours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  country TEXT NOT NULL,
  type harbour_type NOT NULL DEFAULT 'loading'
);

-- 4. Mines
CREATE TABLE mines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  country TEXT NOT NULL DEFAULT 'ZA',
  region TEXT NOT NULL,
  commodities commodity_type[] NOT NULL,
  nearest_harbour_id UUID REFERENCES harbours(id),
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL
);

-- 5. Routes (mine to harbour)
CREATE TABLE routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_mine_id UUID NOT NULL REFERENCES mines(id) ON DELETE CASCADE,
  harbour_id UUID NOT NULL REFERENCES harbours(id) ON DELETE CASCADE,
  route_geometry GEOGRAPHY(LINESTRING, 4326),
  distance_km NUMERIC NOT NULL,
  transport_mode transport_mode NOT NULL DEFAULT 'road'
);

-- 6. Listings
CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_mine_id UUID NOT NULL REFERENCES mines(id),
  commodity_type commodity_type NOT NULL,
  spec_sheet JSONB NOT NULL DEFAULT '{}',
  volume_tonnes NUMERIC NOT NULL,
  price_per_tonne NUMERIC NOT NULL,
  currency currency_type NOT NULL DEFAULT 'USD',
  incoterms TEXT[] NOT NULL DEFAULT '{"FOB"}',
  loading_port_id UUID NOT NULL REFERENCES harbours(id),
  is_verified BOOLEAN NOT NULL DEFAULT false,
  allocation_mode allocation_mode NOT NULL DEFAULT 'open',
  max_buyers INTEGER,
  preferred_buyer_ids UUID[] DEFAULT '{}',
  status listing_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Requirements
CREATE TABLE requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  commodity_type commodity_type NOT NULL,
  target_spec_range JSONB NOT NULL DEFAULT '{}',
  volume_needed NUMERIC NOT NULL,
  target_price NUMERIC NOT NULL,
  currency currency_type NOT NULL DEFAULT 'USD',
  delivery_port TEXT NOT NULL,
  incoterm TEXT NOT NULL DEFAULT 'FOB',
  status requirement_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Deals
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id),
  requirement_id UUID REFERENCES requirements(id),
  buyer_id UUID NOT NULL REFERENCES users(id),
  seller_id UUID NOT NULL REFERENCES users(id),
  commodity_type commodity_type NOT NULL,
  volume_tonnes NUMERIC NOT NULL,
  agreed_price NUMERIC NOT NULL,
  currency currency_type NOT NULL DEFAULT 'USD',
  fx_rate_locked NUMERIC,
  fx_source_timestamp TIMESTAMPTZ,
  incoterm TEXT NOT NULL,
  spec_tolerances JSONB DEFAULT '{}',
  price_adjustment_rules JSONB DEFAULT '{}',
  escrow_amount NUMERIC,
  escrow_status escrow_status DEFAULT 'pending_deposit',
  status deal_status NOT NULL DEFAULT 'interest',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  second_accept_at TIMESTAMPTZ
);

-- 9. Deal milestones
CREATE TABLE deal_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  milestone_type milestone_type NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  location GEOGRAPHY(POINT, 4326),
  location_name TEXT,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id)
);

-- 10. Deal documents
CREATE TABLE deal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  doc_type doc_type NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified BOOLEAN NOT NULL DEFAULT false
);

-- 11. Verifications
CREATE TABLE verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  lab_report_url TEXT NOT NULL,
  assay_results JSONB NOT NULL DEFAULT '{}',
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  badge_level badge_level NOT NULL DEFAULT 'standard'
);

-- 12. Ratings
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES users(id),
  rated_user_id UUID NOT NULL REFERENCES users(id),
  spec_accuracy INTEGER NOT NULL CHECK (spec_accuracy BETWEEN 1 AND 5),
  timeliness INTEGER NOT NULL CHECK (timeliness BETWEEN 1 AND 5),
  communication INTEGER NOT NULL CHECK (communication BETWEEN 1 AND 5),
  documentation INTEGER NOT NULL CHECK (documentation BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(deal_id, rater_id)
);

-- 13. Create indexes
CREATE INDEX idx_listings_commodity ON listings(commodity_type);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_seller ON listings(seller_id);
CREATE INDEX idx_requirements_commodity ON requirements(commodity_type);
CREATE INDEX idx_requirements_buyer ON requirements(buyer_id);
CREATE INDEX idx_deals_buyer ON deals(buyer_id);
CREATE INDEX idx_deals_seller ON deals(seller_id);
CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_deal_milestones_deal ON deal_milestones(deal_id);
CREATE INDEX idx_mines_location ON mines USING GIST(location);
CREATE INDEX idx_harbours_location ON harbours USING GIST(location);

-- 14. Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE mines ENABLE ROW LEVEL SECURITY;
ALTER TABLE harbours ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

-- 15. RLS Policies

-- Users: users can read their own profile, public read for company_name/country
CREATE POLICY "Users can read own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id);

-- Harbours: public read
CREATE POLICY "Public read harbours" ON harbours FOR SELECT USING (true);

-- Mines: public read, owner can write
CREATE POLICY "Public read mines" ON mines FOR SELECT USING (true);
CREATE POLICY "Owner can insert mines" ON mines FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner can update mines" ON mines FOR UPDATE USING (auth.uid() = owner_id);

-- Routes: public read
CREATE POLICY "Public read routes" ON routes FOR SELECT USING (true);

-- Listings: public read for active, owner writes
CREATE POLICY "Public read active listings" ON listings
  FOR SELECT USING (status = 'active' OR seller_id = auth.uid());
CREATE POLICY "Seller can insert listings" ON listings
  FOR INSERT WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Seller can update listings" ON listings
  FOR UPDATE USING (auth.uid() = seller_id);

-- Requirements: public read for active, owner writes
CREATE POLICY "Public read active requirements" ON requirements
  FOR SELECT USING (status = 'active' OR buyer_id = auth.uid());
CREATE POLICY "Buyer can insert requirements" ON requirements
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Buyer can update requirements" ON requirements
  FOR UPDATE USING (auth.uid() = buyer_id);

-- Deals: only participants
CREATE POLICY "Deal participants can read" ON deals
  FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "Buyer can create deal" ON deals
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Participants can update deal" ON deals
  FOR UPDATE USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Deal milestones: only deal participants
CREATE POLICY "Deal participants can read milestones" ON deal_milestones
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_milestones.deal_id
      AND (deals.buyer_id = auth.uid() OR deals.seller_id = auth.uid()))
  );
CREATE POLICY "Deal participants can create milestones" ON deal_milestones
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_milestones.deal_id
      AND (deals.buyer_id = auth.uid() OR deals.seller_id = auth.uid()))
  );

-- Deal documents: only deal participants
CREATE POLICY "Deal participants can read documents" ON deal_documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_documents.deal_id
      AND (deals.buyer_id = auth.uid() OR deals.seller_id = auth.uid()))
  );
CREATE POLICY "Deal participants can upload documents" ON deal_documents
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_documents.deal_id
      AND (deals.buyer_id = auth.uid() OR deals.seller_id = auth.uid()))
  );

-- Verifications: public read, admin-only write (handled by service role key, not RLS)
CREATE POLICY "Public read verifications" ON verifications FOR SELECT USING (true);

-- Ratings: public read, rater can create (once per deal enforced by UNIQUE constraint)
CREATE POLICY "Public read ratings" ON ratings FOR SELECT USING (true);
CREATE POLICY "Rater can create rating" ON ratings
  FOR INSERT WITH CHECK (auth.uid() = rater_id);
```

- [ ] **Step 2: Verify SQL is syntactically valid**

Run: `cd /Users/alexnelja/projects/dashboard && head -5 supabase-setup.sql`
Expected: First 5 lines of the new schema file

- [ ] **Step 3: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add supabase-setup.sql && git commit -m "feat: replace deployments schema with full marketplace schema

Includes all tables: users, harbours, mines, routes, listings,
requirements, deals, deal_milestones, deal_documents, verifications,
ratings. PostGIS enabled, RLS policies for all tables."
```

---

### Task 3: Write seed data

**Files:**
- Create: `dashboard/seed-data.sql`

- [ ] **Step 1: Write realistic seed data**

Create `dashboard/seed-data.sql`:

```sql
-- Seed Data for Mining Materials Aggregator Platform
-- Run AFTER supabase-setup.sql
-- Note: User records are created via Supabase Auth signup.
-- These seeds assume test users already exist in auth.users.
-- For dev, create test users via Supabase dashboard first, then update UUIDs below.

-- Placeholder UUIDs for test users (replace with actual auth.users IDs after signup)
-- Seller 1: Chrome mine operator
-- Seller 2: Manganese mine operator
-- Buyer 1: Chinese steel trader
-- Buyer 2: Turkish chrome buyer

-- Harbours (South African loading ports + key global destinations)
INSERT INTO harbours (id, name, location, country, type) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Richards Bay', ST_MakePoint(32.0383, -28.7830)::geography, 'ZA', 'loading'),
  ('a0000000-0000-0000-0000-000000000002', 'Saldanha Bay', ST_MakePoint(17.9318, -33.0046)::geography, 'ZA', 'loading'),
  ('a0000000-0000-0000-0000-000000000003', 'Durban', ST_MakePoint(31.0218, -29.8587)::geography, 'ZA', 'loading'),
  ('a0000000-0000-0000-0000-000000000004', 'Maputo', ST_MakePoint(32.5732, -25.9655)::geography, 'MZ', 'loading'),
  ('a0000000-0000-0000-0000-000000000005', 'Shanghai', ST_MakePoint(121.4737, 31.2304)::geography, 'CN', 'destination'),
  ('a0000000-0000-0000-0000-000000000006', 'Mersin', ST_MakePoint(34.6415, 36.7996)::geography, 'TR', 'destination'),
  ('a0000000-0000-0000-0000-000000000007', 'Tianjin', ST_MakePoint(117.3616, 39.3434)::geography, 'CN', 'destination'),
  ('a0000000-0000-0000-0000-000000000008', 'Vizag', ST_MakePoint(83.2185, 17.6868)::geography, 'IN', 'destination');

-- Mines (South African mines — no owner_id until test users are created)
INSERT INTO mines (id, name, location, country, region, commodities, nearest_harbour_id) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Tharisa Mine', ST_MakePoint(27.5820, -25.7460)::geography, 'ZA', 'North West', '{chrome}', 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002', 'Dwarsrivier Mine', ST_MakePoint(30.1050, -24.8830)::geography, 'ZA', 'Limpopo', '{chrome}', 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000003', 'Hotazel Mine', ST_MakePoint(22.9670, -27.2830)::geography, 'ZA', 'Northern Cape', '{manganese}', 'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000004', 'Sishen Mine', ST_MakePoint(22.8140, -27.7330)::geography, 'ZA', 'Northern Cape', '{iron_ore}', 'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000005', 'Grootegeluk Mine', ST_MakePoint(27.7740, -23.6560)::geography, 'ZA', 'Limpopo', '{coal}', 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000006', 'AfriSam Quarry', ST_MakePoint(28.2500, -26.2000)::geography, 'ZA', 'Gauteng', '{aggregates}', 'a0000000-0000-0000-0000-000000000003');

-- Routes (mine to nearest harbour)
INSERT INTO routes (id, origin_mine_id, harbour_id, distance_km, transport_mode) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 520, 'road'),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 380, 'rail'),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 640, 'rail'),
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 580, 'rail'),
  ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 350, 'rail'),
  ('c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000003', 60, 'road');
```

- [ ] **Step 2: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add seed-data.sql && git commit -m "feat: add seed data for harbours, mines, and routes"
```

---

### Task 4: Update TypeScript types

**Files:**
- Modify: `dashboard/lib/types.ts` — replace entirely

- [ ] **Step 1: Write marketplace types**

Replace the entire contents of `lib/types.ts`:

```typescript
// Core enums as TypeScript types
export type UserRole = 'buyer' | 'seller' | 'both';
export type KycStatus = 'pending' | 'verified' | 'rejected';
export type CommodityType = 'chrome' | 'manganese' | 'iron_ore' | 'coal' | 'aggregates';
export type HarbourType = 'loading' | 'destination' | 'both';
export type TransportMode = 'road' | 'rail' | 'combined';
export type ListingStatus = 'active' | 'paused' | 'sold' | 'expired';
export type AllocationMode = 'open' | 'invite_only';
export type RequirementStatus = 'active' | 'matched' | 'fulfilled' | 'expired';
export type DealStatus =
  | 'interest' | 'first_accept' | 'negotiation' | 'second_accept'
  | 'escrow_held' | 'loading' | 'in_transit' | 'delivered'
  | 'escrow_released' | 'completed' | 'disputed' | 'cancelled';
export type EscrowStatus = 'pending_deposit' | 'held' | 'releasing' | 'released' | 'frozen';
export type CurrencyType = 'USD' | 'ZAR' | 'EUR';
export type MilestoneType = 'loaded' | 'departed_port' | 'in_transit' | 'arrived_port' | 'customs' | 'delivered';
export type DocType = 'bill_of_lading' | 'certificate_of_origin' | 'weighbridge_ticket' | 'lab_report' | 'customs_declaration' | 'invoice';
export type BadgeLevel = 'standard' | 'premium';

// Database row types
export interface User {
  id: string;
  role: UserRole;
  company_name: string;
  country: string;
  kyc_status: KycStatus;
  created_at: string;
}

export interface Harbour {
  id: string;
  name: string;
  location: unknown; // PostGIS geography — parsed separately
  country: string;
  type: HarbourType;
}

export interface Mine {
  id: string;
  name: string;
  location: unknown; // PostGIS geography
  country: string;
  region: string;
  commodities: CommodityType[];
  nearest_harbour_id: string;
  owner_id: string | null;
}

export interface Route {
  id: string;
  origin_mine_id: string;
  harbour_id: string;
  route_geometry: unknown; // PostGIS geography
  distance_km: number;
  transport_mode: TransportMode;
}

export interface Listing {
  id: string;
  seller_id: string;
  source_mine_id: string;
  commodity_type: CommodityType;
  spec_sheet: Record<string, number>;
  volume_tonnes: number;
  price_per_tonne: number;
  currency: CurrencyType;
  incoterms: string[];
  loading_port_id: string;
  is_verified: boolean;
  allocation_mode: AllocationMode;
  max_buyers: number | null;
  preferred_buyer_ids: string[];
  status: ListingStatus;
  created_at: string;
}

export interface Requirement {
  id: string;
  buyer_id: string;
  commodity_type: CommodityType;
  target_spec_range: Record<string, { min?: number; max?: number }>;
  volume_needed: number;
  target_price: number;
  currency: CurrencyType;
  delivery_port: string;
  incoterm: string;
  status: RequirementStatus;
  created_at: string;
}

export interface Deal {
  id: string;
  listing_id: string;
  requirement_id: string | null;
  buyer_id: string;
  seller_id: string;
  commodity_type: CommodityType;
  volume_tonnes: number;
  agreed_price: number;
  currency: CurrencyType;
  fx_rate_locked: number | null;
  fx_source_timestamp: string | null;
  incoterm: string;
  spec_tolerances: Record<string, unknown>;
  price_adjustment_rules: Record<string, unknown>;
  escrow_amount: number | null;
  escrow_status: EscrowStatus;
  status: DealStatus;
  created_at: string;
  second_accept_at: string | null;
}

export interface DealMilestone {
  id: string;
  deal_id: string;
  milestone_type: MilestoneType;
  timestamp: string;
  location: unknown;
  location_name: string | null;
  notes: string | null;
  created_by: string;
}

export interface DealDocument {
  id: string;
  deal_id: string;
  doc_type: DocType;
  file_url: string;
  uploaded_by: string;
  uploaded_at: string;
  verified: boolean;
}

export interface Verification {
  id: string;
  listing_id: string;
  lab_report_url: string;
  assay_results: Record<string, number>;
  verified_at: string;
  badge_level: BadgeLevel;
}

export interface Rating {
  id: string;
  deal_id: string;
  rater_id: string;
  rated_user_id: string;
  spec_accuracy: number;
  timeliness: number;
  communication: number;
  documentation: number;
  comment: string | null;
  created_at: string;
}

// Commodity display config
export const COMMODITY_CONFIG: Record<CommodityType, { label: string; color: string }> = {
  chrome: { label: 'Chrome', color: '#f59e0b' },
  manganese: { label: 'Manganese', color: '#a78bfa' },
  iron_ore: { label: 'Iron Ore', color: '#60a5fa' },
  coal: { label: 'Coal', color: '#6b7280' },
  aggregates: { label: 'Aggregates', color: '#f97316' },
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/alexnelja/projects/dashboard && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `lib/types.ts`

- [ ] **Step 3: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add lib/types.ts && git commit -m "feat: replace deployment types with full marketplace type definitions"
```

---

### Task 5: Set up Supabase auth clients

**Files:**
- Modify: `dashboard/lib/supabase.ts`
- Create: `dashboard/lib/supabase-server.ts`
- Create: `dashboard/lib/auth.ts`
- Modify: `dashboard/.env.example`

- [ ] **Step 1: Update the browser client**

Replace the contents of `lib/supabase.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: Create the server client**

Create `lib/supabase-server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — can't set cookies, handled by middleware
          }
        },
      },
    }
  );
}
```

- [ ] **Step 3: Create auth helpers**

Create `lib/auth.ts`:

```typescript
import { createServerSupabaseClient } from './supabase-server';
import { redirect } from 'next/navigation';
import type { User } from './types';

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createServerSupabaseClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single();

  return profile as User | null;
}

export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  return user;
}
```

- [ ] **Step 4: Update .env.example**

Replace the contents of `.env.example`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

- [ ] **Step 5: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add lib/supabase.ts lib/supabase-server.ts lib/auth.ts .env.example && git commit -m "feat: set up Supabase Auth with SSR client and auth helpers"
```

---

### Task 6: Create auth callback route

**Files:**
- Create: `dashboard/app/api/auth/callback/route.ts`

- [ ] **Step 1: Write the callback handler**

Create `app/api/auth/callback/route.ts`:

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/map';

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add app/api/auth/callback/route.ts && git commit -m "feat: add Supabase Auth callback route handler"
```

---

### Task 7: Create middleware for route protection

**Files:**
- Create: `dashboard/middleware.ts`

- [ ] **Step 1: Write the middleware**

Create `middleware.ts` in the dashboard root:

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const publicRoutes = ['/login', '/signup', '/api/auth/callback'];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isPublicRoute = publicRoutes.some(route =>
    request.nextUrl.pathname.startsWith(route)
  );

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup')) {
    const url = request.nextUrl.clone();
    url.pathname = '/map';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

- [ ] **Step 2: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add middleware.ts && git commit -m "feat: add auth middleware for route protection"
```

---

### Task 8: Create auth pages (login + signup)

**Files:**
- Create: `dashboard/app/(auth)/layout.tsx`
- Create: `dashboard/app/(auth)/login/page.tsx`
- Create: `dashboard/app/(auth)/signup/page.tsx`

- [ ] **Step 1: Create the auth layout (no sidebar)**

Create `app/(auth)/layout.tsx`:

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create the login page**

Create `app/(auth)/login/page.tsx`:

```tsx
'use client';

import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/map');
      router.refresh();
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center mx-auto mb-4">
          <span className="text-black text-lg font-bold">M</span>
        </div>
        <h1 className="text-xl font-bold">Sign in to MineMarket</h1>
        <p className="text-gray-400 text-sm mt-1">Bulk minerals marketplace</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
            {error}
          </div>
        )}
        <div>
          <label htmlFor="email" className="block text-sm text-gray-400 mb-1">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
            placeholder="you@company.com"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm text-gray-400 mb-1">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-white text-black rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-white hover:underline">Sign up</Link>
      </p>
    </div>
  );
}
```

**Important:** Ensure email confirmation is disabled in Supabase Auth settings (Authentication → Providers → Email → toggle off "Confirm email"). Otherwise `auth.uid()` won't be set after signup and the profile insert will fail due to RLS.

- [ ] **Step 3: Create the signup page**

Create `app/(auth)/signup/page.tsx`:

```tsx
'use client';

import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import type { UserRole } from '@/lib/types';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState<UserRole>('buyer');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const { error: profileError } = await supabase.from('users').insert({
        id: data.user.id,
        role,
        company_name: companyName,
        country: 'ZA',
      });

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }
    }

    router.push('/map');
    router.refresh();
  }

  const roles: { value: UserRole; label: string; desc: string }[] = [
    { value: 'buyer', label: 'Buyer', desc: 'I want to purchase materials' },
    { value: 'seller', label: 'Seller', desc: 'I have materials to sell' },
    { value: 'both', label: 'Both', desc: 'I buy and sell materials' },
  ];

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center mx-auto mb-4">
          <span className="text-black text-lg font-bold">M</span>
        </div>
        <h1 className="text-xl font-bold">Create your account</h1>
        <p className="text-gray-400 text-sm mt-1">Join the marketplace</p>
      </div>

      <form onSubmit={handleSignup} className="space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
            {error}
          </div>
        )}
        <div>
          <label htmlFor="company" className="block text-sm text-gray-400 mb-1">Company name</label>
          <input
            id="company"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
            placeholder="Your company"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm text-gray-400 mb-1">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
            placeholder="you@company.com"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm text-gray-400 mb-1">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
            placeholder="••••••••"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-2">I am a</label>
          <div className="grid grid-cols-3 gap-2">
            {roles.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRole(r.value)}
                className={`p-3 rounded-lg border text-center transition-colors ${
                  role === r.value
                    ? 'border-white bg-gray-800 text-white'
                    : 'border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-600'
                }`}
              >
                <div className="text-sm font-medium">{r.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{r.desc}</div>
              </button>
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-white text-black rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-white hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add app/\(auth\) && git commit -m "feat: add login and signup pages with role selection"
```

---

### Task 9: Update sidebar navigation

**Files:**
- Modify: `dashboard/app/sidebar.tsx`

- [ ] **Step 1: Replace sidebar with new navigation**

Replace the entire contents of `app/sidebar.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

const navItems = [
  { label: 'Map', href: '/map', icon: MapIcon },
  { label: 'Trading', href: '/trading', icon: TradingIcon },
  { label: 'Marketplace', href: '/marketplace', icon: MarketplaceIcon },
  { label: 'Deals', href: '/deals', icon: DealsIcon },
  { label: 'Dashboard', href: '/dashboard', icon: DashboardIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-56 flex-col border-r border-gray-800 bg-gray-950 z-30">
        <div className="px-5 py-6">
          <Link href="/map" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-white flex items-center justify-center">
              <span className="text-black text-xs font-bold">M</span>
            </div>
            <span className="font-semibold text-sm tracking-tight">MineMarket</span>
          </Link>
        </div>
        <nav className="flex-1 px-3 space-y-0.5">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-900'
                }`}
              >
                <item.icon active={active} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-gray-800">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-900 transition-colors w-full"
          >
            <SignOutIcon />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 h-14 border-b border-gray-800 bg-gray-950/80 backdrop-blur-md z-30 flex items-center px-4 gap-4">
        <Link href="/map" className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-white flex items-center justify-center">
            <span className="text-black text-xs font-bold">M</span>
          </div>
          <span className="font-semibold text-sm">MineMarket</span>
        </Link>
        <nav className="flex gap-1 ml-4 overflow-x-auto">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="md:hidden h-14 flex-shrink-0" />
    </>
  );
}

function MapIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={active ? 'text-white' : 'text-gray-500'}>
      <path d="M1 3.5L5.5 1.5L10.5 3.5L15 1.5V12.5L10.5 14.5L5.5 12.5L1 14.5V3.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M5.5 1.5V12.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 3.5V14.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function TradingIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={active ? 'text-white' : 'text-gray-500'}>
      <path d="M1 12L5 6L9 9L15 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 3H15V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MarketplaceIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={active ? 'text-white' : 'text-gray-500'}>
      <rect x="1" y="3" width="14" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1 6.5H15" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 1.5V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11 1.5V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function DealsIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={active ? 'text-white' : 'text-gray-500'}>
      <path d="M2 8L6 12L14 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={active ? 'text-white' : 'text-gray-500'}>
      <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-gray-500">
      <path d="M6 14H3C2.44772 14 2 13.5523 2 13V3C2 2.44772 2.44772 2 3 2H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 11L13 8L10 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add app/sidebar.tsx && git commit -m "feat: update sidebar with marketplace navigation and sign out"
```

---

### Task 10: Update layout and create placeholder pages

**Files:**
- Modify: `dashboard/app/layout.tsx`
- Modify: `dashboard/app/page.tsx`
- Create: `dashboard/app/map/page.tsx`
- Create: `dashboard/app/trading/page.tsx`
- Create: `dashboard/app/marketplace/page.tsx`
- Create: `dashboard/app/deals/page.tsx`
- Create: `dashboard/app/dashboard/page.tsx`
- Delete: `dashboard/app/deployments/page.tsx`

- [ ] **Step 1: Update layout metadata**

In `app/layout.tsx`, replace the metadata:

```typescript
export const metadata: Metadata = {
  title: "MineMarket",
  description: "Bulk minerals aggregator marketplace",
};
```

- [ ] **Step 2: Update root page to redirect**

Replace `app/page.tsx`:

```typescript
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/map');
}
```

- [ ] **Step 3: Create placeholder pages**

Create `app/map/page.tsx`:

```tsx
export default function MapPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-2">Map View</h1>
      <p className="text-gray-400 text-sm">Browse mines, listings, and routes on the map.</p>
      <div className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-12 text-center text-gray-500">
        Map view coming in Plan 2
      </div>
    </div>
  );
}
```

Create `app/trading/page.tsx`:

```tsx
export default function TradingPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-2">Trading</h1>
      <p className="text-gray-400 text-sm">Market data, price charts, and recent deals.</p>
      <div className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-12 text-center text-gray-500">
        Trading view coming in Plan 3
      </div>
    </div>
  );
}
```

Create `app/marketplace/page.tsx`:

```tsx
export default function MarketplacePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-2">Marketplace</h1>
      <p className="text-gray-400 text-sm">Browse listings and buyer requirements.</p>
      <div className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-12 text-center text-gray-500">
        Marketplace coming in Plan 2
      </div>
    </div>
  );
}
```

Create `app/deals/page.tsx`:

```tsx
export default function DealsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-2">Deal Tracker</h1>
      <p className="text-gray-400 text-sm">Track your active deals and shipments.</p>
      <div className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-12 text-center text-gray-500">
        Deal tracker coming in Plan 3
      </div>
    </div>
  );
}
```

Create `app/dashboard/page.tsx`:

```tsx
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-2">My Dashboard</h1>
      <p className="text-gray-400 text-sm">Your listings, deals, and account overview.</p>
      <div className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-12 text-center text-gray-500">
        Dashboard coming in Plan 2
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Delete old deployments page**

```bash
rm /Users/alexnelja/projects/dashboard/app/deployments/page.tsx
rmdir /Users/alexnelja/projects/dashboard/app/deployments
```

- [ ] **Step 5: Verify the app compiles**

Run: `cd /Users/alexnelja/projects/dashboard && npx next build 2>&1 | tail -20`
Expected: Build completes successfully

- [ ] **Step 6: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add -A && git commit -m "feat: replace deployments with marketplace page structure

Add placeholder pages for map, trading, marketplace, deals, and
dashboard routes. Update layout metadata to MineMarket. Root page
redirects to /map. Remove old deployments page."
```

---

### Task 11: Verify everything works end-to-end

- [ ] **Step 1: Run the dev server and verify**

Run: `cd /Users/alexnelja/projects/dashboard && npm run build 2>&1 | tail -30`
Expected: Build succeeds with all routes listed:
- `/` (redirect)
- `/login`
- `/signup`
- `/map`
- `/trading`
- `/marketplace`
- `/deals`
- `/dashboard`
- `/api/auth/callback`

- [ ] **Step 2: Verify TypeScript has no errors**

Run: `cd /Users/alexnelja/projects/dashboard && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors
