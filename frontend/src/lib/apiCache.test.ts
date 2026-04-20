import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCached, setCache, invalidate, cached } from './apiCache';

describe('apiCache', () => {
  beforeEach(() => invalidate());

  it('returns null for uncached key', () => {
    expect(getCached('missing')).toBeNull();
  });

  it('returns cached data within TTL', () => {
    setCache('test', { value: 42 });
    expect(getCached('test')).toEqual({ value: 42 });
  });

  it('returns null after TTL expires', () => {
    setCache('test', { value: 42 });
    // Advance time past TTL
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 120_000);
    expect(getCached('test')).toBeNull();
    vi.restoreAllMocks();
  });

  it('invalidate clears all when no pattern given', () => {
    setCache('tasks', [1, 2]);
    setCache('tags', ['a']);
    invalidate();
    expect(getCached('tasks')).toBeNull();
    expect(getCached('tags')).toBeNull();
  });

  it('invalidate clears specific pattern', () => {
    setCache('tasks', [1, 2]);
    setCache('tags', ['a']);
    invalidate('tasks');
    expect(getCached('tasks')).toBeNull();
    expect(getCached('tags')).toEqual(['a']);
  });

  it('cached() returns fresh data on miss', async () => {
    const fetcher = vi.fn().mockResolvedValue([1, 2, 3]);
    const result = await cached('test', fetcher);
    expect(result).toEqual([1, 2, 3]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('cached() returns cached data on hit', async () => {
    const fetcher = vi.fn().mockResolvedValue([1, 2, 3]);
    await cached('test', fetcher);
    const result2 = await cached('test', fetcher);
    expect(result2).toEqual([1, 2, 3]);
    expect(fetcher).toHaveBeenCalledTimes(1); // Not called again
  });

  it('cached() re-fetches after TTL expires', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce([1, 2])
      .mockResolvedValueOnce([3, 4]);
    await cached('test', fetcher);
    // Advance time past default TTL
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 120_000);
    const result = await cached('test', fetcher);
    expect(result).toEqual([3, 4]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });
});
