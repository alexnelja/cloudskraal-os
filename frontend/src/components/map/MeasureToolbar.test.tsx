import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MeasureToolbar from './MeasureToolbar';

type MockTerraDraw = { setMode: ReturnType<typeof vi.fn> };

function makeTd(): MockTerraDraw {
  return { setMode: vi.fn() };
}

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
});
