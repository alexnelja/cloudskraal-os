const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');
const { computeAll } = require('../services/financial');

const router = Router();

// Helper: get full project with cashFlows and scenarios
function getFullProject(db, id) {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!project) return null;

  const cashFlows = db.prepare('SELECT * FROM cash_flows WHERE projectId = ? ORDER BY year').all(id);
  const scenarios = db.prepare('SELECT * FROM scenarios WHERE projectId = ?').all(id);

  return { ...project, cashFlows, scenarios };
}

// GET /api/projects — list summaries
router.get('/', (req, res) => {
  const db = getDb();

  const projects = db.prepare('SELECT * FROM projects ORDER BY createdAt DESC').all();

  const summaries = projects.map(p => {
    const bestScenario = db.prepare(
      'SELECT npv, irr FROM scenarios WHERE projectId = ? ORDER BY npv DESC LIMIT 1'
    ).get(p.id);

    return {
      id: p.id,
      name: p.name,
      type: p.type,
      initialOutlay: p.initialOutlay,
      status: p.status,
      priority: p.priority,
      taxBenefit: p.taxBenefit,
      bestNpv: bestScenario ? bestScenario.npv : null,
      bestIrr: bestScenario ? bestScenario.irr : null,
    };
  });

  res.json(summaries);
});

// GET /api/projects/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const project = getFullProject(db, req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
});

// POST /api/projects
router.post('/', (req, res) => {
  const db = getDb();
  const { name, type, description, initialOutlay, usefulLifeYears, salvageValue, priority, taxBenefit } = req.body;

  if (!name || !type) {
    return res.status(400).json({ error: 'name and type are required' });
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO projects (id, name, type, description, initialOutlay, usefulLifeYears, salvageValue, status, priority, taxBenefit, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)
  `).run(id, name, type, description || '', initialOutlay || 0, usefulLifeYears || 10, salvageValue || 0, priority || 'tier3', taxBenefit || '', now, now);

  const project = getFullProject(db, id);
  res.status(201).json(project);
});

// PATCH /api/projects/:id
router.patch('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Project not found' });

  const fields = ['name', 'type', 'description', 'initialOutlay', 'usefulLifeYears', 'salvageValue', 'status', 'priority', 'taxBenefit'];
  const updates = {};
  for (const f of fields) {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  }

  if (Object.keys(updates).length > 0) {
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(new Date().toISOString());
    values.push(req.params.id);

    db.prepare(`UPDATE projects SET ${setClauses}, updatedAt = ? WHERE id = ?`).run(...values);
  }

  // If financial inputs changed, recompute all scenarios
  const financialFields = ['initialOutlay', 'usefulLifeYears', 'salvageValue'];
  const financialChanged = financialFields.some(f => updates[f] !== undefined);
  if (financialChanged) {
    recomputeScenarios(db, req.params.id);
  }

  const project = getFullProject(db, req.params.id);
  res.json(project);
});

// DELETE /api/projects/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Project not found' });

  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

// --- Cash Flows ---

// GET /api/projects/:id/cashflows
router.get('/:id/cashflows', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const cashFlows = db.prepare('SELECT * FROM cash_flows WHERE projectId = ? ORDER BY year').all(req.params.id);
  res.json(cashFlows);
});

// PUT /api/projects/:id/cashflows — replace all cash flows
router.put('/:id/cashflows', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const { cashFlows } = req.body;
  if (!Array.isArray(cashFlows)) {
    return res.status(400).json({ error: 'cashFlows array is required' });
  }

  const replaceCashFlows = db.transaction(() => {
    db.prepare('DELETE FROM cash_flows WHERE projectId = ?').run(req.params.id);

    const insert = db.prepare(`
      INSERT INTO cash_flows (id, projectId, year, revenue, operatingCosts, netCashFlow)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const cf of cashFlows) {
      const netCashFlow = (cf.revenue || 0) - (cf.operatingCosts || 0);
      insert.run(uuidv4(), req.params.id, cf.year, cf.revenue || 0, cf.operatingCosts || 0, netCashFlow);
    }

    // Update project timestamp
    db.prepare('UPDATE projects SET updatedAt = ? WHERE id = ?').run(new Date().toISOString(), req.params.id);
  });

  replaceCashFlows();

  // Recompute all scenarios for this project
  recomputeScenarios(db, req.params.id);

  const result = db.prepare('SELECT * FROM cash_flows WHERE projectId = ? ORDER BY year').all(req.params.id);
  res.json(result);
});

// --- Scenarios ---

// GET /api/projects/:id/scenarios
router.get('/:id/scenarios', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const scenarios = db.prepare('SELECT * FROM scenarios WHERE projectId = ?').all(req.params.id);
  res.json(scenarios);
});

// POST /api/projects/:id/scenarios
router.post('/:id/scenarios', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const { name, debtPercent, equityPercent, interestRate, loanTermYears, equityCostPercent, repaymentType } = req.body;

  if (!name) return res.status(400).json({ error: 'name is required' });

  const cashFlows = db.prepare('SELECT * FROM cash_flows WHERE projectId = ? ORDER BY year').all(req.params.id);

  const scenario = {
    debtPercent: debtPercent ?? 0.6,
    equityPercent: equityPercent ?? 0.4,
    interestRate: interestRate ?? 0.105,
    loanTermYears: loanTermYears ?? 10,
    equityCostPercent: equityCostPercent ?? 0.15,
    repaymentType: repaymentType || 'equal_installments',
  };

  const computed = computeAll(scenario, project, cashFlows);
  const id = uuidv4();

  db.prepare(`
    INSERT INTO scenarios (id, projectId, name, debtPercent, equityPercent, interestRate, loanTermYears, equityCostPercent, repaymentType, wacc, npv, irr, paybackYears, profitabilityIndex, monthlyPayment, totalInterest)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, req.params.id, name,
    scenario.debtPercent, scenario.equityPercent, scenario.interestRate,
    scenario.loanTermYears, scenario.equityCostPercent, scenario.repaymentType,
    computed.wacc, computed.npv, computed.irr, computed.paybackYears,
    computed.profitabilityIndex, computed.monthlyPayment, computed.totalInterest
  );

  const result = db.prepare('SELECT * FROM scenarios WHERE id = ?').get(id);
  res.status(201).json(result);
});

// PATCH /api/projects/:id/scenarios/:scenarioId
router.patch('/:id/scenarios/:scenarioId', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const existing = db.prepare('SELECT * FROM scenarios WHERE id = ? AND projectId = ?').get(req.params.scenarioId, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Scenario not found' });

  const fields = ['name', 'debtPercent', 'equityPercent', 'interestRate', 'loanTermYears', 'equityCostPercent', 'repaymentType'];
  const updates = {};
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates[f] = req.body[f];
    }
  }

  // Merge with existing for recompute
  const merged = { ...existing, ...updates };

  const cashFlows = db.prepare('SELECT * FROM cash_flows WHERE projectId = ? ORDER BY year').all(req.params.id);
  const computed = computeAll(merged, project, cashFlows);

  const allUpdates = { ...updates, ...computed };
  const setClauses = Object.keys(allUpdates).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(allUpdates), req.params.scenarioId];

  db.prepare(`UPDATE scenarios SET ${setClauses} WHERE id = ?`).run(...values);

  const result = db.prepare('SELECT * FROM scenarios WHERE id = ?').get(req.params.scenarioId);
  res.json(result);
});

// DELETE /api/projects/:id/scenarios/:scenarioId
router.delete('/:id/scenarios/:scenarioId', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM scenarios WHERE id = ? AND projectId = ?').get(req.params.scenarioId, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Scenario not found' });

  db.prepare('DELETE FROM scenarios WHERE id = ?').run(req.params.scenarioId);
  res.status(204).send();
});

// Helper: recompute all scenarios for a project (after cash flow or project changes)
function recomputeScenarios(db, projectId) {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) return;

  const cashFlows = db.prepare('SELECT * FROM cash_flows WHERE projectId = ? ORDER BY year').all(projectId);
  const scenarios = db.prepare('SELECT * FROM scenarios WHERE projectId = ?').all(projectId);

  for (const s of scenarios) {
    const computed = computeAll(s, project, cashFlows);
    db.prepare(`
      UPDATE scenarios SET wacc = ?, npv = ?, irr = ?, paybackYears = ?, profitabilityIndex = ?, monthlyPayment = ?, totalInterest = ?
      WHERE id = ?
    `).run(computed.wacc, computed.npv, computed.irr, computed.paybackYears, computed.profitabilityIndex, computed.monthlyPayment, computed.totalInterest, s.id);
  }
}

module.exports = router;
