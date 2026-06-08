/**
 * Tests for COP × enterprise_prices → margin.
 *
 * Covers:
 *  - price_basis column on enterprise_prices (schema + self-migration)
 *  - seedEnterprisePrices sets rooibos basis = sifted_netto_dry_kg
 *  - computeLineMargin: basis-aligned per-line margin, exact price-year match,
 *    graceful null + warnings (no price, unconvertible basis, zero yield)
 *  - computeFieldCop integration: productive line gets margin, non-productive null
 */

import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { initFarmSchema } from '../src/db/schema-farms.js';
import { initPhase3Schema } from '../src/db/schema-phase3.js';
import { initCalendarSchema } from '../src/db/schema-calendar.js';
import { migrateFieldCop } from '../src/db/migrate-field-cop.js';
import { initUsagePeriodsSchema } from '../src/db/schema-usage-periods.js';
import { initEnterprisePricesSchema } from '../src/db/schema-enterprise-prices.js';
import { seedEnterprisePrices } from '../src/db/seed-enterprise-prices.js';
import { initConversionFactorsSchema } from '../src/db/schema-conversion-factors.js';
import { seedConversionFactors } from '../src/db/seed-conversion-factors.js';
import { computeLineMargin, computeFieldCop } from '../src/services/cop.js';
import { migrateEnterprisePriceBasis } from '../src/db/migrate-enterprise-price-basis.js';

// ─── shared setup ────────────────────────────────────────────────────────────

function makeDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initFarmSchema(db);
  initCalendarSchema(db);
  initPhase3Schema(db);
  migrateFieldCop(db);
  initUsagePeriodsSchema(db);
  initConversionFactorsSchema(db);
  seedConversionFactors(db);
  initEnterprisePricesSchema(db);
  return db;
}

function insertPrice(db, { enterprise, year, price_per_kg, price_basis }) {
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO enterprise_prices
    (id, enterprise, year, price_per_kg, price_basis, notes, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?)`)
    .run(`${enterprise}-${year}`, enterprise, year, price_per_kg, price_basis, null, now, now);
}

// ─── schema + seed ───────────────────────────────────────────────────────────

describe('enterprise_prices price_basis column', () => {
  it('initEnterprisePricesSchema creates the price_basis column on a fresh DB', () => {
    const db = new Database(':memory:');
    initEnterprisePricesSchema(db);
    const cols = db.prepare('PRAGMA table_info(enterprise_prices)').all();
    expect(cols.some(c => c.name === 'price_basis')).toBe(true);
    db.close();
  });

  it('adds price_basis to a pre-existing table that lacks it (self-migration)', () => {
    const db = new Database(':memory:');
    // simulate an old DB created before the column existed
    db.exec(`CREATE TABLE enterprise_prices (
      id TEXT PRIMARY KEY, enterprise TEXT NOT NULL, year INTEGER NOT NULL,
      price_per_kg REAL NOT NULL, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );`);
    expect(db.prepare('PRAGMA table_info(enterprise_prices)').all()
      .some(c => c.name === 'price_basis')).toBe(false);
    initEnterprisePricesSchema(db);
    expect(db.prepare('PRAGMA table_info(enterprise_prices)').all()
      .some(c => c.name === 'price_basis')).toBe(true);
    // idempotent — second run does not throw
    expect(() => initEnterprisePricesSchema(db)).not.toThrow();
    db.close();
  });

  it('seedEnterprisePrices sets rooibos price_basis = sifted_netto_dry_kg', () => {
    const db = makeDb();
    seedEnterprisePrices(db);
    const rows = db.prepare(
      "SELECT price_basis FROM enterprise_prices WHERE enterprise='rooibos'"
    ).all();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(r => r.price_basis === 'sifted_netto_dry_kg')).toBe(true);
    db.close();
  });
});

// ─── backfill migration for existing DBs ─────────────────────────────────────

describe('migrateEnterprisePriceBasis (existing-DB backfill)', () => {
  function oldPricesDb() {
    const db = new Database(':memory:');
    // table created before price_basis existed, already holding rooibos rows
    db.exec(`CREATE TABLE enterprise_prices (
      id TEXT PRIMARY KEY, enterprise TEXT NOT NULL, year INTEGER NOT NULL,
      price_per_kg REAL NOT NULL, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );`);
    const now = new Date().toISOString();
    const ins = db.prepare(`INSERT INTO enterprise_prices
      (id,enterprise,year,price_per_kg,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`);
    ins.run('r-2026', 'rooibos', 2026, 40, null, now, now);
    ins.run('r-2027', 'rooibos', 2027, 46, null, now, now);
    return db;
  }

  it('adds the column and backfills rooibos basis on a pre-column DB', () => {
    const db = oldPricesDb();
    migrateEnterprisePriceBasis(db);
    expect(db.prepare('PRAGMA table_info(enterprise_prices)').all()
      .some(c => c.name === 'price_basis')).toBe(true);
    const rows = db.prepare("SELECT price_basis FROM enterprise_prices WHERE enterprise='rooibos'").all();
    expect(rows.every(r => r.price_basis === 'sifted_netto_dry_kg')).toBe(true);
    db.close();
  });

  it('is idempotent and does not overwrite an already-set basis', () => {
    const db = oldPricesDb();
    migrateEnterprisePriceBasis(db);
    // pretend someone set a custom basis on one row
    db.prepare("UPDATE enterprise_prices SET price_basis='dried_kg' WHERE id='r-2026'").run();
    expect(() => migrateEnterprisePriceBasis(db)).not.toThrow();
    expect(db.prepare("SELECT price_basis FROM enterprise_prices WHERE id='r-2026'").get().price_basis)
      .toBe('dried_kg');
    db.close();
  });
});

// ─── computeLineMargin ───────────────────────────────────────────────────────

describe('computeLineMargin', () => {
  const asOf = '2026-12-31';

  it('computes basis-aligned margin for rooibos (harvest_wet → sifted_netto_dry, factor 0.3915)', () => {
    const db = makeDb();
    insertPrice(db, { enterprise: 'rooibos', year: 2026, price_per_kg: 40, price_basis: 'sifted_netto_dry_kg' });

    const { margin, warnings } = computeLineMargin(db, {
      enterprise: 'rooibos', year: 2026,
      totalCost: 50000, actualYieldKg: 10000, areaHa: 10, asOf,
    });

    expect(warnings).toEqual([]);
    expect(margin.enterprise).toBe('rooibos');
    expect(margin.year).toBe(2026);
    expect(margin.price_per_kg).toBe(40);
    expect(margin.price_basis).toBe('sifted_netto_dry_kg');
    expect(margin.yield_at_price_basis_kg).toBe(3915);      // 10000 * 0.3915
    expect(margin.gross_revenue).toBe(156600);              // 40 * 3915
    expect(margin.cost_per_kg_at_price_basis).toBe(12.77);  // 50000 / 3915
    expect(margin.margin_per_kg).toBe(27.23);               // 40 - 12.7714
    expect(margin.margin_total).toBe(106600);               // 156600 - 50000
    expect(margin.margin_per_ha).toBe(10660);               // 106600 / 10
    expect(margin.margin_pct).toBe(68.07);                  // 106600 / 156600 * 100
    db.close();
  });

  it('margin_pct is a percentage, not a decimal fraction', () => {
    const db = makeDb();
    insertPrice(db, { enterprise: 'wine', year: 2026, price_per_kg: 20, price_basis: 'harvest_wet_kg' });
    const { margin } = computeLineMargin(db, {
      enterprise: 'wine', year: 2026,
      totalCost: 5000, actualYieldKg: 1000, areaHa: 5, asOf,
    });
    // margin_total 15000 / gross 20000 = 0.75 → 75 (%)
    expect(margin.margin_pct).toBe(75);
    expect(margin.margin_pct).toBeGreaterThan(1);
    db.close();
  });

  it('uses factor 1 when price_basis equals the yield base (no conversion needed)', () => {
    const db = makeDb();
    insertPrice(db, { enterprise: 'wine', year: 2026, price_per_kg: 20, price_basis: 'harvest_wet_kg' });
    const { margin, warnings } = computeLineMargin(db, {
      enterprise: 'wine', year: 2026,
      totalCost: 5000, actualYieldKg: 1000, areaHa: 5, asOf,
    });
    expect(warnings).toEqual([]);
    expect(margin.yield_at_price_basis_kg).toBe(1000);
    expect(margin.gross_revenue).toBe(20000);
    expect(margin.cost_per_kg_at_price_basis).toBe(5);
    expect(margin.margin_per_kg).toBe(15);
    db.close();
  });

  it('returns null margin + no_price_for_year when no exact-year price exists', () => {
    const db = makeDb();
    insertPrice(db, { enterprise: 'rooibos', year: 2026, price_per_kg: 40, price_basis: 'sifted_netto_dry_kg' });
    const res = computeLineMargin(db, {
      enterprise: 'rooibos', year: 2025,   // no row for 2025
      totalCost: 50000, actualYieldKg: 10000, areaHa: 10, asOf: '2025-12-31',
    });
    expect(res.margin).toBeNull();
    expect(res.warnings).toContain('no_price_for_year');
    db.close();
  });

  it('returns null margin + price_basis_missing when the price row has no basis', () => {
    const db = makeDb();
    insertPrice(db, { enterprise: 'rooibos', year: 2026, price_per_kg: 40, price_basis: null });
    const res = computeLineMargin(db, {
      enterprise: 'rooibos', year: 2026,
      totalCost: 50000, actualYieldKg: 10000, areaHa: 10, asOf,
    });
    expect(res.margin).toBeNull();
    expect(res.warnings).toContain('price_basis_missing');
    db.close();
  });

  it('warns margin_basis_unconvertible (with missing edge) when basis cannot be reached', () => {
    const db = makeDb();
    insertPrice(db, { enterprise: 'lupines', year: 2026, price_per_kg: 10, price_basis: 'baled_kg' });
    const { margin, warnings } = computeLineMargin(db, {
      enterprise: 'lupines', year: 2026,
      totalCost: 3000, actualYieldKg: 8000, areaHa: 8, asOf,
    });
    // price is still surfaced, but metrics that need the basis are null
    expect(margin.price_per_kg).toBe(10);
    expect(margin.price_basis).toBe('baled_kg');
    expect(margin.yield_at_price_basis_kg).toBeNull();
    expect(margin.margin_per_kg).toBeNull();
    expect(margin.gross_revenue).toBeNull();
    expect(warnings.some(w => w.startsWith('margin_basis_unconvertible'))).toBe(true);
    expect(warnings.some(w => w.includes('harvest_wet_kg') && w.includes('baled_kg'))).toBe(true);
    db.close();
  });

  it('returns null margin without throwing when enterprise_prices table is absent', () => {
    // A DB that never initialised the prices table — margin must degrade, not crash.
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    initFarmSchema(db);
    initCalendarSchema(db);
    initPhase3Schema(db);
    migrateFieldCop(db);
    initConversionFactorsSchema(db);
    seedConversionFactors(db);
    let res;
    expect(() => {
      res = computeLineMargin(db, {
        enterprise: 'rooibos', year: 2026,
        totalCost: 50000, actualYieldKg: 10000, areaHa: 10, asOf,
      });
    }).not.toThrow();
    expect(res.margin).toBeNull();
    db.close();
  });

  it('handles zero yield: per-kg metrics null, total reflects the cost as a loss', () => {
    const db = makeDb();
    insertPrice(db, { enterprise: 'rooibos', year: 2026, price_per_kg: 40, price_basis: 'sifted_netto_dry_kg' });
    const { margin, warnings } = computeLineMargin(db, {
      enterprise: 'rooibos', year: 2026,
      totalCost: 5000, actualYieldKg: 0, areaHa: 10, asOf,
    });
    expect(margin.yield_at_price_basis_kg).toBe(0);
    expect(margin.gross_revenue).toBe(0);
    expect(margin.cost_per_kg_at_price_basis).toBeNull();
    expect(margin.margin_per_kg).toBeNull();
    expect(margin.margin_total).toBe(-5000);
    expect(margin.margin_per_ha).toBe(-500);
    expect(margin.margin_pct).toBeNull();
    expect(warnings).toContain('no_yield');
    db.close();
  });
});

// ─── computeFieldCop integration ─────────────────────────────────────────────

describe('computeFieldCop margin integration', () => {
  function seedFarmField(db, { enterprise = 'rooibos', area_ha = 10 } = {}) {
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO farms (id,name,code,type,created_at,updated_at) VALUES (?,?,?,?,?,?)`)
      .run('farm1', 'Cloudskraal', 'CK', 'owned', now, now);
    db.prepare(`INSERT INTO fields (id,farm_id,name,enterprise,area_ha,geometry,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?,?)`)
      .run('fld1', 'farm1', 'Blouvlei', enterprise, area_ha, '{}', now, now);
  }
  function seedPeriod(db, { id, usage, start_date, end_date = null }) {
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO field_usage_period
      (id,field_id,usage,start_date,end_date,planted_date,source,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(id, 'fld1', usage, start_date, end_date, null, 'seed', now, now);
  }
  function seedProduction(db, { usage_year, actual_yield_kg, harvest_date }) {
    db.prepare(`INSERT INTO field_production
      (id,field_id,year,actual_yield_kg,harvest_date)
      VALUES (?,?,?,?,?)`)
      .run(`prod-${usage_year}`, 'fld1', usage_year, actual_yield_kg, harvest_date);
  }

  it('attaches margin to a productive rooibos line and null to a non-productive line', () => {
    const db = makeDb();
    seedFarmField(db, { enterprise: 'rooibos', area_ha: 10 });
    seedPeriod(db, { id: 'p1', usage: 'rooibos', start_date: '2026-01-01', end_date: '2026-06-30' });
    seedPeriod(db, { id: 'p2', usage: 'fallow', start_date: '2026-07-01', end_date: null });
    seedProduction(db, { usage_year: 2026, actual_yield_kg: 10000, harvest_date: '2026-05-01' });
    insertPrice(db, { enterprise: 'rooibos', year: 2026, price_per_kg: 40, price_basis: 'sifted_netto_dry_kg' });

    const report = computeFieldCop(db, 'fld1', 2026);
    const rooibos = report.lines.find(l => l.usage === 'rooibos');
    const fallow = report.lines.find(l => l.usage === 'fallow');

    expect(rooibos.margin).toBeTruthy();
    expect(rooibos.margin.price_per_kg).toBe(40);
    expect(rooibos.margin.gross_revenue).toBe(156600);
    expect(fallow.margin).toBeNull();
    // non-productive line must not carry a no_price warning
    expect(fallow.warnings).not.toContain('no_price_for_year');
    db.close();
  });
});
