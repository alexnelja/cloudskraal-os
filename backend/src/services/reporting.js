// Spec 2h.3 — reporting rollups. allEnterprisesSummary: one row per productive
// field enterprise (variable vs fully-loaded cost/kg, price, margin) + flock
// COP rows. dataQuality: farm-wide health counters so the operator can triage
// uncategorized spend, missing yields, off-but-present layers, and warnings.
const { computeFieldCop } = require('./cop');
const { enterpriseCostSummary } = require('./cost_node_map');

function round2(n) { return Math.round(n * 100) / 100; }

const ALL_FLAGS = ['shared', 'activities', 'overhead', 'capital', 'processing'];
const NON_PRODUCTIVE = new Set(['fallow', 'grazing', 'fallow_greening']);

function allEnterprisesSummary(db, year, opts = {}) {
  const rows = db.prepare(`
    SELECT enterprise, COUNT(*) AS fields_count, SUM(COALESCE(area_ha,0)) AS area_ha
      FROM fields
     WHERE enterprise IS NOT NULL
     GROUP BY enterprise ORDER BY area_ha DESC
  `).all().filter(r => !NON_PRODUCTIVE.has(r.enterprise));

  const enterprises = [];
  for (const r of rows) {
    const variable = enterpriseCostSummary(db, r.enterprise, year, { include: [], denominator: opts.denominator });
    const loaded = enterpriseCostSummary(db, r.enterprise, year, { include: ALL_FLAGS, denominator: opts.denominator });
    enterprises.push({
      enterprise: r.enterprise,
      fields_count: r.fields_count,
      area_ha: round2(r.area_ha),
      yield_kg: loaded.total_yield_kg,
      cost_variable: variable.total_cost,
      cost_loaded: loaded.total_cost,
      cost_per_kg_variable: variable.cost_per_kg,
      cost_per_kg_loaded: loaded.cost_per_kg,
      price_per_kg: loaded.price_per_kg,
      margin_per_kg: loaded.margin_per_kg,
    });
  }

  // Livestock rows (different denominators: R/kg wool + R/kg liveweight).
  let flocks = [];
  try {
    const { computeFlockCop } = require('./livestock_cop'); // lazy require
    const groups = db.prepare('SELECT id, name FROM livestock_groups').all();
    for (const g of groups) {
      try {
        const c = computeFlockCop(db, g.id, year);
        if (!c || c.error) continue;
        flocks.push({
          flock_id: g.id,
          name: g.name,
          cost_per_kg_wool: c.cost_per_kg_wool ?? null,
          cost_per_kg_liveweight: c.cost_per_kg_liveweight ?? null,
          gross_margin_per_ewe: c.gross_margin_per_ewe ?? null,
        });
      } catch { /* flock without inputs — skip */ }
    }
  } catch { flocks = []; }

  return { year, enterprises, flocks };
}

function dataQuality(db, year) {
  const fields = db.prepare('SELECT id, name, enterprise FROM fields').all();
  const uncategorizedFields = [];
  const costedNoYield = [];
  const warningCounts = {};
  const excludedLayers = {};
  let uncategorizedTotal = 0;
  let scanned = 0;

  for (const f of fields) {
    let report;
    try { report = computeFieldCop(db, f.id, year); } catch { continue; }
    if (!report || report.error) continue;
    scanned++;

    const unc = report.totals?.uncategorized_cost || 0;
    if (unc > 0) {
      uncategorizedTotal += unc;
      uncategorizedFields.push({ field_id: f.id, name: f.name, amount: round2(unc) });
    }

    for (const line of report.lines || []) {
      for (const w of line.warnings || []) {
        warningCounts[w] = (warningCounts[w] || 0) + 1;
      }
      if (!NON_PRODUCTIVE.has(line.usage) && line.usage !== 'uncategorized'
          && line.total_cost > 0 && !(line.actual_yield_kg > 0)) {
        costedNoYield.push({ field_id: f.id, name: f.name, usage: line.usage, total_cost: line.total_cost });
      }
    }

    for (const layer of report.coverage?.excluded_layers || []) {
      excludedLayers[layer] = (excludedLayers[layer] || 0) + 1;
    }
  }

  return {
    year,
    fields_scanned: scanned,
    uncategorized: {
      total_zar: round2(uncategorizedTotal),
      fields: uncategorizedFields.sort((a, b) => b.amount - a.amount),
    },
    costed_no_yield: costedNoYield.sort((a, b) => b.total_cost - a.total_cost),
    warning_counts: warningCounts,
    excluded_layers: excludedLayers,
  };
}

module.exports = { allEnterprisesSummary, dataQuality };
