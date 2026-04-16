/**
 * Removes entries from map_layers that behave as full basemaps rather than
 * overlays — those live in the frontend BASEMAPS registry and are swapped
 * via BasemapSwitcher, not toggled in LayerControl.
 *
 * Idempotent — deletes by name; no-op if already removed.
 */
const BASEMAP_NAMES = [
  'Esri World Topographic',   // duplicates registry 'topographic'
  'NASA Blue Marble (Next Gen)', // promoted to registry 'bluemarble'
];

function migrateMapLayersCleanupBasemaps(db) {
  const del = db.prepare('DELETE FROM map_layers WHERE name = ?');
  for (const name of BASEMAP_NAMES) {
    del.run(name);
  }
}

module.exports = { migrateMapLayersCleanupBasemaps, BASEMAP_NAMES };
