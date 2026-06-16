import type { GaugeSpec } from '../../config/calculators';
import { markerPercent, classifyZone } from './gaugeMath';

const ZONE_COLOR = {
  good: 'var(--md-sys-color-primary, #047857)',
  edge: '#b45309',
  over: '#dc2626',
} as const;

export default function EnvelopeGauge({
  value, gauge, recommended,
}: { value: number; gauge: GaugeSpec; recommended?: number }) {
  const pct = markerPercent(value, gauge.min, gauge.max);
  const zone = classifyZone(value, gauge);
  const isLadder = !!gauge.ticks?.length;
  const goodLeft = markerPercent(gauge.goodMin ?? gauge.min, gauge.min, gauge.max);
  const goodRight = markerPercent(gauge.goodMax ?? gauge.max, gauge.min, gauge.max);

  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-2xl font-bold" style={{ color: ZONE_COLOR[zone] }}>
          {value.toLocaleString('en-ZA', { maximumFractionDigits: 2 })}
        </span>
        {gauge.unit && <span className="text-xs text-stone-500">{gauge.unit}</span>}
      </div>
      <div className="relative h-3 rounded-full bg-stone-100">
        {!isLadder && (
          <div className="absolute inset-y-0 rounded-full bg-emerald-100"
               style={{ left: `${goodLeft}%`, width: `${Math.max(0, goodRight - goodLeft)}%` }} />
        )}
        {gauge.threshold != null && (
          <div className="absolute inset-y-[-3px] w-0.5 bg-red-500"
               style={{ left: `${markerPercent(gauge.threshold, gauge.min, gauge.max)}%` }} />
        )}
        {isLadder && gauge.ticks!.map((t) => (
          <div key={t.value}
               data-testid={`gauge-tick-${t.value}`}
               data-recommended={String(recommended === t.value)}
               className="absolute inset-y-[-2px] w-px"
               style={{ left: `${markerPercent(t.value, gauge.min, gauge.max)}%`,
                        background: recommended === t.value ? ZONE_COLOR.good : '#d6d3d1' }} />
        ))}
        <div data-testid="gauge-marker" data-pct={String(pct)} data-zone={zone}
             className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 border-white shadow"
             style={{ left: `${pct}%`, background: ZONE_COLOR[zone] }} />
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-stone-400">
        <span>{gauge.min}</span><span>{gauge.max}</span>
      </div>
    </div>
  );
}
