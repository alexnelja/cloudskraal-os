import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  SunHorizon,
  Cloud,
  Funnel,
  MapTrifold,
  Crosshair,
  CaretDown,
} from '@phosphor-icons/react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Task } from '../../types/calendar';
import type { Tag, TaskStatusConfig } from '../../types/taskManager';
import type { WeatherBlock } from '../../lib/weatherBlocking';
import TaskRow from './TaskRow';
import InlineTaskAdd from './InlineTaskAdd';
import type { ParsedTaskInput } from './QuickInput';
import type { DetectedField } from '../../hooks/useFieldDetection';

interface TodayViewProps {
  tasks: Task[];
  statuses: TaskStatusConfig[];
  tags: Tag[];
  onComplete: (id: string) => void;
  onSelectTask: (id: string) => void;
  selectedTaskId: string | null;
  onReorder?: (taskId: string, newIndex: number) => void;
  weatherBlocks?: WeatherBlock[];
  weatherWind?: number;
  weatherTemp?: number;
  weatherRain?: number;
  onWeatherRefresh?: () => void;
  geojson?: GeoJSON.FeatureCollection | null;
  fields?: Array<{ id: string; name: string }>;
  selectedFieldId?: string | null;
  onFieldSelect?: (fieldId: string | null) => void;
  detectedField?: DetectedField | null;
  detectedFieldTaskCount?: number;
  onGpsShow?: () => void;
  gpsEnabled?: boolean;
  onGpsToggle?: () => void;
  onQuickCreate?: (parsed: ParsedTaskInput) => void;
  listTitle?: string;
  listColor?: string;
  /** Filter mode: 'today' shows Overdue+Today+Tomorrow, 'all' shows everything, 'upcoming' future only, 'completed' done only */
  filterMode?: 'today' | 'all' | 'upcoming' | 'completed';
  /** Pre-activate a tag filter on mount (e.g. from home tag click) */
  initialTagFilter?: string | null;
}

type TimeGroup = 'Overdue' | 'Today' | 'Tomorrow' | 'Upcoming' | 'No Date';

const GROUP_ORDER_TODAY: TimeGroup[] = ['Overdue', 'Today', 'Tomorrow'];
const GROUP_ORDER_ALL: TimeGroup[] = ['Overdue', 'Today', 'Tomorrow', 'Upcoming', 'No Date'];

function classifyTask(dueDate: string | null): TimeGroup {
  if (!dueDate) return 'No Date';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  return 'Upcoming';
}

export default function TodayView({
  tasks,
  statuses,
  tags,
  onComplete,
  onSelectTask,
  selectedTaskId,
  onReorder,
  weatherBlocks,
  weatherWind,
  weatherTemp,
  weatherRain,
  onWeatherRefresh,
  geojson,
  fields: fieldsList,
  selectedFieldId,
  onFieldSelect,
  detectedField,
  detectedFieldTaskCount,
  onGpsShow,
  gpsEnabled,
  onGpsToggle,
  onQuickCreate,
  listTitle = 'Today',
  listColor = '#059669',
  filterMode = 'today',
  initialTagFilter,
}: TodayViewProps) {
  const [activeTagIds, setActiveTagIds] = useState<Set<string>>(new Set());
  const [showCompleted, setShowCompleted] = useState(filterMode === 'completed');
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  const [showWeatherPopover, setShowWeatherPopover] = useState(false);

  // Pre-activate tag filter when navigated from home tag click
  useEffect(() => {
    if (initialTagFilter) {
      setActiveTagIds(new Set([initialTagFilter]));
    }
  }, [initialTagFilter]);
  const weatherPopoverRef = useRef<HTMLDivElement>(null);
  const filterPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showWeatherPopover && !showFilterPopover) return;
    const handler = (e: MouseEvent) => {
      if (showWeatherPopover && weatherPopoverRef.current && !weatherPopoverRef.current.contains(e.target as Node)) {
        setShowWeatherPopover(false);
      }
      if (showFilterPopover && filterPopoverRef.current && !filterPopoverRef.current.contains(e.target as Node)) {
        setShowFilterPopover(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showWeatherPopover, showFilterPopover]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowWeatherPopover(false);
        setShowFilterPopover(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Apply filter mode
    if (filterMode === 'completed') {
      result = result.filter((t) =>
        t.status === 'completed' || t.status === 'skipped' ||
        t.status_name === 'Completed' || t.status_name === 'Skipped' ||
        t.status_name === 'Verified',
      );
    } else if (filterMode === 'upcoming') {
      result = result.filter((t) => {
        if (!t.due_date) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(t.due_date + 'T00:00:00');
        return due > today;
      });
      // Exclude completed
      result = result.filter((t) =>
        t.status !== 'completed' && t.status !== 'skipped' &&
        t.status_name !== 'Completed' && t.status_name !== 'Skipped' &&
        t.status_name !== 'Verified',
      );
    } else if (!showCompleted) {
      result = result.filter((t) =>
        t.status !== 'completed' && t.status !== 'skipped' &&
        t.status_name !== 'Completed' && t.status_name !== 'Skipped' &&
        t.status_name !== 'Verified',
      );
    }

    if (activeTagIds.size > 0) {
      result = result.filter((t) =>
        t.tags?.some((tag) => activeTagIds.has(tag.id)),
      );
    }
    if (selectedFieldId) {
      result = result.filter((t) => t.field_id === selectedFieldId);
    }
    return result;
  }, [tasks, activeTagIds, selectedFieldId, showCompleted, filterMode]);

  const groupOrder = filterMode === 'today' ? GROUP_ORDER_TODAY : GROUP_ORDER_ALL;

  const groups = useMemo(() => {
    const map: Record<TimeGroup, Task[]> = { Overdue: [], Today: [], Tomorrow: [], Upcoming: [], 'No Date': [] };
    for (const task of filteredTasks) {
      const group = classifyTask(task.due_date);
      // For today filter mode, bucket Upcoming into Tomorrow
      if (filterMode === 'today' && group === 'Upcoming') {
        // Skip tasks beyond tomorrow in today mode
        continue;
      }
      if (filterMode === 'today' && group === 'No Date') {
        map['Today'].push(task);
      } else {
        map[group].push(task);
      }
    }
    return map;
  }, [filteredTasks, filterMode]);

  const activeTaskCount = filteredTasks.length;

  const toggleTag = (tagId: string) => {
    setActiveTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  };

  const hasAny = groupOrder.some((g) => groups[g].length > 0);

  const hasWeather = weatherTemp != null;
  const blockedCount = weatherBlocks?.filter((b) => b.severity === 'blocked').length ?? 0;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorder) return;
    for (const groupName of groupOrder) {
      const groupTasks = groups[groupName];
      const oldIndex = groupTasks.findIndex((t) => t.id === active.id);
      const newIndex = groupTasks.findIndex((t) => t.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorder(active.id as string, newIndex);
        break;
      }
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#f2f2f7]">
      {/* Header area */}
      <div className="px-5 pt-5 pb-2">
        <div className="flex items-center justify-between">
          <h2 className="text-[34px] font-bold text-stone-900 leading-tight" style={{ color: listColor }}>
            {listTitle}
          </h2>
          <div className="flex items-center gap-1">
            {/* Weather icon button */}
            {hasWeather && (
              <div className="relative" ref={weatherPopoverRef}>
                <button
                  type="button"
                  onClick={() => setShowWeatherPopover(!showWeatherPopover)}
                  className={`p-2 rounded-full transition-colors ${
                    blockedCount > 0
                      ? 'text-amber-600 bg-amber-50'
                      : 'text-stone-400 hover:text-stone-600 hover:bg-stone-100'
                  }`}
                  title={`${weatherTemp}\u00B0C, Wind ${weatherWind} km/h, Rain ${weatherRain}mm${blockedCount > 0 ? ` (${blockedCount} blocked)` : ''}`}
                >
                  <Cloud size={20} weight={blockedCount > 0 ? 'fill' : 'regular'} />
                  {blockedCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {blockedCount}
                    </span>
                  )}
                </button>
                <AnimatePresence>
                  {showWeatherPopover && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.95 }}
                      className="absolute right-0 top-10 bg-white rounded-2xl shadow-lg border border-stone-200/60 p-4 z-50 w-56"
                    >
                      <p className="text-[13px] text-stone-600 font-medium mb-2">Weather Today</p>
                      <div className="space-y-1 text-[13px] text-stone-500">
                        <p>Temperature: {weatherTemp}\u00B0C</p>
                        <p>Wind: {weatherWind} km/h</p>
                        <p>Rain: {weatherRain}mm</p>
                        {blockedCount > 0 && (
                          <p className="text-amber-600 font-medium mt-2">{blockedCount} task(s) weather-blocked</p>
                        )}
                      </div>
                      {onWeatherRefresh && (
                        <button
                          type="button"
                          onClick={() => { onWeatherRefresh(); setShowWeatherPopover(false); }}
                          className="mt-3 text-[12px] text-blue-500 hover:text-blue-700"
                        >
                          Refresh forecast
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* GPS indicator */}
            {gpsEnabled && detectedField && (
              <button
                type="button"
                onClick={onGpsShow}
                className="p-2 rounded-full text-green-600 bg-green-50 transition-colors"
                title={`Near ${detectedField.fieldName} (${detectedFieldTaskCount} tasks)`}
              >
                <Crosshair size={20} weight="fill" />
              </button>
            )}

            {/* Filter button */}
            {tags.length > 0 && (
              <div className="relative" ref={filterPopoverRef}>
                <button
                  type="button"
                  onClick={() => setShowFilterPopover(!showFilterPopover)}
                  className={`p-2 rounded-full transition-colors ${
                    activeTagIds.size > 0 || selectedFieldId
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-stone-400 hover:text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  <Funnel size={20} weight={activeTagIds.size > 0 ? 'fill' : 'regular'} />
                  {activeTagIds.size > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {activeTagIds.size}
                    </span>
                  )}
                </button>
                <AnimatePresence>
                  {showFilterPopover && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.95 }}
                      className="absolute right-0 top-10 bg-white rounded-2xl shadow-lg border border-stone-200/60 p-4 z-50 w-56"
                    >
                      <p className="text-[13px] text-stone-600 font-medium mb-2">Filter by tag</p>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => { setActiveTagIds(new Set()); setShowFilterPopover(false); }}
                          className={`px-2.5 py-1 rounded-full text-[12px] font-medium transition-colors ${
                            activeTagIds.size === 0 ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'
                          }`}
                        >
                          All
                        </button>
                        {tags.map((tag) => {
                          const isActive = activeTagIds.has(tag.id);
                          return (
                            <button
                              key={tag.id}
                              type="button"
                              aria-label={tag.name}
                              onClick={() => toggleTag(tag.id)}
                              className={`px-2.5 py-1 rounded-full text-[12px] font-medium transition-colors ${
                                isActive ? 'text-white' : ''
                              }`}
                              style={
                                isActive
                                  ? { backgroundColor: tag.color, color: 'white' }
                                  : { backgroundColor: tag.color + '18', color: tag.color }
                              }
                            >
                              {tag.name}
                            </button>
                          );
                        })}
                      </div>
                      {selectedFieldId && (
                        <button
                          type="button"
                          onClick={() => { onFieldSelect?.(null); setShowFilterPopover(false); }}
                          className="mt-3 text-[12px] text-blue-500 hover:text-blue-700"
                        >
                          Clear field filter
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* Subtitle: task count */}
        <p className="text-[13px] text-stone-400 mt-0.5">
          {activeTaskCount} {activeTaskCount === 1 ? 'task' : 'tasks'}
          {activeTagIds.size > 0 && ' (filtered)'}
        </p>
      </div>

      {/* Task groups */}
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-y-auto">
          {!hasAny ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
              <SunHorizon size={40} weight="duotone" className="text-stone-300 mb-3" />
              <p className="text-[15px] text-stone-400">
                {activeTagIds.size > 0 || selectedFieldId
                  ? 'No tasks match your filters'
                  : filterMode === 'completed'
                    ? 'No completed tasks yet'
                    : 'No active tasks -- enjoy the quiet'}
              </p>
              {(activeTagIds.size > 0 || selectedFieldId) && (
                <button
                  type="button"
                  onClick={() => { setActiveTagIds(new Set()); onFieldSelect?.(null); }}
                  className="mt-2 text-[13px] hover:underline"
                  style={{ color: listColor }}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="pb-2">
              <AnimatePresence>
                {groupOrder.map((groupName) => {
                  const groupTasks = groups[groupName];
                  if (groupTasks.length === 0) return null;
                  const isOverdue = groupName === 'Overdue';
                  return (
                    <motion.div
                      key={groupName}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="flex items-center gap-2 px-5 pt-5 pb-1">
                        <span className={`text-[13px] font-semibold uppercase tracking-wide ${
                          isOverdue ? 'text-red-500' : 'text-stone-400'
                        }`}>
                          {groupName}
                        </span>
                        <span className={`text-[11px] font-mono ${isOverdue ? 'text-red-400' : 'text-stone-300'}`}>
                          {groupTasks.length}
                        </span>
                      </div>
                      <div className="bg-white rounded-2xl mx-3 shadow-sm border border-stone-200/40 overflow-hidden">
                        <SortableContext
                          items={groupTasks.map((t) => t.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <ul>
                            {groupTasks.map((task, idx) => (
                              <li key={task.id} className={idx > 0 ? 'border-t border-stone-100' : ''} style={{ listStyle: 'none' }}>
                                <TaskRow
                                  task={task}
                                  statuses={statuses}
                                  onComplete={onComplete}
                                  onSelect={onSelectTask}
                                  selected={task.id === selectedTaskId}
                                  sortableId={task.id}
                                />
                              </li>
                            ))}
                          </ul>
                        </SortableContext>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </DndContext>

      {/* Bottom area: show completed toggle + inline add */}
      <div className="border-t border-stone-200/40 bg-[#f2f2f7]">
        {filterMode !== 'completed' && (
          <div className="flex items-center justify-between px-5 py-2">
            <button
              type="button"
              onClick={() => setShowCompleted(v => !v)}
              className="text-[13px] text-stone-400 hover:text-stone-600 transition-colors"
            >
              {showCompleted ? 'Hide completed' : `Show completed (${tasks.filter(t => t.status === 'completed' || t.status_name === 'Completed').length})`}
            </button>
            {selectedFieldId && (
              <button
                type="button"
                onClick={() => onFieldSelect?.(null)}
                className="text-[13px] transition-colors"
                style={{ color: listColor }}
              >
                Clear field filter
              </button>
            )}
          </div>
        )}
        {onQuickCreate && (
          <InlineTaskAdd
            tags={tags}
            fields={fieldsList ?? []}
            onSubmit={onQuickCreate}
            accentColor={listColor}
          />
        )}
      </div>
    </div>
  );
}
