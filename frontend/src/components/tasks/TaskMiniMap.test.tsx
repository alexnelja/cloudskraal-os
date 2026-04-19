import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TaskMiniMap from './TaskMiniMap';

// Mock maplibre-gl — it doesn't work in jsdom
vi.mock('maplibre-gl', () => {
  class MockMap {
    on = vi.fn();
    remove = vi.fn();
    addSource = vi.fn();
    addLayer = vi.fn();
    addControl = vi.fn();
    fitBounds = vi.fn();
    getSource = vi.fn();
    getLayer = vi.fn();
    getCanvas = vi.fn(() => ({ style: {} }));
    getContainer = vi.fn(() => ({ addEventListener: vi.fn() }));
    isStyleLoaded = vi.fn(() => true);
    resize = vi.fn();
    queryRenderedFeatures = vi.fn(() => []);
    setFilter = vi.fn();
  }
  class MockAttributionControl {}
  class MockLngLatBounds {
    extend = vi.fn();
    isEmpty = vi.fn(() => true);
  }
  return {
    default: {
      Map: MockMap,
      AttributionControl: MockAttributionControl,
      LngLatBounds: MockLngLatBounds,
    },
  };
});

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

const mockGeojson: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { id: 'f1', name: 'Block A', enterprise: 'rooibos' },
      geometry: { type: 'Polygon', coordinates: [[[19.0, -31.3], [19.01, -31.3], [19.01, -31.31], [19.0, -31.31], [19.0, -31.3]]] },
    },
  ],
};

const fields = [{ id: 'f1', name: 'Block A' }];

describe('TaskMiniMap', () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    vi.restoreAllMocks();
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; },
      },
      writable: true,
      configurable: true,
    });
  });

  it('renders collapse toggle button', () => {
    render(
      <TaskMiniMap
        geojson={mockGeojson}
        tasks={[]}
        fields={fields}
        onFieldSelect={vi.fn()}
        selectedFieldId={null}
      />,
    );
    expect(screen.getByRole('button', { name: /map/i })).toBeInTheDocument();
  });

  it('starts expanded by default', () => {
    render(
      <TaskMiniMap
        geojson={mockGeojson}
        tasks={[]}
        fields={fields}
        onFieldSelect={vi.fn()}
        selectedFieldId={null}
      />,
    );
    const container = screen.getByTestId('minimap-container');
    expect(container.style.height).toBe('150px');
  });

  it('collapses when toggle is clicked', () => {
    render(
      <TaskMiniMap
        geojson={mockGeojson}
        tasks={[]}
        fields={fields}
        onFieldSelect={vi.fn()}
        selectedFieldId={null}
      />,
    );
    const toggle = screen.getByRole('button', { name: /map/i });
    fireEvent.click(toggle);
    const container = screen.getByTestId('minimap-container');
    expect(container.style.height).toBe('0px');
  });

  it('persists collapsed state in localStorage', () => {
    store['capex.task-minimap-collapsed'] = 'true';
    render(
      <TaskMiniMap
        geojson={mockGeojson}
        tasks={[]}
        fields={fields}
        onFieldSelect={vi.fn()}
        selectedFieldId={null}
      />,
    );
    const container = screen.getByTestId('minimap-container');
    expect(container.style.height).toBe('0px');
  });

  it('renders without geojson gracefully', () => {
    render(
      <TaskMiniMap
        geojson={null}
        tasks={[]}
        fields={fields}
        onFieldSelect={vi.fn()}
        selectedFieldId={null}
      />,
    );
    expect(screen.getByRole('button', { name: /map/i })).toBeInTheDocument();
  });
});
