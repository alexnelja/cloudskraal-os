/**
 * v1.0.0 release gate — Supabase JWT auth middleware.
 *
 * In-process tests (no live server, no network): a tiny express app mounts the
 * middleware with an injected token verifier so we exercise every branch
 * (missing header, invalid token, valid token, verifier failure, disabled mode)
 * deterministically and offline.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRequireAuth } from '../src/middleware/requireAuth.js';

function appWith(verifyToken) {
  const app = express();
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.use(createRequireAuth({ verifyToken }));
  app.get('/api/secret', (req, res) => res.json({ ok: true, user: req.user || null }));
  return app;
}

const VALID = { id: 'user-123', email: 'alex@example.com' };
const verifyOk = async (token) => (token === 'good-token' ? VALID : null);

beforeEach(() => {
  delete process.env.AUTH_DISABLED; // auth enabled unless a test opts out
});
afterEach(() => {
  delete process.env.AUTH_DISABLED;
});

describe('requireAuth middleware', () => {
  it('401 when Authorization header is missing', async () => {
    const res = await request(appWith(verifyOk)).get('/api/secret');
    expect(res.status).toBe(401);
  });

  it('401 when header is malformed (no Bearer scheme)', async () => {
    const res = await request(appWith(verifyOk)).get('/api/secret').set('Authorization', 'good-token');
    expect(res.status).toBe(401);
  });

  it('401 when token is invalid/expired (verifier returns null)', async () => {
    const res = await request(appWith(verifyOk)).get('/api/secret').set('Authorization', 'Bearer bad-token');
    expect(res.status).toBe(401);
  });

  it('200 and attaches req.user when token is valid', async () => {
    const res = await request(appWith(verifyOk)).get('/api/secret').set('Authorization', 'Bearer good-token');
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual(VALID);
  });

  it('503 (fail closed) when the verifier throws (e.g. Supabase unreachable / misconfigured)', async () => {
    const verifyThrows = async () => { throw new Error('network down'); };
    const res = await request(appWith(verifyThrows)).get('/api/secret').set('Authorization', 'Bearer whatever');
    expect(res.status).toBe(503);
  });

  it('bypasses entirely when AUTH_DISABLED=true (dev/test)', async () => {
    process.env.AUTH_DISABLED = 'true';
    const res = await request(appWith(verifyOk)).get('/api/secret');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
