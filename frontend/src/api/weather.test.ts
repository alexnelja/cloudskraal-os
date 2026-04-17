import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockForecast = {
  daily: {
    time: ['2026-04-17', '2026-04-18', '2026-04-19', '2026-04-20', '2026-04-21', '2026-04-22', '2026-04-23'],
    temperature_2m_max: [25, 26, 24, 22, 20, 23, 27],
    temperature_2m_min: [10, 11, 9, 8, 7, 10, 12],
    precipitation_sum: [0, 3, 5, 0, 0, 1, 0],
    weathercode: [0, 2, 61, 3, 1, 51, 0],
    windspeed_10m_max: [15, 20, 30, 10, 5, 18, 12],
    relative_humidity_2m_max: [60, 70, 85, 55, 50, 65, 58],
  },
  hourly: {
    time: Array.from({ length: 168 }, (_, i) => `2026-04-17T${String(i % 24).padStart(2, '0')}:00`),
    temperature_2m: Array.from({ length: 168 }, () => 20),
    precipitation: Array.from({ length: 168 }, () => 0),
  },
};

// Create an in-memory localStorage mock
function createStorageMock() {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]); }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };
}

describe('fetchForecast', () => {
  let storageMock: ReturnType<typeof createStorageMock>;

  beforeEach(() => {
    storageMock = createStorageMock();
    vi.stubGlobal('localStorage', storageMock);
    vi.restoreAllMocks();
    // Re-stub after restoreAllMocks
    storageMock = createStorageMock();
    vi.stubGlobal('localStorage', storageMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns typed WeatherForecast on successful fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockForecast),
    }));

    // Dynamic import to get fresh module with mocked globals
    const { fetchForecast } = await import('./weather');
    const result = await fetchForecast(-32.3, 19.0, 'farm-1');
    expect(result).not.toBeNull();
    expect(result!.data).toEqual(mockForecast);
    expect(result!.stale).toBe(false);
    expect(result!.data.daily.time).toHaveLength(7);
  });

  it('caches response in localStorage on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockForecast),
    }));

    const { fetchForecast } = await import('./weather');
    await fetchForecast(-32.3, 19.0, 'farm-1');
    expect(storageMock.setItem).toHaveBeenCalledWith(
      'weather_forecast_farm-1',
      expect.stringContaining('"data"'),
    );
  });

  it('returns cached data when fetch throws and cache exists', async () => {
    // Seed stale cache
    const entry = { data: mockForecast, timestamp: Date.now() - 4 * 60 * 60 * 1000 };
    storageMock.setItem('weather_forecast_farm-1', JSON.stringify(entry));

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    const { fetchForecast } = await import('./weather');
    const result = await fetchForecast(-32.3, 19.0, 'farm-1');
    expect(result).not.toBeNull();
    expect(result!.data).toEqual(mockForecast);
    expect(result!.stale).toBe(true);
  });

  it('returns null when fetch throws and no cache exists', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    const { fetchForecast } = await import('./weather');
    const result = await fetchForecast(-32.3, 19.0, 'farm-1');
    expect(result).toBeNull();
  });

  it('respects 3-hour cache TTL (fresh cache skips fetch)', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    // Seed fresh cache (1 hour old)
    const entry = { data: mockForecast, timestamp: Date.now() - 1 * 60 * 60 * 1000 };
    storageMock.setItem('weather_forecast_farm-1', JSON.stringify(entry));

    const { fetchForecast } = await import('./weather');
    const result = await fetchForecast(-32.3, 19.0, 'farm-1');
    expect(result).not.toBeNull();
    expect(result!.data).toEqual(mockForecast);
    expect(result!.stale).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetches fresh when cache is stale (> 3 hours)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockForecast),
    });
    vi.stubGlobal('fetch', fetchSpy);

    // Seed stale cache (4 hours old)
    const entry = { data: mockForecast, timestamp: Date.now() - 4 * 60 * 60 * 1000 };
    storageMock.setItem('weather_forecast_farm-1', JSON.stringify(entry));

    const { fetchForecast } = await import('./weather');
    await fetchForecast(-32.3, 19.0, 'farm-1');
    expect(fetchSpy).toHaveBeenCalled();
  });
});

describe('getCacheTimestamp', () => {
  let storageMock: ReturnType<typeof createStorageMock>;

  beforeEach(() => {
    storageMock = createStorageMock();
    vi.stubGlobal('localStorage', storageMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when no cache exists', async () => {
    const { getCacheTimestamp } = await import('./weather');
    expect(getCacheTimestamp('farm-x')).toBeNull();
  });

  it('returns timestamp when cache exists', async () => {
    const ts = Date.now();
    storageMock.setItem('weather_forecast_farm-1', JSON.stringify({ data: mockForecast, timestamp: ts }));
    const { getCacheTimestamp } = await import('./weather');
    expect(getCacheTimestamp('farm-1')).toBe(ts);
  });
});
