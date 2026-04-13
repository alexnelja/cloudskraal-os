import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardFillLevels from './DashboardFillLevels';

describe('DashboardFillLevels', () => {
  it('renders section header', () => {
    render(<DashboardFillLevels />);
    expect(screen.getByText('Storage & Feed Levels')).toBeInTheDocument();
  });

  it('renders all fill level bars', () => {
    render(<DashboardFillLevels />);
    expect(screen.getByText('Feed: Ewes')).toBeInTheDocument();
    expect(screen.getByText('Feed: Rams')).toBeInTheDocument();
    expect(screen.getByText('Feed: Lambs')).toBeInTheDocument();
    expect(screen.getByText('Water: Main Tank')).toBeInTheDocument();
    expect(screen.getByText('Water: Portable')).toBeInTheDocument();
    expect(screen.getByText('Silo: Lupine Seed')).toBeInTheDocument();
    expect(screen.getByText('Silo: Rooibos Tea')).toBeInTheDocument();
  });
});
