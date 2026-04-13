import { useState } from 'react';
import { LayoutDashboard } from 'lucide-react';
import PageShell from '../components/layout/PageShell';
import PageHeader from '../components/layout/PageHeader';
import DashboardKPIs from '../components/dashboard/DashboardKPIs';
import DashboardWeather from '../components/dashboard/DashboardWeather';
import DashboardAlerts from '../components/dashboard/DashboardAlerts';
import DashboardFillLevels from '../components/dashboard/DashboardFillLevels';
import DashboardTasks from '../components/dashboard/DashboardTasks';
import DashboardActivity from '../components/dashboard/DashboardActivity';

const ENTERPRISES = ['All', 'Livestock', 'Rooibos', 'Wine', 'Crops/Rotation'] as const;

export default function Dashboard() {
  const [enterprise, setEnterprise] = useState<string>('All');

  return (
    <PageShell>
      <PageHeader icon={LayoutDashboard} title="Dashboard" />
      <div className="flex-1 overflow-y-auto page-fade-in">
        {/* Enterprise filter pills - sticky */}
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-[#f3f4f3] px-4 py-2 flex gap-2">
          {ENTERPRISES.map((e) => (
            <button
              key={e}
              onClick={() => setEnterprise(e)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                enterprise === e
                  ? 'bg-emerald-700 text-white'
                  : 'bg-[#f3f4f3] text-[#6e7a73] hover:bg-emerald-50'
              }`}
            >
              {e}
            </button>
          ))}
        </div>

        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
          <DashboardKPIs enterprise={enterprise} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DashboardWeather />
            <DashboardAlerts />
          </div>
          <DashboardFillLevels />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DashboardTasks />
            <DashboardActivity />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
