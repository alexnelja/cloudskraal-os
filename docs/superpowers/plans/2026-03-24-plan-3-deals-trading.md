# Plan 3: Deals & Trading View

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the deal lifecycle (express interest → escrow → delivery → completion), the deal tracker with pipeline kanban and shipment map, and the trading view with price charts and market stats.

**Architecture:** Deals are created from listing detail pages via "Express Interest". Server Actions handle mutations (create deal, advance status, upload documents, submit ratings). The deal tracker has two tabs: a shipment map (Mapbox with vessel dots and route lines) and a pipeline kanban board. The trading view uses lightweight-charts for price history and computes stats from the deals/listings tables (no TimescaleDB in v1 — we derive stats directly from Supabase until volume justifies the separate instance).

**Tech Stack:** Next.js 16, Supabase (PostGIS), Mapbox GL JS, lightweight-charts (TradingView), Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-03-20-mining-aggregator-platform-design.md`

**Depends on:** Plan 2 (Marketplace & Map View) — complete

---

## File Structure

```
dashboard/
├── app/
│   ├── marketplace/
│   │   └── listings/
│   │       └── [id]/
│   │           └── page.tsx               # MODIFY - wire "Express Interest" button
│   ├── deals/
│   │   ├── page.tsx                       # MODIFY - deal tracker with two tabs
│   │   ├── pipeline-tab.tsx              # CREATE - kanban board view
│   │   ├── pipeline-card.tsx             # CREATE - deal card for kanban columns
│   │   ├── shipment-tab.tsx              # CREATE - shipment map + sidebar
│   │   ├── shipment-card.tsx             # CREATE - active shipment card
│   │   ├── deals-tab-switcher.tsx        # CREATE - client tab toggle (shipments/pipeline)
│   │   └── [id]/
│   │       ├── page.tsx                   # CREATE - deal detail page
│   │       ├── deal-actions.tsx           # CREATE - client component for status transitions
│   │       ├── milestone-timeline.tsx     # CREATE - milestone tracker component
│   │       ├── document-upload.tsx        # CREATE - document upload/list component
│   │       └── rating-form.tsx            # CREATE - post-deal rating form
│   ├── trading/
│   │   ├── page.tsx                       # MODIFY - trading dashboard
│   │   ├── stats-row.tsx                 # CREATE - 4 stat cards
│   │   ├── price-chart.tsx               # CREATE - lightweight-charts price history
│   │   ├── recent-deals-table.tsx        # CREATE - completed deals table
│   │   └── commodity-tab-switcher.tsx   # CREATE - client commodity selector
│   └── api/
│       └── deals/
│           ├── route.ts                   # CREATE - POST create deal
│           ├── [id]/
│           │   ├── route.ts               # CREATE - GET deal, PATCH status
│           │   ├── milestones/
│           │   │   └── route.ts           # CREATE - POST milestone
│           │   ├── documents/
│           │   │   └── route.ts           # CREATE - POST document upload
│           │   └── ratings/
│           │       └── route.ts           # CREATE - POST rating
│           └── stats/
│               └── route.ts               # CREATE - GET trading stats
├── lib/
│   ├── deal-queries.ts                    # CREATE - deal CRUD + queries
│   ├── deal-helpers.ts                    # CREATE - status transitions, price adjustments
│   └── format.ts                          # MODIFY - add currency/number formatters
└── package.json                           # MODIFY - add lightweight-charts
```

---

### Task 1: Install lightweight-charts and add format helpers

**Files:**
- Modify: `dashboard/package.json`
- Modify: `dashboard/lib/format.ts`

- [ ] **Step 1: Install lightweight-charts**

```bash
cd /Users/alexnelja/projects/dashboard && npm install lightweight-charts
```

- [ ] **Step 2: Add format helpers to lib/format.ts**

Add these functions after the existing `timeAgo` function in `lib/format.ts`:

```typescript
export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatTonnes(tonnes: number): string {
  if (tonnes >= 1_000_000) return `${(tonnes / 1_000_000).toFixed(1)}Mt`;
  if (tonnes >= 1_000) return `${(tonnes / 1_000).toFixed(1)}kt`;
  return `${tonnes.toLocaleString()}t`;
}

export function formatPctChange(current: number, previous: number): { text: string; positive: boolean } {
  if (previous === 0) return { text: '—', positive: true };
  const pct = ((current - previous) / previous) * 100;
  return {
    text: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`,
    positive: pct >= 0,
  };
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add package.json package-lock.json lib/format.ts && git commit -m "feat: install lightweight-charts and add currency/volume formatters"
```

---

### Task 2: Create deal query functions and status helpers

**Files:**
- Create: `dashboard/lib/deal-queries.ts`
- Create: `dashboard/lib/deal-helpers.ts`

- [ ] **Step 1: Create deal-queries.ts**

Create `lib/deal-queries.ts`:

```typescript
import { createServerSupabaseClient } from './supabase-server';
import type {
  Deal, DealMilestone, DealDocument, Rating, CommodityType,
} from './types';

// Extended deal with joined counterparty and listing info
export interface DealWithDetails extends Deal {
  counterparty_name: string;
  listing_commodity_label: string;
  mine_name: string;
  harbour_name: string;
}

export async function getDealsByUser(userId: string): Promise<DealWithDetails[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('deals')
    .select(`
      *,
      listings!listing_id (
        commodity_type,
        mines!source_mine_id (name),
        harbours!loading_port_id (name)
      )
    `)
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  // Fetch all counterparty IDs in one query
  const counterpartyIds = data.map((d: Record<string, unknown>) =>
    d.buyer_id === userId ? d.seller_id : d.buyer_id
  ) as string[];
  const uniqueIds = [...new Set(counterpartyIds)];

  const { data: users } = await supabase
    .from('users')
    .select('id, company_name')
    .in('id', uniqueIds);

  const userMap = new Map((users ?? []).map((u: { id: string; company_name: string }) => [u.id, u.company_name]));

  return data.map((d: Record<string, unknown>) => {
    const listing = d.listings as Record<string, unknown> | null;
    const mine = listing?.mines as Record<string, unknown> | null;
    const harbour = listing?.harbours as Record<string, unknown> | null;
    const counterpartyId = (d.buyer_id === userId ? d.seller_id : d.buyer_id) as string;

    return {
      ...d,
      counterparty_name: userMap.get(counterpartyId) ?? 'Unknown',
      listing_commodity_label: '',
      mine_name: (mine?.name as string) ?? 'Unknown',
      harbour_name: (harbour?.name as string) ?? 'Unknown',
    } as DealWithDetails;
  });
}

export async function getDealById(dealId: string, userId: string): Promise<DealWithDetails | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('deals')
    .select(`
      *,
      listings!listing_id (
        commodity_type, spec_sheet, volume_tonnes, price_per_tonne,
        mines!source_mine_id (name, region),
        harbours!loading_port_id (name)
      )
    `)
    .eq('id', dealId)
    .single();

  if (error || !data) return null;

  // Verify user is a participant
  if (data.buyer_id !== userId && data.seller_id !== userId) return null;

  const counterpartyId = data.buyer_id === userId ? data.seller_id : data.buyer_id;
  const { data: counterparty } = await supabase
    .from('users')
    .select('company_name')
    .eq('id', counterpartyId)
    .single();

  const listing = data.listings as Record<string, unknown> | null;
  const mine = listing?.mines as Record<string, unknown> | null;
  const harbour = listing?.harbours as Record<string, unknown> | null;

  return {
    ...data,
    counterparty_name: counterparty?.company_name ?? 'Unknown',
    listing_commodity_label: '',
    mine_name: (mine?.name as string) ?? 'Unknown',
    harbour_name: (harbour?.name as string) ?? 'Unknown',
  } as DealWithDetails;
}

export async function getDealMilestones(dealId: string): Promise<DealMilestone[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('deal_milestones')
    .select('*')
    .eq('deal_id', dealId)
    .order('timestamp', { ascending: true });

  if (error || !data) return [];
  return data as DealMilestone[];
}

export async function getDealDocuments(dealId: string): Promise<DealDocument[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('deal_documents')
    .select('*')
    .eq('deal_id', dealId)
    .order('uploaded_at', { ascending: false });

  if (error || !data) return [];
  return data as DealDocument[];
}

export async function getDealRatings(dealId: string): Promise<Rating[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('ratings')
    .select('*')
    .eq('deal_id', dealId);

  if (error || !data) return [];
  return data as Rating[];
}

export async function getCompletedDeals(commodity?: CommodityType): Promise<Deal[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from('deals')
    .select('*')
    .in('status', ['completed', 'escrow_released'])
    .order('created_at', { ascending: false })
    .limit(50);

  if (commodity) {
    query = query.eq('commodity_type', commodity);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data as Deal[];
}

export async function getTradingStats(commodity: CommodityType) {
  const supabase = await createServerSupabaseClient();

  // Active listings for this commodity
  const { data: listings } = await supabase
    .from('listings')
    .select('price_per_tonne, volume_tonnes')
    .eq('commodity_type', commodity)
    .eq('status', 'active');

  // Active deals
  const { data: activeDeals } = await supabase
    .from('deals')
    .select('agreed_price, volume_tonnes')
    .eq('commodity_type', commodity)
    .not('status', 'in', '("completed","cancelled","disputed")');

  // Recent completed deals (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentDeals } = await supabase
    .from('deals')
    .select('agreed_price, volume_tonnes, created_at')
    .eq('commodity_type', commodity)
    .in('status', ['completed', 'escrow_released'])
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: true });

  // Active requirements (bid side)
  const { data: requirements } = await supabase
    .from('requirements')
    .select('target_price, volume_needed')
    .eq('commodity_type', commodity)
    .eq('status', 'active');

  const listingsArr = listings ?? [];
  const activeDealsArr = activeDeals ?? [];
  const recentDealsArr = recentDeals ?? [];
  const requirementsArr = requirements ?? [];

  const avgAskPrice = listingsArr.length > 0
    ? listingsArr.reduce((sum, l) => sum + (l.price_per_tonne as number), 0) / listingsArr.length
    : 0;

  const avgBidPrice = requirementsArr.length > 0
    ? requirementsArr.reduce((sum, r) => sum + (r.target_price as number), 0) / requirementsArr.length
    : 0;

  const totalVolumeListed = listingsArr.reduce((sum, l) => sum + (l.volume_tonnes as number), 0);
  const totalDealValue = activeDealsArr.reduce(
    (sum, d) => sum + (d.agreed_price as number) * (d.volume_tonnes as number), 0
  );

  // Build price history from recent completed deals
  const priceHistory = recentDealsArr.map((d) => ({
    time: d.created_at as string,
    value: d.agreed_price as number,
  }));

  return {
    avgAskPrice,
    avgBidPrice,
    spread: avgAskPrice - avgBidPrice,
    totalVolumeListed,
    activeDealsCount: activeDealsArr.length,
    totalDealValue,
    priceHistory,
  };
}
```

- [ ] **Step 2: Create deal-helpers.ts**

Create `lib/deal-helpers.ts`:

```typescript
import type { DealStatus } from './types';

// Valid status transitions — maps current status to allowed next statuses
const TRANSITIONS: Record<DealStatus, DealStatus[]> = {
  interest: ['first_accept', 'cancelled'],
  first_accept: ['negotiation', 'cancelled'],
  negotiation: ['second_accept', 'cancelled'],
  second_accept: ['escrow_held', 'cancelled'],
  escrow_held: ['loading', 'disputed', 'cancelled'],
  loading: ['in_transit', 'disputed'],
  in_transit: ['delivered', 'disputed'],
  delivered: ['escrow_released', 'disputed'],
  escrow_released: ['completed'],
  completed: [],
  disputed: ['escrow_released', 'cancelled'],
  cancelled: [],
};

export function canTransition(current: DealStatus, next: DealStatus): boolean {
  return TRANSITIONS[current]?.includes(next) ?? false;
}

export function getNextStatuses(current: DealStatus): DealStatus[] {
  return TRANSITIONS[current] ?? [];
}

// Human-readable labels for deal statuses
export const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  interest: 'Interest',
  first_accept: 'First Accept',
  negotiation: 'Negotiation',
  second_accept: 'Second Accept',
  escrow_held: 'Escrow Held',
  loading: 'Loading',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  escrow_released: 'Escrow Released',
  completed: 'Completed',
  disputed: 'Disputed',
  cancelled: 'Cancelled',
};

// Color config for statuses
export const DEAL_STATUS_COLORS: Record<DealStatus, { bg: string; text: string; border: string }> = {
  interest: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  first_accept: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  negotiation: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  second_accept: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  escrow_held: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  loading: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' },
  in_transit: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' },
  delivered: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  escrow_released: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  completed: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  disputed: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  cancelled: { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/20' },
};

// Pipeline columns for kanban view
export const PIPELINE_COLUMNS: { key: string; label: string; statuses: DealStatus[] }[] = [
  { key: 'interest', label: 'Interest', statuses: ['interest', 'first_accept'] },
  { key: 'negotiation', label: 'Negotiation', statuses: ['negotiation', 'second_accept'] },
  { key: 'escrow', label: 'Escrow', statuses: ['escrow_held'] },
  { key: 'transit', label: 'In Transit', statuses: ['loading', 'in_transit'] },
  { key: 'completed', label: 'Completed', statuses: ['delivered', 'escrow_released', 'completed'] },
];

// Milestone types in order for progress display
export const MILESTONE_ORDER: { type: string; label: string }[] = [
  { type: 'loaded', label: 'Loaded' },
  { type: 'departed_port', label: 'Departed' },
  { type: 'in_transit', label: 'At Sea' },
  { type: 'arrived_port', label: 'Arrived' },
  { type: 'customs', label: 'Customs' },
  { type: 'delivered', label: 'Delivered' },
];
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/alexnelja/projects/dashboard && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add lib/deal-queries.ts lib/deal-helpers.ts && git commit -m "feat: add deal query functions and status transition helpers"
```

---

### Task 3: Create deal API routes

**Files:**
- Create: `dashboard/app/api/deals/route.ts`
- Create: `dashboard/app/api/deals/[id]/route.ts`
- Create: `dashboard/app/api/deals/[id]/milestones/route.ts`
- Create: `dashboard/app/api/deals/[id]/documents/route.ts`
- Create: `dashboard/app/api/deals/[id]/ratings/route.ts`
- Create: `dashboard/app/api/deals/stats/route.ts`

- [ ] **Step 1: Create POST /api/deals — create a deal from a listing**

Create `app/api/deals/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { listing_id } = body;

  if (!listing_id) {
    return NextResponse.json({ error: 'listing_id is required' }, { status: 400 });
  }

  // Fetch the listing
  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('*')
    .eq('id', listing_id)
    .eq('status', 'active')
    .single();

  if (listingError || !listing) {
    return NextResponse.json({ error: 'Listing not found or not active' }, { status: 404 });
  }

  // Cannot express interest in your own listing
  if (listing.seller_id === user.id) {
    return NextResponse.json({ error: 'Cannot express interest in your own listing' }, { status: 400 });
  }

  // Enforce allocation mode
  if (listing.allocation_mode === 'invite_only') {
    const preferredIds: string[] = listing.preferred_buyer_ids ?? [];
    if (!preferredIds.includes(user.id)) {
      return NextResponse.json({ error: 'This listing is invite-only' }, { status: 403 });
    }
  }

  // Enforce max_buyers
  if (listing.max_buyers) {
    const { count } = await supabase
      .from('deals')
      .select('id', { count: 'exact', head: true })
      .eq('listing_id', listing_id)
      .not('status', 'in', '("cancelled")');

    if ((count ?? 0) >= listing.max_buyers) {
      return NextResponse.json({ error: 'This listing has reached its maximum number of buyers' }, { status: 400 });
    }
  }

  // Check for existing deal on this listing by this buyer
  const { data: existing } = await supabase
    .from('deals')
    .select('id')
    .eq('listing_id', listing_id)
    .eq('buyer_id', user.id)
    .not('status', 'in', '("cancelled")')
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'You already have an active deal on this listing', existing_deal_id: existing[0].id }, { status: 409 });
  }

  // Create the deal
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .insert({
      listing_id,
      buyer_id: user.id,
      seller_id: listing.seller_id,
      commodity_type: listing.commodity_type,
      volume_tonnes: listing.volume_tonnes,
      agreed_price: listing.price_per_tonne,
      currency: listing.currency,
      incoterm: listing.incoterms[0],
      spec_tolerances: {},
      price_adjustment_rules: {},
      escrow_status: 'pending_deposit',
      status: 'interest',
    })
    .select()
    .single();

  if (dealError) {
    return NextResponse.json({ error: dealError.message }, { status: 500 });
  }

  return NextResponse.json(deal, { status: 201 });
}
```

- [ ] **Step 2: Create GET/PATCH /api/deals/[id] — read and update deal status**

Create `app/api/deals/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { canTransition } from '@/lib/deal-helpers';
import type { DealStatus } from '@/lib/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: deal, error } = await supabase
    .from('deals')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !deal) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
  }

  if (deal.buyer_id !== user.id && deal.seller_id !== user.id) {
    return NextResponse.json({ error: 'Not authorized to view this deal' }, { status: 403 });
  }

  return NextResponse.json(deal);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { status: newStatus } = body as { status: DealStatus };

  if (!newStatus) {
    return NextResponse.json({ error: 'status is required' }, { status: 400 });
  }

  // Fetch current deal
  const { data: deal, error: fetchError } = await supabase
    .from('deals')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !deal) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
  }

  if (deal.buyer_id !== user.id && deal.seller_id !== user.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  if (!canTransition(deal.status as DealStatus, newStatus)) {
    return NextResponse.json({
      error: `Cannot transition from ${deal.status} to ${newStatus}`,
    }, { status: 400 });
  }

  // Build update payload
  const update: Record<string, unknown> = { status: newStatus };

  // Lock FX rate and escrow at second_accept
  if (newStatus === 'second_accept') {
    update.second_accept_at = new Date().toISOString();
    update.escrow_amount = (deal.agreed_price as number) * (deal.volume_tonnes as number);
  }

  // Update escrow status for relevant transitions
  if (newStatus === 'escrow_held') update.escrow_status = 'held';
  if (newStatus === 'escrow_released') update.escrow_status = 'releasing';
  if (newStatus === 'completed') update.escrow_status = 'released';
  if (newStatus === 'disputed') update.escrow_status = 'frozen';

  const { data: updated, error: updateError } = await supabase
    .from('deals')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json(updated);
}
```

- [ ] **Step 3: Create POST /api/deals/[id]/milestones**

Create `app/api/deals/[id]/milestones/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id: dealId } = await context.params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify participation
  const { data: deal } = await supabase
    .from('deals')
    .select('buyer_id, seller_id')
    .eq('id', dealId)
    .single();

  if (!deal || (deal.buyer_id !== user.id && deal.seller_id !== user.id)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const body = await request.json();
  const { milestone_type, location_name, notes } = body;

  if (!milestone_type) {
    return NextResponse.json({ error: 'milestone_type is required' }, { status: 400 });
  }

  const { data: milestone, error } = await supabase
    .from('deal_milestones')
    .insert({
      deal_id: dealId,
      milestone_type,
      timestamp: new Date().toISOString(),
      location_name: location_name ?? null,
      notes: notes ?? null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(milestone, { status: 201 });
}
```

- [ ] **Step 4: Create POST /api/deals/[id]/documents**

Create `app/api/deals/[id]/documents/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id: dealId } = await context.params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify participation
  const { data: deal } = await supabase
    .from('deals')
    .select('buyer_id, seller_id')
    .eq('id', dealId)
    .single();

  if (!deal || (deal.buyer_id !== user.id && deal.seller_id !== user.id)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const docType = formData.get('doc_type') as string | null;

  if (!file || !docType) {
    return NextResponse.json({ error: 'file and doc_type are required' }, { status: 400 });
  }

  // Upload to Supabase Storage
  const filePath = `deals/${dealId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from('deal-documents')
    .upload(filePath, file);

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // Create document record
  const { data: doc, error: docError } = await supabase
    .from('deal_documents')
    .insert({
      deal_id: dealId,
      doc_type: docType,
      file_url: filePath,
      uploaded_by: user.id,
      verified: false,
    })
    .select()
    .single();

  if (docError) {
    return NextResponse.json({ error: docError.message }, { status: 500 });
  }

  return NextResponse.json(doc, { status: 201 });
}
```

- [ ] **Step 5: Create POST /api/deals/[id]/ratings**

Create `app/api/deals/[id]/ratings/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id: dealId } = await context.params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify deal is completed and user is a participant
  const { data: deal } = await supabase
    .from('deals')
    .select('buyer_id, seller_id, status')
    .eq('id', dealId)
    .single();

  if (!deal || (deal.buyer_id !== user.id && deal.seller_id !== user.id)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  if (!['completed', 'escrow_released'].includes(deal.status)) {
    return NextResponse.json({ error: 'Deal must be completed to leave a rating' }, { status: 400 });
  }

  // Check if already rated
  const { data: existing } = await supabase
    .from('ratings')
    .select('id')
    .eq('deal_id', dealId)
    .eq('rater_id', user.id)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'You have already rated this deal' }, { status: 409 });
  }

  const body = await request.json();
  const { spec_accuracy, timeliness, communication, documentation, comment } = body;

  // Validate ratings are 1-5
  for (const [field, value] of Object.entries({ spec_accuracy, timeliness, communication, documentation })) {
    if (typeof value !== 'number' || value < 1 || value > 5) {
      return NextResponse.json({ error: `${field} must be between 1 and 5` }, { status: 400 });
    }
  }

  const ratedUserId = deal.buyer_id === user.id ? deal.seller_id : deal.buyer_id;

  const { data: rating, error } = await supabase
    .from('ratings')
    .insert({
      deal_id: dealId,
      rater_id: user.id,
      rated_user_id: ratedUserId,
      spec_accuracy,
      timeliness,
      communication,
      documentation,
      comment: comment ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(rating, { status: 201 });
}
```

- [ ] **Step 6: Create GET /api/deals/stats — trading stats endpoint**

Create `app/api/deals/stats/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getTradingStats } from '@/lib/deal-queries';
import type { CommodityType } from '@/lib/types';

const VALID_COMMODITIES: CommodityType[] = ['chrome', 'manganese', 'iron_ore', 'coal', 'aggregates'];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const commodity = searchParams.get('commodity') as CommodityType | null;

  if (!commodity || !VALID_COMMODITIES.includes(commodity)) {
    return NextResponse.json({ error: 'Valid commodity parameter required' }, { status: 400 });
  }

  const stats = await getTradingStats(commodity);
  return NextResponse.json(stats);
}
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `cd /Users/alexnelja/projects/dashboard && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 8: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add app/api/deals/ && git commit -m "feat: add deal API routes (create, status transitions, milestones, documents, ratings, stats)"
```

---

### Task 4: Wire "Express Interest" on listing detail page

**Files:**
- Modify: `dashboard/app/marketplace/listings/[id]/page.tsx`

- [ ] **Step 1: Replace the disabled Express Interest placeholder with a working client component**

Replace the `/* Express Interest — Plan 3 placeholder */` section (lines 126–140) in `app/marketplace/listings/[id]/page.tsx` with a working button. Since the page is a server component, add a client component inline. Add this import at the top of the file:

```typescript
import { ExpressInterestButton } from './express-interest-button';
```

Replace lines 126–140 with:

```tsx
      {/* Express Interest */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Interested in this listing?</h2>
            <p className="text-xs text-gray-500 mt-1">Start a deal by expressing interest to the seller.</p>
          </div>
          <ExpressInterestButton listingId={listing.id} />
        </div>
      </div>
```

- [ ] **Step 2: Create the ExpressInterestButton client component**

Create `app/marketplace/listings/[id]/express-interest-button.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ExpressInterestButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExpressInterest() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listingId }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 && data.existing_deal_id) {
          router.push(`/deals/${data.existing_deal_id}`);
          return;
        }
        setError(data.error || 'Failed to express interest');
        return;
      }

      router.push(`/deals/${data.id}`);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleExpressInterest}
        disabled={loading}
        className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
      >
        {loading ? 'Submitting…' : 'Express Interest'}
      </button>
      {error && (
        <p className="text-xs text-red-400 mt-2 text-right">{error}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/alexnelja/projects/dashboard && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add app/marketplace/listings/\[id\]/page.tsx app/marketplace/listings/\[id\]/express-interest-button.tsx && git commit -m "feat: wire Express Interest button on listing detail page"
```

---

### Task 5: Build the deal detail page

**Files:**
- Create: `dashboard/app/deals/[id]/page.tsx`
- Create: `dashboard/app/deals/[id]/deal-actions.tsx`
- Create: `dashboard/app/deals/[id]/milestone-timeline.tsx`

- [ ] **Step 1: Create the deal detail server page**

Create `app/deals/[id]/page.tsx`:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { getDealById, getDealMilestones, getDealDocuments, getDealRatings } from '@/lib/deal-queries';
import { DEAL_STATUS_LABELS, DEAL_STATUS_COLORS } from '@/lib/deal-helpers';
import { COMMODITY_CONFIG } from '@/lib/types';
import { formatCurrency, timeAgo } from '@/lib/format';
import { DealActions } from './deal-actions';
import { MilestoneTimeline } from './milestone-timeline';
import { DocumentUpload } from './document-upload';
import { RatingForm } from './rating-form';

interface DealDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function DealDetailPage({ params }: DealDetailPageProps) {
  const user = await requireAuth();
  const { id } = await params;

  const deal = await getDealById(id, user.id);
  if (!deal) notFound();

  const [milestones, documents, ratings] = await Promise.all([
    getDealMilestones(id),
    getDealDocuments(id),
    getDealRatings(id),
  ]);

  const config = COMMODITY_CONFIG[deal.commodity_type];
  const statusColors = DEAL_STATUS_COLORS[deal.status];
  const isBuyer = deal.buyer_id === user.id;
  const hasRated = ratings.some((r) => r.rater_id === user.id);

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href="/deals"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 transition-colors"
      >
        ← Back to Deals
      </Link>

      {/* Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: config.color }} />
              <h1 className="text-xl font-bold text-white">{config.label} Deal</h1>
              <span className={`text-xs px-2.5 py-0.5 rounded-full border ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}>
                {DEAL_STATUS_LABELS[deal.status]}
              </span>
            </div>
            <p className="text-gray-400 text-sm mt-1">
              {isBuyer ? 'Seller' : 'Buyer'}: {deal.counterparty_name}
            </p>
          </div>
          <div className="text-right">
            <div className="text-amber-400 text-xl font-bold">
              {formatCurrency(deal.agreed_price, deal.currency)}/t
            </div>
            <div className="text-gray-500 text-xs mt-0.5">
              {deal.volume_tonnes.toLocaleString()}t · {deal.incoterm}
            </div>
          </div>
        </div>

        {/* Deal details grid */}
        <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-gray-800">
          <div>
            <p className="text-xs text-gray-500">Mine</p>
            <p className="text-sm text-white">{deal.mine_name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Loading Port</p>
            <p className="text-sm text-white">{deal.harbour_name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Value</p>
            <p className="text-sm text-white">
              {formatCurrency(deal.agreed_price * deal.volume_tonnes, deal.currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Escrow</p>
            <p className="text-sm text-white capitalize">
              {deal.escrow_amount ? formatCurrency(deal.escrow_amount, deal.currency) : '—'}{' '}
              <span className="text-gray-500">({deal.escrow_status.replace('_', ' ')})</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Created</p>
            <p className="text-sm text-white">{timeAgo(deal.created_at)}</p>
          </div>
          {deal.second_accept_at && (
            <div>
              <p className="text-xs text-gray-500">Second Accept</p>
              <p className="text-sm text-white">{timeAgo(deal.second_accept_at)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Actions — advance deal status */}
      <DealActions
        dealId={deal.id}
        currentStatus={deal.status}
        isBuyer={isBuyer}
      />

      {/* Milestone timeline */}
      <MilestoneTimeline
        dealId={deal.id}
        milestones={milestones}
        dealStatus={deal.status}
        isBuyer={isBuyer}
      />

      {/* Documents */}
      <DocumentUpload
        dealId={deal.id}
        documents={documents}
      />

      {/* Rating form — only shown for completed deals */}
      {(['completed', 'escrow_released'] as string[]).includes(deal.status) && !hasRated && (
        <RatingForm dealId={deal.id} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the deal actions client component**

Create `app/deals/[id]/deal-actions.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getNextStatuses, DEAL_STATUS_LABELS, DEAL_STATUS_COLORS } from '@/lib/deal-helpers';
import type { DealStatus } from '@/lib/types';

interface DealActionsProps {
  dealId: string;
  currentStatus: DealStatus;
  isBuyer: boolean;
}

export function DealActions({ dealId, currentStatus, isBuyer }: DealActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextStatuses = getNextStatuses(currentStatus);

  if (nextStatuses.length === 0) return null;

  async function advanceStatus(newStatus: DealStatus) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to update status');
        return;
      }

      router.refresh();
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Actions</h2>
      <div className="flex flex-wrap gap-2">
        {nextStatuses.map((status) => {
          const colors = DEAL_STATUS_COLORS[status];
          const isDestructive = status === 'cancelled' || status === 'disputed';
          return (
            <button
              key={status}
              onClick={() => advanceStatus(status)}
              disabled={loading}
              className={`text-sm font-medium px-4 py-2 rounded-lg border transition-colors disabled:opacity-50 ${
                isDestructive
                  ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                  : `${colors.border} ${colors.text} hover:${colors.bg}`
              }`}
            >
              {loading ? '…' : `→ ${DEAL_STATUS_LABELS[status]}`}
            </button>
          );
        })}
      </div>
      {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
      <p className="text-xs text-gray-600 mt-3">
        You are the {isBuyer ? 'buyer' : 'seller'} in this deal.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Create the milestone timeline component**

Create `app/deals/[id]/milestone-timeline.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MILESTONE_ORDER } from '@/lib/deal-helpers';
import type { DealMilestone, DealStatus, MilestoneType } from '@/lib/types';

interface MilestoneTimelineProps {
  dealId: string;
  milestones: DealMilestone[];
  dealStatus: DealStatus;
  isBuyer: boolean;
}

export function MilestoneTimeline({ dealId, milestones, dealStatus, isBuyer }: MilestoneTimelineProps) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const completedTypes = new Set(milestones.map((m) => m.milestone_type));

  // Only show add milestone for active shipping statuses
  const showAdd = ['loading', 'in_transit', 'delivered'].includes(dealStatus);

  // Determine which milestone types can be added
  const addableTypes = MILESTONE_ORDER
    .filter((m) => !completedTypes.has(m.type as MilestoneType))
    .map((m) => m.type);

  async function addMilestone(type: string) {
    setAdding(true);
    setError(null);

    try {
      const res = await fetch(`/api/deals/${dealId}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          milestone_type: type,
          location_name: locationName || null,
          notes: notes || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to add milestone');
        return;
      }

      setLocationName('');
      setNotes('');
      router.refresh();
    } catch {
      setError('Something went wrong');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Shipment Progress</h2>

      {/* Timeline */}
      <div className="flex items-center gap-1 mb-6">
        {MILESTONE_ORDER.map((step, i) => {
          const completed = completedTypes.has(step.type as MilestoneType);
          const milestone = milestones.find((m) => m.milestone_type === step.type);
          return (
            <div key={step.type} className="flex-1 flex flex-col items-center">
              <div className="flex items-center w-full">
                {i > 0 && (
                  <div className={`flex-1 h-0.5 ${completed ? 'bg-emerald-500' : 'bg-gray-700'}`} />
                )}
                <div
                  className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                    completed
                      ? 'bg-emerald-500 border-emerald-500'
                      : 'bg-gray-900 border-gray-600'
                  }`}
                />
                {i < MILESTONE_ORDER.length - 1 && (
                  <div className={`flex-1 h-0.5 ${completed ? 'bg-emerald-500' : 'bg-gray-700'}`} />
                )}
              </div>
              <span className={`text-[10px] mt-1.5 ${completed ? 'text-emerald-400' : 'text-gray-600'}`}>
                {step.label}
              </span>
              {milestone && (
                <span className="text-[9px] text-gray-500">
                  {milestone.location_name ?? ''}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Add milestone form */}
      {showAdd && addableTypes.length > 0 && (
        <div className="border-t border-gray-800 pt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Location (optional)"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
            <input
              type="text"
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {addableTypes.map((type) => {
              const label = MILESTONE_ORDER.find((m) => m.type === type)?.label ?? type;
              return (
                <button
                  key={type}
                  onClick={() => addMilestone(type)}
                  disabled={adding}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white transition-colors disabled:opacity-50"
                >
                  + {label}
                </button>
              );
            })}
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Users/alexnelja/projects/dashboard && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add app/deals/\[id\]/page.tsx app/deals/\[id\]/deal-actions.tsx app/deals/\[id\]/milestone-timeline.tsx && git commit -m "feat: add deal detail page with actions and milestone timeline"
```

---

### Task 6: Build document upload and rating form components

**Files:**
- Create: `dashboard/app/deals/[id]/document-upload.tsx`
- Create: `dashboard/app/deals/[id]/rating-form.tsx`

- [ ] **Step 1: Create document upload component**

Create `app/deals/[id]/document-upload.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DealDocument, DocType } from '@/lib/types';
import { timeAgo } from '@/lib/format';

const DOC_TYPE_LABELS: Record<DocType, string> = {
  bill_of_lading: 'Bill of Lading',
  certificate_of_origin: 'Certificate of Origin',
  weighbridge_ticket: 'Weighbridge Ticket',
  lab_report: 'Lab Report',
  customs_declaration: 'Customs Declaration',
  invoice: 'Invoice',
};

interface DocumentUploadProps {
  dealId: string;
  documents: DealDocument[];
}

export function DocumentUpload({ dealId, documents }: DocumentUploadProps) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<DocType>('bill_of_lading');

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('doc_type', selectedType);

      const res = await fetch(`/api/deals/${dealId}/documents`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Upload failed');
        return;
      }

      router.refresh();
    } catch {
      setError('Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Documents</h2>

      {/* Existing documents */}
      {documents.length > 0 && (
        <div className="space-y-2 mb-4">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between py-2 px-3 bg-gray-950 rounded-lg border border-gray-800"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">📄</span>
                <div>
                  <p className="text-sm text-white">{DOC_TYPE_LABELS[doc.doc_type]}</p>
                  <p className="text-xs text-gray-500">{timeAgo(doc.uploaded_at)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {doc.verified && (
                  <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                    ✓
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload form */}
      <div className="flex items-center gap-3">
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as DocType)}
          className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-gray-500"
        >
          {(Object.entries(DOC_TYPE_LABELS) as [DocType, string][]).map(([type, label]) => (
            <option key={type} value={type}>{label}</option>
          ))}
        </select>
        <label className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white transition-colors cursor-pointer">
          {uploading ? 'Uploading…' : '+ Upload'}
          <input
            type="file"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          />
        </label>
      </div>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Create rating form component**

Create `app/deals/[id]/rating-form.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const DIMENSIONS = [
  { key: 'spec_accuracy', label: 'Spec Accuracy', description: 'Material matched agreed specifications' },
  { key: 'timeliness', label: 'Timeliness', description: 'Delivered on schedule' },
  { key: 'communication', label: 'Communication', description: 'Responsive and clear communication' },
  { key: 'documentation', label: 'Documentation', description: 'Complete and accurate paperwork' },
];

interface RatingFormProps {
  dealId: string;
}

export function RatingForm({ dealId }: RatingFormProps) {
  const router = useRouter();
  const [ratings, setRatings] = useState<Record<string, number>>({
    spec_accuracy: 0,
    timeliness: 0,
    communication: 0,
    documentation: 0,
  });
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setRating(key: string, value: number) {
    setRatings((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate all ratings filled
    for (const dim of DIMENSIONS) {
      if (!ratings[dim.key] || ratings[dim.key] === 0) {
        setError(`Please rate ${dim.label}`);
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/deals/${dealId}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...ratings, comment: comment || null }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to submit rating');
        return;
      }

      router.refresh();
    } catch {
      setError('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Rate this Deal</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {DIMENSIONS.map((dim) => (
          <div key={dim.key}>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-white">{dim.label}</label>
              <span className="text-xs text-gray-500">{dim.description}</span>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(dim.key, value)}
                  className={`w-9 h-9 rounded-lg border text-sm font-medium transition-colors ${
                    ratings[dim.key] >= value
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      : 'bg-gray-950 text-gray-600 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div>
          <label className="text-sm text-white block mb-1">Comment (optional)</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder="Any additional feedback…"
            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-none"
          />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
        >
          {submitting ? 'Submitting…' : 'Submit Rating'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/alexnelja/projects/dashboard && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add app/deals/\[id\]/document-upload.tsx app/deals/\[id\]/rating-form.tsx && git commit -m "feat: add document upload and rating form components"
```

---

### Task 7: Build the pipeline kanban tab

**Files:**
- Create: `dashboard/app/deals/pipeline-tab.tsx`
- Create: `dashboard/app/deals/pipeline-card.tsx`

- [ ] **Step 1: Create the pipeline card component**

Create `app/deals/pipeline-card.tsx`:

```tsx
import Link from 'next/link';
import { COMMODITY_CONFIG } from '@/lib/types';
import { DEAL_STATUS_LABELS, DEAL_STATUS_COLORS } from '@/lib/deal-helpers';
import { formatCurrency, timeAgo } from '@/lib/format';
import type { DealWithDetails } from '@/lib/deal-queries';

interface PipelineCardProps {
  deal: DealWithDetails;
}

export function PipelineCard({ deal }: PipelineCardProps) {
  const config = COMMODITY_CONFIG[deal.commodity_type];
  const statusColors = DEAL_STATUS_COLORS[deal.status];

  return (
    <Link
      href={`/deals/${deal.id}`}
      className="block bg-gray-950 border border-gray-800 rounded-lg p-3 hover:border-gray-700 transition-colors"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
        <span className="text-xs font-medium text-white">{config.label}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ml-auto ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}>
          {DEAL_STATUS_LABELS[deal.status]}
        </span>
      </div>
      <div className="text-xs text-gray-400">{deal.counterparty_name}</div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-sm font-semibold text-amber-500">
          {formatCurrency(deal.agreed_price, deal.currency)}/t
        </span>
        <span className="text-xs text-gray-500">
          {deal.volume_tonnes.toLocaleString()}t
        </span>
      </div>
      <div className="text-[10px] text-gray-600 mt-1">{timeAgo(deal.created_at)}</div>
    </Link>
  );
}
```

- [ ] **Step 2: Create the pipeline tab component**

Create `app/deals/pipeline-tab.tsx`:

```tsx
import { PIPELINE_COLUMNS } from '@/lib/deal-helpers';
import { PipelineCard } from './pipeline-card';
import type { DealWithDetails } from '@/lib/deal-queries';

interface PipelineTabProps {
  deals: DealWithDetails[];
}

export function PipelineTab({ deals }: PipelineTabProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {PIPELINE_COLUMNS.map((column) => {
        const columnDeals = deals.filter((d) => column.statuses.includes(d.status));
        return (
          <div key={column.key} className="flex-shrink-0 w-64">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {column.label}
              </h3>
              <span className="text-xs text-gray-600 bg-gray-800 rounded-full px-2 py-0.5">
                {columnDeals.length}
              </span>
            </div>
            <div className="space-y-2">
              {columnDeals.length === 0 ? (
                <div className="text-xs text-gray-600 text-center py-6 border border-dashed border-gray-800 rounded-lg">
                  No deals
                </div>
              ) : (
                columnDeals.map((deal) => (
                  <PipelineCard key={deal.id} deal={deal} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add app/deals/pipeline-tab.tsx app/deals/pipeline-card.tsx && git commit -m "feat: add pipeline kanban tab with deal cards"
```

---

### Task 8: Build the shipment map tab

**Files:**
- Create: `dashboard/app/deals/shipment-tab.tsx`
- Create: `dashboard/app/deals/shipment-card.tsx`

- [ ] **Step 1: Create the shipment card component**

Create `app/deals/shipment-card.tsx`:

```tsx
import Link from 'next/link';
import { COMMODITY_CONFIG } from '@/lib/types';
import { MILESTONE_ORDER, DEAL_STATUS_LABELS } from '@/lib/deal-helpers';
import { formatCurrency } from '@/lib/format';
import type { DealWithDetails } from '@/lib/deal-queries';
import type { DealMilestone, MilestoneType } from '@/lib/types';

interface ShipmentCardProps {
  deal: DealWithDetails;
  milestones: DealMilestone[];
  isSelected: boolean;
  onSelect: (dealId: string) => void;
}

export function ShipmentCard({ deal, milestones, isSelected, onSelect }: ShipmentCardProps) {
  const config = COMMODITY_CONFIG[deal.commodity_type];
  const completedTypes = new Set(milestones.map((m) => m.milestone_type));

  return (
    <div
      onClick={() => onSelect(deal.id)}
      className={`border rounded-lg p-3 cursor-pointer transition-colors ${
        isSelected
          ? 'bg-gray-800/50 border-gray-600'
          : 'bg-gray-950 border-gray-800 hover:border-gray-700'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
        <span className="text-xs font-medium text-white">{config.label}</span>
        <span className="text-xs text-gray-500 ml-auto">{DEAL_STATUS_LABELS[deal.status]}</span>
      </div>
      <div className="text-xs text-gray-400 mb-1">
        {deal.mine_name} → {deal.harbour_name}
      </div>
      <div className="text-xs text-gray-400 mb-2">
        {formatCurrency(deal.agreed_price * deal.volume_tonnes, deal.currency)} · {deal.volume_tonnes.toLocaleString()}t
      </div>

      {/* Mini milestone bar */}
      <div className="flex gap-0.5">
        {MILESTONE_ORDER.map((step) => (
          <div
            key={step.type}
            className={`flex-1 h-1 rounded-full ${
              completedTypes.has(step.type as MilestoneType) ? 'bg-emerald-500' : 'bg-gray-700'
            }`}
          />
        ))}
      </div>

      <Link
        href={`/deals/${deal.id}`}
        className="text-[10px] text-gray-500 hover:text-gray-300 mt-2 block"
        onClick={(e) => e.stopPropagation()}
      >
        View details →
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Create the shipment tab component**

Create `app/deals/shipment-tab.tsx`:

```tsx
'use client';

import { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { ShipmentCard } from './shipment-card';
import { COMMODITY_CONFIG } from '@/lib/types';
import type { DealWithDetails } from '@/lib/deal-queries';
import type { DealMilestone, GeoPoint } from '@/lib/types';

interface ShipmentTabProps {
  deals: DealWithDetails[];
  milestonesMap: Record<string, DealMilestone[]>;
  harbourLocations: Record<string, GeoPoint>;
  mineLocations: Record<string, GeoPoint>;
}

export function ShipmentTab({ deals, milestonesMap, harbourLocations, mineLocations }: ShipmentTabProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  // Filter to in-transit deals only
  const transitDeals = deals.filter((d) =>
    ['loading', 'in_transit', 'delivered'].includes(d.status)
  );

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [35, -10],
      zoom: 3,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Draw deal routes and vessel positions
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    function addLayers() {
      const m = map.current!;

      // Remove existing layers
      if (m.getLayer('deal-routes')) m.removeLayer('deal-routes');
      if (m.getSource('deal-routes')) m.removeSource('deal-routes');

      // Build route features
      const features = transitDeals
        .map((deal) => {
          const mineLoc = mineLocations[deal.mine_name];
          const harbourLoc = harbourLocations[deal.harbour_name];
          if (!mineLoc || !harbourLoc) return null;

          const config = COMMODITY_CONFIG[deal.commodity_type];
          return {
            type: 'Feature' as const,
            properties: { color: config.color, dealId: deal.id },
            geometry: {
              type: 'LineString' as const,
              coordinates: [
                [mineLoc.lng, mineLoc.lat],
                [harbourLoc.lng, harbourLoc.lat],
              ],
            },
          };
        })
        .filter(Boolean);

      if (features.length > 0) {
        m.addSource('deal-routes', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: features as GeoJSON.Feature[] },
        });

        m.addLayer({
          id: 'deal-routes',
          type: 'line',
          source: 'deal-routes',
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 2,
            'line-dasharray': [4, 3],
            'line-opacity': 0.7,
          },
        });
      }

      // Add pulsing vessel dots at midpoint of each route
      transitDeals.forEach((deal) => {
        const mineLoc = mineLocations[deal.mine_name];
        const harbourLoc = harbourLocations[deal.harbour_name];
        if (!mineLoc || !harbourLoc) return;

        // Estimate position along route based on milestones
        const milestones = milestonesMap[deal.id] ?? [];
        const progress = milestones.length / 6; // rough progress
        const lng = mineLoc.lng + (harbourLoc.lng - mineLoc.lng) * Math.min(progress, 0.95);
        const lat = mineLoc.lat + (harbourLoc.lat - mineLoc.lat) * Math.min(progress, 0.95);

        const config = COMMODITY_CONFIG[deal.commodity_type];
        const el = document.createElement('div');
        el.style.cssText = `
          width: 12px; height: 12px;
          background: ${config.color};
          border-radius: 50%;
          border: 2px solid #0f172a;
          box-shadow: 0 0 12px ${config.color}88;
          cursor: pointer;
          animation: pulse 2s ease-in-out infinite;
        `;

        const marker = new mapboxgl.Marker(el)
          .setLngLat([lng, lat])
          .addTo(m);

        markersRef.current.push(marker);

        el.addEventListener('click', () => setSelectedDealId(deal.id));
      });
    }

    if (map.current.isStyleLoaded()) {
      addLayers();
    } else {
      map.current.on('style.load', addLayers);
    }
  }, [transitDeals, mineLocations, harbourLocations, milestonesMap]);

  // Pan to selected deal
  useEffect(() => {
    if (!map.current || !selectedDealId) return;
    const deal = transitDeals.find((d) => d.id === selectedDealId);
    if (!deal) return;
    const harbourLoc = harbourLocations[deal.harbour_name];
    if (harbourLoc) {
      map.current.flyTo({ center: [harbourLoc.lng, harbourLoc.lat], zoom: 5, duration: 1000 });
    }
  }, [selectedDealId, transitDeals, harbourLocations]);

  return (
    <div className="flex h-[calc(100vh-12rem)] -mx-6 md:-mx-10">
      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapContainer} className="absolute inset-0" />
        {transitDeals.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-gray-500 text-sm bg-gray-950/80 px-4 py-2 rounded-lg">No active shipments</p>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="w-72 border-l border-gray-800 bg-gray-950 overflow-y-auto p-3 space-y-2">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
          Active Shipments ({transitDeals.length})
        </h3>
        {transitDeals.map((deal) => (
          <ShipmentCard
            key={deal.id}
            deal={deal}
            milestones={milestonesMap[deal.id] ?? []}
            isSelected={selectedDealId === deal.id}
            onSelect={setSelectedDealId}
          />
        ))}
        {transitDeals.length === 0 && (
          <p className="text-xs text-gray-600 text-center py-8">
            Shipments will appear here when deals reach the loading stage.
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/alexnelja/projects/dashboard && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add app/deals/shipment-tab.tsx app/deals/shipment-card.tsx && git commit -m "feat: add shipment map tab with vessel tracking and route lines"
```

---

### Task 9: Wire up the deals page with tabs

**Files:**
- Modify: `dashboard/app/deals/page.tsx`

- [ ] **Step 1: Replace the placeholder deals page with the real tabbed layout**

Replace `app/deals/page.tsx` entirely:

```tsx
import { requireAuth } from '@/lib/auth';
import { getDealsByUser, getDealMilestones } from '@/lib/deal-queries';
import { getMines, getHarbours } from '@/lib/queries';
import { PipelineTab } from './pipeline-tab';
import { ShipmentTab } from './shipment-tab';
import { DealsTabSwitcher } from './deals-tab-switcher';
import type { DealMilestone, GeoPoint } from '@/lib/types';

export default async function DealsPage() {
  const user = await requireAuth();
  const deals = await getDealsByUser(user.id);

  // Fetch milestones for in-transit deals
  const transitDeals = deals.filter((d) =>
    ['loading', 'in_transit', 'delivered'].includes(d.status)
  );
  const milestonesEntries = await Promise.all(
    transitDeals.map(async (d) => {
      const milestones = await getDealMilestones(d.id);
      return [d.id, milestones] as [string, DealMilestone[]];
    })
  );
  const milestonesMap = Object.fromEntries(milestonesEntries);

  // Get mine and harbour locations for map
  const [mines, harbours] = await Promise.all([getMines(), getHarbours()]);
  const mineLocations: Record<string, GeoPoint> = {};
  mines.forEach((m) => { mineLocations[m.name] = m.location; });
  const harbourLocations: Record<string, GeoPoint> = {};
  harbours.forEach((h) => { harbourLocations[h.name] = h.location; });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Deal Tracker</h1>
          <p className="text-gray-400 text-sm">
            {deals.length} deal{deals.length !== 1 ? 's' : ''} total
          </p>
        </div>
      </div>

      <DealsTabSwitcher
        pipelineContent={<PipelineTab deals={deals} />}
        shipmentContent={
          <ShipmentTab
            deals={deals}
            milestonesMap={milestonesMap}
            harbourLocations={harbourLocations}
            mineLocations={mineLocations}
          />
        }
      />
    </div>
  );
}
```

- [ ] **Step 2: Create the tab switcher client component**

Create `app/deals/deals-tab-switcher.tsx`:

```tsx
'use client';

import { useState } from 'react';

interface DealsTabSwitcherProps {
  pipelineContent: React.ReactNode;
  shipmentContent: React.ReactNode;
}

export function DealsTabSwitcher({ pipelineContent, shipmentContent }: DealsTabSwitcherProps) {
  const [tab, setTab] = useState<'shipments' | 'pipeline'>('shipments');

  return (
    <>
      <div className="flex gap-1 mb-6 bg-gray-900 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('shipments')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === 'shipments' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Shipments
        </button>
        <button
          onClick={() => setTab('pipeline')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === 'pipeline' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Pipeline
        </button>
      </div>

      {tab === 'shipments' ? shipmentContent : pipelineContent}
    </>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/alexnelja/projects/dashboard && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add app/deals/page.tsx app/deals/deals-tab-switcher.tsx && git commit -m "feat: wire deals page with shipments map and pipeline kanban tabs"
```

---

### Task 10: Build the trading view stats and chart components

**Files:**
- Create: `dashboard/app/trading/stats-row.tsx`
- Create: `dashboard/app/trading/price-chart.tsx`
- Create: `dashboard/app/trading/recent-deals-table.tsx`

- [ ] **Step 1: Create the stats row component**

Create `app/trading/stats-row.tsx`:

```tsx
import { formatCurrency, formatTonnes } from '@/lib/format';

interface TradingStats {
  avgAskPrice: number;
  avgBidPrice: number;
  spread: number;
  totalVolumeListed: number;
  activeDealsCount: number;
  totalDealValue: number;
}

interface StatsRowProps {
  stats: TradingStats;
  currency: string;
}

export function StatsRow({ stats, currency }: StatsRowProps) {
  const cards = [
    {
      label: 'Avg Ask Price',
      value: stats.avgAskPrice > 0 ? `${formatCurrency(stats.avgAskPrice, currency)}/t` : '—',
    },
    {
      label: 'Volume Listed',
      value: stats.totalVolumeListed > 0 ? formatTonnes(stats.totalVolumeListed) : '—',
    },
    {
      label: 'Active Deals',
      value: stats.activeDealsCount > 0
        ? `${stats.activeDealsCount} (${formatCurrency(stats.totalDealValue, currency)})`
        : '—',
    },
    {
      label: 'Bid/Ask Spread',
      value: stats.avgBidPrice > 0 && stats.avgAskPrice > 0
        ? `${formatCurrency(stats.spread, currency)}`
        : '—',
      sublabel: stats.avgBidPrice > 0 && stats.avgAskPrice > 0
        ? (stats.spread > 0 ? 'Ask higher' : 'Bid higher')
        : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-gray-900 border border-gray-800 rounded-xl p-4"
        >
          <p className="text-xs text-gray-500 mb-1">{card.label}</p>
          <p className="text-lg font-bold text-white">{card.value}</p>
          {card.sublabel && (
            <p className="text-xs text-gray-500 mt-0.5">{card.sublabel}</p>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create the price chart component**

Create `app/trading/price-chart.tsx`:

```tsx
'use client';

import { useRef, useEffect } from 'react';
import { createChart, ColorType, type IChartApi } from 'lightweight-charts';

interface PriceChartProps {
  data: { time: string; value: number }[];
  color: string;
}

export function PriceChart({ data, color }: PriceChartProps) {
  const chartContainer = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainer.current) return;

    chart.current = createChart(chartContainer.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#6b7280',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#1f2937' },
        horzLines: { color: '#1f2937' },
      },
      width: chartContainer.current.clientWidth,
      height: 320,
      rightPriceScale: {
        borderColor: '#374151',
      },
      timeScale: {
        borderColor: '#374151',
        timeVisible: false,
      },
      crosshair: {
        vertLine: { color: '#4b5563', labelBackgroundColor: '#374151' },
        horzLine: { color: '#4b5563', labelBackgroundColor: '#374151' },
      },
    });

    const areaSeries = chart.current.addAreaSeries({
      lineColor: color,
      topColor: `${color}33`,
      bottomColor: `${color}05`,
      lineWidth: 2,
    });

    // Convert ISO dates to YYYY-MM-DD for lightweight-charts
    const chartData = data
      .map((d) => ({
        time: d.time.slice(0, 10),
        value: d.value,
      }))
      .sort((a, b) => a.time.localeCompare(b.time));

    // Deduplicate by date (keep last value per day)
    const deduped = new Map<string, number>();
    chartData.forEach((d) => deduped.set(d.time, d.value));
    const finalData = Array.from(deduped.entries()).map(([time, value]) => ({ time, value }));

    areaSeries.setData(finalData as { time: string; value: number }[]);
    chart.current.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainer.current && chart.current) {
        chart.current.applyOptions({ width: chartContainer.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.current?.remove();
      chart.current = null;
    };
  }, [data, color]);

  if (data.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 flex items-center justify-center h-80">
        <p className="text-gray-500 text-sm">No price data yet. Completed deals will populate this chart.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Price History</h2>
      <div ref={chartContainer} />
    </div>
  );
}
```

- [ ] **Step 3: Create the recent deals table component**

Create `app/trading/recent-deals-table.tsx`:

```tsx
import { COMMODITY_CONFIG } from '@/lib/types';
import { formatCurrency, timeAgo } from '@/lib/format';
import type { Deal } from '@/lib/types';

interface RecentDealsTableProps {
  deals: Deal[];
  avgPrice: number;
}

export function RecentDealsTable({ deals, avgPrice }: RecentDealsTableProps) {
  if (deals.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
        <p className="text-gray-500 text-sm">No completed deals yet for this commodity.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Recent Completed Deals</h2>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-500 border-b border-gray-800">
            <th className="px-4 py-2 text-left font-medium">Material</th>
            <th className="px-4 py-2 text-right font-medium">Price</th>
            <th className="px-4 py-2 text-right font-medium">Volume</th>
            <th className="px-4 py-2 text-right font-medium">Incoterm</th>
            <th className="px-4 py-2 text-right font-medium">When</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((deal) => {
            const config = COMMODITY_CONFIG[deal.commodity_type];
            const aboveAvg = deal.agreed_price >= avgPrice;
            return (
              <tr key={deal.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
                    <span className="text-white">{config.label}</span>
                  </div>
                </td>
                <td className={`px-4 py-2 text-right font-medium ${aboveAvg ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(deal.agreed_price, deal.currency)}/t
                </td>
                <td className="px-4 py-2 text-right text-gray-400">
                  {deal.volume_tonnes.toLocaleString()}t
                </td>
                <td className="px-4 py-2 text-right text-gray-400">
                  {deal.incoterm}
                </td>
                <td className="px-4 py-2 text-right text-gray-500">
                  {timeAgo(deal.created_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add app/trading/stats-row.tsx app/trading/price-chart.tsx app/trading/recent-deals-table.tsx && git commit -m "feat: add trading view stats, price chart, and deals table components"
```

---

### Task 11: Wire up the trading page

**Files:**
- Modify: `dashboard/app/trading/page.tsx`

- [ ] **Step 1: Replace the placeholder trading page**

Replace `app/trading/page.tsx` entirely:

```tsx
import { COMMODITY_CONFIG } from '@/lib/types';
import type { CommodityType } from '@/lib/types';
import { getTradingStats, getCompletedDeals } from '@/lib/deal-queries';
import { StatsRow } from './stats-row';
import { PriceChart } from './price-chart';
import { RecentDealsTable } from './recent-deals-table';
import { CommodityTabSwitcher } from './commodity-tab-switcher';

interface TradingPageProps {
  searchParams: Promise<{ commodity?: string }>;
}

export default async function TradingPage({ searchParams }: TradingPageProps) {
  const params = await searchParams;
  const commodity = (params.commodity as CommodityType) || 'chrome';
  const config = COMMODITY_CONFIG[commodity];

  const [stats, completedDeals] = await Promise.all([
    getTradingStats(commodity),
    getCompletedDeals(commodity),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trading</h1>
        <p className="text-gray-400 text-sm">Market data, price charts, and recent deals.</p>
      </div>

      {/* Commodity tabs */}
      <CommodityTabSwitcher activeCommodity={commodity} />

      {/* Stats */}
      <StatsRow stats={stats} currency="USD" />

      {/* Price chart */}
      <PriceChart data={stats.priceHistory} color={config.color} />

      {/* Recent deals */}
      <RecentDealsTable deals={completedDeals} avgPrice={stats.avgAskPrice} />
    </div>
  );
}
```

- [ ] **Step 2: Create the commodity tab switcher**

Create `app/trading/commodity-tab-switcher.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { COMMODITY_CONFIG } from '@/lib/types';
import type { CommodityType } from '@/lib/types';

interface CommodityTabSwitcherProps {
  activeCommodity: CommodityType;
}

export function CommodityTabSwitcher({ activeCommodity }: CommodityTabSwitcherProps) {
  const router = useRouter();

  return (
    <div className="flex gap-1 bg-gray-900 rounded-lg p-1 w-fit">
      {(Object.entries(COMMODITY_CONFIG) as [CommodityType, { label: string; color: string }][]).map(
        ([type, config]) => (
          <button
            key={type}
            onClick={() => router.push(`/trading?commodity=${type}`)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeCommodity === type
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: config.color }}
            />
            {config.label}
          </button>
        )
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/alexnelja/projects/dashboard && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add app/trading/ && git commit -m "feat: wire trading page with commodity tabs, stats, price chart, and deals table"
```

---

### Task 12: Add deal seed data

**Files:**
- Create: `dashboard/seed-deals.sql`

- [ ] **Step 1: Create seed data for deals**

Create `seed-deals.sql` with sample deals at various pipeline stages. This seed data references the existing users, mines, harbours, and listings from `seed-data-full.sql`:

```sql
-- Seed data for deals (run after seed-data-full.sql)
-- Uses existing listing and user IDs from the full seed data

-- First, get some listing and user IDs to reference
-- This assumes seed-data-full.sql has been run and we have active listings

-- Insert sample deals at various stages
-- (In practice, you'd use actual UUIDs from your seeded data)
-- Run this in Supabase SQL Editor after verifying your listing/user IDs

DO $$
DECLARE
  v_listing RECORD;
  v_buyer_id UUID;
  v_deal_id UUID;
BEGIN
  -- Get a buyer (someone who isn't the seller)
  SELECT id INTO v_buyer_id FROM users WHERE role IN ('buyer', 'both') LIMIT 1;

  -- Create deals from the first 5 active listings
  FOR v_listing IN
    SELECT l.id, l.seller_id, l.commodity_type, l.volume_tonnes, l.price_per_tonne, l.currency, l.incoterms[1] as incoterm
    FROM listings l
    WHERE l.status = 'active' AND l.seller_id != v_buyer_id
    LIMIT 5
  LOOP
    -- Deal 1: Interest stage
    IF v_listing.incoterm IS NOT NULL THEN
      INSERT INTO deals (listing_id, buyer_id, seller_id, commodity_type, volume_tonnes, agreed_price, currency, incoterm, spec_tolerances, price_adjustment_rules, escrow_status, status)
      VALUES (v_listing.id, v_buyer_id, v_listing.seller_id, v_listing.commodity_type, v_listing.volume_tonnes, v_listing.price_per_tonne, v_listing.currency, v_listing.incoterm, '{}', '{}', 'pending_deposit', 'interest')
      RETURNING id INTO v_deal_id;
    END IF;
  END LOOP;

  -- Advance one deal to in_transit with milestones
  SELECT id INTO v_deal_id FROM deals WHERE status = 'interest' LIMIT 1;
  IF v_deal_id IS NOT NULL THEN
    UPDATE deals SET status = 'in_transit', escrow_status = 'held', escrow_amount = agreed_price * volume_tonnes, second_accept_at = now() - interval '7 days' WHERE id = v_deal_id;
    INSERT INTO deal_milestones (deal_id, milestone_type, timestamp, location_name, created_by) VALUES
      (v_deal_id, 'loaded', now() - interval '5 days', 'Mine Site', v_buyer_id),
      (v_deal_id, 'departed_port', now() - interval '3 days', 'Richards Bay', v_buyer_id),
      (v_deal_id, 'in_transit', now() - interval '1 day', 'Indian Ocean', v_buyer_id);
  END IF;

  -- Advance another deal to negotiation
  SELECT id INTO v_deal_id FROM deals WHERE status = 'interest' LIMIT 1;
  IF v_deal_id IS NOT NULL THEN
    UPDATE deals SET status = 'negotiation' WHERE id = v_deal_id;
  END IF;

  -- Advance another to completed
  SELECT id INTO v_deal_id FROM deals WHERE status = 'interest' LIMIT 1;
  IF v_deal_id IS NOT NULL THEN
    UPDATE deals SET status = 'completed', escrow_status = 'released', escrow_amount = agreed_price * volume_tonnes, second_accept_at = now() - interval '30 days' WHERE id = v_deal_id;
  END IF;
END $$;
```

- [ ] **Step 2: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add seed-deals.sql && git commit -m "feat: add deal seed data script for testing"
```

---

### Task 13: Verify everything builds

- [ ] **Step 1: Run TypeScript type check**

Run: `cd /Users/alexnelja/projects/dashboard && npx tsc --noEmit 2>&1`

Expected: No errors.

- [ ] **Step 2: Run Next.js build**

Run: `cd /Users/alexnelja/projects/dashboard && npm run build 2>&1 | tail -30`

Expected: Build succeeds. Check for any page-level errors.

- [ ] **Step 3: Fix any build errors**

If there are TypeScript or build errors, fix them and re-run.

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
cd /Users/alexnelja/projects/dashboard && git add -A && git commit -m "fix: resolve build errors in Plan 3 implementation"
```
