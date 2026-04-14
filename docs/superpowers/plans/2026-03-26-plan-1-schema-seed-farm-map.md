# Phase 1, Plan 1: Database Schema + Seed Data + Farm Map

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing Cloudskraal CapEx app with farm/field tables, seed 128 fields + 20yr production history from real data, and build a full-screen MapLibre farm map with field polygons, detail panels, GIS overlays, and responsive mobile layout.

**Architecture:** Add new tables to existing SQLite schema. Load GeoJSON field boundaries and Johan Brand Oeskatting production data as seed. Build a MapLibre GL JS map page with enterprise-colored field polygons, a click-to-inspect detail panel (slide-up on mobile, sidebar on desktop), and toggleable GIS layers from Elsenburg/NDA ArcGIS REST services. Make the entire app responsive with bottom nav on mobile.

**Tech Stack:** MapLibre GL JS (free, open-source), React 19, TypeScript, Tailwind CSS 4, Express, SQLite, Recharts (for production charts in field panel)

**Spec:** `docs/superpowers/specs/2026-03-26-cloudskraal-os-design.md`

**Data files:**
- GeoJSON: `cloudskraal-capex/data/Cloudskraal .geojson` (128 fields, 115KB)
- Production: `cloudskraal-capex/data/Johan Brand - Rooibos Oeskatting.xlsx` (53 fields × 25 years)

---

## File Structure

### Backend — New Files
| File | Responsibility |
|------|---------------|
| `backend/src/db/schema-farms.js` | Farm, field, field_production, field_notes, map_layers table definitions |
| `backend/src/db/seed-farms.js` | Seed farms, fields (from GeoJSON), production history (from Oeskatting), map layers |
| `backend/src/routes/farms.js` | CRUD for farms + fields + production + notes + GeoJSON endpoint |

### Backend — Modified Files
| File | Change |
|------|--------|
| `backend/src/db/schema.js` | Import and call `initFarmSchema(db)` after existing schema init |
| `backend/src/index.js` | Import and mount farms routes, call farm seed |
| `backend/package.json` | Add `xlsx` dependency (for reading Oeskatting) |

### Frontend — New Files
| File | Responsibility |
|------|---------------|
| `frontend/src/pages/FarmMapPage.tsx` | Full-screen map page with sidebar/bottom-sheet field panel |
| `frontend/src/components/map/FarmMap.tsx` | MapLibre GL JS map with field polygon layers |
| `frontend/src/components/map/FieldPanel.tsx` | Field detail panel (info + production chart + notes) |
| `frontend/src/components/map/LayerControl.tsx` | GIS layer toggle panel |
| `frontend/src/components/map/MapControls.tsx` | Farm zoom, enterprise filter, field search |
| `frontend/src/components/layout/AppShell.tsx` | Responsive shell: sidebar on desktop, bottom nav on mobile |
| `frontend/src/components/layout/BottomNav.tsx` | Mobile bottom tab navigation |
| `frontend/src/api/farms.ts` | API client for farm/field endpoints |
| `frontend/src/types/farm.ts` | TypeScript types for farm, field, production, note |

### Frontend — Modified Files
| File | Change |
|------|--------|
| `frontend/src/App.tsx` | Wrap in AppShell, add /map route, remove hardcoded sidebar |
| `frontend/src/components/Sidebar.tsx` | Add Map, Calendar, Wiki nav items |
| `frontend/package.json` | Add `maplibre-gl` dependency |

---

## Task 1: Backend — Farm Schema

**Files:**
- Create: `backend/src/db/schema-farms.js`
- Modify: `backend/src/db/schema.js`

- [ ] **Step 1: Create farm schema file**

Create `backend/src/db/schema-farms.js`:

```javascript
function initFarmSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS farms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE,
      type TEXT NOT NULL DEFAULT 'owned',
      total_ha REAL,
      lat REAL,
      lng REAL,
      region TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fields (
      id TEXT PRIMARY KEY,
      farm_id TEXT NOT NULL REFERENCES farms(id),
      name TEXT NOT NULL,
      code TEXT,
      enterprise TEXT NOT NULL DEFAULT 'unclassified',
      crop_type TEXT,
      area_ha REAL,
      planted_year TEXT,
      status TEXT DEFAULT 'active',
      geometry TEXT NOT NULL,
      soil_type TEXT,
      irrigation_type TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS field_production (
      id TEXT PRIMARY KEY,
      field_id TEXT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
      year INTEGER NOT NULL,
      estimated_yield_kg REAL,
      actual_yield_kg REAL,
      notes TEXT,
      UNIQUE(field_id, year)
    );

    CREATE TABLE IF NOT EXISTS field_notes (
      id TEXT PRIMARY KEY,
      field_id TEXT REFERENCES fields(id) ON DELETE CASCADE,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      title TEXT,
      body TEXT,
      photo_path TEXT,
      tags TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS map_layers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source_url TEXT NOT NULL,
      source_type TEXT NOT NULL,
      category TEXT,
      visible INTEGER DEFAULT 0,
      opacity REAL DEFAULT 0.7,
      z_index INTEGER DEFAULT 0
    );
  `);
}

module.exports = { initFarmSchema };
```

- [ ] **Step 2: Wire into existing schema.js**

Modify `backend/src/db/schema.js` — add after existing `initSchema(db)` call:

```javascript
const { initFarmSchema } = require('./schema-farms');

// Inside getDb(), after initSchema(db):
initFarmSchema(db);
```

- [ ] **Step 3: Verify schema creates on startup**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex/backend
rm -f data/capex.db
node -e "const {getDb} = require('./src/db/schema'); const db = getDb(); console.log(db.pragma('table_list').map(t => t.name).sort().join(', '));"
```

Expected: `cash_flows, farms, field_notes, field_production, fields, map_layers, projects, scenarios`

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/schema-farms.js backend/src/db/schema.js
git commit -m "feat: add farm/field/production/notes schema tables"
```

---

## Task 2: Backend — Farm & Field Seed Data

**Files:**
- Create: `backend/src/db/seed-farms.js`
- Modify: `backend/src/index.js`
- Modify: `backend/package.json`

- [ ] **Step 1: Add xlsx dependency**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex/backend
npm install xlsx
```

- [ ] **Step 2: Create seed-farms.js**

Create `backend/src/db/seed-farms.js`. This file must:

1. Check if farms table is already seeded (skip if so)
2. Read `../../data/Cloudskraal .geojson` and parse 128 field features
3. Read `../../data/Johan Brand - Rooibos Oeskatting.xlsx` and parse 53 fields × 25 years
4. Create 6 farm records (Cloudskraal, Glenridge, Biekoes, Garsland, Meulsteenvlei, Kromvlei)
5. For each GeoJSON feature, determine the farm by name prefix and enterprise by matching logic:
   - `B*:` → farm: Biekoes, enterprise: rooibos
   - `C*:` (not CL) → farm: Cloudskraal, enterprise: rooibos
   - `CL *` → farm: Cloudskraal, enterprise: boundary (skip or mark as farm_boundary)
   - `G*:` (not GA) → farm: Glenridge, enterprise: rooibos
   - `GA*:` → farm: Garsland, enterprise: rooibos
   - `Pierre*` → farm: Meulsteenvlei, enterprise: infer from name (buchu if "buchu" in name, else rooibos)
   - `KV*` / `Kromvlei*` / `kromvlei*` → farm: Kromvlei, enterprise: infer (vineyard if "wingerd"/"Wingerd" in name, else rooibos)
   - Names containing "Wingerd" or "wingerd" → enterprise: wine
   - Names containing "Buchu" or "buchu" → enterprise: buchu
   - Area > 200 ha → type: farm_boundary (not a field, store but mark differently)
   - `sketch-*` → skip
   - `Almond Orchard` → enterprise: other
   - `Gaste huise` → enterprise: other (tourism)
   - `Garsland Tea Court` → enterprise: other (facility)
   - `Chenin Blanc` → enterprise: wine
6. Match Oeskatting field codes to GeoJSON field codes and load production data (year, estimated_yield_kg, actual_yield_kg)
7. Seed map_layers with pre-configured GIS endpoints

The seed function signature: `function seedFarms(db) { ... }`

Key implementation notes:
- Use `xlsx` package to read the .xlsx file: `const XLSX = require('xlsx');`
- Parse Oeskatting: row 3 is header, rows 4-56 are data. Columns: A=farm, B=land_name, C=code, D=planted, E=hectares, then pairs of (OESSKAT, WERKLIK) for years 2004-2028
- GeoJSON geometry stored as `JSON.stringify(feature.geometry)` in the fields table
- Calculate area_ha from GeoJSON geometry using the shoelace formula (or use the Oeskatting hectares where matched)
- Oeskatting field codes (B2, C9, G3, GA2) match GeoJSON codes extracted from names like "B2: Damkamp" → code "B2"
- Some Oeskatting values are strings like "NIE BESKIKBAAR" — treat as null
- Some values are 0 — store as 0 (field existed but no production)
- Production values are in kg (already)

Farm seed data:
```javascript
const FARMS = [
  { name: 'Cloudskraal', code: 'cloudskraal', type: 'owned', total_ha: 5864, lat: -31.3222, lng: 19.0198, region: 'Northern Cape' },
  { name: 'Glenridge', code: 'glenridge', type: 'owned', total_ha: 324, lat: -31.30, lng: 19.03, region: 'Northern Cape' },
  { name: 'Biekoes', code: 'biekoes', type: 'owned', total_ha: 517, lat: -31.31, lng: 18.95, region: 'Northern Cape' },
  { name: 'Garsland', code: 'garsland', type: 'owned', total_ha: 61, lat: -31.32, lng: 19.01, region: 'Northern Cape' },
  { name: 'Meulsteenvlei', code: 'meulsteenvlei', type: 'owned', total_ha: 207, lat: -31.33, lng: 19.00, region: 'Northern Cape' },
  { name: 'Kromvlei', code: 'kromvlei', type: 'prospect', total_ha: 507, lat: -31.34, lng: 19.02, region: 'Northern Cape' },
];
```

Map layers seed data:
```javascript
const MAP_LAYERS = [
  { name: 'Soils', source_url: 'https://gis.elsenburg.com/arcgis/rest/services/Soils/MapServer', source_type: 'arcgis_tiles', category: 'soils' },
  { name: 'Rainfall', source_url: 'https://gis.elsenburg.com/arcgis/rest/services/Climate/MapServer', source_type: 'arcgis_tiles', category: 'climate' },
  { name: 'Vegetation', source_url: 'https://gis.elsenburg.com/arcgis/rest/services/Vegetation/MapServer', source_type: 'arcgis_tiles', category: 'vegetation' },
  { name: 'Geology', source_url: 'https://gis.elsenburg.com/arcgis/rest/services/Geology/CGS_1M_Geology/MapServer', source_type: 'arcgis_tiles', category: 'geology' },
  { name: 'Elevation', source_url: 'https://gis.elsenburg.com/arcgis/rest/services/Topography/SUDEM80/MapServer', source_type: 'arcgis_tiles', category: 'topography' },
  { name: 'Cadastral Boundaries', source_url: 'https://gis.elsenburg.com/arcgis/rest/services/SG/MapServer', source_type: 'arcgis_tiles', category: 'boundaries' },
  { name: 'Soil pH', source_url: 'https://maps.isric.org/mapserv?map=/map/phh2o.map', source_type: 'wms', category: 'soils' },
  { name: 'Soil Clay Content', source_url: 'https://maps.isric.org/mapserv?map=/map/clay.map', source_type: 'wms', category: 'soils' },
  { name: 'Soil Organic Carbon', source_url: 'https://maps.isric.org/mapserv?map=/map/soc.map', source_type: 'wms', category: 'soils' },
  { name: 'Agricultural Capability (NC)', source_url: 'https://ndagis.nda.agric.za/arcgis/rest/services/Northern_Cape/MapServer', source_type: 'arcgis_tiles', category: 'agriculture' },
];
```

- [ ] **Step 3: Wire seed into index.js**

Modify `backend/src/index.js`:

```javascript
const { seedFarms } = require('./db/seed-farms');

// After existing seedDatabase(db):
seedFarms(db);
```

- [ ] **Step 4: Delete DB and test seed**

```bash
rm -f data/capex.db
node -e "
const {getDb} = require('./src/db/schema');
const {seedDatabase} = require('./src/db/seed');
const {seedFarms} = require('./src/db/seed-farms');
const db = getDb();
seedDatabase(db);
seedFarms(db);
console.log('Farms:', db.prepare('SELECT count(*) as c FROM farms').get().c);
console.log('Fields:', db.prepare('SELECT count(*) as c FROM fields').get().c);
console.log('Production records:', db.prepare('SELECT count(*) as c FROM field_production').get().c);
console.log('Map layers:', db.prepare('SELECT count(*) as c FROM map_layers').get().c);
console.log('Rooibos fields:', db.prepare(\"SELECT count(*) as c FROM fields WHERE enterprise = 'rooibos'\").get().c);
"
```

Expected: Farms: 6, Fields: ~118 (128 minus ~10 farm boundaries and sketches), Production records: ~1300 (53 fields × ~25 years), Map layers: 10, Rooibos fields: ~57

- [ ] **Step 5: Commit**

```bash
git add backend/src/db/seed-farms.js backend/src/index.js backend/package.json backend/package-lock.json
git commit -m "feat: seed farms, fields from GeoJSON, 20yr production from Oeskatting"
```

---

## Task 3: Backend — Farm & Field API Routes

**Files:**
- Create: `backend/src/routes/farms.js`
- Modify: `backend/src/index.js`

- [ ] **Step 1: Create farms route file**

Create `backend/src/routes/farms.js` with these endpoints:

```
GET  /api/farms                         → All farms
GET  /api/farms/:id                     → Farm with field count summary
GET  /api/fields                        → All fields (filters: ?farm_id=, ?enterprise=)
GET  /api/fields/:id                    → Single field with production history
PATCH /api/fields/:id                   → Update field (enterprise, status, notes, etc.)
GET  /api/fields/:id/production         → Production history array
GET  /api/fields/:id/notes              → Field notes
POST /api/fields/:id/notes              → Create field note
DELETE /api/field-notes/:noteId         → Delete note
GET  /api/map/geojson                   → Full GeoJSON FeatureCollection (filters: ?farm=, ?enterprise=)
GET  /api/map-layers                    → All map layers
PATCH /api/map-layers/:id              → Update layer visibility/opacity
```

Key implementation:
- `/api/map/geojson` must return a valid GeoJSON FeatureCollection where each feature has `properties` including: id, name, code, farm_id, farm_name, enterprise, area_ha, status, planted_year. The `geometry` field is parsed from the stored JSON string.
- `/api/fields` returns field metadata (no geometry, for list views)
- `/api/fields/:id` returns full field + production[] + notes[]
- Filters use SQL WHERE clauses built from query params

- [ ] **Step 2: Mount in index.js**

Add to `backend/src/index.js`:

```javascript
const farmRoutes = require('./routes/farms');
app.use('/api', farmRoutes);
```

- [ ] **Step 3: Test endpoints**

```bash
# Start server
node src/index.js &
sleep 2

# Test farms
curl -s http://localhost:3001/api/farms | python3 -m json.tool | head -20

# Test fields with filter
curl -s "http://localhost:3001/api/fields?enterprise=rooibos" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{len(d)} rooibos fields')"

# Test GeoJSON
curl -s "http://localhost:3001/api/map/geojson?enterprise=rooibos" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{len(d[\"features\"])} features in GeoJSON')"

# Test single field with production
FIELD_ID=$(curl -s "http://localhost:3001/api/fields?enterprise=rooibos" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")
curl -s "http://localhost:3001/api/fields/$FIELD_ID" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{d[\"name\"]}: {len(d.get(\"production\",[]))} production records')"

# Test map layers
curl -s http://localhost:3001/api/map-layers | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{len(d)} map layers')"

kill %1
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/farms.js backend/src/index.js
git commit -m "feat: add farm/field/production/notes/geojson API routes"
```

---

## Task 4: Frontend — Install MapLibre + Types

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/types/farm.ts`
- Create: `frontend/src/api/farms.ts`

- [ ] **Step 1: Install maplibre-gl**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex/frontend
npm install maplibre-gl
```

- [ ] **Step 2: Create farm types**

Create `frontend/src/types/farm.ts`:

```typescript
export interface Farm {
  id: string;
  name: string;
  code: string;
  type: 'owned' | 'leased' | 'prospect';
  total_ha: number;
  lat: number;
  lng: number;
  region: string;
  notes: string | null;
  field_count?: number;
}

export interface Field {
  id: string;
  farm_id: string;
  farm_name?: string;
  name: string;
  code: string | null;
  enterprise: string;
  crop_type: string | null;
  area_ha: number;
  planted_year: string | null;
  status: string;
  soil_type: string | null;
  irrigation_type: string | null;
  notes: string | null;
  production?: FieldProduction[];
  field_notes?: FieldNote[];
}

export interface FieldProduction {
  id: string;
  field_id: string;
  year: number;
  estimated_yield_kg: number | null;
  actual_yield_kg: number | null;
}

export interface FieldNote {
  id: string;
  field_id: string;
  lat: number;
  lng: number;
  title: string | null;
  body: string | null;
  photo_path: string | null;
  tags: string[];
  created_by: string | null;
  created_at: string;
}

export interface MapLayer {
  id: string;
  name: string;
  source_url: string;
  source_type: 'arcgis_tiles' | 'wms' | 'geojson';
  category: string;
  visible: boolean;
  opacity: number;
  z_index: number;
}

export type Enterprise = 'rooibos' | 'wine' | 'sheep' | 'buchu' | 'sceletium' | 'grazing' | 'fallow' | 'other' | 'unclassified';

export const ENTERPRISE_COLORS: Record<string, string> = {
  rooibos: '#047857',     // emerald-700
  wine: '#7c3aed',        // violet-600
  sheep: '#d97706',       // amber-600
  buchu: '#0d9488',       // teal-600
  sceletium: '#059669',   // emerald-600
  grazing: '#a16207',     // yellow-700
  fallow: '#9ca3af',      // gray-400
  other: '#6b7280',       // gray-500
  unclassified: '#d1d5db', // gray-300
  farm_boundary: '#374151', // gray-700 dashed
};

export const ENTERPRISE_LABELS: Record<string, string> = {
  rooibos: 'Rooibos',
  wine: 'Wine / Grapes',
  sheep: 'Sheep / Grazing',
  buchu: 'Buchu',
  sceletium: 'Sceletium',
  grazing: 'Natural Veld',
  fallow: 'Fallow',
  other: 'Other',
  unclassified: 'Unclassified',
};
```

- [ ] **Step 3: Create farms API client**

Create `frontend/src/api/farms.ts`:

```typescript
import type { Farm, Field, FieldNote, MapLayer } from '../types/farm';

const BASE_URL = 'http://localhost:3001/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function getFarms(): Promise<Farm[]> {
  return request<Farm[]>('/farms');
}

export async function getFields(params?: { farm_id?: string; enterprise?: string }): Promise<Field[]> {
  const qs = new URLSearchParams();
  if (params?.farm_id) qs.set('farm_id', params.farm_id);
  if (params?.enterprise) qs.set('enterprise', params.enterprise);
  const query = qs.toString();
  return request<Field[]>(`/fields${query ? `?${query}` : ''}`);
}

export async function getField(id: string): Promise<Field> {
  return request<Field>(`/fields/${id}`);
}

export async function updateField(id: string, data: Partial<Field>): Promise<Field> {
  return request<Field>(`/fields/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function getMapGeoJSON(params?: { farm?: string; enterprise?: string }): Promise<GeoJSON.FeatureCollection> {
  const qs = new URLSearchParams();
  if (params?.farm) qs.set('farm', params.farm);
  if (params?.enterprise) qs.set('enterprise', params.enterprise);
  const query = qs.toString();
  return request<GeoJSON.FeatureCollection>(`/map/geojson${query ? `?${query}` : ''}`);
}

export async function getMapLayers(): Promise<MapLayer[]> {
  return request<MapLayer[]>('/map-layers');
}

export async function updateMapLayer(id: string, data: { visible?: boolean; opacity?: number }): Promise<MapLayer> {
  return request<MapLayer>(`/map-layers/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function createFieldNote(fieldId: string, data: { lat: number; lng: number; title?: string; body?: string }): Promise<FieldNote> {
  return request<FieldNote>(`/fields/${fieldId}/notes`, { method: 'POST', body: JSON.stringify(data) });
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/types/farm.ts frontend/src/api/farms.ts
git commit -m "feat: add MapLibre dependency, farm types, and API client"
```

---

## Task 5: Frontend — Responsive App Shell

**Files:**
- Create: `frontend/src/components/layout/AppShell.tsx`
- Create: `frontend/src/components/layout/BottomNav.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create BottomNav component**

Create `frontend/src/components/layout/BottomNav.tsx`:

Mobile bottom navigation with 5 tabs: Home, Map, Calendar, Wiki, More.
- Uses `NavLink` from react-router-dom
- Icons from lucide-react: `LayoutDashboard`, `Map`, `Calendar`, `BookOpen`, `Menu`
- Fixed to bottom, h-16, bg-white, border-t, z-50
- Active tab: emerald-700 text+icon, inactive: gray-400
- Touch target: full tab width, min 44px height
- Only visible on mobile (< md breakpoint)

- [ ] **Step 2: Update Sidebar with new nav items**

Modify `frontend/src/components/Sidebar.tsx`:

Add nav items for Map, Calendar, Wiki to the existing array:
```typescript
const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/map', icon: Map, label: 'Farm Map' },
  { to: '/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/wiki', icon: BookOpen, label: 'Wiki' },
  { to: '/projects', icon: FolderOpen, label: 'CapEx' },
  { to: '/compare', icon: GitCompare, label: 'Compare' },
];
```

Import `Map`, `Calendar`, `BookOpen` from lucide-react.

Add `hidden md:flex` to the aside element so sidebar hides on mobile.

- [ ] **Step 3: Create AppShell**

Create `frontend/src/components/layout/AppShell.tsx`:

Wraps the app content. On mobile (< md), removes left margin and shows BottomNav. On desktop (≥ md), shows Sidebar with left margin.

```typescript
import { useState } from 'react';
import Sidebar from '../Sidebar';
import BottomNav from './BottomNav';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50">
      <Sidebar />
      <BottomNav />
      {/* Main content: left margin on desktop only, bottom padding on mobile for nav */}
      <main className="md:ml-64 pb-20 md:pb-0 transition-all duration-300">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Update App.tsx**

Replace the current App.tsx layout with AppShell. Add the /map route (placeholder for now). Remove the hardcoded sidebar and margin from App.tsx since AppShell handles it.

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import Dashboard from './pages/Dashboard';
import ProjectsList from './pages/ProjectsList';
import ProjectDetail from './pages/ProjectDetail';
import CompareProjects from './pages/CompareProjects';
import FarmMapPage from './pages/FarmMapPage';

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<div className="p-8"><div className="max-w-7xl mx-auto"><Dashboard /></div></div>} />
          <Route path="/map" element={<FarmMapPage />} />
          <Route path="/map/:fieldId" element={<FarmMapPage />} />
          <Route path="/calendar" element={<div className="p-8"><div className="max-w-7xl mx-auto"><p className="text-stone-400">Calendar — coming soon</p></div></div>} />
          <Route path="/wiki" element={<div className="p-8"><div className="max-w-7xl mx-auto"><p className="text-stone-400">Wiki — coming soon</p></div></div>} />
          <Route path="/projects" element={<div className="p-8"><div className="max-w-7xl mx-auto"><ProjectsList /></div></div>} />
          <Route path="/projects/:id" element={<div className="p-8"><div className="max-w-7xl mx-auto"><ProjectDetail /></div></div>} />
          <Route path="/compare" element={<div className="p-8"><div className="max-w-7xl mx-auto"><CompareProjects /></div></div>} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
```

Note: FarmMapPage gets NO padding/max-width wrapper — it's full-screen. Other pages keep their padding.

- [ ] **Step 5: Create placeholder FarmMapPage**

Create `frontend/src/pages/FarmMapPage.tsx` with a simple placeholder:

```typescript
export default function FarmMapPage() {
  return (
    <div className="h-[calc(100vh-5rem)] md:h-screen bg-stone-200 flex items-center justify-center">
      <p className="text-stone-500">Farm Map loading...</p>
    </div>
  );
}
```

- [ ] **Step 6: Test responsive layout**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex/frontend
npm run dev
```

Open http://localhost:5173 — verify:
- Desktop (>768px): sidebar visible on left, content area with margin
- Mobile (<768px): no sidebar, bottom nav visible with 5 tabs, content fills width
- Click "Farm Map" tab — shows placeholder
- All existing pages (Dashboard, CapEx, Compare) still work

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/layout/ frontend/src/components/Sidebar.tsx frontend/src/App.tsx frontend/src/pages/FarmMapPage.tsx
git commit -m "feat: responsive app shell with sidebar (desktop) and bottom nav (mobile)"
```

---

## Task 6: Frontend — MapLibre Farm Map

**Files:**
- Create: `frontend/src/components/map/FarmMap.tsx`
- Modify: `frontend/src/pages/FarmMapPage.tsx`

- [ ] **Step 1: Add MapLibre CSS import**

Add to `frontend/src/index.css` (or import in FarmMapPage):
```css
@import 'maplibre-gl/dist/maplibre-gl.css';
```

- [ ] **Step 2: Create FarmMap component**

Create `frontend/src/components/map/FarmMap.tsx`:

This is the core map component. It must:

1. Initialize a MapLibre GL JS map in a container div
2. Use free satellite tiles. Options:
   - Esri World Imagery: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}` (free for non-commercial/dev)
   - Or OpenStreetMap for initial development: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`
3. Center on Cloudskraal: `[19.0198, -31.3222]`, zoom 12
4. Load field GeoJSON from `/api/map/geojson` as a source
5. Add a fill layer for field polygons, colored by enterprise using `ENTERPRISE_COLORS`
6. Add an outline layer for field boundaries (1px darker stroke)
7. Add a symbol layer for field labels (name + area)
8. On field click: call `onFieldSelect(fieldId)` callback
9. On field hover: change cursor to pointer, highlight the field
10. Accept `selectedFieldId` prop to highlight the selected field
11. Accept `visibleEnterprises` prop to filter which enterprises show
12. Cleanup map on unmount

Key MapLibre patterns:
```typescript
import { useRef, useEffect } from 'react';
import maplibregl from 'maplibre-gl';

// In useEffect:
const map = new maplibregl.Map({
  container: containerRef.current,
  style: {
    version: 8,
    sources: {
      'osm-tiles': {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        attribution: '© Esri',
      },
    },
    layers: [{ id: 'osm', type: 'raster', source: 'osm-tiles' }],
  },
  center: [19.0198, -31.3222],
  zoom: 12,
});

map.on('load', () => {
  // Add GeoJSON source
  map.addSource('fields', { type: 'geojson', data: geojsonData });

  // Fill layer with data-driven color
  map.addLayer({
    id: 'fields-fill',
    type: 'fill',
    source: 'fields',
    paint: {
      'fill-color': ['match', ['get', 'enterprise'],
        'rooibos', '#047857',
        'wine', '#7c3aed',
        'sheep', '#d97706',
        'buchu', '#0d9488',
        'fallow', '#9ca3af',
        '#d1d5db' // default
      ],
      'fill-opacity': 0.4,
    },
  });

  // Outline layer
  map.addLayer({
    id: 'fields-outline',
    type: 'line',
    source: 'fields',
    paint: {
      'line-color': ['match', ['get', 'enterprise'],
        'rooibos', '#065f46',
        'wine', '#5b21b6',
        // ... etc
        '#6b7280'
      ],
      'line-width': 1.5,
    },
  });
});
```

- [ ] **Step 3: Wire FarmMapPage to show the map**

Update `frontend/src/pages/FarmMapPage.tsx` to:
1. Fetch GeoJSON from API on mount
2. Render FarmMap full-screen: `h-[calc(100vh-5rem)] md:h-screen`
3. Track selectedFieldId in state
4. Pass onFieldSelect callback

- [ ] **Step 4: Test the map renders**

Open http://localhost:5173/map — verify:
- Satellite imagery loads
- Field polygons render with enterprise colors
- Green polygons for rooibos fields visible around Nieuwoudtville
- Click a field → selectedFieldId updates (check console)
- Hover shows pointer cursor

- [ ] **Step 5: Commit**

```bash
git add frontend/src/index.css frontend/src/components/map/FarmMap.tsx frontend/src/pages/FarmMapPage.tsx
git commit -m "feat: MapLibre farm map with enterprise-colored field polygons"
```

---

## Task 7: Frontend — Field Detail Panel

**Files:**
- Create: `frontend/src/components/map/FieldPanel.tsx`
- Modify: `frontend/src/pages/FarmMapPage.tsx`

- [ ] **Step 1: Create FieldPanel component**

Create `frontend/src/components/map/FieldPanel.tsx`:

A slide-in panel that shows when a field is selected. Must be:
- **Desktop** (≥ md): fixed right sidebar, 400px wide, full height, border-left, overflow-y-auto
- **Mobile** (< md): slide-up bottom sheet, max 70vh, rounded-t-2xl, drag handle at top

Content:
1. **Header**: field name, enterprise badge (colored), close button
2. **Info grid**: Farm, Code, Area (ha), Planted Year, Status, Irrigation
3. **Production chart**: Recharts BarChart showing 20yr estimated vs actual yield
   - X axis: year, Y axis: kg
   - Two bars: estimated (gray), actual (green/amber)
   - Only show for rooibos fields (where production data exists)
4. **Notes section**: list of field notes with date, title, body
5. **Quick actions**: "Add Note" button, "Create Task" button (placeholder), "View in Wiki" (placeholder)

Props: `{ field: Field | null; onClose: () => void }`

The panel fetches field detail (with production + notes) when field.id changes using `getField(id)`.

- [ ] **Step 2: Integrate into FarmMapPage**

Update FarmMapPage to show FieldPanel alongside the map:
- Desktop: map takes remaining width, panel on right
- Mobile: map full-screen, panel overlays from bottom
- When field selected, fetch full field data, show panel
- When panel closed, deselect field on map

- [ ] **Step 3: Test field selection flow**

Open http://localhost:5173/map:
- Click a rooibos field → panel slides in with field info
- Production chart shows 20yr data (bars for estimated vs actual)
- Click X or outside → panel closes
- On mobile viewport → panel slides up from bottom

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/map/FieldPanel.tsx frontend/src/pages/FarmMapPage.tsx
git commit -m "feat: field detail panel with production history chart"
```

---

## Task 8: Frontend — Map Controls (Farm Zoom + Enterprise Filter + Search)

**Files:**
- Create: `frontend/src/components/map/MapControls.tsx`
- Modify: `frontend/src/pages/FarmMapPage.tsx`
- Modify: `frontend/src/components/map/FarmMap.tsx`

- [ ] **Step 1: Create MapControls component**

Create `frontend/src/components/map/MapControls.tsx`:

Floating controls panel on top-left of map. Contains:
1. **Farm zoom dropdown**: Select farm → map flies to that farm's bounds
   - Options: All Farms, Cloudskraal, Glenridge, Biekoes, Garsland, Meulsteenvlei, Kromvlei
   - On select, compute bounding box of that farm's fields and call `map.fitBounds()`
2. **Enterprise filter**: Checkboxes for each enterprise type
   - All checked by default
   - Unchecking hides those field polygons on the map via layer filter
3. **Field search**: Text input, searches field names
   - On select from dropdown, fly to that field and open detail panel

Styling: white bg, rounded-xl, shadow-lg, px-3 py-2. Semi-transparent on mobile to not obstruct map.

- [ ] **Step 2: Pass map ref and filter state to FarmMap**

Update FarmMap to:
- Expose map instance via ref or callback for fitBounds
- Accept `visibleEnterprises: string[]` and apply as layer filter
- Accept `highlightFieldId: string | null`

Update FarmMapPage to:
- Manage enterprise filter state
- Pass to both MapControls and FarmMap

- [ ] **Step 3: Test controls**

- Farm dropdown: select "Biekoes" → map zooms to Biekoes fields
- Enterprise filter: uncheck "wine" → purple polygons disappear
- Search: type "Bakenkamp" → dropdown shows match → select → map flies to G3

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/map/MapControls.tsx frontend/src/pages/FarmMapPage.tsx frontend/src/components/map/FarmMap.tsx
git commit -m "feat: map controls — farm zoom, enterprise filter, field search"
```

---

## Task 9: Frontend — GIS Layer Overlay Control

**Files:**
- Create: `frontend/src/components/map/LayerControl.tsx`
- Modify: `frontend/src/components/map/FarmMap.tsx`
- Modify: `frontend/src/pages/FarmMapPage.tsx`

- [ ] **Step 1: Create LayerControl component**

Create `frontend/src/components/map/LayerControl.tsx`:

Floating panel on top-right of map (below zoom controls). Expandable — shows a layers icon that expands to show all available GIS layers.

For each layer:
- Toggle switch (on/off)
- Opacity slider (0-100%)
- Category grouping (Soils, Climate, Vegetation, Geology, Boundaries)

On toggle, calls `updateMapLayer(id, { visible })` API to persist preference, and adds/removes the layer from the MapLibre map.

- [ ] **Step 2: Add GIS layer rendering to FarmMap**

Update FarmMap to accept `layers: MapLayer[]` and for each visible layer, add the appropriate source:

For `arcgis_tiles` type:
```typescript
map.addSource(layer.id, {
  type: 'raster',
  tiles: [`${layer.source_url}/tile/{z}/{y}/{x}`],
  tileSize: 256,
});
map.addLayer({
  id: `layer-${layer.id}`,
  type: 'raster',
  source: layer.id,
  paint: { 'raster-opacity': layer.opacity },
}, 'fields-fill'); // Insert below field polygons
```

For `wms` type (ISRIC SoilGrids):
```typescript
map.addSource(layer.id, {
  type: 'raster',
  tiles: [`${layer.source_url}&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=phh2o_0-5cm_mean&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&SRS=EPSG:3857&FORMAT=image/png&TRANSPARENT=true`],
  tileSize: 256,
});
```

- [ ] **Step 3: Test GIS overlays**

- Open map, expand layer control
- Toggle "Soils" → Elsenburg soil layer appears under field polygons
- Adjust opacity slider → layer becomes more/less transparent
- Toggle off → layer removed
- Try "Soil pH" (WMS) → ISRIC data appears

Note: Some layers may not render for Nieuwoudtville area if coverage doesn't extend there. This is expected — the layers are real external services.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/map/LayerControl.tsx frontend/src/components/map/FarmMap.tsx frontend/src/pages/FarmMapPage.tsx
git commit -m "feat: GIS layer control with Elsenburg/NDA/ISRIC overlays"
```

---

## Task 10: Final Polish — Labels, Legend, Field Colors

**Files:**
- Modify: `frontend/src/components/map/FarmMap.tsx`
- Modify: `frontend/src/pages/FarmMapPage.tsx`

- [ ] **Step 1: Add field labels to map**

Add a symbol layer to FarmMap that shows field name + area at appropriate zoom levels:
- Zoom < 13: no labels
- Zoom 13-15: field code only (e.g., "C9")
- Zoom > 15: full name + area (e.g., "Groenvlei\n25.3 ha")

```typescript
map.addLayer({
  id: 'fields-labels',
  type: 'symbol',
  source: 'fields',
  layout: {
    'text-field': ['step', ['zoom'],
      '', // no labels below zoom 13
      13, ['get', 'code'],
      15, ['concat', ['get', 'name'], '\n', ['to-string', ['get', 'area_ha']], ' ha'],
    ],
    'text-size': 11,
    'text-anchor': 'center',
    'text-allow-overlap': false,
  },
  paint: {
    'text-color': '#ffffff',
    'text-halo-color': '#000000',
    'text-halo-width': 1,
  },
});
```

- [ ] **Step 2: Add map legend**

Add a small legend in the bottom-left corner of the map showing enterprise colors:
- Colored square + label for each enterprise that has visible fields
- Collapse to icon on mobile, expand on tap

- [ ] **Step 3: Add farm boundary outlines**

For features classified as `farm_boundary` or with area > 200ha, render as dashed outlines only (no fill):
```typescript
// Add a separate layer for farm boundaries
map.addLayer({
  id: 'farm-boundaries',
  type: 'line',
  source: 'fields',
  filter: ['==', ['get', 'enterprise'], 'farm_boundary'],
  paint: {
    'line-color': '#374151',
    'line-width': 2,
    'line-dasharray': [4, 2],
  },
});
```

- [ ] **Step 4: Final visual test**

Take screenshots at different zoom levels and verify:
- Zoom 10: farm boundaries visible, colored field clusters
- Zoom 13: individual fields with code labels
- Zoom 15+: full names and areas visible
- Legend shows correct enterprise colors
- Meulsteenvlei (Pierre) fields in blue
- Kromvlei fields in orange dashed

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/map/FarmMap.tsx frontend/src/pages/FarmMapPage.tsx
git commit -m "feat: field labels, legend, farm boundary outlines"
```

---

## Summary

| Task | What it builds | Key files |
|------|---------------|-----------|
| 1 | Farm/field database schema | `schema-farms.js` |
| 2 | Seed 128 fields + 20yr production from real data | `seed-farms.js` |
| 3 | REST API for farms, fields, GeoJSON | `routes/farms.js` |
| 4 | MapLibre + types + API client | `farm.ts`, `farms.ts` |
| 5 | Responsive app shell (sidebar + bottom nav) | `AppShell.tsx`, `BottomNav.tsx` |
| 6 | MapLibre map with enterprise-colored polygons | `FarmMap.tsx` |
| 7 | Field detail panel with production chart | `FieldPanel.tsx` |
| 8 | Farm zoom, enterprise filter, field search | `MapControls.tsx` |
| 9 | GIS layer overlays (Elsenburg/NDA/ISRIC) | `LayerControl.tsx` |
| 10 | Labels, legend, farm boundaries | Polish pass |

**After this plan:** The app will have a fully functional farm map with 128 real fields, 20 years of rooibos production data, satellite imagery, enterprise color-coding, and free GIS overlays — all running on the existing Express/SQLite stack with zero cost. The responsive shell will be ready for Calendar (Plan 2) and Wiki (Plan 3) modules to plug in.
