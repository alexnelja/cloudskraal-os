import { TrendingUp, TrendingDown } from 'lucide-react';

interface KPI {
  label: string;
  value: string;
  delta: number;      // percentage change
  deltaLabel: string;  // e.g. "+5.2%"
}

// TODO: Replace with real API data, filtered by enterprise
const MOCK_KPIS: KPI[] = [
  { label: 'Total Hectares', value: '2,429 ha', delta: 0, deltaLabel: '0%' },
  { label: 'Livestock', value: '847 head', delta: 5.2, deltaLabel: '+5.2%' },
  { label: 'Active Projects', value: '12', delta: -2, deltaLabel: '-2' },
  { label: 'Cash Position', value: 'R1,245,000', delta: 3.2, deltaLabel: '+3.2%' },
];

interface DashboardKPIsProps {
  enterprise: string;
}

export default function DashboardKPIs({ enterprise: _enterprise }: DashboardKPIsProps) {
  // TODO: Filter KPIs by enterprise once real data is wired up
  const kpis = MOCK_KPIS;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi) => {
        const isPositive = kpi.delta > 0;
        const isNeutral = kpi.delta === 0;
        const isNegative = kpi.delta < 0;

        return (
          <div key={kpi.label} className="bg-white rounded-2xl p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#6e7a73] mb-1">
              {kpi.label}
            </p>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-[#1a2e1a]">{kpi.value}</span>
              {!isNeutral && (
                <span
                  className={`inline-flex items-center gap-0.5 text-xs font-medium mb-0.5 ${
                    isPositive ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {isPositive ? (
                    <TrendingUp size={14} />
                  ) : isNegative ? (
                    <TrendingDown size={14} />
                  ) : null}
                  {kpi.deltaLabel}
                </span>
              )}
              {isNeutral && (
                <span className="text-xs font-medium text-[#6e7a73] mb-0.5">
                  {kpi.deltaLabel}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
