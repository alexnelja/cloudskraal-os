import { Sun, Cloud, CloudRain } from 'lucide-react';

// TODO: Replace with weather API
const CURRENT_WEATHER = {
  temp: 24,
  condition: 'Partly Cloudy',
  icon: Cloud,
};

const FORECAST = [
  { day: 'Tue', icon: Sun, high: 27, low: 14 },
  { day: 'Wed', icon: Cloud, high: 22, low: 12 },
  { day: 'Thu', icon: CloudRain, high: 18, low: 10 },
];

const RAINFALL = {
  thisMonth: 42,
  average: 55,
};

export default function DashboardWeather() {
  const CurrentIcon = CURRENT_WEATHER.icon;
  const pct = Math.round((RAINFALL.thisMonth / RAINFALL.average) * 100);

  return (
    <div className="bg-white rounded-2xl p-5">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#6e7a73] mb-3">
        Weather
      </h3>

      {/* Current conditions */}
      <div className="flex items-center gap-4 mb-4">
        <CurrentIcon size={40} className="text-amber-500" />
        <div>
          <p className="text-3xl font-bold text-[#1a2e1a]">{CURRENT_WEATHER.temp}&deg;C</p>
          <p className="text-sm text-[#6e7a73]">{CURRENT_WEATHER.condition}</p>
        </div>
      </div>

      {/* 3-day forecast */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {FORECAST.map((day) => {
          const DayIcon = day.icon;
          return (
            <div key={day.day} className="text-center bg-[#f3f4f3] rounded-xl py-3 px-2">
              <p className="text-xs font-medium text-[#6e7a73] mb-1">{day.day}</p>
              <DayIcon size={20} className="mx-auto text-[#6e7a73] mb-1" />
              <p className="text-xs font-bold text-[#1a2e1a]">
                {day.high}&deg; <span className="text-[#6e7a73] font-normal">/ {day.low}&deg;</span>
              </p>
            </div>
          );
        })}
      </div>

      {/* Rainfall bar */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-[#6e7a73]">Rainfall this month</span>
          <span className="font-medium text-[#1a2e1a]">{RAINFALL.thisMonth}mm / {RAINFALL.average}mm avg</span>
        </div>
        <div className="h-2 bg-[#f3f4f3] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-500"
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
