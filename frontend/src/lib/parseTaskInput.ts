import * as chrono from 'chrono-node';
import type { Tag } from '../types/taskManager';

export interface ParseResult {
  title: string;
  due_date: Date | null;
  due_text: string | null;
  priority: 'urgent' | 'high' | 'medium' | 'low' | null;
  priority_text: string | null;
  tag_matches: Array<{ tag: Tag; match_text: string }>;
  field_match: { field: { id: string; name: string }; match_text: string } | null;
}

const PRIORITY_MAP: Record<string, 'urgent' | 'high' | 'medium' | 'low'> = {
  '1': 'urgent',
  '2': 'high',
  '3': 'medium',
  '4': 'low',
};

export function parseTaskInput(
  text: string,
  tags: Tag[],
  fields: Array<{ id: string; name: string }>,
): ParseResult {
  let remaining = text;
  const removals: string[] = [];

  // 1. Extract priority tokens: /\bp[1-4]\b/i
  let priority: ParseResult['priority'] = null;
  let priority_text: string | null = null;
  const priorityMatch = remaining.match(/\bp([1-4])\b/i);
  if (priorityMatch) {
    priority = PRIORITY_MAP[priorityMatch[1]];
    priority_text = priorityMatch[0];
    removals.push(priorityMatch[0]);
    remaining = remaining.replace(priorityMatch[0], ' ');
  }

  // 2. Extract tag tokens: /#(\w[\w-]*)/g — fuzzy match against available tags
  const tag_matches: ParseResult['tag_matches'] = [];
  const tagRegex = /#([\w-]+)/g;
  let tagMatch: RegExpExecArray | null;
  const tagTokensToRemove: string[] = [];

  while ((tagMatch = tagRegex.exec(remaining)) !== null) {
    const hashText = tagMatch[0]; // e.g. "#rooibos"
    const searchTerm = tagMatch[1].toLowerCase(); // e.g. "rooibos"

    // Find matching tag: exact match first, then partial/fuzzy
    const exactMatch = tags.find(
      (t) => t.name.toLowerCase() === searchTerm,
    );
    if (exactMatch) {
      tag_matches.push({ tag: exactMatch, match_text: hashText });
      tagTokensToRemove.push(hashText);
      continue;
    }

    // Partial match: tag name starts with search term or search term is substring
    const partialMatch = tags.find(
      (t) =>
        t.name.toLowerCase().startsWith(searchTerm) ||
        t.name.toLowerCase().includes(searchTerm),
    );
    if (partialMatch) {
      tag_matches.push({ tag: partialMatch, match_text: hashText });
      tagTokensToRemove.push(hashText);
    }
    // If no match, leave the hashtag in the text
  }

  for (const token of tagTokensToRemove) {
    remaining = remaining.replace(token, ' ');
    removals.push(token);
  }

  // 3. Use chrono-node to parse dates from remaining text
  let due_date: Date | null = null;
  let due_text: string | null = null;
  const chronoResults = chrono.parse(remaining);
  if (chronoResults.length > 0) {
    const firstResult = chronoResults[0];
    due_date = firstResult.date();
    due_text = firstResult.text;
    remaining = remaining.replace(firstResult.text, ' ');
    removals.push(firstResult.text);
  }

  // 4. Try to match remaining words against field names (case-insensitive)
  let field_match: ParseResult['field_match'] = null;
  // Sort fields by name length descending so longer names match first
  const sortedFields = [...fields].sort(
    (a, b) => b.name.length - a.name.length,
  );
  for (const field of sortedFields) {
    const idx = remaining.toLowerCase().indexOf(field.name.toLowerCase());
    if (idx !== -1) {
      const matchedText = remaining.slice(idx, idx + field.name.length);
      field_match = { field, match_text: matchedText };
      remaining = remaining.slice(0, idx) + ' ' + remaining.slice(idx + field.name.length);
      break;
    }
  }

  // 5. Clean up the title
  const title = remaining.replace(/\s+/g, ' ').trim();

  return {
    title,
    due_date,
    due_text,
    priority,
    priority_text,
    tag_matches,
    field_match,
  };
}
