import * as turf from '@turf/turf';

export interface ContainingFarmMatch {
  farmId: string;
  farmName: string;
}

/**
 * Given the loaded farm-boundaries GeoJSON and a drawn geometry, find the farm
 * whose polygon contains the geometry's centroid. Returns null if no farm matches
 * (e.g. the drawn polygon falls outside every boundary).
 *
 * Used when a polygon is drawn via the polygon-first add-field flow (5n): we
 * auto-select the farm in NewFieldModal so the operator doesn't have to pick.
 */
export function findContainingFarm(
  farmBoundaries: GeoJSON.FeatureCollection | null,
  drawn: GeoJSON.Geometry,
): ContainingFarmMatch | null {
  if (!farmBoundaries) return null;
  let centroid: GeoJSON.Feature<GeoJSON.Point>;
  try {
    centroid = turf.centroid(turf.feature(drawn));
  } catch {
    return null;
  }
  for (const f of farmBoundaries.features) {
    if (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon') continue;
    try {
      const contains = turf.booleanPointInPolygon(
        centroid,
        f as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
      );
      if (contains) {
        const props = f.properties ?? {};
        return {
          farmId: String(props.id ?? props.farm_id ?? ''),
          farmName: String(props.name ?? props.farm_name ?? props.id ?? 'unknown'),
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}
