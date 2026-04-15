import type { FieldProduction } from '../../types/farm';

export const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  fallow: 'bg-stone-100 text-stone-700',
  planned: 'bg-blue-100 text-blue-800',
  retired: 'bg-red-100 text-red-700',
};

export const CATEGORY_COLORS: Record<string, string> = {
  fertilizer: 'bg-emerald-100 text-emerald-700',
  herbicide: 'bg-red-100 text-red-700',
  pesticide: 'bg-amber-100 text-amber-700',
  fuel: 'bg-stone-200 text-stone-700',
  seed: 'bg-teal-100 text-teal-700',
};

export const TABS = ['Overview', 'Inputs', 'Labour', 'Costs', 'Enrichment'] as const;
export type Tab = typeof TABS[number];

export interface ChartRow {
  year: number;
  Estimated: number;
  Actual: number;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export function formatZAR(amount: number): string {
  return `R${amount.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function hasProductionData(production: FieldProduction[]): boolean {
  return production.some(p => p.estimated_yield_kg !== null || p.actual_yield_kg !== null);
}

export function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-stone-500 mb-0.5">{label}</p>
      <p className="text-sm text-stone-800 font-medium">{value}</p>
    </div>
  );
}

export function SummaryCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="rounded-lg bg-stone-50 p-2.5">
      <div className="flex items-center gap-1 mb-1">
        <span className={color}>{icon}</span>
        <p className="text-[10px] text-stone-500 uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-sm font-bold ${color}`}>{value}</p>
    </div>
  );
}

export function MetricCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-stone-100 p-3 bg-white">
      <p className="text-[10px] text-stone-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-lg font-bold text-stone-900">{value}</p>
      <p className="text-[10px] text-stone-400 mt-0.5">{sub}</p>
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="p-4 space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-12 bg-stone-100 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

export function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-stone-400">
      {icon}
      <p className="text-sm mt-2">{message}</p>
    </div>
  );
}
