/**
 * Spec 2i.3 — field activities (operations): machine + attachment + operator
 * tied to field(s) per activity. Cost = comboRate × hours + operator rate × hours.
 * No activity-linked inputs in v1 (inputs live in inventory/shared_inputs).
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
import { initActivitiesSchema } from '../src/db/schema-activities.js';
import { activityCost, fieldActivityCost } from '../src/services/activities.js';
import { computeFieldCop } from '../src/services/cop.js';

const now = new Date().toISOString();
function makeDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initFarmSchema(db); initCalendarSchema(db); initPhase2Schema(db); initPhase3Schema(db);
  initFarmConfigSchema(db); migrateFieldCop(db); initUsagePeriodsSchema(db);
  initActivitiesSchema(db);
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
// Machine: dep (500000-50000)/10/900 = 50 + maint 18000/900 = 20 + fuel 12×22 = 264 → R334/hr
// Attachment: dep (90000-10000)/8/400 = 25 + maint 4000/400 = 10 + no fuel → R35/hr
function equip(db, e) {
  db.prepare(`INSERT INTO equipment
    (id,name,type,depreciation_method,purchase_price,salvage_value,useful_life_years,
     annual_use_hours,maintenance_zar_per_year,fuel_l_per_hour,kind,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    e.id, e.name ?? e.id, e.type ?? 'tractor', e.depreciation_method ?? 'straight_line',
    e.purchase_price ?? 500000, e.salvage_value ?? 50000, e.useful_life_years ?? 10,
    e.annual_use_hours ?? 900, e.maintenance_zar_per_year ?? 18000,
    e.fuel_l_per_hour ?? (e.kind === 'attachment' ? null : 12), e.kind ?? 'machine', now, now);
}
function attachment(db, id) {
  equip(db, { id, kind: 'attachment', type: 'slasher', purchase_price: 90000, salvage_value: 10000,
    useful_life_years: 8, annual_use_hours: 400, maintenance_zar_per_year: 4000 });
}
function employee(db, { id, hourly_rate = 60 }) {
  db.prepare(`INSERT INTO employees (id,name,type,hourly_rate,created_at,updated_at)
              VALUES (?,?,?,?,?,?)`).run(id, id, 'permanent', hourly_rate, now, now);
}
function activity(db, a) {
  db.prepare(`INSERT INTO field_activities
    (id,date,year,activity_type,enterprise,equipment_id,attachment_id,operator_employee_id,
     hours,ha_covered,is_establishment,entry_basis,external_source,external_id,notes,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    a.id, a.date ?? '2026-03-01', a.year ?? 2026, a.activity_type ?? 'firebreak_cutting',
    a.enterprise ?? null, a.equipment_id ?? null, a.attachment_id ?? null, a.operator_employee_id ?? null,
    a.hours ?? null, a.ha_covered ?? null, a.is_establishment ?? 0, a.entry_basis ?? 'estimate',
    a.external_source ?? null, a.external_id ?? null, null, now, now);
  for (const f of a.fields || []) {
    const fid = typeof f === 'string' ? f : f.field_id;
    const ha = typeof f === 'string' ? null : f.ha ?? null;
    db.prepare(`INSERT INTO field_activity_fields (id,activity_id,field_id,ha) VALUES (?,?,?,?)`)
      .run(`${a.id}-${fid}`, a.id, fid, ha);
  }
}

describe('field_activities schema', () => {
  it('has the cost + provenance columns', () => {
    const db = makeDb();
    const cols = db.prepare('PRAGMA table_info(field_activities)').all().map(c => c.name);
    for (const c of ['activity_type', 'equipment_id', 'attachment_id', 'operator_employee_id',
      'hours', 'ha_covered', 'is_establishment', 'entry_basis', 'external_source', 'external_id'])
      expect(cols).toContain(c);
    db.close();
  });
  it('cascades field links on delete and enforces idempotent external id', () => {
    const db = makeDb(); field(db, { id: 'f1' });
    activity(db, { id: 'a1', hours: 2, fields: ['f1'], external_source: 'xero', external_id: 'X1' });
    expect(db.prepare('SELECT COUNT(*) n FROM field_activity_fields').get().n).toBe(1);
    expect(() => db.prepare(`INSERT INTO field_activities (id,year,external_source,external_id,created_at,updated_at)
      VALUES ('a2',2026,'xero','X1',?,?)`).run(now, now)).toThrow();
    db.prepare("DELETE FROM field_activities WHERE id='a1'").run();
    expect(db.prepare('SELECT COUNT(*) n FROM field_activity_fields').get().n).toBe(0);
    db.close();
  });
});

describe('activityCost', () => {
  it('machine only = machine rate × hours', () => {
    const db = makeDb(); field(db, { id: 'f1' }); equip(db, { id: 'm1' });
    activity(db, { id: 'a1', equipment_id: 'm1', hours: 4, fields: ['f1'] });
    const r = activityCost(db, 'a1');
    expect(r.machine_cost).toBe(1336);   // 334 × 4
    expect(r.operator_cost).toBe(0);
    expect(r.total).toBe(1336);
    db.close();
  });
  it('machine + attachment + operator = (334 + 35 + 60) × 4', () => {
    const db = makeDb(); field(db, { id: 'f1' });
    equip(db, { id: 'm1' }); attachment(db, 'att1'); employee(db, { id: 'emp1', hourly_rate: 60 });
    activity(db, { id: 'a1', equipment_id: 'm1', attachment_id: 'att1',
      operator_employee_id: 'emp1', hours: 4, fields: ['f1'] });
    const r = activityCost(db, 'a1');
    expect(r.machine_cost).toBe(1476);   // (334 + 35) × 4
    expect(r.operator_cost).toBe(240);   // 60 × 4
    expect(r.total).toBe(1716);
    db.close();
  });
  it('propagates annual_use_hours_missing and excludes that machine component', () => {
    const db = makeDb(); field(db, { id: 'f1' });
    equip(db, { id: 'm1', annual_use_hours: 0 }); employee(db, { id: 'emp1', hourly_rate: 60 });
    activity(db, { id: 'a1', equipment_id: 'm1', operator_employee_id: 'emp1', hours: 4, fields: ['f1'] });
    const r = activityCost(db, 'a1');
    expect(r.warnings).toContain('annual_use_hours_missing');
    expect(r.machine_cost).toBe(0);
    expect(r.total).toBe(240);           // operator only
    db.close();
  });
});

describe('fieldActivityCost', () => {
  it('single-field activity lands fully on that field', () => {
    const db = makeDb(); field(db, { id: 'f1' }); equip(db, { id: 'm1' });
    activity(db, { id: 'a1', equipment_id: 'm1', hours: 4, fields: ['f1'] });
    expect(fieldActivityCost(db, 'f1', 2026).total).toBe(1336);
    db.close();
  });
  it('multi-field activity splits by link-ha share', () => {
    const db = makeDb(); field(db, { id: 'f1' }); field(db, { id: 'f2' }); equip(db, { id: 'm1' });
    activity(db, { id: 'a1', equipment_id: 'm1', hours: 4,
      fields: [{ field_id: 'f1', ha: 10 }, { field_id: 'f2', ha: 30 }] });
    expect(fieldActivityCost(db, 'f1', 2026).total).toBe(334);    // 1336 × 10/40
    expect(fieldActivityCost(db, 'f2', 2026).total).toBe(1002);   // 1336 × 30/40
    db.close();
  });
  it('falls back to field area_ha when link ha is null', () => {
    const db = makeDb(); field(db, { id: 'f1', area_ha: 10 }); field(db, { id: 'f2', area_ha: 30 });
    equip(db, { id: 'm1' });
    activity(db, { id: 'a1', equipment_id: 'm1', hours: 4, fields: ['f1', 'f2'] });
    expect(fieldActivityCost(db, 'f1', 2026).total).toBe(334);
    db.close();
  });
  it('warns and skips a split with zero total ha', () => {
    const db = makeDb(); field(db, { id: 'f1', area_ha: 0 }); field(db, { id: 'f2', area_ha: 0 });
    equip(db, { id: 'm1' });
    activity(db, { id: 'a1', equipment_id: 'm1', hours: 4, fields: ['f1', 'f2'] });
    const r = fieldActivityCost(db, 'f1', 2026);
    expect(r.total).toBe(0);
    expect(r.warnings).toContain('multi_field_split_zero_area');
    db.close();
  });
  it('excludes is_establishment rows (they accrue to capital, not in-year)', () => {
    const db = makeDb(); field(db, { id: 'f1' }); equip(db, { id: 'm1' });
    activity(db, { id: 'a1', equipment_id: 'm1', hours: 4, fields: ['f1'], is_establishment: 1 });
    expect(fieldActivityCost(db, 'f1', 2026).total).toBe(0);
    db.close();
  });
  it('only counts the queried year', () => {
    const db = makeDb(); field(db, { id: 'f1' }); equip(db, { id: 'm1' });
    activity(db, { id: 'a1', equipment_id: 'm1', hours: 4, fields: ['f1'], year: 2025 });
    expect(fieldActivityCost(db, 'f1', 2026).total).toBe(0);
    db.close();
  });
  it('warns activity_labour_overlaps_time_entry when operator+date matches a time entry', () => {
    const db = makeDb(); field(db, { id: 'f1' }); equip(db, { id: 'm1' });
    employee(db, { id: 'emp1' });
    db.prepare(`INSERT INTO time_entries (id,employee_id,date,hours_worked,created_at)
                VALUES ('te1','emp1','2026-03-01',8,?)`).run(now);
    activity(db, { id: 'a1', date: '2026-03-01', equipment_id: 'm1',
      operator_employee_id: 'emp1', hours: 4, fields: ['f1'] });
    expect(fieldActivityCost(db, 'f1', 2026).warnings).toContain('activity_labour_overlaps_time_entry');
    db.close();
  });
});

describe('computeFieldCop activities integration (opt-in)', () => {
  function withCost(db, fieldId, usageName) {
    usage(db, { id: 'u_' + fieldId, field_id: fieldId, usage: usageName });
    db.prepare(`INSERT INTO input_products (id,name,category,unit_of_measure,cost_per_unit,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?)`).run('p_' + fieldId, 'x', 'chemical', 'l', 1, now, now);
    db.prepare(`INSERT INTO inventory_transactions
      (id,product_id,type,date,quantity,unit_cost,total_cost,field_id,cost_category,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run('t_' + fieldId, 'p_' + fieldId, 'usage', '2026-03-01', 1, 10000, 10000, fieldId, 'direct_variable', now);
  }

  it('attaches line.activity_cost on the enterprise line with include=activities', () => {
    const db = makeDb(); field(db, { id: 'f1', enterprise: 'rooibos' }); equip(db, { id: 'm1' });
    withCost(db, 'f1', 'rooibos');
    activity(db, { id: 'a1', equipment_id: 'm1', hours: 4, fields: ['f1'] });
    const line = computeFieldCop(db, 'f1', 2026, { include: ['activities'] }).lines.find(l => l.usage === 'rooibos');
    expect(line.activity_cost).toBe(1336);
    db.close();
  });
  it('is absent by default + flags exclusion when rows exist', () => {
    const db = makeDb(); field(db, { id: 'f1', enterprise: 'rooibos' }); equip(db, { id: 'm1' });
    withCost(db, 'f1', 'rooibos');
    activity(db, { id: 'a1', equipment_id: 'm1', hours: 4, fields: ['f1'] });
    const r = computeFieldCop(db, 'f1', 2026);
    expect(r.lines.find(l => l.usage === 'rooibos').activity_cost).toBeUndefined();
    expect(r.coverage.excluded_layers).toContain('activities');
    db.close();
  });
  it('falls back to the single productive line when enterprise has no matching line', () => {
    const db = makeDb(); field(db, { id: 'f1', enterprise: 'rooibos' }); equip(db, { id: 'm1' });
    withCost(db, 'f1', 'lupines');
    activity(db, { id: 'a1', equipment_id: 'm1', hours: 4, fields: ['f1'] });
    const line = computeFieldCop(db, 'f1', 2026, { include: ['activities'] }).lines.find(l => l.usage === 'lupines');
    expect(line.activity_cost).toBe(1336);
    db.close();
  });
  it('warns activity_line_not_found when no productive line exists', () => {
    const db = makeDb(); field(db, { id: 'f1', enterprise: 'rooibos' }); equip(db, { id: 'm1' });
    withCost(db, 'f1', 'fallow');
    activity(db, { id: 'a1', equipment_id: 'm1', hours: 4, fields: ['f1'] });
    const r = computeFieldCop(db, 'f1', 2026, { include: ['activities'] });
    expect(r.activities.warnings).toContain('activity_line_not_found');
    db.close();
  });
  it('composes with include=shared without touching other layers', () => {
    const db = makeDb(); field(db, { id: 'f1', enterprise: 'rooibos' }); equip(db, { id: 'm1' });
    withCost(db, 'f1', 'rooibos');
    activity(db, { id: 'a1', equipment_id: 'm1', hours: 4, fields: ['f1'] });
    const r = computeFieldCop(db, 'f1', 2026, { include: ['activities'] });
    const line = r.lines.find(l => l.usage === 'rooibos');
    expect(line.activity_cost).toBe(1336);
    expect(line.total_cost).toBe(10000); // existing line total untouched (additive field)
    db.close();
  });
});
