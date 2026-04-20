const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { v4: uuidv4 } = require('uuid');

// ── Farm definitions ──────────────────────────────────────────────────────────
const FARMS = [
  { name: 'Cloudskraal', code: 'cloudskraal', type: 'owned', total_ha: 5864, lat: -31.3222, lng: 19.0198, region: 'Northern Cape' },
  { name: 'Glenridge', code: 'glenridge', type: 'owned', total_ha: 324, lat: -31.30, lng: 19.03, region: 'Northern Cape' },
  { name: 'Biekoes', code: 'biekoes', type: 'owned', total_ha: 517, lat: -31.31, lng: 18.95, region: 'Northern Cape' },
  { name: 'Garsland', code: 'garsland', type: 'owned', total_ha: 61, lat: -31.32, lng: 19.01, region: 'Northern Cape' },
  { name: 'Meulsteenvlei', code: 'meulsteenvlei', type: 'owned', total_ha: 207, lat: -31.33, lng: 19.00, region: 'Northern Cape' },
  { name: 'Kromvlei', code: 'kromvlei', type: 'prospect', total_ha: 507, lat: -31.34, lng: 19.02, region: 'Northern Cape' },
];

// ── Map layers ────────────────────────────────────────────────────────────────
const MAP_LAYERS = [
  { name: 'Soils', source_url: 'https://gis.elsenburg.com/arcgis/rest/services/Soils/MapServer', source_type: 'arcgis_tiles', category: 'soils' },
  { name: 'Rainfall', source_url: 'https://gis.elsenburg.com/arcgis/rest/services/Climate/MapServer', source_type: 'arcgis_tiles', category: 'climate' },
  { name: 'Vegetation', source_url: 'https://gis.elsenburg.com/arcgis/rest/services/Vegetation/MapServer', source_type: 'arcgis_tiles', category: 'vegetation' },
  { name: 'Geology', source_url: 'https://gis.elsenburg.com/arcgis/rest/services/Geology/CGS_1M_Geology/MapServer', source_type: 'arcgis_tiles', category: 'geology' },
  { name: 'Elevation', source_url: 'https://gis.elsenburg.com/arcgis/rest/services/Topography/SUDEM80/MapServer', source_type: 'arcgis_tiles', category: 'topography' },
  { name: 'Cadastral Boundaries', source_url: 'https://gis.elsenburg.com/arcgis/rest/services/SG/MapServer', source_type: 'arcgis_tiles', category: 'boundaries' },
  { name: 'Soil pH', source_url: 'https://maps.isric.org/mapserv?map=/map/phh2o.map', source_type: 'wms', category: 'soils' },
  { name: 'Soil Clay Content', source_url: 'https://maps.isric.org/mapserv?map=/map/clay.map', source_type: 'wms', category: 'soils' },
  { name: 'Soil Organic Carbon', source_url: 'https://maps.isric.org/mapserv?map=/map/soc.map', source_type: 'wms', category: 'soils' },
  { name: 'Agricultural Capability (NC)', source_url: 'https://ndagis.nda.agric.za/arcgis/rest/services/Northern_Cape/MapServer', source_type: 'arcgis_tiles', category: 'agriculture' },
];

// ── Area calculation ──────────────────────────────────────────────────────────
function polygonAreaHa(coords) {
  const n = coords.length;
  if (n < 3) return 0;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const latAvg = (coords[i][1] + coords[j][1]) / 2;
    const mx = 111320 * Math.cos(latAvg * Math.PI / 180);
    const my = 110540;
    const x1 = coords[i][0] * mx, y1 = coords[i][1] * my;
    const x2 = coords[j][0] * mx, y2 = coords[j][1] * my;
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2 / 10000;
}

function featureAreaHa(geometry) {
  if (geometry.type === 'Polygon') {
    return polygonAreaHa(geometry.coordinates[0]);
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.reduce((sum, poly) => sum + polygonAreaHa(poly[0]), 0);
  }
  return 0;
}

// ── Classification ────────────────────────────────────────────────────────────
function classifyFeature(name) {
  // Skip sketches
  if (name.startsWith('sketch-')) return null;

  let farm = null;
  let enterprise = 'rooibos';

  // Farm assignment by name pattern
  if (/^B\d/.test(name)) {
    farm = 'biekoes';
  } else if (/^C\d+:/.test(name)) {
    farm = 'cloudskraal';
  } else if (/^CL /.test(name)) {
    // CL-prefixed are farm boundaries — assign to the correct farm
    const clName = name.replace('CL ', '').replace('CL-', '').trim().toLowerCase();
    if (clName.includes('biekoes')) farm = 'biekoes';
    else if (clName.includes('glenridge') || clName.includes('kerk glenridge')) farm = 'glenridge';
    else if (clName.includes('garsland')) farm = 'garsland';
    else if (clName.includes('kromvlei')) farm = 'kromvlei';
    else if (clName.includes('straatklip')) farm = 'cloudskraal';
    else if (clName.includes('winterplaas')) farm = 'cloudskraal';
    else farm = 'cloudskraal';
    enterprise = 'farm_boundary';
  } else if (/^G\d/.test(name) && !/^GA/.test(name)) {
    farm = 'glenridge';
  } else if (/^GA/.test(name)) {
    farm = 'garsland';
  } else if (/^Pierre/.test(name)) {
    farm = 'meulsteenvlei';
  } else if (/^KV|^Kromvlei|^kromvlei|^KromVlei/.test(name)) {
    farm = 'kromvlei';
  } else if (/^Claudskraal 645/.test(name) || /^Pierre Claudskraal/.test(name)) {
    farm = 'meulsteenvlei';
    enterprise = 'farm_boundary';
  } else if (/^Klippe Rivier/.test(name) || /^Klipriver/.test(name)) {
    farm = 'kromvlei';
    enterprise = 'farm_boundary';
  } else if (/Wingerd|wingerd|Wingers/.test(name)) {
    // Biekoes Wingers, Biekhoes Wingerd — wine fields on biekoes
    farm = 'biekoes';
    enterprise = 'wine';
  } else if (name === 'Chenin Blanc') {
    farm = 'glenridge';
    enterprise = 'wine';
  } else if (name === 'Buchu Bo') {
    farm = 'cloudskraal';
    enterprise = 'buchu';
  } else if (name === 'Gaste huise') {
    farm = 'garsland';
    enterprise = 'other';
  } else if (name === 'Garsland Tea Court') {
    farm = 'garsland';
    enterprise = 'other';
  } else if (name === 'Almond Orchard') {
    farm = 'cloudskraal';
    enterprise = 'other';
  } else {
    // Fallback: assign to cloudskraal
    farm = 'cloudskraal';
  }

  // Enterprise overrides based on name content (applied after farm assignment)
  if (enterprise !== 'farm_boundary') {
    if (/Wingerd|wingerd|Wingers|Chenin Blanc/.test(name)) {
      enterprise = 'wine';
    } else if (/Buchu|buchu/.test(name)) {
      enterprise = 'buchu';
    } else if (/Gaste huise/.test(name)) {
      enterprise = 'other';
    } else if (/Tea Court/.test(name)) {
      enterprise = 'other';
    }
  }

  return { farm, enterprise };
}

function extractFieldCode(name) {
  if (name.includes(':')) {
    return name.split(':')[0].trim();
  }
  return null;
}

// ── Excel parsing ─────────────────────────────────────────────────────────────
async function parseOeskatting(filePath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.getWorksheet('clo010');
  if (!ws) return [];

  // xlsx was 0-indexed; ExcelJS is 1-indexed. Original loop started at r=3 (row 4 visually).
  // Preserve identical offsets by shifting: xlsx r=3 → ExcelJS row 4, xlsx c=0 → ExcelJS col 1.
  const rows = [];
  const lastRow = ws.rowCount;
  for (let r = 4; r <= lastRow; r++) {
    const row = ws.getRow(r);
    const getCell = (c) => {
      const raw = row.getCell(c + 1).value;
      if (raw == null) return null;
      if (typeof raw === 'object') {
        if ('result' in raw) return raw.result;
        if ('text' in raw) return raw.text;
        if ('richText' in raw && Array.isArray(raw.richText)) {
          return raw.richText.map(rt => rt.text).join('');
        }
      }
      return raw;
    };

    const farmName = getCell(0);
    if (!farmName) continue;

    const fieldName = getCell(1);
    const fieldCode = getCell(2);
    const planted = getCell(3);
    const hectares = getCell(4);

    const production = [];
    for (let year = 2004; year <= 2028; year++) {
      const baseCol = 5 + (year - 2004) * 2;
      let estimated = getCell(baseCol);
      let actual = (year < 2028) ? getCell(baseCol + 1) : null;

      // Normalize values
      if (typeof estimated === 'string') estimated = (estimated === 'NIE BESKIKBAAR') ? null : estimated;
      if (typeof actual === 'string') actual = (actual === 'NIE BESKIKBAAR' || actual === '') ? null : actual;
      if (estimated === '') estimated = null;
      if (actual === '') actual = null;

      production.push({ year, estimated, actual });
    }

    // Map farm name to code
    const farmMap = {
      'Biekoes': 'biekoes',
      'Cloudskraal': 'cloudskraal',
      'Glenridge': 'glenridge',
      'Garsland': 'garsland',
    };

    rows.push({
      farm: farmMap[farmName] || farmName.toLowerCase(),
      name: fieldName,
      code: fieldCode,
      planted: planted,
      hectares: hectares,
      production,
    });
  }

  return rows;
}

// ── Main seed function ────────────────────────────────────────────────────────
async function seedFarms(db) {
  const count = db.prepare('SELECT COUNT(*) as c FROM farms').get().c;
  if (count > 0) {
    console.log('Farms already seeded, skipping.');
    return;
  }

  console.log('Seeding farms, fields, and production data...');
  const now = new Date().toISOString();

  // ── Read data files ──
  // Use updated geojson if available, fallback to original
  const updatedGeoPath = path.join(__dirname, '..', '..', '..', 'data', 'Cloudskraal  (1).geojson');
  const originalGeoPath = path.join(__dirname, '..', '..', '..', 'data', 'Cloudskraal .geojson');
  const geoPath = fs.existsSync(updatedGeoPath) ? updatedGeoPath : originalGeoPath;
  const xlsxPath = path.join(__dirname, '..', '..', '..', 'data', 'Johan Brand - Rooibos Oeskatting.xlsx');

  const geojson = JSON.parse(fs.readFileSync(geoPath, 'utf8'));
  const oeskatting = await parseOeskatting(xlsxPath);

  // Build a lookup of oeskatting rows by field code
  const oesLookup = {};
  for (const row of oeskatting) {
    if (row.code) {
      oesLookup[row.code] = row;
    }
  }

  // ── Prepared statements ──
  const insertFarm = db.prepare(`
    INSERT INTO farms (id, name, code, type, total_ha, lat, lng, region, geometry, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertField = db.prepare(`
    INSERT INTO fields (id, farm_id, name, code, enterprise, area_ha, planted_year, status, geometry, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertProduction = db.prepare(`
    INSERT INTO field_production (id, field_id, year, estimated_yield_kg, actual_yield_kg)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertLayer = db.prepare(`
    INSERT INTO map_layers (id, name, source_url, source_type, category)
    VALUES (?, ?, ?, ?, ?)
  `);

  const seedAll = db.transaction(() => {
    // ── Collect farm boundary geometries from GeoJSON before inserting farms ──
    const farmBoundaryGeometries = {}; // farmCode → array of geometries
    for (const feature of geojson.features) {
      const name = feature.properties.name;
      const classification = classifyFeature(name);
      if (classification && classification.enterprise === 'farm_boundary') {
        const farmCode = classification.farm;
        if (!farmBoundaryGeometries[farmCode]) farmBoundaryGeometries[farmCode] = [];
        farmBoundaryGeometries[farmCode].push(feature.geometry);
      }
    }

    // Merge multiple boundary geometries into a single MultiPolygon per farm
    function mergeGeometries(geometries) {
      if (geometries.length === 0) return null;
      const allPolygons = [];
      for (const g of geometries) {
        if (g.type === 'Polygon') allPolygons.push(g.coordinates);
        else if (g.type === 'MultiPolygon') allPolygons.push(...g.coordinates);
      }
      if (allPolygons.length === 0) return null;
      if (allPolygons.length === 1) return { type: 'Polygon', coordinates: allPolygons[0] };
      return { type: 'MultiPolygon', coordinates: allPolygons };
    }

    // ── Insert farms (with boundary geometry) ──
    const farmIds = {};
    for (const farm of FARMS) {
      const id = uuidv4();
      farmIds[farm.code] = id;
      const boundaryGeom = farmBoundaryGeometries[farm.code]
        ? JSON.stringify(mergeGeometries(farmBoundaryGeometries[farm.code]))
        : null;
      insertFarm.run(id, farm.name, farm.code, farm.type, farm.total_ha, farm.lat, farm.lng, farm.region, boundaryGeom, now, now);
    }

    // ── Insert fields from GeoJSON ──
    let fieldCount = 0;
    let prodCount = 0;
    let skipped = 0;

    for (const feature of geojson.features) {
      const name = feature.properties.name;
      const classification = classifyFeature(name);

      if (!classification || classification.enterprise === 'farm_boundary') {
        skipped++;
        continue;
      }

      const { farm, enterprise } = classification;
      const farmId = farmIds[farm];
      if (!farmId) {
        console.warn(`  No farm ID for code "${farm}" (feature: ${name})`);
        skipped++;
        continue;
      }

      const fieldCode = extractFieldCode(name);
      let areaHa = featureAreaHa(feature.geometry);
      let plantedYear = null;

      // Match to oeskatting data if we have a field code
      const oesRow = fieldCode ? oesLookup[fieldCode] : null;
      if (oesRow) {
        // Use oeskatting hectares (more accurate)
        if (oesRow.hectares && typeof oesRow.hectares === 'number') {
          areaHa = oesRow.hectares;
        }
        // Use planting year
        if (oesRow.planted && oesRow.planted !== 'Braak') {
          plantedYear = String(oesRow.planted);
        }
      }

      const fieldId = uuidv4();
      const status = (oesRow && oesRow.planted === 'Braak') ? 'fallow' : 'active';
      const geometryJson = JSON.stringify(feature.geometry);

      insertField.run(
        fieldId, farmId, name, fieldCode, enterprise,
        Math.round(areaHa * 100) / 100,
        plantedYear, status, geometryJson, now, now
      );
      fieldCount++;

      // Insert production records for matched rooibos fields
      if (oesRow && enterprise === 'rooibos') {
        for (const prod of oesRow.production) {
          insertProduction.run(
            uuidv4(), fieldId, prod.year,
            prod.estimated !== null && prod.estimated !== undefined ? prod.estimated : null,
            prod.actual !== null && prod.actual !== undefined ? prod.actual : null
          );
          prodCount++;
        }
      }
    }

    // ── Insert map layers ──
    for (const layer of MAP_LAYERS) {
      insertLayer.run(uuidv4(), layer.name, layer.source_url, layer.source_type, layer.category);
    }

    console.log(`  Farms: ${FARMS.length}`);
    console.log(`  Fields: ${fieldCount} (skipped ${skipped})`);
    console.log(`  Production records: ${prodCount}`);
    console.log(`  Map layers: ${MAP_LAYERS.length}`);
  });

  seedAll();
  console.log('Farm seed complete.');
}

module.exports = { seedFarms };
