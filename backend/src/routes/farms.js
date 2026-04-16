const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');
const { refreshFieldCurrent } = require('../services/usage');
const { todayUTC } = require('../utils/dates');
const { getSoilAtPoint, fieldCentroid } = require('../services/fieldEnrichment');

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

  const asOf = todayUTC();
  for (const r of fields) refreshFieldCurrent(db, r.id, asOf);
  const ids = fields.map(r => r.id);
  if (ids.length > 0) {
    const placeholders = ids.map(() => '?').join(',');
    const fresh = db.prepare(
      `SELECT id, enterprise, crop_type, planted_year FROM fields WHERE id IN (${placeholders})`
    ).all(...ids);
    const byId = new Map(fresh.map(f => [f.id, f]));
    for (const r of fields) {
      const f = byId.get(r.id);
      if (f) { r.enterprise = f.enterprise; r.crop_type = f.crop_type; r.planted_year = f.planted_year; }
    }
  }

  res.json(fields);
});

// GET /api/fields/:id — single field with production and field_notes
router.get('/fields/:id', (req, res) => {
  const db = getDb();

  refreshFieldCurrent(db, req.params.id, todayUTC());

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

// GET /api/fields/:id/enrichment — external GIS data at the field centroid
router.get('/fields/:id/enrichment', async (req, res) => {
  const db = getDb();
  const field = db.prepare('SELECT id, geometry FROM fields WHERE id = ?').get(req.params.id);
  if (!field) return res.status(404).json({ error: 'Field not found' });

  const c = fieldCentroid(field);
  if (!c) return res.status(422).json({ error: 'field_centroid_unavailable' });

  try {
    const soil = await getSoilAtPoint(c.lng, c.lat);
    res.json({ centroid: c, soil });
  } catch (err) {
    console.warn('[enrichment] fetch failed:', err.message);
    res.json({ centroid: c, soil: null, error: 'fetch_failed' });
  }
});

// POST /api/fields — create a new field
router.post('/fields', (req, res) => {
  const db = getDb();
  const required = ['farm_id', 'name', 'enterprise', 'area_ha'];
  for (const k of required) {
    if (req.body[k] === undefined || req.body[k] === null || req.body[k] === '') {
      return res.status(400).json({ error: `Missing required field: ${k}` });
    }
  }
  const farm = db.prepare('SELECT id FROM farms WHERE id = ?').get(req.body.farm_id);
  if (!farm) return res.status(400).json({ error: 'Unknown farm_id' });

  const now = new Date().toISOString();
  const row = {
    id: uuidv4(),
    farm_id: req.body.farm_id,
    name: req.body.name,
    code: req.body.code ?? null,
    enterprise: req.body.enterprise,
    crop_type: req.body.crop_type ?? null,
    area_ha: Number(req.body.area_ha),
    planted_year: req.body.planted_year ?? null,
    status: req.body.status ?? 'active',
    geometry:
      typeof req.body.geometry === 'string'
        ? req.body.geometry
        : req.body.geometry
        ? JSON.stringify(req.body.geometry)
        : null,
    notes: req.body.notes ?? null,
    created_at: now,
    updated_at: now,
  };
  db.prepare(
    `INSERT INTO fields (id, farm_id, name, code, enterprise, crop_type, area_ha, planted_year, status, geometry, notes, created_at, updated_at)
     VALUES (@id, @farm_id, @name, @code, @enterprise, @crop_type, @area_ha, @planted_year, @status, @geometry, @notes, @created_at, @updated_at)`,
  ).run(row);
  res.status(201).json(row);
});

// PATCH /api/fields/:id — partial update
router.patch('/fields/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM fields WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Field not found' });

  const readOnly = ['enterprise', 'crop_type', 'planted_year'];
  const blocked = Object.keys(req.body || {}).filter(k => readOnly.includes(k));
  if (blocked.length > 0) {
    return res.status(400).json({
      error: 'read_only',
      fields: blocked,
      managed_by: 'field_usage_period',
      use: 'POST /api/fields/:id/usage-periods',
    });
  }
  const allowed = ['status', 'soil_type', 'irrigation_type', 'notes'];
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

// GET /api/fields/:id/cost-of-production — CopReport wrapper around services/cop
router.get('/fields/:id/cost-of-production', (req, res) => {
  const db = getDb();
  const yearStr = req.query.year;
  if (!yearStr || isNaN(Number(yearStr))) {
    return res.status(400).json({ error: 'year_required' });
  }
  const year = Number(yearStr);
  const { computeFieldCop } = require('../services/cop');
  const report = computeFieldCop(db, req.params.id, year, {
    denominator: req.query.denominator,
  });
  if (!report) return res.status(404).json({ error: 'Field not found' });
  if (report.error) return res.status(400).json(report);
  res.json(report);
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
