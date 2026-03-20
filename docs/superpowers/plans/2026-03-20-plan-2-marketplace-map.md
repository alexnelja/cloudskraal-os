# Plan 2: Marketplace & Map View

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Airbnb-style map view with mine/harbour visualization, marketplace browse pages, listing/requirement creation forms, and the user dashboard.

**Architecture:** Map view uses Mapbox GL JS with a 40/60 split layout. Listings panel on the left with commodity filters, map on the right showing mine pins and harbour nodes. Marketplace page provides a tabbed list/grid browse. All data fetched server-side from Supabase with PostGIS geography columns parsed as GeoJSON. Forms use client components with Supabase browser client for mutations.

**Tech Stack:** Next.js 16, Mapbox GL JS, Supabase (PostGIS), Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-03-20-mining-aggregator-platform-design.md`

**Depends on:** Plan 1 (Foundation) - complete

---

## File Structure

```
dashboard/
├── app/
│   ├── map/
│   │   ├── page.tsx                     # MODIFY - server component, fetches mines/harbours/listings
│   │   ├── map-client.tsx               # CREATE - client component with Mapbox GL map
│   │   ├── listings-panel.tsx           # CREATE - left panel with filter bar + listing cards
│   │   └── filter-bar.tsx              # CREATE - commodity chips, price range, incoterm, volume range, verified toggle
│   ├── marketplace/
│   │   ├── page.tsx                     # MODIFY - server component, fetches listings + requirements
│   │   ├── listing-card.tsx            # CREATE - reusable listing card component
│   │   ├── requirement-card.tsx        # CREATE - reusable requirement card component
│   │   ├── listings/
│   │   │   └── [id]/page.tsx           # CREATE - listing detail page
│   │   ├── new-listing/
│   │   │   └── page.tsx                # CREATE - create listing form
│   │   └── new-requirement/
│   │       └── page.tsx                # CREATE - create requirement form
│   ├── dashboard/
│   │   └── page.tsx                     # MODIFY - user dashboard with listings/deals summary
│   └── layout.tsx                       # MODIFY - add Mapbox CSS link
├── lib/
│   ├── types.ts                         # MODIFY - add GeoJSON helper types
│   ├── geo.ts                           # CREATE - PostGIS geography parsing helpers
│   └── queries.ts                       # CREATE - shared Supabase query functions
├── .env.example                         # MODIFY - add NEXT_PUBLIC_MAPBOX_TOKEN
└── package.json                         # MODIFY - add mapbox-gl
```

---

### Task 1: Install Mapbox GL JS and add env config

**Files:**
- Modify: `dashboard/package.json`
- Modify: `dashboard/.env.example`
- Modify: `dashboard/.env.local`
- Modify: `dashboard/app/layout.tsx`

- [ ] **Step 1: Install mapbox-gl**

```bash
cd /Users/alexnelja/projects/dashboard && npm install mapbox-gl
```

- [ ] **Step 2: Add Mapbox token to env files**

Add to `.env.example`:
```
NEXT_PUBLIC_MAPBOX_TOKEN=your-mapbox-token-here
```

Add to `.env.local` (user must replace with their actual token):
```
NEXT_PUBLIC_MAPBOX_TOKEN=pk.placeholder_replace_with_your_mapbox_token
```

- [ ] **Step 3: Add Mapbox CSS to layout**

In `app/layout.tsx`, add a `<link>` tag for the Mapbox GL CSS in the `<head>` section. Modify the `<html>` tag area:

```tsx
<html lang="en">
  <head>
    <link href="https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.css" rel="stylesheet" />
  </head>
  <body className="bg-gray-950 text-white min-h-screen">
```

- [ ] **Step 4: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add package.json package-lock.json .env.example app/layout.tsx && git commit -m "feat: install mapbox-gl and add CSS/env config"
```

---

### Task 2: Create geo parsing helpers and shared query functions

**Files:**
- Modify: `dashboard/lib/types.ts` - add GeoPoint type
- Create: `dashboard/lib/geo.ts`
- Create: `dashboard/lib/queries.ts`

- [ ] **Step 1: Add GeoPoint type to types.ts**

Add to the end of the types section in `lib/types.ts` (before `COMMODITY_CONFIG`):

```typescript
// GeoJSON point extracted from PostGIS geography columns
export interface GeoPoint {
  lng: number;
  lat: number;
}

// Extended types with parsed geography for client use
export interface MineWithGeo extends Omit<Mine, 'location'> {
  location: GeoPoint;
}

export interface HarbourWithGeo extends Omit<Harbour, 'location'> {
  location: GeoPoint;
}

// Listing joined with mine and harbour names for display
export interface ListingWithDetails extends Listing {
  mine_name: string;
  mine_region: string;
  mine_location: GeoPoint;
  harbour_name: string;
  seller_company: string;
}
```

- [ ] **Step 2: Create geo.ts**

Create `lib/geo.ts`:

```typescript
import type { GeoPoint } from './types';

/**
 * Parse PostGIS geography column returned by Supabase.
 * Supabase returns geography as GeoJSON string or object:
 * {"type":"Point","coordinates":[lng, lat]}
 */
export function parseGeoPoint(geo: unknown): GeoPoint | null {
  if (!geo) return null;

  try {
    const parsed = typeof geo === 'string' ? JSON.parse(geo) : geo;
    if (parsed?.type === 'Point' && Array.isArray(parsed.coordinates)) {
      return { lng: parsed.coordinates[0], lat: parsed.coordinates[1] };
    }
    return null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Create queries.ts**

Create `lib/queries.ts`:

```typescript
import { createServerSupabaseClient } from './supabase-server';
import { parseGeoPoint } from './geo';
import type {
  Listing, MineWithGeo, HarbourWithGeo, ListingWithDetails,
  Requirement, CommodityType,
} from './types';

export async function getHarbours(): Promise<HarbourWithGeo[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('harbours')
    .select('*');

  if (error || !data) return [];

  return data.map((h) => ({
    ...h,
    location: parseGeoPoint(h.location) ?? { lng: 0, lat: 0 },
  }));
}

export async function getMines(): Promise<MineWithGeo[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('mines')
    .select('*');

  if (error || !data) return [];

  return data.map((m) => ({
    ...m,
    location: parseGeoPoint(m.location) ?? { lng: 0, lat: 0 },
  }));
}

export async function getActiveListings(): Promise<ListingWithDetails[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('listings')
    .select(`
      *,
      mines!source_mine_id (name, region, location),
      harbours!loading_port_id (name),
      users!seller_id (company_name)
    `)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((l: Record<string, unknown>) => {
    const mine = l.mines as Record<string, unknown> | null;
    const harbour = l.harbours as Record<string, unknown> | null;
    const seller = l.users as Record<string, unknown> | null;

    return {
      ...l,
      mine_name: (mine?.name as string) ?? 'Unknown',
      mine_region: (mine?.region as string) ?? 'Unknown',
      mine_location: parseGeoPoint(mine?.location) ?? { lng: 0, lat: 0 },
      harbour_name: (harbour?.name as string) ?? 'Unknown',
      seller_company: (seller?.company_name as string) ?? 'Unknown',
    } as ListingWithDetails;
  });
}

export async function getActiveRequirements(): Promise<Requirement[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('requirements')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as Requirement[];
}

export async function getListingById(id: string): Promise<ListingWithDetails | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('listings')
    .select(`
      *,
      mines!source_mine_id (name, region, location),
      harbours!loading_port_id (name),
      users!seller_id (company_name)
    `)
    .eq('id', id)
    .single();

  if (error || !data) return null;

  const mine = data.mines as Record<string, unknown> | null;
  const harbour = data.harbours as Record<string, unknown> | null;
  const seller = data.users as Record<string, unknown> | null;

  return {
    ...data,
    mine_name: (mine?.name as string) ?? 'Unknown',
    mine_region: (mine?.region as string) ?? 'Unknown',
    mine_location: parseGeoPoint(mine?.location) ?? { lng: 0, lat: 0 },
    harbour_name: (harbour?.name as string) ?? 'Unknown',
    seller_company: (seller?.company_name as string) ?? 'Unknown',
  } as ListingWithDetails;
}

export async function getRoutes(): Promise<{ origin_mine_id: string; harbour_id: string; mine_location: GeoPoint; harbour_location: GeoPoint }[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('routes')
    .select(`
      origin_mine_id, harbour_id,
      mines!origin_mine_id (location),
      harbours!harbour_id (location)
    `);

  if (error || !data) return [];

  return data.map((r: Record<string, unknown>) => {
    const mine = r.mines as Record<string, unknown> | null;
    const harbour = r.harbours as Record<string, unknown> | null;
    return {
      origin_mine_id: r.origin_mine_id as string,
      harbour_id: r.harbour_id as string,
      mine_location: parseGeoPoint(mine?.location) ?? { lng: 0, lat: 0 },
      harbour_location: parseGeoPoint(harbour?.location) ?? { lng: 0, lat: 0 },
    };
  });
}

export async function getUserListings(userId: string): Promise<Listing[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('seller_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as Listing[];
}

export async function getUserRequirements(userId: string): Promise<Requirement[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('requirements')
    .select('*')
    .eq('buyer_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as Requirement[];
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Users/alexnelja/projects/dashboard && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add lib/types.ts lib/geo.ts lib/queries.ts && git commit -m "feat: add geo parsing helpers and shared Supabase query functions"
```

---

### Task 3: Build the filter bar component

**Files:**
- Create: `dashboard/app/map/filter-bar.tsx`

- [ ] **Step 1: Create the filter bar**

Create `app/map/filter-bar.tsx`:

```tsx
'use client';

import { COMMODITY_CONFIG, type CommodityType } from '@/lib/types';

export interface Filters {
  commodities: CommodityType[];
  verifiedOnly: boolean;
  priceMin: number | null;
  priceMax: number | null;
  volumeMin: number | null;
  incoterm: string | null;
}

interface FilterBarProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  listingCount: number;
}

const allCommodities = Object.keys(COMMODITY_CONFIG) as CommodityType[];
const incotermsOptions = ['FOB', 'CIF', 'CFR'];

export function FilterBar({ filters, onFiltersChange, listingCount }: FilterBarProps) {
  function toggleCommodity(commodity: CommodityType) {
    const commodities = filters.commodities.includes(commodity)
      ? filters.commodities.filter((c) => c !== commodity)
      : [...filters.commodities, commodity];
    onFiltersChange({ ...filters, commodities });
  }

  return (
    <div className="border-b border-gray-800 px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{listingCount} listings</span>
        <button
          onClick={() => onFiltersChange({ ...filters, verifiedOnly: !filters.verifiedOnly })}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            filters.verifiedOnly
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'text-gray-400 border-gray-700 hover:border-gray-600'
          }`}
        >
          {filters.verifiedOnly ? '✓ Verified only' : 'Verified only'}
        </button>
      </div>
      {/* Commodity chips */}
      <div className="flex gap-1.5 flex-wrap">
        {allCommodities.map((commodity) => {
          const config = COMMODITY_CONFIG[commodity];
          const isSelected = filters.commodities.includes(commodity);
          return (
            <button
              key={commodity}
              onClick={() => toggleCommodity(commodity)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                isSelected
                  ? 'text-white border-gray-600 bg-gray-800'
                  : 'text-gray-500 border-gray-800 hover:border-gray-700'
              }`}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full mr-1.5"
                style={{ backgroundColor: config.color }}
              />
              {config.label}
              {isSelected && <span className="ml-1 text-gray-500">×</span>}
            </button>
          );
        })}
      </div>
      {/* Price range, volume, incoterm */}
      <div className="flex gap-2 flex-wrap">
        <input
          type="number"
          placeholder="Min $/t"
          value={filters.priceMin ?? ''}
          onChange={(e) => onFiltersChange({ ...filters, priceMin: e.target.value ? Number(e.target.value) : null })}
          className="w-20 bg-gray-900 border border-gray-800 rounded-lg px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
        />
        <input
          type="number"
          placeholder="Max $/t"
          value={filters.priceMax ?? ''}
          onChange={(e) => onFiltersChange({ ...filters, priceMax: e.target.value ? Number(e.target.value) : null })}
          className="w-20 bg-gray-900 border border-gray-800 rounded-lg px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
        />
        <input
          type="number"
          placeholder="Min tonnes"
          value={filters.volumeMin ?? ''}
          onChange={(e) => onFiltersChange({ ...filters, volumeMin: e.target.value ? Number(e.target.value) : null })}
          className="w-24 bg-gray-900 border border-gray-800 rounded-lg px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
        />
        <select
          value={filters.incoterm ?? ''}
          onChange={(e) => onFiltersChange({ ...filters, incoterm: e.target.value || null })}
          className="bg-gray-900 border border-gray-800 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-gray-600"
        >
          <option value="">Any incoterm</option>
          {incotermsOptions.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add app/map/filter-bar.tsx && git commit -m "feat: add commodity filter bar component"
```

---

### Task 4: Build the listings panel component

**Files:**
- Create: `dashboard/app/map/listings-panel.tsx`

- [ ] **Step 1: Create the listings panel**

Create `app/map/listings-panel.tsx`:

```tsx
'use client';

import { useState, useMemo } from 'react';
import { FilterBar, type Filters } from './filter-bar';
import { COMMODITY_CONFIG, type ListingWithDetails } from '@/lib/types';
import { timeAgo } from '@/lib/format';

interface ListingsPanelProps {
  listings: ListingWithDetails[];
  hoveredListingId: string | null;
  onListingHover: (id: string | null) => void;
  onListingClick: (listing: ListingWithDetails) => void;
}

export function ListingsPanel({
  listings,
  hoveredListingId,
  onListingHover,
  onListingClick,
}: ListingsPanelProps) {
  const [filters, setFilters] = useState<Filters>({
    commodities: [],
    verifiedOnly: false,
    priceMin: null,
    priceMax: null,
    volumeMin: null,
    incoterm: null,
  });

  const filteredListings = useMemo(() => {
    return listings.filter((l) => {
      if (filters.commodities.length > 0 && !filters.commodities.includes(l.commodity_type)) return false;
      if (filters.verifiedOnly && !l.is_verified) return false;
      if (filters.priceMin !== null && l.price_per_tonne < filters.priceMin) return false;
      if (filters.priceMax !== null && l.price_per_tonne > filters.priceMax) return false;
      if (filters.volumeMin !== null && l.volume_tonnes < filters.volumeMin) return false;
      if (filters.incoterm !== null && !l.incoterms.includes(filters.incoterm)) return false;
      return true;
    });
  }, [listings, filters]);

  return (
    <div className="flex flex-col h-full">
      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        listingCount={filteredListings.length}
      />
      <div className="flex-1 overflow-y-auto">
        {filteredListings.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No listings match your filters
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {filteredListings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                isHovered={hoveredListingId === listing.id}
                onHover={onListingHover}
                onClick={onListingClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ListingCard({
  listing,
  isHovered,
  onHover,
  onClick,
}: {
  listing: ListingWithDetails;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  onClick: (listing: ListingWithDetails) => void;
}) {
  const config = COMMODITY_CONFIG[listing.commodity_type];

  return (
    <div
      className={`px-4 py-3 cursor-pointer transition-colors ${
        isHovered ? 'bg-gray-800/50' : 'hover:bg-gray-900'
      }`}
      onMouseEnter={() => onHover(listing.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(listing)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: config.color }}
            />
            <span className="text-sm font-medium text-white truncate">
              {config.label} {listing.spec_sheet?.cr2o3_pct ?? listing.spec_sheet?.fe_pct ?? ''}%
            </span>
            {listing.is_verified && (
              <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                ✓
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {listing.mine_name}, {listing.mine_region} → {listing.harbour_name}
          </p>
        </div>
        <span className="text-xs text-gray-600 flex-shrink-0">
          {timeAgo(listing.created_at)}
        </span>
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-sm font-semibold text-amber-500">
          ${listing.price_per_tonne}/t {listing.incoterms[0]}
        </span>
        <span className="text-xs text-gray-500">
          {listing.volume_tonnes.toLocaleString()}t
        </span>
      </div>
      <div className="flex gap-1 mt-1.5">
        {listing.incoterms.map((term) => (
          <span
            key={term}
            className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded"
          >
            {term}
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add app/map/listings-panel.tsx && git commit -m "feat: add listings panel with filtering and hover interaction"
```

---

### Task 5: Build the Mapbox map client component

**Files:**
- Create: `dashboard/app/map/map-client.tsx`

- [ ] **Step 1: Create the map client**

Create `app/map/map-client.tsx`:

```tsx
'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { ListingsPanel } from './listings-panel';
import {
  COMMODITY_CONFIG,
  type MineWithGeo,
  type HarbourWithGeo,
  type ListingWithDetails,
} from '@/lib/types';

interface RouteData {
  origin_mine_id: string;
  harbour_id: string;
  mine_location: { lng: number; lat: number };
  harbour_location: { lng: number; lat: number };
}

interface MapClientProps {
  mines: MineWithGeo[];
  harbours: HarbourWithGeo[];
  listings: ListingWithDetails[];
  routes: RouteData[];
}

export function MapClient({ mines, harbours, listings, routes }: MapClientProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [hoveredListingId, setHoveredListingId] = useState<string | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [26, -29], // Center on South Africa
      zoom: 5,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Add mine markers
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Add mine markers
    mines.forEach((mine) => {
      const primaryCommodity = mine.commodities[0];
      const color = primaryCommodity
        ? COMMODITY_CONFIG[primaryCommodity]?.color ?? '#6b7280'
        : '#6b7280';

      const el = document.createElement('div');
      el.className = 'mine-marker';
      el.style.cssText = `
        width: 14px; height: 14px;
        background: ${color};
        border-radius: 50%;
        border: 2px solid #0f172a;
        box-shadow: 0 0 8px ${color}55;
        cursor: pointer;
      `;

      const popup = new mapboxgl.Popup({ offset: 12, closeButton: false })
        .setHTML(`
          <div style="color: #e2e8f0; font-size: 12px; font-weight: 600;">${mine.name}</div>
          <div style="color: #94a3b8; font-size: 11px;">${mine.region}</div>
          <div style="color: ${color}; font-size: 11px; margin-top: 2px;">${mine.commodities.map(c => COMMODITY_CONFIG[c]?.label).join(', ')}</div>
        `);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([mine.location.lng, mine.location.lat])
        .setPopup(popup)
        .addTo(map.current!);

      markersRef.current.push(marker);
    });

    // Add harbour markers
    harbours.forEach((harbour) => {
      const el = document.createElement('div');
      el.className = 'harbour-marker';
      el.style.cssText = `
        width: 10px; height: 10px;
        background: #10b981;
        border-radius: 2px;
        border: 2px solid #0f172a;
        cursor: pointer;
      `;

      const popup = new mapboxgl.Popup({ offset: 10, closeButton: false })
        .setHTML(`
          <div style="color: #10b981; font-size: 12px; font-weight: 600;">${harbour.name}</div>
          <div style="color: #94a3b8; font-size: 11px;">${harbour.country} - ${harbour.type}</div>
        `);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([harbour.location.lng, harbour.location.lat])
        .setPopup(popup)
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }, [mines, harbours]);

  // Draw route lines (mine to harbour, dashed)
  useEffect(() => {
    if (!map.current) return;

    function addRoutes() {
      const m = map.current!;
      // Remove existing route layer/source if present
      if (m.getLayer('route-lines')) m.removeLayer('route-lines');
      if (m.getSource('routes')) m.removeSource('routes');

      const features = routes.map((r) => ({
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates: [
            [r.mine_location.lng, r.mine_location.lat],
            [r.harbour_location.lng, r.harbour_location.lat],
          ],
        },
      }));

      m.addSource('routes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features },
      });

      m.addLayer({
        id: 'route-lines',
        type: 'line',
        source: 'routes',
        paint: {
          'line-color': '#475569',
          'line-width': 1.5,
          'line-dasharray': [4, 3],
          'line-opacity': 0.6,
        },
      });
    }

    if (map.current.isStyleLoaded()) {
      addRoutes();
    } else {
      map.current.on('style.load', addRoutes);
    }
  }, [routes]);

  // Highlight hovered listing's mine on map
  useEffect(() => {
    if (!map.current || !hoveredListingId) return;

    const listing = listings.find((l) => l.id === hoveredListingId);
    if (listing?.mine_location) {
      map.current.easeTo({
        center: [listing.mine_location.lng, listing.mine_location.lat],
        duration: 500,
      });
    }
  }, [hoveredListingId, listings]);

  const handleListingClick = useCallback((listing: ListingWithDetails) => {
    if (map.current && listing.mine_location) {
      map.current.flyTo({
        center: [listing.mine_location.lng, listing.mine_location.lat],
        zoom: 8,
        duration: 1000,
      });
    }
  }, []);

  return (
    <div className="flex h-[calc(100vh-5rem)] -m-6 md:-m-10">
      {/* Left panel: listings */}
      <div className="w-[40%] min-w-[320px] border-r border-gray-800 bg-gray-950 flex flex-col overflow-hidden">
        <ListingsPanel
          listings={listings}
          hoveredListingId={hoveredListingId}
          onListingHover={setHoveredListingId}
          onListingClick={handleListingClick}
        />
      </div>
      {/* Right panel: map */}
      <div className="flex-1 relative">
        <div ref={mapContainer} className="absolute inset-0" />
        {/* Legend */}
        <div className="absolute bottom-10 left-3 bg-gray-950/90 border border-gray-800 rounded-lg p-3 text-xs space-y-1.5 z-10">
          {Object.entries(COMMODITY_CONFIG).map(([key, config]) => (
            <div key={key} className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: config.color }}
              />
              <span className="text-gray-400">{config.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-sm bg-emerald-500" />
            <span className="text-gray-400">Harbour</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add app/map/map-client.tsx && git commit -m "feat: add Mapbox GL map component with mine/harbour markers"
```

---

### Task 6: Wire up the map page

**Files:**
- Modify: `dashboard/app/map/page.tsx`

- [ ] **Step 1: Replace the placeholder with the real map page**

Replace `app/map/page.tsx`:

```tsx
import { getMines, getHarbours, getActiveListings, getRoutes } from '@/lib/queries';
import { MapClient } from './map-client';

export default async function MapPage() {
  const [mines, harbours, listings, routes] = await Promise.all([
    getMines(),
    getHarbours(),
    getActiveListings(),
    getRoutes(),
  ]);

  return <MapClient mines={mines} harbours={harbours} listings={listings} routes={routes} />;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/alexnelja/projects/dashboard && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add app/map/page.tsx && git commit -m "feat: wire up map page with server data fetching"
```

---

### Task 7: Build reusable listing and requirement card components

**Files:**
- Create: `dashboard/app/marketplace/listing-card.tsx`
- Create: `dashboard/app/marketplace/requirement-card.tsx`

- [ ] **Step 1: Create listing card**

Create `app/marketplace/listing-card.tsx`:

```tsx
import Link from 'next/link';
import { COMMODITY_CONFIG, type Listing } from '@/lib/types';
import { timeAgo } from '@/lib/format';

interface ListingCardProps {
  listing: Listing;
}

export function ListingCard({ listing }: ListingCardProps) {
  const config = COMMODITY_CONFIG[listing.commodity_type];

  return (
    <Link
      href={`/marketplace/listings/${listing.id}`}
      className="block bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: config.color }}
          />
          <span className="text-sm font-semibold text-white">
            {config.label}
          </span>
          {listing.is_verified && (
            <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
              ✓ Verified
            </span>
          )}
        </div>
        <span className="text-xs text-gray-600">{timeAgo(listing.created_at)}</span>
      </div>
      <div className="flex items-center justify-between mt-3">
        <span className="text-lg font-bold text-amber-500">
          ${listing.price_per_tonne}/t
        </span>
        <span className="text-sm text-gray-400">
          {listing.volume_tonnes.toLocaleString()}t
        </span>
      </div>
      <div className="flex gap-1.5 mt-2">
        {listing.incoterms.map((term) => (
          <span
            key={term}
            className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded"
          >
            {term}
          </span>
        ))}
        <span className="text-[10px] text-gray-500 ml-auto">
          {listing.currency}
        </span>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Create requirement card**

Create `app/marketplace/requirement-card.tsx`:

```tsx
import { COMMODITY_CONFIG, type Requirement } from '@/lib/types';
import { timeAgo } from '@/lib/format';

interface RequirementCardProps {
  requirement: Requirement;
}

export function RequirementCard({ requirement }: RequirementCardProps) {
  const config = COMMODITY_CONFIG[requirement.commodity_type];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: config.color }}
          />
          <span className="text-sm font-semibold text-white">
            {config.label} wanted
          </span>
        </div>
        <span className="text-xs text-gray-600">{timeAgo(requirement.created_at)}</span>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        Delivery to {requirement.delivery_port} · {requirement.incoterm}
      </p>
      <div className="flex items-center justify-between mt-3">
        <span className="text-lg font-bold text-blue-400">
          ${requirement.target_price}/t target
        </span>
        <span className="text-sm text-gray-400">
          {requirement.volume_needed.toLocaleString()}t needed
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add app/marketplace/listing-card.tsx app/marketplace/requirement-card.tsx && git commit -m "feat: add reusable listing and requirement card components"
```

---

### Task 8: Build the marketplace browse page

**Files:**
- Modify: `dashboard/app/marketplace/page.tsx`

- [ ] **Step 1: Replace marketplace placeholder**

Replace `app/marketplace/page.tsx`:

```tsx
import { getActiveListings, getActiveRequirements } from '@/lib/queries';
import { ListingCard } from './listing-card';
import { RequirementCard } from './requirement-card';
import Link from 'next/link';

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const tab = params.tab ?? 'listings';

  const [listings, requirements] = await Promise.all([
    getActiveListings(),
    getActiveRequirements(),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marketplace</h1>
          <p className="text-gray-400 text-sm mt-1">Browse listings and buyer requirements</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/marketplace/new-listing"
            className="text-xs bg-white text-black rounded-lg px-3 py-1.5 font-medium hover:bg-gray-200 transition-colors"
          >
            + New Listing
          </Link>
          <Link
            href="/marketplace/new-requirement"
            className="text-xs bg-gray-900 border border-gray-800 text-gray-300 rounded-lg px-3 py-1.5 font-medium hover:text-white transition-colors"
          >
            + New Requirement
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-800">
        <Link
          href="/marketplace?tab=listings"
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'listings'
              ? 'text-white border-b-2 border-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Listings ({listings.length})
        </Link>
        <Link
          href="/marketplace?tab=requirements"
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'requirements'
              ? 'text-white border-b-2 border-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Requirements ({requirements.length})
        </Link>
      </div>

      {/* Content */}
      {tab === 'listings' ? (
        listings.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center text-gray-500">
            No active listings yet. Be the first to list material!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )
      ) : requirements.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center text-gray-500">
          No active requirements yet. Post what you need!
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {requirements.map((req) => (
            <RequirementCard key={req.id} requirement={req} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add app/marketplace/page.tsx && git commit -m "feat: build marketplace browse page with listings/requirements tabs"
```

---

### Task 9: Build the listing detail page

**Files:**
- Create: `dashboard/app/marketplace/listings/[id]/page.tsx`

- [ ] **Step 1: Create listing detail page**

Create `app/marketplace/listings/[id]/page.tsx`:

```tsx
import { getListingById } from '@/lib/queries';
import { COMMODITY_CONFIG } from '@/lib/types';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await getListingById(id);

  if (!listing) notFound();

  const config = COMMODITY_CONFIG[listing.commodity_type];

  return (
    <div className="max-w-3xl">
      <Link
        href="/marketplace"
        className="text-xs text-gray-500 hover:text-white transition-colors"
      >
        ← Back to Marketplace
      </Link>

      <div className="mt-4 bg-gray-900 border border-gray-800 rounded-xl p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: config.color }}
              />
              <h1 className="text-xl font-bold">{config.label}</h1>
              {listing.is_verified && (
                <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  ✓ Verified
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400">
              Listed by {listing.seller_company}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-amber-500">
              ${listing.price_per_tonne}/t
            </p>
            <p className="text-xs text-gray-500">{listing.currency}</p>
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-4 mt-6">
          <DetailItem label="Source Mine" value={`${listing.mine_name}, ${listing.mine_region}`} />
          <DetailItem label="Loading Port" value={listing.harbour_name} />
          <DetailItem label="Volume" value={`${listing.volume_tonnes.toLocaleString()} tonnes`} />
          <DetailItem label="Incoterms" value={listing.incoterms.join(', ')} />
          <DetailItem
            label="Allocation"
            value={listing.allocation_mode === 'open' ? 'Open to all buyers' : 'Invite only'}
          />
          <DetailItem
            label="Status"
            value={listing.status.charAt(0).toUpperCase() + listing.status.slice(1)}
          />
        </div>

        {/* Spec sheet */}
        {Object.keys(listing.spec_sheet).length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">Spec Sheet</h2>
            <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(listing.spec_sheet).map(([key, value]) => (
                  <div key={key}>
                    <p className="text-xs text-gray-500">{key.replace(/_/g, ' ')}</p>
                    <p className="text-sm font-medium text-white">{String(value)}%</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Action */}
        <div className="mt-6 pt-6 border-t border-gray-800">
          <button className="bg-white text-black rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-200 transition-colors">
            Express Interest
          </button>
          <p className="text-xs text-gray-600 mt-2">
            Deal flow will be available in Plan 3
          </p>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-white mt-0.5">{value}</p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add app/marketplace/listings && git commit -m "feat: add listing detail page with spec sheet"
```

---

### Task 10: Build the create listing form

**Files:**
- Create: `dashboard/app/marketplace/new-listing/page.tsx`

- [ ] **Step 1: Create the listing form**

Create `app/marketplace/new-listing/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { COMMODITY_CONFIG, type CommodityType, type CurrencyType } from '@/lib/types';
import Link from 'next/link';

const commodities = Object.keys(COMMODITY_CONFIG) as CommodityType[];
const currencies: CurrencyType[] = ['USD', 'ZAR', 'EUR'];
const incotermsOptions = ['FOB', 'CIF', 'CFR', 'EXW', 'DDP'];

export default function NewListingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [commodityType, setCommodityType] = useState<CommodityType>('chrome');
  const [pricePer, setPricePer] = useState('');
  const [volume, setVolume] = useState('');
  const [currency, setCurrency] = useState<CurrencyType>('USD');
  const [selectedIncoterms, setSelectedIncoterms] = useState<string[]>(['FOB']);
  const [specFields, setSpecFields] = useState<Record<string, string>>({});

  function toggleIncoterm(term: string) {
    setSelectedIncoterms((prev) =>
      prev.includes(term) ? prev.filter((t) => t !== term) : [...prev, term]
    );
  }

  function updateSpec(key: string, value: string) {
    setSpecFields((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('You must be logged in');
      setLoading(false);
      return;
    }

    // Get user's first mine (simplified for v1)
    const { data: mines } = await supabase
      .from('mines')
      .select('id, nearest_harbour_id')
      .limit(1);

    if (!mines || mines.length === 0) {
      setError('No mines found. Please contact support to register your mine.');
      setLoading(false);
      return;
    }

    const specSheet: Record<string, number> = {};
    for (const [key, value] of Object.entries(specFields)) {
      if (value) specSheet[key] = parseFloat(value);
    }

    const { error: insertError } = await supabase.from('listings').insert({
      seller_id: user.id,
      source_mine_id: mines[0].id,
      commodity_type: commodityType,
      spec_sheet: specSheet,
      volume_tonnes: parseFloat(volume),
      price_per_tonne: parseFloat(pricePer),
      currency,
      incoterms: selectedIncoterms,
      loading_port_id: mines[0].nearest_harbour_id,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push('/marketplace');
    router.refresh();
  }

  // Dynamic spec fields based on commodity
  const specFieldsForCommodity: Record<CommodityType, string[]> = {
    chrome: ['cr2o3_pct', 'fe_pct', 'sio2_pct', 'moisture_pct'],
    manganese: ['mn_pct', 'fe_pct', 'sio2_pct', 'moisture_pct'],
    iron_ore: ['fe_pct', 'sio2_pct', 'al2o3_pct', 'moisture_pct'],
    coal: ['cv_kcal', 'ash_pct', 'volatile_pct', 'moisture_pct'],
    aggregates: ['particle_size_mm', 'density', 'moisture_pct'],
  };

  return (
    <div className="max-w-xl">
      <Link
        href="/marketplace"
        className="text-xs text-gray-500 hover:text-white transition-colors"
      >
        ← Back to Marketplace
      </Link>
      <h1 className="text-2xl font-bold tracking-tight mt-4 mb-6">New Listing</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Commodity */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">Commodity</label>
          <div className="grid grid-cols-5 gap-2">
            {commodities.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCommodityType(c)}
                className={`p-2 rounded-lg border text-center text-xs transition-colors ${
                  commodityType === c
                    ? 'border-white bg-gray-800 text-white'
                    : 'border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-600'
                }`}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full mb-1"
                  style={{ backgroundColor: COMMODITY_CONFIG[c].color }}
                />
                <div>{COMMODITY_CONFIG[c].label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Price and Volume */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="price" className="block text-sm text-gray-400 mb-1">Price per tonne</label>
            <input
              id="price"
              type="number"
              step="0.01"
              value={pricePer}
              onChange={(e) => setPricePer(e.target.value)}
              required
              className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-600"
              placeholder="185.00"
            />
          </div>
          <div>
            <label htmlFor="volume" className="block text-sm text-gray-400 mb-1">Volume (tonnes)</label>
            <input
              id="volume"
              type="number"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              required
              className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-600"
              placeholder="15000"
            />
          </div>
        </div>

        {/* Currency */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Currency</label>
          <div className="flex gap-2">
            {currencies.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  currency === c
                    ? 'border-white bg-gray-800 text-white'
                    : 'border-gray-800 text-gray-400 hover:border-gray-600'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Incoterms */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Available Incoterms</label>
          <div className="flex gap-2 flex-wrap">
            {incotermsOptions.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => toggleIncoterm(term)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  selectedIncoterms.includes(term)
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    : 'border-gray-800 text-gray-400 hover:border-gray-600'
                }`}
              >
                {term}
              </button>
            ))}
          </div>
        </div>

        {/* Spec Sheet */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">Spec Sheet</label>
          <div className="grid grid-cols-2 gap-3">
            {specFieldsForCommodity[commodityType].map((field) => (
              <div key={field}>
                <label htmlFor={field} className="block text-xs text-gray-500 mb-1">
                  {field.replace(/_/g, ' ')}
                </label>
                <input
                  id={field}
                  type="number"
                  step="0.01"
                  value={specFields[field] ?? ''}
                  onChange={(e) => updateSpec(field, e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-600"
                  placeholder="0.00"
                />
              </div>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-white text-black rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          {loading ? 'Creating listing...' : 'Create Listing'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add app/marketplace/new-listing && git commit -m "feat: add create listing form with commodity-specific spec fields"
```

---

### Task 11: Build the create requirement form

**Files:**
- Create: `dashboard/app/marketplace/new-requirement/page.tsx`

- [ ] **Step 1: Create the requirement form**

Create `app/marketplace/new-requirement/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { COMMODITY_CONFIG, type CommodityType, type CurrencyType } from '@/lib/types';
import Link from 'next/link';

const commodities = Object.keys(COMMODITY_CONFIG) as CommodityType[];
const currencies: CurrencyType[] = ['USD', 'ZAR', 'EUR'];
const incotermsOptions = ['FOB', 'CIF', 'CFR', 'EXW', 'DDP'];

export default function NewRequirementPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [commodityType, setCommodityType] = useState<CommodityType>('chrome');
  const [targetPrice, setTargetPrice] = useState('');
  const [volume, setVolume] = useState('');
  const [currency, setCurrency] = useState<CurrencyType>('USD');
  const [incoterm, setIncoterm] = useState('FOB');
  const [deliveryPort, setDeliveryPort] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('You must be logged in');
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from('requirements').insert({
      buyer_id: user.id,
      commodity_type: commodityType,
      target_spec_range: {},
      volume_needed: parseFloat(volume),
      target_price: parseFloat(targetPrice),
      currency,
      delivery_port: deliveryPort,
      incoterm,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push('/marketplace?tab=requirements');
    router.refresh();
  }

  return (
    <div className="max-w-xl">
      <Link
        href="/marketplace"
        className="text-xs text-gray-500 hover:text-white transition-colors"
      >
        ← Back to Marketplace
      </Link>
      <h1 className="text-2xl font-bold tracking-tight mt-4 mb-6">New Requirement</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Commodity */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">Commodity needed</label>
          <div className="grid grid-cols-5 gap-2">
            {commodities.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCommodityType(c)}
                className={`p-2 rounded-lg border text-center text-xs transition-colors ${
                  commodityType === c
                    ? 'border-white bg-gray-800 text-white'
                    : 'border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-600'
                }`}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full mb-1"
                  style={{ backgroundColor: COMMODITY_CONFIG[c].color }}
                />
                <div>{COMMODITY_CONFIG[c].label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Target Price and Volume */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="target-price" className="block text-sm text-gray-400 mb-1">Target price per tonne</label>
            <input
              id="target-price"
              type="number"
              step="0.01"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              required
              className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-600"
              placeholder="180.00"
            />
          </div>
          <div>
            <label htmlFor="req-volume" className="block text-sm text-gray-400 mb-1">Volume needed (tonnes)</label>
            <input
              id="req-volume"
              type="number"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              required
              className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-600"
              placeholder="20000"
            />
          </div>
        </div>

        {/* Delivery Port */}
        <div>
          <label htmlFor="delivery-port" className="block text-sm text-gray-400 mb-1">Delivery port</label>
          <input
            id="delivery-port"
            type="text"
            value={deliveryPort}
            onChange={(e) => setDeliveryPort(e.target.value)}
            required
            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-600"
            placeholder="Shanghai, Mersin, Tianjin..."
          />
        </div>

        {/* Currency and Incoterm */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Currency</label>
            <div className="flex gap-2">
              {currencies.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    currency === c
                      ? 'border-white bg-gray-800 text-white'
                      : 'border-gray-800 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Preferred Incoterm</label>
            <div className="flex gap-2 flex-wrap">
              {incotermsOptions.slice(0, 3).map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => setIncoterm(term)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    incoterm === term
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      : 'border-gray-800 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-white text-black rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          {loading ? 'Posting requirement...' : 'Post Requirement'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add app/marketplace/new-requirement && git commit -m "feat: add create requirement form"
```

---

### Task 12: Build the user dashboard page

**Files:**
- Modify: `dashboard/app/dashboard/page.tsx`

- [ ] **Step 1: Replace dashboard placeholder**

Replace `app/dashboard/page.tsx`:

```tsx
import { requireAuth } from '@/lib/auth';
import { getUserListings, getUserRequirements } from '@/lib/queries';
import { COMMODITY_CONFIG } from '@/lib/types';
import Link from 'next/link';

export default async function DashboardPage() {
  const user = await requireAuth();
  const [listings, requirements] = await Promise.all([
    getUserListings(user.id),
    getUserRequirements(user.id),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">
            {user.company_name} · {user.role}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Active Listings" value={listings.filter((l) => l.status === 'active').length} />
        <StatCard label="Active Requirements" value={requirements.filter((r) => r.status === 'active').length} />
        <StatCard label="Verified Listings" value={listings.filter((l) => l.is_verified).length} />
        <StatCard label="KYC Status" value={user.kyc_status} />
      </div>

      {/* Listings */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-300">Your Listings</h2>
          <Link
            href="/marketplace/new-listing"
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            + New Listing
          </Link>
        </div>
        {listings.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center text-gray-500 text-sm">
            No listings yet
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {listings.map((l, i) => {
              const config = COMMODITY_CONFIG[l.commodity_type];
              return (
                <div
                  key={l.id}
                  className={`flex items-center gap-4 px-5 py-3 ${
                    i !== listings.length - 1 ? 'border-b border-gray-800' : ''
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: config.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium">{config.label}</p>
                    <p className="text-xs text-gray-500">
                      {l.volume_tonnes.toLocaleString()}t · ${l.price_per_tonne}/t
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      l.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-gray-800 text-gray-400'
                    }`}
                  >
                    {l.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Requirements */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-300">Your Requirements</h2>
          <Link
            href="/marketplace/new-requirement"
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            + New Requirement
          </Link>
        </div>
        {requirements.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center text-gray-500 text-sm">
            No requirements yet
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {requirements.map((r, i) => {
              const config = COMMODITY_CONFIG[r.commodity_type];
              return (
                <div
                  key={r.id}
                  className={`flex items-center gap-4 px-5 py-3 ${
                    i !== requirements.length - 1 ? 'border-b border-gray-800' : ''
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: config.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium">{config.label} wanted</p>
                    <p className="text-xs text-gray-500">
                      {r.volume_needed.toLocaleString()}t · ${r.target_price}/t target · {r.delivery_port}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      r.status === 'active'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'bg-gray-800 text-gray-400'
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* Active Deals - placeholder for Plan 3 */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Active Deals</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center text-gray-500 text-sm">
          Deal tracking coming in Plan 3
        </div>
      </div>

      {/* Trust Score - placeholder for Plan 4 */}
      <div>
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Trust Score</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center text-gray-500 text-sm">
          Reputation scoring coming in Plan 4
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/alexnelja/projects/dashboard && git add app/dashboard/page.tsx && git commit -m "feat: build user dashboard with listings and requirements summary"
```

---

### Task 13: Verify everything builds

- [ ] **Step 1: TypeScript check**

Run: `cd /Users/alexnelja/projects/dashboard && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 2: Full build**

Run: `cd /Users/alexnelja/projects/dashboard && npm run build 2>&1 | tail -30`
Expected: Build succeeds with all routes including new ones:
- `/map` (dynamic)
- `/marketplace` (dynamic)
- `/marketplace/listings/[id]` (dynamic)
- `/marketplace/new-listing`
- `/marketplace/new-requirement`
- `/dashboard` (dynamic)
