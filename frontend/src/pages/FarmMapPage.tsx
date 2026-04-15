import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import FarmMap from '../components/map/FarmMap';
import FieldPanel from '../components/map/FieldPanel';
import MapControls from '../components/map/MapControls';
import LayerControl from '../components/map/LayerControl';
import { AnimatePresence, motion } from 'motion/react';
import { MapPinArea, ClipboardText, NotePencil, CheckSquare, MapPin } from '@phosphor-icons/react';
import AnnotateTool, { type DrawFinishPayload } from '../components/map/tools/AnnotateTool';
import SaveAnnotationModal from '../components/map/SaveAnnotationModal';
import AnnotationsSidebar from '../components/map/AnnotationsSidebar';
import AnnotationMarkers from '../components/map/AnnotationMarkers';
import CreateTaskModal, { type TaskContext } from '../components/map/CreateTaskModal';
import MapContextMenu, { type MenuItem } from '../components/map/MapContextMenu';
import MapOverlayRail from '../components/map/MapOverlayRail';
import type { MapContextMenuEvent } from '../components/map/FarmMap';
import { listTasks, createTask, type Task } from '../api/tasks';
import { createAnnotation } from '../api/annotations';
import { API_BASE_URL } from '../api/config';
import { getMapGeoJSON, getFarmBoundaries, getFarms, getFields, getMapLayers, updateMapLayer } from '../api/farms';
import {
  listAnnotations as apiListAnnotations,
  createAnnotation as apiCreateAnnotation,
  deleteAnnotation as apiDeleteAnnotation,
} from '../api/annotations';
import type { Farm, Field, MapLayer } from '../types/farm';
import type { Annotation, CreateAnnotationInput } from '../types/annotation';
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
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingDraw, setPendingDraw] = useState<DrawFinishPayload | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; title: string; items: MenuItem[];
  } | null>(null);
  const [createTaskContext, setCreateTaskContext] = useState<{
    context: TaskContext; defaultTitle: string;
  } | null>(null);

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

    apiListAnnotations().then(setAnnotations).catch(err => {
      console.error('Failed to load annotations:', err);
    });
    listTasks().then(setTasks).catch(err => {
      console.error('Failed to load tasks:', err);
    });
  }, []);

  const refreshTasks = useCallback(async () => {
    try { setTasks(await listTasks()); } catch (e) { console.error(e); }
  }, []);

  const taskCountByAnnotation = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of tasks) {
      if (t.annotation_id && t.status !== 'completed' && t.status !== 'cancelled') {
        m[t.annotation_id] = (m[t.annotation_id] ?? 0) + 1;
      }
    }
    return m;
  }, [tasks]);

  const refreshAnnotations = useCallback(async () => {
    try { setAnnotations(await apiListAnnotations()); }
    catch (e) { console.error('Failed to refresh annotations:', e); }
  }, []);

  const flyToAnnotation = useCallback((ann: Annotation) => {
    const map = mapRef.current;
    if (!map) return;
    const walk = (c: unknown): [number, number][] => {
      if (Array.isArray(c) && typeof c[0] === 'number') return [[c[0] as number, c[1] as number]];
      if (Array.isArray(c)) return (c as unknown[]).flatMap(walk);
      return [];
    };
    const pts = walk((ann.geometry as { coordinates: unknown }).coordinates);
    if (pts.length === 0) return;
    if (pts.length === 1) {
      map.flyTo({ center: pts[0], zoom: Math.max(map.getZoom(), 15) });
      return;
    }
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const [lng, lat] of pts) {
      minLng = Math.min(minLng, lng); minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng); maxLat = Math.max(maxLat, lat);
    }
    map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 80 });
  }, []);

  // Deep-link: ?annotation=<id>
  useEffect(() => {
    const annId = searchParams.get('annotation');
    if (!annId || annotations.length === 0) return;
    const ann = annotations.find((a) => a.id === annId);
    if (!ann) return;
    setSelectedAnnotationId(annId);
    setSidebarOpen(true);
    flyToAnnotation(ann);
  }, [searchParams, annotations, flyToAnnotation]);

  const handleDrawFinish = useCallback((payload: DrawFinishPayload) => {
    setPendingDraw(payload);
  }, []);

  const handleSaveAnnotation = useCallback(async (input: CreateAnnotationInput) => {
    try {
      const created = await apiCreateAnnotation(input);
      setAnnotations((prev) => [created, ...prev]);
      setSelectedAnnotationId(created.id);
      setSidebarOpen(true);
      setPendingDraw(null);
    } catch (e) {
      console.error('Save annotation failed:', e);
    }
  }, []);

  const handleDiscardAnnotation = useCallback(() => {
    setPendingDraw(null);
  }, []);

  const handleAnnotationSelect = useCallback((id: string) => {
    setSelectedAnnotationId(id);
    setSidebarOpen(true);
    const ann = annotations.find((a) => a.id === id);
    if (ann) flyToAnnotation(ann);
  }, [annotations, flyToAnnotation]);

  const openCreateTaskModal = useCallback((ctx: TaskContext, defaultTitle: string) => {
    setCreateTaskContext({ context: ctx, defaultTitle });
  }, []);

  const handleSaveTask = useCallback(async (input: Parameters<typeof createTask>[0]) => {
    try {
      await createTask(input);
      setCreateTaskContext(null);
      refreshTasks();
    } catch (e) {
      console.error('Create task failed', e);
    }
  }, [refreshTasks]);

  const handleMapContextMenu = useCallback((e: MapContextMenuEvent) => {
    const items: MenuItem[] = [];
    if (e.target === 'field' && e.fieldId) {
      items.push({
        id: 'task-for-field',
        label: `Create task for ${e.fieldName ?? 'this field'}`,
        Icon: ClipboardText,
        tint: 'emerald',
        onClick: () =>
          openCreateTaskModal(
            { kind: 'field', label: e.fieldName ?? 'field', fieldId: e.fieldId! },
            '',
          ),
      });
    } else {
      items.push({
        id: 'task-here',
        label: 'Create task at this location',
        Icon: ClipboardText,
        tint: 'emerald',
        onClick: async () => {
          // First drop a task_location pin, then open CreateTaskModal linked to it.
          try {
            const pin = await createAnnotation({
              type: 'pin',
              title: 'Task location',
              category: 'task_location',
              geometry: { type: 'Point', coordinates: [e.lng, e.lat] },
            });
            setAnnotations((prev) => [pin, ...prev]);
            openCreateTaskModal(
              { kind: 'annotation', label: pin.title, annotationId: pin.id },
              '',
            );
          } catch (err) { console.error(err); }
        },
      });
      items.push({
        id: 'map-note',
        label: 'Drop map note',
        Icon: NotePencil,
        tint: 'amber',
        onClick: async () => {
          try {
            const pin = await createAnnotation({
              type: 'pin',
              title: 'Map note',
              category: 'map_note',
              geometry: { type: 'Point', coordinates: [e.lng, e.lat] },
            });
            setAnnotations((prev) => [pin, ...prev]);
            setSelectedAnnotationId(pin.id);
            setSidebarOpen(true);
            // Append to the Map Notes wiki page (best-effort)
            try {
              await fetch(`${API_BASE_URL}/wiki/map-notes/append`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ annotation_id: pin.id }),
              });
            } catch (err2) { console.warn('wiki append failed', err2); }
          } catch (err) { console.error(err); }
        },
      });
    }
    setContextMenu({
      x: e.x,
      y: e.y,
      title: e.target === 'field' ? (e.fieldName ?? 'Field') : 'Map',
      items,
    });
  }, [openCreateTaskModal]);

  const handleMarkerContextMenu = useCallback(
    (annotationId: string, x: number, y: number) => {
      const ann = annotations.find((a) => a.id === annotationId);
      if (!ann) return;
      const items: MenuItem[] = [
        {
          id: 'task-linked',
          label: `Create task linked to ${ann.title}`,
          Icon: CheckSquare,
          tint: 'emerald',
          onClick: () =>
            openCreateTaskModal(
              { kind: 'annotation', label: ann.title, annotationId: ann.id },
              '',
            ),
        },
        {
          id: 'fly-to',
          label: 'Zoom to this pin',
          Icon: MapPin,
          tint: 'stone',
          onClick: () => {
            setSelectedAnnotationId(ann.id);
            setSidebarOpen(true);
          },
        },
      ];
      setContextMenu({ x, y, title: ann.title, items });
    },
    [annotations, openCreateTaskModal],
  );

  const handleAnnotationDelete = useCallback(async (id: string) => {
    try {
      await apiDeleteAnnotation(id);
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
      if (selectedAnnotationId === id) setSelectedAnnotationId(null);
      if (searchParams.get('annotation') === id) {
        searchParams.delete('annotation');
        setSearchParams(searchParams, { replace: true });
      }
    } catch (e) {
      console.error('Delete annotation failed:', e);
    }
  }, [selectedAnnotationId, searchParams, setSearchParams]);

  // Suppress unused warning in strict mode (reserved for future server refetch).
  void refreshAnnotations;

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
    <div className="h-[calc(100vh-5rem)] md:h-screen relative overflow-hidden">
      {/* Map fills the full container */}
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
          onMapReady={(map) => { mapRef.current = map; setMapInstance(map); }}
          gisLayers={mapLayers}
          annotations={annotations}
          selectedAnnotationId={selectedAnnotationId}
          onAnnotationSelect={handleAnnotationSelect}
          onContextMenu={handleMapContextMenu}
        />
      )}

      {/* Top-right rail: nav + layers + annotations toggle */}
      {!loading && (
        <MapOverlayRail position="tr">
          <MapControls
            farms={farms}
            fields={fields}
            enterprises={enterprises}
            visibleEnterprises={visibleEnterprises ?? enterprises}
            onEnterpriseToggle={handleEnterpriseToggle}
            onFarmZoom={handleFarmZoom}
            onFieldSelect={handleFieldSelect}
          />
          <LayerControl
            layers={mapLayers}
            onToggle={handleLayerToggle}
            onOpacityChange={handleLayerOpacity}
          />
          <AnimatePresence>
            {!sidebarOpen && (
              <motion.button
                key="annotations-toggle"
                type="button"
                onClick={() => setSidebarOpen(true)}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                className="glass-button rounded-full px-4 py-2.5 text-[12px] font-medium text-stone-800 flex items-center gap-2"
              >
                <MapPinArea size={16} weight="duotone" className="text-amber-700" />
                <span>Annotations</span>
                <span className="text-[11px] font-mono text-stone-500">{annotations.length}</span>
              </motion.button>
            )}
          </AnimatePresence>
        </MapOverlayRail>
      )}

      {/* Enterprise color legend — bottom-left rail */}
      {!loading && enterprises.length > 0 && (() => {
        const legendEnterprises = enterprises.filter(
          e => e !== 'farm_boundary' && e !== 'unclassified',
        );
        if (legendEnterprises.length === 0) return null;
        return (
          <MapOverlayRail position="bl">
            {/* Mobile: collapsible */}
            <div className="md:hidden">
              {legendExpanded ? (
                <div className="glass-panel rounded-xl px-3 py-2 flex flex-col gap-1">
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
                  className="glass-button rounded-full px-3 py-2 text-xs font-semibold text-stone-700"
                >
                  Legend ▼
                </button>
              )}
            </div>
            {/* Desktop: always visible */}
            <div className="hidden md:block glass-panel rounded-xl px-3 py-2">
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
          </MapOverlayRail>
        );
      })()}

      {/* Annotate tool — mounts terradraw controls on the map */}
      <AnnotateTool map={mapInstance} onFinish={handleDrawFinish} />

      {/* Category icon markers overlay (QGIS-style) */}
      <AnnotationMarkers
        map={mapInstance}
        annotations={annotations}
        selectedId={selectedAnnotationId}
        onSelect={handleAnnotationSelect}
        onContextMenu={handleMarkerContextMenu}
      />

      {/* Context menu on right-click */}
      <MapContextMenu
        open={contextMenu !== null}
        x={contextMenu?.x ?? 0}
        y={contextMenu?.y ?? 0}
        title={contextMenu?.title}
        items={contextMenu?.items ?? []}
        onDismiss={() => setContextMenu(null)}
      />

      {/* Create task modal */}
      <CreateTaskModal
        open={createTaskContext !== null}
        defaultTitle={createTaskContext?.defaultTitle ?? ''}
        context={createTaskContext?.context ?? { kind: 'blank', label: 'location' }}
        onSave={handleSaveTask}
        onCancel={() => setCreateTaskContext(null)}
      />

      {/* Save dialog after finishing a draw */}
      <SaveAnnotationModal
        open={pendingDraw !== null}
        type={pendingDraw?.type ?? 'pin'}
        geometry={pendingDraw?.geometry ?? { type: 'Point', coordinates: [0, 0] }}
        onSave={handleSaveAnnotation}
        onDiscard={handleDiscardAnnotation}
      />

      {/* Annotations sidebar */}
      <AnnotationsSidebar
        open={sidebarOpen}
        annotations={annotations}
        selectedId={selectedAnnotationId}
        onToggle={() => setSidebarOpen(false)}
        onSelect={handleAnnotationSelect}
        onDelete={handleAnnotationDelete}
        taskCountById={taskCountByAnnotation}
      />

      {/* Field detail panel — overlays on top of map */}
      <FieldPanel
        fieldId={selectedFieldId}
        onClose={() => setSelectedFieldId(null)}
      />
    </div>
  );
}
