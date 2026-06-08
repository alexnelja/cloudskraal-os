// Spec 2f.2 — Livestock COP compute.
// Slice A: basic flock COP from flock_cop_inputs with hybrid income-share
// allocation (shearing 100% → wool, remaining shared cost split by gross-income
// share). Grazing/feed transfers (slices B/C) extend `shared_pool` and
// `transfers_in` later; A leaves them empty.

function round2(n) { return Math.round(n * 100) / 100; }

function computeFlockCop(db, groupId, year) {
  const inputs = db.prepare(
    'SELECT * FROM flock_cop_inputs WHERE group_id = ? AND year = ?'
  ).get(groupId, year);
  if (!inputs) return null;

  const group = db.prepare('SELECT head_count FROM livestock_groups WHERE id = ?').get(groupId);
  const headCount = group ? group.head_count : null;

  const warnings = [];
  const n = (v) => (v == null ? 0 : v);

  // Cost buckets. shearing is allocated 100% to wool; everything else is the
  // shared pool, split by income share. Grazing/feed transfers (slices B/C)
  // enter the shared pool too.
  const shearing = n(inputs.shearing_cost);

  // Feed source rule: itemised purchased feeding_events are authoritative; the
  // annual feed_cost bucket is a fallback. (Internal feed is a transfer, below.)
  let effectiveFeed = n(inputs.feed_cost);
  let purchasedRows = [];
  try {
    purchasedRows = db.prepare(
      "SELECT quantity_kg, unit_cost_zar FROM feeding_events WHERE group_id = ? AND source_type = 'purchased' AND date >= ? AND date <= ?"
    ).all(groupId, `${year}-01-01`, `${year}-12-31`);
  } catch { purchasedRows = []; } // table absent
  if (purchasedRows.length > 0) {
    effectiveFeed = purchasedRows.reduce((s, r) => s + n(r.quantity_kg) * n(r.unit_cost_zar), 0);
    warnings.push('feed_bucket_overridden_by_events');
  }

  let sharedPool = effectiveFeed + n(inputs.labour_cost)
    + n(inputs.animal_health_cost) + n(inputs.other_direct_cost);

  // Internal transfers IN (grazing-share, internal feed) — at cost, additive.
  const { transfersForFlock } = require('./internal_transfers');
  const transfersIn = transfersForFlock(db, groupId, year);
  for (const t of transfersIn) {
    sharedPool += t.amount;
    if (t.warning && !warnings.includes(t.warning)) warnings.push(t.warning);
  }

  const totalCost = shearing + sharedPool;

  // Income split (annual; one ratio applied to all costs).
  const woolIncome = n(inputs.wool_income);
  const meatIncome = n(inputs.meat_income);
  const incomeBase = woolIncome + meatIncome;
  let woolShare = null;
  if (incomeBase > 0) {
    woolShare = woolIncome / incomeBase;
  } else {
    warnings.push('no_income_cannot_split');
  }

  // Hybrid allocation.
  let woolAllocated = null;
  let meatAllocated = null;
  if (woolShare !== null) {
    woolAllocated = round2(shearing + woolShare * sharedPool);
    meatAllocated = round2((1 - woolShare) * sharedPool);
  }

  // Wool denominator: clean kg = greasy/head × head × yield%.
  let cleanWoolKg = null;
  if (inputs.greasy_fleece_kg_per_head != null
      && inputs.clean_yield_pct != null
      && headCount != null && headCount > 0) {
    cleanWoolKg = round2(
      inputs.greasy_fleece_kg_per_head * headCount * (inputs.clean_yield_pct / 100)
    );
  } else {
    warnings.push('wool_denominator_incomplete');
  }

  const liveweightSold = inputs.liveweight_sold_kg_total;
  if (liveweightSold == null || liveweightSold <= 0) {
    warnings.push('no_liveweight_sold');
  }

  const costPerKgWool = (woolAllocated != null && cleanWoolKg != null && cleanWoolKg > 0)
    ? round2(woolAllocated / cleanWoolKg) : null;
  const costPerKgLiveweight = (meatAllocated != null && liveweightSold > 0)
    ? round2(meatAllocated / liveweightSold) : null;

  const grossMargin = round2(incomeBase - totalCost);
  const grossMarginPerEwe = inputs.ewes_mated
    ? round2(grossMargin / inputs.ewes_mated) : null;

  return {
    group_id: groupId,
    year,
    head_count: headCount,
    source: inputs.source,
    costs: {
      feed: round2(effectiveFeed),
      labour: round2(n(inputs.labour_cost)),
      animal_health: round2(n(inputs.animal_health_cost)),
      shearing: round2(shearing),
      other: round2(n(inputs.other_direct_cost)),
      total: round2(totalCost),
    },
    income: {
      wool: round2(woolIncome),
      meat: round2(meatIncome),
      wool_share: woolShare === null ? null : round2(woolShare),
    },
    allocation: { wool: woolAllocated, meat: meatAllocated },
    denominators: {
      clean_wool_kg: cleanWoolKg,
      liveweight_sold_kg: liveweightSold == null ? null : round2(liveweightSold),
    },
    cost_per_kg_wool: costPerKgWool,
    cost_per_kg_liveweight: costPerKgLiveweight,
    transfers_in: transfersIn,
    gross_margin: grossMargin,
    gross_margin_per_ewe: grossMarginPerEwe,
    warnings,
  };
}

module.exports = { computeFlockCop };
