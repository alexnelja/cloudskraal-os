const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');

const router = Router();

// ── DASHBOARD ─────────────────────────────────────────────────────────────────

router.get('/production/dashboard', (req, res) => {
  const db = getDb();

  const batchesByStatusRows = db.prepare(
    'SELECT status, COUNT(*) as count FROM production_batches GROUP BY status'
  ).all();
  const batchesByStatus = {};
  for (const row of batchesByStatusRows) {
    batchesByStatus[row.status] = row.count;
  }

  const totalKgInPipeline = db.prepare(`
    SELECT COALESCE(SUM(current_quantity_kg), 0) as total
    FROM production_batches
    WHERE status NOT IN ('sold', 'shipped')
  `).get().total;

  const totalRevenue = db.prepare(
    'SELECT COALESCE(SUM(total_amount), 0) as total FROM sales'
  ).get().total;

  const recentBatches = db.prepare(`
    SELECT pb.*,
      (SELECT COUNT(*) FROM processing_steps ps WHERE ps.batch_id = pb.id) AS step_count
    FROM production_batches pb
    ORDER BY pb.created_at DESC
    LIMIT 5
  `).all();

  res.json({ batchesByStatus, totalKgInPipeline, totalRevenue, recentBatches });
});

// ── BATCHES ───────────────────────────────────────────────────────────────────

router.get('/production/batches', (req, res) => {
  const db = getDb();
  const batches = db.prepare(`
    SELECT pb.*,
      (SELECT COUNT(*) FROM processing_steps ps WHERE ps.batch_id = pb.id) AS step_count,
      (SELECT ps2.step_type FROM processing_steps ps2 WHERE ps2.batch_id = pb.id ORDER BY ps2.step_number DESC LIMIT 1) AS latest_step
    FROM production_batches pb
    ORDER BY pb.created_at DESC
  `).all();

  res.json(batches);
});

router.get('/production/batches/:id', (req, res) => {
  const db = getDb();
  const batch = db.prepare('SELECT * FROM production_batches WHERE id = ?').get(req.params.id);
  if (!batch) return res.status(404).json({ error: 'Batch not found' });

  const steps = db.prepare(
    'SELECT * FROM processing_steps WHERE batch_id = ? ORDER BY step_number'
  ).all(req.params.id);

  const quality_tests = db.prepare(
    'SELECT * FROM quality_tests WHERE batch_id = ? ORDER BY test_date DESC'
  ).all(req.params.id);

  const sales = db.prepare(
    'SELECT * FROM sales WHERE batch_id = ? ORDER BY created_at DESC'
  ).all(req.params.id);

  res.json({ ...batch, steps, quality_tests, sales });
});

router.post('/production/batches', (req, res) => {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const b = req.body;

  db.prepare(`
    INSERT INTO production_batches (id, batch_code, enterprise, product_type, source_field_ids,
      harvest_date_start, harvest_date_end, initial_quantity_kg, current_quantity_kg, status,
      quality_grade, storage_location, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, b.batch_code, b.enterprise, b.product_type || null,
    b.source_field_ids ? JSON.stringify(b.source_field_ids) : null,
    b.harvest_date_start || null, b.harvest_date_end || null,
    b.initial_quantity_kg || null, b.current_quantity_kg || b.initial_quantity_kg || null,
    b.status || 'received', b.quality_grade || null, b.storage_location || null,
    b.notes || null, now, now);

  const batch = db.prepare('SELECT * FROM production_batches WHERE id = ?').get(id);
  res.status(201).json(batch);
});

router.patch('/production/batches/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM production_batches WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Batch not found' });

  const allowed = ['batch_code', 'enterprise', 'product_type', 'source_field_ids',
    'harvest_date_start', 'harvest_date_end', 'initial_quantity_kg', 'current_quantity_kg',
    'status', 'quality_grade', 'storage_location', 'notes'];

  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates[key] = key === 'source_field_ids' && Array.isArray(req.body[key])
        ? JSON.stringify(req.body[key])
        : req.body[key];
    }
  }

  if (Object.keys(updates).length > 0) {
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), new Date().toISOString(), req.params.id];
    db.prepare(`UPDATE production_batches SET ${setClauses}, updated_at = ? WHERE id = ?`).run(...values);
  }

  const batch = db.prepare('SELECT * FROM production_batches WHERE id = ?').get(req.params.id);
  res.json(batch);
});

// ── PROCESSING STEPS ──────────────────────────────────────────────────────────

router.post('/production/batches/:id/steps', (req, res) => {
  const db = getDb();
  const batch = db.prepare('SELECT id FROM production_batches WHERE id = ?').get(req.params.id);
  if (!batch) return res.status(404).json({ error: 'Batch not found' });

  const id = uuidv4();
  const now = new Date().toISOString();
  const b = req.body;

  db.prepare(`
    INSERT INTO processing_steps (id, batch_id, step_number, step_type, start_datetime,
      end_datetime, facility, equipment_id, operator, input_quantity_kg, output_quantity_kg,
      loss_kg, loss_reason, parameters, quality_check_passed, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.params.id, b.step_number, b.step_type, b.start_datetime || null,
    b.end_datetime || null, b.facility || null, b.equipment_id || null,
    b.operator || null, b.input_quantity_kg || null, b.output_quantity_kg || null,
    b.loss_kg || null, b.loss_reason || null,
    b.parameters ? JSON.stringify(b.parameters) : null,
    b.quality_check_passed != null ? b.quality_check_passed : null,
    b.notes || null, now);

  const step = db.prepare('SELECT * FROM processing_steps WHERE id = ?').get(id);
  res.status(201).json(step);
});

// ── QUALITY TESTS ─────────────────────────────────────────────────────────────

router.post('/production/batches/:id/quality', (req, res) => {
  const db = getDb();
  const batch = db.prepare('SELECT id FROM production_batches WHERE id = ?').get(req.params.id);
  if (!batch) return res.status(404).json({ error: 'Batch not found' });

  const id = uuidv4();
  const now = new Date().toISOString();
  const b = req.body;

  db.prepare(`
    INSERT INTO quality_tests (id, batch_id, test_type, test_date, tested_by, results,
      pass_fail, certificate_number, lab_reference, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.params.id, b.test_type || null, b.test_date,
    b.tested_by || null, b.results ? JSON.stringify(b.results) : null,
    b.pass_fail || null, b.certificate_number || null, b.lab_reference || null,
    b.notes || null, now);

  const test = db.prepare('SELECT * FROM quality_tests WHERE id = ?').get(id);
  res.status(201).json(test);
});

// ── SALES ─────────────────────────────────────────────────────────────────────

router.get('/sales', (req, res) => {
  const db = getDb();
  const sales = db.prepare(`
    SELECT s.*, pb.batch_code
    FROM sales s
    LEFT JOIN production_batches pb ON pb.id = s.batch_id
    ORDER BY s.created_at DESC
  `).all();

  res.json(sales);
});

router.post('/sales', (req, res) => {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const b = req.body;

  db.prepare(`
    INSERT INTO sales (id, batch_id, customer, quantity_kg, unit_price, total_amount,
      currency, export_destination, invoice_number, shipped_date, paid_date, status,
      notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, b.batch_id || null, b.customer, b.quantity_kg || null,
    b.unit_price || null, b.total_amount || null, b.currency || 'ZAR',
    b.export_destination || null, b.invoice_number || null,
    b.shipped_date || null, b.paid_date || null, b.status || 'pending',
    b.notes || null, now, now);

  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
  res.status(201).json(sale);
});

router.patch('/sales/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Sale not found' });

  const allowed = ['batch_id', 'customer', 'quantity_kg', 'unit_price', 'total_amount',
    'currency', 'export_destination', 'invoice_number', 'shipped_date', 'paid_date', 'status', 'notes'];

  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length > 0) {
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), new Date().toISOString(), req.params.id];
    db.prepare(`UPDATE sales SET ${setClauses}, updated_at = ? WHERE id = ?`).run(...values);
  }

  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
  res.json(sale);
});

module.exports = router;
