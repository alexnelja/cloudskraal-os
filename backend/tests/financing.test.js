/**
 * Spec 2i.5 — financing costs: working-capital + establishment/land-loan
 * interest as a SEPARATE stream (principal × rate × period), not an overhead
 * allocation. Rollup by kind + optional enterprise routing.
 */
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { initFarmSchema } from '../src/db/schema-farms.js';
import { initFinancingSchema } from '../src/db/schema-financing.js';
import { addFinancingCost, financingSummary } from '../src/services/financing.js';

const now = new Date().toISOString();
function makeDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initFarmSchema(db); initFinancingSchema(db);
  return db;
}

describe('schema', () => {
  it('financing_costs has the stream + provenance columns', () => {
    const db = makeDb();
    const cols = db.prepare('PRAGMA table_info(financing_costs)').all().map(c => c.name);
    for (const c of ['year', 'kind', 'principal_zar', 'annual_rate_pct', 'months',
      'interest_zar', 'enterprise', 'entry_basis', 'external_source', 'external_id'])
      expect(cols).toContain(c);
    db.close();
  });
});

describe('addFinancingCost', () => {
  it('computes interest = principal × rate × months/12 when not given', () => {
    const db = makeDb();
    const r = addFinancingCost(db, {
      year: 2026, kind: 'working_capital', description: 'Produksielening',
      principal_zar: 1_000_000, annual_rate_pct: 9, months: 12,
    });
    expect(r.interest_zar).toBe(90000);
    const r6 = addFinancingCost(db, {
      year: 2026, kind: 'working_capital', principal_zar: 1_000_000, annual_rate_pct: 9, months: 6,
    });
    expect(r6.interest_zar).toBe(45000);
    db.close();
  });
  it('an explicit interest amount wins over the computation', () => {
    const db = makeDb();
    const r = addFinancingCost(db, {
      year: 2026, kind: 'land_loan', interest_zar: 123456,
    });
    expect(r.interest_zar).toBe(123456);
    db.close();
  });
  it('rejects an invalid kind and a row with neither interest nor the computing trio', () => {
    const db = makeDb();
    expect(addFinancingCost(db, { year: 2026, kind: 'magic' }).error).toBe('kind_invalid');
    expect(addFinancingCost(db, { year: 2026, kind: 'working_capital' }).error)
      .toBe('interest_or_principal_rate_months_required');
    db.close();
  });
});

describe('financingSummary', () => {
  function seed(db) {
    addFinancingCost(db, { year: 2026, kind: 'working_capital', principal_zar: 1_000_000, annual_rate_pct: 9, months: 12, enterprise: 'rooibos' });
    addFinancingCost(db, { year: 2026, kind: 'establishment_loan', interest_zar: 60000, enterprise: 'rooibos' });
    addFinancingCost(db, { year: 2026, kind: 'land_loan', interest_zar: 200000 });          // farm-wide
    addFinancingCost(db, { year: 2025, kind: 'working_capital', interest_zar: 50000 });     // other year
  }
  it('rolls up by kind for the year', () => {
    const db = makeDb(); seed(db);
    const r = financingSummary(db, 2026);
    expect(r.total).toBe(350000);                       // 90k + 60k + 200k
    expect(r.by_kind.working_capital).toBe(90000);
    expect(r.by_kind.establishment_loan).toBe(60000);
    expect(r.by_kind.land_loan).toBe(200000);
    expect(r.items.length).toBe(3);
    db.close();
  });
  it('filters by enterprise, keeping unrouted rows visible as farm_wide', () => {
    const db = makeDb(); seed(db);
    const r = financingSummary(db, 2026, { enterprise: 'rooibos' });
    expect(r.total).toBe(150000);                       // rooibos-routed only
    expect(r.farm_wide_total).toBe(200000);             // land loan, unrouted
    db.close();
  });
});
