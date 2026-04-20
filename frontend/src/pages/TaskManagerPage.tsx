import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, BellSlash, GearSix, CaretLeft } from '@phosphor-icons/react';
import { useFieldDetection } from '../hooks/useFieldDetection';
import { useViewTransition } from '../hooks/useViewTransition';
import { getTasks, completeTask, uncompleteTask, createTask, updateTask, deleteTask } from '../api/calendar';
import { listTags, listStatuses, addTagToTask } from '../api/taskManager';
import { getFields, getFarms, getMapGeoJSON } from '../api/farms';
import { fetchForecast, clearForecastCache } from '../api/weather';
import type { Task } from '../types/calendar';
import type { Tag, TaskStatusConfig } from '../types/taskManager';
import { evaluateWeatherBlocks, type WeatherBlock, type WeatherData } from '../lib/weatherBlocking';
import { requestNotificationPermission, isNotificationEnabled, notifyOverdueTasks, notifyWeatherUnblock } from '../lib/notifications';
import { checkTransitionTriggers, type TransitionSuggestion } from '../lib/usagePeriodTriggers';
import TransitionBanner from '../components/tasks/TransitionBanner';
import TodayView from '../components/tasks/TodayView';
import BoardView from '../components/tasks/BoardView';
import ListView from '../components/tasks/ListView';
import TagManager from '../components/tasks/TagManager';
import CopToast from '../components/tasks/CopToast';
import TaskDetailSheet from '../components/tasks/TaskDetailSheet';
import type { ParsedTaskInput } from '../components/tasks/QuickInput';

type ViewMode = 'home' | 'today' | 'upcoming' | 'all' | 'completed' | 'board' | 'list';

interface SmartListCard {
  id: ViewMode;
  label: string;
  color: string;
  countFn: (tasks: Task[]) => number;
}

const SMART_LISTS: SmartListCard[] = [
  {
    id: 'today',
    label: 'Today',
    color: '#3b82f6',
    countFn: (tasks) => {
      const today = new Date().toISOString().slice(0, 10);
      return tasks.filter((t) => {
        if (t.status === 'completed' || t.status === 'skipped') return false;
        if (!t.due_date) return true; // no-date tasks show in today
        const diff = Math.round((new Date(t.due_date + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000);
        return diff <= 1; // today + tomorrow + overdue
      });
    },
  },
  {
    id: 'upcoming',
    label: 'Upcoming',
    color: '#f97316',
    countFn: (tasks) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return tasks.filter((t) => {
        if (t.status === 'completed' || t.status === 'skipped') return false;
        if (!t.due_date) return false;
        const due = new Date(t.due_date + 'T00:00:00');
        return due > today;
      }).length;
    },
  },
  {
    id: 'all',
    label: 'All',
    color: '#57534e',
    countFn: (tasks) => tasks.filter((t) => t.status !== 'completed' && t.status !== 'skipped').length,
  },
  {
    id: 'completed',
    label: 'Completed',
    color: '#22c55e',
    countFn: (tasks) => tasks.filter((t) => t.status === 'completed').length,
  },
];

export default function TaskManagerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [statuses, setStatuses] = useState<TaskStatusConfig[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [initialTagFilter, setInitialTagFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [fields, setFields] = useState<Array<{ id: string; name: string; enterprise: string }>>([]);
  const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [weatherBlocks, setWeatherBlocks] = useState<WeatherBlock[]>([]);
  const [weatherToday, setWeatherToday] = useState<WeatherData | null>(null);
  const [copToast, setCopToast] = useState<{ costsLogged: Array<{ id: string; product_name: string; total_cost: number }>; taskTitle: string; taskId: string } | null>(null);
  const [completionToast, setCompletionToast] = useState<{ taskId: string; title: string } | null>(null);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [transitionSuggestions, setTransitionSuggestions] = useState<TransitionSuggestion[]>([]);
  const [notificationsOn, setNotificationsOn] = useState(() =>
    localStorage.getItem('capex.notifications-enabled') === 'true' && isNotificationEnabled(),
  );
  const prevBlockedIdsRef = useRef<Set<string>>(new Set());
  const [gpsEnabled, setGpsEnabled] = useState(() =>
    localStorage.getItem('capex.gps-field-detection') === 'true',
  );
  const detectedField = useFieldDetection(geojson, gpsEnabled);
  const { startTransition } = useViewTransition();

  const detectedFieldTaskCount = useMemo(() => {
    if (!detectedField) return 0;
    return tasks.filter((t) => t.field_id === detectedField.fieldId).length;
  }, [tasks, detectedField]);

  const handleGpsToggle = useCallback(() => {
    setGpsEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('capex.gps-field-detection', String(next));
      return next;
    });
  }, []);

  const handleGpsShow = useCallback(() => {
    if (detectedField) {
      setSelectedFieldId(detectedField.fieldId);
      setViewMode('today');
    }
  }, [detectedField]);

  // Data fetching
  const fetchData = useCallback(async () => {
    try {
      const [taskData, tagData, statusData, fieldData, geoData] = await Promise.all([
        getTasks(),
        listTags(),
        listStatuses(),
        getFields(),
        getMapGeoJSON().catch(() => null),
      ]);
      setTasks(taskData);
      setTags(tagData);
      setStatuses(statusData);
      setFields(fieldData.map((f) => ({ id: f.id, name: f.name, enterprise: f.enterprise })));
      setGeojson(geoData);
    } catch (err) {
      console.error('Failed to load task data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-open task detail sheet from ?detail= query param (e.g. after FAB quick-create)
  useEffect(() => {
    if (loading) return;
    const detailId = searchParams.get('detail');
    if (detailId) {
      const taskExists = tasks.some((t) => t.id === detailId);
      if (taskExists) {
        setSelectedTaskId(detailId);
        // Switch to a list view so the detail sheet makes sense
        if (viewMode === 'home') setViewMode('all');
      }
      // Clear the query param so it doesn't re-trigger
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('detail');
        return next;
      }, { replace: true });
    }
  }, [loading, tasks, searchParams, setSearchParams, viewMode]);

  // Weather
  const loadWeather = useCallback(
    async (taskList: Task[]) => {
      try {
        const farms = await getFarms();
        if (farms.length === 0 || farms[0].lat == null || farms[0].lng == null) return;
        const farm = farms[0];
        const result = await fetchForecast(farm.lat, farm.lng, farm.id);
        if (!result) return;

        const { daily } = result.data;
        const todayData: WeatherData = {
          wind_speed_max: daily.windspeed_10m_max[0] ?? 0,
          precipitation_sum: daily.precipitation_sum[0] ?? 0,
          temperature_min: daily.temperature_2m_min[0] ?? 10,
          temperature_max: daily.temperature_2m_max[0] ?? 25,
        };
        setWeatherToday(todayData);

        const forecast: WeatherData[] = daily.time.slice(1).map((_: any, i: number) => ({
          wind_speed_max: daily.windspeed_10m_max[i + 1] ?? 0,
          precipitation_sum: daily.precipitation_sum[i + 1] ?? 0,
          temperature_min: daily.temperature_2m_min[i + 1] ?? 10,
          temperature_max: daily.temperature_2m_max[i + 1] ?? 25,
        }));

        const blocks = evaluateWeatherBlocks(taskList, todayData, forecast);
        setWeatherBlocks(blocks);

        for (const block of blocks) {
          if (block.severity === 'blocked') {
            await updateTask(block.taskId, {
              blocked_reason: block.message,
              blocked_until: block.clearsAt,
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.error('Weather fetch failed:', err);
      }
    },
    [],
  );

  useEffect(() => {
    if (!loading && tasks.length > 0) {
      loadWeather(tasks);
    }
  }, [loading, tasks, loadWeather]);

  // Notifications
  useEffect(() => {
    if (loading || !notificationsOn) return;
    if (sessionStorage.getItem('capex.overdue-notified')) return;
    const today = new Date().toISOString().slice(0, 10);
    const overdue = tasks.filter(
      (t) => t.due_date && t.due_date < today && t.status !== 'completed' && t.status !== 'skipped',
    );
    if (overdue.length > 0) {
      notifyOverdueTasks(overdue.length);
      sessionStorage.setItem('capex.overdue-notified', '1');
    }
  }, [loading, tasks, notificationsOn]);

  useEffect(() => {
    if (!notificationsOn) return;
    const currentBlockedIds = new Set(
      weatherBlocks.filter((b) => b.severity === 'blocked').map((b) => b.taskId),
    );
    const prev = prevBlockedIdsRef.current;
    if (prev.size > 0) {
      for (const taskId of prev) {
        if (!currentBlockedIds.has(taskId)) {
          const task = tasks.find((t) => t.id === taskId);
          if (task) {
            notifyWeatherUnblock(task.field_name || 'Field', 'Conditions improved');
          }
        }
      }
    }
    prevBlockedIdsRef.current = currentBlockedIds;
  }, [weatherBlocks, tasks, notificationsOn]);

  const handleToggleNotifications = useCallback(async () => {
    if (notificationsOn) {
      setNotificationsOn(false);
      localStorage.setItem('capex.notifications-enabled', 'false');
    } else {
      const granted = await requestNotificationPermission();
      if (granted) {
        setNotificationsOn(true);
        localStorage.setItem('capex.notifications-enabled', 'true');
      }
    }
  }, [notificationsOn]);

  const handleWeatherRefresh = useCallback(async () => {
    try {
      const farms = await getFarms();
      if (farms.length > 0) clearForecastCache(farms[0].id);
    } catch { /* ignore */ }
    loadWeather(tasks);
  }, [tasks, loadWeather]);

  // Transitions
  useEffect(() => {
    if (loading || fields.length === 0) return;
    const dismissed: string[] = JSON.parse(localStorage.getItem('transition_dismissed') || '[]');
    const all = checkTransitionTriggers(fields, tasks);
    setTransitionSuggestions(all.filter((s) => !dismissed.includes(s.fieldId)));
  }, [loading, fields, tasks]);

  const handleTransitionGenerate = useCallback(
    async (fieldId: string) => {
      const field = fields.find((f) => f.id === fieldId);
      if (!field) return;
      try {
        await createTask({
          title: `Set up ${field.enterprise} for ${field.name}`,
          description: `Transition task: configure ${field.enterprise} tasks for this field.`,
          enterprise: field.enterprise,
          field_id: fieldId,
          type: 'triggered' as const,
          status: 'pending' as const,
          priority: 'medium' as const,
          due_date: new Date().toISOString().slice(0, 10),
          assigned_to: null, depends_on_task_id: null, recurrence_rule: null,
          calendar_event_id: null, notes: null, status_id: null,
          estimated_minutes: null, actual_minutes: null,
          blocked_reason: null, blocked_until: null,
          sort_order: 0, verified_by: null, verified_at: null,
        });
        const dismissed: string[] = JSON.parse(localStorage.getItem('transition_dismissed') || '[]');
        localStorage.setItem('transition_dismissed', JSON.stringify([...dismissed, fieldId]));
        setTransitionSuggestions((prev) => prev.filter((s) => s.fieldId !== fieldId));
        await fetchData();
      } catch (err) { console.error('Failed to generate transition task:', err); }
    },
    [fields, fetchData],
  );

  const handleTransitionDismiss = useCallback((fieldId: string) => {
    const dismissed: string[] = JSON.parse(localStorage.getItem('transition_dismissed') || '[]');
    localStorage.setItem('transition_dismissed', JSON.stringify([...dismissed, fieldId]));
    setTransitionSuggestions((prev) => prev.filter((s) => s.fieldId !== fieldId));
  }, []);

  // Task actions
  const handleComplete = useCallback(async (id: string) => {
    try {
      // Grab the title before the task disappears from the list
      const taskTitle = tasks.find((t) => t.id === id)?.title ?? 'Task';
      const result = await completeTask(id);
      await fetchData();
      if (result.costs_logged && result.costs_logged.length > 0) {
        setCopToast({ costsLogged: result.costs_logged, taskTitle: result.title, taskId: id });
      } else {
        // Show lightweight completion toast with undo for non-COP completions
        if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
        setCompletionToast({ taskId: id, title: taskTitle });
        completionTimerRef.current = setTimeout(() => {
          setCompletionToast(null);
        }, 4000);
      }
    } catch (err) { console.error('Failed to complete task:', err); }
  }, [fetchData, tasks]);

  const handleUndoComplete = useCallback(async () => {
    if (!copToast) return;
    try {
      await uncompleteTask(copToast.taskId);
      setCopToast(null);
      await fetchData();
    } catch (err) { console.error('Failed to undo task completion:', err); }
  }, [copToast, fetchData]);

  const handleUndoCompletionToast = useCallback(async () => {
    if (!completionToast) return;
    if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
    try {
      await uncompleteTask(completionToast.taskId);
      setCompletionToast(null);
      await fetchData();
    } catch (err) { console.error('Failed to undo task completion:', err); }
  }, [completionToast, fetchData]);

  const handleStatusChange = useCallback(async (taskId: string, newStatusId: string) => {
    try {
      await updateTask(taskId, { status_id: newStatusId });
      await fetchData();
    } catch (err) { console.error('Failed to update task status:', err); }
  }, [fetchData]);

  const handleTaskUpdate = useCallback(async (taskId: string, data: Record<string, any>) => {
    try {
      await updateTask(taskId, data);
      await fetchData();
    } catch (err) { console.error('Failed to update task:', err); }
  }, [fetchData]);

  const handleDelete = useCallback(async (taskId: string) => {
    try {
      await deleteTask(taskId);
      setSelectedTaskId(null);
      await fetchData();
    } catch (err) { console.error('Failed to delete task:', err); }
  }, [fetchData]);

  const handleReorder = useCallback(async (taskId: string, newIndex: number) => {
    try {
      await updateTask(taskId, { sort_order: newIndex });
      setTasks((prev) => {
        const idx = prev.findIndex((t) => t.id === taskId);
        if (idx === -1) return prev;
        const updated = [...prev];
        updated[idx] = { ...updated[idx], sort_order: newIndex };
        return updated;
      });
    } catch (err) { console.error('Failed to reorder task:', err); }
  }, []);

  const handleQuickCreate = useCallback(async (parsed: ParsedTaskInput) => {
    try {
      const newTask = await createTask({
        title: parsed.title,
        description: null, enterprise: null,
        field_id: parsed.field_id,
        type: 'manual', status: 'pending',
        priority: (parsed.priority as any) || 'medium',
        due_date: parsed.due_date,
        assigned_to: null, depends_on_task_id: null,
        recurrence_rule: null, calendar_event_id: null,
        notes: null, status_id: null,
        estimated_minutes: null, actual_minutes: null,
        blocked_reason: null, blocked_until: null,
        sort_order: 0, verified_by: null, verified_at: null,
      });
      if (parsed.tag_ids.length) {
        await Promise.all(parsed.tag_ids.map((tagId) => addTagToTask(newTask.id, tagId)));
      }
      await fetchData();
    } catch (err) { console.error('Failed to quick-create task:', err); }
  }, [fetchData]);

  const handleSelectTask = useCallback((id: string) => {
    setSelectedTaskId(id);
  }, []);

  const selectedTask = useMemo(() => {
    if (!selectedTaskId) return null;
    return tasks.find((t) => t.id === selectedTaskId) ?? null;
  }, [tasks, selectedTaskId]);

  // Tag counts for home view
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const task of tasks) {
      if (task.status === 'completed' || task.status === 'skipped') continue;
      for (const tag of task.tags ?? []) {
        counts[tag.id] = (counts[tag.id] || 0) + 1;
      }
    }
    return counts;
  }, [tasks]);

  const isListView = viewMode !== 'home' && viewMode !== 'board' && viewMode !== 'list';
  const activeListConfig = SMART_LISTS.find((l) => l.id === viewMode);

  return (
    <div className="h-[calc(100vh-5rem)] md:h-screen flex flex-col bg-[#f2f2f7]">
      {/* Header */}
      <div className="px-5 pt-5 pb-2">
        <div className="flex items-center justify-between">
          {viewMode === 'home' ? (
            <h1 className="text-[34px] font-bold text-stone-900 leading-tight">Tasks</h1>
          ) : (
            <button
              type="button"
              onClick={() => startTransition('slide-back', () => { setViewMode('home'); setInitialTagFilter(null); })}
              className="flex items-center gap-1 text-blue-500 hover:text-blue-600 transition-colors"
            >
              <CaretLeft size={20} weight="bold" />
              <span className="text-[17px]">Back</span>
            </button>
          )}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleToggleNotifications}
              className={`p-2 rounded-full transition-colors ${
                notificationsOn
                  ? 'text-blue-500 hover:text-blue-600 hover:bg-blue-50'
                  : 'text-stone-400 hover:text-stone-600 hover:bg-stone-100'
              }`}
              aria-label={notificationsOn ? 'Disable notifications' : 'Enable notifications'}
            >
              {notificationsOn ? <Bell size={20} weight="fill" /> : <BellSlash size={20} />}
            </button>
            <button
              type="button"
              onClick={() => setTagManagerOpen(true)}
              className="p-2 rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
              aria-label="Manage tags and statuses"
            >
              <GearSix size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Transition banner - subtle, only on home */}
      {viewMode === 'home' && transitionSuggestions.length > 0 && (
        <div className="px-3 pb-2">
          <TransitionBanner
            suggestions={transitionSuggestions}
            onGenerate={handleTransitionGenerate}
            onDismiss={handleTransitionDismiss}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-[15px] text-stone-400">Loading tasks...</span>
          </div>
        ) : viewMode === 'home' ? (
          /* ===== HOME: Smart List Cards ===== */
          <div className="h-full overflow-y-auto px-3 pb-6">
            {/* Smart list cards grid */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {SMART_LISTS.map((card) => {
                const count = card.countFn(tasks);
                return (
                  <motion.button
                    key={card.id}
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => startTransition('slide-forward', () => setViewMode(card.id))}
                    className="bg-white rounded-2xl shadow-sm border border-stone-200/40 p-4 text-left transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: card.color + '18', viewTransitionName: `card-${card.id}` } as React.CSSProperties}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full"
                            style={{ backgroundColor: card.color }}
                          />
                        </span>
                        <span className="text-[15px] font-medium text-stone-700">{card.label}</span>
                      </div>
                      <span className="text-[24px] font-bold leading-none" style={{ color: card.color }}>{count}</span>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* View toggles: Board / List */}
            <div className="flex items-center gap-4 mb-4 px-2">
              <button
                type="button"
                onClick={() => startTransition('fade', () => setViewMode('board'))}
                className="text-[13px] text-stone-400 hover:text-stone-600 transition-colors"
              >
                Board view
              </button>
              <button
                type="button"
                onClick={() => startTransition('fade', () => setViewMode('list'))}
                className="text-[13px] text-stone-400 hover:text-stone-600 transition-colors"
              >
                List view
              </button>
            </div>

            {/* My Tags section */}
            {tags.length > 0 && (
              <div className="px-2">
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-stone-400 mb-3">My Tags</h3>
                <div className="bg-white rounded-2xl shadow-sm border border-stone-200/40 overflow-hidden">
                  {tags.map((tag, idx) => {
                    const count = tagCounts[tag.id] || 0;
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          setInitialTagFilter(tag.id);
                          setViewMode('all');
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-stone-50 transition-colors ${
                          idx > 0 ? 'border-t border-stone-100' : ''
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="text-[15px] text-stone-700 flex-1">{tag.name}</span>
                        <span className="text-[13px] text-stone-400">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : isListView ? (
          /* ===== SMART LIST VIEW ===== */
          <TodayView
            tasks={tasks}
            statuses={statuses}
            tags={tags}
            onComplete={handleComplete}
            onSelectTask={handleSelectTask}
            selectedTaskId={selectedTaskId}
            onReorder={handleReorder}
            geojson={geojson}
            fields={fields}
            selectedFieldId={selectedFieldId}
            onFieldSelect={setSelectedFieldId}
            weatherBlocks={weatherBlocks}
            weatherWind={weatherToday?.wind_speed_max}
            weatherTemp={weatherToday?.temperature_max}
            weatherRain={weatherToday?.precipitation_sum}
            onWeatherRefresh={handleWeatherRefresh}
            detectedField={detectedField}
            detectedFieldTaskCount={detectedFieldTaskCount}
            onGpsShow={handleGpsShow}
            gpsEnabled={gpsEnabled}
            onGpsToggle={handleGpsToggle}
            onQuickCreate={handleQuickCreate}
            listTitle={activeListConfig?.label ?? 'Tasks'}
            listColor={activeListConfig?.color ?? '#57534e'}
            filterMode={viewMode as 'today' | 'all' | 'upcoming' | 'completed'}
            initialTagFilter={initialTagFilter}
          />
        ) : viewMode === 'board' ? (
          <BoardView
            tasks={tasks}
            statuses={statuses}
            onStatusChange={handleStatusChange}
            onSelectTask={handleSelectTask}
          />
        ) : (
          <ListView
            tasks={tasks}
            statuses={statuses}
            tags={tags}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
            onSelectTask={handleSelectTask}
          />
        )}
      </div>

      {/* Task detail sheet */}
      <TaskDetailSheet
        task={selectedTask}
        open={selectedTaskId !== null}
        onDismiss={() => setSelectedTaskId(null)}
        onSave={handleTaskUpdate}
        onDelete={handleDelete}
        tags={tags}
        statuses={statuses}
        fields={fields}
      />

      {/* Tag & status manager */}
      <TagManager
        open={tagManagerOpen}
        onDismiss={() => setTagManagerOpen(false)}
        tags={tags}
        statuses={statuses}
        onTagsChanged={() => fetchData()}
      />

      {/* COP auto-log toast */}
      {copToast && (
        <CopToast
          costsLogged={copToast.costsLogged}
          taskTitle={copToast.taskTitle}
          onUndo={handleUndoComplete}
          onDismiss={() => setCopToast(null)}
        />
      )}

      {/* Completion undo toast (non-COP tasks) */}
      <AnimatePresence onExitComplete={() => setCompletionToast(null)}>
        {completionToast && !copToast && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] max-w-sm w-[calc(100%-2rem)]"
          >
            <div className="bg-white/95 backdrop-blur-md rounded-xl px-4 py-3 shadow-lg border border-stone-200/40 flex items-center justify-between gap-3">
              <p className="text-sm text-stone-700 truncate">
                &lsquo;{completionToast.title}&rsquo; completed
              </p>
              <button
                type="button"
                onClick={handleUndoCompletionToast}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 underline underline-offset-2 transition-colors shrink-0"
              >
                Undo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
