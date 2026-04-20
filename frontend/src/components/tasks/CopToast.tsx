import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface CopToastProps {
  costsLogged: Array<{ id: string; product_name: string; total_cost: number }>;
  taskTitle: string;
  onUndo: () => void;
  onDismiss: () => void;
}

export default function CopToast({ costsLogged, taskTitle, onUndo, onDismiss }: CopToastProps) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setVisible(false);
    }, 5000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleUndo = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onUndo();
    setVisible(false);
  };

  return (
    <AnimatePresence onExitComplete={onDismiss}>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] max-w-sm w-[calc(100%-2rem)]"
        >
          <div
            className="rounded-xl px-4 py-3 shadow-lg border border-amber-200/40 backdrop-blur-md"
            style={{
              background: 'linear-gradient(135deg, rgba(245,240,233,0.92), rgba(255,251,235,0.92))',
            }}
          >
            <p className="text-sm text-stone-800">
              <span className="font-semibold text-amber-700">{costsLogged.length}</span>
              {' '}cost{costsLogged.length !== 1 ? 's' : ''} logged to COP for{' '}
              <span className="font-medium">&lsquo;{taskTitle}&rsquo;</span>
            </p>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-xs text-stone-500">
                R{costsLogged.reduce((s, c) => s + c.total_cost, 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
              </span>
              <button
                type="button"
                onClick={handleUndo}
                className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2 transition-colors"
              >
                Undo
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
