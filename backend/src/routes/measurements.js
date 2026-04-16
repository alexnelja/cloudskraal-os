const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');

const router = express.Router();

const REQUIRED = ['name', 'kind', 'value', 'unit', 'formatted', 'geometry'];
const VALID_KINDS = ['length', 'area'];

router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM measurements ORDER BY created_at DESC').all();
  res.json(rows);
});

router.post('/', (req, res) => {
  for (const key of REQUIRED) {
    if (req.body[key] === undefined || req.body[key] === null) {
      return res.status(400).json({ error: `Missing required field: ${key}` });
    }
  }
  if (!VALID_KINDS.includes(req.body.kind)) {
    return res.status(400).json({ error: `kind must be one of: ${VALID_KINDS.join(', ')}` });
  }
  const row = {
    id: uuidv4(),
    name: req.body.name,
    kind: req.body.kind,
    value: Number(req.body.value),
    unit: req.body.unit,
    formatted: req.body.formatted,
    geometry: typeof req.body.geometry === 'string'
      ? req.body.geometry
      : JSON.stringify(req.body.geometry),
    field_id: req.body.field_id ?? null,
    notes: req.body.notes ?? null,
    created_at: new Date().toISOString(),
  };
  getDb()
    .prepare(
      'INSERT INTO measurements (id, name, kind, value, unit, formatted, geometry, field_id, notes, created_at) VALUES (@id, @name, @kind, @value, @unit, @formatted, @geometry, @field_id, @notes, @created_at)',
    )
    .run(row);
  res.status(201).json(row);
});

router.delete('/:id', (req, res) => {
  const out = getDb().prepare('DELETE FROM measurements WHERE id = ?').run(req.params.id);
  if (out.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

module.exports = router;
