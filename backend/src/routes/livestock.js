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

// ── COP INPUTS (Spec 2f.1) ──────────────────────────────────────────────────

const COP_INPUT_NUMERIC = [
  'ewes_mated', 'weaning_pct', 'greasy_fleece_kg_per_head', 'clean_yield_pct',
  'liveweight_sold_kg_total', 'feed_cost', 'labour_cost', 'animal_health_cost',
  'shearing_cost', 'other_direct_cost', 'wool_income', 'meat_income',
];

// Returns the name of the first non-numeric field present, or null if all valid.
function badCopNumeric(b) {
  for (const f of COP_INPUT_NUMERIC) {
    if (b[f] !== undefined && b[f] !== null && typeof b[f] !== 'number') return f;
  }
  return null;
}

router.get('/livestock/cop-inputs', (req, res) => {
  const db = getDb();
  const { year, group_id } = req.query;
  let sql = `SELECT fci.*, lg.name AS group_name
               FROM flock_cop_inputs fci
               JOIN livestock_groups lg ON lg.id = fci.group_id`;
  const cond = [], params = [];
  if (year) { cond.push('fci.year = ?'); params.push(Number(year)); }
  if (group_id) { cond.push('fci.group_id = ?'); params.push(group_id); }
  if (cond.length) sql += ' WHERE ' + cond.join(' AND ');
  sql += ' ORDER BY lg.name, fci.year DESC';
  res.json(db.prepare(sql).all(...params));
});

router.get('/livestock/groups/:id/cop-inputs', (req, res) => {
  const db = getDb();
  const group = db.prepare('SELECT id FROM livestock_groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  const { year } = req.query;
  let sql = 'SELECT * FROM flock_cop_inputs WHERE group_id = ?';
  const params = [req.params.id];
  if (year) { sql += ' AND year = ?'; params.push(Number(year)); }
  sql += ' ORDER BY year DESC';
  res.json(db.prepare(sql).all(...params));
});

router.post('/livestock/groups/:id/cop-inputs', (req, res) => {
  const db = getDb();
  const group = db.prepare('SELECT id FROM livestock_groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const b = req.body || {};
  if (typeof b.year !== 'number') return res.status(400).json({ error: 'year_required' });
  const bad = badCopNumeric(b);
  if (bad) return res.status(400).json({ error: 'invalid_numeric', field: bad });

  const dup = db.prepare('SELECT id FROM flock_cop_inputs WHERE group_id = ? AND year = ?')
    .get(req.params.id, b.year);
  if (dup) return res.status(409).json({ error: 'duplicate_year' });

  const id = uuidv4();
  const now = new Date().toISOString();
  const v = (k) => (b[k] === undefined ? null : b[k]);
  db.prepare(`INSERT INTO flock_cop_inputs (
      id, group_id, year, ewes_mated, weaning_pct, greasy_fleece_kg_per_head,
      clean_yield_pct, liveweight_sold_kg_total, feed_cost, labour_cost,
      animal_health_cost, shearing_cost, other_direct_cost, wool_income,
      meat_income, source, notes, created_at, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, req.params.id, b.year, v('ewes_mated'), v('weaning_pct'),
    v('greasy_fleece_kg_per_head'), v('clean_yield_pct'), v('liveweight_sold_kg_total'),
    v('feed_cost'), v('labour_cost'), v('animal_health_cost'), v('shearing_cost'),
    v('other_direct_cost'), v('wool_income'), v('meat_income'),
    b.source || 'actual', b.notes || null, now, now);

  res.status(201).json(db.prepare('SELECT * FROM flock_cop_inputs WHERE id = ?').get(id));
});

router.patch('/livestock/cop-inputs/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM flock_cop_inputs WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'COP input not found' });

  const b = req.body || {};
  const bad = badCopNumeric(b);
  if (bad) return res.status(400).json({ error: 'invalid_numeric', field: bad });

  const allowed = [...COP_INPUT_NUMERIC, 'source', 'notes'];
  const updates = {};
  for (const k of allowed) if (b[k] !== undefined) updates[k] = b[k];

  if (Object.keys(updates).length > 0) {
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), new Date().toISOString(), req.params.id];
    db.prepare(`UPDATE flock_cop_inputs SET ${setClauses}, updated_at = ? WHERE id = ?`).run(...values);
  }
  res.json(db.prepare('SELECT * FROM flock_cop_inputs WHERE id = ?').get(req.params.id));
});

// ── FLOCK COP COMPUTE + TRANSFER EVENTS (Spec 2f.2) ─────────────────────────

router.get('/livestock/groups/:id/cost-of-production', (req, res) => {
  const db = getDb();
  const yearStr = req.query.year;
  if (!yearStr || isNaN(Number(yearStr))) return res.status(400).json({ error: 'year_required' });
  const { computeFlockCop } = require('../services/livestock_cop');
  const report = computeFlockCop(db, req.params.id, Number(yearStr));
  if (!report) return res.status(404).json({ error: 'No COP inputs for this flock/year' });
  res.json(report);
});

// transfer-pricing mode (farm_config) -------------------------------------------
router.get('/livestock/transfer-pricing-mode', (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT value FROM farm_config WHERE key = 'transfer_pricing_mode'").get();
  res.json({ mode: row && row.value === 'at_market' ? 'at_market' : 'at_cost' });
});

router.put('/livestock/transfer-pricing-mode', (req, res) => {
  const db = getDb();
  const mode = req.body && req.body.mode;
  if (mode !== 'at_cost' && mode !== 'at_market') {
    return res.status(400).json({ error: 'invalid_mode', allowed: ['at_cost', 'at_market'] });
  }
  db.prepare(`INSERT INTO farm_config (key,value,updated_at) VALUES ('transfer_pricing_mode',?,?)
              ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`)
    .run(mode, new Date().toISOString());
  res.json({ mode });
});

// grazing events ----------------------------------------------------------------
router.get('/livestock/grazing-events', (req, res) => {
  const db = getDb();
  const { group_id, field_id } = req.query;
  let sql = `SELECT ge.*, lg.name AS group_name, fi.name AS field_name
               FROM grazing_events ge
               JOIN livestock_groups lg ON lg.id = ge.group_id
               LEFT JOIN fields fi ON fi.id = ge.field_id`;
  const cond = [], params = [];
  if (group_id) { cond.push('ge.group_id = ?'); params.push(group_id); }
  if (field_id) { cond.push('ge.field_id = ?'); params.push(field_id); }
  if (cond.length) sql += ' WHERE ' + cond.join(' AND ');
  sql += ' ORDER BY ge.start_date DESC';
  res.json(db.prepare(sql).all(...params));
});

router.post('/livestock/grazing-events', (req, res) => {
  const db = getDb();
  const b = req.body || {};
  const group = db.prepare('SELECT id FROM livestock_groups WHERE id = ?').get(b.group_id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (!b.start_date) return res.status(400).json({ error: 'start_date_required' });
  // allocation_fraction optional: null → auto-allocate from head_count + stocking density.
  if (b.allocation_fraction != null &&
      (typeof b.allocation_fraction !== 'number' || b.allocation_fraction < 0 || b.allocation_fraction > 1)) {
    return res.status(400).json({ error: 'invalid_allocation_fraction' });
  }
  if (b.allocation_fraction == null && b.head_count == null) {
    return res.status(400).json({ error: 'allocation_fraction_or_head_count_required' });
  }
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO grazing_events
    (id,group_id,field_id,start_date,end_date,allocation_fraction,head_count,market_value_zar,notes,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(id, b.group_id, b.field_id || null, b.start_date,
    b.end_date || null, b.allocation_fraction ?? null, b.head_count ?? null, b.market_value_zar ?? null,
    b.notes || null, now, now);
  res.status(201).json(db.prepare('SELECT * FROM grazing_events WHERE id = ?').get(id));
});

router.patch('/livestock/grazing-events/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM grazing_events WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Grazing event not found' });
  const b = req.body || {};
  if (b.allocation_fraction !== undefined &&
      (typeof b.allocation_fraction !== 'number' || b.allocation_fraction < 0 || b.allocation_fraction > 1)) {
    return res.status(400).json({ error: 'invalid_allocation_fraction' });
  }
  const allowed = ['field_id', 'start_date', 'end_date', 'allocation_fraction', 'head_count', 'market_value_zar', 'notes'];
  const updates = {};
  for (const k of allowed) if (b[k] !== undefined) updates[k] = b[k];
  if (Object.keys(updates).length) {
    const set = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    db.prepare(`UPDATE grazing_events SET ${set}, updated_at = ? WHERE id = ?`)
      .run(...Object.values(updates), new Date().toISOString(), req.params.id);
  }
  res.json(db.prepare('SELECT * FROM grazing_events WHERE id = ?').get(req.params.id));
});

router.delete('/livestock/grazing-events/:id', (req, res) => {
  const db = getDb();
  const r = db.prepare('DELETE FROM grazing_events WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Grazing event not found' });
  res.status(204).end();
});

// feeding events ----------------------------------------------------------------
router.get('/livestock/feeding-events', (req, res) => {
  const db = getDb();
  const { group_id, source_field_id } = req.query;
  let sql = `SELECT fe.*, lg.name AS group_name FROM feeding_events fe
               JOIN livestock_groups lg ON lg.id = fe.group_id`;
  const cond = [], params = [];
  if (group_id) { cond.push('fe.group_id = ?'); params.push(group_id); }
  if (source_field_id) { cond.push('fe.source_field_id = ?'); params.push(source_field_id); }
  if (cond.length) sql += ' WHERE ' + cond.join(' AND ');
  sql += ' ORDER BY fe.date DESC';
  res.json(db.prepare(sql).all(...params));
});

router.post('/livestock/feeding-events', (req, res) => {
  const db = getDb();
  const b = req.body || {};
  const group = db.prepare('SELECT id FROM livestock_groups WHERE id = ?').get(b.group_id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (!b.date) return res.status(400).json({ error: 'date_required' });
  if (b.source_type !== 'purchased' && b.source_type !== 'internal') {
    return res.status(400).json({ error: 'invalid_source_type' });
  }
  if (b.source_type === 'internal' && !b.source_field_id) {
    return res.status(400).json({ error: 'source_field_required_for_internal' });
  }
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO feeding_events
    (id,group_id,date,source_type,source_field_id,source_usage,product,quantity_kg,unit_cost_zar,market_price_zar,notes,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, b.group_id, b.date, b.source_type,
    b.source_field_id || null, b.source_usage || null, b.product || null,
    b.quantity_kg ?? null, b.unit_cost_zar ?? null, b.market_price_zar ?? null, b.notes || null, now, now);
  res.status(201).json(db.prepare('SELECT * FROM feeding_events WHERE id = ?').get(id));
});

router.patch('/livestock/feeding-events/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM feeding_events WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Feeding event not found' });
  const b = req.body || {};
  const allowed = ['date', 'source_type', 'source_field_id', 'source_usage', 'product', 'quantity_kg', 'unit_cost_zar', 'market_price_zar', 'notes'];
  const updates = {};
  for (const k of allowed) if (b[k] !== undefined) updates[k] = b[k];
  if (Object.keys(updates).length) {
    const set = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    db.prepare(`UPDATE feeding_events SET ${set}, updated_at = ? WHERE id = ?`)
      .run(...Object.values(updates), new Date().toISOString(), req.params.id);
  }
  res.json(db.prepare('SELECT * FROM feeding_events WHERE id = ?').get(req.params.id));
});

router.delete('/livestock/feeding-events/:id', (req, res) => {
  const db = getDb();
  const r = db.prepare('DELETE FROM feeding_events WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Feeding event not found' });
  res.status(204).end();
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
      avg_weaning_weight_kg, weaning_date, weaning_percentage, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, b.group_id, b.year, b.joining_start || null, b.joining_end || null,
    b.rams_used || null, b.ewes_joined || null, b.scanning_date || null,
    b.pregnant_count || null, b.dry_count || null, b.singles_count || null,
    b.twins_count || null, b.triplets_count || null, b.lambing_start || null,
    b.lambing_end || null, b.born_count || null, b.survived_count || null,
    b.weaned_count || null, b.avg_weaning_weight_kg ?? null, b.weaning_date || null,
    b.weaning_percentage || null, b.notes || null, now, now);

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
    'weaned_count', 'avg_weaning_weight_kg', 'weaning_date', 'weaning_percentage', 'notes'];

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
