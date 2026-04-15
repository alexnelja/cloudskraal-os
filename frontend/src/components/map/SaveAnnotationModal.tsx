import { useEffect, useMemo, useState } from 'react';
import length from '@turf/length';
import area from '@turf/area';
import { lineString, polygon } from '@turf/helpers';
import type { AnnotationType, CreateAnnotationInput } from '../../types/annotation';
import { formatDistance, formatArea } from './tools/metricFormat';
import { CATEGORIES, getCategoryDef } from './annotationCategories';

interface SaveAnnotationModalProps {
  open: boolean;
  type: AnnotationType;
  geometry: GeoJSON.Geometry;
  onSave: (input: CreateAnnotationInput) => void;
  onDiscard: () => void;
}

function computeMetricLabel(type: AnnotationType, geometry: GeoJSON.Geometry): string | null {
  try {
    if (type === 'line' && geometry.type === 'LineString') {
      const meters = length(lineString(geometry.coordinates), { units: 'meters' });
      return formatDistance(meters);
    }
    if (type === 'polygon' && geometry.type === 'Polygon') {
      const m2 = area(polygon(geometry.coordinates));
      return formatArea(m2);
    }
  } catch {
    return null;
  }
  return null;
}

export default function SaveAnnotationModal({
  open,
  type,
  geometry,
  onSave,
  onDiscard,
}: SaveAnnotationModalProps) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<string>('generic');

  // Reset when type changes so the picker shows valid options
  useEffect(() => {
    setCategory('generic');
  }, [type]);

  // Reset form when reopened
  useEffect(() => {
    if (!open) {
      setTitle('');
      setNotes('');
      setCategory('generic');
    }
  }, [open]);

  const metric = useMemo(() => computeMetricLabel(type, geometry), [type, geometry]);
  const categories = CATEGORIES[type] ?? [];
  const selectedDef = getCategoryDef(type, category);
  const SelectedIcon = selectedDef.Icon;

  if (!open) return null;

  const canSave = title.trim().length > 0;
  const handleSave = () => {
    if (!canSave) return;
    onSave({
      type,
      title: title.trim(),
      notes: notes.trim() || null,
      geometry,
      category,
    });
  };

  const typeLabel = type === 'line' ? 'Line' : type === 'polygon' ? 'Area' : 'Pin';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-md bg-amber-50 text-amber-700">
            <SelectedIcon size={22} weight="regular" />
          </div>
          <h2 className="text-xl font-semibold">
            Save {typeLabel}
            <span className="text-sm font-normal text-gray-500 ml-2">{selectedDef.label}</span>
          </h2>
        </div>
        {metric && (
          <p className="text-sm text-gray-600 mb-4" data-testid="annotation-metric">
            {metric}
          </p>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="ann-title" className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              id="ann-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="e.g. Broken fence"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
            <div
              className="grid grid-cols-4 gap-1.5"
              role="radiogroup"
              aria-label="Category"
            >
              {categories.map((c) => {
                const Icon = c.Icon;
                const isSelected = c.id === category;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={c.label}
                    data-category={c.id}
                    onClick={() => setCategory(c.id)}
                    className={`flex flex-col items-center justify-center gap-1 p-2 rounded-md border text-xs transition ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50 text-amber-800 ring-1 ring-amber-400'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <Icon size={20} weight={isSelected ? 'fill' : 'regular'} />
                    <span className="text-[10px] leading-tight text-center">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="ann-notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              id="ann-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Optional context"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onDiscard}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
