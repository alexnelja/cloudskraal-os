import { useState } from 'react';
import { Layers } from 'lucide-react';
import type { MapLayer } from '../../types/farm';

interface LayerControlProps {
  layers: MapLayer[];
  onToggle: (layerId: string, visible: boolean) => void;
  onOpacityChange: (layerId: string, opacity: number) => void;
}

const CATEGORY_ORDER = [
  'Soils',
  'Climate',
  'Vegetation',
  'Geology',
  'Topography',
  'Boundaries',
  'Agriculture',
];

function groupByCategory(layers: MapLayer[]): Record<string, MapLayer[]> {
  const groups: Record<string, MapLayer[]> = {};
  for (const layer of layers) {
    const cat = layer.category || 'Other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(layer);
  }
  return groups;
}

export default function LayerControl({ layers, onToggle, onOpacityChange }: LayerControlProps) {
  const [expanded, setExpanded] = useState(false);

  const grouped = groupByCategory(layers);
  const categories = [
    ...CATEGORY_ORDER.filter(c => grouped[c]),
    ...Object.keys(grouped).filter(c => !CATEGORY_ORDER.includes(c)),
  ];

  return (
    <div className="absolute top-3 right-12 z-10">
      {/* Toggle button */}
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="bg-white rounded-xl shadow-lg p-2 flex items-center justify-center hover:bg-stone-50 transition-colors"
        title="Toggle GIS layers"
        aria-label="Toggle GIS layer panel"
      >
        <Layers size={18} className={expanded ? 'text-emerald-700' : 'text-stone-600'} />
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="mt-1 bg-white rounded-xl shadow-lg w-64 max-h-[60vh] overflow-y-auto">
          <div className="px-3 py-2 border-b border-[#f3f4f3]">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">GIS Layers</p>
          </div>

          {categories.length === 0 ? (
            <p className="px-3 py-3 text-xs text-stone-400">No layers available.</p>
          ) : (
            categories.map(category => (
              <div key={category}>
                <div className="px-3 py-1.5 bg-[#f3f4f3] border-b border-[#f3f4f3]">
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">{category}</p>
                </div>
                {grouped[category].map(layer => (
                  <LayerRow
                    key={layer.id}
                    layer={layer}
                    onToggle={onToggle}
                    onOpacityChange={onOpacityChange}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface LayerRowProps {
  layer: MapLayer;
  onToggle: (layerId: string, visible: boolean) => void;
  onOpacityChange: (layerId: string, opacity: number) => void;
}

function LayerRow({ layer, onToggle, onOpacityChange }: LayerRowProps) {
  return (
    <div className="px-3 py-2 border-b border-[#f3f4f3] last:border-b-0">
      {/* Toggle row */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-stone-700 flex-1 leading-tight">{layer.name}</span>
        {/* Toggle switch */}
        <button
          role="switch"
          aria-checked={layer.visible}
          onClick={() => onToggle(layer.id, !layer.visible)}
          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
            layer.visible ? 'bg-emerald-600' : 'bg-stone-300'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
              layer.visible ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Opacity slider — only when visible */}
      {layer.visible && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-stone-400 w-12 flex-shrink-0">Opacity</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(layer.opacity * 100)}
            onChange={e => onOpacityChange(layer.id, Number(e.target.value) / 100)}
            className="flex-1 h-1 accent-emerald-600 cursor-pointer"
          />
          <span className="text-xs text-stone-400 w-8 text-right flex-shrink-0">
            {Math.round(layer.opacity * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}
