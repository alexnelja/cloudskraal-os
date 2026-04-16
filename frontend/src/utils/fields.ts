import * as turf from '@turf/turf';

export interface EnclosingMatch {
  fieldId: string;
  fieldName: string;
}

/**
 * Returns the first field polygon that fully contains the drawn geometry,
 * or null if none does. Skips features that aren't polygons (can't contain).
 */
export function findEnclosingField(
  fieldsGeoJson: GeoJSON.FeatureCollection,
  drawn: GeoJSON.Geometry,
): EnclosingMatch | null {
  const drawnFeature = turf.feature(drawn);
  for (const f of fieldsGeoJson.features) {
    if (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon') continue;
    try {
      if (
        turf.booleanContains(
          f as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
          drawnFeature,
        )
      ) {
        return {
          fieldId: String(f.properties?.id ?? ''),
          fieldName: String(f.properties?.name ?? f.properties?.id ?? 'unknown'),
        };
      }
    } catch {
      // turf throws on degenerate geometries — treat as non-enclosing
      continue;
    }
  }
  return null;
}
