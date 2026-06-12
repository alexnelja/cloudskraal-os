/**
 * COP UI — FlockCopSection + CopMarginBlock smoke tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { FlockCOP } from '../../api/livestock';
import CopMarginBlock from '../map/CopMarginBlock';
import type { CopMargin } from '../../types/farm';

const mockGetFlockCop = vi.fn();
vi.mock('../../api/livestock', () => ({
  getFlockCostOfProduction: (...a: unknown[]) => mockGetFlockCop(...a),
}));

import FlockCopSection from './FlockCopSection';

const flockCop: FlockCOP = {
  group_id: 'g1', year: 2026,
  costs: { feed: 120000, labour: 60000, animal_health: 25000, shearing: 30000, other: 5000, total: 240000 },
  income: { wool: 200000, meat: 300000, wool_share: 0.4 },
  allocation: { wool: 114000, meat: 126000 },
  denominators: { clean_wool_kg: 1200, liveweight_sold_kg: 9000 },
  cost_per_kg_wool: 95, cost_per_kg_liveweight: 14,
  cost_per_weaned_lamb: 480, gross_margin: 260000, gross_margin_per_ewe: 410,
  transfers_in: { total: 35000, items: [] },
  warnings: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetFlockCop.mockResolvedValue(flockCop);
});

describe('FlockCopSection', () => {
  it('renders cost buckets, per-kg numbers and gross margin per ewe', async () => {
    render(<FlockCopSection groupId="g1" />);
    await waitFor(() => expect(screen.getByText('Feed')).toBeInTheDocument());
    expect(screen.getByText('Cost / kg wool')).toBeInTheDocument();
    expect(screen.getByText('Gross margin / ewe')).toBeInTheDocument();
    expect(screen.getByText(/internal transfers in/)).toBeInTheDocument();
    expect(mockGetFlockCop).toHaveBeenCalledWith('g1', 2026);
  });
  it('404 → quiet capture hint, not an error', async () => {
    mockGetFlockCop.mockRejectedValue(new Error('API error 404'));
    render(<FlockCopSection groupId="g1" />);
    await waitFor(() => expect(screen.getByText(/No COP inputs for 2026/)).toBeInTheDocument());
  });
});

describe('CopMarginBlock', () => {
  const margin: CopMargin = {
    enterprise: 'rooibos', year: 2026, price_per_kg: 39.6, price_basis: 'sifted_netto_dry_kg',
    yield_at_price_basis_kg: 391.5, cost_per_kg_at_price_basis: 44.17, margin_per_kg: -4.57,
    gross_revenue: 15503, margin_total: -1789, margin_per_ha: -179, margin_pct: -11.5,
  };
  it('renders the price-basis margin grid with negative values red', () => {
    render(<CopMarginBlock margin={margin} />);
    expect(screen.getByTestId('cop-margin-block')).toBeInTheDocument();
    expect(screen.getByText(/price basis sifted netto dry kg/)).toBeInTheDocument();
    expect(screen.getByText('Margin / kg').nextElementSibling?.className).toContain('text-red-600');
  });
  it('renders nothing when margin is null', () => {
    const { container } = render(<CopMarginBlock margin={null} />);
    expect(container.firstChild).toBeNull();
  });
});
