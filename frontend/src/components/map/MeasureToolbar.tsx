import { Ruler, Polygon as PolyIcon, MapPin, ArrowsOut as Line } from '@phosphor-icons/react';

type TerraDraw = { setMode: (mode: string) => void };

interface MeasureToolbarProps {
  terraDraw: TerraDraw | null;
  currentMode: string;
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

export default function MeasureToolbar({ terraDraw, currentMode }: MeasureToolbarProps) {
  if (!terraDraw) return null;

  return (
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
            onClick={() => terraDraw.setMode(m.mode)}
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
  );
}
