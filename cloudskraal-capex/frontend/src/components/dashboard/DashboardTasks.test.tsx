import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardTasks from './DashboardTasks';

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <DashboardTasks />
    </MemoryRouter>
  );
}

describe('DashboardTasks', () => {
  it('renders task items grouped by day', () => {
    renderWithRouter();
    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('Tue')).toBeInTheDocument();
    expect(screen.getByText('Wed')).toBeInTheDocument();
    expect(screen.getByText('Thu')).toBeInTheDocument();
    expect(screen.getByText('Fri')).toBeInTheDocument();
  });

  it('renders task names', () => {
    renderWithRouter();
    expect(screen.getByText(/Drench ewe flock/)).toBeInTheDocument();
    expect(screen.getByText(/Service irrigation pump/)).toBeInTheDocument();
    expect(screen.getByText(/Rooibos field inspection/)).toBeInTheDocument();
    expect(screen.getByText(/Mix lamb creep feed/)).toBeInTheDocument();
    expect(screen.getByText(/Vineyard pruning/)).toBeInTheDocument();
    expect(screen.getByText(/Vet check/)).toBeInTheDocument();
    expect(screen.getByText(/Lupine harvest prep/)).toBeInTheDocument();
  });
});
