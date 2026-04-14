import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type maplibregl from 'maplibre-gl';
import MeasureTool from './MeasureTool';

// Mock the terradraw package — we don't want to instantiate its real control
// (requires a real MapLibre canvas) in jsdom. We assert our wiring.
const mockMeasureCtor = vi.fn();
vi.mock('@watergis/maplibre-gl-terradraw', () => ({
  MaplibreMeasureControl: class {
    constructor(options: unknown) {
      mockMeasureCtor(options);
    }
  },
}));

function makeMockMap() {
  return {
    addControl: vi.fn(),
    removeControl: vi.fn(),
    hasControl: vi.fn().mockReturnValue(false),
  } as unknown as maplibregl.Map & {
    addControl: ReturnType<typeof vi.fn>;
    removeControl: ReturnType<typeof vi.fn>;
  };
}

describe('MeasureTool', () => {
  beforeEach(() => {
    mockMeasureCtor.mockClear();
    cleanup();
  });

  it('does nothing when map is null', () => {
    const { container } = render(<MeasureTool map={null} />);
    expect(container.firstChild).toBeNull();
    expect(mockMeasureCtor).not.toHaveBeenCalled();
  });

  it('adds a MaplibreMeasureControl to the map on mount', () => {
    const map = makeMockMap();
    render(<MeasureTool map={map} />);
    expect(mockMeasureCtor).toHaveBeenCalledTimes(1);
    expect(map.addControl).toHaveBeenCalledTimes(1);
  });

  it('configures the control with metric units', () => {
    const map = makeMockMap();
    render(<MeasureTool map={map} />);
    const opts = mockMeasureCtor.mock.calls[0][0] as Record<string, unknown>;
    expect(opts.measureUnitType).toBe('metric');
  });

  it('removes the control on unmount', () => {
    const map = makeMockMap();
    const { unmount } = render(<MeasureTool map={map} />);
    unmount();
    expect(map.removeControl).toHaveBeenCalledTimes(1);
  });

  it('does not re-add on map re-render with same instance', () => {
    const map = makeMockMap();
    const { rerender } = render(<MeasureTool map={map} />);
    rerender(<MeasureTool map={map} />);
    expect(map.addControl).toHaveBeenCalledTimes(1);
  });
});
