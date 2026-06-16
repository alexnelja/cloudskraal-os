# Calculators Visual Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a visual representation to each of the six field calculators — an envelope gauge backbone (5 calcs), schematics for sprayer/pipe/pump, and a tank-mix graphic for pest — augmenting (not replacing) the existing text result card.

**Architecture:** Frontend-only, additive. Each calculator declares a `visual` spec in `config/calculators.ts`. A `CalcVisual` dispatcher reads that spec plus the already-fetched `CalcResponse.result` and renders the right combination of pure presentational SVG components. No backend, API, engine, or backend-test changes. No new dependencies (inline SVG; recharts not required).

**Tech Stack:** React 19 + Vite + TypeScript, Material design tokens (`--md-sys-color-*`), inline SVG, Phosphor icons. Tests: vitest + @testing-library/react (jsdom), run from `frontend/`.

**Spec:** `docs/superpowers/specs/2026-06-15-calculators-visual-layer-design.md`
**Branch:** `feat/calculators-visual` (already created off `main`)

---

## Conventions (read once)

- All commands run from `/Users/alexnelja/projects/cloudskraal-capex/frontend`.
- Run a single test file: `npx vitest run src/path/to/file.test.tsx`
- Verified result keys (from engines + `config/calculators.ts`): sprayer `application_l_ha`; fertilizer `product_kg_ha`; lime `lime_t_ha`; electrical `kw_required` + `recommended_motor_kw`; fluid `velocity_m_s` (+ `head_loss_m`, `head_loss_m_per_100m`); pest `total_chemical`, `unit` ('g'|'ml'), `total_water_l` (nullable), `total_cost_zar`.
- `CalcResponse` shape (from `src/api/calculators.ts`): `{ result: Record<string, number | string | null>, breakdown?: string, warnings: string[], error?: string }`.
- Styling: match `CalculatorsPage.tsx` (stone/emerald Tailwind classes already used there; `text-emerald-700`, `border-stone-200`, `rounded-2xl`). Use the same palette so the visuals feel native.

## File Structure

New (`frontend/src/components/calculators/`):
- `gaugeMath.ts` — pure helpers (`markerPercent`, `classifyZone`). Isolated so the math is unit-tested without rendering.
- `EnvelopeGauge.tsx` — gauge component (continuous band + discrete `ticks` mode).
- `TankMix.tsx` — pest graphic (per-100L water-fill vs per-ha dose-only).
- `SprayerSchematic.tsx`, `PipeSchematic.tsx`, `PumpSchematic.tsx` — labelled SVG illustrations.
- `CalcVisual.tsx` — dispatcher.
- Tests: `gaugeMath.test.ts`, `EnvelopeGauge.test.tsx`, `TankMix.test.tsx`, `CalcVisual.test.tsx`.
- `frontend/src/config/calculators.visual.test.ts` — config integrity.

Modified:
- `frontend/src/config/calculators.ts` — add `VisualSpec` types + `visual` on each `CalcDef`, and export the pump `MOTOR_LADDER`.
- `frontend/src/pages/CalculatorsPage.tsx` — render `<CalcVisual>` in the result card.

---

## Task 1: Visual config types, specs, and integrity test

**Files:**
- Modify: `frontend/src/config/calculators.ts`
- Test: `frontend/src/config/calculators.visual.test.ts`

- [ ] **Step 1: Write the failing integrity test**

```ts
// frontend/src/config/calculators.visual.test.ts
import { describe, it, expect } from 'vitest';
import { CALCULATORS, MOTOR_LADDER } from './calculators';

describe('calculator visual specs', () => {
  it('every calculator has a visual spec', () => {
    for (const c of CALCULATORS) {
      expect(c.visual, `${c.type} missing visual`).toBeDefined();
    }
  });

  it('every gauge resultKey exists in that calculator results[]', () => {
    for (const c of CALCULATORS) {
      const v = c.visual!;
      if (v.kind === 'gauge' || v.kind === 'gauge+schematic') {
        const keys = c.results.map((r) => r.key);
        expect(keys, `${c.type} gauge key`).toContain(v.gauge.resultKey);
      }
    }
  });

  it('gauge ranges are well-formed (min < max; bands/threshold within range)', () => {
    for (const c of CALCULATORS) {
      const v = c.visual!;
      if (v.kind === 'gauge' || v.kind === 'gauge+schematic') {
        const g = v.gauge;
        expect(g.min).toBeLessThan(g.max);
        for (const n of [g.goodMin, g.goodMax, g.threshold]) {
          if (n != null) {
            expect(n).toBeGreaterThanOrEqual(g.min);
            expect(n).toBeLessThanOrEqual(g.max);
          }
        }
      }
    }
  });

  it('pump ticks are members of the engine motor ladder and fit the range', () => {
    const pump = CALCULATORS.find((c) => c.type === 'electrical')!;
    const v = pump.visual!;
    if (v.kind !== 'gauge+schematic') throw new Error('pump should be gauge+schematic');
    for (const t of v.gauge.ticks ?? []) {
      expect(MOTOR_LADDER, `tick ${t.value}`).toContain(t.value);
      expect(t.value).toBeGreaterThanOrEqual(v.gauge.min);
      expect(t.value).toBeLessThanOrEqual(v.gauge.max);
    }
  });
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `npx vitest run src/config/calculators.visual.test.ts`
Expected: FAIL (`MOTOR_LADDER` not exported / `visual` undefined).

- [ ] **Step 3: Add types + MOTOR_LADDER + visual specs to `calculators.ts`**

Add near the top (after `CalcResultRow`):

```ts
export interface GaugeSpec {
  resultKey: string;
  min: number;
  max: number;
  goodMin?: number;
  goodMax?: number;
  threshold?: number;
  unit?: string;
  ticks?: { value: number; label: string }[];
}

export type VisualSpec =
  | { kind: 'gauge'; gauge: GaugeSpec }
  | { kind: 'gauge+schematic'; gauge: GaugeSpec; schematic: 'sprayer' | 'pipe' | 'pump' }
  | { kind: 'tankmix' };

// Standard IEC motor ladder — mirrors backend electrical.js. The pump gauge
// ticks must be a subset of this so every recommendation lands on a real tick.
export const MOTOR_LADDER = [
  0.37, 0.55, 0.75, 1.1, 1.5, 2.2, 3, 4, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55, 75, 90, 110, 132,
] as const;
```

Add `visual?: VisualSpec;` to the `CalcDef` interface.

Then add a `visual` field to each calculator object:

- sprayer:
```ts
visual: {
  kind: 'gauge+schematic',
  schematic: 'sprayer',
  gauge: { resultKey: 'application_l_ha', min: 0, max: 600, goodMin: 100, goodMax: 400, threshold: 600, unit: 'L/ha' },
},
```
- pest: `visual: { kind: 'tankmix' },`
- fertilizer:
```ts
visual: { kind: 'gauge', gauge: { resultKey: 'product_kg_ha', min: 0, max: 1000, goodMin: 0, goodMax: 800, threshold: 1000, unit: 'kg/ha' } },
```
- lime:
```ts
visual: { kind: 'gauge', gauge: { resultKey: 'lime_t_ha', min: 0, max: 10, goodMin: 0, goodMax: 8, threshold: 8, unit: 't/ha' } },
```
- electrical (ticks = a readable subset of the ladder spanning typical farm pumps; all members of MOTOR_LADDER):
```ts
visual: {
  kind: 'gauge+schematic',
  schematic: 'pump',
  gauge: {
    resultKey: 'kw_required', min: 0, max: 132, unit: 'kW',
    ticks: [
      { value: 1.1, label: '1.1' }, { value: 2.2, label: '2.2' }, { value: 4, label: '4' },
      { value: 7.5, label: '7.5' }, { value: 11, label: '11' }, { value: 22, label: '22' },
      { value: 45, label: '45' }, { value: 90, label: '90' }, { value: 132, label: '132' },
    ],
  },
},
```
- fluid:
```ts
visual: { kind: 'gauge+schematic', schematic: 'pipe', gauge: { resultKey: 'velocity_m_s', min: 0, max: 3, goodMin: 0, goodMax: 2, threshold: 2, unit: 'm/s' } },
```

- [ ] **Step 4: Run the test — verify it passes**

Run: `npx vitest run src/config/calculators.visual.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/config/calculators.ts src/config/calculators.visual.test.ts
git commit -m "feat(calculators): visual config specs + integrity test"
```

---

## Task 2: gaugeMath helpers

**Files:**
- Create: `frontend/src/components/calculators/gaugeMath.ts`
- Test: `frontend/src/components/calculators/gaugeMath.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { markerPercent, classifyZone } from './gaugeMath';

describe('markerPercent', () => {
  it('maps value to 0–100% of the range', () => {
    expect(markerPercent(0, 0, 600)).toBe(0);
    expect(markerPercent(300, 0, 600)).toBe(50);
    expect(markerPercent(600, 0, 600)).toBe(100);
  });
  it('clamps below min and above max', () => {
    expect(markerPercent(-50, 0, 600)).toBe(0);
    expect(markerPercent(900, 0, 600)).toBe(100);
  });
});

describe('classifyZone', () => {
  const g = { min: 0, max: 10, goodMin: 0, goodMax: 8, threshold: 8 };
  it('over when value exceeds threshold', () => {
    expect(classifyZone(9, g)).toBe('over');
  });
  it('good when within good band', () => {
    expect(classifyZone(3, g)).toBe('good');
  });
  it('edge when outside good band but not over threshold', () => {
    expect(classifyZone(8.0, { ...g, goodMax: 6, threshold: 9 })).toBe('edge');
  });
  it('good by default when no bands defined', () => {
    expect(classifyZone(5, { min: 0, max: 10 })).toBe('good');
  });
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `npx vitest run src/components/calculators/gaugeMath.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// gaugeMath.ts
export function markerPercent(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  const pct = ((value - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, pct));
}

type ZoneSpec = { min: number; max: number; goodMin?: number; goodMax?: number; threshold?: number };

export function classifyZone(value: number, g: ZoneSpec): 'good' | 'edge' | 'over' {
  if (g.threshold != null && value > g.threshold) return 'over';
  const lo = g.goodMin ?? g.min;
  const hi = g.goodMax ?? g.max;
  return value >= lo && value <= hi ? 'good' : 'edge';
}
```

- [ ] **Step 4: Run the test — verify it passes**

Run: `npx vitest run src/components/calculators/gaugeMath.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/calculators/gaugeMath.ts src/components/calculators/gaugeMath.test.ts
git commit -m "feat(calculators): gauge math helpers"
```

---

## Task 3: EnvelopeGauge component

**Files:**
- Create: `frontend/src/components/calculators/EnvelopeGauge.tsx`
- Test: `frontend/src/components/calculators/EnvelopeGauge.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EnvelopeGauge from './EnvelopeGauge';

const base = { resultKey: 'x', min: 0, max: 600, goodMin: 100, goodMax: 400, threshold: 600, unit: 'L/ha' };

describe('EnvelopeGauge', () => {
  it('shows the value with its unit', () => {
    render(<EnvelopeGauge value={150} gauge={base} />);
    expect(screen.getByText(/150/)).toBeInTheDocument();
    expect(screen.getByText(/L\/ha/)).toBeInTheDocument();
  });

  it('positions the marker by percent (data-pct)', () => {
    render(<EnvelopeGauge value={300} gauge={base} />);
    expect(screen.getByTestId('gauge-marker').getAttribute('data-pct')).toBe('50');
  });

  it('marks an over-threshold value (data-zone=over)', () => {
    render(<EnvelopeGauge value={650} gauge={base} />);
    expect(screen.getByTestId('gauge-marker').getAttribute('data-zone')).toBe('over');
  });

  it('renders ticks in ladder mode and highlights the recommended one', () => {
    const pump = { resultKey: 'kw_required', min: 0, max: 132, unit: 'kW',
      ticks: [{ value: 7.5, label: '7.5' }, { value: 11, label: '11' }] };
    render(<EnvelopeGauge value={9.1} gauge={pump} recommended={11} />);
    expect(screen.getByTestId('gauge-tick-11').getAttribute('data-recommended')).toBe('true');
    expect(screen.getByTestId('gauge-tick-7.5').getAttribute('data-recommended')).toBe('false');
  });
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `npx vitest run src/components/calculators/EnvelopeGauge.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```tsx
// EnvelopeGauge.tsx
import type { GaugeSpec } from '../../config/calculators';
import { markerPercent, classifyZone } from './gaugeMath';

const ZONE_COLOR = {
  good: 'var(--md-sys-color-primary, #047857)',
  edge: '#b45309',
  over: '#dc2626',
} as const;

export default function EnvelopeGauge({
  value, gauge, recommended,
}: { value: number; gauge: GaugeSpec; recommended?: number }) {
  const pct = markerPercent(value, gauge.min, gauge.max);
  const zone = classifyZone(value, gauge);
  const isLadder = !!gauge.ticks?.length;

  const goodLeft = markerPercent(gauge.goodMin ?? gauge.min, gauge.min, gauge.max);
  const goodRight = markerPercent(gauge.goodMax ?? gauge.max, gauge.min, gauge.max);

  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-2xl font-bold" style={{ color: ZONE_COLOR[zone] }}>
          {value.toLocaleString('en-ZA', { maximumFractionDigits: 2 })}
        </span>
        {gauge.unit && <span className="text-xs text-stone-500">{gauge.unit}</span>}
      </div>

      <div className="relative h-3 rounded-full bg-stone-100">
        {!isLadder && (
          <div className="absolute inset-y-0 rounded-full bg-emerald-100"
               style={{ left: `${goodLeft}%`, width: `${Math.max(0, goodRight - goodLeft)}%` }} />
        )}
        {gauge.threshold != null && (
          <div className="absolute inset-y-[-3px] w-0.5 bg-red-500"
               style={{ left: `${markerPercent(gauge.threshold, gauge.min, gauge.max)}%` }} />
        )}
        {isLadder && gauge.ticks!.map((t) => (
          <div key={t.value}
               data-testid={`gauge-tick-${t.value}`}
               data-recommended={String(recommended === t.value)}
               className="absolute inset-y-[-2px] w-px"
               style={{
                 left: `${markerPercent(t.value, gauge.min, gauge.max)}%`,
                 background: recommended === t.value ? ZONE_COLOR.good : '#d6d3d1',
               }} />
        ))}
        <div data-testid="gauge-marker" data-pct={String(pct)} data-zone={zone}
             className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 border-white shadow"
             style={{ left: `${pct}%`, background: ZONE_COLOR[zone] }} />
      </div>

      <div className="flex justify-between mt-1 text-[10px] text-stone-400">
        <span>{gauge.min}</span><span>{gauge.max}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test — verify it passes**

Run: `npx vitest run src/components/calculators/EnvelopeGauge.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/calculators/EnvelopeGauge.tsx src/components/calculators/EnvelopeGauge.test.tsx
git commit -m "feat(calculators): EnvelopeGauge component"
```

---

## Task 4: TankMix component (pest)

**Files:**
- Create: `frontend/src/components/calculators/TankMix.tsx`
- Test: `frontend/src/components/calculators/TankMix.test.tsx`

`TankMix` takes the pest `result` object: `{ total_chemical, unit, total_water_l, total_cost_zar }`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TankMix from './TankMix';

describe('TankMix', () => {
  it('per-100L: shows water fill, dose with unit, and cost', () => {
    render(<TankMix result={{ total_chemical: 2400, unit: 'ml', total_water_l: 997.6, total_cost_zar: 612 }} />);
    expect(screen.getByTestId('tankmix-water')).toBeInTheDocument();
    expect(screen.getByText(/2,?400\s*ml/)).toBeInTheDocument();
    expect(screen.getByText(/R\s?612/)).toBeInTheDocument();
  });

  it('per-ha (null water): dose-only, no water fill, no NaN', () => {
    const { container } = render(
      <TankMix result={{ total_chemical: 168, unit: 'g', total_water_l: null, total_cost_zar: 90 }} />
    );
    expect(screen.queryByTestId('tankmix-water')).not.toBeInTheDocument();
    expect(screen.getByText(/168\s*g/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/NaN/);
  });
});
```

- [ ] **Step 2: Run it — verify it fails.** `npx vitest run src/components/calculators/TankMix.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

```tsx
// TankMix.tsx
type PestResult = {
  total_chemical?: number | null;
  unit?: string | null;
  total_water_l?: number | null;
  total_cost_zar?: number | null;
};

function n(v: number | null | undefined) {
  return v == null ? '—' : v.toLocaleString('en-ZA', { maximumFractionDigits: 2 });
}

export default function TankMix({ result }: { result: PestResult }) {
  const unit = result.unit ?? '';
  const hasWater = result.total_water_l != null && result.total_water_l > 0;

  return (
    <div className="w-full">
      {hasWater ? (
        <div data-testid="tankmix-water" className="rounded-xl border border-stone-200 overflow-hidden">
          <div className="bg-sky-100 px-3 py-4 text-center text-xs text-sky-800">
            water {n(result.total_water_l)} L
          </div>
          <div className="bg-emerald-600 text-white px-3 py-1.5 text-center text-xs">
            chemical {n(result.total_chemical)} {unit}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-stone-200 bg-emerald-600 text-white px-3 py-3 text-center text-sm">
          dose {n(result.total_chemical)} {unit}
        </div>
      )}
      <div className="mt-2 flex justify-between text-xs text-stone-500">
        <span>Total dose {n(result.total_chemical)} {unit}</span>
        <span className="font-semibold text-stone-800">R {n(result.total_cost_zar)}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run — verify PASS.** `npx vitest run src/components/calculators/TankMix.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/components/calculators/TankMix.tsx src/components/calculators/TankMix.test.tsx
git commit -m "feat(calculators): TankMix pest graphic"
```

---

## Task 5: Schematics (sprayer, pipe, pump)

Presentational SVGs with live-labelled values. Light testing: each renders and shows a passed value label. Keep them small.

**Files:**
- Create: `frontend/src/components/calculators/SprayerSchematic.tsx`, `PipeSchematic.tsx`, `PumpSchematic.tsx`
- Test: add cases to `CalcVisual.test.tsx` in Task 6 (dispatcher covers rendering). A dedicated schematic test is optional; if added, assert each renders an `<svg>` and the label text.

- [ ] **Step 1: Implement the three schematics**

Each accepts the relevant result values and renders an SVG with labels. Signatures:

```tsx
// SprayerSchematic.tsx
export default function SprayerSchematic({ lHa }: { lHa: number | null }) { /* boom + nozzles + swath, label `${lHa} L/ha` */ }

// PipeSchematic.tsx
export default function PipeSchematic({ velocity, headLoss }: { velocity: number | null; headLoss: number | null }) { /* pipe with flow arrows; labels velocity m/s + head loss m */ }

// PumpSchematic.tsx
export default function PumpSchematic({ kw, motorKw }: { kw: number | null; motorKw: number | null }) { /* pump+motor glyph; labels kW required + motor kW */ }
```

Use the same `viewBox="0 0 320 150"` style as the brainstorm mockups, emerald/stone fills, `font-family="system-ui"`. Guard null with `?? '—'`. Keep each under ~50 lines.

- [ ] **Step 2: Typecheck.** `npx tsc --noEmit` → clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/calculators/SprayerSchematic.tsx src/components/calculators/PipeSchematic.tsx src/components/calculators/PumpSchematic.tsx
git commit -m "feat(calculators): sprayer/pipe/pump schematics"
```

---

## Task 6: CalcVisual dispatcher + page wiring

**Files:**
- Create: `frontend/src/components/calculators/CalcVisual.tsx`
- Test: `frontend/src/components/calculators/CalcVisual.test.tsx`
- Modify: `frontend/src/pages/CalculatorsPage.tsx`

- [ ] **Step 1: Write the failing dispatcher test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CalcVisual from './CalcVisual';
import { CALCULATORS } from '../../config/calculators';

const sprayer = CALCULATORS.find((c) => c.type === 'sprayer')!;
const pest = CALCULATORS.find((c) => c.type === 'pest')!;
const electrical = CALCULATORS.find((c) => c.type === 'electrical')!;

describe('CalcVisual', () => {
  it('renders a gauge for the sprayer result key', () => {
    render(<CalcVisual calc={sprayer} result={{ application_l_ha: 150 }} />);
    expect(screen.getByTestId('gauge-marker')).toBeInTheDocument();
  });

  it('renders tankmix for pest', () => {
    render(<CalcVisual calc={pest} result={{ total_chemical: 168, unit: 'g', total_water_l: null, total_cost_zar: 90 }} />);
    expect(screen.getByText(/168\s*g/)).toBeInTheDocument();
  });

  it('passes recommended motor to the pump gauge ticks', () => {
    render(<CalcVisual calc={electrical} result={{ kw_required: 9.1, recommended_motor_kw: 11 }} />);
    expect(screen.getByTestId('gauge-tick-11').getAttribute('data-recommended')).toBe('true');
  });

  it('renders nothing when the target value is null/missing', () => {
    const { container } = render(<CalcVisual calc={sprayer} result={{ application_l_ha: null }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run it — verify it fails.** `npx vitest run src/components/calculators/CalcVisual.test.tsx` → FAIL.

- [ ] **Step 3: Implement the dispatcher**

```tsx
// CalcVisual.tsx
import type { CalcDef } from '../../config/calculators';
import EnvelopeGauge from './EnvelopeGauge';
import TankMix from './TankMix';
import SprayerSchematic from './SprayerSchematic';
import PipeSchematic from './PipeSchematic';
import PumpSchematic from './PumpSchematic';

type ResultMap = Record<string, number | string | null | undefined>;
const num = (v: unknown): number | null => (typeof v === 'number' && !Number.isNaN(v) ? v : null);

export default function CalcVisual({ calc, result }: { calc: CalcDef; result: ResultMap }) {
  const v = calc.visual;
  if (!v) return null;

  if (v.kind === 'tankmix') {
    return (
      <div className="mb-4">
        <TankMix result={{
          total_chemical: num(result.total_chemical),
          unit: typeof result.unit === 'string' ? result.unit : null,
          total_water_l: num(result.total_water_l),
          total_cost_zar: num(result.total_cost_zar),
        }} />
      </div>
    );
  }

  const value = num(result[v.gauge.resultKey]);
  if (value == null) return null;

  const recommended = v.kind === 'gauge+schematic' && v.schematic === 'pump'
    ? num(result.recommended_motor_kw) ?? undefined
    : undefined;

  return (
    <div className="mb-4 space-y-3">
      <EnvelopeGauge value={value} gauge={v.gauge} recommended={recommended} />
      {v.kind === 'gauge+schematic' && v.schematic === 'sprayer' && <SprayerSchematic lHa={value} />}
      {v.kind === 'gauge+schematic' && v.schematic === 'pipe' && (
        <PipeSchematic velocity={value} headLoss={num(result.head_loss_m)} />
      )}
      {v.kind === 'gauge+schematic' && v.schematic === 'pump' && (
        <PumpSchematic kw={value} motorKw={num(result.recommended_motor_kw)} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run — verify PASS.** `npx vitest run src/components/calculators/CalcVisual.test.tsx`

- [ ] **Step 5: Wire into CalculatorsPage**

In `frontend/src/pages/CalculatorsPage.tsx`: add `import CalcVisual from '../components/calculators/CalcVisual';`. Inside the result card (the `data-testid="calc-result"` block), in the non-error branch, render the visual **above** the `<dl>`:

```tsx
{response.error ? (
  <p className="text-sm text-red-600">{response.error}</p>
) : (
  <>
    <CalcVisual calc={calc} result={response.result} />
    <dl className="space-y-1.5">
      {/* ...unchanged... */}
```

- [ ] **Step 6: Typecheck + full frontend suite**

Run: `npx tsc --noEmit` → clean
Run: `npx vitest run` → all pass (existing + new)

- [ ] **Step 7: Commit**

```bash
git add src/components/calculators/CalcVisual.tsx src/components/calculators/CalcVisual.test.tsx src/pages/CalculatorsPage.tsx
git commit -m "feat(calculators): CalcVisual dispatcher + page wiring"
```

---

## Task 7: Verify in the running app

- [ ] **Step 1: Build** — `npm run build` → succeeds.
- [ ] **Step 2: Run dev** — `npm run dev`; open the Calculators page, run each of the six calculators, confirm: gauge marker sits in the right zone, sprayer/pipe/pump show their schematic, pest shows the tank (per-100L) and dose-only (per-ha) forms, and the text results/breakdown/warnings still render below.
- [ ] **Step 3:** Use the @verify or @run skill to screenshot the sprayer + pump + pest results for the record.

---

## Definition of done
- All six calculators show a visual above their text result card.
- `npx vitest run` green (config integrity, gauge math, EnvelopeGauge, TankMix, CalcVisual).
- `npx tsc --noEmit` clean; `npm run build` succeeds.
- No backend/API/engine changes; no new dependencies.
