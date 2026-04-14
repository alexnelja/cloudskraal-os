import { useEffect, useRef } from 'react';
import type maplibregl from 'maplibre-gl';
import { MaplibreMeasureControl } from '@watergis/maplibre-gl-terradraw';
import '@watergis/maplibre-gl-terradraw/dist/maplibre-gl-terradraw.css';

interface MeasureToolProps {
  map: maplibregl.Map | null;
}

export default function MeasureTool({ map }: MeasureToolProps) {
  const controlRef = useRef<MaplibreMeasureControl | null>(null);

  useEffect(() => {
    if (!map) return;
    if (controlRef.current) return;

    const control = new MaplibreMeasureControl({
      modes: ['render', 'linestring', 'polygon', 'delete-selection', 'delete'],
      measureUnitType: 'metric',
      distancePrecision: 2,
      areaPrecision: 2,
      open: false,
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
