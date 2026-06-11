// Spec 4.1 — task lifecycle state machine. Verify posts the task's actuals to
// COP (inventory_transactions per input + time_entries per worker) exactly
// once — the task_events trail is the idempotency source of truth.
const { randomUUID } = require('crypto');

const LEGAL = {
  scheduled: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: ['verified', 'cancelled'],
  verified: [],
  cancelled: [],
};

function round2(n) { return Math.round(n * 100) / 100; }

// Legacy rows predate `state`: derive from the free-text status.
function currentState(task) {
  if (task.state) return task.state;
  return task.status === 'completed' ? 'completed' : 'scheduled';
}

function writeEvent(db, taskId, type, at, by, payload) {
  db.prepare(`INSERT INTO task_events (id,task_id,event_type,at,by,payload_json)
              VALUES (?,?,?,?,?,?)`)
    .run(randomUUID(), taskId, type, at, by || null, payload ? JSON.stringify(payload) : null);
}

function listEvents(db, taskId) {
  return db.prepare('SELECT * FROM task_events WHERE task_id = ? ORDER BY at, id').all(taskId);
}

// Resolve the inputs to post: captured actuals win; else template defaults
// pro-rated by actual_area_ha (fallback: the field's full area).
function inputsToPost(db, task) {
  let actuals = [];
  try { actuals = task.actual_inputs_json ? JSON.parse(task.actual_inputs_json) : []; } catch { /* fall through */ }
  if (actuals.length) return actuals;

  if (!task.template_id) return [];
  const tpl = db.prepare('SELECT default_inputs_json FROM task_op_templates WHERE id = ?').get(task.template_id);
  if (!tpl || !tpl.default_inputs_json) return [];
  let defaults = [];
  try { defaults = JSON.parse(tpl.default_inputs_json); } catch { return []; }

  let area = task.actual_area_ha;
  if (area == null && task.field_id) {
    const f = db.prepare('SELECT COALESCE(area_ha,0) AS area_ha FROM fields WHERE id = ?').get(task.field_id);
    area = f ? f.area_ha : 0;
  }
  return defaults.map(d => ({ product: d.product, quantity: round2((d.rate_per_ha || 0) * (area || 0)), unit: d.unit }));
}

function postActuals(db, task, payload, at, warnings) {
  const date = String(task.actual_end || at).slice(0, 10);
  const opType = task.template_id
    ? (db.prepare('SELECT op_type FROM task_op_templates WHERE id = ?').get(task.template_id) || {}).op_type
    : null;

  for (const input of inputsToPost(db, task)) {
    const prod = db.prepare('SELECT id, cost_per_unit FROM input_products WHERE name = ?').get(input.product);
    if (!prod) { warnings.push(`posting_product_missing: ${input.product}`); continue; }
    const unitCost = input.unit_cost ?? prod.cost_per_unit ?? 0;
    db.prepare(`INSERT INTO inventory_transactions
      (id,product_id,type,date,quantity,unit_cost,total_cost,field_id,task_id,cost_category,notes,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(randomUUID(), prod.id, 'usage', date, input.quantity, unitCost,
           round2(input.quantity * unitCost), task.field_id, task.id, 'direct_variable',
           `posted on verify of task ${task.id}`, at);
  }

  const workers = Array.isArray(payload.workers) ? payload.workers : [];
  for (const w of workers) {
    db.prepare(`INSERT INTO time_entries
      (id,employee_id,date,hours_worked,activity_type,field_id,task_id,cost_category,created_at)
      VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(randomUUID(), w.employee_id, date, w.hours, opType, task.field_id, task.id, 'direct_variable', at);
  }
  if (!workers.length && task.actual_duration_hrs > 0) {
    warnings.push('labour_not_posted_no_workers');
  }
}

function transition(db, taskId, toState, payload = {}) {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!task) return { error: 'task_not_found' };

  // Idempotency first (spec: task_events is the source of truth) — a re-fired
  // verify reports already_verified, not a generic illegal_transition.
  if (toState === 'verified') {
    const already = db.prepare(
      "SELECT 1 FROM task_events WHERE task_id = ? AND event_type = 'verified' LIMIT 1"
    ).get(taskId);
    if (already) return { error: 'already_verified' };
  }

  const from = currentState(task);
  if (!(LEGAL[from] || []).includes(toState)) {
    return { error: 'illegal_transition', from, to: toState };
  }

  const at = payload.at || new Date().toISOString();
  const warnings = [];

  const run = db.transaction(() => {
    if (toState === 'in_progress') {
      db.prepare(`UPDATE tasks SET state='in_progress', status='in_progress', actual_start=?,
                  assigned_to=COALESCE(?, assigned_to), updated_at=? WHERE id=?`)
        .run(at, payload.assigned_to || null, at, taskId);
      writeEvent(db, taskId, 'started', at, payload.by);
    } else if (toState === 'completed') {
      const inputsJson = payload.actual_inputs_json != null
        ? (typeof payload.actual_inputs_json === 'string'
            ? payload.actual_inputs_json : JSON.stringify(payload.actual_inputs_json))
        : null;
      db.prepare(`UPDATE tasks SET state='completed', status='completed', actual_end=?,
                  actual_inputs_json=COALESCE(?, actual_inputs_json),
                  actual_duration_hrs=COALESCE(?, actual_duration_hrs),
                  actual_area_ha=COALESCE(?, actual_area_ha),
                  completed_date=?, updated_at=? WHERE id=?`)
        .run(at, inputsJson, payload.actual_duration_hrs ?? null,
             payload.actual_area_ha ?? null, at, at, taskId);
      writeEvent(db, taskId, 'completed', at, payload.by,
                 { actual_duration_hrs: payload.actual_duration_hrs, actual_area_ha: payload.actual_area_ha });
    } else if (toState === 'cancelled') {
      db.prepare(`UPDATE tasks SET state='cancelled', status='cancelled', cancelled_reason=?,
                  updated_at=? WHERE id=?`).run(payload.reason, at, taskId);
      writeEvent(db, taskId, 'cancelled', at, payload.by, { reason: payload.reason });
    } else if (toState === 'verified') {
      const fresh = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
      postActuals(db, fresh, payload, at, warnings);
      db.prepare(`UPDATE tasks SET state='verified', verified_at=?, verified_by=?, updated_at=?
                  WHERE id=?`).run(at, payload.by || null, at, taskId);
      writeEvent(db, taskId, 'verified', at, payload.by, { workers: payload.workers });
    }
  });

  if (toState === 'cancelled' && !payload.reason) return { error: 'cancel_reason_required' };

  run();
  return { task: db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId), warnings };
}

module.exports = { transition, listEvents, currentState };
