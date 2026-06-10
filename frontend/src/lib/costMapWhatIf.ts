// Spec 2h.2 — what-if recompute. The DAG arithmetic is plain sums + a divide,
// so overrides propagate client-side: leaf/layer values → total → ÷yield →
// cost/kg → margin vs price. Off layers never count, mirroring the backend.
import type { CostNodeMap, LayerKey } from '../types/costMap';

export interface WhatIfOverrides {
  /** node-id → new R value (leaf:… or layer:…), plus 'yield' (kg) and 'price' (R/kg) */
  [nodeIdOrSpecial: string]: number;
}

export interface WhatIfResult {
  layerValues: Partial<Record<LayerKey, number>>;
  total: number;
  yieldKg: number;
  unitCost: number | null;
  pricePerKg: number | null;
  marginPerKg: number | null;
  deltas: { total: number; unitCost: number | null; marginPerKg: number | null };
}

function round2(n: number): number { return Math.round(n * 100) / 100; }

function compute(map: CostNodeMap, overrides: WhatIfOverrides) {
  const layerValues: Partial<Record<LayerKey, number>> = {};
  let total = 0;

  for (const node of map.nodes) {
    if (node.kind !== 'layer' || node.status !== 'ok' || !node.layer) continue;
    let value: number;
    const layerOverride = overrides[node.id];
    if (layerOverride != null) {
      value = layerOverride;
    } else {
      // Base value + the delta from any overridden leaves (the backend layer
      // value can exceed the rendered leaf sum, so adjust rather than re-sum).
      value = node.value_zar ?? 0;
      for (const leaf of map.nodes) {
        if (leaf.kind !== 'leaf' || leaf.layer !== node.layer) continue;
        const o = overrides[leaf.id];
        if (o != null) value += o - (leaf.value_zar ?? 0);
      }
    }
    layerValues[node.layer] = round2(value);
    total += value;
  }
  total = round2(total);

  const yieldKg = overrides['yield'] ?? map.summary.yield_kg;
  const unitCost = yieldKg > 0 ? round2(total / yieldKg) : null;

  const pricePerKg = overrides['price'] ?? map.summary.price_per_kg;
  let marginPerKg: number | null = null;
  const baseYield = map.summary.yield_kg;
  const baseYieldAtBasis = map.summary.yield_at_price_basis_kg;
  if (pricePerKg != null && baseYieldAtBasis != null && baseYield > 0) {
    const yieldAtBasis = yieldKg * (baseYieldAtBasis / baseYield); // basis factor scales with yield
    if (yieldAtBasis > 0) marginPerKg = round2(pricePerKg - total / yieldAtBasis);
  }

  return { layerValues, total, yieldKg, unitCost, pricePerKg, marginPerKg };
}

export function applyWhatIf(map: CostNodeMap, overrides: WhatIfOverrides): WhatIfResult {
  const base = compute(map, {});
  const r = compute(map, overrides);
  return {
    ...r,
    deltas: {
      total: round2(r.total - base.total),
      unitCost: r.unitCost != null && base.unitCost != null ? round2(r.unitCost - base.unitCost) : null,
      marginPerKg: r.marginPerKg != null && base.marginPerKg != null ? round2(r.marginPerKg - base.marginPerKg) : null,
    },
  };
}
