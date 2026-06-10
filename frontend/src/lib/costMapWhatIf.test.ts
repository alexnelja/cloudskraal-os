/**
 * Spec 2h.2 — what-if recompute: client-side propagation of node value
 * overrides through the cost DAG (layer sums → total → ÷yield → cost/kg →
 * margin vs price), without re-calling the backend.
 */
import { describe, it, expect } from 'vitest';
import type { CostNodeMap } from '../types/costMap';
import { applyWhatIf } from './costMapWhatIf';

// Mirrors the backend fixture: direct 10000 (1 leaf), activities 1336 (1 leaf),
// yield 1000 kg, price R60 on harvest_wet_kg (yield_at_basis 1000).
function fixture(): CostNodeMap {
  return {
    field_id: 'f1', year: 2026, enterprise: 'rooibos', denominator: 'raw_harvest_kg',
    nodes: [
      { id: 'layer:direct_inputs', kind: 'layer', layer: 'direct_inputs', label: 'Direct inputs', status: 'ok', value_zar: 10000, include_flag: null, toggleable: false },
      { id: 'leaf:direct_inputs:0', kind: 'leaf', layer: 'direct_inputs', label: 'Fertiliser', value_zar: 10000 },
      { id: 'layer:labour', kind: 'layer', layer: 'labour', label: 'Labour', status: 'ok', value_zar: 0, include_flag: null, toggleable: false },
      { id: 'layer:activities', kind: 'layer', layer: 'activities', label: 'Equipment & operations', status: 'ok', value_zar: 1336, include_flag: 'activities', toggleable: true },
      { id: 'leaf:activities:0', kind: 'leaf', layer: 'activities', label: 'firebreak_cutting', value_zar: 1336 },
      { id: 'layer:shared', kind: 'layer', layer: 'shared', label: 'Shared inputs', status: 'off', include_flag: 'shared', toggleable: true, value_zar: null },
      { id: 'layer:overhead', kind: 'layer', layer: 'overhead', label: 'Overhead', status: 'off', include_flag: 'overhead', toggleable: true, value_zar: null },
      { id: 'layer:capital', kind: 'layer', layer: 'capital', label: 'Capital amortisation', status: 'off', include_flag: 'capital', toggleable: true, value_zar: null },
      { id: 'layer:processing', kind: 'layer', layer: 'processing', label: 'Processing', status: 'off', include_flag: 'processing', toggleable: true, value_zar: null },
      { id: 'total', kind: 'total', label: 'Total cost', value_zar: 11336 },
      { id: 'yield', kind: 'denominator', label: 'Yield', value_kg: 1000, denominator: 'raw_harvest_kg' },
      { id: 'unit_cost', kind: 'unit_cost', label: 'Cost / kg', value_zar_per_kg: 11.34 },
      { id: 'price', kind: 'price', label: 'Price', value_zar_per_kg: 60, price_basis: 'harvest_wet_kg' },
      { id: 'margin', kind: 'margin', label: 'Margin / kg', value_zar_per_kg: 48.66 },
    ],
    edges: [
      { source: 'leaf:direct_inputs:0', target: 'layer:direct_inputs' },
      { source: 'leaf:activities:0', target: 'layer:activities' },
      { source: 'layer:direct_inputs', target: 'total' },
      { source: 'layer:labour', target: 'total' },
      { source: 'layer:activities', target: 'total' },
      { source: 'total', target: 'unit_cost' },
      { source: 'yield', target: 'unit_cost' },
      { source: 'price', target: 'margin' },
      { source: 'unit_cost', target: 'margin' },
    ],
    summary: {
      total_direct: 10000, total_loaded: 11336, yield_kg: 1000,
      yield_at_price_basis_kg: 1000,
      cost_per_kg_direct: 10, cost_per_kg_loaded: 11.34,
      price_per_kg: 60, price_basis: 'harvest_wet_kg',
      enabled_layers: ['direct_inputs', 'labour', 'activities'],
    },
    warnings: [],
  };
}

describe('applyWhatIf — baseline', () => {
  it('with no overrides reproduces the backend summary', () => {
    const r = applyWhatIf(fixture(), {});
    expect(r.total).toBe(11336);
    expect(r.unitCost).toBe(11.34);
    expect(r.marginPerKg).toBe(48.66);
    expect(r.deltas.total).toBe(0);
  });
});

describe('applyWhatIf — overrides propagate', () => {
  it('leaf override re-sums its layer and the total', () => {
    const r = applyWhatIf(fixture(), { 'leaf:direct_inputs:0': 12000 });
    expect(r.layerValues['direct_inputs']).toBe(12000);
    expect(r.total).toBe(13336);
    expect(r.unitCost).toBe(13.34);
    expect(r.deltas.total).toBe(2000);
  });
  it('layer override (leafless) replaces the layer value directly', () => {
    const r = applyWhatIf(fixture(), { 'layer:activities': 2000 });
    expect(r.layerValues['activities']).toBe(2000);
    expect(r.total).toBe(12000);
  });
  it('yield override moves cost/kg and margin', () => {
    const r = applyWhatIf(fixture(), { yield: 800 });
    expect(r.unitCost).toBe(14.17);            // 11336 / 800
    expect(r.marginPerKg).toBe(45.83);          // 60 − 11336/800 (basis scales with yield)
  });
  it('price override moves margin only', () => {
    const r = applyWhatIf(fixture(), { price: 31.65 });
    expect(r.unitCost).toBe(11.34);
    expect(r.marginPerKg).toBe(20.31);          // 31.65 − 11.34
  });
  it('zero yield gives null unit cost and margin without crashing', () => {
    const r = applyWhatIf(fixture(), { yield: 0 });
    expect(r.unitCost).toBeNull();
    expect(r.marginPerKg).toBeNull();
  });
  it('off layers stay excluded even if overridden', () => {
    const r = applyWhatIf(fixture(), { 'layer:shared': 5000 });
    expect(r.total).toBe(11336);
  });
});
