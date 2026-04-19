import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { SunHorizon } from '@phosphor-icons/react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Task } from '../../types/calendar';
import type { Tag, TaskStatusConfig } from '../../types/taskManager';
import TaskRow from './TaskRow';
import DailyProgress from './DailyProgress';
import TaskStats from './TaskStats';

interface TodayViewProps {
  tasks: Task[];
  statuses: TaskStatusConfig[];
  tags: Tag[];
  onComplete: (id: string) => void;
  onSelectTask: (id: string) => void;
  selectedTaskId: string | null;
  onReorder?: (taskId: string, newIndex: number) => void;
}

type TimeGroup = 'Overdue' | 'Today' | 'Tomorrow';

const GROUP_ORDER: TimeGroup[] = ['Overdue', 'Today', 'Tomorrow'];

const GROUP_STYLES: Record<TimeGroup, { header: string; accent: string }> = {
  Overdue: { header: 'text-red-700', accent: 'bg-red-100 text-red-700' },
  Today: { header: 'text-stone-900', accent: 'bg-amber-100/70 text-amber-800' },
  Tomorrow: { header: 'text-stone-500', accent: 'bg-stone-100 text-stone-600' },
};

function classifyTask(dueDate: string | null): TimeGroup {
  if (!dueDate) return 'Today';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Today';
  return 'Tomorrow';
}

export default function TodayView({
  tasks,
  statuses,
  tags,
  onComplete,
  onSelectTask,
  selectedTaskId,
  onReorder,
}: TodayViewProps) {
  const [activeTagIds, setActiveTagIds] = useState<Set<string>>(new Set());

  const filteredTasks = useMemo(() => {
    if (activeTagIds.size === 0) return tasks;
    return tasks.filter((t) =>
      t.tags?.some((tag) => activeTagIds.has(tag.id)),
    );
  }, [tasks, activeTagIds]);

  const groups = useMemo(() => {
    const map: Record<TimeGroup, Task[]> = { Overdue: [], Today: [], Tomorrow: [] };
    for (const task of filteredTasks) {
      const group = classifyTask(task.due_date);
      map[group].push(task);
    }
    return map;
  }, [filteredTasks]);

  const todayTasks = useMemo(() => {
    return tasks.filter((t) => classifyTask(t.due_date) === 'Today');
  }, [tasks]);

  const todayCompleted = todayTasks.filter((t) => t.status === 'completed').length;

  const toggleTag = (tagId: string) => {
    setActiveTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  };

  const hasAny = GROUP_ORDER.some((g) => groups[g].length > 0);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorder) return;

    // Find which group the dragged task belongs to
    for (const groupName of GROUP_ORDER) {
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
    <div className="flex flex-col h-full">
      {/* Tag filter pills */}
      <div className="flex gap-1 px-4 py-2 border-b border-stone-200/60 overflow-x-auto">
        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          onClick={() => setActiveTagIds(new Set())}
          className={`px-3 py-1 text-[11px] uppercase tracking-wide rounded-full whitespace-nowrap transition-colors ${
            activeTagIds.size === 0 ? 'text-white' : 'text-stone-700 hover:text-stone-900'
          }`}
          style={{
            background:
              activeTagIds.size === 0
                ? 'linear-gradient(135deg, #d97706, #b45309)'
                : 'rgba(245, 240, 233, 0.6)',
          }}
        >
          All
        </motion.button>
        {tags.map((tag) => {
          const isActive = activeTagIds.has(tag.id);
          return (
            <motion.button
              key={tag.id}
              type="button"
              whileTap={{ scale: 0.94 }}
              aria-label={tag.name}
              onClick={() => toggleTag(tag.id)}
              className={`px-3 py-1 text-[11px] uppercase tracking-wide rounded-full whitespace-nowrap transition-colors ${
                isActive ? 'text-white' : 'text-stone-700 hover:text-stone-900'
              }`}
              style={{
                background: isActive
                  ? tag.color
                  : 'rgba(245, 240, 233, 0.6)',
              }}
            >
              {tag.name}
            </motion.button>
          );
        })}
      </div>

      {/* Task groups */}
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-y-auto">
          {!hasAny ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
              <SunHorizon size={40} weight="duotone" className="text-amber-300 mb-3" />
              <p className="text-sm text-stone-500">No tasks for today — enjoy the quiet</p>
            </div>
          ) : (
            <AnimatePresence>
              {GROUP_ORDER.map((groupName) => {
                const groupTasks = groups[groupName];
                if (groupTasks.length === 0) return null;
                const style = GROUP_STYLES[groupName];
                return (
                  <motion.div
                    key={groupName}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex items-center gap-2 px-4 pt-4 pb-1">
                      <span className={`font-serif text-sm font-medium ${style.header}`}>
                        {groupName}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${style.accent}`}>
                        {groupTasks.length}
                      </span>
                    </div>
                    <SortableContext
                      items={groupTasks.map((t) => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <ul>
                        {groupTasks.map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            statuses={statuses}
                            onComplete={onComplete}
                            onSelect={onSelectTask}
                            selected={task.id === selectedTaskId}
                            sortableId={task.id}
                          />
                        ))}
                      </ul>
                    </SortableContext>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </DndContext>

      {/* Daily progress */}
      <div className="border-t border-stone-200/60">
        <DailyProgress total={todayTasks.length} completed={todayCompleted} />
        <TaskStats tasks={tasks} completedToday={todayCompleted} totalToday={todayTasks.length} />
      </div>
    </div>
  );
}
