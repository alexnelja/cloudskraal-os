import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type maplibregl from 'maplibre-gl';
import AnnotateTool from './AnnotateTool';

const mockMeasureCtor = vi.fn();
const mockTerraDrawOn = vi.fn();

vi.mock('@watergis/maplibre-gl-terradraw', () => ({
  MaplibreMeasureControl: class {
    constructor(options: unknown) {
      mockMeasureCtor(options);
    }
    getTerraDrawInstance() {
      return { on: mockTerraDrawOn, getSnapshot: () => [] };
    }
  },
}));

vi.mock('terra-draw', () => ({
  TerraDrawLineStringMode: class {
    opts: unknown;
    constructor(opts: unknown) { this.opts = opts; }
  },
  TerraDrawPolygonMode: class {
    opts: unknown;
    constructor(opts: unknown) { this.opts = opts; }
  },
  TerraDrawPointMode: class {
    opts: unknown;
    constructor(opts: unknown) { this.opts = opts; }
  },
  TerraDrawUndoRedoKeyboardShortcuts: class {
    opts: unknown;
    constructor(opts: unknown) { this.opts = opts; }
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

describe('AnnotateTool', () => {
  beforeEach(() => {
    mockMeasureCtor.mockClear();
    mockTerraDrawOn.mockClear();
    cleanup();
  });

  it('does nothing when map is null', () => {
    render(<AnnotateTool map={null} />);
    expect(mockMeasureCtor).not.toHaveBeenCalled();
  });

  it('adds a MaplibreMeasureControl to the map', () => {
    const map = makeMockMap();
    render(<AnnotateTool map={map} />);
    expect(mockMeasureCtor).toHaveBeenCalledTimes(1);
    expect(map.addControl).toHaveBeenCalledTimes(1);
  });

  it('includes point mode in the configured modes list', () => {
    const map = makeMockMap();
    render(<AnnotateTool map={map} />);
    const opts = mockMeasureCtor.mock.calls[0][0] as { modes: string[] };
    expect(opts.modes).toContain('point');
    expect(opts.modes).toContain('linestring');
    expect(opts.modes).toContain('polygon');
  });

  it('subscribes to the terradraw finish event', () => {
    const map = makeMockMap();
    render(<AnnotateTool map={map} onFinish={() => {}} />);
    expect(mockTerraDrawOn).toHaveBeenCalledWith('finish', expect.any(Function));
  });

  it('removes the control on unmount', () => {
    const map = makeMockMap();
    const { unmount } = render(<AnnotateTool map={map} />);
    unmount();
    expect(map.removeControl).toHaveBeenCalledTimes(1);
  });
});
