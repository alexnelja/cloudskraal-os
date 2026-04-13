import { useState, useEffect, useCallback } from 'react';
import { List } from 'lucide-react';
import type { WikiHeading } from './WikiRenderer';

interface WikiTableOfContentsProps {
  headings: WikiHeading[];
}

export default function WikiTableOfContents({ headings }: WikiTableOfContentsProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 }
    );

    for (const heading of headings) {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings]);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
    }
  }, []);

  if (headings.length < 2) return null;

  return (
    <div className="mb-5">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-1.5 text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2 hover:text-stone-700 transition-colors w-full"
      >
        <List size={12} />
        <span>Contents</span>
        <span className="text-stone-400 font-normal">({headings.length})</span>
        <span className="ml-auto text-[10px] text-stone-400">{collapsed ? '+' : '\u2212'}</span>
      </button>
      {!collapsed && (
        <nav className="space-y-0.5">
          {headings.map((heading) => (
            <button
              key={heading.id}
              onClick={() => scrollTo(heading.id)}
              className={`block w-full text-left text-sm truncate transition-colors rounded px-2 py-0.5 ${
                activeId === heading.id
                  ? 'text-emerald-700 bg-emerald-50 font-medium'
                  : 'text-stone-600 hover:text-stone-800 hover:bg-stone-50'
              }`}
              style={{ paddingLeft: `${(heading.level - 1) * 12 + 8}px` }}
            >
              {heading.text}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
