// Spec 6 — fertilizer rate: product kg/ha from a nutrient target and the
// product analysis percentage; block totals and catalogue cost.
const { round2, num, productPrice } = require('./_shared');

function computeFertilizer(inputs = {}, db = null) {
  const target = num(inputs.target_nutrient_kg_ha);
  const analysis = num(inputs.analysis_pct);
  const area = num(inputs.area_ha);
  if (!target || target <= 0) return { error: 'target_nutrient_kg_ha_required' };
  if (!analysis || analysis <= 0 || analysis > 100) return { error: 'analysis_pct_invalid' };
  if (!area || area <= 0) return { error: 'area_ha_required' };

  const warnings = [];
  const rawKgHa = target / (analysis / 100);
  const productKgHa = round2(rawKgHa);
  const totalKg = round2(rawKgHa * area);
  if (productKgHa > 1000) warnings.push(`${productKgHa} kg/ha product is unusually high — recheck the analysis %`);

  let totalCost = null;
  if (inputs.product) {
    const price = productPrice(db, inputs.product, warnings);
    if (price != null) totalCost = round2(rawKgHa * area * price);
  }

  return {
    result: { product_kg_ha: productKgHa, total_product_kg: totalKg, total_cost_zar: totalCost },
    breakdown: `${target} kg nutrient/ha ÷ ${analysis}% = ${productKgHa} kg product/ha × ${area} ha`,
    warnings,
  };
}

module.exports = { computeFertilizer };
