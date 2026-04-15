import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MapOverlayRail from './MapOverlayRail';

describe('MapOverlayRail', () => {
  it('renders children inside the rail', () => {
    render(
      <MapOverlayRail position="tl">
        <button>one</button>
        <button>two</button>
      </MapOverlayRail>,
    );
    expect(screen.getByText('one')).toBeInTheDocument();
    expect(screen.getByText('two')).toBeInTheDocument();
  });

  it('applies the correct position modifier class', () => {
    const { container, rerender } = render(
      <MapOverlayRail position="tl">
        <span>x</span>
      </MapOverlayRail>,
    );
    expect(container.firstChild).toHaveClass('map-rail', 'map-rail--tl');

    rerender(
      <MapOverlayRail position="br">
        <span>x</span>
      </MapOverlayRail>,
    );
    expect(container.firstChild).toHaveClass('map-rail', 'map-rail--br');
    expect(container.firstChild).not.toHaveClass('map-rail--tl');
  });

  it('supports all four corner variants', () => {
    for (const pos of ['tl', 'tr', 'bl', 'br'] as const) {
      const { container, unmount } = render(
        <MapOverlayRail position={pos}>
          <span>x</span>
        </MapOverlayRail>,
      );
      expect(container.firstChild).toHaveClass(`map-rail--${pos}`);
      unmount();
    }
  });

  it('merges custom className onto the rail', () => {
    const { container } = render(
      <MapOverlayRail position="tl" className="w-full md:w-72">
        <span>x</span>
      </MapOverlayRail>,
    );
    expect(container.firstChild).toHaveClass('map-rail', 'map-rail--tl', 'w-full', 'md:w-72');
  });
});
