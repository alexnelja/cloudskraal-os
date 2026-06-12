// Spec 6 — pest dose: label rate × area (per-ha basis) or rate × total spray
// water ÷ 100 (per-100L basis). Cost via the input_products catalogue.
const { round2, num, productPrice } = require('./_shared');

function computePestDose(inputs = {}, db = null) {
  const rate = num(inputs.rate_value);
  const area = num(inputs.area_ha);
  const basis = inputs.rate_basis; // 'g_per_ha' | 'ml_per_ha' | 'g_per_100l' | 'ml_per_100l'
  if (!rate || rate <= 0) return { error: 'rate_value_required' };
  if (!area || area <= 0) return { error: 'area_ha_required' };

  const warnings = [];
  let totalChemical;     // in the rate's own unit (g or ml)
  let totalWater = null;

  if (basis === 'g_per_ha' || basis === 'ml_per_ha') {
    totalChemical = round2(rate * area);
  } else if (basis === 'g_per_100l' || basis === 'ml_per_100l') {
    const volume = num(inputs.spray_volume_l_ha);
    if (!volume || volume <= 0) return { error: 'spray_volume_l_ha_required_for_per_100l_basis' };
    totalWater = round2(volume * area);
    totalChemical = round2((rate * totalWater) / 100);
  } else {
    return { error: 'rate_basis_invalid' };
  }

  let totalCost = null;
  if (inputs.product) {
    const price = productPrice(db, inputs.product, warnings);
    if (price != null) totalCost = round2(totalChemical * price);
  }

  return {
    result: {
      total_chemical: totalChemical,
      unit: basis.startsWith('g') ? 'g' : 'ml',
      total_water_l: totalWater,
      total_cost_zar: totalCost,
    },
    breakdown: basis.endsWith('_per_ha')
      ? `${rate} × ${area} ha = ${totalChemical}`
      : `${rate}/100 L × ${totalWater} L water = ${totalChemical}`,
    warnings,
  };
}

module.exports = { computePestDose };
