import { describe, it, expect, vi, beforeEach } from 'vitest';
import { installApiAuthInterceptor, setAccessToken, __resetApiAuthForTests } from './apiAuth';
import { API_BASE_URL } from '../api/config';

describe('apiAuth fetch interceptor', () => {
  let mock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', mock);
    __resetApiAuthForTests();
    setAccessToken(null);
    installApiAuthInterceptor(); // wraps the fresh mock
  });

  function lastInit() {
    return mock.mock.calls[mock.mock.calls.length - 1][1] as RequestInit;
  }
  function authHeader() {
    const h = new Headers(lastInit()?.headers);
    return h.get('Authorization');
  }

  it('adds Authorization: Bearer <token> to API-base requests when a token is set', async () => {
    setAccessToken('tok-123');
    await fetch(`${API_BASE_URL}/production/batches`);
    expect(authHeader()).toBe('Bearer tok-123');
  });

  it('does NOT add Authorization to non-API requests (e.g. Supabase, external)', async () => {
    setAccessToken('tok-123');
    await fetch('https://example.supabase.co/auth/v1/user');
    expect(authHeader()).toBeNull();
  });

  it('does NOT add Authorization when no token is set', async () => {
    await fetch(`${API_BASE_URL}/dashboard/stats`);
    expect(authHeader()).toBeNull();
  });

  it('preserves existing headers (Content-Type) while adding the token', async () => {
    setAccessToken('tok-xyz');
    await fetch(`${API_BASE_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const h = new Headers(lastInit().headers);
    expect(h.get('Content-Type')).toBe('application/json');
    expect(h.get('Authorization')).toBe('Bearer tok-xyz');
    expect(lastInit().method).toBe('POST');
  });

  it('reflects token changes (sign-out clears it)', async () => {
    setAccessToken('tok-1');
    await fetch(`${API_BASE_URL}/a`);
    expect(authHeader()).toBe('Bearer tok-1');
    setAccessToken(null);
    await fetch(`${API_BASE_URL}/b`);
    expect(authHeader()).toBeNull();
  });
});
