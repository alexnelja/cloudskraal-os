import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SaveAsChooserPopover from './SaveAsChooserPopover';

describe('SaveAsChooserPopover', () => {
  const polygon = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } as GeoJSON.Geometry;
  const line = { type: 'LineString', coordinates: [[0, 0], [1, 1]] } as GeoJSON.Geometry;

  it('shows four destinations for a polygon', () => {
    render(<SaveAsChooserPopover geometry={polygon} onPick={vi.fn()} onDiscard={vi.fn()} />);
    expect(screen.getByRole('button', { name: /field/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /feature/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /measurement/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /^note$/i })).toBeEnabled();
  });

  it('disables FIELD for a line', () => {
    render(<SaveAsChooserPopover geometry={line} onPick={vi.fn()} onDiscard={vi.fn()} />);
    expect(screen.getByRole('button', { name: /field/i })).toBeDisabled();
  });

  it('fires onPick with the chosen destination', () => {
    const onPick = vi.fn();
    render(<SaveAsChooserPopover geometry={polygon} onPick={onPick} onDiscard={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /measurement/i }));
    expect(onPick).toHaveBeenCalledWith('measurement');
  });

  it('disables MEASUREMENT for a point geometry', () => {
    const point = { type: 'Point', coordinates: [0, 0] } as GeoJSON.Geometry;
    render(<SaveAsChooserPopover geometry={point} onPick={vi.fn()} onDiscard={vi.fn()} />);
    expect(screen.getByRole('button', { name: /measurement/i })).toBeDisabled();
  });
});
