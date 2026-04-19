export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function isNotificationEnabled(): boolean {
  return 'Notification' in window && Notification.permission === 'granted';
}

export function sendNotification(title: string, options?: NotificationOptions): void {
  if (!isNotificationEnabled()) return;
  new Notification(title, {
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    ...options,
  });
}

// Specific farm notification helpers

export function notifyWeatherUnblock(fieldName: string, condition: string): void {
  sendNotification(`Spray window open — ${fieldName}`, {
    body: `${condition}. Tasks unblocked.`,
    tag: `weather-${fieldName}`,
  });
}

export function notifyOverdueTasks(count: number): void {
  sendNotification(`${count} overdue task${count === 1 ? '' : 's'}`, {
    body: 'Check your task list for items past due.',
    tag: 'overdue-reminder',
  });
}

export function notifyPhiComplete(fieldName: string, chemical: string): void {
  sendNotification(`Harvest cleared — ${fieldName}`, {
    body: `${chemical} withholding period complete.`,
    tag: `phi-${fieldName}`,
  });
}

export function notifyTaskAssigned(taskTitle: string): void {
  sendNotification('New task assigned', {
    body: taskTitle,
    tag: `assigned-${taskTitle}`,
  });
}
