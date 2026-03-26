import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';

interface FarmMapProps {
  geojson: GeoJSON.FeatureCollection | null;
  selectedFieldId: string | null;
  onFieldSelect: (fieldId: string | null) => void;
  visibleEnterprises?: string[];
  onMapReady?: (map: maplibregl.Map) => void;
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
        'farm_boundary', 'transparent',
        'other', '#6b7280',
        '#d1d5db',
      ],
      'fill-opacity': [
        'case',
        ['==', ['get', 'enterprise'], 'farm_boundary'], 0,
        0.35,
      ],
    },
  });

  // Outline layer — solid lines for everything except farm_boundary
  map.addLayer({
    id: 'fields-outline',
    type: 'line',
    source: 'fields',
    filter: ['!=', ['get', 'enterprise'], 'farm_boundary'],
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

  // Outline layer — dashed lines for farm_boundary
  map.addLayer({
    id: 'fields-outline-boundary',
    type: 'line',
    source: 'fields',
    filter: ['==', ['get', 'enterprise'], 'farm_boundary'],
    paint: {
      'line-color': '#374151',
      'line-width': 2,
      'line-dasharray': [4, 2],
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
}

export default function FarmMap({
  geojson,
  selectedFieldId,
  onFieldSelect,
  visibleEnterprises,
  onMapReady,
}: FarmMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const layersAddedRef = useRef(false);

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
      onMapReadyRef.current?.(map);

      if (geojson) {
        addFieldLayers(map, geojson);
        layersAddedRef.current = true;
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
      // Show all
      map.setFilter('fields-fill', null);
      map.setFilter('fields-outline', ['!=', ['get', 'enterprise'], 'farm_boundary']);
      map.setFilter('fields-outline-boundary', ['==', ['get', 'enterprise'], 'farm_boundary']);
    } else {
      const entFilter: maplibregl.FilterSpecification = ['in', ['get', 'enterprise'], ['literal', visibleEnterprises]];
      map.setFilter('fields-fill', entFilter);
      // For outline layers, combine with the boundary / non-boundary distinction
      map.setFilter('fields-outline', [
        'all',
        entFilter,
        ['!=', ['get', 'enterprise'], 'farm_boundary'],
      ]);
      map.setFilter('fields-outline-boundary', [
        'all',
        entFilter,
        ['==', ['get', 'enterprise'], 'farm_boundary'],
      ]);
    }
  }, [visibleEnterprises]);

  return <div ref={mapContainerRef} className="w-full h-full" />;
}
