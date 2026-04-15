import { useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { motion } from 'motion/react';
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
    <motion.div
      className="group flex items-center gap-1.5 pointer-events-auto select-none"
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      whileHover={{ scale: 1.08 }}
    >
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        className="flex items-center justify-center rounded-full"
        style={{
          width: selected ? 34 : 28,
          height: selected ? 34 : 28,
          background: selected
            ? 'radial-gradient(circle at 35% 30%, #f59e0b, #b45309)'
            : 'radial-gradient(circle at 35% 30%, rgba(255,253,248,0.98), rgba(255,253,248,0.85))',
          color: selected ? '#fff' : '#b45309',
          border: selected
            ? '2px solid rgba(255,255,255,0.95)'
            : '2px solid rgba(217, 119, 6, 0.85)',
          boxShadow: selected
            ? '0 6px 16px -4px rgba(146, 64, 14, 0.55), inset 0 1px 0 rgba(255,255,255,0.35)'
            : '0 4px 10px -2px rgba(60, 40, 20, 0.35), inset 0 1px 0 rgba(255,255,255,0.8)',
          backdropFilter: 'blur(6px)',
        }}
      >
        <Icon size={selected ? 18 : 15} weight={selected ? 'fill' : 'duotone'} />
      </motion.div>
      {ann.type === 'pin' && (
        <motion.span
          animate={{ opacity: selected ? 1 : 0 }}
          whileHover={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap max-w-[160px] truncate group-hover:opacity-100"
          style={{
            background: 'rgba(20, 18, 14, 0.78)',
            color: '#fef3c7',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {ann.title}
        </motion.span>
      )}
    </motion.div>
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
