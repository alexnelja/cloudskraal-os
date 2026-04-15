const express = require('express');
const { getDb } = require('../db/schema');
const {
  createAnnotation,
  listAnnotations,
  getAnnotation,
  updateAnnotation,
  deleteAnnotation,
} = require('../services/annotations');

const router = express.Router();

router.get('/annotations', (req, res) => {
  const db = getDb();
  const { type, field_id } = req.query;
  if (type && !['line', 'polygon', 'pin'].includes(type)) {
    return res.status(400).json({ error: 'invalid_type' });
  }
  res.json(listAnnotations(db, { type, field_id }));
});

router.get('/annotations/:id', (req, res) => {
  const db = getDb();
  const row = getAnnotation(db, req.params.id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json(row);
});

router.post('/annotations', (req, res) => {
  const db = getDb();
  const { type, title, notes, geometry } = req.body || {};
  if (!type || !['line', 'polygon', 'pin'].includes(type)) {
    return res.status(400).json({ error: 'invalid_type' });
  }
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title_required' });
  }
  if (!geometry || typeof geometry !== 'object') {
    return res.status(400).json({ error: 'geometry_required' });
  }
  try {
    const row = createAnnotation(db, { type, title: title.trim(), notes, geometry });
    res.status(201).json(row);
  } catch (e) {
    if (e.code === 'type_mismatch') return res.status(400).json({ error: 'type_mismatch' });
    throw e;
  }
});

router.patch('/annotations/:id', (req, res) => {
  const db = getDb();
  const { title, notes, geometry, type, length_m, area_m2 } = req.body || {};
  if (geometry !== undefined || type !== undefined || length_m !== undefined || area_m2 !== undefined) {
    return res.status(400).json({ error: 'immutable_field', message: 'geometry, type, and metrics are immutable; delete + recreate' });
  }
  if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
    return res.status(400).json({ error: 'title_required' });
  }
  const patch = {};
  if (title !== undefined) patch.title = title.trim();
  if (notes !== undefined) patch.notes = notes;
  const row = updateAnnotation(db, req.params.id, patch);
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json(row);
});

router.delete('/annotations/:id', (req, res) => {
  const db = getDb();
  const ok = deleteAnnotation(db, req.params.id);
  if (!ok) return res.status(404).json({ error: 'not_found' });
  res.status(204).end();
});

module.exports = router;
