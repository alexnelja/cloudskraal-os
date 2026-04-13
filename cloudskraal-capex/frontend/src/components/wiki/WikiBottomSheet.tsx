import { useState, useRef, useCallback } from 'react';
import { ChevronUp, X } from 'lucide-react';

interface WikiBottomSheetProps {
  children: React.ReactNode;
  title?: string;
}

export default function WikiBottomSheet({ children, title = 'Page Info' }: WikiBottomSheetProps) {
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState(280);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const handleDragStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragRef.current = { startY: clientY, startHeight: height };
  }, [height]);

  const handleDrag = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!dragRef.current) return;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const delta = dragRef.current.startY - clientY;
    const newHeight = Math.max(100, Math.min(window.innerHeight * 0.8, dragRef.current.startHeight + delta));
    setHeight(newHeight);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (!dragRef.current) return;
    // Snap: if dragged below 150px, close
    if (height < 150) {
      setOpen(false);
      setHeight(280);
    }
    dragRef.current = null;
  }, [height]);

  return (
    <div className="md:hidden">
      {/* Toggle button — fixed at bottom */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 z-40 bg-white shadow-lg border border-stone-200 rounded-full px-3 py-2 flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
        >
          <ChevronUp size={14} />
          {title}
        </button>
      )}

      {/* Bottom sheet */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setOpen(false)} />

          {/* Sheet */}
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl flex flex-col"
            style={{ height, transition: dragRef.current ? 'none' : 'height 0.2s ease' }}
          >
            {/* Drag handle */}
            <div
              className="flex-shrink-0 flex items-center justify-center py-2 cursor-grab active:cursor-grabbing"
              onTouchStart={handleDragStart}
              onTouchMove={handleDrag}
              onTouchEnd={handleDragEnd}
              onMouseDown={handleDragStart}
              onMouseMove={handleDrag}
              onMouseUp={handleDragEnd}
            >
              <div className="w-8 h-1 bg-stone-300 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex-shrink-0 px-4 pb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">{title}</span>
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-600 rounded"
              >
                <X size={14} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {children}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
