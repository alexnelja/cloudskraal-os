/**
 * Spec 2i.1 — shared inputs applied to selected fields (per-ha rate or total÷ha).
 * Provenance (entry_basis/external_source/external_id) baked in for future Xero import.
 */
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { initFarmSchema } from '../src/db/schema-farms.js';
import { initCalendarSchema } from '../src/db/schema-calendar.js';
import { initPhase3Schema } from '../src/db/schema-phase3.js';
import { migrateFieldCop } from '../src/db/migrate-field-cop.js';
import { initUsagePeriodsSchema } from '../src/db/schema-usage-periods.js';
import { initSharedInputsSchema } from '../src/db/schema-shared-inputs.js';
import { fieldSharedInputCost } from '../src/services/shared_inputs.js';
import { computeFieldCop } from '../src/services/cop.js';

const now = new Date().toISOString();
function makeDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initFarmSchema(db); initCalendarSchema(db); initPhase3Schema(db); migrateFieldCop(db);
  initUsagePeriodsSchema(db); initSharedInputsSchema(db);
  db.prepare(`INSERT INTO farms (id,name,code,type,created_at,updated_at) VALUES (?,?,?,?,?,?)`)
    .run('farm1', 'CK', 'CK', 'owned', now, now);
  return db;
}
function field(db, { id, enterprise = 'rooibos', area_ha = 10 }) {
  db.prepare(`INSERT INTO fields (id,farm_id,name,enterprise,area_ha,geometry,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?,?)`).run(id, 'farm1', id, enterprise, area_ha, '{}', now, now);
}
function usage(db, { id, field_id, usage }) {
  db.prepare(`INSERT INTO field_usage_period (id,field_id,usage,start_date,end_date,source,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?,?)`).run(id, field_id, usage, '2026-01-01', '2026-12-31', 'seed', now, now);
}
function sharedInput(db, s) {
  db.prepare(`INSERT INTO shared_inputs
    (id,date,year,product,cost_category,basis,rate_per_ha,total_cost_zar,usage,is_establishment,
     entry_basis,external_source,external_id,notes,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    s.id, s.date ?? '2026-03-01', s.year ?? 2026, s.product ?? 'Fertiliser',
    s.cost_category ?? 'direct_variable', s.basis, s.rate_per_ha ?? null, s.total_cost_zar ?? null,
    s.usage ?? null, s.is_establishment ?? 0, s.entry_basis ?? 'estimate',
    s.external_source ?? null, s.external_id ?? null, null, now, now);
  for (const fid of s.fields) {
    db.prepare(`INSERT INTO shared_input_fields (id,shared_input_id,field_id) VALUES (?,?,?)`)
      .run(`${s.id}-${fid}`, s.id, fid);
  }
}

describe('shared_inputs schema', () => {
  it('has the cost + provenance columns', () => {
    const db = makeDb();
    const cols = db.prepare('PRAGMA table_info(shared_inputs)').all().map(c => c.name);
    for (const c of ['basis', 'rate_per_ha', 'total_cost_zar', 'usage', 'is_establishment',
      'entry_basis', 'external_source', 'external_id']) expect(cols).toContain(c);
    db.close();
  });
  it('cascades field links on delete and enforces idempotent external id', () => {
    const db = makeDb(); field(db, { id: 'f1' });
    sharedInput(db, { id: 'si1', basis: 'per_ha_rate', rate_per_ha: 100, fields: ['f1'], external_source: 'xero', external_id: 'X1' });
    expect(db.prepare('SELECT COUNT(*) n FROM shared_input_fields').get().n).toBe(1);
    // duplicate (xero, X1) rejected
    expect(() => db.prepare(`INSERT INTO shared_inputs (id,year,basis,external_source,external_id,created_at,updated_at)
      VALUES ('si2',2026,'per_ha_rate','xero','X1',?,?)`).run(now, now)).toThrow();
    db.prepare("DELETE FROM shared_inputs WHERE id='si1'").run();
    expect(db.prepare('SELECT COUNT(*) n FROM shared_input_fields').get().n).toBe(0); // cascade
    db.close();
  });
});

describe('fieldSharedInputCost', () => {
  it('per_ha_rate = rate × field area', () => {
    const db = makeDb(); field(db, { id: 'f1', area_ha: 10 });
    sharedInput(db, { id: 'si1', basis: 'per_ha_rate', rate_per_ha: 500, fields: ['f1'] });
    expect(fieldSharedInputCost(db, 'f1', 2026).total).toBe(5000);
    db.close();
  });
  it('total_split_ha splits a bulk cost by ha share', () => {
    const db = makeDb(); field(db, { id: 'f1', area_ha: 10 }); field(db, { id: 'f2', area_ha: 30 });
    sharedInput(db, { id: 'si1', basis: 'total_split_ha', total_cost_zar: 220000, fields: ['f1', 'f2'] });
    expect(fieldSharedInputCost(db, 'f1', 2026).total).toBe(55000);   // 220000 × 10/40
    expect(fieldSharedInputCost(db, 'f2', 2026).total).toBe(165000);  // × 30/40
    db.close();
  });
  it('excludes is_establishment rows (they accrue to capital, not in-year)', () => {
    const db = makeDb(); field(db, { id: 'f1', area_ha: 10 });
    sharedInput(db, { id: 'si1', basis: 'per_ha_rate', rate_per_ha: 500, fields: ['f1'], is_establishment: 1 });
    expect(fieldSharedInputCost(db, 'f1', 2026).total).toBe(0);
    db.close();
  });
  it('warns and skips a total_split with zero total area', () => {
    const db = makeDb(); field(db, { id: 'f1', area_ha: 0 });
    sharedInput(db, { id: 'si1', basis: 'total_split_ha', total_cost_zar: 1000, fields: ['f1'] });
    const r = fieldSharedInputCost(db, 'f1', 2026);
    expect(r.total).toBe(0);
    expect(r.warnings).toContain('multi_field_split_zero_area');
    db.close();
  });
  it('only counts the queried year', () => {
    const db = makeDb(); field(db, { id: 'f1', area_ha: 10 });
    sharedInput(db, { id: 'si1', basis: 'per_ha_rate', rate_per_ha: 500, fields: ['f1'], year: 2025 });
    expect(fieldSharedInputCost(db, 'f1', 2026).total).toBe(0);
    db.close();
  });
});

describe('computeFieldCop shared-input integration (opt-in)', () => {
  function withCost(db, fieldId, usageName) {
    usage(db, { id: 'u_' + fieldId, field_id: fieldId, usage: usageName });
    db.prepare(`INSERT INTO input_products (id,name,category,unit_of_measure,cost_per_unit,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?)`).run('p_' + fieldId, 'x', 'chemical', 'l', 1, now, now);
    db.prepare(`INSERT INTO inventory_transactions
      (id,product_id,type,date,quantity,unit_cost,total_cost,field_id,cost_category,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run('t_' + fieldId, 'p_' + fieldId, 'usage', '2026-03-01', 1, 10000, 10000, fieldId, 'direct_variable', now);
  }

  it('attaches line.shared_input_cost on the enterprise line with include=shared', () => {
    const db = makeDb(); field(db, { id: 'f1', enterprise: 'rooibos', area_ha: 10 });
    withCost(db, 'f1', 'rooibos');
    sharedInput(db, { id: 'si1', basis: 'per_ha_rate', rate_per_ha: 500, fields: ['f1'] });
    const line = computeFieldCop(db, 'f1', 2026, { include: ['shared'] }).lines.find(l => l.usage === 'rooibos');
    expect(line.shared_input_cost).toBe(5000);
    db.close();
  });
  it('is absent by default + flags exclusion when rows exist', () => {
    const db = makeDb(); field(db, { id: 'f1', enterprise: 'rooibos', area_ha: 10 });
    withCost(db, 'f1', 'rooibos');
    sharedInput(db, { id: 'si1', basis: 'per_ha_rate', rate_per_ha: 500, fields: ['f1'] });
    const r = computeFieldCop(db, 'f1', 2026);
    const line = r.lines.find(l => l.usage === 'rooibos');
    expect(line.shared_input_cost).toBeUndefined();
    expect(r.coverage.excluded_layers).toContain('shared');
    db.close();
  });
  it('falls back to the single productive line when enterprise has no matching line', () => {
    const db = makeDb(); field(db, { id: 'f1', enterprise: 'rooibos', area_ha: 10 });
    withCost(db, 'f1', 'lupines'); // single productive line 'lupines' ≠ enterprise 'rooibos'
    sharedInput(db, { id: 'si1', basis: 'per_ha_rate', rate_per_ha: 500, fields: ['f1'] });
    const line = computeFieldCop(db, 'f1', 2026, { include: ['shared'] }).lines.find(l => l.usage === 'lupines');
    expect(line.shared_input_cost).toBe(5000);
    db.close();
  });
  it('warns shared_input_line_not_found when no productive line exists', () => {
    const db = makeDb(); field(db, { id: 'f1', enterprise: 'rooibos', area_ha: 10 });
    withCost(db, 'f1', 'fallow'); // non-productive only
    sharedInput(db, { id: 'si1', basis: 'per_ha_rate', rate_per_ha: 500, fields: ['f1'] });
    const r = computeFieldCop(db, 'f1', 2026, { include: ['shared'] });
    expect(r.shared_inputs.warnings).toContain('shared_input_line_not_found');
    db.close();
  });
});
