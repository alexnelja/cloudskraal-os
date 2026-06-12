// COP UI — per-line margin block: price vs cost at the price's sale basis.
// Null margin (no price / non-productive line) renders nothing.
import type { CopMargin } from '../../types/farm';

function fmtR(v: number | null | undefined): string {
  if (v == null) return '—';
  return `R ${v.toLocaleString('en-ZA', { maximumFractionDigits: 2 })}`;
}

export default function CopMarginBlock({ margin }: { margin?: CopMargin | null }) {
  if (!margin || margin.price_per_kg == null) return null;
  const pos = (v: number | null) => (v ?? 0) >= 0;

  return (
    <div className="space-y-2 border-t border-stone-100 pt-3" data-testid="cop-margin-block">
      <p className="text-xs font-semibold text-stone-700">
        Margin · price basis {margin.price_basis.replace(/_/g, ' ')}
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded bg-stone-50 px-2 py-1.5">
          <p className="text-stone-500 mb-0.5">Price / kg</p>
          <p className="font-bold text-stone-900">{fmtR(margin.price_per_kg)}</p>
        </div>
        <div className="rounded bg-stone-50 px-2 py-1.5">
          <p className="text-stone-500 mb-0.5">Cost / kg @ basis</p>
          <p className="font-bold text-stone-900">{fmtR(margin.cost_per_kg_at_price_basis)}</p>
        </div>
        <div className={`rounded px-2 py-1.5 ${pos(margin.margin_per_kg) ? 'bg-emerald-50' : 'bg-red-50'}`}>
          <p className="text-stone-500 mb-0.5">Margin / kg</p>
          <p className={`font-bold ${pos(margin.margin_per_kg) ? 'text-emerald-700' : 'text-red-600'}`}>
            {fmtR(margin.margin_per_kg)}
          </p>
        </div>
        <div className={`rounded px-2 py-1.5 ${pos(margin.margin_per_ha) ? 'bg-emerald-50' : 'bg-red-50'}`}>
          <p className="text-stone-500 mb-0.5">Margin / ha</p>
          <p className={`font-bold ${pos(margin.margin_per_ha) ? 'text-emerald-700' : 'text-red-600'}`}>
            {fmtR(margin.margin_per_ha)}
          </p>
        </div>
      </div>
      <div className="flex items-baseline justify-between text-xs px-0.5">
        <span className="text-stone-500">
          Gross revenue {fmtR(margin.gross_revenue)}
          {margin.yield_at_price_basis_kg != null
            ? ` · ${margin.yield_at_price_basis_kg.toLocaleString('en-ZA')} kg @ basis`
            : ''}
        </span>
        <span className={`font-bold ${pos(margin.margin_total) ? 'text-emerald-700' : 'text-red-600'}`}>
          {fmtR(margin.margin_total)}{margin.margin_pct != null ? ` (${margin.margin_pct.toFixed(1)}%)` : ''}
        </span>
      </div>
    </div>
  );
}
