import { describe, expect, it } from 'vitest';
import { findContainingFarm } from './farms';

const FARMS: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { id: 'farm-a', name: 'Alpha' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
      },
    },
    {
      type: 'Feature',
      properties: { id: 'farm-b', name: 'Beta' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[20, 0], [30, 0], [30, 10], [20, 10], [20, 0]]],
      },
    },
  ],
};

describe('findContainingFarm', () => {
  it('returns the farm whose polygon contains the drawn centroid', () => {
    const drawn: GeoJSON.Geometry = {
      type: 'Polygon',
      coordinates: [[[2, 2], [4, 2], [4, 4], [2, 4], [2, 2]]],
    };
    const match = findContainingFarm(FARMS, drawn);
    expect(match).toEqual({ farmId: 'farm-a', farmName: 'Alpha' });
  });

  it('returns null when the drawn polygon is outside every farm', () => {
    const drawn: GeoJSON.Geometry = {
      type: 'Polygon',
      coordinates: [[[100, 100], [101, 100], [101, 101], [100, 100]]],
    };
    expect(findContainingFarm(FARMS, drawn)).toBeNull();
  });

  it('returns null when farmBoundaries is null', () => {
    const drawn: GeoJSON.Geometry = {
      type: 'Polygon',
      coordinates: [[[2, 2], [4, 2], [4, 4], [2, 2]]],
    };
    expect(findContainingFarm(null, drawn)).toBeNull();
  });

  it('matches based on centroid even when drawn polygon overlaps farm boundary', () => {
    // Drawn polygon straddles farm A's edge — centroid still inside A
    const drawn: GeoJSON.Geometry = {
      type: 'Polygon',
      coordinates: [[[8, 8], [12, 8], [12, 12], [8, 12], [8, 8]]],
    };
    // Centroid at (10, 10) — on the corner of A; booleanPointInPolygon is
    // boundary-inclusive by default, so we expect a match on A.
    const match = findContainingFarm(FARMS, drawn);
    expect(match?.farmId).toBe('farm-a');
  });

  it('skips farm features without polygon geometry', () => {
    const mixed: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { id: 'point-farm' }, geometry: { type: 'Point', coordinates: [5, 5] } },
        ...FARMS.features,
      ],
    };
    const drawn: GeoJSON.Geometry = {
      type: 'Polygon',
      coordinates: [[[2, 2], [4, 2], [4, 4], [2, 4], [2, 2]]],
    };
    // Should still find farm-a despite the point feature coming first
    expect(findContainingFarm(mixed, drawn)?.farmId).toBe('farm-a');
  });
});
