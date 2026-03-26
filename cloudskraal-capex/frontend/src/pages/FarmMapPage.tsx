import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import FarmMap from '../components/map/FarmMap';
import FieldPanel from '../components/map/FieldPanel';
import { getMapGeoJSON } from '../api/farms';

export default function FarmMapPage() {
  const { fieldId } = useParams<{ fieldId?: string }>();
  const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(fieldId || null);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    getMapGeoJSON()
      .then(data => { setGeojson(data); setLoading(false); })
      .catch(err => { console.error('Failed to load GeoJSON:', err); setLoading(false); });
  }, []);

  return (
    <div className="h-[calc(100vh-5rem)] md:h-screen relative overflow-hidden">
      {/* Map fills the full container */}
      {loading ? (
        <div className="w-full h-full bg-stone-200 flex items-center justify-center">
          <p className="text-stone-500 text-sm">Loading map...</p>
        </div>
      ) : (
        <FarmMap
          geojson={geojson}
          selectedFieldId={selectedFieldId}
          onFieldSelect={setSelectedFieldId}
          onMapReady={(map) => { mapRef.current = map; }}
        />
      )}

      {/* Field detail panel — overlays on top of map (fixed positioning) */}
      <FieldPanel
        fieldId={selectedFieldId}
        onClose={() => setSelectedFieldId(null)}
      />
    </div>
  );
}
