import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardActivity from './DashboardActivity';

describe('DashboardActivity', () => {
  it('renders activity items', () => {
    render(<DashboardActivity />);
    expect(screen.getByText(/Updated "Rooibos Harvest Schedule"/)).toBeInTheDocument();
    expect(screen.getByText(/Logged service for John Deere/)).toBeInTheDocument();
    expect(screen.getByText(/Recorded 120kg wool clip/)).toBeInTheDocument();
    expect(screen.getByText(/Treated 4 ewes for blue tongue/)).toBeInTheDocument();
    expect(screen.getByText(/Rooibos Block A marked as harvested/)).toBeInTheDocument();
    expect(screen.getByText(/Lupine seed delivery confirmed/)).toBeInTheDocument();
    expect(screen.getByText(/R45,000 payment received/)).toBeInTheDocument();
    expect(screen.getByText(/Approved "Solar pump/)).toBeInTheDocument();
  });

  it('renders timestamps', () => {
    render(<DashboardActivity />);
    expect(screen.getByText('25m ago')).toBeInTheDocument();
    expect(screen.getByText('1h ago')).toBeInTheDocument();
    expect(screen.getByText('2h ago')).toBeInTheDocument();
    expect(screen.getByText('3h ago')).toBeInTheDocument();
    expect(screen.getByText('5h ago')).toBeInTheDocument();
    expect(screen.getAllByText('Yesterday')).toHaveLength(2);
    expect(screen.getByText('2 days ago')).toBeInTheDocument();
  });
});
