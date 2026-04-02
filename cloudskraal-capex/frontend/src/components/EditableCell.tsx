import { useState, useRef, useEffect, useCallback } from 'react';
import { Pencil } from 'lucide-react';

interface EditableCellProps {
  value: string | number | null;
  onSave: (newValue: string) => void;
  type?: 'text' | 'number' | 'select' | 'date';
  options?: string[];
  className?: string;
}

export default function EditableCell({ value, onSave, type = 'text', options, className = '' }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value ?? ''));
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if ('select' in inputRef.current && type !== 'select') {
        (inputRef.current as HTMLInputElement).select();
      }
    }
  }, [editing, type]);

  const handleSave = () => {
    setEditing(false);
    if (editValue !== String(value ?? '')) {
      onSave(editValue);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setEditValue(String(value ?? ''));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') handleCancel();
  };

  if (editing) {
    if (type === 'select' && options) {
      return (
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          value={editValue}
          onChange={(e) => { setEditValue(e.target.value); }}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className={`px-1.5 py-0.5 text-sm border-b-2 border-emerald-500 bg-white outline-none rounded-sm transition-all ${className}`}
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type={type === 'date' ? 'date' : type === 'number' ? 'number' : 'text'}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={`px-1.5 py-0.5 text-sm border-b-2 border-emerald-500 bg-white outline-none rounded-sm w-full transition-all ${className}`}
      />
    );
  }

  return (
    <button
      onClick={() => { setEditValue(String(value ?? '')); setEditing(true); }}
      className={`group inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-emerald-50/50 transition-colors text-left ${className}`}
    >
      <span>{value != null && value !== '' ? String(value) : '-'}</span>
      <Pencil size={12} className="text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
    </button>
  );
}

interface StepperCellProps {
  value: number;
  onSave: (newValue: number) => void;
  className?: string;
}

export function StepperCell({ value, onSave, className = '' }: StepperCellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = () => {
    setEditing(false);
    if (editValue !== value) {
      onSave(editValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') { setEditing(false); setEditValue(value); }
  };

  if (editing) {
    return (
      <div className={`inline-flex items-center gap-1 ${className}`}>
        <button
          onClick={() => setEditValue(Math.max(0, editValue - 1))}
          className="w-6 h-6 rounded-full bg-stone-200 text-stone-700 text-sm font-bold hover:bg-stone-300 transition-colors flex items-center justify-center"
        >
          -
        </button>
        <input
          ref={inputRef}
          type="number"
          value={editValue}
          onChange={(e) => setEditValue(Number(e.target.value) || 0)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="w-16 text-center px-1 py-0.5 text-sm border-b-2 border-emerald-500 bg-white outline-none rounded-sm"
        />
        <button
          onClick={() => setEditValue(editValue + 1)}
          className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-sm font-bold hover:bg-emerald-200 transition-colors flex items-center justify-center"
        >
          +
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => { setEditValue(value); setEditing(true); }}
      className={`group inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-emerald-50/50 transition-colors ${className}`}
    >
      <span className="font-bold">{value}</span>
      <Pencil size={12} className="text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
    </button>
  );
}

/* ---- StatusCycle: click to cycle through status options ---- */

interface StatusCycleProps {
  value: string;
  options: string[];
  colors: Record<string, string>;
  onSave: (newValue: string) => void;
  className?: string;
}

export function StatusCycle({ value, options, colors, onSave, className = '' }: StatusCycleProps) {
  const currentIdx = options.indexOf(value);
  const next = options[(currentIdx + 1) % options.length];

  return (
    <button
      onClick={() => onSave(next)}
      className={`cursor-pointer transition-transform hover:scale-105 ${className}`}
      title={`Click to change to ${next}`}
    >
      <span
        className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
        style={{ backgroundColor: colors[value] ?? '#6b7280' }}
      >
        {value}
      </span>
    </button>
  );
}

/* ---- DebouncedEditableCell: auto-saves with 500ms debounce for text, immediate for select ---- */

interface DebouncedEditableCellProps {
  value: string | number | null;
  onSave: (newValue: string) => void;
  type?: 'text' | 'number' | 'select' | 'date';
  options?: string[];
  className?: string;
  debounceMs?: number;
}

export function DebouncedEditableCell({ value, onSave, type = 'text', options, className = '', debounceMs = 500 }: DebouncedEditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value ?? ''));
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if ('select' in inputRef.current && type !== 'select') {
        (inputRef.current as HTMLInputElement).select();
      }
    }
  }, [editing, type]);

  // Reset edit value when value prop changes while not editing
  useEffect(() => {
    if (!editing) setEditValue(String(value ?? ''));
  }, [value, editing]);

  const debouncedSave = useCallback((val: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (val !== String(value ?? '')) onSave(val);
    }, debounceMs);
  }, [value, onSave, debounceMs]);

  const handleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setEditing(false);
    if (editValue !== String(value ?? '')) {
      onSave(editValue);
    }
  }, [editValue, value, onSave]);

  const handleCancel = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setEditing(false);
    setEditValue(String(value ?? ''));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') handleCancel();
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEditValue(val);
    if (type === 'text') debouncedSave(val);
  };

  if (editing) {
    if (type === 'select' && options) {
      return (
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          value={editValue}
          onChange={(e) => {
            setEditValue(e.target.value);
            // Immediate save for selects
            onSave(e.target.value);
            setEditing(false);
          }}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className={`px-1.5 py-0.5 text-sm border-b-2 border-emerald-500 bg-white outline-none rounded-sm transition-all ${className}`}
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type={type === 'date' ? 'date' : type === 'number' ? 'number' : 'text'}
        value={editValue}
        onChange={handleTextChange}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={`px-1.5 py-0.5 text-sm border-b-2 border-emerald-500 bg-white outline-none rounded-sm w-full transition-all ${className}`}
      />
    );
  }

  return (
    <button
      onClick={() => { setEditValue(String(value ?? '')); setEditing(true); }}
      className={`group inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-emerald-50/50 transition-colors text-left ${className}`}
    >
      <span>{value != null && value !== '' ? String(value) : <span className="text-stone-300 italic">empty</span>}</span>
      <Pencil size={12} className="text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
    </button>
  );
}
