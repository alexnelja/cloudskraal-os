import { useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import type { LivestockGroup, ShearingRecord } from '../../types/phase2';
import LivestockOverview from './LivestockOverview';
import LivestockAnimals from './LivestockAnimals';
import LivestockShearing from './LivestockShearing';
import LivestockHealth from './LivestockHealth';

const TABS = ['Overview', 'Animals', 'Shearing', 'Health'] as const;
type Tab = typeof TABS[number];

interface Props {
  group: LivestockGroup;
  shearingRecords: ShearingRecord[];
  onShearingUpdate: (id: string, data: Partial<ShearingRecord>) => void;
  onClose: () => void;
}

export default function LivestockDetail({ group, shearingRecords, onShearingUpdate, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('Overview');

  // Filter shearing records for this group
  const groupShearing = shearingRecords.filter(
    (r) => r.group_name === group.name || r.group_id === group.id,
  );

  return (
    <div className="md:w-[420px] md:flex-shrink-0 border-t md:border-t-0 md:border-l border-[#f3f4f3] overflow-y-auto bg-white page-slide-in">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <button
          onClick={onClose}
          className="p-1 text-stone-400 hover:text-stone-600 md:hidden"
        >
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-lg font-bold text-stone-900 flex-1">{group.name}</h2>
        <button
          onClick={onClose}
          className="p-1 text-stone-400 hover:text-stone-600 hidden md:block"
        >
          <X size={18} />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-[#f3f4f3] px-4">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-xs font-medium transition-colors relative ${
              activeTab === tab
                ? 'text-emerald-700'
                : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            {tab}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-700 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'Overview' && <LivestockOverview group={group} />}
      {activeTab === 'Animals' && <LivestockAnimals groupName={group.name} />}
      {activeTab === 'Shearing' && (
        <LivestockShearing records={groupShearing} onUpdate={onShearingUpdate} />
      )}
      {activeTab === 'Health' && <LivestockHealth />}
    </div>
  );
}
