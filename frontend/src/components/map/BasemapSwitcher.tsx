import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MapTrifold, Check } from '@phosphor-icons/react';
import { BASEMAPS, getBasemap } from '../../config/basemaps';

interface BasemapSwitcherProps {
  current: string;
  onChange: (id: string) => void;
}

export default function BasemapSwitcher({ current, onChange }: BasemapSwitcherProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentDef = getBasemap(current);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Basemap"
        title={`Basemap: ${currentDef.label}`}
        className="glass-button rounded-full pl-3 pr-4 py-2 flex items-center gap-2 text-[12px] font-medium text-stone-800"
      >
        <MapTrifold size={16} weight="duotone" className="text-amber-700" />
        <span className="whitespace-nowrap">{currentDef.label}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="basemap-popover"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className="absolute top-full right-0 mt-2 glass-panel rounded-2xl p-2 w-60 grid grid-cols-2 gap-2 z-20"
          >
            {BASEMAPS.map((b) => {
              const isCurrent = b.id === current;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => pick(b.id)}
                  aria-current={isCurrent ? 'true' : undefined}
                  title={b.description}
                  className={`relative overflow-hidden rounded-xl border text-left group ${
                    isCurrent
                      ? 'border-amber-500 ring-2 ring-amber-300/60'
                      : 'border-stone-200 hover:border-amber-400'
                  }`}
                >
                  <div
                    className="h-14 w-full"
                    style={{ background: b.thumbBg }}
                    aria-hidden
                  />
                  {isCurrent && (
                    <span className="absolute top-1 right-1 p-0.5 rounded-full bg-amber-500 text-white">
                      <Check size={12} weight="bold" />
                    </span>
                  )}
                  <div className="px-2 py-1.5 bg-white/60">
                    <div className="text-[11px] font-semibold text-stone-800 leading-tight">{b.label}</div>
                  </div>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
