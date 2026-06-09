// Spec 2i.3 — activity (operation) costing: machine+attachment (comboRate, 2i.2)
// + operator, × hours. No activity-linked inputs in v1 (inputs live in
// inventory_transactions/shared_inputs). Establishment-flagged rows are excluded
// from in-year cost (they accrue to field_establishment, 2c).
const { comboRate } = require('./equipment_rates');

function round2(n) { return Math.round(n * 100) / 100; }

// Cost of one activity row: { machine_cost, operator_cost, total, warnings }.
function activityCost(db, activityId) {
  const a = typeof activityId === 'object'
    ? activityId
    : db.prepare('SELECT * FROM field_activities WHERE id = ?').get(activityId);
  if (!a) return { error: 'activity_not_found', total: 0, warnings: [] };

  const warnings = [];
  const hours = a.hours || 0;

  let machine_cost = 0;
  if (a.equipment_id) {
    const rate = comboRate(db, a.equipment_id, a.attachment_id);
    for (const part of a.attachment_id ? [rate.machine, rate.attachment] : [rate]) {
      if (part.warning && !warnings.includes(part.warning)) warnings.push(part.warning);
      if (part.error && !warnings.includes(part.error)) warnings.push(part.error);
    }
    if (rate.cost_per_hour != null) {
      machine_cost = round2(rate.cost_per_hour * hours);
    } else if (a.attachment_id) {
      // one half of the combo may still be priceable
      const ok = [rate.machine, rate.attachment].filter(p => p.cost_per_hour != null);
      machine_cost = round2(ok.reduce((s, p) => s + p.cost_per_hour * hours, 0));
    }
  }

  let operator_cost = 0;
  if (a.operator_employee_id) {
    const emp = db.prepare('SELECT hourly_rate FROM employees WHERE id = ?').get(a.operator_employee_id);
    operator_cost = round2(((emp && emp.hourly_rate) || 0) * hours);
  }

  return { activity_id: a.id, machine_cost, operator_cost, total: round2(machine_cost + operator_cost), warnings };
}

// A field's share of all non-establishment activities for a year.
// Split by link-ha (fallback: field area_ha); Σ ha = 0 → warn and skip.
function fieldActivityCost(db, fieldId, year) {
  let rows;
  try {
    rows = db.prepare(`
      SELECT a.* FROM field_activities a
        JOIN field_activity_fields f ON f.activity_id = a.id
       WHERE f.field_id = ? AND a.year = ? AND COALESCE(a.is_establishment,0) = 0
    `).all(fieldId, year);
  } catch { return { total: 0, items: [], warnings: [] }; }

  const warnings = [];
  const items = [];
  let total = 0;
  for (const a of rows) {
    const links = db.prepare(`
      SELECT COALESCE(af.ha, fi.area_ha, 0) AS ha, af.field_id
        FROM field_activity_fields af LEFT JOIN fields fi ON fi.id = af.field_id
       WHERE af.activity_id = ?
    `).all(a.id);
    const sumHa = links.reduce((s, l) => s + (l.ha || 0), 0);
    const fieldHa = (links.find(l => l.field_id === fieldId) || {}).ha || 0;

    let share;
    if (links.length === 1) {
      share = 1;
    } else if (sumHa <= 0) {
      if (!warnings.includes('multi_field_split_zero_area')) warnings.push('multi_field_split_zero_area');
      continue;
    } else {
      share = fieldHa / sumHa;
    }

    const c = activityCost(db, a);
    for (const w of c.warnings) if (!warnings.includes(w)) warnings.push(w);

    // One-place rule (v1: surfaced, not enforced): operator labour may also sit
    // in time_entries for the same person+date — warn, don't adjust.
    if (a.operator_employee_id && a.date) {
      const overlap = db.prepare(
        'SELECT 1 FROM time_entries WHERE employee_id = ? AND date = ? LIMIT 1'
      ).get(a.operator_employee_id, a.date);
      if (overlap && !warnings.includes('activity_labour_overlaps_time_entry')) {
        warnings.push('activity_labour_overlaps_time_entry');
      }
    }

    const allocated = round2(c.total * share);
    total += allocated;
    items.push({ activity_id: a.id, activity_type: a.activity_type, allocated });
  }
  return { total: round2(total), items, warnings };
}

// Cheap existence check for the opt-in exclusion flag.
function hasFieldActivities(db, fieldId, year) {
  try {
    return !!db.prepare(`
      SELECT 1 FROM field_activities a JOIN field_activity_fields f ON f.activity_id = a.id
       WHERE f.field_id = ? AND a.year = ? AND COALESCE(a.is_establishment,0) = 0 LIMIT 1
    `).get(fieldId, year);
  } catch { return false; }
}

module.exports = { activityCost, fieldActivityCost, hasFieldActivities };
