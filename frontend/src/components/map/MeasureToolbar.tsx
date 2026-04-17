import { useState } from 'react';
import { Ruler, Polygon as PolyIcon, MapPin, Hand, ArrowUUpLeft, ArrowUUpRight } from '@phosphor-icons/react';
import SaveAsChooserPopover from './SaveAsChooserPopover';

type TerraDraw = { setMode: (mode: string) => void; undo?: () => boolean; redo?: () => boolean };
type SaveDestination = 'field' | 'feature' | 'measurement' | 'note';

function getDefaultDestination(geometry: GeoJSON.Geometry): { dest: SaveDestination; label: string } {
  switch (geometry.type) {
    case 'Polygon':
    case 'MultiPolygon':
      return { dest: 'field', label: 'Save as Field' };
    case 'LineString':
    case 'MultiLineString':
      return { dest: 'measurement', label: 'Save as Measurement' };
    case 'Point':
    case 'MultiPoint':
      return { dest: 'note', label: 'Save as Note' };
    default:
      return { dest: 'feature', label: 'Save as Feature' };
  }
}

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

const MODES: ModeDef[] = [
  { id: 'distance', label: 'Measure distance', mode: 'linestring', icon: Ruler, shape: 'line' },
  { id: 'polygon', label: 'Draw polygon / area', mode: 'polygon', icon: PolyIcon, shape: 'poly' },
  { id: 'pin', label: 'Drop pin', mode: 'point', icon: MapPin, shape: 'line' },
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

  const isPanMode = currentMode === 'render' || currentMode === 'static';
  const showSavePanel = finishedGeometry != null && isPanMode;

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
        <button
          type="button"
          onClick={() => terraDraw.setMode('render')}
          aria-label="Pan mode"
          aria-pressed={isPanMode}
          title="Pan mode (Esc)"
          className={`w-[34px] h-[34px] rounded-[10px] flex items-center justify-center transition-colors ${
            isPanMode
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
          }`}
        >
          <Hand size={18} weight="regular" />
        </button>
        {MODES.map((m) => {
          const active = currentMode === m.mode;
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                if (active) {
                  terraDraw.setMode('render');
                } else {
                  terraDraw.setMode('render');
                  terraDraw.setMode(m.mode);
                }
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
        {!isPanMode && terraDraw.undo && (
          <>
            <div className="w-px h-5 bg-stone-200" />
            <button
              type="button"
              onClick={() => terraDraw.undo?.()}
              aria-label="Undo"
              title="Undo (⌘Z)"
              className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center bg-stone-50 text-stone-600 hover:bg-stone-100 transition-colors"
            >
              <ArrowUUpLeft size={16} weight="regular" />
            </button>
            <button
              type="button"
              onClick={() => terraDraw.redo?.()}
              aria-label="Redo"
              title="Redo (⇧⌘Z)"
              className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center bg-stone-50 text-stone-600 hover:bg-stone-100 transition-colors"
            >
              <ArrowUUpRight size={16} weight="regular" />
            </button>
          </>
        )}
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
            <div className="flex gap-0.5 flex-1">
              <button
                type="button"
                aria-label={getDefaultDestination(finishedGeometry).label}
                onClick={() => handlePick(getDefaultDestination(finishedGeometry).dest)}
                className="flex-1 bg-amber-600 text-white rounded-l-lg px-2 py-1.5 text-[11px] font-medium hover:bg-amber-700 transition-colors"
              >
                + {getDefaultDestination(finishedGeometry).label}
              </button>
              <button
                type="button"
                aria-label="More save options"
                onClick={() => setChooserOpen((v) => !v)}
                className="bg-amber-600 text-white rounded-r-lg px-2 py-1.5 text-[11px] font-medium hover:bg-amber-700 transition-colors"
              >
                ▾
              </button>
            </div>
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
