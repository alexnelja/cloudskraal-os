/**
 * Attaches the current Supabase access token to every request aimed at our own
 * API (API_BASE_URL), via a single scoped global fetch wrapper. This means the
 * ~20 per-module fetch helpers need no changes, and requests to other origins
 * (Supabase Auth, Open-Meteo, map tiles…) are left untouched.
 *
 * The token is held in module state and kept fresh by the AuthProvider through
 * setAccessToken() on every Supabase auth state change.
 */
import { API_BASE_URL } from '../api/config';

let accessToken: string | null = null;
let installed = false;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url; // Request
}

function isApiRequest(input: RequestInfo | URL): boolean {
  return urlOf(input).startsWith(API_BASE_URL);
}

export function installApiAuthInterceptor(): void {
  if (installed) return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (accessToken && isApiRequest(input)) {
      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined)
      );
      headers.set('Authorization', `Bearer ${accessToken}`);
      return originalFetch(input, { ...init, headers });
    }
    return originalFetch(input, init);
  };
}

// Test-only: allow re-installing over a freshly stubbed global fetch.
export function __resetApiAuthForTests(): void {
  installed = false;
  accessToken = null;
}
