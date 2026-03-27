import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';

interface GisLayer {
  id: string;
  source_url: string;
  source_type: string;
  visible: boolean;
  opacity: number;
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
}

function getWmsLayerName(url: string): string {
  if (url.includes('phh2o')) return 'phh2o_0-5cm_mean';
  if (url.includes('clay')) return 'clay_0-5cm_mean';
  if (url.includes('soc')) return 'soc_0-5cm_mean';
  return '';
}

function addFieldLayers(map: maplibregl.Map, geojson: GeoJSON.FeatureCollection) {
  map.addSource('fields', {
    type: 'geojson',
    data: geojson,
  });

  // Fill layer — colored by enterprise
  map.addLayer({
    id: 'fields-fill',
    type: 'fill',
    source: 'fields',
    paint: {
      'fill-color': [
        'match', ['get', 'enterprise'],
        'rooibos', '#047857',
        'wine', '#7c3aed',
        'sheep', '#d97706',
        'buchu', '#0d9488',
        'sceletium', '#059669',
        'grazing', '#a16207',
        'fallow', '#9ca3af',
        'other', '#6b7280',
        '#d1d5db',
      ],
      'fill-opacity': 0.35,
    },
  });

  // Outline layer — solid lines for fields
  map.addLayer({
    id: 'fields-outline',
    type: 'line',
    source: 'fields',
    paint: {
      'line-color': [
        'match', ['get', 'enterprise'],
        'rooibos', '#065f46',
        'wine', '#5b21b6',
        'sheep', '#92400e',
        'buchu', '#115e59',
        '#4b5563',
      ],
      'line-width': 1.5,
    },
  });

  // Highlight layer — for selected field
  map.addLayer({
    id: 'fields-highlight',
    type: 'line',
    source: 'fields',
    filter: ['==', ['get', 'id'], ''],
    paint: {
      'line-color': '#f59e0b',
      'line-width': 3,
    },
  });

  // Field labels — zoom-dependent: code at z13, full name+area at z15
  map.addLayer({
    id: 'fields-labels',
    type: 'symbol',
    source: 'fields',
    layout: {
      'text-field': [
        'step', ['zoom'],
        '',
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
  map.addSource('farm-boundaries', {
    type: 'geojson',
    data: boundaries,
  });

  // Dashed outline for farm boundaries
  map.addLayer({
    id: 'farm-boundaries-outline',
    type: 'line',
    source: 'farm-boundaries',
    paint: {
      'line-color': '#374151',
      'line-width': 2,
      'line-dasharray': [4, 2],
      'line-opacity': 0.6,
    },
  }, 'fields-fill'); // Insert BELOW field polygons

  // Farm name labels at low zoom
  map.addLayer({
    id: 'farm-boundaries-labels',
    type: 'symbol',
    source: 'farm-boundaries',
    layout: {
      'text-field': ['concat', ['get', 'name'], '\n', ['to-string', ['round', ['get', 'total_ha']]], ' ha'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 9, 11, 13, 14],
      'text-anchor': 'center',
      'text-allow-overlap': false,
      'text-max-width': 10,
      'text-line-height': 1.3,
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
    },
    paint: {
      'text-color': '#e5e7eb',
      'text-halo-color': 'rgba(0,0,0,0.8)',
      'text-halo-width': 2,
    },
    maxzoom: 13, // Hide farm labels when zoomed in (field labels take over)
  });
}

export default function FarmMap({
  geojson,
  farmBoundaries,
  selectedFieldId,
  onFieldSelect,
  visibleEnterprises,
  showFarmBoundaries = true,
  onMapReady,
  gisLayers,
}: FarmMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const layersAddedRef = useRef(false);
  const mapLoadedRef = useRef(false);

  const onFieldSelectRef = useRef(onFieldSelect);
  onFieldSelectRef.current = onFieldSelect;

  const onMapReadyRef = useRef(onMapReady);
  onMapReadyRef.current = onMapReady;

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          satellite: {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            attribution: '&copy; Esri',
            maxzoom: 19,
          },
        },
        layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }],
      },
      center: [19.0198, -31.3222],
      zoom: 12,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    map.on('load', () => {
      mapRef.current = map;
      mapLoadedRef.current = true;
      onMapReadyRef.current?.(map);

      if (geojson) {
        addFieldLayers(map, geojson);
        layersAddedRef.current = true;
      }
      if (farmBoundaries) {
        addFarmBoundaryLayers(map, farmBoundaries);
      }
    });

    // Click handler
    map.on('click', 'fields-fill', (e) => {
      const feature = e.features?.[0];
      if (feature?.properties?.id) {
        onFieldSelectRef.current(feature.properties.id as string);
      }
    });

    // Hover handlers
    map.on('mouseenter', 'fields-fill', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'fields-fill', () => {
      map.getCanvas().style.cursor = '';
    });

    return () => {
      mapRef.current = null;
      layersAddedRef.current = false;
      mapLoadedRef.current = false;
      map.remove();
    };
    // geojson is handled via the ref-based approach below for updates;
    // the initial value is captured in the load handler closure above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update GeoJSON source when data changes after initial load
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geojson) return;

    if (!layersAddedRef.current) {
      // Map loaded before geojson was available — add layers now
      if (map.isStyleLoaded()) {
        addFieldLayers(map, geojson);
        layersAddedRef.current = true;
      }
      return;
    }

    const source = map.getSource('fields') as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(geojson);
    }
  }, [geojson]);

  // Update selected field highlight
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersAddedRef.current) return;
    map.setFilter('fields-highlight', ['==', ['get', 'id'], selectedFieldId || '']);
  }, [selectedFieldId]);

  // Update enterprise visibility filter
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersAddedRef.current) return;

    if (!visibleEnterprises) {
      // Show all fields
      map.setFilter('fields-fill', null);
      map.setFilter('fields-outline', null);
      map.setFilter('fields-labels', null);
    } else {
      const entFilter: maplibregl.FilterSpecification = ['in', ['get', 'enterprise'], ['literal', visibleEnterprises]];
      map.setFilter('fields-fill', entFilter);
      map.setFilter('fields-outline', entFilter);
      map.setFilter('fields-labels', entFilter);
    }

    // Farm boundaries toggle is independent of enterprise filter
    if (map.getLayer('farm-boundaries-outline')) {
      map.setLayoutProperty('farm-boundaries-outline', 'visibility', showFarmBoundaries ? 'visible' : 'none');
    }
    if (map.getLayer('farm-boundaries-labels')) {
      map.setLayoutProperty('farm-boundaries-labels', 'visibility', showFarmBoundaries ? 'visible' : 'none');
    }
  }, [visibleEnterprises, showFarmBoundaries]);

  // Manage GIS overlay layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current || !gisLayers) return;

    for (const layer of gisLayers) {
      const layerId = layer.id;
      const mapLayerId = `gis-${layerId}`;

      if (layer.visible) {
        if (!map.getSource(layerId)) {
          // Add source + layer
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
          }

          if (map.getSource(layerId)) {
            // Insert below field polygons if the layer exists
            const beforeLayer = map.getLayer('fields-fill') ? 'fields-fill' : undefined;
            map.addLayer(
              {
                id: mapLayerId,
                type: 'raster',
                source: layerId,
                paint: { 'raster-opacity': layer.opacity },
              },
              beforeLayer,
            );
          }
        } else {
          // Source already present — just update opacity
          if (map.getLayer(mapLayerId)) {
            map.setPaintProperty(mapLayerId, 'raster-opacity', layer.opacity);
          }
        }
      } else {
        // Not visible — remove layer and source if present
        if (map.getLayer(mapLayerId)) map.removeLayer(mapLayerId);
        if (map.getSource(layerId)) map.removeSource(layerId);
      }
    }
  }, [gisLayers]);

  return <div ref={mapContainerRef} className="w-full h-full" />;
}
