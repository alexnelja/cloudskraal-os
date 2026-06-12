// Spec 2i.5 — financing cost stream CRUD + rollup.
const { Router } = require('express');
const { getDb } = require('../db/schema');
const { addFinancingCost, financingSummary } = require('../services/financing');

const router = Router();

router.get('/financing-costs', (req, res) => {
  const db = getDb();
  const rows = req.query.year
    ? db.prepare('SELECT * FROM financing_costs WHERE year = ? ORDER BY kind, created_at').all(Number(req.query.year))
    : db.prepare('SELECT * FROM financing_costs ORDER BY year DESC, kind').all();
  res.json(rows);
});

router.post('/financing-costs', (req, res) => {
  const db = getDb();
  const r = addFinancingCost(db, req.body || {});
  if (r.error) return res.status(400).json(r);
  res.status(201).json(r);
});

router.delete('/financing-costs/:id', (req, res) => {
  const db = getDb();
  const r = db.prepare('DELETE FROM financing_costs WHERE id = ?').run(req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

router.get('/reporting/financing', (req, res) => {
  const db = getDb();
  const year = Number(req.query.year);
  if (!year) return res.status(400).json({ error: 'year_required' });
  res.json(financingSummary(db, year, { enterprise: req.query.enterprise || undefined }));
});

module.exports = router;
