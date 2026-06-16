import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TankMix from './TankMix';

describe('TankMix', () => {
  it('per-100L: shows water fill, dose with unit, and cost', () => {
    render(<TankMix result={{ total_chemical: 2400, unit: 'ml', total_water_l: 997.6, total_cost_zar: 612 }} />);
    expect(screen.getByTestId('tankmix-water')).toBeInTheDocument();
    expect(screen.getByText(/2[\s,]?400\s*ml/)).toBeInTheDocument();
    expect(screen.getByText(/R\s?612/)).toBeInTheDocument();
  });
  it('per-ha (null water): dose-only, no water fill, no NaN', () => {
    const { container } = render(
      <TankMix result={{ total_chemical: 168, unit: 'g', total_water_l: null, total_cost_zar: 90 }} />
    );
    expect(screen.queryByTestId('tankmix-water')).not.toBeInTheDocument();
    expect(screen.getByText(/168\s*g/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/NaN/);
  });
});
