import { useState, useRef, useCallback, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import * as turf from '@turf/turf';
import {
  createAnnotation,
  createAnnotation as apiCreateAnnotation,
  deleteAnnotation as apiDeleteAnnotation,
  updateAnnotation as apiUpdateAnnotation,
} from '../api/annotations';
import { API_BASE_URL } from '../api/config';
import { findEnclosingField } from '../utils/fields';
import { formatDistance, formatArea } from '../components/map/tools/metricFormat';
import type { Annotation, CreateAnnotationInput } from '../types/annotation';
import type { DrawFinishPayload } from '../components/map/tools/AnnotateTool';
import type { Task } from '../api/tasks';

interface UseAnnotationStateArgs {
  mapRef: React.MutableRefObject<maplibregl.Map | null>;
  annotations: Annotation[];
  setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>;
  tasks: Task[];
  geojson: GeoJSON.FeatureCollection | null;
}

export function useAnnotationState({
  mapRef,
  annotations,
  setAnnotations,
  tasks,
  geojson,
}: UseAnnotationStateArgs) {
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingDraw, setPendingDraw] = useState<DrawFinishPayload | null>(null);

  // 5m — save-as state
  const [finishedGeometry, setFinishedGeometry] = useState<GeoJSON.Geometry | null>(null);
  const [measurementText, setMeasurementText] = useState<string | null>(null);
  const pendingDrawPayloadRef = useRef<DrawFinishPayload | null>(null);

  // Editing state
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
  const preEditGeometryRef = useRef<GeoJSON.Geometry | null>(null);

  // Save measurement pending
  const [saveMeasurementPending, setSaveMeasurementPending] = useState<{
    geometry: GeoJSON.Geometry;
    kind: 'length' | 'area';
    value: number;
    unit: 'm' | 'km' | 'm²' | 'ha';
    formatted: string;
  } | null>(null);

  // New field seed (geometry captured from draw)
  const [newFieldSeed, setNewFieldSeed] = useState<{ geometry?: GeoJSON.Geometry; areaHa?: number }>({});
  const [newFieldOpen, setNewFieldOpen] = useState(false);

  const taskCountByAnnotation = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of tasks) {
      if (t.annotation_id && t.status !== 'completed' && t.status !== 'cancelled') {
        m[t.annotation_id] = (m[t.annotation_id] ?? 0) + 1;
      }
    }
    return m;
  }, [tasks]);

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
  }, [mapRef]);

  const handleAnnotationSelect = useCallback((id: string) => {
    setSelectedAnnotationId(id);
    setSidebarOpen(true);
    const ann = annotations.find((a) => a.id === id);
    if (ann) flyToAnnotation(ann);
  }, [annotations, flyToAnnotation]);

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
  }, [setAnnotations]);

  const handleAnnotationDelete = useCallback(async (id: string, searchParams: URLSearchParams, setSearchParams: (params: URLSearchParams, opts?: { replace?: boolean }) => void) => {
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
  }, [selectedAnnotationId, setAnnotations]);

  const handleBatchDelete = useCallback(async (ids: string[]) => {
    try {
      await Promise.all(ids.map(id => apiDeleteAnnotation(id)));
      setAnnotations(prev => prev.filter(a => !ids.includes(a.id)));
      if (selectedAnnotationId && ids.includes(selectedAnnotationId)) {
        setSelectedAnnotationId(null);
      }
    } catch (e) {
      console.error('Batch delete failed:', e);
    }
  }, [selectedAnnotationId, setAnnotations]);

  // handleAnnotationEdit — sets up editing state. TerraDraw operations are done by the caller.
  const handleAnnotationEdit = useCallback((id: string) => {
    const ann = annotations.find(a => a.id === id);
    if (!ann) return null;
    preEditGeometryRef.current = ann.geometry;
    setEditingAnnotationId(id);
    setSelectedAnnotationId(id);
    return ann;
  }, [annotations]);

  const handleGeometryChange = useCallback(async (_featureId: string | number, geometry: GeoJSON.Geometry) => {
    if (!editingAnnotationId) return;
    try {
      const updated = await apiUpdateAnnotation(editingAnnotationId, { geometry });
      setAnnotations((prev) => prev.map((a) => a.id === editingAnnotationId ? updated : a));
    } catch (e) {
      console.error('Failed to update annotation geometry:', e);
    }
  }, [editingAnnotationId, setAnnotations]);

  // handleFinishEditing — clears editing state. TerraDraw cleanup done by caller.
  const handleFinishEditing = useCallback(() => {
    const id = editingAnnotationId;
    preEditGeometryRef.current = null;
    setEditingAnnotationId(null);
    return id;
  }, [editingAnnotationId]);

  // handleCancelEditing — reverts geometry. TerraDraw cleanup done by caller.
  const handleCancelEditing = useCallback(() => {
    const id = editingAnnotationId;
    const origGeom = preEditGeometryRef.current;
    if (id && origGeom) {
      setAnnotations(prev => prev.map(a => a.id === id ? { ...a, geometry: origGeom } : a));
      apiUpdateAnnotation(id, { geometry: origGeom }).catch(() => {});
    }
    preEditGeometryRef.current = null;
    setEditingAnnotationId(null);
    return id;
  }, [editingAnnotationId, setAnnotations]);

  const handleDrawFinish = useCallback((
    payload: DrawFinishPayload,
    awaitingFieldDraw: boolean,
    setAwaitingFieldDraw: (v: boolean) => void,
  ) => {
    // polygon-first field creation
    if (awaitingFieldDraw && payload.geometry.type === 'Polygon') {
      let areaHa: number | undefined;
      try {
        areaHa = turf.area(turf.feature(payload.geometry)) / 10000;
      } catch { /* ignore */ }
      setNewFieldSeed({ geometry: payload.geometry, areaHa });
      setNewFieldOpen(true);
      setAwaitingFieldDraw(false);
      return;
    }

    pendingDrawPayloadRef.current = payload;
    setFinishedGeometry(payload.geometry);
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
        return;
      }
      if (dest === 'measurement') {
        try {
          let kind: 'length' | 'area' = 'length';
          let value = 0;
          let unit: 'm' | 'km' | 'm²' | 'ha' = 'm';
          const formatted = measurementText ?? '';
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
  }, [setAnnotations]);

  const handleDiscardAnnotation = useCallback(() => {
    setPendingDraw(null);
    pendingDrawPayloadRef.current = null;
  }, []);

  return {
    // Annotation selection
    selectedAnnotationId,
    setSelectedAnnotationId,
    sidebarOpen,
    setSidebarOpen,

    // Drawing
    pendingDraw,
    finishedGeometry,
    measurementText,
    handleDrawFinish,
    clearFinished,
    handleSaveAsPick,
    handleSaveAnnotation,
    handleDiscardAnnotation,

    // Editing
    editingAnnotationId,
    preEditGeometryRef,
    handleAnnotationEdit,
    handleGeometryChange,
    handleFinishEditing,
    handleCancelEditing,

    // CRUD
    handleAnnotationSelect,
    handleAnnotationDelete,
    handleBatchDelete,
    dropMapNote,
    flyToAnnotation,

    // Tasks on annotations
    taskCountByAnnotation,

    // Measurement modal
    saveMeasurementPending,
    setSaveMeasurementPending,

    // New field from draw
    newFieldSeed,
    setNewFieldSeed,
    newFieldOpen,
    setNewFieldOpen,
  };
}
