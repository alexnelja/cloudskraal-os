import { useEffect, useRef } from 'react';
import type maplibregl from 'maplibre-gl';
import { MaplibreMeasureControl } from '@watergis/maplibre-gl-terradraw';
import {
  TerraDrawLineStringMode,
  TerraDrawPolygonMode,
  TerraDrawUndoRedoKeyboardShortcuts,
} from 'terra-draw';
import '@watergis/maplibre-gl-terradraw/dist/maplibre-gl-terradraw.css';

interface MeasureToolProps {
  map: maplibregl.Map | null;
}

export default function MeasureTool({ map }: MeasureToolProps) {
  const controlRef = useRef<MaplibreMeasureControl | null>(null);

  useEffect(() => {
    if (!map) return;
    if (controlRef.current) return;

    const commonModeOptions = {
      showCoordinatePoints: true,
      editable: true,
      keyEvents: { cancel: 'Escape', finish: 'Enter' },
    };

    const control = new MaplibreMeasureControl({
      modes: ['render', 'linestring', 'polygon', 'delete-selection', 'delete'],
      measureUnitType: 'metric',
      distancePrecision: 2,
      areaPrecision: 2,
      open: false,
      modeOptions: {
        linestring: new TerraDrawLineStringMode(commonModeOptions),
        polygon: new TerraDrawPolygonMode(commonModeOptions),
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
    map.addControl(control, 'top-right');

    return () => {
      if (controlRef.current) {
        map.removeControl(controlRef.current);
        controlRef.current = null;
      }
    };
  }, [map]);

  return null;
}
