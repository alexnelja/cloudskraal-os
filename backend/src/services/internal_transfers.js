// Spec 2f.2 — internal transfer reconciliation. Single source of truth for the
// at-cost value of feed/grazing moving from a crop field to a flock. Both COP
// services read through here so the two legs (flock cost IN, field credit OUT)
// are always equal and net to zero.
//
// No recursion: we always price the source field with computeFieldCop(..., {
// withTransfers: false }) — the gross COP — so this helper never re-enters the
// transfers path.

function round2(n) { return Math.round(n * 100) / 100; }

// Inclusive day count between two ISO dates.
function daysInclusive(startStr, endStr) {
  const a = new Date(startStr + 'T00:00:00Z').getTime();
  const b = new Date(endStr + 'T00:00:00Z').getTime();
  return Math.round((b - a) / 86400000) + 1;
}

// Fraction of an event's days that fall within `year`. 1.0 when fully inside.
function yearOverlapFactor(startStr, endStr, year) {
  const yStart = `${year}-01-01`;
  const yEnd = `${year}-12-31`;
  const end = endStr || yEnd; // open-ended event → treat as running to year end
  const ovStart = startStr > yStart ? startStr : yStart;
  const ovEnd = end < yEnd ? end : yEnd;
  if (ovEnd < ovStart) return 0;
  const overlap = daysInclusive(ovStart, ovEnd);
  const total = daysInclusive(startStr, end);
  if (total <= 0) return 0;
  return overlap / total;
}

// Gross COP for a field, or null/error pushed as a warning code.
function grossFieldCop(db, fieldId, year) {
  const { computeFieldCop } = require('./cop'); // lazy: break circular require
  const cop = computeFieldCop(db, fieldId, year, { withTransfers: false });
  if (!cop) return { error: 'source_field_not_found' };
  if (cop.error) return { error: 'source_field_cop_error' };
  return { cop };
}

// Grazing transfers for one flock-year. Returns rows shaped for both legs:
// { source_field_id, kind, amount, warning? }.
function grazingTransfers(db, { groupId, fieldId, year }) {
  let events;
  try {
    let sql = 'SELECT * FROM grazing_events WHERE 1=1';
    const params = [];
    if (groupId) { sql += ' AND group_id = ?'; params.push(groupId); }
    if (fieldId) { sql += ' AND field_id = ?'; params.push(fieldId); }
    events = db.prepare(sql).all(...params);
  } catch {
    return []; // table not present in this DB
  }

  const out = [];
  for (const e of events) {
    const factor = yearOverlapFactor(e.start_date, e.end_date, year);
    if (factor <= 0) continue; // event doesn't touch this year
    const res = grossFieldCop(db, e.field_id, year);
    if (res.error) {
      out.push({ source_field_id: e.field_id, flock_id: e.group_id, kind: 'grazing', amount: 0, warning: res.error });
      continue;
    }
    const amount = round2(res.cop.totals.total_cost * e.allocation_fraction * factor);
    out.push({ source_field_id: e.field_id, flock_id: e.group_id, kind: 'grazing', amount });
  }
  return out;
}

// Internal-feed transfers (at cost = qty × source field line cost_per_kg).
// Two-leg, same as grazing. Purchased feed is NOT here (no field leg) — it is
// handled in computeFlockCop as a shared-pool cost / bucket override.
function internalFeedTransfers(db, { groupId, fieldId, year }) {
  let events;
  try {
    let sql = "SELECT * FROM feeding_events WHERE source_type = 'internal' AND date >= ? AND date <= ?";
    const params = [`${year}-01-01`, `${year}-12-31`];
    if (groupId) { sql += ' AND group_id = ?'; params.push(groupId); }
    if (fieldId) { sql += ' AND source_field_id = ?'; params.push(fieldId); }
    events = db.prepare(sql).all(...params);
  } catch {
    return [];
  }

  const out = [];
  for (const e of events) {
    const base = { source_field_id: e.source_field_id, flock_id: e.group_id, kind: 'feed_internal' };
    const res = grossFieldCop(db, e.source_field_id, year);
    if (res.error) { out.push({ ...base, amount: 0, warning: res.error }); continue; }

    const cop = res.cop;
    let costPerKg = null;
    let warning = null;
    const line = e.source_usage
      ? cop.lines.find(l => l.usage === e.source_usage)
      : null;
    if (line) {
      costPerKg = line.cost_per_kg; // may be null (no yield)
    } else {
      // Fallback: field-level cost per kg of yield.
      warning = 'feed_product_line_ambiguous';
      costPerKg = cop.totals.total_yield_kg > 0
        ? cop.totals.total_cost / cop.totals.total_yield_kg : null;
    }

    if (costPerKg == null) {
      // line matched but no yield, or fallback had no field yield → can't cost
      out.push({ ...base, amount: 0, warning: 'internal_feed_uncosted' });
      continue;
    }
    const amount = round2(costPerKg * (e.quantity_kg || 0));
    out.push(warning ? { ...base, amount, warning } : { ...base, amount });
  }
  return out;
}

// Costs flowing INTO a flock (grazing + internal feed).
function transfersForFlock(db, groupId, year) {
  return [
    ...grazingTransfers(db, { groupId, year }),
    ...internalFeedTransfers(db, { groupId, year }),
  ];
}

// Credits flowing OUT of a field (same transfers, field perspective).
function transfersForField(db, fieldId, year) {
  return [
    ...grazingTransfers(db, { fieldId, year }),
    ...internalFeedTransfers(db, { fieldId, year }),
  ];
}

module.exports = { transfersForFlock, transfersForField, yearOverlapFactor };
