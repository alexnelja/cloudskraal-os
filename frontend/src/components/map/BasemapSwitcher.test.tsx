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
      /esri world topo/i,
      /opentopomap/i,
      /carto dark/i,
      /blue marble/i,
      /25 cm aerial/i,
      /50 cm aerial/i,
      /topocadastral/i,
      /hillshade dark/i,
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

  it('renders a coverage pill for entries that declare coverage', () => {
    render(<BasemapSwitcher current="satellite" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /basemap/i }));

    // WC entry has a visible pill reading "WC"
    const ngi2021 = screen.getByTitle(/25 cm aerial/i);
    expect(ngi2021.textContent).toContain('WC');

    // A pre-existing entry without coverage has no pill
    const satellite = screen.getByTitle(/esri world imagery/i);
    expect(satellite.textContent).not.toContain('WC');
    expect(satellite.textContent).not.toContain('SA');
    expect(satellite.textContent).not.toContain('Global');
  });
});
