/**
 * Frontend registry of basemap raster sources. Swapped at runtime without
 * rebuilding the whole map style — the FarmMap component removes the
 * existing `basemap` source + layer and re-adds from the selected entry.
 *
 * Kept as a static registry (not a DB table) because these are stable
 * well-known tile endpoints, not per-farm configuration. If a basemap
 * needs to be added across all users, add it here and redeploy.
 */

export type BasemapSourceType = 'xyz' | 'wmts' | 'imageserver';

export interface BasemapTileSource {
  url: string;
  attribution: string;
  /**
   * Metadata only in A1 — no runtime branching. A2's Esri MapServer adapter
   * will consume this when it lands.
   */
  sourceType: BasemapSourceType;
  maxzoom?: number;
  tileSize?: number;
}

export interface BasemapDef {
  id: string;
  label: string;
  /** One-line helper shown in the switcher tooltip. */
  description: string;
  /** Primary raster tile source. */
  primary: BasemapTileSource;
  /** Optional overlay raster layered above the primary (for Hybrid labels). */
  overlay?: BasemapTileSource;
  /** Placeholder CSS background for the switcher thumbnail while tiles load. */
  thumbBg: string;
  /** Optional coverage badge shown in BasemapSwitcher; omit to render nothing. */
  coverage?: 'Global' | 'SA' | 'WC';
}

export const BASEMAPS: BasemapDef[] = [
  {
    id: 'satellite',
    label: 'Satellite',
    description: 'Esri World Imagery — true-colour aerial',
    primary: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; Esri',
      sourceType: 'xyz',
      maxzoom: 19,
    },
    thumbBg:
      'linear-gradient(135deg, #3f6f4a 0%, #5a7a3a 40%, #8a7c3f 70%, #a89061 100%)',
  },
  {
    id: 'hybrid',
    label: 'Hybrid',
    description: 'Satellite with road + place labels',
    primary: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; Esri',
      sourceType: 'xyz',
      maxzoom: 19,
    },
    overlay: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; Esri',
      sourceType: 'xyz',
      maxzoom: 19,
    },
    thumbBg:
      'linear-gradient(135deg, #3f6f4a 0%, #5a7a3a 40%, #8a7c3f 70%, #a89061 100%)',
  },
  {
    id: 'streets',
    label: 'Streets',
    description: 'OpenStreetMap — roads and settlements',
    primary: {
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors',
      sourceType: 'xyz',
      maxzoom: 19,
    },
    thumbBg:
      'linear-gradient(135deg, #f2efe9 0%, #e0d8c4 60%, #c9bfa0 100%)',
  },
  {
    id: 'topographic',
    label: 'Topographic',
    description: 'Esri World Topo — contours + hillshade',
    primary: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; Esri',
      sourceType: 'xyz',
      maxzoom: 19,
    },
    thumbBg:
      'linear-gradient(135deg, #d9d0b7 0%, #b6a577 50%, #8a7845 100%)',
  },
  {
    id: 'terrain',
    label: 'Terrain',
    description: 'OpenTopoMap — detailed terrain and contours',
    primary: {
      url: 'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenTopoMap (CC-BY-SA)',
      sourceType: 'xyz',
      maxzoom: 17,
    },
    thumbBg:
      'linear-gradient(135deg, #f5ebd4 0%, #c9b67a 50%, #7a6037 100%)',
  },
  {
    id: 'dark',
    label: 'Dark',
    description: 'Carto dark matter — low-light for bright overlays',
    primary: {
      url: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      attribution: '&copy; CARTO &copy; OpenStreetMap contributors',
      sourceType: 'xyz',
      maxzoom: 19,
    },
    thumbBg:
      'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 60%, #3a3a3a 100%)',
  },
  {
    id: 'bluemarble',
    label: 'Blue Marble',
    description: 'NASA Blue Marble Next Generation — true-colour global composite',
    primary: {
      url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg',
      attribution: '&copy; NASA EOSDIS GIBS',
      sourceType: 'xyz',
      maxzoom: 8,
    },
    thumbBg:
      'linear-gradient(135deg, #123c6b 0%, #1f6a4a 50%, #8c7238 100%)',
  },
  {
    id: 'ngi-aerial-wc-2021',
    label: 'NGI Aerial 2021',
    description: 'NGI 25 cm aerial — Western Cape, 2021',
    coverage: 'WC',
    primary: {
      url: 'https://bp-cdngiapollo.dlrrd.gov.za/erdas-iws/ogc/wmts/CDNGI_PORTAL_BACKDROP?Service=WMTS&Request=GetTile&Version=1.0.0&Layer=CDNGI_Imagery_25cm_MOSAIC_Western_Cape_2021&Style=default&TileMatrixSet=GoogleMapsCompatibleExt:epsg:3857&TileMatrix={z}&TileRow={y}&TileCol={x}&Format=image/jpeg',
      attribution: '&copy; NGI (DALRRD)',
      sourceType: 'wmts',
      maxzoom: 17,
    },
    thumbBg:
      'linear-gradient(135deg, #3f6f4a 0%, #5a7a3a 40%, #8a7c3f 70%, #a89061 100%)',
  },
  {
    id: 'ngi-aerial-50cm',
    label: 'NGI Aerial 50cm',
    description: 'NGI 50 cm aerial — South Africa',
    coverage: 'SA',
    primary: {
      url: 'https://bp-cdngiapollo.dlrrd.gov.za/erdas-iws/ogc/wmts/CDNGI_PORTAL_BACKDROP?Service=WMTS&Request=GetTile&Version=1.0.0&Layer=CDNGI_Imagery_50cm_MOSAIC&Style=default&TileMatrixSet=GoogleMapsCompatibleExt:epsg:3857&TileMatrix={z}&TileRow={y}&TileCol={x}&Format=image/jpeg',
      attribution: '&copy; NGI (DALRRD)',
      sourceType: 'wmts',
      maxzoom: 17,
    },
    thumbBg:
      'linear-gradient(135deg, #4a5a3a 0%, #6a6a4a 50%, #8a7a5a 100%)',
  },
  {
    id: 'ngi-topo-50k',
    label: 'Topo 50K',
    description: 'NGI 1:50 000 topocadastral series',
    coverage: 'SA',
    primary: {
      url: 'https://bp-cdngiapollo.dlrrd.gov.za/erdas-iws/ogc/wmts/CDNGI_PORTAL_BACKDROP?Service=WMTS&Request=GetTile&Version=1.0.0&Layer=CDNGI_50K_Current_Mosaic&Style=default&TileMatrixSet=GoogleMapsCompatibleExt:epsg:3857&TileMatrix={z}&TileRow={y}&TileCol={x}&Format=image/png',
      attribution: '&copy; NGI (DALRRD)',
      sourceType: 'wmts',
      maxzoom: 17,
    },
    thumbBg:
      'linear-gradient(135deg, #e8dfc6 0%, #c7b894 55%, #8a6f3f 100%)',
  },
  {
    id: 'esri-hillshade-dark',
    label: 'Hillshade',
    description: 'Esri World Hillshade Dark — pure relief',
    coverage: 'Global',
    primary: {
      url: 'https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade_Dark/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; Esri',
      sourceType: 'xyz',
      maxzoom: 16,
    },
    thumbBg:
      'linear-gradient(135deg, #2a2a2a 0%, #4a4a4a 50%, #6a6a6a 100%)',
  },
];

export const DEFAULT_BASEMAP_ID = 'satellite';
const LS_KEY = 'capex.basemap';

export function getBasemap(id: string): BasemapDef {
  return BASEMAPS.find((b) => b.id === id) ?? BASEMAPS[0];
}

export function loadBasemapPreference(): string {
  try {
    const v = window.localStorage.getItem(LS_KEY);
    if (v && BASEMAPS.some((b) => b.id === v)) return v;
  } catch {
    // SSR / private mode — fall through
  }
  return DEFAULT_BASEMAP_ID;
}

export function saveBasemapPreference(id: string): void {
  try {
    window.localStorage.setItem(LS_KEY, id);
  } catch {
    // noop — localStorage unavailable
  }
}
