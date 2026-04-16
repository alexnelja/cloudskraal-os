# Spec 5l — Fields tree sidebar (L5)

- **Status:** Approved for planning (2026-04-16, Spec B of the current cycle).
- **Parent:** Supersedes the current `MapControls` filter panel on `/map`. Consumes the existing `fields` API.
- **Reference:** Alex's image 9 — left-sidebar tree grouping fields by enterprise/usage with per-group totals + per-field details + an Add button.

## Problem

Today `/map` shows field polygons on the basemap but provides no at-a-glance breakdown of what's planted where. The operator has to hover each polygon to learn its area/enterprise, and there's no total hectarage anywhere in the UI. The current TR `MapControls` panel mixes "who/what am I looking at?" (farm + enterprise filter) with "how am I looking?" (coming in Spec 5k — measure, basemap, layers, annotations). Those concerns split cleanly into a left-side information panel and a right-side tool rail.

## Goal

Introduce a left-side `/map` sidebar that lists fields grouped by enterprise, shows per-group + overall totals, folds farm/enterprise/search filtering into the same surface, and supports click-to-zoom on the map. Shrink the TR rail to tool-rail concerns only.

## In scope

- New `FieldsSidebar` component — glass-surface, left-anchored, collapsible.
- Header: total hectarage (e.g. "1,247 ha · 42 fields") + `+ Add field` button.
- Search input (text filter over `name`, `code`, `farm_name`).
- Farm selector (native `<select>` with glass-input polish, same as the current `MapControls` control).
- Body: fields grouped by `enterprise` with collapsible `<details>`-style rows. Each group header shows icon + label + `(ha · count)` + colour-coded left-border accent.
- Row: field name + individual ha, colour-dot matching enterprise.
- Click a field row → map zooms and selects that field (existing `onFieldSelect` pathway).
- Click a group header → expand/collapse; state persists across sessions via localStorage.
- Click a group's trailing eye icon → toggle visibility of that enterprise on the map (replaces the current enterprise pill chips; the pill-chip design from Spec 5k is dropped since this sidebar does the job).
- Mobile: sidebar becomes a `FluidSheet` overlay (reuses existing primitive) toggled by a hamburger icon.
- TR `MapControls` component is removed; farm selector + search + enterprise visibility move into the sidebar.

## Out of scope (deferred)

| Ref | What | Why deferred |
|---|---|---|
| — | L4 standalone `/fields` page + CSV export | Not needed now per your decision; revisit if reporting becomes a real workflow. |
| — | Sort / re-group (by farm, status, planted year) | Default enterprise grouping covers the stated use case. |
| — | Drag-to-resize sidebar | Fixed width is fine; revisit only if feedback demands it. |
| — | Inline field edit | The sidebar navigates; the existing `FieldPanel` handles edit. |
| Spec 8 | Weather forecast modal | Benched. |

## Design decisions (locked)

**Position:** left edge of `/map`, `fixed top-0 bottom-0 left-0`. Width `w-72` desktop (288px), `w-[85vw]` mobile inside `FluidSheet`.

**Visual language:** same glass tokens as Spec 5k's TR rail (`--glass-bg`, `--glass-border-hairline`, `--glass-blur`, `--glass-shadow`, `--overlay-radius`). Border-radius `rounded-r-2xl` (only right side rounded since left edge is flush with viewport).

**Group affordance:** coloured left-border accent + matching text colour for header. Colours come from `ENTERPRISE_COLORS`. Enterprises without fields get hidden from the tree.

**Default state:**
- Top three enterprises by `area_ha` expanded; rest collapsed.
- Farm selector defaults to "All Farms".
- Search empty.
- Expansion + enterprise visibility persist to `localStorage['capex.fields-sidebar']`.

**Enterprise visibility toggle:** each group header has a trailing eye icon (`Eye` / `EyeSlash` from Phosphor). Toggling hides/shows all fields of that enterprise on the map. Replaces the pill-chip design from Spec 5k draft — the sidebar already has the real estate.

**Aggregate totals:** computed client-side from the loaded `fields` array. No backend aggregation endpoint needed for Cloudskraal's ~50 fields; revisit if a farm grows past ~500.

## Component shape

`frontend/src/components/map/FieldsSidebar.tsx` (new):

```tsx
interface FieldsSidebarProps {
  farms: Farm[];
  fields: Field[];
  enterprises: string[];
  visibleEnterprises: string[];
  selectedFieldId: string | null;
  onEnterpriseToggle: (enterprise: string) => void;
  onFarmSelect: (farmCode: string | null) => void;
  onFieldSelect: (fieldId: string) => void;
  onAddField: () => void;
}
```

Renders (desktop):

```
┌────────────────────────────┐
│ Fields            [+ Add]  │  ← header, glass-panel
├────────────────────────────┤
│ 1,247 ha · 42 fields       │  ← aggregate strip
├────────────────────────────┤
│ [Search…]                  │  ← glass-input
│ [Cloudskraal       ▾]      │  ← farm selector, glass-input
├────────────────────────────┤
│ 🌿 Rooibos  420 ha · 18  👁 │  ← group header, accent border
│   Blok 1              42 ha │
│   Blok 2              38 ha │
│   … 16 more                 │
│ 🍷 Wine     380 ha · 12  👁 │
│ 🐑 Sheep    260 ha · 8   👁 │
│ 🌱 Buchu    187 ha · 4   👁 │
│ ○ Fallow     62 ha · 3   👁 │
└────────────────────────────┘
```

Body scrolls independently of the header.

## Map area reflow

The map element needs `padding-left: 288px` (desktop) / `0` (mobile) so the sidebar doesn't cover polygons. `FarmMapPage.tsx` wraps the map in a flex container: sidebar + map viewport.

`MapControls` is deleted from the TR rail. `MapOverlayRail position="tr"` retains: measure toolbar, basemap pill, layers control, annotations pill — all Spec 5k concerns.

The existing enterprise-visibility state + `farmZoom` logic in `FarmMapPage.tsx` moves unchanged; only the UI surface changes.

## Tests (TDD, tests first)

1. **`FieldsSidebar.test.tsx` (new)**
   - Renders aggregate "1,247 ha · 42 fields" given a mock field list.
   - Renders one group per enterprise present in the fields array; hides enterprises with zero fields.
   - Group header shows per-enterprise total + count.
   - Search input filters visible fields (match on `name`, `code`, `farm_name`, case-insensitive).
   - Farm selector narrows the visible set; "All Farms" resets.
   - Clicking a field row calls `onFieldSelect` with the field id.
   - Clicking the eye icon calls `onEnterpriseToggle` with the enterprise key.
   - Collapsed groups hide their rows; expand state persists to localStorage.
2. **`FarmMapPage.test.tsx` (extend existing)**
   - Sidebar renders in place of the old TR filter panel.
   - Map container respects `padding-left: 288px` at desktop width; `0` at mobile.
3. **Manual smoke (required):**
   - Sidebar shows all enterprises with correct totals.
   - Clicking a field row zooms the map and highlights the polygon.
   - Toggling an enterprise's eye hides/shows its polygons.
   - Reload preserves expanded groups + visibility toggles.
   - Mobile (390px): hamburger icon opens the sidebar as a full-height sheet; backdrop dismisses.

## Risks

- **Viewport width.** With TR rail + left sidebar both flush, the visible map at 1280px gets ~900px of usable width. Acceptable for farm-scale zoom; if too tight, collapse the TR rail to a 48px icon strip when the viewport is < 1440px.
- **Large field sets.** If a farm has 500+ fields, rendering every row is fine (React 19 handles it) but scroll performance could hitch. Defer virtualisation until observed.
- **State migration.** The current `MapControls` holds `visibleEnterprises` state in `FarmMapPage`. Moving the UI without moving the state keeps behaviour identical; just verify the prop-drilling survives.
- **Mobile overlap.** The FluidSheet pattern is already used by `FieldPanel` + `AnnotationsSidebar`. Stack order needs verifying so two sheets don't fight.

## Files changed

| File | Change |
|---|---|
| `frontend/src/components/map/FieldsSidebar.tsx` (new) | The sidebar. |
| `frontend/src/components/map/FieldsSidebar.test.tsx` (new) | Unit tests. |
| `frontend/src/components/map/MapControls.tsx` | **Deleted** — superseded by the sidebar. |
| `frontend/src/components/map/MapControls.test.tsx` | **Deleted**. |
| `frontend/src/pages/FarmMapPage.tsx` | Render `FieldsSidebar` in a flex wrapper; pad the map; remove `MapControls` import + JSX. |
| `frontend/src/pages/FarmMapPage.test.tsx` (if exists) | Adjust the filter assertions. |
| `frontend/src/index.css` | Add `.fields-sidebar` spacing tokens if needed. |
| `docs/handoffs/2026-04-17-spec-5l-fields-sidebar.md` (new on ship) | Smoke results. |

No backend changes. No DB migration.

## Success criteria

- Left sidebar renders on `/map` with grouped fields + totals.
- `MapControls` component + test are removed from the codebase.
- All automated tests green (backend + frontend).
- Manual smoke passes at 390 / 1280 / 1920 viewports.
- `git log` for 5l work is ≤ 3 focused commits.
