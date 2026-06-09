const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');
const { fieldSharedInputCost } = require('../services/shared_inputs');

const router = Router();
const BASES = ['per_ha_rate', 'total_split_ha'];

router.get('/shared-inputs', (req, res) => {
  const db = getDb();
  const { year, field_id } = req.query;
  let sql = 'SELECT DISTINCT si.* FROM shared_inputs si';
  const cond = [], params = [];
  if (field_id) { sql += ' JOIN shared_input_fields f ON f.shared_input_id = si.id'; cond.push('f.field_id = ?'); params.push(field_id); }
  if (year) { cond.push('si.year = ?'); params.push(Number(year)); }
  if (cond.length) sql += ' WHERE ' + cond.join(' AND ');
  sql += ' ORDER BY si.date DESC';
  const rows = db.prepare(sql).all(...params);
  for (const r of rows) {
    r.fields = db.prepare('SELECT field_id FROM shared_input_fields WHERE shared_input_id = ?').all(r.id).map(x => x.field_id);
  }
  res.json(rows);
});

router.post('/shared-inputs', (req, res) => {
  const db = getDb();
  const b = req.body || {};
  if (typeof b.year !== 'number') return res.status(400).json({ error: 'year_required' });
  if (!BASES.includes(b.basis)) return res.status(400).json({ error: 'invalid_basis', allowed: BASES });
  if (b.basis === 'per_ha_rate' && typeof b.rate_per_ha !== 'number') return res.status(400).json({ error: 'rate_per_ha_required' });
  if (b.basis === 'total_split_ha' && typeof b.total_cost_zar !== 'number') return res.status(400).json({ error: 'total_cost_zar_required' });
  const fields = Array.isArray(b.field_ids) ? b.field_ids : [];
  if (!fields.length) return res.status(400).json({ error: 'field_ids_required' });
  for (const fid of fields) {
    if (!db.prepare('SELECT id FROM fields WHERE id = ?').get(fid)) return res.status(400).json({ error: 'field_not_found', field_id: fid });
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO shared_inputs
      (id,date,year,product,cost_category,basis,rate_per_ha,total_cost_zar,usage,is_establishment,
       entry_basis,external_source,external_id,notes,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id, b.date || null, b.year, b.product || null, b.cost_category || 'direct_variable', b.basis,
      b.rate_per_ha ?? null, b.total_cost_zar ?? null, b.usage || null, b.is_establishment ? 1 : 0,
      b.entry_basis || 'estimate', b.external_source || null, b.external_id || null, b.notes || null, now, now);
    for (const fid of fields) {
      db.prepare('INSERT INTO shared_input_fields (id,shared_input_id,field_id) VALUES (?,?,?)').run(uuidv4(), id, fid);
    }
  });
  tx();
  const row = db.prepare('SELECT * FROM shared_inputs WHERE id = ?').get(id);
  row.fields = fields;
  res.status(201).json(row);
});

router.delete('/shared-inputs/:id', (req, res) => {
  const db = getDb();
  const r = db.prepare('DELETE FROM shared_inputs WHERE id = ?').run(req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

router.get('/fields/:id/shared-input-cost', (req, res) => {
  const db = getDb();
  const year = Number(req.query.year);
  if (!year) return res.status(400).json({ error: 'year_required' });
  res.json(fieldSharedInputCost(db, req.params.id, year));
});

module.exports = router;
