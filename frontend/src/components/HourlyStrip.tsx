import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

export interface HourlyStripProps {
  hours: string[] | null;
  temps: number[] | null;
  rain: number[] | null;
}

export default function HourlyStrip({ hours, temps, rain }: HourlyStripProps) {
  if (!hours || !temps || !rain) {
    return (
      <p className="text-sm text-[#6e7a73] py-3 text-center" data-testid="hourly-unavailable">
        Hourly detail available for today and tomorrow only.
      </p>
    );
  }

  const data = hours.map((h, i) => ({
    hour: h,
    temp: temps[i],
    rain: rain[i],
  }));

  return (
    <div className="overflow-x-auto" data-testid="hourly-chart">
      <div style={{ minWidth: 600, height: 120 }}>
        <ResponsiveContainer width="100%" height={120}>
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="temp" orientation="left" tick={{ fontSize: 10 }} unit="°" />
            <YAxis yAxisId="rain" orientation="right" tick={{ fontSize: 10 }} unit="mm" />
            <Tooltip />
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="temp"
              stroke="#047857"
              dot={false}
              strokeWidth={2}
              name="Temp (°C)"
            />
            <Bar
              yAxisId="rain"
              dataKey="rain"
              fill="#0ea5e9"
              fillOpacity={0.4}
              name="Rain (mm)"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
