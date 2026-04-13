import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LivestockDetail from './LivestockDetail';
import type { LivestockGroup, ShearingRecord } from '../../types/phase2';

const mockGroup: LivestockGroup = {
  id: 'g1',
  name: 'Breeding Ewes',
  enterprise: 'Sheep',
  species: 'Ovine',
  breed: 'Dohne Merino',
  management_type: 'breeding',
  head_count: 320,
  current_field_id: null,
  average_weight_kg: 68,
  notes: null,
};

const mockShearingRecords: ShearingRecord[] = [
  {
    id: 's1',
    group_id: 'g1',
    group_name: 'Breeding Ewes',
    date: '2026-03-01',
    head_shorn: 280,
    total_fleece_kg: 1120,
    avg_fleece_kg: 4.0,
    micron_avg: 21.5,
    yield_pct: 68,
    grade: 'A',
    buyer: 'BKB',
    price_per_kg: 85,
    total_revenue: 95200,
  },
];

describe('LivestockDetail', () => {
  const onClose = vi.fn();
  const onShearingUpdate = vi.fn();

  const renderDetail = () =>
    render(
      <LivestockDetail
        group={mockGroup}
        shearingRecords={mockShearingRecords}
        onShearingUpdate={onShearingUpdate}
        onClose={onClose}
      />,
    );

  it('renders group name in header', () => {
    renderDetail();
    expect(screen.getByText('Breeding Ewes')).toBeInTheDocument();
  });

  it('renders tab bar with 4 tabs', () => {
    renderDetail();
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Animals')).toBeInTheDocument();
    expect(screen.getByText('Shearing')).toBeInTheDocument();
    expect(screen.getByText('Health')).toBeInTheDocument();
  });

  it('shows Overview content by default', () => {
    renderDetail();
    // Overview shows head count
    expect(screen.getByText('Head Count')).toBeInTheDocument();
  });

  it('clicking Animals tab switches to animals content', () => {
    renderDetail();
    fireEvent.click(screen.getByText('Animals'));
    // Animals tab has a search input
    expect(screen.getByPlaceholderText('Search by tag, breed, status...')).toBeInTheDocument();
  });

  it('clicking Shearing tab shows shearing content', () => {
    renderDetail();
    fireEvent.click(screen.getByText('Shearing'));
    // Shearing should show the record data
    expect(screen.getByText('280')).toBeInTheDocument();
  });

  it('clicking Health tab shows health records', () => {
    renderDetail();
    fireEvent.click(screen.getByText('Health'));
    expect(screen.getAllByText('Vaccination').length).toBeGreaterThan(0);
  });

  it('close button calls onClose', () => {
    renderDetail();
    // There are two close buttons (mobile ArrowLeft, desktop X) - click the visible one
    const closeButtons = screen.getAllByRole('button').filter(
      (btn) => !['Overview', 'Animals', 'Shearing', 'Health'].includes(btn.textContent ?? ''),
    );
    fireEvent.click(closeButtons[0]);
    expect(onClose).toHaveBeenCalled();
  });
});
