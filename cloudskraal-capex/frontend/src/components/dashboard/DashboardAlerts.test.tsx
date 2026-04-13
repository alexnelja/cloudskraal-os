import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardAlerts from './DashboardAlerts';

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <DashboardAlerts />
    </MemoryRouter>
  );
}

describe('DashboardAlerts', () => {
  it('renders alert items', () => {
    renderWithRouter();
    expect(screen.getByText('Overdue service: Bovic Cutter')).toBeInTheDocument();
    expect(screen.getByText('Low stock: Veterinary supplies')).toBeInTheDocument();
    expect(screen.getByText('Feed trough low: Ram paddock')).toBeInTheDocument();
    expect(screen.getByText('3 tasks due this week')).toBeInTheDocument();
  });

  it('renders action links', () => {
    renderWithRouter();
    expect(screen.getByText('Log now')).toBeInTheDocument();
    expect(screen.getByText('Reorder')).toBeInTheDocument();
    expect(screen.getByText('Check')).toBeInTheDocument();
    expect(screen.getByText('View')).toBeInTheDocument();
  });

  it('renders alert count badge', () => {
    renderWithRouter();
    expect(screen.getByText('4')).toBeInTheDocument();
  });
});
