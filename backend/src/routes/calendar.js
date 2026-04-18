const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');
const gcal = require('../services/google-calendar');

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

// POST /api/calendar/events — create event (+ push to Google)
router.post('/calendar/events', async (req, res) => {
  try {
    const db = getDb();
    const { title, enterprise, start_date, end_date, all_day, recurrence_rule, color, notes } = req.body;

    if (!title || !start_date) {
      return res.status(400).json({ error: 'title and start_date are required' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const allDayInt = all_day === false || all_day === 0 ? 0 : 1;
    db.prepare(`
      INSERT INTO calendar_events (id, title, enterprise, start_date, end_date, all_day, recurrence_rule, color, notes, google_event_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
    `).run(id, title, enterprise || null, start_date, end_date || null, allDayInt, recurrence_rule || null, color || null, notes || null, now, now);

    const event = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(id);

    // Push to Google Calendar (best-effort)
    try {
      const googleEventId = await gcal.pushEvent(event);
      db.prepare('UPDATE calendar_events SET google_event_id = ? WHERE id = ?').run(googleEventId, id);
      event.google_event_id = googleEventId;
    } catch (err) {
      console.warn('[gcal] Failed to push new event to Google:', err.message);
    }

    res.status(201).json(event);
  } catch (err) {
    console.error('Error creating event:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/calendar/events/:id — update event (+ push to Google)
router.patch('/calendar/events/:id', async (req, res) => {
  try {
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

    // Push update to Google Calendar (best-effort)
    try {
      const googleEventId = await gcal.pushEvent(event);
      if (!event.google_event_id && googleEventId) {
        db.prepare('UPDATE calendar_events SET google_event_id = ? WHERE id = ?').run(googleEventId, req.params.id);
        event.google_event_id = googleEventId;
      }
    } catch (err) {
      console.warn('[gcal] Failed to push event update to Google:', err.message);
    }

    res.json(event);
  } catch (err) {
    console.error('Error updating event:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/calendar/events/:id (+ delete from Google)
router.delete('/calendar/events/:id', async (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Event not found' });

    db.prepare('DELETE FROM calendar_events WHERE id = ?').run(req.params.id);

    // Delete from Google Calendar (best-effort)
    if (existing.google_event_id) {
      try {
        await gcal.deleteGoogleEvent(existing.enterprise, existing.google_event_id);
      } catch (err) {
        console.warn('[gcal] Failed to delete event from Google:', err.message);
      }
    }

    res.status(204).send();
  } catch (err) {
    console.error('Error deleting event:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===========================================================================
// GOOGLE CALENDAR SYNC
// ===========================================================================

// POST /api/calendar/sync — pull changes from Google Calendar
router.post('/calendar/sync', async (req, res) => {
  try {
    const db = getDb();
    const counts = await gcal.syncFromGoogle(db);
    res.json(counts);
  } catch (err) {
    console.error('[gcal] Sync failed:', err);
    res.status(500).json({ error: 'Sync failed', message: err.message });
  }
});

// POST /api/calendar/link-google — link existing local events to Google by title
router.post('/calendar/link-google', async (req, res) => {
  try {
    const db = getDb();
    const unlinked = db.prepare(
      'SELECT * FROM calendar_events WHERE google_event_id IS NULL'
    ).all();

    let linked = 0;
    for (const event of unlinked) {
      try {
        const googleEventId = await gcal.findEventByTitle(event.enterprise, event.title);
        if (googleEventId) {
          db.prepare('UPDATE calendar_events SET google_event_id = ? WHERE id = ?').run(googleEventId, event.id);
          linked++;
        }
      } catch (err) {
        console.warn(`[gcal] Failed to find Google event for "${event.title}":`, err.message);
      }
    }

    res.json({ unlinked: unlinked.length, linked });
  } catch (err) {
    console.error('[gcal] Link failed:', err);
    res.status(500).json({ error: 'Link failed', message: err.message });
  }
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
  const { status, enterprise, field_id, annotation_id, wiki_page_id, due_before, due_after } = req.query;

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
  if (annotation_id) {
    conditions.push('t.annotation_id = ?');
    params.push(annotation_id);
  }
  if (wiki_page_id) {
    conditions.push('t.wiki_page_id = ?');
    params.push(wiki_page_id);
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

  const tags = db.prepare(
    'SELECT t.* FROM tags t JOIN task_tags tt ON t.id = tt.tag_id WHERE tt.task_id = ?'
  ).all(req.params.id);
  task.tags = tags;

  if (task.status_id) {
    const statusRow = db.prepare('SELECT name, color, category FROM task_statuses WHERE id = ?').get(task.status_id);
    if (statusRow) {
      task.status_name = statusRow.name;
      task.status_color = statusRow.color;
      task.status_category = statusRow.category;
    }
  }

  let depends_on_task = null;
  if (task.depends_on_task_id) {
    depends_on_task = db.prepare('SELECT id, title, status FROM tasks WHERE id = ?').get(task.depends_on_task_id);
  }

  res.json({ ...task, inputs, checklists, depends_on_task });
});

// POST /api/tasks — create task (+ push due date to Google)
router.post('/tasks', async (req, res) => {
  try {
    const db = getDb();
    const {
      title, description, enterprise, field_id, annotation_id, wiki_page_id, type, status, priority,
      due_date, assigned_to, depends_on_task_id, recurrence_rule,
      calendar_event_id, notes
    } = req.body;

    if (!title) return res.status(400).json({ error: 'title is required' });

    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO tasks (id, title, description, enterprise, field_id, annotation_id, wiki_page_id, type, status, priority, due_date, completed_date, completed_by, assigned_to, depends_on_task_id, recurrence_rule, calendar_event_id, google_event_id, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, NULL, ?, ?, ?)
    `).run(
      id, title, description || null, enterprise || null, field_id || null,
      annotation_id || null, wiki_page_id || null,
      type || 'manual', status || 'pending', priority || 'medium',
      due_date || null, assigned_to || null, depends_on_task_id || null,
      recurrence_rule || null, calendar_event_id || null, notes || null,
      now, now
    );

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);

    // Push task due date to Google Calendar (best-effort)
    if (task.due_date) {
      try {
        const googleEventId = await gcal.pushTaskDueDate(task);
        db.prepare('UPDATE tasks SET google_event_id = ? WHERE id = ?').run(googleEventId, id);
        task.google_event_id = googleEventId;
      } catch (err) {
        console.warn('[gcal] Failed to push task due date to Google:', err.message);
      }
    }

    res.status(201).json(task);
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/tasks/:id — update task
router.patch('/tasks/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const allowed = [
    'title', 'description', 'enterprise', 'field_id', 'annotation_id', 'wiki_page_id',
    'type', 'status', 'priority', 'due_date', 'assigned_to', 'depends_on_task_id',
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

  // Delete task's Google Calendar event (best-effort)
  if (existing.google_event_id) {
    gcal.deleteGoogleEvent(existing.enterprise, existing.google_event_id).catch(err => {
      console.warn('[gcal] Failed to delete task event from Google:', err.message);
    });
  }

  res.status(204).send();
});

// POST /api/tasks/:id/complete — mark task complete with dependency check (+ update Google)
router.post('/tasks/:id/complete', async (req, res) => {
  try {
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

    // Update Google Calendar event to show completed (best-effort)
    if (task.google_event_id) {
      try {
        const desc = `[COMPLETED] ${now}\nPriority: ${task.priority || 'medium'}\nEnterprise: ${task.enterprise || 'general'}\nType: ${task.type || 'manual'}`;
        await gcal.updateGoogleEventDescription(task.enterprise, task.google_event_id, desc);
      } catch (err) {
        console.warn('[gcal] Failed to update completed task in Google:', err.message);
      }
    }

    const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    console.error('Error completing task:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
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
