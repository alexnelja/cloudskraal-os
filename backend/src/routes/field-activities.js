const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');
const { activityCost, fieldActivityCost } = require('../services/activities');

const router = Router();

router.get('/field-activities', (req, res) => {
  const db = getDb();
  const { year, field_id } = req.query;
  let sql = 'SELECT DISTINCT a.* FROM field_activities a';
  const cond = [], params = [];
  if (field_id) { sql += ' JOIN field_activity_fields f ON f.activity_id = a.id'; cond.push('f.field_id = ?'); params.push(field_id); }
  if (year) { cond.push('a.year = ?'); params.push(Number(year)); }
  if (cond.length) sql += ' WHERE ' + cond.join(' AND ');
  sql += ' ORDER BY a.date DESC';
  const rows = db.prepare(sql).all(...params);
  for (const r of rows) {
    r.fields = db.prepare('SELECT field_id, ha FROM field_activity_fields WHERE activity_id = ?').all(r.id);
  }
  res.json(rows);
});

router.post('/field-activities', (req, res) => {
  const db = getDb();
  const b = req.body || {};
  if (typeof b.year !== 'number') return res.status(400).json({ error: 'year_required' });
  if (typeof b.hours !== 'number' || b.hours <= 0) return res.status(400).json({ error: 'hours_required' });
  const fields = Array.isArray(b.fields) ? b.fields : [];
  if (!fields.length) return res.status(400).json({ error: 'fields_required' });
  for (const f of fields) {
    const fid = typeof f === 'string' ? f : f.field_id;
    if (!db.prepare('SELECT id FROM fields WHERE id = ?').get(fid)) return res.status(400).json({ error: 'field_not_found', field_id: fid });
  }
  for (const [key, table] of [['equipment_id', 'equipment'], ['attachment_id', 'equipment'], ['operator_employee_id', 'employees']]) {
    if (b[key] && !db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(b[key])) {
      return res.status(400).json({ error: `${key.replace(/_id$/, '')}_not_found` });
    }
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO field_activities
      (id,date,year,activity_type,enterprise,equipment_id,attachment_id,operator_employee_id,
       hours,ha_covered,is_establishment,entry_basis,external_source,external_id,notes,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id, b.date || null, b.year, b.activity_type || null, b.enterprise || null,
      b.equipment_id || null, b.attachment_id || null, b.operator_employee_id || null,
      b.hours, b.ha_covered ?? null, b.is_establishment ? 1 : 0,
      b.entry_basis || 'estimate', b.external_source || null, b.external_id || null, b.notes || null, now, now);
    for (const f of fields) {
      const fid = typeof f === 'string' ? f : f.field_id;
      const ha = typeof f === 'string' ? null : f.ha ?? null;
      db.prepare('INSERT INTO field_activity_fields (id,activity_id,field_id,ha) VALUES (?,?,?,?)').run(uuidv4(), id, fid, ha);
    }
  });
  tx();
  const row = db.prepare('SELECT * FROM field_activities WHERE id = ?').get(id);
  row.fields = db.prepare('SELECT field_id, ha FROM field_activity_fields WHERE activity_id = ?').all(id);
  row.cost = activityCost(db, id);
  res.status(201).json(row);
});

router.delete('/field-activities/:id', (req, res) => {
  const db = getDb();
  const r = db.prepare('DELETE FROM field_activities WHERE id = ?').run(req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

router.get('/field-activities/:id/cost', (req, res) => {
  const db = getDb();
  const r = activityCost(db, req.params.id);
  if (r.error === 'activity_not_found') return res.status(404).json({ error: 'Not found' });
  res.json(r);
});

router.get('/fields/:id/activity-cost', (req, res) => {
  const db = getDb();
  const year = Number(req.query.year);
  if (!year) return res.status(400).json({ error: 'year_required' });
  res.json(fieldActivityCost(db, req.params.id, year));
});

module.exports = router;
