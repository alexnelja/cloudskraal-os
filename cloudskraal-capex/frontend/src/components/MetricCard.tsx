import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  subtitle?: string;
}

export default function MetricCard({ label, value, subtitle }: MetricCardProps) {
  return (
    <div className="bg-white p-4 rounded-xl border border-[#bdc9c1]/15 flex flex-col gap-1">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#6e7a73]">{label}</p>
      <p className="text-2xl font-semibold text-[#005d42]">{value}</p>
      {subtitle && <p className="text-xs text-[#6e7a73]">{subtitle}</p>}
    </div>
  );
}
