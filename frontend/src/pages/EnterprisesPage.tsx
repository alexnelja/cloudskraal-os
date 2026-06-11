// Spec 2h.3 — enterprise comparison: one row per enterprise (kg, variable vs
// fully-loaded cost/kg, price, margin) + flock COP rows. The rooibos row
// click-through lands on the Cost Map for the layer-by-layer story.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plant } from '@phosphor-icons/react';
import PageHeader from '../components/layout/PageHeader';
import { getEnterprisesReport } from '../api/reporting';
import type { EnterprisesReport } from '../types/reporting';

const YEARS = [2024, 2025, 2026, 2027];

function fmtR(v: number | null | undefined, suffix = ''): string {
  if (v == null) return '—';
  return `R ${v.toLocaleString('en-ZA', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })}${suffix}`;
}

export default function EnterprisesPage() {
  const navigate = useNavigate();
  const [year, setYear] = useState(2026);
  const [report, setReport] = useState<EnterprisesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getEnterprisesReport(year)
      .then(setReport)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [year]);

  return (
    <div className="h-[calc(100vh-5rem)] md:h-screen flex flex-col overflow-hidden">
      <PageHeader
        icon={<Plant size={24} weight="duotone" />}
        title="Enterprises"
        subtitle="Cost per kilogram and margin, side by side — variable vs fully loaded"
        sticky
        filters={
          <div className="flex items-center gap-2 py-1">
            <select value={year} onChange={e => setYear(Number(e.target.value))} aria-label="Year"
              className="text-sm border border-stone-200 rounded-lg px-2 py-1 bg-white">
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto bg-white p-4">
        {loading && <div className="text-sm text-stone-500 p-8 text-center">Loading enterprise roll-up…</div>}
        {error && <div className="text-sm text-red-600 p-8 text-center">{error}</div>}

        {!loading && !error && report && (
          <>
            <div className="rounded-2xl border border-stone-200 overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                    <th className="px-4 py-2">Enterprise</th>
                    <th className="px-4 py-2 text-right">Fields</th>
                    <th className="px-4 py-2 text-right">ha</th>
                    <th className="px-4 py-2 text-right">Yield kg</th>
                    <th className="px-4 py-2 text-right">Cost/kg variable</th>
                    <th className="px-4 py-2 text-right">Cost/kg loaded</th>
                    <th className="px-4 py-2 text-right">Price</th>
                    <th className="px-4 py-2 text-right">Margin/kg</th>
                  </tr>
                </thead>
                <tbody>
                  {report.enterprises.map(e => {
                    const neg = (e.margin_per_kg ?? 0) < 0;
                    const clickable = e.enterprise === 'rooibos';
                    return (
                      <tr key={e.enterprise}
                        className={`border-t border-stone-100 ${clickable ? 'hover:bg-stone-50 cursor-pointer' : ''}`}
                        onClick={() => clickable && navigate('/cost-map')}
                        title={clickable ? 'Open the rooibos cost map' : undefined}>
                        <td className="px-4 py-2 font-medium">{e.enterprise.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-2 text-right">{e.fields_count}</td>
                        <td className="px-4 py-2 text-right">{e.area_ha.toLocaleString('en-ZA')}</td>
                        <td className="px-4 py-2 text-right">{e.yield_kg.toLocaleString('en-ZA')}</td>
                        <td className="px-4 py-2 text-right">{fmtR(e.cost_per_kg_variable)}</td>
                        <td className="px-4 py-2 text-right font-medium">{fmtR(e.cost_per_kg_loaded)}</td>
                        <td className="px-4 py-2 text-right">{fmtR(e.price_per_kg)}</td>
                        <td className={`px-4 py-2 text-right font-semibold ${
                          e.margin_per_kg == null ? 'text-stone-400' : neg ? 'text-red-600' : 'text-emerald-700'}`}>
                          {fmtR(e.margin_per_kg)}
                        </td>
                      </tr>
                    );
                  })}
                  {report.enterprises.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-stone-400">No enterprise data for {year}.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-stone-400">
              Loaded = variable + shared inputs + activities + overhead + capital amortisation + processing.
              Margin compares price (at its sale basis) to the loaded cost. Quality is graded at delivery, so
              realised price per kg is a band around these numbers.
            </p>

            {report.flocks.length > 0 && (
              <>
                <h3 className="mt-6 mb-2 text-[11px] font-bold uppercase tracking-[0.05em] text-stone-500">
                  Livestock (flock COP)
                </h3>
                <div className="rounded-2xl border border-stone-200 overflow-x-auto">
                  <table className="w-full text-sm min-w-[560px]">
                    <thead>
                      <tr className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                        <th className="px-4 py-2">Flock</th>
                        <th className="px-4 py-2 text-right">Cost/kg wool</th>
                        <th className="px-4 py-2 text-right">Cost/kg liveweight</th>
                        <th className="px-4 py-2 text-right">Gross margin / ewe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.flocks.map(f => (
                        <tr key={f.flock_id} className="border-t border-stone-100">
                          <td className="px-4 py-2 font-medium">{f.name}</td>
                          <td className="px-4 py-2 text-right">{fmtR(f.cost_per_kg_wool)}</td>
                          <td className="px-4 py-2 text-right">{fmtR(f.cost_per_kg_liveweight)}</td>
                          <td className={`px-4 py-2 text-right font-semibold ${
                            (f.gross_margin_per_ewe ?? 0) < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                            {fmtR(f.gross_margin_per_ewe)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
