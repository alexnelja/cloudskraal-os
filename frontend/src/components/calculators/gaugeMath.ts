export function markerPercent(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  const pct = ((value - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, pct));
}

type ZoneSpec = { min: number; max: number; goodMin?: number; goodMax?: number; threshold?: number };

export function classifyZone(value: number, g: ZoneSpec): 'good' | 'edge' | 'over' {
  if (g.threshold != null && value > g.threshold) return 'over';
  const lo = g.goodMin ?? g.min;
  const hi = g.goodMax ?? g.max;
  return value >= lo && value <= hi ? 'good' : 'edge';
}
