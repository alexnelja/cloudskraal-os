import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { useFieldDetection } from './useFieldDetection';

vi.mock('@turf/boolean-point-in-polygon', () => ({ default: vi.fn() }));
vi.mock('@turf/helpers', () => ({
  point: (coords: number[]) => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: coords },
    properties: {},
  }),
}));

const mockWatchPosition = vi.fn();
const mockClearWatch = vi.fn();

const sampleGeojson: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { id: 'field-1', name: 'Lucerne A' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[18.0, -32.0], [18.1, -32.0], [18.1, -32.1], [18.0, -32.1], [18.0, -32.0]]],
      },
    },
  ],
};

describe('useFieldDetection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'geolocation', {
      value: { watchPosition: mockWatchPosition, clearWatch: mockClearWatch },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
    mockWatchPosition.mockReset();
    mockClearWatch.mockReset();
    vi.mocked(booleanPointInPolygon).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when disabled', () => {
    const { result } = renderHook(() => useFieldDetection(sampleGeojson, false));
    expect(result.current).toBeNull();
    expect(mockWatchPosition).not.toHaveBeenCalled();
  });

  it('returns null when geojson is null', () => {
    const { result } = renderHook(() => useFieldDetection(null, true));
    expect(result.current).toBeNull();
  });

  it('calls watchPosition when enabled', () => {
    renderHook(() => useFieldDetection(sampleGeojson, true));
    expect(mockWatchPosition).toHaveBeenCalledTimes(1);
    expect(mockWatchPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      { enableHighAccuracy: false },
    );
  });

  it('calls clearWatch on cleanup', () => {
    mockWatchPosition.mockReturnValue(42);
    const { unmount } = renderHook(() => useFieldDetection(sampleGeojson, true));
    unmount();
    expect(mockClearWatch).toHaveBeenCalledWith(42);
  });

  it('returns detected field when position matches polygon', () => {
    vi.mocked(booleanPointInPolygon).mockReturnValue(true);
    mockWatchPosition.mockImplementation((success: PositionCallback) => {
      success({
        coords: { latitude: -32.05, longitude: 18.05 },
        timestamp: Date.now(),
      } as GeolocationPosition);
      return 1;
    });

    const { result } = renderHook(() => useFieldDetection(sampleGeojson, true));

    expect(result.current).toEqual({
      fieldId: 'field-1',
      fieldName: 'Lucerne A',
    });
  });

  it('returns null when position does not match any polygon', () => {
    vi.mocked(booleanPointInPolygon).mockReturnValue(false);
    mockWatchPosition.mockImplementation((success: PositionCallback) => {
      success({
        coords: { latitude: -33.0, longitude: 19.0 },
        timestamp: Date.now(),
      } as GeolocationPosition);
      return 1;
    });

    const { result } = renderHook(() => useFieldDetection(sampleGeojson, true));
    expect(result.current).toBeNull();
  });

  it('handles permission denied gracefully', () => {
    mockWatchPosition.mockImplementation((_s: any, error: PositionErrorCallback) => {
      error({ code: 1, message: 'User denied', PERMISSION_DENIED: 1 } as GeolocationPositionError);
      return 1;
    });

    const { result } = renderHook(() => useFieldDetection(sampleGeojson, true));
    expect(result.current).toBeNull();
  });
});
