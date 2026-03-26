const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');

const router = Router();

// ── DASHBOARD ─────────────────────────────────────────────────────────────────

router.get('/livestock/dashboard', (req, res) => {
  const db = getDb();

  const totalHead = db.prepare('SELECT COALESCE(SUM(head_count), 0) as total FROM livestock_groups').get().total;

  const groups = db.prepare(
    'SELECT name, head_count as count, management_type FROM livestock_groups ORDER BY head_count DESC'
  ).all();

  // Upcoming events: breeding seasons with future dates
  const today = new Date().toISOString().split('T')[0];
  const upcomingEvents = db.prepare(`
    SELECT bs.*, lg.name AS group_name
    FROM breeding_seasons bs
    JOIN livestock_groups lg ON lg.id = bs.group_id
    WHERE bs.lambing_start > ? OR bs.weaning_date > ? OR bs.scanning_date > ?
    ORDER BY COALESCE(bs.lambing_start, bs.weaning_date, bs.scanning_date)
    LIMIT 5
  `).all(today, today, today);

  const latestShearing = db.prepare(`
    SELECT sr.*, lg.name AS group_name
    FROM shearing_records sr
    JOIN livestock_groups lg ON lg.id = sr.group_id
    ORDER BY sr.date DESC
    LIMIT 1
  `).get();

  res.json({ totalHead, groups, upcomingEvents, latestShearing });
});

// ── GROUPS ────────────────────────────────────────────────────────────────────

router.get('/livestock/groups', (req, res) => {
  const db = getDb();
  const groups = db.prepare(`
    SELECT lg.*,
      (SELECT COUNT(*) FROM livestock_records lr WHERE lr.group_id = lg.id) AS record_count,
      fi.name AS field_name
    FROM livestock_groups lg
    LEFT JOIN fields fi ON fi.id = lg.current_field_id
    ORDER BY lg.head_count DESC
  `).all();

  res.json(groups);
});

router.get('/livestock/groups/:id', (req, res) => {
  const db = getDb();
  const group = db.prepare(`
    SELECT lg.*, fi.name AS field_name
    FROM livestock_groups lg
    LEFT JOIN fields fi ON fi.id = lg.current_field_id
    WHERE lg.id = ?
  `).get(req.params.id);

  if (!group) return res.status(404).json({ error: 'Group not found' });

  const records = db.prepare(
    'SELECT * FROM livestock_records WHERE group_id = ? ORDER BY date DESC LIMIT 50'
  ).all(req.params.id);

  res.json({ ...group, records });
});

router.post('/livestock/groups', (req, res) => {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const b = req.body;

  db.prepare(`
    INSERT INTO livestock_groups (id, name, enterprise, species, breed, management_type,
      head_count, current_field_id, average_weight_kg, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, b.name, b.enterprise || 'sheep', b.species, b.breed || null,
    b.management_type || null, b.head_count || 0, b.current_field_id || null,
    b.average_weight_kg || null, b.notes || null, now, now);

  const group = db.prepare('SELECT * FROM livestock_groups WHERE id = ?').get(id);
  res.status(201).json(group);
});

router.patch('/livestock/groups/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM livestock_groups WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Group not found' });

  const allowed = ['name', 'enterprise', 'species', 'breed', 'management_type',
    'head_count', 'current_field_id', 'average_weight_kg', 'notes'];

  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length > 0) {
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), new Date().toISOString(), req.params.id];
    db.prepare(`UPDATE livestock_groups SET ${setClauses}, updated_at = ? WHERE id = ?`).run(...values);
  }

  const group = db.prepare('SELECT * FROM livestock_groups WHERE id = ?').get(req.params.id);
  res.json(group);
});

// ── RECORDS ───────────────────────────────────────────────────────────────────

router.post('/livestock/groups/:id/records', (req, res) => {
  const db = getDb();
  const group = db.prepare('SELECT id FROM livestock_groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const id = uuidv4();
  const now = new Date().toISOString();
  const b = req.body;

  db.prepare(`
    INSERT INTO livestock_records (id, group_id, record_type, date, details, head_count,
      field_id, product_used, cost, recorded_by, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.params.id, b.record_type, b.date, b.details ? JSON.stringify(b.details) : null,
    b.head_count || null, b.field_id || null, b.product_used || null,
    b.cost || null, b.recorded_by || null, b.notes || null, now);

  const record = db.prepare('SELECT * FROM livestock_records WHERE id = ?').get(id);
  res.status(201).json(record);
});

router.get('/livestock/groups/:id/records', (req, res) => {
  const db = getDb();
  const group = db.prepare('SELECT id FROM livestock_groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const { record_type } = req.query;
  let sql = 'SELECT * FROM livestock_records WHERE group_id = ?';
  const params = [req.params.id];

  if (record_type) {
    sql += ' AND record_type = ?';
    params.push(record_type);
  }

  sql += ' ORDER BY date DESC';
  const records = db.prepare(sql).all(...params);
  res.json(records);
});

// ── BREEDING SEASONS ──────────────────────────────────────────────────────────

router.get('/livestock/breeding-seasons', (req, res) => {
  const db = getDb();
  const seasons = db.prepare(`
    SELECT bs.*, lg.name AS group_name
    FROM breeding_seasons bs
    JOIN livestock_groups lg ON lg.id = bs.group_id
    ORDER BY bs.year DESC
  `).all();

  res.json(seasons);
});

router.post('/livestock/breeding-seasons', (req, res) => {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const b = req.body;

  db.prepare(`
    INSERT INTO breeding_seasons (id, group_id, year, joining_start, joining_end, rams_used,
      ewes_joined, scanning_date, pregnant_count, dry_count, singles_count, twins_count,
      triplets_count, lambing_start, lambing_end, born_count, survived_count, weaned_count,
      weaning_date, weaning_percentage, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, b.group_id, b.year, b.joining_start || null, b.joining_end || null,
    b.rams_used || null, b.ewes_joined || null, b.scanning_date || null,
    b.pregnant_count || null, b.dry_count || null, b.singles_count || null,
    b.twins_count || null, b.triplets_count || null, b.lambing_start || null,
    b.lambing_end || null, b.born_count || null, b.survived_count || null,
    b.weaned_count || null, b.weaning_date || null, b.weaning_percentage || null,
    b.notes || null, now, now);

  const season = db.prepare('SELECT * FROM breeding_seasons WHERE id = ?').get(id);
  res.status(201).json(season);
});

router.patch('/livestock/breeding-seasons/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM breeding_seasons WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Breeding season not found' });

  const allowed = ['joining_start', 'joining_end', 'rams_used', 'ewes_joined',
    'scanning_date', 'pregnant_count', 'dry_count', 'singles_count', 'twins_count',
    'triplets_count', 'lambing_start', 'lambing_end', 'born_count', 'survived_count',
    'weaned_count', 'weaning_date', 'weaning_percentage', 'notes'];

  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length > 0) {
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), new Date().toISOString(), req.params.id];
    db.prepare(`UPDATE breeding_seasons SET ${setClauses}, updated_at = ? WHERE id = ?`).run(...values);
  }

  const season = db.prepare('SELECT * FROM breeding_seasons WHERE id = ?').get(req.params.id);
  res.json(season);
});

// ── SHEARING ──────────────────────────────────────────────────────────────────

router.get('/livestock/shearing', (req, res) => {
  const db = getDb();
  const records = db.prepare(`
    SELECT sr.*, lg.name AS group_name
    FROM shearing_records sr
    JOIN livestock_groups lg ON lg.id = sr.group_id
    ORDER BY sr.date DESC
  `).all();

  res.json(records);
});

router.post('/livestock/shearing', (req, res) => {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const b = req.body;

  db.prepare(`
    INSERT INTO shearing_records (id, group_id, date, head_shorn, total_fleece_kg,
      avg_fleece_kg, micron_avg, yield_pct, vegetable_matter, staple_length_mm,
      grade, buyer, price_per_kg, total_revenue, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, b.group_id, b.date, b.head_shorn || null, b.total_fleece_kg || null,
    b.avg_fleece_kg || null, b.micron_avg || null, b.yield_pct || null,
    b.vegetable_matter || null, b.staple_length_mm || null, b.grade || null,
    b.buyer || null, b.price_per_kg || null, b.total_revenue || null,
    b.notes || null, now);

  const record = db.prepare('SELECT * FROM shearing_records WHERE id = ?').get(id);
  res.status(201).json(record);
});

module.exports = router;
