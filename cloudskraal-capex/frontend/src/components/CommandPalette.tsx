import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getWikiPages } from '../api/wiki';
import { getFields } from '../api/farms';
import { getEquipment } from '../api/equipment';
import { getTasks } from '../api/calendar';
import type { WikiPageSummary } from '../types/wiki';
import type { Field } from '../types/farm';
import type { Equipment } from '../types/phase2';
import type { Task } from '../types/calendar';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface PaletteItem {
  id: string;
  category: string;
  icon: string;
  title: string;
  subtitle?: string;
  meta?: string;
  route: string;
}

const NAV_ITEMS: PaletteItem[] = [
  { id: 'nav-dashboard',   category: 'Navigation', icon: '🏠', title: 'Dashboard',  route: '/' },
  { id: 'nav-map',         category: 'Navigation', icon: '🗺️', title: 'Farm Map',   route: '/map' },
  { id: 'nav-calendar',    category: 'Navigation', icon: '📅', title: 'Calendar',   route: '/calendar' },
  { id: 'nav-wiki',        category: 'Navigation', icon: '📖', title: 'Wiki',        route: '/wiki' },
  { id: 'nav-equipment',   category: 'Navigation', icon: '🔧', title: 'Equipment',  route: '/equipment' },
  { id: 'nav-livestock',   category: 'Navigation', icon: '🐑', title: 'Livestock',  route: '/livestock' },
  { id: 'nav-production',  category: 'Navigation', icon: '🌿', title: 'Production', route: '/production' },
  { id: 'nav-employees',   category: 'Navigation', icon: '👥', title: 'Employees',  route: '/employees' },
  { id: 'nav-inventory',   category: 'Navigation', icon: '📦', title: 'Inventory',  route: '/inventory' },
  { id: 'nav-financials',  category: 'Navigation', icon: '💰', title: 'Financials', route: '/financials' },
  { id: 'nav-capex',       category: 'Navigation', icon: '🏗️', title: 'CapEx',      route: '/projects' },
];

// Session-level cache
let cachedWiki: WikiPageSummary[] | null = null;
let cachedFields: Field[] | null = null;
let cachedEquipment: Equipment[] | null = null;
let cachedTasks: Task[] | null = null;

function fuzzyMatch(text: string, query: string): boolean {
  if (!query) return true;
  return text.toLowerCase().includes(query.toLowerCase());
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [wiki, setWiki] = useState<WikiPageSummary[]>(cachedWiki ?? []);
  const [fields, setFields] = useState<Field[]>(cachedFields ?? []);
  const [equipment, setEquipment] = useState<Equipment[]>(cachedEquipment ?? []);
  const [tasks, setTasks] = useState<Task[]>(cachedTasks ?? []);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Fetch data once per session when palette first opens
  useEffect(() => {
    if (!open) return;

    const fetches: Promise<void>[] = [];

    if (cachedWiki === null) {
      fetches.push(
        getWikiPages().then((data) => {
          cachedWiki = data;
          setWiki(data);
        }).catch(() => {/* ignore */})
      );
    }

    if (cachedFields === null) {
      fetches.push(
        getFields().then((data) => {
          cachedFields = data;
          setFields(data);
        }).catch(() => {/* ignore */})
      );
    }

    if (cachedEquipment === null) {
      fetches.push(
        getEquipment().then((data) => {
          cachedEquipment = data;
          setEquipment(data);
        }).catch(() => {/* ignore */})
      );
    }

    if (cachedTasks === null) {
      fetches.push(
        getTasks().then((data) => {
          cachedTasks = data;
          setTasks(data);
        }).catch(() => {/* ignore */})
      );
    }
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  // Build filtered items
  const filteredItems = useCallback((): PaletteItem[] => {
    const q = query.trim();

    const navItems = NAV_ITEMS.filter((item) =>
      !q || fuzzyMatch(item.title, q)
    );

    const wikiItems: PaletteItem[] = wiki
      .filter((w) => !q || fuzzyMatch(w.title, q) || fuzzyMatch(w.category ?? '', q))
      .slice(0, q ? 4 : wiki.length)
      .map((w) => ({
        id: `wiki-${w.id}`,
        category: 'Wiki Pages',
        icon: '📖',
        title: w.title,
        subtitle: w.category ?? undefined,
        meta: w.enterprise ?? undefined,
        route: `/wiki/${w.slug}`,
      }));

    const fieldItems: PaletteItem[] = fields
      .filter((f) => !q || fuzzyMatch(f.name, q) || fuzzyMatch(f.farm_name ?? '', q) || fuzzyMatch(f.enterprise, q))
      .slice(0, q ? 4 : fields.length)
      .map((f) => ({
        id: `field-${f.id}`,
        category: 'Fields',
        icon: '🗺️',
        title: f.name,
        subtitle: f.farm_name ?? f.farm_id,
        meta: f.area_ha ? `${f.area_ha} ha` : undefined,
        route: `/map/${f.id}`,
      }));

    const equipmentItems: PaletteItem[] = equipment
      .filter((e) => !q || fuzzyMatch(e.name, q) || fuzzyMatch(e.type, q) || fuzzyMatch(e.make ?? '', q))
      .slice(0, q ? 4 : equipment.length)
      .map((e) => ({
        id: `equip-${e.id}`,
        category: 'Equipment',
        icon: '🔧',
        title: e.name,
        subtitle: e.type,
        meta: e.status,
        route: '/equipment',
      }));

    const taskItems: PaletteItem[] = tasks
      .filter((t) => !q || fuzzyMatch(t.title, q) || fuzzyMatch(t.status, q) || fuzzyMatch(t.enterprise ?? '', q))
      .slice(0, q ? 4 : tasks.length)
      .map((t) => ({
        id: `task-${t.id}`,
        category: 'Tasks',
        icon: '📋',
        title: t.title,
        subtitle: t.enterprise ?? undefined,
        meta: t.status,
        route: '/calendar/tasks',
      }));

    return [...navItems, ...wikiItems, ...fieldItems, ...equipmentItems, ...taskItems];
  }, [query, wiki, fields, equipment, tasks]);

  const items = filteredItems();

  // Reset selected index when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.querySelector('[data-selected="true"]');
    selectedEl?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  function handleSelect(item: PaletteItem) {
    navigate(item.route);
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = items[selectedIndex];
      if (item) handleSelect(item);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }

  if (!open) return null;

  // Group items by category for rendering
  const grouped: Record<string, PaletteItem[]> = {};
  for (const item of items) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }

  // Build flat index map for selected highlighting
  let flatIndex = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]"
      style={{ backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.4)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-xl mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100">
          <svg
            className="w-5 h-5 text-stone-400 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search Cloudskraal OS…"
            className="flex-1 text-lg text-stone-900 placeholder-stone-400 outline-none bg-transparent"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-xs font-medium text-stone-400 border border-stone-200 rounded">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto py-2"
        >
          {items.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-stone-400">
              No results for &ldquo;{query}&rdquo;
            </p>
          )}

          {Object.entries(grouped).map(([category, categoryItems]) => (
            <div key={category}>
              <div className="px-4 pt-3 pb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                  {category}
                </span>
              </div>
              {categoryItems.map((item) => {
                const currentIndex = flatIndex++;
                const isSelected = currentIndex === selectedIndex;

                return (
                  <button
                    key={item.id}
                    data-selected={isSelected}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      isSelected
                        ? 'bg-emerald-50'
                        : 'hover:bg-stone-50'
                    }`}
                    onMouseEnter={() => setSelectedIndex(currentIndex)}
                    onClick={() => handleSelect(item)}
                  >
                    <span className="text-lg leading-none flex-shrink-0 w-6 text-center">
                      {item.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className={`block text-sm font-medium truncate ${
                        isSelected ? 'text-emerald-900' : 'text-stone-800'
                      }`}>
                        {item.title}
                      </span>
                      {item.subtitle && (
                        <span className="block text-xs text-stone-400 truncate">
                          {item.subtitle}
                        </span>
                      )}
                    </div>
                    {item.meta && (
                      <span className="flex-shrink-0 text-xs text-stone-400 ml-2">
                        {item.meta}
                      </span>
                    )}
                    {isSelected && (
                      <kbd className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 text-xs font-medium text-emerald-600 border border-emerald-200 rounded bg-white">
                        ↵
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-stone-100 flex items-center gap-4 text-xs text-stone-400">
          <span className="flex items-center gap-1">
            <kbd className="px-1 border border-stone-200 rounded">↑↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 border border-stone-200 rounded">↵</kbd> open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 border border-stone-200 rounded">Esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
