import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { getTasks, completeTask } from '../api/calendar';
import { listTags, listStatuses } from '../api/taskManager';
import type { Task } from '../types/calendar';
import type { Tag, TaskStatusConfig } from '../types/taskManager';
import TodayView from '../components/tasks/TodayView';

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

  const fetchData = useCallback(async () => {
    try {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 2);
      const dueBefore = tomorrow.toISOString().slice(0, 10);

      const [taskData, tagData, statusData] = await Promise.all([
        getTasks({ due_before: dueBefore }),
        listTags(),
        listStatuses(),
      ]);
      setTasks(taskData);
      setTags(tagData);
      setStatuses(statusData);
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

  return (
    <div className="h-[calc(100vh-5rem)] md:h-screen flex flex-col">
      {/* Header */}
      <div className="px-6 pt-6 pb-2">
        <h1 className="text-2xl font-serif text-stone-900 tracking-tight">Tasks</h1>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 px-6 py-2 border-b border-stone-200/60">
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
      </div>

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
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-stone-400">Coming soon</p>
          </div>
        )}
      </div>
    </div>
  );
}
