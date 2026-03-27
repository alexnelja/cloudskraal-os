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
    <div className="bg-white p-5 rounded-2xl flex flex-col gap-1">
      <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#6e7a73]">{label}</p>
      <p className="text-3xl font-semibold text-[#005d42]">{value}</p>
      {subtitle && <p className="text-xs text-[#6e7a73]">{subtitle}</p>}
    </div>
  );
}
