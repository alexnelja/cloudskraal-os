// Spec 2e.1/2e.2 — processing-centre yield + cost attribution.
function round2(n) { return Math.round(n * 100) / 100; }
function round4(n) { return Math.round(n * 10000) / 10000; }

// Mass-balance tolerance: wet_in should ≈ fresh field wet + recirculated stokke.
const MASS_BALANCE_TOLERANCE = 0.05; // 5%

function freshWet(db, batchId) {
  return db.prepare('SELECT COALESCE(SUM(wet_contributed_kg),0) AS s FROM processing_batch_sources WHERE batch_id = ?')
    .get(batchId).s;
}

function recirculatedIn(db, batchId) {
  try {
    return db.prepare('SELECT COALESCE(SUM(stokke_reintroduced_kg),0) AS s FROM processing_batch_recirculations WHERE batch_id = ?')
      .get(batchId).s;
  } catch { return 0; } // table absent (pre-2e.2 DB)
}

function stofRevenue(b) {
  return round2((b.stof_kg || 0) * (b.stof_price_zar_per_kg || 0));
}

// Weights, actual shrinkage, byproduct + recirculation accounting for one batch.
function batchYield(db, batchId) {
  const b = db.prepare('SELECT * FROM processing_batches WHERE id = ?').get(batchId);
  if (!b) return null;
  const fresh = freshWet(db, batchId);
  const recirc = recirculatedIn(db, batchId);
  const stof_rev = stofRevenue(b);
  const expectedWet = fresh + recirc;
  const mass_balance_ok = b.wet_in_kg > 0 && expectedWet > 0
    ? Math.abs(b.wet_in_kg - expectedWet) / b.wet_in_kg <= MASS_BALANCE_TOLERANCE
    : (b.wet_in_kg || 0) === expectedWet;
  return {
    wet_in: b.wet_in_kg,
    fresh_wet: round2(fresh),
    recirculated_in_kg: round2(recirc),
    dried_bruto: b.dried_bruto_kg,
    sifted_netto: b.sifted_netto_kg,
    stokke: b.stokke_kg,
    stof: b.stof_kg,
    stof_revenue: stof_rev,
    processing_cost: b.processing_cost_zar,
    net_processing_cost: round2((b.processing_cost_zar || 0) - stof_rev),
    shrinkage_actual: b.wet_in_kg > 0 ? round4(b.sifted_netto_kg / b.wet_in_kg) : null,
    mass_balance_ok,
  };
}

// A field's share of actual sifted-netto + NET processing cost across batches it
// fed (end_date in `year`). Share is by FRESH field wet (sum of sources) so
// recirculated stokke is never double-counted; sifted-netto (already boosted by
// recirculation) distributes across this batch's fresh contributors.
function fieldProcessingShare(db, fieldId, year) {
  const batches = db.prepare(`
    SELECT b.id, b.sifted_netto_kg, b.processing_cost_zar, b.stof_kg, b.stof_price_zar_per_kg,
           s.wet_contributed_kg
      FROM processing_batch_sources s
      JOIN processing_batches b ON b.id = s.batch_id
     WHERE s.field_id = ?
       AND b.end_date >= ? AND b.end_date <= ?
  `).all(fieldId, `${year}-01-01`, `${year}-12-31`);

  let siftedNetto = 0;
  let processingCost = 0;
  const out = [];
  for (const b of batches) {
    const fresh = freshWet(db, b.id);
    const share = fresh > 0 ? b.wet_contributed_kg / fresh : 0;
    const netCost = (b.processing_cost_zar || 0) - stofRevenue(b);
    const sifted = round2((b.sifted_netto_kg || 0) * share);
    const cost = round2(netCost * share);
    siftedNetto += sifted;
    processingCost += cost;
    out.push({
      batch_id: b.id,
      share: round4(share),
      wet_contributed_kg: b.wet_contributed_kg,
      sifted_netto_kg: sifted,
      processing_cost: cost,
    });
  }
  return { sifted_netto_kg: round2(siftedNetto), processing_cost: round2(processingCost), batches: out };
}

module.exports = { batchYield, fieldProcessingShare };
