import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HourlyStrip from './HourlyStrip';

// recharts needs ResizeObserver
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

describe('HourlyStrip', () => {
  it('shows unavailable message when data is null', () => {
    render(<HourlyStrip hours={null} temps={null} rain={null} />);
    expect(screen.getByTestId('hourly-unavailable')).toHaveTextContent(
      'Hourly detail available for today and tomorrow only.',
    );
  });

  it('renders chart container when data is provided', () => {
    const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    const temps = Array.from({ length: 24 }, () => 20);
    const rain = Array.from({ length: 24 }, () => 0);

    render(<HourlyStrip hours={hours} temps={temps} rain={rain} />);
    expect(screen.getByTestId('hourly-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('hourly-unavailable')).not.toBeInTheDocument();
  });
});
