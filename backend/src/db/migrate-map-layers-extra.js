const { v4: uuidv4 } = require('uuid');

/**
 * Seeds additional GIS overlay layers beyond the core "live" set.
 * Idempotent — inserts each layer only if its name is not already present.
 *
 * Verified live 2026-04-16:
 *   - ESA WorldCover 10m 2021 (land cover) via NASA GIBS
 *   - Esri World Hillshade (topographic relief)
 *   - MODIS Terra Land Surface Temperature — Day (climate)
 *   - Esri World Transportation (road + rail overlay)
 *   - NASA GIBS Blue Marble Next Generation (reference imagery)
 */
const EXTRA_LAYERS = [
  {
    name: 'ESA WorldCover 10m (2021)',
    source_url:
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/ESA_WorldCover_10m_2021_v200/default/default/GoogleMapsCompatible_Level12/{z}/{y}/{x}.png',
    source_type: 'xyz',
    category: 'land_cover',
  },
  {
    name: 'Esri World Hillshade',
    source_url:
      'https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}',
    source_type: 'xyz',
    category: 'topography',
  },
  {
    name: 'MODIS Land Surface Temperature (Day)',
    source_url:
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Land_Surface_Temp_Day/default/2026-04-01/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png',
    source_type: 'xyz',
    category: 'climate',
  },
  {
    name: 'Roads & Rail (overlay)',
    source_url:
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
    source_type: 'xyz',
    category: 'infrastructure',
  },
  // NASA Blue Marble (Next Gen) previously lived here; promoted to the
  // frontend BASEMAPS registry as id 'bluemarble' — it behaves as a full
  // basemap, not an overlay, so LayerControl was the wrong place.
];

function migrateMapLayersExtra(db) {
  const existing = new Set(
    db.prepare('SELECT name FROM map_layers').all().map((r) => r.name),
  );
  const insert = db.prepare(`
    INSERT INTO map_layers (id, name, source_url, source_type, category, visible, opacity, z_index)
    VALUES (?, ?, ?, ?, ?, 0, 0.7, 0)
  `);
  for (const layer of EXTRA_LAYERS) {
    if (existing.has(layer.name)) continue;
    insert.run(uuidv4(), layer.name, layer.source_url, layer.source_type, layer.category);
  }
}

module.exports = { migrateMapLayersExtra, EXTRA_LAYERS };
