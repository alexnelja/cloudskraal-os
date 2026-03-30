import { useState, useEffect, useCallback } from 'react';
import { Beef, ChevronDown, ChevronUp } from 'lucide-react';
import { getLivestockGroups, getLivestockDashboard, getBreedingSeasons, getShearingRecords, updateLivestockGroup, updateBreedingSeason, updateShearingRecord } from '../api/livestock';
import type { LivestockGroup, LivestockDashboard, BreedingSeason, ShearingRecord } from '../types/phase2';
import EditableCell, { StepperCell } from '../components/EditableCell';

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function pct(num: number | null, denom: number | null): string {
  if (num == null || denom == null || denom === 0) return '-';
  return `${((num / denom) * 100).toFixed(0)}%`;
}

const MGMT_COLORS: Record<string, string> = {
  breeding: '#7c3aed',
  fattening: '#d97706',
  replacement: '#2563eb',
  mixed: '#047857',
};

export default function LivestockPage() {
  const [dashboard, setDashboard] = useState<LivestockDashboard | null>(null);
  const [groups, setGroups] = useState<LivestockGroup[]>([]);
  const [breedingSeasons, setBreedingSeasons] = useState<BreedingSeason[]>([]);
  const [shearingRecords, setShearingRecords] = useState<ShearingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      getLivestockDashboard(),
      getLivestockGroups(),
      getBreedingSeasons(),
      getShearingRecords(),
    ])
      .then(([dash, grps, breed, shear]) => {
        setDashboard(dash);
        setGroups(grps);
        setBreedingSeasons(breed);
        setShearingRecords(shear);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load livestock data:', err);
        setLoading(false);
      });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="h-[calc(100vh-5rem)] md:h-screen flex items-center justify-center">
        <p className="text-stone-400 text-sm">Loading livestock data...</p>
      </div>
    );
  }

  // KPI calculations from latest breeding season
  const latestBreeding = breedingSeasons.length > 0 ? breedingSeasons[0] : null;
  const lambingPct = latestBreeding ? pct(latestBreeding.born_count, latestBreeding.ewes_joined) : '-';
  const weaningPct = latestBreeding?.weaning_percentage != null ? `${latestBreeding.weaning_percentage}%` : pct(latestBreeding?.weaned_count ?? null, latestBreeding?.ewes_joined ?? null);
  const latestShearing = shearingRecords.length > 0 ? shearingRecords[0] : null;
  const avgWoolPerHead = latestShearing?.avg_fleece_kg != null ? `${latestShearing.avg_fleece_kg.toFixed(1)} kg` : '-';
  const mortalityRate = latestBreeding
    ? pct(
        (latestBreeding.born_count ?? 0) - (latestBreeding.survived_count ?? 0),
        latestBreeding.born_count,
      )
    : '-';

  return (
    <div className="h-[calc(100vh-5rem)] md:h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[#f3f4f3] px-4 py-3 bg-white">
        <div className="flex items-center gap-2">
          <Beef size={20} className="text-emerald-700" />
          <h1 className="text-lg font-bold text-stone-900">Livestock Tracker</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-6xl mx-auto p-4 space-y-6">

          {/* Dashboard cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-stone-50 rounded-lg p-4 text-center">
              <p className="text-xs text-stone-400 mb-1">Total Head</p>
              <p className="text-3xl font-bold text-stone-900">{dashboard?.totalHead ?? 0}</p>
            </div>
            <div className="bg-stone-50 rounded-lg p-4 text-center">
              <p className="text-xs text-stone-400 mb-1">Groups</p>
              <p className="text-3xl font-bold text-stone-900">{groups.length}</p>
            </div>
            <div className="bg-stone-50 rounded-lg p-4 text-center">
              <p className="text-xs text-stone-400 mb-1">Latest Shearing</p>
              <p className="text-xl font-bold text-stone-900">
                {latestShearing ? `${latestShearing.total_fleece_kg?.toLocaleString() ?? '-'} kg` : '-'}
              </p>
              <p className="text-[10px] text-stone-400">{latestShearing ? formatDate(latestShearing.date) : ''}</p>
            </div>
            <div className="bg-stone-50 rounded-lg p-4 text-center">
              <p className="text-xs text-stone-400 mb-1">Avg Micron</p>
              <p className="text-xl font-bold text-stone-900">
                {latestShearing?.micron_avg != null ? `${latestShearing.micron_avg}\u00B5` : '-'}
              </p>
            </div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg p-3 text-center">
              <p className="text-[10px] text-stone-400 uppercase tracking-wide mb-0.5">Lambing %</p>
              <p className="text-xl font-bold text-emerald-700">{lambingPct}</p>
              <p className="text-[10px] text-stone-400">born / joined</p>
            </div>
            <div className="rounded-lg p-3 text-center">
              <p className="text-[10px] text-stone-400 uppercase tracking-wide mb-0.5">Weaning %</p>
              <p className="text-xl font-bold text-emerald-700">{weaningPct}</p>
              <p className="text-[10px] text-stone-400">weaned / joined</p>
            </div>
            <div className="rounded-lg p-3 text-center">
              <p className="text-[10px] text-stone-400 uppercase tracking-wide mb-0.5">Avg Wool/Head</p>
              <p className="text-xl font-bold text-emerald-700">{avgWoolPerHead}</p>
            </div>
            <div className="rounded-lg p-3 text-center">
              <p className="text-[10px] text-stone-400 uppercase tracking-wide mb-0.5">Mortality Rate</p>
              <p className="text-xl font-bold text-red-600">{mortalityRate}</p>
              <p className="text-[10px] text-stone-400">deaths / born</p>
            </div>
          </div>

          {/* Groups section */}
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-[#6e7a73] mb-3">Flock Groups</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className="rounded-2xl overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
                    className="w-full text-left p-4 hover:bg-stone-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div onClick={(e) => e.stopPropagation()}>
                        <EditableCell
                          value={group.name}
                          onSave={(val) => {
                            setGroups(prev => prev.map(g => g.id === group.id ? { ...g, name: val } : g));
                            updateLivestockGroup(group.id, { name: val }).catch(() => fetchData());
                          }}
                          className="text-sm font-bold text-stone-800"
                        />
                        <EditableCell
                          value={group.breed ?? group.species}
                          onSave={(val) => {
                            setGroups(prev => prev.map(g => g.id === group.id ? { ...g, breed: val } : g));
                            updateLivestockGroup(group.id, { breed: val }).catch(() => fetchData());
                          }}
                          className="text-xs text-stone-500"
                        />
                      </div>
                      <div className="text-right" onClick={(e) => e.stopPropagation()}>
                        <StepperCell
                          value={group.head_count}
                          onSave={(val) => {
                            setGroups(prev => prev.map(g => g.id === group.id ? { ...g, head_count: val } : g));
                            updateLivestockGroup(group.id, { head_count: val }).catch(() => fetchData());
                          }}
                          className="text-2xl text-stone-900"
                        />
                        <p className="text-[10px] text-stone-400">head</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {group.management_type && (
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                          style={{ backgroundColor: MGMT_COLORS[group.management_type] ?? '#6b7280' }}
                        >
                          {group.management_type}
                        </span>
                      )}
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 text-stone-600">
                        {group.enterprise}
                      </span>
                      <span className="flex-1" />
                      {expandedGroup === group.id ? <ChevronUp size={14} className="text-stone-400" /> : <ChevronDown size={14} className="text-stone-400" />}
                    </div>
                  </button>
                  {expandedGroup === group.id && (
                    <div className="border-t border-[#f3f4f3] p-4 bg-stone-50">
                      <div className="flex items-center gap-2 text-xs text-stone-500">
                        <span>Avg weight:</span>
                        <EditableCell
                          value={group.average_weight_kg != null ? String(group.average_weight_kg) : ''}
                          type="number"
                          onSave={(val) => {
                            const num = val ? Number(val) : null;
                            setGroups(prev => prev.map(g => g.id === group.id ? { ...g, average_weight_kg: num } : g));
                            updateLivestockGroup(group.id, { average_weight_kg: num }).catch(() => fetchData());
                          }}
                          className="text-xs text-stone-500"
                        />
                        <span>kg</span>
                        {group.record_count != null && <span>| {group.record_count} records</span>}
                      </div>
                      {group.notes && (
                        <p className="text-xs text-stone-600 mt-1">{group.notes}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Breeding Tracker */}
          {breedingSeasons.length > 0 && (
            <div>
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-[#6e7a73] mb-3">Breeding Tracker</h2>
              {breedingSeasons.map((season) => (
                <div key={season.id} className="rounded-2xl p-4 mb-3">
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-sm font-bold text-stone-800">
                      {season.group_name ?? 'Season'} {season.year}
                    </h3>
                    {season.weaning_percentage != null && (
                      <span className="ml-auto text-sm font-bold text-emerald-700">
                        Weaning: {season.weaning_percentage}%
                      </span>
                    )}
                  </div>

                  {/* Pipeline visualization */}
                  <div className="flex items-center gap-0 overflow-x-auto">
                    <PipelineStage
                      label="Joining"
                      detail={season.joining_start ? formatDate(season.joining_start).split(' ').slice(1).join(' ') : '-'}
                      metricValue={season.ewes_joined}
                      metricSuffix="ewes"
                      subMetricValue={season.rams_used}
                      subMetricSuffix="rams"
                      color="#7c3aed"
                      isFirst
                      onMetricSave={(val) => {
                        setBreedingSeasons(prev => prev.map(s => s.id === season.id ? { ...s, ewes_joined: val } : s));
                        updateBreedingSeason(season.id, { ewes_joined: val }).catch(() => fetchData());
                      }}
                      onSubMetricSave={(val) => {
                        setBreedingSeasons(prev => prev.map(s => s.id === season.id ? { ...s, rams_used: val } : s));
                        updateBreedingSeason(season.id, { rams_used: val }).catch(() => fetchData());
                      }}
                    />
                    <PipelineArrow />
                    <PipelineStage
                      label="Scanning"
                      detail={season.scanning_date ? formatDate(season.scanning_date).split(' ').slice(1).join(' ') : '-'}
                      metricValue={season.pregnant_count}
                      metricSuffix="pregnant"
                      subMetricValue={season.dry_count}
                      subMetricSuffix="dry"
                      color="#2563eb"
                      onMetricSave={(val) => {
                        setBreedingSeasons(prev => prev.map(s => s.id === season.id ? { ...s, pregnant_count: val } : s));
                        updateBreedingSeason(season.id, { pregnant_count: val }).catch(() => fetchData());
                      }}
                      onSubMetricSave={(val) => {
                        setBreedingSeasons(prev => prev.map(s => s.id === season.id ? { ...s, dry_count: val } : s));
                        updateBreedingSeason(season.id, { dry_count: val }).catch(() => fetchData());
                      }}
                    />
                    <PipelineArrow />
                    <PipelineStage
                      label="Lambing"
                      detail={season.lambing_start ? formatDate(season.lambing_start).split(' ').slice(1).join(' ') : '-'}
                      metricValue={season.born_count}
                      metricSuffix="born"
                      subMetricValue={season.survived_count}
                      subMetricSuffix="survived"
                      color="#d97706"
                      onMetricSave={(val) => {
                        setBreedingSeasons(prev => prev.map(s => s.id === season.id ? { ...s, born_count: val } : s));
                        updateBreedingSeason(season.id, { born_count: val }).catch(() => fetchData());
                      }}
                      onSubMetricSave={(val) => {
                        setBreedingSeasons(prev => prev.map(s => s.id === season.id ? { ...s, survived_count: val } : s));
                        updateBreedingSeason(season.id, { survived_count: val }).catch(() => fetchData());
                      }}
                    />
                    <PipelineArrow />
                    <PipelineStage
                      label="Weaning"
                      detail={season.weaning_date ? formatDate(season.weaning_date).split(' ').slice(1).join(' ') : '-'}
                      metricValue={season.weaned_count}
                      metricSuffix="weaned"
                      subMetricValue={null}
                      subMetricSuffix={null}
                      color="#047857"
                      isLast
                      onMetricSave={(val) => {
                        setBreedingSeasons(prev => prev.map(s => s.id === season.id ? { ...s, weaned_count: val } : s));
                        updateBreedingSeason(season.id, { weaned_count: val }).catch(() => fetchData());
                      }}
                    />
                  </div>

                  {/* Scanning breakdown */}
                  {(season.singles_count != null || season.twins_count != null || season.triplets_count != null) && (
                    <div className="flex items-center gap-4 mt-3 text-xs text-stone-500">
                      <span>Scan breakdown:</span>
                      {season.singles_count != null && <span>Singles: {season.singles_count}</span>}
                      {season.twins_count != null && <span>Twins: {season.twins_count}</span>}
                      {season.triplets_count != null && <span>Triplets: {season.triplets_count}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Shearing Records */}
          {shearingRecords.length > 0 && (
            <div>
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-[#6e7a73] mb-3">Shearing Records</h2>
              <div className="overflow-x-auto rounded-2xl">
                <table className="w-full text-sm">
                  <thead className="bg-[#f3f4f3] border-b border-[#f3f4f3]">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-stone-600">Date</th>
                      <th className="text-left px-4 py-2 font-medium text-stone-600 hidden sm:table-cell">Group</th>
                      <th className="text-right px-4 py-2 font-medium text-stone-600">Head</th>
                      <th className="text-right px-4 py-2 font-medium text-stone-600">Total kg</th>
                      <th className="text-right px-4 py-2 font-medium text-stone-600 hidden md:table-cell">Avg kg</th>
                      <th className="text-right px-4 py-2 font-medium text-stone-600 hidden md:table-cell">Micron</th>
                      <th className="text-right px-4 py-2 font-medium text-stone-600 hidden lg:table-cell">Yield %</th>
                      <th className="text-left px-4 py-2 font-medium text-stone-600 hidden lg:table-cell">Buyer</th>
                      <th className="text-right px-4 py-2 font-medium text-stone-600 hidden sm:table-cell">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shearingRecords.map((rec) => {
                      const patchShearing = (data: Partial<ShearingRecord>) => {
                        updateShearingRecord(rec.id, data).catch(() => fetchData());
                      };
                      return (
                      <tr key={rec.id} className="border-b border-[#f3f4f3]">
                        <td className="px-4 py-2.5 text-stone-800">
                          <EditableCell
                            value={rec.date ?? ''}
                            type="date"
                            onSave={(val) => {
                              setShearingRecords(prev => prev.map(r => r.id === rec.id ? { ...r, date: val } : r));
                              patchShearing({ date: val });
                            }}
                          />
                        </td>
                        <td className="px-4 py-2.5 text-stone-600 hidden sm:table-cell">{rec.group_name ?? '-'}</td>
                        <td className="px-4 py-2.5 text-right text-stone-800">
                          <EditableCell
                            value={rec.head_shorn != null ? String(rec.head_shorn) : ''}
                            type="number"
                            onSave={(val) => {
                              const num = val ? Number(val) : null;
                              setShearingRecords(prev => prev.map(r => r.id === rec.id ? { ...r, head_shorn: num } : r));
                              patchShearing({ head_shorn: num });
                            }}
                          />
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-stone-800">
                          <EditableCell
                            value={rec.total_fleece_kg != null ? String(rec.total_fleece_kg) : ''}
                            type="number"
                            onSave={(val) => {
                              const num = val ? Number(val) : null;
                              setShearingRecords(prev => prev.map(r => r.id === rec.id ? { ...r, total_fleece_kg: num } : r));
                              patchShearing({ total_fleece_kg: num });
                            }}
                          />
                        </td>
                        <td className="px-4 py-2.5 text-right text-stone-600 hidden md:table-cell">
                          <EditableCell
                            value={rec.avg_fleece_kg != null ? String(rec.avg_fleece_kg) : ''}
                            type="number"
                            onSave={(val) => {
                              const num = val ? Number(val) : null;
                              setShearingRecords(prev => prev.map(r => r.id === rec.id ? { ...r, avg_fleece_kg: num } : r));
                              patchShearing({ avg_fleece_kg: num });
                            }}
                          />
                        </td>
                        <td className="px-4 py-2.5 text-right text-stone-600 hidden md:table-cell">
                          <EditableCell
                            value={rec.micron_avg != null ? String(rec.micron_avg) : ''}
                            type="number"
                            onSave={(val) => {
                              const num = val ? Number(val) : null;
                              setShearingRecords(prev => prev.map(r => r.id === rec.id ? { ...r, micron_avg: num } : r));
                              patchShearing({ micron_avg: num });
                            }}
                          />
                        </td>
                        <td className="px-4 py-2.5 text-right text-stone-600 hidden lg:table-cell">
                          <EditableCell
                            value={rec.yield_pct != null ? String(rec.yield_pct) : ''}
                            type="number"
                            onSave={(val) => {
                              const num = val ? Number(val) : null;
                              setShearingRecords(prev => prev.map(r => r.id === rec.id ? { ...r, yield_pct: num } : r));
                              patchShearing({ yield_pct: num });
                            }}
                          />
                        </td>
                        <td className="px-4 py-2.5 text-stone-600 hidden lg:table-cell">
                          <EditableCell
                            value={rec.buyer ?? ''}
                            onSave={(val) => {
                              setShearingRecords(prev => prev.map(r => r.id === rec.id ? { ...r, buyer: val || null } : r));
                              patchShearing({ buyer: val || null });
                            }}
                          />
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-emerald-700 hidden sm:table-cell">
                          <EditableCell
                            value={rec.total_revenue != null ? String(rec.total_revenue) : ''}
                            type="number"
                            onSave={(val) => {
                              const num = val ? Number(val) : null;
                              setShearingRecords(prev => prev.map(r => r.id === rec.id ? { ...r, total_revenue: num } : r));
                              patchShearing({ total_revenue: num });
                            }}
                          />
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

/* Pipeline stage component */
function PipelineStage({
  label,
  detail,
  metricValue,
  metricSuffix,
  subMetricValue,
  subMetricSuffix,
  color,
  isFirst,
  isLast,
  onMetricSave,
  onSubMetricSave,
}: {
  label: string;
  detail: string;
  metricValue: number | null;
  metricSuffix: string;
  subMetricValue?: number | null;
  subMetricSuffix?: string | null;
  color: string;
  isFirst?: boolean;
  isLast?: boolean;
  onMetricSave?: (val: number) => void;
  onSubMetricSave?: (val: number) => void;
}) {
  return (
    <div
      className={`flex-1 min-w-[100px] p-3 text-center ${isFirst ? 'rounded-l-lg' : ''} ${isLast ? 'rounded-r-lg' : ''}`}
      style={{ backgroundColor: `${color}10`, borderTop: `3px solid ${color}` }}
    >
      <p className="text-xs font-bold" style={{ color }}>{label}</p>
      <p className="text-[10px] text-stone-400 mb-1">{detail}</p>
      {metricValue != null ? (
        <div className="inline-block">
          <EditableCell
            value={String(metricValue)}
            type="number"
            onSave={(val) => onMetricSave?.(Number(val) || 0)}
            className="text-xs font-medium text-stone-800"
          />
          <span className="text-xs text-stone-600 ml-0.5">{metricSuffix}</span>
        </div>
      ) : null}
      {subMetricValue != null && subMetricSuffix ? (
        <div className="inline-block">
          <EditableCell
            value={String(subMetricValue)}
            type="number"
            onSave={(val) => onSubMetricSave?.(Number(val) || 0)}
            className="text-[10px] text-stone-500"
          />
          <span className="text-[10px] text-stone-500 ml-0.5">{subMetricSuffix}</span>
        </div>
      ) : null}
    </div>
  );
}

function PipelineArrow() {
  return (
    <div className="flex-shrink-0 text-stone-300 px-0.5">
      <svg width="12" height="20" viewBox="0 0 12 20" fill="none">
        <path d="M2 2L10 10L2 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}
