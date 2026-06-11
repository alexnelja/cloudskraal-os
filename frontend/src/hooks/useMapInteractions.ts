import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import { ClipboardText, NotePencil, CheckSquare, MapPin } from '@phosphor-icons/react';
import { useLongPress } from './useLongPress';
import { createAnnotation } from '../api/annotations';
import { createTask } from '../api/tasks';
import { getTaskSuggestions, type TaskSuggestion } from '../api/taskSuggestions';
import { loadBasemapPreference, saveBasemapPreference } from '../config/basemaps';
import type { DrawMode } from '../components/map/tools/AnnotateTool';
import type { MapContextMenuEvent } from '../components/map/FarmMap';
import type { MenuItem } from '../components/map/MapContextMenu';
import type { TaskContext } from '../components/map/CreateTaskModal';
import type { Annotation } from '../types/annotation';

interface UseMapInteractionsArgs {
  mapRef: React.MutableRefObject<maplibregl.Map | null>;
  annotations: Annotation[];
  setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>;
  dropMapNote: (lng: number, lat: number) => Promise<void>;
  handleAnnotationSelect: (id: string) => void;
  setSidebarOpen: (open: boolean) => void;
  setSelectedAnnotationId: (id: string | null) => void;
  refreshTasks: () => Promise<void>;
}

export function useMapInteractions({
  mapRef,
  annotations,
  setAnnotations,
  dropMapNote,
  setSidebarOpen,
  setSelectedAnnotationId,
  refreshTasks,
}: UseMapInteractionsArgs) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; title: string; items: MenuItem[];
  } | null>(null);
  const [createTaskContext, setCreateTaskContext] = useState<{
    context: TaskContext; defaultTitle: string; template?: TaskSuggestion | null;
  } | null>(null);
  const [armedDropMode, setArmedDropMode] = useState(false);
  const [pressRing, setPressRing] = useState<{ x: number; y: number } | null>(null);
  const [drawMode, setDrawMode] = useState<DrawMode>('static');
  const [terraDraw, setTerraDraw] = useState<{
    setMode: (mode: string) => void;
    addFeatures?: (features: GeoJSON.Feature[]) => void;
    removeFeatures?: (ids: (string | number)[]) => void;
  } | null>(null);
  const [basemapId, setBasemapId] = useState<string>(() => loadBasemapPreference());
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);

  // Field draw waiting state
  const [awaitingFieldDraw, setAwaitingFieldDraw] = useState(false);
  const awaitingFieldDrawRef = useRef(false);
  awaitingFieldDrawRef.current = awaitingFieldDraw;

  // Arm drop-note mode when FAB navigates here with ?armNote=1.
  useEffect(() => {
    if (searchParams.get('armNote') === '1') {
      setArmedDropMode(true);
      const next = new URLSearchParams(searchParams);
      next.delete('armNote');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Esc cancels armed drop mode.
  useEffect(() => {
    if (!armedDropMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setArmedDropMode(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [armedDropMode]);

  // Esc exits active draw mode back to pan.
  useEffect(() => {
    if (!terraDraw) return;
    const activeModes = ['linestring', 'polygon', 'point'];
    if (!activeModes.includes(drawMode)) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') terraDraw.setMode('render');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawMode, terraDraw]);

  // Esc cancels awaiting-field-draw mode.
  useEffect(() => {
    if (!awaitingFieldDraw) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAwaitingFieldDraw(false);
        terraDraw?.setMode('static');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [awaitingFieldDraw, terraDraw]);

  const handleArmedMapClick = useCallback(
    async (e: { lng: number; lat: number }) => {
      if (!armedDropMode) return;
      await dropMapNote(e.lng, e.lat);
      setArmedDropMode(false);
    },
    [armedDropMode, dropMapNote],
  );

  const openCreateTaskModal = useCallback((ctx: TaskContext, defaultTitle: string, template?: TaskSuggestion | null) => {
    setCreateTaskContext({ context: ctx, defaultTitle, template: template ?? null });
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
      const fieldCtx: TaskContext = { kind: 'field', label: e.fieldName ?? 'field', fieldId: e.fieldId };
      items.push({
        id: 'task-for-field',
        label: `Create task for ${e.fieldName ?? 'this field'}`,
        Icon: ClipboardText,
        tint: 'emerald',
        onClick: () => openCreateTaskModal(fieldCtx, ''),
      });
      // Spec 3.2 — usage-matched op suggestions, appended once they load.
      const fieldId = e.fieldId;
      getTaskSuggestions(fieldId)
        .then((r) => {
          if (!r.suggestions.length) return;
          const tiles: MenuItem[] = r.suggestions.slice(0, 4).map((sugg) => ({
            id: `tpl-${sugg.template_id}`,
            label: sugg.estimated_cost_zar > 0
              ? `${sugg.name} · ~R ${sugg.estimated_cost_zar.toLocaleString('en-ZA')}`
              : sugg.name,
            Icon: ClipboardText,
            tint: 'amber',
            onClick: () => openCreateTaskModal(fieldCtx, '', sugg),
          }));
          setContextMenu((prev) => {
            // Only extend if this field's menu is still the one on screen.
            if (!prev || !prev.items.some((i) => i.id === 'task-for-field')) return prev;
            const withoutTiles = prev.items.filter((i) => !i.id.startsWith('tpl-'));
            const anchor = withoutTiles.findIndex((i) => i.id === 'task-for-field');
            const next = [...withoutTiles];
            next.splice(anchor + 1, 0, ...tiles);
            return { ...prev, items: next };
          });
        })
        .catch(() => { /* suggestions are progressive enhancement */ });
    } else {
      items.push({
        id: 'task-here',
        label: 'Create task at this location',
        Icon: ClipboardText,
        tint: 'emerald',
        onClick: async () => {
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
        onClick: () => { dropMapNote(e.lng, e.lat); },
      });
    }
    setContextMenu({
      x: e.x,
      y: e.y,
      title: e.target === 'field' ? (e.fieldName ?? 'Field') : 'Map',
      items,
    });
  }, [openCreateTaskModal, dropMapNote, setAnnotations]);

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
    [annotations, openCreateTaskModal, setSelectedAnnotationId, setSidebarOpen],
  );

  // Long-press handlers
  const openChooserAt = useCallback(
    (clientX: number, clientY: number) => {
      const map = mapRef.current;
      if (!map) return;
      const rect = map.getContainer().getBoundingClientRect();
      const point: [number, number] = [clientX - rect.left, clientY - rect.top];
      const lngLat = map.unproject(point);
      const features = map.queryRenderedFeatures(point, { layers: ['fields-fill'] });
      const feat = features?.[0];
      handleMapContextMenu({
        target: feat ? 'field' : 'blank',
        fieldId: feat?.properties?.id as string | undefined,
        fieldName: feat?.properties?.name as string | undefined,
        lng: lngLat.lng,
        lat: lngLat.lat,
        x: clientX,
        y: clientY,
      });
    },
    [handleMapContextMenu, mapRef],
  );

  const longPress = useLongPress({
    durationMs: 500,
    onLongPress: ({ clientX, clientY }) => {
      if (armedDropMode) return;
      openChooserAt(clientX, clientY);
    },
    onProgress: (p) => {
      setPressRing(p.active ? { x: p.clientX, y: p.clientY } : null);
    },
  });

  const handleBasemapChange = useCallback((id: string) => {
    setBasemapId(id);
    saveBasemapPreference(id);
  }, []);

  const handleAddField = useCallback((opts?: { geometry?: GeoJSON.Geometry; areaHa?: number }) => {
    if (opts?.geometry) {
      // Caller provides geometry directly — handled by annotation state hook
      return opts;
    }
    // No geometry — arm polygon draw mode
    if (terraDraw) {
      terraDraw.setMode('render');
      terraDraw.setMode('polygon');
    }
    setAwaitingFieldDraw(true);
    return undefined;
  }, [terraDraw]);

  return {
    // Context menu
    contextMenu,
    setContextMenu,
    handleMapContextMenu,
    handleMarkerContextMenu,

    // Task creation
    createTaskContext,
    setCreateTaskContext,
    handleSaveTask,

    // Armed drop
    armedDropMode,
    setArmedDropMode,
    handleArmedMapClick,

    // Long press
    longPress,
    pressRing,

    // Draw mode + terraDraw
    drawMode,
    setDrawMode,
    terraDraw,
    setTerraDraw,

    // Basemap
    basemapId,
    handleBasemapChange,

    // Map instance
    mapInstance,
    setMapInstance,

    // Field draw
    awaitingFieldDraw,
    setAwaitingFieldDraw,
    awaitingFieldDrawRef,
    handleAddField,
  };
}
