import { render } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Annotation } from '../../types/annotation';

let markerCount = 0;
let removeCount = 0;

vi.mock('maplibre-gl', () => {
  class Marker {
    constructor() { markerCount++; }
    setLngLat() { return this; }
    addTo() { return this; }
    remove() { removeCount++; }
  }
  return { default: { Marker } };
});

vi.mock('@turf/centroid', () => ({
  default: () => ({ geometry: { coordinates: [19.0, -31.3] } }),
}));

vi.mock('@turf/helpers', () => ({
  feature: (geom: unknown) => ({ type: 'Feature', geometry: geom }),
}));

vi.mock('motion/react', () => ({
  motion: {
    div: (props: Record<string, unknown>) => {
      const { children } = props;
      return <div>{children as React.ReactNode}</div>;
    },
    span: (props: Record<string, unknown>) => {
      const { children } = props;
      return <span>{children as React.ReactNode}</span>;
    },
  },
}));

import AnnotationMarkers from './AnnotationMarkers';
import maplibregl from 'maplibre-gl';

function makeAnnotation(id: string, type: 'line' | 'polygon' | 'pin'): Annotation {
  const geometry = type === 'pin'
    ? { type: 'Point' as const, coordinates: [19.0, -31.3] }
    : type === 'line'
      ? { type: 'LineString' as const, coordinates: [[19.0, -31.3], [19.001, -31.3]] }
      : { type: 'Polygon' as const, coordinates: [[[19.0, -31.3], [19.001, -31.3], [19.001, -31.301], [19.0, -31.3]]] };
  return {
    id, type,
    title: `Test ${id}`,
    notes: null,
    geometry_json: JSON.stringify(geometry),
    geometry,
    length_m: null, area_m2: null, field_id: null, farm_id: null,
    created_at: '2026-01-01', updated_at: '2026-01-01',
    category: null, metadata: null,
  };
}

const mockMap = {} as unknown as maplibregl.Map;

describe('AnnotationMarkers', () => {
  beforeEach(() => {
    markerCount = 0;
    removeCount = 0;
  });

  it('creates markers for all annotations', () => {
    const anns = [makeAnnotation('a1', 'pin'), makeAnnotation('a2', 'line')];
    render(
      <AnnotationMarkers map={mockMap} annotations={anns} selectedId={null} onSelect={vi.fn()} />,
    );
    expect(markerCount).toBe(2);
  });

  it('excludes annotation matching excludeId', () => {
    const anns = [makeAnnotation('a1', 'pin'), makeAnnotation('a2', 'line')];
    render(
      <AnnotationMarkers map={mockMap} annotations={anns} selectedId={null} onSelect={vi.fn()} excludeId="a1" />,
    );
    expect(markerCount).toBe(1);
  });

  it('removes marker when excludeId changes to its id', () => {
    const anns = [makeAnnotation('a1', 'pin'), makeAnnotation('a2', 'line')];
    const { rerender } = render(
      <AnnotationMarkers map={mockMap} annotations={anns} selectedId={null} onSelect={vi.fn()} />,
    );
    expect(markerCount).toBe(2);

    rerender(
      <AnnotationMarkers map={mockMap} annotations={anns} selectedId={null} onSelect={vi.fn()} excludeId="a1" />,
    );
    expect(removeCount).toBe(1);
  });

  it('re-adds marker when excludeId is cleared', () => {
    const anns = [makeAnnotation('a1', 'pin'), makeAnnotation('a2', 'line')];
    const { rerender } = render(
      <AnnotationMarkers map={mockMap} annotations={anns} selectedId={null} onSelect={vi.fn()} excludeId="a1" />,
    );
    const before = markerCount;

    rerender(
      <AnnotationMarkers map={mockMap} annotations={anns} selectedId={null} onSelect={vi.fn()} />,
    );
    expect(markerCount).toBe(before + 1);
  });
});
