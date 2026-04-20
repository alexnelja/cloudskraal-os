import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getMapGeoJSON, getFarmBoundaries, getFarms, getFields, getMapLayers, updateMapLayer, deleteField } from '../api/farms';
import { listAnnotations as apiListAnnotations } from '../api/annotations';
import { listTasks, type Task } from '../api/tasks';
import { useEnterpriseColors } from './useEnterpriseColors';
import { useOnlineStatus } from './useOnlineStatus';
import { flushQueue, getQueue } from '../lib/syncQueue';
import type { Farm, Field, MapLayer } from '../types/farm';
import type { Annotation } from '../types/annotation';

function getUniqueEnterprises(geojson: GeoJSON.FeatureCollection): string[] {
  const seen = new Set<string>();
  for (const f of geojson.features) {
    const ent = f.properties?.enterprise as string | undefined;
    if (ent) seen.add(ent);
  }
  return Array.from(seen);
}

export function useMapData() {
  const { fieldId } = useParams<{ fieldId?: string }>();

  const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(fieldId || null);
  const { colors: enterpriseColors, setColor: setEnterpriseColor } = useEnterpriseColors();
  const isOnline = useOnlineStatus();
  const [syncPending, setSyncPending] = useState(getQueue().length);

  const [loading, setLoading] = useState(true);
  const [visibleEnterprises, setVisibleEnterprises] = useState<string[] | undefined>(undefined);
  const [enterprises, setEnterprises] = useState<string[]>([]);
  const [farmBoundaries, setFarmBoundaries] = useState<GeoJSON.FeatureCollection | null>(null);
  const [showFarmBoundaries, setShowFarmBoundaries] = useState(true);
  const [mapLayers, setMapLayers] = useState<MapLayer[]>([]);
  const [legendExpanded, setLegendExpanded] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [loadNonce, setLoadNonce] = useState(0);

  // Flush sync queue when coming back online
  useEffect(() => {
    if (!isOnline) return;
    if (getQueue().length === 0) return;
    flushQueue().then(() => setSyncPending(getQueue().length));
  }, [isOnline]);

  // Main data fetch
  useEffect(() => {
    const errors: string[] = [];
    let pending = 5;
    const done = () => {
      pending -= 1;
      if (pending === 0) {
        setLoadErrors(errors);
        setLoading(false);
      }
    };

    getMapGeoJSON()
      .then(gj => {
        setGeojson(gj);
        const ents = getUniqueEnterprises(gj);
        setEnterprises(ents);
        setVisibleEnterprises(ents);
      })
      .catch(err => { console.error('getMapGeoJSON:', err); errors.push('map'); })
      .finally(done);

    getFarmBoundaries()
      .then(setFarmBoundaries)
      .catch(err => { console.error('getFarmBoundaries:', err); errors.push('boundaries'); })
      .finally(done);

    getFarms()
      .then(setFarms)
      .catch(err => { console.error('getFarms:', err); errors.push('farms'); })
      .finally(done);

    getFields()
      .then(setFields)
      .catch(err => { console.error('getFields:', err); errors.push('fields'); })
      .finally(done);

    getMapLayers()
      .then(setMapLayers)
      .catch(err => { console.error('getMapLayers:', err); errors.push('layers'); })
      .finally(done);

    apiListAnnotations().then(setAnnotations).catch(err => {
      console.error('Failed to load annotations:', err);
    });
    listTasks().then(setTasks).catch(err => {
      console.error('Failed to load tasks:', err);
    });
  }, [loadNonce]);

  const refreshTasks = useCallback(async () => {
    try { setTasks(await listTasks()); } catch (e) { console.error(e); }
  }, []);

  const refreshAnnotations = useCallback(async () => {
    try { setAnnotations(await apiListAnnotations()); }
    catch (e) { console.error('Failed to refresh annotations:', e); }
  }, []);

  // Layer handlers
  const handleLayerToggle = useCallback((layerId: string, visible: boolean) => {
    setMapLayers(prev =>
      prev.map(l => l.id === layerId ? { ...l, visible } : l),
    );
    updateMapLayer(layerId, { visible }).catch(err =>
      console.error('Failed to persist layer visibility:', err),
    );
  }, []);

  const handleLayerOpacity = useCallback((layerId: string, opacity: number) => {
    setMapLayers(prev =>
      prev.map(l => l.id === layerId ? { ...l, opacity } : l),
    );
    updateMapLayer(layerId, { opacity }).catch(err =>
      console.error('Failed to persist layer opacity:', err),
    );
  }, []);

  // Enterprise filter
  const handleEnterpriseToggle = useCallback((enterprise: string) => {
    setVisibleEnterprises(prev => {
      const current = prev ?? enterprises;
      if (current.includes(enterprise)) {
        return current.filter(e => e !== enterprise);
      } else {
        return [...current, enterprise];
      }
    });
  }, [enterprises]);

  // Field CRUD
  const handleDeleteField = useCallback(async (fId: string) => {
    const field = fields.find((f) => f.id === fId);
    const label = field ? field.name : 'this field';
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;
    try {
      await deleteField(fId);
      if (selectedFieldId === fId) setSelectedFieldId(null);
      setLoadNonce((n) => n + 1);
    } catch (err) {
      console.error('Failed to delete field', err);
    }
  }, [fields, selectedFieldId]);

  const handleEditField = useCallback((_fieldId: string) => {
    // Exposed as setter — page component uses setEditFieldId directly
  }, []);

  const retryLoad = useCallback(() => {
    setLoadErrors([]);
    setLoading(true);
    setLoadNonce(n => n + 1);
  }, []);

  const bumpLoadNonce = useCallback(() => {
    setLoadNonce(n => n + 1);
  }, []);

  // Suppress unused warning (reserved for future server refetch).
  void refreshAnnotations;

  return {
    // Data
    geojson,
    farms,
    fields,
    farmBoundaries,
    enterprises,
    enterpriseColors,
    setEnterpriseColor,
    annotations,
    setAnnotations,
    tasks,
    setTasks,
    mapLayers,

    // Selection
    selectedFieldId,
    setSelectedFieldId,

    // UI state
    loading,
    setLoading,
    loadErrors,
    visibleEnterprises,
    setVisibleEnterprises,
    showFarmBoundaries,
    setShowFarmBoundaries,
    legendExpanded,
    setLegendExpanded,

    // Online/sync
    isOnline,
    syncPending,

    // Actions
    refreshTasks,
    refreshAnnotations,
    handleLayerToggle,
    handleLayerOpacity,
    handleEnterpriseToggle,
    handleDeleteField,
    handleEditField,
    retryLoad,
    bumpLoadNonce,
    loadNonce,
  };
}
