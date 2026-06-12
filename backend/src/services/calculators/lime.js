// Spec 6 — lime requirement GUIDE: t/ha ≈ ΔpH × CEC × 0.75 × texture factor.
// A first-pass field heuristic, not a recommendation — soil-lab/agronomist
// confirmation is always advised (the result carries that warning).
const { round2, num, productPrice } = require('./_shared');

const TEXTURE_FACTORS = { sand: 0.75, loam: 1.0, clay: 1.25 };

function computeLime(inputs = {}, db = null) {
  const current = num(inputs.current_ph);
  const target = num(inputs.target_ph);
  const cec = num(inputs.cec);
  const area = num(inputs.area_ha);
  const texture = inputs.texture || 'loam';
  if (current == null || current <= 0 || current > 14) return { error: 'current_ph_invalid' };
  if (target == null || target <= current) return { error: 'target_ph_must_exceed_current' };
  if (!cec || cec <= 0) return { error: 'cec_required' };
  if (!area || area <= 0) return { error: 'area_ha_required' };
  if (!(texture in TEXTURE_FACTORS)) return { error: 'texture_invalid', allowed: Object.keys(TEXTURE_FACTORS) };

  const warnings = ['Guide value only — confirm with a soil lab / agronomist before applying'];
  const rawTHa = (target - current) * cec * 0.75 * TEXTURE_FACTORS[texture];
  const tHa = round2(rawTHa);
  const totalT = round2(rawTHa * area);
  if (tHa > 8) warnings.push(`${tHa} t/ha exceeds the 8 t/ha single-application envelope — split applications over seasons`);

  let totalCost = null;
  if (inputs.product) {
    const price = productPrice(db, inputs.product, warnings); // price per kg
    if (price != null) totalCost = round2(rawTHa * area * 1000 * price);
  }

  return {
    result: { lime_t_ha: tHa, total_t: totalT, total_cost_zar: totalCost },
    breakdown: `(${target} − ${current}) × CEC ${cec} × 0.75 × ${texture} ${TEXTURE_FACTORS[texture]} = ${tHa} t/ha`,
    warnings,
  };
}

module.exports = { computeLime };
