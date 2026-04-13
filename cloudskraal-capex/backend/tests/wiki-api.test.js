import { describe, it, expect, beforeAll } from 'vitest';

const BASE = 'http://localhost:3001/api';

async function api(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
  return { status: res.status, data: await res.json() };
}

describe('Wiki API', () => {
  let testSlug = '';

  it('GET /wiki — lists pages', async () => {
    const { status, data } = await api('/wiki');
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty('title');
    expect(data[0]).toHaveProperty('slug');
  });

  it('POST /wiki — creates a page', async () => {
    const { status, data } = await api('/wiki', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test Page ' + Date.now(), body: 'Test body with [[link]]', category: 'general' }),
    });
    expect(status).toBe(201);
    expect(data.title).toMatch(/^Test Page/);
    expect(data.slug).toBeTruthy();
    testSlug = data.slug;
  });

  it('GET /wiki/:slug — gets a page with links', async () => {
    const { status, data } = await api(`/wiki/${testSlug}`);
    expect(status).toBe(200);
    expect(data.title).toMatch(/^Test Page/);
    expect(data.body).toBe('Test body with [[link]]');
    expect(data).toHaveProperty('outgoing_links');
    expect(data).toHaveProperty('backlinks');
    expect(data).toHaveProperty('broken_links');
    expect(data).toHaveProperty('unlinked_mentions');
  });

  it('PATCH /wiki/:slug — updates a page', async () => {
    const { status, data } = await api(`/wiki/${testSlug}`, {
      method: 'PATCH',
      body: JSON.stringify({ body: 'Updated body', tags: ['test-tag'] }),
    });
    expect(status).toBe(200);
    expect(data.body).toBe('Updated body');
    expect(data.tags).toContain('test-tag');
  });

  it('GET /wiki/:slug/history — has revision after update', async () => {
    const { status, data } = await api(`/wiki/${testSlug}/history`);
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(data[0].body).toBe('Test body with [[link]]'); // original body
  });

  it('GET /wiki?search=test — searches pages', async () => {
    const { status, data } = await api('/wiki?search=test');
    expect(status).toBe(200);
    expect(data.some(p => p.slug === testSlug)).toBe(true);
  });

  it('GET /wiki/graph — returns graph data', async () => {
    const { status, data } = await api('/wiki/graph');
    expect(status).toBe(200);
    expect(data).toHaveProperty('nodes');
    expect(data).toHaveProperty('edges');
    expect(Array.isArray(data.nodes)).toBe(true);
  });

  it('GET /wiki/tags — returns tags', async () => {
    const { status, data } = await api('/wiki/tags');
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('DELETE /wiki/:slug — soft deletes to trash', async () => {
    await api(`/wiki/${testSlug}`, { method: 'DELETE' });
    // Page should be gone
    const { status } = await api(`/wiki/${testSlug}`);
    expect(status).toBe(404);
  });

  it('GET /wiki-trash — shows deleted page', async () => {
    const { status, data } = await api('/wiki-trash');
    expect(status).toBe(200);
    expect(data.some(p => p.slug === testSlug)).toBe(true);
  });

  it('GET /wiki-audit — shows audit log', async () => {
    const { status, data } = await api('/wiki-audit');
    expect(status).toBe(200);
    expect(data.length).toBeGreaterThan(0);
    expect(data.some(l => l.action === 'create')).toBe(true);
    expect(data.some(l => l.action === 'delete')).toBe(true);
  });

  it('POST /wiki — rejects missing title', async () => {
    const { status } = await api('/wiki', {
      method: 'POST',
      body: JSON.stringify({ body: 'no title' }),
    });
    expect(status).toBe(400);
  });

  it('GET /wiki/nonexistent — returns 404', async () => {
    const { status } = await api('/wiki/this-slug-does-not-exist-' + Date.now());
    expect(status).toBe(404);
  });
});
