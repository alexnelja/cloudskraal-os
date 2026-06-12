// COP UI — flock cost-of-production report inside the expanded livestock
// group panel. Self-contained fetch; 404 (no COP inputs for the year) shows
// a quiet hint instead of an error.
import { useEffect, useState } from 'react';
import { getFlockCostOfProduction, type FlockCOP } from '../../api/livestock';

function fmtR(v: number | null | undefined): string {
  if (v == null) return '—';
  return `R ${v.toLocaleString('en-ZA', { maximumFractionDigits: 2 })}`;
}

const YEARS = [2024, 2025, 2026, 2027];
const BUCKETS: Array<{ key: keyof FlockCOP['costs']; label: string }> = [
  { key: 'feed', label: 'Feed' },
  { key: 'labour', label: 'Labour' },
  { key: 'animal_health', label: 'Animal health' },
  { key: 'shearing', label: 'Shearing' },
  { key: 'other', label: 'Other' },
];

export default function FlockCopSection({ groupId }: { groupId: string }) {
  const [year, setYear] = useState(2026);
  const [cop, setCop] = useState<FlockCOP | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setMissing(false);
    getFlockCostOfProduction(groupId, year)
      .then(r => setCop(r))
      .catch(() => { setCop(null); setMissing(true); })
      .finally(() => setLoading(false));
  }, [groupId, year]);

  return (
    <div className="mt-3 border-t border-stone-200 pt-3" data-testid="flock-cop-section">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-stone-500">Cost of production</p>
        <select value={year} onChange={e => setYear(Number(e.target.value))} aria-label="COP year"
          className="text-xs border border-stone-200 rounded px-1.5 py-0.5 bg-white">
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading && <p className="text-xs text-stone-400">Loading…</p>}
      {!loading && missing && (
        <p className="text-xs text-stone-400">
          No COP inputs for {year} — capture them under flock COP inputs to see this report.
        </p>
      )}

      {!loading && cop && (
        <div className="space-y-3">
          {/* cost buckets */}
          <div className="space-y-1">
            {BUCKETS.map(b => {
              const v = cop.costs[b.key] || 0;
              if (v <= 0) return null;
              const pct = cop.costs.total > 0 ? (v / cop.costs.total) * 100 : 0;
              return (
                <div key={b.key}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="text-stone-500">{b.label}</span>
                    <span className="text-stone-700 font-medium">{fmtR(v)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            <div className="flex items-center justify-between text-xs pt-1 border-t border-stone-100">
              <span className="font-semibold text-stone-700">
                Total{cop.allocation.wool != null && cop.costs.total > 0
                  ? ` (wool ${fmtR(cop.allocation.wool)} / meat ${fmtR(cop.allocation.meat)})`
                  : ''}
              </span>
              <span className="font-bold text-stone-900">{fmtR(cop.costs.total)}</span>
            </div>
          </div>

          {/* per-kg + margins */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded bg-stone-50 px-2 py-1.5">
              <p className="text-stone-500 mb-0.5">Cost / kg wool</p>
              <p className="font-bold text-stone-900">{fmtR(cop.cost_per_kg_wool)}</p>
            </div>
            <div className="rounded bg-stone-50 px-2 py-1.5">
              <p className="text-stone-500 mb-0.5">Cost / kg liveweight</p>
              <p className="font-bold text-stone-900">{fmtR(cop.cost_per_kg_liveweight)}</p>
            </div>
            {cop.cost_per_weaned_lamb != null && (
              <div className="rounded bg-stone-50 px-2 py-1.5">
                <p className="text-stone-500 mb-0.5">Cost / weaned lamb</p>
                <p className="font-bold text-stone-900">{fmtR(cop.cost_per_weaned_lamb)}</p>
              </div>
            )}
            <div className={`rounded px-2 py-1.5 ${(cop.gross_margin_per_ewe ?? 0) >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
              <p className="text-stone-500 mb-0.5">Gross margin / ewe</p>
              <p className={`font-bold ${(cop.gross_margin_per_ewe ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {fmtR(cop.gross_margin_per_ewe)}
              </p>
            </div>
          </div>

          {cop.transfers_in && cop.transfers_in.total > 0 && (
            <p className="text-[11px] text-stone-500">
              Includes {fmtR(cop.transfers_in.total)} internal transfers in (grazing/feed).
            </p>
          )}
          {cop.warnings.length > 0 && (
            <p className="text-[10px] text-stone-400">{cop.warnings.join(' · ')}</p>
          )}
        </div>
      )}
    </div>
  );
}
