import { useState, useEffect, useCallback, useRef } from 'react';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import { GPS_DEBOUNCE_MS } from '../constants';

export interface DetectedField {
  fieldId: string;
  fieldName: string;
}

const DEBOUNCE_MS = GPS_DEBOUNCE_MS;
const MIN_MOVE_DEG = 0.0001; // ~11 m — skip check if position barely moved

/**
 * Watches the user's GPS position and determines which field polygon
 * (if any) the user is currently standing in.
 *
 * Returns the matched field or null. Pauses when the page is backgrounded.
 * Handles permission denied gracefully (returns null, never throws).
 */
export function useFieldDetection(
  geojson: GeoJSON.FeatureCollection | null,
  enabled: boolean,
): DetectedField | null {
  const [detected, setDetected] = useState<DetectedField | null>(null);
  const lastCheckRef = useRef(0);
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);

  const checkPosition = useCallback(
    (lat: number, lng: number) => {
      if (!geojson) return;

      const now = Date.now();
      const lastPos = lastPosRef.current;

      // Debounce: skip if checked recently and position hasn't moved significantly
      if (
        lastPos &&
        now - lastCheckRef.current < DEBOUNCE_MS &&
        Math.abs(lat - lastPos.lat) < MIN_MOVE_DEG &&
        Math.abs(lng - lastPos.lng) < MIN_MOVE_DEG
      ) {
        return;
      }

      lastCheckRef.current = now;
      lastPosRef.current = { lat, lng };

      const pt = point([lng, lat]);

      for (const feature of geojson.features) {
        if (
          feature.geometry.type !== 'Polygon' &&
          feature.geometry.type !== 'MultiPolygon'
        ) {
          continue;
        }
        if (booleanPointInPolygon(pt, feature as any)) {
          const fieldId = (feature.properties?.id ?? feature.properties?.fieldId ?? '') as string;
          const fieldName = (feature.properties?.name ?? 'Unknown field') as string;
          setDetected({ fieldId, fieldName });
          return;
        }
      }
      setDetected(null);
    },
    [geojson],
  );

  useEffect(() => {
    if (!enabled || !geojson) {
      setDetected(null);
      return;
    }

    // Visibility handling: pause when backgrounded
    let watchId: number | null = null;

    function startWatching() {
      if (watchId != null) return;
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (document.visibilityState !== 'visible') return;
          checkPosition(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          // Permission denied or error — fail silently
          setDetected(null);
        },
        { enableHighAccuracy: false },
      );
    }

    function stopWatching() {
      if (watchId != null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        startWatching();
      } else {
        stopWatching();
      }
    }

    startWatching();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopWatching();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, geojson, checkPosition]);

  return detected;
}
