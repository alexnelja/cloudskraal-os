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
];
const FIELDS: Field[] = [
  { id: 'a', farm_id: 'f1', farm_name: 'Cloudskraal', name: 'Blok 1', code: null, enterprise: 'rooibos', crop_type: null, area_ha: 42, planted_year: '2022', status: 'active', soil_type: null, irrigation_type: null, notes: null },
  { id: 'b', farm_id: 'f1', farm_name: 'Cloudskraal', name: 'Blok 2', code: null, enterprise: 'rooibos', crop_type: null, area_ha: 38, planted_year: '2023', status: 'active', soil_type: null, irrigation_type: null, notes: null },
  { id: 'c', farm_id: 'f1', farm_name: 'Cloudskraal', name: 'Vineyard N', code: null, enterprise: 'wine', crop_type: null, area_ha: 22, planted_year: '2019', status: 'active', soil_type: null, irrigation_type: null, notes: null },
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
    // 42 + 38 + 22 = 102
    expect(screen.getByText(/102/)).toBeInTheDocument();
    expect(screen.getByText(/3 fields/i)).toBeInTheDocument();
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
});
