import { useState, useCallback, useRef } from 'react';
import { getTasks, completeTask, uncompleteTask, createTask, updateTask, deleteTask } from '../api/calendar';
import { listTags, listStatuses, addTagToTask } from '../api/taskManager';
import { getFields, getMapGeoJSON } from '../api/farms';
import type { Task } from '../types/calendar';
import type { Tag, TaskStatusConfig } from '../types/taskManager';
import type { ParsedTaskInput } from '../components/tasks/QuickInput';

export interface CopToastData {
  costsLogged: Array<{ id: string; product_name: string; total_cost: number }>;
  taskTitle: string;
  taskId: string;
}

export interface CompletionToastData {
  taskId: string;
  title: string;
}

export function useTaskData() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [statuses, setStatuses] = useState<TaskStatusConfig[]>([]);
  const [fields, setFields] = useState<Array<{ id: string; name: string; enterprise: string }>>([]);
  const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [copToast, setCopToast] = useState<CopToastData | null>(null);
  const [completionToast, setCompletionToast] = useState<CompletionToastData | null>(null);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleComplete = useCallback(async (id: string) => {
    try {
      const taskTitle = tasks.find((t) => t.id === id)?.title ?? 'Task';
      const result = await completeTask(id);
      await fetchData();
      if (result.costs_logged && result.costs_logged.length > 0) {
        setCopToast({ costsLogged: result.costs_logged, taskTitle: result.title, taskId: id });
      } else {
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

  return {
    tasks,
    tags,
    statuses,
    fields,
    geojson,
    loading,
    fetchData,
    handleComplete,
    handleUndoComplete,
    handleUndoCompletionToast,
    handleStatusChange,
    handleTaskUpdate,
    handleDelete,
    handleReorder,
    handleQuickCreate,
    copToast,
    setCopToast,
    completionToast,
    setCompletionToast,
  };
}
