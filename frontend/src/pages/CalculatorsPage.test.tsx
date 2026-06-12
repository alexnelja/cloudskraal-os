/**
 * Spec 6b — CalculatorsPage smoke: tiles, schema-driven form, compute,
 * warnings, and query-string restore.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockCompute = vi.fn();
vi.mock('../api/calculators', () => ({
  computeCalculator: (...a: unknown[]) => mockCompute(...a),
  getInputProductNames: vi.fn(() => Promise.resolve(['Glifosaat', 'LAN 28'])),
}));

import CalculatorsPage from './CalculatorsPage';

beforeEach(() => {
  vi.clearAllMocks();
  mockCompute.mockResolvedValue({
    result: { application_l_ha: 180, total_spray_l: 1152, tank_fills: 0.58 },
    breakdown: 'L/ha = 1.2 L/min × 600 ÷ (8 km/h × 0.5 m) = 180',
    warnings: [],
  });
});

function renderAt(path = '/calculators') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CalculatorsPage />
    </MemoryRouter>,
  );
}

describe('CalculatorsPage', () => {
  it('shows a tile per calculator', () => {
    renderAt();
    for (const t of ['sprayer', 'pest', 'fertilizer', 'lime', 'electrical', 'fluid'])
      expect(screen.getByTestId(`tile-${t}`)).toBeInTheDocument();
  });

  it('opens a calc, computes, and renders the result card with breakdown', async () => {
    renderAt();
    fireEvent.click(screen.getByTestId('tile-sprayer'));
    fireEvent.change(screen.getByLabelText(/nozzle output/i), { target: { value: '1.2' } });
    fireEvent.change(screen.getByLabelText(/travel speed/i), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText(/nozzle spacing/i), { target: { value: '0.5' } });
    fireEvent.click(screen.getByRole('button', { name: /compute/i }));
    await waitFor(() => expect(screen.getByTestId('calc-result')).toBeInTheDocument());
    expect(mockCompute).toHaveBeenCalledWith('sprayer', expect.objectContaining({
      nozzle_l_min: 1.2, speed_kmh: 8, nozzle_spacing_m: 0.5,
    }));
    expect(screen.getAllByText(/Application rate/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/180/).length).toBeGreaterThan(0);
    expect(screen.getByText(/× 600 ÷/)).toBeInTheDocument();
  });

  it('renders sanity warnings amber', async () => {
    mockCompute.mockResolvedValue({
      result: { application_l_ha: 1200 },
      warnings: ['application rate 1200 L/ha is outside the typical 50–600 L/ha envelope — recheck nozzle/speed/spacing'],
    });
    renderAt('/calculators?calc=sprayer&nozzle_l_min=4&speed_kmh=4&nozzle_spacing_m=0.5');
    fireEvent.click(screen.getByRole('button', { name: /compute/i }));
    await waitFor(() => expect(screen.getByText(/outside the typical/)).toBeInTheDocument());
  });

  it('restores inputs from the query string (shareable URL)', () => {
    renderAt('/calculators?calc=sprayer&nozzle_l_min=1.2&speed_kmh=8&nozzle_spacing_m=0.5');
    expect((screen.getByLabelText(/nozzle output/i) as HTMLInputElement).value).toBe('1.2');
    expect(screen.getByRole('button', { name: /compute/i })).toBeEnabled();
  });

  it('compute stays disabled until required fields are filled', () => {
    renderAt('/calculators?calc=lime');
    expect(screen.getByRole('button', { name: /compute/i })).toBeDisabled();
  });
});
