const centroid = require('@turf/centroid').default;
const { feature } = require('@turf/helpers');

/**
 * Queries ISRIC SoilGrids REST API for the given field's centroid.
 * Returns { pH, clay_pct, soc_g_per_kg, source, as_of } or null on failure.
 *
 * ISRIC units (per API docs):
 *   phh2o mean — value × 10 (e.g. 70 → pH 7.0)
 *   clay mean  — g/kg (value × 0.1 = %)
 *   soc mean   — dg/kg (value × 0.1 = g/kg)
 */
async function getSoilAtPoint(lng, lat) {
  const url =
    `https://rest.isric.org/soilgrids/v2.0/properties/query` +
    `?lon=${lng}&lat=${lat}` +
    `&property=phh2o&property=clay&property=soc` +
    `&depth=0-5cm&value=mean`;

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return null;
  const data = await res.json();
  const layers = data?.properties?.layers ?? [];

  const get = (name) =>
    layers.find((l) => l.name === name)?.depths?.[0]?.values?.mean ?? null;

  const phRaw = get('phh2o');
  const clayRaw = get('clay');
  const socRaw = get('soc');

  return {
    pH: phRaw == null ? null : Math.round(phRaw) / 10,
    clay_pct: clayRaw == null ? null : Math.round(clayRaw) / 10,
    soc_g_per_kg: socRaw == null ? null : Math.round(socRaw) / 10,
    source: 'ISRIC SoilGrids v2.0 (0-5cm, mean)',
    as_of: new Date().toISOString(),
  };
}

function fieldCentroid(field) {
  if (!field?.geometry) return null;
  try {
    const geom = typeof field.geometry === 'string' ? JSON.parse(field.geometry) : field.geometry;
    if (!geom?.coordinates) return null;
    const c = centroid(feature(geom));
    const [lng, lat] = c.geometry.coordinates;
    return { lng, lat };
  } catch {
    return null;
  }
}

module.exports = { getSoilAtPoint, fieldCentroid };
