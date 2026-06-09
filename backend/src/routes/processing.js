const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');
const { batchYield, fieldProcessingShare } = require('../services/processing');

const router = Router();

// ── PROCESSING BATCHES (Spec 2e.1) ──────────────────────────────────────────
router.get('/processing-batches', (req, res) => {
  const db = getDb();
  const { enterprise, year } = req.query;
  let sql = 'SELECT * FROM processing_batches';
  const cond = [], params = [];
  if (enterprise) { cond.push('enterprise = ?'); params.push(enterprise); }
  if (year) { cond.push('end_date >= ? AND end_date <= ?'); params.push(`${year}-01-01`, `${year}-12-31`); }
  if (cond.length) sql += ' WHERE ' + cond.join(' AND ');
  sql += ' ORDER BY end_date DESC';
  res.json(db.prepare(sql).all(...params));
});

router.get('/processing-batches/:id', (req, res) => {
  const db = getDb();
  const batch = db.prepare('SELECT * FROM processing_batches WHERE id = ?').get(req.params.id);
  if (!batch) return res.status(404).json({ error: 'Batch not found' });
  const sources = db.prepare('SELECT * FROM processing_batch_sources WHERE batch_id = ?').all(req.params.id);
  const recirculations = db.prepare('SELECT * FROM processing_batch_recirculations WHERE batch_id = ?').all(req.params.id);
  res.json({ ...batch, sources, recirculations, yield: batchYield(db, req.params.id) });
});

const BATCH_FIELDS = ['enterprise', 'start_date', 'end_date', 'wet_in_kg', 'dried_bruto_kg',
  'sifted_netto_kg', 'stokke_kg', 'stof_kg', 'stof_price_zar_per_kg', 'processing_cost_zar', 'status', 'notes'];

router.post('/processing-batches', (req, res) => {
  const db = getDb();
  const b = req.body || {};
  if (b.wet_in_kg != null && typeof b.wet_in_kg !== 'number') {
    return res.status(400).json({ error: 'invalid_wet_in_kg' });
  }
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO processing_batches
    (id,enterprise,start_date,end_date,wet_in_kg,dried_bruto_kg,sifted_netto_kg,stokke_kg,stof_kg,
     stof_price_zar_per_kg,processing_cost_zar,status,notes,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, b.enterprise || 'rooibos', b.start_date || null,
    b.end_date || null, b.wet_in_kg ?? null, b.dried_bruto_kg ?? null, b.sifted_netto_kg ?? null,
    b.stokke_kg ?? null, b.stof_kg ?? null, b.stof_price_zar_per_kg ?? null, b.processing_cost_zar ?? 0,
    b.status || 'done', b.notes || null, now, now);
  res.status(201).json(db.prepare('SELECT * FROM processing_batches WHERE id = ?').get(id));
});

router.patch('/processing-batches/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM processing_batches WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Batch not found' });
  const b = req.body || {};
  const updates = {};
  for (const k of BATCH_FIELDS) if (b[k] !== undefined) updates[k] = b[k];
  if (Object.keys(updates).length) {
    const set = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    db.prepare(`UPDATE processing_batches SET ${set}, updated_at = ? WHERE id = ?`)
      .run(...Object.values(updates), new Date().toISOString(), req.params.id);
  }
  res.json(db.prepare('SELECT * FROM processing_batches WHERE id = ?').get(req.params.id));
});

router.delete('/processing-batches/:id', (req, res) => {
  const db = getDb();
  const r = db.prepare('DELETE FROM processing_batches WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Batch not found' });
  res.status(204).end();
});

// sources -----------------------------------------------------------------------
router.get('/processing-batches/:id/sources', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM processing_batch_sources WHERE batch_id = ?').all(req.params.id));
});

router.post('/processing-batches/:id/sources', (req, res) => {
  const db = getDb();
  const batch = db.prepare('SELECT id FROM processing_batches WHERE id = ?').get(req.params.id);
  if (!batch) return res.status(404).json({ error: 'Batch not found' });
  const b = req.body || {};
  if (!b.field_id) return res.status(400).json({ error: 'field_id_required' });
  if (!db.prepare('SELECT id FROM fields WHERE id = ?').get(b.field_id)) {
    return res.status(400).json({ error: 'field_not_found' });
  }
  const id = uuidv4();
  db.prepare(`INSERT INTO processing_batch_sources (id,batch_id,field_id,period_id,wet_contributed_kg)
              VALUES (?,?,?,?,?)`).run(id, req.params.id, b.field_id, b.period_id || null, b.wet_contributed_kg ?? null);
  res.status(201).json(db.prepare('SELECT * FROM processing_batch_sources WHERE id = ?').get(id));
});

// graded fractions (2e.3) -------------------------------------------------------
const GRADES = ['stokke', 'netto', 'superfine', 'ultrafine'];
router.get('/processing-batches/:id/fractions', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM processing_batch_fractions WHERE batch_id = ?').all(req.params.id));
});

router.post('/processing-batches/:id/fractions', (req, res) => {
  const db = getDb();
  const batch = db.prepare('SELECT id FROM processing_batches WHERE id = ?').get(req.params.id);
  if (!batch) return res.status(404).json({ error: 'Batch not found' });
  const b = req.body || {};
  if (!GRADES.includes(b.grade)) return res.status(400).json({ error: 'invalid_grade', allowed: GRADES });
  const id = uuidv4();
  const ts = new Date().toISOString();
  db.prepare(`INSERT INTO processing_batch_fractions (id,batch_id,grade,kg,sold_kg,price_zar_per_kg,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?,?)`).run(id, req.params.id, b.grade, b.kg ?? null, b.sold_kg ?? 0, b.price_zar_per_kg ?? null, ts, ts);
  res.status(201).json(db.prepare('SELECT * FROM processing_batch_fractions WHERE id = ?').get(id));
});

router.patch('/processing-fractions/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM processing_batch_fractions WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const allowed = ['grade', 'kg', 'sold_kg', 'price_zar_per_kg'];
  const updates = {};
  for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
  if (Object.keys(updates).length) {
    const set = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    db.prepare(`UPDATE processing_batch_fractions SET ${set}, updated_at = ? WHERE id = ?`)
      .run(...Object.values(updates), new Date().toISOString(), req.params.id);
  }
  res.json(db.prepare('SELECT * FROM processing_batch_fractions WHERE id = ?').get(req.params.id));
});

// recirculation (stokke feedback, 2e.2) -----------------------------------------
router.post('/processing-batches/:id/recirculate', (req, res) => {
  const db = getDb();
  const batch = db.prepare('SELECT id FROM processing_batches WHERE id = ?').get(req.params.id);
  if (!batch) return res.status(404).json({ error: 'Batch not found' });
  const b = req.body || {};
  if (typeof b.stokke_reintroduced_kg !== 'number') {
    return res.status(400).json({ error: 'stokke_reintroduced_kg_required' });
  }
  const id = uuidv4();
  db.prepare(`INSERT INTO processing_batch_recirculations (id,batch_id,source_batch_id,stokke_reintroduced_kg,created_at)
              VALUES (?,?,?,?,?)`).run(id, req.params.id, b.source_batch_id || null, b.stokke_reintroduced_kg, new Date().toISOString());
  res.status(201).json(db.prepare('SELECT * FROM processing_batch_recirculations WHERE id = ?').get(id));
});

// field processing share rollup -------------------------------------------------
router.get('/fields/:id/processing-share', (req, res) => {
  const db = getDb();
  const year = Number(req.query.year);
  if (!year) return res.status(400).json({ error: 'year_required' });
  res.json(fieldProcessingShare(db, req.params.id, year));
});

module.exports = router;
