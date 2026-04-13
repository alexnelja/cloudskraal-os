import type { LivestockGroup } from '../../types/phase2';

const MGMT_COLORS: Record<string, string> = {
  breeding: '#7c3aed',
  fattening: '#d97706',
  replacement: '#2563eb',
  mixed: '#047857',
};

interface Props {
  group: LivestockGroup;
}

export default function LivestockOverview({ group }: Props) {
  // Mock condition distribution for the group
  const conditionDist = getConditionDistribution(group.name);

  return (
    <div className="p-4 space-y-4">
      {/* Stats summary */}
      <div className="bg-stone-50 rounded-lg p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-stone-500">Head Count</span>
          <span className="text-stone-800 font-medium">{group.head_count}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-stone-500">Avg Weight</span>
          <span className="text-stone-800 font-medium">
            {group.average_weight_kg != null ? `${group.average_weight_kg} kg` : '-'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-stone-500">Breed</span>
          <span className="text-stone-800">{group.breed ?? group.species}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-stone-500">Enterprise</span>
          <span className="text-stone-800">{group.enterprise}</span>
        </div>
        {group.management_type && (
          <div className="flex justify-between items-center">
            <span className="text-stone-500">Management</span>
            <span
              className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
              style={{ backgroundColor: MGMT_COLORS[group.management_type] ?? '#6b7280' }}
            >
              {group.management_type}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-stone-500">Avg Condition</span>
          <span className="text-stone-800 font-medium">{conditionDist.avg.toFixed(1)}</span>
        </div>
        {group.notes && (
          <div className="pt-2 border-t border-[#f3f4f3]">
            <p className="text-stone-500 text-xs mb-1">Notes</p>
            <p className="text-stone-700 text-xs">{group.notes}</p>
          </div>
        )}
      </div>

      {/* Condition distribution bar */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#6e7a73] mb-2">Condition Distribution</p>
        <div className="h-4 rounded-full overflow-hidden flex">
          {conditionDist.good > 0 && (
            <div
              className="h-full bg-emerald-600"
              style={{ width: `${conditionDist.good}%` }}
              title={`Good: ${conditionDist.good}%`}
            />
          )}
          {conditionDist.fair > 0 && (
            <div
              className="h-full bg-amber-500"
              style={{ width: `${conditionDist.fair}%` }}
              title={`Fair: ${conditionDist.fair}%`}
            />
          )}
          {conditionDist.poor > 0 && (
            <div
              className="h-full bg-red-500"
              style={{ width: `${conditionDist.poor}%` }}
              title={`Poor: ${conditionDist.poor}%`}
            />
          )}
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-stone-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-600" />
            Good {conditionDist.good}%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" />
            Fair {conditionDist.fair}%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
            Poor {conditionDist.poor}%
          </span>
        </div>
      </div>
    </div>
  );
}

/** Mock condition distribution per group name — will be replaced with real data */
function getConditionDistribution(groupName: string) {
  const distributions: Record<string, { good: number; fair: number; poor: number; avg: number }> = {
    'Breeding Ewes': { good: 72, fair: 22, poor: 6, avg: 3.4 },
    'Rams': { good: 85, fair: 12, poor: 3, avg: 3.8 },
    'Weaners': { good: 60, fair: 30, poor: 10, avg: 3.1 },
    'Replacement Ewes': { good: 78, fair: 18, poor: 4, avg: 3.5 },
  };
  return distributions[groupName] ?? { good: 68, fair: 24, poor: 8, avg: 3.3 };
}
