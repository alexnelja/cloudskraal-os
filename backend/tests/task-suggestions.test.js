/**
 * Spec 3.2 — task templates + cost pre-fill: usage-filtered op suggestions,
 * inputs scaled to field area, cost estimate frozen onto the task at create.
 */
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { initFarmSchema } from '../src/db/schema-farms.js';
import { initCalendarSchema } from '../src/db/schema-calendar.js';
import { initPhase3Schema } from '../src/db/schema-phase3.js';
import { initUsagePeriodsSchema } from '../src/db/schema-usage-periods.js';
import { initTaskTemplatesSchema } from '../src/db/schema-task-templates.js';
import { seedTaskTemplates } from '../src/db/seed-task-templates.js';
import { suggestionsForField, estimateCost } from '../src/services/task_suggestions.js';

const now = new Date().toISOString();
function makeDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initFarmSchema(db); initCalendarSchema(db); initPhase3Schema(db);
  initUsagePeriodsSchema(db); initTaskTemplatesSchema(db);
  db.prepare(`INSERT INTO farms (id,name,code,type,created_at,updated_at) VALUES (?,?,?,?,?,?)`)
    .run('farm1', 'CK', 'CK', 'owned', now, now);
  return db;
}
function field(db, { id, enterprise = 'rooibos', area_ha = 10 }) {
  db.prepare(`INSERT INTO fields (id,farm_id,name,enterprise,area_ha,geometry,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?,?)`).run(id, 'farm1', id, enterprise, area_ha, '{}', now, now);
  db.prepare(`INSERT INTO field_usage_period (id,field_id,usage,start_date,end_date,source,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?,?)`).run('u_' + id, id, enterprise, '2020-01-01', null, 'seed', now, now);
}
function template(db, t) {
  db.prepare(`INSERT INTO task_op_templates
    (id,usage,op_type,name,default_inputs_json,default_duration_hrs,default_unit_rate,notes,sort_order)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(
    t.id, t.usage, t.op_type, t.name, t.default_inputs_json ?? null,
    t.default_duration_hrs ?? null, t.default_unit_rate ?? null, null, t.sort_order ?? 0);
}
function product(db, { name, cost_per_unit }) {
  db.prepare(`INSERT INTO input_products (id,name,category,unit_of_measure,cost_per_unit,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?)`).run('p_' + name, name, 'chemical', 'l', cost_per_unit, now, now);
}

describe('task_op_templates schema', () => {
  it('creates the table and extends tasks with template_id + estimated_cost_zar', () => {
    const db = makeDb();
    const cols = db.prepare('PRAGMA table_info(task_op_templates)').all().map(c => c.name);
    for (const c of ['usage', 'op_type', 'name', 'default_inputs_json', 'default_duration_hrs', 'default_unit_rate', 'sort_order'])
      expect(cols).toContain(c);
    const taskCols = db.prepare('PRAGMA table_info(tasks)').all().map(c => c.name);
    expect(taskCols).toContain('template_id');
    expect(taskCols).toContain('estimated_cost_zar');
    db.close();
  });
  it('seed is idempotent and covers the four starter usages', () => {
    const db = makeDb();
    seedTaskTemplates(db); seedTaskTemplates(db); // run twice
    const usages = db.prepare('SELECT DISTINCT usage FROM task_op_templates').all().map(r => r.usage);
    for (const u of ['rooibos', 'lupines_fourrages', 'fallow', 'grazing']) expect(usages).toContain(u);
    const n = db.prepare('SELECT COUNT(*) n FROM task_op_templates').get().n;
    seedTaskTemplates(db);
    expect(db.prepare('SELECT COUNT(*) n FROM task_op_templates').get().n).toBe(n);
    db.close();
  });
});

describe('suggestionsForField', () => {
  it('returns only the active usage’s templates, sorted', () => {
    const db = makeDb(); field(db, { id: 'f1', enterprise: 'rooibos' });
    template(db, { id: 't1', usage: 'rooibos', op_type: 'harvest', name: 'Teesny', sort_order: 1 });
    template(db, { id: 't2', usage: 'rooibos', op_type: 'spray', name: 'Weed spray', sort_order: 0 });
    template(db, { id: 't3', usage: 'lupines_fourrages', op_type: 'plant', name: 'Plant lupines' });
    const r = suggestionsForField(db, 'f1');
    expect(r.usage).toBe('rooibos');
    expect(r.suggestions.map(s => s.name)).toEqual(['Weed spray', 'Teesny']);
    db.close();
  });
  it('suggests the last assignee for the same template on this field', () => {
    const db = makeDb(); field(db, { id: 'f1' });
    template(db, { id: 't1', usage: 'rooibos', op_type: 'spray', name: 'Weed spray' });
    db.prepare(`INSERT INTO tasks (id,title,field_id,template_id,assigned_to,status,type,created_at,updated_at)
                VALUES ('task1','Weed spray','f1','t1','Willem','completed','manual',?,?)`).run(now, now);
    const r = suggestionsForField(db, 'f1');
    expect(r.suggestions[0].suggested_assignee).toBe('Willem');
    db.close();
  });
  it('scales inputs and cost to the field area', () => {
    const db = makeDb(); field(db, { id: 'f1', area_ha: 20 });
    product(db, { name: 'Roundup', cost_per_unit: 100 });
    template(db, {
      id: 't1', usage: 'rooibos', op_type: 'spray', name: 'Weed spray',
      default_inputs_json: JSON.stringify([{ product: 'Roundup', rate_per_ha: 2, unit: 'l' }]),
      default_duration_hrs: 6,
    });
    const r = suggestionsForField(db, 'f1');
    const s = r.suggestions[0];
    expect(s.inputs[0].quantity).toBe(40);          // 2 l/ha × 20 ha
    expect(s.estimated_cost_zar).toBe(4000);        // 40 × R100
    db.close();
  });
});

describe('estimateCost', () => {
  it('inputs cost + per-ha unit rate', () => {
    const db = makeDb(); product(db, { name: 'Roundup', cost_per_unit: 100 });
    template(db, {
      id: 't1', usage: 'rooibos', op_type: 'spray', name: 'Weed spray',
      default_inputs_json: JSON.stringify([{ product: 'Roundup', rate_per_ha: 2, unit: 'l' }]),
      default_unit_rate: 50,                         // R/ha operation charge
    });
    const r = estimateCost(db, 't1', 10);
    expect(r.inputs_cost).toBe(2000);                // 2×10×100
    expect(r.operation_cost).toBe(500);              // 50×10
    expect(r.total).toBe(2500);
    db.close();
  });
  it('warns when a product has no catalogue price and still returns the rest', () => {
    const db = makeDb();
    template(db, {
      id: 't1', usage: 'rooibos', op_type: 'spray', name: 'Mystery spray',
      default_inputs_json: JSON.stringify([{ product: 'Unobtainium', rate_per_ha: 1, unit: 'l' }]),
      default_unit_rate: 50,
    });
    const r = estimateCost(db, 't1', 10);
    expect(r.warnings).toContain('product_price_missing: Unobtainium');
    expect(r.total).toBe(500);                       // unit-rate leg only
    db.close();
  });
  it('unknown template → error', () => {
    const db = makeDb();
    expect(estimateCost(db, 'nope', 10).error).toBe('template_not_found');
    db.close();
  });
});
