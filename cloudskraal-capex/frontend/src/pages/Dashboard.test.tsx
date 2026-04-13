import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );
}

describe('Dashboard', () => {
  it('renders enterprise filter pills', () => {
    renderWithRouter();
    const pills = ['All', 'Livestock', 'Rooibos', 'Wine', 'Crops/Rotation'];
    pills.forEach((label) => {
      const buttons = screen.getAllByRole('button').filter((btn) => btn.textContent === label);
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders all dashboard sections', () => {
    renderWithRouter();
    // KPIs
    expect(screen.getByText('Total Hectares')).toBeInTheDocument();
    // Weather
    expect(screen.getByText('Weather')).toBeInTheDocument();
    // Alerts
    expect(screen.getByText('Alerts')).toBeInTheDocument();
    // Fill Levels
    expect(screen.getByText('Storage & Feed Levels')).toBeInTheDocument();
    // Tasks
    expect(screen.getByText("This Week's Tasks")).toBeInTheDocument();
    // Activity
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });
});
