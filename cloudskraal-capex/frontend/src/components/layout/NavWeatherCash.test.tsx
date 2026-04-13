import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import NavWeatherCash from './NavWeatherCash';

describe('NavWeatherCash', () => {
  it('sidebar variant renders weather and cash', () => {
    render(<NavWeatherCash variant="sidebar" />);
    expect(screen.getByText('22°C')).toBeInTheDocument();
    expect(screen.getByText('sunny')).toBeInTheDocument();
    expect(screen.getByText(/1.*245.*000/)).toBeInTheDocument();
    expect(screen.getByText('3.2%')).toBeInTheDocument();
  });

  it('mobile variant renders compact format', () => {
    render(<NavWeatherCash variant="mobile" />);
    expect(screen.getByText('22°C')).toBeInTheDocument();
    expect(screen.getByText('R1245K')).toBeInTheDocument();
  });
});
