import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ArrowRight, X } from '@phosphor-icons/react';
import { parseTaskInput } from '../../lib/parseTaskInput';
import type { Tag } from '../../types/taskManager';
import { PRIORITY_COLORS } from '../../types/calendar';

export interface ParsedTaskInput {
  title: string;
  due_date: string | null;
  priority: string | null;
  tag_ids: string[];
  field_id: string | null;
}

interface QuickInputProps {
  tags: Tag[];
  fields: Array<{ id: string; name: string }>;
  onSubmit: (parsed: ParsedTaskInput) => void;
}

export default function QuickInput({ tags, fields, onSubmit }: QuickInputProps) {
  const [text, setText] = useState('');
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const [removedTokens, setRemovedTokens] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const parsed = useMemo(
    () => parseTaskInput(text, tags, fields),
    [text, tags, fields],
  );

  // Filter out removed tokens from parsed results
  const activePriority = removedTokens.has('priority') ? null : parsed.priority;
  const activeDueDate = removedTokens.has('date') ? null : parsed.due_date;
  const activeDueText = removedTokens.has('date') ? null : parsed.due_text;
  const activeTagMatches = parsed.tag_matches.filter(
    (tm) => !removedTokens.has(`tag:${tm.tag.id}`),
  );
  const activeFieldMatch = removedTokens.has('field') ? null : parsed.field_match;

  // Tag autocomplete logic
  const hashMatch = useMemo(() => {
    const match = text.match(/#([\w-]*)$/);
    return match ? match[1] : null;
  }, [text]);

  const filteredTags = useMemo(() => {
    if (hashMatch === null) return [];
    const search = hashMatch.toLowerCase();
    return tags.filter(
      (t) =>
        t.name.toLowerCase().includes(search) &&
        !activeTagMatches.some((tm) => tm.tag.id === t.id),
    );
  }, [hashMatch, tags, activeTagMatches]);

  useEffect(() => {
    if (hashMatch !== null && filteredTags.length > 0) {
      setAutocompleteOpen(true);
      setAutocompleteIndex(0);
    } else {
      setAutocompleteOpen(false);
    }
  }, [hashMatch, filteredTags.length]);

  const selectTag = useCallback(
    (tag: Tag) => {
      // Replace the partial #text with full #tagname
      const newText = text.replace(/#[\w-]*$/, `#${tag.name} `);
      setText(newText);
      setAutocompleteOpen(false);
      inputRef.current?.focus();
    },
    [text],
  );

  const formatDueDate = (date: Date, dueText: string | null): string => {
    if (dueText) {
      // Capitalize first letter
      return dueText.charAt(0).toUpperCase() + dueText.slice(1);
    }
    return date.toLocaleDateString();
  };

  const handleSubmit = useCallback(() => {
    if (!parsed.title.trim() && !activePriority && !activeDueDate && activeTagMatches.length === 0) {
      return;
    }

    const due_date = activeDueDate
      ? activeDueDate.toISOString().slice(0, 10)
      : null;

    onSubmit({
      title: parsed.title.trim(),
      due_date,
      priority: activePriority,
      tag_ids: activeTagMatches.map((tm) => tm.tag.id),
      field_id: activeFieldMatch?.field.id ?? null,
    });

    setText('');
    setRemovedTokens(new Set());
  }, [parsed, activePriority, activeDueDate, activeTagMatches, activeFieldMatch, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (autocompleteOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setAutocompleteIndex((prev) =>
            prev < filteredTags.length - 1 ? prev + 1 : 0,
          );
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setAutocompleteIndex((prev) =>
            prev > 0 ? prev - 1 : filteredTags.length - 1,
          );
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          if (filteredTags[autocompleteIndex]) {
            selectTag(filteredTags[autocompleteIndex]);
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setAutocompleteOpen(false);
          return;
        }
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    },
    [autocompleteOpen, filteredTags, autocompleteIndex, selectTag, handleSubmit],
  );

  const removePill = (type: string) => {
    setRemovedTokens((prev) => new Set([...prev, type]));
  };

  const hasPills =
    activePriority || activeDueDate || activeTagMatches.length > 0 || activeFieldMatch;

  return (
    <div className="relative px-4 pt-3 pb-1">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setRemovedTokens(new Set());
          }}
          onKeyDown={handleKeyDown}
          placeholder='Add a task... (try: Spray Block 5A tomorrow p1 #rooibos)'
          className="w-full bg-white/80 backdrop-blur-sm border border-stone-200/60 rounded-xl px-4 py-3 pr-12 text-stone-900 placeholder-stone-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400/30 shadow-sm text-sm"
        />
        <button
          type="button"
          onClick={handleSubmit}
          className="absolute right-2 w-8 h-8 rounded-full flex items-center justify-center text-white transition-colors"
          style={{
            background: 'linear-gradient(135deg, #059669, #047857)',
          }}
          aria-label="Submit task"
        >
          <ArrowRight weight="bold" size={16} />
        </button>
      </div>

      {/* Tag autocomplete dropdown */}
      {autocompleteOpen && filteredTags.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute left-4 right-4 mt-1 bg-white shadow-lg rounded-lg border border-stone-200 max-h-48 overflow-y-auto z-50"
        >
          {filteredTags.map((tag, idx) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => selectTag(tag)}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                idx === autocompleteIndex
                  ? 'bg-emerald-50 text-stone-900'
                  : 'text-stone-700 hover:bg-stone-50'
              }`}
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: tag.color }}
              />
              <span>{tag.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Parsed pills */}
      {hasPills && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {activeDueDate && (
            <Pill
              color="bg-blue-100 text-blue-700"
              onRemove={() => removePill('date')}
            >
              {formatDueDate(activeDueDate, activeDueText)}
            </Pill>
          )}

          {activePriority && (
            <Pill
              color="bg-stone-100 text-stone-700"
              onRemove={() => removePill('priority')}
            >
              <span
                className="w-2 h-2 rounded-full inline-block mr-1"
                style={{ backgroundColor: PRIORITY_COLORS[activePriority] }}
              />
              {activePriority.charAt(0).toUpperCase() + activePriority.slice(1)}
            </Pill>
          )}

          {activeTagMatches.map((tm) => (
            <Pill
              key={tm.tag.id}
              color="text-white"
              style={{ backgroundColor: tm.tag.color }}
              onRemove={() => removePill(`tag:${tm.tag.id}`)}
            >
              {tm.tag.name}
            </Pill>
          ))}

          {activeFieldMatch && (
            <Pill
              color="bg-stone-200 text-stone-700"
              onRemove={() => removePill('field')}
            >
              {activeFieldMatch.field.name}
            </Pill>
          )}
        </div>
      )}
    </div>
  );
}

function Pill({
  children,
  color,
  style,
  onRemove,
}: {
  children: React.ReactNode;
  color: string;
  style?: React.CSSProperties;
  onRemove: () => void;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}
      style={style}
    >
      {children}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Remove"
      >
        <X size={10} weight="bold" />
      </button>
    </span>
  );
}
