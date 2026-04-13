import {
  BookOpen,
  Wrench,
  BarChart3,
  Bug,
  Leaf,
  Truck,
  DollarSign,
  Landmark,
} from 'lucide-react';
import type { ElementType } from 'react';

interface ActivityItem {
  id: number;
  icon: ElementType;
  iconColor: string;
  description: string;
  timestamp: string;
}

// TODO: Replace with real activity feed from API
const MOCK_ACTIVITY: ActivityItem[] = [
  { id: 1, icon: BookOpen, iconColor: 'text-blue-500', description: 'Wiki: Updated "Rooibos Harvest Schedule" page', timestamp: '25m ago' },
  { id: 2, icon: Wrench, iconColor: 'text-amber-500', description: 'Equipment: Logged service for John Deere 5075E', timestamp: '1h ago' },
  { id: 3, icon: BarChart3, iconColor: 'text-emerald-500', description: 'Production: Recorded 120kg wool clip — Camp 2', timestamp: '2h ago' },
  { id: 4, icon: Bug, iconColor: 'text-red-500', description: 'Livestock: Treated 4 ewes for blue tongue', timestamp: '3h ago' },
  { id: 5, icon: Leaf, iconColor: 'text-green-600', description: 'Fields: Rooibos Block A marked as harvested', timestamp: '5h ago' },
  { id: 6, icon: Truck, iconColor: 'text-violet-500', description: 'Supply chain: Lupine seed delivery confirmed', timestamp: 'Yesterday' },
  { id: 7, icon: DollarSign, iconColor: 'text-emerald-600', description: 'Finance: R45,000 payment received — wool sale', timestamp: 'Yesterday' },
  { id: 8, icon: Landmark, iconColor: 'text-stone-500', description: 'Projects: Approved "Solar pump — Camp 7" capex', timestamp: '2 days ago' },
];

export default function DashboardActivity() {
  return (
    <div className="bg-white rounded-2xl p-5">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#6e7a73] mb-3">
        Recent Activity
      </h3>

      <div className="space-y-1">
        {MOCK_ACTIVITY.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className="flex items-start gap-3 px-2 py-2 hover:bg-[#f3f4f3] rounded-lg transition-colors"
            >
              <div className={`mt-0.5 shrink-0 ${item.iconColor}`}>
                <Icon size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#1a2e1a] leading-snug">{item.description}</p>
                <p className="text-[10px] text-[#6e7a73] mt-0.5">{item.timestamp}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
