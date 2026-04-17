import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import WeatherForecastPanel from './WeatherForecastPanel';

// recharts needs ResizeObserver
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

const mockFarms = [
  { id: 'f1', name: 'Cloudskraal', code: 'CS', type: 'owned' as const, total_ha: 100, lat: -32.3, lng: 19.0, region: 'Cederberg', notes: null },
  { id: 'f2', name: 'Bergplaas', code: 'BP', type: 'leased' as const, total_ha: 50, lat: -32.5, lng: 19.2, region: 'Cederberg', notes: null },
];

const makeForecast = (overrides?: { minTemps?: number[]; maxTemps?: number[] }) => ({
  daily: {
    time: ['2026-04-17', '2026-04-18', '2026-04-19', '2026-04-20', '2026-04-21', '2026-04-22', '2026-04-23'],
    temperature_2m_max: overrides?.maxTemps ?? [25, 26, 24, 22, 20, 23, 27],
    temperature_2m_min: overrides?.minTemps ?? [10, 11, 9, 8, 7, 10, 12],
    precipitation_sum: [0, 3, 5, 0, 0, 1, 0],
    weathercode: [0, 2, 61, 3, 1, 51, 0],
    windspeed_10m_max: [15, 20, 30, 10, 5, 18, 12],
    relative_humidity_2m_max: [60, 70, 85, 55, 50, 65, 58],
  },
  hourly: {
    time: Array.from({ length: 168 }, (_, i) => {
      const day = Math.floor(i / 24);
      const hour = i % 24;
      const d = 17 + day;
      return `2026-04-${String(d).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00`;
    }),
    temperature_2m: Array.from({ length: 168 }, () => 20),
    precipitation: Array.from({ length: 168 }, () => 0),
  },
});

// Mock getFarms
vi.mock('../api/farms', () => ({
  getFarms: vi.fn(() => Promise.resolve(mockFarms)),
}));

// Mock fetchForecast and getCacheTimestamp
const mockFetchForecast = vi.fn();
const mockGetCacheTimestamp = vi.fn();
vi.mock('../api/weather', () => ({
  fetchForecast: (...args: unknown[]) => mockFetchForecast(...args),
  getCacheTimestamp: (...args: unknown[]) => mockGetCacheTimestamp(...args),
  clearForecastCache: vi.fn(),
}));

describe('WeatherForecastPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCacheTimestamp.mockReturnValue(null);
  });

  it('renders 7 day cards when data is loaded', async () => {
    mockFetchForecast.mockResolvedValue(makeForecast());

    render(<WeatherForecastPanel />);

    await waitFor(() => {
      expect(screen.getByText('Today')).toBeInTheDocument();
    });

    // Should have 7 day cards
    const cards = screen.getAllByTestId('day-card');
    expect(cards).toHaveLength(7);
  });

  it('shows frost alert banner when min temp < 2', async () => {
    mockFetchForecast.mockResolvedValue(
      makeForecast({ minTemps: [10, 1, 9, 8, 7, 10, 12] }),
    );

    render(<WeatherForecastPanel />);

    await waitFor(() => {
      expect(screen.getByText(/Frost risk/)).toBeInTheDocument();
    });
  });

  it('shows heat alert banner when max temp > 38', async () => {
    mockFetchForecast.mockResolvedValue(
      makeForecast({ maxTemps: [25, 40, 24, 22, 20, 23, 27] }),
    );

    render(<WeatherForecastPanel />);

    await waitFor(() => {
      expect(screen.getByText(/Heat stress/)).toBeInTheDocument();
    });
  });

  it('shows stale indicator when using cached data after fetch failure', async () => {
    // Simulate: cache timestamp unchanged before/after fetch = fetch failed, stale cache used
    const staleTs = Date.now() - 4 * 60 * 60 * 1000;
    mockGetCacheTimestamp.mockReturnValue(staleTs);
    mockFetchForecast.mockResolvedValue(makeForecast());

    render(<WeatherForecastPanel />);

    await waitFor(() => {
      expect(screen.getByText(/Last updated/)).toBeInTheDocument();
    });
  });

  it('shows empty state when no data and no cache', async () => {
    mockFetchForecast.mockResolvedValue(null);

    render(<WeatherForecastPanel />);

    await waitFor(() => {
      expect(screen.getByText(/Weather data unavailable/)).toBeInTheDocument();
    });

    // Has retry button
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('farm selector calls fetchForecast with new farm coordinates on change', async () => {
    mockFetchForecast.mockResolvedValue(makeForecast());

    render(<WeatherForecastPanel />);

    await waitFor(() => {
      expect(screen.getByText('Today')).toBeInTheDocument();
    });

    // Initial fetch with first farm
    expect(mockFetchForecast).toHaveBeenCalledWith(-32.3, 19.0, 'f1');

    // Change farm
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'f2' } });

    await waitFor(() => {
      expect(mockFetchForecast).toHaveBeenCalledWith(-32.5, 19.2, 'f2');
    });
  });
});
