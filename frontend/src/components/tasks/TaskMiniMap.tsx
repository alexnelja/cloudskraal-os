import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import type { Task } from '../../types/calendar';
import { getBasemap, DEFAULT_BASEMAP_ID } from '../../config/basemaps';

const LS_KEY = 'capex.task-minimap-collapsed';

interface TaskMiniMapProps {
  geojson: GeoJSON.FeatureCollection | null;
  tasks: Task[];
  fields: Array<{ id: string; name: string }>;
  onFieldSelect: (fieldId: string | null) => void;
  selectedFieldId: string | null;
}

/** Classify whether a task is overdue or due today. */
function classifyDue(dueDate: string | null): 'overdue' | 'today' | 'other' {
  if (!dueDate) return 'today';
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  const diff = Math.round((due.getTime() - now.getTime()) / 86400000);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  return 'other';
}

/** Compute the centroid of a GeoJSON geometry (simple average of all coordinates). */
function centroid(geometry: GeoJSON.Geometry): [number, number] | null {
  const coords: number[][] = [];
  function collect(c: any) {
    if (typeof c[0] === 'number' && typeof c[1] === 'number' && c.length >= 2) {
      coords.push(c as number[]);
    } else if (Array.isArray(c)) {
      for (const item of c) collect(item);
    }
  }
  collect((geometry as any).coordinates);
  if (coords.length === 0) return null;
  const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  return [lng, lat];
}

/** Build a GeoJSON FeatureCollection of task-density dots at field centroids. */
function buildDotFeatures(
  geojson: GeoJSON.FeatureCollection,
  tasks: Task[],
): GeoJSON.FeatureCollection {
  // Group tasks by field_id, only pending/in_progress/overdue (not completed/skipped)
  const tasksByField = new Map<string, { overdue: number; today: number }>();
  for (const task of tasks) {
    if (!task.field_id) continue;
    if (task.status === 'completed' || task.status === 'skipped') continue;
    const cls = classifyDue(task.due_date);
    if (cls === 'other') continue;
    if (!tasksByField.has(task.field_id)) {
      tasksByField.set(task.field_id, { overdue: 0, today: 0 });
    }
    const counts = tasksByField.get(task.field_id)!;
    if (cls === 'overdue') counts.overdue++;
    else counts.today++;
  }

  const features: GeoJSON.Feature[] = [];
  for (const feature of geojson.features) {
    const fieldId = feature.properties?.id as string | undefined;
    if (!fieldId) continue;
    const counts = tasksByField.get(fieldId);
    if (!counts || (counts.overdue === 0 && counts.today === 0)) continue;
    const center = centroid(feature.geometry);
    if (!center) continue;

    const total = counts.overdue + counts.today;
    const dotSize = Math.min(16, 8 + (total - 1) * 2);
    const color = counts.overdue > 0 ? '#dc2626' : '#d97706'; // red or amber

    features.push({
      type: 'Feature',
      properties: { fieldId, dotSize, color, total },
      geometry: { type: 'Point', coordinates: center },
    });
  }

  return { type: 'FeatureCollection', features };
}

export default function TaskMiniMap({
  geojson,
  tasks,
  // fields prop reserved for future use (e.g. field name tooltips)
  fields: _fields = [],
  onFieldSelect,
  selectedFieldId,
}: TaskMiniMapProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(LS_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const mapLoadedRef = useRef(false);
  const onFieldSelectRef = useRef(onFieldSelect);
  onFieldSelectRef.current = onFieldSelect;

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(LS_KEY, String(next));
      } catch { /* noop */ }
      return next;
    });
  }, []);

  // Initialize map
  useEffect(() => {
    if (collapsed || !mapContainerRef.current) return;

    const bm = getBasemap(DEFAULT_BASEMAP_ID);
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          basemap: {
            type: 'raster',
            tiles: [bm.primary.url],
            tileSize: bm.primary.tileSize ?? 256,
            attribution: bm.primary.attribution,
            maxzoom: bm.primary.maxzoom ?? 19,
          },
        },
        layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }],
      },
      center: [19.0198, -31.3222],
      zoom: 12,
      attributionControl: false,
      scrollZoom: false,
      dragPan: false,
      doubleClickZoom: false,
      dragRotate: false,
      touchZoomRotate: false,
      keyboard: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    map.on('load', () => {
      mapRef.current = map;
      mapLoadedRef.current = true;

      if (geojson) {
        // Add field polygons
        map.addSource('fields', { type: 'geojson', data: geojson });
        map.addLayer({
          id: 'fields-fill',
          type: 'fill',
          source: 'fields',
          paint: { 'fill-color': '#d6d3d1', 'fill-opacity': 0.3 },
        });
        map.addLayer({
          id: 'fields-outline',
          type: 'line',
          source: 'fields',
          paint: { 'line-color': '#78716c', 'line-width': 1 },
        });

        // Highlight layer for selected field
        map.addLayer({
          id: 'fields-highlight',
          type: 'line',
          source: 'fields',
          filter: ['==', ['get', 'id'], selectedFieldId ?? ''],
          paint: { 'line-color': '#f59e0b', 'line-width': 2.5 },
        });

        // Add task density dots
        const dotData = buildDotFeatures(geojson, tasks);
        map.addSource('task-dots', { type: 'geojson', data: dotData });
        map.addLayer({
          id: 'task-dots-circle',
          type: 'circle',
          source: 'task-dots',
          paint: {
            'circle-radius': ['get', 'dotSize'],
            'circle-color': ['get', 'color'],
            'circle-opacity': 0.85,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 1.5,
          },
        });

        // Fit bounds to fields extent
        const bounds = new maplibregl.LngLatBounds();
        for (const feature of geojson.features) {
          const c = centroid(feature.geometry);
          if (c) bounds.extend(c as [number, number]);
        }
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, { padding: 20, maxZoom: 14, animate: false });
        }
      }

      // Click field polygon → select
      map.on('click', 'fields-fill', (e) => {
        const feature = e.features?.[0];
        if (feature?.properties?.id) {
          onFieldSelectRef.current(feature.properties.id as string);
        }
      });

      // Click dot → select
      map.on('click', 'task-dots-circle', (e) => {
        const feature = e.features?.[0];
        if (feature?.properties?.fieldId) {
          onFieldSelectRef.current(feature.properties.fieldId as string);
        }
      });

      // Click background → clear
      map.on('click', (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ['fields-fill', 'task-dots-circle'],
        });
        if (!features?.length) {
          onFieldSelectRef.current(null);
        }
      });

      // Pointer cursor on interactive layers
      for (const layerId of ['fields-fill', 'task-dots-circle']) {
        map.on('mouseenter', layerId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = '';
        });
      }
    });

    return () => {
      mapRef.current = null;
      mapLoadedRef.current = false;
      map.remove();
    };
    // Re-create map when collapsed state changes (expand) or geojson/tasks change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed, geojson, tasks]);

  // Sync highlight filter when selectedFieldId changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    try {
      if (map.getLayer('fields-highlight')) {
        map.setFilter('fields-highlight', ['==', ['get', 'id'], selectedFieldId ?? '']);
      }
    } catch { /* layer not ready */ }
  }, [selectedFieldId]);

  return (
    <div className="relative border-b border-stone-200/60">
      {/* Collapse toggle */}
      <button
        type="button"
        onClick={toggleCollapsed}
        className="absolute top-1 right-2 z-10 px-2 py-0.5 text-[10px] uppercase tracking-wide rounded-full bg-white/80 backdrop-blur text-stone-600 hover:text-stone-900 shadow-sm transition-colors"
        aria-label={collapsed ? 'Show Map' : 'Hide Map'}
      >
        {collapsed ? '▼ Map' : '▲ Map'}
      </button>

      {/* Map container with smooth height transition */}
      <div
        data-testid="minimap-container"
        style={{ height: collapsed ? '0px' : '150px' }}
        className="overflow-hidden transition-[height] duration-300 ease-in-out"
      >
        <div ref={mapContainerRef} className="w-full h-[150px]" />
      </div>
    </div>
  );
}
