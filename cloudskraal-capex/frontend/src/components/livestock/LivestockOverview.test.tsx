import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import LivestockOverview from './LivestockOverview';
import type { LivestockGroup } from '../../types/phase2';

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

describe('LivestockOverview', () => {
  it('renders head count', () => {
    render(<LivestockOverview group={mockGroup} />);
    expect(screen.getByText('320')).toBeInTheDocument();
  });

  it('renders average weight', () => {
    render(<LivestockOverview group={mockGroup} />);
    expect(screen.getByText('68 kg')).toBeInTheDocument();
  });

  it('renders average condition score', () => {
    render(<LivestockOverview group={mockGroup} />);
    // Breeding Ewes has avg 3.4
    expect(screen.getByText('3.4')).toBeInTheDocument();
  });

  it('renders condition distribution bar with good/fair/poor labels', () => {
    render(<LivestockOverview group={mockGroup} />);
    expect(screen.getByText('Condition Distribution')).toBeInTheDocument();
    // Breeding Ewes: good=72, fair=22, poor=6
    expect(screen.getByText('Good 72%')).toBeInTheDocument();
    expect(screen.getByText('Fair 22%')).toBeInTheDocument();
    expect(screen.getByText('Poor 6%')).toBeInTheDocument();
  });

  it('renders breed and enterprise', () => {
    render(<LivestockOverview group={mockGroup} />);
    expect(screen.getByText('Dohne Merino')).toBeInTheDocument();
    expect(screen.getByText('Sheep')).toBeInTheDocument();
  });

  it('renders management type badge', () => {
    render(<LivestockOverview group={mockGroup} />);
    expect(screen.getByText('breeding')).toBeInTheDocument();
  });

  it('shows dash when average weight is null', () => {
    const noWeight = { ...mockGroup, average_weight_kg: null };
    render(<LivestockOverview group={noWeight} />);
    expect(screen.getByText('-')).toBeInTheDocument();
  });
});
