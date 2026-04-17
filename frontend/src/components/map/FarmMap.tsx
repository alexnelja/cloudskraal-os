import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { Annotation } from '../../types/annotation';
import { getBasemap, DEFAULT_BASEMAP_ID } from '../../config/basemaps';

interface GisLayer {
  id: string;
  source_url: string;
  source_type: string;
  visible: boolean;
  opacity: number;
}

export interface MapContextMenuEvent {
  target: 'field' | 'blank';
  fieldId?: string;
  fieldName?: string;
  lng: number;
  lat: number;
  x: number;
  y: number;
}

interface FarmMapProps {
  geojson: GeoJSON.FeatureCollection | null;
  farmBoundaries: GeoJSON.FeatureCollection | null;
  selectedFieldId: string | null;
  onFieldSelect: (fieldId: string | null) => void;
  visibleEnterprises?: string[];
  showFarmBoundaries?: boolean;
  onMapReady?: (map: maplibregl.Map) => void;
  gisLayers?: GisLayer[];
  annotations?: Annotation[];
  selectedAnnotationId?: string | null;
  onAnnotationSelect?: (id: string) => void;
  onContextMenu?: (e: MapContextMenuEvent) => void;
  /** Fires on every map click with geo coordinates. Use for armed drop modes. */
  onMapClick?: (e: { lng: number; lat: number; onField: boolean }) => void;
  /** CSS cursor override (e.g. 'crosshair' while armed). */
  cursor?: string;
  /** Basemap id from config/basemaps. Changes swap raster source/layer in place. */
  basemapId?: string;
  /** Enterprise colours (from useEnterpriseColors). Updates map paint live. */
  enterpriseColors?: Record<string, string>;
}

function buildFillColorExpr(colors?: Record<string, string>): maplibregl.ExpressionSpecification {
  const c = colors ?? {};
  return [
    'match', ['get', 'enterprise'],
    'rooibos', c.rooibos ?? '#047857',
    'wine', c.wine ?? '#7c3aed',
    'sheep', c.sheep ?? '#d97706',
    'buchu', c.buchu ?? '#0d9488',
    'sceletium', c.sceletium ?? '#059669',
    'grazing', c.grazing ?? '#a16207',
    'fallow', c.fallow ?? '#9ca3af',
    'other', c.other ?? '#6b7280',
    c.unclassified ?? '#d1d5db',
  ] as maplibregl.ExpressionSpecification;
}

function getWmsLayerName(url: string): string {
  if (url.includes('phh2o')) return 'phh2o_0-5cm_mean';
  if (url.includes('clay')) return 'clay_0-5cm_mean';
  if (url.includes('soc')) return 'soc_0-5cm_mean';
  return '';
}

function addFieldLayers(map: maplibregl.Map, geojson: GeoJSON.FeatureCollection) {
  map.addSource('fields', { type: 'geojson', data: geojson });
  map.addLayer({
    id: 'fields-fill', type: 'fill', source: 'fields',
    paint: {
      'fill-color': [
        'match', ['get', 'enterprise'],
        'rooibos', '#047857', 'wine', '#7c3aed', 'sheep', '#d97706',
        'buchu', '#0d9488', 'sceletium', '#059669', 'grazing', '#a16207',
        'fallow', '#9ca3af', 'other', '#6b7280', '#d1d5db',
      ],
      'fill-opacity': 0.35,
    },
  });
  map.addLayer({
    id: 'fields-outline', type: 'line', source: 'fields',
    paint: {
      'line-color': [
        'match', ['get', 'enterprise'],
        'rooibos', '#065f46', 'wine', '#5b21b6', 'sheep', '#92400e',
        'buchu', '#115e59', '#4b5563',
      ],
      'line-width': 1.5,
    },
  });
  map.addLayer({
    id: 'fields-highlight', type: 'line', source: 'fields',
    filter: ['==', ['get', 'id'], ''],
    paint: { 'line-color': '#f59e0b', 'line-width': 3 },
  });
  map.addLayer({
    id: 'fields-labels', type: 'symbol', source: 'fields',
    layout: {
      'text-field': [
        'step', ['zoom'], '',
        13, ['get', 'code'],
        15, ['concat', ['get', 'name'], '\n', ['to-string', ['round', ['get', 'area_ha']]], ' ha'],
      ],
      'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10, 16, 13],
      'text-anchor': 'center',
      'text-allow-overlap': false,
      'text-ignore-placement': false,
      'text-max-width': 8,
      'text-line-height': 1.2,
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': 'rgba(0,0,0,0.7)',
      'text-halo-width': 1.5,
    },
  });
}

function addFarmBoundaryLayers(map: maplibregl.Map, boundaries: GeoJSON.FeatureCollection) {
  map.addSource('farm-boundaries', { type: 'geojson', data: boundaries });
  map.addLayer({
    id: 'farm-boundaries-outline', type: 'line', source: 'farm-boundaries',
    paint: {
      'line-color': '#374151', 'line-width': 2,
      'line-dasharray': [4, 2], 'line-opacity': 0.6,
    },
  }, 'fields-fill');
  map.addLayer({
    id: 'farm-boundaries-labels', type: 'symbol', source: 'farm-boundaries',
    layout: {
      'text-field': ['concat', ['get', 'name'], '\n', ['to-string', ['round', ['get', 'total_ha']]], ' ha'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 9, 11, 13, 14],
      'text-anchor': 'center', 'text-allow-overlap': false,
      'text-max-width': 10, 'text-line-height': 1.3,
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
    },
    paint: {
      'text-color': '#e5e7eb',
      'text-halo-color': 'rgba(0,0,0,0.8)',
      'text-halo-width': 2,
    },
    maxzoom: 13,
  });
}

function annotationsToFC(
  annotations: Annotation[],
  type: 'line' | 'polygon' | 'pin',
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: annotations
      .filter((a) => a.type === type)
      .map((a) => ({
        type: 'Feature',
        id: a.id,
        properties: { id: a.id, title: a.title, category: a.category ?? 'generic' },
        geometry: a.geometry,
      })),
  };
}

function addAnnotationLayers(map: maplibregl.Map) {
  const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
  map.addSource('annotations-lines', { type: 'geojson', data: empty });
  map.addSource('annotations-polygons', { type: 'geojson', data: empty });
  map.addSource('annotations-pins', { type: 'geojson', data: empty });

  map.addLayer({
    id: 'ann-poly-fill', type: 'fill', source: 'annotations-polygons',
    paint: { 'fill-color': '#f59e0b', 'fill-opacity': 0.15 },
  });
  map.addLayer({
    id: 'ann-poly-outline', type: 'line', source: 'annotations-polygons',
    paint: { 'line-color': '#d97706', 'line-width': 2 },
  });
  map.addLayer({
    id: 'ann-poly-highlight', type: 'line', source: 'annotations-polygons',
    filter: ['==', ['get', 'id'], ''],
    paint: { 'line-color': '#b45309', 'line-width': 4 },
  });

  map.addLayer({
    id: 'ann-line', type: 'line', source: 'annotations-lines',
    paint: { 'line-color': '#d97706', 'line-width': 2 },
  });
  map.addLayer({
    id: 'ann-line-highlight', type: 'line', source: 'annotations-lines',
    filter: ['==', ['get', 'id'], ''],
    paint: { 'line-color': '#b45309', 'line-width': 4 },
  });

  // Pin circle/label layers removed — AnnotationMarkers overlay renders Phosphor icons
  // as DOM markers (see components/map/AnnotationMarkers.tsx). Polygon + line stroke
  // layers above stay for geometry rendering.
}

export default function FarmMap({
  geojson, farmBoundaries, selectedFieldId, onFieldSelect,
  visibleEnterprises, showFarmBoundaries = true, onMapReady, gisLayers,
  annotations, selectedAnnotationId, onAnnotationSelect, onContextMenu,
  onMapClick, cursor, basemapId = DEFAULT_BASEMAP_ID, enterpriseColors,
}: FarmMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const layersAddedRef = useRef(false);
  const mapLoadedRef = useRef(false);

  const onFieldSelectRef = useRef(onFieldSelect);
  onFieldSelectRef.current = onFieldSelect;

  const onMapReadyRef = useRef(onMapReady);
  onMapReadyRef.current = onMapReady;

  const onAnnotationSelectRef = useRef(onAnnotationSelect);
  onAnnotationSelectRef.current = onAnnotationSelect;

  const onContextMenuRef = useRef(onContextMenu);
  onContextMenuRef.current = onContextMenu;

  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  // Swap basemap (+ optional overlay) source/layer in place when basemapId changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    const bm = getBasemap(basemapId);

    // Pick the first content layer above the basemap so we reinsert at the bottom.
    const layers = map.getStyle().layers ?? [];
    const firstContentId = layers.find((l) => l.id !== 'basemap' && l.id !== 'basemap-overlay')?.id;

    const removeIf = (id: string) => {
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    };
    removeIf('basemap-overlay');
    removeIf('basemap');

    map.addSource('basemap', {
      type: 'raster',
      tiles: [bm.primary.url],
      tileSize: bm.primary.tileSize ?? 256,
      attribution: bm.primary.attribution,
      maxzoom: bm.primary.maxzoom ?? 19,
    });
    map.addLayer({ id: 'basemap', type: 'raster', source: 'basemap' }, firstContentId);

    if (bm.overlay) {
      map.addSource('basemap-overlay', {
        type: 'raster',
        tiles: [bm.overlay.url],
        tileSize: bm.overlay.tileSize ?? 256,
        attribution: bm.overlay.attribution,
        maxzoom: bm.overlay.maxzoom ?? 19,
      });
      map.addLayer(
        { id: 'basemap-overlay', type: 'raster', source: 'basemap-overlay' },
        firstContentId,
      );
    }
  }, [basemapId]);

  // Live-update field polygon colours when enterprise colour overrides change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current || !enterpriseColors) return;
    try {
      if (map.getLayer('fields-fill')) {
        map.setPaintProperty('fields-fill', 'fill-color', buildFillColorExpr(enterpriseColors));
      }
    } catch { /* layer not yet added — ignore */ }
  }, [enterpriseColors]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialBm = getBasemap(basemapId);
    const initialSources: Record<string, maplibregl.SourceSpecification> = {
      basemap: {
        type: 'raster',
        tiles: [initialBm.primary.url],
        tileSize: initialBm.primary.tileSize ?? 256,
        attribution: initialBm.primary.attribution,
        maxzoom: initialBm.primary.maxzoom ?? 19,
      },
    };
    const initialLayers: maplibregl.LayerSpecification[] = [
      { id: 'basemap', type: 'raster', source: 'basemap' },
    ];
    if (initialBm.overlay) {
      initialSources['basemap-overlay'] = {
        type: 'raster',
        tiles: [initialBm.overlay.url],
        tileSize: initialBm.overlay.tileSize ?? 256,
        attribution: initialBm.overlay.attribution,
        maxzoom: initialBm.overlay.maxzoom ?? 19,
      };
      initialLayers.push({ id: 'basemap-overlay', type: 'raster', source: 'basemap-overlay' });
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: { version: 8, sources: initialSources, layers: initialLayers },
      center: [19.0198, -31.3222],
      zoom: 12,
      attributionControl: false,
    });

    // No NavigationControl: zoom via trackpad pinch / scroll / +/- keys;
    // the top-right rail is reserved for MapControls / LayerControl / Annotations.
    // Attribution stays bottom-right but CSS offsets it above the FAB's footprint.
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    map.on('load', () => {
      mapRef.current = map;
      mapLoadedRef.current = true;
      onMapReadyRef.current?.(map);

      if (geojson) {
        addFieldLayers(map, geojson);
        layersAddedRef.current = true;
      }
      if (farmBoundaries) addFarmBoundaryLayers(map, farmBoundaries);
      addAnnotationLayers(map);
    });

    map.on('click', 'fields-fill', (e) => {
      const feature = e.features?.[0];
      if (feature?.properties?.id) {
        onFieldSelectRef.current(feature.properties.id as string);
      }
    });

    // Global click — emits lng/lat for armed drop modes. Skips if the
    // click was already handled by the field / annotation layers above
    // so normal select interactions aren't doubled.
    map.on('click', (e) => {
      const cb = onMapClickRef.current;
      if (!cb) return;
      const features = map.queryRenderedFeatures(e.point, {
        layers: ['fields-fill'],
      });
      cb({
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
        onField: (features?.length ?? 0) > 0,
      });
    });

    for (const layerId of ['ann-line', 'ann-poly-fill']) {
      map.on('click', layerId, (e) => {
        const feature = e.features?.[0];
        if (feature?.properties?.id) {
          onAnnotationSelectRef.current?.(feature.properties.id as string);
        }
      });
      map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
    }

    map.on('mouseenter', 'fields-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'fields-fill', () => { map.getCanvas().style.cursor = ''; });

    // Right-click handling: emit an event with the clicked target info.
    map.getContainer().addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
    map.on('contextmenu', (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ['fields-fill'] });
      const feat = features?.[0];
      onContextMenuRef.current?.({
        target: feat ? 'field' : 'blank',
        fieldId: feat?.properties?.id as string | undefined,
        fieldName: feat?.properties?.name as string | undefined,
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
      });
    });

    return () => {
      mapRef.current = null;
      layersAddedRef.current = false;
      mapLoadedRef.current = false;
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geojson) return;

    if (!layersAddedRef.current) {
      if (map.isStyleLoaded()) {
        addFieldLayers(map, geojson);
        layersAddedRef.current = true;
      }
      return;
    }

    const source = map.getSource('fields') as maplibregl.GeoJSONSource | undefined;
    if (source) source.setData(geojson);
  }, [geojson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersAddedRef.current) return;
    map.setFilter('fields-highlight', ['==', ['get', 'id'], selectedFieldId || '']);
  }, [selectedFieldId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersAddedRef.current) return;

    if (!visibleEnterprises) {
      map.setFilter('fields-fill', null);
      map.setFilter('fields-outline', null);
      map.setFilter('fields-labels', null);
    } else {
      const entFilter: maplibregl.FilterSpecification = ['in', ['get', 'enterprise'], ['literal', visibleEnterprises]];
      map.setFilter('fields-fill', entFilter);
      map.setFilter('fields-outline', entFilter);
      map.setFilter('fields-labels', entFilter);
    }

    if (map.getLayer('farm-boundaries-outline')) {
      map.setLayoutProperty('farm-boundaries-outline', 'visibility', showFarmBoundaries ? 'visible' : 'none');
    }
    if (map.getLayer('farm-boundaries-labels')) {
      map.setLayoutProperty('farm-boundaries-labels', 'visibility', showFarmBoundaries ? 'visible' : 'none');
    }
  }, [visibleEnterprises, showFarmBoundaries]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current || !gisLayers) return;

    for (const layer of gisLayers) {
      const layerId = layer.id;
      const mapLayerId = `gis-${layerId}`;

      if (layer.visible) {
        if (!map.getSource(layerId)) {
          if (layer.source_type === 'arcgis_tiles') {
            map.addSource(layerId, {
              type: 'raster',
              tiles: [`${layer.source_url}/tile/{z}/{y}/{x}`],
              tileSize: 256,
            });
          } else if (layer.source_type === 'wms') {
            const wmsLayerName = getWmsLayerName(layer.source_url);
            map.addSource(layerId, {
              type: 'raster',
              tiles: [
                `${layer.source_url}&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${wmsLayerName}&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&SRS=EPSG:3857&FORMAT=image/png&TRANSPARENT=true`,
              ],
              tileSize: 256,
            });
          } else if (layer.source_type === 'xyz') {
            // URL already contains {z}/{y}/{x} placeholders — use as-is
            map.addSource(layerId, {
              type: 'raster',
              tiles: [layer.source_url],
              tileSize: 256,
            });
          }

          if (map.getSource(layerId)) {
            const beforeLayer = map.getLayer('fields-fill') ? 'fields-fill' : undefined;
            map.addLayer(
              {
                id: mapLayerId, type: 'raster', source: layerId,
                paint: { 'raster-opacity': layer.opacity },
              },
              beforeLayer,
            );
          }
        } else {
          if (map.getLayer(mapLayerId)) {
            map.setPaintProperty(mapLayerId, 'raster-opacity', layer.opacity);
          }
        }
      } else {
        if (map.getLayer(mapLayerId)) map.removeLayer(mapLayerId);
        if (map.getSource(layerId)) map.removeSource(layerId);
      }
    }
  }, [gisLayers]);

  // Sync annotation sources when list changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    const list = annotations ?? [];
    (map.getSource('annotations-lines') as maplibregl.GeoJSONSource | undefined)
      ?.setData(annotationsToFC(list, 'line'));
    (map.getSource('annotations-polygons') as maplibregl.GeoJSONSource | undefined)
      ?.setData(annotationsToFC(list, 'polygon'));
    (map.getSource('annotations-pins') as maplibregl.GeoJSONSource | undefined)
      ?.setData(annotationsToFC(list, 'pin'));
  }, [annotations]);

  // Update annotation highlight filters
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    const id = selectedAnnotationId ?? '';
    if (map.getLayer('ann-line-highlight')) {
      map.setFilter('ann-line-highlight', ['==', ['get', 'id'], id]);
    }
    if (map.getLayer('ann-poly-highlight')) {
      map.setFilter('ann-poly-highlight', ['==', ['get', 'id'], id]);
    }
  }, [selectedAnnotationId]);

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-full"
      style={cursor ? { cursor } : undefined}
      data-cursor={cursor ?? 'grab'}
    />
  );
}
