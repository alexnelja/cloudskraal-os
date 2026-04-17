import { useEffect, useMemo, useState } from 'react';
import { Plus, MagnifyingGlass as Search, Eye, EyeSlash, CaretDown, CaretRight } from '@phosphor-icons/react';
import { ENTERPRISE_LABELS } from '../../types/farm';
import type { Farm, Field } from '../../types/farm';

type SortMode = 'enterprise' | 'name-asc' | 'area-desc';

interface FieldsSidebarProps {
  farms: Farm[];
  fields: Field[];
  enterprises: string[];
  visibleEnterprises: string[];
  selectedFieldId: string | null;
  enterpriseColors: Record<string, string>;
  onEnterpriseToggle: (enterprise: string) => void;
  onFarmSelect: (farmCode: string | null) => void;
  onFieldSelect: (fieldId: string) => void;
  onAddField: () => void;
  onColorChange?: (enterprise: string, color: string) => void;
}

const LS_KEY = 'capex.fields-sidebar';

interface PersistedState {
  collapsed: string[];
  sortMode: SortMode;
}

function loadPersisted(): PersistedState {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return { collapsed: [], sortMode: 'enterprise' };
    const parsed = JSON.parse(raw);
    return {
      collapsed: Array.isArray(parsed.collapsed) ? parsed.collapsed : [],
      sortMode: parsed.sortMode ?? 'enterprise',
    };
  } catch {
    return { collapsed: [], sortMode: 'enterprise' };
  }
}

function savePersisted(state: PersistedState) {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    // SSR / private mode — no-op
  }
}

function sortFields(fields: Field[], mode: SortMode): Field[] {
  const sorted = [...fields];
  switch (mode) {
    case 'name-asc':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'area-desc':
      return sorted.sort((a, b) => b.area_ha - a.area_ha || a.name.localeCompare(b.name));
    case 'enterprise':
    default:
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
  }
}

export default function FieldsSidebar({
  farms,
  fields,
  enterprises: _enterprises,
  visibleEnterprises,
  selectedFieldId,
  onEnterpriseToggle,
  onFarmSelect,
  onFieldSelect,
  onAddField,
  enterpriseColors,
  onColorChange,
}: FieldsSidebarProps) {
  const [search, setSearch] = useState('');
  const persisted = loadPersisted();
  const [collapsed, setCollapsed] = useState<string[]>(() => persisted.collapsed);
  const [sortMode, setSortMode] = useState<SortMode>(() => persisted.sortMode);

  useEffect(() => {
    savePersisted({ collapsed, sortMode });
  }, [collapsed, sortMode]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return fields;
    return fields.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.code ?? '').toLowerCase().includes(q) ||
        (f.farm_name ?? '').toLowerCase().includes(q),
    );
  }, [fields, search]);

  const groups = useMemo(() => {
    if (sortMode !== 'enterprise') return null;
    const byEnt = new Map<string, Field[]>();
    for (const f of filtered) {
      const list = byEnt.get(f.enterprise) ?? [];
      list.push(f);
      byEnt.set(f.enterprise, list);
    }
    return Array.from(byEnt.entries())
      .map(([ent, list]) => ({
        ent,
        list: list.sort((a, b) => a.name.localeCompare(b.name)),
        totalHa: list.reduce((s, f) => s + (f.area_ha ?? 0), 0),
      }))
      .sort((a, b) => b.totalHa - a.totalHa);
  }, [filtered, sortMode]);

  const flatSorted = useMemo(() => {
    if (sortMode === 'enterprise') return null;
    return sortFields(filtered, sortMode);
  }, [filtered, sortMode]);

  const totalHa = filtered.reduce((s, f) => s + (f.area_ha ?? 0), 0);

  const farmAggregates = useMemo(() => {
    const farmMap = new Map<string, Farm>();
    for (const farm of farms) farmMap.set(farm.id, farm);

    const byFarmId = new Map<string, { farm: Farm; fieldsHa: number; fieldCount: number }>();
    for (const f of filtered) {
      const farm = farmMap.get(f.farm_id);
      if (!farm) continue;
      const agg = byFarmId.get(f.farm_id) ?? { farm, fieldsHa: 0, fieldCount: 0 };
      agg.fieldsHa += f.area_ha ?? 0;
      agg.fieldCount += 1;
      byFarmId.set(f.farm_id, agg);
    }
    return Array.from(byFarmId.values()).sort((a, b) => a.farm.name.localeCompare(b.farm.name));
  }, [filtered, farms]);

  function toggleGroup(ent: string) {
    setCollapsed((prev) =>
      prev.includes(ent) ? prev.filter((e) => e !== ent) : [...prev, ent],
    );
  }

  return (
    <aside className="h-full w-72 flex-shrink-0 glass-panel rounded-r-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-3 flex items-center gap-2 border-b border-[#f3f4f3]">
        <span className="flex-1 font-semibold text-stone-800 text-[13px]">Fields</span>
        <button
          type="button"
          onClick={onAddField}
          aria-label="Add field"
          className="bg-emerald-700 text-white rounded-lg px-2.5 py-1.5 text-[11px] font-medium flex items-center gap-1 hover:bg-emerald-800"
        >
          <Plus size={12} weight="bold" /> ADD
        </button>
      </div>

      {/* Aggregate strip */}
      <div className="px-3 py-2 bg-stone-50 border-b border-[#f3f4f3] flex items-baseline gap-2">
        <span className="text-lg font-bold text-stone-800">{Math.round(totalHa).toLocaleString()}</span>
        <span className="text-[10px] text-stone-500 font-medium">ha</span>
        <span className="text-[11px] text-stone-500 ml-auto">{filtered.length} fields</span>
      </div>

      {/* Farm-level aggregates */}
      {farmAggregates.length > 0 && (
        <div className="px-3 py-2 border-b border-[#f3f4f3] space-y-1">
          {farmAggregates.map((agg) => {
            const pct = agg.farm.total_ha > 0
              ? Math.round((agg.fieldsHa / agg.farm.total_ha) * 100)
              : 0;
            return (
              <div key={agg.farm.id} className="flex items-center gap-2 text-[10px] text-stone-600">
                <span className="font-medium text-stone-700 truncate flex-1">{agg.farm.name}</span>
                <span>{Math.round(agg.fieldsHa)}/{Math.round(agg.farm.total_ha).toLocaleString()} ha</span>
                <span className="text-stone-400">{pct}%</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Farm filter + search + sort */}
      <div className="px-3 py-2 border-b border-[#f3f4f3] space-y-2">
        <select
          className="w-full glass-input rounded-lg px-2 py-1.5 text-[12px] text-stone-800"
          defaultValue=""
          onChange={(e) => onFarmSelect(e.target.value || null)}
        >
          <option value="">All Farms</option>
          {farms.map((f) => (
            <option key={f.code} value={f.code}>{f.name}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search fields..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full glass-input rounded-lg pl-7 pr-2 py-1.5 text-[12px]"
            />
          </div>
          <select
            aria-label="Sort fields"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="glass-input rounded-lg px-1.5 py-1.5 text-[11px] text-stone-600"
          >
            <option value="enterprise">Enterprise</option>
            <option value="name-asc">Name A→Z</option>
            <option value="area-desc">Area ↓</option>
          </select>
        </div>
      </div>

      {/* Field list */}
      <div className="flex-1 overflow-y-auto text-[11px]">
        {/* Enterprise-grouped view */}
        {groups && groups.length === 0 && (
          <p className="px-3 py-3 text-stone-400 italic">No fields.</p>
        )}
        {groups?.map((g) => {
          const color = enterpriseColors[g.ent] ?? '#6b7280';
          const label = ENTERPRISE_LABELS[g.ent] ?? g.ent;
          const isCollapsed = collapsed.includes(g.ent);
          const isVisible = visibleEnterprises.includes(g.ent);
          return (
            <div key={g.ent}>
              <div
                className="pl-3 pr-2 py-2 flex items-center gap-2 border-l-[3px]"
                style={{ borderLeftColor: color, background: `${color}10`, color }}
              >
                <button
                  type="button"
                  onClick={() => toggleGroup(g.ent)}
                  aria-label={`Toggle ${label} group`}
                  className="flex items-center gap-1 flex-1 font-semibold"
                >
                  {isCollapsed ? <CaretRight size={10} weight="bold" /> : <CaretDown size={10} weight="bold" />}
                  <span>{label}</span>
                </button>
                <span className="text-[10px] font-medium text-stone-600">
                  {Math.round(g.totalHa)} ha · {g.list.length}
                </span>
                {onColorChange && (
                  <label className="relative cursor-pointer" title={`Change ${label} colour`}>
                    <span
                      className="block w-3.5 h-3.5 rounded-full border border-white/60"
                      style={{ backgroundColor: color }}
                    />
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => onColorChange(g.ent, e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      aria-label={`Pick ${label} colour`}
                    />
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => onEnterpriseToggle(g.ent)}
                  aria-label={`Toggle ${label} visibility`}
                  className="text-stone-500 hover:text-stone-800"
                >
                  {isVisible ? <Eye size={12} /> : <EyeSlash size={12} />}
                </button>
              </div>
              {!isCollapsed && g.list.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onFieldSelect(f.id)}
                  className={`field-row w-full pl-8 pr-3 py-1.5 flex items-center justify-between text-left border-b border-[#f7f6f5] hover:bg-stone-50 ${
                    selectedFieldId === f.id ? 'bg-amber-50' : ''
                  }`}
                >
                  <span className="text-stone-800 truncate">{f.name}</span>
                  <span className="text-stone-500 text-[10px] flex-shrink-0 ml-2">{Math.round(f.area_ha)} ha</span>
                </button>
              ))}
            </div>
          );
        })}

        {/* Flat sorted view (name or area) */}
        {flatSorted && flatSorted.length === 0 && (
          <p className="px-3 py-3 text-stone-400 italic">No fields.</p>
        )}
        {flatSorted?.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onFieldSelect(f.id)}
            className={`field-row w-full pl-3 pr-3 py-1.5 flex items-center justify-between text-left border-b border-[#f7f6f5] hover:bg-stone-50 ${
              selectedFieldId === f.id ? 'bg-amber-50' : ''
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: enterpriseColors[f.enterprise] ?? '#6b7280' }}
              />
              <span className="text-stone-800 truncate">{f.name}</span>
            </div>
            <span className="text-stone-500 text-[10px] flex-shrink-0 ml-2">{Math.round(f.area_ha)} ha</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
