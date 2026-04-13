import { Cloud, Sun, CloudRain, TrendingUp, TrendingDown } from 'lucide-react';

// Mock data — replace with real API later
const weather = { temp: 22, condition: 'sunny' as const, icon: Sun };
const cash = { balance: 1_245_000, delta: 3.2 };

const WEATHER_ICONS = { sunny: Sun, cloudy: Cloud, rainy: CloudRain };

interface NavWeatherCashProps {
  variant: 'sidebar' | 'mobile';
}

export default function NavWeatherCash({ variant }: NavWeatherCashProps) {
  const WeatherIcon = WEATHER_ICONS[weather.condition];
  const DeltaIcon = cash.delta >= 0 ? TrendingUp : TrendingDown;
  const deltaColor = cash.delta >= 0 ? 'text-emerald-400' : 'text-red-400';

  if (variant === 'mobile') {
    return (
      <div className="flex items-center gap-3 text-xs text-[#6e7a73]">
        <span className="flex items-center gap-1">
          <WeatherIcon size={14} />
          {weather.temp}°C
        </span>
        <span className="flex items-center gap-1">
          R{(cash.balance / 1000).toFixed(0)}K
          <DeltaIcon size={12} className={deltaColor} />
        </span>
      </div>
    );
  }

  return (
    <div className="px-5 py-3 border-b border-emerald-700 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-emerald-200">
          <WeatherIcon size={14} />
          {weather.temp}°C
        </span>
        <span className="text-emerald-400 text-[10px]">{weather.condition}</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-white font-medium">
          R{cash.balance.toLocaleString('en-ZA')}
        </span>
        <span className={`flex items-center gap-0.5 text-[10px] ${deltaColor}`}>
          <DeltaIcon size={10} />
          {Math.abs(cash.delta)}%
        </span>
      </div>
    </div>
  );
}
