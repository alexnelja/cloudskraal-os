import { useMemo, useState } from 'react';
import length from '@turf/length';
import area from '@turf/area';
import { lineString, polygon } from '@turf/helpers';
import type { AnnotationType, CreateAnnotationInput } from '../../types/annotation';
import { formatDistance, formatArea } from './tools/metricFormat';

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

  const metric = useMemo(() => computeMetricLabel(type, geometry), [type, geometry]);

  if (!open) return null;

  const canSave = title.trim().length > 0;
  const handleSave = () => {
    if (!canSave) return;
    onSave({ type, title: title.trim(), notes: notes.trim() || null, geometry });
  };

  const typeLabel = type === 'line' ? 'Line' : type === 'polygon' ? 'Area' : 'Pin';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-semibold mb-1">Save {typeLabel}</h2>
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
            <label htmlFor="ann-notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              id="ann-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
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
