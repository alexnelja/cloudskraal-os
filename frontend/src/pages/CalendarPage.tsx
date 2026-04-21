import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import MonthView from '../components/calendar/MonthView';
import TaskList from '../components/calendar/TaskList';
import LoadingOverlay from '../components/ui/LoadingOverlay';
import TaskDetail from '../components/calendar/TaskDetail';
import TaskEditor from '../components/calendar/TaskEditor';
import EventEditor from '../components/calendar/EventEditor';
import { getCalendarSummary, completeTask } from '../api/calendar';
import type { CalendarEvent, CalendarSummary, Task } from '../types/calendar';
import { ENTERPRISE_COLORS, ENTERPRISE_LABELS } from '../types/farm';

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

const FILTER_ENTERPRISES = ['rooibos', 'wine', 'sheep', 'buchu', 'general'];

export default function CalendarPage() {
  const { taskId: routeTaskId } = useParams<{ taskId?: string }>();

  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr());
  const [calendarData, setCalendarData] = useState<CalendarSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(routeTaskId ?? null);
  const [enterpriseFilter, setEnterpriseFilter] = useState<Set<string>>(new Set());
  const [showTaskEditor, setShowTaskEditor] = useState(false);
  const [showEventEditor, setShowEventEditor] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [rangeStartDate, setRangeStartDate] = useState<string | undefined>(undefined);
  const [rangeEndDate, setRangeEndDate] = useState<string | undefined>(undefined);

  const monthStr = `${currentYear}-${pad2(currentMonth)}`;

  const fetchData = useCallback(() => {
    setLoading(true);
    getCalendarSummary(monthStr)
      .then((data) => {
        setCalendarData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load calendar data:', err);
        setLoading(false);
      });
  }, [monthStr]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (routeTaskId) setSelectedTaskId(routeTaskId);
  }, [routeTaskId]);

  function handlePrevMonth() {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  }

  function handleNextMonth() {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  }

  function toggleEnterprise(ent: string) {
    setEnterpriseFilter((prev) => {
      const next = new Set(prev);
      if (next.has(ent)) {
        next.delete(ent);
      } else {
        next.add(ent);
      }
      return next;
    });
  }

  // Filter data by enterprise
  const filteredEvents: CalendarEvent[] =
    calendarData?.events.filter(
      (e) => enterpriseFilter.size === 0 || enterpriseFilter.has(e.enterprise ?? 'general'),
    ) ?? [];

  const filteredTasks: Task[] =
    calendarData?.tasks.filter(
      (t) => enterpriseFilter.size === 0 || enterpriseFilter.has(t.enterprise ?? 'general'),
    ) ?? [];

  // Tasks for the selected date
  const dayTasks = filteredTasks.filter(
    (t) => t.due_date && t.due_date.slice(0, 10) === selectedDate,
  );

  const dayEvents = filteredEvents.filter(
    (e) => e.start_date.slice(0, 10) === selectedDate,
  );

  async function handleCompleteTask(taskId: string) {
    try {
      await completeTask(taskId);
      fetchData();
    } catch (err) {
      console.error('Failed to complete task:', err);
    }
  }

  function handleEditTask(task: Task) {
    setEditingTask(task);
    setShowTaskEditor(true);
  }

  function handleRangeSelect(startDate: string, endDate: string) {
    setRangeStartDate(startDate);
    setRangeEndDate(endDate);
    setShowEventEditor(true);
  }

  function handleSaveComplete() {
    setShowTaskEditor(false);
    setShowEventEditor(false);
    setEditingTask(undefined);
    setRangeStartDate(undefined);
    setRangeEndDate(undefined);
    fetchData();
  }

  return (
    <div className="h-[calc(100vh-5rem)] md:h-screen flex flex-col overflow-hidden">
      {/* Top bar: enterprise filters + action buttons */}
      <div className="flex-shrink-0 border-b border-[#f3f4f3] px-4 py-3 flex items-center gap-3 flex-wrap bg-white">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          {FILTER_ENTERPRISES.map((ent) => {
            const active = enterpriseFilter.has(ent);
            return (
              <button
                key={ent}
                onClick={() => toggleEnterprise(ent)}
                className={`
                  px-3 py-1 rounded-full text-xs font-medium transition-all
                  ${active
                    ? 'text-white shadow-sm'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}
                `}
                style={active ? { backgroundColor: ENTERPRISE_COLORS[ent] ?? '#6b7280' } : undefined}
              >
                {ENTERPRISE_LABELS[ent] ?? ent.charAt(0).toUpperCase() + ent.slice(1)}
              </button>
            );
          })}
          {enterpriseFilter.size > 0 && (
            <button
              onClick={() => setEnterpriseFilter(new Set())}
              className="text-xs text-stone-400 hover:text-stone-600 ml-1"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setEditingTask(undefined); setShowTaskEditor(true); }}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-700 text-white text-xs font-medium rounded-lg hover:bg-emerald-800 transition-colors"
          >
            <Plus size={14} />
            New Task
          </button>
          <button
            onClick={() => setShowEventEditor(true)}
            className="flex items-center gap-1 px-3 py-1.5 border border-stone-300 text-stone-700 text-xs font-medium rounded-lg hover:bg-stone-50 transition-colors"
          >
            <Plus size={14} />
            New Event
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Month view */}
        <div className="flex-1 md:flex-[3] overflow-hidden flex flex-col bg-white">
          {loading ? (
            <LoadingOverlay message="Loading calendar…" />
          ) : (
            <MonthView
              year={currentYear}
              month={currentMonth}
              events={filteredEvents}
              tasks={filteredTasks}
              selectedDate={selectedDate}
              onDayClick={setSelectedDate}
              onRangeSelect={handleRangeSelect}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
            />
          )}
        </div>

        {/* Right panel: day detail */}
        <div className="md:w-[400px] md:flex-shrink-0 border-t md:border-t-0 md:border-l border-[#f3f4f3] bg-white overflow-y-auto">
          <div className="p-4">
            <h3 className="text-sm font-semibold text-stone-700 mb-3">
              {selectedDate
                ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-ZA', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                : 'Select a day'}
            </h3>

            {/* Events for the day */}
            {dayEvents.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">Events</p>
                <div className="space-y-2">
                  {dayEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-center gap-2 p-2 rounded-lg border border-stone-100 bg-stone-50"
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor:
                            ev.color ?? ENTERPRISE_COLORS[ev.enterprise ?? ''] ?? '#6b7280',
                        }}
                      />
                      <span className="text-sm text-stone-800 truncate">{ev.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tasks for the day */}
            {dayTasks.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">Tasks</p>
                <TaskList
                  tasks={dayTasks}
                  selectedTaskId={selectedTaskId}
                  onSelect={setSelectedTaskId}
                  onComplete={handleCompleteTask}
                />
              </div>
            ) : (
              !loading && dayEvents.length === 0 && (
                <p className="text-sm text-stone-400 mt-4">No tasks or events for this day.</p>
              )
            )}
          </div>
        </div>
      </div>

      {/* Task detail panel */}
      <TaskDetail
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onRefresh={fetchData}
        onEdit={handleEditTask}
      />

      {/* Editors */}
      <TaskEditor
        task={editingTask}
        open={showTaskEditor}
        onClose={() => { setShowTaskEditor(false); setEditingTask(undefined); }}
        onSave={handleSaveComplete}
      />
      <EventEditor
        open={showEventEditor}
        onClose={() => { setShowEventEditor(false); setRangeStartDate(undefined); setRangeEndDate(undefined); }}
        onSave={handleSaveComplete}
        defaultStartDate={rangeStartDate}
        defaultEndDate={rangeEndDate}
      />
    </div>
  );
}
