const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');
const { equipmentRate } = require('../services/equipment_rates');

const router = Router();

// GET /api/equipment/:id/rate — operating cost/hour (Spec 2i.2)
router.get('/equipment/:id/rate', (req, res) => {
  res.json(equipmentRate(getDb(), req.params.id));
});

// GET /api/equipment/alerts — equipment needing service soon
router.get('/equipment/alerts', (req, res) => {
  const db = getDb();
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  const equipment = db.prepare(`
    SELECT e.*, f.name AS farm_name
    FROM equipment e
    LEFT JOIN farms f ON f.id = e.farm_id
    WHERE (e.next_service_date IS NOT NULL AND e.next_service_date <= ?)
       OR e.status = 'maintenance'
    ORDER BY e.next_service_date
  `).all(thirtyDaysFromNow);

  res.json(equipment);
});

// GET /api/equipment/summary — aggregate stats
router.get('/equipment/summary', (req, res) => {
  const db = getDb();

  const total = db.prepare('SELECT COUNT(*) as count FROM equipment').get().count;
  const totalValue = db.prepare('SELECT COALESCE(SUM(current_value), 0) as value FROM equipment').get().value;

  const today = new Date().toISOString().split('T')[0];
  const overdueService = db.prepare(`
    SELECT COUNT(*) as count FROM equipment
    WHERE next_service_date IS NOT NULL AND next_service_date <= ?
  `).get(today).count;

  const byTypeRows = db.prepare(`
    SELECT type, COUNT(*) as count FROM equipment GROUP BY type
  `).all();
  const byType = {};
  for (const row of byTypeRows) {
    byType[row.type] = row.count;
  }

  res.json({ total, totalValue, overdueService, byType });
});

// GET /api/equipment — list all with latest maintenance date
router.get('/equipment', (req, res) => {
  const db = getDb();
  const equipment = db.prepare(`
    SELECT e.*,
      f.name AS farm_name,
      (SELECT MAX(ml.date) FROM maintenance_logs ml WHERE ml.equipment_id = e.id) AS last_maintenance_date
    FROM equipment e
    LEFT JOIN farms f ON f.id = e.farm_id
    ORDER BY e.name
  `).all();

  res.json(equipment);
});

// GET /api/equipment/:id — single item with maintenance logs
router.get('/equipment/:id', (req, res) => {
  const db = getDb();
  const equipment = db.prepare(`
    SELECT e.*, f.name AS farm_name
    FROM equipment e
    LEFT JOIN farms f ON f.id = e.farm_id
    WHERE e.id = ?
  `).get(req.params.id);

  if (!equipment) return res.status(404).json({ error: 'Equipment not found' });

  const maintenance_logs = db.prepare(
    'SELECT * FROM maintenance_logs WHERE equipment_id = ? ORDER BY date DESC'
  ).all(req.params.id);

  res.json({ ...equipment, maintenance_logs });
});

// POST /api/equipment — create
router.post('/equipment', (req, res) => {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const b = req.body;

  db.prepare(`
    INSERT INTO equipment (id, name, code, type, make, model, year, farm_id, department,
      purchase_date, purchase_price, current_value, depreciation_method, useful_life_years,
      salvage_value, status, hours_meter, odometer_km, next_service_date, next_service_hours,
      fuel_l_per_hour, annual_use_hours, maintenance_zar_per_year, kind,
      notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, b.name, b.code || null, b.type, b.make || null, b.model || null, b.year || null,
    b.farm_id || null, b.department || null, b.purchase_date || null,
    b.purchase_price || null, b.current_value || null, b.depreciation_method || 'straight_line',
    b.useful_life_years || null, b.salvage_value || null, b.status || 'active',
    b.hours_meter || null, b.odometer_km || null, b.next_service_date || null,
    b.next_service_hours || null, b.fuel_l_per_hour ?? null, b.annual_use_hours ?? null,
    b.maintenance_zar_per_year ?? null, b.kind || 'machine', b.notes || null, now, now);

  const equipment = db.prepare('SELECT * FROM equipment WHERE id = ?').get(id);
  res.status(201).json(equipment);
});

// PATCH /api/equipment/:id — update
router.patch('/equipment/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM equipment WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Equipment not found' });

  const allowed = ['name', 'code', 'type', 'make', 'model', 'year', 'farm_id', 'department',
    'purchase_date', 'purchase_price', 'current_value', 'depreciation_method', 'useful_life_years',
    'salvage_value', 'status', 'hours_meter', 'odometer_km', 'next_service_date', 'next_service_hours',
    'fuel_l_per_hour', 'annual_use_hours', 'maintenance_zar_per_year', 'kind', 'notes'];

  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length > 0) {
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), new Date().toISOString(), req.params.id];
    db.prepare(`UPDATE equipment SET ${setClauses}, updated_at = ? WHERE id = ?`).run(...values);
  }

  const equipment = db.prepare('SELECT * FROM equipment WHERE id = ?').get(req.params.id);
  res.json(equipment);
});

// DELETE /api/equipment/:id — delete
router.delete('/equipment/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM equipment WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Equipment not found' });

  db.prepare('DELETE FROM equipment WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

// GET /api/equipment/:id/maintenance — maintenance logs
router.get('/equipment/:id/maintenance', (req, res) => {
  const db = getDb();
  const equipment = db.prepare('SELECT id FROM equipment WHERE id = ?').get(req.params.id);
  if (!equipment) return res.status(404).json({ error: 'Equipment not found' });

  const logs = db.prepare(
    'SELECT * FROM maintenance_logs WHERE equipment_id = ? ORDER BY date DESC'
  ).all(req.params.id);

  res.json(logs);
});

// POST /api/equipment/:id/maintenance — add maintenance log
router.post('/equipment/:id/maintenance', (req, res) => {
  const db = getDb();
  const equipment = db.prepare('SELECT id FROM equipment WHERE id = ?').get(req.params.id);
  if (!equipment) return res.status(404).json({ error: 'Equipment not found' });

  const id = uuidv4();
  const now = new Date().toISOString();
  const b = req.body;

  db.prepare(`
    INSERT INTO maintenance_logs (id, equipment_id, type, date, description, cost,
      performed_by, hours_at_service, parts_used, next_due_date, next_due_hours, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.params.id, b.type, b.date, b.description || null, b.cost || null,
    b.performed_by || null, b.hours_at_service || null,
    b.parts_used ? JSON.stringify(b.parts_used) : null,
    b.next_due_date || null, b.next_due_hours || null, b.notes || null, now);

  // Update equipment next_service_date if provided
  if (b.next_due_date) {
    db.prepare('UPDATE equipment SET next_service_date = ?, updated_at = ? WHERE id = ?')
      .run(b.next_due_date, now, req.params.id);
  }
  if (b.next_due_hours) {
    db.prepare('UPDATE equipment SET next_service_hours = ?, updated_at = ? WHERE id = ?')
      .run(b.next_due_hours, now, req.params.id);
  }

  const log = db.prepare('SELECT * FROM maintenance_logs WHERE id = ?').get(id);
  res.status(201).json(log);
});

module.exports = router;
