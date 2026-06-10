/**
 * Spec 2h.2 — CostMapPage smoke: renders the node map from mocked APIs,
 * layer chips toggle, farm scope shows the per-field roll-up.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { CostNodeMap, EnterpriseSummary } from '../types/costMap';

const mockMap: CostNodeMap = {
  field_id: 'f1', year: 2026, enterprise: 'rooibos', denominator: 'raw_harvest_kg',
  nodes: [
    { id: 'layer:direct_inputs', kind: 'layer', layer: 'direct_inputs', label: 'Direct inputs', status: 'ok', value_zar: 10000, include_flag: null, toggleable: false },
    { id: 'leaf:direct_inputs:0', kind: 'leaf', layer: 'direct_inputs', label: 'Fertiliser', value_zar: 10000 },
    { id: 'layer:labour', kind: 'layer', layer: 'labour', label: 'Labour', status: 'ok', value_zar: 0, include_flag: null, toggleable: false },
    { id: 'layer:shared', kind: 'layer', layer: 'shared', label: 'Shared inputs', status: 'off', include_flag: 'shared', toggleable: true, value_zar: null },
    { id: 'layer:activities', kind: 'layer', layer: 'activities', label: 'Equipment & operations', status: 'ok', value_zar: 1336, include_flag: 'activities', toggleable: true },
    { id: 'layer:overhead', kind: 'layer', layer: 'overhead', label: 'Overhead', status: 'no_data', include_flag: 'overhead', toggleable: true, value_zar: null, hint: 'Add overhead entries' },
    { id: 'layer:capital', kind: 'layer', layer: 'capital', label: 'Capital amortisation', status: 'off', include_flag: 'capital', toggleable: true, value_zar: null },
    { id: 'layer:processing', kind: 'layer', layer: 'processing', label: 'Processing', status: 'off', include_flag: 'processing', toggleable: true, value_zar: null },
    { id: 'total', kind: 'total', label: 'Total cost', value_zar: 11336 },
    { id: 'yield', kind: 'denominator', label: 'Yield', value_kg: 1000, denominator: 'raw_harvest_kg' },
    { id: 'unit_cost', kind: 'unit_cost', label: 'Cost / kg', value_zar_per_kg: 11.34 },
    { id: 'price', kind: 'price', label: 'Price', value_zar_per_kg: 39.6, price_basis: 'sifted_netto_dry_kg' },
    { id: 'margin', kind: 'margin', label: 'Margin / kg', value_zar_per_kg: 28.26 },
  ],
  edges: [
    { source: 'leaf:direct_inputs:0', target: 'layer:direct_inputs' },
    { source: 'layer:direct_inputs', target: 'total' },
    { source: 'layer:activities', target: 'total' },
    { source: 'total', target: 'unit_cost' },
    { source: 'yield', target: 'unit_cost' },
    { source: 'price', target: 'margin' },
    { source: 'unit_cost', target: 'margin' },
  ],
  summary: {
    total_direct: 10000, total_loaded: 11336, yield_kg: 1000, yield_at_price_basis_kg: 400,
    cost_per_kg_direct: 10, cost_per_kg_loaded: 11.34, price_per_kg: 39.6,
    price_basis: 'sifted_netto_dry_kg', enabled_layers: ['direct_inputs', 'labour', 'activities'],
  },
  warnings: [],
};

const mockSummary: EnterpriseSummary = {
  enterprise: 'rooibos', year: 2026, include: [],
  total_cost: 70000, total_yield_kg: 3000, cost_per_kg: 23.33,
  price_per_kg: 39.6, margin_per_kg: 16.27,
  fields: [
    { field_id: 'f1', name: 'Kamp 1', total_cost: 10000, yield_kg: 1000, cost_per_kg: 10 },
    { field_id: 'f2', name: 'Leeukamp', total_cost: 60000, yield_kg: 2000, cost_per_kg: 30 },
  ],
};

const mockGetCostNodeMap = vi.fn();
const mockGetEnterpriseSummary = vi.fn();
vi.mock('../api/costMap', () => ({
  getCostNodeMap: (...a: unknown[]) => mockGetCostNodeMap(...a),
  getEnterpriseSummary: (...a: unknown[]) => mockGetEnterpriseSummary(...a),
}));
vi.mock('../api/farms', () => ({
  getFields: vi.fn(() => Promise.resolve([
    { id: 'f1', name: 'Kamp 1', enterprise: 'rooibos', area_ha: 10 },
    { id: 'f2', name: 'Leeukamp', enterprise: 'rooibos', area_ha: 20 },
  ])),
}));

import CostMapPage from './CostMapPage';

// Locale-proof amount matcher (en-ZA uses NBSP group separators).
const byAmount = (n: number) => (content: string) =>
  content.replace(/[\s\u00a0\u202f,]/g, '') === `R${n}`;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCostNodeMap.mockResolvedValue(mockMap);
  mockGetEnterpriseSummary.mockResolvedValue(mockSummary);
});

describe('CostMapPage', () => {
  it('renders the node map with KPIs and the farm average', async () => {
    render(<CostMapPage />);
    await waitFor(() => expect(screen.getByTestId('cost-node-map')).toBeInTheDocument());
    expect(screen.getAllByText('Total cost').length).toBeGreaterThan(0); // KPI + map node
    expect(screen.getAllByText(byAmount(11336)).length).toBeGreaterThan(0);
    expect(screen.getByText('Cloudskraal avg')).toBeInTheDocument();
    expect(screen.getByTestId('node-layer:activities')).toBeInTheDocument();
  });

  it('layer chip click refetches with toggled include flags', async () => {
    render(<CostMapPage />);
    await waitFor(() => expect(mockGetCostNodeMap).toHaveBeenCalled());
    const before = mockGetCostNodeMap.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Capital' }));
    await waitFor(() => expect(mockGetCostNodeMap.mock.calls.length).toBeGreaterThan(before));
    const lastInclude = mockGetCostNodeMap.mock.calls.at(-1)![2] as string[];
    expect(lastInclude).not.toContain('capital');
  });

  it('farm scope shows the per-field roll-up table', async () => {
    render(<CostMapPage />);
    await waitFor(() => expect(screen.getByTestId('cost-node-map')).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole('button', { name: 'Cloudskraal' })[0]);
    await waitFor(() => expect(screen.getByText('vs Cloudskraal avg')).toBeInTheDocument());
    expect(screen.getByText('Leeukamp')).toBeInTheDocument();
    expect(screen.getByText('Cloudskraal avg cost')).toBeInTheDocument();
  });

  it('clicking a leaf opens the what-if editor and applying moves the KPI', async () => {
    render(<CostMapPage />);
    await waitFor(() => expect(screen.getByTestId('cost-node-map')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('node-leaf:direct_inputs:0'));
    const input = await screen.findByLabelText(/What-if value for/);
    fireEvent.change(input, { target: { value: '12000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(screen.getAllByText(byAmount(13336)).length).toBeGreaterThan(0)); // 11336 + 2000
    expect(screen.getByText(/What-if mode/)).toBeInTheDocument();
  });
});
