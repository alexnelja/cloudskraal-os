// Spec 2h.1 — cost build-up node map: transform computeFieldCop into a layered
// DAG (leaves → layer groups → total → ÷yield → cost/kg; price alongside →
// margin). Layer nodes mirror the opt-in include flags so the UI's layer
// toggles ARE the flags; off/no-data layers stay visible with hints.
const { computeFieldCop, factorChain } = require('./cop');

function round2(n) { return Math.round(n * 100) / 100; }

const NON_PRODUCTIVE = new Set(['fallow', 'grazing', 'fallow_greening']);
const UNCAT = 'uncategorized';

const LAYERS = [
  { key: 'direct_inputs', label: 'Direct inputs', flag: null },
  { key: 'labour', label: 'Labour', flag: null },
  { key: 'shared', label: 'Shared inputs', flag: 'shared',
    hint: 'Record shared (multi-field) inputs to see this layer' },
  { key: 'activities', label: 'Equipment & operations', flag: 'activities',
    hint: 'Record field activities (machine + operator hours) to see this layer' },
  { key: 'overhead', label: 'Overhead', flag: 'overhead',
    hint: 'Add overhead entries + allocation rules to see this layer' },
  { key: 'capital', label: 'Capital amortisation', flag: 'capital',
    hint: 'Record field establishment costs to see this layer' },
  { key: 'processing', label: 'Processing', flag: 'processing',
    hint: 'Track processing batches to see this layer' },
];

function targetLine(report, enterprise) {
  const lines = report.lines || [];
  const productive = lines.filter(l => !NON_PRODUCTIVE.has(l.usage) && l.usage !== UNCAT);
  return lines.find(l => l.usage === enterprise)
    || (productive.length === 1 ? productive[0] : null);
}

function layerValue(key, line, report) {
  switch (key) {
    case 'direct_inputs': return round2((line.total_input_cost || 0) + (line.total_task_input_cost || 0));
    case 'labour': return line.total_labour_cost || 0;
    case 'shared': return line.shared_input_cost;
    case 'activities': return line.activity_cost;
    case 'overhead': return line.allocated_overhead_cost;
    case 'capital': return line.capital_amortized_cost;
    case 'processing': return line.processing ? line.processing.processing_cost : undefined;
    default: return undefined;
  }
}

function layerLeaves(key, line, report) {
  const items = [];
  if (key === 'direct_inputs') {
    const byProduct = new Map();
    for (const i of line.inputs || []) {
      const name = i.product_name || 'Input';
      byProduct.set(name, (byProduct.get(name) || 0) + (i.total_cost || 0));
    }
    for (const [label, v] of byProduct) items.push({ label, value: round2(v) });
    if (line.total_task_input_cost > 0) items.push({ label: 'Task inputs', value: line.total_task_input_cost });
  } else if (key === 'labour') {
    if (line.total_labour_cost > 0) {
      items.push({ label: `Time entries (${line.total_labour_hours || 0} h)`, value: line.total_labour_cost });
    }
  } else if (key === 'shared' && report.shared_inputs) {
    for (const it of report.shared_inputs.items || []) items.push({ label: it.product || 'Shared input', value: it.allocated });
  } else if (key === 'activities' && report.activities) {
    for (const it of report.activities.items || []) items.push({ label: it.activity_type || 'Activity', value: it.allocated });
  } else if (key === 'overhead' && report.overhead) {
    for (const it of report.overhead.items || []) {
      items.push({ label: it.category || it.product || 'Overhead', value: it.allocated ?? it.amount_zar ?? it.amount });
    }
  }
  return items;
}

function buildCostNodeMap(db, fieldId, year, opts = {}) {
  const include = Array.isArray(opts.include)
    ? opts.include
    : (opts.include ? String(opts.include).split(',').map(s => s.trim()) : []);

  const report = computeFieldCop(db, fieldId, year, { include, denominator: opts.denominator });
  if (!report) return { error: 'field_not_found' };
  if (report.error) return report;

  const enterprise = report.field.enterprise;
  const line = targetLine(report, enterprise);
  if (!line) {
    return { field_id: fieldId, year, enterprise, error: 'no_productive_line',
             nodes: [], edges: [], warnings: ['no_productive_line'] };
  }

  const excluded = report.coverage.excluded_layers || [];
  const nodes = [];
  const edges = [];
  const warnings = [...(line.warnings || [])];

  let totalLoaded = line.total_cost || 0;
  for (const def of LAYERS) {
    const id = `layer:${def.key}`;
    const raw = layerValue(def.key, line, report);
    const on = !def.flag || include.includes(def.flag);
    let status, value = null;
    if (!on) {
      status = 'off';
    } else if (def.flag && !(raw > 0)) {
      status = 'no_data';
    } else {
      status = 'ok';
      value = round2(raw || 0);
      if (def.flag) totalLoaded += value;
    }
    const n = { id, kind: 'layer', layer: def.key, label: def.label, status,
                value_zar: value, include_flag: def.flag, toggleable: !!def.flag };
    if (status === 'no_data') n.hint = def.hint;
    if (status === 'off' && excluded.includes(def.flag)) n.data_exists = true;
    nodes.push(n);
    if (status === 'ok') edges.push({ source: id, target: 'total' });

    if (status === 'ok') {
      layerLeaves(def.key, line, report).forEach((leaf, i) => {
        const lid = `leaf:${def.key}:${i}`;
        nodes.push({ id: lid, kind: 'leaf', layer: def.key, label: leaf.label, value_zar: round2(leaf.value || 0) });
        edges.push({ source: lid, target: id });
      });
    }
  }
  totalLoaded = round2(totalLoaded);

  const yieldKg = line.yield_in_denominator_kg ?? line.actual_yield_kg ?? 0;
  const unitCost = yieldKg > 0 ? round2(totalLoaded / yieldKg) : null;

  nodes.push({ id: 'total', kind: 'total', label: 'Total cost', value_zar: totalLoaded });
  nodes.push({ id: 'yield', kind: 'denominator', label: `Yield (${report.coverage.denominator})`,
               value_kg: yieldKg, denominator: report.coverage.denominator });
  nodes.push({ id: 'unit_cost', kind: 'unit_cost', label: 'Cost / kg', value_zar_per_kg: unitCost });
  edges.push({ source: 'total', target: 'unit_cost' });
  edges.push({ source: 'yield', target: 'unit_cost' });

  let priceInfo = null;
  if (line.margin && line.margin.price_per_kg != null) {
    const m = line.margin;
    priceInfo = { price_per_kg: m.price_per_kg, price_basis: m.price_basis,
                  yield_at_price_basis_kg: m.yield_at_price_basis_kg };
    nodes.push({ id: 'price', kind: 'price', label: `Price (${m.price_basis})`,
                 value_zar_per_kg: m.price_per_kg, price_basis: m.price_basis });
    let marginLoaded = null;
    if (m.yield_at_price_basis_kg > 0) {
      marginLoaded = round2(m.price_per_kg - totalLoaded / m.yield_at_price_basis_kg);
    }
    nodes.push({ id: 'margin', kind: 'margin', label: 'Margin / kg', value_zar_per_kg: marginLoaded });
    edges.push({ source: 'price', target: 'margin' });
    edges.push({ source: 'unit_cost', target: 'margin' });
  }

  return {
    field_id: fieldId,
    year,
    enterprise,
    usage: line.usage,
    denominator: report.coverage.denominator,
    nodes,
    edges,
    summary: {
      total_direct: line.total_cost,
      total_loaded: totalLoaded,
      yield_kg: yieldKg,
      cost_per_kg_direct: yieldKg > 0 ? round2((line.total_cost || 0) / yieldKg) : null,
      cost_per_kg_loaded: unitCost,
      price_per_kg: priceInfo ? priceInfo.price_per_kg : null,
      price_basis: priceInfo ? priceInfo.price_basis : null,
      yield_at_price_basis_kg: priceInfo ? priceInfo.yield_at_price_basis_kg : null,
      enabled_layers: nodes.filter(n => n.kind === 'layer' && n.status === 'ok').map(n => n.layer),
    },
    warnings,
  };
}

// Farm-scope aggregation: weighted Cloudskraal-average R/kg for an enterprise
// (Σ loaded cost ÷ Σ yield over all of the enterprise's fields).
function enterpriseCostSummary(db, enterprise, year, opts = {}) {
  const include = Array.isArray(opts.include)
    ? opts.include
    : (opts.include ? String(opts.include).split(',').map(s => s.trim()) : []);
  const fields = db.prepare('SELECT id, name FROM fields WHERE enterprise = ?').all(enterprise);

  const perField = [];
  let totalCost = 0;
  let totalYield = 0;
  for (const f of fields) {
    const report = computeFieldCop(db, f.id, year, { include, denominator: opts.denominator });
    if (!report || report.error) continue;
    const line = targetLine(report, enterprise);
    if (!line) continue;
    let loaded = line.total_cost || 0;
    for (const k of ['shared_input_cost', 'activity_cost', 'allocated_overhead_cost', 'capital_amortized_cost']) {
      loaded += line[k] || 0;
    }
    if (line.processing) loaded += line.processing.processing_cost || 0;
    loaded = round2(loaded);
    const kg = line.yield_in_denominator_kg ?? line.actual_yield_kg ?? 0;
    if (loaded === 0 && kg === 0) continue;
    totalCost += loaded;
    totalYield += kg;
    perField.push({
      field_id: f.id, name: f.name,
      total_cost: loaded, yield_kg: kg,
      cost_per_kg: kg > 0 ? round2(loaded / kg) : null,
    });
  }
  totalCost = round2(totalCost);
  totalYield = round2(totalYield);
  const costPerKg = totalYield > 0 ? round2(totalCost / totalYield) : null;

  // Price at the enterprise's sale basis, converted onto the yield base so the
  // farm margin compares like-for-like (identity when bases match).
  let pricePerKg = null;
  let marginPerKg = null;
  try {
    const p = db.prepare('SELECT price_per_kg, price_basis FROM enterprise_prices WHERE enterprise = ? AND year = ?')
      .get(enterprise, year);
    if (p && p.price_per_kg != null) {
      pricePerKg = p.price_per_kg;
      if (costPerKg != null && p.price_basis) {
        const chain = factorChain(db, 'harvest_wet_kg', p.price_basis, enterprise, `${year}-12-31`);
        if (!chain.error) {
          const yieldAtBasis = totalYield * chain.factor;
          if (yieldAtBasis > 0) marginPerKg = round2(p.price_per_kg - totalCost / yieldAtBasis);
        }
      }
    }
  } catch { /* prices not set up — margin unavailable */ }

  return {
    enterprise, year, include,
    total_cost: totalCost,
    total_yield_kg: totalYield,
    cost_per_kg: costPerKg,
    price_per_kg: pricePerKg,
    margin_per_kg: marginPerKg,
    fields: perField,
  };
}

module.exports = { buildCostNodeMap, enterpriseCostSummary };
