import FillLevelBar from '../shared/FillLevelBar';

// TODO: Replace with real data from storage/feed API
const MOCK_LEVELS = [
  { label: 'Feed: Ewes', current: 72 },
  { label: 'Feed: Rams', current: 45 },
  { label: 'Feed: Lambs', current: 88 },
  { label: 'Water: Main Tank', current: 60 },
  { label: 'Water: Portable', current: 25 },
  { label: 'Silo: Lupine Seed', current: 90 },
  { label: 'Silo: Rooibos Tea', current: 55 },
];

export default function DashboardFillLevels() {
  return (
    <div>
      <h3 className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#6e7a73] mb-3">
        Storage & Feed Levels
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {MOCK_LEVELS.map((level) => (
          <div key={level.label} className="bg-white rounded-2xl p-5">
            <FillLevelBar label={level.label} current={level.current} />
          </div>
        ))}
      </div>
    </div>
  );
}
