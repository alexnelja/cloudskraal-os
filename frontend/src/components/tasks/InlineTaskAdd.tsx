import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CalendarBlank, Tag as TagIcon, Flag, MapPin, X } from '@phosphor-icons/react';
import { parseTaskInput } from '../../lib/parseTaskInput';
import type { Tag } from '../../types/taskManager';
import type { ParsedTaskInput } from './QuickInput';

interface InlineTaskAddProps {
  tags: Tag[];
  fields: Array<{ id: string; name: string }>;
  onSubmit: (parsed: ParsedTaskInput) => void;
  accentColor?: string;
}

export default function InlineTaskAdd({ tags, fields, onSubmit, accentColor = '#3b82f6' }: InlineTaskAddProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showFieldPicker, setShowFieldPicker] = useState(false);
  const [manualDate, setManualDate] = useState('');
  const [manualTagIds, setManualTagIds] = useState<Set<string>>(new Set());
  const [manualFieldId, setManualFieldId] = useState<string | null>(null);
  const [manualPriority, setManualPriority] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(
    () => parseTaskInput(text, tags, fields),
    [text, tags, fields],
  );

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
    }
  }, [editing]);

  const handleSubmit = useCallback(() => {
    const title = parsed.title.trim();
    if (!title) return;

    const due_date = manualDate || (parsed.due_date ? parsed.due_date.toISOString().slice(0, 10) : null);
    const priority = manualPriority || parsed.priority;
    const tag_ids = manualTagIds.size > 0
      ? Array.from(manualTagIds)
      : parsed.tag_matches.map((tm) => tm.tag.id);
    const field_id = manualFieldId || parsed.field_match?.field.id || null;

    onSubmit({ title, due_date, priority, tag_ids, field_id });

    setText('');
    setManualDate('');
    setManualTagIds(new Set());
    setManualFieldId(null);
    setManualPriority(null);
    // Stay in editing mode for continuous add
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [parsed, manualDate, manualPriority, manualTagIds, manualFieldId, onSubmit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setEditing(false);
      setText('');
      setManualDate('');
      setManualTagIds(new Set());
      setManualFieldId(null);
      setManualPriority(null);
    }
  }, [handleSubmit]);

  const toggleTag = (tagId: string) => {
    setManualTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  };

  const priorities = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ];

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex items-center gap-2 px-5 py-4 w-full text-left transition-colors hover:bg-white/60"
        style={{ color: accentColor }}
      >
        <span className="w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center text-[13px] font-bold" style={{ borderColor: accentColor, color: accentColor }}>
          +
        </span>
        <span className="text-[15px] font-medium">New Task</span>
      </button>
    );
  }

  return (
    <div className="border-t border-stone-200/40">
      {/* Input row */}
      <div className="flex items-center gap-3 px-5 py-3">
        <span className="w-[22px] h-[22px] rounded-full border-2 border-stone-300 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={(e) => {
            // Don't close if clicking on toolbar buttons
            if (e.relatedTarget?.closest('[data-inline-toolbar]')) return;
            if (!text.trim()) {
              setEditing(false);
            }
          }}
          placeholder="Task title... (try: Spray Block 5A tomorrow p1 #rooibos)"
          className="flex-1 bg-transparent text-[15px] text-stone-900 placeholder-stone-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setText('');
          }}
          className="text-stone-400 hover:text-stone-600 p-1"
        >
          <X size={16} />
        </button>
      </div>

      {/* Quick toolbar */}
      <div className="flex items-center gap-1 px-5 pb-3" data-inline-toolbar>
        {/* Date picker toggle */}
        <button
          type="button"
          onClick={() => { setShowDatePicker(!showDatePicker); setShowTagPicker(false); setShowFieldPicker(false); }}
          className={`p-2 rounded-lg transition-colors ${
            showDatePicker || manualDate ? 'bg-blue-50 text-blue-600' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-100'
          }`}
        >
          <CalendarBlank size={18} />
        </button>

        {/* Tag picker toggle */}
        <button
          type="button"
          onClick={() => { setShowTagPicker(!showTagPicker); setShowDatePicker(false); setShowFieldPicker(false); }}
          className={`p-2 rounded-lg transition-colors ${
            showTagPicker || manualTagIds.size > 0 ? 'bg-blue-50 text-blue-600' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-100'
          }`}
        >
          <TagIcon size={18} />
        </button>

        {/* Priority toggle */}
        <button
          type="button"
          onClick={() => {
            const cycle = [null, 'low', 'medium', 'high', 'urgent'];
            const idx = cycle.indexOf(manualPriority);
            setManualPriority(cycle[(idx + 1) % cycle.length]);
          }}
          className={`p-2 rounded-lg transition-colors ${
            manualPriority ? 'bg-amber-50 text-amber-600' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-100'
          }`}
        >
          <Flag size={18} weight={manualPriority ? 'fill' : 'regular'} />
        </button>

        {/* Field picker toggle */}
        <button
          type="button"
          onClick={() => { setShowFieldPicker(!showFieldPicker); setShowDatePicker(false); setShowTagPicker(false); }}
          className={`p-2 rounded-lg transition-colors ${
            showFieldPicker || manualFieldId ? 'bg-green-50 text-green-600' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-100'
          }`}
        >
          <MapPin size={18} />
        </button>

        <div className="flex-1" />

        {/* Active selections display */}
        {manualPriority && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
            {manualPriority}
          </span>
        )}
        {manualDate && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
            {manualDate}
          </span>
        )}
      </div>

      {/* Date picker popover */}
      <AnimatePresence>
        {showDatePicker && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden px-5 pb-3"
            data-inline-toolbar
          >
            <input
              type="date"
              value={manualDate}
              onChange={(e) => { setManualDate(e.target.value); setShowDatePicker(false); }}
              className="bg-white border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-900 focus:outline-none focus:border-blue-400"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tag picker popover */}
      <AnimatePresence>
        {showTagPicker && tags.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden px-5 pb-3"
            data-inline-toolbar
          >
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => {
                const isSelected = manualTagIds.has(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`px-2.5 py-1 rounded-full text-[12px] font-medium transition-colors ${
                      isSelected ? 'text-white' : 'text-stone-600'
                    }`}
                    style={
                      isSelected
                        ? { backgroundColor: tag.color }
                        : { backgroundColor: tag.color + '18', color: tag.color }
                    }
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Field picker popover */}
      <AnimatePresence>
        {showFieldPicker && fields.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden px-5 pb-3 max-h-40 overflow-y-auto"
            data-inline-toolbar
          >
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => { setManualFieldId(null); setShowFieldPicker(false); }}
                className="text-left px-3 py-1.5 rounded-lg text-[13px] text-stone-400 hover:bg-stone-50"
              >
                (no field)
              </button>
              {fields.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => { setManualFieldId(f.id); setShowFieldPicker(false); }}
                  className={`text-left px-3 py-1.5 rounded-lg text-[13px] transition-colors ${
                    manualFieldId === f.id ? 'bg-blue-50 text-blue-700' : 'text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
