import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const TEST_DB_PATH = path.join(__dirname, '..', '..', 'data', 'test-fields.db');
process.env.CAPEX_DB_PATH = TEST_DB_PATH;

let schema;
let appModule;

// Load modules after setting env var
function loadModules() {
  schema = require('../db/schema');
  appModule = require('../index');
}

beforeEach(() => {
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  // Reset singleton so next getDb() opens a fresh file
  if (schema) schema._resetForTest();
  loadModules();
});

afterAll(() => {
  if (schema) schema._resetForTest();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

loadModules();
const { app } = appModule;
const request = require('supertest');

describe('POST /api/fields', () => {
  function seedFarm() {
    const { getDb } = require('../db/schema');
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO farms (id, name, code, type, total_ha, lat, lng, region, notes, created_at, updated_at) VALUES ('farm-1', 'Cloudskraal', 'CS', 'owned', 1000, -33, 20, 'WC', NULL, ?, ?)",
    ).run(now, now);
  }

  it('creates a field with valid payload', async () => {
    seedFarm();
    const res = await request(app).post('/api/fields').send({
      farm_id: 'farm-1',
      name: 'Blok 1',
      enterprise: 'rooibos',
      area_ha: 42,
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Blok 1', enterprise: 'rooibos' });
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('created_at');
  });

  it('rejects missing required fields with 400', async () => {
    seedFarm();
    const res = await request(app).post('/api/fields').send({ name: 'x' });
    expect(res.status).toBe(400);
  });

  it('rejects unknown farm_id with 400', async () => {
    const res = await request(app).post('/api/fields').send({
      farm_id: 'nonexistent',
      name: 'Blok 1',
      enterprise: 'rooibos',
      area_ha: 42,
    });
    expect(res.status).toBe(400);
  });

  it('accepts optional geometry + crop_type + planted_year + status + notes', async () => {
    seedFarm();
    const res = await request(app).post('/api/fields').send({
      farm_id: 'farm-1',
      name: 'Blok 2',
      enterprise: 'wine',
      area_ha: 22,
      crop_type: 'Chenin Blanc',
      planted_year: '2019',
      status: 'active',
      geometry: JSON.stringify({ type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,0]]] }),
      notes: 'Sandy loam',
    });
    expect(res.status).toBe(201);
    expect(res.body.geometry).toBeTruthy();
  });
});
