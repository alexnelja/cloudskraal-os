import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const TEST_DB_PATH = path.join(__dirname, '..', '..', 'data', 'test-measurements.db');
process.env.CAPEX_DB_PATH = TEST_DB_PATH;

let schema;
let appModule;
let request;

function loadModules() {
  schema = require('../db/schema');
  appModule = require('../index');
  request = require('supertest');
}

// Let the app's async boot-seed settle before closing the DB, otherwise an
// in-flight seed query hits a closed connection ("database connection is not
// open") and surfaces as an unhandled rejection under full-suite timing.
async function settleReady() {
  if (appModule && appModule.ready) { try { await appModule.ready; } catch (_) { /* ignore */ } }
}

beforeEach(async () => {
  await settleReady();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  if (schema) schema._resetForTest();
  loadModules();
  await settleReady();
});

afterAll(async () => {
  await settleReady();
  if (schema) schema._resetForTest();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

const validBody = {
  name: 'Fence line',
  kind: 'length',
  value: 1234.56,
  unit: 'm',
  formatted: '1.23 km',
  geometry: JSON.stringify({ type: 'LineString', coordinates: [[0, 0], [1, 1]] }),
};

describe('measurements routes', () => {
  it('POST /api/measurements creates a row and returns 201', async () => {
    const res = await request(appModule.app).post('/api/measurements').send(validBody);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Fence line');
    expect(res.body.kind).toBe('length');
  });

  it('GET /api/measurements returns newest first', async () => {
    await request(appModule.app).post('/api/measurements').send({ ...validBody, name: 'First' });
    await new Promise((r) => setTimeout(r, 10));
    await request(appModule.app).post('/api/measurements').send({ ...validBody, name: 'Second' });
    const res = await request(appModule.app).get('/api/measurements');
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe('Second');
    expect(res.body[1].name).toBe('First');
  });

  it('DELETE /api/measurements/:id returns 404 for unknown id', async () => {
    const res = await request(appModule.app).delete('/api/measurements/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('POST rejects missing required fields with 400', async () => {
    const res = await request(appModule.app).post('/api/measurements').send({ name: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('POST rejects invalid kind', async () => {
    const res = await request(appModule.app).post('/api/measurements').send({ ...validBody, kind: 'weight' });
    expect(res.status).toBe(400);
  });
});
