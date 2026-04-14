const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');
const { todayUTC } = require('../utils/dates');

const router = express.Router();

function isValidIsoDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
    && !isNaN(new Date(s).getTime());
}

router.get('/conversion-factors', (req, res) => {
  const db = getDb();
  const context = req.query.context;
  const asOf = req.query.as_of || todayUTC();
  if (!context) return res.status(400).json({ error: 'context_required' });
  const rows = db.prepare(`
    SELECT id, from_uom, to_uom, context, factor, effective_from, notes, created_at, updated_at
      FROM conversion_factors
     WHERE context = ? AND effective_from <= ?
     ORDER BY from_uom, to_uom, effective_from DESC
  `).all(context, asOf);
  res.json(rows);
});

router.post('/conversion-factors', (req, res) => {
  const db = getDb();
  const b = req.body || {};
  for (const f of ['from_uom', 'to_uom', 'context', 'factor', 'effective_from']) {
    if (b[f] === undefined || b[f] === null || b[f] === '') {
      return res.status(400).json({ error: 'missing_field', field: f });
    }
  }
  if (typeof b.factor !== 'number' || b.factor <= 0) {
    return res.status(400).json({ error: 'invalid_factor' });
  }
  if (!isValidIsoDate(b.effective_from)) {
    return res.status(400).json({ error: 'invalid_date' });
  }
  const dup = db.prepare(`
    SELECT id FROM conversion_factors
     WHERE from_uom=? AND to_uom=? AND context=? AND effective_from=?
  `).get(b.from_uom, b.to_uom, b.context, b.effective_from);
  if (dup) {
    return res.status(409).json({
      error: 'duplicate_factor',
      hint: 'use a later effective_from for updates',
    });
  }
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO conversion_factors
    (id, from_uom, to_uom, context, factor, effective_from, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, b.from_uom, b.to_uom, b.context, b.factor,
      b.effective_from, b.notes ?? null, now, now
    );
  const row = db.prepare(`SELECT * FROM conversion_factors WHERE id=?`).get(id);
  res.status(201).json(row);
});

module.exports = router;
