// Spec 3.2 — usage-filtered task suggestions for a field.
const { Router } = require('express');
const { getDb } = require('../db/schema');
const { suggestionsForField, estimateCost } = require('../services/task_suggestions');

const router = Router();

router.get('/fields/:id/task-suggestions', (req, res) => {
  const db = getDb();
  const r = suggestionsForField(db, req.params.id, req.query.date || undefined);
  if (r.error === 'field_not_found') return res.status(404).json({ error: 'Not found' });
  res.json(r);
});

router.get('/task-templates', (req, res) => {
  const db = getDb();
  const rows = req.query.usage
    ? db.prepare('SELECT * FROM task_op_templates WHERE usage = ? ORDER BY sort_order, name').all(req.query.usage)
    : db.prepare('SELECT * FROM task_op_templates ORDER BY usage, sort_order, name').all();
  res.json(rows);
});

router.get('/task-templates/:id/estimate', (req, res) => {
  const db = getDb();
  const area = Number(req.query.area_ha);
  if (!Number.isFinite(area)) return res.status(400).json({ error: 'area_ha_required' });
  const r = estimateCost(db, req.params.id, area);
  if (r.error === 'template_not_found') return res.status(404).json({ error: 'Not found' });
  res.json(r);
});

module.exports = router;
