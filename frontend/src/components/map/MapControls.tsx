import { useState, useRef, useEffect } from 'react';
import { MagnifyingGlass as Search, SlidersHorizontal, CaretDown as ChevronDown } from '@phosphor-icons/react';
import { ENTERPRISE_COLORS, ENTERPRISE_LABELS } from '../../types/farm';
import type { Farm, Field } from '../../types/farm';

interface MapControlsProps {
  farms: Farm[];
  fields: Field[];
  enterprises: string[];
  visibleEnterprises: string[];
  onEnterpriseToggle: (enterprise: string) => void;
  onFarmZoom: (farmCode: string | null) => void;
  onFieldSelect: (fieldId: string) => void;
}

const HIDDEN_FROM_FILTER = new Set(['farm_boundary', 'unclassified']);

export default function MapControls({
  farms,
  fields,
  enterprises,
  visibleEnterprises,
  onEnterpriseToggle,
  onFarmZoom,
  onFieldSelect,
}: MapControlsProps) {
  const [expanded, setExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const filteredFields = searchQuery.trim().length > 0
    ? fields
        .filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
        .slice(0, 8)
    : [];

  // Close search dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filterableEnterprises = enterprises.filter(e => !HIDDEN_FROM_FILTER.has(e));

  return (
    <div className="w-[min(calc(100vw-7rem),18rem)] md:w-72">
      <div className="glass-panel rounded-2xl p-3 space-y-2">

        {/* Top row: farm dropdown + expand toggle */}
        <div className="flex items-center gap-2">
          {/* Farm zoom dropdown */}
          <div className="relative flex-1">
            <select
              className="w-full appearance-none glass-input rounded-lg px-3 py-1.5 pr-7 text-sm text-stone-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500"
              defaultValue=""
              onChange={e => onFarmZoom(e.target.value || null)}
            >
              <option value="">All Farms</option>
              {farms.map(farm => (
                <option key={farm.code} value={farm.code}>
                  {farm.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
          </div>

          {/* Expand/collapse button */}
          <button
            onClick={() => setExpanded(v => !v)}
            className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-colors ${
              expanded
                ? 'bg-green-600 border-green-600 text-white'
                : 'bg-white border-stone-300 text-stone-600 hover:bg-stone-50'
            }`}
            title={expanded ? 'Hide filters' : 'Show filters'}
          >
            <SlidersHorizontal size={15} />
          </button>
        </div>

        {/* Expanded section */}
        {expanded && (
          <>
            {/* Field search */}
            <div ref={searchRef} className="relative">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search fields..."
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  className="w-full glass-input rounded-lg pl-8 pr-3 py-1.5 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Search results dropdown */}
              {searchOpen && filteredFields.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 glass-panel rounded-xl overflow-hidden z-20">
                  {filteredFields.map(field => (
                    <button
                      key={field.id}
                      onClick={() => {
                        onFieldSelect(field.id);
                        setSearchQuery('');
                        setSearchOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-stone-50 flex items-center gap-2 border-b border-stone-100 last:border-0"
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: ENTERPRISE_COLORS[field.enterprise] ?? '#9ca3af' }}
                      />
                      <span className="flex-1 min-w-0 truncate text-stone-800">{field.name}</span>
                      {field.farm_name && (
                        <span className="text-xs text-stone-400 flex-shrink-0">{field.farm_name}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {searchOpen && searchQuery.trim().length > 0 && filteredFields.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-lg shadow-sm px-3 py-2 text-sm text-stone-400 z-20">
                  No fields found
                </div>
              )}
            </div>

            {/* Enterprise filter */}
            {filterableEnterprises.length > 0 && (
              <div>
                <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">
                  Enterprise
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                  {filterableEnterprises.map(ent => {
                    const isVisible = visibleEnterprises.includes(ent);
                    return (
                      <label
                        key={ent}
                        className="flex items-center gap-1.5 cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          checked={isVisible}
                          onChange={() => onEnterpriseToggle(ent)}
                          className="sr-only"
                        />
                        {/* Custom checkbox */}
                        <span
                          className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-colors ${
                            isVisible ? 'border-transparent' : 'bg-white border-stone-300'
                          }`}
                          style={isVisible ? { backgroundColor: ENTERPRISE_COLORS[ent] ?? '#6b7280' } : {}}
                        >
                          {isVisible && (
                            <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 text-white fill-current">
                              <polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: ENTERPRISE_COLORS[ent] ?? '#6b7280' }}
                        />
                        <span className="text-xs text-stone-700">
                          {ENTERPRISE_LABELS[ent] ?? ent}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
