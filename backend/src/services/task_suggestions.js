// Spec 3.2 — usage-filtered task suggestions with inputs scaled to field area
// and a cost estimate (catalogue input prices + optional per-ha operation rate).
// The estimate is frozen onto tasks.estimated_cost_zar at create time.
function round2(n) { return Math.round(n * 100) / 100; }

function activeUsage(db, fieldId, dateStr) {
  const row = db.prepare(`
    SELECT usage FROM field_usage_period
     WHERE field_id = ? AND deleted_at IS NULL
       AND start_date <= ? AND (end_date IS NULL OR end_date >= ?)
     ORDER BY start_date DESC LIMIT 1
  `).get(fieldId, dateStr, dateStr);
  return row ? row.usage : null;
}

// Cost of one template at a given area: inputs (rate/ha × ha × catalogue
// price) + operation charge (unit_rate × ha). Missing prices warn, not fail.
function estimateCost(db, templateId, areaHa) {
  const t = typeof templateId === 'object'
    ? templateId
    : db.prepare('SELECT * FROM task_op_templates WHERE id = ?').get(templateId);
  if (!t) return { error: 'template_not_found', total: 0, warnings: [] };

  const area = areaHa || 0;
  const warnings = [];
  const inputs = [];
  let inputsCost = 0;

  let defaults = [];
  try { defaults = t.default_inputs_json ? JSON.parse(t.default_inputs_json) : []; }
  catch { warnings.push('default_inputs_json_invalid'); }

  for (const d of defaults) {
    const quantity = round2((d.rate_per_ha || 0) * area);
    const prod = db.prepare('SELECT cost_per_unit FROM input_products WHERE name = ?').get(d.product);
    let cost = null;
    if (prod && prod.cost_per_unit != null) {
      cost = round2(quantity * prod.cost_per_unit);
      inputsCost += cost;
    } else {
      warnings.push(`product_price_missing: ${d.product}`);
    }
    inputs.push({ product: d.product, rate_per_ha: d.rate_per_ha, unit: d.unit, quantity, cost });
  }

  const operationCost = t.default_unit_rate ? round2(t.default_unit_rate * area) : 0;

  return {
    template_id: t.id,
    area_ha: area,
    inputs,
    inputs_cost: round2(inputsCost),
    operation_cost: operationCost,
    total: round2(inputsCost + operationCost),
    warnings,
  };
}

function suggestionsForField(db, fieldId, dateStr = new Date().toISOString().slice(0, 10)) {
  const field = db.prepare('SELECT id, name, enterprise, COALESCE(area_ha,0) AS area_ha FROM fields WHERE id = ?').get(fieldId);
  if (!field) return { error: 'field_not_found' };

  const usage = activeUsage(db, fieldId, dateStr) || field.enterprise;
  if (!usage) return { field_id: fieldId, usage: null, suggestions: [] };

  const templates = db.prepare(
    'SELECT * FROM task_op_templates WHERE usage = ? ORDER BY sort_order, name'
  ).all(usage);

  const suggestions = templates.map(t => {
    const est = estimateCost(db, t, field.area_ha);
    // v1 assignee rule per spec: last person who did this op on this field.
    const last = db.prepare(`
      SELECT assigned_to FROM tasks
       WHERE field_id = ? AND template_id = ? AND assigned_to IS NOT NULL
       ORDER BY COALESCE(completed_date, due_date, created_at) DESC LIMIT 1
    `).get(fieldId, t.id);
    return {
      template_id: t.id,
      op_type: t.op_type,
      name: t.name,
      notes: t.notes,
      default_duration_hrs: t.default_duration_hrs,
      inputs: est.inputs,
      estimated_cost_zar: est.total,
      cost_warnings: est.warnings,
      suggested_assignee: last ? last.assigned_to : null,
    };
  });

  return { field_id: fieldId, usage, area_ha: field.area_ha, suggestions };
}

module.exports = { suggestionsForField, estimateCost };
