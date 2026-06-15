# Calculators visual layer — design

**Date:** 2026-06-15
**Status:** Approved (brainstorm) — pending spec review
**Branch:** `feat/calculators-visual` (off `main`)

## Problem

The Calculators page (`frontend/src/pages/CalculatorsPage.tsx`, Spec 6b) renders
six field calculators as: tile grid → schema-driven form → a text result card
(key/value `dl` + mono formula breakdown + amber sanity warnings). It is correct
but entirely numeric. Alex wants each calculator to also communicate its result
**visually**, while keeping the clean/simple aesthetic.

The six calculators (backend engines in `backend/src/services/calculators/`):

| Calc | Primary result | Existing sanity threshold |
|------|----------------|---------------------------|
| sprayer | `application_rate_l_ha` | typical 50–600 L/ha |
| fertilizer | `product_kg_ha` | >1000 kg/ha unusual |
| lime | `t_ha` | >8 t/ha split-application limit |
| electrical (pump) | `kw_required` → `recommended_motor_kw` | motor ladder; >132 kW industrial |
| fluid (pipe) | `velocity` (m/s), `head_loss` | >2 m/s water-hammer; >5 m/100 m undersized |
| pest | total chemical (g/ml) + cost | none (label-dependent) |

## Decisions (from brainstorm)

1. **Visual language:** an **envelope gauge** (B) as the consistent backbone for
   all calculators that have a natural safe range; plus a **schematic** (A) for
   the three where a picture genuinely helps — **sprayer, pipe, pump**.
2. **Pest dose** has no universal envelope → it gets a **tank/mix composition**
   graphic (chemical vs water in the spray tank, + total dose + cost) instead of
   a gauge.
3. **Envelope source = frontend config.** The hard warning thresholds already
   live and fire in the engines. The gauge's *display* range (min, the green
   "typical" sub-band, the red threshold line) is partly presentational, so it is
   declared per calculator in `frontend/src/config/calculators.ts`. **No backend,
   API, or engine/test changes.** The backend warnings remain the authority for
   the hard limits and continue to render below the visual.
4. The visual **augments**, never replaces: the existing text results, mono
   breakdown, and amber warnings all stay.

## Architecture

All work is frontend-only, additive, no new dependencies (inline SVG; recharts
is available but not required for v1).

### Config (`frontend/src/config/calculators.ts`)

Each `CalcDef` gains an optional `visual` field:

```ts
type GaugeSpec = {
  resultKey: string;     // which entry in result{} to plot (must exist in `results`)
  min: number;
  max: number;
  goodMin?: number;      // green "typical" band start (defaults to min)
  goodMax?: number;      // green "typical" band end (defaults to max)
  threshold?: number;    // red warning line (e.g. 8 t/ha, 2 m/s)
  unit?: string;
  ticks?: { value: number; label: string }[]; // discrete ladder (pump motors)
};

type VisualSpec =
  | { kind: 'gauge'; gauge: GaugeSpec }
  | { kind: 'gauge+schematic'; gauge: GaugeSpec; schematic: 'sprayer' | 'pipe' | 'pump' }
  | { kind: 'tankmix' };   // pest
```

Per-calculator mapping:

- **sprayer** — `gauge+schematic` (`sprayer`); gauge on `application_rate_l_ha`,
  min 0, max 600, good 100–400, threshold 600.
- **fertilizer** — `gauge`; on `product_kg_ha`, min 0, max 1000, good 0–800,
  threshold 1000.
- **lime** — `gauge`; on `t_ha`, min 0, max 10, good 0–8, threshold 8.
- **electrical** — `gauge+schematic` (`pump`); gauge on `kw_required` with
  `ticks` for the standard motor ladder (5.5, 7.5, 11, 15, 22, 30, 37, 45, 55,
  75, 90, 110, 132), highlighting `recommended_motor_kw`.
- **fluid** — `gauge+schematic` (`pipe`); gauge on `velocity`, min 0, max 3,
  good 0–2, threshold 2.
- **pest** — `tankmix`.

### Components (`frontend/src/components/calculators/`)

- **`EnvelopeGauge.tsx`** — the backbone. Props: `value`, `GaugeSpec`. Renders a
  horizontal SVG track: full range light, green "good" band, optional red
  threshold marker, and a value pin. Two modes: continuous (band) and `ticks`
  (discrete ladder for the pump). Pure/presentational; uses Material design
  tokens (`--md-sys-color-*`) consistent with the rest of the app.
- **`TankMix.tsx`** — pest: a tank-fill graphic showing chemical vs water
  proportion, total dose, and cost. Inputs derived from the pest result + the
  entered spray volume.
- **`SprayerSchematic.tsx`**, **`PipeSchematic.tsx`**, **`PumpSchematic.tsx`** —
  small SVG illustrations, lightly data-driven (label the computed value; e.g.
  pipe shows diameter/velocity, pump shows head/flow/kW). Static layout, dynamic
  labels — not simulations.
- **`CalcVisual.tsx`** — dispatcher. Given the active `CalcDef` and the
  `CalcResponse.result`, reads `visual` and renders the right combination.
  Renders nothing if `visual` is absent or the target value is null (graceful).

### Rendering

In `CalculatorsPage.tsx`, render `<CalcVisual calc={calc} result={response.result} />`
inside the existing result card, **above** the current `dl`. The breakdown and
warnings stay below, unchanged.

## Data flow

Unchanged compute path: form → `computeCalculator(type, inputs)` → `CalcResponse`
`{ result, breakdown, warnings }`. The visual layer is a pure function of
`calc.visual` (static) + `response.result` (already fetched). No new requests.

## Error / edge handling

- Missing/null target value → `CalcVisual` renders nothing for that piece (the
  text card still shows `—`).
- Value below `min` or above `max` → pin clamps to the track ends; an over-`max`
  or over-`threshold` value renders in the red/amber zone so it reads as "off the
  chart" rather than overflowing.
- A calc with no `visual` spec → no visual (forward-compatible if calcs are added).

## Testing (TDD, frontend vitest + RTL)

- **`EnvelopeGauge`**: marker position math across the range; clamping below min /
  above max; zone classification (in-good vs edge vs over-threshold); `ticks`
  mode highlights the recommended tick.
- **`TankMix`**: chemical/water proportions and labels render from a result.
- **Config integrity test**: every calculator has a `visual` spec; every gauge
  `resultKey` exists in that calculator's `results[]`; gauge `min < max` and any
  `threshold`/`goodMin`/`goodMax` fall within `[min, max]`.
- **`CalcVisual`**: dispatches to the right component per `kind`; renders nothing
  on null value / missing spec.

## Scope guard / non-goals

- No backend, API, engine, or backend-test changes.
- No new dependencies.
- Not a sensitivity/what-if chart (direction C) — deferred; could be added later
  per-calc without disturbing this structure.
- Schematics are illustrative with live labels, not physical simulations.

## Files

New:
- `frontend/src/components/calculators/EnvelopeGauge.tsx`
- `frontend/src/components/calculators/TankMix.tsx`
- `frontend/src/components/calculators/SprayerSchematic.tsx`
- `frontend/src/components/calculators/PipeSchematic.tsx`
- `frontend/src/components/calculators/PumpSchematic.tsx`
- `frontend/src/components/calculators/CalcVisual.tsx`
- `frontend/src/components/calculators/*.test.tsx` (gauge, tankmix, dispatcher)
- `frontend/src/config/calculators.visual.test.ts` (config integrity)

Modified:
- `frontend/src/config/calculators.ts` (add `visual` to each `CalcDef` + types)
- `frontend/src/pages/CalculatorsPage.tsx` (render `<CalcVisual>` in the result card)
