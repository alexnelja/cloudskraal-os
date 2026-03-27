import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { searchWiki } from '../../api/wiki';
import { WIKI_CATEGORIES } from '../../types/wiki';
import type { WikiPageSummary } from '../../types/wiki';

interface WikiSearchProps {
  onSelect: (slug: string) => void;
}

export default function WikiSearch({ onSelect }: WikiSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WikiPageSummary[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    timerRef.current = setTimeout(() => {
      searchWiki(query.trim())
        .then((data) => {
          setResults(data.slice(0, 8));
          setOpen(true);
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  function handleSelect(slug: string) {
    setOpen(false);
    setQuery('');
    onSelect(slug);
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          placeholder="Search wiki..."
          className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-lg text-sm bg-white text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-stone-300 border-t-emerald-600 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          {results.map((page) => {
            const cat = page.category ? WIKI_CATEGORIES[page.category] : null;
            return (
              <button
                key={page.id}
                onClick={() => handleSelect(page.slug)}
                className="w-full text-left px-3 py-2.5 hover:bg-stone-50 flex items-center gap-2 border-b border-stone-100 last:border-b-0 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-800 truncate">{page.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {cat && (
                      <span
                        className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                        style={{ backgroundColor: cat.color }}
                      >
                        {cat.label}
                      </span>
                    )}
                    {page.enterprise && (
                      <span className="text-[10px] text-stone-500 capitalize">{page.enterprise}</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {open && query.trim() && results.length === 0 && !loading && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg z-50 p-3">
          <p className="text-sm text-stone-400">No pages found.</p>
        </div>
      )}
    </div>
  );
}
