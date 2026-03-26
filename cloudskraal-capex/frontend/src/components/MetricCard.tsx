import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  subtitle?: string;
}

export default function MetricCard({ label, value, icon: Icon, trend, subtitle }: MetricCardProps) {
  const trendIcon =
    trend === 'up' ? (
      <TrendingUp size={16} className="text-emerald-600" />
    ) : trend === 'down' ? (
      <TrendingDown size={16} className="text-red-500" />
    ) : trend === 'neutral' ? (
      <Minus size={16} className="text-stone-400" />
    ) : null;

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">{label}</p>
          <p className="mt-1 text-2xl font-bold text-stone-800">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-stone-500">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {trendIcon}
          {Icon && (
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Icon size={20} className="text-emerald-700" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
