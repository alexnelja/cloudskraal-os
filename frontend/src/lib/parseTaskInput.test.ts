import { describe, it, expect } from 'vitest';
import { parseTaskInput } from './parseTaskInput';
import type { Tag } from '../types/taskManager';

const makeTags = (...names: string[]): Tag[] =>
  names.map((name, i) => ({
    id: `tag-${i}`,
    farm_id: 'farm-1',
    name,
    color: '#aaa',
    group: 'custom' as const,
    sort_order: i,
    created_at: '2026-01-01',
  }));

const fields = [
  { id: 'f1', name: 'Block 5A' },
  { id: 'f2', name: 'Paddock North' },
];

describe('parseTaskInput', () => {
  it('parses plain text as title only', () => {
    const result = parseTaskInput('Fix the fence', [], []);
    expect(result.title).toBe('Fix the fence');
    expect(result.due_date).toBeNull();
    expect(result.priority).toBeNull();
    expect(result.tag_matches).toHaveLength(0);
    expect(result.field_match).toBeNull();
  });

  it('detects "tomorrow" as due date via chrono-node', () => {
    const result = parseTaskInput('Spray weeds tomorrow', [], []);
    expect(result.due_date).not.toBeNull();
    expect(result.due_text).toBeTruthy();
    // The title should have the date text removed
    expect(result.title).toBe('Spray weeds');
  });

  it('detects "p1" as urgent priority', () => {
    const result = parseTaskInput('Fix pump p1', [], []);
    expect(result.priority).toBe('urgent');
    expect(result.priority_text).toBe('p1');
    expect(result.title).toBe('Fix pump');
  });

  it('detects "p2" as high priority', () => {
    const result = parseTaskInput('Order parts p2', [], []);
    expect(result.priority).toBe('high');
  });

  it('detects "p3" as medium priority', () => {
    const result = parseTaskInput('Check stock p3', [], []);
    expect(result.priority).toBe('medium');
  });

  it('detects "p4" as low priority', () => {
    const result = parseTaskInput('Tidy shed p4', [], []);
    expect(result.priority).toBe('low');
  });

  it('detects #rooibos as tag match', () => {
    const tags = makeTags('rooibos', 'livestock', 'crop-ops');
    const result = parseTaskInput('Spray fields #rooibos', tags, []);
    expect(result.tag_matches).toHaveLength(1);
    expect(result.tag_matches[0].tag.name).toBe('rooibos');
    expect(result.tag_matches[0].match_text).toBe('#rooibos');
    expect(result.title).toBe('Spray fields');
  });

  it('fuzzy matches partial tag names', () => {
    const tags = makeTags('rooibos', 'livestock');
    const result = parseTaskInput('Do work #rooi', tags, []);
    expect(result.tag_matches).toHaveLength(1);
    expect(result.tag_matches[0].tag.name).toBe('rooibos');
  });

  it('detects field name in text', () => {
    const result = parseTaskInput('Spray Block 5A now', [], fields);
    expect(result.field_match).not.toBeNull();
    expect(result.field_match!.field.name).toBe('Block 5A');
  });

  it('removes parsed tokens from title', () => {
    const tags = makeTags('rooibos');
    const result = parseTaskInput('Spray weeds tomorrow p1 #rooibos', tags, []);
    expect(result.title).toBe('Spray weeds');
    expect(result.priority).toBe('urgent');
    expect(result.tag_matches).toHaveLength(1);
    expect(result.due_date).not.toBeNull();
  });

  it('handles multiple tokens: "Spray Block 5A tomorrow p1 #rooibos #crop-ops"', () => {
    const tags = makeTags('rooibos', 'crop-ops', 'livestock');
    const result = parseTaskInput(
      'Spray Block 5A tomorrow p1 #rooibos #crop-ops',
      tags,
      fields,
    );
    expect(result.title.trim()).toBe('Spray');
    expect(result.priority).toBe('urgent');
    expect(result.tag_matches).toHaveLength(2);
    expect(result.due_date).not.toBeNull();
    expect(result.field_match).not.toBeNull();
    expect(result.field_match!.field.name).toBe('Block 5A');
  });

  it('returns empty array for unmatched #hashtags', () => {
    const tags = makeTags('rooibos');
    const result = parseTaskInput('Do stuff #unknown', tags, []);
    expect(result.tag_matches).toHaveLength(0);
    // Unmatched hashtag stays in title
    expect(result.title).toContain('#unknown');
  });

  it('is case-insensitive for priority', () => {
    const result = parseTaskInput('Fix pump P2', [], []);
    expect(result.priority).toBe('high');
  });

  it('is case-insensitive for tag matching', () => {
    const tags = makeTags('Rooibos');
    const result = parseTaskInput('Spray #rooibos', tags, []);
    expect(result.tag_matches).toHaveLength(1);
  });
});
