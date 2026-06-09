// Spec 2e.1 — processing-centre yield + cost attribution.
function round2(n) { return Math.round(n * 100) / 100; }
function round4(n) { return Math.round(n * 10000) / 10000; }

// Weights + actual shrinkage for a single batch.
function batchYield(db, batchId) {
  const b = db.prepare('SELECT * FROM processing_batches WHERE id = ?').get(batchId);
  if (!b) return null;
  return {
    wet_in: b.wet_in_kg,
    dried_bruto: b.dried_bruto_kg,
    sifted_netto: b.sifted_netto_kg,
    stokke: b.stokke_kg,
    stof: b.stof_kg,
    shrinkage_actual: b.wet_in_kg > 0 ? round4(b.sifted_netto_kg / b.wet_in_kg) : null,
  };
}

// A field's share of the actual sifted-netto output and processing cost across
// every batch (end_date in `year`) it contributed wet harvest to. Share is by
// wet contribution: field wet ÷ batch wet_in.
function fieldProcessingShare(db, fieldId, year) {
  const rows = db.prepare(`
    SELECT s.wet_contributed_kg, b.id AS batch_id, b.wet_in_kg, b.sifted_netto_kg, b.processing_cost_zar
      FROM processing_batch_sources s
      JOIN processing_batches b ON b.id = s.batch_id
     WHERE s.field_id = ?
       AND b.end_date >= ? AND b.end_date <= ?
  `).all(fieldId, `${year}-01-01`, `${year}-12-31`);

  let siftedNetto = 0;
  let processingCost = 0;
  const batches = [];
  for (const r of rows) {
    const share = r.wet_in_kg > 0 ? r.wet_contributed_kg / r.wet_in_kg : 0;
    const sifted = round2((r.sifted_netto_kg || 0) * share);
    const cost = round2((r.processing_cost_zar || 0) * share);
    siftedNetto += sifted;
    processingCost += cost;
    batches.push({
      batch_id: r.batch_id,
      share: round4(share),
      wet_contributed_kg: r.wet_contributed_kg,
      sifted_netto_kg: sifted,
      processing_cost: cost,
    });
  }
  return { sifted_netto_kg: round2(siftedNetto), processing_cost: round2(processingCost), batches };
}

module.exports = { batchYield, fieldProcessingShare };
