import { useState } from 'react';
import { Ruler, Polygon as PolyIcon, MapPin, ArrowsOut as Line } from '@phosphor-icons/react';
import SaveAsChooserPopover from './SaveAsChooserPopover';

type TerraDraw = { setMode: (mode: string) => void };
type SaveDestination = 'field' | 'feature' | 'measurement' | 'note';

interface MeasureToolbarProps {
  terraDraw: TerraDraw | null;
  currentMode: string;
  /** Set when a draw has finished and we're back in static mode. */
  finishedGeometry?: GeoJSON.Geometry | null;
  /** Formatted measurement text (e.g. "1.23 km"). */
  measurementText?: string | null;
  onPick?: (dest: SaveDestination) => void;
  onDiscard?: () => void;
}

interface ModeDef {
  id: string;
  label: string;
  mode: 'linestring' | 'polygon' | 'point';
  icon: typeof Ruler;
  shape: 'line' | 'poly';
}

// Map four UX buttons onto three TerraDraw modes.
// "Distance" and "Draw polygon" both use linestring/polygon draw modes,
// "Area" is also polygon with a different intent label, "Drop pin" is point.
const MODES: ModeDef[] = [
  { id: 'distance', label: 'Measure distance', mode: 'linestring', icon: Line, shape: 'line' },
  { id: 'area', label: 'Measure area', mode: 'polygon', icon: Ruler, shape: 'poly' },
  { id: 'pin', label: 'Drop pin', mode: 'point', icon: MapPin, shape: 'line' },
  { id: 'polygon', label: 'Draw polygon', mode: 'polygon', icon: PolyIcon, shape: 'poly' },
];

export default function MeasureToolbar({
  terraDraw,
  currentMode,
  finishedGeometry = null,
  measurementText = null,
  onPick,
  onDiscard,
}: MeasureToolbarProps) {
  const [chooserOpen, setChooserOpen] = useState(false);

  if (!terraDraw) return null;

  const showSavePanel = finishedGeometry != null && (currentMode === 'static' || currentMode === 'render');

  function handlePick(dest: SaveDestination) {
    setChooserOpen(false);
    onPick?.(dest);
  }

  function handleDiscard() {
    setChooserOpen(false);
    onDiscard?.();
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="glass-panel rounded-[16px] p-1.5 flex gap-1"
        role="toolbar"
        aria-label="Measure tools"
      >
        {MODES.map((m) => {
          const active = currentMode === m.mode;
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                // Reset to render (default) mode first, then activate the target
                // mode. The library's own button handlers do the same sequence
                // internally (resetActiveMode → setMode). Without the reset step,
                // the Proxy's handleModeChange path skips it and the map never
                // enters active draw mode.
                terraDraw.setMode('render');
                terraDraw.setMode(m.mode);
              }}
              aria-label={m.label}
              aria-pressed={active}
              title={m.label}
              className={`w-[34px] h-[34px] rounded-[10px] flex items-center justify-center transition-colors ${
                active
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Icon size={18} weight="regular" />
            </button>
          );
        })}
      </div>

      {showSavePanel && (
        <div className="glass-panel rounded-[16px] p-2 flex flex-col gap-2 min-w-[180px]">
          <div className="flex items-center justify-between px-2 py-1 bg-stone-50/70 rounded-full text-[11px]">
            <span className="font-mono text-amber-800 font-semibold">{measurementText}</span>
            <button
              type="button"
              aria-label="Dismiss chip"
              onClick={handleDiscard}
              className="text-stone-400 hover:text-stone-700 ml-2 leading-none"
            >
              ×
            </button>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              aria-label="Save as"
              onClick={() => setChooserOpen((v) => !v)}
              className="flex-1 bg-amber-600 text-white rounded-lg px-2 py-1.5 text-[11px] font-medium hover:bg-amber-700 transition-colors"
            >
              + Save as ▾
            </button>
            <button
              type="button"
              aria-label="Discard"
              onClick={handleDiscard}
              className="glass-button rounded-lg px-2 py-1.5 text-[11px] text-stone-700"
            >
              Discard
            </button>
          </div>
          {chooserOpen && (
            <SaveAsChooserPopover
              geometry={finishedGeometry}
              onPick={handlePick}
              onDiscard={() => setChooserOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
