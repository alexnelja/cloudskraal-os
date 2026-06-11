// Spec 2h.1 — cost node map + enterprise summary endpoints.
// Spec 2h.3 — all-enterprises comparison + data-quality counters.
const { Router } = require('express');
const { getDb } = require('../db/schema');
const { buildCostNodeMap, enterpriseCostSummary } = require('../services/cost_node_map');
const { allEnterprisesSummary, dataQuality } = require('../services/reporting');

const router = Router();

router.get('/reporting/enterprises', (req, res) => {
  const db = getDb();
  const year = Number(req.query.year);
  if (!year) return res.status(400).json({ error: 'year_required' });
  res.json(allEnterprisesSummary(db, year, { denominator: req.query.denominator || undefined }));
});

router.get('/reporting/data-quality', (req, res) => {
  const db = getDb();
  const year = Number(req.query.year);
  if (!year) return res.status(400).json({ error: 'year_required' });
  res.json(dataQuality(db, year));
});

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
