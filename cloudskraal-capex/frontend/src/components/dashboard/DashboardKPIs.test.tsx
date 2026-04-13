import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardKPIs from './DashboardKPIs';

describe('DashboardKPIs', () => {
  it('renders all 4 KPI cards', () => {
    render(<DashboardKPIs enterprise="All" />);
    expect(screen.getByText('Total Hectares')).toBeInTheDocument();
    expect(screen.getByText('Livestock')).toBeInTheDocument();
    expect(screen.getByText('Active Projects')).toBeInTheDocument();
    expect(screen.getByText('Cash Position')).toBeInTheDocument();
  });

  it('renders KPI values', () => {
    render(<DashboardKPIs enterprise="All" />);
    expect(screen.getByText('2,429 ha')).toBeInTheDocument();
    expect(screen.getByText('847 head')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('R1,245,000')).toBeInTheDocument();
  });

  it('renders delta arrows with correct values', () => {
    render(<DashboardKPIs enterprise="All" />);
    expect(screen.getByText('+5.2%')).toBeInTheDocument();
    expect(screen.getByText('-2')).toBeInTheDocument();
    expect(screen.getByText('+3.2%')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('accepts enterprise prop without crashing', () => {
    const { container } = render(<DashboardKPIs enterprise="Livestock" />);
    expect(container).toBeTruthy();
  });
});
