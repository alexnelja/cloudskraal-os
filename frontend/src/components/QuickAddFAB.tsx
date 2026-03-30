import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, ClipboardList, CalendarPlus, Wrench, Package, X } from 'lucide-react';

const ACTIONS = [
  { label: 'New Wiki Page', icon: FileText, path: '/wiki?create=true', color: 'text-blue-600' },
  { label: 'New Task', icon: ClipboardList, path: '/calendar/tasks?create=true', color: 'text-emerald-600' },
  { label: 'New Event', icon: CalendarPlus, path: '/calendar?create=true', color: 'text-violet-600' },
  { label: 'Log Maintenance', icon: Wrench, path: '/equipment?create=true', color: 'text-amber-600' },
  { label: 'Record Inventory', icon: Package, path: '/inventory?create=true', color: 'text-orange-600' },
];

export default function QuickAddFAB() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('mousedown', handleClick);
    return () => { window.removeEventListener('keydown', handleKey); window.removeEventListener('mousedown', handleClick); };
  }, [open]);

  const handleAction = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <div ref={containerRef} className="fixed bottom-24 right-4 md:bottom-8 md:right-8 z-50">
      {/* Action buttons */}
      <div className={`flex flex-col-reverse gap-2 mb-3 transition-all duration-200 ${open ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        {ACTIONS.map((action, idx) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              onClick={() => handleAction(action.path)}
              className="flex items-center gap-3 pl-3 pr-4 py-2.5 bg-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 group"
              style={{ transitionDelay: open ? `${idx * 40}ms` : '0ms' }}
            >
              <Icon size={18} className={action.color} />
              <span className="text-sm font-medium text-stone-700 whitespace-nowrap">{action.label}</span>
            </button>
          );
        })}
      </div>

      {/* FAB button */}
      <button
        onClick={() => setOpen(!open)}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ml-auto ${
          open
            ? 'bg-stone-800 hover:bg-stone-700 rotate-45'
            : 'bg-gradient-to-br from-[#005d42] to-[#047857] hover:opacity-90'
        }`}
      >
        {open ? <X size={24} className="text-white -rotate-45" /> : <Plus size={24} className="text-white" />}
      </button>
    </div>
  );
}
