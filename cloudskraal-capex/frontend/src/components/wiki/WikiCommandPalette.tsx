import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, Plus, Network, ArrowRight } from 'lucide-react';
import { searchWiki } from '../../api/wiki';
import { WIKI_CATEGORIES } from '../../types/wiki';

interface PaletteItem {
  id: string;
  type: 'page' | 'action';
  title: string;
  subtitle?: string;
  category?: string;
  slug?: string;
  action?: () => void;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

export default function WikiCommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<PaletteItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const actions = useMemo<PaletteItem[]>(() => [
    { id: 'new-page', type: 'action', title: 'New Page', subtitle: 'Create a new wiki page', icon: Plus, action: () => navigate('/wiki') },
    { id: 'graph', type: 'action', title: 'Knowledge Graph', subtitle: 'View the wiki knowledge graph', icon: Network, action: () => navigate('/wiki/graph') },
    { id: 'wiki-home', type: 'action', title: 'Wiki Home', subtitle: 'Go to wiki home page', icon: FileText, action: () => navigate('/wiki') },
  ], [navigate]);

  // Global Cmd+K listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Search pages on query change
  const fetchPages = useCallback((q: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setLoading(true);
    timerRef.current = setTimeout(() => {
      searchWiki(q)
        .then((pages) => {
          const pageItems: PaletteItem[] = pages.slice(0, 10).map((p) => ({
            id: p.id,
            type: 'page' as const,
            title: p.title,
            subtitle: p.category ? WIKI_CATEGORIES[p.category]?.label : undefined,
            category: p.category ?? undefined,
            slug: p.slug,
            icon: FileText,
          }));

          const filteredActions = q
            ? actions.filter((a) => a.title.toLowerCase().includes(q.toLowerCase()))
            : actions;

          setItems([...filteredActions, ...pageItems]);
          setSelectedIndex(0);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }, 150);
  }, [navigate]);

  useEffect(() => {
    if (open) {
      fetchPages(query);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, open, fetchPages]);

  function executeItem(item: PaletteItem) {
    setOpen(false);
    if (item.type === 'action' && item.action) {
      item.action();
    } else if (item.slug) {
      navigate(`/wiki/${item.slug}`);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items.length > 0) executeItem(items[selectedIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />

      {/* Palette */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden wiki-scale-in">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-200">
          <Search size={18} className="text-stone-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, actions..."
            className="flex-1 text-sm bg-transparent border-none outline-none placeholder:text-stone-400"
          />
          <kbd className="text-[10px] text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded font-mono">esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {loading && items.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-stone-400">Searching...</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-stone-400">No results found</div>
          ) : (
            <div className="py-1">
              {items.map((item, i) => {
                const cat = item.category ? WIKI_CATEGORIES[item.category] : null;
                return (
                  <button
                    key={item.id}
                    onClick={() => executeItem(item)}
                    className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                      i === selectedIndex
                        ? 'bg-emerald-50'
                        : 'hover:bg-stone-50'
                    }`}
                  >
                    <item.icon size={16} className={`flex-shrink-0 ${i === selectedIndex ? 'text-emerald-700' : 'text-stone-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${i === selectedIndex ? 'text-emerald-900 font-medium' : 'text-stone-800'}`}>
                        {item.title}
                      </p>
                      {item.subtitle && (
                        <p className="text-xs text-stone-400 truncate">{item.subtitle}</p>
                      )}
                    </div>
                    {cat && (
                      <span
                        className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded text-white flex-shrink-0"
                        style={{ backgroundColor: cat.color }}
                      >
                        {cat.label}
                      </span>
                    )}
                    {i === selectedIndex && (
                      <ArrowRight size={14} className="text-emerald-600 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-stone-100 flex items-center gap-4 text-[10px] text-stone-400">
          <span><kbd className="bg-stone-100 px-1 py-0.5 rounded font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="bg-stone-100 px-1 py-0.5 rounded font-mono">↵</kbd> open</span>
          <span><kbd className="bg-stone-100 px-1 py-0.5 rounded font-mono">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
