type SaveDestination = 'field' | 'feature' | 'measurement' | 'note';

interface SaveAsChooserPopoverProps {
  geometry: GeoJSON.Geometry;
  onPick: (dest: SaveDestination) => void;
  onDiscard: () => void;
}

interface DestDef {
  id: SaveDestination;
  label: string;
  /** Returns true if this destination is available for the given geometry type */
  available: (geo: GeoJSON.Geometry) => boolean;
}

const DESTINATIONS: DestDef[] = [
  {
    id: 'field',
    label: 'Field',
    available: (geo) => geo.type === 'Polygon' || geo.type === 'MultiPolygon',
  },
  {
    id: 'feature',
    label: 'Feature',
    available: () => true,
  },
  {
    id: 'measurement',
    label: 'Measurement',
    // Measurements make sense for lines and polygons, not bare points
    available: (geo) => geo.type !== 'Point' && geo.type !== 'MultiPoint',
  },
  {
    id: 'note',
    label: 'Note',
    available: () => true,
  },
];

export default function SaveAsChooserPopover({
  geometry,
  onPick,
  onDiscard,
}: SaveAsChooserPopoverProps) {
  return (
    <div
      className="glass-panel rounded-xl p-2 flex flex-col gap-1 min-w-[140px]"
      role="dialog"
      aria-label="Save as"
    >
      {DESTINATIONS.map((dest) => {
        const enabled = dest.available(geometry);
        return (
          <button
            key={dest.id}
            type="button"
            aria-label={dest.label}
            disabled={!enabled}
            onClick={() => {
              if (enabled) onPick(dest.id);
            }}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium text-left transition-colors ${
              enabled
                ? 'text-stone-800 hover:bg-amber-50 hover:text-amber-800'
                : 'text-stone-400 cursor-not-allowed'
            }`}
          >
            {dest.label}
          </button>
        );
      })}
      <div className="border-t border-stone-200/60 mt-1 pt-1">
        <button
          type="button"
          aria-label="Cancel save"
          onClick={onDiscard}
          className="px-3 py-1 rounded-lg text-[11px] text-stone-500 hover:text-stone-700 w-full text-left"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
