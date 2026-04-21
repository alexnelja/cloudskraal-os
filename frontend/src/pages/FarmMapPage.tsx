import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import FarmMap from '../components/map/FarmMap';
import LoadingOverlay from '../components/ui/LoadingOverlay';
import FieldPanel from '../components/map/FieldPanel';
import FieldsSidebar from '../components/map/FieldsSidebar';
import NewFieldModal from '../components/map/NewFieldModal';
import EditFieldModal from '../components/map/EditFieldModal';
import LayerControl from '../components/map/LayerControl';
import { AnimatePresence, motion } from 'motion/react';
import { MapPinArea, NotePencil, List, Polygon as PolyIcon } from '@phosphor-icons/react';
import FluidSheet from '../components/map/FluidSheet';
import AnnotateTool, { type DrawFinishPayload } from '../components/map/tools/AnnotateTool';
import SaveAnnotationModal from '../components/map/SaveAnnotationModal';
import AnnotationsSidebar from '../components/map/AnnotationsSidebar';
import AnnotationMarkers from '../components/map/AnnotationMarkers';
import CreateTaskModal from '../components/map/CreateTaskModal';
import MapContextMenu from '../components/map/MapContextMenu';
import MapOverlayRail from '../components/map/MapOverlayRail';
import BasemapSwitcher from '../components/map/BasemapSwitcher';
import EnterpriseFilterBar from '../components/map/EnterpriseFilterBar';
import MeasureToolbar from '../components/map/MeasureToolbar';
import ExportMapButton from '../components/map/ExportMapButton';
import SaveMeasurementModal from '../components/map/SaveMeasurementModal';
import { WifiSlash } from '@phosphor-icons/react';
import { ENTERPRISE_LABELS } from '../types/farm';
import { useMapData } from '../hooks/useMapData';
import { useAnnotationState } from '../hooks/useAnnotationState';
import { useMapInteractions } from '../hooks/useMapInteractions';
import type { Measurement } from '../types/measurement';
import * as turf from '@turf/turf';

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

export default function FarmMapPage() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [editFieldId, setEditFieldId] = useState<string | null>(null);
  const [fieldsSidebarOpen, setFieldsSidebarOpen] = useState(false);
  const [fieldsSidebarCollapsed, setFieldsSidebarCollapsed] = useState(false);

  // --- Data hook ---
  const {
    geojson, farms, fields, farmBoundaries, enterprises, enterpriseColors, setEnterpriseColor,
    annotations, setAnnotations, tasks, mapLayers,
    selectedFieldId, setSelectedFieldId,
    loading, setLoading, loadErrors, visibleEnterprises, setVisibleEnterprises,
    showFarmBoundaries, setShowFarmBoundaries, legendExpanded, setLegendExpanded,
    isOnline, syncPending,
    refreshTasks, handleLayerToggle, handleLayerOpacity, handleEnterpriseToggle,
    handleDeleteField, retryLoad, bumpLoadNonce,
  } = useMapData();

  // --- Annotation hook ---
  const ann = useAnnotationState({
    mapRef, annotations, setAnnotations, tasks, geojson,
  });

  // --- Interactions hook ---
  const ix = useMapInteractions({
    mapRef, annotations, setAnnotations,
    dropMapNote: ann.dropMapNote,
    handleAnnotationSelect: ann.handleAnnotationSelect,
    setSidebarOpen: ann.setSidebarOpen,
    setSelectedAnnotationId: ann.setSelectedAnnotationId,
    refreshTasks,
  });

  // --- TerraDraw-dependent annotation wiring ---
  // These few handlers bridge annotation state with terraDraw from interactions.

  const handleAnnotationEditWired = useCallback((id: string) => {
    const editAnn = ann.handleAnnotationEdit(id);
    if (!editAnn || !ix.terraDraw) return;
    const geomType = editAnn.geometry.type;
    const mode = geomType === 'Polygon' ? 'polygon' : geomType === 'LineString' ? 'linestring' : 'point';
    const feature: GeoJSON.Feature = {
      id: editAnn.id,
      type: 'Feature',
      geometry: editAnn.geometry,
      properties: { mode },
    };
    ix.terraDraw.addFeatures?.([feature]);
    ix.terraDraw.setMode('select');
  }, [ann, ix.terraDraw]);

  const handleFinishEditingWired = useCallback(() => {
    const id = ann.handleFinishEditing();
    if (id && ix.terraDraw?.removeFeatures) {
      ix.terraDraw.removeFeatures([id]);
    }
    ix.terraDraw?.setMode('render');
  }, [ann, ix.terraDraw]);

  const handleCancelEditingWired = useCallback(() => {
    const id = ann.handleCancelEditing();
    if (id) {
      ix.terraDraw?.removeFeatures?.([id]);
    }
    ix.terraDraw?.setMode('render');
  }, [ann, ix.terraDraw]);

  const handleAnnotationDeleteWired = useCallback(async (id: string) => {
    await ann.handleAnnotationDelete(id, searchParams, setSearchParams);
  }, [ann, searchParams, setSearchParams]);

  // Wrap handleDrawFinish to pass awaitingFieldDraw state
  const handleDrawFinish = useCallback((payload: DrawFinishPayload) => {
    ann.handleDrawFinish(payload, ix.awaitingFieldDrawRef.current, ix.setAwaitingFieldDraw);
  }, [ann, ix.awaitingFieldDrawRef, ix.setAwaitingFieldDraw]);

  // handleAddField — opens modal or arms polygon draw
  const handleAddField = useCallback((opts?: { geometry?: GeoJSON.Geometry; areaHa?: number }) => {
    if (opts?.geometry) {
      ann.setNewFieldSeed(opts);
      ann.setNewFieldOpen(true);
      return;
    }
    if (ix.terraDraw) {
      ix.terraDraw.setMode('render');
      ix.terraDraw.setMode('polygon');
    }
    ix.setAwaitingFieldDraw(true);
  }, [ann, ix.terraDraw, ix.setAwaitingFieldDraw]);

  // Field select with zoom
  const handleFieldSelect = useCallback((fieldId: string) => {
    setSelectedFieldId(fieldId);
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
      minLng = Math.min(minLng, lng); minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng); maxLat = Math.max(maxLat, lat);
    }
    map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 80 });
  }, [setSelectedFieldId, geojson]);

  // Farm zoom
  const handleFarmZoom = useCallback((farmCode: string | null) => {
    const map = mapRef.current;
    if (!map || !geojson) return;
    const bounds = getBoundsForFarm(geojson, farmCode);
    if (!bounds) return;
    const [minLng, minLat, maxLng, maxLat] = bounds;
    map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 50 });
  }, [geojson]);

  // Deep-link: ?annotation=<id>
  useEffect(() => {
    const annId = searchParams.get('annotation');
    if (!annId || annotations.length === 0) return;
    const found = annotations.find((a) => a.id === annId);
    if (!found) return;
    ann.setSelectedAnnotationId(annId);
    ann.setSidebarOpen(true);
    ann.flyToAnnotation(found);
  }, [searchParams, annotations, ann]);

  const fieldsSidebar = (
    <FieldsSidebar
      farms={farms}
      fields={fields}
      enterprises={enterprises}
      visibleEnterprises={visibleEnterprises ?? enterprises}
      selectedFieldId={selectedFieldId}
      enterpriseColors={enterpriseColors}
      onEnterpriseToggle={handleEnterpriseToggle}
      onFarmSelect={handleFarmZoom}
      onFieldSelect={handleFieldSelect}
      onAddField={() => handleAddField()}
      onDeleteField={handleDeleteField}
      onEditField={setEditFieldId}
      onColorChange={setEnterpriseColor}
      collapsed={fieldsSidebarCollapsed}
      onToggleCollapse={() => setFieldsSidebarCollapsed((v) => !v)}
    />
  );

  return (
    <div className="h-[calc(100vh-5rem)] md:h-screen flex min-h-0">
      <a href="#map-container" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:bg-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg">
        Skip to map
      </a>
      {/* Desktop: inline flex child sidebar */}
      <div className="hidden md:block h-full">{fieldsSidebar}</div>

      {/* Mobile: FluidSheet overlay */}
      <div className="md:hidden">
        <FluidSheet side="left" open={fieldsSidebarOpen} onDismiss={() => setFieldsSidebarOpen(false)}>
          {fieldsSidebar}
        </FluidSheet>
      </div>

      {/* Map area — fills remaining space */}
      <div id="map-container" className="flex-1 relative min-h-0 overflow-hidden">
      {loading ? (
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}
          aria-busy="true"
        >
          <LoadingOverlay message="Loading map…" />
        </div>
      ) : (
        <div
          className="w-full h-full"
          onPointerDown={ix.longPress.onPointerDown}
          onPointerMove={ix.longPress.onPointerMove}
          onPointerUp={ix.longPress.onPointerUp}
          onPointerCancel={ix.longPress.onPointerCancel}
        >
        <FarmMap
          geojson={geojson}
          farmBoundaries={farmBoundaries}
          selectedFieldId={selectedFieldId}
          onFieldSelect={setSelectedFieldId}
          visibleEnterprises={visibleEnterprises}
          showFarmBoundaries={showFarmBoundaries}
          onMapReady={(map) => { mapRef.current = map; ix.setMapInstance(map); }}
          gisLayers={mapLayers}
          annotations={annotations}
          selectedAnnotationId={ann.selectedAnnotationId}
          onAnnotationSelect={ann.handleAnnotationSelect}
          onContextMenu={ix.handleMapContextMenu}
          onMapClick={ix.handleArmedMapClick}
          cursor={
            ix.armedDropMode || ['linestring', 'polygon', 'point'].includes(ix.drawMode)
              ? 'crosshair'
              : 'grab'
          }
          basemapId={ix.basemapId}
          enterpriseColors={enterpriseColors}
        />
        </div>
      )}

      {/* Long-press affordance ring */}
      <AnimatePresence>
        {ix.pressRing && (
          <motion.div
            key="press-ring"
            className="longpress-ring"
            style={{ left: ix.pressRing.x, top: ix.pressRing.y }}
            initial={{ scale: 0.2, opacity: 0.8 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.25, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
          />
        )}
      </AnimatePresence>

      {/* Data-load error toast */}
      <AnimatePresence>
        {loadErrors.length > 0 && (
          <motion.div
            key="load-error"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 glass-panel rounded-2xl px-4 py-3 flex items-center gap-3 max-w-md"
          >
            <span className="text-sm text-stone-800">
              Couldn't load: <span className="font-semibold">{loadErrors.join(', ')}</span>
            </span>
            <button
              onClick={retryLoad}
              className="glass-button rounded-full px-3 py-1 text-xs font-medium text-amber-800"
            >
              Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Offline indicator */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            key="offline-banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute top-3 left-1/2 -translate-x-1/2 z-30 glass-panel rounded-full px-4 py-2 flex items-center gap-2"
          >
            <WifiSlash size={14} weight="duotone" className="text-stone-500" />
            <span className="text-[11px] text-stone-600">
              Offline — changes will sync when reconnected
              {syncPending > 0 && <span className="font-mono ml-1">({syncPending} pending)</span>}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drawing help banner */}
      <AnimatePresence>
        {(ix.drawMode === 'linestring' || ix.drawMode === 'polygon' || ix.drawMode === 'point') && (
          <motion.div
            key="draw-help"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute top-3 left-1/2 -translate-x-1/2 z-20 glass-panel rounded-full px-4 py-2 flex items-center gap-4 pointer-events-none"
          >
            <span className="text-[11px] text-stone-600 flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-stone-100 font-mono text-[10px] text-stone-700">Click</span>
              add point
            </span>
            <span className="text-[11px] text-stone-600 flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 font-mono text-[10px] text-emerald-800">Enter</span>
              save
            </span>
            <span className="text-[11px] text-stone-600 flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-stone-100 font-mono text-[10px] text-stone-700">Esc</span>
              cancel
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Awaiting field boundary draw banner */}
      <AnimatePresence>
        {ix.awaitingFieldDraw && (
          <motion.div
            key="field-draw-banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute top-3 left-1/2 -translate-x-1/2 z-20 glass-panel rounded-full px-4 py-2 flex items-center gap-3 pointer-events-none"
          >
            <PolyIcon size={16} weight="duotone" className="text-amber-700" />
            <span className="text-sm font-medium text-stone-800">
              Draw the field boundary
            </span>
            <span className="text-[11px] text-stone-600 flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 font-mono text-[10px] text-emerald-800">Enter</span>
              finish
            </span>
            <span className="text-[11px] font-mono text-stone-500 px-1.5 py-0.5 rounded bg-stone-100">
              Esc cancel
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Armed drop-note banner */}
      <AnimatePresence>
        {ix.armedDropMode && (
          <motion.div
            key="drop-banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute top-3 left-1/2 -translate-x-1/2 z-20 glass-panel rounded-full px-4 py-2 flex items-center gap-3 pointer-events-none"
          >
            <NotePencil size={16} weight="duotone" className="text-amber-700" />
            <span className="text-sm font-medium text-stone-800">
              Click to drop note
            </span>
            <span className="text-[11px] font-mono text-stone-500 px-1.5 py-0.5 rounded bg-stone-100">
              Esc
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hamburger pill (mobile only) */}
      <button
        type="button"
        className="md:hidden absolute top-3 left-3 z-10 glass-button rounded-full w-10 h-10 flex items-center justify-center"
        aria-label="Open fields sidebar"
        onClick={() => setFieldsSidebarOpen(true)}
      >
        <List size={18} />
      </button>

      {/* Enterprise filter bar */}
      {!loading && enterprises.length > 0 && (
        <div className="absolute top-3 left-14 md:left-3 right-48 z-10 pointer-events-none">
          <div className="pointer-events-auto inline-flex glass-panel rounded-xl px-2.5 py-1.5">
            <EnterpriseFilterBar
              enterprises={enterprises}
              visibleEnterprises={visibleEnterprises ?? enterprises}
              onToggle={handleEnterpriseToggle}
              onShowAll={() => setVisibleEnterprises(undefined)}
            />
          </div>
        </div>
      )}

      {/* Top-right rail */}
      {!loading && (
        <MapOverlayRail position="tr">
          <MeasureToolbar
            terraDraw={ix.terraDraw}
            currentMode={ix.drawMode}
            finishedGeometry={ann.finishedGeometry}
            measurementText={ann.measurementText}
            onPick={ann.handleSaveAsPick}
            onDiscard={ann.clearFinished}
          />
          <BasemapSwitcher
            current={ix.basemapId}
            onChange={ix.handleBasemapChange}
          />
          <LayerControl
            layers={mapLayers}
            onToggle={handleLayerToggle}
            onOpacityChange={handleLayerOpacity}
          />
          <AnimatePresence>
            {!ann.sidebarOpen && (
              <motion.button
                key="annotations-toggle"
                type="button"
                onClick={() => ann.setSidebarOpen(true)}
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
                          backgroundColor: enterpriseColors[ent] ?? '#d1d5db',
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
                        backgroundColor: enterpriseColors[ent] ?? '#d1d5db',
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

      {/* Export map button */}
      <MapOverlayRail position="bl">
        <ExportMapButton map={ix.mapInstance} />
      </MapOverlayRail>

      {/* Annotate tool */}
      <AnnotateTool map={ix.mapInstance} onFinish={handleDrawFinish} onModeChange={ix.setDrawMode} onReady={ix.setTerraDraw} onGeometryChange={ann.handleGeometryChange} />

      {/* Category icon markers overlay */}
      <AnnotationMarkers
        map={ix.mapInstance}
        annotations={annotations}
        selectedId={ann.selectedAnnotationId}
        onSelect={ann.handleAnnotationSelect}
        onContextMenu={ix.handleMarkerContextMenu}
        excludeId={ann.editingAnnotationId}
      />

      {/* Context menu */}
      <MapContextMenu
        open={ix.contextMenu !== null}
        x={ix.contextMenu?.x ?? 0}
        y={ix.contextMenu?.y ?? 0}
        title={ix.contextMenu?.title}
        items={ix.contextMenu?.items ?? []}
        onDismiss={() => ix.setContextMenu(null)}
      />

      {/* Create task modal */}
      <CreateTaskModal
        open={ix.createTaskContext !== null}
        defaultTitle={ix.createTaskContext?.defaultTitle ?? ''}
        context={ix.createTaskContext?.context ?? { kind: 'blank', label: 'location' }}
        onSave={ix.handleSaveTask}
        onCancel={() => ix.setCreateTaskContext(null)}
      />

      {/* Save dialog after finishing a draw */}
      <SaveAnnotationModal
        open={ann.pendingDraw !== null}
        type={ann.pendingDraw?.type ?? 'pin'}
        geometry={ann.pendingDraw?.geometry ?? { type: 'Point', coordinates: [0, 0] }}
        onSave={ann.handleSaveAnnotation}
        onDiscard={ann.handleDiscardAnnotation}
      />

      {/* Editing bar */}
      {ann.editingAnnotationId && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-white/95 backdrop-blur-sm shadow-lg rounded-xl px-5 py-3 border border-stone-200/60">
          <span className="text-sm text-stone-700">Editing annotation geometry — drag to reshape</span>
          <button
            type="button"
            onClick={handleFinishEditingWired}
            className="px-4 py-1.5 text-sm font-medium text-white rounded-lg transition-colors"
            style={{ background: 'linear-gradient(135deg, #d97706, #b45309)' }}
          >
            Done editing
          </button>
          <button
            type="button"
            onClick={handleCancelEditingWired}
            className="px-3 py-1.5 text-sm text-stone-600 hover:text-stone-900 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Annotations sidebar */}
      <AnnotationsSidebar
        open={ann.sidebarOpen}
        annotations={annotations}
        selectedId={ann.selectedAnnotationId}
        onToggle={() => ann.setSidebarOpen(false)}
        onSelect={ann.handleAnnotationSelect}
        onDelete={handleAnnotationDeleteWired}
        onEdit={handleAnnotationEditWired}
        onBatchDelete={ann.handleBatchDelete}
        taskCountById={ann.taskCountByAnnotation}
        onMeasurementZoom={(m) => {
          try {
            const geom = JSON.parse(m.geometry) as GeoJSON.Geometry;
            const bbox = turf.bbox(turf.feature(geom));
            mapRef.current?.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 80, maxZoom: 17 });
          } catch (err) {
            console.warn('Failed to zoom to measurement:', err);
          }
        }}
      />

      {/* Field detail panel */}
      <FieldPanel
        fieldId={selectedFieldId}
        onClose={() => setSelectedFieldId(null)}
      />
      </div> {/* end map area flex-1 */}

      {/* New field modal */}
      <NewFieldModal
        open={ann.newFieldOpen}
        onClose={() => { ann.setNewFieldOpen(false); ann.setNewFieldSeed({}); ann.clearFinished(); }}
        onCreated={() => {
          setLoading(true);
          bumpLoadNonce();
          ann.clearFinished();
        }}
        farms={farms}
        enterprises={enterprises}
        geometry={ann.newFieldSeed.geometry}
        areaHa={ann.newFieldSeed.areaHa}
        farmBoundaries={farmBoundaries}
      />

      {/* Edit field modal */}
      <EditFieldModal
        open={editFieldId !== null}
        field={fields.find(f => f.id === editFieldId) ?? null}
        onClose={() => setEditFieldId(null)}
        onUpdated={() => {
          setEditFieldId(null);
          bumpLoadNonce();
        }}
        farms={farms}
        enterprises={enterprises}
      />

      {/* Save measurement modal */}
      {ann.saveMeasurementPending && (
        <SaveMeasurementModal
          open={true}
          kind={ann.saveMeasurementPending.kind}
          value={ann.saveMeasurementPending.value}
          unit={ann.saveMeasurementPending.unit}
          formatted={ann.saveMeasurementPending.formatted}
          geometry={ann.saveMeasurementPending.geometry}
          onSaved={(_m: Measurement) => {
            ann.setSaveMeasurementPending(null);
          }}
          onDiscard={() => ann.setSaveMeasurementPending(null)}
        />
      )}
    </div>
  );
}
