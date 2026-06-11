/**
 * Spec 4.1 — task lifecycle: scheduled → in_progress → completed → verified
 * (cancelled off-ramp), append-only task_events audit trail, and COP postings
 * (inventory_transactions + time_entries) written exactly once at verify.
 */
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { initFarmSchema } from '../src/db/schema-farms.js';
import { initCalendarSchema } from '../src/db/schema-calendar.js';
import { initPhase3Schema } from '../src/db/schema-phase3.js';
import { migrateFieldCop } from '../src/db/migrate-field-cop.js';
import { initUsagePeriodsSchema } from '../src/db/schema-usage-periods.js';
import { initTaskTemplatesSchema } from '../src/db/schema-task-templates.js';
import { initTaskEventsSchema } from '../src/db/schema-task-events.js';
import { transition, listEvents } from '../src/services/task_lifecycle.js';
import { computeFieldCop } from '../src/services/cop.js';

const now = new Date().toISOString();
function makeDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initFarmSchema(db); initCalendarSchema(db); initPhase3Schema(db);
  migrateFieldCop(db); initUsagePeriodsSchema(db); initTaskTemplatesSchema(db);
  initTaskEventsSchema(db);
  db.prepare(`INSERT INTO farms (id,name,code,type,created_at,updated_at) VALUES (?,?,?,?,?,?)`)
    .run('farm1', 'CK', 'CK', 'owned', now, now);
  db.prepare(`INSERT INTO fields (id,farm_id,name,enterprise,area_ha,geometry,created_at,updated_at)
              VALUES ('f1','farm1','f1','rooibos',10,'{}',?,?)`).run(now, now);
  db.prepare(`INSERT INTO field_usage_period (id,field_id,usage,start_date,end_date,source,created_at,updated_at)
              VALUES ('u1','f1','rooibos','2020-01-01',NULL,'seed',?,?)`).run(now, now);
  return db;
}
function task(db, t = {}) {
  db.prepare(`INSERT INTO tasks (id,title,field_id,template_id,status,type,created_at,updated_at)
              VALUES (?,?,?,?,?,'manual',?,?)`)
    .run(t.id ?? 'task1', t.title ?? 'Spray', t.field_id ?? 'f1', t.template_id ?? null,
         t.status ?? 'pending', now, now);
  return t.id ?? 'task1';
}
function product(db, { id, name, cost_per_unit }) {
  db.prepare(`INSERT INTO input_products (id,name,category,unit_of_measure,cost_per_unit,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?)`).run(id, name, 'chemical', 'l', cost_per_unit, now, now);
}
function employee(db, { id, hourly_rate = 60 }) {
  db.prepare(`INSERT INTO employees (id,name,type,hourly_rate,created_at,updated_at)
              VALUES (?,?,?,?,?,?)`).run(id, id, 'permanent', hourly_rate, now, now);
}

describe('schema', () => {
  it('tasks gains lifecycle columns; task_events exists', () => {
    const db = makeDb();
    const cols = db.prepare('PRAGMA table_info(tasks)').all().map(c => c.name);
    for (const c of ['state', 'actual_start', 'actual_end', 'actual_inputs_json',
      'actual_duration_hrs', 'actual_area_ha', 'verified_at', 'verified_by', 'cancelled_reason'])
      expect(cols).toContain(c);
    const evCols = db.prepare('PRAGMA table_info(task_events)').all().map(c => c.name);
    for (const c of ['task_id', 'event_type', 'at', 'by', 'payload_json']) expect(evCols).toContain(c);
    db.close();
  });
});

describe('transition validity', () => {
  it('scheduled → in_progress stamps actual_start and writes a started event', () => {
    const db = makeDb(); const id = task(db);
    const r = transition(db, id, 'in_progress', { by: 'Alex' });
    expect(r.task.state).toBe('in_progress');
    expect(r.task.actual_start).toBeTruthy();
    expect(listEvents(db, id).map(e => e.event_type)).toContain('started');
    db.close();
  });
  it('rejects illegal jumps (scheduled → verified)', () => {
    const db = makeDb(); const id = task(db);
    const r = transition(db, id, 'verified', { by: 'Alex' });
    expect(r.error).toBe('illegal_transition');
    db.close();
  });
  it('in_progress → completed captures actuals', () => {
    const db = makeDb(); const id = task(db);
    transition(db, id, 'in_progress', {});
    const r = transition(db, id, 'completed', {
      actual_inputs_json: [{ product: 'Glifosaat', quantity: 12, unit: 'l' }],
      actual_duration_hrs: 5, actual_area_ha: 4,
    });
    expect(r.task.state).toBe('completed');
    expect(r.task.actual_end).toBeTruthy();
    expect(JSON.parse(r.task.actual_inputs_json)[0].quantity).toBe(12);
    expect(r.task.actual_area_ha).toBe(4);
    db.close();
  });
  it('cancel requires a reason and is terminal', () => {
    const db = makeDb(); const id = task(db);
    expect(transition(db, id, 'cancelled', {}).error).toBe('cancel_reason_required');
    transition(db, id, 'cancelled', { reason: 'rain' });
    expect(transition(db, id, 'in_progress', {}).error).toBe('illegal_transition');
    db.close();
  });
  it('legacy completed status (no state) is treated as completed', () => {
    const db = makeDb(); const id = task(db, { status: 'completed' });
    const r = transition(db, id, 'verified', { by: 'Alex' });
    expect(r.task.state).toBe('verified');
    db.close();
  });
});

describe('verify postings', () => {
  function completedTask(db) {
    product(db, { id: 'p1', name: 'Glifosaat', cost_per_unit: 100 });
    employee(db, { id: 'emp1', hourly_rate: 60 });
    const id = task(db);
    transition(db, id, 'in_progress', {});
    transition(db, id, 'completed', {
      actual_inputs_json: [{ product: 'Glifosaat', quantity: 12, unit: 'l' }],
      actual_duration_hrs: 5,
      at: '2026-03-01T10:00:00Z',
    });
    return id;
  }
  it('posts inventory + time entries tagged with task_id at verify', () => {
    const db = makeDb(); const id = completedTask(db);
    const r = transition(db, id, 'verified', { by: 'Alex', workers: [{ employee_id: 'emp1', hours: 5 }] });
    expect(r.error).toBeUndefined();
    const inv = db.prepare('SELECT * FROM inventory_transactions WHERE task_id = ?').all(id);
    expect(inv.length).toBe(1);
    expect(inv[0].quantity).toBe(12);
    expect(inv[0].total_cost).toBe(1200);          // 12 × R100
    expect(inv[0].cost_category).toBe('direct_variable');
    expect(inv[0].field_id).toBe('f1');
    const te = db.prepare('SELECT * FROM time_entries WHERE task_id = ?').all(id);
    expect(te.length).toBe(1);
    expect(te[0].hours_worked).toBe(5);
    expect(te[0].employee_id).toBe('emp1');
    db.close();
  });
  it('verify is idempotent — second call refuses and does not duplicate postings', () => {
    const db = makeDb(); const id = completedTask(db);
    transition(db, id, 'verified', { by: 'Alex', workers: [{ employee_id: 'emp1', hours: 5 }] });
    const again = transition(db, id, 'verified', { by: 'Alex' });
    expect(again.error).toBe('already_verified');
    expect(db.prepare('SELECT COUNT(*) n FROM inventory_transactions WHERE task_id = ?').get(id).n).toBe(1);
    db.close();
  });
  it('missing catalogue product → warning, posting skipped, rest proceeds', () => {
    const db = makeDb(); employee(db, { id: 'emp1' });
    const id = task(db);
    transition(db, id, 'in_progress', {});
    transition(db, id, 'completed', {
      actual_inputs_json: [{ product: 'Unobtainium', quantity: 3, unit: 'l' }],
    });
    const r = transition(db, id, 'verified', { by: 'Alex', workers: [{ employee_id: 'emp1', hours: 2 }] });
    expect(r.warnings).toContain('posting_product_missing: Unobtainium');
    expect(db.prepare('SELECT COUNT(*) n FROM inventory_transactions WHERE task_id = ?').get(id).n).toBe(0);
    expect(db.prepare('SELECT COUNT(*) n FROM time_entries WHERE task_id = ?').get(id).n).toBe(1);
    db.close();
  });
  it('falls back to template inputs × actual_area_ha when no actuals were captured', () => {
    const db = makeDb();
    product(db, { id: 'p1', name: 'Glifosaat', cost_per_unit: 100 });
    db.prepare(`INSERT INTO task_op_templates (id,usage,op_type,name,default_inputs_json,sort_order)
                VALUES ('tpl1','rooibos','spray','Onkruidspuit',?,0)`)
      .run(JSON.stringify([{ product: 'Glifosaat', rate_per_ha: 2, unit: 'l' }]));
    const id = task(db, { template_id: 'tpl1' });
    transition(db, id, 'in_progress', {});
    transition(db, id, 'completed', { actual_area_ha: 4 });   // 4 of 10 ha — pro-rated
    transition(db, id, 'verified', { by: 'Alex' });
    const inv = db.prepare('SELECT * FROM inventory_transactions WHERE task_id = ?').get(id);
    expect(inv.quantity).toBe(8);                              // 2 l/ha × 4 ha
    expect(inv.total_cost).toBe(800);
    db.close();
  });
  it('end-to-end: COP sees the verified actuals on the field line', () => {
    const db = makeDb(); const id = completedTask(db);
    transition(db, id, 'verified', { by: 'Alex', workers: [{ employee_id: 'emp1', hours: 5 }] });
    const line = computeFieldCop(db, 'f1', 2026).lines.find(l => l.usage === 'rooibos');
    expect(line.total_input_cost).toBe(1200);
    expect(line.total_labour_cost).toBe(300);                  // 5 h × R60
    db.close();
  });
});
