import { describe, it, expect, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'data', 'capex.db');

const BASE = 'http://localhost:3001/api';
async function api(p, o = {}) {
  const res = await fetch(`${BASE}${p}`, {
    headers: { 'Content-Type': 'application/json' }, ...o,
  });
  if (res.status === 204) return { status: 204, data: null };
  return { status: res.status, data: await res.json() };
}

const TEST_SENTINEL = '__test_tag_api__';

afterAll(() => {
  const db = new Database(DB_PATH);
  // Clean up test tasks
  const testTasks = db.prepare("SELECT id FROM tasks WHERE title LIKE ?").all(`%${TEST_SENTINEL}%`);
  for (const t of testTasks) {
    db.prepare('DELETE FROM task_tags WHERE task_id = ?').run(t.id);
    db.prepare('DELETE FROM task_inputs WHERE task_id = ?').run(t.id);
    db.prepare('DELETE FROM task_checklists WHERE task_id = ?').run(t.id);
    db.prepare('DELETE FROM tasks WHERE id = ?').run(t.id);
  }
  // Clean up test tags
  db.prepare("DELETE FROM tags WHERE name LIKE ?").run(`%${TEST_SENTINEL}%`);
  // Clean up test statuses
  db.prepare("DELETE FROM task_statuses WHERE name LIKE ?").run(`%${TEST_SENTINEL}%`);
  db.close();
});

describe('Tags API', () => {
  it('GET /tags returns seeded tags (>= 11)', async () => {
    const { status, data } = await api('/tags');
    expect(status).toBe(200);
    expect(data.length).toBeGreaterThanOrEqual(11);
  });

  it('GET /tags?group=enterprise returns only enterprise tags', async () => {
    const { status, data } = await api('/tags?group=enterprise');
    expect(status).toBe(200);
    expect(data.length).toBeGreaterThan(0);
    for (const tag of data) {
      expect(tag.group).toBe('enterprise');
    }
  });

  it('POST /tags creates a custom tag and returns 201', async () => {
    const { status, data } = await api('/tags', {
      method: 'POST',
      body: JSON.stringify({ name: `custom_${TEST_SENTINEL}`, color: '#ff0000' }),
    });
    expect(status).toBe(201);
    expect(data.id).toBeTruthy();
    expect(data.name).toBe(`custom_${TEST_SENTINEL}`);
    expect(data.color).toBe('#ff0000');
    expect(data.group).toBe('custom');
  });

  it('DELETE /tags/:id removes tag and returns 204', async () => {
    // Create a tag to delete
    const { data: tag } = await api('/tags', {
      method: 'POST',
      body: JSON.stringify({ name: `delete_me_${TEST_SENTINEL}` }),
    });

    const { status } = await api(`/tags/${tag.id}`, { method: 'DELETE' });
    expect(status).toBe(204);

    // Verify it's gone
    const { data: all } = await api('/tags');
    const found = all.find(t => t.id === tag.id);
    expect(found).toBeUndefined();
  });
});

describe('Task Statuses API', () => {
  it('GET /task-statuses returns >= 6 defaults', async () => {
    const { status, data } = await api('/task-statuses');
    expect(status).toBe(200);
    expect(data.length).toBeGreaterThanOrEqual(6);
  });

  it('POST /task-statuses creates custom status with valid category', async () => {
    const { status, data } = await api('/task-statuses', {
      method: 'POST',
      body: JSON.stringify({ name: `review_${TEST_SENTINEL}`, color: '#00ff00', category: 'active' }),
    });
    expect(status).toBe(201);
    expect(data.name).toBe(`review_${TEST_SENTINEL}`);
    expect(data.category).toBe('active');
  });

  it('POST /task-statuses rejects invalid category with 400', async () => {
    const { status, data } = await api('/task-statuses', {
      method: 'POST',
      body: JSON.stringify({ name: `bad_${TEST_SENTINEL}`, category: 'invalid' }),
    });
    expect(status).toBe(400);
    expect(data.error).toContain('category');
  });

  it('PATCH /task-statuses/:id updates color', async () => {
    // Create one to update
    const { data: created } = await api('/task-statuses', {
      method: 'POST',
      body: JSON.stringify({ name: `patch_${TEST_SENTINEL}`, category: 'done' }),
    });

    const { status, data } = await api(`/task-statuses/${created.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ color: '#abcdef' }),
    });
    expect(status).toBe(200);
    expect(data.color).toBe('#abcdef');
  });
});

describe('Task-Tag Linking API', () => {
  let testTaskId;
  let testTagId;

  it('POST /tasks creates a test task', async () => {
    const { status, data } = await api('/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: `linking_task_${TEST_SENTINEL}`, enterprise: 'rooibos' }),
    });
    expect(status).toBe(201);
    testTaskId = data.id;
  });

  it('POST /tasks/:id/tags links a tag to a task', async () => {
    // Get an existing tag
    const { data: tags } = await api('/tags');
    testTagId = tags[0].id;

    const { status, data } = await api(`/tasks/${testTaskId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tag_id: testTagId }),
    });
    expect(status).toBe(201);
    expect(data.task_id).toBe(testTaskId);
    expect(data.tag_id).toBe(testTagId);
  });

  it('POST /tasks/:id/tags is idempotent (returns 200 on duplicate)', async () => {
    const { status } = await api(`/tasks/${testTaskId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tag_id: testTagId }),
    });
    expect(status).toBe(200);
  });

  it('GET /tasks/:id includes tags array after linking', async () => {
    const { status, data } = await api(`/tasks/${testTaskId}`);
    expect(status).toBe(200);
    expect(Array.isArray(data.tags)).toBe(true);
    expect(data.tags.length).toBeGreaterThanOrEqual(1);
    expect(data.tags.some(t => t.id === testTagId)).toBe(true);
  });

  it('DELETE /tasks/:id/tags/:tagId unlinks and returns 204', async () => {
    const { status } = await api(`/tasks/${testTaskId}/tags/${testTagId}`, {
      method: 'DELETE',
    });
    expect(status).toBe(204);

    // Verify unlinked
    const { data } = await api(`/tasks/${testTaskId}`);
    expect(data.tags.some(t => t.id === testTagId)).toBe(false);
  });
});
