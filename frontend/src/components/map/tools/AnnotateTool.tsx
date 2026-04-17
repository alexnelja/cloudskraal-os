import { useEffect, useRef } from 'react';
import type maplibregl from 'maplibre-gl';
import { MaplibreMeasureControl } from '@watergis/maplibre-gl-terradraw';
import {
  TerraDrawLineStringMode,
  TerraDrawPolygonMode,
  TerraDrawPointMode,
  TerraDrawSelectMode,
  TerraDrawUndoRedoKeyboardShortcuts,
} from 'terra-draw';
import '@watergis/maplibre-gl-terradraw/dist/maplibre-gl-terradraw.css';
import type { AnnotationType } from '../../../types/annotation';

export interface DrawFinishPayload {
  type: AnnotationType;
  geometry: GeoJSON.Geometry;
}

export type DrawMode = 'static' | 'linestring' | 'polygon' | 'point' | 'select' | 'render' | string;

type TerraDraw = { setMode: (mode: string) => void; on: (event: string, cb: (...args: unknown[]) => void) => void; getSnapshot?: () => unknown[]; getMode?: () => string; start?: () => void; enabled?: boolean; undo?: () => boolean; redo?: () => boolean; addFeatures?: (features: GeoJSON.Feature[]) => void; removeFeatures?: (ids: (string | number)[]) => void };

interface AnnotateToolProps {
  map: maplibregl.Map | null;
  onFinish?: (payload: DrawFinishPayload) => void;
  onModeChange?: (mode: DrawMode) => void;
  onReady?: (td: TerraDraw) => void;
  onGeometryChange?: (featureId: string | number, geometry: GeoJSON.Geometry) => void;
}

function geometryToType(geom: GeoJSON.Geometry): AnnotationType | null {
  if (geom.type === 'LineString') return 'line';
  if (geom.type === 'Polygon') return 'polygon';
  if (geom.type === 'Point') return 'pin';
  return null;
}

export default function AnnotateTool({ map, onFinish, onModeChange, onReady, onGeometryChange }: AnnotateToolProps) {
  const controlRef = useRef<MaplibreMeasureControl | null>(null);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const onModeChangeRef = useRef(onModeChange);
  onModeChangeRef.current = onModeChange;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onGeometryChangeRef = useRef(onGeometryChange);
  onGeometryChangeRef.current = onGeometryChange;
  const readyFiredRef = useRef(false);

  useEffect(() => {
    if (!map) return;
    if (controlRef.current) return;

    const commonModeOptions = {
      showCoordinatePoints: true,
      editable: true,
      keyEvents: { cancel: 'Escape', finish: 'Enter' },
      snapping: { toCoordinate: true, toLine: true },
    };

    const control = new MaplibreMeasureControl({
      modes: ['render', 'linestring', 'polygon', 'point', 'select', 'delete-selection', 'delete'],
      measureUnitType: 'metric',
      distancePrecision: 2,
      areaPrecision: 2,
      open: false,
      modeOptions: {
        linestring: new TerraDrawLineStringMode({
          ...commonModeOptions,
          styles: { snappingPointColor: '#d97706', snappingPointWidth: 6, snappingPointOutlineColor: '#fff', snappingPointOutlineWidth: 2 },
        }),
        polygon: new TerraDrawPolygonMode({
          ...commonModeOptions,
          styles: { snappingPointColor: '#d97706', snappingPointWidth: 6, snappingPointOutlineColor: '#fff', snappingPointOutlineWidth: 2 },
        }),
        point: new TerraDrawPointMode({ editable: true }),
        select: new TerraDrawSelectMode({
          flags: {
            polygon: {
              feature: {
                draggable: true,
                rotateable: true,
                scaleable: true,
                coordinates: { midpoints: true, draggable: true, deletable: true },
              },
            },
            linestring: {
              feature: {
                draggable: true,
                coordinates: { midpoints: true, draggable: true, deletable: true },
              },
            },
            point: {
              feature: { draggable: true },
            },
          },
        }),
      },
      undoRedo: {
        keyboardShortcuts: new TerraDrawUndoRedoKeyboardShortcuts({
          undo: [{ key: 'z', heldKeys: ['Meta'] }, { key: 'z', heldKeys: ['Control'] }],
          redo: [
            { key: 'z', heldKeys: ['Meta', 'Shift'] },
            { key: 'z', heldKeys: ['Control', 'Shift'] },
            { key: 'y', heldKeys: ['Control'] },
          ],
        }),
      },
    });

    controlRef.current = control;

    map.addControl(control, 'top-left');
    // Hide the library's built-in DOM container so only our React MeasureToolbar
    // is visible. The addControl call is still required — it triggers onAdd(map)
    // which is the only place TerraDraw is instantiated inside the library.
    const container = (control as unknown as { controlContainer?: HTMLElement }).controlContainer
      ?? (control as unknown as { _container?: HTMLElement })._container;
    if (container) container.style.display = 'none';

    const td = control.getTerraDrawInstance?.();
    if (td && typeof td.on === 'function') {
      // The library's own UI calls td.start() lazily when a button is clicked.
      // Since we hide that UI and use our own MeasureToolbar, we must start it here.
      if (typeof td.start === 'function' && !td.enabled) {
        td.start();
      }
      td.on('finish', (featureId: string | number) => {
        // Guard: skip re-trigger from clicking an already-saved feature (pin bug fix)
        const mode = typeof td.getMode === 'function' ? td.getMode() : null;
        if (mode === 'static' || mode === 'select') return;
        const snapshot = typeof td.getSnapshot === 'function' ? td.getSnapshot() : [];
        const feature = snapshot?.find((f) => f.id === featureId);
        if (!feature) return;
        const annType = geometryToType(feature.geometry as GeoJSON.Geometry);
        if (!annType) return;
        onFinishRef.current?.({ type: annType, geometry: feature.geometry as GeoJSON.Geometry });
      });

      td.on('change', (ids: (string | number)[], type: string) => {
        if (type !== 'update') return;
        const snapshot = typeof td.getSnapshot === 'function' ? td.getSnapshot() : [];
        if (!snapshot) return;
        for (const id of ids) {
          const feature = snapshot.find((f) => f.id === id);
          if (feature) {
            onGeometryChangeRef.current?.(id, feature.geometry as GeoJSON.Geometry);
          }
        }
      });

      if (!readyFiredRef.current) {
        readyFiredRef.current = true;
        onReadyRef.current?.(td as TerraDraw);
      }
    }

    // terradraw has no mode-change event; poll getMode() cheaply and fire
    // onModeChange whenever it transitions. 300ms is imperceptible and the
    // call is trivially fast.
    let lastMode: string | null = null;
    const modePollId = window.setInterval(() => {
      const current = typeof td?.getMode === 'function' ? td.getMode() : null;
      if (current && current !== lastMode) {
        lastMode = current;
        onModeChangeRef.current?.(current as DrawMode);
      }
    }, 300);

    return () => {
      window.clearInterval(modePollId);
      if (controlRef.current) {
        map.removeControl(controlRef.current);
      }
      controlRef.current = null;
    };
  }, [map]);

  return null;
}
