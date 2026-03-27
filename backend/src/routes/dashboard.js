const { Router } = require('express');
const { getDb } = require('../db/schema');

const router = Router();

router.get('/stats', (req, res) => {
  const db = getDb();

  const totalProjects = db.prepare('SELECT COUNT(*) as count FROM projects').get().count;
  const totalCapexBudget = db.prepare('SELECT COALESCE(SUM(initialOutlay), 0) as total FROM projects').get().total;

  // Average IRR across all scenarios that have a computed IRR
  const avgIrrRow = db.prepare('SELECT AVG(irr) as avg FROM scenarios WHERE irr IS NOT NULL').get();
  const avgIrr = avgIrrRow.avg !== null ? Math.round(avgIrrRow.avg * 10000) / 10000 : null;

  // Best NPV project
  const bestNpvRow = db.prepare(`
    SELECT p.name, s.npv
    FROM scenarios s
    JOIN projects p ON s.projectId = p.id
    WHERE s.npv IS NOT NULL
    ORDER BY s.npv DESC
    LIMIT 1
  `).get();

  const bestNpvProject = bestNpvRow ? { name: bestNpvRow.name, npv: bestNpvRow.npv } : null;

  res.json({
    totalProjects,
    totalCapexBudget,
    avgIrr,
    bestNpvProject,
  });
});

module.exports = router;
