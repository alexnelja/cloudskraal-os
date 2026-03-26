import { useState, useEffect, useCallback } from 'react';
import { Beef, ChevronDown, ChevronUp } from 'lucide-react';
import { getLivestockGroups, getLivestockDashboard, getBreedingSeasons, getShearingRecords } from '../api/livestock';
import type { LivestockGroup, LivestockDashboard, BreedingSeason, ShearingRecord } from '../types/phase2';

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatCurrency(val: number | null): string {
  if (val == null) return '-';
  return `R${val.toLocaleString('en-ZA', { minimumFractionDigits: 0 })}`;
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
      <div className="flex-shrink-0 border-b border-stone-200 px-4 py-3 bg-white">
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
            <div className="border border-stone-200 rounded-lg p-3 text-center">
              <p className="text-[10px] text-stone-400 uppercase tracking-wide mb-0.5">Lambing %</p>
              <p className="text-xl font-bold text-emerald-700">{lambingPct}</p>
              <p className="text-[10px] text-stone-400">born / joined</p>
            </div>
            <div className="border border-stone-200 rounded-lg p-3 text-center">
              <p className="text-[10px] text-stone-400 uppercase tracking-wide mb-0.5">Weaning %</p>
              <p className="text-xl font-bold text-emerald-700">{weaningPct}</p>
              <p className="text-[10px] text-stone-400">weaned / joined</p>
            </div>
            <div className="border border-stone-200 rounded-lg p-3 text-center">
              <p className="text-[10px] text-stone-400 uppercase tracking-wide mb-0.5">Avg Wool/Head</p>
              <p className="text-xl font-bold text-emerald-700">{avgWoolPerHead}</p>
            </div>
            <div className="border border-stone-200 rounded-lg p-3 text-center">
              <p className="text-[10px] text-stone-400 uppercase tracking-wide mb-0.5">Mortality Rate</p>
              <p className="text-xl font-bold text-red-600">{mortalityRate}</p>
              <p className="text-[10px] text-stone-400">deaths / born</p>
            </div>
          </div>

          {/* Groups section */}
          <div>
            <h2 className="text-sm font-semibold text-stone-700 mb-3">Flock Groups</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className="border border-stone-200 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
                    className="w-full text-left p-4 hover:bg-stone-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-stone-800">{group.name}</h3>
                        <p className="text-xs text-stone-500">{group.breed ?? group.species}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-stone-900">{group.head_count}</p>
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
                    <div className="border-t border-stone-200 p-4 bg-stone-50">
                      <p className="text-xs text-stone-500">
                        {group.average_weight_kg ? `Avg weight: ${group.average_weight_kg} kg` : 'No weight data'}
                        {group.record_count != null && ` | ${group.record_count} records`}
                      </p>
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
              <h2 className="text-sm font-semibold text-stone-700 mb-3">Breeding Tracker</h2>
              {breedingSeasons.map((season) => (
                <div key={season.id} className="border border-stone-200 rounded-lg p-4 mb-3">
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
                      metric={season.ewes_joined != null ? `${season.ewes_joined} ewes` : null}
                      subMetric={season.rams_used != null ? `${season.rams_used} rams` : null}
                      color="#7c3aed"
                      isFirst
                    />
                    <PipelineArrow />
                    <PipelineStage
                      label="Scanning"
                      detail={season.scanning_date ? formatDate(season.scanning_date).split(' ').slice(1).join(' ') : '-'}
                      metric={season.pregnant_count != null ? `${season.pregnant_count} pregnant` : null}
                      subMetric={season.dry_count != null ? `${season.dry_count} dry` : null}
                      color="#2563eb"
                    />
                    <PipelineArrow />
                    <PipelineStage
                      label="Lambing"
                      detail={season.lambing_start ? formatDate(season.lambing_start).split(' ').slice(1).join(' ') : '-'}
                      metric={season.born_count != null ? `${season.born_count} born` : null}
                      subMetric={season.survived_count != null ? `${season.survived_count} survived` : null}
                      color="#d97706"
                    />
                    <PipelineArrow />
                    <PipelineStage
                      label="Weaning"
                      detail={season.weaning_date ? formatDate(season.weaning_date).split(' ').slice(1).join(' ') : '-'}
                      metric={season.weaned_count != null ? `${season.weaned_count} weaned` : null}
                      subMetric={null}
                      color="#047857"
                      isLast
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
              <h2 className="text-sm font-semibold text-stone-700 mb-3">Shearing Records</h2>
              <div className="overflow-x-auto border border-stone-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 border-b border-stone-200">
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
                    {shearingRecords.map((rec) => (
                      <tr key={rec.id} className="border-b border-stone-100">
                        <td className="px-4 py-2.5 text-stone-800">{formatDate(rec.date)}</td>
                        <td className="px-4 py-2.5 text-stone-600 hidden sm:table-cell">{rec.group_name ?? '-'}</td>
                        <td className="px-4 py-2.5 text-right text-stone-800">{rec.head_shorn ?? '-'}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-stone-800">{rec.total_fleece_kg?.toLocaleString() ?? '-'}</td>
                        <td className="px-4 py-2.5 text-right text-stone-600 hidden md:table-cell">{rec.avg_fleece_kg?.toFixed(1) ?? '-'}</td>
                        <td className="px-4 py-2.5 text-right text-stone-600 hidden md:table-cell">{rec.micron_avg ?? '-'}</td>
                        <td className="px-4 py-2.5 text-right text-stone-600 hidden lg:table-cell">{rec.yield_pct != null ? `${rec.yield_pct}%` : '-'}</td>
                        <td className="px-4 py-2.5 text-stone-600 hidden lg:table-cell">{rec.buyer ?? '-'}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-emerald-700 hidden sm:table-cell">{formatCurrency(rec.total_revenue)}</td>
                      </tr>
                    ))}
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
  metric,
  subMetric,
  color,
  isFirst,
  isLast,
}: {
  label: string;
  detail: string;
  metric: string | null;
  subMetric: string | null;
  color: string;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  return (
    <div
      className={`flex-1 min-w-[100px] p-3 text-center ${isFirst ? 'rounded-l-lg' : ''} ${isLast ? 'rounded-r-lg' : ''}`}
      style={{ backgroundColor: `${color}10`, borderTop: `3px solid ${color}` }}
    >
      <p className="text-xs font-bold" style={{ color }}>{label}</p>
      <p className="text-[10px] text-stone-400 mb-1">{detail}</p>
      {metric && <p className="text-xs font-medium text-stone-800">{metric}</p>}
      {subMetric && <p className="text-[10px] text-stone-500">{subMetric}</p>}
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
