import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { initFarmSchema } from '../src/db/schema-farms.js';
import { initPhase3Schema } from '../src/db/schema-phase3.js';
import { initCalendarSchema } from '../src/db/schema-calendar.js';
import { migrateFieldCop } from '../src/db/migrate-field-cop.js';

function setupDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initFarmSchema(db);
  initCalendarSchema(db);
  initPhase3Schema(db);
  migrateFieldCop(db);
  return db;
}

describe('migrate-field-cop', () => {
  it('adds harvest_date to field_production', () => {
    const db = setupDb();
    const cols = db.prepare('PRAGMA table_info(field_production)').all();
    expect(cols.some(c => c.name === 'harvest_date')).toBe(true);
    db.close();
  });

  it('adds cost_category to inventory_transactions with default direct_variable', () => {
    const db = setupDb();
    const cols = db.prepare('PRAGMA table_info(inventory_transactions)').all();
    const col = cols.find(c => c.name === 'cost_category');
    expect(col).toBeTruthy();
    expect(col.dflt_value).toBe("'direct_variable'");
    db.close();
  });

  it('adds cost_category to time_entries with default direct_variable', () => {
    const db = setupDb();
    const cols = db.prepare('PRAGMA table_info(time_entries)').all();
    const col = cols.find(c => c.name === 'cost_category');
    expect(col).toBeTruthy();
    db.close();
  });

  it('is idempotent — second run does not throw', () => {
    const db = setupDb();
    expect(() => migrateFieldCop(db)).not.toThrow();
    db.close();
  });

  it('creates idx_fprod_field_harvest', () => {
    const db = setupDb();
    const idx = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='field_production'"
    ).all().map(r => r.name);
    expect(idx).toContain('idx_fprod_field_harvest');
    db.close();
  });
});

import { initUsagePeriodsSchema } from '../src/db/schema-usage-periods.js';
import { usageOnDate } from '../src/services/cop.js';

function seedField(db) {
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO farms (id,name,code,type,created_at,updated_at) VALUES (?,?,?,?,?,?)`)
    .run('farm1','Test','t','owned',now,now);
  db.prepare(`INSERT INTO fields (id,farm_id,name,enterprise,geometry,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?)`)
    .run('fld1','farm1','F1','unclassified','{}',now,now);
}

function seedPeriod(db, args) {
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO field_usage_period
    (id,field_id,usage,start_date,end_date,planted_date,source,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(
      args.id, args.field_id, args.usage, args.start_date, args.end_date ?? null,
      args.planted_date ?? null, args.source ?? 'seed', now, now
    );
}

describe('usageOnDate', () => {
  it('returns the usage active on the date', () => {
    const db = setupDb();
    initUsagePeriodsSchema(db);
    seedField(db);
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'rooibos',
      start_date: '2022-01-01', end_date: null });
    expect(usageOnDate(db, 'fld1', '2026-04-14')).toEqual({
      usage: 'rooibos', period_id: 'p1'
    });
    db.close();
  });

  it('returns null when in a gap', () => {
    const db = setupDb();
    initUsagePeriodsSchema(db);
    seedField(db);
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'rooibos',
      start_date: '2022-01-01', end_date: '2024-01-01' });
    expect(usageOnDate(db, 'fld1', '2026-04-14')).toBeNull();
    db.close();
  });

  it('ignores soft-deleted periods', () => {
    const db = setupDb();
    initUsagePeriodsSchema(db);
    seedField(db);
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'rooibos',
      start_date: '2022-01-01', end_date: null });
    const now = new Date().toISOString();
    db.prepare('UPDATE field_usage_period SET deleted_at=? WHERE id=?').run(now, 'p1');
    expect(usageOnDate(db, 'fld1', '2026-04-14')).toBeNull();
    db.close();
  });

  it('picks most recent start_date when multiple overlap', () => {
    const db = setupDb();
    initUsagePeriodsSchema(db);
    seedField(db);
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'rooibos',
      start_date: '2022-01-01', end_date: '2026-03-31' });
    seedPeriod(db, { id: 'p2', field_id: 'fld1', usage: 'lupines_fourrages',
      start_date: '2026-04-01', end_date: null });
    expect(usageOnDate(db, 'fld1', '2026-05-01')).toEqual({
      usage: 'lupines_fourrages', period_id: 'p2'
    });
    db.close();
  });
});

import { periodsOverlappingYear } from '../src/services/cop.js';

describe('periodsOverlappingYear', () => {
  it('returns periods that touch the year', () => {
    const db = setupDb();
    initUsagePeriodsSchema(db);
    seedField(db);
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'rooibos',
      start_date: '2022-01-01', end_date: null });
    const rows = periodsOverlappingYear(db, 'fld1', 2026);
    expect(rows.map(r => r.id)).toEqual(['p1']);
    db.close();
  });

  it('includes periods that span two years', () => {
    const db = setupDb();
    initUsagePeriodsSchema(db);
    seedField(db);
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'lupines_fourrages',
      start_date: '2025-11-01', end_date: '2026-06-30' });
    const in2025 = periodsOverlappingYear(db, 'fld1', 2025).map(r => r.id);
    const in2026 = periodsOverlappingYear(db, 'fld1', 2026).map(r => r.id);
    expect(in2025).toContain('p1');
    expect(in2026).toContain('p1');
    db.close();
  });

  it('excludes soft-deleted', () => {
    const db = setupDb();
    initUsagePeriodsSchema(db);
    seedField(db);
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'rooibos',
      start_date: '2022-01-01', end_date: null });
    const now = new Date().toISOString();
    db.prepare('UPDATE field_usage_period SET deleted_at=? WHERE id=?').run(now, 'p1');
    expect(periodsOverlappingYear(db, 'fld1', 2026)).toEqual([]);
    db.close();
  });

  it('excludes periods entirely before the year', () => {
    const db = setupDb();
    initUsagePeriodsSchema(db);
    seedField(db);
    seedPeriod(db, { id: 'p1', field_id: 'fld1', usage: 'rooibos',
      start_date: '2020-01-01', end_date: '2021-12-31' });
    expect(periodsOverlappingYear(db, 'fld1', 2026)).toEqual([]);
    db.close();
  });
});

import { computeFieldCop } from '../src/services/cop.js';

function seedInput(db, args) {
  const now = new Date().toISOString();
  try {
    db.prepare(`INSERT INTO input_products (id,name,category,unit_of_measure,cost_per_unit,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?)`).run(args.product_id, args.product_name ?? 'X', 'fertilizer', 'kg', 10, now, now);
  } catch {}
  db.prepare(`INSERT INTO inventory_transactions
    (id,product_id,type,date,quantity,unit_cost,total_cost,field_id,cost_category,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      args.id, args.product_id, 'usage', args.date, args.quantity ?? 1,
      args.unit_cost ?? 10, args.total_cost, args.field_id,
      args.cost_category ?? 'direct_variable', now
    );
}

function seedLabour(db, args) {
  const now = new Date().toISOString();
  try {
    db.prepare(`INSERT INTO employees (id,name,type,role,hourly_rate,monthly_salary,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?,?)`).run('emp1','Japie','casual','field_worker',50,null,now,now);
  } catch {}
  db.prepare(`INSERT INTO time_entries
    (id,employee_id,date,hours_worked,field_id,cost_category,created_at)
    VALUES (?,?,?,?,?,?,?)`).run(
      args.id, 'emp1', args.date, args.hours, args.field_id,
      args.cost_category ?? 'direct_variable', now
    );
}

function seedProduction(db, args) {
  db.prepare(`INSERT INTO field_production
    (id,field_id,year,estimated_yield_kg,actual_yield_kg,harvest_date,stand_pct,notes)
    VALUES (?,?,?,?,?,?,?,?)`).run(
      args.id, args.field_id, args.year,
      args.estimated ?? null, args.actual ?? null,
      args.harvest_date ?? null, args.stand_pct ?? null, args.notes ?? null
    );
}

describe('computeFieldCop', () => {
  function setup() {
    const db = setupDb();
    initUsagePeriodsSchema(db);
    seedField(db);
    db.prepare(`UPDATE fields SET area_ha=10 WHERE id='fld1'`).run();
    return db;
  }

  it('returns shape with field, lines, totals, rotation, coverage', () => {
    const db = setup();
    const r = computeFieldCop(db, 'fld1', 2026);
    expect(r.field_id).toBe('fld1');
    expect(r.year).toBe(2026);
    expect(Array.isArray(r.lines)).toBe(true);
    expect(r.totals).toHaveProperty('total_cost');
    expect(r.coverage.excludes).toContain('overhead');
    expect(r.coverage.denominator).toBe('raw_harvest_kg');
    db.close();
  });

  it('single period, single input, single yield → one line, correct sums', () => {
    const db = setup();
    seedPeriod(db, { id:'p1', field_id:'fld1', usage:'rooibos',
      start_date:'2022-01-01', end_date:null, planted_date:'2022-01-01' });
    seedInput(db, { id:'i1', product_id:'prod1', field_id:'fld1',
      date:'2026-05-01', total_cost:100 });
    seedProduction(db, { id:'y1', field_id:'fld1', year:2026,
      actual:500, harvest_date:'2026-02-15' });
    const r = computeFieldCop(db, 'fld1', 2026);
    expect(r.lines).toHaveLength(1);
    const line = r.lines[0];
    expect(line.usage).toBe('rooibos');
    expect(line.total_input_cost).toBe(100);
    expect(line.total_cost).toBe(100);
    expect(line.actual_yield_kg).toBe(500);
    expect(line.cost_per_kg).toBe(0.2);
    expect(line.area_ha).toBe(10);
    expect(line.cost_per_ha).toBe(10);
    expect(r.totals.total_cost).toBe(100);
    db.close();
  });

  it('mid-year rotation → two lines, costs split by date', () => {
    const db = setup();
    seedPeriod(db, { id:'p1', field_id:'fld1', usage:'rooibos',
      start_date:'2022-01-01', end_date:'2026-03-31' });
    seedPeriod(db, { id:'p2', field_id:'fld1', usage:'lupines_fourrages',
      start_date:'2026-05-01', end_date:'2026-12-31' });
    seedInput(db, { id:'i1', product_id:'prod1', field_id:'fld1',
      date:'2026-02-10', total_cost:50 });
    seedInput(db, { id:'i2', product_id:'prod1', field_id:'fld1',
      date:'2026-06-01', total_cost:80 });
    const r = computeFieldCop(db, 'fld1', 2026);
    const rooibos = r.lines.find(l => l.usage === 'rooibos');
    const lupines = r.lines.find(l => l.usage === 'lupines_fourrages');
    expect(rooibos.total_input_cost).toBe(50);
    expect(lupines.total_input_cost).toBe(80);
    expect(r.totals.total_cost).toBe(130);
    expect(r.totals.uncategorized_cost).toBe(0);
    db.close();
  });

  it('input in a gap → uncategorized line', () => {
    const db = setup();
    seedPeriod(db, { id:'p1', field_id:'fld1', usage:'rooibos',
      start_date:'2022-01-01', end_date:'2026-01-31' });
    seedInput(db, { id:'i1', product_id:'prod1', field_id:'fld1',
      date:'2026-07-15', total_cost:40 });
    const r = computeFieldCop(db, 'fld1', 2026);
    const unc = r.lines.find(l => l.usage === 'uncategorized');
    expect(unc).toBeTruthy();
    expect(unc.total_input_cost).toBe(40);
    expect(r.totals.uncategorized_cost).toBe(40);
    db.close();
  });

  it('yield with null harvest_date → fallback to mid-year, warning added', () => {
    const db = setup();
    seedPeriod(db, { id:'p1', field_id:'fld1', usage:'rooibos',
      start_date:'2022-01-01', end_date:null });
    seedProduction(db, { id:'y1', field_id:'fld1', year:2026, actual:300 });
    const r = computeFieldCop(db, 'fld1', 2026);
    const rooibos = r.lines.find(l => l.usage === 'rooibos');
    expect(rooibos.actual_yield_kg).toBe(300);
    expect(rooibos.warnings).toContain('harvest_date_missing_fallback_applied');
    db.close();
  });

  it('cost_category=overhead is excluded from totals', () => {
    const db = setup();
    seedPeriod(db, { id:'p1', field_id:'fld1', usage:'rooibos',
      start_date:'2022-01-01', end_date:null });
    seedInput(db, { id:'i1', product_id:'prod1', field_id:'fld1',
      date:'2026-05-01', total_cost:100, cost_category:'direct_variable' });
    seedInput(db, { id:'i2', product_id:'prod1', field_id:'fld1',
      date:'2026-05-01', total_cost:999, cost_category:'overhead' });
    const r = computeFieldCop(db, 'fld1', 2026);
    expect(r.totals.total_cost).toBe(100);
    db.close();
  });

  it('empty field-year returns lines=[] and zeroed totals, coverage present', () => {
    const db = setup();
    const r = computeFieldCop(db, 'fld1', 2026);
    expect(r.lines).toEqual([]);
    expect(r.totals).toEqual({ total_cost:0, total_yield_kg:0, uncategorized_cost:0 });
    expect(r.coverage).toBeTruthy();
    db.close();
  });

  it('line with overlapping period but no transactions still appears', () => {
    const db = setup();
    seedPeriod(db, { id:'p1', field_id:'fld1', usage:'rooibos',
      start_date:'2022-01-01', end_date:null });
    const r = computeFieldCop(db, 'fld1', 2026);
    expect(r.lines).toHaveLength(1);
    const line = r.lines[0];
    expect(line.usage).toBe('rooibos');
    expect(line.period_ids).toEqual(['p1']);
    expect(line.total_cost).toBe(0);
    db.close();
  });

  it('labour cost uses hourly_rate × hours', () => {
    const db = setup();
    seedPeriod(db, { id:'p1', field_id:'fld1', usage:'rooibos',
      start_date:'2022-01-01', end_date:null });
    seedLabour(db, { id:'t1', field_id:'fld1', date:'2026-05-01', hours:8 });
    const r = computeFieldCop(db, 'fld1', 2026);
    const line = r.lines[0];
    expect(line.total_labour_hours).toBe(8);
    expect(line.total_labour_cost).toBe(400);
    expect(line.total_cost).toBe(400);
    db.close();
  });

  it('zero yield → cost_per_kg null', () => {
    const db = setup();
    seedPeriod(db, { id:'p1', field_id:'fld1', usage:'rooibos',
      start_date:'2022-01-01', end_date:null });
    seedInput(db, { id:'i1', product_id:'prod1', field_id:'fld1',
      date:'2026-05-01', total_cost:100 });
    const r = computeFieldCop(db, 'fld1', 2026);
    expect(r.lines[0].cost_per_kg).toBeNull();
    db.close();
  });
});

import { initConversionFactorsSchema } from '../src/db/schema-conversion-factors.js';
import { seedConversionFactors } from '../src/db/seed-conversion-factors.js';

describe('conversion_factors schema', () => {
  it('creates the table with expected columns', () => {
    const db = new Database(':memory:');
    initConversionFactorsSchema(db);
    const cols = db.prepare('PRAGMA table_info(conversion_factors)').all()
      .map(c => c.name).sort();
    expect(cols).toEqual([
      'context','created_at','effective_from','factor','from_uom',
      'id','notes','to_uom','updated_at'
    ]);
    db.close();
  });

  it('has a unique index on (from_uom, to_uom, context, effective_from)', () => {
    const db = new Database(':memory:');
    initConversionFactorsSchema(db);
    const idx = db.prepare(
      "SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='conversion_factors'"
    ).all();
    expect(idx.some(r => r.name === 'idx_factors_unique' && /UNIQUE/.test(r.sql))).toBe(true);
    db.close();
  });

  it('seeds the rooibos factors', () => {
    const db = new Database(':memory:');
    initConversionFactorsSchema(db);
    seedConversionFactors(db);
    const rows = db.prepare(
      "SELECT from_uom, to_uom, factor FROM conversion_factors WHERE context='rooibos' ORDER BY from_uom"
    ).all();
    expect(rows).toEqual([
      { from_uom: 'dried_kg', to_uom: 'sifted_netto_dry_kg', factor: 0.87 },
      { from_uom: 'harvest_wet_kg', to_uom: 'dried_kg', factor: 0.45 },
    ]);
    db.close();
  });

  it('seed is idempotent', () => {
    const db = new Database(':memory:');
    initConversionFactorsSchema(db);
    seedConversionFactors(db);
    seedConversionFactors(db);
    const n = db.prepare("SELECT COUNT(*) as c FROM conversion_factors").get().c;
    expect(n).toBe(2);
    db.close();
  });
});

import { resolveDenominator } from '../src/services/cop.js';

describe('resolveDenominator', () => {
  it('returns null when denominator is falsy', () => {
    expect(resolveDenominator('rooibos', undefined)).toBeNull();
    expect(resolveDenominator('rooibos', '')).toBeNull();
  });

  it('resolves rooibos tiers', () => {
    expect(resolveDenominator('rooibos', 'harvest')).toBe('harvest_wet_kg');
    expect(resolveDenominator('rooibos', 'dried')).toBe('dried_kg');
    expect(resolveDenominator('rooibos', 'netto_dry')).toBe('sifted_netto_dry_kg');
  });

  it('passes through unknown value as explicit UOM', () => {
    expect(resolveDenominator('rooibos', 'sifted_netto_dry_kg')).toBe('sifted_netto_dry_kg');
    expect(resolveDenominator('rooibos', 'nonsense')).toBe('nonsense');
  });

  it('passes through for unknown usage (factor chain will decide)', () => {
    expect(resolveDenominator('lupines_fourrages', 'netto_dry')).toBe('netto_dry');
  });
});

import { factorChain } from '../src/services/cop.js';

function seedFactors(db) {
  const now = new Date().toISOString();
  const ins = db.prepare(`INSERT INTO conversion_factors
    (id, from_uom, to_uom, context, factor, effective_from, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  ins.run('f1','harvest_wet_kg','dried_kg','rooibos',0.45,'2022-01-01',null,now,now);
  ins.run('f2','dried_kg','sifted_netto_dry_kg','rooibos',0.87,'2022-01-01',null,now,now);
}

describe('factorChain', () => {
  function setup() {
    const db = new Database(':memory:');
    initConversionFactorsSchema(db);
    seedFactors(db);
    return db;
  }

  it('returns 1.0 when from === to', () => {
    const db = setup();
    expect(factorChain(db, 'harvest_wet_kg', 'harvest_wet_kg', 'rooibos', '2026-12-31'))
      .toEqual({ factor: 1, path: [] });
    db.close();
  });

  it('single-hop', () => {
    const db = setup();
    const r = factorChain(db, 'harvest_wet_kg', 'dried_kg', 'rooibos', '2026-12-31');
    expect(r.factor).toBeCloseTo(0.45, 10);
    expect(r.path).toHaveLength(1);
    expect(r.path[0]).toEqual({ from_uom: 'harvest_wet_kg', to_uom: 'dried_kg', factor: 0.45, context: 'rooibos' });
    db.close();
  });

  it('multi-hop product', () => {
    const db = setup();
    const r = factorChain(db, 'harvest_wet_kg', 'sifted_netto_dry_kg', 'rooibos', '2026-12-31');
    expect(r.factor).toBeCloseTo(0.45 * 0.87, 10);
    expect(r.path).toHaveLength(2);
    db.close();
  });

  it('missing edge returns error', () => {
    const db = setup();
    const r = factorChain(db, 'harvest_wet_kg', 'nonsense_uom', 'rooibos', '2026-12-31');
    expect(r.error).toBe('factor_missing');
    expect(r.missing_edge).toBeTruthy();
    db.close();
  });

  it('asOf before effective_from returns error', () => {
    const db = setup();
    const r = factorChain(db, 'harvest_wet_kg', 'dried_kg', 'rooibos', '2020-01-01');
    expect(r.error).toBe('factor_missing');
    db.close();
  });

  it('picks most recent effective_from row for a given edge', () => {
    const db = setup();
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO conversion_factors
      (id, from_uom, to_uom, context, factor, effective_from, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('f3','harvest_wet_kg','dried_kg','rooibos',0.46,'2026-07-01',null,now,now);
    const r2025 = factorChain(db, 'harvest_wet_kg', 'dried_kg', 'rooibos', '2025-12-31');
    const r2026 = factorChain(db, 'harvest_wet_kg', 'dried_kg', 'rooibos', '2026-12-31');
    expect(r2025.factor).toBeCloseTo(0.45, 10);
    expect(r2026.factor).toBeCloseTo(0.46, 10);
    db.close();
  });
});
