import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardWeather from './DashboardWeather';

describe('DashboardWeather', () => {
  it('renders current temperature', () => {
    render(<DashboardWeather />);
    expect(screen.getByText('Partly Cloudy')).toBeInTheDocument();
    // Temperature uses &deg; so check for the rendered text
    expect(screen.getByText(/24°C/)).toBeInTheDocument();
  });

  it('renders 3-day forecast', () => {
    render(<DashboardWeather />);
    expect(screen.getByText('Tue')).toBeInTheDocument();
    expect(screen.getByText('Wed')).toBeInTheDocument();
    expect(screen.getByText('Thu')).toBeInTheDocument();
  });

  it('renders rainfall section', () => {
    render(<DashboardWeather />);
    expect(screen.getByText('Rainfall this month')).toBeInTheDocument();
    expect(screen.getByText('42mm / 55mm avg')).toBeInTheDocument();
  });
});
