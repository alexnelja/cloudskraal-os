/**
 * Spec 2h.1 — cost build-up node map: transform computeFieldCop into a layered
 * DAG (leaves → layer groups → total → ÷yield → cost/kg, price alongside →
 * margin). Layer nodes mirror the include flags; off-layers stay visible so the
 * UI can render toggles and "enable X tracking" hints.
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
import { initConversionFactorsSchema } from '../src/db/schema-conversion-factors.js';
import { seedConversionFactors } from '../src/db/seed-conversion-factors.js';
import { initEnterprisePricesSchema } from '../src/db/schema-enterprise-prices.js';
import { initSharedInputsSchema } from '../src/db/schema-shared-inputs.js';
import { initActivitiesSchema } from '../src/db/schema-activities.js';
import { initProcessingSchema } from '../src/db/schema-processing.js';
import { buildCostNodeMap } from '../src/services/cost_node_map.js';
import { enterpriseCostSummary } from '../src/services/cost_node_map.js';

const now = new Date().toISOString();
function makeDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initFarmSchema(db); initCalendarSchema(db); initPhase2Schema(db); initPhase3Schema(db);
  initFarmConfigSchema(db); migrateFieldCop(db); initUsagePeriodsSchema(db);
  initConversionFactorsSchema(db); seedConversionFactors(db); initEnterprisePricesSchema(db);
  initSharedInputsSchema(db); initActivitiesSchema(db); initProcessingSchema(db);
  db.prepare(`INSERT INTO farms (id,name,code,type,created_at,updated_at) VALUES (?,?,?,?,?,?)`)
    .run('farm1', 'CK', 'CK', 'owned', now, now);
  return db;
}
function field(db, { id, enterprise = 'rooibos', area_ha = 10 }) {
  db.prepare(`INSERT INTO fields (id,farm_id,name,enterprise,area_ha,geometry,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?,?)`).run(id, 'farm1', id, enterprise, area_ha, '{}', now, now);
  db.prepare(`INSERT INTO field_usage_period (id,field_id,usage,start_date,end_date,source,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?,?)`).run('u_' + id, id, enterprise, '2026-01-01', '2026-12-31', 'seed', now, now);
}
function inputCost(db, fieldId, total, product = 'Fertiliser') {
  const pid = 'p_' + fieldId + product;
  db.prepare(`INSERT INTO input_products (id,name,category,unit_of_measure,cost_per_unit,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?)`).run(pid, product, 'chemical', 'l', 1, now, now);
  db.prepare(`INSERT INTO inventory_transactions
    (id,product_id,type,date,quantity,unit_cost,total_cost,field_id,cost_category,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run('t_' + pid, pid, 'usage', '2026-03-01', 1, total, total, fieldId, 'direct_variable', now);
}
function yieldKg(db, fieldId, kg) {
  db.prepare(`INSERT INTO field_production (id,field_id,year,actual_yield_kg) VALUES (?,?,?,?)`)
    .run('y_' + fieldId, fieldId, 2026, kg);
}
// Machine fixture → R334/hr
function equip(db, id) {
  db.prepare(`INSERT INTO equipment
    (id,name,type,depreciation_method,purchase_price,salvage_value,useful_life_years,
     annual_use_hours,maintenance_zar_per_year,fuel_l_per_hour,kind,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, id, 'tractor', 'straight_line', 500000, 50000, 10, 900, 18000, 12, 'machine', now, now);
}
function activity(db, a) {
  db.prepare(`INSERT INTO field_activities
    (id,date,year,activity_type,equipment_id,hours,is_establishment,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(
    a.id, '2026-08-01', 2026, a.activity_type ?? 'firebreak_cutting', a.equipment_id, a.hours, 0, now, now);
  for (const fid of a.fields) {
    db.prepare(`INSERT INTO field_activity_fields (id,activity_id,field_id,ha) VALUES (?,?,?,?)`)
      .run(`${a.id}-${fid}`, a.id, fid, null);
  }
}
function sharedInput(db, s) {
  db.prepare(`INSERT INTO shared_inputs (id,year,product,basis,rate_per_ha,is_establishment,created_at,updated_at)
    VALUES (?,?,?,?,?,0,?,?)`).run(s.id, 2026, s.product ?? 'Lime', 'per_ha_rate', s.rate_per_ha, now, now);
  for (const fid of s.fields) {
    db.prepare(`INSERT INTO shared_input_fields (id,shared_input_id,field_id) VALUES (?,?,?)`)
      .run(`${s.id}-${fid}`, s.id, fid);
  }
}
function price(db, { enterprise = 'rooibos', price_per_kg, price_basis = 'harvest_wet_kg' }) {
  db.prepare(`INSERT INTO enterprise_prices (id,enterprise,year,price_per_kg,price_basis,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?)`).run(`${enterprise}-2026`, enterprise, 2026, price_per_kg, price_basis, now, now);
}
const node = (map, id) => map.nodes.find(n => n.id === id);
const edge = (map, s, t) => map.edges.some(e => e.source === s && e.target === t);

describe('buildCostNodeMap — base layers', () => {
  it('builds direct-inputs leaf → layer → total → unit_cost with yield node', () => {
    const db = makeDb(); field(db, { id: 'f1' });
    inputCost(db, 'f1', 10000); yieldKg(db, 'f1', 1000);
    const map = buildCostNodeMap(db, 'f1', 2026);
    expect(node(map, 'layer:direct_inputs').value_zar).toBe(10000);
    expect(node(map, 'layer:direct_inputs').status).toBe('ok');
    expect(node(map, 'total').value_zar).toBe(10000);
    expect(node(map, 'yield').value_kg).toBe(1000);
    expect(node(map, 'unit_cost').value_zar_per_kg).toBe(10);
    expect(edge(map, 'layer:direct_inputs', 'total')).toBe(true);
    expect(edge(map, 'total', 'unit_cost')).toBe(true);
    expect(edge(map, 'yield', 'unit_cost')).toBe(true);
    // a product leaf feeds the layer
    const leaf = map.nodes.find(n => n.kind === 'leaf' && n.layer === 'direct_inputs');
    expect(leaf.value_zar).toBe(10000);
    expect(edge(map, leaf.id, 'layer:direct_inputs')).toBe(true);
    db.close();
  });
  it('always renders all seven layer nodes (toggleable ones off by default)', () => {
    const db = makeDb(); field(db, { id: 'f1' }); inputCost(db, 'f1', 100);
    const map = buildCostNodeMap(db, 'f1', 2026);
    const layers = map.nodes.filter(n => n.kind === 'layer').map(n => n.layer);
    for (const k of ['direct_inputs', 'labour', 'shared', 'activities', 'overhead', 'capital', 'processing'])
      expect(layers).toContain(k);
    expect(node(map, 'layer:activities').status).toBe('off');
    expect(node(map, 'layer:activities').include_flag).toBe('activities');
    db.close();
  });
});

describe('buildCostNodeMap — toggleable layers', () => {
  it('include=activities folds activity cost into total and cost/kg', () => {
    const db = makeDb(); field(db, { id: 'f1' }); equip(db, 'm1');
    inputCost(db, 'f1', 10000); yieldKg(db, 'f1', 1000);
    activity(db, { id: 'a1', equipment_id: 'm1', hours: 4, fields: ['f1'] });
    const map = buildCostNodeMap(db, 'f1', 2026, { include: ['activities'] });
    expect(node(map, 'layer:activities').status).toBe('ok');
    expect(node(map, 'layer:activities').value_zar).toBe(1336);
    expect(node(map, 'total').value_zar).toBe(11336);
    expect(node(map, 'unit_cost').value_zar_per_kg).toBe(11.34);
    const leaf = map.nodes.find(n => n.kind === 'leaf' && n.layer === 'activities');
    expect(leaf.value_zar).toBe(1336);
    db.close();
  });
  it('flags data_exists on an off layer whose rows exist', () => {
    const db = makeDb(); field(db, { id: 'f1' });
    inputCost(db, 'f1', 100);
    sharedInput(db, { id: 'si1', rate_per_ha: 500, fields: ['f1'] });
    const map = buildCostNodeMap(db, 'f1', 2026);
    expect(node(map, 'layer:shared').status).toBe('off');
    expect(node(map, 'layer:shared').data_exists).toBe(true);
    db.close();
  });
  it('marks an enabled layer with no rows as no_data with a hint', () => {
    const db = makeDb(); field(db, { id: 'f1' }); inputCost(db, 'f1', 100);
    const map = buildCostNodeMap(db, 'f1', 2026, { include: ['processing'] });
    expect(node(map, 'layer:processing').status).toBe('no_data');
    expect(node(map, 'layer:processing').hint).toBeTruthy();
    db.close();
  });
});

describe('buildCostNodeMap — price + margin', () => {
  it('draws price and margin nodes against the LOADED cost/kg', () => {
    const db = makeDb(); field(db, { id: 'f1' }); equip(db, 'm1');
    inputCost(db, 'f1', 10000); yieldKg(db, 'f1', 1000);
    activity(db, { id: 'a1', equipment_id: 'm1', hours: 4, fields: ['f1'] });
    price(db, { price_per_kg: 60 });
    const map = buildCostNodeMap(db, 'f1', 2026, { include: ['activities'] });
    expect(node(map, 'price').value_zar_per_kg).toBe(60);
    expect(node(map, 'margin').value_zar_per_kg).toBe(48.66); // 60 − 11336/1000
    expect(edge(map, 'price', 'margin')).toBe(true);
    expect(edge(map, 'unit_cost', 'margin')).toBe(true);
    db.close();
  });
  it('handles zero yield: unit_cost null, no margin node crash', () => {
    const db = makeDb(); field(db, { id: 'f1' }); inputCost(db, 'f1', 10000);
    price(db, { price_per_kg: 60 });
    const map = buildCostNodeMap(db, 'f1', 2026);
    expect(node(map, 'unit_cost').value_zar_per_kg).toBeNull();
    db.close();
  });
  it('returns error for an unknown field', () => {
    const db = makeDb();
    expect(buildCostNodeMap(db, 'nope', 2026).error).toBe('field_not_found');
    db.close();
  });
});

describe('enterpriseCostSummary — Cloudskraal-average R/kg', () => {
  it('aggregates all fields of the enterprise: Σcost ÷ Σkg (weighted, not simple avg)', () => {
    const db = makeDb();
    field(db, { id: 'f1' }); inputCost(db, 'f1', 10000); yieldKg(db, 'f1', 1000); // 10/kg
    field(db, { id: 'f2' }); inputCost(db, 'f2', 60000); yieldKg(db, 'f2', 2000); // 30/kg
    const r = enterpriseCostSummary(db, 'rooibos', 2026);
    expect(r.total_cost).toBe(70000);
    expect(r.total_yield_kg).toBe(3000);
    expect(r.cost_per_kg).toBe(23.33);
    expect(r.fields.length).toBe(2);
    expect(r.fields.find(f => f.field_id === 'f1').cost_per_kg).toBe(10);
    db.close();
  });
  it('includes opt-in layers passed via include', () => {
    const db = makeDb(); equip(db, 'm1');
    field(db, { id: 'f1' }); inputCost(db, 'f1', 10000); yieldKg(db, 'f1', 1000);
    activity(db, { id: 'a1', equipment_id: 'm1', hours: 4, fields: ['f1'] });
    const r = enterpriseCostSummary(db, 'rooibos', 2026, { include: ['activities'] });
    expect(r.total_cost).toBe(11336);
    db.close();
  });
  it('excludes other enterprises and carries margin when priced', () => {
    const db = makeDb();
    field(db, { id: 'f1' }); inputCost(db, 'f1', 10000); yieldKg(db, 'f1', 1000);
    field(db, { id: 'w1', enterprise: 'wine' }); inputCost(db, 'w1', 99999); yieldKg(db, 'w1', 10);
    price(db, { price_per_kg: 60 });
    const r = enterpriseCostSummary(db, 'rooibos', 2026);
    expect(r.total_cost).toBe(10000);
    expect(r.price_per_kg).toBe(60);
    expect(r.margin_per_kg).toBe(50); // 60 − 10
    db.close();
  });
});
