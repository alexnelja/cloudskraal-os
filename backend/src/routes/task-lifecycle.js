// Spec 4.1 — task lifecycle transitions + audit trail.
const { Router } = require('express');
const { getDb } = require('../db/schema');
const { transition, listEvents } = require('../services/task_lifecycle');

const router = Router();

const ERROR_STATUS = {
  task_not_found: 404,
  illegal_transition: 409,
  already_verified: 409,
  cancel_reason_required: 400,
};

router.post('/tasks/:id/transition', (req, res) => {
  const db = getDb();
  const { to_state, ...payload } = req.body || {};
  if (!to_state) return res.status(400).json({ error: 'to_state_required' });
  const r = transition(db, req.params.id, to_state, payload);
  if (r.error) return res.status(ERROR_STATUS[r.error] || 400).json(r);
  res.json(r);
});

router.get('/tasks/:id/events', (req, res) => {
  const db = getDb();
  if (!db.prepare('SELECT id FROM tasks WHERE id = ?').get(req.params.id)) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json(listEvents(db, req.params.id));
});

module.exports = router;
