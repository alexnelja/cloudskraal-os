export interface WeatherForecast {
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    weathercode: number[];
    windspeed_10m_max: number[];
    relative_humidity_2m_max: number[];
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    precipitation: number[];
  };
}

interface CachedForecast {
  data: WeatherForecast;
  timestamp: number;
}

const CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours
const FETCH_TIMEOUT_MS = 8000;
const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

function cacheKey(farmId: string): string {
  return `weather_forecast_${farmId}`;
}

function getCache(farmId: string): CachedForecast | null {
  try {
    const raw = localStorage.getItem(cacheKey(farmId));
    if (!raw) return null;
    return JSON.parse(raw) as CachedForecast;
  } catch {
    return null;
  }
}

function setCache(farmId: string, data: WeatherForecast): void {
  const entry: CachedForecast = { data, timestamp: Date.now() };
  localStorage.setItem(cacheKey(farmId), JSON.stringify(entry));
}

function isFresh(cached: CachedForecast): boolean {
  return Date.now() - cached.timestamp < CACHE_TTL_MS;
}

export function getCacheTimestamp(farmId: string): number | null {
  const cached = getCache(farmId);
  return cached ? cached.timestamp : null;
}

export function clearForecastCache(farmId: string): void {
  localStorage.removeItem(cacheKey(farmId));
}

export interface ForecastResult {
  data: WeatherForecast;
  stale: boolean;
}

export async function fetchForecast(
  lat: number,
  lng: number,
  farmId: string,
): Promise<ForecastResult | null> {
  const cached = getCache(farmId);
  if (cached && isFresh(cached)) {
    return { data: cached.data, stale: false };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      timezone: 'Africa/Johannesburg',
      forecast_days: '7',
      hourly: 'temperature_2m,precipitation',
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,windspeed_10m_max,relative_humidity_2m_max',
    });

    const res = await fetch(`${BASE_URL}?${params}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const json = await res.json();
    if (!json?.daily?.time || !Array.isArray(json.daily.time) || !json?.hourly?.time) {
      throw new Error('Unexpected API response shape');
    }
    const forecast = json as WeatherForecast;
    setCache(farmId, forecast);
    return { data: forecast, stale: false };
  } catch (err) {
    console.error('Weather fetch failed:', err);
    if (cached) {
      return { data: cached.data, stale: true };
    }
    return null;
  }
}
