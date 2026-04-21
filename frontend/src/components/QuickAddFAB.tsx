import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Plus, FileText, ClipboardText, CalendarPlus, Wrench, Package, X, NotePencil,
  Check,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { createTask } from '../api/calendar';

interface ActionDef {
  label: string;
  icon: Icon;
  path: string;
  tint: string;
  /** If true, opens inline prompt instead of navigating */
  inlineCreate?: boolean;
}

const ACTIONS: ActionDef[] = [
  { label: 'New Wiki Page', icon: FileText, path: '/wiki?create=true', tint: '#2563eb' },
  { label: 'New Task', icon: ClipboardText, path: '/tasks', tint: '#059669', inlineCreate: true },
  { label: 'New Event', icon: CalendarPlus, path: '/calendar?create=true', tint: '#7c3aed' },
  { label: 'Drop map note', icon: NotePencil, path: '/map?armNote=1', tint: '#d97706' },
  { label: 'Log Maintenance', icon: Wrench, path: '/equipment?create=true', tint: '#b45309' },
  { label: 'Record Inventory', icon: Package, path: '/inventory?create=true', tint: '#ea580c' },
];

export default function QuickAddFAB() {
  const [open, setOpen] = useState(false);
  const [inlineMode, setInlineMode] = useState<string | null>(null);
  const [inlineValue, setInlineValue] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open && !inlineMode) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); setInlineMode(null); setInlineValue(''); }
    };
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setInlineMode(null);
        setInlineValue('');
      }
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('mousedown', handleClick);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('mousedown', handleClick);
    };
  }, [open, inlineMode]);

  useEffect(() => {
    if (inlineMode && inputRef.current) inputRef.current.focus();
  }, [inlineMode]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleAction = (action: ActionDef) => {
    if (action.inlineCreate) {
      setOpen(false);
      setInlineMode(action.label);
      setInlineValue('');
    } else {
      setOpen(false);
      navigate(action.path);
    }
  };

  const handleInlineSubmit = useCallback(async () => {
    const title = inlineValue.trim();
    if (!title || saving) return;
    setSaving(true);
    try {
      const newTask = await createTask({
        title,
        description: null,
        enterprise: null,
        field_id: null,
        type: 'manual',
        status: 'pending',
        priority: 'medium',
        due_date: new Date().toISOString().slice(0, 10),
        assigned_to: null,
        depends_on_task_id: null,
        recurrence_rule: null,
        calendar_event_id: null,
        notes: null,
        status_id: null,
        estimated_minutes: null,
        actual_minutes: null,
        blocked_reason: null,
        blocked_until: null,
        sort_order: 0,
        verified_by: null,
        verified_at: null,
      });
      navigator.vibrate?.(15);
      setInlineValue('');
      setInlineMode(null);
      // Navigate to task detail sheet so user can enrich the new task
      navigate(`/tasks?detail=${newTask.id}`);
    } catch {
      setToast('Failed to create task');
    } finally {
      setSaving(false);
    }
  }, [inlineValue, saving, navigate]);

  return (
    <div
      ref={containerRef}
      className="md-inset-bottom-nav fixed right-4 md:right-8 z-50 flex flex-col items-end gap-2"
    >
      {/* Toast notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="md-inset-bottom-toast fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-stone-900 text-white px-4 py-2.5 rounded-full shadow-lg text-sm"
          >
            <Check size={14} weight="bold" className="text-emerald-400" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inline create prompt */}
      <AnimatePresence>
        {inlineMode && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            className="bg-white rounded-2xl shadow-xl border border-stone-200/60 p-4 w-[320px] mb-2"
          >
            <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-stone-500 mb-2">{inlineMode}</p>
            <input
              ref={inputRef}
              type="text"
              value={inlineValue}
              onChange={(e) => setInlineValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleInlineSubmit(); }}
              placeholder="What needs to be done?"
              className="w-full bg-[#f2f2f7] border-0 rounded-xl px-3 py-2.5 text-[15px] text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            />
            <div className="flex items-center justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={() => { setInlineMode(null); setInlineValue(''); }}
                className="px-3 py-1.5 text-[13px] text-stone-500 hover:text-stone-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInlineSubmit}
                disabled={!inlineValue.trim() || saving}
                className="px-4 py-1.5 text-[13px] font-medium text-white rounded-lg transition-colors disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #059669, #047857)' }}
              >
                {saving ? 'Saving...' : 'Add'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="flex flex-col-reverse gap-2 mb-1 items-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {ACTIONS.map((action, idx) => {
              const ActionIcon = action.icon;
              return (
                <motion.button
                  key={action.label}
                  onClick={() => handleAction(action)}
                  initial={{ opacity: 0, x: 20, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 20, scale: 0.9 }}
                  transition={{
                    type: 'spring',
                    stiffness: 420,
                    damping: 26,
                    delay: idx * 0.035,
                  }}
                  whileHover={{ x: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="glass-button flex items-center gap-3 pl-3 pr-4 py-2.5 rounded-full group"
                >
                  <span
                    className="flex items-center justify-center w-7 h-7 rounded-full text-white"
                    style={{
                      background: `linear-gradient(135deg, ${action.tint}, color-mix(in oklab, ${action.tint} 70%, black))`,
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
                    }}
                  >
                    <ActionIcon size={14} weight="bold" />
                  </span>
                  <span className="text-sm font-medium text-stone-800 whitespace-nowrap">
                    {action.label}
                  </span>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => { setOpen(!open); if (inlineMode) { setInlineMode(null); setInlineValue(''); } }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.92 }}
        animate={{ rotate: open ? 45 : 0 }}
        transition={{ type: 'spring', stiffness: 450, damping: 28 }}
        className="relative w-14 h-14 rounded-full flex items-center justify-center overflow-hidden"
        aria-label={open ? 'Close quick add menu' : 'Open quick add menu'}
        style={{
          background: 'var(--glass-bg)',
          border: '1px solid rgba(4,120,87,0.4)',
          boxShadow:
            '0 8px 20px rgba(4,120,87,0.18), inset 0 1px 0 rgba(255,255,255,0.25)',
          backdropFilter: 'var(--glass-blur)',
        }}
      >
        {open ? (
          <X size={22} weight="bold" className="text-emerald-700 relative z-10 -rotate-45" />
        ) : (
          <Plus size={24} weight="bold" className="text-emerald-700 relative z-10" />
        )}
      </motion.button>
    </div>
  );
}
