// Spec 6 — sprayer calibration: application rate from nozzle output, travel
// speed and nozzle spacing (the standard 600 formula), plus block totals.
const { round2, num } = require('./_shared');

function computeSprayer(inputs = {}) {
  const nozzle = num(inputs.nozzle_l_min);
  const speed = num(inputs.speed_kmh);
  const spacing = num(inputs.nozzle_spacing_m);
  if (!nozzle || nozzle <= 0) return { error: 'nozzle_l_min_required' };
  if (!speed || speed <= 0) return { error: 'speed_kmh_required' };
  if (!spacing || spacing <= 0) return { error: 'nozzle_spacing_m_required' };

  const warnings = [];
  const lHa = round2((nozzle * 600) / (speed * spacing));
  if (lHa < 50 || lHa > 600) {
    warnings.push(`application rate ${lHa} L/ha is outside the typical 50–600 L/ha envelope — recheck nozzle/speed/spacing`);
  }

  const area = num(inputs.area_ha);
  const tank = num(inputs.tank_size_l);
  const totalSpray = area ? round2(lHa * area) : null;
  const tankFills = totalSpray && tank ? round2(totalSpray / tank) : null;

  return {
    result: {
      application_l_ha: lHa,
      total_spray_l: totalSpray,
      tank_fills: tankFills,
    },
    breakdown: `L/ha = ${nozzle} L/min × 600 ÷ (${speed} km/h × ${spacing} m) = ${lHa}`,
    warnings,
  };
}

module.exports = { computeSprayer };
