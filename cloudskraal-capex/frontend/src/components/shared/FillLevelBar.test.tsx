import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import FillLevelBar from './FillLevelBar';

describe('FillLevelBar', () => {
  it('renders label and current value', () => {
    render(<FillLevelBar label="Fuel" current={60} />);
    expect(screen.getByText('Fuel')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('shows red color when below low threshold', () => {
    const { container } = render(<FillLevelBar label="Fuel" current={10} />);
    const bar = container.querySelector('[style]')!;
    expect(bar.className).toContain('bg-red-500');
  });

  it('shows amber color when below warning threshold', () => {
    const { container } = render(<FillLevelBar label="Fuel" current={30} />);
    const bar = container.querySelector('[style]')!;
    expect(bar.className).toContain('bg-amber-500');
  });

  it('shows green color when above warning threshold', () => {
    const { container } = render(<FillLevelBar label="Fuel" current={60} />);
    const bar = container.querySelector('[style]')!;
    expect(bar.className).toContain('bg-emerald-500');
  });

  it('respects custom thresholds', () => {
    const { container } = render(
      <FillLevelBar label="Fuel" current={30} thresholds={{ low: 40, warning: 60 }} />
    );
    const bar = container.querySelector('[style]')!;
    // 30 is <= 40 (low), so should be red
    expect(bar.className).toContain('bg-red-500');
  });

  it('clamps width at 100%', () => {
    const { container } = render(<FillLevelBar label="Fuel" current={150} />);
    const bar = container.querySelector('[style]') as HTMLElement;
    expect(bar.style.width).toBe('100%');
  });
});
