# Plan 4: Trust & Intelligence

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Bayesian weighted trust scoring with badge tiers, lab verification display, and an admin-only intelligence dashboard with volume/supply/demand/concentration/velocity panels.

**Architecture:** Trust scores are computed server-side from the `ratings` table using a Bayesian weighted formula that smooths new users toward the platform average. Pure computation functions live in `lib/trust-score.ts`, while query functions in `lib/trust-queries.ts` fetch ratings and compute scores per user. The intelligence dashboard at `/intelligence` is admin-gated (v1 uses `ADMIN_USER_ID` env var) and derives all stats from existing Supabase tables -- no TimescaleDB needed. Verification details are submitted via a POST API route and displayed on listing detail pages.

**Tech Stack:** Next.js 16, Supabase, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-03-20-mining-aggregator-platform-design.md`

**Depends on:** Plan 3 (Deals & Trading) -- complete

---

## File Structure

```
dashboard/
├── app/
│   ├── dashboard/
│   │   └── page.tsx                         # MODIFY - replace trust score placeholder
│   ├── marketplace/
│   │   └── listings/
│   │       └── [id]/
│   │           └── page.tsx                 # MODIFY - add verification details + seller trust badge
│   ├── deals/
│   │   └── [id]/
│   │       └── page.tsx                     # MODIFY - add counterparty trust badge
│   ├── intelligence/
│   │   ├── page.tsx                         # CREATE - admin intelligence dashboard
│   │   ├── volume-panel.tsx                 # CREATE - deals by commodity, total volume
│   │   ├── supply-panel.tsx                 # CREATE - per-mine output, listings over time
│   │   ├── demand-panel.tsx                 # CREATE - requirements by commodity/region
│   │   ├── concentration-panel.tsx          # CREATE - top sellers by volume share
│   │   └── velocity-panel.tsx               # CREATE - avg time through pipeline stages
│   ├── sidebar.tsx                          # MODIFY - add Intelligence nav item (admin-only)
│   └── api/
│       └── verifications/
│           └── route.ts                     # CREATE - POST verification (admin/lab)
├── lib/
│   ├── trust-score.ts                       # CREATE - pure Bayesian scoring + badge tiers
│   ├── trust-queries.ts                     # CREATE - fetch ratings, compute trust score
│   ├── intelligence-queries.ts              # CREATE - intelligence dashboard data queries
│   └── admin.ts                             # CREATE - admin check helper
└── .env.local                               # MODIFY - add ADMIN_USER_ID
```

---

### Task 1: Create trust score computation helpers

**Files:**
- Create: `dashboard/lib/trust-score.ts`

- [ ] **Step 1: Create `lib/trust-score.ts`**

This file contains pure functions with zero Supabase dependency -- just math.

```typescript
// lib/trust-score.ts

import type { Rating } from './types';

// Bayesian confidence threshold
const M = 10;

// Dimension weights (must sum to 1.0)
export const TRUST_DIMENSIONS = {
  spec_accuracy: { label: 'Spec Accuracy', weight: 0.30 },
  timeliness: { label: 'Timeliness', weight: 0.25 },
  communication: { label: 'Communication', weight: 0.15 },
  documentation: { label: 'Documentation', weight: 0.15 },
  dispute_history: { label: 'Dispute History', weight: 0.15 },
} as const;

export type TrustDimension = keyof typeof TRUST_DIMENSIONS;

// Badge tier thresholds based on completed deal count
export type BadgeTier = 'unrated' | 'bronze' | 'silver' | 'gold' | 'platinum';

export const BADGE_TIERS: { tier: BadgeTier; minDeals: number; label: string; color: string; bg: string; border: string }[] = [
  { tier: 'platinum', minDeals: 50, label: 'Platinum', color: 'text-cyan-300', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
  { tier: 'gold', minDeals: 30, label: 'Gold', color: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  { tier: 'silver', minDeals: 15, label: 'Silver', color: 'text-gray-300', bg: 'bg-gray-500/10', border: 'border-gray-400/30' },
  { tier: 'bronze', minDeals: 5, label: 'Bronze', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  { tier: 'unrated', minDeals: 0, label: 'Unrated', color: 'text-gray-500', bg: 'bg-gray-800', border: 'border-gray-700' },
];

export function getBadgeTier(completedDeals: number): typeof BADGE_TIERS[number] {
  // BADGE_TIERS is sorted descending by minDeals, so first match wins
  return BADGE_TIERS.find((b) => completedDeals >= b.minDeals) ?? BADGE_TIERS[BADGE_TIERS.length - 1];
}

/**
 * Compute Bayesian weighted score for a single dimension.
 *
 * Formula: weighted_score = (n / (n + m)) * actual_avg + (m / (n + m)) * platform_avg
 *
 * n = number of ratings, m = confidence threshold (10)
 * When n is low, the score is pulled toward the platform average.
 * As n grows, the actual average dominates.
 */
export function bayesianScore(actualAvg: number, n: number, platformAvg: number): number {
  if (n === 0) return platformAvg;
  return (n / (n + M)) * actualAvg + (M / (n + M)) * platformAvg;
}

export interface DimensionScore {
  dimension: TrustDimension;
  label: string;
  weight: number;
  rawAvg: number;       // actual average from ratings (1-5)
  bayesianAvg: number;  // smoothed via Bayesian formula
  weighted: number;     // bayesianAvg * weight
}

export interface TrustScore {
  overall: number;        // weighted sum across dimensions (1-5 scale)
  overallPct: number;     // (overall / 5) * 100 for display
  dimensions: DimensionScore[];
  completedDeals: number;
  ratingCount: number;
  badge: typeof BADGE_TIERS[number];
}

/**
 * Compute a user's full trust score from their ratings and dispute history.
 *
 * @param ratings - All ratings where this user is rated_user_id
 * @param completedDeals - Count of deals with status completed/escrow_released
 * @param disputedDeals - Count of deals with status disputed where this user was a party
 * @param platformAvg - Platform-wide average score per dimension (defaults to 3.0)
 */
export function computeTrustScore(
  ratings: Rating[],
  completedDeals: number,
  disputedDeals: number,
  platformAvg: number = 3.0,
): TrustScore {
  const n = ratings.length;

  // Compute raw averages per dimension from ratings
  const specAvg = n > 0 ? ratings.reduce((s, r) => s + r.spec_accuracy, 0) / n : 0;
  const timeAvg = n > 0 ? ratings.reduce((s, r) => s + r.timeliness, 0) / n : 0;
  const commAvg = n > 0 ? ratings.reduce((s, r) => s + r.communication, 0) / n : 0;
  const docsAvg = n > 0 ? ratings.reduce((s, r) => s + r.documentation, 0) / n : 0;

  // Dispute history: 5 = no disputes, decreases with dispute ratio
  // If 0 completed deals, default to platform average
  const disputeRatio = completedDeals > 0 ? disputedDeals / completedDeals : 0;
  const disputeScore = Math.max(1, 5 * (1 - disputeRatio * 2)); // each dispute costs 10% of 5 points

  const rawScores: Record<TrustDimension, number> = {
    spec_accuracy: specAvg,
    timeliness: timeAvg,
    communication: commAvg,
    documentation: docsAvg,
    dispute_history: disputeScore,
  };

  const dimensions: DimensionScore[] = (Object.entries(TRUST_DIMENSIONS) as [TrustDimension, { label: string; weight: number }][]).map(
    ([key, { label, weight }]) => {
      const rawAvg = rawScores[key];
      // For dispute_history we use completedDeals as n (it's derived from deals, not ratings)
      const effectiveN = key === 'dispute_history' ? completedDeals : n;
      const bayesianAvg = bayesianScore(rawAvg, effectiveN, platformAvg);
      return {
        dimension: key,
        label,
        weight,
        rawAvg: Math.round(rawAvg * 100) / 100,
        bayesianAvg: Math.round(bayesianAvg * 100) / 100,
        weighted: Math.round(bayesianAvg * weight * 100) / 100,
      };
    },
  );

  const overall = dimensions.reduce((sum, d) => sum + d.weighted, 0);
  const overallRounded = Math.round(overall * 100) / 100;

  return {
    overall: overallRounded,
    overallPct: Math.round((overallRounded / 5) * 100),
    dimensions,
    completedDeals,
    ratingCount: n,
    badge: getBadgeTier(completedDeals),
  };
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add lib/trust-score.ts && git commit -m "feat: add Bayesian trust score computation helpers"
```

---

### Task 2: Create admin check helper

**Files:**
- Create: `dashboard/lib/admin.ts`

- [ ] **Step 1: Create `lib/admin.ts`**

```typescript
// lib/admin.ts

/**
 * Check if a user ID is an admin.
 * v1: simple env var check. In v2 this would check an is_admin column.
 */
export function isAdmin(userId: string): boolean {
  const adminId = process.env.ADMIN_USER_ID;
  if (!adminId) return false;
  return userId === adminId;
}
```

- [ ] **Step 2: Add `ADMIN_USER_ID` to `.env.local`**

Add the following line to your `.env.local` (replace with your actual user ID from Supabase):

```
ADMIN_USER_ID=your-supabase-user-id-here
```

- [ ] **Step 3: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add lib/admin.ts && git commit -m "feat: add admin check helper (env var based for v1)"
```

---

### Task 3: Create trust score query functions

**Files:**
- Create: `dashboard/lib/trust-queries.ts`

- [ ] **Step 1: Create `lib/trust-queries.ts`**

```typescript
// lib/trust-queries.ts

import { createAdminSupabaseClient } from './supabase-server';
import { computeTrustScore } from './trust-score';
import type { TrustScore } from './trust-score';
import type { Rating, Verification } from './types';

/**
 * Fetch all ratings for a given user (where they are the rated party).
 * Uses admin client to bypass RLS since we need cross-user data.
 */
export async function getUserRatings(userId: string): Promise<Rating[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('ratings')
    .select('*')
    .eq('rated_user_id', userId);

  if (error || !data) return [];
  return data as Rating[];
}

/**
 * Count completed and disputed deals for a user.
 */
async function getUserDealCounts(userId: string): Promise<{ completed: number; disputed: number }> {
  const admin = createAdminSupabaseClient();

  const { count: completed } = await admin
    .from('deals')
    .select('*', { count: 'exact', head: true })
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .in('status', ['completed', 'escrow_released']);

  const { count: disputed } = await admin
    .from('deals')
    .select('*', { count: 'exact', head: true })
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .eq('status', 'disputed');

  return {
    completed: completed ?? 0,
    disputed: disputed ?? 0,
  };
}

/**
 * Compute the platform-wide average rating across all dimensions.
 * Returns a single number (average of all dimension averages).
 */
async function getPlatformAverage(): Promise<number> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from('ratings')
    .select('spec_accuracy, timeliness, communication, documentation');

  if (!data || data.length === 0) return 3.0;

  const total = data.reduce((sum, r) => {
    return sum + r.spec_accuracy + r.timeliness + r.communication + r.documentation;
  }, 0);

  return total / (data.length * 4);
}

/**
 * Get the full computed trust score for a user.
 */
export async function getTrustScoreForUser(userId: string): Promise<TrustScore> {
  const [ratings, dealCounts, platformAvg] = await Promise.all([
    getUserRatings(userId),
    getUserDealCounts(userId),
    getPlatformAverage(),
  ]);

  return computeTrustScore(ratings, dealCounts.completed, dealCounts.disputed, platformAvg);
}

/**
 * Fetch verification records for a listing.
 */
export async function getListingVerifications(listingId: string): Promise<Verification[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('verifications')
    .select('*')
    .eq('listing_id', listingId)
    .order('verified_at', { ascending: false });

  if (error || !data) return [];
  return data as Verification[];
}

/**
 * Get trust score for a user by looking up from a listing's seller_id.
 * Convenience wrapper for listing detail pages.
 */
export async function getSellerTrustScore(sellerId: string): Promise<TrustScore> {
  return getTrustScoreForUser(sellerId);
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add lib/trust-queries.ts && git commit -m "feat: add trust score query functions (ratings, deal counts, platform avg)"
```

---

### Task 4: Replace dashboard Trust Score placeholder with real display

**Files:**
- Modify: `dashboard/app/dashboard/page.tsx`

- [ ] **Step 1: Add trust score import and data fetch**

Add the import at the top of `app/dashboard/page.tsx`, after the existing imports:

```typescript
import { getTrustScoreForUser } from '@/lib/trust-queries';
import { TRUST_DIMENSIONS } from '@/lib/trust-score';
```

Inside the `DashboardPage` function, add `getTrustScoreForUser` to the `Promise.all`:

Replace:
```typescript
  const [listings, requirements, deals] = await Promise.all([
    getUserListings(user.id),
    getUserRequirements(user.id),
    getDealsByUser(user.id),
  ]);
```

With:
```typescript
  const [listings, requirements, deals, trustScore] = await Promise.all([
    getUserListings(user.id),
    getUserRequirements(user.id),
    getDealsByUser(user.id),
    getTrustScoreForUser(user.id),
  ]);
```

- [ ] **Step 2: Replace the Trust Score placeholder section**

Replace lines 247-253 (the trust score placeholder) with the full trust score display:

```typescript
      {/* Trust Score */}
      <div>
        <h2 className="text-base font-semibold text-white mb-3">Trust Score</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-start gap-6">
            {/* Overall score circle */}
            <div className="flex-shrink-0 text-center">
              <div className="relative w-20 h-20">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="35" fill="none" stroke="#1f2937" strokeWidth="6" />
                  <circle
                    cx="40" cy="40" r="35" fill="none"
                    stroke={trustScore.badge.tier === 'platinum' ? '#67e8f9' : trustScore.badge.tier === 'gold' ? '#fcd34d' : trustScore.badge.tier === 'silver' ? '#d1d5db' : trustScore.badge.tier === 'bronze' ? '#fb923c' : '#6b7280'}
                    strokeWidth="6"
                    strokeDasharray={`${(trustScore.overallPct / 100) * 220} 220`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold text-white">{trustScore.overall.toFixed(1)}</span>
                </div>
              </div>
              <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full border ${trustScore.badge.bg} ${trustScore.badge.color} ${trustScore.badge.border}`}>
                {trustScore.badge.label}
              </span>
            </div>

            {/* Dimension breakdown */}
            <div className="flex-1 space-y-2.5">
              {trustScore.dimensions.map((d) => (
                <div key={d.dimension}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="text-gray-400">{d.label} ({(d.weight * 100).toFixed(0)}%)</span>
                    <span className="text-white font-medium">{d.bayesianAvg.toFixed(1)} / 5</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-500"
                      style={{ width: `${(d.bayesianAvg / 5) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Stats */}
            <div className="flex-shrink-0 text-right space-y-3">
              <div>
                <p className="text-xs text-gray-500">Completed Deals</p>
                <p className="text-lg font-bold text-white">{trustScore.completedDeals}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Ratings Received</p>
                <p className="text-lg font-bold text-white">{trustScore.ratingCount}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
```

- [ ] **Step 3: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add app/dashboard/page.tsx && git commit -m "feat: replace trust score placeholder with Bayesian score display on dashboard"
```

---

### Task 5: Add trust badge to listing detail page

**Files:**
- Modify: `dashboard/app/marketplace/listings/[id]/page.tsx`

- [ ] **Step 1: Add imports**

Add at the top of `app/marketplace/listings/[id]/page.tsx`:

```typescript
import { getSellerTrustScore, getListingVerifications } from '@/lib/trust-queries';
```

- [ ] **Step 2: Fetch trust score and verifications**

After `const listing = await getListingById(id);` and the null check, add:

```typescript
  const [sellerTrust, verifications] = await Promise.all([
    getSellerTrustScore(listing.seller_id),
    getListingVerifications(listing.id),
  ]);
```

- [ ] **Step 3: Add seller trust badge to the header section**

In the header card, after the seller company name line (`<p className="text-gray-400 text-sm mt-0.5">{listing.seller_company}</p>`), add:

```typescript
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${sellerTrust.badge.bg} ${sellerTrust.badge.color} ${sellerTrust.badge.border}`}>
                  {sellerTrust.badge.label}
                </span>
                <span className="text-xs text-gray-500">
                  {sellerTrust.overall.toFixed(1)}/5 ({sellerTrust.ratingCount} rating{sellerTrust.ratingCount !== 1 ? 's' : ''})
                </span>
              </div>
```

- [ ] **Step 4: Add verification details section**

After the spec sheet section and before the "Express Interest" section, add a new verification details card:

```typescript
      {/* Verification Details */}
      {verifications.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Lab Verifications</h2>
          <div className="space-y-4">
            {verifications.map((v) => (
              <div key={v.id} className="border border-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-green-900/40 text-green-400 border border-green-800 rounded-full px-2 py-0.5">
                      {v.badge_level === 'premium' ? 'Premium Verified' : 'Verified'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(v.verified_at).toLocaleDateString()}
                    </span>
                  </div>
                  <a
                    href={v.lab_report_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    View Lab Report
                  </a>
                </div>
                {Object.keys(v.assay_results).length > 0 && (
                  <div className="grid grid-cols-3 gap-x-6 gap-y-2">
                    {Object.entries(v.assay_results).map(([key, value]) => (
                      <div key={key}>
                        <p className="text-xs text-gray-500">{key}</p>
                        <p className="text-sm text-white">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
```

- [ ] **Step 5: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add app/marketplace/listings/\[id\]/page.tsx && git commit -m "feat: add seller trust badge and verification details to listing page"
```

---

### Task 6: Add counterparty trust badge to deal detail page

**Files:**
- Modify: `dashboard/app/deals/[id]/page.tsx`

- [ ] **Step 1: Add import**

Add at the top of `app/deals/[id]/page.tsx`:

```typescript
import { getTrustScoreForUser } from '@/lib/trust-queries';
```

- [ ] **Step 2: Fetch counterparty trust score**

After the existing `Promise.all` block that fetches milestones, documents, and ratings, add:

```typescript
  const counterpartyId = isBuyer ? deal.seller_id : deal.buyer_id;
  const counterpartyTrust = await getTrustScoreForUser(counterpartyId);
```

Note: `isBuyer` is defined below the `Promise.all`, so you need to move the counterparty trust fetch after `isBuyer` is computed, or restructure slightly. The cleanest approach: compute `isBuyer` before the trust fetch:

Replace the existing block:

```typescript
  const config = COMMODITY_CONFIG[deal.commodity_type];
  const statusColors = DEAL_STATUS_COLORS[deal.status];
  const isBuyer = deal.buyer_id === user.id;
  const hasRated = ratings.some((r) => r.rater_id === user.id);
```

With:

```typescript
  const config = COMMODITY_CONFIG[deal.commodity_type];
  const statusColors = DEAL_STATUS_COLORS[deal.status];
  const isBuyer = deal.buyer_id === user.id;
  const hasRated = ratings.some((r) => r.rater_id === user.id);

  const counterpartyId = isBuyer ? deal.seller_id : deal.buyer_id;
  const counterpartyTrust = await getTrustScoreForUser(counterpartyId);
```

- [ ] **Step 3: Add trust badge to the deal header**

In the deal header, after the counterparty name line (`{isBuyer ? 'Seller' : 'Buyer'}: {deal.counterparty_name}`), add a trust badge on the same `<p>` tag or as a new element:

Replace:
```typescript
            <p className="text-gray-400 text-sm mt-1">
              {isBuyer ? 'Seller' : 'Buyer'}: {deal.counterparty_name}
            </p>
```

With:
```typescript
            <div className="flex items-center gap-2 mt-1">
              <p className="text-gray-400 text-sm">
                {isBuyer ? 'Seller' : 'Buyer'}: {deal.counterparty_name}
              </p>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${counterpartyTrust.badge.bg} ${counterpartyTrust.badge.color} ${counterpartyTrust.badge.border}`}>
                {counterpartyTrust.badge.label}
              </span>
              <span className="text-xs text-gray-500">
                {counterpartyTrust.overall.toFixed(1)}/5
              </span>
            </div>
```

- [ ] **Step 4: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add app/deals/\[id\]/page.tsx && git commit -m "feat: add counterparty trust badge to deal detail page"
```

---

### Task 7: Create verification API route

**Files:**
- Create: `dashboard/app/api/verifications/route.ts`

- [ ] **Step 1: Create `app/api/verifications/route.ts`**

```typescript
// app/api/verifications/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { isAdmin } from '@/lib/admin';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only admins can submit verifications
  if (!isAdmin(user.id)) {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const { listing_id, lab_report_url, assay_results, badge_level } = body;

  // Validate required fields
  if (!listing_id || typeof listing_id !== 'string') {
    return NextResponse.json({ error: 'listing_id is required' }, { status: 400 });
  }
  if (!lab_report_url || typeof lab_report_url !== 'string') {
    return NextResponse.json({ error: 'lab_report_url is required' }, { status: 400 });
  }
  if (assay_results && typeof assay_results !== 'object') {
    return NextResponse.json({ error: 'assay_results must be a JSON object' }, { status: 400 });
  }
  if (badge_level && !['standard', 'premium'].includes(badge_level)) {
    return NextResponse.json({ error: 'badge_level must be "standard" or "premium"' }, { status: 400 });
  }

  // Verify the listing exists
  const { data: listing } = await supabase
    .from('listings')
    .select('id')
    .eq('id', listing_id)
    .single();

  if (!listing) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
  }

  // Insert verification record
  const { data: verification, error: insertError } = await supabase
    .from('verifications')
    .insert({
      listing_id,
      lab_report_url,
      assay_results: assay_results ?? {},
      badge_level: badge_level ?? 'standard',
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Update the listing's is_verified flag
  const { error: updateError } = await supabase
    .from('listings')
    .update({ is_verified: true })
    .eq('id', listing_id);

  if (updateError) {
    // Non-fatal: verification was saved but listing flag wasn't updated
    console.error('Failed to update listing is_verified:', updateError.message);
  }

  return NextResponse.json(verification, { status: 201 });
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add app/api/verifications/route.ts && git commit -m "feat: add verification API route (admin-only POST)"
```

---

### Task 8: Add Intelligence nav item to sidebar (admin-only)

**Files:**
- Modify: `dashboard/app/sidebar.tsx`

The sidebar is a client component, so we cannot call `isAdmin` directly (it reads `process.env` which is server-only). Instead we pass the admin status as a prop from the layout, or we use a simpler approach: we add the nav item and gate the actual page server-side. For v1, we add the nav item to the array and protect the page itself.

- [ ] **Step 1: Add the Intelligence icon and nav item**

In `app/sidebar.tsx`, add an `IntelligenceIcon` function after the existing icon functions (before `SignOutIcon`):

```typescript
function IntelligenceIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={active ? 'text-white' : 'text-gray-500'}>
      <path d="M2 13V7H5V13H2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6.5 13V4H9.5V13H6.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M11 13V1H14V13H11Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
```

Then add the Intelligence item to the `navItems` array, after the Dashboard entry:

```typescript
const navItems = [
  { label: 'Map', href: '/map', icon: MapIcon },
  { label: 'Trading', href: '/trading', icon: TradingIcon },
  { label: 'Marketplace', href: '/marketplace', icon: MarketplaceIcon },
  { label: 'Deals', href: '/deals', icon: DealsIcon },
  { label: 'Dashboard', href: '/dashboard', icon: DashboardIcon },
  { label: 'Intelligence', href: '/intelligence', icon: IntelligenceIcon },
];
```

Note: In v1, everyone sees the link but the page itself returns a 403/redirect for non-admins. This avoids the complexity of passing server state into the client sidebar component. A future version can conditionally render it.

- [ ] **Step 2: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add app/sidebar.tsx && git commit -m "feat: add Intelligence nav item to sidebar"
```

---

### Task 9: Create intelligence data query functions

**Files:**
- Create: `dashboard/lib/intelligence-queries.ts`

- [ ] **Step 1: Create `lib/intelligence-queries.ts`**

```typescript
// lib/intelligence-queries.ts

import { createAdminSupabaseClient } from './supabase-server';
import type { CommodityType } from './types';
import { COMMODITY_CONFIG } from './types';

// --- Volume Flow ---

export interface VolumeFlowRow {
  commodity: CommodityType;
  label: string;
  color: string;
  dealCount: number;
  totalVolume: number;
  totalValue: number;
}

export async function getVolumeFlow(): Promise<VolumeFlowRow[]> {
  const admin = createAdminSupabaseClient();
  const { data: deals } = await admin
    .from('deals')
    .select('commodity_type, volume_tonnes, agreed_price, status')
    .in('status', ['completed', 'escrow_released', 'delivered', 'in_transit', 'loading', 'escrow_held']);

  if (!deals || deals.length === 0) return [];

  const byCommodity = new Map<CommodityType, { count: number; volume: number; value: number }>();

  for (const d of deals) {
    const ct = d.commodity_type as CommodityType;
    const existing = byCommodity.get(ct) ?? { count: 0, volume: 0, value: 0 };
    existing.count += 1;
    existing.volume += d.volume_tonnes as number;
    existing.value += (d.volume_tonnes as number) * (d.agreed_price as number);
    byCommodity.set(ct, existing);
  }

  return Array.from(byCommodity.entries()).map(([commodity, stats]) => ({
    commodity,
    label: COMMODITY_CONFIG[commodity].label,
    color: COMMODITY_CONFIG[commodity].color,
    dealCount: stats.count,
    totalVolume: stats.volume,
    totalValue: stats.value,
  })).sort((a, b) => b.totalVolume - a.totalVolume);
}

// --- Supply Intelligence ---

export interface SupplyRow {
  mineId: string;
  mineName: string;
  region: string;
  listingCount: number;
  totalVolume: number;
  commodities: CommodityType[];
}

export async function getSupplyIntelligence(): Promise<SupplyRow[]> {
  const admin = createAdminSupabaseClient();
  const { data: listings } = await admin
    .from('listings')
    .select(`
      id, volume_tonnes, commodity_type, created_at,
      mines!source_mine_id (id, name, region)
    `);

  if (!listings || listings.length === 0) return [];

  const byMine = new Map<string, SupplyRow>();

  for (const l of listings) {
    const mine = l.mines as Record<string, unknown> | null;
    if (!mine) continue;
    const mineId = mine.id as string;
    const existing = byMine.get(mineId) ?? {
      mineId,
      mineName: (mine.name as string) ?? 'Unknown',
      region: (mine.region as string) ?? 'Unknown',
      listingCount: 0,
      totalVolume: 0,
      commodities: [],
    };
    existing.listingCount += 1;
    existing.totalVolume += l.volume_tonnes as number;
    const ct = l.commodity_type as CommodityType;
    if (!existing.commodities.includes(ct)) {
      existing.commodities.push(ct);
    }
    byMine.set(mineId, existing);
  }

  return Array.from(byMine.values()).sort((a, b) => b.totalVolume - a.totalVolume);
}

// --- Demand Heatmap ---

export interface DemandRow {
  commodity: CommodityType;
  label: string;
  color: string;
  deliveryPort: string;
  requirementCount: number;
  totalVolumeNeeded: number;
  avgTargetPrice: number;
}

export async function getDemandIntelligence(): Promise<DemandRow[]> {
  const admin = createAdminSupabaseClient();
  const { data: requirements } = await admin
    .from('requirements')
    .select('commodity_type, delivery_port, volume_needed, target_price, status')
    .eq('status', 'active');

  if (!requirements || requirements.length === 0) return [];

  const byKey = new Map<string, DemandRow>();

  for (const r of requirements) {
    const ct = r.commodity_type as CommodityType;
    const port = (r.delivery_port as string) ?? 'Unknown';
    const key = `${ct}::${port}`;
    const existing = byKey.get(key) ?? {
      commodity: ct,
      label: COMMODITY_CONFIG[ct].label,
      color: COMMODITY_CONFIG[ct].color,
      deliveryPort: port,
      requirementCount: 0,
      totalVolumeNeeded: 0,
      avgTargetPrice: 0,
    };
    existing.requirementCount += 1;
    existing.totalVolumeNeeded += r.volume_needed as number;
    // Running sum for average computation
    existing.avgTargetPrice += r.target_price as number;
    byKey.set(key, existing);
  }

  // Finalize averages
  return Array.from(byKey.values())
    .map((row) => ({
      ...row,
      avgTargetPrice: row.requirementCount > 0
        ? Math.round(row.avgTargetPrice / row.requirementCount)
        : 0,
    }))
    .sort((a, b) => b.totalVolumeNeeded - a.totalVolumeNeeded);
}

// --- Market Concentration ---

export interface ConcentrationRow {
  sellerId: string;
  sellerName: string;
  dealCount: number;
  totalVolume: number;
  volumeShare: number; // percentage
}

export async function getMarketConcentration(): Promise<ConcentrationRow[]> {
  const admin = createAdminSupabaseClient();
  const { data: deals } = await admin
    .from('deals')
    .select('seller_id, volume_tonnes, status')
    .in('status', ['completed', 'escrow_released', 'delivered', 'in_transit', 'loading', 'escrow_held']);

  if (!deals || deals.length === 0) return [];

  const bySeller = new Map<string, { count: number; volume: number }>();
  let grandTotal = 0;

  for (const d of deals) {
    const sellerId = d.seller_id as string;
    const volume = d.volume_tonnes as number;
    grandTotal += volume;
    const existing = bySeller.get(sellerId) ?? { count: 0, volume: 0 };
    existing.count += 1;
    existing.volume += volume;
    bySeller.set(sellerId, existing);
  }

  // Fetch seller names
  const sellerIds = [...bySeller.keys()];
  const { data: users } = await admin
    .from('users')
    .select('id, company_name')
    .in('id', sellerIds);

  const nameMap = new Map((users ?? []).map((u: { id: string; company_name: string }) => [u.id, u.company_name]));

  return Array.from(bySeller.entries())
    .map(([sellerId, stats]) => ({
      sellerId,
      sellerName: nameMap.get(sellerId) ?? 'Unknown',
      dealCount: stats.count,
      totalVolume: stats.volume,
      volumeShare: grandTotal > 0 ? Math.round((stats.volume / grandTotal) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.totalVolume - a.totalVolume)
    .slice(0, 10); // Top 10
}

// --- Deal Velocity ---

export interface VelocityStage {
  from: string;
  to: string;
  label: string;
  avgDays: number;
  dealCount: number;
}

export async function getDealVelocity(): Promise<VelocityStage[]> {
  const admin = createAdminSupabaseClient();

  // Fetch completed deals with their milestones to compute stage durations
  const { data: deals } = await admin
    .from('deals')
    .select('id, created_at, second_accept_at, status')
    .in('status', ['completed', 'escrow_released']);

  if (!deals || deals.length === 0) return [];

  const dealIds = deals.map((d) => d.id as string);
  const { data: milestones } = await admin
    .from('deal_milestones')
    .select('deal_id, milestone_type, timestamp')
    .in('deal_id', dealIds)
    .order('timestamp', { ascending: true });

  // Build a timeline per deal
  const dealTimelines = new Map<string, Map<string, string>>();
  for (const d of deals) {
    const timeline = new Map<string, string>();
    timeline.set('created', d.created_at as string);
    if (d.second_accept_at) {
      timeline.set('second_accept', d.second_accept_at as string);
    }
    dealTimelines.set(d.id as string, timeline);
  }

  for (const m of (milestones ?? [])) {
    const timeline = dealTimelines.get(m.deal_id as string);
    if (timeline) {
      timeline.set(m.milestone_type as string, m.timestamp as string);
    }
  }

  // Compute average duration between stages
  const stages: { from: string; to: string; label: string }[] = [
    { from: 'created', to: 'second_accept', label: 'Interest to Agreement' },
    { from: 'second_accept', to: 'loaded', label: 'Agreement to Loading' },
    { from: 'loaded', to: 'departed_port', label: 'Loading to Departure' },
    { from: 'departed_port', to: 'delivered', label: 'Departure to Delivery' },
  ];

  return stages.map(({ from, to, label }) => {
    const durations: number[] = [];
    for (const timeline of dealTimelines.values()) {
      const fromTs = timeline.get(from);
      const toTs = timeline.get(to);
      if (fromTs && toTs) {
        const days = (new Date(toTs).getTime() - new Date(fromTs).getTime()) / (1000 * 60 * 60 * 24);
        if (days >= 0) durations.push(days);
      }
    }
    const avgDays = durations.length > 0
      ? Math.round((durations.reduce((s, d) => s + d, 0) / durations.length) * 10) / 10
      : 0;
    return { from, to, label, avgDays, dealCount: durations.length };
  });
}

// --- Verification Insights ---
// Spec accuracy trends: listed spec vs lab-tested actual values per mine

export interface VerificationInsightRow {
  mineName: string;
  commodity: string;
  listingsCount: number;
  verificationsCount: number;
  verificationRate: number; // 0-1
  avgSpecDeviation: number; // average % deviation between listed and actual
}

export async function getVerificationInsights(): Promise<VerificationInsightRow[]> {
  const admin = createAdminSupabaseClient();

  // Fetch all verifications joined with listings and mines
  const { data: verifications } = await admin
    .from('verifications')
    .select(`
      assay_results,
      listings!listing_id (
        commodity_type, spec_sheet,
        mines!source_mine_id (name)
      )
    `);

  if (!verifications || verifications.length === 0) return [];

  // Group by mine
  const byMine = new Map<string, {
    commodity: string;
    listings: number;
    verifications: number;
    deviations: number[];
  }>();

  for (const v of verifications) {
    const listing = v.listings as Record<string, unknown> | null;
    if (!listing) continue;
    const mine = listing.mines as Record<string, unknown> | null;
    const mineName = (mine?.name as string) ?? 'Unknown';
    const commodity = (listing.commodity_type as string) ?? 'unknown';
    const specSheet = (listing.spec_sheet ?? {}) as Record<string, number>;
    const assay = (v.assay_results ?? {}) as Record<string, number>;

    const existing = byMine.get(mineName) ?? {
      commodity,
      listings: 0,
      verifications: 0,
      deviations: [],
    };
    existing.verifications += 1;

    // Calculate spec deviation for overlapping keys
    for (const key of Object.keys(assay)) {
      if (specSheet[key] !== undefined && specSheet[key] > 0) {
        const deviation = Math.abs(assay[key] - specSheet[key]) / specSheet[key];
        existing.deviations.push(deviation);
      }
    }

    byMine.set(mineName, existing);
  }

  // Count total listings per mine
  const { data: listings } = await admin
    .from('listings')
    .select('mines!source_mine_id (name)');

  if (listings) {
    for (const l of listings) {
      const mine = l.mines as Record<string, unknown> | null;
      const mineName = (mine?.name as string) ?? 'Unknown';
      const existing = byMine.get(mineName);
      if (existing) existing.listings += 1;
    }
  }

  return Array.from(byMine.entries()).map(([mineName, stats]) => ({
    mineName,
    commodity: stats.commodity,
    listingsCount: stats.listings,
    verificationsCount: stats.verifications,
    verificationRate: stats.listings > 0 ? stats.verifications / stats.listings : 0,
    avgSpecDeviation: stats.deviations.length > 0
      ? stats.deviations.reduce((s, d) => s + d, 0) / stats.deviations.length * 100
      : 0,
  }));
}
```

> **Note:** The "Price Discovery" panel (platform prices vs Platts/Fastmarkets indices) is deferred — it requires the TimescaleDB `price_ticks` pipeline which is out of scope for v1. All other 6 of 7 spec panels are implemented.

- [ ] **Step 2: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add lib/intelligence-queries.ts && git commit -m "feat: add intelligence dashboard query functions"
```

---

### Task 10: Create intelligence dashboard panels

**Files:**
- Create: `dashboard/app/intelligence/volume-panel.tsx`
- Create: `dashboard/app/intelligence/supply-panel.tsx`
- Create: `dashboard/app/intelligence/demand-panel.tsx`
- Create: `dashboard/app/intelligence/concentration-panel.tsx`
- Create: `dashboard/app/intelligence/velocity-panel.tsx`
- Create: `dashboard/app/intelligence/verification-panel.tsx`

- [ ] **Step 1: Create `app/intelligence/volume-panel.tsx`**

```typescript
// app/intelligence/volume-panel.tsx

import type { VolumeFlowRow } from '@/lib/intelligence-queries';
import { formatTonnes, formatCurrency } from '@/lib/format';

export function VolumePanel({ rows }: { rows: VolumeFlowRow[] }) {
  const totalVolume = rows.reduce((s, r) => s + r.totalVolume, 0);
  const totalDeals = rows.reduce((s, r) => s + r.dealCount, 0);
  const totalValue = rows.reduce((s, r) => s + r.totalValue, 0);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Volume Flow</h3>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div>
          <p className="text-xs text-gray-500">Total Deals</p>
          <p className="text-xl font-bold text-white">{totalDeals}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Total Volume</p>
          <p className="text-xl font-bold text-white">{formatTonnes(totalVolume)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Total Value</p>
          <p className="text-xl font-bold text-white">{formatCurrency(totalValue, 'USD')}</p>
        </div>
      </div>

      {/* By commodity */}
      {rows.length === 0 ? (
        <p className="text-sm text-gray-600">No deal data yet.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.commodity} className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: row.color }} />
              <span className="text-sm text-white w-24 flex-shrink-0">{row.label}</span>
              <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: row.color,
                    width: totalVolume > 0 ? `${(row.totalVolume / totalVolume) * 100}%` : '0%',
                  }}
                />
              </div>
              <span className="text-xs text-gray-400 w-20 text-right flex-shrink-0">{formatTonnes(row.totalVolume)}</span>
              <span className="text-xs text-gray-500 w-10 text-right flex-shrink-0">{row.dealCount}d</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `app/intelligence/supply-panel.tsx`**

```typescript
// app/intelligence/supply-panel.tsx

import type { SupplyRow } from '@/lib/intelligence-queries';
import { formatTonnes } from '@/lib/format';
import { COMMODITY_CONFIG } from '@/lib/types';

export function SupplyPanel({ rows }: { rows: SupplyRow[] }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Supply Intelligence</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-600">No listing data yet.</p>
      ) : (
        <div className="overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800">
                <th className="pb-2 font-medium">Mine</th>
                <th className="pb-2 font-medium">Region</th>
                <th className="pb-2 font-medium text-right">Listings</th>
                <th className="pb-2 font-medium text-right">Volume</th>
                <th className="pb-2 font-medium">Commodities</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {rows.slice(0, 10).map((row) => (
                <tr key={row.mineId}>
                  <td className="py-2.5 text-sm text-white">{row.mineName}</td>
                  <td className="py-2.5 text-sm text-gray-400">{row.region}</td>
                  <td className="py-2.5 text-sm text-gray-400 text-right">{row.listingCount}</td>
                  <td className="py-2.5 text-sm text-white text-right font-medium">{formatTonnes(row.totalVolume)}</td>
                  <td className="py-2.5">
                    <div className="flex gap-1">
                      {row.commodities.map((ct) => (
                        <span
                          key={ct}
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: COMMODITY_CONFIG[ct].color }}
                          title={COMMODITY_CONFIG[ct].label}
                        />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `app/intelligence/demand-panel.tsx`**

```typescript
// app/intelligence/demand-panel.tsx

import type { DemandRow } from '@/lib/intelligence-queries';
import { formatTonnes, formatCurrency } from '@/lib/format';

export function DemandPanel({ rows }: { rows: DemandRow[] }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Demand Heatmap</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-600">No active requirements yet.</p>
      ) : (
        <div className="overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800">
                <th className="pb-2 font-medium">Commodity</th>
                <th className="pb-2 font-medium">Delivery Port</th>
                <th className="pb-2 font-medium text-right">Requests</th>
                <th className="pb-2 font-medium text-right">Volume Needed</th>
                <th className="pb-2 font-medium text-right">Avg Target Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {rows.slice(0, 10).map((row, i) => (
                <tr key={`${row.commodity}-${row.deliveryPort}-${i}`}>
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                      <span className="text-sm text-white">{row.label}</span>
                    </div>
                  </td>
                  <td className="py-2.5 text-sm text-gray-400">{row.deliveryPort}</td>
                  <td className="py-2.5 text-sm text-gray-400 text-right">{row.requirementCount}</td>
                  <td className="py-2.5 text-sm text-white text-right font-medium">{formatTonnes(row.totalVolumeNeeded)}</td>
                  <td className="py-2.5 text-sm text-amber-400 text-right">{formatCurrency(row.avgTargetPrice, 'USD')}/t</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create `app/intelligence/concentration-panel.tsx`**

```typescript
// app/intelligence/concentration-panel.tsx

import type { ConcentrationRow } from '@/lib/intelligence-queries';
import { formatTonnes } from '@/lib/format';

export function ConcentrationPanel({ rows }: { rows: ConcentrationRow[] }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Market Concentration</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-600">No deal data yet.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.sellerId} className="flex items-center gap-3">
              <span className="text-sm text-white w-40 flex-shrink-0 truncate" title={row.sellerName}>
                {row.sellerName}
              </span>
              <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500"
                  style={{ width: `${row.volumeShare}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 w-16 text-right flex-shrink-0">{row.volumeShare}%</span>
              <span className="text-xs text-gray-500 w-16 text-right flex-shrink-0">{formatTonnes(row.totalVolume)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create `app/intelligence/velocity-panel.tsx`**

```typescript
// app/intelligence/velocity-panel.tsx

import type { VelocityStage } from '@/lib/intelligence-queries';

export function VelocityPanel({ stages }: { stages: VelocityStage[] }) {
  const totalDays = stages.reduce((s, st) => s + st.avgDays, 0);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Deal Velocity</h3>

      {stages.every((s) => s.dealCount === 0) ? (
        <p className="text-sm text-gray-600">No completed deal data yet.</p>
      ) : (
        <>
          <div className="mb-4">
            <p className="text-xs text-gray-500">Avg Total Pipeline Duration</p>
            <p className="text-2xl font-bold text-white">{totalDays.toFixed(1)} days</p>
          </div>

          {/* Stage breakdown */}
          <div className="space-y-3">
            {stages.map((stage) => (
              <div key={stage.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-400">{stage.label}</span>
                  <span className="text-white font-medium">
                    {stage.avgDays > 0 ? `${stage.avgDays}d` : '--'}
                    <span className="text-gray-600 ml-1">({stage.dealCount} deals)</span>
                  </span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-cyan-500"
                    style={{ width: totalDays > 0 ? `${(stage.avgDays / totalDays) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Create `app/intelligence/verification-panel.tsx`**

```typescript
// app/intelligence/verification-panel.tsx

import { COMMODITY_CONFIG } from '@/lib/types';
import type { CommodityType } from '@/lib/types';
import type { VerificationInsightRow } from '@/lib/intelligence-queries';

export function VerificationPanel({ rows }: { rows: VerificationInsightRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Verification Insights</h3>
        <p className="text-gray-500 text-sm text-center py-4">No verification data yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Verification Insights</h3>
      <p className="text-xs text-gray-500 mb-4">Listed spec vs lab-tested actual values per mine</p>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-500 border-b border-gray-800">
            <th className="text-left py-2 font-medium">Mine</th>
            <th className="text-left py-2 font-medium">Commodity</th>
            <th className="text-right py-2 font-medium">Listings</th>
            <th className="text-right py-2 font-medium">Verified</th>
            <th className="text-right py-2 font-medium">Rate</th>
            <th className="text-right py-2 font-medium">Avg Spec Deviation</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const cfg = COMMODITY_CONFIG[row.commodity as CommodityType];
            const deviationColor = row.avgSpecDeviation < 2 ? 'text-emerald-400' : row.avgSpecDeviation < 5 ? 'text-amber-400' : 'text-red-400';
            return (
              <tr key={row.mineName} className="border-b border-gray-800/50">
                <td className="py-2 text-white">{row.mineName}</td>
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg?.color ?? '#6b7280' }} />
                    <span className="text-gray-400">{cfg?.label ?? row.commodity}</span>
                  </div>
                </td>
                <td className="py-2 text-right text-gray-400">{row.listingsCount}</td>
                <td className="py-2 text-right text-gray-400">{row.verificationsCount}</td>
                <td className="py-2 text-right text-gray-400">{Math.round(row.verificationRate * 100)}%</td>
                <td className={`py-2 text-right font-medium ${deviationColor}`}>
                  {row.avgSpecDeviation > 0 ? `${row.avgSpecDeviation.toFixed(1)}%` : '—'}
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

- [ ] **Step 7: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add app/intelligence/volume-panel.tsx app/intelligence/supply-panel.tsx app/intelligence/demand-panel.tsx app/intelligence/concentration-panel.tsx app/intelligence/velocity-panel.tsx app/intelligence/verification-panel.tsx && git commit -m "feat: create intelligence dashboard panel components"
```

---

### Task 11: Create the intelligence dashboard page

**Files:**
- Create: `dashboard/app/intelligence/page.tsx`

- [ ] **Step 1: Create `app/intelligence/page.tsx`**

```typescript
// app/intelligence/page.tsx

import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { isAdmin } from '@/lib/admin';
import {
  getVolumeFlow,
  getSupplyIntelligence,
  getDemandIntelligence,
  getMarketConcentration,
  getDealVelocity,
  getVerificationInsights,
} from '@/lib/intelligence-queries';
import { VolumePanel } from './volume-panel';
import { SupplyPanel } from './supply-panel';
import { DemandPanel } from './demand-panel';
import { ConcentrationPanel } from './concentration-panel';
import { VelocityPanel } from './velocity-panel';
import { VerificationPanel } from './verification-panel';

export default async function IntelligencePage() {
  const user = await requireAuth();

  if (!isAdmin(user.id)) {
    redirect('/dashboard');
  }

  const [volumeFlow, supply, demand, concentration, velocity, verifications] = await Promise.all([
    getVolumeFlow(),
    getSupplyIntelligence(),
    getDemandIntelligence(),
    getMarketConcentration(),
    getDealVelocity(),
    getVerificationInsights(),
  ]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Intelligence</h1>
        <p className="text-gray-400 text-sm mt-1">
          Platform-wide analytics and market intelligence
        </p>
      </div>

      {/* Top row: Volume + Velocity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VolumePanel rows={volumeFlow} />
        <VelocityPanel stages={velocity} />
      </div>

      {/* Middle: Supply + Demand */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SupplyPanel rows={supply} />
        <DemandPanel rows={demand} />
      </div>

      {/* Bottom: Concentration + Verification */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConcentrationPanel rows={concentration} />
        <VerificationPanel rows={verifications} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add app/intelligence/page.tsx && git commit -m "feat: create admin-only intelligence dashboard page"
```

---

### Task 12: Verify everything builds

- [ ] **Step 1: Run the build**

```bash
cd /Users/alexnelja/projects/dashboard && npm run build
```

Fix any TypeScript or import errors that appear. Common things to check:

- `lib/trust-score.ts` exports are correctly imported in `lib/trust-queries.ts` and `app/dashboard/page.tsx`
- `lib/intelligence-queries.ts` exports match the imports in the panel components
- The `TrustScore` type is exported from `lib/trust-score.ts`
- `formatTonnes` and `formatCurrency` are imported from `@/lib/format` in the panel components
- `isAdmin` is imported from `@/lib/admin` in both `app/intelligence/page.tsx` and `app/api/verifications/route.ts`

- [ ] **Step 2: Final commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add -A && git commit -m "chore: fix any build issues for Plan 4 trust & intelligence"
```

---

## Summary of Changes

| Area | What Changed |
|------|-------------|
| `lib/trust-score.ts` | Pure Bayesian scoring functions, badge tier logic, dimension weights |
| `lib/trust-queries.ts` | Server-side queries to fetch ratings, compute trust scores, get verifications |
| `lib/admin.ts` | Simple admin check via `ADMIN_USER_ID` env var |
| `lib/intelligence-queries.ts` | Volume flow, supply, demand, concentration, velocity queries from Supabase |
| `app/dashboard/page.tsx` | Trust Score placeholder replaced with live score + badge + dimension bars |
| `app/marketplace/listings/[id]/page.tsx` | Seller trust badge + lab verification details section |
| `app/deals/[id]/page.tsx` | Counterparty trust badge in deal header |
| `app/api/verifications/route.ts` | Admin-only POST endpoint for lab verifications |
| `app/sidebar.tsx` | Intelligence nav item added |
| `app/intelligence/page.tsx` | Admin-gated intelligence dashboard page |
| `app/intelligence/*-panel.tsx` | Five panel components (volume, supply, demand, concentration, velocity) |
