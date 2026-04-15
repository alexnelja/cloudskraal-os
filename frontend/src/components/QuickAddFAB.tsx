import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Plus, FileText, ClipboardList, CalendarPlus, Wrench, Package, X,
} from 'lucide-react';

interface ActionDef {
  label: string;
  icon: typeof Plus;
  path: string;
  tint: string; // gradient end
}

const ACTIONS: ActionDef[] = [
  { label: 'New Wiki Page', icon: FileText, path: '/wiki?create=true', tint: '#2563eb' },
  { label: 'New Task', icon: ClipboardList, path: '/calendar/tasks?create=true', tint: '#059669' },
  { label: 'New Event', icon: CalendarPlus, path: '/calendar?create=true', tint: '#7c3aed' },
  { label: 'Log Maintenance', icon: Wrench, path: '/equipment?create=true', tint: '#d97706' },
  { label: 'Record Inventory', icon: Package, path: '/inventory?create=true', tint: '#ea580c' },
];

export default function QuickAddFAB() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('mousedown', handleClick);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('mousedown', handleClick);
    };
  }, [open]);

  const handleAction = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <div
      ref={containerRef}
      className="fixed bottom-24 right-4 md:bottom-8 md:right-8 z-50 flex flex-col items-end gap-2"
    >
      <AnimatePresence>
        {open && (
          <motion.div
            className="flex flex-col-reverse gap-2 mb-1 items-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {ACTIONS.map((action, idx) => {
              const Icon = action.icon;
              return (
                <motion.button
                  key={action.label}
                  onClick={() => handleAction(action.path)}
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
                    <Icon size={14} />
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
        onClick={() => setOpen(!open)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.92 }}
        animate={{ rotate: open ? 45 : 0 }}
        transition={{ type: 'spring', stiffness: 450, damping: 28 }}
        className="relative w-14 h-14 rounded-full flex items-center justify-center overflow-hidden"
        aria-label={open ? 'Close quick add menu' : 'Open quick add menu'}
        style={{
          background: open
            ? 'linear-gradient(135deg, #1f2937, #0f172a)'
            : 'linear-gradient(135deg, #047857, #065f46)',
          boxShadow: open
            ? 'inset 0 1px 0 rgba(255,255,255,0.15), 0 14px 34px -10px rgba(15, 23, 42, 0.55)'
            : 'inset 0 1px 0 rgba(255,255,255,0.25), 0 14px 34px -10px rgba(4, 120, 87, 0.55)',
        }}
      >
        {/* specular sheen */}
        <span
          aria-hidden
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.45), transparent 55%)',
          }}
        />
        {open ? (
          <X size={22} className="text-white relative z-10 -rotate-45" />
        ) : (
          <Plus size={24} className="text-white relative z-10" />
        )}
      </motion.button>
    </div>
  );
}
