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
