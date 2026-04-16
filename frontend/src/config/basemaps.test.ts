import { describe, expect, it } from 'vitest';
import { BASEMAPS, DEFAULT_BASEMAP_ID, getBasemap } from './basemaps';

describe('basemap registry', () => {
  it('has no duplicate ids', () => {
    const ids = BASEMAPS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry has non-empty attribution on primary', () => {
    for (const b of BASEMAPS) {
      expect(b.primary.attribution.trim().length).toBeGreaterThan(0);
    }
  });

  it('every entry has a valid sourceType on primary', () => {
    const valid = new Set(['xyz', 'wmts', 'imageserver']);
    for (const b of BASEMAPS) {
      expect(valid.has(b.primary.sourceType)).toBe(true);
    }
  });

  it('every WMTS url contains {z}, {x}, {y} placeholders', () => {
    for (const b of BASEMAPS) {
      if (b.primary.sourceType !== 'wmts') continue;
      expect(b.primary.url).toContain('{z}');
      expect(b.primary.url).toContain('{x}');
      expect(b.primary.url).toContain('{y}');
    }
  });

  it('no url contains unresolved < > placeholder markers', () => {
    for (const b of BASEMAPS) {
      expect(b.primary.url).not.toMatch(/[<>]/);
      if (b.overlay) expect(b.overlay.url).not.toMatch(/[<>]/);
    }
  });

  it('getBasemap falls back to default when id is unknown', () => {
    const fallback = getBasemap('not-a-real-id');
    expect(fallback.id).toBe(DEFAULT_BASEMAP_ID);
  });

  it('includes ngi-aerial-wc-2021 as a WC WMTS basemap', () => {
    const bm = BASEMAPS.find((b) => b.id === 'ngi-aerial-wc-2021');
    expect(bm).toBeDefined();
    expect(bm!.primary.sourceType).toBe('wmts');
    expect(bm!.coverage).toBe('WC');
  });

  it('includes ngi-aerial-50cm as an SA WMTS basemap', () => {
    const bm = BASEMAPS.find((b) => b.id === 'ngi-aerial-50cm');
    expect(bm).toBeDefined();
    expect(bm!.primary.sourceType).toBe('wmts');
    expect(bm!.coverage).toBe('SA');
  });

  it('includes ngi-topo-50k as an SA WMTS basemap', () => {
    const bm = BASEMAPS.find((b) => b.id === 'ngi-topo-50k');
    expect(bm).toBeDefined();
    expect(bm!.primary.sourceType).toBe('wmts');
    expect(bm!.coverage).toBe('SA');
  });

  it('includes esri-hillshade-dark as an XYZ basemap with Global coverage', () => {
    const bm = BASEMAPS.find((b) => b.id === 'esri-hillshade-dark');
    expect(bm).toBeDefined();
    expect(bm!.primary.sourceType).toBe('xyz');
    expect(bm!.coverage).toBe('Global');
  });
});
