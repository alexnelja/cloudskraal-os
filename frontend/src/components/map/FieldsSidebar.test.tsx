import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import FieldsSidebar from './FieldsSidebar';
import type { Farm, Field } from '../../types/farm';

// Provide a real localStorage mock since the test environment stub has no methods
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

const FARMS: Farm[] = [
  { id: 'f1', name: 'Cloudskraal', code: 'CS', type: 'owned', total_ha: 1000, lat: -33, lng: 20, region: 'WC', notes: null },
  { id: 'f2', name: 'Bergplaas', code: 'BP', type: 'leased', total_ha: 500, lat: -33.1, lng: 20.1, region: 'WC', notes: null },
];
const FIELDS: Field[] = [
  { id: 'a', farm_id: 'f1', farm_name: 'Cloudskraal', name: 'Blok 1', code: null, enterprise: 'rooibos', crop_type: null, area_ha: 42, planted_year: '2022', status: 'active', soil_type: null, irrigation_type: null, notes: null },
  { id: 'b', farm_id: 'f1', farm_name: 'Cloudskraal', name: 'Blok 2', code: null, enterprise: 'rooibos', crop_type: null, area_ha: 38, planted_year: '2023', status: 'active', soil_type: null, irrigation_type: null, notes: null },
  { id: 'c', farm_id: 'f1', farm_name: 'Cloudskraal', name: 'Vineyard N', code: null, enterprise: 'wine', crop_type: null, area_ha: 22, planted_year: '2019', status: 'active', soil_type: null, irrigation_type: null, notes: null },
  { id: 'd', farm_id: 'f2', farm_name: 'Bergplaas', name: 'Aloe Field', code: null, enterprise: 'rooibos', crop_type: null, area_ha: 60, planted_year: '2021', status: 'active', soil_type: null, irrigation_type: null, notes: null },
];

const baseProps = {
  farms: FARMS,
  fields: FIELDS,
  enterprises: ['rooibos', 'wine'],
  visibleEnterprises: ['rooibos', 'wine'],
  selectedFieldId: null as string | null,
  onEnterpriseToggle: vi.fn(),
  onFarmSelect: vi.fn(),
  onFieldSelect: vi.fn(),
  onAddField: vi.fn(),
  enterpriseColors: { rooibos: '#047857', wine: '#7c3aed', sheep: '#d97706' },
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
});

describe('FieldsSidebar', () => {
  it('renders aggregate total hectarage and field count', () => {
    render(<FieldsSidebar {...baseProps} />);
    // 42 + 38 + 22 + 60 = 162
    expect(screen.getByText(/162/)).toBeInTheDocument();
    expect(screen.getByText(/4 fields/i)).toBeInTheDocument();
  });

  it('groups fields by enterprise with per-group totals', () => {
    render(<FieldsSidebar {...baseProps} />);
    // rooibos group: 42 + 38 = 80 ha, 2 fields
    expect(screen.getByText(/rooibos/i)).toBeInTheDocument();
    // wine group: 22 ha, 1 field
    expect(screen.getByText(/wine/i)).toBeInTheDocument();
  });

  it('clicking a field row calls onFieldSelect with the field id', () => {
    render(<FieldsSidebar {...baseProps} />);
    fireEvent.click(screen.getByText('Blok 1'));
    expect(baseProps.onFieldSelect).toHaveBeenCalledWith('a');
  });

  it('clicking an enterprise eye icon calls onEnterpriseToggle', () => {
    render(<FieldsSidebar {...baseProps} />);
    const eyes = screen.getAllByRole('button', { name: /toggle (rooibos|wine) visibility/i });
    fireEvent.click(eyes[0]);
    expect(baseProps.onEnterpriseToggle).toHaveBeenCalledTimes(1);
  });

  it('typing in search filters visible rows', () => {
    render(<FieldsSidebar {...baseProps} />);
    const search = screen.getByPlaceholderText(/search/i);
    fireEvent.change(search, { target: { value: 'Vineyard' } });
    expect(screen.getByText('Vineyard N')).toBeInTheDocument();
    expect(screen.queryByText('Blok 1')).toBeNull();
  });

  it('clicking + Add calls onAddField', () => {
    render(<FieldsSidebar {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /add field/i }));
    expect(baseProps.onAddField).toHaveBeenCalled();
  });

  it('persists expanded-group state to localStorage', () => {
    const { unmount } = render(<FieldsSidebar {...baseProps} />);
    // collapse rooibos
    const toggle = screen.getAllByRole('button', { name: /toggle (rooibos) group/i })[0];
    fireEvent.click(toggle);
    unmount();
    // re-mount — rooibos should stay collapsed
    render(<FieldsSidebar {...baseProps} />);
    expect(screen.queryByText('Blok 1')).toBeNull();
  });

  // === Spec 5p: Sort options ===

  it('renders a sort control', () => {
    render(<FieldsSidebar {...baseProps} />);
    expect(screen.getByLabelText(/sort/i)).toBeInTheDocument();
  });

  it('sorts fields by name (A→Z) when name sort selected', () => {
    render(<FieldsSidebar {...baseProps} />);
    const sortSelect = screen.getByLabelText(/sort/i);
    fireEvent.change(sortSelect, { target: { value: 'name-asc' } });
    const rows = screen.getAllByRole('button').filter(b => b.classList.contains('field-row'));
    const names = rows.map(b => b.querySelector('.text-stone-800')?.textContent);
    expect(names).toEqual(['Aloe Field', 'Blok 1', 'Blok 2', 'Vineyard N']);
  });

  it('sorts fields by area descending when area sort selected', () => {
    render(<FieldsSidebar {...baseProps} />);
    const sortSelect = screen.getByLabelText(/sort/i);
    fireEvent.change(sortSelect, { target: { value: 'area-desc' } });
    const rows = screen.getAllByRole('button').filter(b => b.classList.contains('field-row'));
    const names = rows.map(b => b.querySelector('.text-stone-800')?.textContent);
    // 60, 42, 38, 22
    expect(names).toEqual(['Aloe Field', 'Blok 1', 'Blok 2', 'Vineyard N']);
  });

  it('default sort is by enterprise (grouped by enterprise, then by name)', () => {
    render(<FieldsSidebar {...baseProps} />);
    const rows = screen.getAllByRole('button').filter(b => b.classList.contains('field-row'));
    const names = rows.map(b => b.querySelector('.text-stone-800')?.textContent);
    // rooibos group (largest total) first, then wine. Within group: alphabetical
    expect(names).toEqual(['Aloe Field', 'Blok 1', 'Blok 2', 'Vineyard N']);
  });

  // === Spec 5p: Farm-level aggregates ===

  it('shows farm-level aggregate row with fields-ha vs farm-ha', () => {
    render(<FieldsSidebar {...baseProps} />);
    // Cloudskraal: fields total 42+38+22=102 ha, farm total 1000 ha
    // Bergplaas: 60 ha fields, 500 ha farm
    // Look for the "X/Y ha" pattern in the aggregate rows
    expect(screen.getByText('102/1,000 ha')).toBeInTheDocument();
    expect(screen.getByText('60/500 ha')).toBeInTheDocument();
  });

  it('shows utilisation percentage for each farm', () => {
    render(<FieldsSidebar {...baseProps} />);
    // Cloudskraal: 102/1000 = 10%
    expect(screen.getByText('10%')).toBeInTheDocument();
    // Bergplaas: 60/500 = 12%
    expect(screen.getByText('12%')).toBeInTheDocument();
  });
});
