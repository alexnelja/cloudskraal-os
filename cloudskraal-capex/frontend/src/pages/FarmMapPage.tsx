import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Map as MapIcon } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import PageHeader from '../components/layout/PageHeader';
import FarmMap from '../components/map/FarmMap';
import FieldPanel from '../components/map/FieldPanel';
import MapControls from '../components/map/MapControls';
import LayerControl from '../components/map/LayerControl';
import { getMapGeoJSON, getFarmBoundaries, getFarms, getFields, getMapLayers, updateMapLayer } from '../api/farms';
import type { Farm, Field, MapLayer } from '../types/farm';
import { ENTERPRISE_COLORS, ENTERPRISE_LABELS } from '../types/farm';

function getBoundsForFarm(
  geojson: GeoJSON.FeatureCollection,
  farmCode: string | null,
): [number, number, number, number] | null {
  const features = farmCode
    ? geojson.features.filter(f => f.properties?.farm_code === farmCode)
    : geojson.features;
  if (features.length === 0) return null;

  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const f of features) {
    const walkCoords = (coords: unknown) => {
      if (Array.isArray(coords) && typeof coords[0] === 'number') {
        minLng = Math.min(minLng, coords[0] as number);
        minLat = Math.min(minLat, coords[1] as number);
        maxLng = Math.max(maxLng, coords[0] as number);
        maxLat = Math.max(maxLat, coords[1] as number);
      } else if (Array.isArray(coords)) {
        (coords as unknown[]).forEach(walkCoords);
      }
    };
    if ((f.geometry as { coordinates?: unknown })?.coordinates) {
      walkCoords((f.geometry as { coordinates: unknown }).coordinates);
    }
  }
  if (!isFinite(minLng)) return null;
  return [minLng, minLat, maxLng, maxLat];
}

function getUniqueEnterprises(geojson: GeoJSON.FeatureCollection): string[] {
  const seen = new Set<string>();
  for (const f of geojson.features) {
    const ent = f.properties?.enterprise as string | undefined;
    if (ent) seen.add(ent);
  }
  return Array.from(seen);
}

export default function FarmMapPage() {
  const { fieldId } = useParams<{ fieldId?: string }>();
  const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(fieldId || null);
  const [loading, setLoading] = useState(true);
  const [visibleEnterprises, setVisibleEnterprises] = useState<string[] | undefined>(undefined);
  const [enterprises, setEnterprises] = useState<string[]>([]);
  const [farmBoundaries, setFarmBoundaries] = useState<GeoJSON.FeatureCollection | null>(null);
  const [showFarmBoundaries, setShowFarmBoundaries] = useState(true);
  const [mapLayers, setMapLayers] = useState<MapLayer[]>([]);
  const [legendExpanded, setLegendExpanded] = useState(false);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    Promise.all([
      getMapGeoJSON(),
      getFarmBoundaries(),
      getFarms(),
      getFields(),
      getMapLayers(),
    ]).then(([gj, boundaries, farmList, fieldList, layerList]) => {
      setGeojson(gj);
      setFarmBoundaries(boundaries);
      setFarms(farmList);
      setFields(fieldList);
      setMapLayers(layerList);
      const ents = getUniqueEnterprises(gj);
      setEnterprises(ents);
      setVisibleEnterprises(ents); // start with all visible
      setLoading(false);
    }).catch(err => {
      console.error('Failed to load map data:', err);
      setLoading(false);
    });
  }, []);

  function handleLayerToggle(layerId: string, visible: boolean) {
    setMapLayers(prev =>
      prev.map(l => l.id === layerId ? { ...l, visible } : l),
    );
    updateMapLayer(layerId, { visible }).catch(err =>
      console.error('Failed to persist layer visibility:', err),
    );
  }

  function handleLayerOpacity(layerId: string, opacity: number) {
    setMapLayers(prev =>
      prev.map(l => l.id === layerId ? { ...l, opacity } : l),
    );
    updateMapLayer(layerId, { opacity }).catch(err =>
      console.error('Failed to persist layer opacity:', err),
    );
  }

  function handleEnterpriseToggle(enterprise: string) {
    setVisibleEnterprises(prev => {
      const current = prev ?? enterprises;
      if (current.includes(enterprise)) {
        return current.filter(e => e !== enterprise);
      } else {
        return [...current, enterprise];
      }
    });
  }

  function handleFarmZoom(farmCode: string | null) {
    const map = mapRef.current;
    if (!map || !geojson) return;
    const bounds = getBoundsForFarm(geojson, farmCode);
    if (!bounds) return;
    const [minLng, minLat, maxLng, maxLat] = bounds;
    map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 50 });
  }

  function handleFieldSelect(fieldId: string) {
    setSelectedFieldId(fieldId);
    // Zoom to field on the map — find it in geojson
    const map = mapRef.current;
    if (!map || !geojson) return;
    const feature = geojson.features.find(f => f.properties?.id === fieldId);
    if (!feature) return;
    const walkCoords = (coords: unknown): [number, number][] => {
      if (Array.isArray(coords) && typeof coords[0] === 'number') {
        return [[coords[0] as number, coords[1] as number]];
      } else if (Array.isArray(coords)) {
        return (coords as unknown[]).flatMap(walkCoords);
      }
      return [];
    };
    const pts = walkCoords((feature.geometry as { coordinates: unknown }).coordinates);
    if (pts.length === 0) return;
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const [lng, lat] of pts) {
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    }
    map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 80 });
  }

  return (
    <div className="h-[calc(100vh-5rem)] md:h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <PageHeader icon={MapIcon} title="Farm Map" />

      {/* Map fills the remaining space */}
      <div className="flex-1 relative overflow-hidden page-fade-in">
      {loading ? (
        <div className="w-full h-full bg-stone-200 flex items-center justify-center">
          <p className="text-stone-500 text-sm">Loading map...</p>
        </div>
      ) : (
        <FarmMap
          geojson={geojson}
          farmBoundaries={farmBoundaries}
          selectedFieldId={selectedFieldId}
          onFieldSelect={setSelectedFieldId}
          visibleEnterprises={visibleEnterprises}
          showFarmBoundaries={showFarmBoundaries}
          onMapReady={(map) => { mapRef.current = map; }}
          gisLayers={mapLayers}
        />
      )}

      {/* Floating map controls */}
      {!loading && (
        <MapControls
          farms={farms}
          fields={fields}
          enterprises={enterprises}
          visibleEnterprises={visibleEnterprises ?? enterprises}
          onEnterpriseToggle={handleEnterpriseToggle}
          onFarmZoom={handleFarmZoom}
          onFieldSelect={handleFieldSelect}
        />
      )}

      {/* GIS layer control */}
      {!loading && (
        <LayerControl
          layers={mapLayers}
          onToggle={handleLayerToggle}
          onOpacityChange={handleLayerOpacity}
        />
      )}

      {/* Enterprise color legend */}
      {!loading && enterprises.length > 0 && (() => {
        const legendEnterprises = enterprises.filter(
          e => e !== 'farm_boundary' && e !== 'unclassified',
        );
        if (legendEnterprises.length === 0) return null;
        return (
          <div className="absolute bottom-8 left-3 z-10">
            {/* Mobile: collapsible */}
            <div className="md:hidden">
              {legendExpanded ? (
                <div className="bg-white/90 backdrop-blur rounded-lg shadow px-3 py-2 flex flex-col gap-1">
                  <button
                    onClick={() => setLegendExpanded(false)}
                    className="text-xs font-semibold text-stone-600 text-left mb-1"
                  >
                    Legend ▲
                  </button>
                  {legendEnterprises.map(ent => (
                    <div key={ent} className="flex items-center gap-2">
                      <span
                        className="rounded-full shrink-0"
                        style={{
                          width: 10,
                          height: 10,
                          backgroundColor: ENTERPRISE_COLORS[ent] ?? '#d1d5db',
                        }}
                      />
                      <span className="text-xs text-stone-700">
                        {ENTERPRISE_LABELS[ent] ?? ent}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <button
                  onClick={() => setLegendExpanded(true)}
                  className="bg-white/90 backdrop-blur rounded-lg shadow px-3 py-2 text-xs font-semibold text-stone-600"
                >
                  Legend ▼
                </button>
              )}
            </div>
            {/* Desktop: always visible */}
            <div className="hidden md:block bg-white/90 backdrop-blur rounded-lg shadow px-3 py-2">
              <p className="text-xs font-semibold text-stone-500 mb-1">Fields</p>
              <div className="flex flex-col gap-1">
                {legendEnterprises.map(ent => (
                  <div key={ent} className="flex items-center gap-2">
                    <span
                      className="rounded-full shrink-0"
                      style={{
                        width: 10,
                        height: 10,
                        backgroundColor: ENTERPRISE_COLORS[ent] ?? '#d1d5db',
                      }}
                    />
                    <span className="text-xs text-stone-700">
                      {ENTERPRISE_LABELS[ent] ?? ent}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-stone-200 mt-2 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showFarmBoundaries}
                    onChange={() => setShowFarmBoundaries(!showFarmBoundaries)}
                    className="rounded border-stone-300 text-stone-600"
                  />
                  <span className="inline-block w-4 border-t-2 border-dashed border-stone-500" />
                  <span className="text-xs text-stone-700">Farm Boundaries</span>
                </label>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Field detail panel — overlays on top of map */}
      <FieldPanel
        fieldId={selectedFieldId}
        onClose={() => setSelectedFieldId(null)}
      />
      </div>
    </div>
  );
}
