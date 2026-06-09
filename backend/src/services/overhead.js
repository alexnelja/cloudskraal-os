// Spec 2d — overhead allocation. Allocates each year's overhead_entries to a
// field by the method in overhead_allocation_rules (default per_ha).
function round2(n) { return Math.round(n * 100) / 100; }

// Real fields only (exclude the farm_boundary polygon) for area/revenue shares.
function fieldsForShare(db) {
  return db.prepare(
    "SELECT id, enterprise, COALESCE(area_ha,0) AS area_ha FROM fields WHERE enterprise != 'farm_boundary'"
  ).all();
}

// Per-field gross revenue for revenue_share. computeFieldCop is called WITHOUT
// include (margin is always-on), so this never re-enters overhead.
function grossRevenueByField(db, year) {
  const { computeFieldCop } = require('./cop'); // lazy: avoid circular require
  const map = new Map();
  for (const f of fieldsForShare(db)) {
    const cop = computeFieldCop(db, f.id, year);
    let gross = 0;
    if (cop && cop.lines) {
      for (const l of cop.lines) gross += (l.margin && l.margin.gross_revenue) || 0;
    }
    map.set(f.id, gross);
  }
  return map;
}

function allocatedOverhead(db, fieldId, year) {
  const field = db.prepare('SELECT id, enterprise, COALESCE(area_ha,0) AS area_ha FROM fields WHERE id = ?').get(fieldId);
  if (!field) return { total: 0, items: [] };

  let entries;
  try {
    entries = db.prepare('SELECT * FROM overhead_entries WHERE year = ?').all(year);
  } catch { return { total: 0, items: [] }; }
  if (!entries.length) return { total: 0, items: [] };

  const ruleFor = (cat) =>
    db.prepare('SELECT * FROM overhead_allocation_rules WHERE category = ? LIMIT 1').get(cat);

  const allFields = fieldsForShare(db);
  const totalArea = allFields.reduce((s, f) => s + f.area_ha, 0);
  let revByField = null; // lazily computed only if a revenue_share rule is hit

  const items = [];
  let total = 0;
  for (const e of entries) {
    const rule = ruleFor(e.category);
    const method = rule ? rule.method : 'per_ha';
    let factor = 0;

    if (method === 'per_enterprise') {
      const params = rule && rule.key_params ? JSON.parse(rule.key_params) : {};
      if (field.enterprise === params.enterprise) {
        const entArea = allFields.filter(f => f.enterprise === params.enterprise)
          .reduce((s, f) => s + f.area_ha, 0);
        factor = entArea > 0 ? field.area_ha / entArea : 0;
      }
    } else if (method === 'revenue_share') {
      if (!revByField) revByField = grossRevenueByField(db, year);
      const totalRev = [...revByField.values()].reduce((s, v) => s + v, 0);
      factor = totalRev > 0 ? (revByField.get(fieldId) || 0) / totalRev : 0;
    } else { // per_ha (default)
      factor = totalArea > 0 ? field.area_ha / totalArea : 0;
    }

    const allocated = round2(e.amount_zar * factor);
    total += allocated;
    items.push({ category: e.category, method, amount: e.amount_zar, factor: round2(factor * 10000) / 10000, allocated });
  }
  return { total: round2(total), items };
}

module.exports = { allocatedOverhead };
