// Spec 6b — field calculators: one tile per calc, schema-driven form
// (config/calculators.ts), result card with breakdown + sanity warnings.
// Inputs live in the query string so a setup is shareable by URL.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calculator, Warning, ArrowLeft } from '@phosphor-icons/react';
import PageHeader from '../components/layout/PageHeader';
import { CALCULATORS, type CalcDef } from '../config/calculators';
import { computeCalculator, getInputProductNames, type CalcResponse } from '../api/calculators';

function fmt(v: number | string | null | undefined, currency = false): string {
  if (v == null) return '—';
  if (typeof v === 'string') return v;
  return `${currency ? 'R ' : ''}${v.toLocaleString('en-ZA', { maximumFractionDigits: 2 })}`;
}

export default function CalculatorsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedType = searchParams.get('calc');
  const calc: CalcDef | undefined = CALCULATORS.find(c => c.type === selectedType);

  const [values, setValues] = useState<Record<string, string>>({});
  const [response, setResponse] = useState<CalcResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [products, setProducts] = useState<string[]>([]);

  // restore inputs from the query string when a calc is opened
  useEffect(() => {
    if (!calc) return;
    const restored: Record<string, string> = {};
    for (const f of calc.fields) {
      const v = searchParams.get(f.key);
      if (v != null) restored[f.key] = v;
    }
    setValues(restored);
    setResponse(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType]);

  useEffect(() => {
    if (calc?.fields.some(f => f.key === 'product')) {
      getInputProductNames().then(setProducts).catch(() => setProducts([]));
    }
  }, [calc]);

  const setValue = (key: string, v: string) => {
    setValues(prev => ({ ...prev, [key]: v }));
  };

  const canCompute = useMemo(
    () => !!calc && calc.fields.filter(f => f.required).every(f => (values[f.key] ?? '') !== ''),
    [calc, values],
  );

  const compute = useCallback(async () => {
    if (!calc) return;
    setBusy(true);
    try {
      const inputs: Record<string, number | string> = {};
      for (const f of calc.fields) {
        const raw = values[f.key];
        if (raw == null || raw === '') continue;
        inputs[f.key] = f.type === 'select' ? raw : Number(raw);
      }
      setResponse(await computeCalculator(calc.type, inputs));
      // persist to the query string for sharing
      const next = new URLSearchParams({ calc: calc.type });
      for (const [k, v] of Object.entries(values)) if (v !== '') next.set(k, v);
      setSearchParams(next, { replace: true });
    } catch (e) {
      setResponse({ result: {}, warnings: [], error: String(e) });
    } finally {
      setBusy(false);
    }
  }, [calc, values, setSearchParams]);

  return (
    <div className="h-[calc(100vh-5rem)] md:h-screen flex flex-col overflow-hidden">
      <PageHeader
        icon={<Calculator size={24} weight="duotone" />}
        title="Calculators"
        subtitle="Field math with the formulas locked in — shareable by URL"
        sticky
        onBack={calc ? () => setSearchParams({}) : undefined}
      />

      <div className="flex-1 overflow-y-auto bg-white p-4">
        {!calc && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl">
            {CALCULATORS.map(c => (
              <button key={c.type} type="button"
                data-testid={`tile-${c.type}`}
                onClick={() => setSearchParams({ calc: c.type })}
                className="text-left rounded-2xl border border-stone-200 p-4 hover:border-emerald-600 hover:shadow-sm transition-all">
                <div className="font-semibold text-stone-900 text-sm">{c.label}</div>
                <div className="text-xs text-stone-500 mt-1">{c.description}</div>
              </button>
            ))}
          </div>
        )}

        {calc && (
          <div className="max-w-xl">
            <button type="button" onClick={() => setSearchParams({})}
              className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 mb-3">
              <ArrowLeft size={13} /> All calculators
            </button>
            <h2 className="text-base font-semibold text-stone-900">{calc.label}</h2>
            <p className="text-xs text-stone-500 mb-4">{calc.description}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {calc.fields.map(f => (
                <div key={f.key}>
                  <label htmlFor={`calc-${f.key}`}
                    className="block text-[11px] uppercase tracking-wide font-semibold text-stone-500 mb-1">
                    {f.label}{f.unit ? ` (${f.unit})` : ''}{f.required ? ' *' : ''}
                  </label>
                  {f.type === 'select' && f.key === 'product' ? (
                    <select id={`calc-${f.key}`} value={values[f.key] ?? ''}
                      onChange={e => setValue(f.key, e.target.value)}
                      className="w-full border border-stone-200 rounded-lg px-2 py-1.5 text-sm bg-white">
                      <option value="">— optional —</option>
                      {products.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  ) : f.type === 'select' ? (
                    <select id={`calc-${f.key}`} value={values[f.key] ?? ''}
                      onChange={e => setValue(f.key, e.target.value)}
                      className="w-full border border-stone-200 rounded-lg px-2 py-1.5 text-sm bg-white">
                      <option value="">— select —</option>
                      {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input id={`calc-${f.key}`} type="number" inputMode="decimal" step="any"
                      value={values[f.key] ?? ''} placeholder={f.placeholder}
                      onChange={e => setValue(f.key, e.target.value)}
                      className="w-full border border-stone-200 rounded-lg px-2 py-1.5 text-sm bg-white" />
                  )}
                </div>
              ))}
            </div>

            <button type="button" disabled={!canCompute || busy} onClick={compute}
              className="mt-4 px-4 py-2 rounded-lg text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40">
              Compute
            </button>

            {response && (
              <div className="mt-4 rounded-2xl border border-stone-200 p-4" data-testid="calc-result">
                {response.error ? (
                  <p className="text-sm text-red-600">{response.error}</p>
                ) : (
                  <>
                    <dl className="space-y-1.5">
                      {calc.results.map(r => (
                        <div key={r.key} className="flex items-baseline justify-between gap-4">
                          <dt className="text-xs text-stone-500">{r.label}</dt>
                          <dd className="text-sm font-semibold text-stone-900">
                            {fmt(response.result[r.key], r.currency)}
                            {r.unit && response.result[r.key] != null ? ` ${r.unit}` : ''}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    {response.breakdown && (
                      <p className="mt-3 text-[11px] text-stone-400 font-mono">{response.breakdown}</p>
                    )}
                    {response.warnings.length > 0 && (
                      <ul className="mt-3 space-y-1">
                        {response.warnings.map((w, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-[11px] text-amber-700">
                            <Warning size={13} className="mt-0.5 flex-shrink-0" aria-hidden /> {w}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
