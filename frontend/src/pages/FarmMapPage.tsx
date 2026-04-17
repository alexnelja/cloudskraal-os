import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import FarmMap from '../components/map/FarmMap';
import FieldPanel from '../components/map/FieldPanel';
import FieldsSidebar from '../components/map/FieldsSidebar';
import NewFieldModal from '../components/map/NewFieldModal';
import LayerControl from '../components/map/LayerControl';
import { AnimatePresence, motion } from 'motion/react';
import { MapPinArea, ClipboardText, NotePencil, CheckSquare, MapPin, List, Polygon as PolyIcon } from '@phosphor-icons/react';
import FluidSheet from '../components/map/FluidSheet';
import AnnotateTool, { type DrawFinishPayload, type DrawMode } from '../components/map/tools/AnnotateTool';
import SaveAnnotationModal from '../components/map/SaveAnnotationModal';
import AnnotationsSidebar from '../components/map/AnnotationsSidebar';
import AnnotationMarkers from '../components/map/AnnotationMarkers';
import CreateTaskModal, { type TaskContext } from '../components/map/CreateTaskModal';
import MapContextMenu, { type MenuItem } from '../components/map/MapContextMenu';
import MapOverlayRail from '../components/map/MapOverlayRail';
import BasemapSwitcher from '../components/map/BasemapSwitcher';
import MeasureToolbar from '../components/map/MeasureToolbar';
import { loadBasemapPreference, saveBasemapPreference } from '../config/basemaps';
import { useLongPress } from '../hooks/useLongPress';
import type { MapContextMenuEvent } from '../components/map/FarmMap';
import { listTasks, createTask, type Task } from '../api/tasks';
import { createAnnotation } from '../api/annotations';
import { API_BASE_URL } from '../api/config';
import { getMapGeoJSON, getFarmBoundaries, getFarms, getFields, getMapLayers, updateMapLayer } from '../api/farms';
import { findEnclosingField } from '../utils/fields';
import { formatDistance, formatArea } from '../components/map/tools/metricFormat';
import * as turf from '@turf/turf';
import {
  listAnnotations as apiListAnnotations,
  createAnnotation as apiCreateAnnotation,
  deleteAnnotation as apiDeleteAnnotation,
} from '../api/annotations';
import type { Farm, Field, MapLayer } from '../types/farm';
import type { Annotation, CreateAnnotationInput } from '../types/annotation';
import type { Measurement } from '../types/measurement';
import SaveMeasurementModal from '../components/map/SaveMeasurementModal';
import { ENTERPRISE_LABELS } from '../types/farm';
import { useEnterpriseColors } from '../hooks/useEnterpriseColors';

function getBoundsForFarm(
  geojson: GeoJSON.FeatureCollection,
  farmCode: string | null,
): [number, number, number, number] | null {
  const features = farmCode
    ? geojson.features.filter(f => f.properties?.farm_code === farmCode)
    : geojson.features;
  if (features.length === 0) return null;

  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const f of features) {
    const walkCoords = (coords: unknown) => {
      if (Array.isArray(coords) && typeof coords[0] === 'number') {
        minLng = Math.min(minLng, coords[0] as number);
        minLat = Math.min(minLat, coords[1] as number);
        maxLng = Math.max(maxLng, coords[0] as number);
        maxLat = Math.max(maxLat, coords[1] as number);
      } else if (Array.isArray(coords)) {
        (coords as unknown[]).forEach(walkCoords);
      }
    };
    if ((f.geometry as { coordinates?: unknown })?.coordinates) {
      walkCoords((f.geometry as { coordinates: unknown }).coordinates);
    }
  }
  if (!isFinite(minLng)) return null;
  return [minLng, minLat, maxLng, maxLat];
}

function getUniqueEnterprises(geojson: GeoJSON.FeatureCollection): string[] {
  const seen = new Set<string>();
  for (const f of geojson.features) {
    const ent = f.properties?.enterprise as string | undefined;
    if (ent) seen.add(ent);
  }
  return Array.from(seen);
}

export default function FarmMapPage() {
  const { fieldId } = useParams<{ fieldId?: string }>();
  const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(fieldId || null);
  const { colors: enterpriseColors, setColor: setEnterpriseColor } = useEnterpriseColors();
  const [loading, setLoading] = useState(true);
  const [visibleEnterprises, setVisibleEnterprises] = useState<string[] | undefined>(undefined);
  const [enterprises, setEnterprises] = useState<string[]>([]);
  const [farmBoundaries, setFarmBoundaries] = useState<GeoJSON.FeatureCollection | null>(null);
  const [showFarmBoundaries, setShowFarmBoundaries] = useState(true);
  const [mapLayers, setMapLayers] = useState<MapLayer[]>([]);
  const [legendExpanded, setLegendExpanded] = useState(false);
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingDraw, setPendingDraw] = useState<DrawFinishPayload | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; title: string; items: MenuItem[];
  } | null>(null);
  const [createTaskContext, setCreateTaskContext] = useState<{
    context: TaskContext; defaultTitle: string;
  } | null>(null);
  const [armedDropMode, setArmedDropMode] = useState(false);
  const [pressRing, setPressRing] = useState<{ x: number; y: number } | null>(null);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [loadNonce, setLoadNonce] = useState(0);
  const [drawMode, setDrawMode] = useState<DrawMode>('static');
  const [terraDraw, setTerraDraw] = useState<{ setMode: (mode: string) => void } | null>(null);
  const [basemapId, setBasemapId] = useState<string>(() => loadBasemapPreference());
  const [fieldsSidebarOpen, setFieldsSidebarOpen] = useState(false);
  const [newFieldOpen, setNewFieldOpen] = useState(false);
  const [newFieldSeed, setNewFieldSeed] = useState<{ geometry?: GeoJSON.Geometry; areaHa?: number }>({});
  // True while we're waiting for the user to draw a polygon for a new field.
  const [awaitingFieldDraw, setAwaitingFieldDraw] = useState(false);

  // 5m — save-as state: geometry captured when a draw finishes
  const [finishedGeometry, setFinishedGeometry] = useState<GeoJSON.Geometry | null>(null);
  const [measurementText, setMeasurementText] = useState<string | null>(null);
  // Stores the raw draw payload so FEATURE/NOTE route can open SaveAnnotationModal
  // without the modal appearing simultaneously with the chooser panel.
  const pendingDrawPayloadRef = useRef<import('../components/map/tools/AnnotateTool').DrawFinishPayload | null>(null);
  // Ref mirror of awaitingFieldDraw so handleDrawFinish closure always sees current value.
  const awaitingFieldDrawRef = useRef(false);
  const [saveMeasurementPending, setSaveMeasurementPending] = useState<{
    geometry: GeoJSON.Geometry;
    kind: 'length' | 'area';
    value: number;
    unit: 'm' | 'km' | 'm²' | 'ha';
    formatted: string;
  } | null>(null);

  // Keep ref mirror of awaitingFieldDraw in sync so callbacks always read current value.
  awaitingFieldDrawRef.current = awaitingFieldDraw;

  useEffect(() => {
    // Fire all endpoints independently so one failure doesn't empty the rest.
    const errors: string[] = [];
    let pending = 5;
    const done = () => {
      pending -= 1;
      if (pending === 0) {
        setLoadErrors(errors);
        setLoading(false);
      }
    };

    getMapGeoJSON()
      .then(gj => {
        setGeojson(gj);
        const ents = getUniqueEnterprises(gj);
        setEnterprises(ents);
        setVisibleEnterprises(ents);
      })
      .catch(err => { console.error('getMapGeoJSON:', err); errors.push('map'); })
      .finally(done);

    getFarmBoundaries()
      .then(setFarmBoundaries)
      .catch(err => { console.error('getFarmBoundaries:', err); errors.push('boundaries'); })
      .finally(done);

    getFarms()
      .then(setFarms)
      .catch(err => { console.error('getFarms:', err); errors.push('farms'); })
      .finally(done);

    getFields()
      .then(setFields)
      .catch(err => { console.error('getFields:', err); errors.push('fields'); })
      .finally(done);

    getMapLayers()
      .then(setMapLayers)
      .catch(err => { console.error('getMapLayers:', err); errors.push('layers'); })
      .finally(done);

    apiListAnnotations().then(setAnnotations).catch(err => {
      console.error('Failed to load annotations:', err);
    });
    listTasks().then(setTasks).catch(err => {
      console.error('Failed to load tasks:', err);
    });
  }, [loadNonce]);

  const refreshTasks = useCallback(async () => {
    try { setTasks(await listTasks()); } catch (e) { console.error(e); }
  }, []);

  const dropMapNote = useCallback(async (lng: number, lat: number) => {
    try {
      const pin = await createAnnotation({
        type: 'pin',
        title: 'Map note',
        category: 'map_note',
        geometry: { type: 'Point', coordinates: [lng, lat] },
      });
      setAnnotations((prev) => [pin, ...prev]);
      setSelectedAnnotationId(pin.id);
      setSidebarOpen(true);
      try {
        await fetch(`${API_BASE_URL}/wiki/map-notes/append`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ annotation_id: pin.id }),
        });
      } catch (err2) { console.warn('wiki append failed', err2); }
    } catch (err) { console.error(err); }
  }, []);

  // Arm drop-note mode when FAB navigates here with ?armNote=1.
  useEffect(() => {
    if (searchParams.get('armNote') === '1') {
      setArmedDropMode(true);
      const next = new URLSearchParams(searchParams);
      next.delete('armNote');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Esc cancels armed drop mode.
  useEffect(() => {
    if (!armedDropMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setArmedDropMode(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [armedDropMode]);

  // Esc cancels awaiting-field-draw mode.
  useEffect(() => {
    if (!awaitingFieldDraw) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAwaitingFieldDraw(false);
        terraDraw?.setMode('static');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [awaitingFieldDraw, terraDraw]);

  const handleArmedMapClick = useCallback(
    async (e: { lng: number; lat: number }) => {
      if (!armedDropMode) return;
      await dropMapNote(e.lng, e.lat);
      setArmedDropMode(false);
    },
    [armedDropMode, dropMapNote],
  );

  const taskCountByAnnotation = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of tasks) {
      if (t.annotation_id && t.status !== 'completed' && t.status !== 'cancelled') {
        m[t.annotation_id] = (m[t.annotation_id] ?? 0) + 1;
      }
    }
    return m;
  }, [tasks]);

  const refreshAnnotations = useCallback(async () => {
    try { setAnnotations(await apiListAnnotations()); }
    catch (e) { console.error('Failed to refresh annotations:', e); }
  }, []);

  const flyToAnnotation = useCallback((ann: Annotation) => {
    const map = mapRef.current;
    if (!map) return;
    const walk = (c: unknown): [number, number][] => {
      if (Array.isArray(c) && typeof c[0] === 'number') return [[c[0] as number, c[1] as number]];
      if (Array.isArray(c)) return (c as unknown[]).flatMap(walk);
      return [];
    };
    const pts = walk((ann.geometry as { coordinates: unknown }).coordinates);
    if (pts.length === 0) return;
    if (pts.length === 1) {
      map.flyTo({ center: pts[0], zoom: Math.max(map.getZoom(), 15) });
      return;
    }
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const [lng, lat] of pts) {
      minLng = Math.min(minLng, lng); minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng); maxLat = Math.max(maxLat, lat);
    }
    map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 80 });
  }, []);

  // Deep-link: ?annotation=<id>
  useEffect(() => {
    const annId = searchParams.get('annotation');
    if (!annId || annotations.length === 0) return;
    const ann = annotations.find((a) => a.id === annId);
    if (!ann) return;
    setSelectedAnnotationId(annId);
    setSidebarOpen(true);
    flyToAnnotation(ann);
  }, [searchParams, annotations, flyToAnnotation]);

  const handleDrawFinish = useCallback((payload: DrawFinishPayload) => {
    // Fix 2 — polygon-first field creation: if we were waiting for a field
    // boundary polygon, capture it and open NewFieldModal pre-filled.
    if (awaitingFieldDrawRef.current && payload.geometry.type === 'Polygon') {
      let areaHa: number | undefined;
      try {
        areaHa = turf.area(turf.feature(payload.geometry)) / 10000;
      } catch { /* ignore */ }
      setNewFieldSeed({ geometry: payload.geometry, areaHa });
      setNewFieldOpen(true);
      setAwaitingFieldDraw(false);
      return; // don't fall through to save-as chooser
    }

    // Store payload for later — only pushed into pendingDraw when user
    // explicitly picks FEATURE or NOTE from the chooser, so SaveAnnotationModal
    // never appears simultaneously with the save-as chooser panel (Fix 1 — 5m).
    pendingDrawPayloadRef.current = payload;
    // Capture for the save-as chooser (5m)
    setFinishedGeometry(payload.geometry);
    // Compute a measurement text for the chip
    try {
      if (payload.type === 'line' && payload.geometry.type === 'LineString') {
        const meters = turf.length(turf.lineString((payload.geometry as GeoJSON.LineString).coordinates), { units: 'meters' });
        setMeasurementText(formatDistance(meters));
      } else if (payload.type === 'polygon' && payload.geometry.type === 'Polygon') {
        const m2 = turf.area(turf.polygon((payload.geometry as GeoJSON.Polygon).coordinates));
        setMeasurementText(formatArea(m2));
      } else {
        setMeasurementText(null);
      }
    } catch {
      setMeasurementText(null);
    }
  }, []);

  const clearFinished = useCallback(() => {
    setFinishedGeometry(null);
    setMeasurementText(null);
    pendingDrawPayloadRef.current = null;
  }, []);

  const handleSaveAsPick = useCallback(
    (dest: 'field' | 'feature' | 'measurement' | 'note') => {
      if (!finishedGeometry) return;
      if (dest === 'field') {
        if (geojson) {
          const match = findEnclosingField(geojson, finishedGeometry);
          if (match) {
            // eslint-disable-next-line no-alert
            window.alert(`Already inside "${match.fieldName}" — no new field created.`);
            clearFinished();
            return;
          }
        }
        let areaHa: number | undefined;
        try {
          if (finishedGeometry.type === 'Polygon') {
            areaHa = turf.area(turf.feature(finishedGeometry)) / 10000;
          }
        } catch { /* ignore */ }
        setNewFieldSeed({ geometry: finishedGeometry, areaHa });
        setNewFieldOpen(true);
        // clearFinished called when modal closes
        return;
      }
      if (dest === 'measurement') {
        try {
          let kind: 'length' | 'area' = 'length';
          let value = 0;
          let unit: 'm' | 'km' | 'm²' | 'ha' = 'm';
          let formatted = measurementText ?? '';
          if (finishedGeometry.type === 'LineString') {
            kind = 'length';
            value = turf.length(turf.lineString((finishedGeometry as GeoJSON.LineString).coordinates), { units: 'meters' });
            unit = value >= 1000 ? 'km' : 'm';
          } else if (finishedGeometry.type === 'Polygon') {
            kind = 'area';
            value = turf.area(turf.feature(finishedGeometry));
            unit = value >= 10000 ? 'ha' : 'm²';
          }
          setSaveMeasurementPending({ geometry: finishedGeometry, kind, value, unit, formatted });
        } catch { /* ignore */ }
        clearFinished();
        return;
      }
      if (dest === 'feature' || dest === 'note') {
        // Route through existing SaveAnnotationModal.
        // clearFinished() first so the chooser panel unmounts before
        // SaveAnnotationModal mounts — no dual-modal flash (Fix 1 — 5m).
        clearFinished();
        if (pendingDrawPayloadRef.current) {
          setPendingDraw(pendingDrawPayloadRef.current);
          pendingDrawPayloadRef.current = null;
        }
        return;
      }
      clearFinished();
    },
    [finishedGeometry, measurementText, geojson, clearFinished],
  );

  const handleSaveAnnotation = useCallback(async (input: CreateAnnotationInput) => {
    try {
      const created = await apiCreateAnnotation(input);
      setAnnotations((prev) => [created, ...prev]);
      setSelectedAnnotationId(created.id);
      setSidebarOpen(true);
      setPendingDraw(null);
    } catch (e) {
      console.error('Save annotation failed:', e);
    }
  }, []);

  const handleDiscardAnnotation = useCallback(() => {
    setPendingDraw(null);
    pendingDrawPayloadRef.current = null;
  }, []);

  const handleAnnotationSelect = useCallback((id: string) => {
    setSelectedAnnotationId(id);
    setSidebarOpen(true);
    const ann = annotations.find((a) => a.id === id);
    if (ann) flyToAnnotation(ann);
  }, [annotations, flyToAnnotation]);

  const openCreateTaskModal = useCallback((ctx: TaskContext, defaultTitle: string) => {
    setCreateTaskContext({ context: ctx, defaultTitle });
  }, []);

  const handleSaveTask = useCallback(async (input: Parameters<typeof createTask>[0]) => {
    try {
      await createTask(input);
      setCreateTaskContext(null);
      refreshTasks();
    } catch (e) {
      console.error('Create task failed', e);
    }
  }, [refreshTasks]);

  const handleMapContextMenu = useCallback((e: MapContextMenuEvent) => {
    const items: MenuItem[] = [];
    if (e.target === 'field' && e.fieldId) {
      items.push({
        id: 'task-for-field',
        label: `Create task for ${e.fieldName ?? 'this field'}`,
        Icon: ClipboardText,
        tint: 'emerald',
        onClick: () =>
          openCreateTaskModal(
            { kind: 'field', label: e.fieldName ?? 'field', fieldId: e.fieldId! },
            '',
          ),
      });
    } else {
      items.push({
        id: 'task-here',
        label: 'Create task at this location',
        Icon: ClipboardText,
        tint: 'emerald',
        onClick: async () => {
          // First drop a task_location pin, then open CreateTaskModal linked to it.
          try {
            const pin = await createAnnotation({
              type: 'pin',
              title: 'Task location',
              category: 'task_location',
              geometry: { type: 'Point', coordinates: [e.lng, e.lat] },
            });
            setAnnotations((prev) => [pin, ...prev]);
            openCreateTaskModal(
              { kind: 'annotation', label: pin.title, annotationId: pin.id },
              '',
            );
          } catch (err) { console.error(err); }
        },
      });
      items.push({
        id: 'map-note',
        label: 'Drop map note',
        Icon: NotePencil,
        tint: 'amber',
        onClick: () => { dropMapNote(e.lng, e.lat); },
      });
    }
    setContextMenu({
      x: e.x,
      y: e.y,
      title: e.target === 'field' ? (e.fieldName ?? 'Field') : 'Map',
      items,
    });
  }, [openCreateTaskModal, dropMapNote]);

  const handleMarkerContextMenu = useCallback(
    (annotationId: string, x: number, y: number) => {
      const ann = annotations.find((a) => a.id === annotationId);
      if (!ann) return;
      const items: MenuItem[] = [
        {
          id: 'task-linked',
          label: `Create task linked to ${ann.title}`,
          Icon: CheckSquare,
          tint: 'emerald',
          onClick: () =>
            openCreateTaskModal(
              { kind: 'annotation', label: ann.title, annotationId: ann.id },
              '',
            ),
        },
        {
          id: 'fly-to',
          label: 'Zoom to this pin',
          Icon: MapPin,
          tint: 'stone',
          onClick: () => {
            setSelectedAnnotationId(ann.id);
            setSidebarOpen(true);
          },
        },
      ];
      setContextMenu({ x, y, title: ann.title, items });
    },
    [annotations, openCreateTaskModal],
  );

  // Long-press handlers — fire the same chooser as right-click, but gesture-based.
  // Trackpad-friendly alternative to secondary-click per Apple HIG.
  const openChooserAt = useCallback(
    (clientX: number, clientY: number) => {
      const map = mapRef.current;
      if (!map) return;
      const rect = map.getContainer().getBoundingClientRect();
      const point: [number, number] = [clientX - rect.left, clientY - rect.top];
      const lngLat = map.unproject(point);
      const features = map.queryRenderedFeatures(point, { layers: ['fields-fill'] });
      const feat = features?.[0];
      handleMapContextMenu({
        target: feat ? 'field' : 'blank',
        fieldId: feat?.properties?.id as string | undefined,
        fieldName: feat?.properties?.name as string | undefined,
        lng: lngLat.lng,
        lat: lngLat.lat,
        x: clientX,
        y: clientY,
      });
    },
    [handleMapContextMenu],
  );

  const longPress = useLongPress({
    durationMs: 500,
    onLongPress: ({ clientX, clientY }) => {
      if (armedDropMode) return; // armed-click path already handles drop
      openChooserAt(clientX, clientY);
    },
    onProgress: (p) => {
      setPressRing(p.active ? { x: p.clientX, y: p.clientY } : null);
    },
  });

  const handleAnnotationDelete = useCallback(async (id: string) => {
    try {
      await apiDeleteAnnotation(id);
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
      if (selectedAnnotationId === id) setSelectedAnnotationId(null);
      if (searchParams.get('annotation') === id) {
        searchParams.delete('annotation');
        setSearchParams(searchParams, { replace: true });
      }
    } catch (e) {
      console.error('Delete annotation failed:', e);
    }
  }, [selectedAnnotationId, searchParams, setSearchParams]);

  // Suppress unused warning in strict mode (reserved for future server refetch).
  void refreshAnnotations;

  function handleLayerToggle(layerId: string, visible: boolean) {
    setMapLayers(prev =>
      prev.map(l => l.id === layerId ? { ...l, visible } : l),
    );
    updateMapLayer(layerId, { visible }).catch(err =>
      console.error('Failed to persist layer visibility:', err),
    );
  }

  function handleLayerOpacity(layerId: string, opacity: number) {
    setMapLayers(prev =>
      prev.map(l => l.id === layerId ? { ...l, opacity } : l),
    );
    updateMapLayer(layerId, { opacity }).catch(err =>
      console.error('Failed to persist layer opacity:', err),
    );
  }

  function handleEnterpriseToggle(enterprise: string) {
    setVisibleEnterprises(prev => {
      const current = prev ?? enterprises;
      if (current.includes(enterprise)) {
        return current.filter(e => e !== enterprise);
      } else {
        return [...current, enterprise];
      }
    });
  }

  function handleFarmZoom(farmCode: string | null) {
    const map = mapRef.current;
    if (!map || !geojson) return;
    const bounds = getBoundsForFarm(geojson, farmCode);
    if (!bounds) return;
    const [minLng, minLat, maxLng, maxLat] = bounds;
    map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 50 });
  }

  function handleAddField(opts?: { geometry?: GeoJSON.Geometry; areaHa?: number }) {
    if (opts?.geometry) {
      // Called with a pre-supplied geometry (e.g. from SaveAs chooser) — open modal directly.
      setNewFieldSeed(opts);
      setNewFieldOpen(true);
      return;
    }
    // No geometry yet — arm polygon draw mode; modal opens after the user
    // finishes drawing the boundary (handleDrawFinish intercepts it).
    if (terraDraw) {
      terraDraw.setMode('render');
      terraDraw.setMode('polygon');
    }
    setAwaitingFieldDraw(true);
  }

  function handleFieldSelect(fieldId: string) {
    setSelectedFieldId(fieldId);
    // Zoom to field on the map — find it in geojson
    const map = mapRef.current;
    if (!map || !geojson) return;
    const feature = geojson.features.find(f => f.properties?.id === fieldId);
    if (!feature) return;
    const walkCoords = (coords: unknown): [number, number][] => {
      if (Array.isArray(coords) && typeof coords[0] === 'number') {
        return [[coords[0] as number, coords[1] as number]];
      } else if (Array.isArray(coords)) {
        return (coords as unknown[]).flatMap(walkCoords);
      }
      return [];
    };
    const pts = walkCoords((feature.geometry as { coordinates: unknown }).coordinates);
    if (pts.length === 0) return;
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const [lng, lat] of pts) {
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    }
    map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 80 });
  }

  const fieldsSidebar = (
    <FieldsSidebar
      farms={farms}
      fields={fields}
      enterprises={enterprises}
      visibleEnterprises={visibleEnterprises ?? enterprises}
      selectedFieldId={selectedFieldId}
      enterpriseColors={enterpriseColors}
      onEnterpriseToggle={handleEnterpriseToggle}
      onFarmSelect={handleFarmZoom}
      onFieldSelect={handleFieldSelect}
      onAddField={() => handleAddField()}
      onColorChange={setEnterpriseColor}
    />
  );

  return (
    <div className="h-[calc(100vh-5rem)] md:h-screen flex min-h-0">
      {/* Desktop: inline flex child sidebar */}
      <div className="hidden md:block h-full">{fieldsSidebar}</div>

      {/* Mobile: FluidSheet overlay */}
      <div className="md:hidden">
        <FluidSheet side="left" open={fieldsSidebarOpen} onDismiss={() => setFieldsSidebarOpen(false)}>
          {fieldsSidebar}
        </FluidSheet>
      </div>

      {/* Map area — fills remaining space */}
      <div className="flex-1 relative min-h-0 overflow-hidden">
      {/* Map fills the full container */}
      {loading ? (
        <div className="w-full h-full bg-stone-200 flex items-center justify-center">
          <p className="text-stone-500 text-sm">Loading map...</p>
        </div>
      ) : (
        <div
          className="w-full h-full"
          onPointerDown={longPress.onPointerDown}
          onPointerMove={longPress.onPointerMove}
          onPointerUp={longPress.onPointerUp}
          onPointerCancel={longPress.onPointerCancel}
        >
        <FarmMap
          geojson={geojson}
          farmBoundaries={farmBoundaries}
          selectedFieldId={selectedFieldId}
          onFieldSelect={setSelectedFieldId}
          visibleEnterprises={visibleEnterprises}
          showFarmBoundaries={showFarmBoundaries}
          onMapReady={(map) => { mapRef.current = map; setMapInstance(map); }}
          gisLayers={mapLayers}
          annotations={annotations}
          selectedAnnotationId={selectedAnnotationId}
          onAnnotationSelect={handleAnnotationSelect}
          onContextMenu={handleMapContextMenu}
          onMapClick={handleArmedMapClick}
          cursor={armedDropMode || ['linestring', 'polygon', 'point'].includes(drawMode) ? 'crosshair' : undefined}
          basemapId={basemapId}
          enterpriseColors={enterpriseColors}
        />
        </div>
      )}

      {/* Long-press affordance — pulsing amber ring grows 0→500ms */}
      <AnimatePresence>
        {pressRing && (
          <motion.div
            key="press-ring"
            className="longpress-ring"
            style={{ left: pressRing.x, top: pressRing.y }}
            initial={{ scale: 0.2, opacity: 0.8 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.25, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
          />
        )}
      </AnimatePresence>

      {/* Data-load error toast */}
      <AnimatePresence>
        {loadErrors.length > 0 && (
          <motion.div
            key="load-error"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 glass-panel rounded-2xl px-4 py-3 flex items-center gap-3 max-w-md"
          >
            <span className="text-sm text-stone-800">
              Couldn't load: <span className="font-semibold">{loadErrors.join(', ')}</span>
            </span>
            <button
              onClick={() => { setLoadErrors([]); setLoading(true); setLoadNonce(n => n + 1); }}
              className="glass-button rounded-full px-3 py-1 text-xs font-medium text-amber-800"
            >
              Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drawing help banner — shown while terradraw is in an active draw mode */}
      <AnimatePresence>
        {(drawMode === 'linestring' || drawMode === 'polygon' || drawMode === 'point') && (
          <motion.div
            key="draw-help"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute top-3 left-1/2 -translate-x-1/2 z-20 glass-panel rounded-full px-4 py-2 flex items-center gap-4 pointer-events-none"
          >
            <span className="text-[11px] text-stone-600 flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-stone-100 font-mono text-[10px] text-stone-700">Click</span>
              add point
            </span>
            <span className="text-[11px] text-stone-600 flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 font-mono text-[10px] text-emerald-800">Enter</span>
              save
            </span>
            <span className="text-[11px] text-stone-600 flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-stone-100 font-mono text-[10px] text-stone-700">Esc</span>
              cancel
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Awaiting field boundary draw banner */}
      <AnimatePresence>
        {awaitingFieldDraw && (
          <motion.div
            key="field-draw-banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute top-3 left-1/2 -translate-x-1/2 z-20 glass-panel rounded-full px-4 py-2 flex items-center gap-3 pointer-events-none"
          >
            <PolyIcon size={16} weight="duotone" className="text-amber-700" />
            <span className="text-sm font-medium text-stone-800">
              Draw the field boundary
            </span>
            <span className="text-[11px] text-stone-600 flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 font-mono text-[10px] text-emerald-800">Enter</span>
              finish
            </span>
            <span className="text-[11px] font-mono text-stone-500 px-1.5 py-0.5 rounded bg-stone-100">
              Esc cancel
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Armed drop-note banner */}
      <AnimatePresence>
        {armedDropMode && (
          <motion.div
            key="drop-banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute top-3 left-1/2 -translate-x-1/2 z-20 glass-panel rounded-full px-4 py-2 flex items-center gap-3 pointer-events-none"
          >
            <NotePencil size={16} weight="duotone" className="text-amber-700" />
            <span className="text-sm font-medium text-stone-800">
              Click to drop note
            </span>
            <span className="text-[11px] font-mono text-stone-500 px-1.5 py-0.5 rounded bg-stone-100">
              Esc
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hamburger pill (mobile only) — opens FieldsSidebar sheet */}
      <button
        type="button"
        className="md:hidden absolute top-3 left-3 z-10 glass-button rounded-full w-10 h-10 flex items-center justify-center"
        aria-label="Open fields sidebar"
        onClick={() => setFieldsSidebarOpen(true)}
      >
        <List size={18} />
      </button>

      {/* Top-right rail: nav + layers + annotations toggle */}
      {!loading && (
        <MapOverlayRail position="tr">
          <MeasureToolbar
            terraDraw={terraDraw}
            currentMode={drawMode}
            finishedGeometry={finishedGeometry}
            measurementText={measurementText}
            onPick={handleSaveAsPick}
            onDiscard={clearFinished}
          />
          <BasemapSwitcher
            current={basemapId}
            onChange={(id) => { setBasemapId(id); saveBasemapPreference(id); }}
          />
          <LayerControl
            layers={mapLayers}
            onToggle={handleLayerToggle}
            onOpacityChange={handleLayerOpacity}
          />
          <AnimatePresence>
            {!sidebarOpen && (
              <motion.button
                key="annotations-toggle"
                type="button"
                onClick={() => setSidebarOpen(true)}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                className="glass-button rounded-full px-4 py-2.5 text-[12px] font-medium text-stone-800 flex items-center gap-2"
              >
                <MapPinArea size={16} weight="duotone" className="text-amber-700" />
                <span>Annotations</span>
                <span className="text-[11px] font-mono text-stone-500">{annotations.length}</span>
              </motion.button>
            )}
          </AnimatePresence>
        </MapOverlayRail>
      )}

      {/* Enterprise color legend — bottom-left rail */}
      {!loading && enterprises.length > 0 && (() => {
        const legendEnterprises = enterprises.filter(
          e => e !== 'farm_boundary' && e !== 'unclassified',
        );
        if (legendEnterprises.length === 0) return null;
        return (
          <MapOverlayRail position="bl">
            {/* Mobile: collapsible */}
            <div className="md:hidden">
              {legendExpanded ? (
                <div className="glass-panel rounded-xl px-3 py-2 flex flex-col gap-1">
                  <button
                    onClick={() => setLegendExpanded(false)}
                    className="text-xs font-semibold text-stone-600 text-left mb-1"
                  >
                    Legend ▲
                  </button>
                  {legendEnterprises.map(ent => (
                    <div key={ent} className="flex items-center gap-2">
                      <span
                        className="rounded-full shrink-0"
                        style={{
                          width: 10,
                          height: 10,
                          backgroundColor: enterpriseColors[ent] ?? '#d1d5db',
                        }}
                      />
                      <span className="text-xs text-stone-700">
                        {ENTERPRISE_LABELS[ent] ?? ent}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <button
                  onClick={() => setLegendExpanded(true)}
                  className="glass-button rounded-full px-3 py-2 text-xs font-semibold text-stone-700"
                >
                  Legend ▼
                </button>
              )}
            </div>
            {/* Desktop: always visible */}
            <div className="hidden md:block glass-panel rounded-xl px-3 py-2">
              <p className="text-xs font-semibold text-stone-500 mb-1">Fields</p>
              <div className="flex flex-col gap-1">
                {legendEnterprises.map(ent => (
                  <div key={ent} className="flex items-center gap-2">
                    <span
                      className="rounded-full shrink-0"
                      style={{
                        width: 10,
                        height: 10,
                        backgroundColor: enterpriseColors[ent] ?? '#d1d5db',
                      }}
                    />
                    <span className="text-xs text-stone-700">
                      {ENTERPRISE_LABELS[ent] ?? ent}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-stone-200 mt-2 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showFarmBoundaries}
                    onChange={() => setShowFarmBoundaries(!showFarmBoundaries)}
                    className="rounded border-stone-300 text-stone-600"
                  />
                  <span className="inline-block w-4 border-t-2 border-dashed border-stone-500" />
                  <span className="text-xs text-stone-700">Farm Boundaries</span>
                </label>
              </div>
            </div>
          </MapOverlayRail>
        );
      })()}

      {/* Annotate tool — mounts terradraw controls on the map */}
      <AnnotateTool map={mapInstance} onFinish={handleDrawFinish} onModeChange={setDrawMode} onReady={setTerraDraw} />

      {/* Category icon markers overlay (QGIS-style) */}
      <AnnotationMarkers
        map={mapInstance}
        annotations={annotations}
        selectedId={selectedAnnotationId}
        onSelect={handleAnnotationSelect}
        onContextMenu={handleMarkerContextMenu}
      />

      {/* Context menu on right-click */}
      <MapContextMenu
        open={contextMenu !== null}
        x={contextMenu?.x ?? 0}
        y={contextMenu?.y ?? 0}
        title={contextMenu?.title}
        items={contextMenu?.items ?? []}
        onDismiss={() => setContextMenu(null)}
      />

      {/* Create task modal */}
      <CreateTaskModal
        open={createTaskContext !== null}
        defaultTitle={createTaskContext?.defaultTitle ?? ''}
        context={createTaskContext?.context ?? { kind: 'blank', label: 'location' }}
        onSave={handleSaveTask}
        onCancel={() => setCreateTaskContext(null)}
      />

      {/* Save dialog after finishing a draw */}
      <SaveAnnotationModal
        open={pendingDraw !== null}
        type={pendingDraw?.type ?? 'pin'}
        geometry={pendingDraw?.geometry ?? { type: 'Point', coordinates: [0, 0] }}
        onSave={handleSaveAnnotation}
        onDiscard={handleDiscardAnnotation}
      />

      {/* Annotations sidebar */}
      <AnnotationsSidebar
        open={sidebarOpen}
        annotations={annotations}
        selectedId={selectedAnnotationId}
        onToggle={() => setSidebarOpen(false)}
        onSelect={handleAnnotationSelect}
        onDelete={handleAnnotationDelete}
        taskCountById={taskCountByAnnotation}
        onMeasurementZoom={(m) => {
          try {
            const geom = JSON.parse(m.geometry) as GeoJSON.Geometry;
            const bbox = turf.bbox(turf.feature(geom));
            mapRef.current?.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 80, maxZoom: 17 });
          } catch (err) {
            console.warn('Failed to zoom to measurement:', err);
          }
        }}
      />

      {/* Field detail panel — overlays on top of map */}
      <FieldPanel
        fieldId={selectedFieldId}
        onClose={() => setSelectedFieldId(null)}
      />
      </div> {/* end map area flex-1 */}

      {/* New field modal — portal-renders outside the flex layout */}
      <NewFieldModal
        open={newFieldOpen}
        onClose={() => { setNewFieldOpen(false); setNewFieldSeed({}); clearFinished(); }}
        onCreated={() => {
          // Refetch all data by bumping the nonce
          setLoading(true);
          setLoadNonce((n) => n + 1);
          clearFinished();
        }}
        farms={farms}
        enterprises={enterprises}
        geometry={newFieldSeed.geometry}
        areaHa={newFieldSeed.areaHa}
        farmBoundaries={farmBoundaries}
      />

      {/* Save measurement modal (5m) */}
      {saveMeasurementPending && (
        <SaveMeasurementModal
          open={true}
          kind={saveMeasurementPending.kind}
          value={saveMeasurementPending.value}
          unit={saveMeasurementPending.unit}
          formatted={saveMeasurementPending.formatted}
          geometry={saveMeasurementPending.geometry}
          onSaved={(_m: Measurement) => {
            setSaveMeasurementPending(null);
          }}
          onDiscard={() => setSaveMeasurementPending(null)}
        />
      )}
    </div>
  );
}
