import { useState, useEffect, useCallback } from 'react';
import { Warning, CloudSlash, ArrowClockwise } from '@phosphor-icons/react';
import { getFarms } from '../api/farms';
import { fetchForecast, getCacheTimestamp, clearForecastCache } from '../api/weather';
import type { WeatherForecast } from '../api/weather';
import type { Farm } from '../types/farm';
import { getWeatherInfo } from '../config/weather-codes';
import HourlyStrip from './HourlyStrip';

function dayLabel(dateStr: string, index: number): string {
  if (index === 0) return 'Today';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-ZA', { weekday: 'short' });
}

function relativeTime(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff}m ago`;
  const hours = Math.floor(diff / 60);
  return `${hours}h ago`;
}

export default function WeatherForecastPanel() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(0);
  const [isStale, setIsStale] = useState(false);
  const [cacheTime, setCacheTime] = useState<number | null>(null);
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  useEffect(() => {
    getFarms()
      .then((f) => {
        setFarms(f);
        if (f.length > 0 && !selectedFarmId) {
          setSelectedFarmId(f[0].id);
        }
      })
      .catch(() => {
        setLoading(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedFarm = farms.find((f) => f.id === selectedFarmId);

  const loadForecast = useCallback(async (farm: Farm) => {
    setLoading(true);
    setIsStale(false);

    const tsBefore = getCacheTimestamp(farm.id);
    const data = await fetchForecast(farm.lat, farm.lng, farm.id);
    const tsAfter = getCacheTimestamp(farm.id);

    setForecast(data);
    setSelectedDay(0);
    setCacheTime(tsAfter);

    // Stale = we got data but the cache timestamp didn't change (fetch failed, used stale cache)
    if (data && tsBefore !== null && tsAfter === tsBefore) {
      setIsStale(true);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (selectedFarm) {
      loadForecast(selectedFarm);
    }
  }, [selectedFarm, loadForecast]);

  const handleRetry = () => {
    if (selectedFarm) {
      clearForecastCache(selectedFarm.id);
      loadForecast(selectedFarm);
    }
  };

  // No coordinates state
  if (selectedFarm && (selectedFarm.lat == null || selectedFarm.lng == null)) {
    return (
      <div className="bg-white rounded-2xl p-5">
        <p className="text-sm text-[#6e7a73]">
          No location set for this farm. Add coordinates on the Map page.
        </p>
      </div>
    );
  }

  // Build hourly data for selected day
  let hourlyHours: string[] | null = null;
  let hourlyTemps: number[] | null = null;
  let hourlyRain: number[] | null = null;

  if (forecast && selectedDay < 2) {
    const startIdx = selectedDay * 24;
    const endIdx = startIdx + 24;
    hourlyHours = forecast.hourly.time
      .slice(startIdx, endIdx)
      .map((t) => t.split('T')[1]?.substring(0, 5) ?? t);
    hourlyTemps = forecast.hourly.temperature_2m.slice(startIdx, endIdx);
    hourlyRain = forecast.hourly.precipitation.slice(startIdx, endIdx);
  }

  // Frost and heat alerts
  const alerts: Array<{ type: 'frost' | 'heat'; day: string; temp: number }> = [];
  if (forecast) {
    forecast.daily.temperature_2m_min.forEach((min, i) => {
      if (min < 2) {
        alerts.push({ type: 'frost', day: dayLabel(forecast.daily.time[i], i), temp: Math.round(min) });
      }
    });
    forecast.daily.temperature_2m_max.forEach((max, i) => {
      if (max > 38) {
        alerts.push({ type: 'heat', day: dayLabel(forecast.daily.time[i], i), temp: Math.round(max) });
      }
    });
  }

  return (
    <div className="bg-white rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#6e7a73]">
          7-Day Forecast
        </h2>
        {farms.length > 0 && (
          <select
            className="text-sm border border-gray-200 rounded-lg px-2 py-1 text-gray-700 bg-white"
            value={selectedFarmId ?? ''}
            onChange={(e) => setSelectedFarmId(e.target.value)}
            role="combobox"
          >
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Stale indicator */}
      {isStale && cacheTime && (
        <div className="flex items-center gap-1.5 text-xs text-[#6e7a73] mb-3">
          <CloudSlash size={16} />
          <span>Last updated {relativeTime(cacheTime)}</span>
        </div>
      )}

      {/* Alerts */}
      {(showAllAlerts ? alerts : alerts.slice(0, 2)).map((alert, i) => (
        <div
          key={i}
          className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg mb-2 ${
            alert.type === 'frost'
              ? 'bg-amber-50 text-amber-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          <Warning size={16} weight="regular" />
          {alert.type === 'frost'
            ? `Frost risk on ${alert.day}: ${alert.temp}\u00B0C low`
            : `Heat stress on ${alert.day}: ${alert.temp}\u00B0C high`}
        </div>
      ))}
      {alerts.length > 2 && !showAllAlerts && (
        <button
          onClick={() => setShowAllAlerts(true)}
          className="text-xs text-emerald-700 hover:text-emerald-800 font-medium mb-2"
        >
          Show all ({alerts.length} alerts)
        </button>
      )}

      {/* Loading */}
      {loading && (
        <div className="py-8 text-center text-sm text-[#6e7a73]">Loading forecast...</div>
      )}

      {/* Empty state */}
      {!loading && !forecast && (
        <div className="py-8 text-center">
          <p className="text-sm text-[#6e7a73] mb-3">
            Weather data unavailable. Check your connection.
          </p>
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-1.5 text-sm text-emerald-700 hover:text-emerald-800 font-medium"
            aria-label="Retry"
          >
            <ArrowClockwise size={16} />
            Retry
          </button>
        </div>
      )}

      {/* Day cards */}
      {!loading && forecast && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {forecast.daily.time.map((date, i) => {
              const info = getWeatherInfo(forecast.daily.weathercode[i]);
              const Icon = info.icon;
              const high = Math.round(forecast.daily.temperature_2m_max[i]);
              const low = Math.round(forecast.daily.temperature_2m_min[i]);
              const rain = Math.round(forecast.daily.precipitation_sum[i]);
              const wind = Math.round(forecast.daily.windspeed_10m_max[i]);
              const isSelected = selectedDay === i;

              return (
                <button
                  key={date}
                  data-testid="day-card"
                  onClick={() => setSelectedDay(i)}
                  aria-label={`${dayLabel(date, i)}: ${info.label}, ${high}° high, ${low}° low`}
                  aria-pressed={isSelected}
                  className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl text-center min-w-[90px] transition-colors ${
                    isSelected
                      ? 'border-b-2 border-emerald-600 bg-emerald-50/50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="text-xs font-semibold text-gray-700">
                    {dayLabel(date, i)}
                  </span>
                  <Icon size={18} weight="regular" className="text-gray-600" />
                  <span className="text-[10px] text-[#6e7a73]">{info.label}</span>
                  <span className="text-sm font-semibold text-gray-800">
                    {high}&deg; / {low}&deg;
                  </span>
                  {rain > 0 && (
                    <span className="text-[10px] text-sky-600">{rain} mm</span>
                  )}
                  <span className="text-[10px] text-[#6e7a73]">{wind} km/h</span>
                </button>
              );
            })}
          </div>

          {/* Hourly strip */}
          <div className="mt-3">
            <HourlyStrip hours={hourlyHours} temps={hourlyTemps} rain={hourlyRain} />
          </div>
        </>
      )}
    </div>
  );
}
