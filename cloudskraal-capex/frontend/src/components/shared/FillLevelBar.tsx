interface FillLevelBarProps {
  label: string;
  current: number;  // 0-100
  unit?: string;
  thresholds?: { low: number; warning: number }; // defaults: low=20, warning=40
}

export default function FillLevelBar({ label, current, unit = '%', thresholds = { low: 20, warning: 40 } }: FillLevelBarProps) {
  const color = current <= thresholds.low
    ? 'bg-red-500'
    : current <= thresholds.warning
    ? 'bg-amber-500'
    : 'bg-emerald-500';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-[#6e7a73]">{label}</span>
        <span className="font-medium text-[#1a2e1a]">{current}{unit}</span>
      </div>
      <div className="h-2 bg-[#f3f4f3] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(current, 100)}%` }}
        />
      </div>
    </div>
  );
}
