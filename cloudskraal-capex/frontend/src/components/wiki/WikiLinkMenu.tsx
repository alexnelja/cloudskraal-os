import { useState, useEffect, useRef } from 'react';
import { FileText, Plus } from 'lucide-react';
import { searchWiki } from '../../api/wiki';
import { WIKI_CATEGORIES } from '../../types/wiki';
import type { WikiPageSummary } from '../../types/wiki';

interface WikiLinkMenuProps {
  position: { top: number; left: number };
  query: string;
  onSelect: (title: string, exists: boolean) => void;
  onClose: () => void;
}

export default function WikiLinkMenu({ position, query, onSelect, onClose }: WikiLinkMenuProps) {
  const [results, setResults] = useState<WikiPageSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // Search pages
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      searchWiki(query)
        .then((data) => {
          setResults(data.slice(0, 8));
          setSelectedIndex(0);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }, 100);
    return () => clearTimeout(timer);
  }, [query]);

  // Check if query matches an existing page exactly
  const exactMatch = results.some(p => p.title.toLowerCase() === query.toLowerCase());

  // Build the items list: results + "Create new" option if no exact match
  const showCreate = query.trim().length > 0 && !exactMatch;
  const totalItems = results.length + (showCreate ? 1 : 0);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => Math.min(prev + 1, totalItems - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        if (selectedIndex < results.length) {
          onSelect(results[selectedIndex].title, true);
        } else if (showCreate) {
          onSelect(query.trim(), false);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [results, selectedIndex, totalItems, query, onSelect, onClose, showCreate]);

  // Click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Scroll selected into view
  useEffect(() => {
    const el = menuRef.current?.querySelector(`[data-idx="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const top = Math.min(position.top, window.innerHeight - 350);
  const left = Math.min(position.left, window.innerWidth - 320);

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] w-80 max-h-72 overflow-y-auto bg-white rounded-lg shadow-2xl border border-stone-200 py-1 wiki-scale-in"
      style={{ top, left }}
    >
      {loading && results.length === 0 ? (
        <div className="px-3 py-3 text-xs text-stone-400">Searching...</div>
      ) : (
        <>
          {results.map((page, i) => {
            const cat = page.category ? WIKI_CATEGORIES[page.category] : null;
            return (
              <button
                key={page.id}
                data-idx={i}
                onClick={() => onSelect(page.title, true)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors ${
                  i === selectedIndex ? 'bg-emerald-50 text-emerald-900' : 'hover:bg-stone-50 text-stone-700'
                }`}
              >
                <FileText size={14} className="flex-shrink-0 text-stone-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{page.title}</p>
                  {cat && (
                    <p className="text-[10px] text-stone-400">{cat.label}</p>
                  )}
                </div>
              </button>
            );
          })}

          {showCreate && (
            <button
              data-idx={results.length}
              onClick={() => onSelect(query.trim(), false)}
              className={`w-full text-left px-3 py-2 flex items-center gap-2.5 border-t border-stone-100 transition-colors ${
                selectedIndex === results.length ? 'bg-emerald-50 text-emerald-900' : 'hover:bg-stone-50 text-stone-700'
              }`}
            >
              <Plus size={14} className="flex-shrink-0 text-emerald-600" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Create "{query.trim()}"</p>
                <p className="text-[10px] text-stone-400">New page</p>
              </div>
            </button>
          )}

          {results.length === 0 && !showCreate && !loading && (
            <div className="px-3 py-3 text-xs text-stone-400">No pages found</div>
          )}
        </>
      )}
    </div>
  );
}
