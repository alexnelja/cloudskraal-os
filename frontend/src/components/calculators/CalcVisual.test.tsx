import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CalcVisual from './CalcVisual';
import { CALCULATORS } from '../../config/calculators';

const sprayer = CALCULATORS.find((c) => c.type === 'sprayer')!;
const pest = CALCULATORS.find((c) => c.type === 'pest')!;
const electrical = CALCULATORS.find((c) => c.type === 'electrical')!;

describe('CalcVisual', () => {
  it('renders a gauge for the sprayer result key', () => {
    render(<CalcVisual calc={sprayer} result={{ application_l_ha: 150 }} />);
    expect(screen.getByTestId('gauge-marker')).toBeInTheDocument();
  });
  it('renders tankmix for pest', () => {
    render(<CalcVisual calc={pest} result={{ total_chemical: 168, unit: 'g', total_water_l: null, total_cost_zar: 90 }} />);
    expect(screen.getByText(/168\s*g/)).toBeInTheDocument();
  });
  it('passes recommended motor to the pump gauge ticks', () => {
    render(<CalcVisual calc={electrical} result={{ kw_required: 9.1, recommended_motor_kw: 11 }} />);
    expect(screen.getByTestId('gauge-tick-11').getAttribute('data-recommended')).toBe('true');
  });
  it('renders nothing when the target value is null/missing', () => {
    const { container } = render(<CalcVisual calc={sprayer} result={{ application_l_ha: null }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
