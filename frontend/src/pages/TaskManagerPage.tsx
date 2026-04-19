import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Plus, GearSix } from '@phosphor-icons/react';
import { getTasks, completeTask, createTask, updateTask, deleteTask } from '../api/calendar';
import { listTags, listStatuses, addTagToTask } from '../api/taskManager';
import { getFields } from '../api/farms';
import type { Task } from '../types/calendar';
import type { Tag, TaskStatusConfig } from '../types/taskManager';
import TodayView from '../components/tasks/TodayView';
import BoardView from '../components/tasks/BoardView';
import ListView from '../components/tasks/ListView';
import TaskCreateForm from '../components/tasks/TaskCreateForm';
import QuickInput from '../components/tasks/QuickInput';
import type { ParsedTaskInput } from '../components/tasks/QuickInput';
import TagManager from '../components/tasks/TagManager';

type TabId = 'today' | 'board' | 'list';

const TABS: { id: TabId; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'board', label: 'Board' },
  { id: 'list', label: 'List' },
];

export default function TaskManagerPage() {
  const [activeTab, setActiveTab] = useState<TabId>('today');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [statuses, setStatuses] = useState<TaskStatusConfig[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [fields, setFields] = useState<Array<{ id: string; name: string }>>([]);

  const fetchData = useCallback(async () => {
    try {
      const [taskData, tagData, statusData, fieldData] = await Promise.all([
        getTasks(),
        listTags(),
        listStatuses(),
        getFields(),
      ]);
      setTasks(taskData);
      setTags(tagData);
      setStatuses(statusData);
      setFields(fieldData.map((f) => ({ id: f.id, name: f.name })));
    } catch (err) {
      console.error('Failed to load task data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleComplete = useCallback(
    async (id: string) => {
      try {
        await completeTask(id);
        await fetchData();
      } catch (err) {
        console.error('Failed to complete task:', err);
      }
    },
    [fetchData],
  );

  const handleCreate = useCallback(
    async (data: any) => {
      try {
        const { tag_ids, ...taskData } = data;
        const newTask = await createTask({
          ...taskData,
          type: 'manual',
          enterprise: null,
          recurrence_rule: null,
          calendar_event_id: null,
          notes: null,
          actual_minutes: null,
          blocked_reason: null,
          blocked_until: null,
          sort_order: 0,
          verified_by: null,
          verified_at: null,
        });
        if (tag_ids?.length) {
          await Promise.all(tag_ids.map((tagId: string) => addTagToTask(newTask.id, tagId)));
        }
        await fetchData();
        setCreateOpen(false);
      } catch (err) {
        console.error('Failed to create task:', err);
      }
    },
    [fetchData],
  );

  const handleStatusChange = useCallback(
    async (taskId: string, newStatusId: string) => {
      try {
        await updateTask(taskId, { status_id: newStatusId });
        await fetchData();
      } catch (err) {
        console.error('Failed to update task status:', err);
      }
    },
    [fetchData],
  );

  const handleDelete = useCallback(
    async (taskId: string) => {
      try {
        await deleteTask(taskId);
        await fetchData();
      } catch (err) {
        console.error('Failed to delete task:', err);
      }
    },
    [fetchData],
  );

  const handleReorder = useCallback(
    async (taskId: string, newIndex: number) => {
      try {
        await updateTask(taskId, { sort_order: newIndex });
        setTasks((prev) => {
          const idx = prev.findIndex((t) => t.id === taskId);
          if (idx === -1) return prev;
          const updated = [...prev];
          updated[idx] = { ...updated[idx], sort_order: newIndex };
          return updated;
        });
      } catch (err) {
        console.error('Failed to reorder task:', err);
      }
    },
    [],
  );

  const handleQuickCreate = useCallback(
    async (parsed: ParsedTaskInput) => {
      try {
        const newTask = await createTask({
          title: parsed.title,
          description: null,
          enterprise: null,
          field_id: parsed.field_id,
          type: 'manual',
          status: 'pending',
          priority: (parsed.priority as any) || 'medium',
          due_date: parsed.due_date,
          assigned_to: null,
          depends_on_task_id: null,
          recurrence_rule: null,
          calendar_event_id: null,
          notes: null,
          status_id: null,
          estimated_minutes: null,
          actual_minutes: null,
          blocked_reason: null,
          blocked_until: null,
          sort_order: 0,
          verified_by: null,
          verified_at: null,
        });
        if (parsed.tag_ids.length) {
          await Promise.all(
            parsed.tag_ids.map((tagId) => addTagToTask(newTask.id, tagId)),
          );
        }
        await fetchData();
      } catch (err) {
        console.error('Failed to quick-create task:', err);
      }
    },
    [fetchData],
  );

  return (
    <div className="h-[calc(100vh-5rem)] md:h-screen flex flex-col">
      {/* Header */}
      <div className="px-6 pt-6 pb-2">
        <h1 className="text-2xl font-serif text-stone-900 tracking-tight">Tasks</h1>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-6 py-2 border-b border-stone-200/60">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <motion.button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              whileTap={{ scale: 0.94 }}
              className={`px-3 py-1 text-[11px] uppercase tracking-wide rounded-full whitespace-nowrap transition-colors ${
                isActive ? 'text-white' : 'text-stone-700 hover:text-stone-900'
              }`}
              style={{
                background: isActive
                  ? 'linear-gradient(135deg, #d97706, #b45309)'
                  : 'rgba(245, 240, 233, 0.6)',
                boxShadow: isActive
                  ? 'inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 2px 6px -2px rgba(180, 83, 9, 0.4)'
                  : 'none',
              }}
            >
              {tab.label}
            </motion.button>
          );
        })}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setTagManagerOpen(true)}
          className="p-1.5 rounded-full text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors"
          aria-label="Manage tags and statuses"
        >
          <GearSix size={18} />
        </button>
      </div>

      {/* Quick input bar */}
      {activeTab === 'today' && !loading && (
        <QuickInput tags={tags} fields={fields} onSubmit={handleQuickCreate} />
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-sm text-stone-500">Loading tasks...</span>
          </div>
        ) : activeTab === 'today' ? (
          <TodayView
            tasks={tasks}
            statuses={statuses}
            tags={tags}
            onComplete={handleComplete}
            onSelectTask={setSelectedTaskId}
            selectedTaskId={selectedTaskId}
            onReorder={handleReorder}
          />
        ) : activeTab === 'board' ? (
          <BoardView
            tasks={tasks}
            statuses={statuses}
            onStatusChange={handleStatusChange}
            onSelectTask={setSelectedTaskId}
          />
        ) : (
          <ListView
            tasks={tasks}
            statuses={statuses}
            tags={tags}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
            onSelectTask={setSelectedTaskId}
          />
        )}
      </div>

      {/* Floating "+" button */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.9 }}
        onClick={() => setCreateOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white text-2xl"
        style={{
          background: 'linear-gradient(135deg, #d97706, #b45309)',
          boxShadow: '0 4px 14px -3px rgba(180, 83, 9, 0.5)',
        }}
        aria-label="Create task"
      >
        <Plus weight="bold" size={24} />
      </motion.button>

      {/* Task creation form */}
      <TaskCreateForm
        open={createOpen}
        tags={tags}
        statuses={statuses}
        fields={fields}
        onSave={handleCreate}
        onDismiss={() => setCreateOpen(false)}
      />

      {/* Tag & status manager */}
      <TagManager
        open={tagManagerOpen}
        onDismiss={() => setTagManagerOpen(false)}
        tags={tags}
        statuses={statuses}
        onTagsChanged={() => {
          fetchData();
        }}
      />
    </div>
  );
}
