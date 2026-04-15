import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SaveAnnotationModal from './SaveAnnotationModal';
import type { AnnotationType } from '../../types/annotation';

function renderModal(overrides: Partial<React.ComponentProps<typeof SaveAnnotationModal>> = {}) {
  const props = {
    open: true,
    type: 'pin' as AnnotationType,
    geometry: { type: 'Point', coordinates: [0, 0] } as GeoJSON.Geometry,
    onSave: vi.fn(),
    onDiscard: vi.fn(),
    ...overrides,
  };
  return { ...props, ...render(<SaveAnnotationModal {...props} />) };
}

describe('SaveAnnotationModal', () => {
  beforeEach(cleanup);

  it('renders title and notes inputs and action buttons', () => {
    renderModal();
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument();
  });

  it('Save button is disabled when title is empty', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('Save button enables after typing a title', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByLabelText(/title/i), 'Fence');
    expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
  });

  it('computes and displays "m" for a short line', () => {
    renderModal({
      type: 'line',
      // ~1 minute of latitude = ~1852 m. Short line within that range.
      geometry: {
        type: 'LineString',
        coordinates: [[0, 0], [0, 0.002]], // ~222 m
      },
    });
    const metric = screen.getByTestId('annotation-metric');
    expect(metric.textContent).toMatch(/\d+\s*m\b/);
  });

  it('computes and displays "ha" for a polygon over 1 hectare', () => {
    renderModal({
      type: 'polygon',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [0, 0],
          [0.002, 0],
          [0.002, 0.002],
          [0, 0.002],
          [0, 0],
        ]],
      },
    });
    expect(screen.getByTestId('annotation-metric').textContent).toMatch(/ha\b/);
  });

  it('shows no metric for a pin', () => {
    renderModal({ type: 'pin' });
    expect(screen.queryByTestId('annotation-metric')).not.toBeInTheDocument();
  });

  it('Save calls onSave with {type, title, notes, geometry}', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const geometry = { type: 'Point', coordinates: [19.0, -31.3] } as GeoJSON.Geometry;
    renderModal({ onSave, geometry, type: 'pin' });
    await user.type(screen.getByLabelText(/title/i), 'Gate');
    await user.type(screen.getByLabelText(/notes/i), 'broken latch');
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith({
      type: 'pin',
      title: 'Gate',
      notes: 'broken latch',
      geometry,
    });
  });

  it('Discard calls onDiscard', async () => {
    const user = userEvent.setup();
    const onDiscard = vi.fn();
    renderModal({ onDiscard });
    await user.click(screen.getByRole('button', { name: /discard/i }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when open=false', () => {
    const { container } = renderModal({ open: false });
    expect(container.firstChild).toBeNull();
  });
});
