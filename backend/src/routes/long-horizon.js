const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');
const { allocatedOverhead } = require('../services/overhead');

const router = Router();
const now = () => new Date().toISOString();

// ── FIELD ESTABLISHMENT (capital, Spec 2c) ──────────────────────────────────
router.get('/field-establishment', (req, res) => {
  const db = getDb();
  const { field_id } = req.query;
  const sql = field_id
    ? 'SELECT * FROM field_establishment WHERE field_id = ? ORDER BY planted_date DESC'
    : 'SELECT * FROM field_establishment ORDER BY planted_date DESC';
  res.json(field_id ? db.prepare(sql).all(field_id) : db.prepare(sql).all());
});

router.post('/field-establishment', (req, res) => {
  const db = getDb();
  const b = req.body || {};
  if (!b.field_id) return res.status(400).json({ error: 'field_id_required' });
  if (!db.prepare('SELECT id FROM fields WHERE id = ?').get(b.field_id)) {
    return res.status(400).json({ error: 'field_not_found' });
  }
  const id = uuidv4();
  db.prepare(`INSERT INTO field_establishment
    (id,field_id,usage,planted_date,total_cost_zar,expected_productive_years,notes,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(id, b.field_id, b.usage || null, b.planted_date || null,
    b.total_cost_zar ?? null, b.expected_productive_years ?? null, b.notes || null, now(), now());
  res.status(201).json(db.prepare('SELECT * FROM field_establishment WHERE id = ?').get(id));
});

router.patch('/field-establishment/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM field_establishment WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const allowed = ['usage', 'planted_date', 'total_cost_zar', 'expected_productive_years', 'notes'];
  const updates = {};
  for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
  if (Object.keys(updates).length) {
    const set = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    db.prepare(`UPDATE field_establishment SET ${set}, updated_at = ? WHERE id = ?`)
      .run(...Object.values(updates), now(), req.params.id);
  }
  res.json(db.prepare('SELECT * FROM field_establishment WHERE id = ?').get(req.params.id));
});

router.delete('/field-establishment/:id', (req, res) => {
  const db = getDb();
  const r = db.prepare('DELETE FROM field_establishment WHERE id = ?').run(req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

// ── OVERHEAD ENTRIES (Spec 2d) ──────────────────────────────────────────────
router.get('/overhead-entries', (req, res) => {
  const db = getDb();
  const { year } = req.query;
  const sql = year
    ? 'SELECT * FROM overhead_entries WHERE year = ? ORDER BY category'
    : 'SELECT * FROM overhead_entries ORDER BY year DESC, category';
  res.json(year ? db.prepare(sql).all(Number(year)) : db.prepare(sql).all());
});

router.post('/overhead-entries', (req, res) => {
  const db = getDb();
  const b = req.body || {};
  if (typeof b.year !== 'number') return res.status(400).json({ error: 'year_required' });
  if (!b.category) return res.status(400).json({ error: 'category_required' });
  if (typeof b.amount_zar !== 'number') return res.status(400).json({ error: 'amount_required' });
  const id = uuidv4();
  db.prepare(`INSERT INTO overhead_entries (id,year,category,amount_zar,notes,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?)`).run(id, b.year, b.category, b.amount_zar, b.notes || null, now(), now());
  res.status(201).json(db.prepare('SELECT * FROM overhead_entries WHERE id = ?').get(id));
});

router.delete('/overhead-entries/:id', (req, res) => {
  const db = getDb();
  const r = db.prepare('DELETE FROM overhead_entries WHERE id = ?').run(req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

// ── OVERHEAD ALLOCATION RULES (Spec 2d) ─────────────────────────────────────
const METHODS = ['per_ha', 'per_enterprise', 'revenue_share'];
router.get('/overhead-allocation-rules', (req, res) => {
  res.json(getDb().prepare('SELECT * FROM overhead_allocation_rules ORDER BY category').all());
});

router.post('/overhead-allocation-rules', (req, res) => {
  const db = getDb();
  const b = req.body || {};
  if (!b.category) return res.status(400).json({ error: 'category_required' });
  if (!METHODS.includes(b.method)) return res.status(400).json({ error: 'invalid_method', allowed: METHODS });
  const key_params = b.key_params == null ? null
    : (typeof b.key_params === 'string' ? b.key_params : JSON.stringify(b.key_params));
  const id = uuidv4();
  db.prepare(`INSERT INTO overhead_allocation_rules (id,category,method,key_params,created_at,updated_at)
              VALUES (?,?,?,?,?,?)`).run(id, b.category, b.method, key_params, now(), now());
  res.status(201).json(db.prepare('SELECT * FROM overhead_allocation_rules WHERE id = ?').get(id));
});

router.delete('/overhead-allocation-rules/:id', (req, res) => {
  const db = getDb();
  const r = db.prepare('DELETE FROM overhead_allocation_rules WHERE id = ?').run(req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

// field overhead rollup
router.get('/fields/:id/overhead', (req, res) => {
  const db = getDb();
  const year = Number(req.query.year);
  if (!year) return res.status(400).json({ error: 'year_required' });
  res.json(allocatedOverhead(db, req.params.id, year));
});

module.exports = router;
