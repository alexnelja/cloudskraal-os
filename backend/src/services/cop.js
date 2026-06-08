function usageOnDate(db, fieldId, dateStr) {
  const row = db.prepare(`
    SELECT id AS period_id, usage
      FROM field_usage_period
     WHERE field_id = ?
       AND deleted_at IS NULL
       AND start_date <= ?
       AND (end_date IS NULL OR end_date >= ?)
     ORDER BY start_date DESC
     LIMIT 1
  `).get(fieldId, dateStr, dateStr);
  return row ? { usage: row.usage, period_id: row.period_id } : null;
}

function periodsOverlappingYear(db, fieldId, year) {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  return db.prepare(`
    SELECT id, usage, start_date, end_date, planted_date, source
      FROM field_usage_period
     WHERE field_id = ?
       AND deleted_at IS NULL
       AND start_date <= ?
       AND (end_date IS NULL OR end_date >= ?)
     ORDER BY start_date ASC
  `).all(fieldId, yearEnd, yearStart);
}

module.exports = { usageOnDate, periodsOverlappingYear };

const UNCAT = 'uncategorized';
const NON_PRODUCTIVE = new Set(['fallow', 'grazing', 'fallow_greening']);

const COVERAGE = {
  excludes: ['overhead', 'capital_amortization', 'processing', 'wet_to_dry_shrinkage'],
  denominator: 'raw_harvest_kg',
  notes: 'Field-level direct variable costs only. See future specs 2b–2h for full COP.',
};

function emptyLine(usage, area_ha) {
  return {
    usage,
    period_ids: [],
    inputs: [],
    task_inputs: [],
    labour: [],
    production: [],
    total_input_cost: 0,
    total_task_input_cost: 0,
    total_labour_cost: 0,
    total_labour_hours: 0,
    total_cost: 0,
    area_ha,
    cost_per_ha: 0,
    estimated_yield_kg: 0,
    actual_yield_kg: 0,
    yield_per_ha: 0,
    cost_per_kg: null,
    warnings: [],
  };
}

function round2(n) { return Math.round(n * 100) / 100; }

function computeFieldCop(db, fieldId, year, opts = {}) {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const field = db.prepare(`
    SELECT fi.*, f.name AS farm_name
      FROM fields fi
      LEFT JOIN farms f ON f.id = fi.farm_id
     WHERE fi.id = ?
  `).get(fieldId);
  if (!field) return null;

  const area_ha = field.area_ha || 1;

  const denominatorOpt = opts.denominator;
  const asOf = `${year}-12-31`;
  const factorsUsed = [];

  const periods = periodsOverlappingYear(db, fieldId, year);
  const linesByUsage = new Map();
  for (const p of periods) {
    if (!linesByUsage.has(p.usage)) linesByUsage.set(p.usage, emptyLine(p.usage, area_ha));
    linesByUsage.get(p.usage).period_ids.push(p.id);
  }

  function getOrCreateLine(usage) {
    if (!linesByUsage.has(usage)) linesByUsage.set(usage, emptyLine(usage, area_ha));
    return linesByUsage.get(usage);
  }

  const inputs = db.prepare(`
    SELECT t.*, p.name AS product_name, p.category, p.unit_of_measure
      FROM inventory_transactions t
      LEFT JOIN input_products p ON p.id = t.product_id
     WHERE t.field_id = ?
       AND t.type = 'usage'
       AND t.cost_category = 'direct_variable'
       AND t.date >= ? AND t.date <= ?
     ORDER BY t.date DESC
  `).all(fieldId, yearStart, yearEnd);
  for (const i of inputs) {
    const hit = usageOnDate(db, fieldId, i.date);
    const usage = hit?.usage ?? UNCAT;
    const line = getOrCreateLine(usage);
    line.inputs.push(i);
    line.total_input_cost += i.total_cost || 0;
  }

  const taskInputs = db.prepare(`
    SELECT ti.*, t.title AS task_title, t.due_date, t.completed_date, t.status AS task_status
      FROM task_inputs ti
      JOIN tasks t ON t.id = ti.task_id
     WHERE t.field_id = ?
       AND (
         (t.completed_date IS NOT NULL AND t.completed_date >= ? AND t.completed_date <= ?)
         OR (t.completed_date IS NULL AND t.due_date IS NOT NULL AND t.due_date >= ? AND t.due_date <= ?)
       )
     ORDER BY COALESCE(t.completed_date, t.due_date) DESC
  `).all(fieldId, yearStart, yearEnd, yearStart, yearEnd);
  for (const ti of taskInputs) {
    const d = ti.completed_date || ti.due_date;
    if (!d) continue;
    const hit = usageOnDate(db, fieldId, d);
    const usage = hit?.usage ?? UNCAT;
    const line = getOrCreateLine(usage);
    line.task_inputs.push(ti);
    line.total_task_input_cost += ti.total_cost || 0;
  }

  const labour = db.prepare(`
    SELECT te.*, e.name AS employee_name, e.role AS employee_role,
           e.hourly_rate, e.monthly_salary
      FROM time_entries te
      LEFT JOIN employees e ON e.id = te.employee_id
     WHERE te.field_id = ?
       AND te.cost_category = 'direct_variable'
       AND te.date >= ? AND te.date <= ?
     ORDER BY te.date DESC
  `).all(fieldId, yearStart, yearEnd);
  for (const te of labour) {
    const hit = usageOnDate(db, fieldId, te.date);
    const usage = hit?.usage ?? UNCAT;
    const line = getOrCreateLine(usage);
    line.labour.push(te);
    const hours = te.hours_worked || 0;
    const cost = te.hourly_rate
      ? hours * te.hourly_rate
      : (te.monthly_salary ? hours * (te.monthly_salary / 176) : 0);
    line.total_labour_cost += cost;
    line.total_labour_hours += hours;
  }

  const production = db.prepare(`
    SELECT * FROM field_production WHERE field_id = ? AND year = ?
  `).all(fieldId, year);
  for (const yrow of production) {
    let usage, addFallback = false;
    if (yrow.harvest_date) {
      const hit = usageOnDate(db, fieldId, yrow.harvest_date);
      usage = hit?.usage ?? UNCAT;
    } else {
      const hit = usageOnDate(db, fieldId, `${year}-06-30`);
      usage = hit?.usage ?? UNCAT;
      addFallback = true;
    }
    const line = getOrCreateLine(usage);
    line.production.push(yrow);
    line.estimated_yield_kg += yrow.estimated_yield_kg || 0;
    line.actual_yield_kg += yrow.actual_yield_kg || 0;
    if (addFallback && !line.warnings.includes('harvest_date_missing_fallback_applied')) {
      line.warnings.push('harvest_date_missing_fallback_applied');
    }
  }

  const lines = [];
  for (const line of linesByUsage.values()) {
    let denomFactor = 1;
    if (denominatorOpt && !NON_PRODUCTIVE.has(line.usage)) {
      const denomTarget = resolveDenominator(line.usage, denominatorOpt);
      if (denomTarget && denomTarget !== 'harvest_wet_kg') {
        const chain = factorChain(db, 'harvest_wet_kg', denomTarget, line.usage, asOf);
        if (chain.error) {
          return { error: chain.error, missing_edge: chain.missing_edge, context: line.usage };
        }
        denomFactor = chain.factor;
        for (const edge of chain.path) factorsUsed.push(edge);
      }
    }

    line.total_cost = round2(line.total_input_cost + line.total_task_input_cost + line.total_labour_cost);
    line.total_input_cost = round2(line.total_input_cost);
    line.total_task_input_cost = round2(line.total_task_input_cost);
    line.total_labour_cost = round2(line.total_labour_cost);
    line.total_labour_hours = Math.round(line.total_labour_hours * 10) / 10;
    line.cost_per_ha = round2(line.total_cost / area_ha);
    line.yield_per_ha = round2(line.actual_yield_kg / area_ha);
    line.cost_per_kg = line.actual_yield_kg > 0 ? round2(line.total_cost / line.actual_yield_kg) : null;
    line.estimated_yield_kg = round2(line.estimated_yield_kg);
    line.actual_yield_kg = round2(line.actual_yield_kg);
    line.yield_in_denominator_kg = round2(line.actual_yield_kg * denomFactor);
    if (denomFactor !== 1) {
      line.cost_per_kg = line.yield_in_denominator_kg > 0
        ? round2(line.total_cost / line.yield_in_denominator_kg) : null;
      line.yield_per_ha = round2(line.yield_in_denominator_kg / area_ha);
    }
    if (line.usage === UNCAT && line.total_cost === 0
        && line.estimated_yield_kg === 0 && line.actual_yield_kg === 0) continue;

    // Margin: only meaningful for productive enterprise usages. Non-productive
    // and uncategorized lines never have a sale price, so margin is null
    // silently (no warning noise).
    if (NON_PRODUCTIVE.has(line.usage) || line.usage === UNCAT) {
      line.margin = null;
    } else {
      const m = computeLineMargin(db, {
        enterprise: line.usage,
        year,
        totalCost: line.total_cost,
        actualYieldKg: line.actual_yield_kg,
        areaHa: area_ha,
        asOf,
      });
      line.margin = m.margin;
      for (const w of m.warnings) {
        if (!line.warnings.includes(w)) line.warnings.push(w);
      }
    }

    lines.push(line);
  }

  const totals = {
    total_cost: round2(lines.reduce((s, l) => s + l.total_cost, 0)),
    total_yield_kg: round2(lines.reduce((s, l) => s + l.actual_yield_kg, 0)),
    uncategorized_cost: round2(
      lines.filter(l => l.usage === UNCAT).reduce((s, l) => s + l.total_cost, 0)
    ),
  };

  const rotation = computeFieldRotation(db, field);

  const coverage = { ...COVERAGE };
  if (denominatorOpt) {
    const seen = new Set();
    coverage.factors_used = [];
    for (const e of factorsUsed) {
      const key = `${e.from_uom}|${e.to_uom}|${e.context}|${e.factor}`;
      if (seen.has(key)) continue;
      seen.add(key);
      coverage.factors_used.push(e);
    }
    const targets = new Set(
      lines.filter(l => !NON_PRODUCTIVE.has(l.usage))
           .map(l => resolveDenominator(l.usage, denominatorOpt) || 'harvest_wet_kg')
    );
    coverage.denominator = targets.size === 1 ? [...targets][0] : 'mixed';
  }

  const report = { field_id: fieldId, year, field, lines, totals, rotation, coverage };

  // Opt-in internal-transfer credit line (Spec 2f.2). Default off → existing
  // callers and numbers unchanged. transfersForField prices against this field's
  // GROSS COP (withTransfers:false), so there is no recursion back into here.
  if (opts.withTransfers) {
    const { transfersForField } = require('./internal_transfers'); // lazy: break circular require
    const items = transfersForField(db, fieldId, year)
      .map(t => ({ flock_id: t.flock_id, kind: t.kind, amount: t.amount }));
    const creditTotal = round2(items.reduce((s, t) => s + t.amount, 0));
    report.internal_transfers = { credit_total: creditTotal, items };
    report.totals.net_cost_after_transfers = round2(totals.total_cost - creditTotal);
  }

  return report;
}

function computeFieldRotation(db, field) {
  if (field.enterprise !== 'rooibos' || !field.planted_year) return null;
  const plantedYear = parseInt(field.planted_year);
  const currentYear = new Date().getUTCFullYear();
  const rotationYear = currentYear - plantedYear;

  const latestStand = db.prepare(
    'SELECT stand_pct, year FROM field_production WHERE field_id = ? AND stand_pct IS NOT NULL ORDER BY year DESC LIMIT 1'
  ).get(field.id);
  const standTrend = db.prepare(
    'SELECT year, stand_pct FROM field_production WHERE field_id = ? AND stand_pct IS NOT NULL ORDER BY year DESC LIMIT 5'
  ).all(field.id).reverse();
  const currentStand = latestStand ? latestStand.stand_pct : null;

  let replant_status = 'ok';
  let replant_message = null;
  if (currentStand !== null) {
    if (currentStand < 50) {
      replant_status = 'must_replant';
      replant_message = `Stand at ${currentStand}% — below 50%, must replant`;
    } else if (rotationYear >= 5 && currentStand > 70) {
      replant_status = 'can_delay';
      replant_message = `Year ${rotationYear}, stand still ${currentStand}% — can delay replant 1 year`;
    } else if (rotationYear >= 5) {
      replant_status = 'must_replant';
      replant_message = `Year ${rotationYear}, stand at ${currentStand}% — schedule replant`;
    } else if (currentStand < 60) {
      replant_status = 'warning';
      replant_message = `Stand declining to ${currentStand}% at year ${rotationYear}`;
    }
  }

  let phase = 'production';
  if (rotationYear === 0) phase = 'establishment';
  else if (rotationYear === 1) phase = 'topping';
  else if (rotationYear >= 5 && replant_status === 'must_replant') phase = 'end_of_life';

  return {
    planted_year: plantedYear,
    rotation_year: rotationYear,
    phase,
    current_stand_pct: currentStand,
    stand_trend: standTrend,
    replant_status,
    replant_message,
  };
}

module.exports.computeFieldCop = computeFieldCop;
module.exports.computeFieldRotation = computeFieldRotation;

// TIER_MAPS is hardcoded here for now. Specs 2f (sheep) and 2g (wine) extend it.
// If a fourth crop type lands (almonds, olives, buchu) reconsider moving this
// to a DB table so new tiers don't require a code change + deploy.
const TIER_MAPS = {
  rooibos: {
    harvest: 'harvest_wet_kg',
    dried: 'dried_kg',
    netto_dry: 'sifted_netto_dry_kg',
  },
  wine: {
    grape: 'grape_kg',
    wine_litres: 'wine_litres',
    bottle: 'bottle_750ml',
  },
};

function resolveDenominator(usage, denominator) {
  if (!denominator) return null;
  const tierMap = TIER_MAPS[usage] ?? {};
  if (tierMap[denominator]) return tierMap[denominator];
  return denominator;
}

module.exports.resolveDenominator = resolveDenominator;
module.exports.TIER_MAPS = TIER_MAPS;

function factorChain(db, fromUom, toUom, context, asOf) {
  if (fromUom === toUom) return { factor: 1, path: [] };

  // For each (from, to) in this context with effective_from <= asOf, pick the
  // row with the latest effective_from (MAX).
  const edges = db.prepare(`
    SELECT from_uom, to_uom, context,
           (SELECT factor FROM conversion_factors c2
             WHERE c2.from_uom = c1.from_uom AND c2.to_uom = c1.to_uom
               AND c2.context = c1.context AND c2.effective_from <= ?
             ORDER BY c2.effective_from DESC LIMIT 1) AS factor
      FROM conversion_factors c1
     WHERE c1.context = ? AND c1.effective_from <= ?
     GROUP BY from_uom, to_uom, context
  `).all(asOf, context, asOf);

  // Build adjacency
  const adj = new Map();
  for (const e of edges) {
    if (e.factor == null) continue;
    if (!adj.has(e.from_uom)) adj.set(e.from_uom, []);
    adj.get(e.from_uom).push(e);
  }

  // BFS
  const visited = new Set([fromUom]);
  const parents = new Map();
  const queue = [fromUom];
  let found = false;
  while (queue.length) {
    const node = queue.shift();
    if (node === toUom) { found = true; break; }
    for (const edge of adj.get(node) ?? []) {
      if (!visited.has(edge.to_uom)) {
        visited.add(edge.to_uom);
        parents.set(edge.to_uom, edge);
        queue.push(edge.to_uom);
      }
    }
  }

  if (!found) {
    return { error: 'factor_missing', missing_edge: `${fromUom} → ${toUom}`, context };
  }

  const path = [];
  let node = toUom;
  while (node !== fromUom) {
    const edge = parents.get(node);
    path.unshift({ from_uom: edge.from_uom, to_uom: edge.to_uom, factor: edge.factor, context: edge.context });
    node = edge.from_uom;
  }

  const factor = path.reduce((acc, e) => acc * e.factor, 1);
  return { factor, path };
}

module.exports.factorChain = factorChain;

// COP yields (field_production.actual_yield_kg) are recorded as harvest-wet kg —
// the same base the denominator logic converts from.
const YIELD_BASE_UOM = 'harvest_wet_kg';

// Compute per-line margin by aligning COP cost (harvest-wet basis) to the basis
// the sale price is quoted on. Returns { margin, warnings }:
//   - no price row for (enterprise, year) → { margin: null, warnings: ['no_price_for_year'] }
//   - price row without a basis           → { margin: null, warnings: ['price_basis_missing'] }
//   - basis unreachable in the factor graph → margin object with null metrics +
//     ['margin_basis_unconvertible: <from> → <to>']
//   - zero yield → per-kg metrics null, totals reflect the cost as a loss + ['no_yield']
function computeLineMargin(db, { enterprise, year, totalCost, actualYieldKg, areaHa, asOf }) {
  let price;
  try {
    price = db.prepare(`
      SELECT price_per_kg, price_basis
        FROM enterprise_prices
       WHERE enterprise = ? AND year = ?
    `).get(enterprise, year);
  } catch {
    // Prices not set up in this DB — margin is simply unavailable, not an error.
    return { margin: null, warnings: [] };
  }

  if (!price) return { margin: null, warnings: ['no_price_for_year'] };
  if (!price.price_basis) return { margin: null, warnings: ['price_basis_missing'] };

  const margin = {
    enterprise,
    year,
    price_per_kg: price.price_per_kg,
    price_basis: price.price_basis,
    yield_at_price_basis_kg: null,
    cost_per_kg_at_price_basis: null,
    margin_per_kg: null,
    gross_revenue: null,
    margin_total: null,
    margin_per_ha: null,
    margin_pct: null,
  };

  const chain = factorChain(db, YIELD_BASE_UOM, price.price_basis, enterprise, asOf);
  if (chain.error) {
    return {
      margin,
      warnings: [`margin_basis_unconvertible: ${YIELD_BASE_UOM} → ${price.price_basis}`],
    };
  }

  const yieldAtBasis = actualYieldKg * chain.factor;
  const area = areaHa || 1;
  const warnings = [];

  margin.yield_at_price_basis_kg = round2(yieldAtBasis);
  margin.gross_revenue = round2(price.price_per_kg * yieldAtBasis);
  margin.margin_total = round2(margin.gross_revenue - totalCost);
  margin.margin_per_ha = round2(margin.margin_total / area);

  if (yieldAtBasis > 0) {
    margin.cost_per_kg_at_price_basis = round2(totalCost / yieldAtBasis);
    margin.margin_per_kg = round2(price.price_per_kg - totalCost / yieldAtBasis);
    margin.margin_pct = margin.gross_revenue > 0
      ? round2((margin.margin_total / margin.gross_revenue) * 100)
      : null;
  } else {
    warnings.push('no_yield');
  }

  return { margin, warnings };
}

module.exports.computeLineMargin = computeLineMargin;
