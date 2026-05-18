import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { initFarmSchema } from '../src/db/schema-farms.js';
import { initPhase3Schema } from '../src/db/schema-phase3.js';
import { initCalendarSchema } from '../src/db/schema-calendar.js';
import { migrateFieldCop } from '../src/db/migrate-field-cop.js';
import { initUsagePeriodsSchema } from '../src/db/schema-usage-periods.js';
import { computeFieldRotation, computeFieldCop } from '../src/services/cop.js';

// currentYear from cop.js uses new Date().getUTCFullYear()
const THIS_YEAR = new Date().getUTCFullYear();

function setupDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initFarmSchema(db);
  initCalendarSchema(db);
  initPhase3Schema(db);
  migrateFieldCop(db);
  initUsagePeriodsSchema(db);
  return db;
}

function insertFarm(db) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO farms (id,name,code,type,created_at,updated_at) VALUES (?,?,?,?,?,?)`
  ).run('farm1', 'Cloudskraal', 'cs', 'owned', now, now);
}

function insertField(db, { id = 'fld1', enterprise = 'rooibos', planted_year = null } = {}) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO fields (id,farm_id,name,enterprise,planted_year,geometry,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(id, 'farm1', id, enterprise, planted_year, '{}', now, now);
}

function insertProduction(db, { field_id, year, stand_pct }) {
  db.prepare(
    `INSERT INTO field_production (id,field_id,year,stand_pct) VALUES (?,?,?,?)`
  ).run(`prod-${field_id}-${year}`, field_id, year, stand_pct);
}

// ---------------------------------------------------------------------------
// computeFieldRotation — direct unit tests
// ---------------------------------------------------------------------------

describe('computeFieldRotation — null cases', () => {
  it('returns null for non-rooibos enterprise', () => {
    const db = setupDb();
    insertFarm(db);
    insertField(db, { enterprise: 'lupines_fourrages', planted_year: String(THIS_YEAR - 3) });
    const field = db.prepare('SELECT fi.*, f.name AS farm_name FROM fields fi LEFT JOIN farms f ON f.id=fi.farm_id WHERE fi.id=?').get('fld1');
    expect(computeFieldRotation(db, field)).toBeNull();
    db.close();
  });

  it('returns null for rooibos with no planted_year', () => {
    const db = setupDb();
    insertFarm(db);
    insertField(db, { enterprise: 'rooibos', planted_year: null });
    const field = db.prepare('SELECT fi.*, f.name AS farm_name FROM fields fi LEFT JOIN farms f ON f.id=fi.farm_id WHERE fi.id=?').get('fld1');
    expect(computeFieldRotation(db, field)).toBeNull();
    db.close();
  });

  it('returns null for fallow enterprise', () => {
    const db = setupDb();
    insertFarm(db);
    insertField(db, { enterprise: 'fallow', planted_year: String(THIS_YEAR - 2) });
    const field = db.prepare('SELECT fi.*, f.name AS farm_name FROM fields fi LEFT JOIN farms f ON f.id=fi.farm_id WHERE fi.id=?').get('fld1');
    expect(computeFieldRotation(db, field)).toBeNull();
    db.close();
  });
});

describe('computeFieldRotation — phases', () => {
  function makeField(db, planted_year) {
    insertFarm(db);
    insertField(db, { enterprise: 'rooibos', planted_year: String(planted_year) });
    return db.prepare('SELECT fi.*, f.name AS farm_name FROM fields fi LEFT JOIN farms f ON f.id=fi.farm_id WHERE fi.id=?').get('fld1');
  }

  it('phase=establishment when rotation_year=0 (planted this year)', () => {
    const db = setupDb();
    const field = makeField(db, THIS_YEAR);
    const r = computeFieldRotation(db, field);
    expect(r.phase).toBe('establishment');
    expect(r.rotation_year).toBe(0);
    db.close();
  });

  it('phase=topping when rotation_year=1', () => {
    const db = setupDb();
    const field = makeField(db, THIS_YEAR - 1);
    const r = computeFieldRotation(db, field);
    expect(r.phase).toBe('topping');
    expect(r.rotation_year).toBe(1);
    db.close();
  });

  it('phase=production for year 2–4 with healthy stand', () => {
    const db = setupDb();
    const field = makeField(db, THIS_YEAR - 3);
    insertProduction(db, { field_id: 'fld1', year: THIS_YEAR, stand_pct: 80 });
    const r = computeFieldRotation(db, field);
    expect(r.phase).toBe('production');
    expect(r.rotation_year).toBe(3);
    db.close();
  });

  it('phase=end_of_life when year>=5 and stand<50', () => {
    const db = setupDb();
    const field = makeField(db, THIS_YEAR - 6);
    insertProduction(db, { field_id: 'fld1', year: THIS_YEAR, stand_pct: 40 });
    const r = computeFieldRotation(db, field);
    expect(r.phase).toBe('end_of_life');
    expect(r.replant_status).toBe('must_replant');
    db.close();
  });

  it('phase=production (not end_of_life) when year>=5 but stand>70 (can_delay)', () => {
    const db = setupDb();
    const field = makeField(db, THIS_YEAR - 5);
    insertProduction(db, { field_id: 'fld1', year: THIS_YEAR, stand_pct: 75 });
    const r = computeFieldRotation(db, field);
    expect(r.replant_status).toBe('can_delay');
    expect(r.phase).toBe('production');
    db.close();
  });
});

describe('computeFieldRotation — replant_status rules', () => {
  function fieldWithStand(db, rotationYearsAgo, stand) {
    insertFarm(db);
    insertField(db, { enterprise: 'rooibos', planted_year: String(THIS_YEAR - rotationYearsAgo) });
    if (stand !== null) {
      insertProduction(db, { field_id: 'fld1', year: THIS_YEAR, stand_pct: stand });
    }
    return db.prepare('SELECT fi.*, f.name AS farm_name FROM fields fi LEFT JOIN farms f ON f.id=fi.farm_id WHERE fi.id=?').get('fld1');
  }

  it('must_replant when stand < 50% (any year)', () => {
    const db = setupDb();
    const field = fieldWithStand(db, 2, 45);
    const r = computeFieldRotation(db, field);
    expect(r.replant_status).toBe('must_replant');
    expect(r.replant_message).toMatch(/below 50%/);
    db.close();
  });

  it('warning when stand < 60% (early years)', () => {
    const db = setupDb();
    const field = fieldWithStand(db, 3, 55);
    const r = computeFieldRotation(db, field);
    expect(r.replant_status).toBe('warning');
    expect(r.replant_message).toMatch(/declining/);
    db.close();
  });

  it('can_delay when year>=5 and stand>70', () => {
    const db = setupDb();
    const field = fieldWithStand(db, 5, 72);
    const r = computeFieldRotation(db, field);
    expect(r.replant_status).toBe('can_delay');
    expect(r.replant_message).toMatch(/can delay/);
    db.close();
  });

  it('must_replant when year>=5 and stand=70 (not >70)', () => {
    const db = setupDb();
    const field = fieldWithStand(db, 5, 70);
    const r = computeFieldRotation(db, field);
    expect(r.replant_status).toBe('must_replant');
    expect(r.replant_message).toMatch(/schedule replant/);
    db.close();
  });

  it('ok status when no stand data recorded', () => {
    const db = setupDb();
    const field = fieldWithStand(db, 3, null);
    const r = computeFieldRotation(db, field);
    expect(r.replant_status).toBe('ok');
    expect(r.replant_message).toBeNull();
    expect(r.current_stand_pct).toBeNull();
    db.close();
  });

  it('picks most recent stand_pct across years', () => {
    const db = setupDb();
    insertFarm(db);
    insertField(db, { enterprise: 'rooibos', planted_year: String(THIS_YEAR - 4) });
    insertProduction(db, { field_id: 'fld1', year: THIS_YEAR - 2, stand_pct: 80 });
    insertProduction(db, { field_id: 'fld1', year: THIS_YEAR - 1, stand_pct: 65 });
    insertProduction(db, { field_id: 'fld1', year: THIS_YEAR, stand_pct: 45 });
    const field = db.prepare('SELECT fi.*, f.name AS farm_name FROM fields fi LEFT JOIN farms f ON f.id=fi.farm_id WHERE fi.id=?').get('fld1');
    const r = computeFieldRotation(db, field);
    expect(r.current_stand_pct).toBe(45);
    expect(r.replant_status).toBe('must_replant');
    db.close();
  });

  it('stand_trend contains up to 5 years in chronological order', () => {
    const db = setupDb();
    insertFarm(db);
    insertField(db, { enterprise: 'rooibos', planted_year: String(THIS_YEAR - 7) });
    for (let i = 6; i >= 1; i--) {
      insertProduction(db, { field_id: 'fld1', year: THIS_YEAR - i, stand_pct: 90 - i * 5 });
    }
    const field = db.prepare('SELECT fi.*, f.name AS farm_name FROM fields fi LEFT JOIN farms f ON f.id=fi.farm_id WHERE fi.id=?').get('fld1');
    const r = computeFieldRotation(db, field);
    expect(r.stand_trend.length).toBeLessThanOrEqual(5);
    const years = r.stand_trend.map(t => t.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
    db.close();
  });
});

describe('computeFieldRotation — planted_year on field', () => {
  it('exposes planted_year and rotation_year in output', () => {
    const db = setupDb();
    insertFarm(db);
    insertField(db, { enterprise: 'rooibos', planted_year: String(THIS_YEAR - 3) });
    const field = db.prepare('SELECT fi.*, f.name AS farm_name FROM fields fi LEFT JOIN farms f ON f.id=fi.farm_id WHERE fi.id=?').get('fld1');
    const r = computeFieldRotation(db, field);
    expect(r.planted_year).toBe(THIS_YEAR - 3);
    expect(r.rotation_year).toBe(3);
    db.close();
  });
});

// ---------------------------------------------------------------------------
// computeFieldCop — rotation embedded in response
// ---------------------------------------------------------------------------

describe('computeFieldCop — rotation in COP response', () => {
  function setup({ enterprise = 'rooibos', planted_year = null } = {}) {
    const db = setupDb();
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO farms (id,name,code,type,created_at,updated_at) VALUES (?,?,?,?,?,?)`)
      .run('farm1', 'Test', 't', 'owned', now, now);
    db.prepare(`INSERT INTO fields (id,farm_id,name,enterprise,planted_year,area_ha,geometry,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?,?,?)`)
      .run('fld1', 'farm1', 'F1', enterprise, planted_year, 10, '{}', now, now);
    return db;
  }

  it('rotation is null for a lupines field', () => {
    const db = setup({ enterprise: 'lupines_fourrages' });
    const r = computeFieldCop(db, 'fld1', THIS_YEAR);
    expect(r.rotation).toBeNull();
    db.close();
  });

  it('rotation is null for rooibos field with no planted_year', () => {
    const db = setup({ enterprise: 'rooibos', planted_year: null });
    const r = computeFieldCop(db, 'fld1', THIS_YEAR);
    expect(r.rotation).toBeNull();
    db.close();
  });

  it('rotation present for rooibos field with planted_year', () => {
    const db = setup({ enterprise: 'rooibos', planted_year: String(THIS_YEAR - 2) });
    const r = computeFieldCop(db, 'fld1', THIS_YEAR);
    expect(r.rotation).not.toBeNull();
    expect(r.rotation.planted_year).toBe(THIS_YEAR - 2);
    expect(r.rotation.rotation_year).toBe(2);
    expect(r.rotation.phase).toBe('production');
    db.close();
  });

  it('mid-year rotation (rooibos → lupines) — only rooibos period gets rotation logic', () => {
    const db = setup({ enterprise: 'rooibos', planted_year: String(THIS_YEAR - 3) });
    // Rooibos ends mid-year, lupines takes over — COP still reports rooibos rotation
    db.prepare(`INSERT INTO field_usage_period
      (id,field_id,usage,start_date,end_date,planted_date,source,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(
        'p1', 'fld1', 'rooibos',
        `${THIS_YEAR - 3}-01-01`, `${THIS_YEAR}-05-31`,
        `${THIS_YEAR - 3}-01-01`, 'test',
        new Date().toISOString(), new Date().toISOString()
      );
    db.prepare(`INSERT INTO field_usage_period
      (id,field_id,usage,start_date,end_date,planted_date,source,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(
        'p2', 'fld1', 'lupines_fourrages',
        `${THIS_YEAR}-06-01`, null, null, 'test',
        new Date().toISOString(), new Date().toISOString()
      );
    const r = computeFieldCop(db, 'fld1', THIS_YEAR);
    // COP lines should include both usages
    const usages = r.lines.map(l => l.usage);
    expect(usages).toContain('rooibos');
    expect(usages).toContain('lupines_fourrages');
    // Rotation is based on field.enterprise (rooibos) + field.planted_year
    expect(r.rotation).not.toBeNull();
    expect(r.rotation.rotation_year).toBe(3);
    db.close();
  });
});
