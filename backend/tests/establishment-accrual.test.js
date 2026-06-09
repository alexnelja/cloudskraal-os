/**
 * Spec 2i.4 — establishment accrual: is_establishment-flagged shared inputs +
 * activities (year == cohort planted_year) accumulate into
 * field_establishment.total_cost_zar, then amortise via include=capital (2c).
 */
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { initFarmSchema } from '../src/db/schema-farms.js';
import { initCalendarSchema } from '../src/db/schema-calendar.js';
import { initPhase2Schema } from '../src/db/schema-phase2.js';
import { initPhase3Schema } from '../src/db/schema-phase3.js';
import { initFarmConfigSchema } from '../src/db/schema-farm-config.js';
import { migrateFieldCop } from '../src/db/migrate-field-cop.js';
import { initUsagePeriodsSchema } from '../src/db/schema-usage-periods.js';
import { initLongHorizonSchema } from '../src/db/schema-long-horizon.js';
import { initSharedInputsSchema } from '../src/db/schema-shared-inputs.js';
import { initActivitiesSchema } from '../src/db/schema-activities.js';
import { fieldSharedInputCost } from '../src/services/shared_inputs.js';
import { fieldActivityCost } from '../src/services/activities.js';
import { establishmentAccrual, applyEstablishmentAccrual } from '../src/services/establishment.js';
import { computeFieldCop } from '../src/services/cop.js';

const now = new Date().toISOString();
function makeDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initFarmSchema(db); initCalendarSchema(db); initPhase2Schema(db); initPhase3Schema(db);
  initFarmConfigSchema(db); migrateFieldCop(db); initUsagePeriodsSchema(db);
  initLongHorizonSchema(db); initSharedInputsSchema(db); initActivitiesSchema(db);
  db.prepare(`INSERT INTO farms (id,name,code,type,created_at,updated_at) VALUES (?,?,?,?,?,?)`)
    .run('farm1', 'CK', 'CK', 'owned', now, now);
  return db;
}
function field(db, { id, enterprise = 'rooibos', area_ha = 10 }) {
  db.prepare(`INSERT INTO fields (id,farm_id,name,enterprise,area_ha,geometry,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?,?)`).run(id, 'farm1', id, enterprise, area_ha, '{}', now, now);
}
// Machine fixture → R334/hr (dep 50 + maint 20 + fuel 264 @ R22)
function equip(db, id) {
  db.prepare(`INSERT INTO equipment
    (id,name,type,depreciation_method,purchase_price,salvage_value,useful_life_years,
     annual_use_hours,maintenance_zar_per_year,fuel_l_per_hour,kind,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, id, 'tractor', 'straight_line', 500000, 50000, 10, 900, 18000, 12, 'machine', now, now);
}
function sharedInput(db, s) {
  db.prepare(`INSERT INTO shared_inputs
    (id,year,product,basis,rate_per_ha,total_cost_zar,is_establishment,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(
    s.id, s.year ?? 2026, s.product ?? 'Seedlings', s.basis ?? 'per_ha_rate',
    s.rate_per_ha ?? null, s.total_cost_zar ?? null, s.is_establishment ?? 0, now, now);
  for (const fid of s.fields) {
    db.prepare(`INSERT INTO shared_input_fields (id,shared_input_id,field_id) VALUES (?,?,?)`)
      .run(`${s.id}-${fid}`, s.id, fid);
  }
}
function activity(db, a) {
  db.prepare(`INSERT INTO field_activities
    (id,date,year,activity_type,equipment_id,hours,is_establishment,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(
    a.id, a.date ?? '2026-08-01', a.year ?? 2026, a.activity_type ?? 'planting',
    a.equipment_id ?? null, a.hours ?? null, a.is_establishment ?? 0, now, now);
  for (const fid of a.fields) {
    db.prepare(`INSERT INTO field_activity_fields (id,activity_id,field_id,ha) VALUES (?,?,?,?)`)
      .run(`${a.id}-${fid}`, a.id, fid, null);
  }
}
function establishment(db, e) {
  db.prepare(`INSERT INTO field_establishment
    (id,field_id,usage,planted_date,total_cost_zar,expected_productive_years,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?)`).run(
    e.id, e.field_id, e.usage ?? 'rooibos', e.planted_date ?? '2026-08-01',
    e.total_cost_zar ?? null, e.expected_productive_years ?? 10, now, now);
}

describe('establishment-only allocation option', () => {
  it('fieldSharedInputCost({establishment:true}) returns ONLY establishment rows', () => {
    const db = makeDb(); field(db, { id: 'f1', area_ha: 10 });
    sharedInput(db, { id: 'si1', rate_per_ha: 500, fields: ['f1'] });                       // in-year
    sharedInput(db, { id: 'si2', rate_per_ha: 800, fields: ['f1'], is_establishment: 1 }); // establishment
    expect(fieldSharedInputCost(db, 'f1', 2026).total).toBe(5000);
    expect(fieldSharedInputCost(db, 'f1', 2026, { establishment: true }).total).toBe(8000);
    db.close();
  });
  it('fieldActivityCost({establishment:true}) returns ONLY establishment rows', () => {
    const db = makeDb(); field(db, { id: 'f1' }); equip(db, 'm1');
    activity(db, { id: 'a1', equipment_id: 'm1', hours: 4, fields: ['f1'] });                       // in-year
    activity(db, { id: 'a2', equipment_id: 'm1', hours: 2, fields: ['f1'], is_establishment: 1 }); // establishment
    expect(fieldActivityCost(db, 'f1', 2026).total).toBe(1336);
    expect(fieldActivityCost(db, 'f1', 2026, { establishment: true }).total).toBe(668);
    db.close();
  });
});

describe('establishmentAccrual', () => {
  it('sums establishment-flagged shared inputs + activities at the planted year', () => {
    const db = makeDb(); field(db, { id: 'f1', area_ha: 10 }); equip(db, 'm1');
    sharedInput(db, { id: 'si1', rate_per_ha: 800, fields: ['f1'], is_establishment: 1 });
    activity(db, { id: 'a1', equipment_id: 'm1', hours: 2, fields: ['f1'], is_establishment: 1 });
    const r = establishmentAccrual(db, 'f1', 2026);
    expect(r.shared_inputs.total).toBe(8000);
    expect(r.activities.total).toBe(668);
    expect(r.total).toBe(8668);
    db.close();
  });
  it('ignores establishment rows from other years (year == planted_year rule)', () => {
    const db = makeDb(); field(db, { id: 'f1', area_ha: 10 });
    sharedInput(db, { id: 'si1', rate_per_ha: 800, fields: ['f1'], is_establishment: 1, year: 2025 });
    expect(establishmentAccrual(db, 'f1', 2026).total).toBe(0);
    db.close();
  });
});

describe('applyEstablishmentAccrual', () => {
  it('writes the accrued total onto field_establishment.total_cost_zar', () => {
    const db = makeDb(); field(db, { id: 'f1', area_ha: 10 }); equip(db, 'm1');
    establishment(db, { id: 'e1', field_id: 'f1', planted_date: '2026-08-01' });
    sharedInput(db, { id: 'si1', rate_per_ha: 800, fields: ['f1'], is_establishment: 1 });
    activity(db, { id: 'a1', equipment_id: 'm1', hours: 2, fields: ['f1'], is_establishment: 1 });
    const r = applyEstablishmentAccrual(db, 'e1');
    expect(r.total_cost_zar).toBe(8668);
    expect(db.prepare("SELECT total_cost_zar FROM field_establishment WHERE id='e1'").get().total_cost_zar).toBe(8668);
    db.close();
  });
  it('warns when establishment-flagged rows sit outside the planted year', () => {
    const db = makeDb(); field(db, { id: 'f1', area_ha: 10 });
    establishment(db, { id: 'e1', field_id: 'f1', planted_date: '2026-08-01' });
    sharedInput(db, { id: 'si1', rate_per_ha: 800, fields: ['f1'], is_establishment: 1, year: 2025 });
    const r = applyEstablishmentAccrual(db, 'e1');
    expect(r.warnings).toContain('establishment_rows_outside_planted_year');
    db.close();
  });
  it('returns establishment_not_found for an unknown id', () => {
    const db = makeDb();
    expect(applyEstablishmentAccrual(db, 'nope').error).toBe('establishment_not_found');
    db.close();
  });
  it('accrued cost then amortises via include=capital (2c), not in-year', () => {
    const db = makeDb(); field(db, { id: 'f1', area_ha: 10 }); equip(db, 'm1');
    db.prepare(`INSERT INTO field_usage_period (id,field_id,usage,start_date,end_date,source,created_at,updated_at)
                VALUES ('u1','f1','rooibos','2026-01-01','2026-12-31','seed',?,?)`).run(now, now);
    establishment(db, { id: 'e1', field_id: 'f1', planted_date: '2026-08-01', expected_productive_years: 10 });
    sharedInput(db, { id: 'si1', rate_per_ha: 800, fields: ['f1'], is_establishment: 1 });
    applyEstablishmentAccrual(db, 'e1');
    const r = computeFieldCop(db, 'f1', 2026, { include: ['capital', 'shared', 'activities'] });
    const line = r.lines.find(l => l.usage === 'rooibos');
    expect(line.capital_amortized_cost).toBe(800);          // 8000 / 10 years
    expect(line.shared_input_cost).toBeUndefined();          // NOT expensed in-year
    db.close();
  });
});
