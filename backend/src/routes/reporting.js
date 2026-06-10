// Spec 2h.1 — cost node map + enterprise summary endpoints.
const { Router } = require('express');
const { getDb } = require('../db/schema');
const { buildCostNodeMap, enterpriseCostSummary } = require('../services/cost_node_map');

const router = Router();

router.get('/fields/:id/cost-node-map', (req, res) => {
  const db = getDb();
  const year = Number(req.query.year);
  if (!year) return res.status(400).json({ error: 'year_required' });
  const r = buildCostNodeMap(db, req.params.id, year, {
    include: req.query.include,
    denominator: req.query.denominator || undefined,
  });
  if (r && r.error === 'field_not_found') return res.status(404).json({ error: 'Not found' });
  res.json(r);
});

router.get('/reporting/enterprise-summary', (req, res) => {
  const db = getDb();
  const year = Number(req.query.year);
  if (!year) return res.status(400).json({ error: 'year_required' });
  if (!req.query.enterprise) return res.status(400).json({ error: 'enterprise_required' });
  res.json(enterpriseCostSummary(db, req.query.enterprise, year, {
    include: req.query.include,
    denominator: req.query.denominator || undefined,
  }));
});

module.exports = router;
