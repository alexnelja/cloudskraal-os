/**
 * Spec 2h.3 — EnterprisesPage + DataQualityCard smoke tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { EnterprisesReport, DataQualityReport } from '../types/reporting';

const mockReport: EnterprisesReport = {
  year: 2026,
  enterprises: [
    { enterprise: 'rooibos', fields_count: 56, area_ha: 1796.46, yield_kg: 77000,
      cost_variable: 1331583, cost_loaded: 1400000, cost_per_kg_variable: 17.29,
      cost_per_kg_loaded: 18.18, price_per_kg: 39.6, margin_per_kg: -4.57 },
    { enterprise: 'oats', fields_count: 5, area_ha: 115.08, yield_kg: 0,
      cost_variable: 179124, cost_loaded: 179124, cost_per_kg_variable: null,
      cost_per_kg_loaded: null, price_per_kg: null, margin_per_kg: null },
  ],
  flocks: [
    { flock_id: 'fl1', name: 'Breeding Ewes 2025', cost_per_kg_wool: 92.5,
      cost_per_kg_liveweight: 31.2, gross_margin_per_ewe: 410 },
  ],
};

const mockDq: DataQualityReport = {
  year: 2026,
  fields_scanned: 60,
  uncategorized: { total_zar: 12500, fields: [{ field_id: 'f1', name: 'Kamp 1', amount: 12500 }] },
  costed_no_yield: [{ field_id: 'f2', name: 'Withope', usage: 'oats', total_cost: 50000 }],
  warning_counts: { no_price_for_year: 4 },
  excluded_layers: { shared: 3 },
};

const mockGetEnterprisesReport = vi.fn();
const mockGetDataQuality = vi.fn();
vi.mock('../api/reporting', () => ({
  getEnterprisesReport: (...a: unknown[]) => mockGetEnterprisesReport(...a),
  getDataQuality: (...a: unknown[]) => mockGetDataQuality(...a),
}));

import EnterprisesPage from './EnterprisesPage';
import DataQualityCard from '../components/DataQualityCard';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetEnterprisesReport.mockResolvedValue(mockReport);
  mockGetDataQuality.mockResolvedValue(mockDq);
});

describe('EnterprisesPage', () => {
  it('renders enterprise rows with margin colouring and a flock section', async () => {
    render(<MemoryRouter><EnterprisesPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('rooibos')).toBeInTheDocument());
    expect(screen.getByText('oats')).toBeInTheDocument();
    const margin = screen.getByText((c) => c.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.') === 'R-4.57');
    expect(margin.className).toContain('text-red-600');           // negative margin styled red
    expect(screen.getByText('Breeding Ewes 2025')).toBeInTheDocument();
    expect(screen.getByText(/Livestock \(flock COP\)/)).toBeInTheDocument();
  });
  it('null metrics render as em dashes, not crashes', async () => {
    render(<MemoryRouter><EnterprisesPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('oats')).toBeInTheDocument());
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});

describe('DataQualityCard', () => {
  it('lists the farm-wide issues', async () => {
    render(<MemoryRouter><DataQualityCard year={2026} /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('data-quality-card')).toBeInTheDocument());
    expect(screen.getByText(/uncategorized spend/)).toBeInTheDocument();
    expect(screen.getByText(/no 2026 yield/)).toBeInTheDocument();
    expect(screen.getByText(/shared inputs data not shown/)).toBeInTheDocument();
    expect(screen.getByText(/no_price_for_year ×4/)).toBeInTheDocument();
  });
  it('renders nothing when the endpoint fails (dashboard stays intact)', async () => {
    mockGetDataQuality.mockRejectedValue(new Error('boom'));
    const { container } = render(<MemoryRouter><DataQualityCard year={2026} /></MemoryRouter>);
    await waitFor(() => expect(mockGetDataQuality).toHaveBeenCalled());
    expect(container.querySelector('[data-testid="data-quality-card"]')).toBeNull();
  });
  it('shows the all-clear state when there are no issues', async () => {
    mockGetDataQuality.mockResolvedValue({
      ...mockDq,
      uncategorized: { total_zar: 0, fields: [] },
      costed_no_yield: [],
      excluded_layers: {},
      warning_counts: {},
    });
    render(<MemoryRouter><DataQualityCard year={2026} /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/No data-quality issues/)).toBeInTheDocument());
  });
});
