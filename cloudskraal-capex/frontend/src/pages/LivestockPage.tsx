import { useState, useEffect, useCallback } from 'react';
import { Beef, TrendingUp, TrendingDown } from 'lucide-react';
import PageShell from '../components/layout/PageShell';
import PageHeader from '../components/layout/PageHeader';
import FillLevelBar from '../components/shared/FillLevelBar';
import LivestockDetail from '../components/livestock/LivestockDetail';
import EditableCell from '../components/EditableCell';
import { getLivestockGroups, getLivestockDashboard, getBreedingSeasons, getShearingRecords, updateLivestockGroup, updateBreedingSeason, updateShearingRecord } from '../api/livestock';
import type { LivestockGroup, LivestockDashboard, BreedingSeason, ShearingRecord } from '../types/phase2';

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

/** Mock feed fill-levels per group */
const FEED_LEVELS = [
  { label: 'Ewes - Lucerne', current: 72 },
  { label: 'Rams - Pellets', current: 45 },
  { label: 'Lambs - Creep feed', current: 88 },
  { label: 'Weaners - Mixed ration', current: 31 },
];

/** Status indicator color based on condition */
function groupStatusColor(group: LivestockGroup): string {
  const w = group.average_weight_kg;
  if (w == null) return '#6b7280';
  if (w >= 65) return '#047857';
  if (w >= 50) return '#d97706';
  return '#ba1a1a';
}

export default function LivestockPage() {
  const [dashboard, setDashboard] = useState<LivestockDashboard | null>(null);
  const [groups, setGroups] = useState<LivestockGroup[]>([]);
  const [breedingSeasons, setBreedingSeasons] = useState<BreedingSeason[]>([]);
  const [shearingRecords, setShearingRecords] = useState<ShearingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<LivestockGroup | null>(null);

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

  // KPI calculations
  const latestBreeding = breedingSeasons.length > 0 ? breedingSeasons[0] : null;
  const breedingRate = latestBreeding ? pct(latestBreeding.pregnant_count, latestBreeding.ewes_joined) : '-';
  const latestShearing = shearingRecords.length > 0 ? shearingRecords[0] : null;
  const nextShearingDate = latestShearing?.date
    ? formatDate(latestShearing.date)
    : '-';
  const avgCondition = groups.length > 0
    ? (groups.reduce((sum, g) => sum + (g.average_weight_kg ?? 0), 0) / groups.filter(g => g.average_weight_kg != null).length).toFixed(0) + ' kg'
    : '-';

  const handleShearingUpdate = useCallback((id: string, data: Partial<ShearingRecord>) => {
    setShearingRecords(prev => prev.map(r => r.id === id ? { ...r, ...data } : r));
    updateShearingRecord(id, data).catch(() => fetchData());
  }, [fetchData]);

  return (
    <PageShell>
      <PageHeader icon={Beef} title="Livestock Tracker" />

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-stone-400 text-sm">Loading livestock data...</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden page-fade-in">
          {/* Left Panel */}
          <div className="flex-1 overflow-y-auto bg-white">
            <div className="max-w-6xl mx-auto p-4 space-y-6">

              {/* KPI cards row */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                  label="Total Head Count"
                  value={String(dashboard?.totalHead ?? 0)}
                  delta="+12 this month"
                  deltaUp
                />
                <KpiCard
                  label="Breeding Rate"
                  value={breedingRate}
                  delta="vs 82% prev season"
                  deltaUp={breedingRate !== '-' && parseInt(breedingRate) >= 82}
                />
                <KpiCard
                  label="Avg Weight"
                  value={avgCondition}
                  delta="target 70 kg"
                  deltaUp={false}
                />
                <KpiCard
                  label="Latest Shearing"
                  value={nextShearingDate}
                  delta={latestShearing?.total_fleece_kg ? `${latestShearing.total_fleece_kg.toLocaleString()} kg total` : ''}
                />
              </div>

              {/* Fill-level bars for feed */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#6e7a73] mb-3">Feed Trough Status</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {FEED_LEVELS.map((f) => (
                    <FillLevelBar key={f.label} label={f.label} current={f.current} />
                  ))}
                </div>
              </div>

              {/* Flock Groups grid */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#6e7a73] mb-3">Flock Groups</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {groups.map((group) => (
                    <button
                      key={group.id}
                      onClick={() => setSelectedGroup(selectedGroup?.id === group.id ? null : group)}
                      className={`bg-white rounded-2xl p-5 text-left transition-all hover:shadow-sm border-2 ${
                        selectedGroup?.id === group.id
                          ? 'border-emerald-500'
                          : 'border-transparent hover:border-stone-200'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-bold text-stone-800">{group.name}</p>
                          <p className="text-xs text-stone-500">{group.breed ?? group.species}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-stone-900">{group.head_count}</p>
                          <p className="text-[10px] text-stone-400">head</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {group.average_weight_kg != null && (
                          <span className="text-xs text-stone-500">
                            {group.average_weight_kg} kg avg
                          </span>
                        )}
                        <span className="flex-1" />
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: groupStatusColor(group) }}
                        />
                        {group.management_type && (
                          <span
                            className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                            style={{ backgroundColor: MGMT_COLORS[group.management_type] ?? '#6b7280' }}
                          >
                            {group.management_type}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Breeding Pipeline -- stays in left panel as global view */}
              {breedingSeasons.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#6e7a73] mb-3">Breeding Tracker</p>
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

            </div>
          </div>

          {/* Right Detail Panel -- slides in when group selected */}
          {selectedGroup && (
            <LivestockDetail
              group={selectedGroup}
              shearingRecords={shearingRecords}
              onShearingUpdate={handleShearingUpdate}
              onClose={() => setSelectedGroup(null)}
            />
          )}
        </div>
      )}
    </PageShell>
  );
}

/* ── KPI Card ────────────────────────────────────────────── */

function KpiCard({ label, value, delta, deltaUp }: {
  label: string;
  value: string;
  delta?: string;
  deltaUp?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#6e7a73] mb-1">{label}</p>
      <p className="text-2xl font-bold text-stone-900">{value}</p>
      {delta && (
        <p className="flex items-center gap-1 text-xs text-stone-500 mt-1">
          {deltaUp != null && (
            deltaUp
              ? <TrendingUp size={12} className="text-emerald-600" />
              : <TrendingDown size={12} className="text-amber-600" />
          )}
          {delta}
        </p>
      )}
    </div>
  );
}

/* ── Pipeline Stage (kept from original) ─────────────────── */

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
