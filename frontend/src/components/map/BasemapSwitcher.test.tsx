import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BasemapSwitcher from './BasemapSwitcher';

describe('BasemapSwitcher', () => {
  it('renders the current basemap label on the toggle button', () => {
    render(<BasemapSwitcher current="topographic" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /basemap/i }).textContent).toMatch(/topo/i);
  });

  it('reveals all basemap tiles when opened', () => {
    render(<BasemapSwitcher current="satellite" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /basemap/i }));
    for (const desc of [
      /esri world imagery/i,
      /road \+ place/i,
      /openstreetmap/i,
      /world topo/i,
      /opentopomap/i,
      /carto dark/i,
      /blue marble/i,
    ]) {
      expect(screen.getByTitle(desc)).toBeInTheDocument();
    }
  });

  it('fires onChange with the picked id and closes the popover', () => {
    const onChange = vi.fn();
    render(<BasemapSwitcher current="satellite" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /basemap/i }));
    fireEvent.click(screen.getByTitle(/carto dark/i));
    expect(onChange).toHaveBeenCalledWith('dark');
  });

  it('marks the current basemap as selected in the popover', () => {
    render(<BasemapSwitcher current="streets" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /basemap/i }));
    const selected = screen.getByTitle(/openstreetmap/i);
    expect(selected).toHaveAttribute('aria-current', 'true');
  });
});
