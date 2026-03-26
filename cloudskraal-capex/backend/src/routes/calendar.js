const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');

const router = Router();

// ===========================================================================
// CALENDAR EVENTS
// ===========================================================================

// GET /api/calendar/events — list events, optional ?month=YYYY-MM&enterprise=X
router.get('/calendar/events', (req, res) => {
  const db = getDb();
  const { month, enterprise } = req.query;

  const conditions = [];
  const params = [];

  if (month) {
    // month format: YYYY-MM
    const start = `${month}-01`;
    const [y, m] = month.split('-').map(Number);
    const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    conditions.push('start_date >= ? AND start_date < ?');
    params.push(start, nextMonth);
  }

  if (enterprise) {
    conditions.push('enterprise = ?');
    params.push(enterprise);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const events = db.prepare(`SELECT * FROM calendar_events ${where} ORDER BY start_date`).all(...params);
  res.json(events);
});

// POST /api/calendar/events — create event
router.post('/calendar/events', (req, res) => {
  const db = getDb();
  const { title, enterprise, start_date, end_date, all_day, recurrence_rule, color, notes } = req.body;

  if (!title || !start_date) {
    return res.status(400).json({ error: 'title and start_date are required' });
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO calendar_events (id, title, enterprise, start_date, end_date, all_day, recurrence_rule, color, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, title, enterprise || null, start_date, end_date || null, all_day != null ? all_day : 1, recurrence_rule || null, color || null, notes || null, now, now);

  const event = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(id);
  res.status(201).json(event);
});

// PATCH /api/calendar/events/:id — update event
router.patch('/calendar/events/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Event not found' });

  const allowed = ['title', 'enterprise', 'start_date', 'end_date', 'all_day', 'recurrence_rule', 'color', 'notes'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length > 0) {
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), new Date().toISOString(), req.params.id];
    db.prepare(`UPDATE calendar_events SET ${setClauses}, updated_at = ? WHERE id = ?`).run(...values);
  }

  const event = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(req.params.id);
  res.json(event);
});

// DELETE /api/calendar/events/:id
router.delete('/calendar/events/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Event not found' });

  db.prepare('DELETE FROM calendar_events WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

// ===========================================================================
// CALENDAR SUMMARY
// ===========================================================================

// GET /api/calendar/summary?month=YYYY-MM
router.get('/calendar/summary', (req, res) => {
  const db = getDb();
  const { month } = req.query;

  if (!month) return res.status(400).json({ error: 'month query param required (YYYY-MM)' });

  const start = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;

  const events = db.prepare(`
    SELECT * FROM calendar_events WHERE start_date >= ? AND start_date < ? ORDER BY start_date
  `).all(start, nextMonth);

  const tasks = db.prepare(`
    SELECT t.*, f.name AS field_name
    FROM tasks t
    LEFT JOIN fields f ON t.field_id = f.id
    WHERE t.due_date >= ? AND t.due_date < ?
    ORDER BY t.due_date
  `).all(start, nextMonth);

  res.json({ events, tasks });
});

// ===========================================================================
// TASKS
// ===========================================================================

// GET /api/tasks/overdue — must be before /api/tasks/:id
router.get('/tasks/overdue', (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  const tasks = db.prepare(`
    SELECT t.*, f.name AS field_name
    FROM tasks t
    LEFT JOIN fields f ON t.field_id = f.id
    WHERE t.due_date < ? AND t.status NOT IN ('completed', 'skipped')
    ORDER BY t.due_date
  `).all(today);

  res.json(tasks);
});

// GET /api/tasks/upcoming?days=7
router.get('/tasks/upcoming', (req, res) => {
  const db = getDb();
  const days = parseInt(req.query.days) || 7;
  const today = new Date().toISOString().slice(0, 10);

  const future = new Date();
  future.setDate(future.getDate() + days);
  const futureStr = future.toISOString().slice(0, 10);

  const tasks = db.prepare(`
    SELECT t.*, f.name AS field_name
    FROM tasks t
    LEFT JOIN fields f ON t.field_id = f.id
    WHERE t.due_date >= ? AND t.due_date <= ? AND t.status != 'completed'
    ORDER BY t.due_date
  `).all(today, futureStr);

  res.json(tasks);
});

// GET /api/tasks — list tasks
router.get('/tasks', (req, res) => {
  const db = getDb();
  const { status, enterprise, field_id, due_before, due_after } = req.query;

  const conditions = [];
  const params = [];

  if (status) {
    conditions.push('t.status = ?');
    params.push(status);
  }
  if (enterprise) {
    conditions.push('t.enterprise = ?');
    params.push(enterprise);
  }
  if (field_id) {
    conditions.push('t.field_id = ?');
    params.push(field_id);
  }
  if (due_before) {
    conditions.push('t.due_date < ?');
    params.push(due_before);
  }
  if (due_after) {
    conditions.push('t.due_date > ?');
    params.push(due_after);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const tasks = db.prepare(`
    SELECT t.*, f.name AS field_name
    FROM tasks t
    LEFT JOIN fields f ON t.field_id = f.id
    ${where}
    ORDER BY CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date ASC
  `).all(...params);

  res.json(tasks);
});

// GET /api/tasks/:id — full task with inputs, checklists, dependency info
router.get('/tasks/:id', (req, res) => {
  const db = getDb();

  const task = db.prepare(`
    SELECT t.*, f.name AS field_name
    FROM tasks t
    LEFT JOIN fields f ON t.field_id = f.id
    WHERE t.id = ?
  `).get(req.params.id);

  if (!task) return res.status(404).json({ error: 'Task not found' });

  const inputs = db.prepare('SELECT * FROM task_inputs WHERE task_id = ?').all(req.params.id);
  const checklists = db.prepare('SELECT * FROM task_checklists WHERE task_id = ? ORDER BY sort_order').all(req.params.id);

  let depends_on_task = null;
  if (task.depends_on_task_id) {
    depends_on_task = db.prepare('SELECT id, title, status FROM tasks WHERE id = ?').get(task.depends_on_task_id);
  }

  res.json({ ...task, inputs, checklists, depends_on_task });
});

// POST /api/tasks — create task
router.post('/tasks', (req, res) => {
  const db = getDb();
  const {
    title, description, enterprise, field_id, type, status, priority,
    due_date, assigned_to, depends_on_task_id, recurrence_rule,
    calendar_event_id, notes
  } = req.body;

  if (!title) return res.status(400).json({ error: 'title is required' });

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO tasks (id, title, description, enterprise, field_id, type, status, priority, due_date, completed_date, completed_by, assigned_to, depends_on_task_id, recurrence_rule, calendar_event_id, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, title, description || null, enterprise || null, field_id || null,
    type || 'manual', status || 'pending', priority || 'medium',
    due_date || null, assigned_to || null, depends_on_task_id || null,
    recurrence_rule || null, calendar_event_id || null, notes || null,
    now, now
  );

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.status(201).json(task);
});

// PATCH /api/tasks/:id — update task
router.patch('/tasks/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const allowed = [
    'title', 'description', 'enterprise', 'field_id', 'type', 'status',
    'priority', 'due_date', 'assigned_to', 'depends_on_task_id',
    'recurrence_rule', 'calendar_event_id', 'notes'
  ];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length > 0) {
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), new Date().toISOString(), req.params.id];
    db.prepare(`UPDATE tasks SET ${setClauses}, updated_at = ? WHERE id = ?`).run(...values);
  }

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  res.json(task);
});

// DELETE /api/tasks/:id
router.delete('/tasks/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

// POST /api/tasks/:id/complete — mark task complete with dependency check
router.post('/tasks/:id/complete', (req, res) => {
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  if (task.depends_on_task_id) {
    const dep = db.prepare('SELECT status FROM tasks WHERE id = ?').get(task.depends_on_task_id);
    if (dep && dep.status !== 'completed') {
      return res.status(400).json({ error: 'Dependency not completed' });
    }
  }

  const now = new Date().toISOString();
  db.prepare(`UPDATE tasks SET status = 'completed', completed_date = ?, updated_at = ? WHERE id = ?`).run(now, now, req.params.id);

  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// ===========================================================================
// TASK INPUTS
// ===========================================================================

// POST /api/tasks/:id/inputs — add input
router.post('/tasks/:id/inputs', (req, res) => {
  const db = getDb();
  const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const { product_name, category, rate, rate_unit, total_applied, total_unit, cost_per_unit, total_cost, notes } = req.body;
  if (!product_name) return res.status(400).json({ error: 'product_name is required' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO task_inputs (id, task_id, product_name, category, rate, rate_unit, total_applied, total_unit, cost_per_unit, total_cost, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.params.id, product_name, category || null, rate || null, rate_unit || null, total_applied || null, total_unit || null, cost_per_unit || null, total_cost || null, notes || null);

  const input = db.prepare('SELECT * FROM task_inputs WHERE id = ?').get(id);
  res.status(201).json(input);
});

// DELETE /api/task-inputs/:id
router.delete('/task-inputs/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM task_inputs WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Input not found' });

  db.prepare('DELETE FROM task_inputs WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

// ===========================================================================
// TASK CHECKLISTS
// ===========================================================================

// POST /api/tasks/:id/checklist — add checklist item
router.post('/tasks/:id/checklist', (req, res) => {
  const db = getDb();
  const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const { item, sort_order } = req.body;
  if (!item) return res.status(400).json({ error: 'item is required' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO task_checklists (id, task_id, item, checked, sort_order)
    VALUES (?, ?, ?, 0, ?)
  `).run(id, req.params.id, item, sort_order || 0);

  const checklist = db.prepare('SELECT * FROM task_checklists WHERE id = ?').get(id);
  res.status(201).json(checklist);
});

// PATCH /api/task-checklists/:id
router.patch('/task-checklists/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM task_checklists WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Checklist item not found' });

  const allowed = ['checked', 'item'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length > 0) {
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), req.params.id];
    db.prepare(`UPDATE task_checklists SET ${setClauses} WHERE id = ?`).run(...values);
  }

  const item = db.prepare('SELECT * FROM task_checklists WHERE id = ?').get(req.params.id);
  res.json(item);
});

// DELETE /api/task-checklists/:id
router.delete('/task-checklists/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM task_checklists WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Checklist item not found' });

  db.prepare('DELETE FROM task_checklists WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

module.exports = router;
