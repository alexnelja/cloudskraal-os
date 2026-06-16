import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EnvelopeGauge from './EnvelopeGauge';

const base = { resultKey: 'x', min: 0, max: 600, goodMin: 100, goodMax: 400, threshold: 600, unit: 'L/ha' };

describe('EnvelopeGauge', () => {
  it('shows the value with its unit', () => {
    render(<EnvelopeGauge value={150} gauge={base} />);
    expect(screen.getByText(/150/)).toBeInTheDocument();
    expect(screen.getByText(/L\/ha/)).toBeInTheDocument();
  });
  it('positions the marker by percent (data-pct)', () => {
    render(<EnvelopeGauge value={300} gauge={base} />);
    expect(screen.getByTestId('gauge-marker').getAttribute('data-pct')).toBe('50');
  });
  it('marks an over-threshold value (data-zone=over)', () => {
    render(<EnvelopeGauge value={650} gauge={base} />);
    expect(screen.getByTestId('gauge-marker').getAttribute('data-zone')).toBe('over');
  });
  it('renders ticks in ladder mode and highlights the recommended one', () => {
    const pump = { resultKey: 'kw_required', min: 0, max: 132, unit: 'kW',
      ticks: [{ value: 7.5, label: '7.5' }, { value: 11, label: '11' }] };
    render(<EnvelopeGauge value={9.1} gauge={pump} recommended={11} />);
    expect(screen.getByTestId('gauge-tick-11').getAttribute('data-recommended')).toBe('true');
    expect(screen.getByTestId('gauge-tick-7.5').getAttribute('data-recommended')).toBe('false');
  });
});
