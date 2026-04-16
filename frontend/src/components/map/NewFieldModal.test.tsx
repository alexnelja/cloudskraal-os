import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import NewFieldModal from './NewFieldModal';
import * as api from '../../api/farms';
import type { Farm } from '../../types/farm';

const FARMS: Farm[] = [
  { id: 'f1', name: 'Cloudskraal', code: 'CS', type: 'owned', total_ha: 1000, lat: -33, lng: 20, region: 'WC', notes: null },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NewFieldModal', () => {
  it('renders when open, hidden when closed', () => {
    const { rerender } = render(
      <NewFieldModal open={false} onClose={vi.fn()} onCreated={vi.fn()} farms={FARMS} enterprises={['rooibos', 'wine']} />
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(
      <NewFieldModal open={true} onClose={vi.fn()} onCreated={vi.fn()} farms={FARMS} enterprises={['rooibos', 'wine']} />
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('submits a valid field and calls onCreated', async () => {
    const spy = vi.spyOn(api, 'createField').mockResolvedValue({
      id: 'new', farm_id: 'f1', name: 'Blok', enterprise: 'rooibos', area_ha: 10,
      code: null, crop_type: null, planted_year: null, status: 'active', soil_type: null, irrigation_type: null, notes: null,
    } as never);
    const onCreated = vi.fn();
    render(
      <NewFieldModal open={true} onClose={vi.fn()} onCreated={onCreated} farms={FARMS} enterprises={['rooibos', 'wine']} />
    );
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Blok' } });
    fireEvent.change(screen.getByLabelText(/enterprise/i), { target: { value: 'rooibos' } });
    fireEvent.change(screen.getByLabelText(/area/i), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /create/i }));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(onCreated).toHaveBeenCalled();
  });

  it('shows error when name is missing', () => {
    render(
      <NewFieldModal open={true} onClose={vi.fn()} onCreated={vi.fn()} farms={FARMS} enterprises={['rooibos', 'wine']} />
    );
    fireEvent.click(screen.getByRole('button', { name: /create/i }));
    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
  });

  it('ignores rapid double-submit — createField called exactly once', async () => {
    let resolveCreate!: (v: unknown) => void;
    const spy = vi.spyOn(api, 'createField').mockReturnValue(
      new Promise((res) => { resolveCreate = res; }) as never,
    );
    render(
      <NewFieldModal open={true} onClose={vi.fn()} onCreated={vi.fn()} farms={FARMS} enterprises={['rooibos', 'wine']} />
    );
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Blok' } });
    fireEvent.change(screen.getByLabelText(/enterprise/i), { target: { value: 'rooibos' } });
    fireEvent.change(screen.getByLabelText(/area/i), { target: { value: '10' } });

    const btn = screen.getByRole('button', { name: /create/i });
    fireEvent.click(btn);  // first click — triggers the pending promise
    fireEvent.click(btn);  // second click — should be ignored by guard

    // resolve to avoid promise leak
    await act(async () => { resolveCreate({ id: 'x' }); });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('accepts optional pre-filled geometry + area (from 5m FIELD branch)', async () => {
    const spy = vi.spyOn(api, 'createField').mockResolvedValue({ id: 'n' } as never);
    const geom = { type: 'Polygon' as const, coordinates: [[[0,0],[1,0],[1,1],[0,0]]] };
    render(
      <NewFieldModal
        open={true}
        onClose={vi.fn()}
        onCreated={vi.fn()}
        farms={FARMS}
        enterprises={['rooibos']}
        geometry={geom}
        areaHa={80.72}
      />
    );
    // Area field is pre-filled and read-only when provided
    const area = screen.getByLabelText(/area/i) as HTMLInputElement;
    expect(area.value).toBe('80.72');
    // Submit should pass the pre-filled area and geometry
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'New block' } });
    fireEvent.change(screen.getByLabelText(/enterprise/i), { target: { value: 'rooibos' } });
    fireEvent.click(screen.getByRole('button', { name: /create/i }));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    const call = spy.mock.calls[0][0];
    expect(call.area_ha).toBe(80.72);
    expect(call.geometry).toBeTruthy();
  });
});
