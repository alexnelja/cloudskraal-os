import { useState, useEffect, useCallback, useRef } from 'react';
import type { Task } from '../types/calendar';
import type { WeatherBlock } from '../lib/weatherBlocking';
import { requestNotificationPermission, isNotificationEnabled, notifyOverdueTasks, notifyWeatherUnblock } from '../lib/notifications';

export function useTaskNotifications(tasks: Task[], weatherBlocks: WeatherBlock[], loading: boolean) {
  const [notificationsOn, setNotificationsOn] = useState(() =>
    localStorage.getItem('capex.notifications-enabled') === 'true' && isNotificationEnabled(),
  );
  const prevBlockedIdsRef = useRef<Set<string>>(new Set());

  // Overdue notification effect
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

  // Weather unblock detection effect
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

  return {
    notificationsOn,
    handleToggleNotifications,
  };
}
