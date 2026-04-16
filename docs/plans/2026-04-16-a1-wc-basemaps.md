# Spec 5f.2 — WC Basemaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four raster basemaps (NGI Aerial 2022, NGI Aerial 2016, NGI Topo 50K, Esri Hillshade Dark) to the existing BasemapSwitcher with a lightweight `sourceType` discriminator + coverage pill UX.

**Architecture:** Pure registry extension. `frontend/src/config/basemaps.ts` gains a `BasemapSourceType` discriminator (metadata only — no runtime branching) and an optional `coverage` UX hint. `BasemapSwitcher.tsx` renders a small corner pill when `coverage` is set. WMTS endpoints are pre-baked as KVP URL templates containing `{z}/{y}/{x}` placeholders that MapLibre substitutes directly — no URL-building helper required. Tests first (registry validation + extended switcher tests), implementation after.

**Tech Stack:** TypeScript 5, React 19, Vitest + @testing-library/react, MapLibre GL, Tailwind, `@phosphor-icons/react`, `motion/react` (Framer Motion fork).

**Spec:** `docs/specs/2026-04-16-spec-5f.2-wc-basemaps.md`

---

## Pre-flight

- [ ] **Step 0.1: Confirm green baseline**

Run from the project root:

```bash
cd /Users/alexnelja/projects/cloudskraal-capex/frontend
npm test -- src/components/map/BasemapSwitcher.test.tsx
npx tsc -b --noEmit
```

Expected: BasemapSwitcher 4 tests pass, no TS errors. If either fails, stop and surface to the user — don't begin work on a red tree.

- [ ] **Step 0.2: Confirm clean git tree**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex
git status --short
git log --oneline -3
```

Expected: clean tree, last commit is `4793f40 docs(spec 5f.2): add candidate hosts per row + MapLibre KVP note`. If tree is dirty or log shows mystery commits, stop — there's a concurrent session.

---

## File structure

| Path | Responsibility | Action |
|---|---|---|
| `frontend/src/config/basemaps.ts` | Static registry of basemap tile sources + helpers (`getBasemap`, `loadBasemapPreference`, `saveBasemapPreference`) | Modify — add `sourceType` + `coverage`, seed existing 7, append 4 new |
| `frontend/src/config/basemaps.test.ts` | Registry-invariant tests (uniqueness, required fields, WMTS placeholder check, fallback) | Create new |
| `frontend/src/components/map/BasemapSwitcher.tsx` | Floating basemap picker control with tile-grid popover | Modify — render coverage pill |
| `frontend/src/components/map/BasemapSwitcher.test.tsx` | Component tests (existing 4) | Extend — add new basemap + pill assertions |
| `docs/handoffs/2026-04-17-a1-wc-basemaps.md` | Live-URL verification results + any dropped endpoints | Create on ship |

**No changes to** `FarmMap.tsx`, backend, or DB — the spec explicitly keeps `sourceType` as metadata so the `bm.primary.url → tiles: [url]` code path is unchanged.

---

## Task 1 — Registry type upgrade

**Files:**
- Create: `frontend/src/config/basemaps.test.ts`
- Modify: `frontend/src/config/basemaps.ts`

- [ ] **Step 1.1: Write the failing registry test**

Create `frontend/src/config/basemaps.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BASEMAPS, DEFAULT_BASEMAP_ID, getBasemap } from './basemaps';

describe('basemap registry', () => {
  it('has no duplicate ids', () => {
    const ids = BASEMAPS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry has non-empty attribution on primary', () => {
    for (const b of BASEMAPS) {
      expect(b.primary.attribution.trim().length).toBeGreaterThan(0);
    }
  });

  it('every entry has a valid sourceType on primary', () => {
    const valid = new Set(['xyz', 'wmts', 'imageserver']);
    for (const b of BASEMAPS) {
      expect(valid.has(b.primary.sourceType)).toBe(true);
    }
  });

  it('every WMTS url contains {z}, {x}, {y} placeholders', () => {
    for (const b of BASEMAPS) {
      if (b.primary.sourceType !== 'wmts') continue;
      expect(b.primary.url).toContain('{z}');
      expect(b.primary.url).toContain('{x}');
      expect(b.primary.url).toContain('{y}');
    }
  });

  it('no url contains unresolved < > placeholder markers', () => {
    // Guards against shipping a URL like `...Layer=<IDENTIFIER_FROM_TASK_2>...`
    // where the implementer forgot the post-verification substitution.
    for (const b of BASEMAPS) {
      expect(b.primary.url).not.toMatch(/[<>]/);
      if (b.overlay) expect(b.overlay.url).not.toMatch(/[<>]/);
    }
  });

  it('getBasemap falls back to default when id is unknown', () => {
    const fallback = getBasemap('not-a-real-id');
    expect(fallback.id).toBe(DEFAULT_BASEMAP_ID);
  });
});
```

- [ ] **Step 1.2: Run test — expect FAIL**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex/frontend
npm test -- src/config/basemaps.test.ts
```

Expected: one or more tests fail with "Object has no property 'sourceType'" or similar TS/runtime error. This is the red state we need.

- [ ] **Step 1.3: Update type definitions in `basemaps.ts`**

In `frontend/src/config/basemaps.ts`, replace the existing `BasemapTileSource` and `BasemapDef` interface block (lines 11-29) with:

```ts
export type BasemapSourceType = 'xyz' | 'wmts' | 'imageserver';

export interface BasemapTileSource {
  url: string;
  attribution: string;
  /**
   * Metadata only in A1 — no runtime branching. A2's Esri MapServer adapter
   * will consume this when it lands.
   */
  sourceType: BasemapSourceType;
  maxzoom?: number;
  tileSize?: number;
}

export interface BasemapDef {
  id: string;
  label: string;
  /** One-line helper shown in the switcher tooltip. */
  description: string;
  /** Primary raster tile source. */
  primary: BasemapTileSource;
  /** Optional overlay raster layered above the primary (for Hybrid labels). */
  overlay?: BasemapTileSource;
  /** Placeholder CSS background for the switcher thumbnail while tiles load. */
  thumbBg: string;
  /** Optional coverage badge shown in BasemapSwitcher; omit to render nothing. */
  coverage?: 'Global' | 'SA' | 'WC';
}
```

- [ ] **Step 1.4: Add `sourceType: 'xyz'` to every existing entry's `primary` and `overlay`**

For each of the seven existing `BASEMAPS` entries (`satellite`, `hybrid`, `streets`, `topographic`, `terrain`, `dark`, `bluemarble`), add `sourceType: 'xyz'` inside `primary: { ... }` alongside `attribution` and `maxzoom`. For `hybrid`, also add it inside `overlay: { ... }`.

Example diff for `satellite`:

```diff
     primary: {
       url: 'https://server.arcgisonline.com/...',
       attribution: '&copy; Esri',
       maxzoom: 19,
+      sourceType: 'xyz',
     },
```

- [ ] **Step 1.5: Run tests — expect PASS**

```bash
npm test -- src/config/basemaps.test.ts
npm test -- src/components/map/BasemapSwitcher.test.tsx
npx tsc -b --noEmit
```

Expected: all 5 new registry tests pass, existing 4 BasemapSwitcher tests still pass, TS clean.

- [ ] **Step 1.6: Commit (intermediate — amended later)**

Don't commit yet. Tasks 2-5 add basemap entries to the same file; they'll land in one commit together. Move to Task 2.

---

## Task 2 — Live-verify NGI WMTS endpoints

**Files:** none modified (research task).

- [ ] **Step 2.1: Fetch NGI WMTS GetCapabilities**

```bash
curl -s --max-time 10 'https://bp-cdngiapollo.dlrrd.gov.za/erdas-iws/ogc/wmts/CDNGI_PORTAL_BACKDROP?Service=WMTS&Request=GetCapabilities' | head -80
```

Expected: XML with `<Layer>` elements. Capture the `<ows:Identifier>` value for each of:
- 25 cm aerial (most recent WC layer — likely named like `Aerial_2022_25cm` or `NGI:CD_2022`)
- 50 cm aerial (likely `Aerial_2016_50cm` or similar)
- 1:50 000 topocadastral (likely `Topo_50k` / `NGI:50K`)

**If the GetCapabilities request times out or returns 4xx:** primary host is dead. Move to Step 2.3 (fallback mirror).

- [ ] **Step 2.2: Sample-tile fetch**

Using the layer identifiers from 2.1, hit one tile to confirm delivery:

```bash
# Pick a tile over Stellenbosch: z=12, x=2330, y=2485 (approximate)
curl -sI --max-time 10 'https://bp-cdngiapollo.dlrrd.gov.za/erdas-iws/ogc/wmts/CDNGI_PORTAL_BACKDROP?Service=WMTS&Request=GetTile&Version=1.0.0&Layer=<IDENTIFIER>&Style=default&TileMatrixSet=GoogleMapsCompatible&TileMatrix=12&TileRow=2485&TileCol=2330&Format=image/jpeg'
```

Expected: `HTTP/2 200` with `Content-Type: image/jpeg` and non-zero `Content-Length`. Save the verified `Layer=<IDENTIFIER>` values in a scratchpad.

Also check CORS:

```bash
curl -sI --max-time 10 -H 'Origin: http://localhost:5173' 'https://bp-cdngiapollo.dlrrd.gov.za/erdas-iws/ogc/wmts/CDNGI_PORTAL_BACKDROP?...'
```

Expected: `access-control-allow-origin: *` or matching origin. If missing, CORS will block the browser — skip to 2.3.

- [ ] **Step 2.3: Fallback to WC Gov mirror (only if primary fails CORS or returns 4xx)**

```bash
curl -s --max-time 10 'https://gis.westerncape.gov.za/hosting/rest/services?f=json' | head -50
```

Document in handoff (Task 9): which basemaps use primary, which use fallback, any dropped entirely. Success criteria allows shipping ≥ 3 of 4.

---

## Task 3 — Add NGI Aerial 2022 entry

**Files:**
- Modify: `frontend/src/config/basemaps.ts`
- Modify: `frontend/src/config/basemaps.test.ts`

- [ ] **Step 3.1: Write failing registry assertion**

Add to `basemaps.test.ts`:

```ts
it('includes ngi-aerial-2022 as a WC WMTS basemap', () => {
  const bm = BASEMAPS.find((b) => b.id === 'ngi-aerial-2022');
  expect(bm).toBeDefined();
  expect(bm!.primary.sourceType).toBe('wmts');
  expect(bm!.coverage).toBe('WC');
});
```

- [ ] **Step 3.2: Run test — expect FAIL**

```bash
npm test -- src/config/basemaps.test.ts
```

Expected: "expected undefined to be defined".

- [ ] **Step 3.3: Append the entry to `BASEMAPS`**

After the `bluemarble` entry in `basemaps.ts`, append:

```ts
  {
    id: 'ngi-aerial-2022',
    label: 'NGI Aerial 2022',
    description: 'NGI 25 cm aerial — Western Cape, 2022',
    coverage: 'WC',
    primary: {
      url:
        'https://bp-cdngiapollo.dlrrd.gov.za/erdas-iws/ogc/wmts/CDNGI_PORTAL_BACKDROP?Service=WMTS&Request=GetTile&Version=1.0.0&Layer=<IDENTIFIER_FROM_TASK_2>&Style=default&TileMatrixSet=GoogleMapsCompatible&TileMatrix={z}&TileRow={y}&TileCol={x}&Format=image/jpeg',
      attribution: '&copy; NGI (DALRRD)',
      sourceType: 'wmts',
      maxzoom: 19,
    },
    thumbBg:
      'linear-gradient(135deg, #3f6f4a 0%, #5a7a3a 40%, #8a7c3f 70%, #a89061 100%)',
  },
```

Replace `<IDENTIFIER_FROM_TASK_2>` with the verified layer name from 2.2. If the fallback host was required, swap the base URL for the WC Gov mirror and its matching tile parameters.

**Substitution gate:** the registry test `'no url contains unresolved < > placeholder markers'` (Task 1.1) will fail until every `<...>` placeholder is replaced — the implementer cannot reach Task 7's green gate while a placeholder remains.

- [ ] **Step 3.4: Run tests — expect PASS**

```bash
npm test -- src/config/basemaps.test.ts
```

Expected: new assertion passes, prior assertions still green.

---

## Task 4 — Add NGI Aerial 2016 entry

**Files:**
- Modify: `frontend/src/config/basemaps.ts`
- Modify: `frontend/src/config/basemaps.test.ts`

- [ ] **Step 4.1: Write failing assertion**

```ts
it('includes ngi-aerial-2016 as an SA WMTS basemap', () => {
  const bm = BASEMAPS.find((b) => b.id === 'ngi-aerial-2016');
  expect(bm).toBeDefined();
  expect(bm!.primary.sourceType).toBe('wmts');
  expect(bm!.coverage).toBe('SA');
});
```

- [ ] **Step 4.2: Run test — expect FAIL, then add entry**

Append to `BASEMAPS`, mirroring the 2022 pattern but with `coverage: 'SA'`, `description: 'NGI 50 cm aerial — South Africa, 2016'`, the 2016 layer identifier from Task 2, and a more neutral `thumbBg` gradient:

```ts
    thumbBg:
      'linear-gradient(135deg, #4a5a3a 0%, #6a6a4a 50%, #8a7a5a 100%)',
```

- [ ] **Step 4.3: Run tests — expect PASS**

```bash
npm test -- src/config/basemaps.test.ts
```

---

## Task 5 — Add NGI Topo 50K entry

**Files:**
- Modify: `frontend/src/config/basemaps.ts`
- Modify: `frontend/src/config/basemaps.test.ts`

- [ ] **Step 5.1: Write failing assertion**

```ts
it('includes ngi-topo-50k as an SA WMTS basemap', () => {
  const bm = BASEMAPS.find((b) => b.id === 'ngi-topo-50k');
  expect(bm).toBeDefined();
  expect(bm!.primary.sourceType).toBe('wmts');
  expect(bm!.coverage).toBe('SA');
});
```

- [ ] **Step 5.2: Add the entry**

```ts
  {
    id: 'ngi-topo-50k',
    label: 'Topo 50K',
    description: 'NGI 1:50 000 topocadastral series',
    coverage: 'SA',
    primary: {
      url:
        'https://bp-cdngiapollo.dlrrd.gov.za/erdas-iws/ogc/wmts/CDNGI_PORTAL_BACKDROP?Service=WMTS&Request=GetTile&Version=1.0.0&Layer=<TOPO50K_IDENTIFIER>&Style=default&TileMatrixSet=GoogleMapsCompatible&TileMatrix={z}&TileRow={y}&TileCol={x}&Format=image/png',
      attribution: '&copy; NGI (DALRRD)',
      sourceType: 'wmts',
      maxzoom: 17,
    },
    thumbBg:
      'linear-gradient(135deg, #e8dfc6 0%, #c7b894 55%, #8a6f3f 100%)',
  },
```

Topo is PNG (not JPEG) — preserves line-art contrast. `maxzoom: 17` reflects the series' native scale.

- [ ] **Step 5.3: Run tests — expect PASS**

---

## Task 6 — Add Esri Hillshade Dark entry

**Files:**
- Modify: `frontend/src/config/basemaps.ts`
- Modify: `frontend/src/config/basemaps.test.ts`

- [ ] **Step 6.1: Write failing assertion**

```ts
it('includes esri-hillshade-dark as an XYZ basemap with Global coverage', () => {
  const bm = BASEMAPS.find((b) => b.id === 'esri-hillshade-dark');
  expect(bm).toBeDefined();
  expect(bm!.primary.sourceType).toBe('xyz');
  expect(bm!.coverage).toBe('Global');
});
```

- [ ] **Step 6.2: Verify endpoint once**

```bash
curl -sI --max-time 10 'https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade_Dark/MapServer/tile/8/120/140'
```

Expected: `HTTP/2 200` + `Content-Type: image/png` (or `image/jpeg`). Esri CDNs are reliable; if this fails, skip the entry and note in handoff.

- [ ] **Step 6.3: Add the entry**

```ts
  {
    id: 'esri-hillshade-dark',
    label: 'Hillshade',
    description: 'Esri World Hillshade Dark — pure relief',
    coverage: 'Global',
    primary: {
      url:
        'https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade_Dark/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; Esri',
      sourceType: 'xyz',
      maxzoom: 16,
    },
    thumbBg:
      'linear-gradient(135deg, #2a2a2a 0%, #4a4a4a 50%, #6a6a6a 100%)',
  },
```

- [ ] **Step 6.4: Run tests — expect PASS**

```bash
npm test -- src/config/basemaps.test.ts
```

---

## Task 7 — Commit basemap additions

- [ ] **Step 7.1: Typecheck + full frontend test suite**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex/frontend
npx tsc -b --noEmit
npm test
```

Expected: all tests pass, no TS errors.

- [ ] **Step 7.2: Commit**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex
git add frontend/src/config/basemaps.ts frontend/src/config/basemaps.test.ts
git commit -m "$(cat <<'EOF'
feat(map): spec 5f.2 — four WC basemaps + sourceType discriminator

Extends BASEMAPS with NGI Aerial 2022 (25cm WC), NGI Aerial 2016 (50cm
SA), NGI Topo 50K, and Esri World Hillshade Dark. Introduces
BasemapSourceType metadata (xyz|wmts|imageserver) and an optional
coverage UX hint. No runtime branching in A1 — sourceType feeds A2's
Esri MapServer adapter when it lands.

Live-URL-verified during implementation. Dropped endpoints (if any)
documented in 2026-04-17 handoff.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

If fewer than four entries actually shipped (dead endpoints), edit the commit body to list the subset that did. Success criterion is ≥ 3 of 4.

---

## Task 8 — Coverage pill UX

**Files:**
- Modify: `frontend/src/components/map/BasemapSwitcher.tsx`
- Modify: `frontend/src/components/map/BasemapSwitcher.test.tsx`

- [ ] **Step 8.1: Write failing test for popover reveal of new basemaps**

Edit `frontend/src/components/map/BasemapSwitcher.test.tsx`. In the existing test `'reveals all basemap tiles when opened'` (currently line 11-25), extend the regex list inside the `for` loop to cover the new entries:

```ts
for (const desc of [
  /esri world imagery/i,
  /road \+ place/i,
  /openstreetmap/i,
  /esri world topo/i,
  /opentopomap/i,
  /carto dark/i,
  /blue marble/i,
  /ngi 25 cm aerial/i,
  /ngi 50 cm aerial/i,
  /topocadastral/i,
  /hillshade dark/i,
]) {
  expect(screen.getByTitle(desc)).toBeInTheDocument();
}
```

**Why the tightened regexes:** `getByTitle` throws when a pattern matches multiple titles. `/hillshade/i` would collide with the existing `'Esri World Topo — contours + hillshade'` description; `/hillshade dark/i` only matches the new entry. Similarly `/esri world topo/i` stays specific to the Topographic entry.

- [ ] **Step 8.2: Write failing test for coverage pill**

Add a new test to `BasemapSwitcher.test.tsx`:

```ts
it('renders a coverage pill for entries that declare coverage', () => {
  render(<BasemapSwitcher current="satellite" onChange={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /basemap/i }));

  // WC entry has a visible pill reading "WC"
  const ngi2022 = screen.getByTitle(/ngi 25 cm aerial/i);
  expect(ngi2022.textContent).toContain('WC');

  // A pre-existing entry without coverage has no pill
  const satellite = screen.getByTitle(/esri world imagery/i);
  expect(satellite.textContent).not.toContain('WC');
  expect(satellite.textContent).not.toContain('SA');
  expect(satellite.textContent).not.toContain('Global');
});
```

- [ ] **Step 8.3: Run tests — expect PASS on reveal, FAIL on pill**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex/frontend
npm test -- src/components/map/BasemapSwitcher.test.tsx
```

Expected outcomes, in this order:
- **Reveal test (Step 8.1) — PASS.** The Task 7 commit already shipped the four new entries, so their descriptions are on the DOM as `title` attributes. This is intentional; don't be alarmed that the reveal test goes green without any pill work.
- **Pill test (Step 8.2) — FAIL.** No `<span>` with coverage text is rendered yet. This is the red state that Step 8.4 fixes.

If the pill test goes green before Step 8.4, stop — something is mis-wired; investigate before proceeding.

- [ ] **Step 8.4: Implement the pill**

In `BasemapSwitcher.tsx`, inside the `BASEMAPS.map((b) => { ... return (<button ...>...</button>) })` block (around lines 62-92), add a pill span before the bottom label block:

```tsx
                  {b.coverage && (
                    <span
                      className="absolute bottom-[22px] right-1 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[9px] font-semibold leading-none"
                      aria-hidden
                    >
                      {b.coverage}
                    </span>
                  )}
```

Place it after the existing `{isCurrent && <span ...>}` check-badge block and before the `<div className="px-2 py-1.5 bg-white/60">` label block. The `bottom-[22px]` keeps it above the label strip; the `right-1` mirrors the check-badge inset.

- [ ] **Step 8.5: Run tests — expect PASS**

```bash
npm test -- src/components/map/BasemapSwitcher.test.tsx
```

Expected: all 6 tests (4 pre-existing + 2 new) green.

- [ ] **Step 8.6: Commit**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex
git add frontend/src/components/map/BasemapSwitcher.tsx frontend/src/components/map/BasemapSwitcher.test.tsx
git commit -m "$(cat <<'EOF'
feat(map): coverage pill on BasemapSwitcher tiles

WC/SA/Global badge rendered bottom-right of each tile when
BasemapDef.coverage is set. Existing entries without coverage render
no pill (preserves the current look for the original seven).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9 — Manual browser smoke + handoff

**Files:**
- Create: `docs/handoffs/2026-04-17-a1-wc-basemaps.md`

- [ ] **Step 9.1: Start dev servers**

In two terminals:

```bash
# Terminal 1 — backend
cd /Users/alexnelja/projects/cloudskraal-capex/backend
lsof -ti:3001 | xargs kill 2>/dev/null; sleep 1
PORT=3001 node src/index.js

# Terminal 2 — frontend + Electron
cd /Users/alexnelja/projects/cloudskraal-capex/frontend
npm run dev
# Then launch the Electron shell (see repo README). Alex prefers full
# Electron over browser-only mode.
```

- [ ] **Step 9.2: Run the smoke checklist**

In the Electron app, navigate to `/map`. Walk through:

- [ ] Basemap button shows current label (e.g. "Satellite").
- [ ] Click opens popover with 10 or 11 tiles (7 pre-existing + whichever of the 4 new entries actually shipped) in a 2-column grid, no overflow/clipping.
- [ ] Click `NGI Aerial 2022` → popover closes, tiles paint ≤ 3s over WC.
- [ ] Click `NGI Aerial 2016` → tiles paint, works nationwide.
- [ ] Click `Topo 50K` → topocadastral sheets render with labels.
- [ ] Click `Hillshade` → dark relief basemap renders globally.
- [ ] Re-open popover → the three NGI tiles show amber `WC` / `SA` pills, Hillshade shows `Global` pill, pre-existing seven show no pill.
- [ ] Reload the app → last-selected basemap restored from `localStorage['capex.basemap']`.
- [ ] Pan map north to Gauteng while on `ngi-aerial-2022` → tiles blank (expected; pill is the warning).
- [ ] Right-click / long-press chooser still works; FAB drop-note still works (regression check).

Tick each box only after verification. If any fail, fix before committing the handoff.

- [ ] **Step 9.3: Write the handoff**

Create `docs/handoffs/2026-04-17-a1-wc-basemaps.md`:

```markdown
# 2026-04-17 — A1 WC basemaps shipped

Sub-spec A1 of the Cape Farm Mapper port. Spec:
`docs/specs/2026-04-16-spec-5f.2-wc-basemaps.md`.

## Commits

| # | Commit | Summary |
|---|---|---|
| 1 | `<sha1>` | feat(map): spec 5f.2 — four WC basemaps + sourceType discriminator |
| 2 | `<sha2>` | feat(map): coverage pill on BasemapSwitcher tiles |

## Live-URL verification

| Basemap | Host used | Verified | Notes |
|---|---|---|---|
| ngi-aerial-2022 | <primary | fallback> | ✓ | |
| ngi-aerial-2016 | <primary | fallback> | ✓ | |
| ngi-topo-50k | <primary | fallback> | ✓ | |
| esri-hillshade-dark | services.arcgisonline.com | ✓ | |

Dropped endpoints: <none | list>.

## Smoke checklist results

<copy the checklist from step 9.2, ticked>

## What's next

- A2 — Esri MapServer adapter + curated WC DOA overlay catalog.
- A3 — SG cadastral FeatureLayer.
```

Fill in the commit SHAs, host used per row, and any dropped endpoints.

- [ ] **Step 9.4: Commit the handoff**

```bash
git add docs/handoffs/2026-04-17-a1-wc-basemaps.md
git commit -m "$(cat <<'EOF'
docs: handoff for spec 5f.2 A1 WC basemaps ship

Live-URL verification results, smoke checklist, and pointers to the
next sub-specs (A2 Esri MapServer adapter, A3 SG cadastral).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 9.5: Final green gate**

```bash
cd /Users/alexnelja/projects/cloudskraal-capex/frontend
npx tsc -b --noEmit
npm test
npm run build
```

Expected: all green. If the build step surfaces unused-import or missing-dep warnings around the new entries, fix and amend into the nearest relevant commit.

---

## Commit count check

Final `git log --oneline` should show at most 3 A1 commits (target from spec success criteria). If there are more (e.g. hotfix commits), squash down via interactive rebase BEFORE pushing — but only with user confirmation per workspace rules.

## Done when

- [ ] 5 new registry tests + 2 new BasemapSwitcher tests green.
- [ ] At least 3 of 4 new basemaps render tiles in the Electron app.
- [ ] Coverage pills render on NGI basemaps, absent on pre-existing seven.
- [ ] Reload preserves selection.
- [ ] Handoff committed with verification results.
- [ ] `git log` shows ≤ 3 focused A1 commits.
