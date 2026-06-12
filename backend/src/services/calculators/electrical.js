// Spec 6 — pump electrical load: hydraulic power ρgQH scaled by efficiency,
// plus the next standard motor size up.
const { round2, num } = require('./_shared');

const MOTOR_LADDER_KW = [0.37, 0.55, 0.75, 1.1, 1.5, 2.2, 3, 4, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55, 75, 90, 110, 132];

function computeElectrical(inputs = {}) {
  const flow = num(inputs.flow_m3_h);
  const head = num(inputs.head_m);
  const eff = num(inputs.efficiency_pct) ?? 65;
  if (!flow || flow <= 0) return { error: 'flow_m3_h_required' };
  if (!head || head <= 0) return { error: 'head_m_required' };
  if (eff <= 0 || eff > 100) return { error: 'efficiency_pct_invalid' };

  const warnings = [];
  // P(kW) = ρ g Q H / η : 1000 × 9.81 × (m³/h ÷ 3600) × m ÷ 1000
  const kw = round2((9.81 * flow * head) / 3600 / (eff / 100));
  const motor = MOTOR_LADDER_KW.find(m => m >= kw) ?? null;
  if (kw > 132) warnings.push(`${kw} kW exceeds the standard motor ladder — confirm the duty point; this is industrial territory`);
  if (eff < 45) warnings.push(`efficiency ${eff}% is very low — check the pump curve`);

  return {
    result: { kw_required: kw, recommended_motor_kw: motor },
    breakdown: `9.81 × ${flow} m³/h × ${head} m ÷ 3600 ÷ ${eff}% = ${kw} kW`,
    warnings,
  };
}

module.exports = { computeElectrical };
