const booleanPointInPolygon = require('@turf/boolean-point-in-polygon').default;
const centroid = require('@turf/centroid').default;
const { point, feature } = require('@turf/helpers');

function probePoint(geometry) {
  if (geometry.type === 'Point') {
    return point(geometry.coordinates);
  }
  if (geometry.type === 'LineString' || geometry.type === 'Polygon') {
    return centroid(feature(geometry));
  }
  return null;
}

function parseGeometry(g) {
  return typeof g === 'string' ? JSON.parse(g) : g;
}

function resolveFieldId(geometry, fields) {
  const probe = probePoint(geometry);
  if (!probe) return { field_id: null, farm_id: null };
  for (const f of fields) {
    let fGeom;
    try { fGeom = parseGeometry(f.geometry); } catch { continue; }
    if (!fGeom || !fGeom.type) continue;
    if (fGeom.type !== 'Polygon' && fGeom.type !== 'MultiPolygon') continue;
    try {
      if (booleanPointInPolygon(probe, feature(fGeom))) {
        return { field_id: f.id, farm_id: f.farm_id ?? null };
      }
    } catch {
      // malformed polygon in a seed — skip, don't poison resolution
    }
  }
  return { field_id: null, farm_id: null };
}

module.exports = { resolveFieldId, probePoint };
