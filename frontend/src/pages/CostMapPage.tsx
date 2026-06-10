// Spec 2h.2 — the operator's lens on COP: cost build-up node map (field scope)
// + Cloudskraal-average roll-up (farm scope). Layer toggles ARE the backend
// include flags; what-if overrides recompute client-side (lib/costMapWhatIf).
import { useEffect, useMemo, useState, useCallback } from 'react';
import { TreeStructure, ArrowCounterClockwise } from '@phosphor-icons/react';
import PageHeader from '../components/layout/PageHeader';
import CostNodeMapView, { LAYER_COLORS } from '../components/costmap/CostNodeMapView';
import { getCostNodeMap, getEnterpriseSummary } from '../api/costMap';
import { getFields } from '../api/farms';
import { applyWhatIf, type WhatIfOverrides } from '../lib/costMapWhatIf';
import type { CostNodeMap, CostMapNode, EnterpriseSummary, IncludeFlag } from '../types/costMap';
import type { Field } from '../types/farm';

const ALL_FLAGS: IncludeFlag[] = ['shared', 'activities', 'overhead', 'capital', 'processing'];
const FLAG_LABELS: Record<IncludeFlag, string> = {
  shared: 'Shared inputs', activities: 'Equipment & ops', overhead: 'Overhead',
  capital: 'Capital', processing: 'Processing',
};
const DENOMS = [
  { key: '', label: 'Harvest (wet)' },
  { key: 'dried', label: 'Dried' },
  { key: 'netto_dry', label: 'Netto dry' },
];
const YEARS = [2024, 2025, 2026, 2027];

function fmtR(v: number | null | undefined, suffix = ''): string {
  if (v == null) return '—';
  return `R ${v.toLocaleString('en-ZA', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })}${suffix}`;
}

function Kpi({ label, value, delta, negative }: { label: string; value: string; delta?: number | null; negative?: boolean }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 min-w-[130px]">
      <div className="text-[11px] uppercase tracking-wide text-stone-500">{label}</div>
      <div className={`text-base font-semibold ${negative ? 'text-red-600' : 'text-stone-900'}`}>{value}</div>
      {delta != null && delta !== 0 && (
        <div className={`text-[11px] font-medium ${delta > 0 ? 'text-amber-600' : 'text-emerald-700'}`}>
          {delta > 0 ? '+' : ''}{fmtR(delta)} what-if
        </div>
      )}
    </div>
  );
}

export default function CostMapPage() {
  const [scope, setScope] = useState<'field' | 'farm'>('field');
  const [fields, setFields] = useState<Field[]>([]);
  const [fieldId, setFieldId] = useState<string>('');
  const [year, setYear] = useState(2026);
  const [denominator, setDenominator] = useState('');
  const [flags, setFlags] = useState<IncludeFlag[]>(['shared', 'activities', 'capital', 'overhead', 'processing']);
  const [map, setMap] = useState<CostNodeMap | null>(null);
  const [summary, setSummary] = useState<EnterpriseSummary | null>(null);
  const [overrides, setOverrides] = useState<WhatIfOverrides>({});
  const [editing, setEditing] = useState<{ id: string; label: string; unit: string; value: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getFields({ enterprise: 'rooibos' })
      .then(fs => {
        const withArea = fs.filter(f => (f.area_ha ?? 0) > 0);
        setFields(withArea);
        if (withArea.length && !fieldId) setFieldId(withArea[0].id);
      })
      .catch(e => setError(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const denom = denominator || undefined;
    const wantMap = scope === 'field' && fieldId
      ? getCostNodeMap(fieldId, year, flags, denom)
      : Promise.resolve(null);
    Promise.all([wantMap, getEnterpriseSummary('rooibos', year, flags, denom)])
      .then(([m, s]) => { setMap(m); setSummary(s); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [scope, fieldId, year, flags, denominator]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setOverrides({}); setEditing(null); }, [fieldId, year, denominator, scope]);

  const whatIf = useMemo(
    () => (map && !map.error ? applyWhatIf(map, overrides) : null),
    [map, overrides],
  );

  const toggleFlag = (flag: IncludeFlag) =>
    setFlags(f => (f.includes(flag) ? f.filter(x => x !== flag) : [...f, flag]));

  const openEditor = (node: CostMapNode) => {
    const unit = node.id === 'yield' ? 'kg' : node.id === 'price' ? 'R/kg' : 'R';
    const current = overrides[node.id]
      ?? (node.id === 'yield' ? node.value_kg : node.id === 'price' ? node.value_zar_per_kg : node.value_zar);
    setEditing({ id: node.id, label: node.label, unit, value: String(current ?? '') });
  };

  const commitEditor = () => {
    if (!editing) return;
    const v = parseFloat(editing.value.replace(/[^0-9.\-]/g, ''));
    if (!isNaN(v)) setOverrides(o => ({ ...o, [editing.id]: v }));
    setEditing(null);
  };

  const farmAvg = summary?.cost_per_kg ?? null;

  return (
    <div className="h-[calc(100vh-5rem)] md:h-screen flex flex-col overflow-hidden">
      <PageHeader
        icon={<TreeStructure size={24} weight="duotone" />}
        title="Cost Map"
        subtitle="How costs build up to a cost per kilogram — toggle layers, test what-ifs"
        sticky
        segmented={
          <div className="flex p-0.5 md-shape-medium" style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}>
            {(['field', 'farm'] as const).map(s => (
              <button key={s} onClick={() => setScope(s)}
                className="md-label-large px-3 py-1 md-shape-small transition-colors"
                style={{
                  backgroundColor: scope === s ? 'var(--md-sys-color-surface)' : 'transparent',
                  color: scope === s ? 'var(--md-sys-color-on-surface)' : 'var(--md-sys-color-on-surface-variant)',
                  boxShadow: scope === s ? 'var(--md-sys-elevation-1)' : undefined,
                }}>
                {s === 'field' ? 'Field' : 'Cloudskraal'}
              </button>
            ))}
          </div>
        }
        filters={
          <div className="flex items-center gap-2 flex-wrap py-1">
            {scope === 'field' && (
              <select value={fieldId} onChange={e => setFieldId(e.target.value)}
                aria-label="Field"
                className="text-sm border border-stone-200 rounded-lg px-2 py-1 bg-white max-w-[220px]">
                {fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            )}
            <select value={year} onChange={e => setYear(Number(e.target.value))} aria-label="Year"
              className="text-sm border border-stone-200 rounded-lg px-2 py-1 bg-white">
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <div className="flex items-center gap-1">
              {DENOMS.map(d => (
                <button key={d.key} onClick={() => setDenominator(d.key)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    denominator === d.key ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}>
                  {d.label}
                </button>
              ))}
            </div>
            <span className="w-px h-5 bg-stone-200 mx-1" aria-hidden />
            {ALL_FLAGS.map(flag => (
              <button key={flag} onClick={() => toggleFlag(flag)}
                aria-pressed={flags.includes(flag)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                  flags.includes(flag)
                    ? 'text-white border-transparent'
                    : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'
                }`}
                style={flags.includes(flag) ? { backgroundColor: LAYER_COLORS[flag] } : undefined}>
                {FLAG_LABELS[flag]}
              </button>
            ))}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto bg-white p-4">
        {loading && <div className="text-sm text-stone-500 p-8 text-center">Loading cost map…</div>}
        {error && <div className="text-sm text-red-600 p-8 text-center">{error}</div>}

        {!loading && !error && scope === 'field' && map && whatIf && (
          <>
            {map.error === 'no_productive_line' ? (
              <div className="text-sm text-stone-500 p-8 text-center">
                No productive usage line for this field-year — nothing to map.
              </div>
            ) : (
              <>
                <div className="flex gap-3 flex-wrap mb-4">
                  <Kpi label="Total cost" value={fmtR(whatIf.total)} delta={whatIf.deltas.total} />
                  <Kpi label={`Cost / kg (${map.denominator})`} value={fmtR(whatIf.unitCost, '/kg')} delta={whatIf.deltas.unitCost} />
                  <Kpi label="Price" value={fmtR(whatIf.pricePerKg, '/kg')} />
                  <Kpi label="Margin / kg" value={fmtR(whatIf.marginPerKg, '/kg')}
                    delta={whatIf.deltas.marginPerKg} negative={(whatIf.marginPerKg ?? 0) < 0} />
                  <Kpi label="Cloudskraal avg" value={fmtR(farmAvg, '/kg')} />
                </div>

                {Object.keys(overrides).length > 0 && (
                  <div className="flex items-center gap-2 mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 w-fit">
                    What-if mode — {Object.keys(overrides).length} override{Object.keys(overrides).length > 1 ? 's' : ''} active
                    <button onClick={() => setOverrides({})}
                      className="inline-flex items-center gap-1 font-medium text-amber-800 hover:underline">
                      <ArrowCounterClockwise size={13} /> Reset
                    </button>
                  </div>
                )}

                <div className="rounded-2xl border border-stone-200 overflow-x-auto">
                  <CostNodeMapView
                    map={map}
                    overrides={overrides}
                    whatIf={whatIf}
                    onNodeClick={openEditor}
                    onToggleLayer={f => toggleFlag(f as IncludeFlag)}
                  />
                </div>
                {map.warnings.length > 0 && (
                  <div className="mt-2 text-[11px] text-stone-400">{map.warnings.join(' · ')}</div>
                )}
              </>
            )}
          </>
        )}

        {!loading && !error && scope === 'farm' && summary && (
          <>
            <div className="flex gap-3 flex-wrap mb-4">
              <Kpi label="Total cost (rooibos)" value={fmtR(summary.total_cost)} />
              <Kpi label="Total yield" value={`${summary.total_yield_kg.toLocaleString('en-ZA')} kg`} />
              <Kpi label="Cloudskraal avg cost" value={fmtR(summary.cost_per_kg, '/kg')} />
              <Kpi label="Price" value={fmtR(summary.price_per_kg, '/kg')} />
              <Kpi label="Margin / kg" value={fmtR(summary.margin_per_kg, '/kg')}
                negative={(summary.margin_per_kg ?? 0) < 0} />
            </div>
            <div className="rounded-2xl border border-stone-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                    <th className="px-4 py-2">Field</th>
                    <th className="px-4 py-2 text-right">Cost</th>
                    <th className="px-4 py-2 text-right">Yield kg</th>
                    <th className="px-4 py-2 text-right">R/kg</th>
                    <th className="px-4 py-2 w-1/3">vs Cloudskraal avg</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.fields
                    .slice()
                    .sort((a, b) => (b.cost_per_kg ?? -1) - (a.cost_per_kg ?? -1))
                    .map(f => {
                      const ratio = farmAvg && f.cost_per_kg != null ? f.cost_per_kg / farmAvg : null;
                      return (
                        <tr key={f.field_id} className="border-t border-stone-100 hover:bg-stone-50 cursor-pointer"
                          onClick={() => { setScope('field'); setFieldId(f.field_id); }}>
                          <td className="px-4 py-2">{f.name}</td>
                          <td className="px-4 py-2 text-right">{fmtR(f.total_cost)}</td>
                          <td className="px-4 py-2 text-right">{f.yield_kg.toLocaleString('en-ZA')}</td>
                          <td className={`px-4 py-2 text-right font-medium ${
                            ratio != null && ratio > 1 ? 'text-amber-700' : 'text-emerald-700'}`}>
                            {fmtR(f.cost_per_kg)}
                          </td>
                          <td className="px-4 py-2">
                            {ratio != null && (
                              <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                                <div className="h-full rounded-full"
                                  style={{
                                    width: `${Math.min(100, ratio * 50)}%`,
                                    backgroundColor: ratio > 1 ? '#d97706' : '#059669',
                                  }} />
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  {summary.fields.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-stone-400">
                      No rooibos field data for {year}.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-5 w-80" onClick={e => e.stopPropagation()}>
            <div className="text-sm font-semibold text-stone-800 mb-1">What-if: {editing.label}</div>
            <div className="text-xs text-stone-500 mb-3">Set a hypothetical value ({editing.unit}) and watch cost/kg move.</div>
            <input
              autoFocus
              value={editing.value}
              aria-label={`What-if value for ${editing.label}`}
              onChange={e => setEditing({ ...editing, value: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') commitEditor(); if (e.key === 'Escape') setEditing(null); }}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm mb-3"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditing(null)}
                className="px-3 py-1.5 text-sm rounded-lg text-stone-600 hover:bg-stone-100">Cancel</button>
              <button onClick={commitEditor}
                className="px-3 py-1.5 text-sm rounded-lg bg-emerald-700 text-white hover:bg-emerald-800">Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
