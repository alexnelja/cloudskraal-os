// Spec 2h.3 — farm-wide COP data-quality widget for the Dashboard: surfaces
// uncategorized spend, costed-but-yieldless fields, off-layers with data, and
// the top line warnings so the operator can triage. Renders nothing on error.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Warning, CheckCircle } from '@phosphor-icons/react';
import { getDataQuality } from '../api/reporting';
import type { DataQualityReport } from '../types/reporting';

const LAYER_LABELS: Record<string, string> = {
  shared: 'shared inputs', activities: 'activities',
};

function fmtR(v: number): string {
  return `R ${v.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`;
}

export default function DataQualityCard({ year = new Date().getFullYear() }: { year?: number }) {
  const [dq, setDq] = useState<DataQualityReport | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getDataQuality(year).then(setDq).catch(() => setFailed(true));
  }, [year]);

  if (failed || !dq) return null;

  const issues: { key: string; text: string; to?: string }[] = [];
  if (dq.uncategorized.total_zar > 0) {
    issues.push({
      key: 'uncat',
      text: `${fmtR(dq.uncategorized.total_zar)} uncategorized spend on ${dq.uncategorized.fields.length} field${dq.uncategorized.fields.length === 1 ? '' : 's'} (no usage period covers the date)`,
    });
  }
  if (dq.costed_no_yield.length > 0) {
    issues.push({
      key: 'noyield',
      text: `${dq.costed_no_yield.length} field-line${dq.costed_no_yield.length === 1 ? '' : 's'} carry costs but no ${dq.year} yield — cost/kg is blind there`,
    });
  }
  for (const [layer, n] of Object.entries(dq.excluded_layers)) {
    issues.push({
      key: `layer-${layer}`,
      text: `${n} field${n === 1 ? '' : 's'} have ${LAYER_LABELS[layer] ?? layer} data not shown in default COP`,
      to: '/cost-map',
    });
  }
  const topWarnings = Object.entries(dq.warning_counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div className="bg-white rounded-2xl p-5" data-testid="data-quality-card">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--md-sys-color-on-surface-variant)] mb-3">
        COP data quality · {dq.year} · {dq.fields_scanned} fields scanned
      </h3>
      {issues.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle size={18} weight="duotone" aria-hidden /> No data-quality issues found.
        </div>
      ) : (
        <ul className="space-y-2">
          {issues.map(i => (
            <li key={i.key} className="flex items-start gap-2 text-sm text-stone-700">
              <Warning size={16} weight="duotone" className="text-amber-600 mt-0.5 flex-shrink-0" aria-hidden />
              {i.to ? <Link to={i.to} className="hover:underline">{i.text}</Link> : <span>{i.text}</span>}
            </li>
          ))}
        </ul>
      )}
      {topWarnings.length > 0 && (
        <div className="mt-3 text-[11px] text-stone-400">
          Warnings: {topWarnings.map(([w, n]) => `${w} ×${n}`).join(' · ')}
        </div>
      )}
    </div>
  );
}
