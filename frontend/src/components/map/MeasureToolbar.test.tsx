import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MeasureToolbar from './MeasureToolbar';

type MockTerraDraw = { setMode: ReturnType<typeof vi.fn> };

function makeTd(): MockTerraDraw {
  return { setMode: vi.fn() };
}

const lineGeometry: GeoJSON.Geometry = { type: 'LineString', coordinates: [[0, 0], [1, 1]] };

describe('MeasureToolbar', () => {
  it('renders nothing when terraDraw is null', () => {
    const { container } = render(<MeasureToolbar terraDraw={null} currentMode="static" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders 4 mode buttons when terraDraw is ready', () => {
    const td = makeTd();
    render(<MeasureToolbar terraDraw={td as never} currentMode="static" />);
    expect(screen.getByRole('button', { name: /measure distance/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /measure area/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /drop pin/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /draw polygon/i })).toBeInTheDocument();
  });

  it('calls setMode with linestring when distance is clicked', () => {
    const td = makeTd();
    render(<MeasureToolbar terraDraw={td as never} currentMode="static" />);
    fireEvent.click(screen.getByRole('button', { name: /measure distance/i }));
    expect(td.setMode).toHaveBeenCalledWith('linestring');
  });

  it('highlights the active mode with aria-pressed=true', () => {
    const td = makeTd();
    render(<MeasureToolbar terraDraw={td as never} currentMode="polygon" />);
    const poly = screen.getByRole('button', { name: /measure area/i });
    expect(poly).toHaveAttribute('aria-pressed', 'true');
    const line = screen.getByRole('button', { name: /measure distance/i });
    expect(line).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders save-as panel when finishedGeometry is set and mode is static', () => {
    const td = makeTd();
    render(
      <MeasureToolbar
        terraDraw={td as never}
        currentMode="static"
        finishedGeometry={lineGeometry}
        measurementText="1.23 km"
        onPick={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    expect(screen.getByText('1.23 km')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save as/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument();
  });

  it('does not render save-as panel when mode is not static', () => {
    const td = makeTd();
    render(
      <MeasureToolbar
        terraDraw={td as never}
        currentMode="linestring"
        finishedGeometry={lineGeometry}
        measurementText="1.23 km"
        onPick={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    expect(screen.queryByText('1.23 km')).not.toBeInTheDocument();
  });

  it('calls onDiscard when DISCARD button is clicked', () => {
    const td = makeTd();
    const onDiscard = vi.fn();
    render(
      <MeasureToolbar
        terraDraw={td as never}
        currentMode="static"
        finishedGeometry={lineGeometry}
        measurementText="1.23 km"
        onPick={vi.fn()}
        onDiscard={onDiscard}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /discard/i }));
    expect(onDiscard).toHaveBeenCalled();
  });

  it('opens chooser popover when SAVE AS is clicked', () => {
    const td = makeTd();
    render(
      <MeasureToolbar
        terraDraw={td as never}
        currentMode="static"
        finishedGeometry={lineGeometry}
        measurementText="1.23 km"
        onPick={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /save as/i }));
    expect(screen.getByRole('button', { name: /measurement/i })).toBeInTheDocument();
  });

  it('hides save-as panel when finishedGeometry is cleared (Fix 1 — no dual-modal flash)', () => {
    // Simulate parent clearing finishedGeometry after FEATURE/NOTE pick:
    // panel should disappear when finishedGeometry becomes null.
    const td = makeTd();
    const { rerender } = render(
      <MeasureToolbar
        terraDraw={td as never}
        currentMode="static"
        finishedGeometry={lineGeometry}
        measurementText="1.23 km"
        onPick={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    // Panel is visible initially.
    expect(screen.getByRole('button', { name: /save as/i })).toBeInTheDocument();

    // Parent clears finishedGeometry (as handleSaveAsPick does for FEATURE/NOTE).
    rerender(
      <MeasureToolbar
        terraDraw={td as never}
        currentMode="static"
        finishedGeometry={null}
        measurementText={null}
        onPick={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    // Panel must be gone — no dual-modal flash.
    expect(screen.queryByRole('button', { name: /save as/i })).not.toBeInTheDocument();
  });
});
