// Spec 2i.5 — financing cost stream. Interest is explicit or computed as
// principal × annual rate × months/12. Rolled up by kind per year; enterprise
// routing is optional — unrouted rows stay visible as farm-wide.
const { randomUUID } = require('crypto');

const KINDS = ['working_capital', 'establishment_loan', 'land_loan', 'other'];

function round2(n) { return Math.round(n * 100) / 100; }

function addFinancingCost(db, input = {}) {
  if (!Number.isFinite(input.year)) return { error: 'year_required' };
  if (!KINDS.includes(input.kind)) return { error: 'kind_invalid', allowed: KINDS };

  let interest = typeof input.interest_zar === 'number' ? input.interest_zar : null;
  if (interest == null) {
    const { principal_zar: p, annual_rate_pct: r, months: m } = input;
    if (![p, r, m].every(v => typeof v === 'number' && v > 0)) {
      return { error: 'interest_or_principal_rate_months_required' };
    }
    interest = round2(p * (r / 100) * (m / 12));
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO financing_costs
    (id,year,kind,description,principal_zar,annual_rate_pct,months,interest_zar,enterprise,field_id,
     entry_basis,external_source,external_id,notes,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, input.year, input.kind, input.description || null,
    input.principal_zar ?? null, input.annual_rate_pct ?? null, input.months ?? null,
    interest, input.enterprise || null, input.field_id || null,
    input.entry_basis || 'estimate', input.external_source || null, input.external_id || null,
    input.notes || null, now, now);

  return db.prepare('SELECT * FROM financing_costs WHERE id = ?').get(id);
}

function financingSummary(db, year, opts = {}) {
  let rows;
  try {
    rows = db.prepare('SELECT * FROM financing_costs WHERE year = ?').all(year);
  } catch { return { year, total: 0, by_kind: {}, items: [] }; }

  const scoped = opts.enterprise ? rows.filter(r => r.enterprise === opts.enterprise) : rows;
  const byKind = {};
  for (const r of scoped) byKind[r.kind] = round2((byKind[r.kind] || 0) + r.interest_zar);

  const summary = {
    year,
    total: round2(scoped.reduce((s, r) => s + r.interest_zar, 0)),
    by_kind: byKind,
    items: scoped,
  };
  if (opts.enterprise) {
    summary.farm_wide_total = round2(
      rows.filter(r => !r.enterprise).reduce((s, r) => s + r.interest_zar, 0));
  }
  return summary;
}

module.exports = { addFinancingCost, financingSummary, KINDS };
