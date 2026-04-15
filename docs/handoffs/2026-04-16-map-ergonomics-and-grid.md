# 2026-04-16 — map ergonomics + design-grid pass

Short session. Shipped the trackpad-ergonomic alternatives to right-click,
plus a consistency pass on the map overlay grid and native controls.

## What shipped (6 commits)

| # | Commit | Summary |
|---|---|---|
| 1 | `54c87bd` | `style(map): consolidate glass design into CSS custom-property tokens` — :root tokens for --glass-*, --accent-*, --overlay-*, --ctrl-*. All glass classes + MapLibre overrides + terradraw now token-driven. |
| 2 | `895ebbd` | `feat(map): introduce MapOverlayRail for unified corner positioning` — `<MapOverlayRail position="tl\|tr\|bl\|br">` + new `.map-rail` CSS; FarmMapPage rewired (TR = MapControls + LayerControl + Annotations pill stacked; BL = legend). 4 tests. |
| 3 | `359ab86` | `feat(hooks): useLongPress hook with cancel-on-movement` — 500ms default, 4px move threshold, onProgress callback for affordance. 7 tests. |
| 4 | `db2ba62` | `feat(map): FAB Drop-note mode with crosshair arming` — Drop-map-note action in QuickAddFAB → /map?armNote=1 → crosshair + banner + click drops + Esc cancels. FAB migrated lucide→phosphor. 3 tests. |
| 5 | `184393b` | `feat(map): long-press to open drop-pin chooser` — wires the hook, synthesizes a MapContextMenuEvent via unproject + queryRenderedFeatures, pulsing amber ring (`.longpress-ring`) during the hold. |
| 6 | `a9d52e9` | `style(map): phosphor migration + token-drive FluidSheet/FluidDialog` — all map-folder lucide imports gone; Fluid primitives consume --glass-bg / --glass-blur / --glass-border. |

## Three ways to drop a map note, ranked by ergonomics

1. **Long-press anywhere on the map** (trackpad-natural) — 500ms hold, pulsing ring, opens the same chooser (Create task here / Drop map note).
2. **FAB → "Drop map note"** (discoverable, keyboard-accessible) — works from any page; arms the map with crosshair cursor + banner; next click drops; Esc cancels.
3. **Right-click** — still works, unchanged.

Long-press is disabled while armed-drop is active so the two paths don't stack.

## Design tokens (`frontend/src/index.css` :root)

```
--glass-bg / --glass-bg-strong / --glass-bg-soft
--glass-border / --glass-border-hairline
--glass-blur / --glass-blur-sm
--glass-shadow / --glass-shadow-sm / --glass-shadow-ctrl
--accent-500 / --accent-50 / --accent-focus-ring
--overlay-inset (12px) / --overlay-gap (8px)
--overlay-radius (14px) / --overlay-radius-sm (10px)
--ctrl-size (32px) / --ctrl-ease
```

All overlay consumers reference these. If you need to tune the look,
change the token — don't duplicate the literal.

## Overlay rail layout (`.map-rail--{tl,tr,bl,br}`)

```
TL  terradraw toolbar (owned by MapLibre control API)
TR  MapControls → LayerControl → Annotations pill (stacked, flex-column, gap-2)
BL  Enterprise legend (mobile-collapsible)
BR  QuickAddFAB (in AppShell; not inside a rail because it's global)
```

`.map-rail` is `pointer-events:none`; children are `pointer-events:auto` so
clicks between overlays pass through to the map underneath.

## State check (run this first next session)

```bash
cd /Users/alexnelja/projects/cloudskraal-capex

# Clean tree
git status --short
git log --oneline -8

# Backend: 154 tests
cd backend
lsof -ti:3001 | xargs kill 2>/dev/null; sleep 1
PORT=3001 node src/index.js > /tmp/ck.log 2>&1 &
sleep 6
npx vitest run
lsof -ti:3001 | xargs kill 2>/dev/null

# Frontend: 54 tests
cd ../frontend
npx tsc -b --noEmit
npm test
npm run build
```

Expected: last commit is the phosphor/fluid-token one (`a9d52e9`), tests all green.

## Manual smoke — REQUIRED before calling this done

Alex flagged that last session shipped six specs without browser confirmation.
Don't repeat that. Before any next spec:

1. `cd frontend && npm run dev` + `cd backend && PORT=3001 node src/index.js`
2. Open `/map`.
3. **Long-press on empty map area** (hold trackpad ~500ms) → pulsing amber ring grows → chooser opens with "Create task at this location" + "Drop map note".
4. **Long-press over a field** → chooser shows "Create task for <field>".
5. **Drag on the map** → NO ring, NO chooser (pan should cancel the press).
6. **Open FAB → "Drop map note"** from /dashboard or anywhere → lands on /map with crosshair cursor + top-center banner.
7. **Click anywhere on the map while armed** → map_note pin drops, sidebar opens, wiki appended.
8. **Esc while armed** → cursor returns to default, banner dismissed, no pin dropped.
9. **Right-click still works** — opens the same chooser.
10. **Rail layout check at widths 390 / 768 / 1280 / 1920**:
    - TR stack doesn't overflow
    - BL legend mobile-collapsed state toggles cleanly
    - MapControls on mobile doesn't collide with anything
    - Terradraw toolbar (TL) still paints as glass + matches native zoom (if visible) visually
11. **Kill pin & navigate away while armed** — armed state must reset on unmount.

## What's still benched (carryover from 2026-04-15)

Unchanged from that handoff:
- 5d/e/f/g/h/i/j, 5a.2, 5b.2/3, 5c.2, 5i.1
- 3.2 task templates
- 4.1 lifecycle, 4.2 slash-commands + cross-tab sync
- 1b, 2c-h, 6, 7*, 8*

## Known pitfalls to respect

- **Long-press events bubble through React synthetics on the wrapping div**, not on MapLibre's canvas directly. If you add a new overlay between the outer div and FarmMap, make sure pointer events still reach the long-press handlers.
- **`openChooserAt` uses `mapRef.current.unproject`** — assumes the map is mounted. The hook only fires after the pointer has been held 500ms, so the map is essentially always ready by then, but keep the `if (!map) return` guard.
- **The armed-drop cursor override** is set via `FarmMap.cursor` prop on the container div. If MapLibre overrides that during a drag, the crosshair may flicker. Not observed yet; flag if it surfaces.
- **Phosphor aliases**: lucide→phosphor uses `import { Drop as Droplets, ... } from '@phosphor-icons/react'`. Call sites keep the lucide names. If you see a "Droplets is not exported" error, grep for a missing alias.
