import { describe, it, expect, beforeEach, vi } from 'vitest';

// Provide a minimal localStorage mock for non-browser test environments
const store: Record<string, string> = {};
const mockStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
};

vi.stubGlobal('localStorage', mockStorage);

import { getQueue, enqueue, dequeue, clearQueue, flushQueue } from './syncQueue';

describe('syncQueue', () => {
  beforeEach(() => {
    delete store['capex.sync-queue'];
  });

  it('starts with empty queue', () => {
    expect(getQueue()).toEqual([]);
  });

  it('enqueue adds an action with id and timestamp', () => {
    const action = enqueue({ url: '/api/test', method: 'POST', body: '{"a":1}' });
    expect(action.id).toBeTruthy();
    expect(action.createdAt).toBeTruthy();
    expect(action.retries).toBe(0);
    expect(getQueue()).toHaveLength(1);
  });

  it('dequeue removes an action by id', () => {
    const a1 = enqueue({ url: '/api/a', method: 'POST' });
    enqueue({ url: '/api/b', method: 'DELETE' });
    expect(getQueue()).toHaveLength(2);
    dequeue(a1.id);
    expect(getQueue()).toHaveLength(1);
    expect(getQueue()[0].url).toBe('/api/b');
  });

  it('clearQueue empties everything', () => {
    enqueue({ url: '/api/a', method: 'POST' });
    enqueue({ url: '/api/b', method: 'DELETE' });
    clearQueue();
    expect(getQueue()).toEqual([]);
  });

  it('flushQueue replays actions and removes successful ones', async () => {
    enqueue({ url: '/api/test', method: 'POST', body: '{}' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));

    const flushed = await flushQueue();
    expect(flushed).toBe(1);
    expect(getQueue()).toHaveLength(0);
    fetchSpy.mockRestore();
  });

  it('flushQueue keeps failed actions in queue', async () => {
    enqueue({ url: '/api/test', method: 'POST', body: '{}' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('error', { status: 500 }));

    const flushed = await flushQueue();
    expect(flushed).toBe(0);
    expect(getQueue()).toHaveLength(1);
    expect(getQueue()[0].retries).toBe(1);
    fetchSpy.mockRestore();
  });

  it('flushQueue stops on network error', async () => {
    enqueue({ url: '/api/a', method: 'POST' });
    enqueue({ url: '/api/b', method: 'POST' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));

    const flushed = await flushQueue();
    expect(flushed).toBe(0);
    expect(getQueue()).toHaveLength(2);
    fetchSpy.mockRestore();
  });
});
