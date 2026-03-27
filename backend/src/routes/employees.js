const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');

const router = Router();

// GET /api/employees/summary — aggregate stats (must be before :id)
router.get('/employees/summary', (req, res) => {
  const db = getDb();

  const total = db.prepare('SELECT COUNT(*) as count FROM employees').get().count;

  const byDeptRows = db.prepare(`
    SELECT department, COUNT(*) as count FROM employees
    WHERE status = 'active' GROUP BY department
  `).all();
  const byDepartment = {};
  for (const row of byDeptRows) {
    byDepartment[row.department || 'Unassigned'] = row.count;
  }

  const byTypeRows = db.prepare(`
    SELECT type, COUNT(*) as count FROM employees
    WHERE status = 'active' GROUP BY type
  `).all();
  const byType = {};
  for (const row of byTypeRows) {
    byType[row.type] = row.count;
  }

  const totalMonthlyCost = db.prepare(`
    SELECT COALESCE(SUM(monthly_salary), 0) as total FROM employees
    WHERE status = 'active'
  `).get().total;

  res.json({ total, byDepartment, byType, totalMonthlyCost });
});

// GET /api/employees — list all (?department, ?status, ?type)
router.get('/employees', (req, res) => {
  const db = getDb();
  let sql = `
    SELECT e.*, f.name AS farm_name
    FROM employees e
    LEFT JOIN farms f ON f.id = e.farm_id
    WHERE 1=1
  `;
  const params = [];

  if (req.query.department) {
    sql += ' AND e.department = ?';
    params.push(req.query.department);
  }
  if (req.query.status) {
    sql += ' AND e.status = ?';
    params.push(req.query.status);
  }
  if (req.query.type) {
    sql += ' AND e.type = ?';
    params.push(req.query.type);
  }

  sql += ' ORDER BY e.name';
  res.json(db.prepare(sql).all(...params));
});

// GET /api/employees/:id — single employee with recent time entries
router.get('/employees/:id', (req, res) => {
  const db = getDb();
  const employee = db.prepare(`
    SELECT e.*, f.name AS farm_name
    FROM employees e
    LEFT JOIN farms f ON f.id = e.farm_id
    WHERE e.id = ?
  `).get(req.params.id);

  if (!employee) return res.status(404).json({ error: 'Employee not found' });

  const time_entries = db.prepare(`
    SELECT * FROM time_entries WHERE employee_id = ?
    ORDER BY date DESC LIMIT 20
  `).all(req.params.id);

  res.json({ ...employee, time_entries });
});

// POST /api/employees — create
router.post('/employees', (req, res) => {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const b = req.body;

  db.prepare(`
    INSERT INTO employees (id, name, id_number, type, department, role, farm_id,
      hourly_rate, monthly_salary, start_date, end_date, status, phone,
      emergency_contact, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, b.name, b.id_number || null, b.type, b.department || null,
    b.role || null, b.farm_id || null, b.hourly_rate || null,
    b.monthly_salary || null, b.start_date || null, b.end_date || null,
    b.status || 'active', b.phone || null, b.emergency_contact || null,
    b.notes || null, now, now);

  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  res.status(201).json(employee);
});

// PATCH /api/employees/:id — update
router.patch('/employees/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Employee not found' });

  const allowed = ['name', 'id_number', 'type', 'department', 'role', 'farm_id',
    'hourly_rate', 'monthly_salary', 'start_date', 'end_date', 'status',
    'phone', 'emergency_contact', 'notes'];

  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length > 0) {
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), new Date().toISOString(), req.params.id];
    db.prepare(`UPDATE employees SET ${setClauses}, updated_at = ? WHERE id = ?`).run(...values);
  }

  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  res.json(employee);
});

// DELETE /api/employees/:id
router.delete('/employees/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Employee not found' });

  db.prepare('DELETE FROM employees WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

// POST /api/employees/:id/time — add time entry
router.post('/employees/:id/time', (req, res) => {
  const db = getDb();
  const employee = db.prepare('SELECT id FROM employees WHERE id = ?').get(req.params.id);
  if (!employee) return res.status(404).json({ error: 'Employee not found' });

  const id = uuidv4();
  const now = new Date().toISOString();
  const b = req.body;

  db.prepare(`
    INSERT INTO time_entries (id, employee_id, date, clock_in, clock_out,
      hours_worked, activity_type, enterprise, field_id, task_id, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.params.id, b.date, b.clock_in || null, b.clock_out || null,
    b.hours_worked || null, b.activity_type || null, b.enterprise || null,
    b.field_id || null, b.task_id || null, b.notes || null, now);

  const entry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(id);
  res.status(201).json(entry);
});

// GET /api/employees/:id/time — time entries (?date_from, ?date_to)
router.get('/employees/:id/time', (req, res) => {
  const db = getDb();
  const employee = db.prepare('SELECT id FROM employees WHERE id = ?').get(req.params.id);
  if (!employee) return res.status(404).json({ error: 'Employee not found' });

  let sql = 'SELECT * FROM time_entries WHERE employee_id = ?';
  const params = [req.params.id];

  if (req.query.date_from) {
    sql += ' AND date >= ?';
    params.push(req.query.date_from);
  }
  if (req.query.date_to) {
    sql += ' AND date <= ?';
    params.push(req.query.date_to);
  }

  sql += ' ORDER BY date DESC';
  res.json(db.prepare(sql).all(...params));
});

module.exports = router;
