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

  it('renders pan + 3 mode buttons when terraDraw is ready', () => {
    const td = makeTd();
    render(<MeasureToolbar terraDraw={td as never} currentMode="render" />);
    expect(screen.getByRole('button', { name: /pan mode/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /measure distance/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /draw polygon/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /drop pin/i })).toBeInTheDocument();
  });

  it('calls setMode with render then linestring when distance is clicked', () => {
    const td = makeTd();
    render(<MeasureToolbar terraDraw={td as never} currentMode="render" />);
    fireEvent.click(screen.getByRole('button', { name: /measure distance/i }));
    expect(td.setMode).toHaveBeenNthCalledWith(1, 'render');
    expect(td.setMode).toHaveBeenNthCalledWith(2, 'linestring');
  });

  it('toggling an active mode deactivates it back to render', () => {
    const td = makeTd();
    render(<MeasureToolbar terraDraw={td as never} currentMode="polygon" />);
    fireEvent.click(screen.getByRole('button', { name: /draw polygon/i }));
    expect(td.setMode).toHaveBeenCalledWith('render');
    expect(td.setMode).toHaveBeenCalledTimes(1);
  });

  it('highlights the active mode with aria-pressed=true', () => {
    const td = makeTd();
    render(<MeasureToolbar terraDraw={td as never} currentMode="polygon" />);
    const poly = screen.getByRole('button', { name: /draw polygon/i });
    expect(poly).toHaveAttribute('aria-pressed', 'true');
    const line = screen.getByRole('button', { name: /measure distance/i });
    expect(line).toHaveAttribute('aria-pressed', 'false');
  });

  it('pan button highlighted in render mode', () => {
    const td = makeTd();
    render(<MeasureToolbar terraDraw={td as never} currentMode="render" />);
    const pan = screen.getByRole('button', { name: /pan mode/i });
    expect(pan).toHaveAttribute('aria-pressed', 'true');
  });

  it('pan button exits draw mode back to render', () => {
    const td = makeTd();
    render(<MeasureToolbar terraDraw={td as never} currentMode="linestring" />);
    fireEvent.click(screen.getByRole('button', { name: /pan mode/i }));
    expect(td.setMode).toHaveBeenCalledWith('render');
  });

  it('renders save-as panel when finishedGeometry is set and mode is render', () => {
    const td = makeTd();
    render(
      <MeasureToolbar
        terraDraw={td as never}
        currentMode="render"
        finishedGeometry={lineGeometry}
        measurementText="1.23 km"
        onPick={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    expect(screen.getByText('1.23 km')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save as/i })).toBeInTheDocument();
  });

  it('does not render save-as panel when mode is active draw', () => {
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
        currentMode="render"
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
        currentMode="render"
        finishedGeometry={lineGeometry}
        measurementText="1.23 km"
        onPick={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /save as/i }));
    expect(screen.getByRole('button', { name: /measurement/i })).toBeInTheDocument();
  });
});
