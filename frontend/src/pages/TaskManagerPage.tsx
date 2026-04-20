import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, BellSlash, GearSix, CaretLeft } from '@phosphor-icons/react';
import { useFieldDetection } from '../hooks/useFieldDetection';
import { useViewTransition } from '../hooks/useViewTransition';
import { useTaskData } from '../hooks/useTaskData';
import { useWeatherBlocking } from '../hooks/useWeatherBlocking';
import { useTaskNotifications } from '../hooks/useTaskNotifications';
import { createTask } from '../api/calendar';
import type { Task } from '../types/calendar';
import { checkTransitionTriggers, type TransitionSuggestion } from '../lib/usagePeriodTriggers';
import TransitionBanner from '../components/tasks/TransitionBanner';
import TodayView from '../components/tasks/TodayView';
import BoardView from '../components/tasks/BoardView';
import ListView from '../components/tasks/ListView';
import TagManager from '../components/tasks/TagManager';
import CopToast from '../components/tasks/CopToast';
import TaskDetailSheet from '../components/tasks/TaskDetailSheet';

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
  const { startTransition } = useViewTransition();

  // --- Custom hooks ---
  const {
    tasks, tags, statuses, fields, geojson, loading,
    fetchData,
    handleComplete, handleUndoComplete, handleUndoCompletionToast,
    handleStatusChange, handleTaskUpdate, handleDelete, handleReorder, handleQuickCreate,
    copToast, setCopToast, completionToast, setCompletionToast,
  } = useTaskData();

  const { weatherBlocks, weatherToday, handleWeatherRefresh } = useWeatherBlocking(tasks, loading);
  const { notificationsOn, handleToggleNotifications } = useTaskNotifications(tasks, weatherBlocks, loading);

  // --- Local UI state ---
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [initialTagFilter, setInitialTagFilter] = useState<string | null>(null);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [transitionSuggestions, setTransitionSuggestions] = useState<TransitionSuggestion[]>([]);
  const [gpsEnabled, setGpsEnabled] = useState(() =>
    localStorage.getItem('capex.gps-field-detection') === 'true',
  );
  const detectedField = useFieldDetection(geojson, gpsEnabled);

  // --- Initial fetch ---
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Auto-open task detail sheet from ?detail= query param ---
  useEffect(() => {
    if (loading) return;
    const detailId = searchParams.get('detail');
    if (detailId) {
      const taskExists = tasks.some((t) => t.id === detailId);
      if (taskExists) {
        setSelectedTaskId(detailId);
        if (viewMode === 'home') setViewMode('all');
      }
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('detail');
        return next;
      }, { replace: true });
    }
  }, [loading, tasks, searchParams, setSearchParams, viewMode]);

  // --- GPS ---
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

  // --- Transitions ---
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

  // --- Task selection ---
  const handleSelectTask = useCallback((id: string) => {
    setSelectedTaskId(id);
  }, []);

  const handleDeleteWithDeselect = useCallback(async (taskId: string) => {
    setSelectedTaskId(null);
    await handleDelete(taskId);
  }, [handleDelete]);

  const selectedTask = useMemo(() => {
    if (!selectedTaskId) return null;
    return tasks.find((t) => t.id === selectedTaskId) ?? null;
  }, [tasks, selectedTaskId]);

  // --- Tag counts for home view ---
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
        <div className="px-5 pb-2">
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
          <div className="h-full overflow-y-auto px-5 pb-6">
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
            onDelete={handleDeleteWithDeselect}
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
        onDelete={handleDeleteWithDeselect}
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
