const USAGE_TYPES = [
  'rooibos',
  'lupines_fourrages',
  'oats',
  'fallow',
  'almond',
  'grazing',
  'vines',
  'wheat',
];

const PERENNIAL_USAGES = new Set(['rooibos', 'almond', 'vines']);

function isValidUsage(usage) {
  return USAGE_TYPES.includes(usage);
}

function isPerennial(usage) {
  return PERENNIAL_USAGES.has(usage);
}

function assertNoOverlap(existingPeriods, candidate) {
  const INF = '9999-12-31';
  const cStart = candidate.start_date;
  const cEnd = candidate.end_date ?? INF;

  for (const row of existingPeriods) {
    if (row.field_id !== candidate.field_id) continue;
    if (row.deleted_at) continue;
    if (row.id && candidate.id && row.id === candidate.id) continue;
    const rStart = row.start_date;
    const rEnd = row.end_date ?? INF;
    if (!(cEnd <= rStart || cStart >= rEnd)) {
      const err = new Error(`overlap with period ${row.id}`);
      err.code = 'overlap';
      err.conflict = row.id;
      throw err;
    }
  }
}

function yearsSincePlanted(plantedDate, asOf) {
  if (!plantedDate) return null;
  const [py, pm, pd] = plantedDate.split('-').map(Number);
  const [ay, am, ad] = asOf.split('-').map(Number);
  let years = ay - py;
  if (am < pm || (am === pm && ad < pd)) years -= 1;
  return years;
}

function rotationYearEffective(period, asOf) {
  if (period.rotation_year != null) return period.rotation_year;
  if (isPerennial(period.usage) && period.planted_date) {
    return yearsSincePlanted(period.planted_date, asOf);
  }
  return null;
}

function refreshFieldCurrent(db, fieldId, asOf) {
  const row = db.prepare(`
    SELECT usage, planted_date
      FROM field_usage_period
     WHERE field_id = ?
       AND deleted_at IS NULL
       AND start_date <= ?
       AND (end_date IS NULL OR end_date >= ?)
     ORDER BY start_date DESC
     LIMIT 1
  `).get(fieldId, asOf, asOf);

  if (!row) return;

  const plantedYear = row.planted_date ? row.planted_date.slice(0, 4) : null;
  db.prepare(`UPDATE fields SET enterprise=?, crop_type=?, planted_year=?, updated_at=? WHERE id=?`)
    .run(row.usage, row.usage, plantedYear, new Date().toISOString(), fieldId);
}

function refreshAllFieldsCurrent(db, fieldIds, asOf) {
  if (!fieldIds.length) return;

  const placeholders = fieldIds.map(() => '?').join(',');
  // Get all active usage periods for the given fields in one query
  const periods = db.prepare(`
    SELECT field_id, usage, planted_date
      FROM field_usage_period
     WHERE field_id IN (${placeholders})
       AND deleted_at IS NULL
       AND start_date <= ?
       AND (end_date IS NULL OR end_date >= ?)
     ORDER BY start_date DESC
  `).all(...fieldIds, asOf, asOf);

  // Keep only the first (most recent start_date) per field
  const currentByField = {};
  for (const p of periods) {
    if (!currentByField[p.field_id]) currentByField[p.field_id] = p;
  }

  // Update all fields in a single transaction
  const now = new Date().toISOString();
  const updateStmt = db.prepare(
    'UPDATE fields SET enterprise=?, crop_type=?, planted_year=?, updated_at=? WHERE id=?'
  );
  const tx = db.transaction(() => {
    for (const fieldId of fieldIds) {
      const row = currentByField[fieldId];
      if (row) {
        const plantedYear = row.planted_date ? row.planted_date.slice(0, 4) : null;
        updateStmt.run(row.usage, row.usage, plantedYear, now, fieldId);
      }
    }
  });
  tx();
}

module.exports = {
  USAGE_TYPES,
  PERENNIAL_USAGES,
  isValidUsage,
  isPerennial,
  assertNoOverlap,
  yearsSincePlanted,
  rotationYearEffective,
  refreshFieldCurrent,
  refreshAllFieldsCurrent,
};
