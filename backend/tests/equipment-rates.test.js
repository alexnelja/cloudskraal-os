/**
 * Spec 2i.2 — equipment operating rates: machine cost/hour from depreciation +
 * maintenance + fuel; attachments (no fuel); combo machine+attachment.
 */
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { initFarmSchema } from '../src/db/schema-farms.js';
import { initPhase2Schema } from '../src/db/schema-phase2.js';
import { initFarmConfigSchema } from '../src/db/schema-farm-config.js';
import { equipmentRate, comboRate } from '../src/services/equipment_rates.js';

const now = new Date().toISOString();
function makeDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initFarmSchema(db);   // equipment.farm_id FK
  initPhase2Schema(db);
  initFarmConfigSchema(db);
  return db;
}
function equip(db, e) {
  db.prepare(`INSERT INTO equipment
    (id,name,type,depreciation_method,purchase_price,salvage_value,useful_life_years,
     annual_use_hours,maintenance_zar_per_year,fuel_l_per_hour,kind,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    e.id, e.name ?? e.id, e.type ?? 'tractor', e.depreciation_method ?? 'straight_line',
    e.purchase_price ?? null, e.salvage_value ?? null, e.useful_life_years ?? null,
    e.annual_use_hours ?? null, e.maintenance_zar_per_year ?? null, e.fuel_l_per_hour ?? null,
    e.kind ?? 'machine', now, now);
}
function setDiesel(db, price) {
  db.prepare(`INSERT INTO farm_config (key,value,updated_at) VALUES ('diesel_price_zar_per_l',?,?)
              ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(String(price), now);
}

describe('equipment rate schema', () => {
  it('equipment has the rate columns', () => {
    const db = makeDb();
    const cols = db.prepare('PRAGMA table_info(equipment)').all().map(c => c.name);
    for (const c of ['fuel_l_per_hour', 'annual_use_hours', 'maintenance_zar_per_year', 'kind']) expect(cols).toContain(c);
    db.close();
  });
});

describe('equipmentRate', () => {
  it('cost/hour = depreciation/hr + maintenance/hr + fuel/hr (default diesel R22)', () => {
    const db = makeDb();
    equip(db, { id: 'm1', purchase_price: 500000, salvage_value: 50000, useful_life_years: 10,
      annual_use_hours: 900, maintenance_zar_per_year: 18000, fuel_l_per_hour: 12 });
    const r = equipmentRate(db, 'm1');
    expect(r.depreciation_per_hour).toBe(50);   // (500000-50000)/10/900
    expect(r.maintenance_per_hour).toBe(20);     // 18000/900
    expect(r.fuel_per_hour).toBe(264);           // 12 × 22
    expect(r.cost_per_hour).toBe(334);
    db.close();
  });
  it('uses diesel price from farm_config when set', () => {
    const db = makeDb(); setDiesel(db, 25);
    equip(db, { id: 'm1', purchase_price: 500000, salvage_value: 50000, useful_life_years: 10,
      annual_use_hours: 900, maintenance_zar_per_year: 18000, fuel_l_per_hour: 12 });
    expect(equipmentRate(db, 'm1').cost_per_hour).toBe(370); // fuel 12×25=300 + 50 + 20
    db.close();
  });
  it('nulls cost/hour + warns when annual_use_hours is missing', () => {
    const db = makeDb();
    equip(db, { id: 'm1', purchase_price: 500000, salvage_value: 50000, useful_life_years: 10, annual_use_hours: 0, fuel_l_per_hour: 12 });
    const r = equipmentRate(db, 'm1');
    expect(r.cost_per_hour).toBeNull();
    expect(r.warning).toBe('annual_use_hours_missing');
    db.close();
  });
  it('errors on an unsupported depreciation method', () => {
    const db = makeDb();
    equip(db, { id: 'm1', depreciation_method: 'diminishing_value', purchase_price: 1, useful_life_years: 5, annual_use_hours: 100 });
    expect(equipmentRate(db, 'm1').error).toBe('depreciation_method_unsupported');
    db.close();
  });
  it('an attachment has no fuel component', () => {
    const db = makeDb();
    equip(db, { id: 'a1', kind: 'attachment', type: 'ripper', purchase_price: 120000, salvage_value: 0,
      useful_life_years: 8, annual_use_hours: 600, maintenance_zar_per_year: 6000, fuel_l_per_hour: 99 });
    const r = equipmentRate(db, 'a1');
    expect(r.fuel_per_hour).toBe(0);   // attachments ignore fuel
    expect(r.cost_per_hour).toBe(35);  // 15000/600 + 6000/600
    db.close();
  });
});

describe('comboRate', () => {
  it('sums a machine + attachment per-hour cost', () => {
    const db = makeDb();
    equip(db, { id: 'm1', purchase_price: 500000, salvage_value: 50000, useful_life_years: 10,
      annual_use_hours: 900, maintenance_zar_per_year: 18000, fuel_l_per_hour: 12 });
    equip(db, { id: 'a1', kind: 'attachment', purchase_price: 120000, salvage_value: 0,
      useful_life_years: 8, annual_use_hours: 600, maintenance_zar_per_year: 6000 });
    expect(comboRate(db, 'm1', 'a1').cost_per_hour).toBe(369); // 334 + 35
    db.close();
  });
  it('handles a machine with no attachment', () => {
    const db = makeDb();
    equip(db, { id: 'm1', purchase_price: 500000, salvage_value: 50000, useful_life_years: 10,
      annual_use_hours: 900, maintenance_zar_per_year: 18000, fuel_l_per_hour: 12 });
    expect(comboRate(db, 'm1', null).cost_per_hour).toBe(334);
    db.close();
  });
});
