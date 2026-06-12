// Spec 6a — technical calculators: one POST per calc type. Cost-linked calcs
// (pest, fertilizer, lime) get the db for input_products price lookups.
const { Router } = require('express');
const { getDb } = require('../db/schema');
const { computeSprayer } = require('../services/calculators/sprayer');
const { computePestDose } = require('../services/calculators/pest');
const { computeFertilizer } = require('../services/calculators/fertilizer');
const { computeLime } = require('../services/calculators/lime');
const { computeElectrical } = require('../services/calculators/electrical');
const { computeFluid } = require('../services/calculators/fluid');

const router = Router();

const CALCULATORS = {
  sprayer: { compute: computeSprayer, usesDb: false, label: 'Sprayer calibration' },
  pest: { compute: computePestDose, usesDb: true, label: 'Pest dose' },
  fertilizer: { compute: computeFertilizer, usesDb: true, label: 'Fertilizer rate' },
  lime: { compute: computeLime, usesDb: true, label: 'Lime requirement' },
  electrical: { compute: computeElectrical, usesDb: false, label: 'Electrical load (pump sizing)' },
  fluid: { compute: computeFluid, usesDb: false, label: 'Fluid flow (pipe head loss)' },
};

router.get('/calculators', (_req, res) => {
  res.json(Object.entries(CALCULATORS).map(([type, c]) => ({ type, label: c.label })));
});

router.post('/calculators/:type', (req, res) => {
  const calc = CALCULATORS[req.params.type];
  if (!calc) return res.status(404).json({ error: 'calculator_unknown', allowed: Object.keys(CALCULATORS) });
  const r = calc.usesDb ? calc.compute(req.body || {}, getDb()) : calc.compute(req.body || {});
  if (r.error) return res.status(400).json(r);
  res.json(r);
});

module.exports = router;
