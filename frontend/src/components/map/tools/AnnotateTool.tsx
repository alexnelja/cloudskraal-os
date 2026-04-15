import { useEffect, useRef } from 'react';
import type maplibregl from 'maplibre-gl';
import { MaplibreMeasureControl } from '@watergis/maplibre-gl-terradraw';
import {
  TerraDrawLineStringMode,
  TerraDrawPolygonMode,
  TerraDrawPointMode,
  TerraDrawUndoRedoKeyboardShortcuts,
} from 'terra-draw';
import '@watergis/maplibre-gl-terradraw/dist/maplibre-gl-terradraw.css';
import type { AnnotationType } from '../../../types/annotation';

export interface DrawFinishPayload {
  type: AnnotationType;
  geometry: GeoJSON.Geometry;
}

interface AnnotateToolProps {
  map: maplibregl.Map | null;
  onFinish?: (payload: DrawFinishPayload) => void;
}

function geometryToType(geom: GeoJSON.Geometry): AnnotationType | null {
  if (geom.type === 'LineString') return 'line';
  if (geom.type === 'Polygon') return 'polygon';
  if (geom.type === 'Point') return 'pin';
  return null;
}

export default function AnnotateTool({ map, onFinish }: AnnotateToolProps) {
  const controlRef = useRef<MaplibreMeasureControl | null>(null);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    if (!map) return;
    if (controlRef.current) return;

    const commonModeOptions = {
      showCoordinatePoints: true,
      editable: true,
      keyEvents: { cancel: 'Escape', finish: 'Enter' },
    };

    const control = new MaplibreMeasureControl({
      modes: ['render', 'linestring', 'polygon', 'point', 'delete-selection', 'delete'],
      measureUnitType: 'metric',
      distancePrecision: 2,
      areaPrecision: 2,
      open: false,
      modeOptions: {
        linestring: new TerraDrawLineStringMode(commonModeOptions),
        polygon: new TerraDrawPolygonMode(commonModeOptions),
        point: new TerraDrawPointMode({ editable: true }),
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

    const td = control.getTerraDrawInstance?.();
    if (td && typeof td.on === 'function') {
      td.on('finish', (featureId: string | number) => {
        const snapshot = typeof td.getSnapshot === 'function' ? td.getSnapshot() : [];
        const feature = snapshot?.find((f) => f.id === featureId);
        if (!feature) return;
        const annType = geometryToType(feature.geometry as GeoJSON.Geometry);
        if (!annType) return;
        onFinishRef.current?.({ type: annType, geometry: feature.geometry as GeoJSON.Geometry });
      });
    }

    return () => {
      if (controlRef.current) {
        map.removeControl(controlRef.current);
        controlRef.current = null;
      }
    };
  }, [map]);

  return null;
}
