import { useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import maplibregl from 'maplibre-gl';
import centroid from '@turf/centroid';
import { feature as turfFeature } from '@turf/helpers';
import type { Annotation } from '../../types/annotation';
import { getCategoryDef } from './annotationCategories';

interface AnnotationMarkersProps {
  map: maplibregl.Map | null;
  annotations: Annotation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function anchorCoord(ann: Annotation): [number, number] | null {
  const geom = ann.geometry;
  if (!geom) return null;
  if (geom.type === 'Point') return geom.coordinates as [number, number];
  if (geom.type === 'LineString' || geom.type === 'Polygon') {
    try {
      const c = centroid(turfFeature(geom));
      const coords = c.geometry.coordinates as [number, number];
      return coords;
    } catch {
      return null;
    }
  }
  return null;
}

function MarkerContent({ ann, selected }: { ann: Annotation; selected: boolean }) {
  const def = getCategoryDef(ann.type, ann.category);
  const Icon = def.Icon;
  return (
    <div
      className={`group flex items-center gap-1.5 pointer-events-auto select-none ${
        selected ? 'scale-110' : ''
      }`}
    >
      <div
        className={`flex items-center justify-center rounded-full shadow-md border-2 transition ${
          selected
            ? 'bg-amber-600 text-white border-white w-8 h-8'
            : 'bg-white text-amber-700 border-amber-600 w-7 h-7 group-hover:bg-amber-50'
        }`}
      >
        <Icon size={selected ? 18 : 16} weight={selected ? 'fill' : 'regular'} />
      </div>
      {ann.type === 'pin' && (
        <span
          className={`text-[11px] font-medium px-1.5 py-0.5 rounded bg-black/60 text-white whitespace-nowrap max-w-[140px] truncate ${
            selected ? '' : 'opacity-0 group-hover:opacity-100 transition-opacity'
          }`}
        >
          {ann.title}
        </span>
      )}
    </div>
  );
}

interface MarkerRecord {
  marker: maplibregl.Marker;
  root: Root;
  el: HTMLDivElement;
  annId: string;
}

export default function AnnotationMarkers({
  map,
  annotations,
  selectedId,
  onSelect,
}: AnnotationMarkersProps) {
  const markersRef = useRef<Map<string, MarkerRecord>>(new Map());

  useEffect(() => {
    if (!map) return;
    const current = markersRef.current;

    // Build desired set
    const desired = new Map<string, Annotation>();
    for (const ann of annotations) desired.set(ann.id, ann);

    // Remove markers no longer desired
    for (const [id, rec] of current) {
      if (!desired.has(id)) {
        rec.marker.remove();
        rec.root.unmount();
        current.delete(id);
      }
    }

    // Add or update markers
    for (const [id, ann] of desired) {
      const coord = anchorCoord(ann);
      if (!coord) continue;
      const isSelected = selectedId === id;

      let rec = current.get(id);
      if (!rec) {
        const el = document.createElement('div');
        el.style.cursor = 'pointer';
        const root = createRoot(el);
        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat(coord)
          .addTo(map);
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelect(ann.id);
        });
        rec = { marker, root, el, annId: id };
        current.set(id, rec);
      } else {
        rec.marker.setLngLat(coord);
      }
      rec.root.render(<MarkerContent ann={ann} selected={isSelected} />);
    }

    return () => {
      // no-op on deps change; full cleanup on unmount below
    };
  }, [map, annotations, selectedId, onSelect]);

  // Final cleanup on unmount
  useEffect(() => {
    return () => {
      for (const [, rec] of markersRef.current) {
        rec.marker.remove();
        rec.root.unmount();
      }
      markersRef.current.clear();
    };
  }, []);

  return null;
}
