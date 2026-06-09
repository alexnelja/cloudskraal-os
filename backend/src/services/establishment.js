// Spec 2i.4 — establishment accrual: is_establishment-flagged shared inputs +
// activities (valid only at year == cohort planted_year) accumulate into
// field_establishment.total_cost_zar, then amortise via include=capital (2c).
const { fieldSharedInputCost } = require('./shared_inputs');
const { fieldActivityCost } = require('./activities');

function round2(n) { return Math.round(n * 100) / 100; }

// Read-only: a field's establishment-flagged cost at its cohort planted year.
function establishmentAccrual(db, fieldId, plantedYear) {
  const si = fieldSharedInputCost(db, fieldId, plantedYear, { establishment: true });
  const act = fieldActivityCost(db, fieldId, plantedYear, { establishment: true });
  const warnings = [...si.warnings];
  for (const w of act.warnings) if (!warnings.includes(w)) warnings.push(w);
  return { total: round2(si.total + act.total), shared_inputs: si, activities: act, warnings };
}

// Recompute and write a field_establishment row's total_cost_zar from the
// establishment-flagged rows at its planted year. Establishment rows in OTHER
// years are invalid per the year==planted_year rule — surfaced, not summed.
function applyEstablishmentAccrual(db, establishmentId) {
  const est = db.prepare('SELECT * FROM field_establishment WHERE id = ?').get(establishmentId);
  if (!est) return { error: 'establishment_not_found' };
  const plantedYear = parseInt(String(est.planted_date).slice(0, 4), 10);
  if (!Number.isFinite(plantedYear)) return { error: 'planted_date_missing' };

  const acc = establishmentAccrual(db, est.field_id, plantedYear);
  const warnings = [...acc.warnings];

  const stray = db.prepare(`
    SELECT 1 FROM shared_inputs si JOIN shared_input_fields f ON f.shared_input_id = si.id
     WHERE f.field_id = ? AND si.year != ? AND COALESCE(si.is_establishment,0) = 1
    UNION
    SELECT 1 FROM field_activities a JOIN field_activity_fields f ON f.activity_id = a.id
     WHERE f.field_id = ? AND a.year != ? AND COALESCE(a.is_establishment,0) = 1
    LIMIT 1
  `).get(est.field_id, plantedYear, est.field_id, plantedYear);
  if (stray) warnings.push('establishment_rows_outside_planted_year');

  db.prepare('UPDATE field_establishment SET total_cost_zar = ?, updated_at = ? WHERE id = ?')
    .run(acc.total, new Date().toISOString(), establishmentId);

  return {
    establishment_id: establishmentId,
    field_id: est.field_id,
    planted_year: plantedYear,
    total_cost_zar: acc.total,
    shared_inputs: acc.shared_inputs,
    activities: acc.activities,
    warnings,
  };
}

module.exports = { establishmentAccrual, applyEstablishmentAccrual };
