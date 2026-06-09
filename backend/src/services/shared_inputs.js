// Spec 2i.1 — a field's share of shared (multi-field) inputs for a year.
// Establishment-flagged rows are excluded (they accrue to field_establishment, 2c).
function round2(n) { return Math.round(n * 100) / 100; }

// opts.establishment: true → ONLY establishment-flagged rows (2i.4 accrual);
// default → only in-year rows (establishment accrues to field_establishment, 2c).
function fieldSharedInputCost(db, fieldId, year, opts = {}) {
  const field = db.prepare('SELECT COALESCE(area_ha,0) AS area_ha FROM fields WHERE id = ?').get(fieldId);
  const fieldArea = field ? field.area_ha : 0;

  let rows;
  try {
    rows = db.prepare(`
      SELECT si.* FROM shared_inputs si
        JOIN shared_input_fields f ON f.shared_input_id = si.id
       WHERE f.field_id = ? AND si.year = ? AND COALESCE(si.is_establishment,0) = ?
    `).all(fieldId, year, opts.establishment ? 1 : 0);
  } catch { return { total: 0, items: [], warnings: [] }; }

  const warnings = [];
  const items = [];
  let total = 0;
  for (const si of rows) {
    let allocated;
    if (si.basis === 'total_split_ha') {
      const sumArea = db.prepare(`
        SELECT COALESCE(SUM(COALESCE(fi.area_ha,0)),0) AS s
          FROM shared_input_fields sf JOIN fields fi ON fi.id = sf.field_id
         WHERE sf.shared_input_id = ?
      `).get(si.id).s;
      if (sumArea <= 0) {
        if (!warnings.includes('multi_field_split_zero_area')) warnings.push('multi_field_split_zero_area');
        continue;
      }
      allocated = round2((si.total_cost_zar || 0) * fieldArea / sumArea);
    } else { // per_ha_rate (default)
      allocated = round2((si.rate_per_ha || 0) * fieldArea);
    }
    total += allocated;
    items.push({ shared_input_id: si.id, product: si.product, basis: si.basis, allocated });
  }
  return { total: round2(total), items, warnings };
}

// Cheap existence check for the opt-in exclusion flag.
function hasSharedInputs(db, fieldId, year) {
  try {
    return !!db.prepare(`
      SELECT 1 FROM shared_inputs si JOIN shared_input_fields f ON f.shared_input_id = si.id
       WHERE f.field_id = ? AND si.year = ? AND COALESCE(si.is_establishment,0) = 0 LIMIT 1
    `).get(fieldId, year);
  } catch { return false; }
}

module.exports = { fieldSharedInputCost, hasSharedInputs };
