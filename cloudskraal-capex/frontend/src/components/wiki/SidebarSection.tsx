import { useState } from 'react';

interface SidebarSectionProps {
  title: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
  color?: string;
}

export default function SidebarSection({ title, count, children, defaultOpen = false, color }: SidebarSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 py-1.5 text-xs font-semibold uppercase tracking-wide hover:text-stone-700 transition-colors"
        style={{ color: color ?? '#78716c' }}
      >
        <span style={{ display: 'inline-block', width: 12, fontSize: 10, transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>&#9654;</span>
        <span>{title}</span>
        {count !== undefined && <span className="text-stone-400 font-normal">({count})</span>}
      </button>
      {open && <div className="pl-4 pb-2">{children}</div>}
    </div>
  );
}
