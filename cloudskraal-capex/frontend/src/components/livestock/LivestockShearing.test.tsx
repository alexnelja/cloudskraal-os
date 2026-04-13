import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LivestockShearing from './LivestockShearing';
import type { ShearingRecord } from '../../types/phase2';

const mockRecords: ShearingRecord[] = [
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
  {
    id: 's2',
    group_id: 'g1',
    group_name: 'Breeding Ewes',
    date: '2025-09-15',
    head_shorn: 250,
    total_fleece_kg: 950,
    avg_fleece_kg: 3.8,
    micron_avg: 22.0,
    yield_pct: 65,
    grade: 'B',
    buyer: 'OVK',
    price_per_kg: 78,
    total_revenue: 74100,
  },
];

const noop = vi.fn();

describe('LivestockShearing', () => {
  it('renders shearing records table with data', () => {
    render(<LivestockShearing records={mockRecords} onUpdate={noop} />);
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Head')).toBeInTheDocument();
    expect(screen.getByText('Total kg')).toBeInTheDocument();
  });

  it('renders record values from props', () => {
    render(<LivestockShearing records={mockRecords} onUpdate={noop} />);
    // EditableCell renders the value as text when not editing
    expect(screen.getByText('280')).toBeInTheDocument();
    expect(screen.getByText('1120')).toBeInTheDocument();
  });

  it('handles empty records array', () => {
    render(<LivestockShearing records={[]} onUpdate={noop} />);
    expect(screen.getByText('No shearing records yet.')).toBeInTheDocument();
  });
});
