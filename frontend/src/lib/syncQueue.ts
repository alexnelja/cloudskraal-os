/**
 * Offline sync queue — stores failed mutations in localStorage and replays
 * them when connectivity is restored.
 */

export interface QueuedAction {
  id: string;
  url: string;
  method: 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: string;
  createdAt: string;
  retries: number;
}

const LS_KEY = 'capex.sync-queue';

export function getQueue(): QueuedAction[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedAction[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(queue));
}

export function enqueue(action: Omit<QueuedAction, 'id' | 'createdAt' | 'retries'>): QueuedAction {
  const entry: QueuedAction = {
    ...action,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    retries: 0,
  };
  const queue = getQueue();
  queue.push(entry);
  saveQueue(queue);
  return entry;
}

export function dequeue(id: string) {
  saveQueue(getQueue().filter(a => a.id !== id));
}

export function clearQueue() {
  localStorage.removeItem(LS_KEY);
}

/** Replay all queued actions. Returns count of successfully flushed items. */
export async function flushQueue(): Promise<number> {
  const queue = getQueue();
  if (queue.length === 0) return 0;

  let flushed = 0;
  for (const action of queue) {
    try {
      const res = await fetch(action.url, {
        method: action.method,
        headers: action.body ? { 'Content-Type': 'application/json' } : undefined,
        body: action.body ?? undefined,
      });
      if (res.ok || res.status === 404 || res.status === 409) {
        // Success or already gone/conflict — remove from queue
        dequeue(action.id);
        flushed++;
      } else {
        // Increment retry counter but keep in queue
        const remaining = getQueue();
        const idx = remaining.findIndex(a => a.id === action.id);
        if (idx >= 0) {
          remaining[idx].retries++;
          saveQueue(remaining);
        }
      }
    } catch {
      // Network still down — stop flushing
      break;
    }
  }
  return flushed;
}
