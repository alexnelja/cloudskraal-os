const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');
const {
  USAGE_TYPES, isValidUsage, isPerennial,
  assertNoOverlap, rotationYearEffective, refreshFieldCurrent,
} = require('../services/usage');
const { todayUTC } = require('../utils/dates');

const router = express.Router();

function badUsage(res) {
  return res.status(400).json({ error: 'invalid_usage', valid: USAGE_TYPES });
}

function loadExisting(db, fieldId) {
  return db.prepare(`
    SELECT id, field_id, start_date, end_date, deleted_at
      FROM field_usage_period
     WHERE field_id = ? AND deleted_at IS NULL
  `).all(fieldId);
}

router.get('/fields/:id/usage-periods', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, usage, start_date, end_date, planted_date, rotation_year,
           source, notes, created_at, updated_at
      FROM field_usage_period
     WHERE field_id = ? AND deleted_at IS NULL
     ORDER BY start_date DESC
  `).all(req.params.id);
  res.json(rows);
});

router.post('/fields/:id/usage-periods', (req, res) => {
  const db = getDb();
  const b = req.body || {};
  if (!isValidUsage(b.usage)) return badUsage(res);
  if (!b.start_date) return res.status(400).json({ error: 'start_date_required' });
  if (b.end_date && b.end_date < b.start_date) {
    return res.status(400).json({ error: 'invalid_interval' });
  }

  const candidate = {
    field_id: req.params.id,
    start_date: b.start_date,
    end_date: b.end_date ?? null,
  };

  const tx = db.transaction(() => {
    const existing = loadExisting(db, req.params.id);
    assertNoOverlap(existing, candidate);
    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO field_usage_period
        (id, field_id, usage, start_date, end_date, planted_date, rotation_year,
         source, notes, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      id, req.params.id, b.usage, b.start_date, b.end_date ?? null,
      b.planted_date ?? null, b.rotation_year ?? null,
      b.source ?? 'manual', b.notes ?? null, now, now,
    );
    return id;
  });

  let id;
  try { id = tx(); } catch (e) {
    if (e.code === 'overlap') {
      return res.status(409).json({ error: 'overlap', conflict: e.conflict });
    }
    throw e;
  }

  refreshFieldCurrent(db, req.params.id, todayUTC());
  const row = db.prepare(`SELECT * FROM field_usage_period WHERE id=?`).get(id);
  if (b.rotation_year != null && isPerennial(b.usage)) {
    row.warning = 'rotation_year_on_perennial';
  }
  res.status(201).json(row);
});

router.put('/fields/:id/usage-periods/:periodId', (req, res) => {
  const db = getDb();
  const b = req.body || {};
  const row = db.prepare(`
    SELECT * FROM field_usage_period WHERE id=? AND field_id=? AND deleted_at IS NULL
  `).get(req.params.periodId, req.params.id);
  if (!row) return res.status(404).json({ error: 'not_found' });

  if (b.usage && !isValidUsage(b.usage)) return badUsage(res);

  const next = {
    ...row,
    ...Object.fromEntries(
      ['usage', 'start_date', 'end_date', 'planted_date', 'rotation_year', 'notes']
        .filter(k => k in b)
        .map(k => [k, b[k]])
    ),
    id: row.id, field_id: row.field_id,
  };
  if (next.end_date && next.end_date < next.start_date) {
    return res.status(400).json({ error: 'invalid_interval' });
  }

  const tx = db.transaction(() => {
    const existing = loadExisting(db, req.params.id);
    assertNoOverlap(existing, next);
    db.prepare(`
      UPDATE field_usage_period
         SET usage=?, start_date=?, end_date=?, planted_date=?, rotation_year=?,
             notes=?, updated_at=?
       WHERE id=?
    `).run(
      next.usage, next.start_date, next.end_date, next.planted_date,
      next.rotation_year, next.notes, new Date().toISOString(), next.id,
    );
  });

  try { tx(); } catch (e) {
    if (e.code === 'overlap') {
      return res.status(409).json({ error: 'overlap', conflict: e.conflict });
    }
    throw e;
  }

  refreshFieldCurrent(db, req.params.id, todayUTC());
  const updated = db.prepare(`SELECT * FROM field_usage_period WHERE id=?`).get(next.id);
  res.json(updated);
});

router.delete('/fields/:id/usage-periods/:periodId', (req, res) => {
  const db = getDb();
  const row = db.prepare(`
    SELECT id FROM field_usage_period WHERE id=? AND field_id=? AND deleted_at IS NULL
  `).get(req.params.periodId, req.params.id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  const now = new Date().toISOString();
  db.prepare(`UPDATE field_usage_period SET deleted_at=?, updated_at=? WHERE id=?`)
    .run(now, now, row.id);
  refreshFieldCurrent(db, req.params.id, todayUTC());
  res.status(204).end();
});

router.get('/usage-history', (req, res) => {
  const db = getDb();
  const asOf = req.query.as_of || todayUTC();
  const rows = db.prepare(`
    SELECT p.id AS period_id, p.field_id, p.usage, p.rotation_year, p.planted_date,
           f.geometry
      FROM field_usage_period p
      JOIN fields f ON f.id = p.field_id
     WHERE p.deleted_at IS NULL
       AND p.start_date <= ?
       AND (p.end_date IS NULL OR p.end_date >= ?)
  `).all(asOf, asOf);

  const result = rows.map(r => ({
    field_id: r.field_id,
    period_id: r.period_id,
    usage: r.usage,
    rotation_year_effective: rotationYearEffective(
      { usage: r.usage, rotation_year: r.rotation_year, planted_date: r.planted_date },
      asOf,
    ),
    planted_date: r.planted_date,
    geometry: r.geometry,
  }));
  res.json(result);
});

module.exports = router;
