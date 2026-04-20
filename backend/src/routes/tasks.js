const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');

const router = Router();

const FARM_ID = 'cloudskraal';

// ===========================================================================
// TAGS
// ===========================================================================

// GET /api/tags — list all tags, optional ?group=enterprise|category|custom
router.get('/tags', (req, res) => {
  const db = getDb();
  const { group } = req.query;

  let sql = 'SELECT * FROM tags WHERE farm_id = ?';
  const params = [FARM_ID];

  if (group) {
    sql += ' AND "group" = ?';
    params.push(group);
  }

  sql += ' ORDER BY sort_order, name';

  const tags = db.prepare(sql).all(...params);
  res.json(tags);
});

// POST /api/tags — create tag
router.post('/tags', (req, res) => {
  try {
    const db = getDb();
    const { name, color, group } = req.body;

    if (!name) return res.status(400).json({ error: 'name is required' });

    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO tags (id, farm_id, name, color, "group", sort_order, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `).run(id, FARM_ID, name, color || '#6b7280', group || 'custom', now);

    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
    res.status(201).json(tag);
  } catch (err) {
    console.error('Error creating tag:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/tags/:id — update tag
router.patch('/tags/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Tag not found' });

  const allowed = ['name', 'color', 'sort_order'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  // Handle "group" separately (reserved word)
  if (req.body.group !== undefined) updates['"group"'] = req.body.group;

  if (Object.keys(updates).length > 0) {
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), req.params.id];
    db.prepare(`UPDATE tags SET ${setClauses} WHERE id = ?`).run(...values);
  }

  const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id);
  res.json(tag);
});

// DELETE /api/tags/:id — delete tag + its task_tags entries
router.delete('/tags/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM tags WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Tag not found' });

  db.prepare('DELETE FROM task_tags WHERE tag_id = ?').run(req.params.id);
  db.prepare('DELETE FROM tags WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

// ===========================================================================
// TASK STATUSES
// ===========================================================================

const VALID_CATEGORIES = ['active', 'done', 'closed'];

// GET /api/task-statuses — list all statuses
router.get('/task-statuses', (req, res) => {
  const db = getDb();
  const statuses = db.prepare(
    'SELECT * FROM task_statuses WHERE farm_id = ? ORDER BY sort_order'
  ).all(FARM_ID);
  res.json(statuses);
});

// POST /api/task-statuses — create status
router.post('/task-statuses', (req, res) => {
  try {
    const db = getDb();
    const { name, color, category } = req.body;

    if (!name) return res.status(400).json({ error: 'name is required' });
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
    }

    const id = uuidv4();

    db.prepare(`
      INSERT INTO task_statuses (id, farm_id, name, color, category, sort_order, is_default)
      VALUES (?, ?, ?, ?, ?, 0, 0)
    `).run(id, FARM_ID, name, color || '#6b7280', category);

    const status = db.prepare('SELECT * FROM task_statuses WHERE id = ?').get(id);
    res.status(201).json(status);
  } catch (err) {
    console.error('Error creating task status:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/task-statuses/:id — update status
router.patch('/task-statuses/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM task_statuses WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Status not found' });

  const allowed = ['name', 'color', 'category', 'sort_order'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      if (key === 'category' && !VALID_CATEGORIES.includes(req.body[key])) {
        return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
      }
      updates[key] = req.body[key];
    }
  }

  if (Object.keys(updates).length > 0) {
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), req.params.id];
    db.prepare(`UPDATE task_statuses SET ${setClauses} WHERE id = ?`).run(...values);
  }

  const status = db.prepare('SELECT * FROM task_statuses WHERE id = ?').get(req.params.id);
  res.json(status);
});

// DELETE /api/task-statuses/:id — delete status
router.delete('/task-statuses/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM task_statuses WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Status not found' });

  // Reassign tasks using this status to the default before deleting
  const defaultStatus = db.prepare(
    'SELECT id FROM task_statuses WHERE farm_id = ? AND is_default = 1 AND id != ? LIMIT 1'
  ).get('cloudskraal', req.params.id);
  if (defaultStatus) {
    db.prepare('UPDATE tasks SET status_id = ? WHERE status_id = ?').run(defaultStatus.id, req.params.id);
  } else {
    db.prepare('UPDATE tasks SET status_id = NULL WHERE status_id = ?').run(req.params.id);
  }

  db.prepare('DELETE FROM task_statuses WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

// ===========================================================================
// TASK-TAG LINKING
// ===========================================================================

// POST /api/tasks/:id/tags — link a tag to a task
router.post('/tasks/:id/tags', (req, res) => {
  try {
    const db = getDb();
    const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const { tag_id } = req.body;
    if (!tag_id) return res.status(400).json({ error: 'tag_id is required' });

    const tag = db.prepare('SELECT id FROM tags WHERE id = ?').get(tag_id);
    if (!tag) return res.status(404).json({ error: 'Tag not found' });

    // Idempotent: check if already linked
    const existing = db.prepare(
      'SELECT id FROM task_tags WHERE task_id = ? AND tag_id = ?'
    ).get(req.params.id, tag_id);

    if (existing) {
      return res.status(200).json({ id: existing.id, task_id: req.params.id, tag_id });
    }

    const id = uuidv4();
    db.prepare(
      'INSERT INTO task_tags (id, task_id, tag_id) VALUES (?, ?, ?)'
    ).run(id, req.params.id, tag_id);

    res.status(201).json({ id, task_id: req.params.id, tag_id });
  } catch (err) {
    console.error('Error linking tag to task:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/tasks/:id/tags/:tagId — unlink a tag from a task
router.delete('/tasks/:id/tags/:tagId', (req, res) => {
  const db = getDb();
  db.prepare(
    'DELETE FROM task_tags WHERE task_id = ? AND tag_id = ?'
  ).run(req.params.id, req.params.tagId);
  res.status(204).send();
});

module.exports = router;
