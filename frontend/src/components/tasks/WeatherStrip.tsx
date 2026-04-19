import { ArrowClockwise } from '@phosphor-icons/react';
import type { WeatherBlock } from '../../lib/weatherBlocking';

interface WeatherStripProps {
  blocks: WeatherBlock[];
  wind: number;
  temp: number;
  rain: number;
  onRefresh?: () => void;
}

export default function WeatherStrip({ blocks, wind, temp, rain, onRefresh }: WeatherStripProps) {
  const hasBlocked = blocks.some((b) => b.severity === 'blocked');
  const hasWarning = blocks.some((b) => b.severity === 'warning');

  // Summarise blocks by reason
  const summaries: string[] = [];
  if (hasBlocked || hasWarning) {
    const windBlocks = blocks.filter((b) => b.reason === 'weather_wind');
    const rainBlocks = blocks.filter((b) => b.reason === 'weather_rain');
    const frostBlocks = blocks.filter((b) => b.reason === 'weather_frost');
    const heatBlocks = blocks.filter((b) => b.reason === 'weather_heat');

    if (windBlocks.length > 0) {
      const clearsLabel = windBlocks[0].clearsAt
        ? ` until ${new Date(windBlocks[0].clearsAt + 'T00:00:00').toLocaleDateString('en-ZA', { weekday: 'short' })}`
        : '';
      summaries.push(
        `Wind ${wind} km/h — ${windBlocks.length} task${windBlocks.length > 1 ? 's' : ''} blocked${clearsLabel}`,
      );
    }
    if (rainBlocks.length > 0) {
      summaries.push(
        `Rain ${rain}mm — ${rainBlocks.length} task${rainBlocks.length > 1 ? 's' : ''} at risk`,
      );
    }
    if (frostBlocks.length > 0) {
      summaries.push(
        `Frost risk — ${frostBlocks.length} livestock task${frostBlocks.length > 1 ? 's' : ''} warned`,
      );
    }
    if (heatBlocks.length > 0) {
      summaries.push(
        `Heat ${temp}°C — ${heatBlocks.length} task${heatBlocks.length > 1 ? 's' : ''} warned`,
      );
    }
  }

  const bgClass = hasBlocked
    ? 'bg-red-50 border-red-200'
    : hasWarning
      ? 'bg-amber-50 border-amber-200'
      : 'bg-white/60 backdrop-blur border-stone-200/60';

  const textClass = hasBlocked
    ? 'text-red-800'
    : hasWarning
      ? 'text-amber-800'
      : 'text-stone-600';

  return (
    <div
      className={`rounded-xl px-4 py-2 text-sm border flex items-center gap-3 ${bgClass}`}
      data-testid="weather-strip"
    >
      <div className={`flex-1 ${textClass}`}>
        {summaries.length > 0 ? (
          <div className="space-y-0.5">
            {summaries.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span>{hasBlocked ? '🚫' : '⚠️'}</span>
                <span>{s}</span>
              </div>
            ))}
          </div>
        ) : (
          <span>
            ☀️ {Math.round(temp)}°C | Wind {Math.round(wind)} km/h | {Math.round(rain)}mm rain
          </span>
        )}
      </div>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          className="p-1 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors flex-shrink-0"
          aria-label="Refresh weather"
        >
          <ArrowClockwise size={16} />
        </button>
      )}
    </div>
  );
}
