// Spec 6 — pipe head loss via Hazen-Williams (C default 150 for PVC) +
// velocity check. Diameter is taken as the flow bore in mm.
const { round2, num } = require('./_shared');

function computeFluid(inputs = {}) {
  const flow = num(inputs.flow_m3_h);
  const length = num(inputs.length_m);
  const dMm = num(inputs.diameter_mm);
  const c = num(inputs.c_factor) ?? 150;
  if (!flow || flow <= 0) return { error: 'flow_m3_h_required' };
  if (!length || length <= 0) return { error: 'length_m_required' };
  if (!dMm || dMm <= 0) return { error: 'diameter_mm_required' };

  const warnings = [];
  const q = flow / 3600;            // m³/s
  const d = dMm / 1000;             // m
  const headLoss = (10.67 * length * Math.pow(q, 1.852)) / (Math.pow(c, 1.852) * Math.pow(d, 4.87));
  const velocity = q / (Math.PI * (d / 2) ** 2);

  if (velocity > 2) warnings.push(`velocity ${round2(velocity)} m/s exceeds 2 m/s — water hammer/wear risk, consider a larger pipe`);
  if (headLoss / length > 0.05) warnings.push('head loss exceeds 5 m per 100 m — pipe is undersized for this flow');

  return {
    result: {
      head_loss_m: round2(headLoss),
      head_loss_m_per_100m: round2((headLoss / length) * 100),
      velocity_m_s: round2(velocity),
    },
    breakdown: `Hazen-Williams: 10.67 × ${length} × (${round2(q * 1000) / 1000})^1.852 ÷ (${c}^1.852 × ${d}^4.87)`,
    warnings,
  };
}

module.exports = { computeFluid };
