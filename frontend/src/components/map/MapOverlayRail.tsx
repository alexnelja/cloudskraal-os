import type { ReactNode } from 'react';

export type RailPosition = 'tl' | 'tr' | 'bl' | 'br';

interface MapOverlayRailProps {
  position: RailPosition;
  className?: string;
  children: ReactNode;
}

/**
 * Positions its children in a fixed corner of the map container with
 * shared spacing tokens (--overlay-inset, --overlay-gap). Rail itself
 * is pointer-events:none; children get pointer-events:auto — so gaps
 * between overlays pass clicks through to the map underneath.
 */
export default function MapOverlayRail({
  position,
  className,
  children,
}: MapOverlayRailProps) {
  const classes = ['map-rail', `map-rail--${position}`, className]
    .filter(Boolean)
    .join(' ');
  return <div className={classes}>{children}</div>;
}
