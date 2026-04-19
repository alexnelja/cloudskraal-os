import { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { Task } from '../../types/calendar';
import type { TaskStatusConfig } from '../../types/taskManager';
import BoardColumn from './BoardColumn';
import BoardCard from './BoardCard';

interface BoardViewProps {
  tasks: Task[];
  statuses: TaskStatusConfig[];
  onStatusChange: (taskId: string, newStatusId: string) => void;
  onSelectTask: (taskId: string) => void;
}

export default function BoardView({
  tasks,
  statuses,
  onStatusChange,
  onSelectTask,
}: BoardViewProps) {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const sortedStatuses = useMemo(
    () => [...statuses].sort((a, b) => a.sort_order - b.sort_order),
    [statuses],
  );

  const tasksByStatus = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const s of sortedStatuses) {
      map[s.id] = [];
    }
    for (const t of tasks) {
      const key = t.status_id;
      if (key && map[key]) {
        map[key].push(t);
      }
    }
    return map;
  }, [tasks, sortedStatuses]);

  const activeTask = activeTaskId
    ? tasks.find((t) => t.id === activeTaskId) ?? null
    : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveTaskId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTaskId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    // Determine target status: if dropped on a column, overId is the status id;
    // if dropped on a card, find that card's status_id
    let newStatusId = overId;
    const isStatusColumn = sortedStatuses.some((s) => s.id === overId);
    if (!isStatusColumn) {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask?.status_id) {
        newStatusId = overTask.status_id;
      }
    }

    const draggedTask = tasks.find((t) => t.id === taskId);
    if (draggedTask && draggedTask.status_id !== newStatusId) {
      onStatusChange(taskId, newStatusId);
    }
  }

  return (
    <DndContext
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 p-4 h-full overflow-x-auto">
        {sortedStatuses.map((status) => (
          <BoardColumn
            key={status.id}
            status={status}
            tasks={tasksByStatus[status.id] ?? []}
            onSelectTask={onSelectTask}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="w-[260px]">
            <BoardCard task={activeTask} onSelect={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
