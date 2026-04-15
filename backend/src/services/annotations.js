const { v4: uuidv4 } = require('uuid');
const { computeMetrics } = require('./annotationMetrics');
const { resolveFieldId } = require('./annotationFieldResolver');

const GEOM_FOR_TYPE = {
  line: 'LineString',
  polygon: 'Polygon',
  pin: 'Point',
};

function assertTypeMatches(type, geometry) {
  const expected = GEOM_FOR_TYPE[type];
  if (!expected) {
    const err = new Error('invalid_type');
    err.code = 'invalid_type';
    throw err;
  }
  if (!geometry || geometry.type !== expected) {
    const err = new Error(`type/geometry mismatch: expected ${expected} for ${type}`);
    err.code = 'type_mismatch';
    throw err;
  }
}

function loadFields(db) {
  return db.prepare('SELECT id, farm_id, geometry FROM fields').all();
}

function hydrate(row) {
  if (!row) return null;
  return {
    ...row,
    geometry: row.geometry_json ? JSON.parse(row.geometry_json) : null,
  };
}

function createAnnotation(db, input) {
  const { type, title, notes = null, geometry } = input;
  if (!title || typeof title !== 'string') {
    const err = new Error('title_required');
    err.code = 'title_required';
    throw err;
  }
  assertTypeMatches(type, geometry);

  const { length_m = null, area_m2 = null } = computeMetrics(geometry);
  const fields = loadFields(db);
  const { field_id, farm_id } = resolveFieldId(geometry, fields);

  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO annotations
      (id, type, title, notes, geometry_json, length_m, area_m2, field_id, farm_id, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, type, title, notes, JSON.stringify(geometry),
    length_m, area_m2, field_id, farm_id, now, now,
  );
  return hydrate(db.prepare('SELECT * FROM annotations WHERE id = ?').get(id));
}

function listAnnotations(db, { type, field_id } = {}) {
  const where = [];
  const params = [];
  if (type) { where.push('type = ?'); params.push(type); }
  if (field_id) { where.push('field_id = ?'); params.push(field_id); }
  const sql = `
    SELECT * FROM annotations
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY created_at DESC, id DESC
  `;
  return db.prepare(sql).all(...params).map(hydrate);
}

function getAnnotation(db, id) {
  return hydrate(db.prepare('SELECT * FROM annotations WHERE id = ?').get(id));
}

function updateAnnotation(db, id, patch) {
  const row = db.prepare('SELECT id FROM annotations WHERE id = ?').get(id);
  if (!row) return null;
  const now = new Date().toISOString();
  const fields = [];
  const params = [];
  if (patch.title !== undefined) { fields.push('title = ?'); params.push(patch.title); }
  if (patch.notes !== undefined) { fields.push('notes = ?'); params.push(patch.notes); }
  fields.push('updated_at = ?'); params.push(now);
  params.push(id);
  db.prepare(`UPDATE annotations SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  return getAnnotation(db, id);
}

function deleteAnnotation(db, id) {
  const info = db.prepare('DELETE FROM annotations WHERE id = ?').run(id);
  return info.changes > 0;
}

module.exports = {
  createAnnotation,
  listAnnotations,
  getAnnotation,
  updateAnnotation,
  deleteAnnotation,
};
