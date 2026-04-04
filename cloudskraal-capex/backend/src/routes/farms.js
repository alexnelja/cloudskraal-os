const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');

const router = Router();

// ---------------------------------------------------------------------------
// FARMS
// ---------------------------------------------------------------------------

// GET /api/farms — all farms with field_count
router.get('/farms', (req, res) => {
  const db = getDb();
  const farms = db.prepare(`
    SELECT f.*, COUNT(fi.id) AS field_count
    FROM farms f
    LEFT JOIN fields fi ON fi.farm_id = f.id
    GROUP BY f.id
    ORDER BY f.name
  `).all();
  res.json(farms);
});

// GET /api/farms/:id — single farm with field_count
router.get('/farms/:id', (req, res) => {
  const db = getDb();
  const farm = db.prepare(`
    SELECT f.*, COUNT(fi.id) AS field_count
    FROM farms f
    LEFT JOIN fields fi ON fi.farm_id = f.id
    WHERE f.id = ?
    GROUP BY f.id
  `).get(req.params.id);
  if (!farm) return res.status(404).json({ error: 'Farm not found' });
  res.json(farm);
});

// ---------------------------------------------------------------------------
// FIELDS
// ---------------------------------------------------------------------------

// GET /api/fields — list without geometry, optional ?farm_id=X&enterprise=X
router.get('/fields', (req, res) => {
  const db = getDb();
  const { farm_id, enterprise } = req.query;

  const conditions = [];
  const params = [];

  if (farm_id) {
    conditions.push('fi.farm_id = ?');
    params.push(farm_id);
  }
  if (enterprise) {
    conditions.push('fi.enterprise = ?');
    params.push(enterprise);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const fields = db.prepare(`
    SELECT
      fi.id, fi.farm_id, fi.name, fi.code, fi.enterprise, fi.crop_type,
      fi.area_ha, fi.planted_year, fi.status, fi.soil_type, fi.irrigation_type,
      fi.notes, fi.created_at, fi.updated_at,
      f.name AS farm_name
    FROM fields fi
    JOIN farms f ON f.id = fi.farm_id
    ${where}
    ORDER BY f.name, fi.name
  `).all(...params);

  res.json(fields);
});

// GET /api/fields/:id — single field with production and field_notes
router.get('/fields/:id', (req, res) => {
  const db = getDb();

  const field = db.prepare(`
    SELECT fi.*, f.name AS farm_name
    FROM fields fi
    JOIN farms f ON f.id = fi.farm_id
    WHERE fi.id = ?
  `).get(req.params.id);

  if (!field) return res.status(404).json({ error: 'Field not found' });

  const production = db.prepare(
    'SELECT * FROM field_production WHERE field_id = ? ORDER BY year'
  ).all(req.params.id);

  const field_notes = db.prepare(
    'SELECT * FROM field_notes WHERE field_id = ? ORDER BY created_at DESC'
  ).all(req.params.id);

  res.json({ ...field, production, field_notes });
});

// PATCH /api/fields/:id — partial update
router.patch('/fields/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM fields WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Field not found' });

  const allowed = ['enterprise', 'crop_type', 'status', 'planted_year', 'soil_type', 'irrigation_type', 'notes'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length > 0) {
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), new Date().toISOString(), req.params.id];
    db.prepare(`UPDATE fields SET ${setClauses}, updated_at = ? WHERE id = ?`).run(...values);
  }

  const field = db.prepare(`
    SELECT fi.*, f.name AS farm_name
    FROM fields fi
    JOIN farms f ON f.id = fi.farm_id
    WHERE fi.id = ?
  `).get(req.params.id);

  res.json(field);
});

// ---------------------------------------------------------------------------
// FIELD COST OF PRODUCTION
// ---------------------------------------------------------------------------

// GET /api/fields/:id/cost-of-production — full input/output/labour cost view
router.get('/fields/:id/cost-of-production', (req, res) => {
  const db = getDb();
  const { year } = req.query; // optional year filter

  const field = db.prepare(`
    SELECT fi.*, f.name AS farm_name
    FROM fields fi
    JOIN farms f ON f.id = fi.farm_id
    WHERE fi.id = ?
  `).get(req.params.id);

  if (!field) return res.status(404).json({ error: 'Field not found' });

  // --- Production (yields) ---
  let productionSql = 'SELECT * FROM field_production WHERE field_id = ?';
  const productionParams = [req.params.id];
  if (year) {
    productionSql += ' AND year = ?';
    productionParams.push(year);
  }
  productionSql += ' ORDER BY year';
  const production = db.prepare(productionSql).all(...productionParams);

  // --- Inputs applied (inventory transactions to this field) ---
  let inputsSql = `
    SELECT t.*, p.name AS product_name, p.category, p.unit_of_measure
    FROM inventory_transactions t
    JOIN input_products p ON p.id = t.product_id
    WHERE t.field_id = ? AND t.type = 'usage'
  `;
  const inputsParams = [req.params.id];
  if (year) {
    inputsSql += " AND t.date >= ? AND t.date < ?";
    inputsParams.push(`${year}-01-01`, `${Number(year) + 1}-01-01`);
  }
  inputsSql += ' ORDER BY t.date DESC';
  const inputs = db.prepare(inputsSql).all(...inputsParams);

  // --- Task inputs (products applied via tasks linked to this field) ---
  let taskInputsSql = `
    SELECT ti.*, t.title AS task_title, t.due_date, t.completed_date, t.status AS task_status
    FROM task_inputs ti
    JOIN tasks t ON t.id = ti.task_id
    WHERE t.field_id = ?
  `;
  const taskInputsParams = [req.params.id];
  if (year) {
    taskInputsSql += " AND (t.due_date >= ? AND t.due_date < ?)";
    taskInputsParams.push(`${year}-01-01`, `${Number(year) + 1}-01-01`);
  }
  taskInputsSql += ' ORDER BY t.due_date DESC';
  const taskInputs = db.prepare(taskInputsSql).all(...taskInputsParams);

  // --- Labour (time entries on this field) ---
  let labourSql = `
    SELECT te.*, e.name AS employee_name, e.role AS employee_role,
           e.hourly_rate, e.monthly_salary
    FROM time_entries te
    JOIN employees e ON e.id = te.employee_id
    WHERE te.field_id = ?
  `;
  const labourParams = [req.params.id];
  if (year) {
    labourSql += " AND te.date >= ? AND te.date < ?";
    labourParams.push(`${year}-01-01`, `${Number(year) + 1}-01-01`);
  }
  labourSql += ' ORDER BY te.date DESC';
  const labour = db.prepare(labourSql).all(...labourParams);

  // --- Tasks linked to this field ---
  let tasksSql = `
    SELECT id, title, status, priority, due_date, completed_date, enterprise
    FROM tasks WHERE field_id = ?
  `;
  const tasksParams = [req.params.id];
  if (year) {
    tasksSql += " AND (due_date >= ? AND due_date < ?)";
    tasksParams.push(`${year}-01-01`, `${Number(year) + 1}-01-01`);
  }
  tasksSql += ' ORDER BY due_date DESC';
  const tasks = db.prepare(tasksSql).all(...tasksParams);

  // --- Compute cost summary ---
  const inputCostTotal = inputs.reduce((sum, i) => sum + (i.total_cost || 0), 0);
  const taskInputCostTotal = taskInputs.reduce((sum, i) => sum + (i.total_cost || 0), 0);

  // Labour cost: use hourly_rate if available, else prorate monthly_salary
  const labourCostTotal = labour.reduce((sum, te) => {
    if (te.hourly_rate) return sum + (te.hours_worked || 0) * te.hourly_rate;
    if (te.monthly_salary) return sum + (te.hours_worked || 0) * (te.monthly_salary / 176); // ~22 days × 8hrs
    return sum;
  }, 0);

  const totalHours = labour.reduce((sum, te) => sum + (te.hours_worked || 0), 0);

  // Revenue from production (use latest rooibos price ~R55/kg as default)
  const totalActualYield = production.reduce((sum, p) => sum + (p.actual_yield_kg || 0), 0);

  const totalCost = inputCostTotal + taskInputCostTotal + labourCostTotal;
  const areaHa = field.area_ha || 1;

  const summary = {
    total_input_cost: Math.round(inputCostTotal * 100) / 100,
    total_task_input_cost: Math.round(taskInputCostTotal * 100) / 100,
    total_labour_cost: Math.round(labourCostTotal * 100) / 100,
    total_labour_hours: Math.round(totalHours * 10) / 10,
    total_cost: Math.round(totalCost * 100) / 100,
    cost_per_ha: Math.round((totalCost / areaHa) * 100) / 100,
    total_yield_kg: Math.round(totalActualYield * 100) / 100,
    yield_per_ha: Math.round((totalActualYield / areaHa) * 100) / 100,
    cost_per_kg: totalActualYield > 0 ? Math.round((totalCost / totalActualYield) * 100) / 100 : null,
  };

  res.json({
    field,
    production,
    inputs,
    taskInputs,
    labour,
    tasks,
    summary,
  });
});

// ---------------------------------------------------------------------------
// FIELD PRODUCTION
// ---------------------------------------------------------------------------

// GET /api/fields/:id/production
router.get('/fields/:id/production', (req, res) => {
  const db = getDb();
  const field = db.prepare('SELECT id FROM fields WHERE id = ?').get(req.params.id);
  if (!field) return res.status(404).json({ error: 'Field not found' });

  const production = db.prepare(
    'SELECT * FROM field_production WHERE field_id = ? ORDER BY year'
  ).all(req.params.id);

  res.json(production);
});

// ---------------------------------------------------------------------------
// FIELD NOTES
// ---------------------------------------------------------------------------

// GET /api/fields/:id/notes
router.get('/fields/:id/notes', (req, res) => {
  const db = getDb();
  const field = db.prepare('SELECT id FROM fields WHERE id = ?').get(req.params.id);
  if (!field) return res.status(404).json({ error: 'Field not found' });

  const notes = db.prepare(
    'SELECT * FROM field_notes WHERE field_id = ? ORDER BY created_at DESC'
  ).all(req.params.id);

  res.json(notes);
});

// POST /api/fields/:id/notes — create a note
router.post('/fields/:id/notes', (req, res) => {
  const db = getDb();
  const field = db.prepare('SELECT id FROM fields WHERE id = ?').get(req.params.id);
  if (!field) return res.status(404).json({ error: 'Field not found' });

  const { lat, lng, title, body, tags } = req.body;

  if (lat == null || lng == null) {
    return res.status(400).json({ error: 'lat and lng are required' });
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  const tagsJson = tags != null ? JSON.stringify(tags) : null;

  db.prepare(`
    INSERT INTO field_notes (id, field_id, lat, lng, title, body, tags, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.params.id, lat, lng, title || null, body || null, tagsJson, now);

  const note = db.prepare('SELECT * FROM field_notes WHERE id = ?').get(id);
  res.status(201).json(note);
});

// DELETE /api/field-notes/:noteId — delete a note
router.delete('/field-notes/:noteId', (req, res) => {
  const db = getDb();
  const note = db.prepare('SELECT id FROM field_notes WHERE id = ?').get(req.params.noteId);
  if (!note) return res.status(404).json({ error: 'Note not found' });

  db.prepare('DELETE FROM field_notes WHERE id = ?').run(req.params.noteId);
  res.status(204).send();
});

// ---------------------------------------------------------------------------
// MAP / GEOJSON
// ---------------------------------------------------------------------------

// GET /api/map/farm-boundaries — GeoJSON of farm boundary polygons (separate from fields)
router.get('/map/farm-boundaries', (req, res) => {
  const db = getDb();
  const farms = db.prepare('SELECT id, name, code, type, total_ha, geometry FROM farms WHERE geometry IS NOT NULL').all();

  const features = farms.map(farm => {
    let geometry = null;
    try {
      geometry = typeof farm.geometry === 'string' ? JSON.parse(farm.geometry) : farm.geometry;
    } catch { geometry = null; }
    if (!geometry) return null;

    return {
      type: 'Feature',
      geometry,
      properties: {
        id: farm.id,
        name: farm.name,
        code: farm.code,
        type: farm.type,
        total_ha: farm.total_ha,
        layer_type: 'farm_boundary',
      },
    };
  }).filter(Boolean);

  res.json({ type: 'FeatureCollection', features });
});

// GET /api/map/geojson — GeoJSON FeatureCollection of FIELDS only, optional ?farm=code&enterprise=X
router.get('/map/geojson', (req, res) => {
  const db = getDb();
  const { farm, enterprise } = req.query;

  const conditions = [];
  const params = [];

  if (farm) {
    conditions.push('f.code = ?');
    params.push(farm);
  }
  if (enterprise) {
    conditions.push('fi.enterprise = ?');
    params.push(enterprise);
  }

  // Always exclude farm_boundary from fields GeoJSON (those are served via /map/farm-boundaries)
  conditions.push("fi.enterprise != 'farm_boundary'");

  const where = `WHERE ${conditions.join(' AND ')}`;

  const rows = db.prepare(`
    SELECT
      fi.id, fi.name, fi.code, fi.farm_id,
      fi.enterprise, fi.area_ha, fi.status, fi.planted_year,
      fi.geometry,
      f.name AS farm_name, f.code AS farm_code
    FROM fields fi
    JOIN farms f ON f.id = fi.farm_id
    ${where}
  `).all(...params);

  const features = rows.map(row => {
    let geometry = null;
    try {
      geometry = typeof row.geometry === 'string' ? JSON.parse(row.geometry) : row.geometry;
    } catch {
      geometry = null;
    }

    return {
      type: 'Feature',
      geometry,
      properties: {
        id: row.id,
        name: row.name,
        code: row.code,
        farm_id: row.farm_id,
        farm_name: row.farm_name,
        farm_code: row.farm_code,
        enterprise: row.enterprise,
        area_ha: row.area_ha,
        status: row.status,
        planted_year: row.planted_year,
      },
    };
  });

  res.json({ type: 'FeatureCollection', features });
});

// ---------------------------------------------------------------------------
// MAP LAYERS
// ---------------------------------------------------------------------------

// GET /api/map-layers
router.get('/map-layers', (req, res) => {
  const db = getDb();
  const layers = db.prepare('SELECT * FROM map_layers ORDER BY z_index, name').all();
  res.json(layers);
});

// PATCH /api/map-layers/:id
router.patch('/map-layers/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM map_layers WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Map layer not found' });

  const allowed = ['visible', 'opacity'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length > 0) {
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), req.params.id];
    db.prepare(`UPDATE map_layers SET ${setClauses} WHERE id = ?`).run(...values);
  }

  const layer = db.prepare('SELECT * FROM map_layers WHERE id = ?').get(req.params.id);
  res.json(layer);
});

module.exports = router;
