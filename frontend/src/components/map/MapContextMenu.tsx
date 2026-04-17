import { useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { IconProps } from '@phosphor-icons/react';

export interface MenuItem {
  id: string;
  label: string;
  Icon: React.ComponentType<IconProps>;
  tint: 'emerald' | 'amber' | 'rose' | 'stone';
  onClick: () => void;
}

interface MapContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  title?: string;
  items: MenuItem[];
  onDismiss: () => void;
}

const TINT_BG: Record<MenuItem['tint'], string> = {
  emerald: 'linear-gradient(135deg, rgba(209, 250, 229, 0.9), rgba(167, 243, 208, 0.55))',
  amber: 'linear-gradient(135deg, rgba(254, 243, 199, 0.9), rgba(253, 224, 155, 0.55))',
  rose: 'linear-gradient(135deg, rgba(255, 228, 230, 0.9), rgba(253, 186, 191, 0.55))',
  stone: 'linear-gradient(135deg, rgba(231, 229, 228, 0.95), rgba(214, 211, 209, 0.6))',
};
const TINT_FG: Record<MenuItem['tint'], string> = {
  emerald: 'text-emerald-800',
  amber: 'text-amber-800',
  rose: 'text-rose-800',
  stone: 'text-stone-700',
};

export default function MapContextMenu({
  open, x, y, title, items, onDismiss,
}: MapContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusedIndexRef = useRef<number>(-1);

  const focusItem = useCallback((index: number) => {
    const btn = itemRefs.current[index];
    if (btn) {
      btn.focus();
      focusedIndexRef.current = index;
    }
  }, []);

  // Focus first item when menu opens
  useEffect(() => {
    if (!open) {
      focusedIndexRef.current = -1;
      return;
    }
    // Defer so AnimatePresence has rendered the items
    const id = requestAnimationFrame(() => {
      focusItem(0);
    });
    return () => cancelAnimationFrame(id);
  }, [open, focusItem]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss();
        return;
      }

      const count = items.length;
      if (count === 0) return;

      const current = focusedIndexRef.current;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = current < count - 1 ? current + 1 : 0;
        focusItem(next);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = current > 0 ? current - 1 : count - 1;
        focusItem(prev);
      } else if (e.key === 'Home') {
        e.preventDefault();
        focusItem(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        focusItem(count - 1);
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss();
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [open, onDismiss, items.length, focusItem]);

  // Flip so menu never runs off the viewport
  const padX = 180;
  const padY = 200;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
  const left = x + padX > vw ? x - padX : x;
  const top = y + padY > vh ? y - padY : y;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          role="menu"
          initial={{ opacity: 0, scale: 0.9, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 480, damping: 30 }}
          className="glass-panel rounded-xl overflow-hidden fixed z-50 min-w-[200px]"
          style={{ left, top }}
        >
          {title && (
            <div className="px-3 py-2 text-[10px] uppercase tracking-[0.08em] font-semibold text-stone-500 border-b border-stone-200/50 truncate">
              {title}
            </div>
          )}
          <ul>
            {items.map((item, index) => {
              const Icon = item.Icon;
              return (
                <li key={item.id}>
                  <motion.button
                    ref={(el) => { itemRefs.current[index] = el; }}
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    onClick={() => {
                      item.onClick();
                      onDismiss();
                    }}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-stone-800 hover:bg-stone-100/60 transition-colors"
                  >
                    <span
                      className={`flex items-center justify-center w-6 h-6 rounded-md ${TINT_FG[item.tint]}`}
                      style={{
                        background: TINT_BG[item.tint],
                        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.75)',
                      }}
                    >
                      <Icon size={14} weight="duotone" />
                    </span>
                    <span>{item.label}</span>
                  </motion.button>
                </li>
              );
            })}
          </ul>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
