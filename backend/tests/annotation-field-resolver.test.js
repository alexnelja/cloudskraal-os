import { describe, it, expect } from 'vitest';
import { resolveFieldId } from '../src/services/annotationFieldResolver.js';

// Two fields: a unit square [0..1]x[0..1] and a unit square shifted [10..11]x[10..11].
const fields = [
  {
    id: 'field-A',
    farm_id: 'farm-1',
    geometry: {
      type: 'Polygon',
      coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
    },
  },
  {
    id: 'field-B',
    farm_id: 'farm-2',
    geometry: {
      type: 'Polygon',
      coordinates: [[[10, 10], [11, 10], [11, 11], [10, 11], [10, 10]]],
    },
  },
];

describe('resolveFieldId', () => {
  it('returns field for a Point inside the polygon', () => {
    const geom = { type: 'Point', coordinates: [0.5, 0.5] };
    expect(resolveFieldId(geom, fields)).toEqual({ field_id: 'field-A', farm_id: 'farm-1' });
  });

  it('returns nulls for a Point outside all fields', () => {
    const geom = { type: 'Point', coordinates: [5, 5] };
    expect(resolveFieldId(geom, fields)).toEqual({ field_id: null, farm_id: null });
  });

  it('uses the midpoint for a LineString', () => {
    // Line from (9.5, 10.5) to (11.5, 10.5) — midpoint (10.5, 10.5) is inside field-B.
    const geom = {
      type: 'LineString',
      coordinates: [[9.5, 10.5], [11.5, 10.5]],
    };
    expect(resolveFieldId(geom, fields)).toEqual({ field_id: 'field-B', farm_id: 'farm-2' });
  });

  it('uses the centroid for a Polygon', () => {
    // Small polygon centered around (0.5, 0.5) — centroid in field-A.
    const geom = {
      type: 'Polygon',
      coordinates: [[[0.4, 0.4], [0.6, 0.4], [0.6, 0.6], [0.4, 0.6], [0.4, 0.4]]],
    };
    expect(resolveFieldId(geom, fields)).toEqual({ field_id: 'field-A', farm_id: 'farm-1' });
  });

  it('parses fields.geometry when provided as a JSON string', () => {
    const geom = { type: 'Point', coordinates: [0.5, 0.5] };
    const stringified = fields.map((f) => ({ ...f, geometry: JSON.stringify(f.geometry) }));
    expect(resolveFieldId(geom, stringified)).toEqual({ field_id: 'field-A', farm_id: 'farm-1' });
  });
});
