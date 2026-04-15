import { describe, it, expect } from 'vitest';
import { computeMetrics } from '../src/services/annotationMetrics.js';

describe('computeMetrics', () => {
  it('returns {} for a Point geometry', () => {
    const geom = { type: 'Point', coordinates: [19.0, -31.3] };
    expect(computeMetrics(geom)).toEqual({});
  });

  it('computes length_m for a LineString', () => {
    // Two points ~1° of longitude apart at -31° lat → roughly 95.2 km.
    // We test a shorter, easy-to-hand-compute segment: 1 minute of latitude = ~1852 m.
    const geom = {
      type: 'LineString',
      coordinates: [
        [19.0, -31.0],
        [19.0, -31.0 + 1 / 60],
      ],
    };
    const { length_m, area_m2 } = computeMetrics(geom);
    expect(area_m2).toBeUndefined();
    expect(length_m).toBeGreaterThan(1800);
    expect(length_m).toBeLessThan(1900);
  });

  it('computes area_m2 for a Polygon (~1 ha square near equator)', () => {
    // Small polygon at equator — 100 m × 100 m ≈ 1 ha.
    // 1 degree lon at equator ≈ 111_319 m → 100 m ≈ 0.000898°.
    const d = 0.000898;
    const geom = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [d, 0],
          [d, d],
          [0, d],
          [0, 0],
        ],
      ],
    };
    const { area_m2, length_m } = computeMetrics(geom);
    expect(length_m).toBeUndefined();
    expect(area_m2).toBeGreaterThan(9800);
    expect(area_m2).toBeLessThan(10200);
  });

  it('returns {} for MultiPoint (unsupported)', () => {
    const geom = { type: 'MultiPoint', coordinates: [[0, 0], [1, 1]] };
    expect(computeMetrics(geom)).toEqual({});
  });
});
