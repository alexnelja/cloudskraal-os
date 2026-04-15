const { v4: uuidv4 } = require('uuid');

/**
 * Deprecate map layers pointing at known-dead sources and insert a
 * curated set of live alternatives. Idempotent — safe to run on every boot.
 *
 * Verified live as of 2026-04-15:
 *   - ISRIC SoilGrids WMS (soil pH, clay, organic carbon)
 *   - NDA Northern Cape ArcGIS (agricultural capability)
 *   - Esri World Topographic Map
 *   - NASA GIBS IMERG Precipitation Rate (low-zoom, daily)
 *   - NASA GIBS MODIS Terra NDVI 8-day (vegetation index)
 */
const DEAD_HOST = 'gis.elsenburg.com';

const LIVE_LAYERS = [
  {
    name: 'Soil pH (0-5cm)',
    source_url: 'https://maps.isric.org/mapserv?map=/map/phh2o.map',
    source_type: 'wms',
    category: 'soils',
  },
  {
    name: 'Soil Clay (0-5cm)',
    source_url: 'https://maps.isric.org/mapserv?map=/map/clay.map',
    source_type: 'wms',
    category: 'soils',
  },
  {
    name: 'Soil Organic Carbon (0-5cm)',
    source_url: 'https://maps.isric.org/mapserv?map=/map/soc.map',
    source_type: 'wms',
    category: 'soils',
  },
  {
    name: 'NASA IMERG Precipitation Rate',
    source_url:
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/IMERG_Precipitation_Rate/default/2026-04-01/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png',
    source_type: 'xyz',
    category: 'climate',
  },
  {
    name: 'MODIS NDVI (8-day)',
    source_url:
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/2026-04-01/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png',
    source_type: 'xyz',
    category: 'vegetation',
  },
  {
    name: 'Esri World Topographic',
    source_url:
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    source_type: 'xyz',
    category: 'topography',
  },
  {
    name: 'Agricultural Capability (NC)',
    source_url: 'https://ndagis.nda.agric.za/arcgis/rest/services/Northern_Cape/MapServer',
    source_type: 'arcgis_tiles',
    category: 'agriculture',
  },
];

function migrateMapLayersLive(db) {
  // Remove known-dead rows
  db.prepare('DELETE FROM map_layers WHERE source_url LIKE ?').run(`%${DEAD_HOST}%`);

  // Remove legacy ISRIC entries (pre-renaming) — superseded by the "(0-5cm)" named rows
  const legacyNames = ['Soil pH', 'Soil Clay Content', 'Soil Organic Carbon'];
  const delStmt = db.prepare('DELETE FROM map_layers WHERE name = ?');
  for (const n of legacyNames) delStmt.run(n);

  // Upsert live rows by name
  const existing = new Map(
    db.prepare('SELECT name, id FROM map_layers').all().map((r) => [r.name, r.id]),
  );
  const insert = db.prepare(`
    INSERT INTO map_layers (id, name, source_url, source_type, category, visible, opacity, z_index)
    VALUES (?, ?, ?, ?, ?, 0, 0.7, 0)
  `);
  const update = db.prepare(`
    UPDATE map_layers SET source_url = ?, source_type = ?, category = ? WHERE id = ?
  `);

  for (const layer of LIVE_LAYERS) {
    const existingId = existing.get(layer.name);
    if (existingId) {
      update.run(layer.source_url, layer.source_type, layer.category, existingId);
    } else {
      insert.run(uuidv4(), layer.name, layer.source_url, layer.source_type, layer.category);
    }
  }
}

module.exports = { migrateMapLayersLive, LIVE_LAYERS };
