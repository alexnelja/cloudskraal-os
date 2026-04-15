import { useState } from 'react';
import type { Annotation, AnnotationType } from '../../types/annotation';
import { formatDistance, formatArea } from './tools/metricFormat';

interface AnnotationsSidebarProps {
  open: boolean;
  annotations: Annotation[];
  selectedId: string | null;
  onToggle: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

type FilterValue = 'all' | AnnotationType;

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'line', label: 'Lines' },
  { value: 'polygon', label: 'Polygons' },
  { value: 'pin', label: 'Pins' },
];

function typeIcon(type: AnnotationType): string {
  if (type === 'line') return '📏';
  if (type === 'polygon') return '⬡';
  return '📍';
}

function metricFor(a: Annotation): string {
  if (a.type === 'line') return formatDistance(a.length_m);
  if (a.type === 'polygon') return formatArea(a.area_m2);
  return '';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export default function AnnotationsSidebar({
  open,
  annotations,
  selectedId,
  onToggle,
  onSelect,
  onDelete,
}: AnnotationsSidebarProps) {
  const [filter, setFilter] = useState<FilterValue>('all');
  if (!open) return null;

  const filtered = filter === 'all' ? annotations : annotations.filter((a) => a.type === filter);

  return (
    <div className="absolute right-0 top-0 h-full w-80 bg-white border-l border-gray-200 shadow-lg flex flex-col z-20">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <span className="font-semibold">Annotations</span>
          <span
            data-testid="annotation-count"
            className="text-xs bg-gray-200 text-gray-700 rounded-full px-2 py-0.5"
          >
            {annotations.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="text-gray-500 hover:text-gray-800 text-lg"
          aria-label="Close sidebar"
        >
          ×
        </button>
      </div>

      <div className="flex gap-1 px-4 py-2 border-b overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1 text-xs rounded-full whitespace-nowrap ${
              filter === f.value
                ? 'bg-amber-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            No annotations yet — draw on the map and save.
          </div>
        ) : (
          <ul>
            {filtered.map((a) => {
              const isSelected = a.id === selectedId;
              return (
                <li
                  key={a.id}
                  data-annotation-row
                  data-selected={isSelected}
                  className={`border-b px-4 py-3 cursor-pointer hover:bg-gray-50 ${
                    isSelected ? 'bg-amber-50' : ''
                  }`}
                  onClick={() => onSelect(a.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span>{typeIcon(a.type)}</span>
                        <span className="font-medium truncate">{a.title}</span>
                      </div>
                      {metricFor(a) && (
                        <div className="text-xs text-gray-600 mt-0.5">{metricFor(a)}</div>
                      )}
                      <div className="text-xs text-gray-400 mt-0.5">{formatDate(a.created_at)}</div>
                    </div>
                    <button
                      type="button"
                      aria-label="Delete annotation"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Delete "${a.title}"?`)) onDelete(a.id);
                      }}
                      className="text-gray-400 hover:text-red-600 text-xs"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
