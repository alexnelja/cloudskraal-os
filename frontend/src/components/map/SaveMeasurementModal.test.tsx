import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import SaveMeasurementModal from './SaveMeasurementModal';
import * as measurementsApi from '../../api/measurements';

vi.mock('../../api/measurements');

describe('SaveMeasurementModal', () => {
  const defaultProps = {
    open: true,
    kind: 'length' as const,
    value: 1234.5,
    unit: 'm' as const,
    formatted: '1.23 km',
    geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } as GeoJSON.Geometry,
    onSaved: vi.fn(),
    onDiscard: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders name input and save button when open', () => {
    render(<SaveMeasurementModal {...defaultProps} />);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('shows formatted measurement value', () => {
    render(<SaveMeasurementModal {...defaultProps} />);
    expect(screen.getByText('1.23 km')).toBeInTheDocument();
  });

  it('requires a name before saving', async () => {
    render(<SaveMeasurementModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
    expect(measurementsApi.createMeasurement).not.toHaveBeenCalled();
  });

  it('calls createMeasurement with correct payload and fires onSaved', async () => {
    const onSaved = vi.fn();
    const created = { ...defaultProps, id: 'abc', created_at: '2026-01-01' };
    vi.mocked(measurementsApi.createMeasurement).mockResolvedValue(created as never);

    render(<SaveMeasurementModal {...defaultProps} onSaved={onSaved} />);
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Fence line' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(measurementsApi.createMeasurement).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Fence line',
          kind: 'length',
          value: 1234.5,
          unit: 'm',
          formatted: '1.23 km',
        }),
      );
      expect(onSaved).toHaveBeenCalled();
    });
  });

  it('renders nothing when open=false', () => {
    const { container } = render(<SaveMeasurementModal {...defaultProps} open={false} />);
    expect(container.firstChild).toBeNull();
  });
});
